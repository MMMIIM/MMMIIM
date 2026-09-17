import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFinalRequirementReconciliation } from '../src/pipeline/final-requirement-reconciliation.js';

test('final reconciliation reports readiness and deterministic written coverage', () => {
  const result = buildFinalRequirementReconciliation({
    projectId: 'P1',
    requirements: [
      { req_id: 'REQ-S', text: '方案', source_verified: true },
      { req_id: 'REQ-C', text: '投标文件须盖章', source_verified: true },
      { req_id: 'REQ-N', text: '无需响应', source_verified: true }
    ],
    responseDecisions: [
      { requirement_id: 'REQ-S', decision_status: 'ROUTED', response_mode: 'SOLUTION', response_required: true, readiness_status: 'READY_FOR_WRITER' },
      { requirement_id: 'REQ-C', decision_status: 'ROUTED', response_mode: 'COMPLIANCE', response_required: true, readiness_status: 'COMPLIANCE_ACTION_REQUIRED' },
      { requirement_id: 'REQ-N', decision_status: 'ROUTED', response_mode: 'SOLUTION', response_required: false, readiness_status: 'NO_RESPONSE_REQUIRED' }
    ],
    generation: { id: 'G1', tasks: [{ input_snapshot: { sections: [{ requirement_ids: ['REQ-S'] }] } }] }
  });
  const byId = new Map(result.requirements.map((row) => [row.requirement_id, row]));
  assert.equal(byId.get('REQ-S').written_coverage_status, 'COVERED');
  assert.equal(byId.get('REQ-C').written_coverage_status, 'NOT_APPLICABLE');
  assert.equal(byId.get('REQ-N').written_coverage_status, 'NOT_APPLICABLE');
  assert.equal(result.summary.written_covered, 1);
  assert.equal(result.summary.compliance_action_required, 1);
});
