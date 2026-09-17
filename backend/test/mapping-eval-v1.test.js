import test from 'node:test';
import assert from 'node:assert/strict';

import {
  loadMappingGold,
  validateMappingGold,
  scoreMappingCases,
  MAPPING_FAILURE_TAXONOMY
} from '../eval/mapping-benchmark-v1/mapping-eval-metrics.js';
import {
  runMappingFastGate,
  runMappingQualityGate,
  runDownstreamSafetyGate,
  runDbGate
} from '../eval/mapping-benchmark-v1/mapping-eval-quality-gate.js';
import {
  writeMappingEvalArtifact,
  assertProductionDoesNotImportEval
} from '../eval/mapping-benchmark-v1/mapping-eval-runner.js';

const directFull = {
  decision: 'direct_full',
  dimensions: {
    subject: 'match', scope: 'match', status: 'not_applicable',
    quantity: 'not_applicable', entity: 'not_applicable', validity: 'match'
  }
};

const partial = {
  decision: 'partial_support',
  dimensions: {
    subject: 'match', scope: 'unknown', status: 'not_applicable',
    quantity: 'not_applicable', entity: 'unknown', validity: 'not_applicable'
  }
};

test('Mapping Gold loader uses the single human-authored 36-case authority', () => {
  const gold = loadMappingGold();
  assert.equal(gold.authorship, 'human-authored-static');
  assert.equal(gold.cases.length, 36);
  assert.equal(validateMappingGold(gold).ok, true);
  assert.match(validateMappingGold(gold).gold_hash, /^[a-f0-9]{64}$/);
});

test('Mapping Gold validation rejects duplicate cases and missing dimensions', () => {
  const gold = loadMappingGold();
  const duplicate = JSON.parse(JSON.stringify(gold));
  duplicate.cases[35] = duplicate.cases[0];
  const duplicateResult = validateMappingGold(duplicate);
  assert.equal(duplicateResult.ok, false);
  assert.ok(duplicateResult.errors.some(error => error.startsWith('duplicate_case_id:')));

  const missingDimension = JSON.parse(JSON.stringify(gold));
  delete missingDimension.cases[0].expected.dimensions.quantity;
  const missingResult = validateMappingGold(missingDimension);
  assert.equal(missingResult.ok, false);
  assert.ok(missingResult.errors.includes('dimension:MAP-G001:quantity'));
});

test('mapping metrics report a perfect deterministic fixture without claiming model quality', () => {
  const gold = { case_id: 'M001', expected: directFull };
  const result = scoreMappingCases([{ gold, actual: directFull }]);
  assert.equal(result.metrics.decision_accuracy, 1);
  assert.equal(result.metrics.dimension_accuracy, 1);
  assert.equal(result.metrics.subject_accuracy, 1);
  assert.equal(result.metrics.validity_accuracy, 1);
  assert.equal(result.metrics.false_full_count, 0);
  assert.equal(result.metrics.conflict_recall, null);
  assert.equal(result.semantic_model_quality, 'NOT_MEASURED');
});

test('mapping metrics classify false full and conflict miss once per case', () => {
  const result = scoreMappingCases([
    { gold: { case_id: 'M-PARTIAL', expected: partial }, actual: directFull },
    { gold: { case_id: 'M-CONFLICT', expected: { decision: 'conflict', dimensions: { quantity: 'mismatch' } } }, actual: partial }
  ]);
  assert.equal(result.metrics.false_full_count, 1);
  assert.equal(result.metrics.missed_conflict_count, 1);
  assert.equal(result.taxonomy.primary.FALSE_FULL, 1);
  assert.equal(result.taxonomy.secondary.AUTHORITY_ESCALATION, 1);
  assert.equal(result.taxonomy.primary.MISSED_CONFLICT, 1);
  assert.equal(Object.values(result.taxonomy.primary).reduce((sum, value) => sum + value, 0), 2);
  assert.ok(MAPPING_FAILURE_TAXONOMY.includes('WRITER_AUTHORITY_BYPASS'));
});

test('mapping metrics do not count an expected partial mapping as a false positive', () => {
  const result = scoreMappingCases([{ gold: { case_id: 'M-PARTIAL', expected: partial }, actual: partial }]);
  assert.equal(result.metrics.false_positive_count, 0);
});

test('fast gate is offline, reuses production policy, and keeps semantic quality unmeasured', async () => {
  const report = await runMappingFastGate();
  assert.equal(report.status, 'PASS');
  assert.equal(report.gold.case_count, 36);
  assert.equal(report.semantic_model_quality, 'NOT_MEASURED');
  assert.equal(report.provider_calls, 0);
  assert.equal(report.db_writes, 0);
  assert.equal(report.negative_controls.status, 'PASS');
  assert.equal(report.case_results.length, 35);
  assert.deepEqual(report.failed_gold_ids, []);
});

test('downstream safety gate catches promotion and Writer bypass controls', async () => {
  const report = await runDownstreamSafetyGate();
  assert.equal(report.status, 'PASS');
  assert.equal(report.metrics.false_full, 0);
  assert.equal(report.metrics.authority_escalation, 0);
  assert.equal(report.metrics.unauthorized_claim_allow, 0);
  assert.equal(report.metrics.writer_authority_bypass, 0);
  assert.equal(report.metrics.cross_project_candidate_leakage, 0);
});

test('quality gate keeps DB and semantic layers distinct and blocks release when DB is not verified', async () => {
  const report = await runMappingQualityGate({ mode: 'fast' });
  assert.equal(report.gates.MAPPING_FAST_GATE.status, 'PASS');
  assert.equal(report.gates.MAPPING_DOWNSTREAM_SAFETY_GATE.status, 'PASS');
  assert.equal(report.gates.MAPPING_DB_GATE.status, 'NOT_EXECUTED');
  assert.equal(report.gates.MAPPING_SEMANTIC_GATE.status, 'NOT_EXECUTED');
  assert.equal(report.gates.MAPPING_RELEASE_GATE.status, 'BLOCKED');
});

test('DB gate reports unavailable instead of converting ECONNREFUSED into PASS', async () => {
  const report = await runDbGate({ enabled: true, runner: async () => ({ exitCode: 1, stderr: 'ECONNREFUSED 127.0.0.1:5432' }) });
  assert.equal(report.status, 'NOT_VERIFIED');
  assert.equal(report.reason_code, 'DB_UNAVAILABLE');
});

test('result artifact has stable gate fields and contains no credential material', () => {
  const writes = [];
  const report = { run_id: 'mapping-eval-test', mode: 'fast', provider_calls: 0, gates: { MAPPING_FAST_GATE: { status: 'PASS' } } };
  writeMappingEvalArtifact(report, { fsImpl: { mkdirSync() {}, writeFileSync: (file, body) => writes.push({ file, body }) }, jsonPath: 'results/test.json', markdownPath: 'results/test.md' });
  assert.equal(writes.length, 2);
  assert.match(writes.find(item => item.file.endsWith('.json')).body, /"run_id": "mapping-eval-test"/);
  assert.equal(writes.some(item => /api[_-]?key|authorization|secret/i.test(item.body)), false);
});

test('production source does not import evaluation code', () => {
  const result = assertProductionDoesNotImportEval();
  assert.equal(result.ok, true);
  assert.equal(result.offending_files.length, 0);
});
