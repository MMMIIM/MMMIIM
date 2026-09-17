import test from 'node:test';
import assert from 'node:assert/strict';
import { appendTraceStage, buildTrace, listEvidenceGaps, makeTraceStage } from '../../src/eval/flywheel/trace.js';

test('trace preserves ordered partial evidence and explicit gaps', () => {
  const trace = buildTrace({ module: 'requirement', evalRunId: 'r', caseId: 'c', stages: [
    makeTraceStage({ stageType: 'Tender Source', ordinal: 0, value: { source_hash: 's' } }),
    makeTraceStage({ stageType: 'Provider Input', ordinal: 3, value: null })
  ] });
  assert.equal(trace.stages[0].stage_type, 'Tender Source');
  assert.equal(listEvidenceGaps(trace)[0].code, 'EVIDENCE_NOT_PERSISTED');
  assert.equal(appendTraceStage(trace, makeTraceStage({ stageType: 'Chunk', ordinal: 2, value: { chunk_number: 1 } })).stages.length, 3);
});
