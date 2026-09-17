import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildMutationOwnershipAudit,
  buildRecoveryArtifacts,
  buildRuntimeIdentityAudit,
  chooseSmokeChunk
} from '../eval/requirement-production-quality-gate/recovery.js';
import { evaluateCandidatePayload } from '../eval/requirement-production-quality-gate/candidate-pipeline-evaluator.js';
import { prepareTender } from '../eval/requirement-semantic-quality-v1/runner.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const readJson = file => JSON.parse(fs.readFileSync(path.join(REPO, file), 'utf8'));

test('mutation ownership is production-quality-gate owned and fail-closed', () => {
  const canonical = readJson('docs/V43_REQUIREMENT_GOLD_V2_SIX_TENDER_CANONICAL_INPUT.json').requirements;
  const result = buildMutationOwnershipAudit({ canonical });
  assert.equal(result.mutation_test_validity, 'VALID');
  assert.equal(result.current_suite.p0_cases, 24);
  assert.equal(result.current_suite.p0_escape, 0);
  assert.equal(result.current_suite.p0_detection_recall, 1);
  assert.ok(result.current_suite.cases.every(row => row.mutation_applied === true));
  assert.ok(result.current_suite.cases.every(row => row.expected_detector_owner === 'REQUIREMENT_QUALITY_GATE_V1'));
});

test('runtime identity audit is safe and never records credentials', async () => {
  const result = await buildRuntimeIdentityAudit({
    env: {
      SEMANTIC_GATEWAY_PROVIDER: 'mock',
      SEMANTIC_GATEWAY_MODEL: 'mock-semantic-v1',
      SEMANTIC_GATEWAY_API_BASE: 'http://127.0.0.1:1',
      SEMANTIC_GATEWAY_API_KEY: 'secret-value',
      SEMANTIC_GATEWAY_USER: 'test-user'
    },
    fetchImpl: async () => { throw new Error('blocked'); }
  });
  const serialized = JSON.stringify(result);
  assert.doesNotMatch(serialized, /secret-value|authorization|bearer/i);
  assert.equal(result.provider_calls, 0);
  assert.equal(result.production_db_writes, 0);
});

test('recovery artifacts are deterministic and provider/database free when live mode is off', async () => {
  const docsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'v43-recovery-docs-'));
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'v43-recovery-output-'));
  const result = await buildRecoveryArtifacts({
    now: '2026-09-07T00:00:00.000Z',
    docsDir,
    outputDir,
    runLive: false,
    env: {
      SEMANTIC_GATEWAY_PROVIDER: 'mock',
      SEMANTIC_GATEWAY_MODEL: 'mock-semantic-v1',
      SEMANTIC_GATEWAY_API_BASE: '',
      SEMANTIC_GATEWAY_API_KEY: '',
      SEMANTIC_GATEWAY_USER: ''
    }
  });
  assert.equal(result.checkpoint.provider_calls, 0);
  assert.equal(result.checkpoint.production_db_writes, 0);
  assert.equal(result.checkpoint.gold_mutations, 0);
  assert.equal(result.checkpoint.mutation_test_validity, 'VALID');
  assert.equal(result.checkpoint.verdicts.requirement_mapping_input_ready, 'NO');
  assert.ok(fs.existsSync(path.join(docsDir, 'V43_REQUIREMENT_HUMAN_ADJUDICATION_PACKET.json')));
});

test('TB-003 smoke selector targets the explicit requirement section', async () => {
  const prepared = await prepareTender('TB-003');
  const selected = chooseSmokeChunk(prepared, 'TB-003');
  assert.equal(selected.chunk_number, 17);
  assert.match(selected.text, /（三）采购需求/);
  assert.doesNotMatch(selected.text, /优化和提升政府采购营商环境政策/);
});

