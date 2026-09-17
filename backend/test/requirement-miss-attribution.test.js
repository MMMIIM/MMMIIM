import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  buildAttributionCheckpoint,
  classifyAttribution,
  loadMissCohort,
  recoverMissAttributions
} from '../eval/requirement-production-quality-gate/attribute-21-source-misses.mjs';

test('missing authoritative 21-case manifest fails closed without fabricating cases', () => {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'req-miss-attribution-'));
  const result = loadMissCohort({ repoRoot });
  assert.equal(result.status, 'BLOCKED_MISSING_AUTHORITATIVE_MISS_MANIFEST');
  assert.equal(result.known_miss_count, 21);
  assert.deepEqual(result.cases, []);
  assert.equal(result.unresolved_artifact_limitation_count, 21);
  assert.ok(result.missing_artifacts.length > 0);
});

test('provided 21-case cohort recovers case-level records without blanket attribution', () => {
  const cohort = loadMissCohort({ repoRoot: process.cwd() });
  assert.equal(cohort.status, 'READY');
  assert.equal(cohort.cases.length, 21);
  assert.deepEqual(cohort.manifest_validation, {
    case_count: 21,
    unique_expected_id_count: 21,
    required_fields_valid: true,
    expected_label_all_missed: true
  });
  const sha256 = (filePath) => createHash('sha256')
    .update(fs.readFileSync(filePath))
    .digest('hex');
  assert.equal(
    sha256(path.join(process.cwd(), 'docs/V43_REQUIREMENT_21_MISS_MANIFEST_GPT_DEVELOPMENT_COHORT.json')),
    sha256(path.join(process.cwd(), 'docs/V43_REQUIREMENT_21_MISS_MANIFEST.json'))
  );

  const attributions = recoverMissAttributions({ repoRoot: process.cwd(), cohort });
  assert.equal(attributions.length, 21);
  assert.equal(attributions.filter((item) => item.classification === 'S5_EVAL_ALIGNMENT_ERROR').length, 1);
  assert.equal(attributions.filter((item) => item.classification === 'UNRESOLVED_ARTIFACT_LIMITATION').length, 20);
  assert.ok(attributions.every((item) => item.expected_id && item.tender_id && item.window_id));
  assert.ok(attributions
    .filter((item) => item.classification === 'UNRESOLVED_ARTIFACT_LIMITATION')
    .every((item) => item.missing_artifact_stage && item.missing_artifact_stages.length > 0));
  assert.equal(attributions
    .filter((item) => item.classification === 'UNRESOLVED_ARTIFACT_LIMITATION')
    .some((item) => item.recovered_candidate_ids.length > 0 || item.recovered_canonical_ids.length > 0), false);
});

test('attribution classification only accepts the frozen S0-S5 taxonomy', () => {
  assert.equal(
    classifyAttribution({ classification: 'S1_INPUT_CONTEXT_DAMAGE' }).classification,
    'S1_INPUT_CONTEXT_DAMAGE'
  );
  assert.throws(
    () => classifyAttribution({ classification: 'UNKNOWN' }),
    (error) => error?.code === 'INVALID_MISS_CLASSIFICATION'
  );
});

test('checkpoint reports unresolved slots and zero side effects', () => {
  const checkpoint = buildAttributionCheckpoint({
    cohort: { status: 'BLOCKED_MISSING_AUTHORITATIVE_MISS_MANIFEST', known_miss_count: 21, cases: [] },
    provider_calls: 0,
    production_db_writes: 0,
    gold_mutations: 0
  });
  assert.equal(checkpoint.counts.UNRESOLVED_ARTIFACT_LIMITATION, 21);
  assert.equal(checkpoint.dominant_root_cause, 'UNRESOLVED_ARTIFACT_LIMITATION');
  assert.equal(checkpoint.side_effects.provider_calls, 0);
  assert.equal(checkpoint.side_effects.production_db_writes, 0);
  assert.equal(checkpoint.side_effects.gold_mutations, 0);
  assert.equal(checkpoint.semantic_remediation, 'STOP_WAITING_FOR_ARTIFACT');
});
