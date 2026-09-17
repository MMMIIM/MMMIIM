import { config as loadDotenv } from 'dotenv';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  SemanticGatewayEvidenceFactExtractor,
  FACT_PROVIDER_AUDIT
} from '../../src/pipeline/semantic-gateway-evidence-fact-extractor.js';
import { createSemanticGatewayClientFromEnv } from '../../src/pipeline/semantic-gateway-client.js';
import {
  FactCanaryTelemetryLedger,
  executeFactCanaryCase,
  factCanaryRequestHash
} from './fact-canary-durable-runner.js';

const CASE_ID = 'COM-01';
const TASK_TYPE = 'evidence_fact_extraction';
const SOURCE_FILE = resolve('backend/eval/rag-pilot/V43_RAG_CODEX_HANDOFF_1/03_company_case_rag/COM-01_公司概况与业务范围.md');
const OUTPUT_DIR = resolve(process.env.FACT_CANARY_OUTPUT_DIR || 'backend/eval/rag-pilot/results/fact-post-normalization-canary-20260907-v2');
const sha256 = value => createHash('sha256').update(String(value ?? ''), 'utf8').digest('hex');
const now = () => new Date().toISOString();

function safeText(value, max = 240) { return typeof value === 'string' ? value.slice(0, max) : null; }
function safeInt(value) { return Number.isInteger(value) ? value : null; }

function safeProbe(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const firstError = Array.isArray(value.schema_validation_errors) ? value.schema_validation_errors[0] : null;
  return {
    gateway_http_status: safeInt(value.gateway_http_status),
    provider_http_status: safeInt(value.provider_http_status),
    provider_http_reached: value.provider_http_reached === true,
    gateway_error_code: safeText(value.gateway_error_code, 120),
    semantic_error_code: safeText(value.semantic_error_code, 120),
    normalization_count: safeInt(value.empty_domain_namespace_normalized_count),
    json_parse: typeof value.json_parse_success === 'boolean' ? value.json_parse_success : null,
    validation_path: safeText(firstError?.path, 240),
    validation_stage: safeText(firstError?.stage, 80),
    expected_shape: safeText(firstError?.expected, 240),
    actual_type: safeText(firstError?.actual_type || firstError?.observed_category, 80),
    schema_valid: Array.isArray(value.schema_validation_errors) ? value.schema_validation_errors.length === 0 : null,
    response_format_type: safeText(value.response_format_type, 40),
    finish_reason: safeText(value.finish_reason, 40),
    retry_count: safeInt(value.retry_attempt)
  };
}

function inspectResponseBody(bodyText) {
  const output = { json_parse: false, response_shape: 'unparseable', fact_count: null, validation: null, probe: null, gateway_error_code: null };
  let outer;
  try { outer = JSON.parse(bodyText); output.json_parse = true; } catch { return output; }
  output.gateway_error_code = safeText(outer?.error_code, 120);
  output.probe = safeProbe(outer?.probe_diagnostics);
  output.validation = output.probe;
  try {
    const payload = outer?.data?.outputs?.response_payload_json;
    const inner = typeof payload === 'string' ? JSON.parse(payload) : payload;
    const facts = inner?.data?.facts;
    output.fact_count = Array.isArray(facts) ? facts.length : null;
    output.response_shape = output.fact_count === null ? 'wrong_shape' : 'semantic_envelope';
  } catch { /* safe shape remains wrong_shape */ }
  return output;
}

function classification({ normalizerObserved, diagnostics }) {
  if (normalizerObserved === false) return 'NORMALIZER_NOT_REACHED';
  // The prior canary failed at the nested empty-namespace shape.  A current
  // failure at the enclosing fact object with an "additional properties"
  // expectation is a newly exposed strict-schema violation, not evidence to
  // rewrite the contract or call another Provider trial.
  if (diagnostics?.validation_path === 'data.facts[0]'
    && /additional properties/i.test(String(diagnostics?.expected_shape || ''))) {
    return 'SECOND_SCHEMA_VIOLATION_REVEALED';
  }
  if (diagnostics?.validation_path && diagnostics?.normalization_count == null) return 'SAFE_TELEMETRY_INSUFFICIENT';
  return null;
}

