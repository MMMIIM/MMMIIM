import test from 'node:test';
import assert from 'node:assert/strict';
import { ResponseRouterService } from '../src/pipeline/response-router-service.js';

test('ResponseRouterService exposes canonical ResponseDecisionV1 while preserving advisory authority', async () => {
  const service = new ResponseRouterService({ repository: {
    async getProject() { return { id: 'P1' }; },
    async getRequirementBaseline() { return { id: 'B1', status: 'confirmed', requirements: [{ req_id: 'REQ-1', text: '有关信息以及', requirement_category: 'context' }] }; }
  } });
  const result = await service.get('P1', 'REQ-1');
  assert.equal(result.decision.decision_status, 'NEED_REVIEW');
  assert.equal(result.decision.response_mode, null);
  assert.equal(result.decision.authority.granted, false);
  assert.equal(result.decision.next_action, 'HUMAN_REVIEW');
});
