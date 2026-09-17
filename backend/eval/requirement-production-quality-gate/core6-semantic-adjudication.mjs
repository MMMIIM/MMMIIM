import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { prepareTender } from '../requirement-semantic-quality-v1/runner.js';
import {
  getSemanticTaskContract,
  getSemanticTaskInstructionMetadata,
  schemaSha256
} from '../../../packages/semantic-contracts/index.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../../..');
const DOCS = path.join(REPO, 'docs');
const RUN_ID = 'req-core6-fresh-20260907133003259-49044f2a';
const RUN_DIR = path.join(REPO, 'backend/eval/requirement-production-quality-gate/results', RUN_ID);
const TELEMETRY_PATH = path.join(RUN_DIR, 'case-telemetry.jsonl');
const CHECKPOINT_PATH = path.join(RUN_DIR, 'checkpoint.json');
const SOURCE_SIDE_PATH = path.join(DOCS, 'V43_REQUIREMENT_SOURCE_SIDE_BLIND_RECALL.jsonl');
const MANIFEST_PATH = path.join(DOCS, 'V43_REQUIREMENT_21_MISS_MANIFEST.json');
const PACKET_PATH = path.join(DOCS, 'V43_REQUIREMENT_CORE6_GPT_SEMANTIC_REVIEW_PACKET.json');
const ROUTING_PATH = path.join(DOCS, 'V43_REQUIREMENT_CORE6_ROUTER_REACHABILITY_AUDIT.json');
const CHECKPOINT_OUT = path.join(DOCS, 'V43_REQUIREMENT_CORE6_SEMANTIC_ADJUDICATION_CHECKPOINT.json');
const CHECKPOINT_MD = path.join(DOCS, 'V43_REQUIREMENT_CORE6_SEMANTIC_ADJUDICATION_CHECKPOINT.md');
const TARGET_IDS = Object.freeze([
  'JY-001-BLIND-10-E02',
  'FAST-01-BLIND-03-E01',
  'FAST-01-BLIND-03-E02'
]);
const CORE6_IDS = Object.freeze([
  'JY-001-BLIND-10-E01',
  'JY-001-BLIND-10-E02',
  'FAST-01-BLIND-03-E01',
  'FAST-01-BLIND-03-E02',
  'FAST-01-BLIND-08-E01',
  'FAST-01-BLIND-08-E02'
]);
const sha256 = value => crypto.createHash('sha256')
  .update(Buffer.isBuffer(value) ? value : String(value ?? ''), 'utf8')
  .digest('hex');
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const readJsonl = file => fs.readFileSync(file, 'utf8')
  .split(/\r?\n/u)
  .filter(Boolean)
  .map(line => JSON.parse(line));
const writeJson = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
const normalized = value => String(value || '').replace(/\s+/gu, '').toLowerCase();

function selectedPromptClauses(instruction) {
  const categories = [
    ['allowed_extraction', /提取范围|明确范围定义|背景中的明确项目约束/u],
    ['forbidden_extraction', /不要提取|禁止推断|价格、单价、评分/u],
    ['scoring_and_evaluation', /评分|评标|评分项|分值/u],
    ['bid_response_requirements', /投标响应|响应义务|投标文件|证明材料/u],
    ['plans_and_measures', /方案|措施|实施|交付|验收/u],
    ['technical_requirements', /技术要求|功能要求|性能、容量|接口与集成/u]
  ];
  return String(instruction || '').split(/\n\s*\n/u).map((text, index) => {
    const matched = categories.filter(([, pattern]) => pattern.test(text)).map(([name]) => name);
    return matched.length ? { clause_index: index, categories: matched, text } : null;
  }).filter(Boolean);
}

function headingLike(text) {
  const value = String(text || '').trim();
  return /^(?:[一二三四五六七八九十百]+[、.．]|\d+(?:\.\d+)*\s|第[一二三四五六七八九十百]+[章节条]|.*(?:组成|要求|方案|标准|编制|功能演示|服务范围))/u.test(value);
}

