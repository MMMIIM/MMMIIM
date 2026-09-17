import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { classifyMaterialLanes, buildFactInventory } from '../eval/gold-governance/source-first-fact-inventory-v1.js';

const REPO = path.resolve(import.meta.dirname, '../..');
const projection = JSON.parse(fs.readFileSync(path.join(REPO, 'backend/eval/gold-human-review/v2/mapping-real-rebuild/00_source_role_projection.json'), 'utf8'));

test('current corpus is separated into real, synthetic, reference, quarantined and unknown lanes', () => {
  const lanes = classifyMaterialLanes(projection);
  assert.equal(lanes.real.length, 0);
  assert.equal(lanes.synthetic.length, 16);
  assert.equal(lanes.reference.length, 34);
  assert.equal(lanes.quarantined.length, 4);
  assert.equal(lanes.unknown.length, 2);
  assert.equal(lanes.synthetic.every((row) => row.synthetic_test_material === true), true);
  assert.equal(lanes.reference.every((row) => row.derived_source_role === 'REFERENCE_CONTEXT_ONLY'), true);
});

test('source-first inventory fails closed without review-backed authority and has no provider or database side effects', () => {
  const report = buildFactInventory({ projection, repoRoot: REPO });
  assert.equal(report.material_total, 56);
  assert.equal(report.real_enterprise_materials, 0);
  assert.equal(report.synthetic_enterprise_materials, 16);
  assert.equal(report.reference_only_materials, 34);
  assert.equal(report.quarantined_materials, 4);
  assert.equal(report.unknown_review_materials, 2);
  assert.equal(report.provider_calls, 0);
  assert.equal(report.production_db_writes, 0);
  assert.equal(report.gold_mutations, 0);
  assert.equal(report.fact_candidate_total, 0);
  assert.equal(report.fact_inventory_complete, 'NO');
  assert.equal(report.fact_inventory_ready_for_gpt_assessment, 'NO');
  assert.equal(report.requirement_blind_extraction, 'PASS_NO_PROVIDER_INPUTS');
  assert.equal(report.no_fabricated_fact, 'PASS');
  assert.equal(report.dispositions.every((row) => row.disposition), true);
});

test('inventory output is deterministic and never contains Requirement fields', () => {
  const a = buildFactInventory({ projection, repoRoot: REPO, now: null });
  const b = buildFactInventory({ projection, repoRoot: REPO, now: null });
  assert.deepEqual(a, b);
  const serialized = JSON.stringify(a).toLowerCase();
  for (const forbidden of ['requirement_id', 'requirement_text', 'req-']) assert.equal(serialized.includes(forbidden), false, forbidden);
});
