import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyFixed48Failure, buildFrozenCaseIdentity } from '../eval/requirement-production-quality-gate/fixed48-live-certification.js';

test('fixed48 live retry classification is limited to transient transport failures', () => {
  assert.equal(classifyFixed48Failure(Object.assign(new Error('timeout'), { code: 'GATEWAY_TIMEOUT' })).retryable, true);
  assert.equal(classifyFixed48Failure(Object.assign(new Error('bad request'), { code: 'GATEWAY_400' })).retryable, false);
  assert.equal(classifyFixed48Failure(null, { provider_http_status: 503 }).retryable, true);
  assert.equal(classifyFixed48Failure(null, { provider_http_status: 401 }).retryable, false);
});

test('fixed48 frozen identity rejects changed input or source hashes', () => {
  const cases = Array.from({ length: 48 }, (_, index) => ({
    case_id: `FIXED48-${String(index + 1).padStart(2, '0')}`,
    case_index: index + 1,
    tender_id: 'T-1',
    chunk_number: index + 1,
    input_sha256: 'a'.repeat(64),
    source_sha256: 'b'.repeat(64)
  }));
  const frozen = {
    task_type: 'requirement_extraction',
    frozen_case_count: 48,
    cases,
    source_identity_parity: { source_sha256_by_tender: { 'T-1': 'b'.repeat(64) } }
  };
  const prepared = new Map([['T-1', { source_sha256: 'b'.repeat(64), chunks: Array.from({ length: 48 }, (_, index) => ({ chunk_number: index + 1, text: 'different', segments: [] })) }]]);
  assert.throws(() => buildFrozenCaseIdentity({ frozen, preparedByTender: prepared }), /FIXED48_INPUT_SHA256_MISMATCH/);
});
