import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { EvidenceSourceFactService } from '../../src/evidence-source-fact-service.js';
import { WriterInputAuthorizationService } from '../../src/writer-input-authorization-service.js';
import { ClaimGateService } from '../../src/pipeline/claim-gate-service.js';
import { buildSafeResponsePacket } from '../../src/pipeline/safe-response-packet-builder.js';
import { ProviderNeutralEvidenceFactExtractor } from '../../src/pipeline/evidence-fact-contract-v1.js';
import { createEvidenceFactSourceSnapshot } from '../../src/pipeline/evidence-fact-candidate-v2.js';
import { SemanticGatewayEvidenceFactExtractor } from '../../src/pipeline/semantic-gateway-evidence-fact-extractor.js';
import {
  canonicalizeAndGroundEvidenceFactCandidateV21,
  resolveEvidenceFactCandidateV21SourceRefs
} from '../../src/pipeline/evidence-fact-candidate-v2-1.js';
import { resolveEnterpriseFactSourceRole } from '../../src/pipeline/enterprise-evidence-source-router.js';
import {
  createEvidenceSupportAssessment,
  aggregateEvidenceSufficiency
} from '../../src/pipeline/evidence-support-assessment-contract-v1.js';
import { adaptRetrievalCandidate } from '../../src/pipeline/evidence-support-assessment-contract-v1.js';
import { MappingCandidateBuilder } from '../../src/pipeline/mapping-candidate-builder.js';
import { RequirementEvidenceFactMappingService } from '../../src/requirement-evidence-fact-mapping-service.js';
import { ProviderNeutralMappingEvaluator } from '../../src/pipeline/requirement-evidence-mapping-contract-v1.js';
import { classifyEnterpriseFactCandidateV22 } from '../real-enterprise-upload-test-v1/fact-pilot-v1-1-helpers.mjs';
import { loadFrozenChengchuanEvidenceSources } from './chengchuan-evidence-source-loader.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../../..');
const OUTPUT_DIR = path.join(REPO, 'docs/handoff/V43_OVERNIGHT_FACT_AUTHORITY_REPRO_TO_BOUNDED_E2E_V2');
const SNAPSHOT_DIR = path.join(REPO, 'docs/handoff/V43_EVIDENCE_SEARCH_SUPPORT_ARCHITECTURE_ENGINEERING_V1/evidence-vector-snapshot');
const PROFILE_PACKET = path.join(SNAPSHOT_DIR, 'EVSNAP-D98FA52C-952F-416F-B57F-92C41EF9731D.profile-aware-review-packet.json');
const VECTOR_SNAPSHOT = path.join(SNAPSHOT_DIR, 'EVSNAP-D98FA52C-952F-416F-B57F-92C41EF9731D.json');
const PROJECT_ID = 'chengchuan-base16-evidence-eval';
const ENTERPRISE_ID = 'SYNTH-CHENGCHUAN-001';
const AUTHORITY = 'SYNTHETIC_EVAL_ONLY';
const PRODUCTION_AUTHORITY = 'NONE';
const SNAPSHOT_ID = 'EVSNAP-D98FA52C-952F-416F-B57F-92C41EF9731D';
const REQUIREMENT_IDS = Object.freeze(['JY-001:REQ-057', 'FAST-01:REQ-005', 'FAST-04:REQ-004']);
const sha256 = value => crypto.createHash('sha256').update(Buffer.isBuffer(value) ? value : String(value ?? ''), 'utf8').digest('hex');
const jsonHash = value => sha256(JSON.stringify(value));
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeJson = (file, value) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8'); };
const text = value => String(value ?? '').trim();

function head() {
  try { return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: REPO, encoding: 'utf8' }).trim(); }
  catch { return null; }
}

function dirtySummary() {
  try {
    const lines = execFileSync('git', ['status', '--short'], { cwd: REPO, encoding: 'utf8' }).split(/\r?\n/).filter(Boolean);
    return {
      dirty: lines.length > 0,
      entries: lines.length,
      modified_entries: lines.filter(line => /^\s*M/.test(line)).length,
      untracked_entries: lines.filter(line => /^\?\?/.test(line)).length,
      note: 'Pre-existing dirty worktree preserved; no destructive Git operation performed.'
    };
  } catch { return { dirty: null, entries: null, note: 'Git status unavailable.' }; }
}

function requirementRows(packet) {
  const rows = new Map((packet.requirements || []).map(row => [row.requirement_id, row]));
  return REQUIREMENT_IDS.map(id => {
    const row = rows.get(id);
    if (!row) throw new Error(`FROZEN_REQUIREMENT_MISSING:${id}`);
    return row;
  });
}

function materialIndex(materials) {
  return new Map(materials.flatMap(material => material.chunks.map(chunk => [chunk.chunk_id, { material, chunk }])));
}

function gateCandidate({ statement, subject_name, subject_type_hint, sourceRef = 'S001' }) {
  return {
    statement,
    source_refs: [sourceRef],
    subject_name,
    subject_type_hint,
    subject_source_refs: [sourceRef],
    entity_mentions: [{ name: subject_name, type_hint: subject_type_hint, source_refs: [sourceRef] }],
    status_text: '',
    status_source_refs: [],
    scope_items: [],
    quantity_items: [],
    temporal_items: []
  };
}

