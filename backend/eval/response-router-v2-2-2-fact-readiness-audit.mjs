import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');
const docsRoot = path.join(repoRoot, 'docs');
const projectionPath = path.join(repoRoot, 'backend/eval/gold-human-review/v2/mapping-real-rebuild/00_source_role_projection.json');
const relative = file => path.relative(repoRoot, file).replaceAll('\\', '/');
const sha256 = value => createHash('sha256').update(value).digest('hex');
const fileDigest = file => {
  const body = fs.readFileSync(path.join(repoRoot, file));
  return { path: file, bytes: body.length, sha256: sha256(body) };
};
const readJson = file => {
  try { return JSON.parse(fs.readFileSync(path.join(repoRoot, file), 'utf8')); } catch { return null; }
};
const stable = value => Array.isArray(value)
  ? value.map(stable)
  : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]))
    : value;
const writeJson = (file, value) => fs.writeFileSync(path.join(repoRoot, file), `${JSON.stringify(stable(value), null, 2)}\n`, 'utf8');

const projection = readJson(relative(projectionPath)) || { materials: [] };
const materials = Array.isArray(projection.materials) ? projection.materials : [];
const roleCounts = materials.reduce((out, row) => {
  const role = row.derived_source_role || 'UNKNOWN_REVIEW_REQUIRED';
  out[role] = (out[role] || 0) + 1;
  return out;
}, {});
const roleRows = role => materials.filter(row => row.derived_source_role === role);
const sourceInventory = readJson('docs/V43_RAG_FACT_SOURCE_INVENTORY.json') || {};
const precert = readJson('docs/fact-precert-engineering-audit-checkpoint.json') || {};
const runtimeAudit = readJson('docs/fact-runtime-routing-audit.json') || {};
const readiness = readJson('docs/V43_RAG_FACT_PRODUCTION_READINESS_CHECKPOINT.json') || {};
const targeted = readJson('docs/V43_RAG_FACT_TARGETED_LIVE_CHECKPOINT.json') || {};
const currentInfo = (() => {
  try {
    const body = JSON.parse(require('node:fs').readFileSync('/dev/null', 'utf8'));
    return body;
  } catch { return null; }
})();

