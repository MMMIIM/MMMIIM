import { config as loadDotenv } from 'dotenv';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  SemanticGatewayEvidenceFactExtractor,
  FACT_PROVIDER_AUDIT,
  buildEvidenceFactSemanticInput
} from '../../src/pipeline/semantic-gateway-evidence-fact-extractor.js';
import { createSemanticGatewayClientFromEnv, parseSemanticGatewayConfig } from '../../src/pipeline/semantic-gateway-client.js';
import { createEvidenceFactContract } from '../../src/pipeline/evidence-fact-contract-v1.js';
import { getSemanticTaskContract } from '../../../packages/semantic-contracts/index.js';

const CASE_ID = 'COM-01';
const TASK_TYPE = 'evidence_fact_extraction';
const SOURCE_FILE = resolve('backend/eval/rag-pilot/V43_RAG_CODEX_HANDOFF_1/03_company_case_rag/COM-01_公司概况与业务范围.md');
const RUN_ID = `fact-second-schema-diagnostic-${new Date().toISOString().replace(/[-:.TZ]/g, '')}-${randomUUID().slice(0, 8)}`;
const OUTPUT_DIR = resolve(process.env.FACT_SECOND_SCHEMA_DIAGNOSTIC_OUTPUT_DIR || `backend/eval/rag-pilot/results/${RUN_ID}`);
const sha256 = value => createHash('sha256').update(String(value ?? ''), 'utf8').digest('hex');

const allowedPropertyNames = Object.freeze(Object.keys(
  getSemanticTaskContract(TASK_TYPE)?.data_schema?.properties?.facts?.items?.properties || {}
).sort());

function safeText(value, max = 240) {
  return typeof value === 'string' ? value.slice(0, max) : null;
}

function safeInt(value) { return Number.isInteger(value) ? value : null; }

function safeArray(value, max = 100) {
  return Array.isArray(value) ? value.filter(item => typeof item === 'string').slice(0, max).map(item => item.slice(0, 120)) : [];
}

function safeKeySets(value) {
  return Array.isArray(value) ? value.slice(0, 100).map(keys => safeArray(keys, 80).sort()) : [];
}

function safeProbe(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const normalization = value.fact_normalization_diagnostic && typeof value.fact_normalization_diagnostic === 'object'
    ? value.fact_normalization_diagnostic : null;
  const schemaErrors = Array.isArray(value.schema_validation_errors) ? value.schema_validation_errors : [];
  const first = schemaErrors[0] || null;
  const unknown = normalization?.unexpected_property_names || value.fact_semantic_diagnostic?.unknown_fields || [];
  return {
    provider_http_reached: value.provider_http_reached === true,
    provider_http_status: safeInt(value.provider_http_status),
    gateway_http_status: safeInt(value.gateway_http_status),
    gateway_error_code: safeText(value.gateway_error_code, 120),
    provider_error_code: safeText(value.provider_error_code, 120),
    json_parse_success: typeof value.json_parse_success === 'boolean' ? value.json_parse_success : null,
    finish_reason: safeText(value.finish_reason, 40),
    response_model: safeText(value.response_model, 120),
    fact_normalization_diagnostic: normalization ? {
      projection_invoked: normalization.projection_invoked === true,
      normalizer_invoked: normalization.normalizer_invoked === true,
      pre_normalization_fact_keys: safeKeySets(normalization.pre_normalization_fact_keys),
      post_normalization_fact_keys: safeKeySets(normalization.post_normalization_fact_keys),
      unexpected_property_names: safeArray(unknown),
      allowed_property_names: safeArray(normalization.allowed_property_names?.length ? normalization.allowed_property_names : allowedPropertyNames),
      removed_property_names: safeArray(normalization.removed_property_names),
      exact_validation_path: safeText(normalization.exact_validation_path, 240)
    } : null,
    schema_validation: {
      valid: schemaErrors.length === 0 && value.semantic_error_code !== 'OUTPUT_SCHEMA_INVALID',
      first_path: safeText(first?.path, 240),
      first_keyword: safeText(first?.keyword || first?.validator_code, 80),
      first_expected: safeText(first?.expected, 240),
      first_actual_type: safeText(first?.actual_type || first?.observed_category, 80),
      first_additional_property: safeText(first?.additional_property, 120)
    }
  };
}

