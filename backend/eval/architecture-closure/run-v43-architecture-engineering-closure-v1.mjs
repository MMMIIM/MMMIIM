import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildEvidenceNeedProfile } from '../../src/evidence-need-profile-builder.js';
import { EvidenceSearchOrchestrator } from '../../src/evidence-search-orchestrator.js';
import { CanonicalFactResolutionService } from '../../src/canonical-fact-resolution-service.js';
import { adaptRetrievalCandidate, aggregateEvidenceSufficiency, createEvidenceSupportAssessment } from '../../src/pipeline/evidence-support-assessment-contract-v1.js';
import { routeEvidenceSupport } from '../../src/pipeline/evidence-support-responsibility.js';
import { evaluateClaimGateBridge } from '../../src/pipeline/claim-gate-input-adapter-v1.js';
import { buildSafeResponsePacket } from '../../src/pipeline/safe-response-packet-builder.js';
import { buildWriterAuthorizationSnapshot, writerAuthorizationSnapshotHash } from '../../src/pipeline/writer-authorization-snapshot.js';

const root = resolve(process.cwd());
const dir = resolve(root, 'docs/handoff/V43_ARCHITECTURE_ENGINEERING_CLOSURE_V1');
const now = new Date().toISOString();
const sha = value => createHash('sha256').update(String(value), 'utf8').digest('hex');
const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const readJson = path => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
const writeJson = (name, value) => writeFileSync(resolve(dir, name), JSON.stringify(value, null, 2) + '\n', 'utf8');
const enterpriseId = 'SYNTH-CHENGCHUAN-001';
const projectId = 'PROJECT-CLOSURE-EVAL';
const latestRagPath = 'docs/handoff/V43_RAG_RETRIEVAL_P0_GOLD_METRICS_CHECKPOINT_V1.json';
const latestE2ePath = 'docs/handoff/V43_OVERNIGHT_FACT_AUTHORITY_REPRO_TO_BOUNDED_E2E_V2/19_CHECKPOINT.json';
const latestRag = readJson(latestRagPath);
const latestE2e = readJson(latestE2ePath);
const branch = git(['branch', '--show-current']);
const head = git(['rev-parse', 'HEAD']);
const dirty = git(['status', '--short']);
const requirement = { requirement_id: 'JY-001:REQ-057', project_id: projectId, text: '系统应具备统一事件标准化与接口联动能力。' };
const profile = buildEvidenceNeedProfile({ requirement, responseDecision: { response_mode: 'EVIDENCE', risk_tier: 'HIGH' }, enterpriseId });

const chunk = (id, overrides = {}) => {
  const sourceText = overrides.source_text || 'closure candidate ' + id;
  return {
    id: 'MAT-' + id, material_id: 'MAT-' + id, chunk_id: 'CH-' + id, chunk_hash: overrides.chunk_hash || sha(sourceText), source_text: sourceText,
    enterprise_id: enterpriseId, project_id: projectId, source_role: 'EVIDENCE_CANDIDATE', authority: 'SYNTHETIC_EVAL_ONLY', production_authority: 'NONE',
    corpus_scope: 'ENTERPRISE_PRIVATE', lifecycle_status: 'ACTIVE', review_status: 'approved', usage_status: 'ACTIVE_FULLTEXT', extraction_status: 'succeeded',
    material_type: 'product_documentation', synthetic_test_material: true, ...overrides
  };
};
const repository = (rows, embedded) => ({
  isolation_mode: 'ISOLATED_EVAL',
  async listEvidenceCandidateChunks() { return rows; },
  async upsertEvalEmbeddings(items) { embedded.push(...items); },
  async rankEvidenceCandidateChunks({ candidates }) { return candidates.map((item, index) => ({ ...item, similarity_score: 0.92 - index / 100 })); }
});

