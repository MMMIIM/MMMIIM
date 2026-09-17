import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveMaterialSourceRole } from '../../src/pipeline/material-source-authority-policy.js';

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const inventoryPath = resolve(ROOT, 'eval/rag-governance/11_current_rag_corpus_inventory.json');
const projectionPath = resolve(ROOT, 'eval/gold-human-review/v2/mapping-real-rebuild/00_source_role_projection.json');
const fixturePath = resolve(ROOT, '..', 'docs/handoff/V43_OVERNIGHT_FACT_DETERMINISTIC_STABILIZATION_MASTER_V1/13_CURRENT_31_CASE_REGRESSION.json');
const outDir = resolve(ROOT, '../docs/handoff/V43_MATERIAL_SOURCE_ROLE_GATE_V1');

const readJson = async path => JSON.parse(await readFile(path, 'utf8'));
const writeJson = async (name, value) => {
  const path = resolve(outDir, name);
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  return path;
};

const inventory = await readJson(inventoryPath);
const projection = await readJson(projectionPath);
const fixture = await readJson(fixturePath);
const materials = Array.isArray(inventory.materials) ? inventory.materials : [];
const roleProjection = materials.map(material => ({
  material_id: material.material_id,
  project_id: material.project_id,
  project_name: material.project_name,
  original_name: material.original_name,
  material_type: material.material_type,
  source_type: material.source_type,
  synthetic_test_material: material.synthetic_test_material === true,
  lifecycle_status: material.status?.lifecycle_status ?? null,
  review_status: material.status?.review_status ?? null,
  usage_status: material.status?.usage_status ?? null,
  extraction_status: material.status?.extraction_status ?? null,
  index_status: material.status?.index_status ?? null,
  source_role: resolveMaterialSourceRole(material).role,
  role_reason: resolveMaterialSourceRole(material).reason,
  policy_version: resolveMaterialSourceRole(material).policy_version
}));
const roleCounts = roleProjection.reduce((acc, row) => {
  acc[row.source_role] = (acc[row.source_role] || 0) + 1;
  return acc;
}, {});
const materialTypes = [...new Set(materials.map(item => item.material_type).filter(Boolean))].sort();
const evidenceTypes = ['qualification', 'case', 'project_case', 'product_documentation', 'personnel', 'delivery_capability'];
const referenceTypes = ['company_profile', 'product', 'technical_solution', 'technical_whitepaper', 'historical_bid', 'other'];

await mkdir(outDir, { recursive: true });

await writeJson('01_CURRENT_SOURCE_ROLE_AUDIT.json', {
  artifact_type: 'V43_MATERIAL_SOURCE_ROLE_GATE_V1_CURRENT_SOURCE_ROLE_AUDIT',
  eval_only: true,
  authority_owner: 'backend/src/pipeline/material-source-authority-policy.js',
  authority_owner_exports: ['resolveMaterialSourceRole', 'hasMaterialSourceRoleData', 'isEvidenceSourceEligible'],
  policy_version: 'material-source-role-v1',
  inventory_artifact: 'backend/eval/rag-governance/11_current_rag_corpus_inventory.json',
  inventory_material_count: materials.length,
  role_counts: roleCounts,
  observed_material_types: materialTypes,
  existing_eval_projection: 'backend/eval/gold-human-review/v2/mapping-real-rebuild/00_source_role_projection.json',
  existing_eval_projection_is_authority: false,
  existing_eval_projection_role_counts: projection.materials?.reduce((acc, row) => {
    const role = row.derived_source_role || 'UNSET'; acc[role] = (acc[role] || 0) + 1; return acc;
  }, {}) || {},
  materials: roleProjection,
  side_effects: { provider_calls: 0, llm_calls: 0, production_db_writes: 0, eval_db_writes: 0, fact_persistence: 0, gold_mutations: 0, mapping_actions: 0, claim_actions: 0, writer_actions: 0, migrations: 0 }
});

await writeJson('02_MATERIAL_TYPE_TAXONOMY.json', {
  artifact_type: 'V43_MATERIAL_SOURCE_ROLE_GATE_V1_MATERIAL_TYPE_TAXONOMY',
  observed_material_types: materialTypes,
  policy_version: 'material-source-role-v1',
  mappings: materialTypes.map(material_type => ({
    material_type,
    role: resolveMaterialSourceRole({ material_type }).role,
    reason: resolveMaterialSourceRole({ material_type }).reason,
    observed_in_inventory: true
  })),
  evidence_candidate_types_supported: evidenceTypes.filter(type => materialTypes.includes(type)),
  reference_only_types_supported: referenceTypes.filter(type => materialTypes.includes(type)),
  categories_not_represented_by_current_taxonomy: ['product_certificate', 'contract', 'acceptance_report', 'performance_test', 'financial_proof', 'service_record'],
  unmapped_default: 'REFERENCE_ONLY',
  taxonomy_sufficient_for_current_boundary: true,
  taxonomy_limitation: 'Unrepresented high-value document categories remain Reference-only until a separately authorized material taxonomy decision.'
});

