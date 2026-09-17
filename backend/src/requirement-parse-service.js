import { createHash } from 'node:crypto';
import { sanitizeAuditJson } from './audit.js';
import { AppError } from './errors.js';
import { routeRequirement } from './pipeline/chapter-router.js';
import {
  assertMandatoryRequirementMetadata,
  detectMandatoryScopeRules
} from './pipeline/mandatory-requirement.js';
import { classifyTenderSections } from './pipeline/tender-section-classifier.js';
import {
  aggregateRequirementCandidates,
  chunkExtractedText,
  resolveRequirementChunkBudget
} from './pipeline/requirement-chunker.js';
import {
  combineRequirementExtractionSections,
  validateCandidateSourceScope
} from './pipeline/requirement-scope-router.js';
import { SourceLocationResolver } from './pipeline/source-location-resolver.js';
import { summarizeSourceReadiness } from './requirement-source-service.js';
import { DocumentCapabilityDetector } from './pipeline/document-capability-detector.js';
import { clearUnverifiedLocation, deriveCandidateSourceStatus } from './pipeline/requirement-source-status.js';
import { requireFormalActorId } from './request-actor.js';
import {
  annotatePdfTableLayout,
  applyTableAnnotationsToChunks,
  applyTableAnnotationsToParagraphs,
  collectPdfLayout
} from './pipeline/pdf-table-layout-annotator.js';

const MAX_EXTRACTED_CHARACTERS = 300_000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function assertValidParseJobId(jobId) {
  if (!UUID_PATTERN.test(String(jobId || ''))) {
    throw new AppError('INVALID_JOB_ID', '需求解析任务 ID 格式无效。', 400);
  }
  return jobId;
}

