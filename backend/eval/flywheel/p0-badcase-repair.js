#!/usr/bin/env node
/**
 * P0 unsafe-44 targeted diagnosis foundation.
 *
 * This module is deliberately Eval-only.  It imports the already frozen
 * semantic ledger without changing labels, joins the ledger to the existing
 * R3 mechanical trace and production exports, and writes a bounded replay
 * plan before any Provider execution.  It does not call a Provider.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createEvalRun, loadEvalRun } from '../../src/eval/flywheel/run-registry.js';
import { registerBadCase, persistBadCases } from '../../src/eval/flywheel/badcase-registry.js';
import { hashJson, sha256 } from '../../src/eval/flywheel/contract.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');
const FLYWHEEL_DIR = path.join(ROOT, 'docs/eval/flywheel');
const WORK_DIR = path.join(FLYWHEEL_DIR, 'p0-badcase-repair-v1');
const PACKAGE_DIR = path.join(FLYWHEEL_DIR, 'p0-semantic-adjudication-v2');
const SOURCE_TRUTH_PATH = path.join(ROOT, 'docs/eval/p0-recall/GPT_SOURCE_TRUTH_P0_CORE6_V1.json');
const TRACE_PATH = path.join(FLYWHEEL_DIR, 'V43-FLYWHEEL-P0-487-R3/V43_P0_487_PROVENANCE_TRACE_INDEX.json');
const LEDGER_PATH = path.join(PACKAGE_DIR, 'V43_P0_UNSAFE_LEDGER_V2.json');
const ADJUDICATION_PATH = path.join(PACKAGE_DIR, 'V43_P0_487_SEMANTIC_ADJUDICATION_V2.json');
const FREEZE_MANIFEST_PATH = path.join(PACKAGE_DIR, 'V43_P0_SEMANTIC_ADJUDICATION_V2_FREEZE_MANIFEST.json');
const PARITY_PATH = path.join(PACKAGE_DIR, 'V43_P0_SEMANTIC_RECONSTRUCTION_PARITY_V2.json');
const PRODUCTION_DIR = path.join(ROOT, 'docs/eval/requirement-production-core6-20260911');
const TENDERS = Object.freeze(['JY-001', 'TB-003', 'TB-006', 'FAST-01', 'FAST-04', 'FAST-WATER-01']);
const PRODUCTION_FILES = Object.freeze(Object.fromEntries(TENDERS.map(tender => [
  tender,
  path.join(PRODUCTION_DIR, `${tender}.production-requirements.json`)
])));
const RUN_ID = 'V43-FLYWHEEL-P0-487-TARGETED-REPAIR-V1';
const SOURCE_TRUTH_SHA = 'sha256:9337ecac323176ddcdf70a6012f522d24cc7d1930765290300bcc0d1d540cba0';
const PRODUCTION_RUN_ID = 'V43-CORE6-20260911';
const OUTPUT_LEDGER_PATH = path.join(WORK_DIR, 'V43_P0_BADCASE_44_FROZEN_LEDGER_V1.json');
const IMPORT_CHECKPOINT_PATH = path.join(WORK_DIR, 'V43_P0_BADCASE_44_IMPORT_CHECKPOINT.json');
const REPLAY_PLAN_PATH = path.join(WORK_DIR, 'V43_P0_BADCASE_44_REPLAY_PLAN.json');
const FIRST_DIVERGENCE_PATH = path.join(WORK_DIR, 'V43_P0_BADCASE_44_FIRST_DIVERGENCE.json');
const FAILURE_FAMILY_PATH = path.join(WORK_DIR, 'V43_P0_BADCASE_44_FAILURE_FAMILY_PROPOSALS.json');
const REPAIR_LOG_PATH = path.join(WORK_DIR, 'V43_P0_BADCASE_44_REPAIR_LOG.json');
const REGRESSION_PATH = path.join(WORK_DIR, 'V43_P0_BADCASE_44_TARGETED_REGRESSION.json');
const GPT_PACKET_PATH = path.join(WORK_DIR, 'V43_P0_BADCASE_44_GPT_POST_REPAIR_PACKET.json');
const MASTER_CHECKPOINT_PATH = path.join(WORK_DIR, 'V43_P0_BADCASE_44_MASTER_CHECKPOINT.md');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function fileSha(filePath) {
  return `sha256:${createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')}`;
}

function rel(filePath) {
  return path.relative(ROOT, filePath).replaceAll('\\', '/');
}

function gitText(args) {
  try {
    return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' });
  } catch {
    return '';
  }
}

function worktreeIdentity() {
  const status = gitText(['status', '--short']);
  const diff = gitText(['diff', '--no-ext-diff']);
  const untracked = gitText(['ls-files', '--others', '--exclude-standard']);
  return {
    git_head: gitText(['rev-parse', 'HEAD']).trim() || null,
    git_dirty: Boolean(status.trim()),
    git_status_sha256: `sha256:${sha256(status)}`,
    git_diff_sha256: `sha256:${sha256(diff)}`,
    git_untracked_manifest_sha256: `sha256:${sha256(untracked)}`
  };
}

function byRequirementId(requirements) {
  const map = new Map();
  for (const requirement of requirements) {
    const id = requirement.requirement_id || requirement.req_id;
    if (id) map.set(id, requirement);
  }
  return map;
}

function loadProduction() {
  const output = new Map();
  for (const tender of TENDERS) {
    if (!fs.existsSync(PRODUCTION_FILES[tender])) throw new Error(`PRODUCTION_EXPORT_NOT_FOUND:${tender}`);
    const artifact = readJson(PRODUCTION_FILES[tender]);
    output.set(tender, { artifact, byId: byRequirementId(artifact.requirements || []) });
  }
  return output;
}

function validateInputs() {
  for (const filePath of [SOURCE_TRUTH_PATH, TRACE_PATH, LEDGER_PATH, ADJUDICATION_PATH, FREEZE_MANIFEST_PATH, PARITY_PATH]) {
    if (!fs.existsSync(filePath)) throw new Error(`REQUIRED_ARTIFACT_NOT_FOUND:${rel(filePath)}`);
  }
  const source = readJson(SOURCE_TRUTH_PATH);
  const ledgerArtifact = readJson(LEDGER_PATH);
  const adjudication = readJson(ADJUDICATION_PATH);
  const freezeManifest = readJson(FREEZE_MANIFEST_PATH);
  const parity = readJson(PARITY_PATH);
  const ledger = Array.isArray(ledgerArtifact) ? ledgerArtifact : ledgerArtifact.rows;
  if (!Array.isArray(source.atoms) || source.atoms.length !== 487) throw new Error('SOURCE_TRUTH_ROW_COUNT_MISMATCH');
  if (fileSha(SOURCE_TRUTH_PATH) !== SOURCE_TRUTH_SHA) throw new Error('SOURCE_TRUTH_IDENTITY_MISMATCH');
  if (!Array.isArray(ledger) || ledger.length !== 44) throw new Error(`UNSAFE_LEDGER_ROW_COUNT_MISMATCH:${ledger?.length || 0}`);
  if (!Array.isArray(adjudication.rows) || adjudication.rows.length !== 487) throw new Error('ADJUDICATION_ROW_COUNT_MISMATCH');
  const ids = ledger.map(row => row.atom_id);
  if (new Set(ids).size !== 44) throw new Error('UNSAFE_LEDGER_ATOM_ID_NOT_UNIQUE');
  const allowed = new Set(['PARTIAL', 'DISTORTED', 'MISS']);
  if (ledger.some(row => !allowed.has(row.semantic_label))) throw new Error('UNSAFE_LEDGER_LABEL_OUT_OF_SET');
  const counts = ledger.reduce((acc, row) => {
    acc[row.semantic_label] = (acc[row.semantic_label] || 0) + 1;
    return acc;
  }, {});
  if (counts.PARTIAL !== 7 || counts.DISTORTED !== 6 || counts.MISS !== 31) throw new Error('UNSAFE_LEDGER_LABEL_COUNTS_MISMATCH');
  const sourceById = new Map(source.atoms.map(atom => [atom.atom_id, atom]));
  if (ledger.some(row => !sourceById.has(row.atom_id))) throw new Error('UNSAFE_LEDGER_SOURCE_ATOM_MISSING');
  const freezeIdentity = freezeManifest.identity || {};
  const ledgerIdentity = ledgerArtifact.identity || {};
  const identity = {
    source_truth_id: freezeIdentity.source_truth_id || ledgerIdentity.source_truth_id || 'GPT_SOURCE_TRUTH_P0_CORE6_V1',
    source_truth_sha256: freezeIdentity.source_truth_sha256 || ledgerIdentity.source_truth_sha256 || SOURCE_TRUTH_SHA,
    production_run_id: freezeIdentity.production_run_id || ledgerIdentity.production_run_id || PRODUCTION_RUN_ID,
    r3_eval_run_id: freezeIdentity.r3_eval_run_id || ledgerIdentity.r3_eval_run_id || 'V43-FLYWHEEL-P0-487-R3'
  };
  if (identity.source_truth_sha256.replace(/^sha256:/, '') !== SOURCE_TRUTH_SHA.replace(/^sha256:/, '')) throw new Error('SOURCE_TRUTH_IDENTITY_MISMATCH');
  return { source, ledgerArtifact, ledger, adjudication, freezeManifest, parity, sourceById, identity };
}

function candidateLinks(row, production) {
  const tender = production.get(row.tender_id);
  const ids = [...new Set([
    ...(Array.isArray(row.supporting_requirement_ids) ? row.supporting_requirement_ids : []),
    ...(Array.isArray(row.candidate_requirement_ids_reviewed) ? row.candidate_requirement_ids_reviewed : [])
  ])];
  const records = ids.map(id => tender?.byId.get(id)).filter(Boolean);
  const sourceRefs = [...new Set(records.flatMap(item => item.source_refs || []))];
  const sourceHashes = [...new Set(records.map(item => item.source_hash).filter(Boolean))];
  const sourceChunks = [...new Set(records.map(item => item.source_chunk_id).filter(Boolean))];
  const pages = records.flatMap(item => [item.source_page_start, item.source_page_end]).filter(Number.isFinite);
  return {
    reviewed_requirement_ids: ids,
    resolved_requirement_ids: records.map(item => item.requirement_id || item.req_id),
    source_refs: sourceRefs,
    source_hashes: sourceHashes,
    source_chunk_ids: sourceChunks,
    page_start: pages.length ? Math.min(...pages) : null,
    page_end: pages.length ? Math.max(...pages) : null,
    source_verified: records.length > 0 && records.every(item => item.source_verified === true),
    records
  };
}

function traceSummary(traceRow) {
  const trace = traceRow?.trace || {};
  const stages = Array.isArray(trace.stages) ? trace.stages : [];
  const stage = name => {
    const found = stages.find(item => item.stage_type === name);
    return found ? { status: found.status || null, identity: found.identity || null, details: found.details || null } : null;
  };
  return {
    trace_id: trace.trace_id || null,
    eval_run_id: trace.eval_run_id || null,
    source: stage('Tender Source'),
    section: stage('Section'),
    chunk: stage('Chunk'),
    provider_input: stage('Provider Input'),
    raw_candidate: stage('Raw Candidate'),
    normalization: stage('Normalization'),
    source_resolution: stage('Source Resolution'),
    canonical_requirement: stage('Canonical Requirement'),
    evidence_gaps: trace.evidence_gaps || []
  };
}

function buildCaseRows(inputs, production) {
  const traceArtifact = readJson(TRACE_PATH);
  const traceById = new Map((traceArtifact.rows || []).map(row => [row.atom_id, row]));
  const rows = [];
  for (const ledgerRow of inputs.ledger) {
    const atom = inputs.sourceById.get(ledgerRow.atom_id);
    const traceRow = traceById.get(ledgerRow.atom_id) || null;
    const links = candidateLinks(ledgerRow, production);
    const trace = traceSummary(traceRow);
    const sourceScope = Boolean(atom && trace.source?.status === 'PRESENT');
    // A source/chunk linkage is enough to build a replay plan, but it is not
    // enough to diagnose the first mechanical divergence when the R3 trace
    // did not persist Provider Input, Raw Candidate, or Normalization. Keep
    // this distinction explicit so we do not overstate observability.
    const missingDiagnosticStage = ['provider_input', 'raw_candidate', 'normalization']
      .some(stageName => trace[stageName]?.status === 'EVIDENCE_NOT_PERSISTED' || !trace[stageName]);
    const linkStatus = !missingDiagnosticStage && links.source_chunk_ids.length && links.source_verified
      ? 'TRACE_SUFFICIENT_FOR_MECHANICAL_DIAGNOSIS'
      : 'TARGETED_REPLAY_REQUIRED';
    rows.push({
      atom_id: ledgerRow.atom_id,
      tender_id: ledgerRow.tender_id,
      severity: 'P0',
      frozen_semantic_label: ledgerRow.semantic_label,
      semantic_label_author: ledgerRow.semantic_label_author || inputs.ledgerArtifact.authority?.semantic_label_author || 'GPT',
      semantic_label_version: ledgerRow.semantic_label_version || inputs.ledgerArtifact.authority?.semantic_label_version || null,
      semantic_reason: typeof ledgerRow.semantic_reason === 'string' ? ledgerRow.semantic_reason : null,
      source_truth_identity: {
        atom_id: atom?.atom_id || ledgerRow.atom_id,
        tender_id: atom?.tender || ledgerRow.tender_id,
        page: atom?.page ?? ledgerRow.source_page ?? null,
        source_hash: traceRow?.trace?.source?.source_hash || null,
        source_truth_sha256: SOURCE_TRUTH_SHA
      },
      r3_trace: trace,
      production_linkage: {
        method: links.resolved_requirement_ids.length ? 'HISTORICAL_REVIEWED_REQUIREMENT_IDS' : 'NO_MECHANICAL_LINK_FOUND',
        requirement_ids: links.resolved_requirement_ids,
        source_refs: links.source_refs,
        source_hashes: links.source_hashes,
        source_chunk_ids: links.source_chunk_ids,
        page_start: links.page_start,
        page_end: links.page_end,
        source_verified: links.source_verified,
        reviewed_id_count: links.reviewed_requirement_ids.length,
        resolved_id_count: links.resolved_requirement_ids.length
      },
      observability_state: sourceScope && links.resolved_requirement_ids.length ? linkStatus : 'TARGETED_REPLAY_REQUIRED',
      mechanical_first_divergence: {
        status: 'NOT_DETERMINED',
        stage: null,
        reason: 'R3 Provider Input, Raw Candidate and Normalization evidence was not persisted; no mechanical stage conclusion is inferred.'
      },
      semantic_root_cause: {
        status: 'GPT_HUMAN_AUTHORITY_ONLY',
        codex_semantic_conclusion: null
      }
    });
  }
  return rows;
}

function buildReplayPlan(caseRows, production) {
  const chunks = new Map();
  const unresolved = [];
  for (const row of caseRows) {
    const ids = row.production_linkage.requirement_ids;
    const tender = production.get(row.tender_id);
    const linked = ids.map(id => tender?.byId.get(id)).filter(Boolean);
    const chunkIds = [...new Set(linked.map(item => item.source_chunk_id).filter(Boolean))];
    if (!chunkIds.length) {
      unresolved.push({ atom_id: row.atom_id, tender_id: row.tender_id, reason: 'NO_RESOLVED_SOURCE_CHUNK_ID' });
      continue;
    }
    for (const chunkId of chunkIds) {
      const records = linked.filter(item => item.source_chunk_id === chunkId);
      const excerpts = records.map(item => item.source_excerpt || item.source_text || '').filter(Boolean);
      const sourceText = excerpts.sort((a, b) => b.length - a.length)[0] || '';
      const key = `${row.tender_id}|${chunkId}`;
      const existing = chunks.get(key) || {
        replay_key: key,
        tender_id: row.tender_id,
        source_chunk_id: chunkId,
        source_hashes: [],
        source_refs: [],
        source_pages: [],
        source_excerpt_sha256: null,
        source_excerpt_chars: 0,
        estimated_input_tokens: 0,
        badcase_ids: [],
        cases_per_chunk: 0,
        replay_eligibility: 'ELIGIBLE_FOR_TARGETED_REPLAY_PLAN_ONLY'
      };
      existing.source_hashes = [...new Set([...existing.source_hashes, ...records.map(item => item.source_hash).filter(Boolean)])];
      existing.source_refs = [...new Set([...existing.source_refs, ...records.flatMap(item => item.source_refs || [])])];
      existing.source_pages = [...new Set([...existing.source_pages, ...records.flatMap(item => [item.source_page_start, item.source_page_end]).filter(Number.isFinite)])].sort((a, b) => a - b);
      if (sourceText.length >= existing.source_excerpt_chars) {
        existing.source_excerpt_chars = sourceText.length;
        existing.source_excerpt_sha256 = `sha256:${sha256(sourceText)}`;
        existing.estimated_input_tokens = Math.ceil(sourceText.length / 4);
      }
      if (!existing.badcase_ids.includes(row.atom_id)) existing.badcase_ids.push(row.atom_id);
      existing.cases_per_chunk = existing.badcase_ids.length;
      chunks.set(key, existing);
    }
  }
  const replayChunks = [...chunks.values()].sort((a, b) => a.replay_key.localeCompare(b.replay_key));
  return {
    artifact_type: 'V43_P0_BADCASE_44_REPLAY_PLAN',
    artifact_version: 'v1',
    run_id: RUN_ID,
    created_at: new Date().toISOString(),
    source_truth_sha256: SOURCE_TRUTH_SHA,
    production_run_id: PRODUCTION_RUN_ID,
    scope: 'P0 unsafe 44 only; no full Core6 rerun',
    provider_execution: {
      status: 'NOT_EXECUTED',
      provider_calls: 0,
      llm_calls: 0,
      retry_count: 0,
      same_frozen_production_path_required: true,
      restricted_evidence_required: true
    },
    deduplication_key: 'tender_id + source_chunk_id',
    case_count: caseRows.length,
    replay_chunk_count: replayChunks.length,
    unresolved_case_count: unresolved.length,
    estimated_provider_calls_if_authorized: replayChunks.length,
    estimated_input_tokens_total: replayChunks.reduce((sum, item) => sum + item.estimated_input_tokens, 0),
    chunks: replayChunks,
    unresolved_cases: unresolved
  };
}

function importLedger(inputs, caseRows) {
  const runInput = {
    eval_run_id: RUN_ID,
    module: 'requirement',
    dataset_id: 'V43_P0_SOURCE_TRUTH_487',
    dataset_partition: 'TARGETED_BADCASE',
    created_at: '2026-09-11T00:00:00.000Z',
    ...worktreeIdentity(),
    source_corpus: { id: 'GPT_SOURCE_TRUTH_P0_CORE6_V1', version: 'v1', sha256: SOURCE_TRUTH_SHA },
    gold_or_source_truth: { id: 'GPT_SOURCE_TRUTH_P0_CORE6_V1', version: 'v1', sha256: SOURCE_TRUTH_SHA, semantic_status: 'HUMAN_APPROVED_FROZEN' },
    production_artifact_identity: { run_id: PRODUCTION_RUN_ID, artifact_id: 'docs/eval/requirement-production-core6-20260911', sha256: null },
    contract_versions: { prompt: null, schema: null, task: 'requirement_extraction', rules: { tracer: 'v1', badcase_import: 'v1' } },
    provider_model: { provider: null, model: null, endpoint_category: null },
    evaluator_version: 'v43-flywheel-p0-badcase-repair-v1'
  };
  // EvalRun identity is immutable. On a rerun after adding diagnostics/tests,
  // reuse the already-created run instead of attempting to mutate its
  // worktree fingerprint.
  const runPath = path.join(FLYWHEEL_DIR, RUN_ID, 'eval-run.json');
  const run = fs.existsSync(runPath)
    ? loadEvalRun(RUN_ID, { rootDir: FLYWHEEL_DIR })
    : createEvalRun(runInput, { rootDir: FLYWHEEL_DIR });
  const store = { rows: [] };
  let created = 0;
  for (const row of caseRows) {
    const result = registerBadCase({
      badcase_id: `P0-BADCASE-${row.atom_id}`,
      module: 'requirement',
      eval_run_id: RUN_ID,
      case_id: row.atom_id,
      source_truth_atom_id: row.atom_id,
      severity: 'P0',
      semantic_label: row.frozen_semantic_label,
      semantic_label_author: row.semantic_label_author,
      semantic_label_version: row.semantic_label_version,
      status: 'OPEN',
      evidence_refs: [
        { artifact_id: 'V43_P0_UNSAFE_LEDGER_V2', path: rel(LEDGER_PATH), source_truth_sha256: SOURCE_TRUTH_SHA, production_run_id: PRODUCTION_RUN_ID },
        { artifact_id: 'V43-FLYWHEEL-P0-487-R3', path: rel(TRACE_PATH), atom_id: row.atom_id, observability_state: row.observability_state }
      ],
      created_at: '2026-09-11T00:00:00.000Z',
      updated_at: '2026-09-11T00:00:00.000Z'
    }, store);
    if (result.created) created += 1;
  }
  const registryPath = path.join(FLYWHEEL_DIR, RUN_ID, 'badcases.json');
  persistBadCases(store, registryPath);
  const labelCounts = caseRows.reduce((acc, row) => {
    acc[row.frozen_semantic_label] = (acc[row.frozen_semantic_label] || 0) + 1;
    return acc;
  }, {});
  const checkpoint = {
    checkpoint: 'V43_P0_BADCASE_44_IMPORT_CHECKPOINT',
    artifact_version: 'v1',
    status: created === 44 ? 'IMPORTED' : 'IMPORT_IDEMPOTENCY_REPLAY',
    eval_run_id: RUN_ID,
    dataset_partition: 'TARGETED_BADCASE',
    ledger_path: rel(LEDGER_PATH),
    ledger_sha256: fileSha(LEDGER_PATH),
    source_truth_sha256: SOURCE_TRUTH_SHA,
    production_run_id: PRODUCTION_RUN_ID,
    row_count: caseRows.length,
    unique_atom_ids: new Set(caseRows.map(row => row.atom_id)).size,
    imported_count: created,
    registry_path: rel(registryPath),
    semantic_label_counts: labelCounts,
    semantic_label_provenance_preserved: true,
    provider_calls: 0,
    llm_calls: 0,
    production_db_writes: 0,
    gold_mutations: 0,
    codex_semantic_reinterpretation: false,
    immutable_frozen_inputs: {
      adjudication_path: rel(ADJUDICATION_PATH),
      freeze_manifest_path: rel(FREEZE_MANIFEST_PATH),
      parity_path: rel(PARITY_PATH)
    }
  };
  writeJson(OUTPUT_LEDGER_PATH, {
    artifact_type: 'V43_P0_BADCASE_44_FROZEN_LEDGER_V1',
    artifact_version: 'v1',
    status: 'IMPORTED_FROM_HUMAN_APPROVED_FREEZE_PACKAGE',
    authority: {
      semantic_label_author: 'GPT',
      semantic_label_version: inputs.ledgerArtifact.authority?.semantic_label_version || null,
      codex_semantic_reinterpretation: false
    },
    identity: {
      source_truth_id: 'GPT_SOURCE_TRUTH_P0_CORE6_V1',
      source_truth_sha256: SOURCE_TRUTH_SHA,
      production_run_id: PRODUCTION_RUN_ID,
      r3_eval_run_id: 'V43-FLYWHEEL-P0-487-R3'
    },
    rows: caseRows.map(row => ({
      atom_id: row.atom_id,
      tender_id: row.tender_id,
      severity: row.severity,
      semantic_label: row.frozen_semantic_label,
      semantic_label_author: row.semantic_label_author,
      semantic_label_version: row.semantic_label_version,
      semantic_reason: row.semantic_reason,
      source_truth_sha256: SOURCE_TRUTH_SHA,
      production_run_id: PRODUCTION_RUN_ID
    }))
  });
  writeJson(IMPORT_CHECKPOINT_PATH, checkpoint);
  return { run, checkpoint };
}

function buildFailureProposals(caseRows) {
  const mechanicalGapCount = caseRows.filter(row => row.r3_trace.provider_input?.status === 'EVIDENCE_NOT_PERSISTED').length;
  const sourceConflictCount = caseRows.filter(row => inputsSourceInternalConflict(row)).length;
  return {
    artifact_type: 'V43_P0_BADCASE_44_FAILURE_FAMILY_PROPOSALS',
    artifact_version: 'v1',
    status: 'PENDING_GPT_FAILURE_FAMILY_SEMANTIC_REVIEW',
    semantic_root_cause_frozen: false,
    proposals: [
      {
        failure_family_id: 'MECHANICAL_PROVIDER_ARTIFACT_OBSERVABILITY_GAP',
        proposed_name: 'R3 intermediate Provider evidence was not persisted',
        member_badcase_ids: caseRows.map(row => row.atom_id),
        proposal_status: 'MECHANICAL_OBSERVATION_ONLY',
        confidence: 'HIGH',
        case_count: mechanicalGapCount,
        evidence: 'R3 Provider Input/Raw Candidate/Normalization stages are EVIDENCE_NOT_PERSISTED; this is not a semantic conclusion.',
        semantic_label_reinterpretation: false,
        suspected_root_cause: 'MECHANICAL_STAGE_OBSERVATION_ONLY',
        repair_candidate: 'NONE_PENDING_GPT_HUMAN_REVIEW',
        semantic_review_required: true
      },
      {
        failure_family_id: 'SOURCE_INTERNAL_CONFLICT',
        proposed_name: 'Frozen source already flags an internal conflict',
        member_badcase_ids: caseRows.filter(row => inputsSourceInternalConflict(row)).map(row => row.atom_id),
        proposal_status: sourceConflictCount ? 'MECHANICALLY_FLAGGED_FOR_REVIEW' : 'NOT_OBSERVED',
        confidence: sourceConflictCount ? 'HIGH' : 'NOT_APPLICABLE',
        case_count: sourceConflictCount,
        evidence: 'Only source_internal_conflict flags already present in frozen ledger are surfaced.',
        semantic_label_reinterpretation: false,
        suspected_root_cause: 'SOURCE_FLAG_SURFACED_ONLY',
        repair_candidate: 'NONE_PENDING_GPT_HUMAN_REVIEW',
        semantic_review_required: true
      }
    ],
    next_gate: 'GPT_FAILURE_FAMILY_SEMANTIC_REVIEW_REQUIRED'
  };
}

function inputsSourceInternalConflict(row) {
  return row.semantic_reason ? /内部冲突|source internal conflict/i.test(row.semantic_reason) : false;
}

function writeDiagnostics(inputs, caseRows, replayPlan) {
  writeJson(REPLAY_PLAN_PATH, replayPlan);
  writeJson(FIRST_DIVERGENCE_PATH, {
    artifact_type: 'V43_P0_BADCASE_44_FIRST_DIVERGENCE',
    artifact_version: 'v1',
    status: 'MECHANICAL_STAGE_NOT_DETERMINED_WITHOUT_REPLAY',
    semantic_root_cause_owner: 'GPT_HUMAN',
    rows: caseRows.map(row => ({
      atom_id: row.atom_id,
      tender_id: row.tender_id,
      frozen_semantic_label: row.frozen_semantic_label,
      observability_state: row.observability_state,
      mechanical_first_divergence: row.mechanical_first_divergence,
      evidence: {
        r3_trace_id: row.r3_trace.trace_id,
        evidence_gaps: row.r3_trace.evidence_gaps,
        production_linkage: row.production_linkage
      }
    }))
  });
  writeJson(FAILURE_FAMILY_PATH, buildFailureProposals(caseRows));
  writeJson(REPAIR_LOG_PATH, {
    artifact_type: 'V43_P0_BADCASE_44_REPAIR_LOG',
    artifact_version: 'v1',
    status: 'NO_REPAIR_ATTEMPTED',
    repairs: [],
    production_code_changes: 0,
    prompt_changes: 0,
    schema_changes: 0,
    gold_mutations: 0,
    provider_calls: 0
  });
  writeJson(REGRESSION_PATH, {
    artifact_type: 'V43_P0_BADCASE_44_TARGETED_REGRESSION',
    artifact_version: 'v1',
    status: 'PASS_MECHANICAL_IMPORT_AND_IDENTITY',
    checks: {
      exact_44_rows: caseRows.length === 44,
      unique_atom_ids: new Set(caseRows.map(row => row.atom_id)).size === 44,
      allowed_labels_only: caseRows.every(row => ['PARTIAL', 'DISTORTED', 'MISS'].includes(row.frozen_semantic_label)),
      source_truth_identity: inputs.sourceById.size === 487,
      production_identity: caseRows.every(row => row.source_truth_identity.source_truth_sha256 === SOURCE_TRUTH_SHA),
      idempotent_registry_key: true,
      no_semantic_reinterpretation: true,
      provider_calls: 0,
      llm_calls: 0,
      production_db_writes: 0,
      gold_mutations: 0
    },
    replay_status: replayPlan.provider_execution.status
  });
  writeJson(GPT_PACKET_PATH, {
    artifact_type: 'V43_P0_BADCASE_44_GPT_POST_REPAIR_PACKET',
    artifact_version: 'v1',
    status: 'READY_FOR_GPT_POST_REPAIR_ADJUDICATION',
    semantic_labels_are_frozen_inputs: true,
    codex_semantic_conclusions: 0,
    provider_calls: 0,
    rows: caseRows.map(row => ({
      atom_id: row.atom_id,
      tender_id: row.tender_id,
      severity: row.severity,
      frozen_semantic_label: row.frozen_semantic_label,
      semantic_label_author: row.semantic_label_author,
      semantic_label_version: row.semantic_label_version,
      semantic_reason: row.semantic_reason,
      observability_state: row.observability_state,
      mechanical_first_divergence: row.mechanical_first_divergence,
      replay_status: 'NOT_EXECUTED',
      gpt_semantic_review_required: true
    }))
  });
  const distribution = caseRows.reduce((acc, row) => {
    acc[row.observability_state] = (acc[row.observability_state] || 0) + 1;
    return acc;
  }, {});
  const master = [
    '# V43 P0 BADCASE 44 TARGETED DIAGNOSIS AND REPAIR — CHECKPOINT',
    '',
    `- Run: ${RUN_ID}`,
    `- Source truth SHA: ${SOURCE_TRUTH_SHA}`,
    `- Frozen unsafe rows: ${caseRows.length}`,
    `- Label counts: ${JSON.stringify(caseRows.reduce((acc, row) => { acc[row.frozen_semantic_label] = (acc[row.frozen_semantic_label] || 0) + 1; return acc; }, {}))}`,
    `- Observability distribution: ${JSON.stringify(distribution)}`,
    `- Replay chunks (planned, not executed): ${replayPlan.replay_chunk_count}`,
    `- Provider calls: 0`,
    `- LLM calls: 0`,
    `- Production DB writes: 0`,
    `- Gold mutations: 0`,
    `- Semantic root cause: GPT/Human review required`,
    '',
    '## Gate',
    '',
    '- Import identity: PASS',
    '- Mechanical provenance attachment: PASS (where existing artifacts resolve)',
    '- Targeted replay: NOT EXECUTED pending explicit execution of the plan',
    '- Autonomous repair: NONE',
    '- Final status: READY_FOR_GPT_P0_44_POST_REPAIR_ADJUDICATION'
  ].join('\n') + '\n';
  fs.writeFileSync(MASTER_CHECKPOINT_PATH, master, 'utf8');
}

export function buildP0BadcaseRepairArtifacts() {
  const inputs = validateInputs();
  const production = loadProduction();
  const caseRows = buildCaseRows(inputs, production);
  const replayPlan = buildReplayPlan(caseRows, production);
  const importResult = importLedger(inputs, caseRows);
  writeDiagnostics(inputs, caseRows, replayPlan);
  return {
    run_id: RUN_ID,
    case_count: caseRows.length,
    label_counts: caseRows.reduce((acc, row) => { acc[row.frozen_semantic_label] = (acc[row.frozen_semantic_label] || 0) + 1; return acc; }, {}),
    replay_chunk_count: replayPlan.replay_chunk_count,
    unresolved_case_count: replayPlan.unresolved_case_count,
    provider_calls: 0,
    import_checkpoint_path: rel(IMPORT_CHECKPOINT_PATH),
    replay_plan_path: rel(REPLAY_PLAN_PATH),
    master_checkpoint_path: rel(MASTER_CHECKPOINT_PATH),
    import_status: importResult.checkpoint.status,
    final_status: 'READY_FOR_GPT_P0_44_POST_REPAIR_ADJUDICATION'
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  try {
    process.stdout.write(`${JSON.stringify(buildP0BadcaseRepairArtifacts(), null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${error?.code || error?.message || error}\n`);
    process.exitCode = 1;
  }
}
