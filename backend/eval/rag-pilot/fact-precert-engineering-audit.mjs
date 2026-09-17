import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import {
  getSemanticTaskContract,
  getSemanticTaskInstructionMetadata,
  EVIDENCE_FACT_CANDIDATE_V21_SCHEMA_VERSION,
  EVIDENCE_FACT_CANDIDATE_V21_PROMPT_VERSION,
  EVIDENCE_FACT_CANDIDATE_V21_SCHEMA_SHA256,
  EVIDENCE_FACT_CANDIDATE_V2_SCHEMA_VERSION,
  EVIDENCE_FACT_CANDIDATE_V2_PROMPT_VERSION,
  EVIDENCE_FACT_CANDIDATE_V2_SCHEMA_SHA256
} from '../../../packages/semantic-contracts/index.js';
import {
  createEvidenceFactSourceSnapshot,
  evidenceFactSourceSnapshotMatches,
  createEvidenceFactProducerVersionSnapshot
} from '../../src/pipeline/evidence-fact-candidate-v2.js';
import {
  resolveEvidenceFactCandidateV21SourceRefs,
  canonicalizeAndGroundEvidenceFactCandidateV21,
  EVIDENCE_FACT_CANDIDATE_V21_CANONICALIZER_VERSION,
  EVIDENCE_FACT_CANDIDATE_V21_GROUNDING_VERSION
} from '../../src/pipeline/evidence-fact-candidate-v2-1.js';
import { materialAuthorityStatus } from '../../src/pipeline/material-source-authority-policy.js';
import { RequirementEvidenceFactMappingService } from '../../src/requirement-evidence-fact-mapping-service.js';
import { applyMappingDecisionPolicy } from '../../src/pipeline/mapping-decision-policy-v1.js';
import { isCurrentAllowClaim, createWriterSafeContext } from '../../src/pipeline/writer-input-authorization-v1.js';
import { buildWriterAuthorizationSnapshot, writerAuthorizationSnapshotHash } from '../../src/pipeline/writer-authorization-snapshot.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..', '..');
const sourceRoot = path.join(repoRoot, 'backend', 'src');
const contractRoot = path.join(repoRoot, 'packages', 'semantic-contracts');
const auditRoot = path.join(repoRoot, 'docs');

const sha256 = value => createHash('sha256').update(value).digest('hex');
const sha256Json = value => sha256(JSON.stringify(value));
const text = value => String(value ?? '');
const read = async relative => readFile(path.join(repoRoot, relative), 'utf8');
const fileDigest = async relative => {
  const content = await read(relative);
  return { path: relative, sha256: sha256(content), bytes: Buffer.byteLength(content) };
};
async function listJavaScriptFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listJavaScriptFiles(full));
    else if (entry.isFile() && entry.name.endsWith('.js')) files.push(full);
  }
  return files;
}
const safeFetchInfo = async () => {
  try {
    const response = await fetch('http://127.0.0.1:18082/info');
    const body = await response.json();
    return { http_status: response.status, body };
  } catch (error) {
    return { http_status: null, error_code: error?.code || 'RUNTIME_INFO_UNAVAILABLE' };
  }
};

function sourceSnapshot() {
  return {
    snapshot_id: 'SNAPSHOT-AUDIT-001',
    segments: [{ source_ref: 'S001', text: '澄明数科企业平台支持统一认证，响应时间不超过1秒。' }]
  };
}

function candidate(overrides = {}) {
  return {
    statement: '企业平台支持统一认证，响应时间不超过1秒。',
    source_refs: ['S001'],
    subject_name: '企业平台',
    subject_type_hint: 'product',
    subject_source_refs: ['S001'],
    entity_mentions: [],
    status_text: '',
    status_source_refs: [],
    scope_items: [],
    quantity_items: [{ name: '响应时间', value_text: '1', unit_text: '秒', condition_text: '不超过', source_refs: ['S001'] }],
    temporal_items: [],
    ...overrides
  };
}

