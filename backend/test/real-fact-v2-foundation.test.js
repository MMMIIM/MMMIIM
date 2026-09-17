import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildRealFactV2Foundation, REAL_FACT_V2_SCHEMA_VERSION, renderRealFactV2Manifest, renderRealFactV2BlindPacket } from '../eval/gold-governance/real-fact-v2-foundation.js';
import { buildRealFactV2FoundationForTest } from '../eval/gold-governance/real-fact-v2-foundation-test-helper.js';
import { computeSourceHash } from '../eval/gold-human-review/v2/mapping-real-rebuild/real-enterprise-source-import-harness.js';

const candidate = (source_id, extra = {}) => ({ source_id, enterprise_id: 'ACME', enterprise_name: 'Acme', source_type: 'official_project_case', material_type: 'project_case', expected_source_authority: 'corporate_primary', source_url: 'https://example.invalid/source', retrieved_at: '2026-09-04T00:00:00Z', source_org: 'Acme', review_status: 'PENDING_HUMAN_SOURCE_APPROVAL', ...extra });
const forbidden = new Set(['expected_answer', 'expected_decision', 'provider_output', 'provider_result', 'production_result', 'model_output', 'provider_response']);
function assertBlind(value) {
  if (value && typeof value === 'object') {
    for (const [key, nested] of Object.entries(value)) { assert.equal(forbidden.has(key.toLowerCase()), false, `forbidden key: ${key}`); assertBlind(nested); }
  }
}

test('synthetic, quarantined, identity-missing, and requirement-derived sources are rejected', () => {
  const report = buildRealFactV2Foundation({ candidates: [
    candidate('SYN', { synthetic_test_material: true }),
    candidate('QUAR', { lifecycle: 'QUARANTINED' }),
    { source_id: 'REQ', enterprise_id: '', enterprise_name: '', source_type: 'requirement_derived', material_type: 'other', expected_source_authority: 'unknown' }
  ], outputDir: null });
  assert.equal(report.eligibleCount, 0);
  assert.ok(report.rejectionAudit.every(row => row.status !== 'SOURCE_READY_FOR_HUMAN_FACT_REVIEW'));
});

test('metadata-only candidates produce no eligible sources and corpus gaps', () => {
  const report = buildRealFactV2Foundation({ candidates: [candidate('META')], outputDir: null });
  assert.equal(report.eligibleCount, 0);
  assert.ok(report.manifest.corpus_gaps.some(row => row.code === 'CORPUS_GAP'));
  assert.equal(report.provider_calls, 0);
  assert.equal(report.db_writes, 0);
});

test('identity-missing source is rejected independently', () => {
  const report = buildRealFactV2Foundation({ candidates: [candidate('NOID', { enterprise_id: '', enterprise_name: '' })], outputDir: null });
  assert.equal(report.rejectionAudit[0].code, 'ENTERPRISE_IDENTITY_REQUIRED');
});

test('lowercase quarantine and reference/industry projection rows fail closed', () => {
  const report = buildRealFactV2Foundation({ candidates: [
    candidate('LOWER', { lifecycle: 'quarantined' }),
    candidate('REF', { material_id: '014434eb-0d82-423f-aa8b-676d30af0182', authority_eligible: true, source_hash: 'declared' }),
    candidate('IND', { material_id: '02001ebe-6272-45ca-b641-d33e3bfcec24', authority_eligible: true, source_hash: 'declared' })
  ], outputDir: null });
  assert.equal(report.rejectionAudit[0].code, 'QUARANTINED_SOURCE_REJECTED');
  assert.equal(report.rejectionAudit[1].code, 'AUTHORITY_INELIGIBLE');
  assert.equal(report.rejectionAudit[2].code, 'AUTHORITY_INELIGIBLE');
});

