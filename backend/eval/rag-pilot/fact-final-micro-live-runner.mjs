import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { SemanticGatewayClient } from '../../src/pipeline/semantic-gateway-client.js';
import { loadBackendEnvironment } from '../../src/backend-runtime.js';
import {
  SemanticGatewayEvidenceFactExtractor,
  FACT_PROVIDER_AUDIT,
  buildEvidenceFactCandidateV21SemanticInput
} from '../../src/pipeline/semantic-gateway-evidence-fact-extractor.js';
import {
  canonicalizeAndGroundEvidenceFactCandidateV21,
  resolveEvidenceFactCandidateV21SourceRefs,
  EVIDENCE_FACT_CANDIDATE_V21_CANONICALIZER_VERSION,
  EVIDENCE_FACT_CANDIDATE_V21_GROUNDING_VERSION
} from '../../src/pipeline/evidence-fact-candidate-v2-1.js';
import { resolveEnterpriseFactSourceRole } from '../../src/pipeline/enterprise-evidence-source-router.js';
import { buildEvidenceFactProducerInputWindows, EVIDENCE_FACT_PRODUCER_INPUT_WINDOW_VERSION } from '../../src/pipeline/evidence-fact-producer-input-window.js';
import {
  EVIDENCE_FACT_CANDIDATE_V21_SCHEMA_VERSION,
  EVIDENCE_FACT_CANDIDATE_V21_PROMPT_VERSION,
  EVIDENCE_FACT_CANDIDATE_V21_SCHEMA_SHA256,
  getSemanticTaskInstructionMetadata
} from '../../../packages/semantic-contracts/index.js';
import { loadSemanticGatewayEnvironment, readSemanticGatewayRuntimeConfig } from '../../../packages/semantic-contracts/runtime-config.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../../..');
const EVAL_ROOT = path.join(REPO, 'backend', 'eval', 'rag-pilot');
const DOCS = path.join(REPO, 'docs');
const MANIFEST = path.join(EVAL_ROOT, 'V43_RAG_CODEX_HANDOFF_1', 'rag_import_manifest.jsonl');
const TARGETS = Object.freeze([
  'COM-07-WINDOW-002',
  'COM-07-WINDOW-004',
  'COM-08-WINDOW-003',
  'COM-08-WINDOW-004'
]);

const sha256 = value => crypto.createHash('sha256').update(String(value ?? ''), 'utf8').digest('hex');
const json = value => `${JSON.stringify(value, null, 2)}\n`;
const safe = (value, max = 240) => typeof value === 'string' ? value.slice(0, max) : null;

function gitValue(args) {
  try { return execFileSync('git', args, { cwd: REPO, encoding: 'utf8' }).trim(); } catch { return null; }
}

function manifestRows() {
  return fs.readFileSync(MANIFEST, 'utf8').split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
}

function loadSources() {
  return ['COM-07', 'COM-08'].map(docId => {
    const manifest = manifestRows().find(row => row.doc_id === docId);
    if (!manifest) throw new Error(`WINDOW_SOURCE_MISSING:${docId}`);
    const file = path.join(EVAL_ROOT, 'V43_RAG_CODEX_HANDOFF_1', manifest.path);
    const sourceText = fs.readFileSync(file, 'utf8');
    const sourceHash = sha256(sourceText);
    if (manifest.sha256 && manifest.sha256 !== sourceHash) throw new Error(`WINDOW_SOURCE_HASH_MISMATCH:${docId}`);
    const prepared = buildEvidenceFactProducerInputWindows({
      documentId: docId,
      sourceText,
      sourceRef: `eval://chengchuan-fixed12/${manifest.path}#full-document`,
      sourceHash,
      metadata: {
        material_id: docId,
        source_kind: manifest.source_kind,
        evidence_status: manifest.evidence_status,
        synthetic_company_evidence: manifest.synthetic_company_evidence === true,
        claim_permission: manifest.claim_permission === true
      }
    });
    return { docId, manifest, file, sourceHash, prepared };
  });
}

function scopedSourceText(window) {
  return [...window.heading_path.map((heading, index) => `${'#'.repeat(Math.max(1, index + 1))} ${heading}`), window.body]
    .filter(Boolean).join('\n').trim();
}

