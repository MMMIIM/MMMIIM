import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGoldV2Foundation, classifyRequirementSources } from '../eval/gold-governance/gold-v2-foundation-orchestrator.js';

const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('classifies the six tender source states from existing builder evidence', () => {
  const result = classifyRequirementSources({
    tenderSources: [
      { tender_id: 'FAST-01', packet_available: true, source_file_exists: true, source_identity: { source_hash_match: true }, source_verified: true },
      { tender_id: 'TB-006', packet_available: true, source_file_exists: true, source_identity: { source_hash_match: true }, source_verified: true },
      { tender_id: 'FAST-WATER-01', packet_available: true, source_file_exists: true, source_identity: { source_hash_match: true }, source_verified: true },
      { tender_id: 'JY-001', packet_available: false, source_file_exists: true, source_identity: { source_hash_match: true }, source_verified: true },
      { tender_id: 'TB-003', packet_available: false, source_file_exists: true, source_identity: { source_hash_match: true }, source_verified: true },
      { tender_id: 'FAST-04', packet_available: false, source_file_exists: true, source_identity: { source_hash_match: true }, source_verified: true }
    ]
  });
  assert.deepEqual(result, { 'FAST-01': 'A_AUTHORITATIVE_PACKET_RECOVERED', 'TB-006': 'A_AUTHORITATIVE_PACKET_RECOVERED', 'FAST-WATER-01': 'A_AUTHORITATIVE_PACKET_RECOVERED', 'JY-001': 'B_HUMAN_RECONSTRUCTION_POSSIBLE', 'TB-003': 'B_HUMAN_RECONSTRUCTION_POSSIBLE', 'FAST-04': 'B_HUMAN_RECONSTRUCTION_POSSIBLE' });
});

test('orchestration is Eval-only and records zero writes/calls', () => {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'v43-gold-v2-'));
  const result = buildGoldV2Foundation({ now: '2026-09-04T00:00:00.000Z', outputDir });
  assert.equal(result.provider_calls, 0);
  assert.equal(result.db_writes, 0);
  assert.equal(result.gold_mutations, 0);
  assert.equal(result.production_files_changed, 0);
});

test('unified checkpoint composes actual Task 1-3 evidence without inferring readiness', () => {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'v43-gold-v2-unified-'));
  const result = buildGoldV2Foundation({ now: '2026-09-04T00:00:00.000Z', outputDir });
  assert.deepEqual(result.foundationStatuses, {
    REQUIREMENT_REAL_SOURCE_FOUNDATION: 'PARTIAL',
    REAL_ENTERPRISE_FACT_V2_FOUNDATION: 'CANDIDATE_ONLY/NO_ELIGIBLE_SOURCES',
    REAL_FACT_V2_ELIGIBLE_CANDIDATES: 0,
    WRITER_EVAL_PROVIDER_OFF_FOUNDATION: 'READY/PASS',
    ARCHITECTURE_MATERIALIZATION: 'PASS',
    FACT_CONTROL_RECONCILIATION: 'PASS',
    BID_PILOT_READ_ONLY_FOUNDATION: 'PASS'
  });
  assert.deepEqual(result.gates, {
    SAFE_TO_START_HUMAN_FACT_V2_REVIEW: 'NO',
    SAFE_TO_FREEZE_REAL_FACT_V2: 'NO',
    SAFE_TO_BUILD_MAPPING_GOLD_V2: 'NO',
    SAFE_TO_RUN_WRITER_LIVE_EVAL: 'NO',
    SAFE_TO_START_BID_PILOT_HITL: 'NO'
  });
  assert.equal(result.trackA.TRACK_A_REMEDIATION, 'CLOSED');
  assert.equal(result.factCandidates.eligibleCount, 0);
  assert.equal(result.writerEval.status, 'READY/PASS');
  assert.equal(result.architecture.status, 'PASS');
  assert.equal(result.factReconciliation.status, 'PASS');
  assert.equal(result.bidPilot.status, 'PASS');
  assert.equal(result.bidPilot.mode, 'READ_ONLY');
  assert.ok(fs.existsSync(path.join(outputDir, 'V43_GOLD_V2_FOUNDATION_AND_WRITER_EVAL_PREP_CHECKPOINT.json')));
  assert.ok(fs.existsSync(path.join(outputDir, 'V43_GOLD_V2_FOUNDATION_AND_WRITER_EVAL_PREP_CHECKPOINT.md')));
});

