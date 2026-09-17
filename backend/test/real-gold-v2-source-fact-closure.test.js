import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildTrackBSourceFactClosure, TRACK_B_CHECKPOINT } from '../eval/gold-governance/real-gold-v2-source-fact-closure.js';

const forbidden = new Set(['expected_answer', 'expected_decision', 'provider_output', 'provider_result', 'production_result', 'model_output', 'provider_response', 'fact_text']);
function assertBlind(value) {
  if (!value || typeof value !== 'object') return;
  for (const [key, nested] of Object.entries(value)) {
    assert.equal(forbidden.has(key.toLowerCase()), false, `forbidden field in blind artifact: ${key}`);
    assertBlind(nested);
  }
}

test('loads the four existing real-public snapshots without mutating their bodies', () => {
  const result = buildTrackBSourceFactClosure({ outputDir: null });
  assert.equal(result.manifest.source_candidate_count, 4);
  assert.equal(result.manifest.sources.length, 4);
  assert.deepEqual(result.manifest.sources.map(row => row.material_type).sort(), [
    'company_profile',
    'product_documentation',
    'project_case',
    'qualification'
  ]);
  assert.equal(result.manifest.sources.filter(row => row.synthetic_test_material === false).length, 4);
  assert.equal(result.manifest.sources.filter(row => row.knowledge_origin === 'enterprise_real_public').length, 4);
  assert.ok(result.manifest.sources.every(row => row.source_snapshot_status === 'IMMUTABLE_VERIFIED'));
  assert.ok(result.manifest.sources.every(row => row.chunk_count > 0 && row.chunk_identity_digest));
});

test('current Material Authority quarantine blocks every Neusoft source from Fact review', () => {
  const result = buildTrackBSourceFactClosure({ outputDir: null });
  assert.equal(result.manifest.authority_eligible_count, 0);
  assert.equal(result.manifest.real_fact_v2_eligible_candidates, 0);
  assert.equal(result.packet.status, 'BLOCKED_NO_ELIGIBLE_REAL_ENTERPRISE_SOURCE');
  assert.deepEqual(result.packet.sources, []);
  assert.equal(result.manifest.sources.filter(row => row.quarantine_status === 'QUARANTINED').length, 4);
  assert.ok(result.manifest.sources.every(row => row.blocking_reasons.includes('MATERIAL_AUTHORITY_QUARANTINED')));
  assert.equal(result.checkpoint.quarantine_gate, 'FAIL');
});

test('public authority is kept separate from enterprise Fact authority', () => {
  const result = buildTrackBSourceFactClosure({ outputDir: null });
  assert.deepEqual([...new Set(result.manifest.sources.map(row => row.source_authority))].sort(), ['corporate_primary', 'government_primary']);
  assert.ok(result.manifest.sources.every(row => row.generates_evidence_fact === false && row.grants_claim_permission === false));
  assert.ok(result.manifest.sources.every(row => row.independent_from_requirement === true && row.requirement_derived === false));
  assert.ok(result.manifest.corpus_gaps.includes('SOURCE_AUTHORITY_GAP:MATERIAL_AUTHORITY_QUARANTINE_REQUIRES_LIFECYCLE_DECISION'));
});

test('snapshot, provenance, identity and quarantine gates are explicit', () => {
  const result = buildTrackBSourceFactClosure({ outputDir: null });
  assert.equal(result.checkpoint.checkpoint, TRACK_B_CHECKPOINT);
  assert.equal(result.checkpoint.source_snapshot_sha_gate, 'PASS');
  assert.equal(result.checkpoint.source_provenance_gate, 'PASS');
  assert.equal(result.checkpoint.enterprise_identity_gate, 'PASS');
  assert.equal(result.checkpoint.requirement_independence_gate, 'PASS');
  assert.equal(result.checkpoint.provider_calls, 0);
  assert.equal(result.checkpoint.production_db_writes, 0);
  assert.equal(result.checkpoint.gold_mutations, 0);
});

test('blind packet contains no expected/provider/Fact authority answer', () => {
  const result = buildTrackBSourceFactClosure({ outputDir: null });
  assertBlind(result.packet);
  assert.equal(result.packet.blind, true);
  assert.equal(result.packet.sources.length, 0);
  assert.equal(result.packet.rejected_source_ids.length, 4);
});

test('deterministic output is reproducible and writes only scoped Eval artifacts', () => {
  const first = fs.mkdtempSync(path.join(os.tmpdir(), 'track-b-a-'));
  const second = fs.mkdtempSync(path.join(os.tmpdir(), 'track-b-b-'));
  const a = buildTrackBSourceFactClosure({ outputDir: first, now: '2026-09-04T00:00:00.000Z' });
  const b = buildTrackBSourceFactClosure({ outputDir: second, now: '2026-09-04T00:00:00.000Z' });
  for (const name of fs.readdirSync(first)) assert.equal(fs.readFileSync(path.join(first, name), 'utf8'), fs.readFileSync(path.join(second, name), 'utf8'));
  assert.equal(a.provider_calls, 0);
  assert.equal(a.production_db_writes, 0);
  assert.equal(a.gold_mutations, 0);
  assert.equal(a.checkpoint.production_files_changed, 0);
});

test('source and blind renderings do not include full source text', () => {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'track-b-render-'));
  buildTrackBSourceFactClosure({ outputDir });
  const manifest = fs.readFileSync(path.join(outputDir, 'track-b-real-enterprise-source-manifest.md'), 'utf8');
  const packet = fs.readFileSync(path.join(outputDir, 'track-b-real-fact-v2-blind-human-review-packet.md'), 'utf8');
  const report = fs.readFileSync(path.join(outputDir, 'track-b-source-fact-closure-report.md'), 'utf8');
  assert.ok(manifest.includes('source_snapshot_sha256'));
  assert.ok(packet.includes('Packet status: BLOCKED_NO_ELIGIBLE_REAL_ENTERPRISE_SOURCE'));
  assert.equal(manifest.includes('东软系统集成业务历经三十余年'), false);
  assert.equal(packet.includes('东软系统集成业务历经三十余年'), false);
  assert.match(report, /Material Authority quarantine gate: FAIL/);
});
