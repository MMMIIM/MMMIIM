import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { buildFullBlindExport, FORBIDDEN_FIELDS, GPT_FIELDS, EXPECTED_COUNTS } from '../eval/response-router-export-full-blind-v2.mjs';

const ROOT = process.cwd().replace(/\\backend$/, '');
const manifestPath = path.join(ROOT, 'docs/V43_RESPONSE_ROUTER_BLIND_GPT_V2_MANIFEST.json');
const checkpointPath = path.join(ROOT, 'docs/V43_RESPONSE_ROUTER_BLIND_GPT_V2_CHECKPOINT.json');

function findKeys(value, found = []) {
  if (Array.isArray(value)) for (const item of value) findKeys(item, found);
  else if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_FIELDS.includes(key)) found.push(key);
    findKeys(child, found);
  }
  return found;
}

test('full blind export is generated with frozen cohort counts', () => {
  const { artifact, checkpoint } = buildFullBlindExport();
  assert.deepEqual(artifact.cohort_counts, EXPECTED_COUNTS);
  assert.equal(artifact.total_count, 2178);
  assert.equal(checkpoint.FULL_CORPUS_COUNT, 2178);
  assert.equal(checkpoint.ROW_LOSS_OR_ADDITION_COUNT, 0);
});

test('full blind export has unique cohort identities and no deterministic semantics', () => {
  const { artifact, checkpoint } = buildFullBlindExport();
  assert.deepEqual(checkpoint.IDS_UNIQUE_WITHIN_COHORT, { CORE6: true, HOLDOUT_V1: true, HOLDOUT_V2: true });
  assert.equal(checkpoint.COMBINED_COHORT_TENDER_REQUIREMENT_IDS_UNIQUE, true);
  assert.equal(checkpoint.BLINDNESS_VIOLATION_COUNT, 0);
  assert.equal(checkpoint.DETERMINISTIC_ROUTER_FIELDS_PRESENT, false);
  assert.deepEqual([...new Set(findKeys(artifact))], []);
});

test('every GPT adjudication field remains null and no semantic mutation occurred', () => {
  const { artifact, checkpoint } = buildFullBlindExport();
  for (const row of artifact.requirements) for (const key of GPT_FIELDS) assert.equal(row[key], null, `${row.case_id}:${key}`);
  assert.equal(checkpoint.GPT_LABELS_PRESENT, 0);
  assert.equal(checkpoint.GPT_FIELDS_ALL_NULL, true);
  assert.equal(checkpoint.SEMANTIC_MUTATION_COUNT, 0);
});

test('source hash metadata and side-effect gates are explicit', () => {
  const { artifact, checkpoint } = buildFullBlindExport();
  assert.equal(artifact.source_artifacts.length, 3);
  assert.ok(artifact.source_artifacts.every((item) => /^[0-9a-f]{64}$/.test(item.sha256)));
  assert.equal(checkpoint.PROVIDER_CALLS, 0);
  assert.equal(checkpoint.LLM_CALLS, 0);
  assert.equal(checkpoint.PRODUCTION_DB_WRITES, 0);
  assert.equal(checkpoint.GOLD_MUTATIONS, 0);
  assert.equal(checkpoint.status, 'READY_FOR_GPT_FULL_CORPUS_SEMANTIC_REFERENCE_V2');
});

test('three cohort files, manifest, and checkpoint are valid JSON exports', () => {
  for (const [cohort, count] of Object.entries(EXPECTED_COUNTS)) {
    const outputPath = path.join(ROOT, `docs/V43_RESPONSE_ROUTER_BLIND_GPT_V2_${cohort}_${count}.json`);
    assert.equal(fs.existsSync(outputPath), true);
    const artifact = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
    assert.equal(artifact.requirements.length, count);
  }
  assert.equal(fs.existsSync(manifestPath), true);
  assert.equal(fs.existsSync(checkpointPath), true);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, 'utf8'));
  assert.equal(manifest.total_count, 2178);
  assert.equal(manifest.GPT_LABELS_PRESENT, 0);
  assert.equal(checkpoint.FULL_CORPUS_COUNT, 2178);
});
