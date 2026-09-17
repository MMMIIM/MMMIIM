import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyGoldEligibility,
  summarizeEligibleGold,
  aggregateEligibleSemanticAdjudication
} from '../eval/requirement-extraction-real-tender-pilot-v1/gold-eligibility.js';

test('SOURCE_AMBIGUOUS Gold is not evaluable while SOURCE_CLEAR remains evaluable', () => {
  assert.deepEqual(classifyGoldEligibility('SOURCE_AMBIGUOUS'), {
    source_authority: 'SOURCE_AMBIGUOUS',
    evaluation_eligible: false
  });
  assert.deepEqual(classifyGoldEligibility('SOURCE_CLEAR'), {
    source_authority: 'SOURCE_CLEAR',
    evaluation_eligible: true
  });
});

test('eligibility summary preserves 199 dataset cases and quarantines only ambiguous cases', () => {
  const result = summarizeEligibleGold({
    goldItems: [{ gold_id: 'G-CLEAR-1' }, { gold_id: 'G-CLEAR-2' }, { gold_id: 'G-AMBIGUOUS' }],
    sourceAuditItems: [
      { gold_id: 'G-CLEAR-1', classification: 'SOURCE_CLEAR' },
      { gold_id: 'G-CLEAR-2', classification: 'SOURCE_CLEAR' },
      { gold_id: 'G-AMBIGUOUS', classification: 'SOURCE_AMBIGUOUS' }
    ]
  });
  assert.equal(result.dataset_case_count, 3);
  assert.equal(result.evaluable_gold_count, 2);
  assert.equal(result.source_ambiguous_count, 1);
  assert.deepEqual(result.quarantined_gold_ids, ['G-AMBIGUOUS']);
});

test('semantic aggregation excludes ambiguous cases from the denominator and results', () => {
  const result = aggregateEligibleSemanticAdjudication({
    adjudicationItems: [
      { gold_id: 'G-FULL', semantic_result: 'FULL', meaning_complete: true, mandatory: false, grouping: 'ATOMIC' },
      { gold_id: 'G-MISS', semantic_result: 'MISS', meaning_complete: false, mandatory: true, critical: false, grouping: 'ATOMIC' },
      { gold_id: 'G-AMBIGUOUS', semantic_result: 'PARTIAL', meaning_complete: false, mandatory: true, critical: true, material_omission: 'CRITICAL', grouping: 'ATOMIC' }
    ],
    sourceAuditItems: [
      { gold_id: 'G-FULL', classification: 'SOURCE_CLEAR' },
      { gold_id: 'G-MISS', classification: 'SOURCE_CLEAR' },
      { gold_id: 'G-AMBIGUOUS', classification: 'SOURCE_AMBIGUOUS' }
    ]
  });
  assert.equal(result.evaluable_gold_count, 2);
  assert.deepEqual(result.gold, { total: 2, FULL: 1, PARTIAL: 0, MISS: 1 });
  assert.equal(result.meaning_completeness.rate, 0.5);
  assert.equal(result.critical_material_omission, 0);
  assert.equal(result.mandatory.total, 1);
  assert.deepEqual(result.excluded_gold_ids, ['G-AMBIGUOUS']);
});

test('candidate quality cannot create or remove source ambiguity eligibility', () => {
  assert.equal(classifyGoldEligibility('SOURCE_AMBIGUOUS', { semantic_result: 'FULL' }).evaluation_eligible, false);
  assert.equal(classifyGoldEligibility('SOURCE_CLEAR', { semantic_result: 'MISS' }).evaluation_eligible, true);
});

test('eligible aggregation preserves candidate-level scope diagnostics separately', () => {
  const result = aggregateEligibleSemanticAdjudication({
    adjudicationItems: [{ gold_id: 'G1', semantic_result: 'FULL', meaning_complete: true, grouping: 'ATOMIC' }],
    sourceAuditItems: [{ gold_id: 'G1', classification: 'SOURCE_CLEAR' }],
    candidateQuality: { total: 173, scope_leakage: 3, scope_leakage_rate: 3 / 173 }
  });
  assert.deepEqual(result.scope, { total: 173, leakage: 3, leakage_rate: 3 / 173 });
});
