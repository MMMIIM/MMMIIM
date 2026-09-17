import test from 'node:test';
import assert from 'node:assert/strict';
import { assignFailureFamily, listFamilyMembers, registerFailureFamily } from '../../src/eval/flywheel/failure-family-registry.js';

test('failure family definitions and membership are versioned/idempotent', () => {
  const store = { families: [], memberships: [] };
  const family = registerFailureFamily({ module: 'requirement', name: 'EXAMPLE_ONLY', version: 'v1' }, store).family;
  assert.equal(assignFailureFamily({ badcaseId: 'b', familyId: family.failure_family_id, evidenceRefs: [{ artifact_id: 'a' }], store }).created, true);
  assert.equal(assignFailureFamily({ badcaseId: 'b', familyId: family.failure_family_id, evidenceRefs: [{ artifact_id: 'a' }], store }).created, false);
  assert.equal(listFamilyMembers(family.failure_family_id, store).length, 1);
});
