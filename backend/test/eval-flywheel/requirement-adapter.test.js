import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRequirementTrace } from '../../src/eval/flywheel/adapters/requirement.js';

test('Requirement adapter uses canonical stage order and no Provider call', () => {
  const trace = buildRequirementTrace({ evalRunId: 'r', caseId: 'FAST-01-P0-0001', source: { tender_id: 'FAST-01', source_hash: 'sha' }, stages: { section: { section_id: 'p1' }, chunk: { chunk_number: 1 }, provider_input: null, raw_candidate: null, source_resolution: { source_refs: ['C001-S001'] }, canonical_requirement: { canonical_requirement_id: 'REQ-1', project_id: 'p' } } });
  assert.deepEqual(trace.stages.map((stage) => stage.stage_type), ['Tender Source', 'Section', 'Chunk', 'Provider Input', 'Raw Candidate', 'Normalization', 'Source Resolution', 'Canonical Requirement']);
  assert.equal(trace.evidence_gaps.length, 3);
});