function buildNaturalAudit(prepared, row) {
  const expectedRefs = Array.isArray(row.source_refs) ? row.source_refs : [];
  const expectedSet = new Set(expectedRefs);
  const naturalChunks = (prepared.chunks || []).filter(chunk => (chunk.segments || [])
    .some(segment => expectedSet.has(segment.source_ref)));
  const naturalWindowIds = naturalChunks.map(chunk => `${prepared.tender_id}-CHUNK-${String(chunk.chunk_number).padStart(2, '0')}`);
  const naturalWindowSourceRefs = naturalChunks.map(chunk => ({
    window_id: `${prepared.tender_id}-CHUNK-${String(chunk.chunk_number).padStart(2, '0')}`,
    source_refs: (chunk.segments || []).map(segment => segment.source_ref).filter(Boolean)
  }));
  const covered = naturalChunks.flatMap(chunk => (chunk.segments || []).map(segment => segment.source_ref))
    .filter(ref => expectedSet.has(ref));
  const uniqueCovered = [...new Set(covered)];
  const primaryChunk = naturalChunks[0] || null;
  const primarySegments = primaryChunk?.segments || [];
  const firstIndex = primarySegments.findIndex(segment => expectedSet.has(segment.source_ref));
  const lastIndex = [...primarySegments].reverse().findIndex(segment => expectedSet.has(segment.source_ref));
  const lastIndexForward = lastIndex < 0 ? -1 : primarySegments.length - 1 - lastIndex;
  const neighborhood = firstIndex >= 0 && lastIndexForward >= firstIndex
    ? primarySegments.slice(Math.max(0, firstIndex - 8), Math.min(primarySegments.length, lastIndexForward + 9))
    : [];
  const parentHeadingPresent = neighborhood.some(segment => !expectedSet.has(segment.source_ref) && headingLike(segment.text));
  const tableHeaderPresent = neighborhood.some(segment => String(segment.semantic_unit_type || '').toUpperCase() === 'TABLE_HEADER'
    || /(?:数量|单位|型号|参数|指标|服务期限)/u.test(String(segment.text || '')) && String(segment.semantic_unit_type || '').toUpperCase().includes('TABLE'));
  const necessaryNeighborPresent = firstIndex >= 0
    && lastIndexForward >= firstIndex
    && (firstIndex > 0 || lastIndexForward < primarySegments.length - 1);
  const expectedTextPresent = Boolean(primaryChunk && normalized(primaryChunk.text).includes(normalized(row.source_excerpt)));
  const naturallyRouted = uniqueCovered.length === expectedRefs.length && expectedRefs.length > 0;
  const contextIntegrity = !naturallyRouted
    ? 'NOT_REACHED'
    : (!expectedTextPresent || !necessaryNeighborPresent ? 'DAMAGED' : 'PASS');
  const routingDiagnosis = !naturallyRouted
    ? 'S0_CURRENT_SOURCE_SCOPE_MISS'
    : contextIntegrity === 'DAMAGED'
      ? 'S1_CURRENT_INPUT_CONTEXT_DAMAGE'
      : 'ROUTER_CONTEXT_PASS';
  return {
    expected_id: row.expected_id,
    tender_id: row.tender_id,
    window_id: row.window_id,
    expected_source_refs: expectedRefs,
    naturally_routed: naturallyRouted ? 'YES' : 'NO',
    natural_window_ids: naturalWindowIds,
    natural_window_source_refs: naturalWindowSourceRefs,
    expected_refs_covered: uniqueCovered,
    expected_text_present: expectedTextPresent,
    parent_heading_present: parentHeadingPresent,
    table_header_present: tableHeaderPresent,
    necessary_neighbor_present: necessaryNeighborPresent,
    context_integrity: contextIntegrity,
    routing_diagnosis: routingDiagnosis,
    natural_window_text: primaryChunk?.text || null,
    natural_window_segment_count: primarySegments.length,
    special_case_checks: {
      jy_full_action_present: prepared.tender_id === 'JY-001'
        ? normalized(primaryChunk?.text || '').includes(normalized('并下发指令，街道和社区可接受指令并反馈内容'))
        : null,
      fast_scoring_obligation_context_present: prepared.tender_id === 'FAST-01' && row.window_id === 'FAST-01-BLIND-03'
        ? normalized(primaryChunk?.text || '').includes(normalized('项目重点难点分析、应对措施及相关的合理化建议'))
          && normalized(primaryChunk?.text || '').includes(normalized('质量保障措施'))
        : null
    },
    source_sha256: prepared.source_sha256
  };
}