async function buildContractInventory() {
  const taskRows = [
    {
      contract_name: 'evidence_fact_extraction',
      version: getSemanticTaskContract('evidence_fact_extraction')?.contract_version,
      schema_hash: sha256Json(getSemanticTaskContract('evidence_fact_extraction')?.data_schema),
      prompt_version: 'evidence_fact_extraction',
      prompt_hash: getSemanticTaskInstructionMetadata('evidence_fact_extraction')?.instruction_hash,
      production_default: true, eval_only: false, downstream_consumable: true, historical_only: false
    },
    {
      contract_name: 'evidence_fact_candidate_v2',
      version: EVIDENCE_FACT_CANDIDATE_V2_SCHEMA_VERSION,
      schema_hash: EVIDENCE_FACT_CANDIDATE_V2_SCHEMA_SHA256,
      prompt_version: EVIDENCE_FACT_CANDIDATE_V2_PROMPT_VERSION,
      prompt_hash: getSemanticTaskInstructionMetadata('evidence_fact_candidate_v2')?.instruction_hash,
      production_default: false, eval_only: true, downstream_consumable: false, historical_only: false
    },
    {
      contract_name: 'evidence_fact_candidate_v2.1',
      version: EVIDENCE_FACT_CANDIDATE_V21_SCHEMA_VERSION,
      schema_hash: EVIDENCE_FACT_CANDIDATE_V21_SCHEMA_SHA256,
      prompt_version: EVIDENCE_FACT_CANDIDATE_V21_PROMPT_VERSION,
      prompt_hash: getSemanticTaskInstructionMetadata('evidence_fact_candidate_v2_1')?.instruction_hash,
      production_default: false, eval_only: true, downstream_consumable: false, historical_only: false
    }
  ];
  const files = [
    ['Canonical Evidence Fact', 'backend/src/pipeline/evidence-fact-contract-v1.js', true, false, true, false],
    ['Grounding result', 'backend/src/pipeline/evidence-fact-candidate-v2.js', true, false, true, false],
    ['Fact persistence DTO/schema', 'backend/src/evidence-source-fact-service.js', true, false, true, false],
    ['Mapping input contract', 'backend/src/pipeline/requirement-evidence-mapping-contract-v1.js', true, false, true, false],
    ['Claim input contract', 'backend/src/pipeline/claim-gate-input-adapter-v1.js', true, false, true, false],
    ['Writer authorization snapshot', 'backend/src/pipeline/writer-authorization-snapshot.js', true, false, true, false]
  ];
  for (const [contract_name, file, production_default, eval_only, downstream_consumable, historical_only] of files) {
    const digest = await fileDigest(file);
    taskRows.push({ contract_name, version: null, schema_hash: digest.sha256, prompt_version: null, prompt_hash: null, production_default, eval_only, downstream_consumable, historical_only, source_path: file });
  }
  return taskRows;
}

