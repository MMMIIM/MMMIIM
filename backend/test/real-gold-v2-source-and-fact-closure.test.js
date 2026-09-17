import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildRealGoldV2SourceAndFactClosure, CLOSURE_CHECKPOINT } from '../eval/gold-governance/real-gold-v2-source-and-fact-closure.js';

test('closure composes Track A and Track B without upgrading authority', () => {
  const result = buildRealGoldV2SourceAndFactClosure({ outputDir: null });
  assert.equal(result.checkpoint, CLOSURE_CHECKPOINT);
  assert.equal(result.REQUIREMENT_SOURCE_A_COUNT, 3);
  assert.equal(result.REQUIREMENT_SOURCE_B_COUNT, 1);
  assert.equal(result.REQUIREMENT_SOURCE_C_COUNT, 2);
  assert.equal(result.SIX_TENDER_SOURCE_PARITY, 'BLOCKED_HUMAN_AUTHORITY_PENDING');
  assert.equal(result.REAL_ENTERPRISE_SOURCE_CANDIDATES, 4);
  assert.equal(result.REAL_ENTERPRISE_SOURCE_ELIGIBLE, 0);
  assert.equal(result.REAL_FACT_V2_ELIGIBLE_CANDIDATES, 0);
  assert.equal(result.REAL_FACT_V2_BLIND_PACKET, 'BLOCKED_NO_ELIGIBLE_REAL_ENTERPRISE_SOURCE');
  assert.equal(result.SAFE_TO_START_HUMAN_REQUIREMENT_RECONSTRUCTION, 'YES');
  assert.equal(result.SAFE_TO_START_HUMAN_FACT_V2_REVIEW, 'NO');
  assert.equal(result.SAFE_TO_FREEZE_REAL_FACT_V2, 'NO');
  assert.equal(result.SAFE_TO_BUILD_MAPPING_GOLD_V2, 'NO');
  assert.equal(result.PROVIDER_CALLS, 0);
  assert.equal(result.PRODUCTION_DB_WRITES, 0);
  assert.equal(result.GOLD_MUTATIONS, 0);
});

test('closure preserves explicit gaps and human decisions', () => {
  const result = buildRealGoldV2SourceAndFactClosure({ outputDir: null });
  assert.ok(result.CORPUS_GAP.some(value => value.includes('authoritative requirement packets')));
  assert.ok(result.SOURCE_AUTHORITY_GAP.some(value => value.includes('QUARANTINED')));
  assert.ok(result.HUMAN_DECISION_REQUIRED.some(value => value.includes('JY-001')));
  assert.equal(result.FINAL_VERDICT.includes('BLOCKED'), true);
});

test('closure artifacts are deterministic and scoped to Eval output', () => {
  const first = fs.mkdtempSync(path.join(os.tmpdir(), 'real-gold-closure-a-'));
  const second = fs.mkdtempSync(path.join(os.tmpdir(), 'real-gold-closure-b-'));
  buildRealGoldV2SourceAndFactClosure({ outputDir: first, now: '2026-09-04T00:00:00.000Z' });
  buildRealGoldV2SourceAndFactClosure({ outputDir: second, now: '2026-09-04T00:00:00.000Z' });
  const files = fs.readdirSync(first).sort();
  assert.deepEqual(files, fs.readdirSync(second).sort());
  for (const file of files) assert.equal(fs.readFileSync(path.join(first, file), 'utf8'), fs.readFileSync(path.join(second, file), 'utf8'));
  assert.deepEqual(files.sort(), [
    'V43_REAL_GOLD_V2_SOURCE_AND_FACT_CLOSURE_CHECKPOINT.json',
    'V43_REAL_GOLD_V2_SOURCE_AND_FACT_CLOSURE_CHECKPOINT.md',
    'V43_REAL_GOLD_V2_SOURCE_AND_FACT_CLOSURE_INPUT_DIGEST.json',
    'V43_REAL_GOLD_V2_SOURCE_AND_FACT_CLOSURE_REPORT.md'
  ]);
});
