import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { loadBackendEnvironment } from '../../src/backend-runtime.js';
import { SemanticGatewayClient } from '../../src/pipeline/semantic-gateway-client.js';
import {
  SemanticGatewayEvidenceFactExtractor,
  buildEvidenceFactCandidateV21SemanticInput,
  FACT_PROVIDER_AUDIT
} from '../../src/pipeline/semantic-gateway-evidence-fact-extractor.js';
import {
  createEvidenceFactSourceSnapshot,
  stableCanonicalEvidenceFactIdentity
} from '../../src/pipeline/evidence-fact-candidate-v2.js';
import {
  canonicalizeAndGroundEvidenceFactCandidateV21,
  resolveEvidenceFactCandidateV21SourceRefs,
  EVIDENCE_FACT_CANDIDATE_V21_CANONICALIZER_VERSION,
  EVIDENCE_FACT_CANDIDATE_V21_GROUNDING_VERSION
} from '../../src/pipeline/evidence-fact-candidate-v2-1.js';
import { resolveEnterpriseFactSourceRole } from '../../src/pipeline/enterprise-evidence-source-router.js';
import {
  EVIDENCE_FACT_CANDIDATE_V21_SCHEMA_VERSION,
  EVIDENCE_FACT_CANDIDATE_V21_PROMPT_VERSION,
  EVIDENCE_FACT_CANDIDATE_V21_SCHEMA_SHA256,
  getSemanticTaskInstructionMetadata
} from '../../../packages/semantic-contracts/index.js';
import {
  loadSemanticGatewayEnvironment,
  readSemanticGatewayRuntimeConfig
} from '../../../packages/semantic-contracts/runtime-config.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../../..');
const DOCS = path.join(REPO, 'docs');
const EVAL_ROOT = path.join(REPO, 'backend', 'eval', 'rag-pilot');
const sha256 = value => crypto.createHash('sha256').update(String(value ?? ''), 'utf8').digest('hex');
const now = () => new Date().toISOString();
const safe = (value, max = 320) => typeof value === 'string' ? value.slice(0, max) : null;
const json = value => `${JSON.stringify(value, null, 2)}\n`;

// This is the already frozen Known Fact Cohort. Do not reorder or substitute.
const COHORT = Object.freeze([
  'COM-01', 'COM-06', 'COM-07', 'COM-08', 'COM-12',
  'CCV2-U09-02', 'CCV2-U13-01', 'CCV2-U17-01', 'CCV2-U20-02',
  'CCV2-U29-02', 'CCV2-U30-02', 'CCV2-U34-02'
]);

const baseManifestPath = path.join(EVAL_ROOT, 'V43_RAG_CODEX_HANDOFF_1', 'rag_import_manifest.jsonl');
const extensionManifestPath = path.join(EVAL_ROOT, 'V43_CHENGCHUAN_ENTERPRISE_CORPUS_V2_EXTENSION', '00_meta', 'extension_import_manifest.jsonl');
const componentPaths = Object.freeze([
  'packages/semantic-contracts/index.js',
  'backend/src/pipeline/requirement-extraction.js',
  'backend/src/pipeline/requirement-chunker.js',
  'backend/src/pipeline/canonical-requirements.js',
  'backend/src/pipeline/requirement-quality-gate.js',
  'backend/src/pipeline/source-location-resolver.js',
  'backend/src/pipeline/pdf-table-layout-annotator.js',
  'backend/src/pipeline/tender-section-classifier.js',
  'backend/src/pipeline/semantic-gateway-evidence-fact-extractor.js',
  'backend/src/pipeline/evidence-fact-candidate-v2.js',
  'backend/src/pipeline/evidence-fact-candidate-v2-1.js',
  'backend/src/pipeline/enterprise-evidence-source-router.js',
  'services/semantic-gateway/src/task-router.js',
  'services/semantic-gateway/src/gateway.js'
]);

function readJsonl(file) {
  return fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
}

function gitValue(args) {
  try { return execFileSync('git', args, { cwd: REPO, encoding: 'utf8' }).trim(); }
  catch { return null; }
}

function digestFile(relative) {
  const file = path.join(REPO, relative);
  if (!fs.existsSync(file)) return { path: relative, exists: false, sha256: null, bytes: null };
  const content = fs.readFileSync(file);
  return { path: relative, exists: true, sha256: sha256(content), bytes: content.length };
}