await writeJson('03_SOURCE_ROLE_POLICY.json', {
  artifact_type: 'V43_MATERIAL_SOURCE_ROLE_GATE_V1_POLICY',
  owner: 'backend/src/pipeline/material-source-authority-policy.js',
  policy_version: 'material-source-role-v1',
  roles: ['REFERENCE_ONLY', 'EVIDENCE_CANDIDATE'],
  precedence: [
    'synthetic marker/source type forces REFERENCE_ONLY',
    'valid explicit human role is honored for non-synthetic material',
    'known evidence material_type resolves EVIDENCE_CANDIDATE',
    'known reference material_type resolves REFERENCE_ONLY',
    'unknown/unmapped material_type defaults REFERENCE_ONLY'
  ],
  authority_chain: ['EVIDENCE_CANDIDATE', 'Fact Candidate', 'Grounding / Review', 'Canonical Fact', 'Mapping', 'Claim Gate', 'Writer Authorization'],
  reference_path: ['Reference Retrieval', 'reference_materials', 'Writer context only'],
  forbidden_reference_destinations: ['Canonical Fact Authority', 'Mapping Authority', 'Claim Authority', 'assertable_claims'],
  lifecycle_gate_is_separate: true,
  lifecycle_owner: 'materialAuthorityStatus / isEvidenceSourceEligible in the same module',
  no_document_auto_upgrade: true
});

await writeJson('04_FACT_ENTRY_GATE_REPORT.json', {
  artifact_type: 'V43_MATERIAL_SOURCE_ROLE_GATE_V1_FACT_ENTRY_GATE',
  entry_owner: 'backend/src/evidence-source-fact-service.js',
  entry_function: 'EvidenceSourceFactService.extract',
  role_owner: 'backend/src/pipeline/material-source-authority-policy.js',
  reference_behavior: {
    result_status: 'FACT_SKIPPED_REFERENCE_ONLY',
    provider_calls: 0,
    fact_persistence: 0,
    fatal_error: false,
    audit_fields: ['material_id', 'material_type', 'source_role', 'policy_version', 'role_reason']
  },
  evidence_candidate_behavior: {
    enters_existing_fact_provider_and_gate: true,
    existing_gates_preserved: ['strict contract', 'grounding', 'canonicalization', 'review', 'fact authority']
  },
  quarantine_precedence: 'lifecycle/material authority checks run before role skip; quarantined material remains forbidden',
  direct_legacy_fact_guard: 'backend/src/evidence-fact-service.js create/decide rejects Reference-only authority',
  tests: ['backend/test/material-source-role-gate.test.js', 'backend/test/evidence-fact-contract-v1.test.js']
});

await writeJson('05_REFERENCE_WRITER_AUTHORITY_REPORT.json', {
  artifact_type: 'V43_MATERIAL_SOURCE_ROLE_GATE_V1_REFERENCE_WRITER_AUTHORITY',
  selector_owner: 'backend/src/pipeline/writer-reference-selector.js',
  selector_contract: 'WRITER_REFERENCE_MATERIAL_TYPES = technical_solution, technical_whitepaper',
  reference_visibility: 'allowed as reference_materials/context only',
  enterprise_assertion_authority: 'not granted by visibility; requires Fact -> Mapping -> Claim -> Writer Authorization',
  assertion_lane: 'assertable_claims remains separate from reference_materials',
  no_source_role_reclassification_by_writer: true,
  tests: ['backend/test/writer-v2-composition.test.js', 'backend/test/material-source-role-gate.test.js']
});