test('candidate source resolution and canonicalization replay is deterministic and stage-separated', async () => {
  const chunk = {
    id: 'TB-003-CHUNK-17',
    segments: [
      { source_ref: 'C017-S001', text: '系统应支持统一身份认证。', page: 17, paragraph: 1 },
      { source_ref: 'C017-S002', text: '系统应支持 LDAP 接入。', page: 17, paragraph: 2 }
    ]
  };
  const payload = [{
    text: '系统应支持统一身份认证。',
    category: 'functional',
    source_range: { start_ref: 'C017-S001', end_ref: 'C017-S001' },
    mandatory_observed: false,
    requires_confirmation: false
  }];
  const first = evaluateCandidatePayload({ candidates: payload, chunk });
  const second = evaluateCandidatePayload({ candidates: payload, chunk });
  assert.deepEqual(second, first);
  assert.equal(first.source_resolution_success, true);
  assert.equal(first.canonicalization_success, true);
  assert.equal(first.failure_stage, null);
});

test('source failure preserves candidate index and never collapses into SOURCE_OR_CANONICALIZATION_FAILED', () => {
  const result = evaluateCandidatePayload({
    candidates: [{
      text: '系统应支持接口集成。',
      category: 'technical',
      source_range: { start_ref: 'C099-S001', end_ref: 'C099-S001' }
    }],
    chunk: { id: 'chunk-1', segments: [{ source_ref: 'C001-S001', text: '来源文本', page: 1, paragraph: 1 }] }
  });
  assert.equal(result.failure_stage, 'SOURCE_RESOLUTION');
  assert.equal(result.source_resolution_failure_code, 'SOURCE_LOCATION_UNRESOLVED');
  assert.equal(result.source_resolution_failed_candidate_index, 0);
  assert.equal(result.canonicalization_success, null);
});

test('empty valid provider payload is quality-gate empty, not a source or canonicalization failure', () => {
  const result = evaluateCandidatePayload({ candidates: [], chunk: { segments: [] } });
  assert.equal(result.failure_stage, 'QUALITY_GATE');
  assert.equal(result.quality_gate_decision, 'REVIEW_REQUIRED_OR_EMPTY');
  assert.equal(result.quality_gate_reason_codes[0], 'NO_CANDIDATES_RETURNED_BY_PROVIDER');
});

test('TB-006 local wrapper consumes smoke_cases rather than a non-existent result property', async () => {
  const docsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'v43-tb006-wrapper-docs-'));
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'v43-tb006-wrapper-output-'));
  const liveDiagnosticsInput = {
    artifact_type: 'V43_REQUIREMENT_LIVE_PIPELINE_DIAGNOSTICS',
    artifact_version: 'v1',
    mode: 'BOUNDED_LIVE',
    six_case_smoke: 'PASS',
    fixed_48_case_benchmark: 'NOT_EXECUTED_PENDING_SMOKE_GATE',
    provider_calls: 1,
    retries: 0,
    first_failure: null,
    stages: { producer: 'PASS', source_resolution: 'PASS', canonicalization: 'PASS', quality_gate: 'PASS' },
    smoke_cases: [{
      tender_id: 'TB-006',
      status: 'PASS',
      producer_success: true,
      source_resolution_success: true,
      canonicalization_success: true,
      quality_gate_decision: 'PASS',
      output_truncated: false,
      provider_chain_reached: true,
      probe_audit: {}
    }],
    safe_side_effects: { production_db_writes: 0, gold_mutations: 0, mapping_actions: 0, claim_actions: 0, writer_actions: 0 }
  };
  const result = await buildRecoveryArtifacts({
    now: '2026-09-07T00:00:00.000Z',
    docsDir,
    outputDir,
    runLive: false,
    liveDiagnosticsInput,
    env: {
      SEMANTIC_GATEWAY_PROVIDER: 'mock',
      SEMANTIC_GATEWAY_MODEL: 'mock-semantic-v1',
      SEMANTIC_GATEWAY_API_BASE: '',
      SEMANTIC_GATEWAY_API_KEY: '',
      SEMANTIC_GATEWAY_USER: ''
    }
  });
  assert.equal(result.checkpoint.live_smoke_cases, 1);
  assert.equal(result.checkpoint.provider_calls, 1);
  assert.equal(result.checkpoint.live_smoke_pass, true);
});
