import { normalizeEvidenceFactTransportData } from '../../../packages/semantic-contracts/fact-transport-normalizer.js';

// Enterprise authority requires an explicit first-party capability statement.
// A publisher name, product name, or generic technical wording is not enough.
const ENTERPRISE_ATTRIBUTION = /(?:(?:我司|本公司|我们|(?:华为|Huawei)(?:云|Cloud|技术|Technologies)?|the company|we|our)[^。；;\n]{0,24}(?:提供|支持|具备|拥有|交付|部署|认证|provide|support|offer|have|deliver|deploy|certif))/i;
const EXPLICIT_CAPABILITY = /(?:提供|支持|具备|拥有|交付|部署|认证|通过|服务|solution|support|provide|offer|deliver|deploy|certif)/i;
const ENTERPRISE_RELATIONSHIP = /(?:提供|支持|具备|拥有|交付|部署|认证|通过|服务|推出|发布|创立|成立|参与|实施|建设|研发|开发|供应|运营|founded|established|launched|released|provide|support|offer|own|deliver|deploy|certif|develop|operate)/i;
const PRODUCT_OWNERSHIP = /(?:推出|发布|提供|拥有|自研|研发|开发|产品|服务|解决方案|platform|product|service|solution|launched|released|provides|offers|owned|developed)/i;
const EXTERNAL_OUTCOME_SUBJECT = /(?:社区|居民|园区|业主|客户|用户|人口|人群|项目|地点|组织|population|community|resident|office\s*park|customer|user|project|location|organization)/i;
const PRODUCT_OR_SERVICE_SUBJECT = /(?:产品|服务|解决方案|平台|系统|product|service|solution|platform|system)/i;

export function normalizeFactTransportCandidate(candidate) {
  const result = normalizeEvidenceFactTransportData({ facts: [candidate] });
  const quantities = Array.isArray(result.data?.facts?.[0]?.quantities) ? result.data.facts[0].quantities : [];
  for (const [index, quantity] of quantities.entries()) {
    if (!quantity || typeof quantity !== 'object' || !String(quantity.unit || '').trim()) {
      throw new Error(`quantities[${index}].unit must be non-empty`);
    }
    if (typeof quantity.value === 'string' && !/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(quantity.value)) {
      throw new Error(`quantities[${index}].value must be an exact decimal`);
    }
  }
  return {
    candidate: result.data.facts[0],
    removed_property_names: result.removed_property_names,
    numeric_coercion_count: result.numeric_coercion_count
  };
}

export function splitSemanticWindowAtChunkBoundary(window) {
  if (!window || !Array.isArray(window.chunks) || window.chunks.length < 2) return [];
  const chunks = [...window.chunks].sort((a, b) => Number(a.char_start) - Number(b.char_start));
  const splitIndex = Math.ceil(chunks.length / 2);
  const groups = [chunks.slice(0, splitIndex), chunks.slice(splitIndex)];
  return groups.filter(group => group.length > 0).map((group, index) => {
    const first = group[0];
    const last = group.at(-1);
    const startOffset = Number(first.char_start);
    const endOffset = Number(last.char_end);
    const sourceText = typeof window.source_text === 'string'
      ? window.source_text.slice(startOffset - Number(window.start_offset || 0), endOffset - Number(window.start_offset || 0))
      : group.map(chunk => String(chunk.source_text || '')).join('');
    return {
      ...window,
      window_id: `${window.window_id}-S${index + 1}`,
      split_depth: Number(window.split_depth || 0) + 1,
      source_text: sourceText,
      source_text_hash: null,
      start_offset: startOffset,
      end_offset: endOffset,
      paragraph_start: first.paragraph_start ?? null,
      paragraph_end: last.paragraph_end ?? null,
      page_start: first.page_start ?? window.page_start ?? null,
      page_end: last.page_end ?? window.page_end ?? null,
      included_chunk_ids: group.map(chunk => chunk.chunk_id),
      included_chunk_count: group.length,
      included_chunk_text_chars: group.reduce((sum, chunk) => sum + String(chunk.source_text || '').length, 0),
      chunks: group
    };
  });
}

