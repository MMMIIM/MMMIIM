import fs from 'node:fs';
import { buildTrace, makeTraceStage, TRACE_STAGE_ORDER } from '../trace.js';
import { sha256 } from '../contract.js';

export function normalizeMechanicalText(value) {
  return String(value ?? '')
    .replace(/\s+/g, '')
    .replace(/[。；，、：:,.!?！？“”‘’（）()【】\[\]"']/g, '')
    .toLowerCase();
}

function sourceRecords(requirement) {
  return [
    requirement,
    ...(Array.isArray(requirement?.sources_json) ? requirement.sources_json : []),
    ...(Array.isArray(requirement?.source_lineage) ? requirement.source_lineage : [])
  ].filter((item) => item && typeof item === 'object');
}

function numericPages(requirement) {
  const pages = new Set();
  for (const record of sourceRecords(requirement)) {
    const start = Number(record.source_page_start ?? record.source_page);
    const end = Number(record.source_page_end ?? record.source_page ?? start);
    if (!Number.isFinite(start)) continue;
    const last = Number.isFinite(end) ? end : start;
    for (let page = Math.min(start, last); page <= Math.max(start, last); page += 1) pages.add(page);
  }
  return [...pages].sort((a, b) => a - b);
}

function sourceTexts(requirement) {
  return sourceRecords(requirement)
    .flatMap((record) => [record.source_excerpt, record.source_text])
    .filter((value) => typeof value === 'string' && value.trim());
}

function hasSharedEightGram(left, right) {
  if (left.length < 8 || right.length < 8) return false;
  const grams = new Set();
  for (let index = 0; index <= left.length - 8; index += 1) grams.add(left.slice(index, index + 8));
  for (let index = 0; index <= right.length - 8; index += 1) {
    if (grams.has(right.slice(index, index + 8))) return true;
  }
  return false;
}

function mechanicalLinkMethod(atomText, requirement) {
  const atom = normalizeMechanicalText(atomText);
  const texts = sourceTexts(requirement).map(normalizeMechanicalText);
  if (texts.some((text) => atom && text && (atom.includes(text) || text.includes(atom)))) {
    return 'normalized_exact_substring';
  }
  if (texts.some((text) => hasSharedEightGram(atom, text))) return 'shared_8gram';
  return 'same_page_span_only';
}

function firstSource(requirement) {
  return sourceRecords(requirement).find((record) => sourceTexts(record).length || record.source_refs || record.source_hash) || requirement;
}

function sourceRefs(requirement) {
  const refs = sourceRecords(requirement).flatMap((record) => Array.isArray(record.source_refs) ? record.source_refs : []);
  return [...new Set(refs.filter(Boolean))];
}

function sourceHash(requirement) {
  return requirement?.source_hash
    || sourceRecords(requirement).map((record) => record.source_hash).find(Boolean)
    || null;
}

/**
 * Recover the historical mechanical, many-to-many atom -> canonical links.
 * This intentionally uses only persisted source page/span/text identity; it
 * never chooses a semantic "best" requirement.
 */
export function linkCanonicalRequirements({ atom = {}, requirements = [] } = {}) {
  const atomPage = Number(atom.page ?? atom.source_truth?.page);
  if (!Number.isFinite(atomPage)) return [];
  const atomText = atom.atomic_requirement ?? atom.source_truth?.atomic_requirement ?? '';
  return requirements
    .filter((requirement) => numericPages(requirement).includes(atomPage))
    .map((requirement) => {
      const pages = numericPages(requirement);
      const first = firstSource(requirement);
      const method = mechanicalLinkMethod(atomText, requirement);
      return {
        requirement_id: requirement.requirement_id || requirement.req_id || requirement.id || null,
        source_refs: sourceRefs(requirement),
        source_hash: sourceHash(requirement),
        source_page_start: pages[0] ?? null,
        source_page_end: pages.at(-1) ?? null,
        source_span: {
          page_start: pages[0] ?? null,
          page_end: pages.at(-1) ?? null,
          chunk_number: requirement.source_chunk_id || requirement.chunk_number || first.source_chunk_id || first.chunk_number || null,
          source_start_offset: requirement.source_start_offset ?? first.source_start_offset ?? null,
          source_end_offset: requirement.source_end_offset ?? first.source_end_offset ?? null
        },
        link_method: method,
        requirement_text: requirement.requirement_text || requirement.content || null,
        source_excerpt: requirement.source_excerpt || requirement.source_text || first.source_excerpt || first.source_text || null,
        source_verified: requirement.source_verified === true || first.source_verified === true
      };
    });
}

function valueFor(input, key) {
  return input?.[key] ?? input?.stages?.[key] ?? null;
}

function artifactRef(value) {
  if (!value || typeof value !== 'object') return null;
  return value.artifact_ref || value.artifact || null;
}

export function buildRequirementTrace({ evalRunId, caseId, source, expected = null, actual = null, stages = {}, artifacts = {} } = {}) {
  const stageValues = {
    'Tender Source': valueFor({ ...stages, source }, 'source'),
    Section: valueFor(stages, 'section'),
    Chunk: valueFor(stages, 'chunk'),
    'Provider Input': valueFor(stages, 'provider_input'),
    'Raw Candidate': valueFor(stages, 'raw_candidate'),
    Normalization: valueFor(stages, 'normalization'),
    'Source Resolution': valueFor(stages, 'source_resolution'),
    'Canonical Requirement': valueFor(stages, 'canonical_requirement')
  };
  const traceStages = TRACE_STAGE_ORDER.map((stageType, ordinal) => {
    const value = stageValues[stageType];
    const identity = value && typeof value === 'object'
      ? Object.fromEntries(Object.entries(value).filter(([key]) => /(^|_)(id|ref|hash|number|run|snapshot|project|tender)/i.test(key)))
      : { present: value !== null && value !== undefined };
    return makeTraceStage({ stageType, ordinal, value, artifactRef: artifacts[stageType] || artifactRef(value), identity });
  });
  return buildTrace({ module: 'requirement', evalRunId, caseId, source: stageValues['Tender Source'], expected, actual, stages: traceStages });
}

export function loadRequirementArtifact(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return { status: 'EVIDENCE_NOT_PERSISTED', path: filePath || null };
  const bytes = fs.readFileSync(filePath);
  return { artifact_ref: { path_or_key: filePath, sha256: `sha256:${sha256(bytes)}`, byte_length: bytes.byteLength } };
}