test('caller authority spoof and complete snapshot cannot bypass projection gate', () => {
  const body = 'An immutable official enterprise source snapshot.';
  const entry = candidate('READY', { authority_eligible: true, source_hash: computeSourceHash(body) });
  const report = buildRealFactV2Foundation({ candidates: [entry], snapshots: new Map([['READY', { text: body, hash: computeSourceHash(body) }]]), outputDir: null });
  assert.equal(report.eligibleCount, 0);
  assert.equal(report.rejectionAudit[0].code, 'AUTHORITY_INELIGIBLE');
});

test('injected authoritative projection admits only a fully matching source', () => {
  const body = 'authoritative immutable source';
  const hash = computeSourceHash(body);
  const entry = candidate('READY', { material_id: 'MAT-1', source_hash: hash, version_or_date: '2026-01-01', currentness: 'CURRENT' });
  process.env.V43_GOLD_V2_TEST_PROJECTION = '1';
  const report = buildRealFactV2FoundationForTest({ candidate: entry, snapshot: { text: body, hash }, projection: { materials: [{ material_id: 'MAT-1', derived_source_role: 'REAL_ENTERPRISE_EVIDENCE_CANDIDATE', lifecycle_status: 'ACTIVE', synthetic_test_material: false, quarantined: false, enterprise_id: 'ACME', enterprise_name: 'Acme', file_hash: hash }] } });
  delete process.env.V43_GOLD_V2_TEST_PROJECTION;
  assert.equal(report.eligibleCount, 1);
  const row = report.manifest.candidates[0];
  assert.deepEqual(row.enterprise_identity, { enterprise_id: 'ACME', enterprise_name: 'Acme' });
  assert.equal(row.sha256, hash);
  assert.equal(row.authority_eligible, true);
  assert.equal(row.fact_ready, false);
  assert.equal(row.fact_projection.status, 'PENDING_HUMAN_FACT_REVIEW');
});

test('normal interface ignores projection override and test helper requires guard', () => {
  assert.throws(() => buildRealFactV2FoundationForTest({}), /TEST_PROJECTION_GUARD_REQUIRED/);
  const report = buildRealFactV2Foundation({ candidates: [{ source_id: 'OVERRIDE', authority_eligible: true }], authorityProjection: { materials: [{ material_id: 'OVERRIDE' }] }, outputDir: null });
  assert.equal(report.eligibleCount, 0);
});

test('positive artifacts render metadata, Fact projection, chunks, and remain blind', () => {
  const body = 'authoritative immutable source';
  const hash = computeSourceHash(body);
  const entry = candidate('RENDER', { material_id: 'MAT-RENDER', source_hash: hash, version_or_date: '2026-01-01', currentness: 'CURRENT' });
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'real-fact-v2-render-'));
  process.env.V43_GOLD_V2_TEST_PROJECTION = '1';
  const report = buildRealFactV2FoundationForTest({ candidate: entry, snapshot: { text: body, hash }, projection: { materials: [{ material_id: 'MAT-RENDER', derived_source_role: 'REAL_ENTERPRISE_EVIDENCE_CANDIDATE', lifecycle_status: 'ACTIVE', synthetic_test_material: false, quarantined: false, enterprise_id: 'ACME', enterprise_name: 'Acme', file_hash: hash }] }, outputDir });
  delete process.env.V43_GOLD_V2_TEST_PROJECTION;
  assert.equal(report.eligibleCount, 1);
  assert.equal(report.rejectionAudit.length, 0);
  assert.equal(report.manifest.rejected_count, 0);
  const manifestJson = fs.readFileSync(path.join(outputDir, 'REAL_FACT_V2_CANDIDATE_MANIFEST.json'), 'utf8');
  const blindJson = fs.readFileSync(path.join(outputDir, 'REAL_FACT_V2_BLIND_HUMAN_REVIEW_PACKET.json'), 'utf8');
  const manifestMd = fs.readFileSync(path.join(outputDir, 'REAL_FACT_V2_CANDIDATE_MANIFEST.md'), 'utf8');
  const blindMd = fs.readFileSync(path.join(outputDir, 'REAL_FACT_V2_BLIND_HUMAN_REVIEW_PACKET.md'), 'utf8');
  const md = manifestMd + blindMd;
  assertBlind(JSON.parse(manifestJson)); assertBlind(JSON.parse(blindJson));
  for (const required of ['enterprise_identity', 'source_location', 'snapshot', 'sha256', 'material_lifecycle', 'authority_eligible', 'fact_projection', 'chunk_count', 'chunk_identity']) { assert.ok(manifestJson.includes(required)); assert.ok(md.includes(required)); }
  for (const required of ['chunk_count', 'chunk_identity']) assert.ok(blindMd.includes(required));
  for (const term of forbidden) { assert.equal(manifestJson.toLowerCase().includes(term), false); assert.equal(blindJson.toLowerCase().includes(term), false); assert.equal(manifestMd.toLowerCase().includes(term), false); assert.equal(blindMd.toLowerCase().includes(term), false); }
});