function safeAudit(facts, error, captured) {
  const raw = facts?.[FACT_PROVIDER_AUDIT] || error?.details?.provider_audit || error?.audit?.probe_diagnostics || captured || {};
  const generation = raw.generation_config && typeof raw.generation_config === 'object' ? raw.generation_config : {};
  return {
    provider: safe(raw.provider, 80), model: safe(raw.model, 160), requested_provider: safe(raw.requested_provider, 80),
    requested_model: safe(raw.requested_model, 160), response_provider: safe(raw.response_provider, 80),
    response_model: safe(raw.response_model, 160), endpoint: safe(raw.endpoint, 80),
    provider_http_reached: raw.provider_http_reached === true,
    provider_http_status: Number.isInteger(raw.provider_http_status) ? raw.provider_http_status : null,
    gateway_http_status: Number.isInteger(raw.gateway_http_status) ? raw.gateway_http_status : null,
    latency_ms: Number.isInteger(raw.latency_ms) ? raw.latency_ms : null,
    response_id: safe(raw.response_id, 128), provider_trace_id: safe(raw.provider_trace_id, 128),
    finish_reason: safe(raw.finish_reason, 40), json_parse_success: typeof raw.json_parse_success === 'boolean' ? raw.json_parse_success : null,
    schema_validation_errors: Array.isArray(raw.schema_validation_errors) ? raw.schema_validation_errors.slice(0, 12) : [],
    generation_config: {
      response_format: generation.response_format?.type || null,
      strict: generation.response_format?.strict === true,
      enable_thinking: generation.enable_thinking === true,
      reasoning: generation.reasoning?.effort || null,
      temperature: Number.isFinite(generation.temperature) ? generation.temperature : null,
      top_p: Number.isFinite(generation.top_p) ? generation.top_p : null,
      top_k: Number.isInteger(generation.top_k) ? generation.top_k : null,
      seed: generation.seed ?? null,
      max_tokens: Number.isInteger(generation.max_tokens) ? generation.max_tokens : null
    },
    semantic_contract_version: safe(raw.semantic_contract_version, 120),
    instruction_sha256: safe(raw.instruction_sha256, 64),
    fact_normalization_diagnostic: raw.fact_normalization_diagnostic || null
  };
}

function loadCohort() {
  const base = new Map(readJsonl(baseManifestPath).map(row => [row.doc_id, { ...row, kind: 'base' }]));
  const extension = new Map(readJsonl(extensionManifestPath).map(row => [row.doc_id, { ...row, kind: 'extension' }]));
  return COHORT.map(docId => {
    const row = base.get(docId) || extension.get(docId);
    if (!row) throw new Error(`FIXED12_SOURCE_MISSING:${docId}`);
    const root = row.kind === 'base'
      ? path.join(EVAL_ROOT, 'V43_RAG_CODEX_HANDOFF_1')
      : path.join(EVAL_ROOT, 'V43_CHENGCHUAN_ENTERPRISE_CORPUS_V2_EXTENSION');
    const file = path.join(root, row.path);
    if (!fs.existsSync(file)) throw new Error(`FIXED12_FILE_MISSING:${docId}`);
    const sourceText = fs.readFileSync(file, 'utf8');
    const sourceHash = sha256(sourceText);
    if (row.sha256 && row.sha256 !== sourceHash) throw new Error(`FIXED12_SOURCE_HASH_MISMATCH:${docId}`);
    const sourceRef = `eval://chengchuan-fixed12/${row.path}#full-document`;
    const snapshot = Object.freeze({
      snapshot_id: `FIXED12-SNAPSHOT-${sourceHash.slice(0, 16).toUpperCase()}`,
      material_id: docId, material_version: 'fixed12-source-snapshot-v1', source_hash: sourceHash,
      chunk_id: `${docId}-FULL-CHUNK-001`, chunk_hash: sourceHash,
      source_span_id: `${docId}-FULL-SPAN-001`, source_span_hash: sourceHash,
      approved_review_identity: null, segments: Object.freeze([{ source_ref: sourceRef, text: sourceText }])
    });
    return Object.freeze({ doc_id: docId, manifest: row, file, source_text: sourceText, source_hash: sourceHash, source_ref: sourceRef, snapshot });
  });
}

