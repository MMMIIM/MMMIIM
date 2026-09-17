#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { normalizeMechanicalText } from '../../src/eval/flywheel/adapters/requirement.js';

// This module is an Eval-only mechanical packet builder.  It intentionally
// does not import or call any Provider, semantic judge, or production service.

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(MODULE_DIR, '../../..');
export const SOURCE_PATH = path.join(ROOT, 'docs/eval/p0-recall/GPT_SOURCE_TRUTH_P0_CORE6_V1.json');
export const R3_PATH = path.join(ROOT, 'docs/eval/flywheel/V43-FLYWHEEL-P0-487-R3/V43_P0_487_PROVENANCE_TRACE_INDEX.json');
export const OUTPUT_DIR = path.join(ROOT, 'docs/eval/flywheel/p0-semantic-reconstruction');
export const SOURCE_TRUTH_ID = 'GPT_SOURCE_TRUTH_P0_CORE6_V1';
export const SOURCE_TRUTH_SHA = 'sha256:9337ecac323176ddcdf70a6012f522d24cc7d1930765290300bcc0d1d540cba0';
export const PRODUCTION_RUN_ID = 'V43-CORE6-20260911';
export const R3_RUN_ID = 'V43-FLYWHEEL-P0-487-R3';

export const TENDERS = Object.freeze(['JY-001', 'TB-003', 'TB-006', 'FAST-01', 'FAST-04', 'FAST-WATER-01']);
export const TENDER_EXPORTS = Object.freeze({
  'JY-001': 'JY-001.production-requirements.json',
  'TB-003': 'TB-003.production-requirements.json',
  'TB-006': 'TB-006.production-requirements.json',
  'FAST-01': 'FAST-01.production-requirements.json',
  'FAST-04': 'FAST-04.production-requirements.json',
  'FAST-WATER-01': 'FAST-WATER-01.production-requirements.json'
});
export const TENDER_COUNTS = Object.freeze({ 'JY-001': 89, 'TB-003': 25, 'TB-006': 19, 'FAST-01': 24, 'FAST-04': 229, 'FAST-WATER-01': 101 });

const METHOD_PRIORITY = Object.freeze({ normalized_exact_substring: 3, shared_8gram: 2, same_page_span_only: 1, tender_local_retrieval: 0 });

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function hashJson(value) {
  return sha256(Buffer.from(JSON.stringify(value)));
}

