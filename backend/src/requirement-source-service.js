import { createHash } from 'node:crypto';
import { AppError } from './errors.js';
import { classifyTenderSections } from './pipeline/tender-section-classifier.js';
import { hashSource, SourceLocationResolver } from './pipeline/source-location-resolver.js';
import { combineRequirementExtractionSections } from './pipeline/requirement-scope-router.js';
import { requireFormalActorId } from './request-actor.js';

export const TENDER_EXTRACTOR_VERSION = 'tender-text-extractor/pdf-parse-2.4.5/v1';
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SOURCE_STATUSES = new Set(['verified', 'provisional', 'excluded']);
const REQUIREMENT_CATEGORIES = new Set(['technical','performance','implementation','delivery','service','contractual','commercial','qualification','context']);
const WRITER_CATEGORIES = new Set(['technical','performance','implementation','delivery','service']);

function assertUuid(value, code, message) {
  if (!UUID_PATTERN.test(String(value || ''))) throw new AppError(code, message, 400);
}

function paragraphsWithOffsets(text, paragraphs) {
  let cursor = 0;
  return paragraphs.map((paragraph) => {
    const value = String(paragraph.text || '').trim();
    let start = text.indexOf(value, cursor);
    if (start < 0) throw new AppError('EXTRACTED_TEXT_SNAPSHOT_MISMATCH', '重新提取的段落无法映射到全文快照，已停止来源回填。', 409);
    const end = start + value.length;
    cursor = end;
    return { ...paragraph, text: value, source_start_offset: start, source_end_offset: end };
  });
}

function sourceUpdate(candidate, resolution) {
  const location = resolution.location;
  const verified = location.source_verified === true;
  return {
    id: candidate.id, ...location, source_status: verified ? 'verified' : 'provisional',
    candidate_decision: verified ? 'include' : (candidate.candidate_decision === 'exclude' ? 'exclude' : 'pending'),
    decision_reason: verified ? 'deterministic_source_reconciliation' : candidate.decision_reason,
    warning: resolution.warning
  };
}

export class RequirementSourceService {
  constructor({ repository, storage, textExtractor, resolver = new SourceLocationResolver(), clock = () => new Date() }) {
    this.repository = repository; this.pool = repository.pool; this.storage = storage;
    this.textExtractor = textExtractor; this.resolver = resolver; this.clock = clock;
  }

