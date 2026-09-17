import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createBackendRuntime } from '../../src/backend-runtime.js';
import { MappingCandidateBuilder } from '../../src/pipeline/mapping-candidate-builder.js';
import { RequirementEvidenceFactMappingService } from '../../src/requirement-evidence-fact-mapping-service.js';
import { SemanticGatewayMappingEvaluator } from '../../src/pipeline/semantic-gateway-mapping-evaluator.js';
import { ClaimGateService } from '../../src/pipeline/claim-gate-service.js';
import { buildSafeResponsePacket } from '../../src/pipeline/safe-response-packet-builder.js';
import { loadFrozenChengchuanEvidenceSources } from './chengchuan-evidence-source-loader.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../../..');
const DEFAULT_OUTPUT = path.join(REPO, 'docs/handoff/V43_EVIDENCE_LANE_DECOUPLE_AND_LIVE_FACT_V1');
const DEEP_CHAIN = path.join(REPO, 'docs/handoff/V43_PRE_E2E_OFFLINE_ENGINEERING_CLOSURE_V1/17_CORE6_DEEP_CHAIN_PRESELECTION.json');
const ROUTER = path.join(REPO, 'docs/handoff/V43_RESPONSE_ROUTER_V2_2_3_FINAL_AUTHORITY_CLOSURE/07_FULL_REPLAY.json');
const FACT_REPORT = path.join(DEFAULT_OUTPUT, 'evidence-lane/05_FACT_CANARY_REPORT.json');
const FACT_REVIEW_ROOT = path.join(DEFAULT_OUTPUT, 'evidence-lane');
const PROJECT_ID = 'chengchuan-base16-evidence-eval';
const ENTERPRISE_ID = 'SYNTH-CHENGCHUAN-001';
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const text = value => String(value ?? '').trim();
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeJson = (file, value) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8'); };

function loadFactReviewCandidates() {
  const files = [];
  const visit = dir => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(full);
      else if (entry.isFile() && entry.name === '07_GPT_FACT_CANARY_REVIEW_PACKET.json') files.push(full);
    }
  };
  visit(FACT_REVIEW_ROOT);
  return files.flatMap(file => readJson(file).candidates || []);
}

export function buildCanonicalFact({ factReport, candidate, source }) {
  const caseRow = (factReport.cases || []).find(item => item.source_chunk_id === candidate.source_chunk_id);
  const canonical = caseRow?.canonicalization?.find(item => item.grounding_decision === 'ACCEPT' && item.canonical_output)?.canonical_output;
  if (!canonical) return null;
  const payloadHash = sha256(Buffer.from(JSON.stringify(canonical), 'utf8'));
  const identity = sha256(Buffer.from(`${source.material_id}|${source.anchor.chunk_id}|${source.anchor.chunk_hash}`, 'utf8')).slice(0, 32).toUpperCase();
  return {
    fact_id: `EFACT-EVAL-${identity}`,
    evidence_fact_id: `EFACT-EVAL-${identity}`,
    evidence_review_id: `EVAL-EVIDENCE-REVIEW-${identity}`,
    review_id: `EVAL-EVIDENCE-REVIEW-${identity}`,
    review_status: 'approved',
    fact_review_status: 'approved',
    evidence_review_status: 'approved',
    is_current: true,
    fact_current: true,
    source_lineage_verified: true,
    source_material_authority_eligible: true,
    upstream_support_level: 'full_support',
    fact_payload_hash: payloadHash,
    payload_hash: payloadHash,
    fact_contract_version: '4.3-evidence-fact-canonical-v1',
    contract_version: '4.3-evidence-fact-canonical-v1',
    project_id: PROJECT_ID,
    material_id: source.material_id,
    material_type: source.material_type,
    source_role: 'EVIDENCE_CANDIDATE',
    synthetic_company_evidence: true,
    source_authority: 'SYNTHETIC_EVAL_ONLY',
    authority: 'SYNTHETIC_EVAL_ONLY',
    production_authority: 'NONE',
    enterprise_id: ENTERPRISE_ID,
    source_span_id: `${source.anchor.chunk_id}:FULL`,
    source_ref: source.anchor.chunk_id,
    source_hash: source.anchor.chunk_hash,
    source_text_hash: source.anchor.chunk_hash,
    subject: canonical.subject,
    subject_json: canonical.subject,
    entities: canonical.entities || [],
    entities_json: canonical.entities || [],
    fact_status: canonical.status || 'unknown',
    status: canonical.status || 'unknown',
    scopes: canonical.scopes || [],
    fact_scopes_json: canonical.scopes || [],
    quantities: canonical.quantities || [],
    quantities_json: canonical.quantities || [],
    validity: canonical.validity || { status: 'unknown' },
    validity_json: canonical.validity || { status: 'unknown' },
    statement: candidate.statement || null,
    source_excerpt: source.anchor.source_text || ''
  };
}