function normalizeError(error) {
  if (error instanceof AppError) return error;
  if (error?.code && typeof error.message === 'string') {
    const normalized = new AppError(error.code, error.message, Number(error.status) || 502, error);
    normalized.audit = error.audit;
    return normalized;
  }
  return new AppError('TENDER_PARSE_FAILED', '招标需求解析失败，请稍后重试。', 500, error);
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function candidateAuditIdentity(candidate = {}) {
  return candidate.candidate_id ?? candidate.requirement_id ?? candidate.req_id ?? candidate.id ?? null;
}

function resolvedSourceSpanAudit(location = {}) {
  return {
    source_refs: Array.isArray(location.source_refs) ? [...location.source_refs] : [],
    source_hash: location.source_hash ?? null,
    source_page_start: location.source_page_start ?? location.source_page ?? null,
    source_page_end: location.source_page_end ?? location.source_page ?? null,
    source_paragraph_start: location.source_paragraph_start ?? location.source_paragraph ?? null,
    source_paragraph_end: location.source_paragraph_end ?? location.source_paragraph ?? null,
    source_start_offset: location.source_start_offset ?? null,
    source_end_offset: location.source_end_offset ?? null,
    source_match_type: location.source_match_type ?? null,
    source_resolution_status: location.source_resolution_status ?? null
  };
}

function scheduleImmediately(task) {
  setImmediate(task);
}

function isPdfDocument(tenderFile = {}) {
  return String(tenderFile.mime_type || '').toLowerCase() === 'application/pdf'
    || /\.pdf$/i.test(String(tenderFile.original_name || ''));
}

export class RequirementParseService {
  constructor({
    repository,
    storage,
    textExtractor,
    extractionGateway,
    logger = console,
    env = process.env,
    chunkBudget = resolveRequirementChunkBudget(env),
    capabilityDetector = new DocumentCapabilityDetector(),
    scheduler = scheduleImmediately,
    pdfLayoutCollector = collectPdfLayout,
    pdfTableAnnotator = annotatePdfTableLayout,
    tableParagraphApplier = applyTableAnnotationsToParagraphs,
    scopeValidator = validateCandidateSourceScope
  }) {
    this.repository = repository;
    this.storage = storage;
    this.textExtractor = textExtractor;
    this.extractionGateway = extractionGateway;
    this.logger = logger;
    this.chunkBudget = chunkBudget;
    this.capabilityDetector = capabilityDetector;
    this.scheduler = scheduler;
    this.pdfLayoutCollector = pdfLayoutCollector;
    this.pdfTableAnnotator = pdfTableAnnotator;
    this.tableParagraphApplier = tableParagraphApplier;
    this.scopeValidator = scopeValidator;
    this.sourceLocationResolver = new SourceLocationResolver();
  }

  async start({ projectId, tenderFileId, waitForCompletion = false }) {
    const project = await this.repository.getProject(projectId);
    if (!project) throw new AppError('PROJECT_NOT_FOUND', '项目不存在。', 404);
    if (await this.repository.getRequirementBaseline(projectId)) {
      throw new AppError('REQUIREMENT_BASELINE_FROZEN', '需求基线已经确认，不能重新解析或替换。', 409);
    }
    const tenderFile = await this.repository.getTenderFile(tenderFileId);
    if (!tenderFile || tenderFile.project_id !== projectId) {
      throw new AppError('TENDER_FILE_NOT_FOUND', '招标文件不存在或不属于当前项目。', 404);
    }

    const job = await this.repository.createParseJob({ projectId, tenderFileId });
    const runningJob = await this.repository.updateParseJob(job.id, 'running', { phase: 'text_extraction' });
    if (waitForCompletion) return this.processJob({ job: runningJob || job, tenderFile, project });

    this.scheduler(() => {
      this.processJob({ job: runningJob || job, tenderFile, project }).catch((error) => {
        this.logger.error('Tender parse background task failed', {
          parseJobId: job.id,
          errorCode: error?.code || 'TENDER_PARSE_FAILED'
        });
      });
    });
    return {
      ...(runningJob || job), status: 'running', phase: 'text_extraction',
      file_name: tenderFile.original_name, total_chunks: 0, completed_chunks: 0
    };
  }

  async processJob({ job, tenderFile, project = null }) {
    if (typeof this.repository.claimParseJob === 'function') {
      const claimed = await this.repository.claimParseJob(job.id);
      if (!claimed) return this.repository.getParseJob(job.id);
      job = claimed;
    }
    const startedAt = Date.now();
    let extraction;
    let sectionAnalysis;
    let mandatoryScopeRules = [];
    let chunks = [];
    let failedChunkNumber = null;
    try {
      const buffer = await this.storage.read(tenderFile.storage_key);
      this.capabilityDetector.assertSupported(this.capabilityDetector.detect({
        fileName: tenderFile.original_name, mimeType: tenderFile.mime_type, buffer
      }));
      try {
        extraction = await this.textExtractor({
          fileName: tenderFile.original_name, mimeType: tenderFile.mime_type, buffer
        });
      } catch (extractionError) {
        this.capabilityDetector.assertSupported(this.capabilityDetector.detect({
          fileName: tenderFile.original_name, mimeType: tenderFile.mime_type, buffer, extractionError
        }));
        throw extractionError;
      }
      const documentCapability = this.capabilityDetector.assertSupported(this.capabilityDetector.detect({
        fileName: tenderFile.original_name, mimeType: tenderFile.mime_type, buffer, extraction
      }));
      if (extraction.text.length > MAX_EXTRACTED_CHARACTERS) {
        throw new AppError(
          'TENDER_TEXT_TOO_LARGE',
          `提取文本超过 ${MAX_EXTRACTED_CHARACTERS.toLocaleString('zh-CN')} 字符，请拆分文件后重试。`,
          422
        );
      }

      const extractedTextSha256 = sha256(extraction.text);
      await this.repository.updateParseJobProgress({
        jobId: job.id,
        phase: 'section_classification',
        extractedTextSha256,
        extractedCharacterCount: extraction.text.length
      });
      sectionAnalysis = classifyTenderSections(extraction);
      const extractionScope = sectionAnalysis.technicalSection
          ? combineRequirementExtractionSections(sectionAnalysis.sections, { includeNonScoringSections: true })
          || sectionAnalysis.requirementExtractionSections?.find((section) => (
            section.section_key === 'technical_requirements'
          )) || sectionAnalysis.technicalSection
        : null;
      if (!extractionScope) {
        throw new AppError('NO_TECHNICAL_REQUIREMENTS_FOUND', '未识别到可处理的技术或项目需求章节。', 422);
      }
      mandatoryScopeRules = detectMandatoryScopeRules(extractionScope);
      await this.repository.saveParseDocumentAnalysis({
        jobId: job.id,
        sections: sectionAnalysis.sections,
        mandatoryScopeRules
      });
      const extractionSummary = {
        file_name: tenderFile.original_name,
        page_count: extraction.pages.length || null,
        paragraph_count: extraction.paragraphs.length,
        character_count: extraction.text.length,
        extraction_section: extractionScope.title,
        extraction_section_character_count: extractionScope.character_count,
        used_fulltext_fallback: sectionAnalysis.usedFullTextFallback,
        document_capability: documentCapability
      };
      await this.repository.updateParseJobProgress({
        jobId: job.id, phase: 'chunking', summary: extractionSummary,
        extractedTextSha256, extractedCharacterCount: extraction.text.length
      });

      // Layout is auxiliary evidence for deterministic table boundaries only.
      // Canonical extracted text, paragraph numbering and source provenance are
      // never regenerated or persisted from this path.  Table metadata is
      // overlaid after chunking so the existing Cxxx-Sxxx windows remain exact.
      let annotatedParagraphs = extractionScope.paragraphs;
      if (isPdfDocument(tenderFile) && this.pdfLayoutCollector) {
        try {
          const pages = [...new Set(extractionScope.paragraphs
            .map((paragraph) => Number(paragraph.page))
            .filter((page) => Number.isInteger(page) && page > 0))];
          const layout = await this.pdfLayoutCollector(buffer, { pages });
          const tableAnnotations = this.pdfTableAnnotator({
            paragraphs: extractionScope.paragraphs,
            layout
          });
          annotatedParagraphs = this.tableParagraphApplier(
            extractionScope.paragraphs,
            tableAnnotations.rows,
            tableAnnotations.headers
          );
          if (tableAnnotations.ambiguous_rows > 0) {
            this.logger.warn?.('Ambiguous PDF table rows left on ordinary paragraph path', {
              parseJobId: job.id, ambiguousRows: tableAnnotations.ambiguous_rows
            });
          }
        } catch (layoutError) {
          this.logger.warn?.('PDF layout annotation unavailable; using canonical paragraph path', {
            parseJobId: job.id,
            errorCode: layoutError?.code || 'PDF_LAYOUT_ANNOTATION_UNAVAILABLE'
          });
        }
      }

      chunks = chunkExtractedText({
        text: extractionScope.content_text,
        paragraphs: extractionScope.paragraphs,
        singleCallThreshold: this.chunkBudget.singleCallThreshold,
        characterBudget: this.chunkBudget.characterBudget,
        tokenBudget: this.chunkBudget.tokenBudget,
        sourceSpanBudget: this.chunkBudget.sourceSpanBudget
      }).map((chunk) => ({ ...chunk, content_sha256: sha256(chunk.text) }));
      if (annotatedParagraphs !== extractionScope.paragraphs) {
        chunks = applyTableAnnotationsToChunks(chunks, annotatedParagraphs);
      }
      const persistedChunks = await this.repository.initializeParseChunks(job.id, chunks);
      if (Array.isArray(persistedChunks)) {
        const ids = new Map(persistedChunks.map((item) => [item.chunk_number, item.id]));
        chunks = chunks.map((chunk) => ({ ...chunk, id: ids.get(chunk.chunk_number) || null }));
      }

      const chunkResults = new Array(chunks.length);
      const chunkWarnings = new Array(chunks.length).fill(null).map(() => []);
      const concurrency = Math.min(2, chunks.length);
      let nextChunkIndex = 0;
      let firstFailure = null;

      const processChunk = async (chunk, chunkIndex) => {
        const chunkStartedAt = Date.now();
        try {
          await this.repository.startParseChunk(job.id, chunk.chunk_number);
          const gatewayResult = await this.extractionGateway.extract({
            fileName: tenderFile.original_name, text: chunk.text,
            paragraphs: chunk.segments, chunk,
            projectName: project?.name || project?.project_name || project?.title || tenderFile.original_name,
            sectionName: extractionScope.title,
            chunkCount: chunks.length
          });
          const rawCandidates = Array.isArray(gatewayResult.candidates) ? gatewayResult.candidates : [];
          const scopeAudit = {
            chunk_id: chunk.id ?? chunk.chunk_id ?? null,
            chunk_number: chunk.chunk_number,
            raw_candidates: rawCandidates.length,
            scope_accepted: 0,
            scope_rejected: 0,
            rejections: []
          };
          const resolvedCandidates = [];
          for (const [index, candidate] of rawCandidates.entries()) {
            const resolution = this.sourceLocationResolver.resolve(candidate, chunk);
            try {
              this.scopeValidator(candidate, chunk);
              scopeAudit.scope_accepted += 1;
              resolvedCandidates.push({ candidate, candidateIndex: index + 1, resolution });
            } catch (scopeError) {
              const normalizedScopeError = normalizeError(scopeError);
              if (normalizedScopeError.code !== 'REQUIREMENT_SCOPE_EXCLUDED') throw scopeError;
              scopeAudit.scope_rejected += 1;
              scopeAudit.rejections.push({
                chunk_id: chunk.id ?? chunk.chunk_id ?? null,
                chunk_number: chunk.chunk_number,
                candidate_index: index + 1,
                candidate_identity: candidateAuditIdentity(candidate),
                resolved_source_span: resolvedSourceSpanAudit(resolution.location),
                source_role: Array.isArray(scopeError.scope_roles)
                  ? [...scopeError.scope_roles]
                  : Array.isArray(scopeError.details?.scope_roles) ? [...scopeError.details.scope_roles] : [],
                scope_decision: 'OUT_OF_SCOPE',
                rejection_reason: 'REQUIREMENT_SCOPE_EXCLUDED',
                scope_reason: scopeError.scope_reason ?? null,
                non_applicability_source_ref: scopeError.non_applicability_source_ref ?? null,
                source_hash: resolution.location.source_hash ?? null
              });
            }
          }
          scopeAudit.outcome = rawCandidates.length === 0
            ? 'SUCCESS_EMPTY'
            : resolvedCandidates.length === 0
              ? 'SUCCESS_EMPTY_AFTER_SCOPE_FILTER'
              : 'SUCCESS';
          const candidates = resolvedCandidates.map(({ candidate, resolution }) => ({
            ...candidate, ...resolution.location
          }));
          const runtimeMs = Date.now() - chunkStartedAt;
          const sanitizedGatewayAudit = sanitizeAuditJson(gatewayResult.audit);
          await this.repository.completeParseChunk({
            jobId: job.id, chunkNumber: chunk.chunk_number,
            candidateCount: candidates.length, runtimeMs,
            gatewayAudit: {
              ...(sanitizedGatewayAudit && typeof sanitizedGatewayAudit === 'object' && !Array.isArray(sanitizedGatewayAudit)
                ? sanitizedGatewayAudit : {}),
              scope_audit: scopeAudit
            }
          });
          chunkWarnings[chunkIndex].push(...(gatewayResult.warnings || []).map((warning) => ({
            ...warning, chunk_number: chunk.chunk_number
          })));
          chunkWarnings[chunkIndex].push(...resolvedCandidates.filter(({ resolution }) => resolution.warning).map(({ candidateIndex, resolution }) => ({
            ...resolution.warning, chunk_number: chunk.chunk_number,
            candidate_index: candidateIndex
          })));
          chunkResults[chunkIndex] = { chunk_number: chunk.chunk_number, candidates, scope_audit: scopeAudit };
        } catch (caught) {
          const error = normalizeError(caught);
          const runtimeMs = Date.now() - chunkStartedAt;
          try {
            await this.repository.failParseChunk({
              jobId: job.id, chunkNumber: chunk.chunk_number,
              errorCode: error.code, errorMessage: error.message, runtimeMs,
              gatewayAudit: sanitizeAuditJson(caught?.audit)
            });
          } catch (persistenceError) {
            this.logger.error('Tender parse chunk failure audit failed', {
              parseJobId: job.id, chunkNumber: chunk.chunk_number,
              errorCode: persistenceError?.code || 'PARSE_CHUNK_FAILURE_AUDIT_FAILED'
            });
          }
          error.failedChunkNumber = chunk.chunk_number;
          error.chunkRuntimeMs = runtimeMs;
          throw error;
        }
      };

      const worker = async () => {
        while (!firstFailure) {
          const chunkIndex = nextChunkIndex++;
          if (chunkIndex >= chunks.length) return;
          const chunk = chunks[chunkIndex];
          try {
            await processChunk(chunk, chunkIndex);
          } catch (error) {
            if (!firstFailure) {
              firstFailure = error;
              failedChunkNumber = error.failedChunkNumber ?? chunk.chunk_number;
            }
            return;
          }
        }
      };

      await Promise.all(Array.from({ length: concurrency }, () => worker()));
      if (firstFailure) throw firstFailure;

      const warnings = [...extraction.warnings, ...sectionAnalysis.warnings];
      for (const warningList of chunkWarnings) warnings.push(...warningList);

      failedChunkNumber = null;
      await this.repository.updateParseJobProgress({
        jobId: job.id, phase: 'aggregating',
        totalChunks: chunks.length, completedChunks: chunks.length
      });
      const candidates = aggregateRequirementCandidates(chunkResults, { mandatoryScopeRules, documentText: extraction.text });
      return await this.repository.completeParseJob({
        jobId: job.id,
        candidates,
        summary: {
          ...extractionSummary, chunk_count: chunks.length,
          single_call_threshold: this.chunkBudget.singleCallThreshold,
          character_budget: this.chunkBudget.characterBudget,
          token_budget: this.chunkBudget.tokenBudget,
          source_span_budget: this.chunkBudget.sourceSpanBudget,
          empty_chunk_count: chunkResults.filter((result) => result.candidates.length === 0).length,
          raw_candidate_count: chunkResults.reduce((total, result) => total + (result.scope_audit?.raw_candidates || 0), 0),
          scope_accepted_count: chunkResults.reduce((total, result) => total + (result.scope_audit?.scope_accepted || 0), 0),
          scope_rejected_count: chunkResults.reduce((total, result) => total + (result.scope_audit?.scope_rejected || 0), 0),
          success_empty_count: chunkResults.filter((result) => result.scope_audit?.outcome === 'SUCCESS_EMPTY').length,
          success_empty_after_scope_filter_count: chunkResults.filter((result) => result.scope_audit?.outcome === 'SUCCESS_EMPTY_AFTER_SCOPE_FILTER').length,
          requirement_count: candidates.length,
          canonicalization_audit: candidates.audit
        },
        warnings,
        gatewayAudit: {
          provider: 'semantic_gateway', task_type: 'requirement_extraction',
          processing: 'bounded_concurrency', concurrency, chunk_count: chunks.length
        },
        extractedTextSha256,
        extractedCharacterCount: extraction.text.length,
        runtimeMs: Date.now() - startedAt
      });
    } catch (caught) {
      const error = normalizeError(caught);
      const actualFailedChunk = error.failedChunkNumber ?? failedChunkNumber;
      const safeMessage = actualFailedChunk
        ? `分片 ${actualFailedChunk}/${chunks.length} 处理失败：${error.message}`
        : error.message;
      try {
        await this.repository.failParseJob({
          jobId: job.id, errorCode: error.code, errorMessage: safeMessage,
          warnings: [...(extraction?.warnings || []), ...(sectionAnalysis?.warnings || [])],
          gatewayAudit: sanitizeAuditJson(caught?.audit),
          extractedTextSha256: extraction?.text ? sha256(extraction.text) : null,
          extractedCharacterCount: extraction?.text?.length ?? null,
          runtimeMs: Date.now() - startedAt,
          failedChunkNumber: actualFailedChunk,
          summary: {
            chunk_count: chunks.length, failed_chunk_number: actualFailedChunk,
            failed_chunk_runtime_ms: error.chunkRuntimeMs ?? null
          }
        });
      } catch (auditError) {
        this.logger.error('Failed to persist tender parse audit', {
          parseJobId: job.id, errorCode: error.code,
          auditError: auditError instanceof Error ? auditError.message : String(auditError)
        });
      }
      throw error;
    }
  }

  async get(jobId) {
    assertValidParseJobId(jobId);
    const job = await this.repository.getParseJob(jobId);
    if (!job) throw new AppError('TENDER_PARSE_JOB_NOT_FOUND', '需求解析任务不存在。', 404);
    return job;
  }

  async confirm(jobId, input = {}) {
    assertValidParseJobId(jobId);
    const job = await this.repository.getParseJob(jobId);
    if (!job) throw new AppError('TENDER_PARSE_JOB_NOT_FOUND', '需求解析任务不存在。', 404);
    if (job.status !== 'succeeded') {
      throw new AppError('TENDER_PARSE_NOT_READY', '仅全部分片成功并完成汇总校验的解析任务可以确认需求基线。', 409);
    }
    if (!job.candidates?.length) {
      throw new AppError('REQUIREMENTS_REQUIRED', '解析任务没有可确认的候选需求。', 422);
    }
    const readiness = summarizeSourceReadiness(job.candidates);
    if (readiness.mandatory_provisional_pending) {
      throw new AppError('MANDATORY_PROVISIONAL_CONFIRMATION_REQUIRED', `仍有 ${readiness.mandatory_provisional_pending} 条来源未定位的实质性要求，必须逐条人工确认或排除。`, 422);
    }
    if (readiness.pending) {
      throw new AppError('CANDIDATE_DECISIONS_PENDING', `仍有 ${readiness.pending} 条候选尚未人工处理，不能确认基线。`, 422);
    }
    if (!readiness.included) {
      throw new AppError('INCLUDED_REQUIREMENTS_REQUIRED', '至少需要保留一条候选需求。', 422);
    }
    const confirmedBy = requireFormalActorId(input.confirmed_by);
    let requirements;
    try {
      requirements = job.candidates.filter((candidate) => candidate.candidate_decision === undefined || candidate.candidate_decision === 'include').map((candidate) => {
        assertMandatoryRequirementMetadata(candidate);
        const sourceStatus = deriveCandidateSourceStatus(candidate);
        if (sourceStatus === 'provisional' && !candidate.confirmed_at) {
          throw new AppError('PROVISIONAL_CONFIRMATION_REQUIRED', `${candidate.req_id} 必须明确确认后才能进入暂定基线。`, 422);
        }
        if (candidate.is_mandatory && sourceStatus === 'provisional' && candidate.confirmation_type !== 'provisional_individual') {
          throw new AppError('MANDATORY_PROVISIONAL_CONFIRMATION_REQUIRED', `${candidate.req_id} 为实质性要求，必须逐条人工确认。`, 422);
        }
        return {
          ...clearUnverifiedLocation(candidate), source_status: sourceStatus,
          target_sections: routeRequirement({ req_id: candidate.req_id, text: candidate.content })
        };
      });
    } catch (error) {
      throw new AppError(
        error.code || 'REQUIREMENT_MANDATORY_METADATA_INVALID',
        error.message || 'Requirement mandatory 信息校验失败。',
        422,
        error
      );
    }
    try {
      return await this.repository.confirmRequirementBaseline({ jobId, requirements, confirmedBy });
    } catch (error) {
      if (error?.code === 'REQUIREMENT_BASELINE_FROZEN' || error?.code === '23505') {
        throw new AppError('REQUIREMENT_BASELINE_FROZEN', '需求基线已经确认，不能增删改合并。', 409);
      }
      throw error;
    }
  }
}