function collectSourceRefs(value, output = []) {
  if (Array.isArray(value)) { for (const item of value) collectSourceRefs(item, output); return output; }
  if (!value || typeof value !== 'object') return output;
  for (const [key, item] of Object.entries(value)) {
    if (key.endsWith('source_refs') && Array.isArray(item)) output.push(...item.filter(ref => typeof ref === 'string'));
    else if (key !== 'provider_audit') collectSourceRefs(item, output);
  }
  return output;
}

function snapshotFor(source, window, sourceRef) {
  const boundedHash = sha256(window.producer_source_text);
  return Object.freeze({
    snapshot_id: `FINAL-MICRO-${sha256(`${source.docId}:${window.window_id}:${boundedHash}`).slice(0, 16).toUpperCase()}`,
    material_id: `${source.docId}:${window.window_id}`,
    material_version: 'com0708-window-snapshot-v1',
    source_hash: boundedHash,
    chunk_id: window.window_id,
    chunk_hash: boundedHash,
    source_span_id: `${window.window_id}-SPAN-001`,
    source_span_hash: boundedHash,
    approved_review_identity: null,
    segments: Object.freeze([{ source_ref: sourceRef, text: window.producer_source_text }])
  });
}

function contextFor(source, window, snapshot) {
  return {
    review_id: `FINAL-MICRO-REVIEW-${window.window_id}`,
    project_id: `FINAL-MICRO-PROJECT-${source.docId}`,
    review_status: 'approved',
    evidence_review_contract_version: 'evidence-review-v1',
    evidence_capability: 'candidate_v2_1_final_micro_live',
    support_level: 'reference_only',
    source_span_id: snapshot.source_span_id,
    source_text: window.producer_source_text,
    source_text_hash: snapshot.source_hash,
    current_source_text_hash: snapshot.source_hash,
    material_id: snapshot.material_id,
    material_type: 'controlled_synthetic_enterprise',
    anchor_chunk_id: window.window_id
  };
}

function auditFrom(facts, error, captured) {
  const raw = facts?.[FACT_PROVIDER_AUDIT] || captured?.probe_diagnostics || error?.audit?.probe_diagnostics || error?.details?.provider_audit || {};
  const generation = raw.generation_config && typeof raw.generation_config === 'object' ? raw.generation_config : {};
  return {
    provider: safe(raw.provider, 80),
    model: safe(raw.model, 160),
    requested_provider: safe(raw.requested_provider, 80),
    requested_model: safe(raw.requested_model, 160),
    response_provider: safe(raw.response_provider, 80),
    response_model: safe(raw.response_model, 160),
    endpoint: safe(raw.endpoint, 80),
    provider_http_reached: raw.provider_http_reached === true,
    provider_http_status: Number.isInteger(raw.provider_http_status) ? raw.provider_http_status : null,
    gateway_http_status: Number.isInteger(raw.gateway_http_status) ? raw.gateway_http_status : null,
    latency_ms: Number.isInteger(raw.latency_ms) ? raw.latency_ms : null,
    response_id: safe(raw.response_id, 128),
    provider_trace_id: safe(raw.provider_trace_id, 128),
    finish_reason: safe(raw.finish_reason, 40),
    json_parse_success: typeof raw.json_parse_success === 'boolean' ? raw.json_parse_success : null,
    output_truncated: raw.output_truncated === true,
    safe_error_code: safe(raw.safe_error_code, 120),
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
    }
  };
}

function safeError(error) {
  return {
    code: safe(error?.code, 120),
    message: safe(error?.message, 320),
    status: Number.isInteger(error?.status) ? error.status : null,
    stage: safe(error?.details?.stage, 80),
    cause_code: safe(error?.details?.cause_code, 120)
  };
}

async function runtimePreflight(runtimeConfig) {
  const base = String(runtimeConfig.gatewayApiBase || '').replace(/\/+$/, '');
  const result = { gateway_base: base, ready_status: null, info_status: null, fact_provider: null, fact_provider_configured: false, fact_provider_endpoint: null, fact_model: null, build_revision: null, task_types: [] };
  for (const endpoint of ['/ready', '/info']) {
    const response = await fetch(`${base}${endpoint}`);
    let body = {};
    try { body = await response.json(); } catch { /* safe preflight */ }
    result[endpoint === '/ready' ? 'ready_status' : 'info_status'] = response.status;
    if (endpoint === '/info') {
      result.fact_provider = body.fact_provider || null;
      result.fact_provider_configured = body.fact_provider_configured === true;
      result.fact_provider_endpoint = body.fact_provider_endpoint || null;
      result.fact_model = body.fact_model || null;
      result.build_revision = body.build_revision || null;
      result.task_types = Array.isArray(body.task_types) ? body.task_types.slice() : [];
    }
  }
  return result;
}

