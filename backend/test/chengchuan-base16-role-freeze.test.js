import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  applyFrozenBase16Role,
  loadChengchuanBase16RoleSnapshot
} from '../eval/rag-pilot/chengchuan-controlled-fact-extraction.mjs';

const SNAPSHOT = resolve(
  process.cwd(),
  'docs/handoff/V43_PRE_E2E_GOVERNANCE_AND_MAPPING_READINESS_CLOSURE_V1/21_CHENGCHUAN_SOURCE_ROLE_MODEL_CORRECTED.json'
);

test('Chengchuan Base16 frozen role snapshot has the approved 7/9 partition', async () => {
  const roles = await loadChengchuanBase16RoleSnapshot(SNAPSHOT);
  assert.equal(roles.size, 16);

  const reference = ['COM-01', 'COM-05', 'COM-09', 'COM-10', 'COM-11', 'COM-12', 'COM-16'];
  const evidence = ['COM-02', 'COM-03', 'COM-04', 'COM-06', 'COM-07', 'COM-08', 'COM-13', 'COM-14', 'COM-15'];
  assert.deepEqual(
    [...roles.values()].filter(item => item.source_role === 'REFERENCE_ONLY').map(item => item.doc_id).sort(),
    reference.sort()
  );
  assert.deepEqual(
    [...roles.values()].filter(item => item.source_role === 'EVIDENCE_CANDIDATE').map(item => item.doc_id).sort(),
    evidence.sort()
  );

  assert.equal(roles.get('COM-03').material_type, 'product_documentation');
  assert.equal(roles.get('COM-04').material_type, 'product_documentation');
  assert.equal(roles.get('COM-06').material_type, 'delivery_capability');
  assert.equal(roles.get('COM-07').material_type, 'delivery_capability');
  assert.equal(roles.get('COM-09').material_type, 'technical_solution');
  assert.equal(roles.get('COM-10').material_type, 'other');
  assert.equal(roles.get('COM-11').material_type, 'technical_solution');
  assert.equal(roles.get('COM-12').material_type, 'technical_solution');
  assert.equal(roles.get('COM-06').semantic_review_status, 'UNKNOWN_REVIEW_REQUIRED');
  assert.match(roles.get('COM-06').semantic_review_reason, /no PASS\/FAIL outcome/i);
});

test('frozen Base16 role is applied instead of legacy evidence-category inference', async () => {
  const roles = await loadChengchuanBase16RoleSnapshot(SNAPSHOT);
  const applied = applyFrozenBase16Role({ doc_id: 'COM-03', evidence_category: 'ARCHITECTURE' }, roles);
  assert.equal(applied.material_type, 'product_documentation');
  assert.equal(applied.source_role, 'EVIDENCE_CANDIDATE');
  assert.equal(applied.authority, 'SYNTHETIC_EVAL_ONLY');
  assert.equal(applied.production_authority, 'NONE');
  for (const docId of ['COM-03', 'COM-04', 'COM-07']) {
    const role = roles.get(docId);
    assert.equal(role.source_role, 'EVIDENCE_CANDIDATE');
    assert.equal(role.fact_eval_eligible, true);
    assert.equal(role.mapping_eval_eligible, true);
  }
  for (const docId of ['COM-09', 'COM-10', 'COM-11', 'COM-12']) {
    const role = roles.get(docId);
    assert.equal(role.source_role, 'REFERENCE_ONLY');
    assert.equal(role.fact_eval_eligible, false);
    assert.equal(role.mapping_eval_eligible, false);
    assert.equal(role.claim_eval_eligible, false);
  }

  const com06 = applyFrozenBase16Role({ doc_id: 'COM-06' }, roles);
  assert.equal(com06.source_role, 'EVIDENCE_CANDIDATE');
  assert.equal(com06.semantic_review_status, 'UNKNOWN_REVIEW_REQUIRED');
  assert.equal(com06.authority, 'SYNTHETIC_EVAL_ONLY');
});

test('frozen behavior boundaries keep reference and raw evidence non-assertable', async () => {
  const snapshot = JSON.parse(await readFile(SNAPSHOT, 'utf8'));
  assert.deepEqual(snapshot.behavior_matrix.synthetic_reference_only, {
    fact: 'BLOCKED',
    mapping: 'BLOCKED',
    claim: 'BLOCKED',
    writer: 'CONTEXT_ONLY_WHERE_ALLOWED'
  });
  assert.equal(snapshot.behavior_matrix.synthetic_evidence_candidate.fact, 'ALLOWED_IN_ISOLATED_EVAL');
  assert.equal(snapshot.behavior_matrix.synthetic_evidence_candidate.production_authority, 'NONE');
  assert.equal(snapshot.behavior_matrix.reference_to_assertable_claim, 'BLOCKED');
  assert.equal(snapshot.behavior_matrix.raw_evidence_to_writer, 'BLOCKED');
});