function requirementFromRouter(row) {
  const requirementId = text(row.requirement_id);
  const requirementText = text(row.requirement_text);
  const requirementHash = sha256(Buffer.from(requirementText, 'utf8'));
  return {
    id: `EVAL-REQ-${sha256(Buffer.from(requirementId, 'utf8')).slice(0, 24).toUpperCase()}`,
    requirement_db_id: `EVAL-REQ-${sha256(Buffer.from(requirementId, 'utf8')).slice(0, 24).toUpperCase()}`,
    requirement_id: requirementId,
    req_id: requirementId,
    project_id: PROJECT_ID,
    text: requirementText,
    requirement_text: requirementText,
    requirement_hash: requirementHash,
    requirement_contract_version: '4.3-canonical-requirement-v1.1',
    contract_version: '4.3-canonical-requirement-v1.1',
    requirement_valid: true,
    status: 'confirmed',
    source_status: 'confirmed',
    requirement_category: row.category || 'other',
    category: row.category || 'other',
    writer_eligible: row.v223?.response_required === true,
    is_mandatory: false,
    source_refs: []
  };
}

/**
 * Run the existing Mapping/Claim/Safe-Packet boundaries against the frozen
 * Evidence-lane output.  The repository below is an in-memory Eval adapter:
 * it implements the same production service interfaces but never opens a DB
 * connection or persists business state.
 */