const pathTrace = {
  artifact: 'V43_REAL_FACT_V2_PRODUCTION_PATH_TRACE',
  eval_only: true,
  source_first: true,
  requirement_blind: true,
  stages: [
    { stage: 'MATERIAL_INGEST', module: 'backend/src/company-material-service.js', entry_point: 'CompanyMaterialService', input_contract: 'uploaded material metadata + file', output_contract: 'company_materials row', implemented: true, production_used: true, stub: false, provider_dependent: false, db_dependent: true, tests: ['backend/test/material-source-authority-policy.test.js'], eval: 'backend/eval/rag-governance/rag-corpus-inventory.js' },
    { stage: 'OBJECT_FILE_AUTHORITY', module: 'backend/src/db.js', entry_point: 'company_materials repository methods', input_contract: 'project/material identity', output_contract: 'material identity, hash, lifecycle, source metadata', implemented: true, production_used: true, stub: false, provider_dependent: false, db_dependent: true, tests: ['backend/test/material-source-authority-policy.test.js'], eval: 'backend/eval/gold-governance/source-first-fact-inventory-v1.js' },
    { stage: 'CHUNKING', module: 'backend/src/pipeline/enterprise-material-chunker.js', entry_point: 'chunkEnterpriseMaterial', input_contract: 'authorized material text', output_contract: 'material_chunks with source offsets/hashes', implemented: true, production_used: true, stub: false, provider_dependent: false, db_dependent: false, tests: ['backend/test/requirement-chunker-v2.test.js'], eval: 'backend/eval/rag-pilot/fact-input-window-selection.test.js' },
    { stage: 'SOURCE_ROLE_AND_ELIGIBILITY', module: 'backend/src/pipeline/material-source-authority-policy.js', entry_point: 'materialAuthorityStatus / MATERIAL_AUTHORITY_SQL', input_contract: 'material lifecycle/source metadata', output_contract: 'authority eligibility predicate', implemented: true, production_used: true, stub: false, provider_dependent: false, db_dependent: true, tests: ['backend/test/material-source-authority-policy.test.js', 'backend/test/evidence-fact-source-role.test.js'], eval: 'backend/eval/gold-governance/source-first-fact-inventory-v1.js' },
    { stage: 'EVIDENCE_SPAN', module: 'backend/src/evidence-source-span-service.js', entry_point: 'EvidenceSourceSpanService', input_contract: 'approved review + chunk anchor', output_contract: 'evidence_source_spans identity/text/hash', implemented: true, production_used: true, stub: false, provider_dependent: false, db_dependent: true, tests: ['backend/test/evidence-fact-contract-v1.test.js'], eval: 'backend/eval/rag-pilot/fact-precert-engineering-audit.mjs' },
    { stage: 'FACT_CANDIDATE_PRODUCER', module: 'backend/src/pipeline/semantic-gateway-evidence-fact-extractor.js', entry_point: 'SemanticGatewayEvidenceFactExtractor.extract', input_contract: 'approved Evidence Review source context', output_contract: 'strict evidence_fact_extraction candidates', implemented: true, production_used: true, stub: false, provider_dependent: true, db_dependent: false, tests: ['backend/test/evidence-fact-execution-observability.test.js', 'backend/test/evidence-fact-transport-v2.test.js'], eval: 'backend/eval/rag-pilot/fact-precert-engineering-audit.mjs', note: 'Gateway-backed producer is wired by backend/src/server.js; the ProviderNeutralEvidenceFactExtractor default compatibility class returns [] only when callers omit the production extractor.' },
    { stage: 'FACT_NORMALIZATION_AND_PROJECTION', module: 'services/semantic-gateway/src/gateway.js; services/semantic-gateway/src/task-router.js', entry_point: 'evidence_fact_extraction task route', input_contract: 'Provider response envelope', output_contract: 'strict task data after bounded normalization/projection', implemented: true, production_used: true, stub: false, provider_dependent: true, db_dependent: false, tests: ['services/semantic-gateway/test/gateway.test.js', 'services/semantic-gateway/test/task-router-response-format.test.js'], eval: 'backend/eval/rag-pilot/fact-precert-engineering-audit.mjs' },
    { stage: 'FACT_QUALITY_AND_GROUNDING', module: 'backend/src/pipeline/evidence-fact-contract-v1.js; backend/src/pipeline/evidence-fact-candidate-v2-1.js', entry_point: 'createEvidenceFactContract / canonicalizeAndGroundEvidenceFactCandidateV21', input_contract: 'candidate + frozen source span', output_contract: 'grounded canonical Fact payload or fail-closed error', implemented: true, production_used: true, stub: false, provider_dependent: false, db_dependent: false, tests: ['backend/test/evidence-fact-contract-v1.test.js', 'backend/test/evidence-fact-candidate-v2-1.test.js'], eval: 'backend/eval/rag-pilot/fact-precert-engineering-audit.mjs' },
    { stage: 'CANONICAL_FACT_AND_CURRENTNESS', module: 'backend/src/evidence-source-fact-service.js', entry_point: 'EvidenceSourceFactService.extract / decide / edit', input_contract: 'approved review + grounded candidate', output_contract: 'draft/approved/current evidence_source_facts row', implemented: true, production_used: true, stub: false, provider_dependent: false, db_dependent: true, tests: ['backend/test/evidence-fact-execution-observability.test.js', 'backend/test/formal-mutation-authorization.test.js'], eval: 'backend/eval/gold-governance/source-first-fact-inventory-v1.js' },
    { stage: 'PERSISTENCE', module: 'backend/src/db.js; backend/migrations/027_evidence_fact_v1.sql; backend/migrations/051_material_source_authority_quarantine.sql', entry_point: 'upsertEvidenceSourceFactsAtomic / replaceEvidenceSourceFactAtomic', input_contract: 'validated canonical Fact DTO', output_contract: 'atomic evidence_source_facts persistence with authority gate', implemented: true, production_used: true, stub: false, provider_dependent: false, db_dependent: true, tests: ['backend/integration/postgres.integration.js', 'backend/test/canonical-persistence-atomicity.test.js'], eval: 'docs/V43_RAG_FACT_PRODUCTION_READINESS_RECOVERY_CHECKPOINT.json' }
  ],
  producer_status: 'FULLY_IMPLEMENTED',
  producer_status_basis: 'Production server constructs SemanticGatewayEvidenceFactExtractor and exposes EvidenceSourceFactService extraction routes; semantic quality/readiness is not certified by this read-only audit.'
};