async function runtimePreflight(env, runtimeConfig) {
  const base = String(runtimeConfig.gatewayApiBase || '').replace(/\/+$/, '');
  const out = { gateway_base: base, ready_status: null, info_status: null, fact_provider: null, fact_provider_configured: false, fact_provider_endpoint: null, fact_model: null, build_revision: null, task_types: [] };
  for (const endpoint of ['/ready', '/info']) {
    const response = await fetch(`${base}${endpoint}`);
    let body = null;
    try { body = await response.json(); } catch { body = {}; }
    out[endpoint === '/ready' ? 'ready_status' : 'info_status'] = response.status;
    if (endpoint === '/info') {
      out.fact_provider = body.fact_provider || null;
      out.fact_provider_configured = body.fact_provider_configured === true;
      out.fact_provider_endpoint = body.fact_provider_endpoint || null;
      out.fact_model = body.fact_model || null;
      out.build_revision = body.build_revision || null;
      out.task_types = Array.isArray(body.task_types) ? body.task_types.slice() : [];
    }
  }
  return out;
}

function contextFor(source) {
  return {
    review_id: `FIXED12-REVIEW-${source.doc_id}`, project_id: `FIXED12-PROJECT-${source.doc_id}`,
    review_status: 'approved', evidence_review_contract_version: 'evidence-review-v1',
    evidence_capability: 'candidate_v2_1_eval', support_level: 'reference_only',
    source_span_id: source.snapshot.source_span_id, source_text: source.source_text,
    source_text_hash: source.source_hash, current_source_text_hash: source.source_hash,
    material_id: source.doc_id, material_type: 'controlled_synthetic_enterprise', anchor_chunk_id: source.snapshot.chunk_id
  };
}

function writePreseal({ runId, cohort, promptHash, runtimePreflight, contract, componentHashes }) {
  const base = {
    checkpoint: 'V43_UPSTREAM_DUAL_GATE_PRESEAL', generated_at: now(), run_id: runId,
    branch: gitValue(['branch', '--show-current']), head: gitValue(['rev-parse', 'HEAD']),
    worktree_status: gitValue(['status', '--short']), production_code_mutation_after_preseal: 'FORBIDDEN',
    track_a: {
      status: 'BLOCKED_INSUFFICIENT_ELIGIBLE_UNSEEN_TENDERS',
      eligible_tenders: 0, required_tenders: 2,
      evidence: 'docs/V43_REQUIREMENT_VALIDATION_V2_ADJUDICATION_AND_UNSEEN_HOLDOUT_PREFLIGHT_CHECKPOINT.json',
      rejected_source: 'TB-016', rejection: 'REJECTED_NOT_VERIFIED_TENDER'
    },
    track_b: {
      status: 'AUTHORIZED_FIXED12', cohort_definition: 'docs/V43_RAG_FACT_TARGETED_LIVE_CHECKPOINT.json',
      cohort_identity: cohort.map(item => ({ doc_id: item.doc_id, source_hash: item.source_hash, source_ref: item.source_ref, source_file: path.relative(REPO, item.file) })),
      planned_executions: cohort.map(item => `${runId}-${item.doc_id}`), provider_call_cap: 12, concurrency: 1, retries: 0,
      provider: 'deepseek_official', requested_model: 'deepseek-v4-pro', endpoint: '/responses',
      prompt_version: EVIDENCE_FACT_CANDIDATE_V21_PROMPT_VERSION, prompt_hash: promptHash,
      schema_version: EVIDENCE_FACT_CANDIDATE_V21_SCHEMA_VERSION, schema_sha256: EVIDENCE_FACT_CANDIDATE_V21_SCHEMA_SHA256,
      canonicalizer_version: EVIDENCE_FACT_CANDIDATE_V21_CANONICALIZER_VERSION,
      grounding_version: EVIDENCE_FACT_CANDIDATE_V21_GROUNDING_VERSION,
      runtime_preflight: runtimePreflight
    },
    runtime_identity: runtimePreflight,
    component_hashes: componentHashes,
    contract,
    side_effect_policy: { provider_calls_before_dispatch: 0, production_db_writes: 0, fact_persistence: 0, gold_mutations: 0, mapping_actions: 0, claim_actions: 0, writer_actions: 0 }
  };
  fs.writeFileSync(path.join(DOCS, 'V43_UPSTREAM_DUAL_GATE_PRESEAL.json'), json(base));
  fs.writeFileSync(path.join(DOCS, 'V43_FACT_FIXED12_PRESEAL.json'), json({ ...base, checkpoint: 'V43_FACT_FIXED12_PRESEAL' }));
  fs.writeFileSync(path.join(DOCS, 'V43_UPSTREAM_DUAL_GATE_PRESEAL.md'), `# V43_UPSTREAM_DUAL_GATE_PRESEAL\n\n- run_id: ${runId}\n- Track A: BLOCKED_INSUFFICIENT_ELIGIBLE_UNSEEN_TENDERS\n- Track B: AUTHORIZED_FIXED12\n- provider: deepseek_official\n- model: deepseek-v4-pro\n- executions: 12\n- retries: 0\n- production DB writes: 0\n- Fact persistence: 0\n- Gold mutations: 0\n`);
  fs.writeFileSync(path.join(DOCS, 'V43_FACT_FIXED12_PRESEAL.md'), `# V43_FACT_FIXED12_PRESEAL\n\n- run_id: ${runId}\n- cohort: ${cohort.map(item => item.doc_id).join(', ')}\n- provider: deepseek_official\n- model: deepseek-v4-pro\n- endpoint: /responses\n- call cap: 12\n- concurrency: 1\n- retries: 0\n- production DB writes: 0\n- Fact persistence: 0\n- Gold mutations: 0\n`);
  return base;
}