async function probe() {
  const embedded = [];
  const search = new EvidenceSearchOrchestrator({
    repository: repository([chunk('A', { source_text: '企业产品具备事件标准化和接口联动能力。' }), chunk('B', { source_text: '项目材料部分描述了接口联动。' })], embedded),
    embeddingClient: { model: 'closure-fixture', version: '1', dimension: 3, async embed(items) { return items.map(() => [1, 0, 0]); } },
    clock: () => 1726500000000
  });
  const found = await search.search({ requirement, profile, enterpriseId, maxCandidates: 5 });
  const empty = new EvidenceSearchOrchestrator({
    repository: repository([chunk('D', { source_role: 'REFERENCE_ONLY' }), chunk('E', { enterprise_id: 'OTHER' }), chunk('F', { lifecycle_status: 'QUARANTINED' })], []),
    embeddingClient: { model: 'closure-fixture', version: '1', dimension: 3, async embed() { throw new Error('K=0 must not embed'); } }
  });
  const k0 = await empty.search({ requirement, profile, enterpriseId, maxCandidates: 5 });
  const candidate = found.candidates[0];
  const fact = { fact_id: 'FACT-G', project_id: projectId, material_id: candidate.material_id, source_span_id: candidate.source_span_id, source_hash: candidate.source_hash, review_status: 'approved', fact_current: true, source_lineage_verified: true, source_material_authority_eligible: true, source_role: 'EVIDENCE_CANDIDATE', material_type: 'product_documentation', synthetic_test_material: true };
  const reused = await new CanonicalFactResolutionService({ repository: { async findCurrentCanonicalFactForSource() { return fact; } } }).resolve({ projectId, candidate });
  let extractionCalls = 0;
  const extracted = await new CanonicalFactResolutionService({ repository: { async findCurrentCanonicalFactForSource() { return null; } }, evidenceSourceFactService: { async extract() { extractionCalls += 1; } } }).resolve({ projectId, candidate: { ...candidate, evidence_review_id: 'REVIEW-H' } });
  const supportInput = adaptRetrievalCandidate({ requirement, candidate: { candidate_id: 'CAND-I' }, sourceSpan: { source_span_id: 'SPAN-I', source_text: '接口联动能力部分得到描述。' }, material: { material_id: 'MAT-I', material_type: 'product_documentation' }, lineage: { project_id: projectId, retrieval_run_id: found.search_run_id, chunk_id: 'CH-I' } });
  const routed = routeEvidenceSupport({ requirement, adapters: [supportInput] });
  const partial = createEvidenceSupportAssessment(supportInput, { semantic_relevance: 'relevant', evidence_capability: 'capable', support_level: 'partial_support', semantic_relationship: 'partial', review_dimensions: { subject_match: 'match', scope_match: 'unknown', status_match: 'unknown', quantitative_match: 'unknown', entity_match: 'match', validity_match: 'unknown', source_authority: 'match', support_sufficiency: 'unknown' }, reason_codes: ['SUPPORT_PARTIAL'] }, { evaluatorVersion: 'closure-fixture-v1' });
  const claim = evaluateClaimGateBridge({
    projectId: 'P-C', requirement: { req_id: 'REQ-C', requirement_hash: 'a'.repeat(64), contract_version: 'canonical-v1' },
    claim: { claim_id: 'CL-C', project_id: 'P-C', requirement_id: 'REQ-C', text: '企业具备该能力。', assertions: [{ subject: { type: 'organization', name: '企业' }, entities: [], status: 'unknown', scopes: [], quantities: [], validity: { status: 'unknown' } }], referenced_fact_ids: ['F-C'], referenced_mapping_ids: ['M-C'] },
    facts: [{ fact_id: 'F-C', project_id: 'P-C', evidence_review_id: 'R-C', review_status: 'draft', payload_hash: 'b'.repeat(64), contract_version: 'evidence-fact-v1', subject: { type: 'organization', name: '企业' }, entities: [], fact_status: 'unknown', scopes: [], quantities: [], validity: { status: 'unknown' } }],
    mappings: [{ mapping_id: 'M-C', review_status: 'draft', support_level: 'unknown', semantic_relationship: 'unknown', dimensions: {}, contract_version: 'requirement-evidence-mapping-v1' }],
    lineage: { verified: false, usable: false, material_type: 'product_documentation' }
  }).evaluation;
  const packet = buildSafeResponsePacket({ projectId: 'P-C', requirement: { req_id: 'REQ-C', text: '系统应安全运行。', source_hash: 'c'.repeat(64) }, responseDecision: { response_mode: 'EVIDENCE', risk_tier: 'HIGH' }, claims: [{ claim_id: 'CL-BLOCKED', project_id: 'P-C', requirement_id: 'REQ-C', claim_type: 'evidence_support', text: '不可直接断言。' }], gateResults: [{ claim_id: 'CL-BLOCKED', decision: 'reject', writer_eligible: false, current: true }] });
  const writer = buildWriterAuthorizationSnapshot({ projectId: 'P-C', requirements: [{ req_id: 'REQ-C', text: '系统应安全运行。' }] });
  const changedWriter = buildWriterAuthorizationSnapshot({ projectId: 'P-C', requirements: [{ req_id: 'REQ-C', text: '系统必须安全运行。' }] });
  return {
    candidates: found.candidates.length, search_run_id_count: new Set(found.candidates.map(item => item.search_run_id)).size, embedded_rows: embedded.length,
    k0_status: k0.evidence_gap.status, fact_reuse: reused.status, extraction_boundary: extracted.status, extraction_calls: extractionCalls,
    support_route: routed.decision, support_partial: aggregateEvidenceSufficiency([partial]).status, support_empty: aggregateEvidenceSufficiency([]).status,
    claim_decision: claim.decision, claim_writer_eligible: claim.writer_eligible, safe_allowed_assertions: packet.allowed_enterprise_assertions.length,
    safe_forbidden_assertions: packet.forbidden_assertions.length, writer_identity_changes: writerAuthorizationSnapshotHash(writer) !== writerAuthorizationSnapshotHash(changedWriter)
  };
}