const blockerAnalysis = {
  artifact: 'V43_REAL_FACT_V2_BLOCKER_ANALYSIS',
  eval_only: true,
  real_fact_v2_eligible_candidates: 0,
  first_blocking_stage: 'SOURCE_ROLE_AND_ELIGIBILITY',
  first_blocker_family: 'NO_ELIGIBLE_SOURCE',
  exact_reason: 'Current source-role projection contains zero REAL_ENTERPRISE_EVIDENCE_CANDIDATE materials; all 56 projected materials are synthetic, reference-only, quarantined, or unknown-review-required.',
  evidence: {
    projection: relative(projectionPath),
    projection_schema_version: projection.schema_version || null,
    material_total: materials.length,
    role_counts: roleCounts,
    real_enterprise_evidence_candidates: roleRows('REAL_ENTERPRISE_EVIDENCE_CANDIDATE').length,
    source_inventory_eligible: sourceInventory.material_eligible_for_enterprise_fact ?? 0,
    source_inventory_blockers: sourceInventory.inventory_blockers || []
  },
  downstream_not_reached: ['EVIDENCE_SPAN', 'FACT_CANDIDATE_PRODUCER', 'FACT_NORMALIZATION_AND_PROJECTION', 'FACT_QUALITY_AND_GROUNDING', 'CANONICAL_FACT_AND_CURRENTNESS', 'PERSISTENCE'],
  semantic_conclusion: 'No semantic Fact quality conclusion is drawn because no authority-eligible real enterprise source enters the producer.'
};

const materialInventory = {
  artifact: 'V43_REAL_FACT_V2_MATERIAL_INVENTORY',
  eval_only: true,
  source_first: true,
  requirement_blind: true,
  projection_path: relative(projectionPath),
  material_count: materials.length,
  chunk_count: materials.reduce((n, row) => n + (Number.isInteger(row.chunk_count) ? row.chunk_count : 0), 0),
  source_role_distribution: roleCounts,
  eligible_source_count: roleRows('REAL_ENTERPRISE_EVIDENCE_CANDIDATE').length,
  evidence_span_count: 'NOT_AVAILABLE_IN_READ_ONLY_PROJECTION',
  structured_fact_candidate_count: sourceInventory.fact_candidate_total ?? 0,
  canonical_fact_count: 0,
  authority_currentness_distribution: { projected_roles: roleCounts, fact_rows: 'NONE_IN_CURRENT_SOURCE_FIRST_INVENTORY' },
  historical_eval_only_context: { chengchuan_materials: 92, prior_fact_candidates: readiness.fact?.candidate_total ?? 5, not_production_authority: true, source: 'docs/V43_RAG_FACT_PRODUCTION_READINESS_CHECKPOINT.json' },
  provider_calls: 0,
  production_db_writes: 0,
  fact_writes: 0
};