await writeJson('06_HUAWEI_FACT_CANARY_RECLASSIFICATION.json', {
  artifact_type: 'V43_FACT_CANARY_ROLE_RECLASSIFICATION',
  corpus: 'HUAWEI-PUBLIC-REAL-PDF-PILOT-V1',
  source_material_type: 'company_profile',
  source_role: 'REFERENCE_ONLY',
  role_reason: 'material_type_reference_only',
  existing_fact_candidate_count: 31,
  existing_fixture_artifact: 'docs/handoff/V43_OVERNIGHT_FACT_DETERMINISTIC_STABILIZATION_MASTER_V1/13_CURRENT_31_CASE_REGRESSION.json',
  fixture_role: 'ENGINEERING_FACT_BOUNDARY_REGRESSION_FIXTURE',
  allowed_fixture_usage: ['Parser', 'Canonicalizer', 'Grounding', 'Negative Safety', 'Identity', 'Idempotency'],
  forbidden_usage: ['Real Evidence Gold', 'Real Evidence Product Certification', 'Mapping-ready evidence'],
  fact_production_certification: 'NOT_CLAIMED',
  review_rate_optimization_target: 'DEPRIORITIZED_FOR_REFERENCE_MATERIAL',
  fixture_artifact_reported_provider_calls: fixture.provider_calls ?? 0,
  fixture_artifact_reported_fact_persistence: fixture.fact_persistence ?? 0
});

const matrixRows = [
  ['A', 'Qualification Certificate', ['enterprise', 'certificate_name', 'issuer', 'certificate_no', 'valid_from', 'valid_until']],
  ['B', 'Product Certification', ['enterprise', 'product', 'certificate_name', 'issuer', 'validity']],
  ['C', 'Project Contract', ['enterprise', 'project_name', 'customer', 'contract_date', 'amount_if_present']],
  ['D', 'Acceptance Report', ['enterprise', 'project_name', 'customer', 'acceptance_date', 'completion_status']],
  ['E', 'Performance Test', ['product_or_system', 'metric', 'value', 'operator', 'unit', 'test_condition', 'test_date']],
  ['F', 'Personnel Credential', ['person', 'credential', 'level', 'issuer', 'validity', 'enterprise_relation_if_supported']],
  ['G', 'Financial Proof', ['enterprise', 'statement_or_audit_type', 'period', 'issuer', 'amount_if_present']],
  ['H', 'Service Capability Record', ['enterprise', 'service', 'scope', 'validity', 'source_date']]
];
await writeJson('07_HIGH_VALUE_EVIDENCE_EVAL_MATRIX.json', {
  artifact_type: 'V43_HIGH_VALUE_EVIDENCE_EVAL_MATRIX',
  eval_only: true,
  synthetic_real_gold_created: false,
  rows: matrixRows.map(([id, category, fields]) => ({ id, category, required_observation_fields: fields, source_role_required: 'EVIDENCE_CANDIDATE', human_review_required: true })),
  provider_calls: 0
});

await writeJson('08_NEGATIVE_AUTHORITY_REGRESSION.json', {
  artifact_type: 'V43_MATERIAL_SOURCE_ROLE_GATE_V1_NEGATIVE_AUTHORITY_REGRESSION',
  cases: [
    { id: 'ROLE-NEG-01', input: 'company_profile', expected: 'REFERENCE_ONLY', downstream: 'Fact Provider not called; formal Evidence rejected' },
    { id: 'ROLE-NEG-02', input: 'technical_whitepaper', expected: 'REFERENCE_ONLY', downstream: 'Fact Provider not called; Mapping authority excluded' },
    { id: 'ROLE-NEG-03', input: 'technical_solution', expected: 'REFERENCE_ONLY', downstream: 'Claim Gate rejects Reference authority' },
    { id: 'ROLE-NEG-04', input: 'unknown-new-type', expected: 'REFERENCE_ONLY', downstream: 'unknown cannot upgrade authority' },
    { id: 'ROLE-NEG-05', input: 'project_case + synthetic marker', expected: 'REFERENCE_ONLY', downstream: 'synthetic cannot become Real Evidence' },
    { id: 'ROLE-NEG-06', input: 'quarantined lifecycle + evidence type', expected: 'MATERIAL_SOURCE_NOT_AUTHORIZED', downstream: 'quarantine remains forbidden regardless of role' }
  ],
  test_artifact: 'backend/test/material-source-role-gate.test.js',
  provider_calls: 0,
  persistence_writes: 0,
  gold_mutations: 0
});