/**
 * Terminal V2.2 partition: preserve each existing production chunk as an
 * independent window.  This is intentionally bounded; callers mark the
 * resulting children as terminal so a truncating single chunk is a hard
 * blocker rather than a trigger for unbounded recursion.
 */
export function splitSemanticWindowIntoIndividualChunks(window) {
  if (!window || !Array.isArray(window.chunks) || window.chunks.length < 2) return [];
  const chunks = [...window.chunks].sort((a, b) => Number(a.char_start) - Number(b.char_start));
  return chunks.map((chunk, index) => {
    const startOffset = Number(chunk.char_start);
    const endOffset = Number(chunk.char_end);
    const baseStart = Number(window.start_offset || 0);
    const sourceText = typeof window.source_text === 'string'
      ? window.source_text.slice(startOffset - baseStart, endOffset - baseStart)
      : String(chunk.source_text || '');
    return {
      ...window,
      window_id: `${window.window_id}-C${String(index + 1).padStart(3, '0')}`,
      split_depth: Number(window.split_depth || 0),
      source_text: sourceText,
      source_text_hash: null,
      start_offset: startOffset,
      end_offset: endOffset,
      paragraph_start: chunk.paragraph_start ?? window.paragraph_start ?? null,
      paragraph_end: chunk.paragraph_end ?? window.paragraph_end ?? null,
      page_start: chunk.page_start ?? window.page_start ?? null,
      page_end: chunk.page_end ?? window.page_end ?? null,
      included_chunk_ids: [chunk.chunk_id],
      included_chunk_count: 1,
      included_chunk_text_chars: String(chunk.source_text || '').length,
      source_span_chars: sourceText.length,
      chunks: [chunk],
      terminal_single_chunk: true
    };
  });
}

function lineKind(line) {
  const text = String(line || '').trim();
  if (!text) return 'blank';
  if (/^(?:[-*•▪◦]|\d+[.)]|[一二三四五六七八九十百]+[、.)])\s*/u.test(text)) return 'bullet';
  if ((text.includes('|') && text.split('|').filter(Boolean).length >= 2)
    || (text.includes('\t') && text.split('\t').filter(Boolean).length >= 2)) return 'table_row';
  if (text.length <= 80 && (/(?:^第[^\n]{0,40}[章节篇条]|^[一二三四五六七八九十百]+[、.]|^\d+(?:\.\d+)*[、.]|[：:]$)/u.test(text)
    || (!/[。！？；;]$/u.test(text) && !/[,，]$/u.test(text) && !/\d{2,}/u.test(text)))) return 'heading';
  return 'text';
}

function makeAtomicSegment({ chunk, text, start, end, headingContext = '', boundaryType }) {
  const segmentText = String(text || '').trim();
  const absoluteStart = Number(chunk.char_start || 0) + Number(start || 0);
  const absoluteEnd = Number(chunk.char_start || 0) + Number(end || 0);
  return {
    segment_id: `${chunk.chunk_id || 'chunk'}-A${String(absoluteStart).padStart(8, '0')}`,
    parent_chunk_id: chunk.chunk_id || null,
    material_id: chunk.material_id || null,
    document_id: chunk.document_id || null,
    page_start: chunk.page_start ?? null,
    page_end: chunk.page_end ?? null,
    start_offset: absoluteStart,
    end_offset: absoluteEnd,
    source_hash: chunk.source_hash || null,
    text: segmentText,
    heading_context: String(headingContext || '').trim() || null,
    model_input_text: headingContext ? `${String(headingContext).trim()}\n${segmentText}` : segmentText,
    boundary_type: boundaryType
  };
}