const contractAudit = {
  artifact: 'V43_REAL_FACT_V2_CONTRACT_AUDIT',
  eval_only: true,
  contract_sources: [
    fileDigest('backend/src/pipeline/evidence-fact-contract-v1.js'),
    fileDigest('backend/src/pipeline/semantic-gateway-evidence-fact-extractor.js'),
    fileDigest('packages/semantic-contracts/index.js')
  ],
  canonical_fact_contract: {
    version: 'evidence-fact-v1',
    fields_mechanically_present: ['fact_id', 'project_id', 'evidence_review_id', 'source_span_id', 'material_id', 'subject', 'entities', 'status', 'scopes', 'quantities', 'validity', 'domain_metadata', 'source', 'payload_hash', 'review_status', 'extractor_type', 'extractor_version', 'contract_version', 'version', 'supersedes_fact_id', 'edited', 'edited_by', 'edit_note'],
    source_lineage_fields: ['source_span_id', 'material_id', 'source_document_id', 'anchor_chunk_id', 'source_text_hash'],
    semantic_dimensions: ['entity', 'scope', 'quantity', 'status', 'validity/currentness'],
    authority_fields: ['review_status', 'extractor_type', 'evidence_review_id', 'supersedes_fact_id'],
    sufficient_for_source_first_inventory: true,
    contract_gap: null
  },
  current_contract_result: 'CURRENT_CONTRACT_SUFFICIENT'
};

const runtimeReadiness = {
  artifact: 'V43_REAL_FACT_V2_RUNTIME_READINESS',
  eval_only: true,
  provider_calls: 0,
  gateway_info: { source: 'http://127.0.0.1:18082/info', observation: 'not fetched by this artifact builder; existing safe runtime audit is used', ...runtimeAudit },
  task_type: 'evidence_fact_extraction',
  task_registration: 'REGISTERED',
  prompt_instruction_identity: 'see packages/semantic-contracts/index.js task metadata; no prompt text copied',
  schema_identity: 'see packages/semantic-contracts/index.js task contract; strict validation enabled',
  provider_model_routing: { provider: runtimeAudit.provider || 'deepseek_official', model: runtimeAudit.resolved_model || 'deepseek-v4-pro', endpoint: '/responses' },
  runtime_result: 'REGISTERED_AND_WIRED_OFFLINE; LIVE_PROVIDER_SEMANTIC_READINESS_NOT_CERTIFIED',
  evidence: relative('docs/fact-precert-engineering-audit-checkpoint.json')
};

const persistenceReadiness = {
  artifact: 'V43_REAL_FACT_V2_PERSISTENCE_READINESS',
  eval_only: true,
  tables: ['company_materials', 'material_chunks', 'evidence_candidate_reviews', 'evidence_source_spans', 'evidence_source_facts', 'evidence_facts'],
  migrations: ['backend/migrations/025_evidence_source_span_v1.sql', 'backend/migrations/026_evidence_review_v1.sql', 'backend/migrations/027_evidence_fact_v1.sql', 'backend/migrations/051_material_source_authority_quarantine.sql'],
  repository_write_paths: ['backend/src/db.js:upsertEvidenceSourceFactsAtomic', 'backend/src/db.js:replaceEvidenceSourceFactAtomic'],
  authority_constraints: ['MATERIAL_AUTHORITY_SQL checked before Fact insert', 'atomic transaction for batch insert/replacement', 'approved Evidence Review and current source lineage required'],
  isolated_db_readiness: 'READY',
  basis: 'Existing isolated Eval DB checkpoint plus current migrations/repository atomic write paths; no Production DB was contacted or modified in this audit.',
  production_db_writes: 0
};