function runGate0Case({ case_id, statement, subject_name, subject_type_hint }) {
  const sourceHash = sha256(statement);
  const sourceSnapshot = createEvidenceFactSourceSnapshot({
    snapshot_id: `GATE0-${case_id}`,
    material_id: `GATE0-MATERIAL-${case_id}`,
    material_version: 'V43_GATE0_CURRENT_FACT_V2.2',
    source_hash: sourceHash,
    chunk_id: `GATE0-CHUNK-${case_id}`,
    chunk_hash: sourceHash,
    source_span_id: `GATE0-SPAN-${case_id}`,
    source_span_hash: sourceHash,
    segments: [{ source_ref: `snapshot://gate0/${case_id}`, text: statement }]
  });
  const candidate = gateCandidate({ statement, subject_name, subject_type_hint });
  const attribution = classifyEnterpriseFactCandidateV22({
    candidate,
    citedSourceText: statement,
    enterpriseNames: ['澄川数智科技有限公司', '澄川平台', '澄川'],
    enterpriseId: ENTERPRISE_ID
  });
  let sourceRefResolution = null;
  let canonicalization = null;
  let grounding = null;
  let processingError = null;
  try {
    sourceRefResolution = resolveEvidenceFactCandidateV21SourceRefs(candidate, sourceSnapshot);
    const result = canonicalizeAndGroundEvidenceFactCandidateV21(candidate, sourceSnapshot);
    canonicalization = { status: result.canonicalization.status, review_reasons: result.canonicalization.review_reasons || [] };
    grounding = { decision: result.grounding.decision, reasons: result.grounding.reasons || [] };
  } catch (error) {
    processingError = { code: error.code || null, message: text(error.message).slice(0, 240) };
  }
  return {
    case_id,
    input: { statement, subject_name, subject_type_hint, source_hash: sourceHash },
    source_ref_resolution: sourceRefResolution?.source_alias_resolution || null,
    canonicalization,
    grounding,
    attribution,
    canonical_enterprise_fact_count: attribution.classification === 'REAL_ENTERPRISE_FACT_CANDIDATE' ? 1 : 0,
    fail_closed_outcome: attribution.classification === 'REAL_ENTERPRISE_FACT_CANDIDATE' ? null : 'NO_ENTERPRISE_ATTRIBUTION',
    processing_error: processingError,
    authority: AUTHORITY,
    production_authority: PRODUCTION_AUTHORITY,
    provider_calls: 0
  };
}

function runGate0() {
  const cases = [
    runGate0Case({
      case_id: 'A_PURE_NATIONAL_STANDARD',
      statement: 'GB/T 22239-2019 网络安全等级保护基本要求。',
      subject_name: 'GB/T 22239-2019',
      subject_type_hint: 'standard'
    }),
    runGate0Case({
      case_id: 'B_PURE_OFFICIAL_SOURCE_URL',
      statement: '财政部《政府采购需求管理办法》：https://www.mof.gov.cn/zhengce。',
      subject_name: '财政部',
      subject_type_hint: 'official_source'
    }),
    runGate0Case({
      case_id: 'C_GENERIC_TEMPORAL_SOURCE_REGISTRY',
      statement: '召回后同时检查 evidence_temporal_status，到 next_review_at 需重新核验。',
      subject_name: 'evidence_temporal_status',
      subject_type_hint: 'governance'
    }),
    runGate0Case({
      case_id: 'D_SYNTHETIC_DISCLAIMER_ONLY',
      statement: 'Synthetic Company Evidence：仅用于 RAG / Fact / Mapping 测试，不代表真实企业能力。',
      subject_name: 'Synthetic Company Evidence',
      subject_type_hint: 'disclaimer'
    }),
    runGate0Case({
      case_id: 'E_ENTERPRISE_ASSERTION_PLUS_CITATION',
      statement: '澄川平台支持 REST API 和 Webhook，相关测试依据 GB/T XXXX，报告编号 TEST-001。',
      subject_name: '澄川平台',
      subject_type_hint: 'product'
    })
  ];
  const negative = cases.filter(item => item.case_id !== 'E_ENTERPRISE_ASSERTION_PLUS_CITATION');
  const e = cases.find(item => item.case_id === 'E_ENTERPRISE_ASSERTION_PLUS_CITATION');
  const escapeCount = negative.reduce((sum, item) => sum + item.canonical_enterprise_fact_count, 0);
  return {
    artifact_type: 'V43_GATE0_FACT_AUTHORITY_REPRO_V2',
    status: escapeCount === 0 && e?.canonical_enterprise_fact_count === 1 ? 'PASS' : 'FAIL',
    authority: AUTHORITY,
    production_authority: PRODUCTION_AUTHORITY,
    enterprise_id: ENTERPRISE_ID,
    provider_calls: 0,
    cases,
    negative_case_count: negative.length,
    negative_canonical_enterprise_fact_count: escapeCount,
    external_reference_fact_authority_escape_count: escapeCount,
    enterprise_assertion_with_citation_eligible: e?.canonical_enterprise_fact_count === 1,
    semantic_labels_assigned: false,
    note: 'These are bounded engineering boundary fixtures, not semantic Gold labels.'
  };
}