function main() {
  const telemetry = readJsonl(TELEMETRY_PATH);
  const checkpoint = readJson(CHECKPOINT_PATH);
  const manifest = readJson(MANIFEST_PATH);
  const sourceRows = readJsonl(SOURCE_SIDE_PATH);
  const byId = new Map(telemetry.map(row => [row.expected_id, row]));
  const manifestById = new Map((manifest.cases || []).map(row => [row.expected_id, row]));
  const sourceByWindow = new Map(sourceRows.map(row => [`${row.tender_id}::${row.window_id}`, row]));
  const contract = getSemanticTaskContract('requirement_extraction');
  const instructionMeta = getSemanticTaskInstructionMetadata('requirement_extraction');
  const promptClauses = selectedPromptClauses(instructionMeta.instruction);
  const preparedCache = new Map();
  const getPrepared = async tenderId => {
    if (!preparedCache.has(tenderId)) preparedCache.set(tenderId, prepareTender(tenderId, {}));
    return preparedCache.get(tenderId);
  };
  return Promise.all(CORE6_IDS.map(async expectedId => {
    const row = byId.get(expectedId);
    if (!row) throw new Error(`Missing Core6 telemetry row: ${expectedId}`);
    const sourceRow = sourceByWindow.get(`${row.tender_id}::${row.window_id}`);
    const prepared = await getPrepared(row.tender_id);
    return { row, sourceRow, prepared, routing: buildNaturalAudit(prepared, { ...row, source_refs: sourceRow?.source_refs || row.source_refs }) };
  })).then(items => {
    const audits = items.map(item => item.routing);
    const targetItems = items.filter(item => TARGET_IDS.includes(item.row.expected_id));
    const cases = targetItems.map(({ row, sourceRow, routing }) => {
      const manifestRow = manifestById.get(row.expected_id) || {};
      const sourceRefs = sourceRow?.source_refs || row.source_refs || [];
      return {
        expected_id: row.expected_id,
        tender_id: row.tender_id,
        window_id: row.window_id,
        development_expected_requirement: manifestRow.expected_requirement || null,
        development_source_excerpt: manifestRow.source_excerpt || sourceRow?.source_excerpt || null,
        source_refs: sourceRefs,
        current_semantic_window_text: row.semantic_window_text || null,
        actual_provider_input: row.provider_input || null,
        heading_visible: row.heading_visible === true,
        table_header_visible: row.table_header_visible === true,
        neighbor_context_visible: row.neighbor_context_visible === true,
        section_identity: row.section_identity || [],
        routing_roles: [...new Set((row.source_refs || []).map(ref => {
          const natural = routing.natural_window_source_refs.flatMap(item => item.source_refs);
          return natural.includes(ref) ? 'UNKNOWN' : 'NOT_REACHED';
        }))],
        provider_model: row.audit?.response_model || row.audit?.provider_model || null,
        prompt_instruction_hash: checkpoint.runtime_identity?.prompt_instruction_hash || instructionMeta.instruction_hash,
        schema_hash: checkpoint.runtime_identity?.candidate_schema_hash || checkpoint.runtime_identity?.task_data_schema_hash || schemaSha256(contract.data_schema),
        task_data_schema_hash: checkpoint.runtime_identity?.task_data_schema_hash || schemaSha256(contract.data_schema),
        candidate_schema_hash: checkpoint.runtime_identity?.candidate_schema_hash || null,
        provider_http_status: row.provider_http?.provider_http_status ?? row.audit?.provider_http_status ?? null,
        gateway_http_status: row.provider_http?.gateway_http_status ?? row.audit?.gateway_http_status ?? null,
        finish_reason: row.provider_http?.finish_reason || row.audit?.finish_reason || null,
        candidate_outputs: row.candidate_outputs || [],
        canonical_outputs: row.canonical_outputs || [],
        source_resolution_result: row.source_resolution_result || null,
        quality_gate_decision: row.filter_events?.at(-1)?.quality_gate_decision || null,
        quality_gate_reason_codes: row.filter_events?.at(-1)?.reason_codes || [],
        deterministic_bigram_coverage: row.offline_alignment || null,
        current_provisional_classification: row.current_runtime_classification || row.final_alignment || null,
        empty_candidate_on_explicit_scoring_response_obligation: row.candidate_outputs?.length === 0
          && ['FAST-01-BLIND-03-E01', 'FAST-01-BLIND-03-E02'].includes(row.expected_id),
        special_case_checks: {
          jy_full_action_present_in_natural_source: routing.special_case_checks.jy_full_action_present,
          fast_scoring_obligation_context_present_in_natural_source: routing.special_case_checks.fast_scoring_obligation_context_present,
          fast_scoring_obligation_context_present_in_provider_input: ['FAST-01-BLIND-03-E01', 'FAST-01-BLIND-03-E02'].includes(row.expected_id)
            ? normalized(row.provider_input || '').includes(normalized('项目重点难点分析、应对措施及相关的合理化建议'))
              && normalized(row.provider_input || '').includes(normalized('质量保障措施'))
            : null,
          empty_candidate_on_explicit_scoring_response_obligation: row.candidate_outputs?.length === 0
            && ['FAST-01-BLIND-03-E01', 'FAST-01-BLIND-03-E02'].includes(row.expected_id)
        },
        natural_router_audit: routing,
        source_side_status: sourceRow?.status || null,
        source_sha256: row.source_sha256 || sourceRow?.source_sha256 || null
      };
    });
    const packet = {
      checkpoint: 'V43_REQUIREMENT_CORE6_GPT_SEMANTIC_REVIEW_PACKET',
      artifact_version: 'v1',
      generated_at: new Date().toISOString(),
      authority: 'GPT_SEMANTIC_ADJUDICATION_REQUIRED',
      run_id: RUN_ID,
      source_run_artifacts: [
        'backend/eval/requirement-production-quality-gate/results/req-core6-fresh-20260907133003259-49044f2a/case-telemetry.jsonl',
        'backend/eval/requirement-production-quality-gate/results/req-core6-fresh-20260907133003259-49044f2a/checkpoint.json',
        'backend/eval/requirement-production-quality-gate/results/req-core6-fresh-20260907133003259-49044f2a/preflight.json'
      ],
      no_provider_call: true,
      cases,
      current_prompt_scope_evidence: {
        task_type: instructionMeta.task_type,
        contract_version: instructionMeta.contract_version,
        instruction_hash: instructionMeta.instruction_hash,
        clauses: promptClauses,
        CURRENT_PROMPT_SCOPE_INTERPRETATION: {
          allowed: 'Prompt explicitly permits extraction of explicit bid-response obligations, including technical, performance, implementation, delivery, acceptance, personnel, and requested proof/document requirements.',
          scoring: 'Prompt excludes score/price/evaluation-only text, while obligations in a scoring section remain eligible when the text itself states a response obligation.',
          plans_and_measures: 'Prompt includes implementation/delivery/acceptance and other response obligations; solution-plan or measure wording is not excluded when it is an explicit response requirement.',
          technical: 'Prompt explicitly includes functional, technical, performance, data, interface/integration, deployment/compatibility, and security requirements.',
          boundary: 'Prompt forbids background-only text, headings alone, process/contact text, inferred facts, and invented values or conditions.'
        }
      },
      router_reachability_audit: audits,
      interpretation: {
        CORE6_TARGET_WINDOW_PRODUCER_REPRODUCTION: 'COMPLETE',
        CORE6_PRODUCTION_ROUTER_COVERAGE: audits.every(a => a.context_integrity === 'PASS') ? 'PASS' : audits.some(a => a.context_integrity === 'PASS') ? 'MIXED' : 'FAIL',
        S0_ROUTING_CONFIRMED: audits.filter(a => a.routing_diagnosis === 'S0_CURRENT_SOURCE_SCOPE_MISS').map(a => a.expected_id),
        S1_CONTEXT_CONFIRMED: audits.filter(a => a.routing_diagnosis === 'S1_CURRENT_INPUT_CONTEXT_DAMAGE').map(a => a.expected_id),
        S2_REQUIRES_GPT_SEMANTIC_ADJUDICATION: TARGET_IDS,
        CORE6_DETERMINISTIC_ALIGNMENT_RATE: checkpoint.CURRENT_CORE6_RECALL,
        P0_ESCAPE: 'NOT_YET_SEMANTICALLY_ADJUDICATED'
      },
      side_effects: {
        PROVIDER_CALLS: 0,
        REQUIREMENT_LIVE_CALLS: 0,
        PRODUCTION_DB_WRITES: 0,
        GOLD_MUTATIONS: 0,
        FACT_CALLS: 0,
        MAPPING_CALLS: 0,
        CLAIM_CALLS: 0,
        WRITER_CALLS: 0
      }
    };
    writeJson(PACKET_PATH, packet);
    writeJson(ROUTING_PATH, {
      checkpoint: 'V43_REQUIREMENT_CORE6_ROUTER_REACHABILITY_AUDIT',
      generated_at: packet.generated_at,
      input: 'original tender PDF -> current parser -> current requirement scope router -> current semantic chunker',
      source_refs_used_as_window_seed: false,
      provider_calls: 0,
      audits
    });
    const finalCheckpoint = {
      checkpoint: 'V43_REQUIREMENT_CORE6_SEMANTIC_ADJUDICATION_CHECKPOINT',
      run_id: RUN_ID,
      TARGET_WINDOW_REPRODUCTION: 'COMPLETE',
      PRODUCTION_ROUTER_COVERAGE: packet.interpretation.CORE6_PRODUCTION_ROUTER_COVERAGE,
      S0_ROUTING_CONFIRMED: packet.interpretation.S0_ROUTING_CONFIRMED,
      S1_CONTEXT_CONFIRMED: packet.interpretation.S1_CONTEXT_CONFIRMED,
      PROVISIONAL_S2_COUNT: TARGET_IDS.length,
      GPT_PACKET_CASE_COUNT: cases.length,
      PROMPT_SCOPE_EVIDENCE_READY: promptClauses.length > 0 ? 'YES' : 'NO',
      CORE6_DETERMINISTIC_ALIGNMENT_RATE: checkpoint.CURRENT_CORE6_RECALL,
      P0_ESCAPE: 'NOT_YET_SEMANTICALLY_ADJUDICATED',
      PROVIDER_CALLS: 0,
      REQUIREMENT_LIVE_CALLS: 0,
      PRODUCTION_DB_WRITES: 0,
      GOLD_MUTATIONS: 0,
      PROMPT_CHANGED: 'NO',
      SCHEMA_CHANGED: 'NO',
      ROUTER_CHANGED: 'NO',
      CHUNKER_CHANGED: 'NO',
      CANONICALIZER_CHANGED: 'NO',
      packet_path: path.relative(REPO, PACKET_PATH).replaceAll('\\', '/'),
      routing_audit_path: path.relative(REPO, ROUTING_PATH).replaceAll('\\', '/'),
      stop_condition: 'RETURN_FOR_GPT_SEMANTIC_REVIEW'
    };
    writeJson(CHECKPOINT_OUT, finalCheckpoint);
    fs.writeFileSync(CHECKPOINT_MD, `${Object.entries(finalCheckpoint).map(([key, value]) => `${key} = ${typeof value === 'string' ? value : JSON.stringify(value)}`).join('\n')}\n`, 'utf8');
    console.log(JSON.stringify({
      packet: path.relative(REPO, PACKET_PATH),
      routing_audit: path.relative(REPO, ROUTING_PATH),
      checkpoint: path.relative(REPO, CHECKPOINT_OUT),
      cases: cases.length,
      router_coverage: packet.interpretation.CORE6_PRODUCTION_ROUTER_COVERAGE,
      s0: packet.interpretation.S0_ROUTING_CONFIRMED,
      s1: packet.interpretation.S1_CONTEXT_CONFIRMED,
      provider_calls: 0,
      production_db_writes: 0,
      gold_mutations: 0
    }, null, 2));
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}

export { buildNaturalAudit, selectedPromptClauses };