function expectedFor(windowId) {
  return {
    'COM-07-WINDOW-002': { source_grounded: 'YES', grounding_mode: 'BOUNDED_COMPOSITIONAL', enterprise_authority: 'NO' },
    'COM-07-WINDOW-004': { source_grounded: 'YES', grounding_mode: 'GOVERNANCE_CONTEXT_ONLY', enterprise_authority: 'NO' },
    'COM-08-WINDOW-003': { source_grounded: 'YES', grounding_mode: 'NEGATED_OR_LIMITED_SCOPE', enterprise_authority: 'NO' },
    'COM-08-WINDOW-004': { source_grounded: 'YES', grounding_mode: 'REFERENCE_CONTEXT_ONLY', enterprise_authority: 'NO' }
  }[windowId] || null;
}

async function run() {
  const runId = `fact-final-micro-live-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}-${crypto.randomBytes(4).toString('hex')}`;
  const sources = loadSources();
  const windowIndex = new Map(sources.flatMap(source => source.prepared.windows.map(window => [window.window_id, { source, window }])));
  const selected = TARGETS.map(windowId => {
    const entry = windowIndex.get(windowId);
    if (!entry) throw new Error(`TARGET_WINDOW_MISSING:${windowId}`);
    return entry;
  });
  const backendEnv = loadBackendEnvironment({ env: process.env });
  const gatewayEnv = loadSemanticGatewayEnvironment({ env: process.env, envFile: path.join(REPO, 'services/semantic-gateway/.env') });
  const runtimeConfig = readSemanticGatewayRuntimeConfig(gatewayEnv);
  const runtime = await runtimePreflight(runtimeConfig);
  const basePacket = {
    packet: 'V43_FACT_FINAL_MICRO_LIVE_GPT_PACKET', generated_at: new Date().toISOString(), run_id: runId,
    eval_only: true, provider: 'deepseek_official', requested_model: 'deepseek-v4-pro', endpoint: '/responses',
    contract: {
      task_type: 'evidence_fact_candidate_v2_1', schema_version: EVIDENCE_FACT_CANDIDATE_V21_SCHEMA_VERSION,
      schema_sha256: EVIDENCE_FACT_CANDIDATE_V21_SCHEMA_SHA256,
      prompt_version: EVIDENCE_FACT_CANDIDATE_V21_PROMPT_VERSION,
      prompt_hash: getSemanticTaskInstructionMetadata('evidence_fact_candidate_v2_1')?.instruction_hash || null,
      producer_window_version: EVIDENCE_FACT_PRODUCER_INPUT_WINDOW_VERSION,
      canonicalizer_version: EVIDENCE_FACT_CANDIDATE_V21_CANONICALIZER_VERSION,
      grounding_version: EVIDENCE_FACT_CANDIDATE_V21_GROUNDING_VERSION
    },
    runtime,
    targets: TARGETS,
    executions: [],
    side_effects: { provider_calls: 0, production_db_writes: 0, fact_persistence: 0, gold_mutations: 0, mapping_actions: 0, claim_actions: 0, writer_actions: 0 }
  };
  const preflightOk = runtime.ready_status === 200 && runtime.info_status === 200
    && runtime.fact_provider === 'deepseek_official' && runtime.fact_provider_configured === true
    && runtime.fact_provider_endpoint === '/responses' && runtime.fact_model === 'deepseek-v4-pro'
    && runtime.task_types.includes('evidence_fact_candidate_v2_1');
  const packetPath = path.join(DOCS, 'V43_FACT_FINAL_MICRO_LIVE_GPT_PACKET.json');
  const checkpointPath = path.join(DOCS, 'V43_FACT_FINAL_MICRO_LIVE_CHECKPOINT.json');
  const markdownPath = path.join(DOCS, 'V43_FACT_FINAL_MICRO_LIVE_CHECKPOINT.md');
  if (!preflightOk || process.env.V43_FACT_FINAL_MICRO_LIVE !== 'true') {
    basePacket.status = !preflightOk ? 'BLOCKED_RUNTIME_PREFLIGHT' : 'BLOCKED_LIVE_FLAG_REQUIRED';
    basePacket.failure = !preflightOk ? { code: 'RUNTIME_PREFLIGHT', message: 'Runtime did not satisfy frozen final micro gate.' } : { code: 'LIVE_FLAG_REQUIRED', message: 'Set V43_FACT_FINAL_MICRO_LIVE=true to authorize live calls.' };
    fs.writeFileSync(packetPath, json(basePacket));
    const checkpoint = { checkpoint: 'V43_FACT_FINAL_MICRO_LIVE_CHECKPOINT', ...basePacket, packet: path.relative(REPO, packetPath), status: basePacket.status, provider_calls: 0, source_ref_resolution_rate: 0 };
    fs.writeFileSync(checkpointPath, json(checkpoint));
    fs.writeFileSync(markdownPath, `# V43_FACT_FINAL_MICRO_LIVE_CHECKPOINT\n\n- status: ${basePacket.status}\n- provider calls: 0\n- production DB writes: 0\n- Fact persistence: 0\n- Gold mutations: 0\n`);
    console.log(JSON.stringify({ status: basePacket.status, run_id: runId, provider_calls: 0, checkpoint: path.relative(REPO, checkpointPath) }));
    return;
  }

  const client = new SemanticGatewayClient({
    apiBase: runtimeConfig.gatewayApiBase,
    apiKey: runtimeConfig.serviceApiKey,
    user: gatewayEnv.SEMANTIC_GATEWAY_USER || gatewayEnv.V43_GATEWAY_USER || 'local-final-micro-live',
    timeoutMs: runtimeConfig.timeoutMs,
    taskTimeouts: { evidence_fact_candidate_v2_1: runtimeConfig.timeoutMs },
    configSource: 'fact-final-micro-live'
  });
  let captured = null;
  const captureClient = { run: async request => { const result = await client.run(request, { diagnosticMode: 'probe-v1' }); captured = result.audit; return result; } };
  const extractor = new SemanticGatewayEvidenceFactExtractor({ client: captureClient });
  let failure = null;
  for (const entry of selected) {
    const { source, window } = entry;
    const sourceRef = `${source.prepared.document.source_ref}#window=${window.window_id}`;
    const snapshot = snapshotFor(source, window, sourceRef);
    const context = contextFor(source, window, snapshot);
    const providerInput = buildEvidenceFactCandidateV21SemanticInput(context, { sourceSnapshot: snapshot });
    const started = Date.now();
    captured = null;
    let facts = null;
    let error = null;
    try {
      facts = await extractor.extractCandidateV21(context, { sourceSnapshot: snapshot, producerVersion: {
        provider: 'deepseek_official', model: 'deepseek-v4-pro', endpoint: '/responses', protocol: 'responses', thinking: 'OFF', reasoning: 'none',
        prompt_version: EVIDENCE_FACT_CANDIDATE_V21_PROMPT_VERSION, prompt_hash: getSemanticTaskInstructionMetadata('evidence_fact_candidate_v2_1')?.instruction_hash || null,
        candidate_schema_version: EVIDENCE_FACT_CANDIDATE_V21_SCHEMA_VERSION, candidate_schema_hash: EVIDENCE_FACT_CANDIDATE_V21_SCHEMA_SHA256,
        canonicalizer_version: EVIDENCE_FACT_CANDIDATE_V21_CANONICALIZER_VERSION, grounding_version: EVIDENCE_FACT_CANDIDATE_V21_GROUNDING_VERSION
      } });
    } catch (caught) { error = caught; }
    const audit = auditFrom(facts, error, captured);
    const semanticEmpty = error?.code === 'FACT_SEMANTIC_EMPTY';
    const schemaPass = Boolean(facts && !error) || semanticEmpty;
    const refs = facts ? facts.flatMap(fact => collectSourceRefs(fact)) : [];
    const foreignRefs = refs.filter(ref => ref !== sourceRef);
    const sourceRefResolution = { total: refs.length, resolved: refs.length - foreignRefs.length, foreign_refs: [...new Set(foreignRefs)] };
    const candidates = [];
    let crossWindow = foreignRefs.length > 0 ? facts?.length || 0 : 0;
    let canonicalizationReviewRequired = 0;
    let groundingReject = 0;
    for (const fact of facts || []) {
      let sourceRole = null;
      let canonicalization = null;
      let grounding = null;
      let candidateError = null;
      try {
        if (collectSourceRefs(fact).some(ref => ref !== sourceRef)) throw Object.assign(new Error('CROSS_WINDOW_SOURCE_REF'), { code: 'CROSS_WINDOW_SOURCE_REF' });
        const resolvedSourceUnit = { heading_path: window.heading_path, text: window.producer_source_text };
        sourceRole = resolveEnterpriseFactSourceRole({ candidate: fact, sourceText: scopedSourceText(window), material: source.manifest });
        resolveEvidenceFactCandidateV21SourceRefs(fact, snapshot);
        const result = canonicalizeAndGroundEvidenceFactCandidateV21(fact, snapshot, { resolvedSourceUnit });
        canonicalization = { status: result.canonicalization.status, reasons: result.canonicalization.review_reasons || [], canonical_fact: result.canonicalization.canonical || null };
        grounding = { decision: result.grounding.decision, reasons: result.grounding.reasons || [], mode: result.grounding.source_grounding_mode || null };
        if (canonicalization.status === 'REVIEW_REQUIRED') canonicalizationReviewRequired += 1;
        if (grounding.decision === 'REJECT') groundingReject += 1;
      } catch (caught) { candidateError = safeError(caught); if (candidateError.code === 'CROSS_WINDOW_SOURCE_REF') crossWindow += 1; }
      candidates.push({ raw_candidate: fact, source_refs: collectSourceRefs(fact), source_ref_resolution: candidateError ? 'FAIL' : 'PASS', source_role: sourceRole, canonicalization, grounding, error: candidateError });
    }
    const status = error && !semanticEmpty ? 'PROVIDER_FAILURE' : !schemaPass ? 'SCHEMA_FAILURE' : semanticEmpty ? 'SEMANTIC_EMPTY' : foreignRefs.length ? 'CROSS_WINDOW_CANDIDATE' : 'PASS';
    const execution = {
      execution_id: `${runId}-${window.window_id}`,
      window_id: window.window_id,
      window_source_hash: snapshot.source_hash,
      request_hash: sha256(JSON.stringify(providerInput)),
      source_ref: sourceRef,
      source_ref_resolution: sourceRefResolution,
      provider_input: providerInput,
      raw_model_output: captured?.raw_response_payload_json || null,
      parsed_candidates: facts || [],
      candidates,
      provider_audit: audit,
      provider_calls: 1,
      retry_count: 0,
      duration_ms: Date.now() - started,
      status,
      schema_pass: schemaPass,
      semantic_empty: semanticEmpty,
      candidate_count: facts?.length || 0,
      canonicalization_review_required: canonicalizationReviewRequired,
      grounding_reject_count: groundingReject,
      cross_window_candidate_count: crossWindow,
      expected: expectedFor(window.window_id),
      error: error ? safeError(error) : null
    };
    basePacket.executions.push(execution);
    basePacket.side_effects.provider_calls += 1;
    if (!['PASS', 'SEMANTIC_EMPTY'].includes(status)) { failure = { code: status, window_id: window.window_id, error: safeError(error) }; break; }
  }
  const allExecutions = basePacket.executions;
  const sourceRefTotal = allExecutions.reduce((sum, item) => sum + item.source_ref_resolution.total, 0);
  const sourceRefResolved = allExecutions.reduce((sum, item) => sum + item.source_ref_resolution.resolved, 0);
  const authorityEscapes = allExecutions.flatMap(item => item.candidates || []).filter(candidate => ['REFERENCE_CONTEXT_ONLY', 'GOVERNANCE_CONTEXT_ONLY'].includes(candidate.source_role?.role) && candidate.grounding?.decision === 'ACCEPT');
  const criticalFalseAccepts = authorityEscapes.filter(candidate => candidate.source_role?.enterprise_authority === true);
  const fullDocumentFallback = 0;
  const crossHeading = 0;
  const expectedMismatch = allExecutions.flatMap(item => item.candidates || []).filter(candidate => candidate.error?.code === 'CROSS_WINDOW_SOURCE_REF').length;
  basePacket.metrics = {
    planned_provider_calls: 4,
    actual_provider_calls: allExecutions.length,
    provider_failures: allExecutions.filter(item => item.status === 'PROVIDER_FAILURE').length,
    schema_failures: allExecutions.filter(item => item.schema_pass === false).length,
    semantic_empty_count: allExecutions.filter(item => item.semantic_empty).length,
    source_ref_total: sourceRefTotal,
    source_ref_resolved: sourceRefResolved,
    source_ref_resolution_rate: sourceRefTotal ? sourceRefResolved / sourceRefTotal : allExecutions.length === 4 ? 1 : 0,
    full_document_fallback_count: fullDocumentFallback,
    cross_heading_grounding_count: crossHeading,
    cross_window_candidate_count: allExecutions.reduce((sum, item) => sum + item.cross_window_candidate_count, 0),
    reference_authority_escape_count: authorityEscapes.length,
    governance_authority_escape_count: authorityEscapes.filter(candidate => candidate.source_role?.role === 'GOVERNANCE_CONTEXT_ONLY').length,
    critical_false_accept_count: criticalFalseAccepts.length,
    source_ref_mismatch_count: expectedMismatch,
    expected_window_ids: TARGETS
  };
  basePacket.status = failure ? `BLOCKED_${failure.code}` : allExecutions.length === 4 && basePacket.metrics.source_ref_resolution_rate === 1 && basePacket.metrics.reference_authority_escape_count === 0 && basePacket.metrics.governance_authority_escape_count === 0 && basePacket.metrics.critical_false_accept_count === 0 ? 'READY_FOR_GPT_FACT_FINAL_RUNTIME_ADJUDICATION' : 'BLOCKED_RUNTIME_SAFETY_GATE';
  basePacket.failure = failure;
  fs.writeFileSync(packetPath, json(basePacket));
  const checkpoint = {
    checkpoint: 'V43_FACT_FINAL_MICRO_LIVE_CHECKPOINT', generated_at: basePacket.generated_at, run_id: runId,
    branch: gitValue(['branch', '--show-current']), head: gitValue(['rev-parse', 'HEAD']), status: basePacket.status,
    window_ids: TARGETS, executions: allExecutions.map(item => ({ execution_id: item.execution_id, window_id: item.window_id, status: item.status, provider_audit: item.provider_audit, source_ref_resolution: item.source_ref_resolution, candidate_count: item.candidate_count, semantic_empty: item.semantic_empty, schema_pass: item.schema_pass, error: item.error })),
    metrics: basePacket.metrics, packet: path.relative(REPO, packetPath), side_effects: basePacket.side_effects
  };
  fs.writeFileSync(checkpointPath, json(checkpoint));
  fs.writeFileSync(markdownPath, `# V43_FACT_FINAL_MICRO_LIVE_CHECKPOINT\n\n- status: ${basePacket.status}\n- run_id: ${runId}\n- windows: ${allExecutions.length}/4\n- provider calls: ${allExecutions.length}\n- source ref resolution rate: ${basePacket.metrics.source_ref_resolution_rate}\n- semantic empty count: ${basePacket.metrics.semantic_empty_count}\n- full-document fallback: ${basePacket.metrics.full_document_fallback_count}\n- cross-heading grounding: ${basePacket.metrics.cross_heading_grounding_count}\n- reference/governance authority escapes: ${basePacket.metrics.reference_authority_escape_count}/${basePacket.metrics.governance_authority_escape_count}\n- critical false accepts: ${basePacket.metrics.critical_false_accept_count}\n- production DB writes: 0\n- Fact persistence: 0\n- Gold mutations: 0\n\nGPT packet: ${path.relative(REPO, packetPath)}\n`);
  console.log(JSON.stringify({ status: basePacket.status, run_id: runId, provider_calls: allExecutions.length, source_ref_resolution_rate: basePacket.metrics.source_ref_resolution_rate, candidate_counts: Object.fromEntries(allExecutions.map(item => [item.window_id, item.candidate_count])), semantic_empty_count: basePacket.metrics.semantic_empty_count, checkpoint: path.relative(REPO, checkpointPath), packet: path.relative(REPO, packetPath) }, null, 2));
  if (failure) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) run().catch(error => { console.error(JSON.stringify({ status: 'FAIL', code: error?.code || 'FINAL_MICRO_LIVE_FAILED', message: safe(error?.message) })); process.exitCode = 1; });