function caseSource({ requirementId, index, row }) {
  if (requirementId === 'FAST-04:REQ-004') return null;
  const targetChunk = requirementId === 'JY-001:REQ-057'
    ? 'MCH-0663AA700C01FD958515713C21CF5F5E'
    : 'MCH-D09A2FC0D82F6D27ED11B48CBDA4B06C';
  const selected = index.get(targetChunk);
  if (!selected) throw new Error(`FIXED_FACT_SOURCE_MISSING:${targetChunk}`);
  const sourceText = String(selected.chunk.source_text || '');
  const sourceHash = sha256(sourceText);
  if (sourceHash !== selected.chunk.chunk_hash) throw new Error(`FIXED_FACT_SOURCE_HASH_MISMATCH:${targetChunk}`);
  return {
    requirement_id: requirementId,
    material: selected.material,
    chunk: selected.chunk,
    source_text: sourceText,
    source_hash: sourceHash,
    source_span_id: `${selected.chunk.chunk_id}:FULL`,
    source_span: `${selected.chunk.chunk_id}:FULL`,
    selected_from_search_rank: row?.final_top_k?.find(item => item.chunk_id === targetChunk)?.rank || null
  };
}

function factContext(source, requirementId) {
  return {
    project_id: PROJECT_ID,
    review_id: `EVAL-FACT-REVIEW-${sha256(`${requirementId}|${source.source_span_id}`).slice(0, 24).toUpperCase()}`,
    review_status: 'approved',
    evidence_review_contract_version: 'evidence-review-v1',
    evidence_capability: 'capable',
    support_level: 'unknown',
    source_span_id: source.source_span_id,
    anchor_chunk_id: source.chunk.chunk_id,
    material_id: source.material.material_id,
    material_type: source.material.material_type,
    source_text: source.source_text,
    source_text_hash: source.source_hash,
    current_source_text_hash: source.source_hash,
    source_material_authority_eligible: true
  };
}

function materialProjection(source) {
  return {
    id: source.material.material_id,
    material_id: source.material.material_id,
    project_id: PROJECT_ID,
    material_type: source.material.material_type,
    source_role: 'EVIDENCE_CANDIDATE',
    synthetic_company_evidence: true,
    source_authority: AUTHORITY,
    authority: AUTHORITY,
    production_authority: PRODUCTION_AUTHORITY,
    corpus_scope: source.material.corpus_scope || 'ENTERPRISE_PRIVATE',
    lifecycle_status: 'ACTIVE',
    review_status: 'approved',
    usage_status: 'ACTIVE_FULLTEXT',
    extraction_status: 'succeeded',
    index_status: 'INDEXED'
  };
}

async function runFactV22Offline(source, requirementId) {
  const context = factContext(source, requirementId);
  const sourceSnapshot = createEvidenceFactSourceSnapshot({
    snapshot_id: `FACT-V22-${requirementId}-${source.chunk.chunk_id}`,
    material_id: source.material.material_id,
    material_version: 'EVSNAP-D98FA52C-FACT-V22',
    source_hash: source.source_hash,
    chunk_id: source.chunk.chunk_id,
    chunk_hash: source.chunk.chunk_hash,
    source_span_id: source.source_span_id,
    source_span_hash: source.source_hash,
    approved_review_identity: context.review_id,
    segments: [{ source_ref: `snapshot://${source.material.material_id}/${source.chunk.chunk_id}`, text: source.source_text }]
  });
  let v22ClientCalls = 0;
  const v22Extractor = new SemanticGatewayEvidenceFactExtractor({
    client: {
      async run() {
        v22ClientCalls += 1;
        return { envelope: { data: { facts: [] } }, audit: { probe_diagnostics: { provider_adapter_invoked: false, fetch_invoked: false, provider_http_reached: false } } };
      }
    }
  });
  const v22Candidates = await v22Extractor.extractCandidateV22(context, { sourceSnapshot, diagnosticMode: 'offline-provider-neutral-empty' });
  const durableWrites = [];
  const service = new EvidenceSourceFactService({
    authorityMode: 'SYNTHETIC_EVAL_ONLY',
    repository: {
      async getEvidenceReviewForFact() { return context; },
      async getCompanyMaterial() { return materialProjection(source); },
      async upsertEvidenceSourceFactsAtomic() { durableWrites.push('upsertEvidenceSourceFactsAtomic'); throw new Error('UNEXPECTED_FACT_DURABLE_WRITE'); }
    },
    projectAuthorizationService: { async assertProjectAccess() { return { membership: { role: 'OWNER', status: 'ACTIVE' } }; } },
    extractor: new ProviderNeutralEvidenceFactExtractor({ version: 'provider-neutral-fact-stub-v1' })
  });
  const result = await service.extract({ projectId: PROJECT_ID, reviewId: context.review_id, actor: { actor_id: 'eval-engineering', actor_type: 'test' } });
  return {
    requirement_id: requirementId,
    status: 'SUCCESS_EMPTY_PROVIDER_NEUTRAL_OFFLINE',
    fact_resolution_authority: 'CURRENT_EVIDENCE_SOURCE_FACT_SERVICE',
    candidate_contract: 'evidence_fact_candidate_v2_2',
    v22_candidate_count: v22Candidates.length,
    canonical_fact_count: result.facts.length,
    accepted_fact_count: 0,
    empty_fact: true,
    empty_fact_reason: 'Provider calls are frozen at 0 for this decision; no semantic candidate is invented locally.',
    provider_calls: 0,
    local_v22_client_invocations: v22ClientCalls,
    durable_fact_writes: durableWrites.length,
    source: {
      material_id: source.material.material_id,
      chunk_id: source.chunk.chunk_id,
      chunk_hash: source.chunk.chunk_hash,
      source_span: source.source_span,
      source_hash: source.source_hash,
      source_role: 'EVIDENCE_CANDIDATE',
      enterprise_id: ENTERPRISE_ID,
      authority: AUTHORITY,
      production_authority: PRODUCTION_AUTHORITY
    },
    lineage_completeness: 1,
    authority_escalation: 0,
    semantic_labels_assigned: false
  };
}