test('projection identity and hash mismatches reject admission', () => {
  const body = 'authoritative immutable source';
  const hash = computeSourceHash(body);
  const entry = candidate('BAD', { material_id: 'MAT-2', source_hash: hash });
  const projection = { materials: [{ material_id: 'MAT-2', derived_source_role: 'REAL_ENTERPRISE_EVIDENCE_CANDIDATE', lifecycle_status: 'ACTIVE', synthetic_test_material: false, quarantined: false, enterprise_id: 'OTHER', enterprise_name: 'Other', file_hash: 'different' }] };
  process.env.V43_GOLD_V2_TEST_PROJECTION = '1';
  const report = buildRealFactV2FoundationForTest({ candidate: entry, snapshot: { text: body, hash }, projection });
  delete process.env.V43_GOLD_V2_TEST_PROJECTION;
  assert.equal(report.eligibleCount, 0);
  assert.equal(report.rejectionAudit[0].code, 'AUTHORITY_INELIGIBLE');
});

test('plain snapshot body without declared SHA is rejected', () => {
  const body = 'immutable body';
  const report = buildRealFactV2Foundation({ candidates: [candidate('NOHASH', { authority_eligible: true })], snapshots: new Map([['NOHASH', body]]), outputDir: null });
  assert.equal(report.eligibleCount, 0);
  assert.equal(report.rejectionAudit[0].code, 'SOURCE_SNAPSHOT_HASH_REQUIRED');
});

test('declared P cannot admit body hash H', () => {
  const body = 'body H';
  const declared = computeSourceHash('body P');
  const entry = candidate('CHAIN', { material_id: 'MAT-CHAIN', source_hash: declared });
  process.env.V43_GOLD_V2_TEST_PROJECTION = '1';
  const report = buildRealFactV2FoundationForTest({ candidate: entry, snapshot: { text: body, hash: declared }, projection: { materials: [{ material_id: 'MAT-CHAIN', derived_source_role: 'REAL_ENTERPRISE_EVIDENCE_CANDIDATE', lifecycle_status: 'ACTIVE', synthetic_test_material: false, quarantined: false, enterprise_id: 'ACME', enterprise_name: 'Acme', file_hash: declared }] } });
  delete process.env.V43_GOLD_V2_TEST_PROJECTION;
  assert.equal(report.eligibleCount, 0);
  assert.ok(['SOURCE_SNAPSHOT_HASH_MISMATCH', 'AUTHORITY_INELIGIBLE'].includes(report.rejectionAudit[0].code));
});

test('blind packet contains source identity but no expected/provider/production fields', () => {
  const report = buildRealFactV2Foundation({ candidates: [], outputDir: null });
  assert.equal(report.blindPacket.expected_decision, undefined);
  assert.equal(report.blindPacket.provider_result, undefined);
  assert.equal(report.blindPacket.production_result, undefined);
  assert.equal(report.db_writes, 0);
  assert.equal(report.manifest.schema_version, REAL_FACT_V2_SCHEMA_VERSION);
});