test('read-only materializations use only their approved status vocabularies', () => {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'v43-gold-v2-vocab-'));
  const result = buildGoldV2Foundation({ now: '2026-09-04T00:00:00.000Z', outputDir });
  const architectureStatuses = new Set(['ENFORCED', 'PARTIAL', 'BYPASS_FOUND', 'NOT_ENFORCED', 'NOT_VERIFIED']);
  const factStatuses = new Set(['REUSE', 'MISSING', 'NEEDS_HARDENING', 'NOT_NEEDED']);
  assert.ok(result.architecture.rows.every(row => architectureStatuses.has(row.status)));
  assert.ok(result.factReconciliation.rows.every(row => factStatuses.has(row.status)));
  assert.equal(result.bidPilot.authority_writes_exposed, 0);
  assert.equal(result.bidPilot.approval_actions_exposed, 0);
});

test('classifies unusable and absent source identities as C and D', () => {
  assert.deepEqual(classifyRequirementSources({ tenderSources: [
    { tender_id: 'C', packet_available: true, source_file_exists: true, source_identity: { source_hash_match: true }, source_verified: false },
    { tender_id: 'D', packet_available: false, source_file_exists: false, source_identity: null, source_verified: false }
  ] }), { C: 'C_REEXTRACTION_REQUIRED', D: 'D_SOURCE_INSUFFICIENT_OR_BLOCKED' });
});

test('fixed-time runs produce identical scoped artifacts and packet SHA parity', () => {
  const first = fs.mkdtempSync(path.join(os.tmpdir(), 'v43-gold-v2-a-'));
  const second = fs.mkdtempSync(path.join(os.tmpdir(), 'v43-gold-v2-b-'));
  const now = '2026-09-04T00:00:00.000Z';
  fs.writeFileSync(path.join(first, 'caller-sentinel.txt'), 'preserve me\n');
  const packetPaths = [
    'backend/eval/requirement-extraction-real-tender-pilot-v1/semantic-boundary-v1.1/packets/TB-006.json',
    'backend/eval/requirement-extraction-real-tender-pilot-v1/semantic-boundary-v1.1/packets/FAST-01.json',
    'backend/eval/requirement-extraction-real-tender-pilot-v1/semantic-boundary-v1.1/packets/FAST-WATER-01.json'
  ].map(file => path.join(REPOSITORY_ROOT, file));
  const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  const beforePacketHashes = packetPaths.map(hash);
  const builderDir = path.join(REPOSITORY_ROOT, 'backend/eval/gold-human-review/v2/mapping-real-rebuild');
  const snapshot = () => Object.fromEntries(fs.readdirSync(builderDir).map(name => [name, fs.readFileSync(path.join(builderDir, name), 'utf8')]));
  const before = snapshot();
  const a = buildGoldV2Foundation({ now, outputDir: first });
  const b = buildGoldV2Foundation({ now, outputDir: second });
  assert.deepEqual(snapshot(), before);
  assert.deepEqual(packetPaths.map(hash), beforePacketHashes);
  const generatedFiles = [
    'REAL_FACT_V2_BLIND_HUMAN_REVIEW_PACKET.json',
    'REAL_FACT_V2_BLIND_HUMAN_REVIEW_PACKET.md',
    'REAL_FACT_V2_CANDIDATE_MANIFEST.json',
    'REAL_FACT_V2_CANDIDATE_MANIFEST.md',
    'V43_GOLD_V2_FOUNDATION_AND_WRITER_EVAL_PREP_CHECKPOINT.json',
    'V43_GOLD_V2_FOUNDATION_AND_WRITER_EVAL_PREP_CHECKPOINT.md',
    'V43_WRITER_EVAL_PROVIDER_OFF_FOUNDATION_CHECKPOINT.json',
    'V43_WRITER_EVAL_PROVIDER_OFF_FOUNDATION_CHECKPOINT.md',
    'requirement-source-foundation-checkpoint.json',
    'requirement-source-foundation-checkpoint.md'
  ];
  for (const name of generatedFiles) {
    assert.equal(fs.readFileSync(path.join(first, name), 'utf8'), fs.readFileSync(path.join(second, name), 'utf8'));
  }
  assert.deepEqual(a.requirementSource.tender_sources.map(row => row.source_identity?.packet_hash), b.requirementSource.tender_sources.map(row => row.source_identity?.packet_hash));
  assert.equal(fs.readFileSync(path.join(first, 'caller-sentinel.txt'), 'utf8'), 'preserve me\n');
  assert.deepEqual(fs.readdirSync(first).sort(), ['caller-sentinel.txt', ...generatedFiles].sort());
  assert.deepEqual(fs.readdirSync(second).sort(), generatedFiles.sort());
});