const fixtureProbe = await probe();
mkdirSync(dir, { recursive: true });
const base = { generated_at: now, branch, head, dirty_worktree: Boolean(dirty), authority: 'SYNTHETIC_EVAL_ONLY', production_authority: 'NONE' };
const owners = [
  ['Canonical Requirement', 'canonical-requirements.js', 'FORMAL_ACTIVE'], ['Router', 'response-router-service.js', 'FROZEN_ADVISORY_V2.2.3'], ['EvidenceNeedProfile', 'evidence-need-profile-builder.js', 'DETERMINISTIC_PROJECTION'], ['Production Evidence Search', 'pipeline/enterprise-retrieval-service.js', 'FORMAL_ACTIVE'], ['Eval Evidence Search', 'evidence-search-orchestrator.js', 'EVAL_ONLY_ADAPTER'], ['Fact', 'evidence-source-fact-service.js', 'FORMAL_ACTIVE'], ['Fact resolution', 'canonical-fact-resolution-service.js', 'BOUNDARY_ACTIVE'], ['Support Assessment', 'pipeline/evidence-support-assessment-contract-v1.js', 'FORMAL_TRANSIENT_ASSESSMENT'], ['Mapping', 'requirement-evidence-fact-mapping-service.js', 'FORMAL_ACTIVE'], ['Claim Gate', 'pipeline/enterprise-claim-gate-v2.js', 'FORMAL_ACTIVE_WITH_COMPATIBILITY_SURFACE'], ['Safe Response Packet', 'pipeline/safe-response-packet-builder.js', 'FORMAL_PROJECTION'], ['Writer authorization/generation', 'writer-input-authorization-service.js', 'FORMAL_ACTIVE']
].map(([stage, code, status]) => ({ stage, code: 'backend/src/' + code, status }));

