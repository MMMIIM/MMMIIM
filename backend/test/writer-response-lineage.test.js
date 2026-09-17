import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWriterTaskWithLineage } from '../src/pipeline/writer-lineage-v1.js';

test('formal writer task carries backend-owned covered requirement lineage', () => {
  const task = buildWriterTaskWithLineage({
    safeContext: { contract_version: 'writer-safe-context-v1', project_id: 'P1', chapter_id: 'S1', authorization_snapshot_hash: 'a'.repeat(64), context_items: [], assertable_claims: [], pending_items: [], blocked_items: [] },
    chapterRole: 'technical_bid_section', chapterInstruction: '方案', requirements: [{ req_id: 'REQ-1' }], bindings: [], coveredRequirementIds: ['REQ-1'], responseUnitId: 'RU-1'
  });
  assert.deepEqual(task.covered_requirement_ids, ['REQ-1']);
  assert.equal(task.response_unit_id, 'RU-1');
  assert.equal(task.writer_task_id.startsWith('WT-'), true);
});
