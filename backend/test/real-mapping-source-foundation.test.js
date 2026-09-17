import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildImportPlan, computeSourceHash, detectSourceMutation, assertEnterpriseIsolation, validateSourceManifest } from '../eval/gold-human-review/v2/mapping-real-rebuild/real-enterprise-source-import-harness.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const OUT = path.join(ROOT, 'backend/eval/gold-human-review/v2/mapping-real-rebuild');
const readJson = name => JSON.parse(fs.readFileSync(path.join(OUT, name), 'utf8'));
const universe = readJson('07_real_requirement_source_universe_v2.json');
const coverage = readJson('08_requirement_cross_tender_coverage.json');
const candidates = readJson('11_real_enterprise_source_candidate_manifest.json');

test('six-tender source universe keeps target IDs and local source identity', () => {
  assert.deepEqual(universe.target_tender_ids, ['JY-001', 'TB-003', 'TB-006', 'FAST-01', 'FAST-04', 'FAST-WATER-01']);
  assert.equal(universe.target_tender_count, 6);
  assert.equal(universe.requirement_count, 198);
  assert.deepEqual(universe.missing_tenders.sort(), ['FAST-04', 'JY-001', 'TB-003']);
  assert.ok(universe.tender_sources.every(row => row.source_file_exists));
});

test('authoritative packet drift is explicit and source packet hashes match local PDFs', () => {
  assert.equal(universe.authoritative_packet_tender_count, 3);
  assert.equal(universe.requirement_packet_parity_gate, 'FAIL_MISSING_AUTHORITATIVE_PACKETS');
  assert.equal(universe.requirement_source_identity_gate, 'PASS');
  assert.ok(universe.tender_sources.every(row => row.source_identity?.source_hash_match === true));
  assert.equal(universe.synthetic_requirement_leakage, 0);
});

test('each evaluable Requirement preserves source range, excerpt and packet identity', () => {
  assert.equal(universe.requirements.length, 198);
  for (const row of universe.requirements) {
    assert.equal(row.source_verified, true);
    assert.ok(row.source_excerpt && row.source_excerpt_sha256);
    assert.ok(row.source_refs.includes(row.source_range.start_ref));
    assert.ok(row.source_refs.includes(row.source_range.end_ref));
    assert.match(row.eval_requirement_id, /^[A-Z0-9-]+:[A-Z0-9-]+$/);
    assert.equal(row.requirement_id, null);
  }
});

test('cross-tender theme grouping reuses only the existing Pilot theme names', () => {
  const allowed = new Set(['system/application capability', 'system integration / API', 'data management / governance', 'deployment / environment', 'identity / access control', 'security', 'logging / audit', 'monitoring / alerting', 'backup / recovery', 'availability / scalability', 'performance / capacity', 'operations / maintenance', 'implementation / delivery', 'project service resources', 'training / knowledge transfer', 'testing / acceptance', 'service / support / SLA', 'project experience / cases', 'industry-specific capability']);
  assert.ok(Object.keys(coverage.themes).every(key => allowed.has(key)));
  assert.equal(coverage.requirement_count, 198);
  assert.equal(coverage.theme_projection.includes('no Production taxonomy change'), true);
});

test('one enterprise identity is accepted for a logical source scope', () => {
  assert.deepEqual(assertEnterpriseIsolation([{ enterprise_id: 'ACME' }, { enterprise_id: 'ACME' }]), { ok: true, enterprise_id: 'ACME' });
});

test('mixed enterprise source scope is rejected', () => {
  assert.throws(() => assertEnterpriseIsolation([{ enterprise_id: 'ALPHA' }, { enterprise_id: 'BETA' }]), error => error.code === 'CROSS_ENTERPRISE_CONTAMINATION');
});

test('synthetic source is rejected before import planning', () => {
  const result = validateSourceManifest({ source_id: 'SYN', enterprise_id: 'ACME', enterprise_name: 'Acme', source_type: 'case', material_type: 'project_case', expected_source_authority: 'corporate_primary', synthetic_test_material: true });
  assert.equal(result.code, 'SYNTHETIC_SOURCE_REJECTED');
  assert.equal(result.ready, false);
});

test('quarantined source is rejected before import planning', () => {
  const result = validateSourceManifest({ source_id: 'Q', enterprise_id: 'ACME', enterprise_name: 'Acme', source_type: 'case', material_type: 'project_case', expected_source_authority: 'corporate_primary', lifecycle_status: 'QUARANTINED' });
  assert.equal(result.code, 'QUARANTINED_SOURCE_REJECTED');
  assert.equal(result.ready, false);
});

test('source snapshot hash is stable and source candidate manifest remains pending', () => {
  assert.equal(computeSourceHash('immutable source body'), computeSourceHash('immutable source body'));
  assert.equal(candidates.schema_version, 'v43-real-enterprise-source-candidate-manifest-v1');
  assert.equal(candidates.candidates.length, 7);
  assert.ok(candidates.candidates.every(entry => entry.review_status === 'PENDING_SOURCE_CANDIDATE' && entry.source_hash === null && entry.import_status === 'NOT_IMPORTED'));
});

test('same URL with changed body requires a new source version', () => {
  assert.deepEqual(detectSourceMutation({ source_url: 'https://example.invalid/a', source_hash: 'old' }, { source_url: 'https://example.invalid/a', source_hash: 'new' }), { mutated: true, code: 'NEW_SOURCE_VERSION_REQUIRED', preserve_previous: true });
  assert.equal(detectSourceMutation({ source_url: 'https://example.invalid/a', source_hash: 'same' }, { source_url: 'https://example.invalid/a', source_hash: 'same' }).mutated, false);
});

test('import plan reuses enterprise chunker and creates no Fact/Mapping/Claim state', () => {
  const snapshotText = 'Official project case paragraph.\n\nAcceptance evidence paragraph.';
  const entry = { source_id: 'SRC-READY', enterprise_id: 'ACME', enterprise_name: 'Acme', source_url: 'https://example.invalid/case', source_type: 'official_project_case', material_type: 'project_case', expected_source_authority: 'corporate_primary', retrieved_at: '2026-09-03T00:00:00Z', source_org: 'Acme', review_status: 'PENDING_HUMAN_SOURCE_APPROVAL', source_hash: computeSourceHash(snapshotText), synthetic_test_material: false };
  const plan = buildImportPlan(entry, { snapshotText });
  assert.equal(plan.status, 'SOURCE_READY_FOR_GPT_REVIEW');
  assert.ok(plan.chunk_count > 0);
  assert.equal(plan.db_writes, 0);
  assert.equal(plan.fact_writes, 0);
  assert.equal(plan.mapping_writes, 0);
  assert.equal(plan.claim_writes, 0);
  assert.equal(plan.fact_ready, false);
});

test('blind source packet contains no semantic decision or provider leakage', () => {
  const serialized = fs.readFileSync(path.join(OUT, '07_real_requirement_source_universe_v2.json'), 'utf8').toLowerCase();
  for (const forbidden of ['expected_decision', 'provider_result', 'semantic_result', 'claim_decision', 'suggested_mapping', 'direct_full', 'partial_support', 'conflict', 'unrelated']) assert.equal(serialized.includes(forbidden), false, `forbidden token leaked: ${forbidden}`);
});
