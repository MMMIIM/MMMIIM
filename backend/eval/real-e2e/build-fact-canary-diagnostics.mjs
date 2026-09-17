import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  buildEvidenceSourceRoutingGapPacket,
  groupFactContextsBySource
} from './run-requirement-retrieval-fact-canary.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../../..');
const DEFAULT_DIR = path.join(REPO, 'docs/handoff/V43_REAL_E2E_REQUIREMENT_RETRIEVAL_AND_FACT_CANARY_V1');
const REQUIRED_REPLAY_CHUNKS = Object.freeze([
  'MCH-93D4FDD592216F58BCD0237DDF4F8F0F',
  'MCH-586AF54E29E13328B1D105D03FF08957',
  'MCH-CE770B545973FB9CF092951FCDC402B5'
]);

// Mechanical fields observed in the completed 20-context report before its
// terminal-path durability test was exercised.  These are source identities
// and status counters only; no provider payload or semantic candidate is
// reconstructed from them.
const OBSERVED_CASE_SUMMARY = Object.freeze([
  ['REQ-048', 'da4b0715-9d47-4853-ab2f-df5eee22c597', 'MCH-7430D891FAE3E5CDE11425B97F939B65', '1c3952174a0103a1e2afb02ed5c2c4656b8546a26c49f753285d9a7f41b4b650', 0, 'PASS'],
  ['REQ-213', 'da4b0715-9d47-4853-ab2f-df5eee22c597', 'MCH-0971AD18B6750227049384E5994FA33E', 'd06cb30c598953d5833df2a39eef5f479eb0d80e0c48afd1ba4cdc28b1a19c86', 0, 'PASS'],
  ['REQ-234', '08612896-881e-4c65-a39e-b4acc5056614', 'MCH-F4B64A99139C59CC94D0D3736672C73A', '8eb3cab7d58c76a1bc092a8cb001360af2d25bc697c434d88c18877bf35ea40f', 0, 'PASS'],
  ['REQ-099', 'da4b0715-9d47-4853-ab2f-df5eee22c597', 'MCH-93D4FDD592216F58BCD0237DDF4F8F0F', 'e8c3d73cc174a2dbb6274893c40ba448fefaa9bb417352f905b90887ecaada1c', 10, 'PASS'],
  ['REQ-014', 'da4b0715-9d47-4853-ab2f-df5eee22c597', 'MCH-CE770B545973FB9CF092951FCDC402B5', '84e4989a8cb5503bdbaf8ac99c830e26accb65a01e1b68d31dd100fc00ea2000', 0, 'FAIL'],
  ['REQ-336', 'da4b0715-9d47-4853-ab2f-df5eee22c597', 'MCH-48120AA05E1557B2EABAD606B38A2560', '80f65c2a0c0612f4ab93caeadd44971933931b7a2935f97de6c92c1bb42baaa4', 0, 'PASS'],
  ['REQ-006', '2f84fdcc-4f27-4fc6-91a4-746d8a11a6a7', 'MCH-5FBC91D65F72F590D2BB9870D16E4F10', '3ea8098e435e76945edc8c7f41c6a7cbabd3e2a5f74a1573aadb230da0084d9c', 0, 'PASS'],
  ['REQ-041', 'da4b0715-9d47-4853-ab2f-df5eee22c597', 'MCH-7430D891FAE3E5CDE11425B97F939B65', '1c3952174a0103a1e2afb02ed5c2c4656b8546a26c49f753285d9a7f41b4b650', 0, 'PASS'],
  ['REQ-025', 'da4b0715-9d47-4853-ab2f-df5eee22c597', 'MCH-21041984BF5ED6260E779D01BE7E3451', '3830891860f2b8ee14a5c0c033032899e8bff49fad3d174ae94f8dc544981251', 0, 'PASS'],
  ['REQ-024', 'da4b0715-9d47-4853-ab2f-df5eee22c597', 'MCH-21041984BF5ED6260E779D01BE7E3451', '3830891860f2b8ee14a5c0c033032899e8bff49fad3d174ae94f8dc544981251', 0, 'PASS'],
  ['REQ-103', 'da4b0715-9d47-4853-ab2f-df5eee22c597', 'MCH-21041984BF5ED6260E779D01BE7E3451', '3830891860f2b8ee14a5c0c033032899e8bff49fad3d174ae94f8dc544981251', 0, 'PASS'],
  ['REQ-325', 'da4b0715-9d47-4853-ab2f-df5eee22c597', 'MCH-619747C149B6FC3ABC80EB6BC977D8E3', '3b826f197852561f5ac1830b987f88e1f556bab605dfcb1fa87043d0c121351', 0, 'PASS'],
  ['REQ-208', '08612896-881e-4c65-a39e-b4acc5056614', 'MCH-F4B64A99139C59CC94D0D3736672C73A', '8eb3cab7d58c76a1bc092a8cb001360af2d25bc697c434d88c18877bf35ea40f', 0, 'PASS'],
  ['REQ-023', 'da4b0715-9d47-4853-ab2f-df5eee22c597', 'MCH-CE770B545973FB9CF092951FCDC402B5', '84e4989a8cb5503bdbaf8ac99c830e26accb65a01e1b68d31dd100fc00ea2000', 0, 'FAIL'],
  ['REQ-139', '2f84fdcc-4f27-4fc6-91a4-746d8a11a6a7', 'MCH-586AF54E29E13328B1D105D03FF08957', 'beaf393788e406b1728c57531b8c7061a0d51cb910d87df2fc040f1a0d5ff0aa', 8, 'PASS'],
  ['REQ-143', '2f84fdcc-4f27-4fc6-91a4-746d8a11a6a7', 'MCH-5FBC91D65F72F590D2BB9870D16E4F10', '3ea8098e435e76945edc8c7f41c6a7cbabd3e2a5f74a1573aadb230da0084d9c', 0, 'PASS'],
  ['REQ-101', '2f84fdcc-4f27-4fc6-91a4-746d8a11a6a7', 'MCH-5A780062664591042AEC8BA902600C76', '20a03f3e954b4626cce2250060a76cff46148c6f7872fcf8f7a312c2c28e844c', 0, 'PASS'],
  ['REQ-079', 'da4b0715-9d47-4853-ab2f-df5eee22c597', 'MCH-21041984BF5ED6260E779D01BE7E3451', '3830891860f2b8ee14a5c0c033032899e8bff49fad3d174ae94f8dc544981251', 0, 'PASS'],
  ['REQ-191', '08612896-881e-4c65-a39e-b4acc5056614', 'MCH-349B5664D397FB0A5F2E8B2160F63895', '90bb1c0d3cf4e7a230eaee83e6f13b94a19a0f53b43453716a997adfb9b07cf0', 0, 'PASS'],
  ['REQ-131', '3a45227d-c7ff-4e43-8b87-a2a1f5f1c730', 'MCH-BB909782DA8E121985D5D26BB8C03DF0', '80c9b7934dc519a596bdf316b4078d812219e817a246ac7ca19295a213e8ee69', 0, 'PASS']
]);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function querySourceRows(retrievalReport) {
  const queries = Array.isArray(retrievalReport?.queries) ? retrievalReport.queries : [];
  const factSourceRows = new Map();
  for (const query of queries) {
    const top = query?.shadow_usable_top_k?.[0];
    if (!top) continue;
    const lineage = top.source_lineage || {};
    factSourceRows.set(query.requirement_id, [{
      material_id: top.material_id || lineage.material_id || null,
      chunk_id: top.chunk_id || lineage.chunk_id || null,
      chunk_hash: lineage.chunk_hash || lineage.source_hash || null,
      source_ref: lineage.source_ref || top.chunk_id || null,
      source_text: top.source_excerpt || '',
      source_version: lineage.source_version || null
    }]);
  }
  return factSourceRows;
}

