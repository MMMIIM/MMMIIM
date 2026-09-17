import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  projectRequirementResponseV223,
  RESPONSE_ROUTER_V223_IMPLEMENTATION_ID,
  RESPONSE_ROUTER_V223_VERSION
} from '../../src/pipeline/requirement-response-router-v2-2-3.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../../..');
export const DEFAULT_REQUIREMENT_SNAPSHOT = path.join(
  REPO,
  'docs/handoff/V43_DAYTIME_REAL_E2E_FOUNDATION_AND_HUMAN_GATE_MASTER_V1/03_TB006_POST_RECERT_REQUIREMENTS.json'
);
export const DEFAULT_OUTPUT_DIR = path.join(
  REPO,
  'docs/handoff/V43_REAL_E2E_REQUIREMENT_RETRIEVAL_AND_FACT_CANARY_V1'
);

const sha256Bytes = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const textOf = value => String(value ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim();
const riskRank = Object.freeze({ P0: 0, HIGH: 1, MEDIUM: 2, LOW: 3, NONE: 4 });
const modeRank = Object.freeze({ EVIDENCE: 0, SOLUTION: 1, COMMITMENT: 2, NEED_REVIEW: 3, COMPLIANCE: 4 });
const excludedScopePrefix = 'OUT_OF_SCOPE_PENDING_AUTHORITY_PERSISTENCE';

function stableSort(a, b) {
  const risk = (riskRank[a.route?.risk_tier] ?? 5) - (riskRank[b.route?.risk_tier] ?? 5);
  if (risk) return risk;
  const mode = (modeRank[a.route?.response_mode] ?? 5) - (modeRank[b.route?.response_mode] ?? 5);
  if (mode) return mode;
  const category = String(a.candidate.category || a.candidate.requirement_category || '').localeCompare(
    String(b.candidate.category || b.candidate.requirement_category || ''),
    'zh-CN'
  );
  if (category) return category;
  const ordinal = Number(a.candidate.ordinal || 0) - Number(b.candidate.ordinal || 0);
  if (ordinal) return ordinal;
  return String(a.candidate.req_id).localeCompare(String(b.candidate.req_id), 'en');
}

export function verifyFrozenSnapshot(snapshot, rawBytes) {
  if (!snapshot || typeof snapshot !== 'object') throw new Error('REQUIREMENT_SNAPSHOT_INVALID');
  const candidates = Array.isArray(snapshot.candidates) ? snapshot.candidates : [];
  if (snapshot.post_recert_final_count !== 337) throw new Error(`REQUIREMENT_SNAPSHOT_POST_RECERT_COUNT:${snapshot.post_recert_final_count}`);
  if (candidates.length !== 341) throw new Error(`REQUIREMENT_SNAPSHOT_CANDIDATE_COUNT:${candidates.length}`);
  const ids = candidates.map(item => item.req_id).filter(Boolean);
  if (new Set(ids).size !== ids.length) throw new Error('REQUIREMENT_SNAPSHOT_IDS_NOT_UNIQUE');
  const inScope = candidates.filter(item => !String(item.post_recert_scope_decision || '').startsWith(excludedScopePrefix));
  if (inScope.length !== 337) throw new Error(`REQUIREMENT_SNAPSHOT_IN_SCOPE_COUNT:${inScope.length}`);
  if (!inScope.every(item => item.req_id && textOf(item.content) && item.source_hash && item.source_chunk_id)) {
    throw new Error('REQUIREMENT_SNAPSHOT_SOURCE_LINEAGE_INCOMPLETE');
  }
  return Object.freeze({
    source_sha256: sha256Bytes(rawBytes),
    artifact_source_sha256: snapshot.source_sha256 || null,
    run_id: snapshot.run_id || null,
    pre_recert_final_count: snapshot.pre_recert_final_count ?? null,
    candidate_count: candidates.length,
    post_recert_count: inScope.length,
    excluded_count: candidates.length - inScope.length,
    excluded_requirement_ids: candidates
      .filter(item => String(item.post_recert_scope_decision || '').startsWith(excludedScopePrefix))
      .map(item => item.req_id)
      .sort(),
    human_authority_persisted_in_artifact: snapshot.human_authority_persisted === true,
    candidates: inScope
  });
}

function routeCandidate(candidate) {
  return projectRequirementResponseV223({
    requirement_id: candidate.req_id,
    requirement_text: candidate.content,
    category: candidate.category || candidate.requirement_category || 'other',
    requirement_category: candidate.requirement_category || candidate.category || 'other',
    is_mandatory: candidate.is_mandatory,
    mandatory_observed: candidate.mandatory_observed,
    requires_confirmation: candidate.requires_confirmation,
    risk_flags: candidate.risk_flags
  });
}

export function selectRequirementCanary(candidates, { limit = 20 } = {}) {
  const routed = candidates.map(candidate => ({ candidate, route: routeCandidate(candidate) }));
  const eligible = routed
    .filter(item => item.route.response_required === true && item.route.evidence_dependency === true)
    .sort(stableSort);
  const selected = [];
  const seenCategories = new Set();
  for (const item of eligible) {
    if (selected.length >= limit) break;
    const category = textOf(item.candidate.category || item.candidate.requirement_category || 'other').toLowerCase();
    const family = `${item.route.response_mode || 'UNKNOWN'}:${category}`;
    if (seenCategories.has(family)) continue;
    selected.push(item);
    seenCategories.add(family);
  }
  for (const item of eligible) {
    if (selected.length >= limit) break;
    if (selected.some(existing => existing.candidate.req_id === item.candidate.req_id)) continue;
    selected.push(item);
  }
  return Object.freeze({
    eligible_count: eligible.length,
    selected: selected.map((item, index) => Object.freeze({
      selection_rank: index + 1,
      candidate: item.candidate,
      route: item.route
    }))
  });
}

function sourceLineage(candidate) {
  const evidence = candidate.source_evidence && typeof candidate.source_evidence === 'object'
    ? candidate.source_evidence
    : {};
  const sources = Array.isArray(candidate.sources_json) ? candidate.sources_json : [];
  return {
    source_artifact: '08_TB006_REQUIREMENT_RUN_V3.json',
    source_run_id: 'REAL_E2E_CASE_01_REQUIREMENT_RUN_V3',
    source_snapshot_sha256: candidate.source_hash || null,
    source_verified: candidate.source_verified === true,
    source_resolution_status: candidate.source_resolution_status || null,
    source_resolution_method: candidate.source_resolution_method || null,
    source_refs: sources.flatMap(item => Array.isArray(item.source_refs) ? item.source_refs : []),
    source_file_chunk_id: candidate.source_chunk_id || evidence.chunk_id || null,
    source_page_start: candidate.source_page_start ?? evidence.page_start ?? null,
    source_page_end: candidate.source_page_end ?? evidence.page_end ?? null,
    source_paragraph_start: candidate.source_paragraph_start ?? evidence.paragraph_start ?? null,
    source_paragraph_end: candidate.source_paragraph_end ?? evidence.paragraph_end ?? null,
    source_excerpt: candidate.source_excerpt || evidence.source_text || null,
    source_context: evidence.context_text || null,
    source_clause_id: candidate.source_clause_id || evidence.source_clause || null,
    source_hash: candidate.source_hash || evidence.source_hash || null
  };
}

function projectSelection(item) {
  const candidate = item.candidate;
  const route = item.route;
  return {
    selection_rank: item.selection_rank,
    tender_id: 'TB-006',
    requirement_id: candidate.req_id,
    requirement_text: candidate.content,
    category: candidate.category || null,
    requirement_category: candidate.requirement_category || candidate.category || null,
    mandatory_observed: candidate.mandatory_observed === true,
    requires_confirmation: candidate.requires_confirmation === true,
    confirmation_reasons: Array.isArray(candidate.confirmation_reasons) ? candidate.confirmation_reasons : [],
    risk_flags: Array.isArray(candidate.risk_flags) ? candidate.risk_flags : [],
    writer_eligible: candidate.writer_eligible === true,
    source_lineage: sourceLineage(candidate),
    response_mode: route.response_mode || null,
    response_role: route.response_role || null,
    response_required: route.response_required === true,
    evidence_dependency: route.evidence_dependency === true,
    risk_tier: route.risk_tier || null,
    human_required: route.human_required === true,
    is_scoring_related: route.is_scoring_related === true,
    scoring_priority: route.scoring_priority || null,
    deep_chain_required: route.deep_chain_required === true,
    secondary_dependencies: Array.isArray(route.secondary_dependencies) ? route.secondary_dependencies : [],
    routing_reasons: Array.isArray(route.routing_reasons) ? route.routing_reasons : [],
    router_projection_version: route.projection_version || RESPONSE_ROUTER_V223_VERSION,
    router_implementation_id: route.implementation_id || RESPONSE_ROUTER_V223_IMPLEMENTATION_ID
  };
}

export function buildOfflinePacket({ snapshotPath = DEFAULT_REQUIREMENT_SNAPSHOT, outputDir = DEFAULT_OUTPUT_DIR } = {}) {
  const rawBytes = fs.readFileSync(snapshotPath);
  const snapshot = JSON.parse(rawBytes.toString('utf8'));
  const verified = verifyFrozenSnapshot(snapshot, rawBytes);
  const selection = selectRequirementCanary(verified.candidates, { limit: 20 });
  if (!selection.selected.length) throw new Error('NO_EVIDENCE_DEPENDENT_REQUIREMENTS_SELECTED');
  const routerPath = path.join(REPO, 'backend/src/pipeline/requirement-response-router-v2-2-3.js');
  const packet = {
    artifact_type: 'V43_REAL_E2E_REQUIREMENT_RETRIEVAL_FACT_CANARY_SELECTION_V1',
    eval_only: true,
    frozen_requirement_universe: {
      tender_id: 'TB-006',
      post_recert_count: verified.post_recert_count,
      source_artifact: path.relative(REPO, snapshotPath).replaceAll('\\', '/'),
      source_sha256: verified.source_sha256,
      source_declared_sha256: verified.artifact_source_sha256,
      source_run_id: verified.run_id,
      excluded_count: verified.excluded_count,
      excluded_requirement_ids: verified.excluded_requirement_ids,
      source_artifact_human_authority_persisted: verified.human_authority_persisted_in_artifact
    },
    current_decision_freeze: {
      requirement_authority: 'CURRENT_DECISION_FROZEN_TB006_337',
      canonical_requirement_count: 337,
      requirement_provider_calls: 0
    },
    router: {
      version: RESPONSE_ROUTER_V223_VERSION,
      implementation_id: RESPONSE_ROUTER_V223_IMPLEMENTATION_ID,
      source_path: path.relative(REPO, routerPath).replaceAll('\\', '/'),
      source_sha256: sha256Bytes(fs.readFileSync(routerPath)),
      deterministic: true,
      provider_calls: 0,
      persistence: false
    },
    selection_policy: {
      limit: 20,
      include: 'response_required=true AND evidence_dependency=true',
      ordering: ['risk_tier:P0,HIGH,MEDIUM,LOW,NONE', 'response_mode:EVIDENCE,SOLUTION,COMMITMENT,NEED_REVIEW,COMPLIANCE', 'category:localeCompare(zh-CN)', 'ordinal', 'requirement_id'],
      diversity: 'first eligible requirement per response_mode+category family, then fill deterministically',
      query: 'complete canonical requirement text; no keyword reduction'
    },
    eligible_count: selection.eligible_count,
    selected_count: selection.selected.length,
    requirements: selection.selected.map(projectSelection),
    side_effects: {
      provider_calls: 0,
      llm_calls: 0,
      production_db_writes: 0,
      eval_db_writes: 0,
      requirement_mutations: 0,
      gold_mutations: 0,
      router_mutations: 0,
      mapping_actions: 0,
      claim_actions: 0,
      writer_actions: 0
    }
  };
  fs.mkdirSync(outputDir, { recursive: true });
  const packetPath = path.join(outputDir, '01_REQUIREMENT_CANARY_SELECTION.json');
  fs.writeFileSync(packetPath, `${JSON.stringify(packet, null, 2)}\n`, 'utf8');
  const hostDoc = [
    '# Host execution',
    '',
    'This is an Eval-only, Host-only canary. The Codex sandbox must not run it.',
    '',
    String.fromCharCode(96).repeat(3) + 'powershell',
    "$env:V43_HOST_EXECUTION='true'",
    "$env:V43_REQUIREMENT_RETRIEVAL_LIVE='true'",
    "$env:V43_FACT_CANARY_LIVE='true'",
    "if(-not $env:DATABASE_URL){throw 'Set DATABASE_URL to the isolated Eval DB before running; production database is forbidden.'}",
    "$env:BACKEND_RUNTIME_MODE='container'",
    "$env:EMBEDDING_PROXY_URL=''",
    "$env:RETRIEVAL_PROJECT_ID='7a038c5d-38e4-46ae-b24d-39437bb3b545'",
    "$env:RETRIEVAL_MATERIAL_NAME_PREFIX='HW-'",
    'node backend/eval/real-e2e/run-requirement-retrieval-fact-canary.mjs',
    String.fromCharCode(96).repeat(3),
    '',
    'Run only from the repository root on the authorized Host. Outputs are 04_REAL_REQUIREMENT_RETRIEVAL_REPORT.json, 05_FACT_CANARY_REPORT.json, and 06_CHECKPOINT.json in this handoff directory.'
  ].join('\n');
  fs.writeFileSync(path.join(outputDir, '02_HOST_EXECUTION.md'), `${hostDoc}\n`, 'utf8');
  const checkpoint = {
    artifact_type: 'V43_REAL_E2E_REQUIREMENT_RETRIEVAL_FACT_CANARY_OFFLINE_CHECKPOINT_V1',
    status: 'READY_FOR_HOST_RETRIEVAL_CANARY',
    source_snapshot_sha256: verified.source_sha256,
    source_snapshot_post_recert_count: verified.post_recert_count,
    router_version: RESPONSE_ROUTER_V223_VERSION,
    router_implementation_id: RESPONSE_ROUTER_V223_IMPLEMENTATION_ID,
    eligible_count: selection.eligible_count,
    selected_count: selection.selected.length,
    provider_calls: 0,
    production_db_writes: 0,
    gold_mutations: 0,
    requirement_mutations: 0,
    notes: [
      'No Provider or LLM call was made in the Codex environment.',
      'Retrieval and Fact canary require the explicitly authorized Host environment.',
      'The snapshot mechanically reports human_authority_persisted=false; this was not changed or inferred.'
    ],
    artifacts: {
      selection: path.relative(REPO, packetPath).replaceAll('\\', '/'),
      host_instructions: path.relative(REPO, path.join(outputDir, '02_HOST_EXECUTION.md')).replaceAll('\\', '/')
    }
  };
  fs.writeFileSync(path.join(outputDir, '03_OFFLINE_CHECKPOINT.json'), `${JSON.stringify(checkpoint, null, 2)}\n`, 'utf8');
  fs.writeFileSync(path.join(outputDir, '00_README.md'), '# V43 Real E2E Requirement Retrieval + Fact Canary\n\nOffline selection is complete. Host execution is required for live retrieval; the supplied Host command enables the bounded Fact canary after usable contexts are found. This packet contains no Provider result and no production writes.\n', 'utf8');
  return { packet, checkpoint, outputDir, packetPath };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const result = buildOfflinePacket({
      snapshotPath: process.env.REQUIREMENT_SNAPSHOT_PATH || DEFAULT_REQUIREMENT_SNAPSHOT,
      outputDir: process.env.REQUIREMENT_CANARY_OUTPUT_DIR || DEFAULT_OUTPUT_DIR
    });
    console.log(JSON.stringify({
      status: result.checkpoint.status,
      output_dir: result.outputDir,
      selected_count: result.packet.selected_count,
      eligible_count: result.packet.eligible_count,
      provider_calls: 0,
      production_db_writes: 0,
      gold_mutations: 0
    }, null, 2));
  } catch (error) {
    console.error(JSON.stringify({ status: 'BLOCKED_OFFLINE_SELECTION', code: error.code || 'SELECTION_FAILED', message: String(error.message || error) }, null, 2));
    process.exitCode = 1;
  }
}
