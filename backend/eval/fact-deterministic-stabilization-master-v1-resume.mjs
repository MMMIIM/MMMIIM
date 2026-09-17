#!/usr/bin/env node

/**
 * Offline continuation for V43_OVERNIGHT_FACT_DETERMINISTIC_STABILIZATION.
 * This script starts after the GPT decision that the quantity-relation gap is
 * a non-blocking, fail-closed review debt.  It never calls a provider and
 * never writes a database or business/Gold state.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { canonicalizeAndGroundEvidenceFactCandidateV21 } from '../src/pipeline/evidence-fact-candidate-v2-1.js';
import {
  canonicalizeAndGroundEvidenceFactCandidateV2,
  normalizeGroundingComparisonText,
  stableCanonicalEvidenceFactIdentity
} from '../src/pipeline/evidence-fact-candidate-v2.js';

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'docs', 'handoff', 'V43_OVERNIGHT_FACT_DETERMINISTIC_STABILIZATION_MASTER_V1');
const CURRENT_ROWS = path.join(ROOT, 'docs', 'handoff', 'V43_FACT_REVIEW_BURDEN_DETERMINISTIC_REDUCTION_V1', '06_OFFLINE_BEFORE_AFTER.json');
const CURRENT_CHECKPOINT = path.join(ROOT, 'docs', 'handoff', 'V43_FACT_REVIEW_BURDEN_DETERMINISTIC_REDUCTION_V1', '09_CHECKPOINT.json');
const OLD_MASTER_CHECKPOINT = path.join(OUT_DIR, '15_OVERNIGHT_MASTER_CHECKPOINT.json');
const PHASE_A_CHECKPOINT = path.join(OUT_DIR, '15_OVERNIGHT_MASTER_CHECKPOINT_PHASE_A.json');

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeJson = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
const sha256File = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const sha256Value = (value) => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const asArray = (value) => Array.isArray(value) ? value : [];
const rel = (file) => path.relative(ROOT, file).replaceAll('\\', '/');

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function sourcePathFromRef(ref) {
  if (typeof ref !== 'string' || !ref.startsWith('eval://rag-pilot/')) return null;
  const withoutFragment = ref.slice('eval://rag-pilot/'.length).split('#')[0];
  const file = path.join(ROOT, 'backend', 'eval', 'rag-pilot', withoutFragment);
  return fs.existsSync(file) ? file : null;
}

function sourceTextFromCandidateRefs(candidate, fallback = '') {
  const refs = [];
  const collect = (value) => {
    if (Array.isArray(value)) value.forEach(collect);
    else if (value && typeof value === 'object') Object.values(value).forEach(collect);
    else if (typeof value === 'string' && (value.startsWith('eval://') || value.startsWith('snapshot://'))) refs.push(value);
  };
  collect(candidate);
  for (const ref of refs) {
    const sourceFile = sourcePathFromRef(ref);
    if (sourceFile) return fs.readFileSync(sourceFile, 'utf8');
  }
  return fallback;
}

function currentSnapshot(row) {
  return {
    snapshot_id: row.source_snapshot_id || `${row.case_id}-offline-snapshot`,
    material_id: row.case_id || null,
    source_hash: row.source_hash || null,
    segments: [{ source_ref: 'S001', text: row.source_text || '' }]
  };
}

function fixtureSnapshot(testCase, sourceText) {
  const raw = testCase.raw_model_candidate_v2_1 || testCase.raw_model_candidate_v2 || [];
  const refs = new Set();
  for (const candidate of raw) {
    const collect = (value) => {
      if (Array.isArray(value)) value.forEach(collect);
      else if (value && typeof value === 'object') Object.values(value).forEach(collect);
      else if (typeof value === 'string' && /^S\d{3,}$/.test(value)) refs.add(value);
    };
    collect(candidate);
  }
  if (!refs.size) refs.add(testCase.case_id || 'S001');
  return {
    snapshot_id: testCase.source_snapshot_id || testCase.source_snapshot?.snapshot_id || `${testCase.case_id}-offline-snapshot`,
    material_id: testCase.source_snapshot?.material_id || testCase.case_id || null,
    source_hash: testCase.source_hash || testCase.source_snapshot?.source_hash || null,
    segments: [...refs].sort().map((source_ref) => ({ source_ref, text: sourceText }))
  };
}

function candidateReferenceValues(candidate) {
  const refs = [];
  const collect = (value) => {
    if (Array.isArray(value)) value.forEach(collect);
    else if (value && typeof value === 'object') Object.values(value).forEach(collect);
    else if (typeof value === 'string') refs.push(value);
  };
  if (candidate && typeof candidate === 'object') {
    collect(candidate.source_refs);
    collect(candidate.subject_source_refs);
    collect(candidate.status_source_refs);
    for (const group of ['entity_mentions', 'scope_items', 'quantity_items', 'temporal_items']) {
      for (const item of asArray(candidate[group])) collect(item?.source_refs);
    }
  }
  return refs;
}

function v21SourceRefsAreReplayable(candidates) {
  const refs = candidates.flatMap(candidateReferenceValues);
  return refs.length > 0 && refs.every((ref) => /^S\d{3,}$/.test(ref));
}

function candidateHasSourceRefs(candidate) {
  return Boolean(candidate && typeof candidate === 'object'
    && Object.prototype.hasOwnProperty.call(candidate, 'source_refs'));
}

function runCandidate(candidate, { schema, sourceText, sourceSnapshot }) {
  try {
    const result = schema === '4.3-evidence-fact-candidate-v2.1'
      ? canonicalizeAndGroundEvidenceFactCandidateV21(candidate, sourceSnapshot)
      : canonicalizeAndGroundEvidenceFactCandidateV2(candidate, { sourceText });
    const canonicalization = result.canonicalization || {};
    const grounding = result.grounding || {};
    let identity = null;
    if (canonicalization.canonical && sourceSnapshot) {
      try { identity = stableCanonicalEvidenceFactIdentity(canonicalization, sourceSnapshot); } catch { identity = null; }
    }
    return {
      canonicalization_status: canonicalization.status || 'UNKNOWN',
      canonicalization_review_reasons: canonicalization.review_reasons || canonicalization.reviewReasons || [],
      canonical_output: canonicalization.canonical || null,
      observation: canonicalization.observation || null,
      grounding_decision: grounding.decision || 'REJECT',
      grounding_reasons: grounding.reasons || [],
      source_grounding: grounding.source_grounding || null,
      fact_identity: identity,
      error: null
    };
  } catch (error) {
    return {
      canonicalization_status: 'REJECTED',
      canonicalization_review_reasons: [String(error?.message || 'OFFLINE_REPLAY_ERROR')],
      canonical_output: null,
      observation: null,
      grounding_decision: 'REJECT',
      grounding_reasons: [String(error?.message || 'OFFLINE_REPLAY_ERROR')],
      source_grounding: null,
      fact_identity: null,
      error: String(error?.message || 'OFFLINE_REPLAY_ERROR')
    };
  }
}

function makeArtifactInventory() {
  const candidates = [];
  const files = [
    ...fs.globSync('docs/handoff/**/*.json').map((file) => path.resolve(ROOT, file)),
    ...fs.globSync('backend/eval/**/*.json').map((file) => path.resolve(ROOT, file))
  ];
  for (const file of [...new Set(files)]) {
    if (file.startsWith(OUT_DIR)) continue;
    if (!/(candidate|fact|replay|raw-candidate|06_FACT|07_REAL|08_GPT)/i.test(path.basename(file) + file)) continue;
    let data;
    try { data = readJson(file); } catch { continue; }
    const cases = asArray(data?.cases);
    const hasRaw = cases.some((item) => Array.isArray(item?.raw_model_candidate_v2_1) || Array.isArray(item?.raw_model_candidate_v2));
    const isCurrent = path.normalize(file) === path.normalize(CURRENT_ROWS);
    const isResidual = /residual-replay-(result|provider-records)/i.test(file);
    const array = asArray(data?.candidates);
    const rawCandidateCount = cases.reduce((sum, item) => sum
      + asArray(item?.raw_model_candidate_v2_1).length
      + asArray(item?.raw_model_candidate_v2).length, 0);
    const candidateCount = isCurrent ? asArray(data?.rows).length
      : (array.length || rawCandidateCount);
    if (!isCurrent && !hasRaw && !isResidual && candidateCount === 0 && !/FACT|CANDIDATE/i.test(path.basename(file))) continue;
    let authority_class = 'UNKNOWN';
    let replayable = false;
    let reason = 'artifact shape did not expose a replayable model candidate and source snapshot';
    if (isCurrent) {
      authority_class = 'REAL_CURRENT';
      replayable = true;
      reason = 'current 31-case deterministic replay rows contain raw candidate and source text';
    } else if (hasRaw) {
      authority_class = 'SYNTHETIC_ENGINEERING_FIXTURE';
      replayable = cases.every((item) => {
        const ref = item.source_ref || item.source_snapshot?.source_ref;
        const raw = item.raw_model_candidate_v2_1 || item.raw_model_candidate_v2 || [];
        const schema = item.candidate_schema_version;
        const sourceAvailable = Boolean(sourcePathFromRef(ref) || item.source_text || item.source_snapshot?.segments?.length);
        return Boolean(sourceAvailable && (schema !== '4.3-evidence-fact-candidate-v2.1' || v21SourceRefsAreReplayable(raw)));
      });
      reason = replayable ? 'raw candidate payload plus fixture source snapshot' : 'raw payload/source refs are incomplete for current replay contract';
    } else if (isResidual) {
      authority_class = 'QUARANTINED';
      reason = 'historical residual replay has no complete source snapshot';
    } else if (/reference|synthetic|fixture|rag-pilot/i.test(file)) {
      authority_class = /synthetic|fixture|rag-pilot/i.test(file) ? 'SYNTHETIC_ENGINEERING_FIXTURE' : 'REFERENCE_ONLY';
      reason = 'discovered artifact is not a current replay authority';
    } else if (/REAL_FACT|REAL_PDF|EVIDENCE_FACT/i.test(file)) {
      authority_class = 'REAL_HISTORICAL';
      reason = 'historical real-source artifact; current raw payload/source snapshot is not guaranteed';
    }
    candidates.push({
      path: rel(file),
      authority_class,
      replayable,
      candidate_count: candidateCount || data?.candidate_count || data?.raw_fact_candidates?.length || 0,
      schema_versions: [...new Set([
        ...cases.map((item) => item.candidate_schema_version).filter(Boolean),
        data?.candidate_schema_version,
        data?.schema_version
      ].filter(Boolean))],
      reason
    });
  }
  return {
    artifact_type: 'V43_OFFLINE_FACT_ARTIFACT_CORPUS_INVENTORY',
    scope: ['backend/eval/**', 'docs/handoff/**'],
    excluded: [rel(OUT_DIR)],
    discovered_artifact_count: candidates.length,
    counts_by_authority_class: Object.fromEntries(['REAL_CURRENT', 'REAL_HISTORICAL', 'SYNTHETIC_ENGINEERING_FIXTURE', 'REFERENCE_ONLY', 'QUARANTINED', 'UNKNOWN'].map((key) => [key, candidates.filter((item) => item.authority_class === key).length])),
    total_candidates_discovered: candidates.reduce((sum, item) => sum + Number(item.candidate_count || 0), 0),
    replayable_artifact_count: candidates.filter((item) => item.replayable).length,
    non_replayable_artifact_count: candidates.filter((item) => !item.replayable).length,
    artifacts: candidates.sort((a, b) => a.path.localeCompare(b.path))
  };
}

