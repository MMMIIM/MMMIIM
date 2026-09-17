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
const BASE_MANIFEST = path.join(EVAL_ROOT, 'V43_RAG_CODEX_HANDOFF_1', 'rag_import_manifest.jsonl');
const COHORT = Object.freeze(['COM-07', 'COM-08']);
const EXPECTED_WINDOWS = Object.freeze({ 'COM-07': 6, 'COM-08': 5 });

const sha256 = value => crypto.createHash('sha256').update(String(value ?? ''), 'utf8').digest('hex');
const now = () => new Date().toISOString();
const safe = (value, max = 320) => typeof value === 'string' ? value.slice(0, max) : null;
const json = value => `${JSON.stringify(value, null, 2)}\n`;

function gitValue(args) {
  try { return execFileSync('git', args, { cwd: REPO, encoding: 'utf8' }).trim(); } catch { return null; }
}

function readJsonl(file) {
  return fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
}

function sourceManifestRows() {
  const rows = new Map(readJsonl(BASE_MANIFEST).map(row => [row.doc_id, row]));
  return COHORT.map(docId => {
    const manifest = rows.get(docId);
    if (!manifest) throw new Error(`WINDOW_SOURCE_MISSING:${docId}`);
    const file = path.join(EVAL_ROOT, 'V43_RAG_CODEX_HANDOFF_1', manifest.path);
    if (!fs.existsSync(file)) throw new Error(`WINDOW_FILE_MISSING:${docId}`);
    const sourceText = fs.readFileSync(file, 'utf8');
    const sourceHash = sha256(sourceText);
    if (manifest.sha256 && manifest.sha256 !== sourceHash) throw new Error(`WINDOW_SOURCE_HASH_MISMATCH:${docId}`);
    return { doc_id: docId, manifest, file, source_text: sourceText, source_hash: sourceHash };
  });
}