function splitSentences(text) {
  const matches = [];
  const re = /[^。！？!?；;\n]+[。！？!?；;]?/gu;
  let match;
  while ((match = re.exec(text)) !== null) matches.push({ text: match[0], start: match.index, end: re.lastIndex });
  return matches.filter(item => item.text.trim());
}

/**
 * Deterministically derives execution-only segments from one existing
 * production chunk.  It never changes the stored chunk or creates a source
 * authority object.  Structural boundaries are preferred; sentence fallback
 * is used only when one structural block is still too large.
 */
export function splitProductionChunkIntoAtomicSegments(chunk, { maxSegmentChars = 12000 } = {}) {
  if (!chunk || typeof chunk.source_text !== 'string' || !chunk.source_text.trim()) return [];
  const source = chunk.source_text;
  const lines = source.split(/\n/gu);
  const structural = [];
  let offset = 0;
  let paragraphStart = null;
  let paragraphLines = [];
  const flushParagraph = endOffset => {
    if (paragraphStart === null || !paragraphLines.length) return;
    const paragraphText = paragraphLines.join('\n');
    const lineKinds = paragraphLines.map(lineKind);
    const hasItems = lineKinds.some(kind => kind === 'bullet' || kind === 'table_row');
    if (!hasItems) {
      structural.push(makeAtomicSegment({ chunk, text: paragraphText, start: paragraphStart, end: endOffset, boundaryType: 'paragraph' }));
    } else {
      let blockStart = paragraphStart;
      let pendingHeading = '';
      for (const [index, line] of paragraphLines.entries()) {
        const kind = lineKinds[index];
        const lineStart = index === 0 ? paragraphStart : paragraphStart + paragraphLines.slice(0, index).join('\n').length + index;
        const lineEnd = lineStart + line.length;
        if (kind === 'heading') { pendingHeading = line.trim(); continue; }
        if (kind === 'bullet' || kind === 'table_row') {
          structural.push(makeAtomicSegment({ chunk, text: line, start: lineStart, end: lineEnd, headingContext: pendingHeading, boundaryType: kind }));
          pendingHeading = '';
        } else if (line.trim()) {
          structural.push(makeAtomicSegment({ chunk, text: line, start: lineStart, end: lineEnd, headingContext: pendingHeading, boundaryType: 'heading_associated_block' }));
          pendingHeading = '';
        }
      }
      if (!structural.length || structural.at(-1)?.start_offset < Number(chunk.char_start || 0) + paragraphStart) {
        structural.push(makeAtomicSegment({ chunk, text: paragraphText, start: paragraphStart, end: endOffset, boundaryType: 'paragraph' }));
      }
    }
    paragraphStart = null;
    paragraphLines = [];
  };
  for (const line of lines) {
    const lineEnd = offset + line.length;
    if (!line.trim()) flushParagraph(offset);
    else { if (paragraphStart === null) paragraphStart = offset; paragraphLines.push(line); }
    offset = lineEnd + 1;
  }
  flushParagraph(source.length);
  const bounded = [];
  for (const segment of structural) {
    if (segment.text.length <= maxSegmentChars) { bounded.push(segment); continue; }
    const sentences = splitSentences(segment.text);
    if (sentences.length <= 1) { bounded.push(segment); continue; }
    for (const sentence of sentences) {
      bounded.push(makeAtomicSegment({
        chunk,
        text: sentence.text,
        start: Number(segment.start_offset) - Number(chunk.char_start || 0) + sentence.start,
        end: Number(segment.start_offset) - Number(chunk.char_start || 0) + sentence.end,
        headingContext: segment.heading_context,
        boundaryType: 'sentence'
      }));
    }
  }
  return bounded.filter(segment => segment.text.length > 0);
}