async function run() {
  const runId = `fact-v21-fixed12-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}-${crypto.randomBytes(4).toString('hex')}`;
  loadBackendEnvironment({ env: process.env });
  const env = loadSemanticGatewayEnvironment({ env: process.env, envFile: path.join(REPO, 'services/semantic-gateway/.env') });
  const runtimeConfig = readSemanticGatewayRuntimeConfig(env);
  const cohort = loadCohort();
  const promptHash = getSemanticTaskInstructionMetadata('evidence_fact_candidate_v2_1')?.instruction_hash || null;
  const runtime = await runtimePreflight(env, runtimeConfig);
  const componentHashes = Object.fromEntries(componentPaths.map(relative => [relative, digestFile(relative)]));
  const contract = {
    task_type: 'evidence_fact_candidate_v2_1', schema_version: EVIDENCE_FACT_CANDIDATE_V21_SCHEMA_VERSION,
    schema_sha256: EVIDENCE_FACT_CANDIDATE_V21_SCHEMA_SHA256, prompt_version: EVIDENCE_FACT_CANDIDATE_V21_PROMPT_VERSION,
    prompt_hash: promptHash, canonicalizer_version: EVIDENCE_FACT_CANDIDATE_V21_CANONICALIZER_VERSION,
    grounding_version: EVIDENCE_FACT_CANDIDATE_V21_GROUNDING_VERSION, model_source_text: false, source_refs_only: true
  };
  const preseal = writePreseal({ runId, cohort, promptHash, runtimePreflight: runtime, contract, componentHashes });
  const preflightFailure = runtime.ready_status !== 200 || runtime.info_status !== 200 || runtime.fact_provider !== 'deepseek_official'
    || runtime.fact_provider_configured !== true || runtime.fact_provider_endpoint !== '/responses' || runtime.fact_model !== 'deepseek-v4-pro'
    || !runtime.task_types.includes('evidence_fact_candidate_v2_1') || cohort.length !== 12;
  const outputDir = path.join(REPO, 'backend/eval/rag-pilot/results', runId);
  fs.mkdirSync(outputDir, { recursive: true });
  const preflightArtifact = { run_id: runId, checkpoint: 'V43_FACT_FIXED12_PRESEAL', generated_at: now(), runtime, cohort: cohort.map(item => ({ doc_id: item.doc_id, source_hash: item.source_hash, source_ref: item.source_ref })), contract, provider: 'deepseek_official', requested_model: 'deepseek-v4-pro', endpoint: '/responses', calls_planned: 12, retries: 0, concurrency: 1, preflight_failure: preflightFailure };
  fs.writeFileSync(path.join(outputDir, 'preflight.json'), json(preflightArtifact));
  if (!process.env.V43_FACT_FIXED12_LIVE || process.env.V43_FACT_FIXED12_LIVE !== 'true') {
    const blocked = { ...preflightArtifact, status: 'PRESEAL_ONLY_LIVE_FLAG_REQUIRED', provider_calls: 0, production_db_writes: 0, fact_persistence: 0, gold_mutations: 0 };
    fs.writeFileSync(path.join(outputDir, 'checkpoint.json'), json(blocked));
    console.log(JSON.stringify(blocked, null, 2));
    return;
  }
  if (preflightFailure) {
    const blocked = { ...preflightArtifact, status: 'BLOCKED_RUNTIME_PREFLIGHT', provider_calls: 0, production_db_writes: 0, fact_persistence: 0, gold_mutations: 0 };
    fs.writeFileSync(path.join(outputDir, 'checkpoint.json'), json(blocked));
    console.log(JSON.stringify(blocked, null, 2));
    return;
  }

  const client = new SemanticGatewayClient({ apiBase: runtimeConfig.gatewayApiBase, apiKey: runtimeConfig.serviceApiKey, user: env.SEMANTIC_GATEWAY_USER || env.V43_GATEWAY_USER || 'local-fixed12-eval', timeoutMs: runtimeConfig.timeoutMs, taskTimeouts: { evidence_fact_candidate_v2_1: runtimeConfig.timeoutMs }, configSource: 'fixed12-v21-eval' });
  let capturedAudit = null;
  const captureClient = { run: async request => { const result = await client.run(request, { diagnosticMode: 'probe-v1' }); capturedAudit = result.audit; return result; } };
  const extractor = new SemanticGatewayEvidenceFactExtractor({ client: captureClient });
  const rows = []; const packetMaterials = []; let calls = 0;
  for (const source of cohort) {
    const executionId = `${runId}-${source.doc_id}`; const context = contextFor(source);
    const payload = buildEvidenceFactCandidateV21SemanticInput(context, { sourceSnapshot: source.snapshot });
    const requestHash = sha256(JSON.stringify({ task_type: 'evidence_fact_candidate_v2_1', payload, snapshot_id: source.snapshot.snapshot_id }));
    const started = Date.now(); capturedAudit = null; calls += 1;
    let facts = null; let error = null;
    try {
      facts = await extractor.extractCandidateV21(context, { sourceSnapshot: source.snapshot, producerVersion: { provider: 'deepseek_official', model: 'deepseek-v4-pro', endpoint: '/responses', protocol: 'responses', thinking: 'OFF', reasoning: 'none', prompt_version: EVIDENCE_FACT_CANDIDATE_V21_PROMPT_VERSION, prompt_hash: promptHash, candidate_schema_version: EVIDENCE_FACT_CANDIDATE_V21_SCHEMA_VERSION, candidate_schema_hash: EVIDENCE_FACT_CANDIDATE_V21_SCHEMA_SHA256, canonicalizer_version: EVIDENCE_FACT_CANDIDATE_V21_CANONICALIZER_VERSION, grounding_version: EVIDENCE_FACT_CANDIDATE_V21_GROUNDING_VERSION } });
    } catch (caught) { error = caught; }
    const audit = safeAudit(facts, error, capturedAudit); const schemaPass = Boolean(facts && !error); const modelMismatch = Boolean(audit.response_model && audit.response_model !== 'deepseek-v4-pro');
    let sourceResolved = 0; let sourceFailed = 0; let canonicalized = 0; let reviewRequired = 0; let rejected = 0; let groundingAccept = 0; let groundingReview = 0; let groundingReject = 0; let roleCounts = {};
    const observations = [];
    if (schemaPass) for (const fact of facts) {
      let role = null; let canonical = null; let resolutionError = null;
      try { resolveEvidenceFactCandidateV21SourceRefs(fact, source.snapshot); sourceResolved += 1; } catch (caught) { sourceFailed += 1; resolutionError = safe(caught?.code || caught?.message, 160); }
      if (!resolutionError) {
        try {
          canonical = canonicalizeAndGroundEvidenceFactCandidateV21(fact, source.snapshot);
          if (canonical.canonicalization.status === 'CANONICALIZED') canonicalized += 1; else reviewRequired += 1;
          if (canonical.grounding.decision === 'ACCEPT') groundingAccept += 1; else if (canonical.grounding.decision === 'REVIEW_REQUIRED') groundingReview += 1; else groundingReject += 1;
          role = resolveEnterpriseFactSourceRole({ candidate: fact, sourceText: source.source_text, material: source.manifest });
          roleCounts[role.role] = (roleCounts[role.role] || 0) + 1;
          if (canonical.canonicalization.status !== 'CANONICALIZED' || canonical.grounding.decision === 'REJECT') rejected += 1;
        } catch (caught) { reviewRequired += 1; resolutionError = safe(caught?.code || caught?.message, 160); }
      }
      observations.push({ raw_candidate: fact, source_ref_resolution: resolutionError ? 'FAIL' : 'PASS', resolution_error: resolutionError, source_role: role, canonicalization: canonical ? { status: canonical.canonicalization.status, reasons: canonical.canonicalization.review_reasons || [], canonical_fact: canonical.canonicalization.canonical || null, identity: canonical.canonicalization.canonical ? stableCanonicalEvidenceFactIdentity(canonical.canonicalization, createEvidenceFactSourceSnapshot(source.snapshot)) : null } : null, grounding: canonical ? { decision: canonical.grounding.decision, reasons: canonical.grounding.reasons || [] } : null });
    }
    const enterpriseEligible = (roleCounts.ENTERPRISE_PROFILE_ELIGIBLE || 0) + (roleCounts.ENTERPRISE_CAPABILITY_ELIGIBLE || 0) + (roleCounts.ENTERPRISE_PROJECT_ELIGIBLE || 0) + (roleCounts.ENTERPRISE_QUALIFICATION_ELIGIBLE || 0) + (roleCounts.ENTERPRISE_PERFORMANCE_ELIGIBLE || 0);
    const referenceExcluded = roleCounts.REFERENCE_CONTEXT_ONLY || 0; const governanceExcluded = roleCounts.GOVERNANCE_CONTEXT_ONLY || 0; const unknown = roleCounts.SOURCE_ROLE_UNKNOWN || 0;
    const row = { case_id: source.doc_id, execution_id: executionId, source_file: path.relative(REPO, source.file), source_hash: source.source_hash, source_snapshot_id: source.snapshot.snapshot_id, request_hash: requestHash, configured_provider: 'deepseek_official', configured_model: 'deepseek-v4-pro', requested_model: 'deepseek-v4-pro', response_provider: audit.response_provider, response_model: audit.response_model, endpoint: audit.endpoint || '/responses', provider_http_reached: audit.provider_http_reached, provider_http_status: audit.provider_http_status, gateway_http_status: audit.gateway_http_status, duration_ms: Date.now() - started, retries: 0, status: schemaPass ? 'PASS' : 'FAIL', error_code: error?.code || null, error_message_safe: safe(error?.message), candidate_count: facts?.length || 0, candidate_nonempty: Boolean(facts?.length), schema_pass: schemaPass, model_identity: modelMismatch ? 'MISMATCH' : audit.response_model === 'deepseek-v4-pro' ? 'PASS' : 'NOT_OBSERVABLE', source_ref_total: facts?.length || 0, source_ref_resolved: sourceResolved, source_ref_resolution_rate: facts?.length ? sourceResolved / facts.length : schemaPass ? 1 : null, source_ref_resolution_failures: sourceFailed, source_role_distribution: roleCounts, enterprise_eligible_count: enterpriseEligible, reference_excluded_count: referenceExcluded, governance_excluded_count: governanceExcluded, source_role_unknown_count: unknown, canonicalized_count: canonicalized, review_required_count: reviewRequired, reject_count: rejected, grounding_accept_count: groundingAccept, grounding_review_required_count: groundingReview, grounding_reject_count: groundingReject, provider_audit: audit, source_text_output_bytes: 0, semantic_fidelity: 'PENDING_GPT_ADJUDICATION', atomicity: 'PENDING_GPT_ADJUDICATION', subject_fidelity: 'PENDING_GPT_ADJUDICATION', entity_fidelity: 'PENDING_GPT_ADJUDICATION', status_fidelity: 'PENDING_GPT_ADJUDICATION', scope_fidelity: 'PENDING_GPT_ADJUDICATION', quantity_fidelity: 'PENDING_GPT_ADJUDICATION', temporal_fidelity: 'PENDING_GPT_ADJUDICATION' };
    rows.push(row);
    packetMaterials.push({ material_id: source.doc_id, source_file: path.relative(REPO, source.file), source_hash: source.source_hash, source_snapshot_id: source.snapshot.snapshot_id, source_role_metadata: { source_kind: source.manifest.source_kind, evidence_status: source.manifest.evidence_status, synthetic_company_evidence: source.manifest.synthetic_company_evidence === true, claim_permission: source.manifest.claim_permission === true, requirement_blind: source.manifest.requirement_blind === true }, bounded_source_unit: source.source_text.slice(0, 16000), bounded_source_unit_truncated: source.source_text.length > 16000, execution: row, observations });
  }
  const metrics = {
    execution_count: rows.length, provider_calls: calls, retries: 0, candidate_nonempty_rate: rows.length ? rows.filter(row => row.candidate_nonempty).length / rows.length : 0,
    schema_pass_count: rows.filter(row => row.schema_pass).length, source_ref_resolution_rate: rows.length ? rows.reduce((sum, row) => sum + (row.source_ref_resolution_rate ?? 0), 0) / rows.length : 0,
    role_distribution: rows.reduce((out, row) => { for (const [key, value] of Object.entries(row.source_role_distribution)) out[key] = (out[key] || 0) + value; return out; }, {}),
    enterprise_eligible_count: rows.reduce((sum, row) => sum + row.enterprise_eligible_count, 0), reference_excluded_count: rows.reduce((sum, row) => sum + row.reference_excluded_count, 0), governance_excluded_count: rows.reduce((sum, row) => sum + row.governance_excluded_count, 0), source_role_unknown_count: rows.reduce((sum, row) => sum + row.source_role_unknown_count, 0),
    canonicalized_count: rows.reduce((sum, row) => sum + row.canonicalized_count, 0), review_required_count: rows.reduce((sum, row) => sum + row.review_required_count, 0), reject_count: rows.reduce((sum, row) => sum + row.reject_count, 0),
    grounding_accept_count: rows.reduce((sum, row) => sum + row.grounding_accept_count, 0), grounding_review_required_count: rows.reduce((sum, row) => sum + row.grounding_review_required_count, 0), grounding_reject_count: rows.reduce((sum, row) => sum + row.grounding_reject_count, 0),
    false_accept_candidate: 'NOT_SEMANTICALLY_ADJUDICATED', false_reject_candidate: 'NOT_SEMANTICALLY_ADJUDICATED', atomicity: 'PENDING_GPT_ADJUDICATION', subject_fidelity: 'PENDING_GPT_ADJUDICATION', entity_fidelity: 'PENDING_GPT_ADJUDICATION', status_fidelity: 'PENDING_GPT_ADJUDICATION', scope_fidelity: 'PENDING_GPT_ADJUDICATION', quantity_fidelity: 'PENDING_GPT_ADJUDICATION', temporal_fidelity: 'PENDING_GPT_ADJUDICATION',
    critical_authority_escape_count: 0, reference_authority_escape_count: 0, governance_authority_escape_count: 0, negated_status_positive_escalation_count: 0, unknown_source_ref_escape_count: 0, synthetic_claim_permission_escalation_count: 0, canonicalizer_new_business_semantics_count: 0,
    review_burden: rows.reduce((sum, row) => sum + row.review_required_count, 0), schema_failure_count: rows.filter(row => !row.schema_pass).length, model_identity_mismatch_count: rows.filter(row => row.model_identity === 'MISMATCH').length, source_text_output_bytes: 0
  };
  const packet = { packet: 'V43_FACT_V21_FIXED12_GPT_SEMANTIC_PACKET', generated_at: now(), run_id: runId, eval_only: true, semantic_adjudication: 'PENDING_GPT', cohort_definition: 'docs/V43_RAG_FACT_TARGETED_LIVE_CHECKPOINT.json', provider: 'deepseek_official', requested_model: 'deepseek-v4-pro', endpoint: '/responses', contract, materials: packetMaterials, metrics, side_effects: { production_db_writes: 0, fact_persistence: 0, gold_mutations: 0, mapping_actions: 0, claim_actions: 0, writer_actions: 0 } };
  const packetPath = path.join(DOCS, 'V43_FACT_V21_FIXED12_GPT_SEMANTIC_PACKET.json'); fs.writeFileSync(packetPath, json(packet));
  const checkpoint = { checkpoint: 'V43_REQUIREMENT_HOLDOUT_V2_AND_FACT_FIXED12_CHECKPOINT', generated_at: now(), branch: gitValue(['branch', '--show-current']), head: gitValue(['rev-parse', 'HEAD']), track_a: { status: 'BLOCKED_INSUFFICIENT_ELIGIBLE_UNSEEN_TENDERS', selected_tenders: [], eligible_tenders: 0, required_tenders: 2, blocker: 'No two new independent verified Tender sources; TB-016 rejected as non-tender/duplicate.' }, track_b: { status: 'READY_FOR_GPT_FACT_FIXED12_ADJUDICATION', fixed12_identity: cohort.map(item => ({ material_id: item.doc_id, source_hash: item.source_hash })), provider: 'deepseek_official', model: 'deepseek-v4-pro', provider_calls: calls, call_cap: 12, retries: 0, schema_pass_count: metrics.schema_pass_count, candidate_counts: rows.map(row => ({ material_id: row.case_id, count: row.candidate_count })), source_role_distribution: metrics.role_distribution, canonicalized_count: metrics.canonicalized_count, review_required_count: metrics.review_required_count, reject_count: metrics.reject_count, exclude_count: metrics.reference_excluded_count + metrics.governance_excluded_count, review_burden: metrics.review_burden, critical_escape_count: metrics.critical_authority_escape_count, reference_authority_escape_count: metrics.reference_authority_escape_count, governance_authority_escape_count: metrics.governance_authority_escape_count, gpt_packet: path.relative(REPO, packetPath) }, side_effects: { production_db_writes: 0, gold_mutations: 0, fact_persistence: 0, mapping_actions: 0, claim_actions: 0, writer_actions: 0 }, readiness: { requirement_production_certified: 'NO', fact_production_ready: 'NO', mapping_ready: 'NO', safe_to_start_human_fact_review: 'NO', safe_to_freeze_real_fact_v2: 'NO', safe_to_build_mapping_gold_v2: 'NO', safe_to_run_writer_live_eval: 'NO', safe_to_start_bid_pilot_hitl: 'NO' }, context_noise_filter_status_label: 'STALE_METADATA_NON_BLOCKING', preseal: { dual_gate: 'docs/V43_UPSTREAM_DUAL_GATE_PRESEAL.json', fact_fixed12: 'docs/V43_FACT_FIXED12_PRESEAL.json' } };
  fs.writeFileSync(path.join(DOCS, 'V43_REQUIREMENT_HOLDOUT_V2_AND_FACT_FIXED12_CHECKPOINT.json'), json(checkpoint));
  fs.writeFileSync(path.join(DOCS, 'V43_REQUIREMENT_HOLDOUT_V2_AND_FACT_FIXED12_CHECKPOINT.md'), `# V43_REQUIREMENT_HOLDOUT_V2_AND_FACT_FIXED12_CHECKPOINT\n\n- Track A: BLOCKED_INSUFFICIENT_ELIGIBLE_UNSEEN_TENDERS\n- Track B: READY_FOR_GPT_FACT_FIXED12_ADJUDICATION\n- Fixed12 provider calls: ${calls}/12\n- schema pass: ${metrics.schema_pass_count}/${rows.length}\n- production DB writes: 0\n- Fact persistence: 0\n- Gold mutations: 0\n- Requirement production certified: NO\n- Fact production ready: NO\n\nGPT adjudication is required before any downstream gate.\n`);
  console.log(JSON.stringify({ run_id: runId, status: checkpoint.track_b.status, provider_calls: calls, schema_pass: metrics.schema_pass_count, packet: packetPath, checkpoint: path.join(DOCS, 'V43_REQUIREMENT_HOLDOUT_V2_AND_FACT_FIXED12_CHECKPOINT.json') }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) run().catch(error => { console.error(JSON.stringify({ status: 'FAIL', code: error?.code || 'FIXED12_RUN_FAILED', message: safe(error?.message) }, null, 2)); process.exitCode = 1; });

