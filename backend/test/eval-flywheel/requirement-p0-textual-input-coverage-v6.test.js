import test from 'node:test';
import assert from 'node:assert/strict';
import {
  contains,
  resolveFrozenSourceEvidence,
  chunkDecision,
  providerPayloadAudit
} from '../../eval/flywheel/requirement-p0-textual-input-coverage-v6.js';

test('frozen source evidence is used when production lineage is empty', () => {
  const evidence = resolveFrozenSourceEvidence(
    { atom_id: 'A-1', page: 4, atomic_requirement: 'descriptor' },
    new Map([['A-1', { source_truth: { source_excerpt: 'authoritative source text' } }]])
  );
  assert.equal(evidence.source_excerpt, 'authoritative source text');
  assert.equal(evidence.source_excerpt_status, 'AVAILABLE');
  assert.equal(evidence.source_excerpt_origin, 'FROZEN_SOURCE_TRUTH_RENDERING');
});

test('source-ref marker alone never satisfies provider textual coverage', () => {
  const state = {
    source_file: 'fixture.pdf',
    scope: { title: 'scope' },
    chunks: [{
      id: 'chunk-1',
      chunk_number: 1,
      text: 'unrelated source text',
      model_text: '[C001-S001] unrelated source text',
      segments: [{ text: 'unrelated source text' }]
    }]
  };
  const result = providerPayloadAudit(state, 'authoritative requirement text', [{
    source_chunk_id: 'chunk-1',
    source_refs: ['C001-S001']
  }]);
  assert.equal(result.source_ref_present, true);
  assert.equal(result.source_text_present, false);
  assert.equal(result.source_evidence_present, false);
});

test('source text passes provider coverage without persisted lineage', () => {
  const state = {
    source_file: 'fixture.pdf',
    scope: { title: 'scope' },
    chunks: [{
      id: 'chunk-1',
      chunk_number: 1,
      text: 'authoritative requirement text',
      model_text: '[C001-S001] authoritative requirement text',
      segments: [{ text: 'authoritative requirement text' }]
    }]
  };
  const result = providerPayloadAudit(state, 'authoritative requirement text', []);
  assert.equal(result.source_text_present, true);
  assert.equal(result.source_evidence_present, true);
});

test('lexical containment tolerates formatting and line-break normalization', () => {
  assert.equal(contains('响应时间\n≤ 1 秒', '响应时间 ≤1秒').present, true);
});

test('adjacent parse chunks are reported as a semantic split', () => {
  const result = chunkDecision({
    chunks: [
      { id: 'c1', chunk_number: 1, text: '第一部分要求' },
      { id: 'c2', chunk_number: 2, text: '第二部分。' }
    ]
  }, '第一部分要求第二部分。');
  assert.equal(result.status, 'PRESENT_ACROSS_PARSE_CHUNKS');
  assert.equal(result.cross_chunk_semantic_split, true);
});