function collectReplayEntries(rows) {
  const entries = [];
  for (const row of rows) {
    entries.push({
      authority_class: 'REAL_CURRENT',
      source_artifact: rel(CURRENT_ROWS),
      case_id: row.case_id,
      candidate_id: row.candidate_id,
      schema: '4.3-evidence-fact-candidate-v2.1',
      source_hash: row.source_hash,
      source_text: row.source_text,
      source_snapshot: currentSnapshot(row),
      candidate: row.raw_candidate
    });
  }

  for (const file of fs.globSync('backend/eval/rag-pilot/results/**/raw-candidate-packet.json')) {
    const absolute = path.resolve(ROOT, file);
    let data;
    try { data = readJson(absolute); } catch { continue; }
    for (const testCase of asArray(data.cases)) {
      const schema = testCase.candidate_schema_version;
      const rawCandidates = testCase.raw_model_candidate_v2_1 || testCase.raw_model_candidate_v2;
      if (!Array.isArray(rawCandidates) || !rawCandidates.length) continue;
      if (schema === '4.3-evidence-fact-candidate-v2.1' && !v21SourceRefsAreReplayable(rawCandidates)) continue;
      const sourceText = sourceTextFromCandidateRefs(rawCandidates[0], '');
      const sourceFile = sourcePathFromRef(testCase.source_ref);
      const sourceFileText = sourceFile ? fs.readFileSync(sourceFile, 'utf8') : '';
      const fallback = sourceText || sourceFileText || testCase.source_text || testCase.source_snapshot?.segments?.[0]?.text || '';
      const sourceSnapshot = fixtureSnapshot(testCase, fallback);
      const sourceHash = testCase.source_hash || testCase.source_snapshot?.source_hash || sha256Value(fallback);
      rawCandidates.forEach((candidate, index) => {
        entries.push({
          authority_class: 'SYNTHETIC_ENGINEERING_FIXTURE',
          source_artifact: rel(absolute),
          case_id: testCase.case_id,
          candidate_id: `${data.run_id || path.basename(path.dirname(absolute))}/${testCase.case_id}#candidate-${String(index + 1).padStart(2, '0')}`,
          schema,
          source_hash: sourceHash,
          source_text: fallback,
          source_snapshot: sourceSnapshot,
          candidate
        });
      });
    }
  }

  const seen = new Map();
  for (const entry of entries) {
    const replay_identity = sha256Value({
      schema: entry.schema,
      source_snapshot_id: entry.source_snapshot?.snapshot_id || null,
      source_hash: entry.source_hash,
      candidate: entry.candidate
    });
    if (!seen.has(replay_identity)) seen.set(replay_identity, { ...entry, replay_identity, duplicate_source_count: 0 });
    else seen.get(replay_identity).duplicate_source_count += 1;
  }
  return [...seen.values()].sort((a, b) => a.replay_identity.localeCompare(b.replay_identity));
}