async function main() {
  loadDotenv({ path: resolve('backend/.env'), override: false });
  await mkdir(OUTPUT_DIR, { recursive: true });
  const sourceText = await readFile(SOURCE_FILE, 'utf8');
  const sourceHash = sha256(sourceText);
  const ledgerPath = join(OUTPUT_DIR, 'provider_call_ledger.jsonl');
  const ledger = new FactCanaryTelemetryLedger({ file_path: ledgerPath, run_id: `fact-post-normalization-${Date.now()}`, case_ids: [CASE_ID], call_cap: 2 });
  await ledger.load();
  const captures = [];
  let callIndex = 0;
  const fetchImpl = async (url, options = {}) => {
    callIndex += 1;
    if (callIndex > 2) throw Object.assign(new Error('FACT_CANARY_CALL_CAP_REACHED'), { code: 'FACT_CANARY_CALL_CAP_REACHED' });
    const started = Date.now();
    const requestHash = factCanaryRequestHash(options.body || '');
    const response = await fetch(url, options);
    const bodyText = await response.clone().text().catch(() => '');
    const inspected = inspectResponseBody(bodyText);
    captures.push({
      call_index: callIndex,
      request_hash: requestHash,
      gateway_http_status: response.status,
      provider_http_status: inspected.probe?.provider_http_status ?? null,
      provider_http_reached: inspected.probe?.provider_http_reached === true,
      gateway_error_code: inspected.gateway_error_code,
      provider_status: response.ok ? 'HTTP_SUCCESS' : 'HTTP_ERROR',
      validation_path: inspected.validation?.validation_path,
      validation_stage: inspected.validation?.validation_stage,
      expected_shape: inspected.validation?.expected_shape,
      actual_type: inspected.validation?.actual_type,
      normalization_count: inspected.probe?.normalization_count ?? null,
      normalizer_invoked: inspected.probe?.normalization_count > 0 ? true : null,
      json_parse: inspected.json_parse,
      schema_valid: inspected.probe?.schema_valid ?? (response.ok ? true : null),
      response_shape: inspected.response_shape,
      final_result: null,
      content_present: bodyText.length > 0,
      content_length: bodyText.length,
      content_hash: sha256(bodyText),
      duration_ms: Date.now() - started,
      retry_count: inspected.probe?.retry_count ?? 0
    });
    return response;
  };

  const client = createSemanticGatewayClientFromEnv({ env: process.env, fetchImpl, taskType: TASK_TYPE });
  const extractor = new SemanticGatewayEvidenceFactExtractor({ client });
  const context = {
    review_id: 'EVAL-CANARY-REVIEW-COM-01',
    project_id: 'EVAL-CANARY-PROJECT-COM-01',
    review_status: 'approved',
    evidence_review_contract_version: 'evidence-review-v1',
    source_span_id: 'EVAL-CANARY-SPAN-COM-01',
    source_text: sourceText,
    source_text_hash: sourceHash,
    current_source_text_hash: sourceHash,
    material_id: 'EVAL-CANARY-MATERIAL-COM-01',
    anchor_chunk_id: 'EVAL-CANARY-CHUNK-COM-01',
    material_type: 'company_profile',
    evidence_capability: 'capable',
    support_level: 'full_support',
    fact_extraction_expected: true
  };
  let result = null;
  let error = null;
  try {
    result = await executeFactCanaryCase({
      ledger,
      case_id: CASE_ID,
      dispatch: async () => {
        try {
          const facts = await extractor.extract(context);
          const audit = facts?.[FACT_PROVIDER_AUDIT] || {};
          const capture = captures.at(-1) || {};
          const metadata = {
            ...capture,
            normalization_count: Number.isInteger(audit.empty_domain_namespace_normalized_count)
              ? audit.empty_domain_namespace_normalized_count : capture.normalization_count,
            normalizer_invoked: audit.empty_domain_namespace_normalized_count > 0 ? true : capture.normalizer_invoked,
            schema_valid: true,
            final_result: facts.length ? 'PASS' : 'REVIEW_REQUIRED'
          };
          return { final_result: metadata.final_result, metadata };
        } catch (caught) {
          const capture = captures.at(-1) || {};
          caught.metadata = {
            ...capture,
            normalization_count: capture.normalization_count ?? null,
            normalizer_invoked: capture.normalizer_invoked,
            error_code: caught?.code || null,
            cause_class: caught?.details?.cause_code || 'SCHEMA_CONTRACT',
            final_result: 'FAIL'
          };
          throw caught;
        }
      }
    });
  } catch (caught) {
    error = caught;
    const capture = captures.at(-1) || {};
    // The extractor retains only safe Provider audit fields; the fetch probe
    // capture adds the exact validation path without persisting raw content.
    const audit = caught?.details?.provider_audit || {};
    const metadata = {
      ...capture,
      gateway_http_status: capture.gateway_http_status ?? audit.gateway_http_status,
      provider_http_status: capture.provider_http_status ?? audit.provider_http_status,
      provider_http_reached: capture.provider_http_reached === true || audit.provider_http_reached === true,
      normalization_count: capture.normalization_count ?? audit.empty_domain_namespace_normalized_count ?? null,
      normalizer_invoked: capture.normalizer_invoked,
      error_code: caught?.code || null,
      cause_class: caught?.details?.cause_code || 'SCHEMA_CONTRACT',
      final_result: 'FAIL'
    };
    if (capture.call_index) {
      const returnEvent = ledger.events.find(event => event.event === 'PROVIDER_RETURNED');
      if (returnEvent) Object.assign(returnEvent.metadata, metadata);
    }
    throw caught;
  } finally {
    const last = captures.at(-1) || {};
    const state = ledger.state(CASE_ID);
    const summary = ledger.summary();
    const normalizerObserved = last.normalizer_invoked === true;
    const checkpoint = {
      checkpoint: 'V43_FACT_POST_NORMALIZATION_CANARY_DIAGNOSTIC_CLOSE_CHECKPOINT',
      generated_at: now(),
      case_id: CASE_ID,
      source_file: basename(SOURCE_FILE),
      source_sha256: sourceHash,
      provider_calls: summary.provider_calls,
      retries: last.retry_count ?? 0,
      normalizer_invoked: normalizerObserved ? 'YES' : 'NOT_OBSERVED',
      empty_namespace_found_count: last.normalization_count ?? null,
      empty_namespace_removed_count: last.normalization_count ?? null,
      pre_normalization_shape_hash: null,
      post_normalization_shape_hash: null,
      post_normalization_validation_path: last.validation_path ?? null,
      post_normalization_validation_type: last.actual_type ?? null,
      gateway_failure_code: last.gateway_error_code ?? error?.details?.provider_audit?.gateway_error_code ?? null,
      exact_observed_validation_path: last.validation_path ?? null,
      expected_shape: last.expected_shape ?? null,
      observed_shape_type: last.actual_type ?? null,
      classification: error ? classification({ normalizerObserved: last.normalizer_invoked, diagnostics: last }) || 'SAFE_TELEMETRY_INSUFFICIENT' : null,
      provider_reached: last.provider_http_reached === true,
      provider_http_status: last.provider_http_status ?? null,
      output_contract_valid: error ? false : true,
      durable_per_case_telemetry: summary.cases_finalized === 1,
      case_state: state.state,
      three_case_gate: 'NOT_STARTED',
      fixed12_material_gate: 'NOT_STARTED',
      production_db_writes: 0,
      gold_mutations: 0,
      mapping_actions: 0,
      claim_actions: 0,
      writer_actions: 0,
      result: result ? 'COM-01_PASS' : 'COM-01_FAIL',
      error_code: error?.code || null,
      error_cause_code: error?.details?.cause_code || null,
      ledger_path: ledgerPath,
      provider_audit: result?.[FACT_PROVIDER_AUDIT] || null
    };
    await writeFile(join(OUTPUT_DIR, 'checkpoint.json'), `${JSON.stringify(checkpoint, null, 2)}\n`);
    await writeFile(join(OUTPUT_DIR, 'checkpoint.md'), `# V43 Fact Post-Normalization Canary Diagnostic Close\n\n- case: ${CASE_ID}\n- provider calls: ${checkpoint.provider_calls}\n- Provider reached: ${checkpoint.provider_reached}\n- HTTP status: ${checkpoint.provider_http_status ?? 'n/a'}\n- normalizer invoked: ${checkpoint.normalizer_invoked}\n- validation path: ${checkpoint.exact_observed_validation_path || 'not recorded'}\n- classification: ${checkpoint.classification || 'PASS'}\n- output contract valid: ${checkpoint.output_contract_valid}\n- durable telemetry: ${checkpoint.durable_per_case_telemetry}\n- three-case gate: NOT_STARTED\n- production DB writes: 0\n- gold mutations: 0\n`);
  }
  return { checkpoint: join(OUTPUT_DIR, 'checkpoint.json') };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().then(result => console.log(JSON.stringify(result))).catch(error => {
    console.error(JSON.stringify({ code: error?.code || 'FACT_CANARY_FAILED', message: 'Fact canary failed; see durable checkpoint artifact.' }));
    process.exitCode = 1;
  });
}
