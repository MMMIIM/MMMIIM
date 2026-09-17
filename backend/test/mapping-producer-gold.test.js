import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateTaskData } from '../../packages/semantic-contracts/index.js';

const gold = JSON.parse(await readFile(new URL('../eval/requirement-evidence-mapping-v1/gold-cases.json', import.meta.url), 'utf8'));

test('Mapping Gold is a human-authored static 36-case boundary set', () => {
  assert.equal(gold.authorship, 'human-authored-static');
  assert.equal(gold.contract_version, 'requirement-evidence-mapping-v1.1');
  assert.equal(gold.cases.length, 36);
  assert.equal(new Set(gold.cases.map(item => item.case_id)).size, 36);
  const labels = new Set(gold.cases.map(item => item.label));
  for (const label of [
    'direct full', 'partial capability', 'related reference',
    'related insufficient', 'unrelated', 'conflict quantity',
    'status mismatch', 'scope mismatch', 'entity mismatch',
    'validity mismatch', 'N/A quantity', 'N/A status', 'N/A validity',
    'applicable unknown', 'similar topic false positive',
    'registered not concurrent', 'participated not completed',
    'subsidiary not group', 'historical contamination', 'multi-fact coverage first',
    'multi-fact coverage second', 'zero evidence', 'superseded fact',
    'cross project fact', 'upstream partial attempted full', 'human override',
    'batch split six plus one'
  ]) assert.ok(labels.has(label), `missing Gold boundary: ${label}`);
});

test('Gold transport expectations are strict and structurally valid without a Provider', () => {
  const cases = gold.cases.filter(item => item.expected?.decision && item.expected?.dimensions);
  assert.ok(cases.length >= 30);
  for (const item of cases) {
    const { decision, dimensions } = item.expected;
    assert.doesNotThrow(() => validateTaskData('requirement_evidence_mapping', {
      results: [{ fact_ref: item.facts[0]?.fact_ref || 'FIXTURE-REF', decision, dimensions }]
    }));
  }
});