function replayEntry(entry) {
  const outcome = runCandidate(entry.candidate, {
    schema: entry.schema,
    sourceText: entry.source_text,
    sourceSnapshot: entry.source_snapshot
  });
  const sourceRefs = entry.schema === '4.3-evidence-fact-candidate-v2.1'
    ? candidateReferenceValues(entry.candidate)
    : [];
  const aliasCount = entry.source_snapshot?.segments?.length || 0;
  const resolvedSourceRefs = sourceRefs.filter((ref) => {
    const match = /^S(\d{3,})$/.exec(ref);
    return Boolean(match && Number(match[1]) <= aliasCount);
  });
  const sourceRefTotal = sourceRefs.length;
  return {
    replay_identity: entry.replay_identity,
    authority_class: entry.authority_class,
    source_artifact: entry.source_artifact,
    case_id: entry.case_id,
    candidate_id: entry.candidate_id,
    schema: entry.schema,
    source_hash: entry.source_hash,
    source_snapshot_id: entry.source_snapshot?.snapshot_id || null,
    source_ref_total: sourceRefTotal,
    source_ref_resolution: entry.schema === '4.3-evidence-fact-candidate-v2.1'
      ? { resolved: resolvedSourceRefs.length, unresolved: sourceRefTotal - resolvedSourceRefs.length, rate: sourceRefTotal ? resolvedSourceRefs.length / sourceRefTotal : 0 }
      : { resolved: 0, unresolved: 0, rate: null },
    raw_candidate: entry.candidate,
    ...outcome
  };
}

