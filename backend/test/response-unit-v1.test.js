import test from 'node:test';
import assert from 'node:assert/strict';
import { buildResponseUnitsV1, RESPONSE_UNIT_V1_VERSION } from '../src/pipeline/response-unit-v1.js';

test('ResponseUnitV1 groups only compatible routed requirements and preserves lineage', () => {
  const units = buildResponseUnitsV1([
    { requirement_id: 'REQ-2', response_mode: 'SOLUTION', response_required: true, readiness_status: 'READY_FOR_WRITER', target_section: 'S1' },
    { requirement_id: 'REQ-1', response_mode: 'SOLUTION', response_required: true, readiness_status: 'READY_FOR_WRITER', target_section: 'S1' },
    { requirement_id: 'REQ-3', response_mode: 'COMPLIANCE', response_required: true, readiness_status: 'COMPLIANCE_ACTION_REQUIRED', target_section: 'S1' },
    { requirement_id: 'REQ-4', response_mode: 'EVIDENCE', response_required: true, readiness_status: 'EVIDENCE_REQUIRED', target_section: 'S2' }
  ]);
  assert.equal(units[0].contract_version, RESPONSE_UNIT_V1_VERSION);
  assert.deepEqual(units.find((unit) => unit.section_key === 'S1' && unit.response_mode === 'SOLUTION').requirement_ids, ['REQ-1', 'REQ-2']);
  assert.equal(units.some((unit) => unit.response_mode === 'COMPLIANCE' && unit.requirement_ids.includes('REQ-3')), true);
  assert.equal(units.every((unit) => !unit.requirement_ids.includes('REQ-3') || unit.response_mode === 'COMPLIANCE'), true);
});

test('NEED_REVIEW and blocked evidence/commitment never become writer units', () => {
  const units = buildResponseUnitsV1([
    { requirement_id: 'REQ-N', response_mode: null, decision_status: 'NEED_REVIEW', readiness_status: 'NEED_REVIEW', target_section: 'S1' },
    { requirement_id: 'REQ-E', response_mode: 'EVIDENCE', readiness_status: 'EVIDENCE_REQUIRED', target_section: 'S1' },
    { requirement_id: 'REQ-C', response_mode: 'COMMITMENT', readiness_status: 'HUMAN_DECISION_REQUIRED', target_section: 'S1' }
  ]);
  assert.deepEqual(units, []);
});
