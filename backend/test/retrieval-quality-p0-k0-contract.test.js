import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { buildK0Amendment, FROZEN_GOLD_SHA256 } from '../eval/retrieval-quality-p0/k0-contract-v1.mjs';

const GOLD_PATH = new URL('../eval/retrieval-quality-p0/GPT_SEMANTIC_GOLD_V1.json', import.meta.url);
const sha256 = value => createHash('sha256').update(value).digest('hex').toUpperCase();

test('P0 K0 amendment is additive and separates retrieval K0 from sufficiency', () => {
  const goldText = fs.readFileSync(GOLD_PATH);
  const gold = JSON.parse(goldText);
  const before = JSON.stringify(gold);
  const amendment = buildK0Amendment({ gold, goldFileSha256: sha256(goldText) });

  assert.equal(sha256(goldText), FROZEN_GOLD_SHA256);
  assert.equal(JSON.stringify(gold), before);
  assert.equal(amendment.basis.gold_mutated, false);
  assert.equal(amendment.basis.original_evidence_spans_and_atoms_unchanged, true);
  assert.equal(amendment.expected_retrieval_k0_count, 2);
  assert.equal(amendment.expected_no_sufficient_evidence_count, 6);

  const byId = new Map(amendment.projections.map(item => [item.requirement_id, item]));
  for (const requirementId of ['JY-001:REQ-077', 'JY-001:REQ-051', 'TB-003:REQ-119', 'TB-003:REQ-170']) {
    assert.equal(byId.get(requirementId).expected_retrieval_k0, false);
    assert.equal(byId.get(requirementId).expected_no_sufficient_evidence, true);
    assert.ok(byId.get(requirementId).grade_gte_2_evidence_item_count > 0);
  }
  assert.equal(byId.get('TB-006:REQ-037').expected_retrieval_k0, true);
  assert.equal(byId.get('JY-001:REQ-148').expected_retrieval_k0, true);
  assert.equal(byId.get('JY-001:REQ-027').expected_no_sufficient_evidence, false);
});