export function buildAtomicFactExtractionWindow(window, segment, index = 0) {
  const parentChunk = Array.isArray(window?.chunks) ? window.chunks[0] : null;
  if (!window || !parentChunk || !segment) return null;
  const atomicChunk = {
    ...parentChunk,
    parent_chunk_id: parentChunk.chunk_id || null,
    atomic_segment_id: segment.segment_id,
    source_text: segment.model_input_text,
    char_start: segment.start_offset,
    char_end: segment.end_offset,
    source_hash: segment.source_hash || parentChunk.source_hash || null,
    atomic_boundary_type: segment.boundary_type,
    heading_context: segment.heading_context
  };
  return {
    ...window,
    window_id: `${window.window_id}-A${String(index + 1).padStart(3, '0')}`,
    split_depth: Number(window.split_depth || 0),
    parent_window_id: window.window_id,
    source_text: segment.model_input_text,
    source_text_hash: null,
    source_span_chars: segment.model_input_text.length,
    start_offset: segment.start_offset,
    end_offset: segment.end_offset,
    page_start: segment.page_start ?? window.page_start ?? null,
    page_end: segment.page_end ?? window.page_end ?? null,
    included_chunk_ids: [parentChunk.chunk_id],
    included_chunk_count: 1,
    included_chunk_text_chars: segment.model_input_text.length,
    chunks: [atomicChunk],
    atomic_segment: true,
    terminal_atomic_segment: true,
    heading_context: segment.heading_context,
    atomic_boundary_type: segment.boundary_type
  };
}

function atomicCandidateIdentity(row) {
  const candidate = row?.candidate_v2_2 || row?.candidate_v2_1 || row?.candidate_v2 || {};
  const refs = Array.isArray(candidate.source_refs) ? [...candidate.source_refs].sort() : [];
  const subject = String(candidate.subject_name || '').trim();
  const entities = Array.isArray(candidate.entity_mentions)
    ? candidate.entity_mentions.map(item => `${item?.type_hint || ''}:${item?.name || ''}`).sort()
    : [];
  const statement = String(candidate.statement || '').trim().replace(/\s+/gu, ' ');
  const parentChunk = row?.source_span?.anchor_chunk_id || row?.source_span?.parent_chunk_id || '';
  return JSON.stringify({ statement, subject, entities, refs, parentChunk });
}

export function deduplicateExactAtomicCandidates(rows = []) {
  const seen = new Set();
  const kept = [];
  const duplicates = [];
  for (const row of rows) {
    if (!row?.source_span?.atomic_segment) {
      kept.push(row);
      continue;
    }
    const identity = atomicCandidateIdentity(row);
    if (seen.has(identity)) duplicates.push(row);
    else { seen.add(identity); kept.push(row); }
  }
  return { rows: kept, removed: duplicates, removed_count: duplicates.length };
}

export function classifyFactExtractionResult(result) {
  const facts = Array.isArray(result?.facts) ? result.facts : [];
  return { status: facts.length === 0 ? 'SUCCESS_EMPTY' : 'FACTS_RETURNED', fact_count: facts.length };
}

export function classifyEnterpriseFactCandidate({ sourceText = '', candidate = {} } = {}) {
  const text = String(sourceText || '');
  const subjectName = String(candidate?.subject?.name || '');
  if (ENTERPRISE_ATTRIBUTION.test(text) && (EXPLICIT_CAPABILITY.test(text) || EXPLICIT_CAPABILITY.test(subjectName))) {
    return { classification: 'REAL_ENTERPRISE_FACT_CANDIDATE', reason: 'explicit_enterprise_attribution' };
  }
  if (text.trim()) return { classification: 'REFERENCE_KNOWLEDGE_REJECTED', reason: 'no_explicit_enterprise_attribution' };
  return { classification: 'REVIEW_REQUIRED', reason: 'source_text_unavailable' };
}

/**
 * Candidate V2.2 attribution boundary.  Attribution is proven only from the
 * emitted statement, its cited source text, the candidate subject/entities,
 * and the resolved enterprise identity.  Publisher/document identity alone
 * is deliberately insufficient.  This is deterministic audit logic, not a
 * semantic gold judge.
 */