  async reconcileRequirementSources(parseJobId) {
    assertUuid(parseJobId, 'INVALID_JOB_ID', '需求解析任务 ID 格式无效。');
    const context = await this.repository.getSourceReconciliationContext(parseJobId);
    if (!context) throw new AppError('TENDER_PARSE_JOB_NOT_FOUND', '需求解析任务不存在。', 404);
    if (context.job.status !== 'succeeded') throw new AppError('TENDER_PARSE_NOT_READY', '仅成功任务可离线重算来源。', 409);
    const buffer = await this.storage.read(context.file.storage_key);
    if (buffer.length !== Number(context.file.size_bytes)) throw new AppError('TENDER_FILE_HASH_MISMATCH', '招标文件大小与数据库记录不一致，已停止来源回填。', 409);
    const fileHash = sha256(buffer);
    if (context.previous_file_hash && context.previous_file_hash !== fileHash) {
      throw new AppError('TENDER_FILE_HASH_MISMATCH', '招标文件哈希与既有快照不一致，已停止来源回填。', 409);
    }
    const extraction = await this.textExtractor({ fileName: context.file.original_name, mimeType: context.file.mime_type, buffer });
    const extractedTextHash = sha256(extraction.text);
    if (extractedTextHash !== context.job.extracted_text_sha256) {
      throw new AppError('EXTRACTED_TEXT_HASH_MISMATCH', '重新提取的文本哈希与原解析任务不一致，已停止来源回填。', 409);
    }
    const analysis = classifyTenderSections(extraction);
    if (context.technical_section?.content_sha256 !== analysis.technicalSection.content_sha256) {
      throw new AppError('SECTION_TEXT_HASH_MISMATCH', '重新提取的技术章节与原归档章节不一致，已停止来源回填。', 409);
    }
    const paragraphs = paragraphsWithOffsets(extraction.text, extraction.paragraphs);
    const requirementScope = combineRequirementExtractionSections(analysis.sections, { includeNonScoringSections: true })
      || analysis.technicalSection;
    const chunkById = new Map(context.chunks.map((chunk) => [chunk.id, chunk]));
    const updates = context.candidates.map((candidate) => {
      const chunk = chunkById.get(candidate.source_chunk_id);
      const scopeParagraphs = requirementScope?.paragraphs || analysis.technicalSection?.paragraphs || paragraphs;
      const scoped = chunk
        ? scopeParagraphs.filter((item) => {
          const hasParagraphBounds = Number.isInteger(chunk.source_start_paragraph)
            && Number.isInteger(chunk.source_end_paragraph)
            && Number.isInteger(item.paragraph);
          const hasOffsets = Number.isInteger(chunk.source_start_offset)
            && Number.isInteger(chunk.source_end_offset);
          return hasParagraphBounds
            ? item.paragraph >= chunk.source_start_paragraph
              && item.paragraph <= chunk.source_end_paragraph
            : hasOffsets
              ? item.source_end_offset > chunk.source_start_offset
                && item.source_start_offset < chunk.source_end_offset
              : false;
        })
        : analysis.technicalSection?.paragraphs || scopeParagraphs;
      const segments = scoped.map((item, index) => ({
        ...item,
        source_ref: `C${String(chunk?.chunk_number || 1).padStart(3, '0')}-S${String(index + 1).padStart(3, '0')}`,
        source_section: item.source_section || requirementScope?.title || analysis.technicalSection?.title || null,
        source_clause_id: item.source_clause_id || null
      }));
      const persistedSources = Array.isArray(candidate.sources_json) ? candidate.sources_json : [];
      const sourceRefs = Array.isArray(candidate.source_refs)
        ? candidate.source_refs
        : persistedSources.flatMap((source) => Array.isArray(source?.source_refs) ? source.source_refs : []);
      const sourceRange = sourceRefs.length
        ? { start_ref: sourceRefs[0], end_ref: sourceRefs.at(-1) }
        : null;
      return sourceUpdate(candidate, this.resolver.resolve({ source_range: sourceRange }, {
        id: candidate.source_chunk_id, chunk_number: chunk?.chunk_number, segments
      }));
    });
    const stats = updates.reduce((result, item) => {
      result.total += 1;
      if (item.source_resolution_status === 'verified') result.verified += 1;
      else if (item.source_resolution_status === 'suggested') result.suggested += 1;
      else result.unresolved += 1;
      if (item.source_verified && item.source_paragraph_start === item.source_paragraph_end) result.single_paragraph += 1;
      if (item.source_verified && item.source_paragraph_start !== item.source_paragraph_end) result.multi_paragraph += 1;
      return result;
    }, { total: 0, verified: 0, suggested: 0, unresolved: 0, single_paragraph: 0, multi_paragraph: 0 });
    stats.mandatory_unresolved = updates.filter((item, index) => context.candidates[index].is_mandatory && !item.source_verified).length;
    await this.repository.saveSourceReconciliation({
      parseJobId, tenderFileId: context.file.id, paragraphs, updates, fileHash,
      extractedTextHash, extractorVersion: TENDER_EXTRACTOR_VERSION,
      extractedAt: this.clock(), statistics: stats
    });
    return { parse_job_id: parseJobId, file_hash: fileHash, extracted_text_hash: extractedTextHash, statistics: stats };
  }

  async getCandidateReview(candidateId) {
    assertUuid(candidateId, 'INVALID_CANDIDATE_ID', '候选需求 ID 格式无效。');
    const context = await this.repository.getCandidateSourceReview(candidateId);
    if (!context) throw new AppError('REQUIREMENT_CANDIDATE_NOT_FOUND', '候选需求不存在。', 404);
    return context;
  }

  async listCandidates(parseJobId, input = {}) {
    assertUuid(parseJobId, 'INVALID_JOB_ID', '需求解析任务 ID 格式无效。');
    const sourceStatus = input.source_status ? String(input.source_status) : null;
    if (sourceStatus && !SOURCE_STATUSES.has(sourceStatus)) throw new AppError('SOURCE_STATUS_INVALID', '来源状态筛选值无效。', 400);
    const result = await this.repository.listRequirementCandidates(parseJobId, sourceStatus);
    if (!result) throw new AppError('TENDER_PARSE_JOB_NOT_FOUND', '需求解析任务不存在。', 404);
    return result;
  }

  async getConfirmationRisk(parseJobId) {
    assertUuid(parseJobId, 'INVALID_JOB_ID', '需求解析任务 ID 格式无效。');
    const result = await this.repository.getRequirementConfirmationRisk(parseJobId);
    if (!result) throw new AppError('TENDER_PARSE_JOB_NOT_FOUND', '需求解析任务不存在。', 404);
    return result;
  }

  async setCandidateStatus(candidateId, input = {}) {
    assertUuid(candidateId, 'INVALID_CANDIDATE_ID', '候选需求 ID 格式无效。');
    const sourceStatus = String(input.source_status || '');
    if (!SOURCE_STATUSES.has(sourceStatus)) throw new AppError('SOURCE_STATUS_INVALID', 'source_status 必须为 verified、provisional 或 excluded。', 422);
    return this.repository.setCandidateSourceStatus({ candidateId, sourceStatus, confirmedBy: requireFormalActorId(input.confirmed_by) });
  }

  async confirmProvisional(candidateId, input = {}) {
    assertUuid(candidateId, 'INVALID_CANDIDATE_ID', '候选需求 ID 格式无效。');
    return this.repository.saveCandidateProvisionalDecision({ candidateId, confirmedBy: requireFormalActorId(input.confirmed_by) });
  }