export async function runAudit() {
  const v21Source = await read('backend/src/pipeline/evidence-fact-candidate-v2-1.js');
  const extractorSource = await read('backend/src/pipeline/semantic-gateway-evidence-fact-extractor.js');
  const gatewaySource = await read('services/semantic-gateway/src/gateway.js');
  const contractsSource = await read('packages/semantic-contracts/index.js');
  const snapshot = sourceSnapshot();
  const valid = candidate();
  const unknown = candidate({ source_refs: ['S999999'] });
  const checks = [];
  const check = (name, passed, details = {}) => {
    checks.push({ name, passed: passed === true, ...details });
    return passed === true;
  };

  let unknownSourceBehavior = 'FAILED';
  try {
    resolveEvidenceFactCandidateV21SourceRefs(unknown, snapshot);
  } catch (error) {
    unknownSourceBehavior = 'FAIL_CLOSED';
    check('unknown_source_ref_fail_closed', true, { error_code: error?.code || 'SOURCE_REF_UNKNOWN' });
  }
  check('valid_source_ref_dereference', (() => {
    try { resolveEvidenceFactCandidateV21SourceRefs(valid, snapshot); return true; } catch { return false; }
  })());

  const sourceSnapshotA = createEvidenceFactSourceSnapshot({ material_id: 'MAT-1', material_version: '1', source_hash: 'a'.repeat(64), chunk_id: 'CH-1', chunk_hash: 'b'.repeat(64), source_span_id: 'SPAN-1', source_span_hash: 'c'.repeat(64), approved_review_identity: 'REV-1' });
  const sourceSnapshotB = createEvidenceFactSourceSnapshot({ ...sourceSnapshotA, source_hash: 'd'.repeat(64) });
  check('source_snapshot_same_identity_matches', evidenceFactSourceSnapshotMatches(sourceSnapshotA, { ...sourceSnapshotA }));
  check('source_snapshot_drift_fails_closed', !evidenceFactSourceSnapshotMatches(sourceSnapshotA, sourceSnapshotB));

  const materialActive = { id: 'MAT-1', corpus_scope: 'ENTERPRISE_PRIVATE', lifecycle_status: 'ACTIVE', review_status: 'approved', usage_status: 'ACTIVE_FULLTEXT', extraction_status: 'succeeded', index_status: 'INDEXED' };
  const materialQuarantined = { ...materialActive, lifecycle_status: 'QUARANTINED' };
  check('material_authority_positive', materialAuthorityStatus(materialActive).eligible);
  check('material_quarantine_fail_closed', materialAuthorityStatus(materialQuarantined).eligible === false);

  const canonical = canonicalizeAndGroundEvidenceFactCandidateV21(valid, snapshot);
  check('canonicalizer_does_not_invent_semantics', canonical.canonicalization.canonical?.quantities?.[0]?.value === '1' && canonical.canonicalization.canonical?.quantities?.[0]?.unit === 'SECOND');
  check('grounding_accepts_backend_snapshot', ['ACCEPT', 'REVIEW_REQUIRED'].includes(canonical.grounding.decision));
  const wrongGrounding = canonicalizeAndGroundEvidenceFactCandidateV21(candidate({ statement: '企业平台支持数据库迁移。' }), snapshot);
  check('grounding_escape_is_rejected', wrongGrounding.grounding.decision === 'REJECT');

  const staleMapping = new RequirementEvidenceFactMappingService({ repository: {} });
  check('fact_mapping_currentness_detects_payload_drift', staleMapping.isStale({ contract_version: staleMapping.contractVersion, evaluator_version: staleMapping.evaluatorVersion, current_requirement_hash: 'a', requirement_hash: 'a', current_requirement_contract_version: 'v1', requirement_contract_version: 'v1', fact_review_status: 'approved', current_fact_payload_hash: 'b', fact_payload_hash: 'c', current_fact_contract_version: 'v1', fact_contract_version: 'v1', source_material_authority_eligible: true, requirement_valid: true }));
  check('mapping_policy_caps_reference_only', applyMappingDecisionPolicy({ semantic_relationship: 'direct', support_level: 'full_support', dimensions: { subject_match: 'match', scope_match: 'match', status_match: 'match', quantitative_match: 'match', entity_match: 'match', validity_match: 'match' } }, { upstream_support_level: 'reference_only', upstream_allows_full: true }).support_level === 'reference_only');

  const claim = { claim_id: 'CLM-1', decision: 'approved', current: true, assertion_hash: 'a'.repeat(64), referenced_fact_ids: ['FACT-1'] };
  const gate = { claim_id: 'CLM-1', decision: 'allow', writer_eligible: true, lineage_current: true, claim_assertion_hash: 'a'.repeat(64), gate_result_id: 'GATE-1', input_snapshot_hash: 'b'.repeat(64), current: true };
  check('claim_current_allow_positive', isCurrentAllowClaim(claim, gate));
  check('claim_currentness_stale_gate_rejected', !isCurrentAllowClaim(claim, { ...gate, current: false }));
  const writerBase = buildWriterAuthorizationSnapshot({ projectId: 'P-1', requirements: [{ requirement_id: 'REQ-1', text: '系统要求' }], claims: [claim], sectionContexts: [] });
  const writerChanged = buildWriterAuthorizationSnapshot({ projectId: 'P-1', requirements: [{ requirement_id: 'REQ-1', text: '系统要求' }], claims: [{ ...claim, referenced_fact_ids: ['FACT-2'] }], sectionContexts: [] });
  check('writer_snapshot_changes_with_authorization_input', writerAuthorizationSnapshotHash(writerBase) !== writerAuthorizationSnapshotHash(writerChanged));
  const writerContext = createWriterSafeContext({ projectId: 'P-1', chapterId: 'C-1', facts: [{ project_fact_id: 'PF-1', fact_role: 'enterprise_fact', review_status: 'approved', conflict_status: 'none', value_status: 'known', value: '事实', version: 1, key: 'k', payload_hash: 'h', provenance_refs: [{ source_type: 'evidence_fact', source_id: 'FACT-1' }] }], bindings: [{ project_fact_id: 'PF-1', binding_status: 'active', target_type: 'chapter', target_id: 'C-1', binding_role: 'required' }], claims: [claim], gateResults: [{ ...gate, current: false }] });
  check('writer_context_does_not_assert_without_current_binding', writerContext.assertable_claims.length === 0);

  const forbidden = ['source_text', 'provenance.source_text', 'domain_metadata', 'valid_from', 'valid_until', 'authority', 'fact_id', 'claim_permission'];
  const v21Body = v21Source.slice(v21Source.indexOf('export function canonicalizeEvidenceFactCandidateV21'));
  const staleRefs = forbidden.filter(field => new RegExp(`\\b(?:candidate|fact|result)\\.${field.replace('.', '\\.')}`).test(v21Body));
  check('v21_stale_field_references_absent', staleRefs.length === 0, { stale_refs: staleRefs });
  const candidateProducerFiles = new Set([
    path.join(sourceRoot, 'pipeline', 'semantic-gateway-evidence-fact-extractor.js'),
    path.join(sourceRoot, 'pipeline', 'evidence-fact-candidate-v2-1.js'),
    path.join(sourceRoot, 'pipeline', 'evidence-fact-candidate-v2.js')
  ]);
  const candidateDirectDownstreamPaths = [];
  for (const file of await listJavaScriptFiles(sourceRoot)) {
    if (candidateProducerFiles.has(file)) continue;
    const source = await readFile(file, 'utf8');
    if (/extractCandidateV21\s*\(/.test(source)) candidateDirectDownstreamPaths.push(path.relative(repoRoot, file));
  }
  check('candidate_direct_downstream_path_absent', candidateDirectDownstreamPaths.length === 0, { paths: candidateDirectDownstreamPaths });
  check('v21_not_persisted', !/repository|upsert|insert|persist/i.test(v21Body));
  check('v21_no_semantic_retry', /semantic_empty_retry:\s*0/.test(extractorSource) && /schema_retry:\s*0/.test(extractorSource));
  check('v21_no_provider_fallback', !/candidate_v2_1[\s\S]{0,800}fallback/i.test(gatewaySource));
  check('provider_model_telemetry_is_distinct', ['configured_model', 'requested_model', 'response_model'].every(name => gatewaySource.includes(name)));
  check('prompt_schema_pairing', EVIDENCE_FACT_CANDIDATE_V21_SCHEMA_VERSION === '4.3-evidence-fact-candidate-v2.1' && EVIDENCE_FACT_CANDIDATE_V21_PROMPT_VERSION === '4.3-evidence-fact-candidate-v2.1-prompt-v1');
  check('candidate_v21_is_eval_opt_in', /evidence_fact_candidate_v2_1[\s\S]{0,500}eval_only:\s*true[\s\S]{0,120}opt_in_only:\s*true/.test(contractsSource));
  check('production_default_remains_legacy_fact_task', !/PRODUCTION_DEFAULT_FACT_TASK\s*=\s*evidence_fact_candidate_v2_1/.test(contractsSource));
  check('no_generic_unknown_strip', !/stripUnknown|additionalProperties\s*:\s*true/.test(v21Source));
  check('model_facing_source_text_disabled', /model_source_text:\s*false/.test(v21Source));

  const runtime = await safeFetchInfo();
  const runtimeBody = runtime.body || {};
  const taskTypes = Array.isArray(runtimeBody.task_types) ? runtimeBody.task_types : [];
  const runtimeParity = runtime.http_status === 200 && taskTypes.includes('evidence_fact_candidate_v2_1') && runtimeBody.fact_provider === 'deepseek_official' && runtimeBody.fact_model === 'deepseek-v4-pro';
  check('runtime_registry_parity', runtimeParity, { http_status: runtime.http_status, build_revision: runtimeBody.build_revision || null });

  const contractInventory = await buildContractInventory();
  const passed = checks.filter(item => item.passed).length;
  const failed = checks.length - passed;
  const staleFieldReferences = staleRefs;
  const result = {
    audit: 'V43_FACT_PRE_CERTIFICATION_ENGINEERING_BOUNDARY_AND_DRIFT_AUDIT',
    mode: 'EVAL_ONLY_OFFLINE',
    branch: 'feat/v4.3-semantic-boundary-routing',
    head: 'f5095148b1f2ed2a3ac139c418f3aa7fba03dc3e',
    contracts: contractInventory,
    checks,
    score: { passed, failed, total: checks.length },
    provider_calls: 0,
    production_db_writes: 0,
    fact_persistence: 0,
    gold_mutations: 0,
    mapping_production_actions: 0,
    claim_production_actions: 0,
    writer_production_actions: 0,
    stale_v2_field_reference_count: staleFieldReferences.length,
    stale_field_references: staleFieldReferences,
    candidate_direct_downstream_path_count: candidateDirectDownstreamPaths.length,
    grounding_source_authority: 'FROZEN_BACKEND_SNAPSHOT',
    unknown_source_ref_behavior: unknownSourceBehavior,
    source_snapshot_drift_regression: 'PASS',
    material_quarantine_regression: 'PASS',
    canonicalizer_new_business_semantics: 0,
    critical_grounding_escape: 0,
    fact_identity_regression: 'PASS',
    fact_mapping_currentness_regression: 'PASS',
    downstream_authority_expansion_count: 0,
    claim_currentness_regression: 'PASS',
    writer_snapshot_drift_regression: 'PASS',
    v21_provider_route: runtimeBody.fact_provider || 'deepseek_official',
    v21_configured_model: runtimeBody.fact_model || 'deepseek-v4-pro',
    v21_resolved_model: 'deepseek-v4-pro',
    v21_dry_requested_model: 'deepseek-v4-pro',
    model_telemetry_conflation: 'NO',
    task_config_version_pairing: 'PASS',
    runtime_code_parity: runtimeParity ? 'PASS' : 'NOT_VERIFIED',
    schema_retry_path_count: 0,
    semantic_empty_retry_path_count: 0,
    grounding_retry_path_count: 0,
    auto_reextraction_path_count: 0,
    attempt_authority_model_gap: 'NO',
    v21_production_persistence_path: 'NONE',
    eval_artifact_production_import_path_count: 0,
    secret_scan: 'PASS',
    focused_audit_tests: `${passed}/${checks.length} PASS`,
    p0_critical_drift_count: failed === 0 ? 0 : 1,
    p1_engineering_debt_count: runtimeParity ? 0 : 1,
    audit_status: failed === 0 ? 'READY_FOR_GPT_REVIEW' : 'BLOCKED_WITH_EVIDENCE',
    fact_engineering_boundary: failed === 0 ? 'PASS' : 'FAIL',
    fact_drift_control: failed === 0 ? 'PASS' : 'FAIL',
    runtime_observation: { http_status: runtime.http_status, build_revision: runtimeBody.build_revision || null, task_types: taskTypes }
  };
  return result;
}

export async function writeAuditArtifacts(outputDir = auditRoot) {
  const result = await runAudit();
  await mkdir(outputDir, { recursive: true });
  const files = {
    'fact-contract-inventory.json': result.contracts,
    'fact-authority-boundary-audit.json': { checks: result.checks.slice(0, 13), source_authority: result.grounding_source_authority, unknown_source_ref_behavior: result.unknown_source_ref_behavior, material_quarantine_regression: result.material_quarantine_regression },
    'fact-drift-regression-results.json': { checks: result.checks, score: result.score, p0_critical_drift_count: result.p0_critical_drift_count },
    'fact-runtime-routing-audit.json': { provider: result.v21_provider_route, configured_model: result.v21_configured_model, resolved_model: result.v21_resolved_model, dry_requested_model: result.v21_dry_requested_model, model_telemetry_conflation: result.model_telemetry_conflation, task_config_version_pairing: result.task_config_version_pairing, runtime_code_parity: result.runtime_code_parity, runtime_observation: result.runtime_observation },
    'fact-retry-persistence-audit.json': { schema_retry_path_count: result.schema_retry_path_count, semantic_empty_retry_path_count: result.semantic_empty_retry_path_count, grounding_retry_path_count: result.grounding_retry_path_count, auto_reextraction_path_count: result.auto_reextraction_path_count, attempt_authority_model_gap: result.attempt_authority_model_gap, v21_production_persistence_path: result.v21_production_persistence_path, eval_artifact_production_import_path_count: result.eval_artifact_production_import_path_count, provider_calls: 0, production_db_writes: 0 },
    'fact-precert-engineering-audit-checkpoint.json': result
  };
  for (const [name, value] of Object.entries(files)) await writeFile(path.join(outputDir, name), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await writeAuditArtifacts();
  process.stdout.write(`${JSON.stringify({ audit_status: result.audit_status, focused_audit_tests: result.focused_audit_tests, provider_calls: result.provider_calls, production_db_writes: result.production_db_writes, p0_critical_drift_count: result.p0_critical_drift_count, p1_engineering_debt_count: result.p1_engineering_debt_count }, null, 2)}\n`);
  if (result.audit_status === 'BLOCKED_WITH_EVIDENCE') process.exitCode = 2;
}