export function classifyEnterpriseFactCandidateV22({
  candidate = {},
  citedSourceText = '',
  enterpriseNames = [],
  enterpriseId = null
} = {}) {
  const statement = String(candidate?.statement || '').trim();
  const cited = String(citedSourceText || '').trim();
  const subject = String(candidate?.subject_name || '').trim();
  const entities = Array.isArray(candidate?.entity_mentions)
    ? candidate.entity_mentions.map(item => String(item?.name || '').trim()).filter(Boolean)
    : [];
  const names = [...new Set((Array.isArray(enterpriseNames) ? enterpriseNames : [enterpriseNames])
    .map(value => String(value || '').trim()).filter(Boolean))];
  if (!statement || !cited) {
    return { classification: 'REVIEW_REQUIRED', reason: 'source_or_statement_unavailable', enterprise_id: enterpriseId || null };
  }
  const enterprisePattern = names.length
    ? new RegExp(names.map(value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'i')
    : null;
  const statementNamesEnterprise = Boolean(enterprisePattern?.test(statement));
  const citedNamesEnterprise = Boolean(enterprisePattern?.test(cited));
  const subjectNamesEnterprise = Boolean(enterprisePattern?.test(subject) || entities.some(value => enterprisePattern?.test(value)));
  const statementRelationship = ENTERPRISE_RELATIONSHIP.test(statement);
  const capabilityInStatement = EXPLICIT_CAPABILITY.test(statement);
  const subjectMentionedInCited = subject ? cited.toLocaleLowerCase().includes(subject.toLocaleLowerCase()) : false;
  const ownershipLineage = citedNamesEnterprise && subjectMentionedInCited && PRODUCT_OWNERSHIP.test(cited);

  const externalOutcome = EXTERNAL_OUTCOME_SUBJECT.test(`${subject} ${entities.join(' ')} ${statement}`)
    && !PRODUCT_OR_SERVICE_SUBJECT.test(`${subject} ${entities.join(' ')}`)
    && !statementNamesEnterprise
    && !subjectNamesEnterprise;

  if (ownershipLineage && externalOutcome) {
    return {
      classification: 'REFERENCE_KNOWLEDGE_REJECTED',
      reason: 'lineage_only_external_outcome',
      enterprise_id: enterpriseId || null,
      evidence: { cited_enterprise: true, statement_enterprise: false, subject_enterprise: false, ownership_lineage: true, external_outcome: true }
    };
  }

  if (citedNamesEnterprise && statementRelationship && (statementNamesEnterprise || subjectNamesEnterprise || ownershipLineage)) {
    return {
      classification: 'REAL_ENTERPRISE_FACT_CANDIDATE',
      reason: ownershipLineage && !statementNamesEnterprise && !subjectNamesEnterprise
        ? 'explicit_product_or_service_ownership_lineage'
        : 'statement_explicit_enterprise_relationship',
      enterprise_id: enterpriseId || null,
      evidence: { cited_enterprise: true, statement_enterprise: statementNamesEnterprise, subject_enterprise: subjectNamesEnterprise, ownership_lineage: ownershipLineage }
    };
  }
  if (statementNamesEnterprise && capabilityInStatement && !citedNamesEnterprise) {
    return { classification: 'REVIEW_REQUIRED', reason: 'enterprise_statement_not_supported_by_cited_span', enterprise_id: enterpriseId || null };
  }
  return {
    classification: 'REFERENCE_KNOWLEDGE_REJECTED',
    reason: citedNamesEnterprise ? 'no_provable_enterprise_relationship' : 'no_explicit_enterprise_relationship',
    enterprise_id: enterpriseId || null,
    evidence: { cited_enterprise: citedNamesEnterprise, statement_enterprise: statementNamesEnterprise, subject_enterprise: subjectNamesEnterprise, ownership_lineage: ownershipLineage }
  };
}