test('default invocation writes the four immutable review artifacts', () => {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'real-fact-v2-'));
  const report = buildRealFactV2Foundation({ outputDir });
  for (const name of ['REAL_FACT_V2_CANDIDATE_MANIFEST.json', 'REAL_FACT_V2_CANDIDATE_MANIFEST.md', 'REAL_FACT_V2_BLIND_HUMAN_REVIEW_PACKET.json', 'REAL_FACT_V2_BLIND_HUMAN_REVIEW_PACKET.md']) assert.ok(fs.existsSync(path.join(outputDir, name)));
  assert.equal(report.eligibleCount, 0);
});

test('production renderer exports complete blind fields', () => {
  const row = { source_id: 'X', enterprise_identity: { enterprise_id: 'E' }, source_location: {}, snapshot: {}, sha256: 'a', material_lifecycle: 'ACTIVE', authority_eligible: true, fact_projection: { status: 'PENDING_HUMAN_FACT_REVIEW' }, chunk_count: 1, chunk_identity: [{ chunk_id: 'C' }], status: 'SOURCE_READY_FOR_HUMAN_FACT_REVIEW' };
  assert.match(renderRealFactV2Manifest({ candidates: [row], candidate_count: 1, eligible_count: 1, rejected_count: 0, corpus_gaps: [], rejection_audit: [] }), /chunk_identity/);
  assert.match(renderRealFactV2BlindPacket({ sources: [row], rejection_audit: [] }), /chunk_count/);
});

test('guarded helper shares synthetic and requirement-derived gates', () => {
  process.env.V43_GOLD_V2_TEST_PROJECTION = '1';
  const projection = { materials: [{ material_id: 'M', derived_source_role: 'REAL_ENTERPRISE_EVIDENCE_CANDIDATE', lifecycle_status: 'ACTIVE', synthetic_test_material: false, quarantined: false, enterprise_id: 'ACME', enterprise_name: 'Acme', file_hash: 'x' }] };
  const report = buildRealFactV2FoundationForTest({ candidate: candidate('S', { material_id: 'M', synthetic_test_material: true, source_hash: 'x' }), snapshot: { text: 'x', hash: 'x' }, projection });
  delete process.env.V43_GOLD_V2_TEST_PROJECTION;
  assert.equal(report.eligibleCount, 0);
});

test('snapshot_hash alias conflicts are rejected by the shared core', () => {
  const body = 'alias conflict body';
  const hash = computeSourceHash(body);
  process.env.V43_GOLD_V2_TEST_PROJECTION = '1';
  const report = buildRealFactV2FoundationForTest({ candidate: candidate('ALIAS', { material_id: 'MAT-ALIAS', source_hash: hash, snapshot_hash: 'Q' }), snapshot: { text: body, hash }, projection: { materials: [{ material_id: 'MAT-ALIAS', derived_source_role: 'REAL_ENTERPRISE_EVIDENCE_CANDIDATE', lifecycle_status: 'ACTIVE', synthetic_test_material: false, quarantined: false, enterprise_id: 'ACME', enterprise_name: 'Acme', file_hash: hash }] } });
  delete process.env.V43_GOLD_V2_TEST_PROJECTION;
  assert.equal(report.eligibleCount, 0);
  assert.equal(report.rejectionAudit[0].code, 'SOURCE_SNAPSHOT_HASH_MISMATCH');
});

test('helper rejects reference-role projection even with matching metadata', () => {
  process.env.V43_GOLD_V2_TEST_PROJECTION = '1';
  const report = buildRealFactV2FoundationForTest({ candidate: candidate('R', { material_id: 'MR', source_hash: 'x' }), snapshot: { text: 'x', hash: 'x' }, projection: { materials: [{ material_id: 'MR', derived_source_role: 'REFERENCE_CONTEXT_ONLY', lifecycle_status: 'ACTIVE', synthetic_test_material: false, quarantined: false, enterprise_id: 'ACME', enterprise_name: 'Acme', file_hash: 'x' }] } });
  delete process.env.V43_GOLD_V2_TEST_PROJECTION;
  assert.equal(report.eligibleCount, 0);
});