function finite(value) {
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

function sourceRecords(requirement) {
  return [
    requirement,
    ...(Array.isArray(requirement?.sources_json) ? requirement.sources_json : []),
    ...(Array.isArray(requirement?.source_lineage) ? requirement.source_lineage : [])
  ].filter((item) => item && typeof item === 'object');
}

function sourceRefs(requirement) {
  return [...new Set(sourceRecords(requirement).flatMap((record) => Array.isArray(record.source_refs) ? record.source_refs : []).filter(Boolean))];
}

function sourceHash(requirement) {
  return requirement?.source_hash
    || sourceRecords(requirement).map((record) => record.source_hash).find(Boolean)
    || null;
}

function sourcePages(requirement) {
  const pages = [];
  for (const record of sourceRecords(requirement)) {
    const start = finite(record.source_page_start ?? record.source_page);
    const end = finite(record.source_page_end ?? record.source_page ?? start);
    if (start === null) continue;
    const last = end === null ? start : end;
    for (let page = Math.min(start, last); page <= Math.max(start, last); page += 1) pages.push(page);
  }
  return [...new Set(pages)].sort((a, b) => a - b);
}

function firstSource(requirement) {
  return sourceRecords(requirement).find((record) => record.source_excerpt || record.source_text || record.source_refs || record.source_hash) || requirement;
}

function canonicalRecord(requirement, { candidateOrigin = 'TRACE_LINEAGE', linkMethod = null } = {}) {
  const first = firstSource(requirement);
  const pages = sourcePages(requirement);
  const requirementId = requirement.requirement_id || requirement.req_id || requirement.id || null;
  return {
    requirement_id: requirementId,
    tender_id: requirement.tender_id || requirement.tender || null,
    requirement_text: requirement.requirement_text || requirement.content || null,
    source_excerpt: requirement.source_excerpt || requirement.source_text || first.source_excerpt || first.source_text || null,
    source_page_start: finite(requirement.source_page_start ?? first.source_page_start ?? first.source_page),
    source_page_end: finite(requirement.source_page_end ?? first.source_page_end ?? first.source_page),
    source_refs: sourceRefs(requirement),
    source_hash: sourceHash(requirement),
    source_span: {
      page_start: pages[0] ?? finite(requirement.source_page_start ?? first.source_page_start ?? first.source_page),
      page_end: pages.at(-1) ?? finite(requirement.source_page_end ?? first.source_page_end ?? first.source_page),
      chunk_number: requirement.source_chunk_id || requirement.chunk_number || first.source_chunk_id || first.chunk_number || null,
      source_start_offset: requirement.source_start_offset ?? first.source_start_offset ?? null,
      source_end_offset: requirement.source_end_offset ?? first.source_end_offset ?? null
    },
    source_verified: requirement.source_verified === true || first.source_verified === true,
    candidate_origin: candidateOrigin,
    link_method: linkMethod || requirement.link_method || null
  };
}

function ngrams(value, size) {
  const output = new Set();
  if (value.length < size) return output;
  for (let index = 0; index <= value.length - size; index += 1) output.add(value.slice(index, index + size));
  return output;
}

function numericTokens(value) {
  return new Set((String(value ?? '').match(/\d+(?:\.\d+)?%?/g) || []));
}

function alphaNumericTokens(value) {
  return new Set((String(value ?? '').toLowerCase().match(/[a-z]+|\d+(?:\.\d+)?%?/g) || []));
}

function intersectionSize(left, right) {
  let count = 0;
  for (const item of left) if (right.has(item)) count += 1;
  return count;
}

export function rankingFeatures(atomText, candidateText, linkMethod) {
  const atom = normalizeMechanicalText(atomText);
  const candidate = normalizeMechanicalText(candidateText);
  const atomBigrams = ngrams(atom, 2);
  const candidateBigrams = ngrams(candidate, 2);
  const sharedEight = intersectionSize(ngrams(atom, 8), ngrams(candidate, 8));
  const sharedBigrams = intersectionSize(atomBigrams, candidateBigrams);
  const unionBigrams = new Set([...atomBigrams, ...candidateBigrams]).size;
  const atomNumbers = numericTokens(atom);
  const candidateNumbers = numericTokens(candidate);
  const atomTokens = alphaNumericTokens(atom);
  const candidateTokens = alphaNumericTokens(candidate);
  const numberOverlap = intersectionSize(atomNumbers, candidateNumbers);
  const tokenOverlap = intersectionSize(atomTokens, candidateTokens);
  const bigramRatio = unionBigrams ? sharedBigrams / unionBigrams : 0;
  const exact = Boolean(atom && candidate && (atom.includes(candidate) || candidate.includes(atom)));
  const methodPriority = METHOD_PRIORITY[linkMethod] ?? 0;
  const mechanicalScore = (methodPriority * 1_000_000) + (sharedEight * 1_000) + (numberOverlap * 100) + (tokenOverlap * 10) + bigramRatio;
  return {
    method_priority: methodPriority,
    normalized_exact_substring: exact,
    shared_8gram_count: sharedEight,
    number_overlap_count: numberOverlap,
    token_overlap_count: tokenOverlap,
    normalized_bigram_overlap_ratio: Number(bigramRatio.toFixed(12)),
    mechanical_score: Number(mechanicalScore.toFixed(12))
  };
}

function compareCandidates(left, right) {
  if (right.ranking_features.mechanical_score !== left.ranking_features.mechanical_score) return right.ranking_features.mechanical_score - left.ranking_features.mechanical_score;
  if (right.ranking_features.method_priority !== left.ranking_features.method_priority) return right.ranking_features.method_priority - left.ranking_features.method_priority;
  const leftId = String(left.requirement_id);
  const rightId = String(right.requirement_id);
  return leftId < rightId ? -1 : leftId > rightId ? 1 : 0;
}

export function rankCandidates(atomText, candidates, limit) {
  const byId = new Map();
  for (const candidate of candidates) {
    const candidateId = candidate.requirement_id || candidate.req_id || candidate.id;
    if (!candidateId) continue;
    const linkMethod = candidate.link_method || 'tender_local_retrieval';
    const base = canonicalRecord(candidate, { candidateOrigin: candidate.candidate_origin || 'TRACE_LINEAGE', linkMethod });
    const text = [base.requirement_text, base.source_excerpt].filter(Boolean).join('\n');
    const value = { ...base, ranking_features: rankingFeatures(atomText, text, linkMethod) };
    const previous = byId.get(candidateId);
    if (!previous || compareCandidates(value, previous) < 0) byId.set(candidateId, value);
  }
  return [...byId.values()].sort(compareCandidates).slice(0, limit);
}

function stageStatuses(trace) {
  return Object.fromEntries((Array.isArray(trace?.stages) ? trace.stages : []).map((stage) => [stage.stage_type, stage.status]));
}

function mechanicalTrace(trace, linkedArtifacts) {
  const links = linkedArtifacts.length > 0;
  const methods = [...new Set(linkedArtifacts.map((item) => item.link_method).filter(Boolean))];
  return {
    r3_case_id: trace?.case_id || null,
    trace_id: trace?.trace_id || null,
    source_linked: links,
    no_mechanical_link_found: !links,
    linked_candidate_count_observed: linkedArtifacts.length,
    link_methods_observed: methods,
    stage_statuses: stageStatuses(trace),
    evidence_gaps: Array.isArray(trace?.evidence_gaps) ? trace.evidence_gaps : []
  };
}

function sourceTruthRow(atom, trace) {
  const sourceText = trace?.source?.text || atom.atomic_requirement || null;
  return {
    atom_id: atom.atom_id,
    tender_id: atom.tender,
    page: finite(atom.page),
    atomic_requirement: atom.atomic_requirement || null,
    source_excerpt: atom.atomic_requirement || null,
    source_text: sourceText,
    source_text_origin: trace?.source?.text ? 'R3.trace.source.text' : 'SourceTruth.atomic_requirement',
    source_hash: trace?.source?.source_hash || null,
    source_truth_sha256: SOURCE_TRUTH_SHA,
    p0_basis: atom.p0_basis || null,
    family: atom.family || null,
    risk_tier: atom.risk_tier || null,
    applicability: atom.applicability || null,
    source_mode: atom.source_mode || null,
    note: atom.note || null,
    context: { page: finite(atom.page), text: sourceText, context_origin: 'frozen-source-truth-and-r3-trace' }
  };
}

function productionIdentity(artifact) {
  return {
    production_run_id: artifact?.run_id || null,
    tender_id: artifact?.tender || null,
    source_sha256: artifact?.source_sha256 || null,
    source_file: artifact?.source_file || null,
    production_export_path: artifact?.__path || null
  };
}

function loadProduction() {
  const out = new Map();
  for (const tender of TENDERS) {
    const filePath = path.join(ROOT, 'docs/eval/requirement-production-core6-20260911', TENDER_EXPORTS[tender]);
    if (!fs.existsSync(filePath)) throw new Error(`PRODUCTION_EXPORT_NOT_FOUND:${tender}`);
    const artifact = readJson(filePath);
    if (artifact.artifact_type !== 'V43_CORE6_PRODUCTION_REQUIREMENT_RUNTIME' || artifact.run_id !== PRODUCTION_RUN_ID || artifact.tender !== tender) {
      throw new Error(`PRODUCTION_IDENTITY_MISMATCH:${tender}`);
    }
    artifact.__path = path.relative(ROOT, filePath).replaceAll('\\', '/');
    out.set(tender, artifact);
  }
  return out;
}

export function loadInputs({ sourcePath = SOURCE_PATH, r3Path = R3_PATH } = {}) {
  const sourceBytes = fs.readFileSync(sourcePath);
  const source = readJson(sourcePath);
  const r3 = readJson(r3Path);
  if (sha256(sourceBytes) !== SOURCE_TRUTH_SHA.slice('sha256:'.length)) throw new Error('SOURCE_TRUTH_FILE_SHA_MISMATCH');
  if (source.source_sha256 && typeof source.source_sha256 === 'string' && `sha256:${source.source_sha256}` !== SOURCE_TRUTH_SHA && source.source_sha256 !== SOURCE_TRUTH_SHA) throw new Error('SOURCE_TRUTH_SHA_MISMATCH');
  if (source.candidate_atom_count !== 487 || !Array.isArray(source.atoms) || source.atoms.length !== 487) throw new Error(`SOURCE_TRUTH_ATOM_COUNT_MISMATCH:${source.atoms?.length || 0}`);
  const atomIds = new Set(source.atoms.map((atom) => atom.atom_id));
  if (atomIds.size !== 487 || source.atoms.some((atom) => !TENDERS.includes(atom.tender))) throw new Error('SOURCE_TRUTH_ATOM_ID_OR_TENDER_MISMATCH');
  for (const tender of TENDERS) {
    const count = source.atoms.filter((atom) => atom.tender === tender).length;
    if (count !== TENDER_COUNTS[tender]) throw new Error(`SOURCE_TRUTH_TENDER_COUNT_MISMATCH:${tender}:${count}`);
  }
  if (r3.eval_run_id !== R3_RUN_ID || r3.source_truth_sha256 !== SOURCE_TRUTH_SHA || r3.atom_count !== 487 || r3.unique_atom_count !== 487) throw new Error('R3_IDENTITY_MISMATCH');
  const r3Ids = new Set((r3.rows || []).map((row) => row.atom_id));
  if (r3Ids.size !== 487 || r3Ids.size !== (r3.rows || []).length || [...atomIds].some((atomId) => !r3Ids.has(atomId))) throw new Error('R3_ATOM_ID_SET_MISMATCH');
  const r3ByAtom = new Map((r3.rows || []).map((row) => [row.atom_id, row]));
  if (source.atoms.some((atom) => r3ByAtom.get(atom.atom_id)?.tender_id !== atom.tender)) throw new Error('R3_TENDER_ID_SET_MISMATCH');
  const production = loadProduction();
  for (const tender of TENDERS) {
    const expectedSourceHash = source.source_sha256?.[tender];
    const actualSourceHash = production.get(tender)?.source_sha256;
    if (expectedSourceHash && actualSourceHash && expectedSourceHash !== actualSourceHash) throw new Error(`PRODUCTION_SOURCE_SHA_MISMATCH:${tender}`);
  }
  return { source, r3, production };
}

export function buildReviewRows({ source, r3, production }) {
  const traceByAtom = new Map((r3.rows || []).map((row) => [row.atom_id, row]));
  const rows = [];
  for (const atom of source.atoms) {
    const traceRow = traceByAtom.get(atom.atom_id);
    const trace = traceRow?.trace || {};
    const artifact = production.get(atom.tender);
    const linkedArtifacts = Array.isArray(trace.actual?.linked_artifacts) ? trace.actual.linked_artifacts : [];
    const linked = linkedArtifacts.map((item) => ({ ...item, tender_id: atom.tender, candidate_origin: 'TRACE_LINEAGE' }));
    const isNoLink = linked.length === 0;
    const local = isNoLink
      ? (artifact.requirements || []).map((item) => ({ ...item, tender_id: atom.tender, candidate_origin: 'TENDER_LOCAL_RETRIEVAL', link_method: 'tender_local_retrieval' }))
      : linked;
    const candidates = rankCandidates(atom.atomic_requirement, local, isNoLink ? 8 : 5);
    rows.push({
      atom_id: atom.atom_id,
      tender_id: atom.tender,
      source_truth: sourceTruthRow(atom, trace),
      production_identity: productionIdentity(artifact),
      mechanical_trace: mechanicalTrace(trace, linkedArtifacts),
      candidate_canonicals: candidates,
      candidate_status: candidates.length ? 'CANDIDATES_AVAILABLE' : 'NO_CANDIDATE_AVAILABLE'
    });
  }
  return rows;
}

export function validateReviewRows(rows) {
  if (!Array.isArray(rows) || rows.length !== 487) throw new Error(`REVIEW_ROW_COUNT_MISMATCH:${rows?.length || 0}`);
  const atomIds = new Set();
  for (const row of rows) {
    if (!row?.atom_id || atomIds.has(row.atom_id)) throw new Error(`REVIEW_ATOM_ID_DUPLICATE:${row?.atom_id || 'missing'}`);
    atomIds.add(row.atom_id);
    const candidates = Array.isArray(row.candidate_canonicals) ? row.candidate_canonicals : [];
    const candidateIds = new Set();
    for (const candidate of candidates) {
      if (!candidate.requirement_id || candidateIds.has(candidate.requirement_id)) throw new Error(`CANDIDATE_ID_DUPLICATE:${row.atom_id}`);
      if (candidate.tender_id !== row.tender_id) throw new Error(`CROSS_TENDER_CANDIDATE:${row.atom_id}:${candidate.requirement_id}`);
      candidateIds.add(candidate.requirement_id);
    }
    if (candidates.length === 0 && row.candidate_status !== 'NO_CANDIDATE_AVAILABLE') throw new Error(`MISSING_NO_CANDIDATE_STATUS:${row.atom_id}`);
    if (candidates.length > 0 && row.candidate_status !== 'CANDIDATES_AVAILABLE') throw new Error(`MISSING_CANDIDATE_STATUS:${row.atom_id}`);
  }
  return true;
}

function assertNoSemanticFields(value) {
  const forbidden = new Set(['semantic_label', 'semantic_label_author', 'semantic_label_version', 'gold_label', 'gold_decision', 'failure_family', 'semantic_root_cause', 'historical_label', 'expected_label']);
  function walk(node) {
    if (Array.isArray(node)) { for (const item of node) walk(item); return; }
    if (!node || typeof node !== 'object') return;
    for (const key of Object.keys(node)) {
      if (forbidden.has(key)) throw new Error(`SEMANTIC_LABEL_LEAKAGE:${key}`);
      walk(node[key]);
    }
  }
  walk(value);
}

export function buildPacketArtifacts(inputs) {
  const rows = buildReviewRows(inputs);
  validateReviewRows(rows);
  const byTender = new Map(TENDERS.map((tender) => [tender, []]));
  for (const row of rows) byTender.get(row.tender_id).push(row);
  const packets = {};
  const packetMeta = [];
  for (const tender of TENDERS) {
    const artifact = inputs.production.get(tender);
    const packet = {
      artifact_type: 'V43_P0_487_SEMANTIC_RECONSTRUCTION_REVIEW_PACKET',
      artifact_version: 'v1',
      blind: true,
      semantic_labels_present: false,
      historical_aggregate_included: false,
      tender_id: tender,
      source_truth: { id: SOURCE_TRUTH_ID, sha256: SOURCE_TRUTH_SHA, atom_count: TENDER_COUNTS[tender] },
      production_identity: { run_id: PRODUCTION_RUN_ID, source_sha256: artifact.source_sha256, export_path: artifact.__path },
      mechanical_trace_identity: { eval_run_id: R3_RUN_ID, artifact_path: 'docs/eval/flywheel/V43-FLYWHEEL-P0-487-R3/V43_P0_487_PROVENANCE_TRACE_INDEX.json' },
      rows: byTender.get(tender),
      side_effects: { provider_calls: 0, llm_calls: 0, production_db_writes: 0, gold_mutations: 0, flywheel_semantic_labels_created: 0 }
    };
    assertNoSemanticFields(packet);
    const fileName = `${tender}.review-packet.json`;
    const serialized = `${JSON.stringify(packet, null, 2)}\n`;
    packets[fileName] = { packet, serialized };
    packetMeta.push({ file: fileName, tender_id: tender, row_count: packet.rows.length, candidate_count_total: packet.rows.reduce((sum, row) => sum + row.candidate_canonicals.length, 0), sha256: sha256(Buffer.from(serialized)), bytes: Buffer.byteLength(serialized) });
  }
  const indexRows = rows.map((row) => ({
    atom_id: row.atom_id,
    tender_id: row.tender_id,
    review_packet: `${row.tender_id}.review-packet.json`,
    candidate_origin_counts: row.candidate_canonicals.reduce((acc, candidate) => { acc[candidate.candidate_origin] = (acc[candidate.candidate_origin] || 0) + 1; return acc; }, {}),
    candidate_count: row.candidate_canonicals.length,
    candidate_status: row.candidate_status,
    source_linked: row.mechanical_trace.source_linked,
    no_mechanical_link_found: row.mechanical_trace.no_mechanical_link_found
  }));
  const reviewIndex = { artifact_type: 'V43_P0_487_REVIEW_INDEX', artifact_version: 'v1', blind: true, source_truth: { id: SOURCE_TRUTH_ID, sha256: SOURCE_TRUTH_SHA, atom_count: rows.length }, production_run_id: PRODUCTION_RUN_ID, r3_eval_run_id: R3_RUN_ID, rows: indexRows, semantic_labels_created: 0 };
  assertNoSemanticFields(reviewIndex);
  const aggregateReference = {
    artifact_type: 'V43_P0_POST_ADJUDICATION_REFERENCE',
    artifact_version: 'v1',
    status: 'HISTORICAL_AGGREGATE_ONLY',
    source: 'Decision V43_P0_487_SEMANTIC_RECONSTRUCTION_PACKET_V1',
    source_truth: { id: SOURCE_TRUTH_ID, sha256: SOURCE_TRUTH_SHA, denominator: 487 },
    per_case_labels_present: false,
    importable_as_ledger: false,
    warning: 'Aggregate authority is retained separately and is not merged into review rows; no per-case labels were reconstructed.',
    aggregate: { MATCH: 443, PARTIAL: 7, DISTORTED: 6, MISS: 31 },
    by_tender: {
      'JY-001': { PARTIAL: 2, DISTORTED: 0, MISS: 8 },
      'TB-003': { PARTIAL: 1, DISTORTED: 0, MISS: 5 },
      'TB-006': { PARTIAL: 1, DISTORTED: 0, MISS: 5 },
      'FAST-01': { PARTIAL: 1, DISTORTED: 3, MISS: 3 },
      'FAST-04': { PARTIAL: 0, DISTORTED: 2, MISS: 4 },
      'FAST-WATER-01': { PARTIAL: 2, DISTORTED: 1, MISS: 6 }
    }
  };
  const noLinkRows = rows.filter((row) => row.mechanical_trace.no_mechanical_link_found);
  const candidateCounts = rows.map((row) => row.candidate_canonicals.length);
  const manifest = {
    artifact_type: 'V43_P0_487_RECONSTRUCTION_MANIFEST',
    artifact_version: 'v1',
    blind: true,
    source_truth: { id: SOURCE_TRUTH_ID, sha256: SOURCE_TRUTH_SHA, atom_count: 487, counts_by_tender: TENDER_COUNTS },
    production_identity: { run_id: PRODUCTION_RUN_ID, export_directory: 'docs/eval/requirement-production-core6-20260911' },
    mechanical_trace_identity: { eval_run_id: R3_RUN_ID, artifact_path: 'docs/eval/flywheel/V43-FLYWHEEL-P0-487-R3/V43_P0_487_PROVENANCE_TRACE_INDEX.json' },
    ranking_policy: { candidate_precedence: ['normalized_exact_substring', 'strongest_shared_8gram', 'same_page_span_only', 'tender_local_retrieval'], linked_limit: 5, no_link_limit: 8, semantic_judgement: false },
    review_rows: 487,
    unique_atom_ids: new Set(rows.map((row) => row.atom_id)).size,
    no_mechanical_link_count: noLinkRows.length,
    no_link_retrieval_coverage: noLinkRows.filter((row) => row.candidate_canonicals.length > 0).length,
    candidate_coverage_rows: rows.filter((row) => row.candidate_canonicals.length > 0).length,
    no_candidate_count: rows.filter((row) => row.candidate_canonicals.length === 0).length,
    average_candidates_per_atom: Number((candidateCounts.reduce((sum, value) => sum + value, 0) / rows.length).toFixed(6)),
    max_candidates_per_atom: Math.max(...candidateCounts),
    packet_files: packetMeta,
    review_index: { file: 'P0_487_REVIEW_INDEX.json', bytes: Buffer.byteLength(`${JSON.stringify(reviewIndex, null, 2)}\n`), sha256: sha256(Buffer.from(`${JSON.stringify(reviewIndex, null, 2)}\n`)) },
    post_adjudication_reference: { file: 'P0_487_POST_ADJUDICATION_REFERENCE.json', bytes: Buffer.byteLength(`${JSON.stringify(aggregateReference, null, 2)}\n`), sha256: sha256(Buffer.from(`${JSON.stringify(aggregateReference, null, 2)}\n`)) },
    side_effects: { provider_calls: 0, llm_calls: 0, production_db_writes: 0, gold_mutations: 0, flywheel_semantic_labels_created: 0, prompts_changed: false, schemas_changed: false, production_changes: 0 }
  };
  assertNoSemanticFields(manifest);
  return { rows, packets, reviewIndex, aggregateReference, manifest };
}

export function writePacketArtifacts({ outputDir = OUTPUT_DIR, ...inputs } = {}) {
  const artifacts = buildPacketArtifacts(inputs);
  fs.mkdirSync(outputDir, { recursive: true });
  for (const [fileName, value] of Object.entries(artifacts.packets)) fs.writeFileSync(path.join(outputDir, fileName), value.serialized, 'utf8');
  const indexSerialized = `${JSON.stringify(artifacts.reviewIndex, null, 2)}\n`;
  const aggregateSerialized = `${JSON.stringify(artifacts.aggregateReference, null, 2)}\n`;
  fs.writeFileSync(path.join(outputDir, 'P0_487_REVIEW_INDEX.json'), indexSerialized, 'utf8');
  fs.writeFileSync(path.join(outputDir, 'P0_487_POST_ADJUDICATION_REFERENCE.json'), aggregateSerialized, 'utf8');
  const manifest = { ...artifacts.manifest, packet_files: artifacts.manifest.packet_files.map((entry) => ({ ...entry, path: `docs/eval/flywheel/p0-semantic-reconstruction/${entry.file}` })) };
  const manifestSerialized = `${JSON.stringify(manifest, null, 2)}\n`;
  fs.writeFileSync(path.join(outputDir, 'P0_487_RECONSTRUCTION_MANIFEST.json'), manifestSerialized, 'utf8');
  return { ...artifacts, manifest, outputDir };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const inputs = loadInputs();
  const result = writePacketArtifacts(inputs);
  process.stdout.write(`${JSON.stringify({
    status: 'READY_FOR_GPT_P0_487_SEMANTIC_RECONSTRUCTION',
    output_dir: path.relative(ROOT, result.outputDir).replaceAll('\\', '/'),
    packet_paths: Object.keys(result.packets).map((name) => `docs/eval/flywheel/p0-semantic-reconstruction/${name}`),
    review_index: 'docs/eval/flywheel/p0-semantic-reconstruction/P0_487_REVIEW_INDEX.json',
    manifest: 'docs/eval/flywheel/p0-semantic-reconstruction/P0_487_RECONSTRUCTION_MANIFEST.json',
    post_adjudication_reference: 'docs/eval/flywheel/p0-semantic-reconstruction/P0_487_POST_ADJUDICATION_REFERENCE.json',
    rows: result.rows.length,
    candidate_coverage: result.manifest.candidate_coverage_rows,
    no_candidate_count: result.manifest.no_candidate_count,
    average_candidates_per_atom: result.manifest.average_candidates_per_atom,
    max_candidates_per_atom: result.manifest.max_candidates_per_atom,
    no_link_retrieval_coverage: `${result.manifest.no_link_retrieval_coverage}/${result.manifest.no_mechanical_link_count}`,
    provider_calls: 0,
    llm_calls: 0,
    semantic_labels_created: 0
  }, null, 2)}\n`);
}