function classify({ normalizerInvoked, unexpectedPropertyNames, schemaValid }) {
  if (normalizerInvoked === false) return 'RUNTIME_NORMALIZATION_PATH_BYPASSED';
  if (normalizerInvoked !== true) return 'TELEMETRY_NOT_OBSERVED';
  if (schemaValid) return null;
  if (unexpectedPropertyNames.length === 0) return 'UNCLASSIFIED_SCHEMA_FAILURE_REQUIRES_REVIEW';
  const canonicalRenameNames = new Set([
    'subject', 'fact', 'fact_text', 'predicate', 'relation', 'value', 'source', 'requirement_id', 'claim'
  ]);
  if (unexpectedPropertyNames.some(name => canonicalRenameNames.has(name))) return 'CONTRACT_DRIFT_REQUIRES_DECISION';
  return 'NARROW_NON_CANONICAL_METADATA_REQUIRES_AUTHORIZATION';
}

function safeGatewayBody(bodyText) {
  try {
    const outer = JSON.parse(bodyText);
    return {
      gateway_request_id: safeText(outer?.request_id, 128),
      error_code: safeText(outer?.error_code, 120),
      probe: safeProbe(outer?.probe_diagnostics),
      content_present: bodyText.length > 0,
      content_length: bodyText.length,
      content_hash: sha256(bodyText)
    };
  } catch {
    return { gateway_request_id: null, error_code: 'UNPARSEABLE_GATEWAY_RESPONSE', probe: null, content_present: bodyText.length > 0, content_length: bodyText.length, content_hash: sha256(bodyText) };
  }
}

async function writeCheckpoint(checkpoint) {
  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(join(OUTPUT_DIR, 'checkpoint.json'), `${JSON.stringify(checkpoint, null, 2)}\n`);
  await writeFile(join(OUTPUT_DIR, 'checkpoint.md'), [
    '# V43 Fact Second Schema Violation Diagnostic',
    '',
    `- run: ${checkpoint.run_id}`,
    `- case: ${checkpoint.case_id}`,
    `- provider calls: ${checkpoint.provider_calls}`,
    `- retries: ${checkpoint.retries}`,
    `- Provider reached: ${checkpoint.provider_reached}`,
    `- HTTP status: ${checkpoint.provider_http_status ?? 'n/a'}`,
    `- normalizer invoked: ${checkpoint.normalizer_invoked}`,
    `- unexpected properties: ${(checkpoint.unexpected_property_names || []).join(', ') || 'none'}`,
    `- validation path: ${checkpoint.exact_validation_path || 'not recorded'}`,
    `- classification: ${checkpoint.classification}`,
    `- semantic/grounding gate: ${checkpoint.semantic_grounding_gate}`,
    '- production DB writes: 0',
    '- gold mutations: 0',
    '- raw provider content persisted: false',
    '',
    `STOP: ${checkpoint.stop_reason}`
  ].join('\n') + '\n');
}

