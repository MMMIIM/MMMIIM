import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import {
  TARGET_TENDER_IDS,
  resolveSixTenderSourceParity,
  buildSuccessorManifest
} from '../eval/gold-governance/requirement-source-parity-v2.js';

const REPO = path.resolve(import.meta.dirname, '../..');
const sha = (value) => crypto.createHash('sha256').update(value).digest('hex');

test('successor resolves all six tenders with source and canonical linkage gates', () => {
  const report = resolveSixTenderSourceParity({ repoRoot: REPO });
  assert.deepEqual(report.target_tender_ids, TARGET_TENDER_IDS);
  assert.equal(report.gates.SIX_TENDER_SOURCE_PARITY, '6/6');
  assert.equal(report.gates.SOURCE_HASH_MISMATCH, 0);
  assert.equal(report.gates.UNRESOLVED_TENDER_SOURCE, 0);
  assert.equal(report.gates.NO_FABRICATED_TENDER_SOURCE, 'PASS');
  for (const row of report.tenders) {
    assert.equal(row.source_identity.source_hash_match, true, row.tender_id);
    assert.equal(row.source_identity.packet_hash_match, true, row.tender_id);
    assert.equal(row.canonical_linkage.source_hash_match, true, row.tender_id);
    assert.ok(row.canonical_linkage.canonical_requirement_count > 0, row.tender_id);
  }
});

test('wrong source SHA fails closed without changing source packets', () => {
  const sourceManifest = JSON.parse(fs.readFileSync(path.join(REPO, 'backend/eval/requirement-extraction-real-tender-pilot-v1/recovered-source-authority-v1/manifest.json'), 'utf8'));
  const before = sha(fs.readFileSync(path.join(REPO, sourceManifest.packets[0].packet_file)));
  const override = new Map([['JY-001', { declaredSourceHash: '0'.repeat(64) }]]);
  const report = resolveSixTenderSourceParity({ repoRoot: REPO, sourceOverrides: override });
  const jy = report.tenders.find((row) => row.tender_id === 'JY-001');
  assert.equal(jy.source_identity.source_hash_match, false);
  assert.equal(report.gates.SOURCE_HASH_MISMATCH, 1);
  assert.equal(report.gates.SIX_TENDER_SOURCE_PARITY, '5/6');
  assert.equal(sha(fs.readFileSync(path.join(REPO, sourceManifest.packets[0].packet_file))), before);
});

test('unknown tender is represented as unresolved and cannot pass the gate', () => {
  const report = resolveSixTenderSourceParity({ repoRoot: REPO, tenderIds: [...TARGET_TENDER_IDS, 'UNKNOWN-999'] });
  const unknown = report.tenders.find((row) => row.tender_id === 'UNKNOWN-999');
  assert.equal(unknown.status, 'UNRESOLVED_TENDER_SOURCE');
  assert.equal(report.gates.UNRESOLVED_TENDER_SOURCE, 1);
  assert.equal(report.gates.SIX_TENDER_SOURCE_PARITY, '6/7');
});

test('successor manifest is stable and does not mutate the frozen manifest', () => {
  const frozenPath = path.join(REPO, 'backend/eval/requirement-extraction-real-tender-pilot-v1/manifest.json');
  const before = sha(fs.readFileSync(frozenPath));
  const a = buildSuccessorManifest({ repoRoot: REPO, generatedAt: null });
  const b = buildSuccessorManifest({ repoRoot: REPO, generatedAt: null });
  assert.deepEqual(a, b);
  assert.equal(sha(fs.readFileSync(frozenPath)), before);
  assert.equal(a.eval_only, true);
  assert.equal(a.gold_mutations, 0);
  assert.equal(a.production_db_writes, 0);
});
