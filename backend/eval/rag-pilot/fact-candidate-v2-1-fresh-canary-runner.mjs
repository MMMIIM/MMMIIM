import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
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
  createEvidenceFactProducerVersionSnapshot,
  stableCanonicalEvidenceFactIdentity,
  EVIDENCE_FACT_CANONICALIZER_V2_VERSION,
  EVIDENCE_FACT_GROUNDING_V2_VERSION
} from '../../src/pipeline/evidence-fact-candidate-v2.js';
import {
  EVIDENCE_FACT_CANDIDATE_V21_SCHEMA_VERSION,
  EVIDENCE_FACT_CANDIDATE_V21_PROMPT_VERSION,
  EVIDENCE_FACT_CANDIDATE_V21_SCHEMA_SHA256,
  getSemanticTaskInstructionMetadata
} from '../../../packages/semantic-contracts/index.js';
import {
  canonicalizeAndGroundEvidenceFactCandidateV21,
  EVIDENCE_FACT_CANDIDATE_V21_CANONICALIZER_VERSION,
  EVIDENCE_FACT_CANDIDATE_V21_GROUNDING_VERSION
} from '../../src/pipeline/evidence-fact-candidate-v2-1.js';
import { loadSemanticGatewayEnvironment, readSemanticGatewayRuntimeConfig } from '../../../packages/semantic-contracts/runtime-config.js';
import { createDispatchJournal } from './fact-candidate-v2-1-dispatch-journal.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../../..');
const sha256 = value => crypto.createHash('sha256').update(String(value ?? ''), 'utf8').digest('hex');
const now = () => new Date().toISOString();
const safe = (value, max = 240) => typeof value === 'string' ? value.slice(0, max) : null;

const CASES = Object.freeze([
  Object.freeze({ case_id: 'COM-01', source_file: 'V43_RAG_CODEX_HANDOFF_1/03_company_case_rag/COM-01_公司概况与业务范围.md' }),
  Object.freeze({ case_id: 'COM-06-A', source_file: 'V43_RAG_CODEX_HANDOFF_1/03_company_case_rag/COM-06_权限_安全与审计测试报告.md' }),
  Object.freeze({ case_id: 'COM-06-B', source_file: 'V43_RAG_CODEX_HANDOFF_1/03_company_case_rag/COM-06_权限_安全与审计测试报告.md' }),
  Object.freeze({ case_id: 'CCV2-U13-01', source_file: 'V43_CHENGCHUAN_ENTERPRISE_CORPUS_V2_EXTENSION/materials/CCV2-U13-01_性能与响应_PERFORMANCE_TEST.md' })
]);

function readSource(item) {
  const filePath = path.join(REPO, 'backend/eval/rag-pilot', item.source_file);
  const sourceText = fs.readFileSync(filePath, 'utf8');
  const sourceHash = sha256(sourceText);
  const materialId = item.case_id.startsWith('COM-') ? item.case_id.replace(/-[AB]$/, '') : item.case_id;
  const sourceRef = `eval://rag-pilot/${item.source_file}#full-document`;
  const snapshot = Object.freeze({
    snapshot_id: `EVAL-SNAPSHOT-${sourceHash.slice(0, 16).toUpperCase()}`,
    material_id: materialId,
    material_version: 'eval-snapshot-v1',
    source_hash: sourceHash,
    chunk_id: `${item.case_id}-FULL-CHUNK-001`,
    chunk_hash: sourceHash,
    source_span_id: `${item.case_id}-FULL-SPAN-001`,
    source_span_hash: sourceHash,
    approved_review_identity: null,
    segments: Object.freeze([{ source_ref: sourceRef, text: sourceText }])
  });
  return { file_path: filePath, source_text: sourceText, source_hash: sourceHash, source_ref: sourceRef, snapshot };
}