export async function runFactSecondSchemaDiagnostic({ fetchImpl = fetch } = {}) {
  loadDotenv({ path: resolve('backend/.env'), override: false });
  const generatedAt = new Date().toISOString();
  const sourceText = await readFile(SOURCE_FILE, 'utf8');
  const sourceHash = sha256(sourceText);
  const config = parseSemanticGatewayConfig(process.env, { taskType: TASK_TYPE });
  const correlationId = randomUUID();
  const preflight = { ready_status: null, info_status: null, gateway_api_base_present: Boolean(config.apiBase), checked_at: generatedAt };
  if (!config.apiBase) {
    const checkpoint = {
      checkpoint: 'V43_FACT_SECOND_SCHEMA_VIOLATION_DIAGNOSTIC_CHECKPOINT', run_id: RUN_ID, case_id: CASE_ID,
      correlation_id: correlationId, source_file: basename(SOURCE_FILE), source_sha256: sourceHash,
      provider_calls: 0, retries: 0, provider_reached: false, provider_http_status: null,
      normalizer_invoked: null, pre_normalization_fact_keys: [], post_normalization_fact_keys: [], unexpected_property_names: [],
      allowed_property_names: allowedPropertyNames, removed_property_names: [], exact_validation_path: null,
      schema_validation: 'NOT_RUN', semantic_grounding_gate: 'NOT_RUN', classification: 'ENVIRONMENT_NOT_CONFIGURED',
      stop_reason: 'Semantic Gateway API base is not configured.', provider_identity: { provider: 'NOT_EXPOSED', model: 'NOT_EXPOSED' },
      production_db_writes: 0, gold_mutations: 0, mapping_actions: 0, claim_actions: 0, writer_actions: 0,
      raw_provider_content_persisted: false, preflight
    };
    await writeCheckpoint(checkpoint); return checkpoint;
  }
  const headers = config.apiKey ? { authorization: `Bearer ${config.apiKey}` } : {};
  const ready = await fetchImpl(`${config.apiBase}/ready`, { headers });
  preflight.ready_status = ready.status;
  if (!ready.ok) {
    const checkpoint = {
      checkpoint: 'V43_FACT_SECOND_SCHEMA_VIOLATION_DIAGNOSTIC_CHECKPOINT', run_id: RUN_ID, case_id: CASE_ID,
      correlation_id: correlationId, source_file: basename(SOURCE_FILE), source_sha256: sourceHash,
      provider_calls: 0, retries: 0, provider_reached: false, provider_http_status: null,
      normalizer_invoked: null, pre_normalization_fact_keys: [], post_normalization_fact_keys: [], unexpected_property_names: [],
      allowed_property_names: allowedPropertyNames, removed_property_names: [], exact_validation_path: null,
      schema_validation: 'NOT_RUN', semantic_grounding_gate: 'NOT_RUN', classification: 'GATEWAY_NOT_READY',
      stop_reason: 'Semantic Gateway readiness check did not pass.', provider_identity: { provider: 'NOT_EXPOSED', model: 'NOT_EXPOSED' },
      production_db_writes: 0, gold_mutations: 0, mapping_actions: 0, claim_actions: 0, writer_actions: 0,
      raw_provider_content_persisted: false, preflight
    };
    await writeCheckpoint(checkpoint); return checkpoint;
  }

  const captures = [];
  let calls = 0;
  const guardedFetch = async (url, options = {}) => {
    const method = String(options.method || 'GET').toUpperCase();
    if (method === 'GET') return fetchImpl(url, options);
    calls += 1;
    if (calls > 1) throw Object.assign(new Error('FACT_SECOND_SCHEMA_CALL_CAP_REACHED'), { code: 'FACT_SECOND_SCHEMA_CALL_CAP_REACHED' });
    const started = Date.now();
    const response = await fetchImpl(url, options);
    const bodyText = await response.clone().text().catch(() => '');
    captures.push({ ...safeGatewayBody(bodyText), gateway_http_status: response.status, duration_ms: Date.now() - started });
    return response;
  };

  const client = createSemanticGatewayClientFromEnv({ env: process.env, fetchImpl: guardedFetch, taskType: TASK_TYPE });
  const extractor = new SemanticGatewayEvidenceFactExtractor({ client });
  const context = {
    review_id: 'EVAL-DIAGNOSTIC-REVIEW-COM-01', project_id: 'EVAL-DIAGNOSTIC-PROJECT-COM-01', review_status: 'approved',
    evidence_review_contract_version: 'evidence-review-v1', source_span_id: 'EVAL-DIAGNOSTIC-SPAN-COM-01', source_text: sourceText,
    source_text_hash: sourceHash, current_source_text_hash: sourceHash, material_id: 'EVAL-DIAGNOSTIC-MATERIAL-COM-01',
    anchor_chunk_id: 'EVAL-DIAGNOSTIC-CHUNK-COM-01', material_type: 'company_profile', evidence_capability: 'capable',
    support_level: 'full_support', fact_extraction_expected: true
  };
  let facts = null; let error = null;
  try { facts = await extractor.extract(context); } catch (caught) { error = caught; }
  const capture = captures[0] || {};
  const audit = facts?.[FACT_PROVIDER_AUDIT] || error?.details?.provider_audit || capture.probe || {};
  const normalization = audit.fact_normalization_diagnostic || capture.probe?.fact_normalization_diagnostic || null;
  const schemaValid = !error;
  let semanticGrounding = 'NOT_RUN';
  if (schemaValid && Array.isArray(facts) && facts.length > 0) {
    try {
      for (const fact of facts) {
        createEvidenceFactContract(context, fact, { extractorVersion: 'fact-second-schema-diagnostic-v1' });
      }
      semanticGrounding = 'PASS';
    } catch (caught) {
      semanticGrounding = `FAIL:${safeText(caught?.code || 'FACT_CONTRACT_INVALID', 120)}`;
    }
  }
  const unexpected = safeArray(
    normalization?.unexpected_property_names
      || capture.probe?.fact_semantic_diagnostic?.unknown_fields
      || (capture.probe?.schema_validation?.first_additional_property ? [capture.probe.schema_validation.first_additional_property] : [])
  );
  const checkpoint = {
    checkpoint: 'V43_FACT_SECOND_SCHEMA_VIOLATION_DIAGNOSTIC_CHECKPOINT', run_id: RUN_ID, case_id: CASE_ID,
    correlation_id: correlationId, source_file: basename(SOURCE_FILE), source_sha256: sourceHash,
    provider_calls: calls, retries: 0, provider_reached: capture.probe?.provider_http_reached === true || audit.provider_http_reached === true,
    provider_request_reached: capture.probe?.provider_http_reached === true || audit.provider_http_reached === true,
    provider_content_present: (capture.content_length || 0) > 0,
    finish_reason: capture.probe?.finish_reason || audit.finish_reason || null,
    json_parse: capture.probe?.json_parse_success ?? audit.json_parse_success ?? null,
    provider_http_status: capture.probe?.provider_http_status ?? audit.provider_http_status ?? null,
    gateway_http_status: capture.gateway_http_status ?? audit.gateway_http_status ?? null,
    provider_identity: { provider: 'semantic_gateway', model: capture.probe?.response_model || audit.response_model || 'NOT_EXPOSED' },
    normalizer_invoked: normalization ? normalization.normalizer_invoked === true : null,
    projection_invoked: normalization ? normalization.projection_invoked === true : null,
    normalizer_invoked_static_path: 'CURRENT_SOURCE_CODE_PROJECTS_BEFORE_VALIDATE',
    runtime_telemetry_status: normalization ? 'OBSERVED' : 'NOT_OBSERVED_RUNTIME_REVISION',
    pre_normalization_fact_keys: safeKeySets(normalization?.pre_normalization_fact_keys || []),
    post_normalization_fact_keys: safeKeySets(normalization?.post_normalization_fact_keys || []),
    unexpected_property_names: unexpected,
    allowed_property_names: safeArray(normalization?.allowed_property_names?.length ? normalization.allowed_property_names : allowedPropertyNames),
    removed_property_names: safeArray(normalization?.removed_property_names || []),
    exact_validation_path: safeText(normalization?.exact_validation_path || capture.probe?.schema_validation?.first_path, 240),
    schema_validation: schemaValid ? 'PASS' : 'FAIL',
    schema_validation_detail: capture.probe?.schema_validation || null,
    semantic_grounding_gate: semanticGrounding,
    classification: schemaValid ? null : classify({ normalizerInvoked: normalization?.normalizer_invoked, unexpectedPropertyNames: unexpected, schemaValid }),
    observed_property_classification: unexpected.some(name => ['subject', 'fact', 'fact_text', 'predicate', 'relation', 'value', 'source', 'requirement_id', 'claim'].includes(name))
      ? 'CONTRACT_DRIFT_REQUIRES_DECISION' : (unexpected.length > 0 ? 'NARROW_NON_CANONICAL_METADATA_REQUIRES_AUTHORIZATION' : null),
    stop_reason: schemaValid ? 'Schema passed; semantic/grounding result recorded and diagnostic run complete.' : 'Strict Fact Schema failed; fail-fast after the single permitted Provider call.',
    error_code: safeText(error?.code || capture.error_code, 120), error_cause_code: safeText(error?.details?.cause_code, 120),
    backend_error_code: safeText(error?.code || capture.error_code, 120), backend_cause_code: safeText(error?.details?.cause_code, 120),
    production_db_writes: 0, gold_mutations: 0, mapping_actions: 0, claim_actions: 0, writer_actions: 0,
    raw_provider_content_persisted: false, provider_response_content_hash: capture.content_hash || null,
    provider_response_content_length: capture.content_length || null, preflight,
    outbound_input: { task_type: TASK_TYPE, source_sha256: sourceHash, payload_hash: sha256(JSON.stringify(buildEvidenceFactSemanticInput(context))), requirement_blind: true }
  };
  await writeCheckpoint(checkpoint);
  return checkpoint;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  runFactSecondSchemaDiagnostic().then(result => {
    console.log(JSON.stringify({ checkpoint: join(OUTPUT_DIR, 'checkpoint.json'), provider_calls: result.provider_calls, classification: result.classification }));
    if (result.provider_calls > 1) process.exitCode = 2;
  }).catch(error => {
    console.error(JSON.stringify({ code: error?.code || 'FACT_SECOND_SCHEMA_DIAGNOSTIC_FAILED', message: 'Diagnostic failed; see checkpoint artifact.' }));
    process.exitCode = 1;
  });
}
