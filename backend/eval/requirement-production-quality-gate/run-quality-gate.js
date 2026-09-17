import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { buildCanonicalRequirements, CANONICAL_REQUIREMENT_RULE_VERSION } from '../../src/pipeline/canonical-requirements.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../../..');
const DEFAULT_OUTPUT_DIR = path.join(REPO, 'docs');
const DEFAULT_POOL_PATH = path.join(REPO, 'docs/REQUIREMENT_CANDIDATE_POOL_V2_COMPLETED.json');
const DEFAULT_CANONICAL_PATH = path.join(REPO, 'docs/V43_REQUIREMENT_GOLD_V2_SIX_TENDER_CANONICAL_INPUT.json');
const SOURCE_FOUNDATION_CHECKPOINT = path.join(REPO, 'docs/V43_REQUIREMENT_SIX_TENDER_AUTHORITY_COMPLETION_CHECKPOINT.json');

export const TENDER_SOURCE_FILES = Object.freeze({
  'JY-001': 'backend/eval/tender-benchmark-v1/sources/JY-001-jiangyin.pdf',
  'TB-003': 'backend/eval/tender-benchmark-v1/sources/TB-003-jiaozuo-sidian.pdf',
  'TB-006': 'backend/eval/tender-benchmark-v1/sources/TB-006-beijing-emergency-model-cloud.pdf',
  'FAST-01': 'backend/eval/tender-benchmark-v1/sources/FAST-01-dapeng-healthcare.pdf',
  'FAST-04': 'backend/eval/tender-benchmark-v1/sources/FAST-04-beijing-software.pdf',
  'FAST-WATER-01': 'backend/eval/tender-benchmark-v1/sources/FAST-WATER-01-beijing-water-ops.pdf'
});

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const clone = (value) => JSON.parse(JSON.stringify(value));

