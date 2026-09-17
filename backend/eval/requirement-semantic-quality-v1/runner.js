import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { extractTenderText } from '../../src/tender-text-extractor.js';
import { loadBackendEnvironment } from '../../src/backend-runtime.js';
import {
  classifyTenderSections
} from '../../src/pipeline/tender-section-classifier.js';
import {
  combineRequirementExtractionSections
} from '../../src/pipeline/requirement-scope-router.js';
import {
  chunkExtractedText,
  estimateTokenCount,
  resolveRequirementChunkBudget
} from '../../src/pipeline/requirement-chunker.js';
import {
  createRequirementExtractionGateway,
  resolveRequirementExtractionProviderInput
} from '../../src/pipeline/requirement-extraction.js';
import { createSemanticGatewayClientFromEnv } from '../../src/pipeline/semantic-gateway-client.js';
import { buildCanonicalRequirements } from '../../src/pipeline/canonical-requirements.js';
import { evaluateCandidatePayload } from '../requirement-production-quality-gate/candidate-pipeline-evaluator.js';
import { readSemanticGatewayRuntimeConfig } from '../../../packages/semantic-contracts/runtime-config.js';
import {
  getSemanticTaskContract,
  schemaSha256
} from '../../../packages/semantic-contracts/index.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../../..');
const DOCS = path.join(REPO, 'docs');
const INPUT = path.join(DOCS, 'V43_REQUIREMENT_GOLD_V2_SIX_TENDER_CANONICAL_INPUT.json');
const TENDERS = Object.freeze({
  'JY-001': 'backend/eval/tender-benchmark-v1/sources/JY-001-jiangyin.pdf',
  'TB-003': 'backend/eval/tender-benchmark-v1/sources/TB-003-jiaozuo-sidian.pdf',
  'TB-006': 'backend/eval/tender-benchmark-v1/sources/TB-006-beijing-emergency-model-cloud.pdf',
  'FAST-01': 'backend/eval/tender-benchmark-v1/sources/FAST-01-dapeng-healthcare.pdf',
  'FAST-04': 'backend/eval/tender-benchmark-v1/sources/FAST-04-beijing-software.pdf',
  'FAST-WATER-01': 'backend/eval/tender-benchmark-v1/sources/FAST-WATER-01-beijing-water-ops.pdf'
});
const TENDER_TITLES = Object.freeze({
  'JY-001': '江阴市招标文件',
  'TB-003': '焦作市电子政务招标文件',
  'TB-006': '北京市应急模型云招标文件',
  'FAST-01': '大鹏医疗健康运维招标文件',
  'FAST-04': '北京软件招标文件',
  'FAST-WATER-01': '北京水务运维招标文件'
});
const OUTPUT_DIR = path.join(REPO, 'backend/eval/requirement-semantic-quality-v1');
const RUN_ID = `req-sem-quality-v1-${new Date().toISOString().replace(/[-:.TZ]/g, '')}`;
const TASK = 'requirement_extraction';
const LIVE_CHUNKS_PER_TENDER = 8;
const BLIND_WINDOWS_PER_TENDER = 12;
const OUTPUT_SAMPLE_PER_TENDER = 40;
const PROVIDER_CAP = 160;