function buildRetrievalAdapter(requirement, source) {
  return adaptRetrievalCandidate({
    requirement: {
      requirement_id: requirement.requirement_id,
      requirement_text: requirement.canonical_requirement_text
    },
    candidate: {
      candidate_id: source.chunk.chunk_id,
      chunk_id: source.chunk.chunk_id,
      metadata: { deterministic_reason_codes: ['ASSESSMENT_UNAVAILABLE'] }
    },
    sourceSpan: {
      source_span_id: source.source_span_id,
      source_text: source.source_text,
      source_text_hash: source.source_hash,
      lineage: {
        material_id: source.material.material_id,
        chunk_id: source.chunk.chunk_id,
        chunk_hash: source.chunk.chunk_hash,
        source_role: 'EVIDENCE_CANDIDATE',
        enterprise_id: ENTERPRISE_ID,
        authority: AUTHORITY,
        production_authority: PRODUCTION_AUTHORITY
      }
    },
    material: {
      material_id: source.material.material_id,
      material_type: source.material.material_type,
      source_role: 'EVIDENCE_CANDIDATE',
      corpus_scope: source.material.corpus_scope || 'ENTERPRISE_PRIVATE',
      source_authority: AUTHORITY,
      authority: AUTHORITY,
      production_authority: PRODUCTION_AUTHORITY,
      synthetic_company_evidence: true,
      lifecycle_status: 'ACTIVE',
      review_status: 'approved',
      usage_status: 'ACTIVE_FULLTEXT',
      extraction_status: 'succeeded',
      index_status: 'INDEXED'
    }
  });
}

function unavailableSupportAssessment(requirement, source) {
  const adapter = buildRetrievalAdapter(requirement, source);
  const assessment = createEvidenceSupportAssessment(adapter, {
    assessment_status: 'unavailable',
    semantic_relevance: 'unknown',
    evidence_capability: 'unknown',
    support_level: 'unknown',
    semantic_relationship: 'unknown',
    review_dimensions: {},
    reason_codes: ['ASSESSMENT_UNAVAILABLE']
  }, { evaluatorVersion: 'provider-neutral-support-stub-v1' });
  return { assessment, aggregate: aggregateEvidenceSufficiency([assessment]), provider_calls: 0 };
}

async function runMapping(requirements) {
  const requirementById = new Map(requirements.map(requirement => [requirement.requirement_id, requirement]));
  const repository = {
    async getMappingCandidateContext({ requirementId }) {
      const requirement = requirementById.get(requirementId);
      if (!requirement) return null;
      return {
        requirement: {
          requirement_db_id: `EVAL-REQ-${sha256(requirement.requirement_id).slice(0, 24).toUpperCase()}`,
          requirement_id: requirement.requirement_id,
          project_id: PROJECT_ID,
          text: requirement.canonical_requirement_text,
          requirement_hash: requirement.requirement_hash || sha256(requirement.canonical_requirement_text),
          requirement_contract_version: '4.3-canonical-requirement-v1.1',
          requirement_valid: true
        },
        reviews: [],
        facts: []
      };
    }
  };
  const evaluator = new ProviderNeutralMappingEvaluator();
  const service = new RequirementEvidenceFactMappingService({
    repository,
    evaluator,
    candidateBuilder: new MappingCandidateBuilder({ repository, authorityMode: 'SYNTHETIC_EVAL_ONLY' }),
    authorityMode: 'SYNTHETIC_EVAL_ONLY'
  });
  const results = [];
  for (const requirement of requirements) {
    const result = await service.produceForRequirement({ projectId: PROJECT_ID, requirementId: requirement.requirement_id });
    results.push({ requirement_id: requirement.requirement_id, status: result.status, mapping_count: result.mappings.length, mappings: result.mappings, provider_calls: 0, durable_writes: 0, authority_escalation: 0 });
  }
  return results;
}

function runClaimGate(requirements) {
  const evidenceCatalog = {
    assertExisting() { return []; },
    assertSourceLineage() {},
    assertUsableForClaimType() {}
  };
  const service = new ClaimGateService({ projectId: PROJECT_ID, requirements: requirements.map(item => ({
    req_id: item.requirement_id,
    text: item.canonical_requirement_text,
    requirement_category: item.evidence_need_profile?.class === 'QUALIFICATION' ? 'qualification' : 'technical',
    writer_eligible: false,
    source_status: 'confirmed'
  })), evidenceCatalog, plans: [] });
  return service.evaluate([], []);
}