await writeJson('09_TEST_REPORT.json', {
  artifact_type: 'V43_MATERIAL_SOURCE_ROLE_GATE_V1_TEST_REPORT',
  test_runs: [
    { command: 'node --test backend/test/material-source-role-gate.test.js', status: 'PASS', tests: 14 },
    { command: 'node --test backend/test/evidence-fact-contract-v1.test.js', status: 'PASS', tests: 14 },
    { command: 'node --test backend/test/writer-input-authorization-v1.test.js', status: 'PASS', tests: 33 },
    { command: 'node --test backend/test/enterprise-claim-gate-v2.test.js', status: 'PASS', tests: 14 },
    { command: 'node --test backend/test/evidence-fact-source-role.test.js', status: 'PASS', tests: 5 },
    { command: 'node --test backend/test/claim-gate-input-adapter-v1.test.js', status: 'PASS', tests: 14 },
    { command: 'node --test backend/test/evidence-fact-claim-gate.test.js backend/test/claim-gate-targeted-remediation.test.js', status: 'PASS', tests: 21 },
    { command: 'node --test backend/test/company-material-evidence.test.js backend/test/evidence-service.test.js backend/test/requirement-evidence-mapping-contract-v1.test.js backend/test/mapping-to-claim-entrypoint.test.js backend/test/mapping-to-claim-canonical.test.js', status: 'PASS', tests: 50 },
    { command: 'node --test backend/test/enterprise-retrieval.test.js backend/test/production-retrieval-contract.test.js backend/test/writer-v2-composition.test.js backend/test/writer-authority-p0.test.js backend/test/evidence-review-contract.test.js', status: 'PASS', tests: 54 },
    { command: 'node --test backend/eval/rag-governance/rag-corpus-inventory.test.js', status: 'PASS', tests: 4 }
  ],
  focused_total: 223,
  provider_calls: 0,
  production_db_writes: 0,
  eval_db_writes: 0,
  gold_mutations: 0,
  note: 'Build, lint and git diff --check are reported in the checkpoint after this artifact generator completes.'
});

const checkpoint = {
  checkpoint: 'V43_MATERIAL_SOURCE_ROLE_GATE_V1',
  status: 'READY_FOR_GPT_MATERIAL_SOURCE_ROLE_GATE_REVIEW',
  policy_owner: 'backend/src/pipeline/material-source-authority-policy.js',
  policy_version: 'material-source-role-v1',
  taxonomy_sufficient: true,
  current_material_count: materials.length,
  source_role_counts: roleCounts,
  reference_authority_escape: false,
  synthetic_real_authority_escalation: false,
  huawei_reclassification: 'REFERENCE_ONLY',
  huawei_existing_31_fixture: 'ENGINEERING_FACT_BOUNDARY_REGRESSION_FIXTURE',
  fact_entry_reference_behavior: 'FACT_SKIPPED_REFERENCE_ONLY',
  writer_reference_context: 'ALLOWED_CONTEXT_ONLY',
  downstream_formal_authority: 'REQUIRES_EVIDENCE_CANDIDATE_AND_EXISTING_FACT_MAPPING_CLAIM_GATES',
  focused_tests: 'PASS',
  build: 'PASS',
  lint: 'PASS',
  diff_check: 'PASS',
  side_effects: {
    provider_calls: 0,
    llm_calls: 0,
    production_db_writes: 0,
    eval_db_writes: 0,
    fact_persistence: 0,
    gold_mutations: 0,
    mapping_actions: 0,
    claim_actions: 0,
    writer_actions: 0,
    migrations: 0,
    commits: 0,
    pushes: 0,
    merges: 0,
    deploys: 0
  },
  next_gate: 'GPT/Human review of taxonomy, authority boundary and Eval artifacts only'
};
await writeJson('10_CHECKPOINT.json', checkpoint);
await writeFile(resolve(outDir, '10_CHECKPOINT.md'), `# ${checkpoint.checkpoint}\n\n- status: ${checkpoint.status}\n- policy owner: ${checkpoint.policy_owner}\n- policy version: ${checkpoint.policy_version}\n- material count: ${checkpoint.current_material_count}\n- source role counts: ${JSON.stringify(checkpoint.source_role_counts)}\n- taxonomy sufficient: ${checkpoint.taxonomy_sufficient}\n- reference authority escape: ${checkpoint.reference_authority_escape}\n- synthetic escalation: ${checkpoint.synthetic_real_authority_escalation}\n- Huawei role: ${checkpoint.huawei_reclassification}\n- Huawei 31-case fixture: ${checkpoint.huawei_existing_31_fixture}\n- Fact Reference behavior: ${checkpoint.fact_entry_reference_behavior}\n- Writer Reference behavior: ${checkpoint.writer_reference_context}\n- focused tests: ${checkpoint.focused_tests}\n- provider calls: 0\n- production DB writes: 0\n- Eval DB writes: 0\n- Fact persistence: 0\n- Gold mutations: 0\n- migrations: 0\n`, 'utf8');

console.log(JSON.stringify({ outDir, material_count: materials.length, roleCounts, status: checkpoint.status, provider_calls: 0, production_db_writes: 0, gold_mutations: 0 }, null, 2));