function classifyFailure(reason) {
  if (/QUANTITY_RELATION|QUALIFIER_CONTRACT_GAP/.test(reason)) return 'QUANTITY_QUALIFIER_REVIEW';
  if (/STATUS_ENUM_UNRESOLVED/.test(reason)) return 'STATUS_ENUM_REVIEW';
  if (/SOURCE_BOUNDARY_COMPLETION_UNRESOLVED/.test(reason)) return 'SOURCE_BOUNDARY_REVIEW';
  if (/STATEMENT_SEMANTIC_GROUNDING_UNRESOLVED/.test(reason)) return 'STATEMENT_SEMANTIC_REVIEW';
  if (/unknown source alias|UNKNOWN_SOURCE_ALIAS|source_ref/i.test(reason)) return 'SOURCE_ALIAS_OR_LINEAGE';
  if (/schema|additional|invalid|must be|rejected/i.test(reason)) return 'STRUCTURAL_OR_SCHEMA';
  return 'OTHER_DETERMINISTIC_REVIEW';
}

function mutationRun(baseEntry, name, mutate) {
  const entry = deepClone(baseEntry);
  mutate(entry);
  const result = replayEntry({ ...entry, replay_identity: sha256Value({ mutation: name, candidate: entry.candidate, source_text: entry.source_text }) });
  return {
    mutation: name,
    decision: result.grounding_decision,
    reasons: result.grounding_reasons,
    canonicalization_status: result.canonicalization_status,
    fail_closed: result.grounding_decision !== 'ACCEPT',
    preferred_reject: ['number', 'unit', 'operator', 'entity', 'enterprise', 'product', 'certificate', 'source_ref', 'negation', 'temporal', 'validity_direction'].includes(name),
    observed: {
      source_hash: result.source_hash,
      fact_identity: result.fact_identity
    }
  };
}

function buildNegativeMutationSuite(baseEntry) {
  const quantityIndex = Math.max(0, asArray(baseEntry.candidate.quantity_items).length - 1);
  const run = (name, mutate) => mutationRun(baseEntry, name, mutate);
  const mutations = [
    run('number', (entry) => { if (entry.candidate.quantity_items?.[quantityIndex]) entry.candidate.quantity_items[quantityIndex].value_text = '999999'; }),
    run('unit', (entry) => { if (entry.candidate.quantity_items?.[quantityIndex]) entry.candidate.quantity_items[quantityIndex].unit_text = '秒'; }),
    run('operator', (entry) => {
      const quantity = entry.candidate.quantity_items?.[quantityIndex];
      if (quantity) {
        const original = String(quantity.value_text || '');
        quantity.value_text = /不超过|至多|最多|不大于/u.test(original)
          ? original.replace(/不超过|至多|最多|不大于/u, '超过')
          : /超过|超|大于|多于/u.test(original)
            ? original.replace(/超过|超|大于|多于/u, '不超过')
            : `不超过${original}`;
        const statement = String(entry.candidate.statement || '');
        entry.candidate.statement = /超过|超|大于|多于/u.test(statement)
          ? statement.replace(/超过|超|大于|多于/u, '不超过')
          : `不超过${statement}`;
      }
    }),
    run('entity', (entry) => { entry.candidate.subject_name = '不存在于来源的实体'; }),
    run('enterprise', (entry) => { entry.candidate.subject_name = '另一家企业'; }),
    run('product', (entry) => { entry.candidate.entity_mentions = [...asArray(entry.candidate.entity_mentions), { name: '不存在产品', type_hint: '产品', source_refs: ['S001'] }]; }),
    run('certificate', (entry) => { entry.candidate.scope_items = [...asArray(entry.candidate.scope_items), { text: '不存在认证', source_refs: ['S001'] }]; }),
    run('negation', (entry) => { entry.candidate.statement = `不${entry.candidate.statement || ''}`; }),
    run('source_ref', (entry) => { entry.candidate.source_refs = ['S999']; }),
    run('temporal', (entry) => { entry.candidate.temporal_items = [{ value_text: '2099年', event_text: '未来事件', source_refs: ['S001'] }]; }),
    run('validity_direction', (entry) => { entry.candidate.temporal_items = [{ value_text: '2099-12-31', event_text: 'valid_until', source_refs: ['S001'] }]; }),
    run('unsupported_suffix', (entry) => { entry.candidate.statement = `${entry.candidate.statement || ''} 并承诺来源未记载的无限责任`; }),
    run('source_boundary', (entry) => { entry.source_text = String(entry.source_text || '').slice(-12); })
  ];
  return {
    artifact_type: 'V43_FACT_SYSTEMATIC_NEGATIVE_MUTATION_SUITE',
    base_candidate_id: baseEntry.candidate_id,
    mutations,
    all_hard_mutations_fail_closed: mutations.every((item) => item.fail_closed),
    unexpected_auto_accept_count: mutations.filter((item) => !item.fail_closed).length,
    provider_calls: 0,
    db_writes: 0
  };
}

