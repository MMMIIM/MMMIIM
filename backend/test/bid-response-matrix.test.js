import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBidResponseMatrix, deriveMatrixReadiness } from '../src/pipeline/bid-response-matrix-v1.js';
import { FlowProjectionService } from '../src/pipeline/flow-projection-service.js';

const requirement = (id, text, extra = {}) => ({ req_id: id, text, requirement_category: extra.category || 'technical', source_verified: true, source_hash: `hash-${id}`, is_mandatory: extra.mandatory === true, ...extra });

test('matrix has exactly one deterministic row per canonical requirement', () => {
  const rows = buildBidResponseMatrix({ requirements: [requirement('REQ-1', '本项目应提交系统总体架构设计方案'), requirement('REQ-2', '投标文件须加盖公章并由法定代表人签字')] });
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map((row) => row.requirement_id), ['REQ-1', 'REQ-2']);
  assert.equal(rows[0].readiness_status, 'READY_FOR_WRITER');
  assert.equal(rows[1].readiness_status, 'COMPLIANCE_ACTION_REQUIRED');
  assert.equal(rows.every((row) => row.authority.creates_authority === false), true);
});

test('matrix readiness is fail-closed for evidence and commitment authority gaps', () => {
  assert.equal(deriveMatrixReadiness({ response_mode: 'EVIDENCE', response_required: true, approved_claim_count: 0 }), 'EVIDENCE_REQUIRED');
  assert.equal(deriveMatrixReadiness({ response_mode: 'COMMITMENT', response_required: true, approved_commitment_count: 0 }), 'HUMAN_DECISION_REQUIRED');
});

test('FlowProjectionService exposes a project-scoped read-only matrix without writes', async () => {
  let writes = 0;
  const service = new FlowProjectionService({
    repository: {
      async getDocumentGenerationInput() { return { baseline: { id: 'B', status: 'confirmed' }, requirements: [requirement('REQ-1', '投标文件须加盖公章')] , claims: [], coverage: {} }; },
      async listProjectFacts() { return []; },
      async listRequirementEvidenceFactMappings() { return []; },
    },
    responseRouterService: { project(item, context) { return projectDecision(item); } },
    reviewCenterService: { async get() { return { pending: [] }; } }
  });
  function projectDecision(item) { return { requirement_id: item.req_id, decision_status: 'ROUTED', response_mode: 'COMPLIANCE', response_required: true, risk_tier: 'P0', human_required: true, routing_reasons: [] }; }
  const result = await service.getBidResponseMatrix('P1');
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].readiness_status, 'COMPLIANCE_ACTION_REQUIRED');
  assert.equal(result.authority.creates_authority, false);
  assert.equal(writes, 0);
});