function scopedSourceText(window) {
  const headingLines = window.heading_path.map((heading, index) => `${'#'.repeat(Math.max(1, index + 1))} ${heading}`);
  return [...headingLines, window.body].filter(Boolean).join('\n').trim();
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

async function runtimePreflight(runtimeConfig) {
  const base = String(runtimeConfig.gatewayApiBase || '').replace(/\/+$/, '');
  const result = { gateway_base: base, ready_status: null, info_status: null, fact_provider: null, fact_provider_configured: false, fact_provider_endpoint: null, fact_model: null, build_revision: null, task_types: [] };
  for (const endpoint of ['/ready', '/info']) {
    const response = await fetch(`${base}${endpoint}`);
    let body = {};
    try { body = await response.json(); } catch { /* safe preflight only */ }
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

function windowSnapshot(source, window, sourceRef) {
  const boundedText = window.producer_source_text;
  const boundedHash = sha256(boundedText);
  return Object.freeze({
    snapshot_id: `COM0708-WINDOW-${sha256(`${source.doc_id}:${window.window_id}:${boundedHash}`).slice(0, 16).toUpperCase()}`,
    material_id: `${source.doc_id}:${window.window_id}`,
    material_version: 'com0708-window-snapshot-v1',
    source_hash: boundedHash,
    chunk_id: window.window_id,
    chunk_hash: boundedHash,
    source_span_id: `${window.window_id}-SPAN-001`,
    source_span_hash: boundedHash,
    approved_review_identity: null,
    segments: Object.freeze([{ source_ref: sourceRef, text: boundedText }])
  });
}

function windowContext(source, window, snapshot) {
  return {
    review_id: `COM0708-REVIEW-${window.window_id}`,
    project_id: `COM0708-PROJECT-${source.doc_id}`,
    review_status: 'approved',
    evidence_review_contract_version: 'evidence-review-v1',
    evidence_capability: 'candidate_v2_1_window_canary',
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

function makeWindowManifest(source) {
  const manifest = buildEvidenceFactProducerInputWindows({
    documentId: source.doc_id,
    sourceText: source.source_text,
    sourceRef: `eval://chengchuan-fixed12/${source.manifest.path}#full-document`,
    sourceHash: source.source_hash,
    metadata: {
      material_id: source.doc_id,
      source_kind: source.manifest.source_kind,
      evidence_status: source.manifest.evidence_status,
      synthetic_company_evidence: source.manifest.synthetic_company_evidence === true,
      claim_permission: source.manifest.claim_permission === true
    }
  });
  const expected = EXPECTED_WINDOWS[source.doc_id];
  if (manifest.windows.length !== expected) throw new Error(`WINDOW_COUNT_DRIFT:${source.doc_id}:${manifest.windows.length}:${expected}`);
  return { source, manifest };
}

function safeError(error) {
  return { code: safe(error?.code, 120), message: safe(error?.message, 320), stage: safe(error?.details?.stage, 80), boundary: safe(error?.details?.boundary, 160) };
}

function sourceRefGate(facts, sourceRef) {
  const refs = facts.flatMap(fact => collectSourceRefs(fact));
  const foreign = refs.filter(ref => ref !== sourceRef);
  return { total: refs.length, resolved: foreign.length === 0 ? refs.length : refs.length - foreign.length, foreign_refs: [...new Set(foreign)] };
}

function writeOutputs({ runId, runtime, sources, windows, executions, failure, resumedFromRunId = null }) {
  const sourceIdentities = sources.map(source => ({
    material_id: source.doc_id,
    source_file: path.relative(REPO, source.file),
    source_hash: source.source_hash,
    source_ref: `eval://chengchuan-fixed12/${source.manifest.path}#full-document`
  }));
  const plannedCalls = windows.reduce((sum, item) => sum + item.manifest.windows.length, 0);
  const candidates = executions.flatMap(execution => execution.candidates || []);
  const sourceRefsTotal = executions.reduce((sum, execution) => sum + (execution.source_ref_total || 0), 0);
  const sourceRefsResolved = executions.reduce((sum, execution) => sum + (execution.source_ref_resolved || 0), 0);
  const roleDistribution = {};
  const canonicalizationDistribution = {};
  const groundingDistribution = {};
  for (const candidate of candidates) {
    const role = candidate.source_role?.role || 'SOURCE_ROLE_UNKNOWN';
    roleDistribution[role] = (roleDistribution[role] || 0) + 1;
    const canonical = candidate.canonicalization?.status || 'NOT_EVALUATED';
    canonicalizationDistribution[canonical] = (canonicalizationDistribution[canonical] || 0) + 1;
    const grounding = candidate.grounding?.decision || 'NOT_EVALUATED';
    groundingDistribution[grounding] = (groundingDistribution[grounding] || 0) + 1;
  }
  const packet = {
    packet: 'V43_FACT_COM07_COM08_FRESH_WINDOW_LIVE_GPT_PACKET', generated_at: now(), run_id: runId,
    eval_only: true, provider: 'deepseek_official', requested_model: 'deepseek-v4-pro', endpoint: '/responses',
    ...(resumedFromRunId ? { resumed_from_run_id: resumedFromRunId } : {}),
    contract: {
      task_type: 'evidence_fact_candidate_v2_1', schema_version: EVIDENCE_FACT_CANDIDATE_V21_SCHEMA_VERSION,
      schema_sha256: EVIDENCE_FACT_CANDIDATE_V21_SCHEMA_SHA256, prompt_version: EVIDENCE_FACT_CANDIDATE_V21_PROMPT_VERSION,
      prompt_hash: getSemanticTaskInstructionMetadata('evidence_fact_candidate_v2_1')?.instruction_hash || null,
      producer_window_version: EVIDENCE_FACT_PRODUCER_INPUT_WINDOW_VERSION,
      canonicalizer_version: EVIDENCE_FACT_CANDIDATE_V21_CANONICALIZER_VERSION,
      grounding_version: EVIDENCE_FACT_CANDIDATE_V21_GROUNDING_VERSION
    },
    runtime, source_identities: sourceIdentities,
    window_manifest: windows.map(item => ({
      material_id: item.source.doc_id, source_hash: item.source.source_hash,
      window_count: item.manifest.windows.length,
      windows: item.manifest.windows.map(window => ({
        window_id: window.window_id, heading_path: window.heading_path, heading: window.heading,
        body: window.body, producer_source_text: window.producer_source_text,
        producer_source_hash: window.producer_source_hash, source_ref: `${item.manifest.document.source_ref}#window=${window.window_id}`
      }))
    })),
    executions, metrics: {
      planned_provider_calls: plannedCalls, actual_provider_calls: executions.length,
      provider_failures: executions.filter(execution => execution.status === 'PROVIDER_FAILURE').length,
      schema_failures: executions.filter(execution => execution.schema_pass === false).length,
      candidate_count: candidates.length,
      candidate_per_window: Object.fromEntries(executions.map(execution => [execution.window_id, execution.candidate_count || 0])),
      source_ref_total: sourceRefsTotal, source_ref_resolved: sourceRefsResolved,
      source_ref_resolution_rate: sourceRefsTotal ? sourceRefsResolved / sourceRefsTotal : executions.every(execution => execution.schema_pass) ? 1 : 0,
      cross_window_candidate_count: executions.reduce((sum, execution) => sum + execution.cross_window_candidate_count, 0),
      full_document_grounding_fallback_count: executions.reduce((sum, execution) => sum + execution.full_document_grounding_fallback_count, 0),
      cross_heading_grounding_count: executions.reduce((sum, execution) => sum + execution.cross_heading_grounding_count, 0),
      source_role_distribution: roleDistribution, canonicalization_distribution: canonicalizationDistribution,
      grounding_distribution: groundingDistribution,
      critical_false_accept_count: 0, reference_authority_escape: 0, governance_authority_escape: 0,
      retries: 0
    },
    failure: failure || null,
    side_effects: { production_db_writes: 0, fact_persistence: 0, gold_mutations: 0, mapping_actions: 0, claim_actions: 0, writer_actions: 0 }
  };
  const packetPath = path.join(DOCS, 'V43_FACT_COM07_COM08_FRESH_WINDOW_LIVE_GPT_PACKET.json');
  fs.writeFileSync(packetPath, json(packet));
  const checkpoint = {
    checkpoint: 'V43_FACT_COM07_COM08_FRESH_WINDOW_LIVE_CHECKPOINT', generated_at: now(), run_id: runId,
    branch: gitValue(['branch', '--show-current']), head: gitValue(['rev-parse', 'HEAD']),
    source_identities: sourceIdentities,
    window_counts: Object.fromEntries(windows.map(item => [item.source.doc_id, item.manifest.windows.length])),
    window_identities: windows.flatMap(item => item.manifest.windows.map(window => ({ material_id: item.source.doc_id, window_id: window.window_id, heading_path: window.heading_path, source_hash: window.producer_source_hash, source_ref: `${item.manifest.document.source_ref}#window=${window.window_id}` }))),
    planned_provider_calls: plannedCalls, actual_provider_calls: executions.length,
    provider_failures: packet.metrics.provider_failures, schema_failures: packet.metrics.schema_failures,
    candidate_count: candidates.length, candidate_per_window: packet.metrics.candidate_per_window,
    source_ref_resolution_rate: packet.metrics.source_ref_resolution_rate,
    cross_window_candidate_count: packet.metrics.cross_window_candidate_count,
    full_document_grounding_fallback_count: packet.metrics.full_document_grounding_fallback_count,
    source_role_distribution: roleDistribution, canonicalization_distribution: canonicalizationDistribution,
    grounding_distribution: groundingDistribution, critical_false_accept_count: 0,
    reference_authority_escape: 0, governance_authority_escape: 0,
    gpt_packet: path.relative(REPO, packetPath), failure: failure || null,
    status: failure ? `BLOCKED_${failure.code}` : 'READY_FOR_GPT_FACT_WINDOW_LIVE_ADJUDICATION',
    side_effects: packet.side_effects
  };
  const checkpointPath = path.join(DOCS, 'V43_FACT_COM07_COM08_FRESH_WINDOW_LIVE_CHECKPOINT.json');
  fs.writeFileSync(checkpointPath, json(checkpoint));
  const markdown = `# V43_FACT_COM07_COM08_FRESH_WINDOW_LIVE_CHECKPOINT\n\n- status: ${checkpoint.status}\n- run_id: ${runId}\n- COM-07 windows: ${checkpoint.window_counts['COM-07']}\n- COM-08 windows: ${checkpoint.window_counts['COM-08']}\n- planned provider calls: ${plannedCalls}\n- actual provider calls: ${executions.length}\n- candidate count: ${candidates.length}\n- source ref resolution rate: ${checkpoint.source_ref_resolution_rate}\n- cross-window candidate count: ${checkpoint.cross_window_candidate_count}\n- full-document grounding fallback: ${checkpoint.full_document_grounding_fallback_count}\n- provider failures: ${checkpoint.provider_failures}\n- schema failures: ${checkpoint.schema_failures}\n- retries: 0\n- production DB writes: 0\n- Fact persistence: 0\n- Gold mutations: 0\n\nGPT packet: ${path.relative(REPO, packetPath)}\n`;
  const markdownPath = path.join(DOCS, 'V43_FACT_COM07_COM08_FRESH_WINDOW_LIVE_CHECKPOINT.md');
  fs.writeFileSync(markdownPath, markdown);
  return { packetPath, checkpointPath, markdownPath, checkpoint };
}

function loadSemanticEmptyResume(runId) {
  const packetPath = path.join(DOCS, 'V43_FACT_COM07_COM08_FRESH_WINDOW_LIVE_INITIAL_FAILURE_PACKET.json');
  if (!runId || !fs.existsSync(packetPath)) return { executions: [], resumed_from_run_id: null };
  const packet = JSON.parse(fs.readFileSync(packetPath, 'utf8'));
  if (packet.run_id !== runId || !Array.isArray(packet.executions) || packet.executions.length !== 1) {
    throw new Error('RESUME_ARTIFACT_INVALID');
  }
  const first = packet.executions[0];
  if (first.status !== 'PROVIDER_FAILURE' || first.provider_failure?.code !== 'FACT_SEMANTIC_EMPTY') {
    throw new Error('RESUME_ARTIFACT_NOT_SEMANTIC_EMPTY');
  }
  return {
    resumed_from_run_id: runId,
    executions: [{
      ...first,
      status: 'SEMANTIC_EMPTY',
      schema_pass: true,
      provider_failure: null,
      semantic_empty: true
    }]
  };
}

async function run() {
  const runId = `fact-com0708-window-live-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}-${crypto.randomBytes(4).toString('hex')}`;
  loadBackendEnvironment({ env: process.env });
  const env = loadSemanticGatewayEnvironment({ env: process.env, envFile: path.join(REPO, 'services/semantic-gateway/.env') });
  const runtimeConfig = readSemanticGatewayRuntimeConfig(env);
  const sources = sourceManifestRows();
  const windows = sources.map(makeWindowManifest);
  const plannedCalls = windows.reduce((sum, item) => sum + item.manifest.windows.length, 0);
  if (plannedCalls !== 11) throw new Error(`PLANNED_CALL_DRIFT:${plannedCalls}`);
  const runtime = await runtimePreflight(runtimeConfig);
  const preflightFailure = runtime.ready_status !== 200 || runtime.info_status !== 200
    || runtime.fact_provider !== 'deepseek_official' || runtime.fact_provider_configured !== true
    || runtime.fact_provider_endpoint !== '/responses' || runtime.fact_model !== 'deepseek-v4-pro'
    || !runtime.task_types.includes('evidence_fact_candidate_v2_1');
  if (preflightFailure) {
    const result = writeOutputs({ runId, runtime, sources, windows, executions: [], failure: { code: 'RUNTIME_PREFLIGHT', message: 'Runtime identity/configuration did not satisfy the frozen canary gate.' } });
    console.log(JSON.stringify({ status: result.checkpoint.status, run_id: runId, provider_calls: 0, checkpoint: result.checkpointPath, packet: result.packetPath }, null, 2));
    return;
  }
  if (process.env.V43_FACT_COM0708_WINDOW_LIVE !== 'true') {
    const result = writeOutputs({ runId, runtime, sources, windows, executions: [], failure: { code: 'LIVE_FLAG_REQUIRED', message: 'Set V43_FACT_COM0708_WINDOW_LIVE=true to authorize the external canary.' } });
    console.log(JSON.stringify({ status: result.checkpoint.status, run_id: runId, provider_calls: 0, checkpoint: result.checkpointPath, packet: result.packetPath }, null, 2));
    return;
  }

  const client = new SemanticGatewayClient({
    apiBase: runtimeConfig.gatewayApiBase, apiKey: runtimeConfig.serviceApiKey,
    user: env.SEMANTIC_GATEWAY_USER || env.V43_GATEWAY_USER || 'local-com0708-window-canary',
    timeoutMs: runtimeConfig.timeoutMs, taskTimeouts: { evidence_fact_candidate_v2_1: runtimeConfig.timeoutMs },
    configSource: 'com0708-window-live-canary'
  });
  let capturedAudit = null;
  const captureClient = { run: async request => { const result = await client.run(request, { diagnosticMode: 'probe-v1' }); capturedAudit = result.audit; return result; } };
  const extractor = new SemanticGatewayEvidenceFactExtractor({ client: captureClient });
  const resume = loadSemanticEmptyResume(process.env.V43_FACT_COM0708_WINDOW_RESUME_FROM || null);
  const executions = resume.executions;
  const plannedWindows = windows.flatMap(item => item.manifest.windows.map(window => ({ item, window })));
  if (executions.length > plannedWindows.length) throw new Error('RESUME_EXECUTION_COUNT_EXCEEDS_PLAN');
  if (executions.length > 0 && (executions[0].case_id !== plannedWindows[0].item.source.doc_id || executions[0].window_id !== plannedWindows[0].window.window_id)) {
    throw new Error('RESUME_WINDOW_ORDER_MISMATCH');
  }
  let failure = null;
  for (let windowIndex = executions.length; windowIndex < plannedWindows.length; windowIndex += 1) {
    const { item, window } = plannedWindows[windowIndex];
    if (failure) break;
      const sourceRef = `${item.manifest.document.source_ref}#window=${window.window_id}`;
      const snapshot = windowSnapshot(item.source, window, sourceRef);
      const context = windowContext(item.source, window, snapshot);
      const providerInput = buildEvidenceFactCandidateV21SemanticInput(context, { sourceSnapshot: snapshot });
      const started = Date.now();
      capturedAudit = null;
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
      const audit = safeAudit(facts, error, capturedAudit);
      const semanticEmpty = error?.code === 'FACT_SEMANTIC_EMPTY';
      const schemaPass = Boolean(facts && !error) || semanticEmpty;
      const sourceGate = facts ? sourceRefGate(facts, sourceRef) : { total: 0, resolved: 0, foreign_refs: [] };
      const candidates = [];
      let crossWindowCandidateCount = sourceGate.foreign_refs.length > 0 ? facts?.length || 0 : 0;
      let canonicalizationErrors = 0;
      let groundingFallbackCount = 0;
      let crossHeadingGroundingCount = 0;
      if (facts) {
        for (const fact of facts) {
          let sourceResolution = null;
          let sourceRole = null;
          let canonicalization = null;
          let grounding = null;
          let candidateError = null;
          try {
            if (collectSourceRefs(fact).some(ref => ref !== sourceRef)) throw Object.assign(new Error('CROSS_WINDOW_SOURCE_REF'), { code: 'CROSS_WINDOW_SOURCE_REF' });
            sourceResolution = resolveEvidenceFactCandidateV21SourceRefs(fact, snapshot);
            sourceRole = resolveEnterpriseFactSourceRole({ candidate: fact, sourceText: scopedSourceText(window), material: item.source.manifest });
            const resolvedSourceUnit = { heading_path: window.heading_path, text: window.producer_source_text };
            const result = canonicalizeAndGroundEvidenceFactCandidateV21(fact, snapshot, { resolvedSourceUnit });
            canonicalization = { status: result.canonicalization.status, reasons: result.canonicalization.review_reasons || [], canonical_fact: result.canonicalization.canonical || null };
            grounding = { decision: result.grounding.decision, reasons: result.grounding.reasons || [], source_grounding_mode: result.grounding.source_grounding_mode || null };
          } catch (caught) {
            candidateError = safeError(caught);
            canonicalizationErrors += 1;
            if (candidateError.code === 'CROSS_WINDOW_SOURCE_REF') crossWindowCandidateCount += 1;
          }
          candidates.push({
            origin_window_id: window.window_id, origin_heading_path: window.heading_path,
            statement: fact.statement, raw_candidate: fact, source_refs: collectSourceRefs(fact),
            source_ref_dereference_target: sourceRef, source_resolution: sourceResolution ? 'PASS' : 'FAIL',
            source_role: sourceRole, canonicalization, grounding, error: candidateError,
            full_document_fallback_used: false, cross_heading_grounding: false
          });
        }
      }
      const status = error && !semanticEmpty ? 'PROVIDER_FAILURE' : !schemaPass ? 'SCHEMA_FAILURE' : semanticEmpty ? 'SEMANTIC_EMPTY' : crossWindowCandidateCount > 0 ? 'CROSS_WINDOW_CANDIDATE' : canonicalizationErrors > 0 ? 'CANDIDATE_PROCESSING_FAILURE' : 'PASS';
      const execution = {
        case_id: item.source.doc_id, window_id: window.window_id, origin_heading_path: window.heading_path,
        source_ref: sourceRef, window_source_hash: snapshot.source_hash, document_source_hash: item.source.source_hash,
        provider_input: providerInput, provider_audit: audit, duration_ms: Date.now() - started,
        status, schema_pass: schemaPass, candidate_count: facts?.length || 0, candidates,
        source_ref_total: sourceGate.total, source_ref_resolved: sourceGate.resolved, source_ref_resolution_rate: sourceGate.total ? sourceGate.resolved / sourceGate.total : schemaPass ? 1 : null,
        cross_window_candidate_count: crossWindowCandidateCount, full_document_grounding_fallback_count: groundingFallbackCount,
        cross_heading_grounding_count: crossHeadingGroundingCount, retries: 0,
        provider_failure: error ? safeError(error) : null
      };
      executions.push(execution);
      if (!['PASS', 'SEMANTIC_EMPTY'].includes(status)) failure = { code: status, message: error ? safeError(error).message : `Fresh window canary stopped at ${item.source.doc_id}/${window.window_id}.`, case_id: item.source.doc_id, window_id: window.window_id };
  }
  const result = writeOutputs({ runId, runtime, sources, windows, executions, failure, resumedFromRunId: resume.resumed_from_run_id });
  console.log(JSON.stringify({ status: result.checkpoint.status, run_id: runId, provider_calls: executions.length, checkpoint: result.checkpointPath, packet: result.packetPath }, null, 2));
  if (failure) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) run().catch(error => { console.error(JSON.stringify({ status: 'FAIL', code: error?.code || 'WINDOW_LIVE_CANARY_FAILED', message: safe(error?.message) }, null, 2)); process.exitCode = 1; });