  async excludeCandidate(candidateId, input = {}) {
    assertUuid(candidateId, 'INVALID_CANDIDATE_ID', '候选需求 ID 格式无效。');
    return this.repository.saveCandidateSourceDecision({ candidateId, action: 'exclude', reason: String(input.reason || '').trim() || '人工排除', confirmedBy: requireFormalActorId(input.confirmed_by) });
  }

  async restoreCandidate(candidateId, input = {}) {
    assertUuid(candidateId, 'INVALID_CANDIDATE_ID', '候选需求 ID 格式无效。');
    return this.repository.restoreCandidate(candidateId, requireFormalActorId(input.confirmed_by));
  }

  async updateClassification(candidateId, input = {}) {
    assertUuid(candidateId, 'INVALID_CANDIDATE_ID', '候选需求 ID 格式无效。');
    const category = String(input.requirement_category || '');
    if (!REQUIREMENT_CATEGORIES.has(category)) throw new AppError('REQUIREMENT_CATEGORY_INVALID', '需求用途分类无效。', 422);
    const confirmedBy = requireFormalActorId(input.confirmed_by);
    const result = await this.repository.updateCandidateClassification({ candidateId, requirementCategory: category, writerEligible: WRITER_CATEGORIES.has(category), confirmedBy });
    if (!result) throw new AppError('REQUIREMENT_CANDIDATE_NOT_FOUND', '候选需求不存在或基线已冻结。', 404);
    return result;
  }

  async decideCandidateSource(candidateId, input) {
    assertUuid(candidateId, 'INVALID_CANDIDATE_ID', '候选需求 ID 格式无效。');
    const confirmedBy = requireFormalActorId(input?.confirmed_by);
    if (input.action === 'exclude') {
      return this.repository.saveCandidateSourceDecision({ candidateId, action: 'exclude', reason: String(input.reason || '').trim() || '人工排除', confirmedBy });
    }
    if (input.action === 'include_provisional') {
      return this.repository.saveCandidateProvisionalDecision({ candidateId, confirmedBy });
    }
    if (input.action !== 'associate') throw new AppError('SOURCE_DECISION_INVALID', '来源处理动作无效。', 400);
    const start = Number(input.source_paragraph_start); const end = Number(input.source_paragraph_end);
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start || end - start > 50) {
      throw new AppError('SOURCE_RANGE_INVALID', '请选择有效且连续的原文段落范围。', 400);
    }
    const paragraphs = await this.repository.getCandidateParagraphRange(candidateId, start, end);
    if (!paragraphs.length || paragraphs[0].paragraph_number !== start || paragraphs.at(-1).paragraph_number !== end || paragraphs.length !== end - start + 1) {
      throw new AppError('SOURCE_RANGE_INVALID', '所选段落范围不完整或不属于当前文件。', 400);
    }
    const original = paragraphs.map((item) => item.text).join('\n');
    return this.repository.saveCandidateSourceDecision({
      candidateId, action: 'associate', reason: String(input.reason || '').trim() || '人工关联来源', confirmedBy,
      location: {
        source_page: paragraphs[0].page_number, source_paragraph: start,
        source_page_start: paragraphs[0].page_number, source_page_end: paragraphs.at(-1).page_number,
        source_paragraph_start: start, source_paragraph_end: end,
        source_paragraphs_json: paragraphs.map((item) => ({ paragraph: item.paragraph_number, page: item.page_number, text_hash: item.text_hash })),
        source_hash: hashSource(original), source_match_type: 'manual', source_match_score: 1,
        source_resolution_status: 'verified', source_resolution_method: 'manual', source_verified: true
      }
    });
  }

  async includeProvisionalBatch(parseJobId, input) {
    assertUuid(parseJobId, 'INVALID_JOB_ID', '需求解析任务 ID 格式无效。');
    const confirmedBy = requireFormalActorId(input?.confirmed_by);
    return this.repository.includeProvisionalCandidates({ parseJobId, confirmedBy });
  }
}

export function summarizeSourceReadiness(candidates) {
  const decision = (item) => Object.hasOwn(item, 'candidate_decision') ? item.candidate_decision : 'include';
  const verified = (item) => Object.hasOwn(item, 'source_verified') ? item.source_verified === true : true;
  const included = candidates.filter((item) => decision(item) === 'include');
  return {
    pending: candidates.filter((item) => decision(item) === 'pending').length,
    included: included.length,
    excluded: candidates.filter((item) => decision(item) === 'exclude').length,
    mandatory_unverified: candidates.filter((item) => item.is_mandatory && !verified(item) && decision(item) !== 'exclude').length,
    mandatory_provisional_pending: candidates.filter((item) => item.is_mandatory && !verified(item) && decision(item) === 'pending').length,
    included_unverified: included.filter((item) => !verified(item)).length
  };
}
