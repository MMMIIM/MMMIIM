/**
 * Human-host-only, one-call DeepSeek Official Fact connectivity probe.
 * The requested `{result:"PASS"}` probe shape is not a registered Gateway
 * task, so this runner intentionally uses the existing frozen Fact task
 * contract rather than inventing a parallel schema or bypassing the Gateway.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadBackendEnvironment } from '../../src/backend-runtime.js';
import { createSemanticGatewayClientFromEnv } from '../../src/pipeline/semantic-gateway-client.js';
import { buildEvidenceFactSemanticInput, EVIDENCE_FACT_EXTRACTION_TASK_TYPE } from '../../src/pipeline/semantic-gateway-evidence-fact-extractor.js';
import { getSemanticTaskInstructionMetadata } from '../../../packages/semantic-contracts/index.js';
import { loadSemanticGatewayEnvironment, readSemanticGatewayRuntimeConfig } from '../../../packages/semantic-contracts/runtime-config.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../../..');
const sha256 = value => crypto.createHash('sha256').update(String(value ?? ''), 'utf8').digest('hex');
const now = () => new Date().toISOString();
const safe = (value, max = 240) => typeof value === 'string' ? value.slice(0, max) : null;

function safeDiagnostics(value = {}) {
  const d = value && typeof value === 'object' ? value : {};
  return {
    gateway_http_status: Number.isInteger(d.gateway_http_status) ? d.gateway_http_status : null,
    provider_http_status: Number.isInteger(d.provider_http_status) ? d.provider_http_status : null,
    provider_http_reached: d.provider_http_reached === true,
    gateway_error_code: safe(d.gateway_error_code, 120), provider_error_code: safe(d.provider_error_code, 120),
    finish_reason: safe(d.finish_reason, 40), json_parse_success: typeof d.json_parse_success === 'boolean' ? d.json_parse_success : null,
    response_format_type: safe(d.response_format_type, 40), instruction_sha256: safe(d.instruction_sha256, 64),
    schema_validation_errors: Array.isArray(d.schema_validation_errors) ? d.schema_validation_errors.slice(0, 10).map(item => ({
      path: safe(item?.path, 200), keyword: safe(item?.keyword, 80), expected: safe(item?.expected, 240)
    })) : []
  };
}

async function getJson(url) {
  const started = Date.now();
  try { const response = await fetch(url); let body = null; try { body = await response.json(); } catch {} return { status: response.status, ok: response.ok, latency_ms: Date.now() - started, body }; }
  catch (error) { return { status: null, ok: false, latency_ms: Date.now() - started, error_code: error?.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK_ERROR' }; }
}

function runtimeEnv() {
  loadBackendEnvironment({ env: process.env });
  return loadSemanticGatewayEnvironment({ env: process.env, envFile: path.join(REPO, 'services/semantic-gateway/.env') });
}

export async function runDeepSeekOfficialConnectivity({ env = runtimeEnv(), allowLive = env.V43_FACT_CONNECTIVITY_LIVE === 'true' } = {}) {
  if (!allowLive) return { status: 'BLOCKED_HOST_ONLY', provider_calls: 0, reason: 'Set V43_FACT_CONNECTIVITY_LIVE=true on the Human host.' };
  const config = readSemanticGatewayRuntimeConfig(env);
  const base = String(config.gatewayApiBase || '').replace(/\/+$/, '');
  const [ready, info] = await Promise.all([getJson(`${base}/ready`), getJson(`${base}/info`)]);
  // The model identity must be observed from the running Gateway, not inferred
  // from a local env file that may belong to a different execution topology.
  const runtimeModel = info.body?.fact_model || null;
  const preflight = {
    ready_status: ready.status, info_status: info.status,
    fact_provider: info.body?.fact_provider || null,
    fact_provider_configured: info.body?.fact_provider_configured === true,
    fact_provider_endpoint: info.body?.fact_provider_endpoint || null,
    fact_model: runtimeModel,
    deepseek_key_present: Boolean(config.deepseekOfficialApiKey),
    build_revision: safe(info.body?.build_revision, 160)
  };
  if (!ready.ok || !info.ok || preflight.fact_provider !== 'deepseek_official'
    || preflight.fact_provider_configured !== true || preflight.fact_provider_endpoint !== '/responses'
    || runtimeModel !== 'deepseek-v4-pro') {
    return { status: 'BLOCKED_RUNTIME_PREFLIGHT', provider_calls: 0, preflight };
  }
  const sourceText = '受控连通性探针：该演示材料用于验证冻结 Fact structured-output 通道。';
  const sourceHash = sha256(sourceText);
  const context = {
    review_id: 'EVAL-CONNECTIVITY-REVIEW', project_id: 'EVAL-CONNECTIVITY-PROJECT', review_status: 'approved',
    evidence_review_contract_version: 'evidence-review-v1', source_span_id: 'EVAL-CONNECTIVITY-SPAN',
    source_text: sourceText, source_text_hash: sourceHash, current_source_text_hash: sourceHash,
    material_id: 'EVAL-CONNECTIVITY-MATERIAL', anchor_chunk_id: 'EVAL-CONNECTIVITY-CHUNK', material_type: 'company_profile'
  };
  const payload = buildEvidenceFactSemanticInput(context);
  const instruction = getSemanticTaskInstructionMetadata(EVIDENCE_FACT_EXTRACTION_TASK_TYPE)?.instruction;
  const requestHash = sha256(JSON.stringify({ task_type: EVIDENCE_FACT_EXTRACTION_TASK_TYPE, payload }));
  const started = Date.now();
  let result = null; let error = null;
  try {
    const client = createSemanticGatewayClientFromEnv({ env, taskType: EVIDENCE_FACT_EXTRACTION_TASK_TYPE });
    result = await client.run({ task_type: EVIDENCE_FACT_EXTRACTION_TASK_TYPE, task_instruction: instruction, task_payload_json: JSON.stringify(payload) }, { diagnosticMode: 'probe-v1' });
  } catch (caught) { error = caught; }
  const diagnostics = safeDiagnostics(result?.audit?.probe_diagnostics || error?.audit?.probe_diagnostics || {});
  const checkpoint = {
    checkpoint: 'V43_DEEPSEEK_OFFICIAL_CONNECTIVITY_CHECKPOINT', generated_at: now(), provider: 'deepseek_official', model: runtimeModel,
    endpoint: '/responses', thinking: 'OFF', request_hash: requestHash, provider_calls: 1,
    requested_probe_schema: 'result/PASS (not a registered semantic task)',
    effective_gateway_contract: EVIDENCE_FACT_EXTRACTION_TASK_TYPE,
    provider_http_status: diagnostics.provider_http_status, provider_http_reached: diagnostics.provider_http_reached,
    gateway_http_status: diagnostics.gateway_http_status, response_format_type: diagnostics.response_format_type,
    json_parse: result ? 'PASS' : 'FAIL', strict_schema: result?.envelope?.data?.facts && Array.isArray(result.envelope.data.facts) ? 'PASS' : 'FAIL',
    finish_reason: diagnostics.finish_reason, latency_ms: Date.now() - started, error_code: error?.code || null,
    preflight, production_db_writes: 0, fact_persistence: 0, gold_mutations: 0, mapping_actions: 0, claim_actions: 0, writer_actions: 0
  };
  const outputDir = path.join(REPO, 'backend/eval/rag-pilot/results', `deepseek-official-connectivity-${Date.now()}`);
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, 'checkpoint.json'), `${JSON.stringify(checkpoint, null, 2)}\n`);
  return { status: checkpoint.json_parse === 'PASS' && checkpoint.strict_schema === 'PASS' ? 'PASS' : 'FAIL', output_dir: outputDir, checkpoint };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  runDeepSeekOfficialConnectivity().then(result => { console.log(JSON.stringify({ status: result.status, provider_calls: result.provider_calls || result.checkpoint?.provider_calls || 0, output_dir: result.output_dir || null })); if (result.status !== 'PASS') process.exitCode = 1; }).catch(error => { console.error(JSON.stringify({ status: 'FAIL', code: error?.code || 'CONNECTIVITY_PROBE_FAILED' })); process.exitCode = 1; });
}