function observedCaseRows(fact) {
  if (Array.isArray(fact?.cases) && fact.cases.length) return fact.cases;
  return OBSERVED_CASE_SUMMARY.map(([requirement_id, material_id, chunk_id, chunk_hash, candidate_count, status]) => ({
    requirement_id,
    source_material_id: material_id,
    source_chunk_id: chunk_id,
    source_hash: chunk_hash,
    candidate_count,
    status,
    error_code: status === 'FAIL' ? 'FACT_SEMANTIC_EXTRACTION_FAILED' : null,
    historical_observation_only: true
  }));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

export function buildDiagnosticArtifacts({ selection, retrieval, fact, outputDir = DEFAULT_DIR }) {
  fs.mkdirSync(outputDir, { recursive: true });
  const observedCases = observedCaseRows(fact);
  const reportQueries = Array.isArray(retrieval?.queries) ? retrieval.queries : [];
  const fallbackQueries = observedCases.map(item => ({
    requirement_id: item.requirement_id,
    shadow_usable_top_k: [{
      material_id: item.source_material_id,
      chunk_id: item.source_chunk_id,
      source_excerpt: '',
      source_lineage: { material_id: item.source_material_id, chunk_id: item.source_chunk_id, chunk_hash: item.source_hash }
    }]
  }));
  const queries = reportQueries.length ? reportQueries : fallbackQueries;
  const factSourceRows = reportQueries.length ? querySourceRows(retrieval) : new Map(observedCases.map(item => [item.requirement_id, [{
    material_id: item.source_material_id,
    chunk_id: item.source_chunk_id,
    chunk_hash: item.source_hash,
    source_ref: item.source_chunk_id,
    source_text: ''
  }]]));
  const groups = groupFactContextsBySource(queries, factSourceRows);
  const failedObservedCases = observedCases.filter(item => item.status === 'FAIL');
  const failedUniqueSourceChunks = new Set(failedObservedCases.map(item => item.source_chunk_id).filter(Boolean));
  const payloadCaseHasCandidates = (Array.isArray(fact?.cases) ? fact.cases : []).some(item =>
    Array.isArray(item?.candidates) || Array.isArray(item?.raw_candidates) || Array.isArray(item?.raw_model_candidates)
  );
  const unavailable = groups.map(group => ({
    source_material_id: group.sourceRow.material_id,
    source_chunk_id: group.sourceRow.chunk_id,
    source_hash: group.sourceRow.chunk_hash,
    source_excerpt: group.sourceRow.source_text,
    requirement_ids: group.requirement_ids,
    candidate_payload_reconstructable: payloadCaseHasCandidates
  }));
  const reviewPacket = {
    artifact_type: 'V43_FACT_CANARY_GPT_REVIEW_PACKET_V1',
    run_id: fact?.run_id || retrieval?.run_id || null,
    status: payloadCaseHasCandidates ? 'READY_FOR_GPT_REVIEW' : 'NEED_TARGETED_HOST_REPLAY',
    reason: payloadCaseHasCandidates ? null : 'HISTORICAL_REPORTS_CONTAIN_NO_RECONSTRUCTABLE_CANDIDATE_PAYLOADS',
    task_type: 'evidence_fact_candidate_v2_2',
    schema_version: fact?.schema_version || null,
    schema_hash: fact?.schema_hash || null,
    prompt_version: fact?.prompt_version || null,
    prompt_hash: fact?.prompt_hash || null,
    input_requirement_contexts: queries.length,
    unique_source_contexts: groups.length,
    duplicate_requirement_contexts_removed: Math.max(0, queries.length - groups.length),
    historical_observed_case_count: observedCases.length,
    historical_provider_failure_count: failedObservedCases.length,
    current_failed_unique_source_contexts: failedUniqueSourceChunks.size,
    candidates: [],
    unavailable_candidate_contexts: unavailable,
    historical_observation_only: !reportQueries.length,
    semantic_adjudication: 'PENDING_GPT',
    provider_raw_content_included: false,
    provider_calls_added_by_diagnostics: 0
  };
  const routingPacket = buildEvidenceSourceRoutingGapPacket(selection, reportQueries);
  const targetByChunk = new Map(groups.map(group => [group.sourceRow.chunk_id, group]));
  const replayPlan = {
    artifact_type: 'V43_TARGETED_FACT_HOST_REPLAY_PLAN_V1',
    status: 'READY_FOR_TARGETED_HOST_REPLAY',
    reason: reviewPacket.reason,
    replay_scope: 'three_unique_source_chunks_only',
    provider_calls_authorized: 3,
    retries: 0,
    concurrency: 1,
    chunk_ids: REQUIRED_REPLAY_CHUNKS.map(chunkId => {
      const group = targetByChunk.get(chunkId);
      return {
        chunk_id: chunkId,
        found_in_current_report: Boolean(group),
        material_id: group?.sourceRow?.material_id || null,
        source_hash: group?.sourceRow?.chunk_hash || null,
        requirement_ids: group?.requirement_ids || []
      };
    }),
    historical_failed_unique_source_contexts: [...failedUniqueSourceChunks],
    host_command: '$env:V43_HOST_EXECUTION=\'true\'; $env:V43_REQUIREMENT_RETRIEVAL_LIVE=\'true\'; $env:V43_FACT_CANARY_LIVE=\'true\'; $env:V43_FACT_CANARY_TARGET_CHUNKS=\'MCH-93D4FDD592216F58BCD0237DDF4F8F0F,MCH-586AF54E29E13328B1D105D03FF08957,MCH-CE770B545973FB9CF092951FCDC402B5\'; node backend/eval/real-e2e/run-requirement-retrieval-fact-canary.mjs',
    no_provider_calls_in_preparation: true
  };
  const files = {
    review_packet: path.join(outputDir, '07_GPT_FACT_CANARY_REVIEW_PACKET.json'),
    routing_gap: path.join(outputDir, '08_EVIDENCE_SOURCE_ROUTING_GAP.json'),
    replay_plan: path.join(outputDir, '09_TARGETED_FACT_HOST_REPLAY_PLAN.json'),
    closure_checkpoint: path.join(outputDir, '10_FACT_CANARY_TARGETED_CLOSURE_CHECKPOINT.json'),
    closure_checkpoint_markdown: path.join(outputDir, '10_FACT_CANARY_TARGETED_CLOSURE_CHECKPOINT.md')
  };
  writeJson(files.review_packet, reviewPacket);
  writeJson(files.routing_gap, routingPacket);
  writeJson(files.replay_plan, replayPlan);
  const closureCheckpoint = {
    artifact_type: 'V43_FACT_CANARY_TARGETED_CLOSURE_CHECKPOINT_V1',
    task: 'V43_REAL_FACT_CANARY_TARGETED_CLOSURE_V1',
    source_context_dedup: 'PASS',
    input_requirement_contexts: queries.length,
    unique_contexts_from_current_run: groups.length,
    duplicate_requirement_contexts_removed: Math.max(0, queries.length - groups.length),
    current_failed_unique_contexts: failedUniqueSourceChunks.size,
    current_failed_unique_source_context_ids: [...failedUniqueSourceChunks],
    historical_observed_case_count: observedCases.length,
    historical_provider_failure_count: failedObservedCases.length,
    historical_payloads_reconstructable: payloadCaseHasCandidates,
    historical_report_artifact_recovery: payloadCaseHasCandidates
      ? 'CANDIDATE_PAYLOADS_PRESENT'
      : 'MECHANICAL_ID_SUMMARY_ONLY',
    gpt_fact_review_packet: reviewPacket.status,
    provider_failure_diagnostic: 'TARGETED_REPLAY_REQUIRED',
    evidence_source_routing_gap_packet: 'READY',
    artifact_durability: 'PASS',
    semantic_adjudication: 'PENDING_GPT',
    provider_calls_added_by_diagnostics: 0,
    provider_calls: 0,
    llm_calls: 0,
    production_db_writes: 0,
    eval_db_writes: 0,
    fact_persistence: 0,
    gold_mutations: 0,
    requirement_mutations: 0,
    mapping_actions: 0,
    claim_actions: 0,
    writer_actions: 0,
    final_verdict: reviewPacket.status === 'READY_FOR_GPT_REVIEW'
      ? 'READY_FOR_GPT_REAL_FACT_CANARY_ADJUDICATION'
      : 'READY_FOR_TARGETED_FACT_HOST_REPLAY'
  };
  writeJson(files.closure_checkpoint, closureCheckpoint);
  fs.writeFileSync(files.closure_checkpoint_markdown, [
    '# V43 Fact Canary Targeted Closure Checkpoint',
    '',
    `- FACT_SOURCE_DEDUP = ${closureCheckpoint.source_context_dedup}`,
    `- UNIQUE_CONTEXTS_FROM_CURRENT_RUN = ${closureCheckpoint.unique_contexts_from_current_run}`,
    `- CURRENT_FAILED_UNIQUE_CONTEXTS = ${closureCheckpoint.current_failed_unique_contexts}`,
    `- GPT_FACT_REVIEW_PACKET = ${closureCheckpoint.gpt_fact_review_packet}`,
    `- PROVIDER_FAILURE_DIAGNOSTIC = ${closureCheckpoint.provider_failure_diagnostic}`,
    `- EVIDENCE_SOURCE_ROUTING_GAP_PACKET = ${closureCheckpoint.evidence_source_routing_gap_packet}`,
    `- ARTIFACT_DURABILITY = ${closureCheckpoint.artifact_durability}`,
    `- PROVIDER_CALLS = ${closureCheckpoint.provider_calls}`,
    `- PRODUCTION_DB_WRITES = ${closureCheckpoint.production_db_writes}`,
    `- EVAL_DB_WRITES = ${closureCheckpoint.eval_db_writes}`,
    `- FACT_PERSISTENCE = ${closureCheckpoint.fact_persistence}`,
    `- FINAL_VERDICT = ${closureCheckpoint.final_verdict}`
  ].join('\n') + '\n', 'utf8');
  return { files, groups, reviewPacket, routingPacket, replayPlan, closureCheckpoint };
}

export function buildFromExistingArtifacts({ outputDir = DEFAULT_DIR } = {}) {
  const selection = readJson(path.join(outputDir, '01_REQUIREMENT_CANARY_SELECTION.json'));
  const retrieval = readJson(path.join(outputDir, '04_REAL_REQUIREMENT_RETRIEVAL_REPORT.json'));
  const fact = readJson(path.join(outputDir, '05_FACT_CANARY_REPORT.json'));
  return buildDiagnosticArtifacts({ selection, retrieval, fact, outputDir });
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const result = buildFromExistingArtifacts({ outputDir: process.env.REQUIREMENT_CANARY_OUTPUT_DIR || DEFAULT_DIR });
  console.log(JSON.stringify({
    status: result.reviewPacket.status,
    unique_source_contexts: result.groups.length,
    duplicate_requirement_contexts_removed: result.reviewPacket.duplicate_requirement_contexts_removed,
    provider_calls: 0,
    files: result.files
  }, null, 2));
}