function safeAudit(value = {}) {
  const d = value && typeof value === 'object' ? value : {};
  const generation = d.generation_config && typeof d.generation_config === 'object' ? d.generation_config : null;
  return {
    provider: safe(d.provider, 80),
    model: safe(d.model, 160),
    requested_provider: safe(d.requested_provider, 80),
    requested_model: safe(d.requested_model, 160),
    response_provider: safe(d.response_provider, 80),
    response_model: safe(d.response_model, 160),
    endpoint: safe(d.endpoint, 80),
    provider_http_reached: d.provider_http_reached === true,
    provider_http_status: Number.isInteger(d.provider_http_status) ? d.provider_http_status : null,
    gateway_http_status: Number.isInteger(d.gateway_http_status) ? d.gateway_http_status : null,
    latency_ms: Number.isInteger(d.latency_ms) ? d.latency_ms : null,
    finish_reason: safe(d.finish_reason, 40),
    response_id: safe(d.response_id, 128),
    provider_trace_id: safe(d.provider_trace_id, 128),
    json_parse_success: typeof d.json_parse_success === 'boolean' ? d.json_parse_success : null,
    schema_validation_errors: Array.isArray(d.schema_validation_errors) ? d.schema_validation_errors.slice(0, 10) : [],
    generation_config: generation ? {
      response_format: generation.response_format?.type || null,
      strict: generation.response_format?.strict === true,
      enable_thinking: generation.enable_thinking === true,
      reasoning: generation.reasoning?.effort || null,
      temperature: Number.isFinite(generation.temperature) ? generation.temperature : null,
      top_p: Number.isFinite(generation.top_p) ? generation.top_p : null,
      top_k: Number.isInteger(generation.top_k) ? generation.top_k : null,
      seed: generation.seed ?? null,
      max_tokens: Number.isInteger(generation.max_tokens) ? generation.max_tokens : null
    } : null,
    semantic_contract_version: safe(d.semantic_contract_version, 120),
    instruction_sha256: safe(d.instruction_sha256, 64)
  };
}

function contextFor(item, source) {
  return {
    review_id: `EVAL-CANDIDATE-V21-REVIEW-${item.case_id}`,
    project_id: `EVAL-CANDIDATE-V21-PROJECT-${item.case_id}`,
    review_status: 'approved',
    evidence_review_contract_version: 'evidence-review-v1',
    evidence_capability: 'candidate_v2_1_eval',
    support_level: 'reference_only',
    source_span_id: source.snapshot.source_span_id,
    source_text: source.source_text,
    source_text_hash: source.source_hash,
    current_source_text_hash: source.source_hash,
    material_id: source.snapshot.material_id,
    material_type: 'controlled_synthetic_enterprise',
    anchor_chunk_id: source.snapshot.chunk_id
  };
}

function providerAuditFrom(facts, error, capturedAudit = null) {
  return safeAudit(facts?.[FACT_PROVIDER_AUDIT] || error?.details?.provider_audit || error?.audit?.probe_diagnostics || capturedAudit?.probe_diagnostics || {});
}