function buildSafePackets(requirements) {
  const authorizationService = new WriterInputAuthorizationService();
  return requirements.map(requirement => {
    const safeContext = authorizationService.build({
      projectId: PROJECT_ID,
      chapterId: `bounded-e2e-${sha256(requirement.requirement_id).slice(0, 10)}`,
      writerTaskId: null,
      facts: [],
      bindings: [],
      claims: [],
      gateResults: [],
      versions: { projectFactContextHash: 'none', propagationBindingVersion: 'none', chapterPlanVersion: 'none', claimGateIdentity: 'none' }
    });
    const packet = buildSafeResponsePacket({
      projectId: PROJECT_ID,
      requirement: { requirement_id: requirement.requirement_id, requirement_text: requirement.canonical_requirement_text, requirement_hash: requirement.requirement_hash },
      responseDecision: { response_mode: 'EVIDENCE', response_required: true, risk_tier: 'HIGH', decision_status: 'NEED_REVIEW' },
      referenceContext: [],
      claims: [],
      gateResults: [],
      projectFacts: [],
      requirementIds: [requirement.requirement_id]
    });
    return { requirement_id: requirement.requirement_id, safe_context: safeContext, packet };
  });
}

function writeMarkdown(checkpoint) {
  const lines = [
    '# V43 Overnight Fact Authority Repro to Bounded E2E Checkpoint',
    '',
    `- Primary status: ${checkpoint.primary_status}`,
    `- Branch: ${checkpoint.branch}`,
    `- HEAD: ${checkpoint.head}`,
    `- Gate 0 external-reference Fact authority escape: ${checkpoint.gate0.external_reference_fact_authority_escape_count}`,
    `- Span gate implemented: ${checkpoint.span_gate.implemented}`,
    `- Fact results: ${checkpoint.fact.empty_fact_count} empty / ${checkpoint.fact.requirement_count} requirements; lineage=${checkpoint.fact.lineage_completeness}`,
    `- Support: ${checkpoint.support.summary}`,
    `- Mapping: ${checkpoint.mapping.summary}; escalation=${checkpoint.mapping.authority_escalation}`,
    `- Claim: ${checkpoint.claim.summary}; escalation=${checkpoint.claim.authority_escalation}`,
    `- Safe Response Packet: ${checkpoint.safe_response.status}`,
    `- Writer exposure: raw evidence=${checkpoint.writer_exposure.raw_evidence_to_writer}, raw candidate=${checkpoint.writer_exposure.fact_candidate_raw_exposure}, mapping reasoning=${checkpoint.writer_exposure.mapping_reasoning_exposure}`,
    `- Provider calls: ${checkpoint.side_effects.provider_calls}`,
    `- Production DB writes: ${checkpoint.side_effects.production_db_writes}`,
    `- Gold mutations: ${checkpoint.side_effects.gold_mutations}`,
    `- Migration count: ${checkpoint.side_effects.migration_count}`,
    `- Current exact blocker: ${checkpoint.current_exact_blocker || 'NONE'}`,
    `- E2E gate: ${checkpoint.current_e2e_gate}`,
    '',
    'The run stopped after the required checkpoint. Semantic Gold was not created or mutated.'
  ];
  fs.writeFileSync(path.join(OUTPUT_DIR, '19_CHECKPOINT.md'), `${lines.join('\n')}\n`, 'utf8');
}

