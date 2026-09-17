import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSafeResponsePacket } from '../src/pipeline/safe-response-packet-builder.js';

test('Safe Response Packet carries ResponseUnit lineage and keeps reference context non-assertable', () => {
  const packet = buildSafeResponsePacket({
    projectId: 'P1', responseUnitId: 'RU-1', requirementIds: ['REQ-1'],
    requirement: { req_id: 'REQ-1', text: '本项目应提交架构设计方案', source_hash: 'S1', source_verified: true },
    responseDecision: { decision_status: 'ROUTED', response_mode: 'SOLUTION', response_required: true, readiness_status: 'READY_FOR_WRITER', risk_tier: 'MEDIUM' },
    referenceContext: [{ material_id: 'REF-1', chunk_id: 'CH-1', text: '参考架构内容' }]
  });
  assert.equal(packet.response_unit_id, 'RU-1');
  assert.deepEqual(packet.requirement_ids, ['REQ-1']);
  assert.equal(packet.reference_context[0].source_type, 'CONTEXT_ONLY');
  assert.deepEqual(packet.allowed_enterprise_assertions, []);
  assert.equal(packet.authority.creates_authority, false);
});