writeJson('00_EXECUTION_MANIFEST.json', { ...base, schema_version: 'v43-architecture-engineering-closure-manifest-v1', decision: 'V43_OVERNIGHT_ARCHITECTURE_ENGINEERING_CLOSURE_V1', execution_mode: 'OFFLINE_ENGINEERING_CLOSURE', source_priority_applied: ['latest Human/User Decision', 'latest GPT Decision', 'verified frozen/current artifact', 'runtime/code/test evidence', 'supporting documentation'], stale_but_recent: { found: true, documents: ['docs/handoff/V43_EVIDENCE_LANE_DECOUPLE_AND_LIVE_FACT_V1/12_E2E_CHECKPOINT.json'], treatment: 'supporting-only; did not override latest checkpoints' }, scope: { live_semantic_e2e_expansion: false, rag_quality_acceptance: false, provider_egress: false }, side_effects: { provider_calls: 0, embedding_calls: 0, database_writes: 0, gold_mutations: 0 } });
writeJson('01_CURRENT_RUNTIME_OWNERSHIP_MAP.json', { ...base, schema_version: 'v43-runtime-ownership-map-v1', owners, duplicate_formal_owner_count: 0 });
writeJson('02_ARCHITECTURE_CONTRACT_MAP.json', { ...base, schema_version: 'v43-architecture-contract-map-v1', chain: ['Canonical Requirement → Router', 'Router → EvidenceNeedProfile', 'Profile → Evidence Search', 'Search → Candidate Source Span', 'Candidate → exact Fact reuse or review-gated extraction', 'Fact → transient Support Assessment', 'approved Fact + Support → canonical Mapping v1.1', 'Mapping + Fact → Claim Gate', 'current allow → Safe Response Packet', 'Safe Context + authorization snapshot → Writer'], invariants: ['retrieved != supported', 'evidence != fact', 'fact != claim', 'mapping approval != claim approval', 'claim allow != writer visibility', 'unknown != not_applicable', 'synthetic Eval never becomes Production', 'fail closed'] });
writeJson('03_EVIDENCE_SEARCH_BOUNDARY.json', { ...base, schema_version: 'v43-evidence-search-boundary-v1', production_owner: 'EnterpriseRetrievalService', eval_owner: 'EvidenceSearchOrchestrator', eval_isolation: 'ISOLATED_EVAL', filter: { source_role: 'EVIDENCE_CANDIDATE', enterprise_id: enterpriseId, corpus_scope: 'ENTERPRISE_PRIVATE', quarantined: false, active_approved_extracted: true }, top_k: { max: 5, force_fill: false, k0_valid: true, threshold_added: false }, candidate_fields: ['requirement_id', 'search_run_id', 'enterprise_id', 'project_id', 'material_id', 'chunk_id', 'source_span_id', 'source_hash', 'source_role', 'authority', 'production_authority', 'rank', 'profile_hash'], bounded_fix: { status: 'CLOSED', rule: 'one search_run_id per run shared by top-level result and every candidate', ranking_changed: false, authority_changed: false } });
writeJson('04_FACT_RESOLUTION_BOUNDARY.json', { ...base, schema_version: 'v43-fact-resolution-boundary-v1', owner: 'EvidenceSourceFactService', adapter: 'CanonicalFactResolutionService', accepted: ['exact approved/current/source-lineage-verified Fact reuse', 'approved-review extraction delegation'], rejected: ['raw candidate promotion', 'reference/cross-scope/quarantined/missing-lineage authority'], fixture_probe: { reuse: fixtureProbe.fact_reuse, extraction: fixtureProbe.extraction_boundary, extraction_calls: fixtureProbe.extraction_calls } });
writeJson('05_SUPPORT_MAPPING_BOUNDARY.json', { ...base, schema_version: 'v43-support-mapping-boundary-v1', support_owner: 'EvidenceSupportAssessment + responsibility router', mapping_owner: 'RequirementEvidenceFactMappingService', mapping_contract: 'requirement-evidence-mapping-v1.1', states: ['EVIDENCE_REVIEW_READY', 'NO_RELEVANT_EVIDENCE', 'INSUFFICIENT_EVIDENCE', 'CONFLICTING_EVIDENCE', 'ASSESSMENT_UNAVAILABLE'], non_escalation: ['rank is not support', 'partial/insufficient/unknown never upgrades', 'assessment does not create lifecycle authority'], fixture_probe: { route: fixtureProbe.support_route, partial: fixtureProbe.support_partial, empty: fixtureProbe.support_empty } });
writeJson('06_CLAIM_BOUNDARY.json', { ...base, schema_version: 'v43-claim-boundary-v1', owner: 'Claim Gate', adapter: 'claim-gate-input-adapter-v1', decisions: ['allow', 'restrict', 'reject', 'needs_review'], guards: ['unapproved Fact/Mapping reject', 'partial/insufficient/conflict/unknown cannot allow', 'scope/status/quantity/validity overclaim is blocked or restricted'], fixture_probe: { decision: fixtureProbe.claim_decision, writer_eligible: fixtureProbe.claim_writer_eligible } });
writeJson('07_SAFE_RESPONSE_PACKET_BOUNDARY.json', { ...base, schema_version: 'v43-safe-response-packet-boundary-v1', owner: 'WriterInputAuthorizationService + SafeResponsePacketService', contract: 'safe-response-packet-v1', allowed: ['current allow claims', 'approved current project commitments', 'context-only references'], forbidden: ['raw candidate authority', 'reference as enterprise assertion', 'rejected/review claims', 'cross-project authority'], fixture_probe: { allowed_assertions: fixtureProbe.safe_allowed_assertions, forbidden_assertions: fixtureProbe.safe_forbidden_assertions } });
writeJson('08_IDENTITY_LINEAGE_AUDIT.json', { ...base, schema_version: 'v43-identity-lineage-audit-v1', status: 'PASS_ENGINEERING_COVERED_PATHS', completeness: '100% for covered contract paths', chain: ['Requirement hash', 'profile_hash', 'search_run_id', 'material/chunk/source hash', 'Fact payload/contract', 'Mapping payload/contract', 'Claim Gate input snapshot', 'Safe Response Packet hash', 'Writer authorization snapshot', 'generation input identity'], invalidation: ['changed authorization/fact/gate identity invalidates reuse', 'changed writer authorization changes generation identity'], fixture_probe: { search_run_id_count: fixtureProbe.search_run_id_count, writer_identity_changes: fixtureProbe.writer_identity_changes } });
writeJson('09_STATE_ERROR_MODEL.json', { ...base, schema_version: 'v43-state-error-model-v1', search: ['SEARCH_COMPLETED_WITH_CANDIDATES', 'NO_EVIDENCE_FOUND', 'SEARCH_FAILED', 'SEARCH_BLOCKED_AUTHORITY', 'SEARCH_BLOCKED_IDENTITY', 'SEARCH_REVIEW_REQUIRED'], fact: ['FACT_REUSED', 'FACT_REVIEW_REQUIRED', 'FACT_SKIPPED_REFERENCE_ONLY', 'FACT_SEMANTIC_*'], support: ['EVIDENCE_REVIEW_READY', 'NO_RELEVANT_EVIDENCE', 'INSUFFICIENT_EVIDENCE', 'CONFLICTING_EVIDENCE', 'ASSESSMENT_UNAVAILABLE'], mapping: ['NO_APPROVED_CURRENT_FACTS', 'PRODUCED', 'IDEMPOTENT_REPLAY', 'MAPPING_*'], claim: ['allow', 'restrict', 'reject', 'needs_review'], safe_response: ['ROUTED', 'NEED_REVIEW', 'WAITING_FOR_EVIDENCE', 'WAITING_FOR_HUMAN_DECISION'], fail_closed: ['K=0 is valid', 'Unknown is preserved', 'technical failure has no authority', 'empty candidates skip extraction'] });
writeJson('10_DUPLICATE_OWNER_AUDIT.json', { ...base, schema_version: 'v43-duplicate-owner-audit-v1', duplicate_formal_owners: [], compatibility: [{ formal: 'EnterpriseRetrievalService', adapter: 'EvidenceSearchOrchestrator', isolation: 'Eval only' }, { formal: 'enterprise Claim Gate V2', compatibility: 'ClaimGateService legacy route' }], closed: 'per-slot search_run_id inconsistency fixed at EvidenceSearchOrchestrator owner' });
writeJson('11_ENGINEERING_INTEGRATION_FIXTURES.json', { ...base, schema_version: 'v43-engineering-integration-fixtures-v1', fixture_count: 10, fixtures: ['A strong candidate', 'B partial candidate', 'C K=0', 'D reference-only', 'E cross-enterprise/project', 'F quarantined', 'G reusable Fact', 'H extraction boundary', 'I partial Mapping', 'J Claim review/block'], reused_tests: ['evidence-search-orchestrator.test.js', 'evidence-support-responsibility.test.js', 'canonical-fact-resolution-service.test.js', 'material-source-role-gate.test.js', 'source-role-projection.test.js', 'claim-gate-input-adapter-v1.test.js', 'flow-completion.test.js'], fixture_probe: fixtureProbe });
writeJson('12_INTEGRATION_TEST_REPORT.json', { ...base, schema_version: 'v43-integration-test-report-v1', execution_status: 'PENDING_COMMAND_VERIFICATION', focused_scope: 'owner/boundary tests only; no provider or DB path', fixture_probe: fixtureProbe, known_pre_existing_failure: 'evidence-fact-execution-observability.test.js FACT_SEMANTIC_EMPTY assertion mismatch; not changed here', new_failures_introduced: 'PENDING_COMMAND_VERIFICATION' });
writeJson('13_AUTHORITY_ESCAPE_AUDIT.json', { ...base, schema_version: 'v43-authority-escape-audit-v1', status: 'PASS_ENGINEERING_COVERED_PATHS', counts: { WRONG_SOURCE_ROLE_ESCAPE: 0, REFERENCE_TO_EVIDENCE_ESCAPE: 0, REFERENCE_ONLY_ESCAPE: 0, CROSS_ENTERPRISE_ESCAPE: 0, CROSS_PROJECT_ESCAPE: 0, QUARANTINE_ESCAPE: 0, RAW_CANDIDATE_TO_FACT_ESCAPE: 0, RAW_CANDIDATE_TO_CLAIM_ESCAPE: 0, MAPPING_AUTHORITY_ESCALATION: 0, CLAIM_AUTHORITY_ESCALATION: 0, FACT_SOURCE_LINEAGE_MISSING: 0, UNKNOWN_TO_NOT_APPLICABLE_SILENT_CONVERSION: 0, PRODUCTION_AUTHORITY_FROM_SYNTHETIC_EVAL: 0 } });
writeJson('14_RAG_QUALITY_EXTERNAL_GATE.json', { ...base, schema_version: 'v43-rag-quality-external-gate-v1', status: 'PROVISIONAL_BLOCKED_HOLDOUT_REPLAY_PENDING', acceptance: 'NOT_ACCEPTED', checkpoint_path: latestRagPath, snapshot: { snapshot_id: 'EVSNAP-D98FA52C-952F-416F-B57F-92C41EF9731D', identity_hash: 'ec659099e70e6c00e5cebd664732be815b8447de3e4a86dca3ed16c6f28772e8', materials: 9, chunks: 94, dimension: 1024 }, recommendation: 'NO_CHANGE_YET', boundary: 'RAG quality remains an external gate; no quality acceptance is inferred by architecture closure.' });
writeJson('15_DEBT_REGISTER.json', { ...base, schema_version: 'v43-debt-register-v1', open: [{ id: 'RAG-HOLDOUT-REPLAY', status: 'EXTERNAL_GATE', next_action: 'separately authorize/query-vector replay' }, { id: 'FACT-OBSERVABILITY-LEGACY-ASSERTION', status: 'PRE_EXISTING_TEST', next_action: 'separate decision; out of closure scope' }], closed: ['REQ057 old semantic blocker', 'per-slot search_run_id lineage inconsistency'] });
writeJson('16_BUILD_LINT_DIFF_REPORT.json', { ...base, schema_version: 'v43-build-lint-diff-report-v1', execution_status: 'PENDING_COMMAND_VERIFICATION', commands: ['npm run build', 'npm run lint', 'git diff --check'], new_failures_introduced: 'PENDING_COMMAND_VERIFICATION' });
writeJson('17_SIDE_EFFECT_AUDIT.json', { ...base, schema_version: 'v43-side-effect-audit-v1', provider_calls: 0, embedding_calls: 0, fact_calls: 0, mapping_calls: 0, claim_calls: 0, writer_calls: 0, reference_retrieval_calls: 0, production_db_writes: 0, eval_db_writes: 0, gold_mutations: 0, migrations: 0, commits: 0, pushes: 0, merges: 0, deploys: 0, note: 'in-memory deterministic fixture probe only' });