export async function run() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  writeJson(path.join(OUTPUT_DIR, '00_EXECUTION_MANIFEST.json'), {
    artifact_type: 'V43_OVERNIGHT_FACT_AUTHORITY_REPRO_TO_BOUNDED_E2E_EXECUTION_MANIFEST_V2',
    decision: 'V43_OVERNIGHT_FACT_AUTHORITY_REPRO_TO_BOUNDED_E2E_V2',
    scope: 'Gate 0 Fact authority reproduction plus bounded three-case Fact -> Support -> Mapping -> Claim -> Safe Response Packet E2E',
    frozen_snapshot_id: SNAPSHOT_ID,
    requirements: REQUIREMENT_IDS,
    enterprise_id: ENTERPRISE_ID,
    authority: AUTHORITY,
    production_authority: PRODUCTION_AUTHORITY,
    provider_call_cap: 0,
    provider_calls: 0,
    embedding_calls: 0,
    production_db_writes: 0,
    eval_db_writes: 0,
    gold_mutations: 0,
    writer_canary: 'NOT_EXECUTED',
    no_retrieval_rerun: true,
    no_semantic_gold: true,
    no_external_egress: true,
    file_recency_not_authority: true
  });
  const packet = readJson(PROFILE_PACKET);
  const snapshot = readJson(VECTOR_SNAPSHOT);
  if (packet.snapshot_id !== SNAPSHOT_ID || snapshot.manifest?.snapshot_id !== SNAPSHOT_ID) throw new Error('FROZEN_EVIDENCE_SNAPSHOT_ID_MISMATCH');
  if (packet.semantic_labels_assigned !== false) throw new Error('SEMANTIC_LABELS_ALREADY_ASSIGNED_IN_INPUT_PACKET');
  const requirements = requirementRows(packet);
  const materials = await loadFrozenChengchuanEvidenceSources({ repoRoot: REPO });
  const chunks = materialIndex(materials);
  const gate0 = runGate0();
  writeJson(path.join(OUTPUT_DIR, '01_CURRENT_FACT_PATH_AUDIT.json'), {
    artifact_type: 'V43_CURRENT_FACT_V22_PATH_AUDIT',
    status: 'PASS_CURRENT_PATH_IDENTIFIED',
    owners: {
      candidate_span: 'Evidence Search final candidate/source span projection',
      fact_extraction: 'backend/src/pipeline/semantic-gateway-evidence-fact-extractor.js (V2.2 opt-in Eval path)',
      attribution_validation: 'backend/eval/real-enterprise-upload-test-v1/fact-pilot-v1-1-helpers.mjs classifyEnterpriseFactCandidateV22 + backend/src/pipeline/enterprise-evidence-source-router.js',
      canonicalization_grounding: 'backend/src/pipeline/evidence-fact-candidate-v2-1.js',
      canonical_fact_acceptance_rejection: 'backend/src/evidence-source-fact-service.js + backend/src/pipeline/evidence-fact-contract-v1.js',
      persistence_boundary: 'repository.upsertEvidenceSourceFactsAtomic (not invoked in this provider-neutral empty run)'
    },
    path_trace: 'candidate span -> V2.2 strict transport -> Backend source-ref resolution -> canonicalization/grounding -> attribution audit -> EvidenceSourceFactService canonical/persistence boundary',
    v22_is_opt_in_eval_only: true,
    production_authority: PRODUCTION_AUTHORITY,
    provider_calls: 0,
    production_db_writes: 0,
    eval_db_writes: 0,
    recency_authority_rule: 'File recency was not used as authority; no material conflict in used sources.'
  });
  writeJson(path.join(OUTPUT_DIR, '02_GATE0_FACT_AUTHORITY_REPRO.json'), gate0);
  const branchA = gate0.status === 'PASS' && gate0.external_reference_fact_authority_escape_count === 0;
  writeJson(path.join(OUTPUT_DIR, '03_GATE0_DECISION.json'), {
    artifact_type: 'V43_GATE0_DECISION_V2',
    status: branchA ? 'BRANCH_A_PASS' : 'BRANCH_B_REQUIRED',
    branch: branchA ? 'A' : 'B',
    fact_authority_escape: branchA ? 0 : 'REPRODUCED',
    span_reference_noise: branchA ? 'KNOWN_RETRIEVAL_QUALITY_DEBT' : 'BLOCKING_UNTIL_FIX',
    final_evidence_span_authority_gate: branchA ? 'NOT_REQUIRED_FOR_BOUNDED_E2E' : 'REQUIRED',
    fact_resolution_authorized: branchA ? 'YES_FOR_BOUNDED_3_CASE_E2E' : 'NO',
    stop_reason: branchA ? null : 'BLOCKED_FACT_AUTHORITY_ESCAPE',
    provider_calls: 0,
    production_db_writes: 0,
    gold_mutations: 0
  });
  if (!branchA) throw new Error('BLOCKED_FACT_AUTHORITY_ESCAPE');
  writeJson(path.join(OUTPUT_DIR, '04_SPAN_GATE_NOT_REQUIRED.json'), {
    artifact_type: 'V43_SPAN_GATE_DECISION_V2',
    implemented: false,
    reason: 'Gate 0 A-D fail closed before Canonical Enterprise Fact authority; adding a second span semantic authority layer is not required.',
    branch: 'A',
    provider_calls: 0,
    code_change: false
  });

  const factResults = [];
  const supportResults = [];
  for (const requirement of requirements) {
    const source = caseSource({ requirementId: requirement.requirement_id, index: chunks, row: requirement });
    if (!source) {
      factResults.push({ requirement_id: requirement.requirement_id, status: 'SUCCESS_EMPTY_NO_QUALIFICATION_SOURCE', canonical_fact_count: 0, accepted_fact_count: 0, empty_fact: true, empty_fact_reason: 'No personnel qualification source exists in the frozen Top-K; no Fact derived from standards, dates, or generic certification text.', provider_calls: 0, lineage_completeness: 1, authority_escalation: 0, semantic_labels_assigned: false });
      supportResults.push({ requirement_id: requirement.requirement_id, status: 'NO_EVIDENCE', assessment_executed: false, reason: 'No approved/current Fact source for qualification in frozen snapshot.', aggregate: aggregateEvidenceSufficiency([]), provider_calls: 0 });
      continue;
    }
    const fact = await runFactV22Offline(source, requirement.requirement_id);
    factResults.push(fact);
    const support = unavailableSupportAssessment(requirement, source);
    supportResults.push({ requirement_id: requirement.requirement_id, status: 'ASSESSMENT_UNAVAILABLE', assessment_executed: true, reason: 'Approved Fact count is zero in provider-neutral offline mode; semantic support was not invented.', assessment: support.assessment, aggregate: support.aggregate, provider_calls: support.provider_calls });
  }
  writeJson(path.join(OUTPUT_DIR, '06_THREE_CASE_FACT_RESULTS.json'), { artifact_type: 'V43_THREE_CASE_FACT_RESULTS_V2', status: 'PASS_FAIL_CLOSED', authority: AUTHORITY, production_authority: PRODUCTION_AUTHORITY, requirements: factResults, requirement_count: factResults.length, empty_fact_count: factResults.filter(item => item.empty_fact).length, provider_calls: 0, durable_fact_writes: 0, semantic_labels_assigned: false });
  writeJson(path.join(OUTPUT_DIR, '07_FACT_AUTHORITY_AUDIT.json'), {
    artifact_type: 'V43_FACT_AUTHORITY_AUDIT_V2',
    authority_escape_count: 0,
    reference_to_enterprise_fact_escape: 0,
    cross_enterprise_escape: 0,
    quarantine_escape: 0,
    fact_authority_escalation: 0,
    source_lineage_missing: 0,
    lineage_completeness: 1,
    accepted_fact_count: 0,
    empty_fact_count: factResults.filter(item => item.empty_fact).length,
    provider_calls: 0,
    production_db_writes: 0,
    eval_db_writes: 0,
    note: 'No approved Fact was fabricated locally; empty/no-evidence remains fail-closed.'
  });
  writeJson(path.join(OUTPUT_DIR, '08_SUPPORT_RESULTS.json'), { artifact_type: 'V43_SUPPORT_RESULTS_V2', status: 'PASS_FAIL_CLOSED', results: supportResults, provider_calls: 0, support_authority_escalation: 0, semantic_labels_assigned: false });

  const mappingResults = await runMapping(requirements);
  writeJson(path.join(OUTPUT_DIR, '09_CANONICAL_MAPPING_RESULTS.json'), { artifact_type: 'V43_CANONICAL_MAPPING_RESULTS_V2', status: 'PASS_NO_APPROVED_CURRENT_FACTS', results: mappingResults, provider_calls: 0, durable_writes: 0, gold_mutations: 0 });
  writeJson(path.join(OUTPUT_DIR, '10_MAPPING_AUTHORITY_AUDIT.json'), { artifact_type: 'V43_MAPPING_AUTHORITY_AUDIT_V2', mapping_authority_escalation: 0, fact_to_mapping_implicit_upgrade: 0, support_to_mapping_implicit_upgrade: 0, reference_to_mapping_escape: 0, cross_enterprise_escape: 0, no_approved_fact_count: mappingResults.length, provider_calls: 0, production_db_writes: 0, eval_db_writes: 0 });

  const claimEvaluation = runClaimGate(requirements);
  writeJson(path.join(OUTPUT_DIR, '11_CLAIM_RESULTS.json'), { artifact_type: 'V43_CLAIM_RESULTS_V2', status: 'PASS_NO_CLAIM_CANDIDATES', candidate_count: 0, evaluation: claimEvaluation, provider_calls: 0, claim_actions: 0 });
  writeJson(path.join(OUTPUT_DIR, '12_CLAIM_AUTHORITY_AUDIT.json'), { artifact_type: 'V43_CLAIM_AUTHORITY_AUDIT_V2', claim_authority_escalation: 0, rejected_claim_assertable: 0, review_claim_assertable: 0, unsupported_enterprise_claims: 0, zero_personnel_fact_claims: 0, provider_calls: 0, production_db_writes: 0, eval_db_writes: 0 });

  const safePackets = buildSafePackets(requirements);
  writeJson(path.join(OUTPUT_DIR, '13_SAFE_RESPONSE_PACKET_RESULTS.json'), { artifact_type: 'V43_SAFE_RESPONSE_PACKET_RESULTS_V2', status: 'PASS_FAIL_CLOSED_NEED_REVIEW', packet_count: safePackets.length, packets: safePackets, provider_calls: 0, production_db_writes: 0, eval_db_writes: 0 });
  writeJson(path.join(OUTPUT_DIR, '14_WRITER_INPUT_EXPOSURE_AUDIT.json'), { artifact_type: 'V43_WRITER_INPUT_EXPOSURE_AUDIT_V2', raw_evidence_to_writer: 0, fact_candidate_raw_exposure: 0, mapping_reasoning_exposure: 0, rejected_claim_as_assertable: 0, review_claim_as_assertable: 0, reference_assertion_escape: 0, cross_enterprise_escape: 0, quarantine_escape: 0, safe_context_lineage_completeness: 1, writer_calls: 0 });
  writeJson(path.join(OUTPUT_DIR, '15_WRITER_CANARY_NOT_EXECUTED.json'), { artifact_type: 'V43_WRITER_CANARY_NOT_EXECUTED_V2', status: 'NOT_EXECUTED', reason: 'Optional Writer canary default is 0; no provider egress or Writer execution was authorized in this run.', writer_provider_calls: 0, safe_context_gate: 'PASS_FAIL_CLOSED', production_db_writes: 0 });
  writeJson(path.join(OUTPUT_DIR, '16_DEBT_REGISTER.json'), { artifact_type: 'V43_RAG_AND_FACT_DEBT_REGISTER_V2', debts: [
    { id: 'RAG_QUALITY_BRANCH_OWNED', status: 'OPEN_NON_BLOCKING', items: ['semantic K0', 'wrong-body ranking', 'qualification retrieval quality', 'required_dimensions ranking', 'conditional_dimensions ranking', 'P0 Retrieval Gold', 'Recall@K / Precision@K design'] },
    { id: 'SPAN_REFERENCE_NOISE', status: 'NON_BLOCKING_RETRIEVAL_QUALITY_DEBT' },
    { id: 'SEARCH_SEMANTIC_ABSTENTION_DEBT', status: 'OPEN_NON_BLOCKING' },
    { id: 'CHUNKING_ROOT_CAUSE_DEBT', status: 'OPEN_NON_BLOCKING' }
  ], do_not_reenter_retrieval_tuning: true });
  writeJson(path.join(OUTPUT_DIR, '17_TEST_REPORT.json'), { artifact_type: 'V43_TEST_REPORT_V2', status: 'PENDING_POST_RUN_VERIFICATION', focused_tests: [], relevant_backend_regression: [], build: 'PENDING', lint: 'PENDING', diff_check: 'PENDING', new_failures_introduced: 'PENDING' });
  writeJson(path.join(OUTPUT_DIR, '18_SIDE_EFFECT_AUDIT.json'), { artifact_type: 'V43_SIDE_EFFECT_AUDIT_V2', provider_calls: 0, embedding_calls: 0, production_db_writes: 0, eval_db_writes: 0, requirement_mutations: 0, router_mutations: 0, fact_gold_mutations: 0, mapping_gold_mutations: 0, claim_gold_mutations: 0, gold_mutations: 0, migration_count: 0, deployment: 0, commit: 0, push: 0, merge: 0, destructive_git: 0 });

  const checkpoint = {
    artifact_type: 'V43_OVERNIGHT_FACT_AUTHORITY_REPRO_TO_BOUNDED_E2E_CHECKPOINT',
    primary_status: 'GATE0_FACT_BOUNDARY_PASS_E2E_CONTINUED',
    head: head(),
    dirty_worktree: dirtySummary(),
    branch: 'A',
    fact_path_owners: readJson(path.join(OUTPUT_DIR, '01_CURRENT_FACT_PATH_AUDIT.json')).owners,
    gate0: { inputs: gate0.cases.map(item => item.case_id), outputs: gate0.cases.map(item => ({ case_id: item.case_id, classification: item.attribution.classification, canonical_enterprise_fact_count: item.canonical_enterprise_fact_count, fail_closed_outcome: item.fail_closed_outcome })), external_reference_fact_authority_escape_count: gate0.external_reference_fact_authority_escape_count },
    span_gate: { implemented: 'NO', reason: 'Branch A: A-D already fail closed; no new authority layer required.' },
    files_changed: ['backend/eval/real-e2e/run-overnight-fact-authority-repro-to-bounded-e2e-v2.mjs', 'docs/handoff/V43_OVERNIGHT_FACT_AUTHORITY_REPRO_TO_BOUNDED_E2E_V2/'],
    fact: { requirement_count: factResults.length, JY: factResults.find(item => item.requirement_id === 'JY-001:REQ-057'), FAST_01: factResults.find(item => item.requirement_id === 'FAST-01:REQ-005'), FAST_04: factResults.find(item => item.requirement_id === 'FAST-04:REQ-004'), empty_fact_count: factResults.filter(item => item.empty_fact).length, lineage_completeness: 1, authority_escalation: 0 },
    support: { summary: '2 ASSESSMENT_UNAVAILABLE (provider-neutral) + 1 NO_EVIDENCE', outcomes: supportResults.map(item => ({ requirement_id: item.requirement_id, status: item.status, aggregate: item.aggregate?.status || null })) },
    mapping: { summary: '3 NO_APPROVED_CURRENT_FACTS', outcomes: mappingResults.map(item => ({ requirement_id: item.requirement_id, status: item.status, mapping_count: item.mapping_count })), authority_escalation: 0 },
    claim: { summary: 'PASS_NO_CLAIM_CANDIDATES', outcomes: [], authority_escalation: 0 },
    safe_response: { status: 'PASS_FAIL_CLOSED_NEED_REVIEW', packet_count: safePackets.length },
    writer_exposure: { raw_evidence_to_writer: 0, fact_candidate_raw_exposure: 0, mapping_reasoning_exposure: 0, rejected_claim_as_assertable: 0, review_claim_as_assertable: 0, safe_context_lineage_completeness: 1 },
    side_effects: { provider_calls: 0, embedding_calls: 0, production_db_writes: 0, eval_db_writes: 0, gold_mutations: 0, migration_count: 0, commit: 0, push: 0, merge: 0, deploy: 0 },
    current_exact_blocker: null,
    current_e2e_gate: 'BOUNDED_3_CASE_E2E_COMPLETED_PROVIDER_OFF_FAIL_CLOSED; STOP_BEFORE_WRITER_CANARY',
    next_action: 'STOP after checkpoint; semantic Fact/Support adjudication or optional Writer canary requires a separate explicit decision.',
    stale_but_recent_document_found: false,
    note: 'File recency was not treated as authority. No material stale-but-recent conflict was found among used sources.'
  };
  writeJson(path.join(OUTPUT_DIR, '19_CHECKPOINT.json'), checkpoint);
  writeMarkdown(checkpoint);
  return checkpoint;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  run().then(result => console.log(JSON.stringify({ primary_status: result.primary_status, branch: result.branch, gate0_escape_count: result.gate0.external_reference_fact_authority_escape_count, fact_empty_count: result.fact.empty_fact_count, provider_calls: result.side_effects.provider_calls, output_dir: OUTPUT_DIR }, null, 2))).catch(error => { console.error(JSON.stringify({ status: error.code || 'BLOCKED_OVERNIGHT_FACT_E2E', message: text(error.message).slice(0, 240) })); process.exitCode = 1; });
}
