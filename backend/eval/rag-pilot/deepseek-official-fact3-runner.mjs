/** Human-host-only Fact semantic runner. Requires a passing connectivity gate. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadBackendEnvironment } from '../../src/backend-runtime.js';
import { createSemanticGatewayClientFromEnv } from '../../src/pipeline/semantic-gateway-client.js';
import { SemanticGatewayEvidenceFactExtractor, FACT_PROVIDER_AUDIT } from '../../src/pipeline/semantic-gateway-evidence-fact-extractor.js';
import { loadSemanticGatewayEnvironment, readSemanticGatewayRuntimeConfig } from '../../../packages/semantic-contracts/runtime-config.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../../..');
const CASES = Object.freeze([
  Object.freeze({ case_id: 'COM-01', file: 'V43_RAG_CODEX_HANDOFF_1/03_company_case_rag/COM-01_公司概况与业务范围.md' }),
  Object.freeze({ case_id: 'COM-06', file: 'V43_RAG_CODEX_HANDOFF_1/03_company_case_rag/COM-06_权限_安全与审计测试报告.md' }),
  Object.freeze({ case_id: 'CCV2-U13-01', file: 'V43_CHENGCHUAN_ENTERPRISE_CORPUS_V2_EXTENSION/materials/CCV2-U13-01_性能与响应_PERFORMANCE_TEST.md' })
]);
const sha256 = value => crypto.createHash('sha256').update(String(value ?? ''), 'utf8').digest('hex');
const now = () => new Date().toISOString();
const safe = (value, max = 240) => typeof value === 'string' ? value.slice(0, max) : null;

function loadEnv() {
  loadBackendEnvironment({ env: process.env });
  return loadSemanticGatewayEnvironment({ env: process.env, envFile: path.join(REPO, 'services/semantic-gateway/.env') });
}

function latestConnectivityPassed() {
  const root = path.join(REPO, 'backend/eval/rag-pilot/results');
  if (!fs.existsSync(root)) return null;
  const entries = fs.readdirSync(root).filter(name => name.startsWith('deepseek-official-connectivity-')).sort().reverse();
  for (const entry of entries) {
    const file = path.join(root, entry, 'checkpoint.json');
    try { const checkpoint = JSON.parse(fs.readFileSync(file, 'utf8')); if (checkpoint?.provider === 'deepseek_official' && checkpoint?.json_parse === 'PASS' && checkpoint?.strict_schema === 'PASS') return file; } catch {}
  }
  return null;
}

function safeAudit(value = {}) {
  const d = value && typeof value === 'object' ? value : {};
  return { provider_http_status: Number.isInteger(d.provider_http_status) ? d.provider_http_status : null,
    provider_http_reached: d.provider_http_reached === true, gateway_http_status: Number.isInteger(d.gateway_http_status) ? d.gateway_http_status : null,
    gateway_error_code: safe(d.gateway_error_code, 120), semantic_error_code: safe(d.semantic_error_code, 120), finish_reason: safe(d.finish_reason, 40),
    normalizer_invoked: d.fact_normalization_diagnostic?.normalizer_invoked === true,
    projection_invoked: d.fact_normalization_diagnostic?.projection_invoked === true,
    unexpected_property_names: Array.isArray(d.fact_normalization_diagnostic?.unexpected_property_names) ? d.fact_normalization_diagnostic.unexpected_property_names.slice(0, 30) : [],
    exact_validation_path: safe(d.fact_normalization_diagnostic?.exact_validation_path, 240),
    response_format_type: safe(d.response_format_type, 40), schema_validation_errors: Array.isArray(d.schema_validation_errors) ? d.schema_validation_errors.slice(0, 10) : [] };
}

async function getJson(url) {
  try { const response = await fetch(url); let body = null; try { body = await response.json(); } catch {} return { status: response.status, ok: response.ok, body }; }
  catch (error) { return { status: null, ok: false, error_code: error?.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK_ERROR' }; }
}

async function currentRuntimePreflight(config) {
  const base = String(config.gatewayApiBase || '').replace(/\/+$/, '');
  const [ready, info] = await Promise.all([getJson(`${base}/ready`), getJson(`${base}/info`)]);
  const observed = {
    ready_status: ready.status, info_status: info.status,
    fact_provider: info.body?.fact_provider || null,
    fact_provider_configured: info.body?.fact_provider_configured === true,
    fact_provider_endpoint: info.body?.fact_provider_endpoint || null,
    fact_model: info.body?.fact_model || null,
    build_revision: safe(info.body?.build_revision, 160)
  };
  return { ok: ready.ok && info.ok && observed.fact_provider === 'deepseek_official'
    && observed.fact_provider_configured === true && observed.fact_provider_endpoint === '/responses'
    && observed.fact_model === 'deepseek-v4-pro', observed };
}

export async function runDeepSeekOfficialFact3({ env = loadEnv(), allowLive = env.V43_FACT3_LIVE === 'true' } = {}) {
  const connectivityCheckpoint = latestConnectivityPassed();
  if (!connectivityCheckpoint) return { status: 'BLOCKED_CONNECTIVITY_GATE_REQUIRED', provider_calls: 0 };
  if (!allowLive) return { status: 'BLOCKED_HOST_ONLY', provider_calls: 0, reason: 'Set V43_FACT3_LIVE=true on the Human host.' };
  const config = readSemanticGatewayRuntimeConfig(env);
  const runtimePreflight = await currentRuntimePreflight(config);
  if (!runtimePreflight.ok) return { status: 'BLOCKED_RUNTIME_PREFLIGHT', provider_calls: 0, preflight: runtimePreflight.observed };
  const client = createSemanticGatewayClientFromEnv({ env, taskType: 'evidence_fact_extraction' });
  const extractor = new SemanticGatewayEvidenceFactExtractor({ client });
  const outputDir = path.join(REPO, 'backend/eval/rag-pilot/results', `deepseek-official-fact3-${Date.now()}`);
  fs.mkdirSync(outputDir, { recursive: true });
  const rows = []; let calls = 0; let retries = 0;
  for (const item of CASES) {
    const sourcePath = path.join(REPO, 'backend/eval/rag-pilot', item.file);
    const sourceText = fs.readFileSync(sourcePath, 'utf8');
    const sourceHash = sha256(sourceText);
    const context = {
      review_id: `EVAL-FACT3-REVIEW-${item.case_id}`, project_id: `EVAL-FACT3-PROJECT-${item.case_id}`, review_status: 'approved',
      evidence_review_contract_version: 'evidence-review-v1', source_span_id: `EVAL-FACT3-SPAN-${item.case_id}`,
      source_text: sourceText, source_text_hash: sourceHash, current_source_text_hash: sourceHash,
      material_id: `EVAL-FACT3-MATERIAL-${item.case_id}`, anchor_chunk_id: `EVAL-FACT3-CHUNK-${item.case_id}`, material_type: 'project_case'
    };
    let result = null; let error = null; const started = Date.now(); let caseAttempts = 0;
    for (let attempt = 0; attempt < 2 && calls < 4; attempt += 1) {
      calls += 1;
      caseAttempts += 1;
      try { result = await extractor.extract(context); error = null; break; }
      catch (caught) { error = caught; const code = String(caught?.code || ''); const transient = /TIMEOUT|NETWORK|PROVIDER_HTTP_FAILURE/.test(code); if (!transient || attempt >= 1 || calls >= 4) break; retries += 1; }
    }
    const audit = safeAudit(result?.[FACT_PROVIDER_AUDIT] || error?.details?.provider_audit || {});
    rows.push({ case_id: item.case_id, source_file: item.file, source_sha256: sourceHash, source_length: sourceText.length,
      request_hash: sha256(`${item.case_id}|${sourceHash}`), provider: 'deepseek_official', model: runtimePreflight.observed.fact_model,
      status: result ? 'PASS' : 'FAIL', fact_count: result?.length || 0, facts: result || [], attempts: caseAttempts,
      duration_ms: Date.now() - started, error_code: error?.code || null, audit });
    if (error && !/TIMEOUT|NETWORK|PROVIDER_HTTP_FAILURE/.test(String(error.code || ''))) break;
  }
  const checkpoint = { checkpoint: 'V43_DEEPSEEK_OFFICIAL_FACT3_CHECKPOINT', generated_at: now(), connectivity_checkpoint: connectivityCheckpoint,
    provider: 'deepseek_official', model: runtimePreflight.observed.fact_model, endpoint: '/responses', thinking: 'OFF',
    runtime_preflight: runtimePreflight.observed,
    provider_calls: calls, retry_count: retries, cases: rows, production_db_writes: 0, fact_persistence: 0, gold_mutations: 0,
    mapping_actions: 0, claim_actions: 0, writer_actions: 0 };
  fs.writeFileSync(path.join(outputDir, 'checkpoint.json'), `${JSON.stringify(checkpoint, null, 2)}\n`);
  return { status: rows.every(row => row.status === 'PASS') ? 'PASS' : 'FAIL', output_dir: outputDir, checkpoint };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  runDeepSeekOfficialFact3().then(result => { console.log(JSON.stringify({ status: result.status, provider_calls: result.provider_calls || result.checkpoint?.provider_calls || 0, output_dir: result.output_dir || null })); if (result.status !== 'PASS') process.exitCode = 1; }).catch(error => { console.error(JSON.stringify({ status: 'FAIL', code: error?.code || 'FACT3_RUNNER_FAILED' })); process.exitCode = 1; });
}