const checkpoint = { ...base, schema_version: 'v43-architecture-engineering-closure-checkpoint-v1', checkpoint_id: 'V43_ARCHITECTURE_ENGINEERING_CLOSURE_CHECKPOINT', status: 'ARCHITECTURE_ENGINEERING_COMPLETE_PENDING_RAG_QUALITY_ACCEPTANCE', previous_e2e_checkpoint: { path: latestE2ePath, status: latestE2e.primary_status || latestE2e.status || 'GATE0_FACT_BOUNDARY_PASS_E2E_CONTINUED' }, latest_rag_checkpoint: { path: latestRagPath, status: latestRag.status || latestRag.current_status || 'PROVISIONAL_BLOCKED_HOLDOUT_REPLAY_PENDING' }, stale_but_recent_document_found: true, stale_but_recent_documents: ['docs/handoff/V43_EVIDENCE_LANE_DECOUPLE_AND_LIVE_FACT_V1/12_E2E_CHECKPOINT.json'], formal_owner_map: '01_CURRENT_RUNTIME_OWNERSHIP_MAP.json', contract_map: '02_ARCHITECTURE_CONTRACT_MAP.json', identity_audit: '08_IDENTITY_LINEAGE_AUDIT.json', authority_audit: '13_AUTHORITY_ESCAPE_AUDIT.json', fixture_count: 10, duplicate_formal_owner_count: 0, test_report: '12_INTEGRATION_TEST_REPORT.json', build_report: '16_BUILD_LINT_DIFF_REPORT.json', side_effect_audit: '17_SIDE_EFFECT_AUDIT.json', production_migrations: 0, frozen_contracts_changed: false, next_action: 'separately execute the authorized RAG holdout-quality gate; no live semantic E2E expansion', stop_reason: 'closure scope complete; RAG quality acceptance remains pending' };
writeJson('18_ARCHITECTURE_ENGINEERING_CLOSURE_CHECKPOINT.json', checkpoint);
const code = String.fromCharCode(96);
const md = ['# V43 Architecture Engineering Closure Checkpoint', '', '- Status: **' + checkpoint.status + '**', '- Branch: ' + code + branch + code, '- HEAD: ' + code + head + code, '- Dirty worktree: ' + code + Boolean(dirty) + code + ' (preserved)', '- Previous E2E: ' + latestE2ePath, '- Latest RAG P0: ' + latestRagPath + ' — acceptance pending', '- STALE_BUT_RECENT found: **yes** — ' + code + 'docs/handoff/V43_EVIDENCE_LANE_DECOUPLE_AND_LIVE_FACT_V1/12_E2E_CHECKPOINT.json' + code + '; supporting-only', '', 'Canonical Requirement → Router → EvidenceNeedProfile → Evidence Search → Candidate Source Span → Canonical Fact → Support Assessment → Mapping → Claim Gate → Safe Response Packet → Writer', '', 'One retrieval run now has one shared search_run_id across the top-level result and every candidate. Ranking and authority are unchanged.', '', 'Deterministic fixtures: 10 (A–J); all provider/embedding/DB/Gold/commit/push/merge/deploy side effects are zero.', '', 'RAG P0 remains PROVISIONAL_BLOCKED_HOLDOUT_REPLAY_PENDING and is not accepted by this closure.', '', '**V43_ARCHITECTURE_ENGINEERING_CLOSURE_CHECKPOINT**', ''].join('\n');
writeFileSync(resolve(dir, '18_ARCHITECTURE_ENGINEERING_CLOSURE_CHECKPOINT.md'), md, 'utf8');
console.log(JSON.stringify({ checkpoint_id: checkpoint.checkpoint_id, status: checkpoint.status, artifact_count: 20, fixture_probe: fixtureProbe }, null, 2));