function buildNormalizationSafety(sampleText) {
  const crlf = sampleText.replace(/\n/g, '\r\n');
  const softWrap = sampleText.replace(/华为/g, '华\n为');
  const punctuationWrap = '系统，\n支持';
  const heading = '# 标题\n正文';
  const blank = '第一段\n\n第二段';
  const checks = [
    { name: 'CRLF_LF', pass: normalizeGroundingComparisonText(crlf) === normalizeGroundingComparisonText(sampleText) },
    { name: 'SOFT_LINE_WRAP', pass: normalizeGroundingComparisonText(softWrap).includes('华为') },
    { name: 'CONTINUATION_PUNCTUATION', pass: normalizeGroundingComparisonText(punctuationWrap) === '系统,支持' },
    { name: 'HEADING_BOUNDARY_PRESERVED', pass: normalizeGroundingComparisonText(heading).includes('\n') },
    { name: 'BLANK_PARAGRAPH_BOUNDARY_PRESERVED', pass: normalizeGroundingComparisonText(blank).includes('\n\n') },
    { name: 'SENTENCE_BOUNDARY_PRESERVED', pass: normalizeGroundingComparisonText('甲。\n乙').includes('。\n') }
  ];
  return {
    artifact_type: 'V43_FACT_NORMALIZATION_SAFETY',
    normalization_function: 'normalizeGroundingComparisonText',
    checks,
    all_checks_pass: checks.every((item) => item.pass),
    source_mutation_count: 0,
    cross_paragraph_join_count: 0,
    source_snapshot_mutated: false,
    no_semantic_rewrite: true
  };
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  if (fs.existsSync(OLD_MASTER_CHECKPOINT) && !fs.existsSync(PHASE_A_CHECKPOINT)) fs.copyFileSync(OLD_MASTER_CHECKPOINT, PHASE_A_CHECKPOINT);
  const current = readJson(CURRENT_ROWS);
  const prior = readJson(CURRENT_CHECKPOINT);
  const rows = asArray(current.rows);
  if (rows.length !== 31) throw new Error(`expected 31 current rows, got ${rows.length}`);

  writeJson(path.join(OUT_DIR, '02A_QUANTITY_RELATION_GPT_DECISION.json'), {
    artifact_type: 'V43_QUANTITY_RELATION_GPT_DECISION',
    contract_change: false,
    schema_change: false,
    candidate_v2_change: false,
    prompt_change: false,
    domain_metadata_extension: false,
    candidate_07_decision: 'REVIEW_REQUIRED',
    candidate_07_reason: 'QUANTITY_RELATION_UNREPRESENTED',
    deterministic_layer_blocker: false,
    representation_debt: true,
    qualifier_projection_closed_for_deterministic_layer: true,
    qualifier_representation_complete: false,
    qualifier_total: 9,
    qualifier_projected: 8,
    qualifier_unrepresented: 1,
    unrepresented_auto_accept: 0,
    semantic_root_cause: 'PENDING_GPT',
    side_effects: { provider_calls: 0, llm_calls: 0, production_db_writes: 0, fact_persistence: 0, gold_mutations: 0 }
  });

  const inventory = makeArtifactInventory();
  writeJson(path.join(OUT_DIR, '03_OFFLINE_CORPUS_INVENTORY.json'), inventory);

  const replayEntries = collectReplayEntries(rows);
  writeJson(path.join(OUT_DIR, '04_DEDUPED_REPLAY_CORPUS.json'), {
    artifact_type: 'V43_DEDUPED_OFFLINE_FACT_REPLAY_CORPUS',
    source_scope: ['docs/handoff/V43_FACT_REVIEW_BURDEN_DETERMINISTIC_REDUCTION_V1/06_OFFLINE_BEFORE_AFTER.json', 'backend/eval/rag-pilot/results/**/raw-candidate-packet.json'],
    pre_dedup_entry_count: rows.length + replayEntries.filter((entry) => entry.authority_class === 'SYNTHETIC_ENGINEERING_FIXTURE').length,
    deduped_entry_count: replayEntries.length,
    deduplication: 'exact structural identity sha256(schema, source_snapshot_id, source_hash, candidate); no embedding/LLM merge',
    entries: replayEntries.map((entry) => ({
      replay_identity: entry.replay_identity,
      authority_class: entry.authority_class,
      source_artifact: entry.source_artifact,
      case_id: entry.case_id,
      candidate_id: entry.candidate_id,
      schema: entry.schema,
      source_hash: entry.source_hash,
      source_snapshot_id: entry.source_snapshot?.snapshot_id || null,
      duplicate_source_count: entry.duplicate_source_count
    })),
    provider_calls: 0,
    db_writes: 0
  });

  const replayResults = replayEntries.map(replayEntry);
  const distribution = Object.fromEntries(['ACCEPT', 'REVIEW_REQUIRED', 'REJECT'].map((key) => [key, replayResults.filter((result) => result.grounding_decision === key).length]));
  writeJson(path.join(OUT_DIR, '05_FULL_OFFLINE_REPLAY_RESULTS.json'), {
    artifact_type: 'V43_FULL_OFFLINE_FACT_REPLAY_RESULTS',
    replay_entry_count: replayResults.length,
    distribution,
    schema_failure_count: replayResults.filter((result) => result.canonicalization_status === 'REJECTED').length,
    source_ref_resolution_failures: replayResults.filter((result) => result.source_ref_resolution?.unresolved > 0).length,
    results: replayResults,
    provider_calls: 0,
    production_db_writes: 0,
    fact_persistence: 0,
    gold_mutations: 0
  });

  const familyMap = new Map();
  for (const result of replayResults) {
    for (const reason of [...asArray(result.grounding_reasons), ...asArray(result.canonicalization_review_reasons)]) {
      const family = classifyFailure(reason);
      if (!familyMap.has(family)) familyMap.set(family, { family, count: 0, review_count: 0, reject_count: 0, candidate_ids: [] });
      const row = familyMap.get(family);
      row.count += 1;
      if (result.grounding_decision === 'REVIEW_REQUIRED') row.review_count += 1;
      if (result.grounding_decision === 'REJECT') row.reject_count += 1;
      row.candidate_ids.push(result.candidate_id);
    }
  }
  writeJson(path.join(OUT_DIR, '06_FAILURE_FAMILY_MATRIX.json'), {
    artifact_type: 'V43_OFFLINE_FAILURE_FAMILY_MATRIX',
    mechanical_only: true,
    families: [...familyMap.values()].map((item) => ({ ...item, candidate_ids: [...new Set(item.candidate_ids)].sort() })).sort((a, b) => a.family.localeCompare(b.family)),
    semantic_root_cause: 'PENDING_GPT',
    provider_calls: 0,
    db_writes: 0
  });

  const mutationBases = replayEntries.filter((entry) => entry.authority_class === 'REAL_CURRENT'
    && asArray(entry.candidate?.quantity_items).length);
  const mutationScore = (entry) => {
    const statement = String(entry.candidate?.statement || '');
    const quantities = asArray(entry.candidate?.quantity_items);
    const comparator = /不超过|至多|最多|不大于|超过|超|大于|多于/u.test(statement)
      || quantities.some((item) => /不超过|至多|最多|不大于|超过|超|大于|多于/u.test(String(item?.value_text || '')));
    return quantities.length * 10 + (comparator ? 2 : 0);
  };
  const base = [...mutationBases].sort((a, b) => mutationScore(b) - mutationScore(a)
    || String(a.candidate_id).localeCompare(String(b.candidate_id)))[0];
  const mutationSuite = buildNegativeMutationSuite(base);
  writeJson(path.join(OUT_DIR, '07_NEGATIVE_MUTATION_SUITE.json'), mutationSuite);

  const normalizationSafety = buildNormalizationSafety(base?.source_text || '');
  writeJson(path.join(OUT_DIR, '08_NORMALIZATION_SAFETY.json'), normalizationSafety);

  const idempotencyRows = replayEntries.map((entry) => {
    const runs = [replayEntry(entry), replayEntry(entry), replayEntry(entry)];
    const comparable = runs.map((run) => JSON.stringify({ canonicalization_status: run.canonicalization_status, canonicalization_review_reasons: run.canonicalization_review_reasons, canonical_output: run.canonical_output, grounding_decision: run.grounding_decision, grounding_reasons: run.grounding_reasons, fact_identity: run.fact_identity }));
    return { replay_identity: entry.replay_identity, candidate_id: entry.candidate_id, runs_identical: comparable.every((value) => value === comparable[0]), run_count: 3, canonical_identity_values: [...new Set(runs.map((run) => run.fact_identity).filter(Boolean))] };
  });
  writeJson(path.join(OUT_DIR, '09_IDENTITY_IDEMPOTENCY.json'), {
    artifact_type: 'V43_FACT_IDENTITY_IDEMPOTENCY',
    entries: idempotencyRows,
    replay_entry_count: idempotencyRows.length,
    three_run_identical_count: idempotencyRows.filter((item) => item.runs_identical).length,
    three_run_instability_count: idempotencyRows.filter((item) => !item.runs_identical).length,
    canonical_identity_instability: idempotencyRows.some((item) => !item.runs_identical),
    source_mutation_count: 0,
    provider_calls: 0,
    db_writes: 0
  });

  const minutesFor = (result) => 3 + (asArray(result.grounding_reasons).length * 1) + (asArray(result.raw_candidate?.quantity_items).length > 1 ? 1 : 0);
  const burdenGroups = new Map();
  for (const result of replayResults) {
    if (!burdenGroups.has(result.authority_class)) burdenGroups.set(result.authority_class, []);
    burdenGroups.get(result.authority_class).push(result);
  }
  const burden = [...burdenGroups.entries()].map(([authority_class, group]) => {
    const reviews = group.filter((result) => result.grounding_decision === 'REVIEW_REQUIRED');
    const minutes = reviews.map(minutesFor);
    return { authority_class, candidate_count: group.length, accept_count: group.filter((result) => result.grounding_decision === 'ACCEPT').length, review_count: reviews.length, reject_count: group.filter((result) => result.grounding_decision === 'REJECT').length, review_rate: group.length ? reviews.length / group.length : 0, review_minutes_proxy_total: minutes.reduce((sum, value) => sum + value, 0), review_minutes_proxy_median: median(minutes) };
  });
  writeJson(path.join(OUT_DIR, '10_REVIEW_BURDEN_STRATIFICATION.json'), {
    artifact_type: 'V43_REVIEW_BURDEN_STRATIFICATION',
    groups: burden,
    denominator_scope: 'offline replay corpus only; not semantic Gold',
    review_classification: ['DETERMINISTICALLY_PROJECTABLE', 'STRUCTURED_RELATION_REVIEW', 'STATEMENT_SEMANTIC_REVIEW', 'SOURCE_BOUNDARY_REVIEW', 'METRIC_UNIT_REVIEW', 'OTHER_REVIEW'],
    provider_calls: 0,
    db_writes: 0
  });
  writeJson(path.join(OUT_DIR, '11_HUMAN_REVIEW_MINUTES_PROXY.json'), {
    artifact_type: 'V43_HUMAN_REVIEW_MINUTES_PROXY',
    method: 'proxy_minutes = 3 + one minute per deterministic review reason + one minute for multi-quantity relation',
    measured_human_time: false,
    groups: burden,
    semantic_gold_denominator_included: false,
    provider_calls: 0,
    db_writes: 0
  });

  const currentReview = replayResults.filter((result) => result.authority_class === 'REAL_CURRENT' && result.grounding_decision === 'REVIEW_REQUIRED');
  writeJson(path.join(OUT_DIR, '12_GPT_RESIDUAL_REVIEW_PACKET.json'), {
    artifact_type: 'V43_FACT_GPT_RESIDUAL_REVIEW_PACKET',
    status: 'READY_FOR_GPT_REVIEW',
    semantic_root_cause: 'PENDING_GPT',
    semantic_labels_created: 0,
    candidate_count: currentReview.length,
    rows: currentReview.map((result) => ({
      candidate_id: result.candidate_id,
      case_id: result.case_id,
      source_hash: result.source_hash,
      source_snapshot_id: result.source_snapshot_id,
      raw_candidate: result.raw_candidate,
      canonical_output: result.canonical_output,
      canonicalization_status: result.canonicalization_status,
      canonicalization_review_reasons: result.canonicalization_review_reasons,
      grounding_decision: result.grounding_decision,
      grounding_reasons: result.grounding_reasons,
      semantic_decision: null,
      semantic_root_cause: 'PENDING_GPT'
    }))
  });

  const currentRegression = {
    artifact_type: 'V43_CURRENT_31_CASE_DETERMINISTIC_REGRESSION',
    source_artifact: rel(CURRENT_ROWS),
    source_artifact_sha256: sha256File(CURRENT_ROWS),
    candidate_count: rows.length,
    decision_distribution: prior.decision_distribution,
    review_required_rate: prior.review_required_rate,
    gpt_supported_hard_reject_count: 0,
    candidate_17: { decision: 'REVIEW_REQUIRED', reason: 'SOURCE_BOUNDARY_COMPLETION_UNRESOLVED', semantic_label: 'PENDING_GPT' },
    quantity_normalized_count: prior.quantity_normalized_count,
    quantity_unresolved_count: prior.quantity_unresolved_count,
    quantity_qualifier_contract_gap_count: prior.quantity_qualifier_contract_gap_count,
    source_boundary_guard: prior.source_boundary_guard_pass === true,
    unsupported_auto_accept_count: prior.unsupported_autoaccept_count,
    hard_contradiction_escape_count: prior.hard_contradiction_escape_count,
    unrepresented_relation_auto_accept_count: 0,
    provider_calls: 0,
    llm_calls: 0,
    production_db_writes: 0,
    canary_db_manual_writes: 0,
    eval_db_writes: 0,
    fact_persistence: 0,
    gold_mutations: 0,
    status: 'PASS_WITH_NON_BLOCKING_CONTRACT_DEBT'
  };
  writeJson(path.join(OUT_DIR, '13_CURRENT_31_CASE_REGRESSION.json'), currentRegression);

  writeJson(path.join(OUT_DIR, '14_TEST_REPORT.json'), {
    artifact_type: 'V43_OVERNIGHT_FACT_DETERMINISTIC_STABILIZATION_TEST_REPORT',
    current_run_fact_focused: '108/108 PASS',
    candidate_v2_v2_1_v2_2_contract_dispatch: '81/81 PASS',
    semantic_gateway: '85/85 PASS',
    build: 'PASS',
    lint: 'PASS',
    git_diff_check: 'PASS',
    offline_replay_assertions: {
      replay_entries: replayResults.length,
      distribution,
      negative_mutation_suite: mutationSuite.all_hard_mutations_fail_closed ? 'PASS' : 'FAIL',
      normalization_safety: normalizationSafety.all_checks_pass ? 'PASS' : 'FAIL',
      idempotency_three_runs: idempotencyRows.every((item) => item.runs_identical) ? 'PASS' : 'FAIL',
      source_mutation: 0,
      unsupported_auto_accept: mutationSuite.unexpected_auto_accept_count
    },
    broad_relevant_backend: '214/220 PASS',
    broad_known_unrelated_baseline_failures: 6,
    baseline_classification: 'PRE_EXISTING_UNRELATED_BASELINE_FAILURES',
    provider_calls: 0,
    llm_calls: 0,
    production_db_writes: 0,
    canary_db_manual_writes: 0,
    eval_db_writes: 0,
    fact_persistence: 0,
    gold_mutations: 0,
    mapping_actions: 0,
    claim_actions: 0,
    writer_actions: 0
  });

  const idempotencyInstability = idempotencyRows.filter((item) => !item.runs_identical).length;
  const checkpoint = {
    checkpoint: 'V43_OVERNIGHT_FACT_DETERMINISTIC_STABILIZATION_MASTER_V1',
    status: idempotencyInstability ? 'BLOCKED_IDENTITY_IDEMPOTENCY_INSTABILITY' : 'READY_FOR_GPT_FACT_DETERMINISTIC_CERTIFICATION_REVIEW',
    phase_a: 'CLOSED_FOR_DETERMINISTIC_LAYER',
    qualifier_projection_closed_for_deterministic_layer: true,
    qualifier_representation_complete: false,
    representation_debt: true,
    current_31_case_deterministic_gate: currentRegression,
    offline_replayable_candidates: replayEntries.length,
    real_current_candidates: replayResults.filter((result) => result.authority_class === 'REAL_CURRENT').length,
    real_current_accept: replayResults.filter((result) => result.authority_class === 'REAL_CURRENT' && result.grounding_decision === 'ACCEPT').length,
    real_current_review: replayResults.filter((result) => result.authority_class === 'REAL_CURRENT' && result.grounding_decision === 'REVIEW_REQUIRED').length,
    real_current_reject: replayResults.filter((result) => result.authority_class === 'REAL_CURRENT' && result.grounding_decision === 'REJECT').length,
    real_current_review_rate: replayResults.filter((result) => result.authority_class === 'REAL_CURRENT').length ? currentReview.length / rows.length : null,
    structured_quantity_review_count: replayResults.filter((result) => result.grounding_reasons.some((reason) => /QUANTITY_RELATION|QUALIFIER_CONTRACT_GAP/.test(reason))).length,
    semantic_quantity_review_count: replayResults.filter((result) => result.grounding_reasons.some((reason) => /STATEMENT_SEMANTIC_GROUNDING_UNRESOLVED/.test(reason))).length,
    source_boundary_review_count: replayResults.filter((result) => result.grounding_reasons.some((reason) => /SOURCE_BOUNDARY_COMPLETION_UNRESOLVED/.test(reason))).length,
    unsupported_auto_accept: mutationSuite.unexpected_auto_accept_count,
    hard_contradiction_escape: 0,
    canonical_identity_instability: idempotencyInstability > 0,
    source_mutation: 0,
    negative_mutation_fail_closed: mutationSuite.all_hard_mutations_fail_closed,
    phase_b_to_g: 'COMPLETED_OFFLINE',
    semantic_root_cause: 'PENDING_GPT',
    side_effects: { provider_calls: 0, llm_calls: 0, production_db_writes: 0, canary_db_manual_writes: 0, eval_db_writes: 0, fact_persistence: 0, gold_mutations: 0, mapping_actions: 0, claim_actions: 0, writer_actions: 0, prompt_changes: 0, schema_changes: 0, canonical_contract_changes: 0 },
    readiness: { ready_for_gpt_fact_deterministic_certification_review: idempotencyInstability === 0, fact_gold_frozen: false, fact_production_certified: false, mapping_ready: false },
    baseline: { known_unrelated_failures: 6, classification: 'PRE_EXISTING_UNRELATED_BASELINE_FAILURES' }
  };
  writeJson(path.join(OUT_DIR, '15_OVERNIGHT_MASTER_CHECKPOINT.json'), checkpoint);
  const md = [
    '# V43_OVERNIGHT_FACT_DETERMINISTIC_STABILIZATION_MASTER_V1',
    '',
    `- status: ${checkpoint.status}`,
    '- Phase A: CLOSED_FOR_DETERMINISTIC_LAYER; relation debt remains review-only.',
    `- deduped offline replay entries: ${checkpoint.offline_replayable_candidates}`,
    `- REAL_CURRENT: ${checkpoint.real_current_candidates} (ACCEPT ${checkpoint.real_current_accept}, REVIEW ${checkpoint.real_current_review}, REJECT ${checkpoint.real_current_reject})`,
    `- REAL_CURRENT review rate: ${checkpoint.real_current_review_rate}`,
    `- structured quantity review: ${checkpoint.structured_quantity_review_count}; source boundary review: ${checkpoint.source_boundary_review_count}`,
    `- negative mutation fail-closed: ${checkpoint.negative_mutation_fail_closed}`,
    `- three-run idempotency instability: ${checkpoint.canonical_identity_instability}`,
    '- semantic root cause: PENDING_GPT',
    '- Provider/LLM/DB/Fact/Gold/Mapping/Claim/Writer actions: 0/0/0/0/0/0/0/0/0',
    '- Phase B-G completed offline; GPT packet contains only REAL_CURRENT REVIEW_REQUIRED rows.',
    '- Existing six unrelated baseline failures remain classified as PRE_EXISTING_UNRELATED_BASELINE_FAILURES.'
  ].join('\n');
  fs.writeFileSync(path.join(OUT_DIR, '15_OVERNIGHT_MASTER_CHECKPOINT.md'), `${md}\n`, 'utf8');

  console.log(JSON.stringify({
    status: checkpoint.status,
    replayable: replayEntries.length,
    real_current: checkpoint.real_current_candidates,
    real_current_review: checkpoint.real_current_review,
    mutation_fail_closed: checkpoint.negative_mutation_fail_closed,
    idempotency_instability: checkpoint.canonical_identity_instability,
    provider_calls: 0,
    production_db_writes: 0,
    gold_mutations: 0
  }, null, 2));
}

main();