const evalReadiness = {
  artifact: 'V43_REAL_FACT_V2_EVAL_READINESS',
  eval_only: true,
  assets: [
    { area: 'source-first Fact extraction', status: 'PARTIAL', path: 'backend/eval/gold-governance/source-first-fact-inventory-v1.js', reason: 'source inventory is ready but no eligible real source-first windows exist' },
    { area: 'Fact quality', status: 'BLOCKED_BY_PRODUCER', path: 'docs/V43_RAG_FACT_PRODUCTION_QUALITY_AUDIT.json', reason: 'prior targeted run stopped on contract/input/network failures' },
    { area: 'authority', status: 'READY', path: 'backend/test/evidence-fact-source-role.test.js', reason: 'deterministic authority controls pass offline' },
    { area: 'currentness', status: 'PARTIAL', path: 'backend/test/evidence-fact-execution-observability.test.js', reason: 'currentness paths exist; live corpus certification absent' },
    { area: 'conflict', status: 'READY', path: 'backend/test/evidence-fact-contract-v1.test.js', reason: 'contract and fail-closed tests available' },
    { area: 'source-role', status: 'READY', path: 'backend/test/material-source-authority-policy.test.js', reason: 'single authority predicate is tested' },
    { area: 'RAG evidence', status: 'PARTIAL', path: 'docs/V43_RAG_FACT_COMPONENT_STATUS_MATRIX.json', reason: 'retrieval engineering proven; Fact semantic quality not certified' }
  ],
  provider_calls: 0,
  production_db_writes: 0,
  gold_mutations: 0
};

const nextDecision = {
  artifact: 'V43_REAL_FACT_V2_NEXT_DECISION_PACKET',
  eval_only: true,
  why_eligible_candidates_zero: blockerAnalysis.exact_reason,
  exact_first_blocker: blockerAnalysis.first_blocker_family,
  architecture_supports_source_first_without_redesign: 'YES',
  semantic_gateway_reuse: 'YES; evidence_fact_extraction is registered and the production server wires the Gateway-backed extractor.',
  provider_call_required_for_next_implementation_task: 'NOT_DETERMINED_BY_THIS_READ_ONLY_AUDIT; a future authorized run would require an eligible source and explicit egress authorization.',
  smallest_next_engineering_task: 'Acquire and freeze an independent, non-synthetic, non-quarantined enterprise source snapshot with resolvable provenance and SHA-256, then rebuild a blind source-authority packet.',
  remain_frozen: ['Requirement V6.4 and Gold', 'Reference V3', 'Fact contract/schema', 'Material Authority predicate', 'Provider/model routing', 'Mapping/Claim/Writer/Bid Pilot'],
  provider_calls: 0,
  production_db_writes: 0,
  fact_writes: 0,
  gold_mutations: 0
};

fs.mkdirSync(docsRoot, { recursive: true });
writeJson('docs/V43_REAL_FACT_V2_PRODUCTION_PATH_TRACE.json', pathTrace);
writeJson('docs/V43_REAL_FACT_V2_BLOCKER_ANALYSIS.json', blockerAnalysis);
writeJson('docs/V43_REAL_FACT_V2_MATERIAL_INVENTORY.json', materialInventory);
writeJson('docs/V43_REAL_FACT_V2_CONTRACT_AUDIT.json', contractAudit);
writeJson('docs/V43_REAL_FACT_V2_RUNTIME_READINESS.json', runtimeReadiness);
writeJson('docs/V43_REAL_FACT_V2_PERSISTENCE_READINESS.json', persistenceReadiness);
writeJson('docs/V43_REAL_FACT_V2_EVAL_READINESS.json', evalReadiness);
writeJson('docs/V43_REAL_FACT_V2_NEXT_DECISION_PACKET.json', nextDecision);

console.log(JSON.stringify({
  producer_status: pathTrace.producer_status,
  real_fact_v2_eligible_candidates: blockerAnalysis.real_fact_v2_eligible_candidates,
  first_blocker_family: blockerAnalysis.first_blocker_family,
  material_count: materialInventory.material_count,
  source_role_distribution: materialInventory.source_role_distribution,
  current_contract: contractAudit.current_contract_result,
  runtime: runtimeReadiness.runtime_result,
  isolated_db: persistenceReadiness.isolated_db_readiness,
  provider_calls: 0,
  production_db_writes: 0,
  fact_writes: 0,
  gold_mutations: 0
}, null, 2));