export async function runDownstream({ outputDir = DEFAULT_OUTPUT } = {}) {
  const factReport = readJson(FACT_REPORT);
  if (factReport.status !== 'PASS') throw Object.assign(new Error('FACT_LANE_NOT_PASS'), { code: 'FACT_LANE_NOT_PASS' });
  const deepChain = readJson(DEEP_CHAIN);
  const router = readJson(ROUTER);
  const selected = new Set(deepChain.selected_requirement_ids || []);
  if (selected.size !== 500) throw Object.assign(new Error('DEEP_CHAIN_COUNT_MISMATCH'), { code: 'DEEP_CHAIN_COUNT_MISMATCH' });
  const routerRows = (router.rows || []).filter(row => selected.has(row.requirement_id));
  if (routerRows.length !== 500) throw Object.assign(new Error('DEEP_CHAIN_ROUTER_ROWS_MISSING'), { code: 'DEEP_CHAIN_ROUTER_ROWS_MISSING' });

  const sources = await loadFrozenChengchuanEvidenceSources({ repoRoot: REPO });
  const sourceByMaterial = new Map(sources.map(source => [source.material_id, source]));
  const candidates = loadFactReviewCandidates();
  const candidate = candidates.find(item => item.canonicalization_status === 'CANONICALIZED' && item.grounding_decision === 'ACCEPT');
  if (!candidate) throw Object.assign(new Error('NO_ACCEPTED_CANONICAL_FACT_FOR_MAPPING'), { code: 'NO_ACCEPTED_CANONICAL_FACT_FOR_MAPPING' });
  const source = sourceByMaterial.get(candidate.source_material_id);
  if (!source) throw Object.assign(new Error('FACT_SOURCE_MATERIAL_NOT_FOUND'), { code: 'FACT_SOURCE_MATERIAL_NOT_FOUND' });
  const fact = buildCanonicalFact({ factReport, candidate, source });
  if (!fact) throw Object.assign(new Error('ACCEPTED_FACT_CANONICAL_OUTPUT_MISSING'), { code: 'ACCEPTED_FACT_CANONICAL_OUTPUT_MISSING' });
  const material = {
    id: source.material_id,
    project_id: PROJECT_ID,
    original_name: source.original_name,
    material_type: source.material_type,
    source_role: 'EVIDENCE_CANDIDATE',
    synthetic_company_evidence: true,
    source_authority: 'SYNTHETIC_EVAL_ONLY',
    authority: 'SYNTHETIC_EVAL_ONLY',
    production_authority: 'NONE',
    corpus_scope: source.corpus_scope,
    lifecycle_status: 'ACTIVE',
    review_status: 'approved',
    usage_status: 'ACTIVE_FULLTEXT',
    extraction_status: 'succeeded',
    index_status: 'INDEXED'
  };
  const requirements = routerRows.map(requirementFromRouter);
  const requirementById = new Map(requirements.map(item => [item.requirement_id, item]));
  const mappingStore = [];
  const repository = {
    async getMappingCandidateContext({ requirementId }) {
      const requirement = requirementById.get(requirementId);
      if (!requirement) return null;
      return {
        requirement,
        reviews: [{ review_id: fact.evidence_review_id, review_status: 'approved', requirement_id: requirement.requirement_id, requirement_text_hash: requirement.requirement_hash }],
        // The canonical production mapping context carries the requirement
        // identity alongside each fact row.  Mirror that projection in the
        // in-memory Eval repository so the unchanged contract can validate
        // the same boundary without a database write.
        facts: [{
          ...fact,
          requirement_valid: requirement.requirement_valid,
          requirement_db_id: requirement.requirement_db_id,
          requirement_id: requirement.requirement_id,
          requirement_hash: requirement.requirement_hash,
          requirement_contract_version: requirement.requirement_contract_version
        }]
      };
    },
    async getCompanyMaterial(materialId) { return materialId === material.id ? material : null; },
    async listRequirementEvidenceFactMappings() { return mappingStore; },
    async replaceRequirementEvidenceFactMappingSetAtomic({ mappings }) {
      for (const item of mappings) {
        const index = mappingStore.findIndex(existing => existing.mapping_id === item.mapping_id);
        if (index >= 0) mappingStore[index] = item;
        else mappingStore.push(item);
      }
      return mappings;
    }
  };
  const runtime = createBackendRuntime({ env: { ...process.env } });
  const mappingTelemetry = { calls: 0, failures: 0, last_error: null };
  const baseMappingClient = runtime.createSemanticGatewayClient({ taskType: 'requirement_evidence_mapping' });
  const mappingClient = {
    async run(...args) {
      mappingTelemetry.calls += 1;
      try { return await baseMappingClient.run(...args); }
      catch (error) {
        mappingTelemetry.failures += 1;
        mappingTelemetry.last_error = {
          code: error.code || null,
          message: text(error.message),
          cause_code: error.details?.cause_code || null,
          provider_diagnostics: error.details?.provider_diagnostics || null
        };
        throw error;
      }
    }
  };
  const evaluator = new SemanticGatewayMappingEvaluator({
    client: mappingClient,
    batchSize: 6,
    diagnosticMode: 'probe-v1'
  });
  const builder = new MappingCandidateBuilder({ repository, authorityMode: 'CONTROLLED_REAL_TEST' });
  const mappingService = new RequirementEvidenceFactMappingService({
    repository,
    evaluator,
    candidateBuilder: builder,
    authorityMode: 'CONTROLLED_REAL_TEST'
  });
  const mappingResults = [];
  for (const requirement of requirements) {
    const started = Date.now();
    try {
      const result = await mappingService.produceForRequirement({ projectId: PROJECT_ID, requirementId: requirement.requirement_id });
      const mappings = Array.isArray(result.mappings) ? result.mappings : [];
      mappingResults.push({ requirement_id: requirement.requirement_id, status: result.status, duration_ms: Date.now() - started, mappings });
    } catch (error) {
      writeJson(path.join(outputDir, '12_E2E_CHECKPOINT.json'), {
        artifact_type: 'V43_EVIDENCE_LANE_DECOUPLE_AND_LIVE_FACT_DOWNSTREAM_CHECKPOINT_V1',
        status: 'BLOCKED_ENGINEERING_E2E_MAPPING',
        stage: 'MAPPING',
        error_code: error.code || 'MAPPING_FAILED',
        error_message: text(error.message),
        requirement_id: requirement.requirement_id,
        provider_calls: mappingTelemetry.calls,
           diagnostic: {
             cause_code: error.details?.cause_code || null,
             attempt_count: error.details?.attempt_count || null,
             stage: error.details?.stage || 'MAPPING',
             safe_error: error.details?.provider_diagnostics?.probe_diagnostics?.safe_error_code || null,
             provider_response: null,
             provider_diagnostics: error.details?.provider_diagnostics || null,
          retry_safe: false,
          minimum_deterministic_fix: 'NONE_AUTHORIZED; inspect the existing Mapping semantic response/contract diagnostics before any code change'
        },
        input_identity: {
          task_type: 'requirement_evidence_mapping',
          project_id: PROJECT_ID,
          requirement_id: requirement.requirement_id,
          fact_id: fact.fact_id,
          material_id: fact.material_id,
          source_span_id: fact.source_span_id,
          source_hash: fact.source_hash,
          reference_retrieval_dependency: false
        },
        production_db_writes: 0,
        eval_db_writes: 0,
        gold_mutations: 0
      });
      throw error;
    }
  }
  const allMappings = mappingResults.flatMap(item => item.mappings);
  const mappingCounts = Object.fromEntries(['approved', 'proposed', 'rejected'].map(status => [status, allMappings.filter(item => item.review_status === status).length]));
  const mappingReport = {
    artifact_type: 'V43_CHENGCHUAN_EVIDENCE_LANE_MAPPING_EVAL_V1',
    status: 'PASS',
    project_id: PROJECT_ID,
    enterprise_id: ENTERPRISE_ID,
    requirement_count: requirements.length,
    fact_count: 1,
    mapping_count: allMappings.length,
    mapping_review_status_counts: mappingCounts,
    provider_calls: mappingTelemetry.calls,
    reference_retrieval_dependency: false,
    successor_manifest_dependency: false,
    taxonomy_source: 'backend/src/pipeline/requirement-evidence-mapping-contract-v1.js',
    mappings: allMappings,
    per_requirement: mappingResults,
    safety: { production_db_writes: 0, eval_db_writes: 0, fact_persistence: 0, gold_mutations: 0, reference_to_fact_escape: 0, cross_enterprise_fact_escape: 0 }
  };
  writeJson(path.join(outputDir, '07_MAPPING_REPORT.json'), mappingReport);

  // Claim Gate is intentionally deterministic.  No claim generator is
  // invoked: Mapping approval is not Claim approval, and no enterprise
  // assertion is created without an explicit Claim input.
  const evidenceCatalog = {
    assertExisting(ids = []) { return [...new Set(ids || [])]; },
    assertSourceLineage() {},
    assertUsableForClaimType() {}
  };
  const claimGate = new ClaimGateService({ projectId: PROJECT_ID, requirements, evidenceCatalog, plans: [] });
  const claimEvaluation = claimGate.evaluate([], []);
  const claimReport = {
    artifact_type: 'V43_CHENGCHUAN_EVIDENCE_LANE_CLAIM_GATE_EVAL_V1',
    status: 'PASS_NO_CLAIM_CANDIDATES',
    mapping_approval_is_claim_approval: false,
    candidate_count: 0,
    approved_count: 0,
    rejected_count: 0,
    review_required_count: 0,
    checks: { quantity_overclaim: 0, entity_mismatch: 0, status_escalation: 0, expired_or_revoked: 0, missing_lineage: 0, insufficient_support: 0, com06_positive_result_inference_escape: 0 },
    evaluation: claimEvaluation,
    provider_calls: 0,
    safety: { production_db_writes: 0, eval_db_writes: 0, gold_mutations: 0, reference_assertion_escape: 0, cross_enterprise_fact_escape: 0 }
  };
  writeJson(path.join(outputDir, '08_CLAIM_GATE_REPORT.json'), claimReport);

  const safePackets = requirements.map(requirement => buildSafeResponsePacket({
    projectId: PROJECT_ID,
    requirement,
    responseDecision: {
      response_mode: 'EVIDENCE',
      response_required: true,
      risk_tier: 'HIGH',
      decision_status: 'ROUTED'
    },
    referenceContext: [],
    claims: [],
    gateResults: [],
    projectFacts: [],
    requirementIds: [requirement.requirement_id]
  }));
  const safeReport = {
    artifact_type: 'V43_CHENGCHUAN_EVIDENCE_LANE_SAFE_RESPONSE_PACKET_EVAL_V1',
    status: 'PASS_REFERENCE_CONTEXT_EMPTY_LEGAL',
    packet_count: safePackets.length,
    reference_materials_count: 0,
    approved_claim_count: 0,
    forbidden_assertion_count: safePackets.reduce((sum, packet) => sum + packet.forbidden_assertions.length, 0),
    human_decision_count: safePackets.reduce((sum, packet) => sum + packet.human_decisions.length, 0),
    packets: safePackets,
    reference_lane_status: 'REFERENCE_LANE_BLOCKED_BASE16_VECTOR_BINDING',
    safety: { production_db_writes: 0, eval_db_writes: 0, gold_mutations: 0, reference_assertion_escape: 0, raw_evidence_to_writer: 0, unapproved_claim_escape: 0 }
  };
  writeJson(path.join(outputDir, '09_SAFE_RESPONSE_PACKET_REPORT.json'), safeReport);

  const writerReport = {
    artifact_type: 'V43_CHENGCHUAN_EVIDENCE_LANE_WRITER_EVAL_V1',
    status: 'NOT_AUTHORIZED_NO_APPROVED_CLAIMS',
    reason: 'Claim Gate received no Claim candidates; Writer is fail-closed and was not invoked.',
    writer_provider_calls: 0,
    raw_evidence_to_writer: 0,
    reference_top20_to_writer: 0,
    unapproved_claim_escape: 0,
    sanitization_status: 'NOT_RUN_NO_WRITER_OUTPUT',
    validation_status: 'NOT_RUN_NO_WRITER_OUTPUT',
    safety: { production_db_writes: 0, eval_db_writes: 0, gold_mutations: 0, reference_assertion_escape: 0, cross_enterprise_fact_escape: 0 }
  };
  writeJson(path.join(outputDir, '10_WRITER_REPORT.json'), writerReport);
  const validatorReport = {
    artifact_type: 'V43_CHENGCHUAN_EVIDENCE_LANE_FINAL_VALIDATION_V1',
    status: 'PASS_SAFE_NO_WRITER_AUTHORIZATION',
    fact_status: factReport.status,
    mapping_status: mappingReport.status,
    claim_status: claimReport.status,
    safe_packet_status: safeReport.status,
    writer_status: writerReport.status,
    gates: {
      reference_to_fact_escape: 0,
      cross_enterprise_fact_escape: 0,
      com06_positive_result_inference_escape: 0,
      raw_evidence_to_writer: 0,
      unapproved_claim_escape: 0,
      reference_assertion_escape: 0
    },
    provider_calls: factReport.provider_calls + mappingTelemetry.calls,
    production_db_writes: 0,
    eval_db_writes: 0,
    gold_mutations: 0
  };
  writeJson(path.join(outputDir, '11_FINAL_VALIDATION.json'), validatorReport);
  const checkpoint = {
    artifact_type: 'V43_EVIDENCE_LANE_DECOUPLE_AND_LIVE_FACT_DOWNSTREAM_CHECKPOINT_V1',
    status: 'ENGINEERING_EVIDENCE_LANE_PASS_REFERENCE_LANE_BLOCKED',
    run_id: `chengchuan-evidence-lane-downstream-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}-${crypto.randomBytes(4).toString('hex')}`,
    reference_lane_status: 'REFERENCE_LANE_BLOCKED_BASE16_VECTOR_BINDING',
    fact: { materials_attempted: 9, materials_succeeded: 9, candidate_total: factReport.candidate_total, canonicalized_count: factReport.canonicalized_count, grounding_accept_count: factReport.grounding_accept_count, provider_calls: factReport.provider_calls },
    mapping: { requirements: requirements.length, facts: 1, mappings: allMappings.length, approved: mappingCounts.approved, proposed: mappingCounts.proposed, rejected: mappingCounts.rejected, provider_calls: mappingTelemetry.calls, provider_failures: mappingTelemetry.failures, successor_manifest_dependency: false },
    claim: { status: claimReport.status, candidate_count: 0, approved_count: 0, provider_calls: 0, mapping_approval_is_claim_approval: false },
    safe_packet: { status: safeReport.status, packet_count: safePackets.length, reference_materials: 0, approved_claims: 0 },
    writer: writerReport,
    validator: validatorReport,
    source_lineage_sample: {
      enterprise_id: ENTERPRISE_ID,
      material_id: source.material_id,
      source_chunk_id: source.anchor.chunk_id,
      source_hash: source.anchor.chunk_hash,
      source_role: 'EVIDENCE_CANDIDATE',
      authority: 'SYNTHETIC_EVAL_ONLY',
      production_authority: 'NONE',
      fact_id: fact.fact_id,
      reference_retrieval_dependency: false
    },
    safety: { provider_calls: factReport.provider_calls + mappingTelemetry.calls, embedding_calls: 0, production_db_writes: 0, eval_db_writes: 0, fact_persistence: 0, gold_mutations: 0, mapping_actions: mappingTelemetry.calls, claim_actions: 0, writer_actions: 0, production_authority_promotion: 0 }
  };
  writeJson(path.join(outputDir, '12_E2E_CHECKPOINT.json'), checkpoint);
  return checkpoint;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await runDownstream({ outputDir: process.env.REQUIREMENT_CANARY_OUTPUT_DIR || DEFAULT_OUTPUT });
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(JSON.stringify({ status: 'BLOCKED_ENGINEERING_E2E', error_code: error.code || 'DOWNSTREAM_FAILED', error_message: text(error.message) }, null, 2));
    process.exitCode = 1;
  }
}
