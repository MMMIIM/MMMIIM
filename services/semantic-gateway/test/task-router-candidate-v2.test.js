import test from 'node:test';
import assert from 'node:assert/strict';
import { createSemanticTaskRouter, deriveTaskResponseFormat } from '../src/task-router.js';
import {
  EVIDENCE_FACT_CANDIDATE_V2_SCHEMA,
  getSemanticTaskContract
} from '../../../packages/semantic-contracts/index.js';

const candidate = {
  statement: '系统支持审计日志。',
  subject_name: '系统',
  subject_type_hint: 'product',
  entity_mentions: [],
  status_text: null,
  scope_items: [],
  quantity_items: [],
  temporal_items: []
};

test('Candidate V2 derives strict schema from the shared contract', () => {
  const format = deriveTaskResponseFormat('evidence_fact_candidate_v2');
  assert.equal(format.type, 'json_schema');
  assert.equal(format.json_schema.strict, true);
  assert.equal(format.json_schema.name, 'evidence_fact_candidate_v2_data');
  assert.equal(format.json_schema.schema, EVIDENCE_FACT_CANDIDATE_V2_SCHEMA);
  assert.equal(getSemanticTaskContract('evidence_fact_candidate_v2').eval_only, true);
});

test('Candidate V2 router validates strict output without legacy projection', async () => {
  let invocation;
  const router = createSemanticTaskRouter({
    provider: { async invoke(input) { invocation = input; return { data: { facts: [candidate] }, provider_audit: {} }; } }
  });
  const result = await router.dispatch({ taskType: 'evidence_fact_candidate_v2', payload: { source_text: candidate.statement } });
  assert.deepEqual(result.data.facts, [candidate]);
  assert.equal(invocation.taskType, 'evidence_fact_candidate_v2');
  assert.equal(invocation.response_format.json_schema.schema, EVIDENCE_FACT_CANDIDATE_V2_SCHEMA);
  assert.match(invocation.instruction, /Candidate V2|Candidate V2 observations/);
  assert.equal(result.provider_audit.semantic_contract_version, '4.3-evidence-fact-candidate-v2');
});

test('Candidate V2 router rejects legacy authority fields', async () => {
  const router = createSemanticTaskRouter({
    provider: { async invoke() { return { data: { facts: [{ ...candidate, domain_metadata: {} }] }, provider_audit: {} }; } }
  });
  await assert.rejects(
    () => router.dispatch({ taskType: 'evidence_fact_candidate_v2', payload: { source_text: candidate.statement } }),
    error => error.code === 'OUTPUT_SCHEMA_INVALID' || /unsupported|additional|data\.facts/.test(String(error.message))
  );
});
