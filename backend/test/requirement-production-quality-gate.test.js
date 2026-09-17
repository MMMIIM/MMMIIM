import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  auditRequirementQuality,
  runReplayDeterminismCheck,
  runMutationSensitivityCheck,
  buildQualityArtifacts
} from '../eval/requirement-production-quality-gate/run-quality-gate.js';
import { runMutationSuite } from '../eval/requirement-semantic-quality-v1/runner.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(REPO, file), 'utf8'));

test('quality audit accounts for every candidate and keeps the one known source-less candidate explicit', () => {
  const report = auditRequirementQuality({
    candidatePool: readJson('docs/REQUIREMENT_CANDIDATE_POOL_V2_COMPLETED.json'),
    canonicalInput: readJson('docs/V43_REQUIREMENT_GOLD_V2_SIX_TENDER_CANONICAL_INPUT.json'),
    repositoryRoot: REPO
  });
  assert.equal(report.candidate_count, 1010);
  assert.equal(report.canonical_count, 1009);
  assert.equal(report.unexplained_candidate_loss, 0);
  assert.deepEqual(report.excluded_candidate_ids, ['FAST-WATER-01:FAST-WATER-01-G071']);
  assert.equal(report.unexplained_identity_loss, 0);
});

test('duplicate clusters are explained without changing the canonical contract', () => {
  const report = auditRequirementQuality({
    candidatePool: readJson('docs/REQUIREMENT_CANDIDATE_POOL_V2_COMPLETED.json'),
    canonicalInput: readJson('docs/V43_REQUIREMENT_GOLD_V2_SIX_TENDER_CANONICAL_INPUT.json'),
    repositoryRoot: REPO
  });
  assert.equal(report.duplicate_cluster_count, 8);
  assert.equal(report.duplicate_canonical_id_count, 0);
  assert.equal(report.unexplained_duplicate_count, 0);
  assert.ok(report.duplicate_clusters.some((cluster) => cluster.classification === 'CROSS_CHUNK_DUPLICATE'));
  assert.ok(report.duplicate_clusters.some((cluster) => cluster.classification === 'LEGITIMATE_REPEATED_REQUIREMENT'));
});

test('source span audit is independent from canonical resolver and never fabricates evidence', () => {
  const report = auditRequirementQuality({
    candidatePool: readJson('docs/REQUIREMENT_CANDIDATE_POOL_V2_COMPLETED.json'),
    canonicalInput: readJson('docs/V43_REQUIREMENT_GOLD_V2_SIX_TENDER_CANONICAL_INPUT.json'),
    repositoryRoot: REPO
  });
  assert.equal(report.source_hash_mismatch_count, 0);
  assert.equal(report.source_span_mismatch_count, 0);
  assert.equal(report.fabricated_source_evidence_count, 0);
  assert.ok(report.source_span_quality_counts.SOURCE_SPAN_PARTIAL >= 0);
});

test('canonical replay and mutation sensitivity are deterministic and provider-free', () => {
  const inputs = {
    candidatePool: readJson('docs/REQUIREMENT_CANDIDATE_POOL_V2_COMPLETED.json'),
    canonicalInput: readJson('docs/V43_REQUIREMENT_GOLD_V2_SIX_TENDER_CANONICAL_INPUT.json'),
    repositoryRoot: REPO
  };
  const replay = runReplayDeterminismCheck(inputs);
  const mutation = runMutationSensitivityCheck(inputs);
  assert.equal(replay.status, 'PASS');
  assert.equal(mutation.status, 'PASS');
  assert.equal(replay.provider_calls, 0);
  assert.equal(mutation.provider_calls, 0);
});

test('production quality mutation suite routes every P0 mutation through the quality gate', () => {
  const canonical = readJson('docs/V43_REQUIREMENT_GOLD_V2_SIX_TENDER_CANONICAL_INPUT.json').requirements;
  const result = runMutationSuite(canonical);
  assert.equal(result.p0_cases, 24);
  assert.equal(result.p0_escape_count, 0);
  assert.equal(result.p0_detection_recall, 1);
  assert.ok(result.cases.every((row) => row.severity !== 'P0' || row.current_gate_detected));
});

test('quality artifacts are Eval-only and contain no provider or production mutation', () => {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'v43-quality-artifacts-'));
  const result = buildQualityArtifacts({ now: '2026-09-06T00:00:00.000Z', outputDir });
  assert.equal(result.manifest.production_files_changed, 0);
  assert.equal(result.manifest.provider_calls, 0);
  assert.equal(result.manifest.production_db_writes, 0);
  assert.equal(result.manifest.gold_mutations, 0);
  const serialized = fs.readFileSync(path.join(outputDir, 'V43_REQUIREMENT_PRODUCTION_QUALITY_GATE_CHECKPOINT.json'), 'utf8');
  assert.doesNotMatch(serialized, /api[_-]?key|authorization|provider[_-]?result/i);
});