const sha256 = (value) => {
  const hash = crypto.createHash('sha256');
  if (Buffer.isBuffer(value)) hash.update(value);
  else hash.update(String(value), 'utf8');
  return hash.digest('hex');
};
const stable = (value) => JSON.stringify(value, (_key, item) => {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
  return Object.fromEntries(Object.keys(item).sort().map((key) => [key, item[key]]));
});
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeJson = (file, value) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};
const writeJsonl = (file, rows) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`, 'utf8');
};
const preview = (value, limit = 1400) => String(value || '').slice(0, limit);

function safeEnvSummary(env) {
  const config = readSemanticGatewayRuntimeConfig(env);
  let gatewayHost = null;
  let providerHost = null;
  try { gatewayHost = new URL(config.gatewayApiBase).hostname; } catch { gatewayHost = config.gatewayApiBase ? 'invalid' : null; }
  try { providerHost = new URL(config.providerApiBase).hostname; } catch { providerHost = config.providerApiBase ? 'invalid' : null; }
  return {
    provider: config.provider && config.provider !== 'mock' ? config.provider : null,
    model: config.model && config.model !== 'mock-semantic-v1' ? config.model : null,
    gateway_host: gatewayHost,
    provider_host: providerHost,
    timeout_ms: config.timeoutMs,
    gateway_configured: Boolean(config.gatewayApiBase && config.serviceApiKey),
    provider_configured: Boolean(config.providerApiBase && config.providerApiKey && config.model),
    service_key_present: Boolean(config.serviceApiKey),
    provider_key_present: Boolean(config.providerApiKey)
  };
}

async function safeGet(url, timeoutMs = 5000) {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { method: 'GET', signal: controller.signal });
    return { status: response.status, ok: response.ok, latency_ms: Date.now() - started };
  } catch (error) {
    return { status: null, ok: false, latency_ms: Date.now() - started, error_code: error?.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK_ERROR' };
  } finally {
    clearTimeout(timer);
  }
}

function riskFeatures(row) {
  const text = String(row.requirement_text || '');
  const excerpt = String(row.source_excerpt || '');
  const numbers = text.match(/\d+(?:\.\d+)?/g) || [];
  const modalities = text.match(/应|须|必须|不得|需要|提供|支持|可|应当/g) || [];
  const negations = text.match(/不得|禁止|不能|不应|无|未/g) || [];
  const enumerations = text.match(/[、,，;；]|(?:包括|包含|分别|以及)/g) || [];
  const multiClause = /[；;]/.test(text) || text.split(/[。！？]/).filter(Boolean).length > 1;
  const multiSubject = (text.match(/(?:采购人|供应商|投标人|系统|平台|项目|用户|单位|企业)/g) || []).length > 1;
  const multiAction = (text.match(/(?:支持|实现|提供|完成|建设|部署|管理|维护|对接|接入|保障|验收|培训)/g) || []).length > 1;
  const tableOrigin = /(?:表|参数|规格|配置|数量|单位|型号)/.test(excerpt) || /table/i.test(JSON.stringify(row.source_span || {}));
  const contextOnly = row.requirement_category === 'context' || (modalities.length === 0 && !/[应须必须不得]/.test(text));
  const flags = [];
  if (multiClause) flags.push('MULTI_CLAUSE');
  if (multiSubject) flags.push('MULTI_SUBJECT');
  if (multiAction) flags.push('MULTI_ACTION');
  if (numbers.length > 1) flags.push('MULTI_QUANTITY');
  if ((text.match(/[A-Za-z\u4e00-\u9fa5]{2,}/g) || []).length > 8) flags.push('MULTI_ENTITY');
  if (enumerations.length >= 4) flags.push('LONG_ENUMERATION');
  if (tableOrigin) flags.push('TABLE_HEADER_DEPENDENCY');
  if (contextOnly) flags.push('POSSIBLE_CONTEXT_ONLY');
  if (text.length > 180) flags.push('SOURCE_REFERENCE_COMPLEXITY');
  const score = flags.reduce((sum, flag) => sum + ({ MULTI_CLAUSE: 3, MULTI_SUBJECT: 3, MULTI_ACTION: 2, MULTI_QUANTITY: 3, MULTI_ENTITY: 2, LONG_ENUMERATION: 2, TABLE_HEADER_DEPENDENCY: 3, POSSIBLE_CONTEXT_ONLY: 2, SOURCE_REFERENCE_COMPLEXITY: 1 }[flag] || 1), 0)
    + (row.mandatory === true ? 3 : 0) + (row.requires_confirmation === true ? 2 : 0) + (numbers.length ? 2 : 0);
  return {
    TEXT_LENGTH: text.length,
    SOURCE_REF_COUNT: Array.isArray(row.source_refs) ? row.source_refs.length : 0,
    SOURCE_SPAN_COUNT: row.source_span && (row.source_span.page_start != null || row.source_span.start_ref) ? 1 : 0,
    NUMBER_COUNT: numbers.length,
    MODALITY_MARKERS: modalities.length,
    NEGATION_MARKERS: negations.length,
    ENUMERATION_COUNT: enumerations.length,
    TABLE_ORIGIN: tableOrigin,
    CATEGORY: row.category || null,
    MANDATORY: row.mandatory === true,
    MANDATORY_OBSERVED: row.mandatory_observed === true,
    REQUIRES_CONFIRMATION: row.requires_confirmation === true,
    RISK_FLAGS: flags,
    risk_score: score
  };
}

function hashRank(row, seed) {
  return sha256(`${seed}|${row.canonical_requirement_id || ''}|${row.requirement_hash || ''}`);
}

function selectOutputSample(rows, tenderId) {
  const enriched = rows.map((row) => ({ row, features: riskFeatures(row) }));
  const high = [...enriched].sort((a, b) => b.features.risk_score - a.features.risk_score || a.row.canonical_requirement_id.localeCompare(b.row.canonical_requirement_id));
  const mandatory = high.filter(({ features }) => features.MANDATORY || features.NUMBER_COUNT > 0 || features.TABLE_ORIGIN || features.RISK_FLAGS.includes('POSSIBLE_CONTEXT_ONLY') === false).slice(0, 10);
  const risk = high.slice(10, 30);
  const random = [...enriched].sort((a, b) => hashRank(a.row, tenderId).localeCompare(hashRank(b.row, tenderId))).slice(0, 10);
  const context = high.filter(({ features }) => features.RISK_FLAGS.includes('POSSIBLE_CONTEXT_ONLY') || features.MODALITY_MARKERS === 0).slice(0, 10);
  const selected = [];
  const seen = new Set();
  for (const group of [mandatory, risk, random, context, high]) {
    for (const item of group) {
      const id = item.row.canonical_requirement_id;
      if (seen.has(id)) continue;
      seen.add(id); selected.push(item);
      if (selected.length >= OUTPUT_SAMPLE_PER_TENDER) break;
    }
    if (selected.length >= OUTPUT_SAMPLE_PER_TENDER) break;
  }
  return selected.slice(0, OUTPUT_SAMPLE_PER_TENDER);
}

export async function prepareTender(tenderId, env) {
  const relative = TENDERS[tenderId];
  const sourcePath = path.join(REPO, relative);
  const buffer = fs.readFileSync(sourcePath);
  const sourceSha = sha256(buffer);
  const extraction = await extractTenderText({ fileName: sourcePath, mimeType: 'application/pdf', buffer });
  const analysis = classifyTenderSections(extraction);
  const routedSections = Array.isArray(analysis.requirementExtractionSections) && analysis.requirementExtractionSections.length
    ? analysis.requirementExtractionSections
    : (analysis.sections || []);
  const scope = combineRequirementExtractionSections(routedSections);
  const scopeText = scope?.content_text || extraction.text;
  const scopeParagraphs = scope?.paragraphs?.length ? scope.paragraphs : extraction.paragraphs;
  const budget = resolveRequirementChunkBudget(env);
  const chunks = chunkExtractedText({
    text: scopeText,
    paragraphs: scopeParagraphs,
    singleCallThreshold: budget.singleCallThreshold,
    characterBudget: budget.characterBudget,
    tokenBudget: budget.tokenBudget,
    sourceSpanBudget: budget.sourceSpanBudget
  });
  const segments = chunks.flatMap((chunk) => chunk.segments.map((segment) => ({ ...segment, chunk_number: chunk.chunk_number })));
  return {
    tender_id: tenderId,
    title: TENDER_TITLES[tenderId],
    source_file: relative,
    source_sha256: sourceSha,
    parser_status: extraction.text ? 'PASS' : 'FAIL',
    parser_character_count: extraction.text.length,
    parser_paragraph_count: extraction.paragraphs.length,
    router_status: scope ? 'PASS' : 'FALLBACK',
    router_warning_count: Array.isArray(analysis.warnings) ? analysis.warnings.length : 0,
    chunker_status: chunks.length ? 'PASS' : 'FAIL',
    chunk_count: chunks.length,
    chunks,
    segments,
    scope
  };
}

function buildBlindWindows(prepared) {
  const segments = prepared.segments.filter((segment) => String(segment.text || '').trim());
  const rows = [];
  for (let i = 0; i < BLIND_WINDOWS_PER_TENDER; i += 1) {
    const index = segments.length ? Math.floor(i * (segments.length - 1) / Math.max(1, BLIND_WINDOWS_PER_TENDER - 1)) : 0;
    const segment = segments[index];
    const context = segments.slice(Math.max(0, index - 1), Math.min(segments.length, index + 2));
    const excerpt = context.map((item) => item.text).join('\n');
    rows.push({
      run_id: RUN_ID,
      tender_id: prepared.tender_id,
      window_id: `${prepared.tender_id}-BLIND-${String(i + 1).padStart(2, '0')}`,
      source_file: prepared.source_file,
      source_sha256: prepared.source_sha256,
      page_start: context[0]?.page ?? null,
      page_end: context.at(-1)?.page ?? null,
      source_refs: context.map((item) => item.source_ref),
      source_excerpt: preview(excerpt, 1600),
      canonical_visibility: 'HIDDEN_FIRST_PASS',
      expected_substantive_requirements: [],
      status: 'PENDING_BLIND_HUMAN_REVIEW'
    });
  }
  return rows;
}

function mutateText(text, dimension, index) {
  const base = String(text || '');
  if (dimension === 'number') {
    const replaced = base.replace(/\d+(?:\.\d+)?/, String(999 + index));
    return replaced === base ? `${base} 数量${999 + index}` : replaced;
  }
  if (dimension === 'negation') return `${base} 不得满足`;
  if (dimension === 'entity') return `${base} 主体替换为未授权企业${index}`;
  if (dimension === 'scope') return `${base} 范围扩展至全国所有区域`;
  if (dimension === 'status') return `${base} 状态改为已验收完成`;
  if (dimension === 'temporal') return `${base} 有效期改为2040年`;
  if (dimension === 'mandatory') {
    const replaced = base.replace(/应|须|必须/, '可');
    return replaced === base ? `${base}（可选）` : replaced;
  }
  if (dimension === 'table_header') {
    const replaced = base.replace(/数量|单位|型号|参数/g, '');
    return replaced === base ? `${base}（表头缺失）` : replaced;
  }
  if (dimension === 'harmful_merge') return `${base}；并且另一个独立系统必须完成迁移和验收`;
  return `项目背景介绍${index}：${base}`;
}

function rawCandidateFromCanonical(row, text, sourceVerified = true) {
  const span = row.source_span || {};
  return {
    text,
    category: row.category || 'other',
    source_text: row.source_excerpt || '',
    source_context_text: row.source_excerpt || '',
    source_verified: sourceVerified,
    source_resolution_status: sourceVerified ? 'verified' : 'ambiguous',
    source_match_type: sourceVerified ? 'verified' : 'ambiguous',
    source_hash: sourceVerified ? row.source_hash : null,
    source_page_start: span.page_start ?? null,
    source_page_end: span.page_end ?? null,
    source_paragraph_start: span.paragraph_start ?? null,
    source_paragraph_end: span.paragraph_end ?? null,
    source_clause_id: null,
    source_section: null,
    source_chunk_id: null,
    mandatory_observed: row.mandatory_observed === true,
    candidate_index: 1
  };
}

export function runMutationSuite(canonical) {
  const dimensions = ['number', 'negation', 'entity', 'scope', 'status', 'temporal', 'mandatory', 'table_header', 'harmful_merge', 'context_only'];
  const p0Dimensions = new Set(['number', 'negation', 'entity', 'scope', 'status', 'temporal', 'mandatory', 'table_header']);
  const sourceRows = canonical.filter((row) => row.source_excerpt && row.source_hash).slice(0, 3);
  const rows = [];
  let sequence = 0;
  for (const dimension of dimensions) {
    for (let index = 0; index < 3; index += 1) {
      const original = sourceRows[index % Math.max(1, sourceRows.length)] || canonical[index];
      const mutatedText = mutateText(original.requirement_text, dimension, index + 1);
      const sourceVerified = dimension !== 'context_only';
      let detected = false;
      let errorCode = null;
      try {
        const projected = buildCanonicalRequirements([rawCandidateFromCanonical(original, mutatedText, sourceVerified)], { qualityGate: true });
        detected = projected.length === 0 || projected[0].quality_gate_decision !== 'PASS';
      } catch (error) {
        detected = true;
        errorCode = error?.code || 'CANONICALIZATION_REJECTED';
      }
      sequence += 1;
      rows.push({
        mutation_id: `REQ-MUT-${String(sequence).padStart(3, '0')}`,
        dimension,
        injection_layer: 'CANONICAL_REQUIREMENT_INPUT',
        component_under_test: 'REQUIREMENT_QUALITY_GATE_V1',
        mutation_applied: mutatedText !== original.requirement_text,
        severity: p0Dimensions.has(dimension) ? 'P0' : 'P1',
        original_requirement_id: original.canonical_requirement_id,
        mutated_text_hash: sha256(mutatedText),
        raw_output_wrong: true,
        current_gate_detected: detected,
        routed_to_review: detected,
        escaped_as_accept: !detected,
        error_code: errorCode,
        expected: 'FAIL_CLOSED'
      });
    }
  }
  const p0 = rows.filter((row) => row.severity === 'P0');
  return {
    suite: 'REQUIREMENT_SEMANTIC_MUTATION_V1',
    total_cases: rows.length,
    p0_cases: p0.length,
    p0_detected_count: p0.filter((row) => row.current_gate_detected).length,
    p0_escape_count: p0.filter((row) => row.escaped_as_accept).length,
    p0_detection_recall: p0.length ? p0.filter((row) => row.current_gate_detected).length / p0.length : null,
    p0_escape_rate: p0.length ? p0.filter((row) => row.escaped_as_accept).length / p0.length : null,
    cases: rows
  };
}

export function safeProbeAudit(value) {
  const diagnostics = value && typeof value === 'object' ? value : {};
  return {
    gateway_http_status: Number.isInteger(diagnostics.gateway_http_status) ? diagnostics.gateway_http_status : null,
    gateway_error_code: typeof diagnostics.gateway_error_code === 'string' ? diagnostics.gateway_error_code : null,
    semantic_error_code: typeof diagnostics.semantic_error_code === 'string' ? diagnostics.semantic_error_code : null,
    provider_error_code: typeof diagnostics.provider_error_code === 'string' ? diagnostics.provider_error_code : null,
    provider_http_status: Number.isInteger(diagnostics.provider_http_status) ? diagnostics.provider_http_status : null,
    finish_reason: typeof diagnostics.finish_reason === 'string' ? diagnostics.finish_reason : null,
    prompt_tokens: Number.isInteger(diagnostics.prompt_tokens) ? diagnostics.prompt_tokens : null,
    completion_tokens: Number.isInteger(diagnostics.completion_tokens) ? diagnostics.completion_tokens : null,
    total_tokens: Number.isInteger(diagnostics.total_tokens) ? diagnostics.total_tokens : null,
    output_truncated: diagnostics.output_truncated === true,
    provider_adapter_invoked: diagnostics.provider_adapter_invoked === true,
    fetch_invoked: diagnostics.fetch_invoked === true,
    provider_http_reached: diagnostics.provider_http_reached === true,
    json_parse_success: typeof diagnostics.json_parse_success === 'boolean' ? diagnostics.json_parse_success : null,
    model_content_length_chars: Number.isInteger(diagnostics.model_content_length_chars) ? diagnostics.model_content_length_chars : null,
    response_format_type: diagnostics.response_format_type || null,
    safe_error_code: diagnostics.safe_error_code || null,
    safe_error_message: typeof diagnostics.safe_error_message === 'string' ? diagnostics.safe_error_message.slice(0, 240) : null
  };
}

function classifyLiveError(error, audit) {
  if (error?.code === 'GATEWAY_TIMEOUT' || error?.code === 'PROVIDER_TIMEOUT') return 'PROVIDER_TIMEOUT';
  if (error?.code === 'GATEWAY_NETWORK_ERROR' || error?.code === 'PROVIDER_NETWORK_ERROR') return 'PROVIDER_NETWORK';
  const gatewayStatus = audit.gateway_http_status || error?.audit?.gateway_http_status;
  const providerStatus = audit.provider_http_status || error?.audit?.provider_http_status;
  if (Number.isInteger(gatewayStatus) && gatewayStatus >= 500) return 'GATEWAY_5XX';
  if (Number.isInteger(gatewayStatus) && gatewayStatus >= 400) return 'GATEWAY_4XX';
  if (Number.isInteger(providerStatus) && providerStatus >= 500) return 'PROVIDER_5XX';
  if (Number.isInteger(providerStatus) && providerStatus >= 400) return 'PROVIDER_4XX';
  if (error?.code === 'GATEWAY_TRUNCATED_JSON') return 'TRUNCATED_JSON';
  if (error?.code === 'GATEWAY_INVALID_JSON') return 'INVALID_JSON';
  if (error?.code === 'GATEWAY_REQUIREMENTS_INVALID' || error?.code === 'SOURCE_LOCATION_UNRESOLVED') return 'SCHEMA_OR_SOURCE_INVALID';
  return error?.code || 'LIVE_PROVIDER_FAILURE';
}

export async function runLiveBenchmark(prepared, env) {
  const candidates = [];
  for (const item of prepared) {
    const sorted = [...item.chunks].sort((a, b) => {
      const score = (chunk) => {
        const text = String(chunk.text || '');
        return (text.match(/\d+(?:\.\d+)?/g) || []).length * 2
          + (text.match(/应|须|必须|不得|支持|性能|安全|服务|验收/g) || []).length;
      };
      return score(b) - score(a) || a.chunk_number - b.chunk_number;
    });
    const selected = [];
    const seen = new Set();
    for (const chunk of sorted) {
      if (selected.length >= LIVE_CHUNKS_PER_TENDER) break;
      if (seen.has(chunk.chunk_number)) continue;
      seen.add(chunk.chunk_number); selected.push(chunk);
    }
    for (const chunk of item.chunks) {
      if (selected.length >= LIVE_CHUNKS_PER_TENDER) break;
      if (!seen.has(chunk.chunk_number)) { seen.add(chunk.chunk_number); selected.push(chunk); }
    }
    for (const chunk of selected) candidates.push({ prepared: item, chunk });
  }
  const gateway = createRequirementExtractionGateway(createSemanticGatewayClientFromEnv({ env, taskType: TASK }));
  const rows = new Array(candidates.length);
  let cursor = 0;
  let calls = 0;
  const worker = async () => {
    while (true) {
      const index = cursor++;
      if (index >= candidates.length) return;
      const { prepared: item, chunk } = candidates[index];
      if (calls >= PROVIDER_CAP) {
        rows[index] = { tender_id: item.tender_id, chunk_number: chunk.chunk_number, status: 'NOT_EXECUTED_PROVIDER_CAP' };
        continue;
      }
      calls += 1;
      const input = resolveRequirementExtractionProviderInput({ chunk, fallbackText: chunk.text });
      const started = Date.now();
      let gatewayResult = null;
      let error = null;
      try {
        gatewayResult = await gateway.extract({
          fileName: item.source_file,
          text: input,
          paragraphs: chunk.segments,
          chunk,
          projectName: item.title,
          sectionName: item.tender_id,
          chunkCount: item.chunk_count,
          diagnosticMode: 'probe-v1'
        });
      } catch (caught) {
        error = caught;
      }
      const audit = safeProbeAudit(gatewayResult?.audit?.probe_diagnostics || error?.audit?.probe_diagnostics);
      let evaluation = null;
      let candidateCount = null;
      if (gatewayResult) {
        candidateCount = gatewayResult.candidates.length;
        evaluation = evaluateCandidatePayload({ candidates: gatewayResult.candidates, chunk, qualityGate: true });
      }
      rows[index] = {
        run_id: RUN_ID,
        tender_id: item.tender_id,
        chunk_number: chunk.chunk_number,
        source_refs: chunk.segments.map((segment) => segment.source_ref),
        input_sha256: sha256(input),
        input_length: input.length,
        started_at: new Date(started).toISOString(),
        finished_at: new Date().toISOString(),
        duration_ms: Date.now() - started,
        provider_call: 1,
        retries: 0,
        status: gatewayResult ? 'RESPONSE_RECEIVED' : 'FAILED',
        gateway_http_status: audit.gateway_http_status || error?.audit?.gateway_http_status || error?.audit?.http_status || null,
        provider_http_status: audit.provider_http_status,
        provider_chain_reached: audit.provider_adapter_invoked && audit.fetch_invoked && audit.provider_http_reached,
        response_shape: gatewayResult ? 'response_payload_json_envelope' : 'UNAVAILABLE',
        schema_pass: Boolean(gatewayResult),
        candidate_count: candidateCount,
        source_resolution_pass: evaluation?.source_resolution_success === true,
        source_resolution_failure_code: evaluation?.source_resolution_failure_code || null,
        source_resolution_failed_candidate_index: evaluation?.source_resolution_failed_candidate_index ?? null,
        canonicalization_pass: evaluation?.canonicalization_success === true,
        canonicalization_failure_code: evaluation?.canonicalization_failure_code || null,
        canonicalization_failed_candidate_index: evaluation?.canonicalization_failed_candidate_index ?? null,
        quality_gate_pass: evaluation?.quality_gate_decision === 'PASS',
        quality_gate_decision: evaluation?.quality_gate_decision || null,
        quality_gate_reason_codes: evaluation?.quality_gate_reason_codes || [],
        failure_stage: evaluation?.failure_stage || null,
        finish_reason: audit.finish_reason,
        prompt_tokens: audit.prompt_tokens,
        completion_tokens: audit.completion_tokens,
        output_truncated: audit.output_truncated,
        probe_audit: audit,
        error_code: error?.code || evaluation?.source_resolution_failure_code || evaluation?.canonicalization_failure_code || null,
        error_class: error ? classifyLiveError(error, audit) : (evaluation?.failure_stage || null)
      };
    }
  };
  await Promise.all([worker(), worker()]);
  const executed = rows.filter((row) => row?.provider_call === 1);
  const durations = executed.map((row) => row.duration_ms).sort((a, b) => a - b);
  const percentile = (values, q) => values.length ? values[Math.min(values.length - 1, Math.floor((values.length - 1) * q))] : null;
  const successes = executed.filter((row) => row.status === 'RESPONSE_RECEIVED');
  return {
    run_id: RUN_ID,
    task_type: TASK,
    live_cases: candidates.length,
    provider_calls: calls,
    provider_failures: executed.filter((row) => row.status !== 'RESPONSE_RECEIVED').length,
    retry_count: 0,
    truncation_count: executed.filter((row) => row.output_truncated).length,
    schema_valid_count: successes.filter((row) => row.schema_pass).length,
    source_resolution_pass_count: successes.filter((row) => row.source_resolution_pass).length,
    canonicalization_pass_count: successes.filter((row) => row.canonicalization_pass).length,
    latency_p50_ms: percentile(durations, 0.5),
    latency_p95_ms: percentile(durations, 0.95),
    tokens_input_total: executed.reduce((sum, row) => sum + (row.prompt_tokens || 0), 0),
    tokens_output_total: executed.reduce((sum, row) => sum + (row.completion_tokens || 0), 0),
    structural_source_fidelity: executed.length ? successes.filter((row) => row.source_resolution_pass).length / executed.length : null,
    quality_metrics: {
      LIVE_SUBSTANTIVE_RECALL: 'NOT_EVALUATED_NO_INDEPENDENT_LABELS',
      LIVE_PRECISION: 'NOT_EVALUATED_NO_INDEPENDENT_LABELS',
      LIVE_P0_ERROR_RATE: 'NOT_EVALUATED_NO_INDEPENDENT_LABELS',
      LIVE_P0_ESCAPE: 'NOT_EVALUATED_NO_INDEPENDENT_LABELS',
      LIVE_ATOMICITY: 'NOT_EVALUATED_NO_INDEPENDENT_LABELS',
      LIVE_SOURCE_FIDELITY: executed.length ? successes.filter((row) => row.source_resolution_pass).length / executed.length : 'NOT_EVALUATED'
    },
    cases: rows
  };
}

function buildCheckpoint({ identity, prepared, canonical, sampleRows, blindRows, mutation, live, preflight, phase = 'COMPLETE' }) {
  const traceable = canonical.filter((row) => row.source_verified === true && row.source_hash && row.source_excerpt).length;
  const reviewRows = sampleRows.filter((row) => row.semantic_judge_status !== 'PASS');
  const p0Mutation = mutation.p0_cases;
  const report = {
    checkpoint: 'V43_REQUIREMENT_PRODUCTION_SEMANTIC_AUDIT_CHECKPOINT',
    run_id: RUN_ID,
    phase,
    generated_at: new Date().toISOString(),
    TARGET_TENDERS: Object.keys(TENDERS),
    CANONICAL_REQUIREMENTS: canonical.length,
    OUTPUT_SEMANTIC_SAMPLE_SIZE: sampleRows.length,
    SOURCE_BLIND_WINDOW_COUNT: blindRows.length,
    SUBSTANTIVE_RECALL: 'NOT_EVALUATED_PENDING_BLIND_ADJUDICATION',
    MANDATORY_CRITICAL_RECALL: 'NOT_EVALUATED_PENDING_INDEPENDENT_ADJUDICATION',
    CANONICAL_PRECISION: 'NOT_EVALUATED_PENDING_INDEPENDENT_ADJUDICATION',
    SEMANTIC_FIDELITY: 'NOT_EVALUATED_PENDING_INDEPENDENT_ADJUDICATION',
    ATOMIC_OR_INTENTIONALLY_GROUPED_RATE: 'NOT_EVALUATED_PENDING_INDEPENDENT_ADJUDICATION',
    SEMANTIC_DUPLICATE_RATE: 'NOT_EVALUATED_PENDING_INDEPENDENT_ADJUDICATION',
    RAW_P0_ERROR_COUNT: p0Mutation,
    P0_DETECTED_COUNT: mutation.p0_detected_count,
    P0_REVIEW_ROUTED_COUNT: mutation.p0_detected_count,
    P0_ESCAPE_COUNT: mutation.p0_escape_count,
    P0_DETECTION_RECALL: mutation.p0_detection_recall,
    P0_ESCAPE_RATE: mutation.p0_escape_rate,
    ACTIONABLE_HUMAN_REVIEW_RATE: reviewRows.length ? 'NOT_EVALUATED_PENDING_HUMAN_OR_INDEPENDENT_JUDGE' : 0,
    SOURCE_TRACEABILITY_RATE: canonical.length ? traceable / canonical.length : null,
    SOURCE_SEMANTIC_MISMATCH: 'NOT_EVALUATED_BY_INDEPENDENT_ADJUDICATION',
    LIVE_CASES: live.live_cases,
    LIVE_PROVIDER_CALLS: live.provider_calls,
    LIVE_PROVIDER_FAILURES: live.provider_failures,
    LIVE_RETRY_RATE: live.provider_calls ? live.retry_count / live.provider_calls : 0,
    LIVE_TRUNCATION: live.truncation_count,
    LIVE_LATENCY_P50: live.latency_p50_ms,
    LIVE_LATENCY_P95: live.latency_p95_ms,
    PROJECTED_100_PAGE_RUNTIME_C2: live.latency_p95_ms == null ? 'NOT_COMPUTED_PROVIDER_UNAVAILABLE' : Math.ceil((100 * live.latency_p95_ms) / (2 * 8 * 1000)),
    MUTATION_CASES: mutation.total_cases,
    P0_MUTATION_DETECTION_RECALL: mutation.p0_detection_recall,
    P0_MUTATION_ESCAPE: mutation.p0_escape_rate,
    PATCH_CYCLES_USED: 0,
    TOKEN_DELTA: 'NOT_APPLICABLE_NO_PATCH',
    LATENCY_DELTA: 'NOT_APPLICABLE_NO_PATCH',
    PRODUCTION_DB_WRITES: 0,
    GOLD_MUTATIONS: 0,
    MAPPING_ACTIONS: 0,
    CLAIM_ACTIONS: 0,
    WRITER_ACTIONS: 0,
    PROVIDER_CALLS_TOTAL: live.provider_calls,
    PROVIDER_CALL_CAP: PROVIDER_CAP,
    REQUIREMENT_ENGINEERING_QUALITY: traceable === canonical.length && mutation.p0_escape_count === 0 ? 'PASS' : 'FAIL',
    REQUIREMENT_SEMANTIC_QUALITY: 'NOT_CERTIFIED_PENDING_INDEPENDENT_ADJUDICATION',
    REQUIREMENT_PERFORMANCE: live.provider_failures === 0 && live.truncation_count === 0 ? 'CONDITIONAL_PROVIDER_BENCHMARK_ONLY' : 'FAIL_PROVIDER_OR_TRANSPORT',
    REQUIREMENT_REVIEW_BURDEN: 'NOT_EVALUATED_PENDING_HUMAN_OR_INDEPENDENT_JUDGE',
    REQUIREMENT_EXTRACTION_PRODUCTION_READINESS: mutation.p0_escape_count > 0 || live.provider_failures > 0 ? 'FAIL' : 'CONDITIONAL_PASS_PENDING_SEMANTIC_CERTIFICATION',
    REQUIREMENT_MAPPING_INPUT_READY: mutation.p0_escape_count > 0 ? 'NO' : 'CONDITIONAL',
    semantic_certification: 'BLOCKED_NO_INDEPENDENT_HUMAN_OR_HOLDOUT_JUDGE',
    runtime_identity: identity,
    preflight,
    tender_preparation: prepared.map((item) => ({
      tender_id: item.tender_id,
      source_file: item.source_file,
      source_sha256: item.source_sha256,
      parser_status: item.parser_status,
      chunker_status: item.chunker_status,
      chunk_count: item.chunk_count,
      parser_character_count: item.parser_character_count,
      parser_paragraph_count: item.parser_paragraph_count
    })),
    side_effects: { production_db_writes: 0, gold_mutations: 0, mapping_actions: 0, claim_actions: 0, writer_actions: 0 },
    blockers: [
      'Independent semantic adjudication is not available in this run; semantic quality metrics remain NOT_EVALUATED.',
      ...(mutation.p0_escape_count > 0 ? ['Current canonicalization accepts injected P0 semantic mutations; P0 mutation gate is not fail-closed.'] : []),
      ...(live.provider_failures > 0 ? ['Live Provider benchmark has unrecovered failures; performance is provider-dependent.'] : [])
    ]
  };
  return report;
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const env = loadBackendEnvironment();
  const taskContract = getSemanticTaskContract(TASK);
  const runtimeConfig = readSemanticGatewayRuntimeConfig(env);
  const identity = {
    run_id: RUN_ID,
    branch: 'read-only-current-worktree',
    task_type: TASK,
    prompt_contract_version: taskContract.contract_version,
    prompt_instruction_hash: taskContract.instruction_hash,
    candidate_schema_hash: schemaSha256(taskContract.data_schema),
    chunker_rule_identity: sha256(fs.readFileSync(path.join(REPO, 'backend/src/pipeline/requirement-chunker.js'))),
    router_rule_identity: sha256(fs.readFileSync(path.join(REPO, 'backend/src/pipeline/requirement-scope-router.js'))),
    canonical_rule_version: '4.3-canonical-requirement-1',
    provider: runtimeConfig.provider,
    model: runtimeConfig.model,
    gateway_host: (() => { try { return new URL(runtimeConfig.gatewayApiBase).hostname; } catch { return null; } })(),
    provider_host: (() => { try { return new URL(runtimeConfig.providerApiBase).hostname; } catch { return null; } })(),
    provider_configured: Boolean(runtimeConfig.providerApiBase && runtimeConfig.providerApiKey && runtimeConfig.model),
    timeout_ms: runtimeConfig.timeoutMs,
    generation: {
      response_format: { type: 'json_schema', strict: true, schema_name: 'requirement_extraction_data', schema_hash: schemaSha256(taskContract.data_schema) },
      enable_thinking: env.SEMANTIC_GATEWAY_ENABLE_THINKING === 'true',
      temperature: Number(env.SEMANTIC_GATEWAY_TEMPERATURE || 0.1),
      max_tokens: Number(env.SEMANTIC_GATEWAY_MAX_TOKENS || 4800)
    },
    retry_count: 0,
    fallback_count: 0,
    dify_call_count: 0,
    chunk_budget: resolveRequirementChunkBudget(env),
    sensitive_values_logged: false
  };
  const preflight = {};
  if (runtimeConfig.gatewayApiBase) {
    for (const endpoint of ['health', 'ready', 'info']) preflight[`/${endpoint}`] = await safeGet(`${runtimeConfig.gatewayApiBase.replace(/\/+$/, '')}/${endpoint}`);
  } else {
    preflight.status = 'GATEWAY_NOT_CONFIGURED';
  }
  writeJson(path.join(DOCS, 'V43_REQUIREMENT_PRODUCTION_SEMANTIC_AUDIT_CHECKPOINT.json'), {
    checkpoint: 'V43_REQUIREMENT_PRODUCTION_SEMANTIC_AUDIT_CHECKPOINT',
    run_id: RUN_ID,
    phase: 'RUNTIME_IDENTITY_READY',
    runtime_identity: identity,
    env_summary: safeEnvSummary(env),
    preflight,
    provider_calls: 0,
    production_db_writes: 0,
    gold_mutations: 0
  });

  const canonicalInput = readJson(INPUT);
  const canonical = canonicalInput.requirements || [];
  const prepared = [];
  for (const tenderId of Object.keys(TENDERS)) prepared.push(await prepareTender(tenderId, env));
  const byTender = new Map(canonical.map((row) => [row.tender_id, []]));
  for (const row of canonical) byTender.get(row.tender_id)?.push(row);

  const census = canonical.map((row) => ({
    run_id: RUN_ID,
    tender_id: row.tender_id,
    canonical_requirement_id: row.canonical_requirement_id,
    requirement_hash: row.requirement_hash,
    ...riskFeatures(row),
    requirement_text: row.requirement_text,
    source_hash: row.source_hash,
    source_span: row.source_span,
    source_verified: row.source_verified === true
  }));
  writeJson(path.join(OUTPUT_DIR, 'deterministic-census.json'), {
    artifact_type: 'V43_REQUIREMENT_DETERMINISTIC_CENSUS',
    run_id: RUN_ID,
    count: census.length,
    provider_calls: 0,
    production_db_writes: 0,
    gold_mutations: 0,
    rows: census
  });

  const sampleRows = [];
  const reviewRows = [];
  for (const [tenderId, rows] of byTender) {
    for (const { row, features } of selectOutputSample(rows, tenderId)) {
      const sample = {
        run_id: RUN_ID,
        tender_id: tenderId,
        canonical_requirement_id: row.canonical_requirement_id,
        requirement_text: row.requirement_text,
        source_excerpt: preview(row.source_excerpt),
        source_hash: row.source_hash,
        source_span: row.source_span,
        features,
        semantic_judge_status: 'PENDING_HUMAN_OR_INDEPENDENT_JUDGE',
        semantic_decision: null,
        failure_type: null,
        severity: null,
        corrected_semantic_intent: null,
        atomicity_assessment: null,
        mapping_usability: 'NOT_EVALUATED',
        authority_note: 'Canonical input is source-backed but not a semantic Gold label.'
      };
      sampleRows.push(sample);
      if (features.risk_score >= 8 || features.RISK_FLAGS.includes('POSSIBLE_CONTEXT_ONLY')) reviewRows.push({ ...sample, review_reason: 'HIGH_RISK_OR_BOUNDARY_SAMPLE' });
    }
  }
  writeJsonl(path.join(DOCS, 'V43_REQUIREMENT_OUTPUT_SIDE_REVIEW.jsonl'), sampleRows);
  writeJson(path.join(OUTPUT_DIR, 'output-side-stratified-sample.json'), { run_id: RUN_ID, sample_count: sampleRows.length, per_tender: OUTPUT_SAMPLE_PER_TENDER, rows: sampleRows });

  const blindRows = prepared.flatMap(buildBlindWindows);
  writeJsonl(path.join(DOCS, 'V43_REQUIREMENT_SOURCE_SIDE_BLIND_RECALL.jsonl'), blindRows);

  const mutation = runMutationSuite(canonical);
  writeJson(path.join(OUTPUT_DIR, 'mutation-suite.json'), { run_id: RUN_ID, provider_calls: 0, production_db_writes: 0, gold_mutations: 0, ...mutation });

  writeJson(path.join(DOCS, 'V43_REQUIREMENT_PRODUCTION_SEMANTIC_AUDIT_CHECKPOINT.json'), {
    checkpoint: 'V43_REQUIREMENT_PRODUCTION_SEMANTIC_AUDIT_CHECKPOINT',
    run_id: RUN_ID,
    phase: 'PRE_LIVE_PREPARATION_COMPLETE',
    runtime_identity: identity,
    preflight,
    TARGET_TENDERS: Object.keys(TENDERS),
    CANONICAL_REQUIREMENTS: canonical.length,
    OUTPUT_SEMANTIC_SAMPLE_SIZE: sampleRows.length,
    SOURCE_BLIND_WINDOW_COUNT: blindRows.length,
    MUTATION_CASES: mutation.total_cases,
    P0_MUTATION_DETECTION_RECALL: mutation.p0_detection_recall,
    P0_MUTATION_ESCAPE: mutation.p0_escape_rate,
    provider_calls: 0,
    production_db_writes: 0,
    gold_mutations: 0
  });

  const live = await runLiveBenchmark(prepared, env);
  writeJson(path.join(DOCS, 'V43_REQUIREMENT_LIVE_BENCHMARK.json'), {
    artifact_type: 'V43_REQUIREMENT_EXTRACTION_LIVE_BENCHMARK',
    data_classification: 'REAL_TENDER_SOURCE_EVAL_ONLY',
    run_id: RUN_ID,
    runtime_identity: identity,
    provider_calls: live.provider_calls,
    production_db_writes: 0,
    gold_mutations: 0,
    ...live
  });
  const performance = {
    artifact_type: 'V43_REQUIREMENT_PERFORMANCE_REPORT',
    run_id: RUN_ID,
    provider: identity.provider,
    model: identity.model,
    live_cases: live.live_cases,
    provider_calls: live.provider_calls,
    failures: live.provider_failures,
    retry_rate: live.provider_calls ? live.retry_count / live.provider_calls : 0,
    truncation_count: live.truncation_count,
    schema_valid_count: live.schema_valid_count,
    latency_p50_ms: live.latency_p50_ms,
    latency_p95_ms: live.latency_p95_ms,
    tokens_input_total: live.tokens_input_total,
    tokens_output_total: live.tokens_output_total,
    projected_100_page_runtime_concurrency_2_ms: live.latency_p95_ms == null ? null : Math.ceil((100 * live.latency_p95_ms) / (2 * 8 * 1000)),
    projected_100_page_runtime_concurrency_3_ms: live.latency_p95_ms == null ? null : Math.ceil((100 * live.latency_p95_ms) / (3 * 8 * 1000)),
    performance_gate: live.provider_failures === 0 && live.truncation_count === 0 && live.retry_count / Math.max(1, live.provider_calls) <= 0.1 && (live.latency_p95_ms == null || live.latency_p95_ms <= 45000) ? 'CONDITIONAL_NO_SEMANTIC_CERTIFICATION' : 'FAIL_OR_PROVIDER_DEPENDENT',
    provider_calls_total: live.provider_calls,
    production_db_writes: 0,
    gold_mutations: 0
  };
  writeJson(path.join(DOCS, 'V43_REQUIREMENT_PERFORMANCE_REPORT.json'), performance);
  writeJson(path.join(DOCS, 'V43_REQUIREMENT_SEMANTIC_FAILURE_INVENTORY.json'), {
    artifact_type: 'V43_REQUIREMENT_SEMANTIC_FAILURE_INVENTORY',
    run_id: RUN_ID,
    taxonomy_version: 'V43_FROZEN_REQUIREMENT_SEMANTIC_FAILURE_TAXONOMY',
    independent_adjudication_available: false,
    p0_mutation_escape_count: mutation.p0_escape_count,
    p0_mutation_cases: mutation.cases.filter((row) => row.severity === 'P0'),
    known_debt_targets: [
      { issue: 'harmful_merge', status: 'NOT_EVALUATED_PENDING_SOURCE_SIDE_ADJUDICATION' },
      { issue: 'granularity', status: 'NOT_EVALUATED_PENDING_INDEPENDENT_ADJUDICATION' },
      { issue: 'duplicate', status: 'DETERMINISTIC_CENSUS_ONLY' },
      { issue: 'table_completeness', status: 'NOT_EVALUATED_PENDING_SOURCE_SIDE_ADJUDICATION' },
      { issue: 'subject_attribution', status: 'NOT_EVALUATED_PENDING_INDEPENDENT_ADJUDICATION' },
      { issue: 'requires_confirmation_semantics', status: 'CONTRACT_FIELDS_PRESENT_SEMANTIC_REVIEW_PENDING' }
    ],
    blockers: [
      'No independent semantic adjudicator or Human Gold was used; no semantic PASS is claimed.',
      ...(mutation.p0_escape_count ? ['P0 mutation cases are accepted by the current canonicalization boundary.'] : []),
      ...(live.provider_failures ? ['Live provider failures require transport/provider follow-up and do not become semantic labels.'] : [])
    ],
    provider_calls: live.provider_calls,
    production_db_writes: 0,
    gold_mutations: 0
  });
  writeJson(path.join(DOCS, 'V43_REQUIREMENT_REVIEW_REQUIRED_PACKET.json'), {
    artifact_type: 'V43_REQUIREMENT_REVIEW_REQUIRED_PACKET',
    run_id: RUN_ID,
    review_status: 'PENDING_HUMAN_OR_INDEPENDENT_AUTHORITY',
    case_count: reviewRows.length,
    cases: reviewRows,
    excluded_from_packet: sampleRows.length - reviewRows.length,
    provider_calls: 0,
    production_db_writes: 0,
    gold_mutations: 0
  });

  const report = buildCheckpoint({ identity, prepared, canonical, sampleRows, blindRows, mutation, live, preflight });
  writeJson(path.join(DOCS, 'V43_REQUIREMENT_PRODUCTION_SEMANTIC_AUDIT_CHECKPOINT.json'), report);
  const md = [
    '# V43_REQUIREMENT_PRODUCTION_SEMANTIC_AUDIT_CHECKPOINT',
    '',
    `- RUN_ID: ${RUN_ID}`,
    `- TARGET_TENDERS: ${Object.keys(TENDERS).join(', ')}`,
    `- CANONICAL_REQUIREMENTS: ${canonical.length}`,
    `- OUTPUT_SEMANTIC_SAMPLE_SIZE: ${sampleRows.length}`,
    `- SOURCE_BLIND_WINDOW_COUNT: ${blindRows.length}`,
    `- SOURCE_TRACEABILITY_RATE: ${report.SOURCE_TRACEABILITY_RATE}`,
    `- P0_MUTATION_DETECTION_RECALL: ${report.P0_MUTATION_DETECTION_RECALL}`,
    `- P0_MUTATION_ESCAPE: ${report.P0_MUTATION_ESCAPE}`,
    `- LIVE_CASES: ${live.live_cases}`,
    `- LIVE_PROVIDER_CALLS: ${live.provider_calls}`,
    `- LIVE_PROVIDER_FAILURES: ${live.provider_failures}`,
    `- LIVE_LATENCY_P50: ${live.latency_p50_ms ?? 'NOT_AVAILABLE'}`,
    `- LIVE_LATENCY_P95: ${live.latency_p95_ms ?? 'NOT_AVAILABLE'}`,
    `- PRODUCTION_DB_WRITES: 0`,
    `- GOLD_MUTATIONS: 0`,
    '',
    '## Verdicts',
    '',
    `- REQUIREMENT_ENGINEERING_QUALITY: ${report.REQUIREMENT_ENGINEERING_QUALITY}`,
    `- REQUIREMENT_SEMANTIC_QUALITY: ${report.REQUIREMENT_SEMANTIC_QUALITY}`,
    `- REQUIREMENT_PERFORMANCE: ${report.REQUIREMENT_PERFORMANCE}`,
    `- REQUIREMENT_REVIEW_BURDEN: ${report.REQUIREMENT_REVIEW_BURDEN}`,
    `- REQUIREMENT_EXTRACTION_PRODUCTION_READINESS: ${report.REQUIREMENT_EXTRACTION_PRODUCTION_READINESS}`,
    `- REQUIREMENT_MAPPING_INPUT_READY: ${report.REQUIREMENT_MAPPING_INPUT_READY}`,
    '',
    '## Blockers',
    '',
    ...report.blockers.map((item) => `- ${item}`),
    '',
    'Semantic metrics remain NOT_EVALUATED until an independent Human/Holdout adjudication is available. No Gold, Mapping, Claim, Fact, Writer or production state was changed.'
  ].join('\n');
  fs.writeFileSync(path.join(DOCS, 'V43_REQUIREMENT_PRODUCTION_SEMANTIC_AUDIT_CHECKPOINT.md'), `${md}\n`, 'utf8');
  console.log(JSON.stringify({
    checkpoint: 'V43_REQUIREMENT_PRODUCTION_SEMANTIC_AUDIT_CHECKPOINT',
    run_id: RUN_ID,
    canonical_requirements: canonical.length,
    output_sample: sampleRows.length,
    blind_windows: blindRows.length,
    mutation_cases: mutation.total_cases,
    p0_mutation_detection_recall: mutation.p0_detection_recall,
    p0_mutation_escape: mutation.p0_escape_rate,
    live_cases: live.live_cases,
    provider_calls: live.provider_calls,
    provider_failures: live.provider_failures,
    production_db_writes: 0,
    gold_mutations: 0,
    verdict: report.REQUIREMENT_EXTRACTION_PRODUCTION_READINESS
  }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(JSON.stringify({ error_code: error?.code || 'REQUIREMENT_SEMANTIC_AUDIT_FAILED', message: String(error?.message || '').slice(0, 240) }));
    process.exitCode = 1;
  });
}