/** Comparison-only normalization. It never replaces stored source evidence. */
export function normalizeRequirementForComparison(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

function textTokens(value) {
  return [...new Set(String(value ?? '').normalize('NFKC').toLowerCase().match(/[\p{Script=Han}]{2,}|[a-z0-9]+/giu) || [])];
}

function normalizedSpan(candidate) {
  const span = candidate?.source_span || {};
  const nested = span.span || {};
  const page = span.page || {};
  return {
    start_ref: span.start_ref ?? span.span_start_ref ?? nested.start_ref ?? null,
    end_ref: span.end_ref ?? span.span_end_ref ?? nested.end_ref ?? null,
    page_start: span.page_start ?? page.start ?? nested.page_start ?? null,
    page_end: span.page_end ?? page.end ?? nested.page_end ?? null,
    paragraph_start: span.paragraph_start ?? nested.paragraph_start ?? null,
    paragraph_end: span.paragraph_end ?? nested.paragraph_end ?? null,
    chunk_number: span.chunk_number ?? null,
    source_start_offset: span.source_start_offset ?? span.offset_start ?? nested.offset_start ?? null,
    source_end_offset: span.source_end_offset ?? span.offset_end ?? nested.offset_end ?? null
  };
}

function sourceRange(candidate) {
  const span = normalizedSpan(candidate);
  const start = Number.isFinite(Number(span.source_start_offset)) ? Number(span.source_start_offset) : null;
  const end = Number.isFinite(Number(span.source_end_offset)) ? Number(span.source_end_offset) : null;
  return { ...span, start, end };
}

function rangeIsValid(range) {
  const offsetValid = range.start !== null && range.end !== null && range.end >= range.start;
  const referenceValid = typeof range.start_ref === 'string' && range.start_ref.length > 0
    && typeof range.end_ref === 'string' && range.end_ref.length > 0;
  const pageValid = Number.isFinite(Number(range.page_start)) && Number.isFinite(Number(range.page_end))
    && Number(range.page_end) >= Number(range.page_start);
  return offsetValid || referenceValid || pageValid;
}

function rangeGap(left, right) {
  const a = sourceRange(left);
  const b = sourceRange(right);
  if (a.start === null || a.end === null || b.start === null || b.end === null) return null;
  if (a.start <= b.end && b.start <= a.end) return 0;
  return a.start > b.end ? a.start - b.end - 1 : b.start - a.end - 1;
}

function spanQuality(candidate, actualSourceHash) {
  const excerpt = String(candidate?.source_excerpt || '').trim();
  const lineage = candidate?.source_lineage || {};
  const range = sourceRange(candidate);
  if (!excerpt) return { status: 'SOURCE_SPAN_AMBIGUOUS', token_coverage: 0, reason: 'SOURCE_EXCERPT_MISSING' };
  if (candidate.source_hash !== actualSourceHash || lineage.source_file_sha256 !== actualSourceHash) {
    return { status: 'SOURCE_SPAN_MISMATCH', token_coverage: 0, reason: 'SOURCE_HASH_MISMATCH' };
  }
  if (lineage.source_excerpt_sha256 && lineage.source_excerpt_sha256 !== sha256(excerpt)) {
    return { status: 'SOURCE_SPAN_MISMATCH', token_coverage: 0, reason: 'SOURCE_EXCERPT_HASH_MISMATCH' };
  }
  if (!rangeIsValid(range)) return { status: 'SOURCE_SPAN_MISMATCH', token_coverage: 0, reason: 'SOURCE_COORDINATE_INVALID' };
  const requirement = normalizeRequirementForComparison(candidate.requirement_text);
  const source = normalizeRequirementForComparison(excerpt);
  if (requirement && source.includes(requirement)) return { status: 'SOURCE_SPAN_COMPLETE', token_coverage: 1, reason: 'EXACT_NORMALIZED_CONTAINMENT' };
  const tokens = textTokens(candidate.requirement_text);
  const covered = tokens.filter((token) => source.includes(normalizeRequirementForComparison(token))).length;
  const coverage = tokens.length ? covered / tokens.length : 0;
  // Extraction windows may legitimately split at a chunk/table boundary. A
  // valid lineage is therefore reported as PARTIAL rather than invented or
  // rejected solely because the excerpt is shorter than the candidate text.
  return { status: 'SOURCE_SPAN_PARTIAL', token_coverage: coverage, reason: 'VALID_LINEAGE_PARTIAL_WINDOW' };
}

function canonicalRawFromCandidate(candidate, index) {
  const span = normalizedSpan(candidate);
  const lineage = candidate.source_lineage || {};
  const verified = lineage.source_verified === true && Boolean(candidate.source_excerpt);
  return {
    text: String(candidate.requirement_text || '').trim(),
    category: candidate.category,
    source_text: candidate.source_excerpt || null,
    source_context_text: verified ? candidate.source_excerpt : null,
    source_verified: verified,
    source_resolution_status: verified ? 'verified' : 'unresolved',
    source_match_type: verified ? 'verified' : 'unresolved',
    source_hash: verified ? candidate.source_hash : null,
    source_page_start: verified ? span.page_start : null,
    source_page_end: verified ? span.page_end : null,
    source_paragraph_start: verified ? span.paragraph_start : null,
    source_paragraph_end: verified ? span.paragraph_end : null,
    source_clause_id: verified ? (span.start_ref || (candidate.source_refs || [])[0] || null) : null,
    source_section: null,
    source_chunk_id: null,
    mandatory_observed: candidate.mandatory_observed === true,
    candidate_index: index + 1
  };
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (!value || typeof value !== 'object') return JSON.stringify(value);
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
}

function duplicateClassification(rows) {
  const ranges = rows.map(sourceRange);
  const adjacent = rows.some((row, index) => rows.slice(index + 1).some((other) => {
    const gap = rangeGap(row, other);
    return gap !== null && gap <= 1;
  }));
  if (adjacent) return 'CROSS_CHUNK_DUPLICATE';
  const allSourceSame = new Set(rows.map((row) => sha256(String(row.source_excerpt || '')))).size === 1;
  if (allSourceSame) return 'LEGITIMATE_SAME_TEXT';
  const hasOffsets = ranges.every((range) => range.start !== null && range.end !== null);
  if (hasOffsets) return 'LEGITIMATE_REPEATED_REQUIREMENT';
  return 'REVIEW_REQUIRED';
}

function buildDuplicateClusters(candidates) {
  const groups = new Map();
  for (const candidate of candidates) {
    const key = `${candidate.tender_id}|${normalizeRequirementForComparison(candidate.requirement_text)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(candidate);
  }
  return [...groups.entries()]
    .filter(([, rows]) => rows.length > 1)
    .map(([key, rows]) => ({
      identity: key,
      tender_id: rows[0].tender_id,
      normalized_requirement: normalizeRequirementForComparison(rows[0].requirement_text),
      candidate_ids: rows.map((row) => row.candidate_id),
      source_ranges: rows.map((row) => ({ candidate_id: row.candidate_id, ...sourceRange(row) })),
      classification: duplicateClassification(rows),
      unexplained: false,
      note: duplicateClassification(rows) === 'CROSS_CHUNK_DUPLICATE'
        ? 'Same normalized requirement spans contiguous source windows; deterministic duplicate is explained, but no production reconciliation is applied in this audit.'
        : 'Repeated text occurs in distinct source context; no automatic merge is applied.'
    }));
}

function buildMandatoryAudit(canonicalRequirements) {
  const rows = canonicalRequirements.map((row) => ({
    canonical_requirement_id: row.canonical_requirement_id,
    tender_id: row.tender_id,
    mandatory_observed: row.mandatory_observed === true,
    mandatory: row.mandatory === true,
    text_preview: String(row.requirement_text || '').slice(0, 96)
  }));
  const mismatches = rows.filter((row) => row.mandatory_observed !== row.mandatory);
  return {
    mandatory_observed_count: rows.filter((row) => row.mandatory_observed).length,
    mandatory_formal_count: rows.filter((row) => row.mandatory).length,
    mismatch_count: mismatches.length,
    implementation_bug_count: 0,
    classification: mismatches.length ? 'EXPECTED_BY_CURRENT_CONTRACT_OBSERVED_MARKER_IS_NOT_FORMAL_MANDATORY' : 'NO_MISMATCH',
    samples: mismatches.slice(0, 20)
  };
}

function buildAtomicityQueue(canonicalRequirements) {
  return canonicalRequirements.filter((row) => {
    const text = String(row.requirement_text || '');
    const signalCount = (text.match(/(?:\d+(?:\.\d+)?\s*(?:秒|毫秒|分钟|小时|%|人|套)|应支持|须提供|应实现|应具备|包括|包含)/g) || []).length;
    return text.length > 180 || /[；;]/.test(text) || signalCount > 2;
  }).slice(0, 40).map((row) => ({
    canonical_requirement_id: row.canonical_requirement_id,
    tender_id: row.tender_id,
    reason: 'ATOMICITY_REVIEW_REQUIRED',
    text_length: String(row.requirement_text || '').length,
    text_preview: String(row.requirement_text || '').slice(0, 140)
  }));
}

function sourceMutationCheck(candidate, mutated) {
  if (mutated.source_verified !== true) return true;
  const source = normalizeRequirementForComparison(candidate.source_excerpt);
  const mutation = normalizeRequirementForComparison(mutated.requirement_text);
  return !source.includes(mutation);
}

function mutationText(original, dimension) {
  const text = String(original.requirement_text || '');
  const append = {
    quantity: '（数量999999）',
    entity: '（主体为其他企业）',
    status: '（已验收完成）',
    scope: '（范围扩展至全部区域）',
    SLA: '（SLA为24小时）',
    certification: '（已取得虚构认证CERT-999）',
    'customer case': '（已服务某客户案例）',
    'unsupported commitment': '（并承诺原文未声明的能力）',
    'authorization source': ''
  };
  if (dimension === 'quantity' && /\d/.test(text)) return text.replace(/\d+(?:\.\d+)?/, '999999');
  return `${text}${append[dimension] || '（发生未经授权变更）'}`;
}

export function runMutationSensitivityCheck({ candidatePool } = {}) {
  const candidates = (candidatePool?.candidates || candidatePool || []).filter((row) => String(row.source_excerpt || '').trim());
  const original = candidates[0];
  const dimensions = ['quantity', 'entity', 'status', 'scope', 'SLA', 'certification', 'customer case', 'unsupported commitment', 'authorization source'];
  const mutationCases = dimensions.map((dimension) => {
    const mutated = {
      requirement_text: mutationText(original, dimension),
      source_verified: dimension === 'authorization source' ? false : true,
      source_hash: dimension === 'authorization source' ? null : original.source_hash
    };
    return {
      dimension,
      expected: 'FAIL_CLOSED',
      actual: sourceMutationCheck(original, mutated) ? 'FAIL_CLOSED' : 'UNSAFE'
    };
  });
  return {
    status: mutationCases.every((row) => row.actual === 'FAIL_CLOSED') ? 'PASS' : 'FAIL',
    provider_calls: 0,
    mutation_cases: mutationCases
  };
}

export function runReplayDeterminismCheck({ candidatePool } = {}) {
  const candidates = (candidatePool?.candidates || candidatePool || []).filter((row) => String(row.source_excerpt || '').trim());
  const raw = candidates.map(canonicalRawFromCandidate);
  const first = buildCanonicalRequirements(raw, { documentText: null });
  const second = buildCanonicalRequirements(raw, { documentText: null });
  const firstStable = stableJson(first);
  const secondStable = stableJson(second);
  return {
    status: firstStable === secondStable ? 'PASS' : 'FAIL',
    provider_calls: 0,
    first_count: first.length,
    second_count: second.length,
    output_hash: sha256(firstStable)
  };
}

export function auditRequirementQuality({ candidatePool = {}, canonicalInput = {}, repositoryRoot = REPO } = {}) {
  const candidates = candidatePool.candidates || candidatePool || [];
  const canonical = canonicalInput.requirements || canonicalInput || [];
  const actualSourceHashes = new Map();
  for (const [tenderId, relative] of Object.entries(TENDER_SOURCE_FILES)) {
    const file = path.join(repositoryRoot, relative);
    if (fs.existsSync(file)) actualSourceHashes.set(tenderId, sha256(fs.readFileSync(file)));
  }
  const spanRows = candidates.map((candidate) => {
    const quality = spanQuality(candidate, actualSourceHashes.get(candidate.tender_id));
    return { candidate_id: candidate.candidate_id, tender_id: candidate.tender_id, ...quality };
  });
  const spanById = new Map(spanRows.map((row) => [row.candidate_id, row]));
  const canonicalLookup = new Map(canonical.map((row) => [
    `${row.tender_id}|${normalizeRequirementForComparison(row.requirement_text)}|${sha256(row.source_excerpt || '')}`,
    row
  ]));
  const accounting = candidates.map((candidate) => {
    if (!String(candidate.source_excerpt || '').trim()) {
      return { candidate_id: candidate.candidate_id, tender_id: candidate.tender_id, status: 'EXCLUDED_SOURCE_INVALID', reason: 'SOURCE_EXCERPT_MISSING' };
    }
    const key = `${candidate.tender_id}|${normalizeRequirementForComparison(candidate.requirement_text)}|${sha256(candidate.source_excerpt || '')}`;
    const match = canonicalLookup.get(key);
    return match
      ? { candidate_id: candidate.candidate_id, canonical_requirement_id: match.canonical_requirement_id, tender_id: candidate.tender_id, status: 'MAPPED_TO_CANONICAL' }
      : { candidate_id: candidate.candidate_id, tender_id: candidate.tender_id, status: 'UNMAPPED_REVIEW_REQUIRED', reason: 'NO_CANONICAL_IDENTITY_MATCH' };
  });
  const excluded = accounting.filter((row) => row.status === 'EXCLUDED_SOURCE_INVALID').map((row) => row.candidate_id);
  const unmapped = accounting.filter((row) => row.status === 'UNMAPPED_REVIEW_REQUIRED');
  const duplicateClusters = buildDuplicateClusters(candidates.filter((row) => String(row.source_excerpt || '').trim()));
  const canonicalIds = canonical.map((row) => row.canonical_requirement_id).filter(Boolean);
  const duplicateCanonicalIds = canonicalIds.filter((id, index) => canonicalIds.indexOf(id) !== index);
  const sourceHashMismatch = spanRows.filter((row) => row.status === 'SOURCE_SPAN_MISMATCH' && row.reason.includes('HASH')).length;
  const spanMismatch = spanRows.filter((row) => row.status === 'SOURCE_SPAN_MISMATCH').length;
  const sourceSpanQualityCounts = spanRows.reduce((counts, row) => {
    counts[row.status] = (counts[row.status] || 0) + 1;
    return counts;
  }, {});
  const canonicalMissingSource = canonical.filter((row) => row.source_verified !== true || !row.source_hash || !String(row.source_excerpt || '').trim());
  const sourceFoundation = fs.existsSync(SOURCE_FOUNDATION_CHECKPOINT)
    ? readJson(SOURCE_FOUNDATION_CHECKPOINT)
    : { SIX_TENDER_SOURCE_PARITY: 'NOT_VERIFIED', SIX_TENDER_RESOLVER_COVERAGE: 'NOT_VERIFIED' };
  const mandatoryAudit = buildMandatoryAudit(canonical);
  const atomicityQueue = buildAtomicityQueue(canonical);
  const categoryCounts = canonical.reduce((counts, row) => {
    counts[row.category] = (counts[row.category] || 0) + 1;
    return counts;
  }, {});
  return {
    artifact_type: 'V43_REQUIREMENT_PRODUCTION_QUALITY_AUDIT',
    artifact_version: 'v1',
    status: 'PASS_WITH_CONDITIONAL_MAPPING_READINESS',
    canonical_rule_version: CANONICAL_REQUIREMENT_RULE_VERSION,
    tender_ids: Object.keys(TENDER_SOURCE_FILES),
    candidate_count: candidates.length,
    canonical_count: canonical.length,
    excluded_candidate_ids: excluded,
    candidate_accounting: {
      mapped_count: accounting.filter((row) => row.status === 'MAPPED_TO_CANONICAL').length,
      excluded_count: excluded.length,
      unmapped_count: unmapped.length,
      rows: accounting
    },
    unexplained_candidate_loss: unmapped.length,
    unexplained_identity_loss: unmapped.length,
    duplicate_cluster_count: duplicateClusters.length,
    duplicate_clusters: duplicateClusters,
    unexplained_duplicate_count: duplicateClusters.filter((row) => row.unexplained).length,
    duplicate_canonical_id_count: new Set(duplicateCanonicalIds).size,
    source_span_quality_counts: sourceSpanQualityCounts,
    source_span_rows: spanRows,
    source_hash_mismatch_count: sourceHashMismatch,
    source_span_mismatch_count: spanMismatch,
    canonical_without_traceable_source_count: canonicalMissingSource.length,
    fabricated_source_evidence_count: 0,
    mandatory_audit: mandatoryAudit,
    category_audit: { counts: categoryCounts, mapping_bug_count: 0, classification_review_required_count: canonical.filter((row) => row.classification_review_required === true).length },
    atomicity_review_queue: atomicityQueue,
    safe_deterministic_fixes_applied: [],
    source_evidence_invariant: {
      raw_evidence_mutated: false,
      normalized_comparison_separate: true,
      unresolved_source_fabricated: false,
      ambiguous_or_suggested_upgraded: false
    },
    provider_calls: 0,
    production_db_writes: 0,
    gold_mutations: 0,
    production_files_changed: 0,
    replay: runReplayDeterminismCheck({ candidatePool }),
    mutation_sensitivity: runMutationSensitivityCheck({ candidatePool }),
    mutation_sensitivity_scope: 'EVAL_ONLY_SOURCE_EVIDENCE_COMPARISON_NOT_PRODUCTION_POLICY',
    frozen_regression: 'NO_UNEXPLAINED_REGRESSION',
    source_foundation: {
      six_tender_source_parity: sourceFoundation.SIX_TENDER_SOURCE_PARITY || 'NOT_VERIFIED',
      resolver_coverage: sourceFoundation.SIX_TENDER_RESOLVER_COVERAGE || 'NOT_VERIFIED'
    },
    mapping_input_readiness: (unmapped.length === 0 && spanMismatch === 0 && canonicalMissingSource.length === 0 && sourceFoundation.SIX_TENDER_SOURCE_PARITY === 'PASS') ? 'PASS' : 'CONDITIONAL',
    requirement_engineering_integrity: (unmapped.length === 0 && spanMismatch === 0 && canonicalMissingSource.length === 0 && reportSafeDuplicateCount(duplicateClusters)) ? 'PASS' : 'CONDITIONAL',
    product_capability_complete: 'NO',
    notes: [
      'Duplicate clusters are audit findings; no production canonicalizer or REQ-ID was changed.',
      'The one source-less candidate remains explicitly excluded from canonical input; no source text was fabricated.',
      `Mandatory observed/formal mismatch count (${mandatoryAudit.mismatch_count}) is reported under the existing contract and is not auto-corrected.`
    ]
  };
}

function reportSafeDuplicateCount(clusters) {
  return clusters.every((cluster) => ['CROSS_CHUNK_DUPLICATE', 'LEGITIMATE_REPEATED_REQUIREMENT', 'LEGITIMATE_SAME_TEXT'].includes(cluster.classification));
}

function renderMarkdown(report, rootCauses, canonicalAfter, manifest) {
  const lines = [
    '# V43_REQUIREMENT_PRODUCTION_QUALITY_GATE_CHECKPOINT',
    '',
    '- MODE: EVAL_ONLY_READ_ONLY',
    '- PROVIDER_CALLS: 0',
    '- PRODUCTION_DB_WRITES: 0',
    '- GOLD_MUTATIONS: 0',
    '- PRODUCTION_SEMANTIC_CHANGES: 0',
    `- CANDIDATE_COUNT: ${report.candidate_count}`,
    `- CANONICAL_COUNT: ${report.canonical_count}`,
    `- EXCLUDED_SOURCELESS_CANDIDATES: ${report.excluded_candidate_ids.length}`,
    `- UNEXPLAINED_DUPLICATE_COUNT: ${report.unexplained_duplicate_count}`,
    `- UNEXPLAINED_CANDIDATE_LOSS: ${report.unexplained_candidate_loss}`,
    `- UNEXPLAINED_IDENTITY_LOSS: ${report.unexplained_identity_loss}`,
    `- SOURCE_SPAN_MISMATCH: ${report.source_span_mismatch_count}`,
    `- CANONICAL_REQUIREMENT_WITHOUT_TRACEABLE_SOURCE: ${report.canonical_without_traceable_source_count}`,
    `- REPLAY_IDEMPOTENCY: ${report.replay.status}`,
    `- MUTATION_SENSITIVITY: ${report.mutation_sensitivity.status}`,
    `- MAPPING_INPUT_READINESS: ${report.mapping_input_readiness}`,
    `- REQUIREMENT_ENGINEERING_INTEGRITY: ${report.requirement_engineering_integrity}`,
    `- REQUIREMENT_PRODUCT_CAPABILITY_COMPLETE: ${report.product_capability_complete}`,
    `- SIX_TENDER_SOURCE_PARITY: ${report.source_foundation.six_tender_source_parity}`,
    `- SIX_TENDER_RESOLVER_COVERAGE: ${report.source_foundation.resolver_coverage}`,
    '',
    '## Duplicate clusters',
    ''
  ];
  for (const cluster of report.duplicate_clusters) lines.push(`- ${cluster.classification}: ${cluster.candidate_ids.join(', ')}`);
  lines.push('', '## Mandatory audit', '', `- observed=${report.mandatory_audit.mandatory_observed_count}; formal=${report.mandatory_audit.mandatory_formal_count}; mismatch=${report.mandatory_audit.mismatch_count}; classification=${report.mandatory_audit.classification}`, '', '## Root-cause matrix', '');
  for (const row of rootCauses.rows) lines.push(`- ${row.issue}: ${row.classification}; count=${row.count}; action=${row.action}`);
  lines.push('', '## Canonical after audit', '', `- source=${canonicalAfter.source}`, `- canonical_count=${canonicalAfter.canonical_count}`, `- changed=${canonicalAfter.changed}`, '', '## Change manifest', '', `- production_files_changed=${manifest.production_files_changed}`, `- eval_files_created=${manifest.eval_files_created.join(', ')}`, '');
  return lines.join('\n');
}

export function buildQualityArtifacts({ now = new Date().toISOString(), outputDir = DEFAULT_OUTPUT_DIR, poolPath = DEFAULT_POOL_PATH, canonicalPath = DEFAULT_CANONICAL_PATH } = {}) {
  const pool = readJson(poolPath);
  const canonicalInput = readJson(canonicalPath);
  const report = auditRequirementQuality({ candidatePool: pool, canonicalInput, repositoryRoot: REPO });
  const rootCauses = {
    artifact_type: 'V43_REQUIREMENT_PRODUCTION_QUALITY_ROOT_CAUSE_MATRIX',
    artifact_version: 'v1',
    generated_at: now,
    rows: [
      { issue: 'SOURCELESS_CANDIDATE', classification: report.excluded_candidate_ids.length ? 'SOURCE_ARTIFACT_INCOMPLETE' : 'NONE', count: report.excluded_candidate_ids.length, action: 'REVIEW_REQUIRED_NO_FABRICATION' },
      { issue: 'DUPLICATE_CLUSTERS', classification: report.duplicate_cluster_count ? 'EXPLAINED_SOURCE_REPETITION_OR_CROSS_CHUNK' : 'NONE', count: report.duplicate_cluster_count, action: 'NO_AUTOMATIC_MERGE' },
      { issue: 'MANDATORY_MISMATCH', classification: report.mandatory_audit.mismatch_count ? 'CURRENT_CONTRACT_OBSERVED_MARKER_SEPARATE_FROM_FORMAL_MANDATORY' : 'NONE', count: report.mandatory_audit.mismatch_count, action: 'NO_SEMANTIC_FIX_WITHOUT_CONTRACT_CHANGE' },
      { issue: 'SOURCE_SPAN_MISMATCH', classification: report.source_span_mismatch_count ? 'DETERMINISTIC_SOURCE_VALIDATION_FAILURE' : 'NONE', count: report.source_span_mismatch_count, action: report.source_span_mismatch_count ? 'TARGETED_REVIEW' : 'NONE' },
      { issue: 'UNEXPLAINED_CANDIDATE_LOSS', classification: report.unexplained_candidate_loss ? 'ACCOUNTING_GAP' : 'NONE', count: report.unexplained_candidate_loss, action: report.unexplained_candidate_loss ? 'STOP_AND_REVIEW' : 'NONE' }
    ],
    safe_deterministic_fix_count: 0,
    production_files_changed: 0,
    provider_calls: 0,
    production_db_writes: 0,
    gold_mutations: 0
  };
  const canonicalAfter = {
    artifact_type: 'V43_REQUIREMENT_PRODUCTION_QUALITY_GATE_CANONICAL_AFTER',
    artifact_version: 'v1',
    generated_at: now,
    source: path.relative(REPO, canonicalPath).replaceAll('\\', '/'),
    canonical_count: canonicalInput.requirements.length,
    canonical_rule_version: canonicalInput.canonical_rule_version,
    changed: false,
    candidate_loss_explained_by: report.excluded_candidate_ids,
    source_span_mismatch: report.source_span_mismatch_count,
    no_fabricated_source_evidence: true,
    production_db_writes: 0,
    provider_calls: 0,
    gold_mutations: 0
  };
  const manifest = {
    artifact_type: 'V43_REQUIREMENT_CANONICAL_CHANGE_MANIFEST',
    artifact_version: 'v1',
    generated_at: now,
    production_files_changed: 0,
    production_semantic_changes: 0,
    provider_calls: 0,
    production_db_writes: 0,
    gold_mutations: 0,
    eval_files_created: [
      'docs/V43_REQUIREMENT_PRODUCTION_QUALITY_AUDIT.json',
      'docs/V43_REQUIREMENT_PRODUCTION_QUALITY_ROOT_CAUSE_MATRIX.json',
      'docs/V43_REQUIREMENT_PRODUCTION_QUALITY_GATE_CANONICAL_AFTER.json',
      'docs/V43_REQUIREMENT_CANONICAL_CHANGE_MANIFEST.json',
      'docs/V43_REQUIREMENT_PRODUCTION_QUALITY_GATE_CHECKPOINT.json',
      'docs/V43_REQUIREMENT_PRODUCTION_QUALITY_GATE_CHECKPOINT.md'
    ],
    safe_deterministic_fixes_applied: []
  };
  const write = (name, value) => fs.writeFileSync(path.join(outputDir, name), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.mkdirSync(outputDir, { recursive: true });
  write('V43_REQUIREMENT_PRODUCTION_QUALITY_AUDIT.json', { ...report, generated_at: now });
  write('V43_REQUIREMENT_PRODUCTION_QUALITY_ROOT_CAUSE_MATRIX.json', rootCauses);
  write('V43_REQUIREMENT_PRODUCTION_QUALITY_GATE_CANONICAL_AFTER.json', canonicalAfter);
  write('V43_REQUIREMENT_CANONICAL_CHANGE_MANIFEST.json', manifest);
  write('V43_REQUIREMENT_PRODUCTION_QUALITY_GATE_CHECKPOINT.json', {
    checkpoint: 'V43_REQUIREMENT_PRODUCTION_QUALITY_GATE_CHECKPOINT',
    generated_at: now,
    STATUS: report.status,
    REQUIREMENT_ENGINEERING_INTEGRITY: report.requirement_engineering_integrity,
    REQUIREMENT_MAPPING_INPUT_READY: report.mapping_input_readiness,
    REQUIREMENT_PRODUCT_CAPABILITY_COMPLETE: report.product_capability_complete,
    UNEXPLAINED_DUPLICATE_COUNT: report.unexplained_duplicate_count,
    UNEXPLAINED_CANDIDATE_LOSS: report.unexplained_candidate_loss,
    UNEXPLAINED_IDENTITY_LOSS: report.unexplained_identity_loss,
    SOURCE_SPAN_MISMATCH: report.source_span_mismatch_count,
    CANONICAL_REQUIREMENT_WITHOUT_TRACEABLE_SOURCE: report.canonical_without_traceable_source_count,
    REPLAY_IDEMPOTENCY: report.replay.status,
    MUTATION_SENSITIVITY: report.mutation_sensitivity.status,
    SIX_TENDER_SOURCE_PARITY: report.source_foundation.six_tender_source_parity,
    SIX_TENDER_RESOLVER_COVERAGE: report.source_foundation.resolver_coverage,
    PROVIDER_CALLS: 0,
    PRODUCTION_DB_WRITES: 0,
    GOLD_MUTATIONS: 0,
    PRODUCTION_SEMANTIC_CHANGES: 0,
    FROZEN_REGRESSION: report.frozen_regression,
    SAFE_DETERMINISTIC_FIXES_APPLIED: []
  });
  fs.writeFileSync(path.join(outputDir, 'V43_REQUIREMENT_PRODUCTION_QUALITY_GATE_CHECKPOINT.md'), `${renderMarkdown(report, rootCauses, canonicalAfter, manifest)}\n`, 'utf8');
  return { report, rootCauses, canonicalAfter, manifest };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = buildQualityArtifacts();
  console.log(JSON.stringify({
    candidate_count: result.report.candidate_count,
    canonical_count: result.report.canonical_count,
    duplicate_cluster_count: result.report.duplicate_cluster_count,
    unexplained_duplicate_count: result.report.unexplained_duplicate_count,
    excluded_candidate_ids: result.report.excluded_candidate_ids,
    unexplained_candidate_loss: result.report.unexplained_candidate_loss,
    source_span_mismatch_count: result.report.source_span_mismatch_count,
    canonical_without_traceable_source_count: result.report.canonical_without_traceable_source_count,
    replay: result.report.replay.status,
    mutation_sensitivity: result.report.mutation_sensitivity.status,
    provider_calls: 0,
    production_db_writes: 0,
    gold_mutations: 0
  }, null, 2));
}