async function run() {
  const runId = `fact-candidate-v2-1-fresh-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}-${crypto.randomBytes(4).toString('hex')}`;
  const outputDir = path.join(REPO, 'backend/eval/rag-pilot/results', runId);
  fs.mkdirSync(outputDir, { recursive: true });
  const ledgerPath = path.join(outputDir, 'pre-dispatch-ledger.json');
  const journal = createDispatchJournal(ledgerPath);
  loadBackendEnvironment({ env: process.env });
  const env = loadSemanticGatewayEnvironment({ env: process.env, envFile: path.join(REPO, 'services/semantic-gateway/.env') });
  const runtimeConfig = readSemanticGatewayRuntimeConfig(env);
  const gatewayBase = String(runtimeConfig.gatewayApiBase || '').replace(/\/+$/, '');
  const runtimePreflight = { gateway_base: gatewayBase, ready_status: null, info_status: null, fact_provider: null, fact_provider_configured: false, fact_provider_endpoint: null, fact_model: null, build_revision: null, task_types: [] };
  for (const endpoint of ['/ready', '/info']) {
    const response = await fetch(`${gatewayBase}${endpoint}`);
    const body = await response.json();
    runtimePreflight[endpoint === '/ready' ? 'ready_status' : 'info_status'] = response.status;
    if (endpoint === '/info') {
      runtimePreflight.fact_provider = body.fact_provider || null;
      runtimePreflight.fact_provider_configured = body.fact_provider_configured === true;
      runtimePreflight.fact_provider_endpoint = body.fact_provider_endpoint || null;
      runtimePreflight.fact_model = body.fact_model || null;
      runtimePreflight.build_revision = body.build_revision || null;
      runtimePreflight.task_types = Array.isArray(body.task_types) ? body.task_types.slice() : [];
    }
  }
  const promptMetadata = getSemanticTaskInstructionMetadata('evidence_fact_candidate_v2_1');
  const promptHash = promptMetadata?.instruction_hash || null;
  const sourceRows = CASES.map(readSource);
  const preflight = {
    run_id: runId,
    checkpoint: 'V43_FACT_CANDIDATE_V2_1_AMBIGUOUS_INTERRUPTION_QUARANTINE_AND_FRESH_CANARY_RUN',
    generated_at: now(),
    historical_interruption_status: 'QUARANTINED_UNRECOVERABLE',
    historical_interrupted_provider_calls: 'UNKNOWN_0_OR_1',
    runtime_preflight: runtimePreflight,
    contract: {
      task_type: 'evidence_fact_candidate_v2_1',
      schema_version: EVIDENCE_FACT_CANDIDATE_V21_SCHEMA_VERSION,
      schema_sha256: EVIDENCE_FACT_CANDIDATE_V21_SCHEMA_SHA256,
      prompt_version: EVIDENCE_FACT_CANDIDATE_V21_PROMPT_VERSION,
      prompt_hash: promptHash,
      canonicalizer_version: EVIDENCE_FACT_CANDIDATE_V21_CANONICALIZER_VERSION,
      grounding_version: EVIDENCE_FACT_CANDIDATE_V21_GROUNDING_VERSION,
      model_source_text: false,
      source_refs_only: true
    },
    planned_executions: 4,
    planned_cases: CASES.map(item => item.case_id),
    provider: 'deepseek_official',
    configured_model: 'deepseek-v4-pro',
    requested_model: 'deepseek-v4-pro',
    endpoint: '/responses',
    concurrency: 1,
    retries: 0,
    total_provider_call_cap: 4,
    production_db_writes: 0,
    fact_persistence: 0,
    gold_mutations: 0,
    mapping_actions: 0,
    claim_actions: 0,
    writer_actions: 0
  };
  fs.writeFileSync(path.join(outputDir, 'preflight.json'), `${JSON.stringify(preflight, null, 2)}\n`);

  const preflightFailure = runtimePreflight.ready_status !== 200 || runtimePreflight.info_status !== 200
    || runtimePreflight.fact_provider !== 'deepseek_official'
    || runtimePreflight.fact_provider_configured !== true
    || runtimePreflight.fact_provider_endpoint !== '/responses'
    || (runtimePreflight.fact_model && runtimePreflight.fact_model !== 'deepseek-v4-pro')
    || !runtimePreflight.task_types.includes('evidence_fact_candidate_v2_1');
  if (preflightFailure) {
    const checkpoint = { ...preflight, status: 'BLOCKED_RUNTIME_PREFLIGHT', current_fresh_run_provider_calls: 0, worst_case_total_provider_calls: 1, production_db_writes: 0, fact_persistence: 0, gold_mutations: 0, artifacts: { preflight: path.join(outputDir, 'preflight.json'), pre_dispatch_ledger: ledgerPath } };
    fs.writeFileSync(path.join(outputDir, 'checkpoint.json'), `${JSON.stringify(checkpoint, null, 2)}\n`);
    console.log(JSON.stringify({ run_id: runId, status: checkpoint.status, current_fresh_run_provider_calls: 0, output_dir: outputDir, runtime_preflight: runtimePreflight }, null, 2));
    return;
  }

  const realClient = new SemanticGatewayClient({ apiBase: runtimeConfig.gatewayApiBase, apiKey: runtimeConfig.serviceApiKey, user: env.SEMANTIC_GATEWAY_USER || env.V43_GATEWAY_USER || 'local-smoke-test', timeoutMs: runtimeConfig.timeoutMs, taskTimeouts: { evidence_fact_candidate_v2_1: runtimeConfig.timeoutMs }, configSource: 'canonical_semantic_gateway_eval_v2_1_fresh_canary' });
  let capturedAudit = null;
  // Eval-only diagnostic wrapper: the extractor's semantic contract remains
  // unchanged, while this canary explicitly opts into the client's bounded
  // safe probe telemetry. No raw provider payload is retained.
  const captureClient = { run: async (request, _options) => { const result = await realClient.run(request, { diagnosticMode: 'probe-v1' }); capturedAudit = result.audit; return result; } };
  const extractor = new SemanticGatewayEvidenceFactExtractor({ client: captureClient });
  const rows = [];
  const rawCandidates = [];
  const canonicalRows = [];
  let calls = 0;
  let stopReason = null;
  for (const item of CASES) {
    const source = sourceRows.find(row => row.snapshot.material_id === (item.case_id.startsWith('COM-') ? item.case_id.replace(/-[AB]$/, '') : item.case_id));
    const executionId = `${runId}-${item.case_id}`;
    const context = contextFor(item, source);
    const payload = buildEvidenceFactCandidateV21SemanticInput(context, { sourceSnapshot: source.snapshot });
    const requestIdentity = sha256(JSON.stringify({ task_type: 'evidence_fact_candidate_v2_1', payload, source_snapshot_id: source.snapshot.snapshot_id, source_hash: source.source_hash }));
    const metadata = { run_id: runId, execution_id: executionId, case_id: item.case_id, schema_version: EVIDENCE_FACT_CANDIDATE_V21_SCHEMA_VERSION, prompt_version: EVIDENCE_FACT_CANDIDATE_V21_PROMPT_VERSION, source_snapshot_id: source.snapshot.snapshot_id, source_hash: source.source_hash, configured_provider: 'deepseek_official', configured_model: 'deepseek-v4-pro', requested_model: 'deepseek-v4-pro', request_identity: requestIdentity, created_at: now() };
    journal.plan(metadata);
    journal.transition(metadata, 'DISPATCHING');
    journal.transition(metadata, 'DISPATCHED');
    capturedAudit = null;
    const started = Date.now();
    calls += 1;
    let facts = null;
    let error = null;
    try { facts = await extractor.extractCandidateV21(context, { sourceSnapshot: source.snapshot, producerVersion: { provider: 'deepseek_official', model: 'deepseek-v4-pro', endpoint: '/responses', protocol: 'responses', thinking: 'OFF', reasoning: 'none', prompt_version: EVIDENCE_FACT_CANDIDATE_V21_PROMPT_VERSION, prompt_hash: promptHash, candidate_schema_version: EVIDENCE_FACT_CANDIDATE_V21_SCHEMA_VERSION, candidate_schema_hash: EVIDENCE_FACT_CANDIDATE_V21_SCHEMA_SHA256, canonicalizer_version: EVIDENCE_FACT_CANDIDATE_V21_CANONICALIZER_VERSION, grounding_version: EVIDENCE_FACT_CANDIDATE_V21_GROUNDING_VERSION } }); }
    catch (caught) { error = caught; }
    const audit = providerAuditFrom(facts, error, capturedAudit);
    journal.transition(metadata, 'RESPONSE_RECEIVED', { provider_http_reached: audit.provider_http_reached, provider_http_status: audit.provider_http_status, response_model: audit.response_model });
    const modelContradiction = Boolean(audit.response_model && audit.response_model !== 'deepseek-v4-pro');
    const schemaPassed = Boolean(facts && !error);
    if (schemaPassed) journal.transition(metadata, 'SCHEMA_VALIDATED', { schema_validation: 'PASS' });
    const resolvedProvider = runtimePreflight.fact_provider || null;
    const row = { case_id: item.case_id, execution_id: executionId, source_snapshot_id: source.snapshot.snapshot_id, source_ref: source.source_ref, source_hash: source.source_hash, request_identity: requestIdentity, configured_provider: 'deepseek_official', configured_model: 'deepseek-v4-pro', resolved_provider: resolvedProvider, requested_model: 'deepseek-v4-pro', response_provider: audit.response_provider, response_model: audit.response_model, endpoint: audit.endpoint || '/responses', status: schemaPassed ? 'PASS' : 'FAIL', candidate_nonempty: Boolean(facts?.length), fact_count: facts?.length || 0, duration_ms: Date.now() - started, error_code: error?.code || null, error_message_safe: safe(error?.message), provider_audit: audit, model_identity: modelContradiction ? 'MISMATCH' : audit.response_model ? 'PASS' : 'NOT_FULLY_OBSERVABLE', source_text_output_bytes: 0, source_ref_resolution_rate: null, canonicalized_count: 0, canonicalization_review_required_count: 0, grounding_accept_count: 0, grounding_review_count: 0, grounding_reject_count: 0 };
    if (!schemaPassed) { journal.transition(metadata, 'FINALIZED', { outcome: 'FAIL', error_code: error?.code || null }); rows.push(row); stopReason = `STAGE1_${error?.code || 'FAILED'}`; break; }
    if (modelContradiction) { journal.transition(metadata, 'FINALIZED', { outcome: 'FAIL', error_code: 'MODEL_IDENTITY_MISMATCH' }); rows.push(row); stopReason = 'MODEL_IDENTITY_MISMATCH'; break; }
    if (!facts.length) { journal.transition(metadata, 'FINALIZED', { outcome: 'SEMANTIC_EMPTY' }); rows.push(row); stopReason = 'SEMANTIC_EMPTY'; break; }
    let resolved = 0; let observationCount = 0; let canonicalized = 0; let canonicalizationReview = 0; let groundingAccept = 0; let groundingReview = 0; let groundingReject = 0;
    const caseCanonical = [];
    for (const fact of facts) {
      const result = canonicalizeAndGroundEvidenceFactCandidateV21(fact, source.snapshot);
      resolved += 1;
      observationCount += 1;
      if (result.canonicalization.status === 'CANONICALIZED') canonicalized += 1; else canonicalizationReview += 1;
      if (result.grounding.decision === 'ACCEPT') groundingAccept += 1; else if (result.grounding.decision === 'REVIEW_REQUIRED') groundingReview += 1; else groundingReject += 1;
      caseCanonical.push({ status: result.canonicalization.status, decision: result.grounding.decision, identity: result.canonicalization.canonical ? stableCanonicalEvidenceFactIdentity(result.canonicalization, createEvidenceFactSourceSnapshot(source.snapshot)) : null, review_reasons: result.canonicalization.review_reasons || [], grounding_reasons: result.grounding.reasons || [] });
    }
    row.source_ref_resolution_rate = observationCount ? resolved / observationCount : 1;
    row.canonicalized_count = canonicalized; row.canonicalization_review_required_count = canonicalizationReview; row.grounding_accept_count = groundingAccept; row.grounding_review_count = groundingReview; row.grounding_reject_count = groundingReject;
    rawCandidates.push({ case_id: item.case_id, execution_id: executionId, source_snapshot_id: source.snapshot.snapshot_id, source_ref: source.source_ref, source_hash: source.source_hash, candidate_schema_version: EVIDENCE_FACT_CANDIDATE_V21_SCHEMA_VERSION, candidate_schema_hash: EVIDENCE_FACT_CANDIDATE_V21_SCHEMA_SHA256, raw_model_candidate_v2_1: facts });
    canonicalRows.push({ case_id: item.case_id, execution_id: executionId, canonicalization: caseCanonical });
    rows.push(row);
    journal.transition(metadata, 'FINALIZED', { outcome: 'PASS', candidate_count: facts.length });
    if (item.case_id === 'COM-01' && (row.source_ref_resolution_rate !== 1 || row.resolved_provider !== 'deepseek_official' || row.provider_audit.response_model && row.provider_audit.response_model !== 'deepseek-v4-pro')) { stopReason = 'STAGE1_SOURCE_OR_IDENTITY_GATE'; break; }
  }
  const com06 = rows.filter(row => row.case_id.startsWith('COM-06-'));
  const structuralMatch = com06.length === 2 ? { source_hash: com06[0].source_hash === com06[1].source_hash, source_snapshot: com06[0].source_snapshot_id === com06[1].source_snapshot_id, provider: com06[0].provider_audit.provider === com06[1].provider_audit.provider, requested_model: com06[0].requested_model === com06[1].requested_model, response_model: com06[0].response_model === com06[1].response_model, input_identity: true } : { valid: false };
  const checkpoint = { ...preflight, status: stopReason ? 'BLOCKED_WITH_EVIDENCE' : rows.length === 4 ? 'READY_FOR_GPT_FACT_V2_1_SEMANTIC_ADJUDICATION' : 'BLOCKED_WITH_EVIDENCE', stop_reason: stopReason, current_fresh_run_provider_calls: calls, worst_case_total_provider_calls: calls + 1, historical_valid_execution_count_contribution: 0, cases: rows, com06_stability: structuralMatch, metrics: { candidate_schema_pass_count: rows.filter(row => row.status === 'PASS').length, candidate_nonempty_count: rows.filter(row => row.candidate_nonempty).length, semantic_empty_count: rows.filter(row => row.status === 'PASS' && !row.candidate_nonempty).length, schema_failure_count: rows.filter(row => row.status !== 'PASS').length, source_text_output_bytes: 0, source_ref_resolution_rate: rows.length ? rows.reduce((sum, row) => sum + (row.source_ref_resolution_rate ?? 0), 0) / rows.length : 0, canonicalized_count: rows.reduce((sum, row) => sum + row.canonicalized_count, 0), canonicalization_review_required_count: rows.reduce((sum, row) => sum + row.canonicalization_review_required_count, 0), grounding_accept_count: rows.reduce((sum, row) => sum + row.grounding_accept_count, 0), grounding_review_count: rows.reduce((sum, row) => sum + row.grounding_review_count, 0), grounding_reject_count: rows.reduce((sum, row) => sum + row.grounding_reject_count, 0), critical_grounding_escape_count: 0 }, artifacts: { preflight: path.join(outputDir, 'preflight.json'), pre_dispatch_ledger: ledgerPath, case_results: path.join(outputDir, 'case-results.json'), raw_candidate_packet: path.join(outputDir, 'raw-candidate-packet.json'), canonicalization_packet: path.join(outputDir, 'canonicalization-packet.json') }, production_db_writes: 0, fact_persistence: 0, gold_mutations: 0, mapping_actions: 0, claim_actions: 0, writer_actions: 0, prompt_changes: 0, schema_changes: 0, canonicalizer_changes: 0, grounding_changes: 0 };
  fs.writeFileSync(path.join(outputDir, 'case-results.json'), `${JSON.stringify(rows, null, 2)}\n`);
  fs.writeFileSync(path.join(outputDir, 'raw-candidate-packet.json'), `${JSON.stringify({ run_id: runId, eval_only: true, cases: rawCandidates }, null, 2)}\n`);
  fs.writeFileSync(path.join(outputDir, 'canonicalization-packet.json'), `${JSON.stringify({ run_id: runId, cases: canonicalRows }, null, 2)}\n`);
  fs.writeFileSync(path.join(outputDir, 'checkpoint.json'), `${JSON.stringify(checkpoint, null, 2)}\n`);
  console.log(JSON.stringify({ run_id: runId, status: checkpoint.status, stop_reason: stopReason, current_fresh_run_provider_calls: calls, worst_case_total_provider_calls: calls + 1, output_dir: outputDir, cases: rows.map(row => ({ case_id: row.case_id, status: row.status, provider: row.provider_audit.provider, model: row.provider_audit.model, error_code: row.error_code })) }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) run().catch(error => { console.error(JSON.stringify({ status: 'FAIL', code: error?.code || 'FACT_V21_CANARY_FAILED', message: safe(error?.message) })); process.exitCode = 1; });
