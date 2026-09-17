import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const readJson = (relative) => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
const sha256 = (value) => createHash('sha256').update(String(value), 'utf8').digest('hex');

const canonical = readJson('docs/V43_REQUIREMENT_GOLD_V2_SIX_TENDER_CANONICAL_INPUT.json').requirements;
const validationV1 = readJson('backend/eval/requirement-p1-semantic-calibration/results/req-p1-independent-validation-20260908/validation-case-results.json');
const calibration = readJson('docs/calibration-post-fix.json');
const safety = readJson('docs/V43_REQUIREMENT_P1_SAFETY_POSITIVE_CONTROLS.json');

const excluded = new Set([
  ...validationV1.cases.map((row) => row.canonical_requirement_id),
  ...calibration.cases.map((row) => row.req_id || row.canonical_requirement_id),
  ...safety.controls.map((row) => row.original_requirement_id)
].filter(Boolean));

const numeric = (row) => /\d/.test(row.requirement_text || '');
const sourceRefs = (row) => new Set(row.source_refs || []);
const overlaps = (left, right) => [...sourceRefs(left)].some((ref) => sourceRefs(right).has(ref));
const hasSibling = (row, rows) => rows.some((other) => other !== row && overlaps(row, other));

const selected = [];
for (const tenderId of [...new Set(canonical.map((row) => row.tender_id))].sort()) {
  const rows = canonical
    .filter((row) => row.tender_id === tenderId && !excluded.has(row.canonical_requirement_id))
    .sort((a, b) => a.canonical_requirement_id.localeCompare(b.canonical_requirement_id));
  const pick = (predicate, used) => rows.find((row) => !used.has(row.canonical_requirement_id) && predicate(row, rows));
  const used = new Set();
  const strata = [
    ['NON_NUMBER', (row) => !numeric(row)],
    ['SINGLE_ASSERTION_NUMERIC', (row, all) => numeric(row) && !hasSibling(row, all)],
    ['MULTI_SIBLING_NUMERIC_OR_NUMERIC_FALLBACK', (row, all) => numeric(row) && hasSibling(row, all)],
    ['NATURAL_MIXED_FALLBACK', () => true]
  ];
  for (const [selectionStratum, predicate] of strata) {
    const row = pick(predicate, used) || (selectionStratum === 'MULTI_SIBLING_NUMERIC_OR_NUMERIC_FALLBACK'
      ? pick((candidate) => numeric(candidate), used)
      : null);
    if (!row) throw new Error(`Unable to select Validation V2 case for ${tenderId}/${selectionStratum}`);
    used.add(row.canonical_requirement_id);
    selected.push({
      validation_v2_case_id: `POST-FIX-V2-${String(selected.length + 1).padStart(3, '0')}`,
      tender_id: row.tender_id,
      canonical_requirement_id: row.canonical_requirement_id,
      source_hash: row.source_hash,
      canonical_hash: row.requirement_hash,
      selection_stratum: selectionStratum
    });
  }
}

if (selected.length !== 24) throw new Error(`Expected 24 Validation V2 cases, got ${selected.length}`);
const ids = selected.map((row) => row.canonical_requirement_id);
if (new Set(ids).size !== ids.length) throw new Error('Validation V2 contains duplicate canonical requirement IDs');

const artifact = {
  artifact_type: 'V43_REQUIREMENT_POST_FIX_VALIDATION_V2_PRESEALED',
  artifact_version: 'v1',
  data_classification: 'VALIDATION_ONLY_NOT_GOLD',
  gold_authority: false,
  human_gold_promotion: false,
  validation_v2_presealed: true,
  validation_v2_count: selected.length,
  sealed_at: new Date().toISOString(),
  canonical_universe: 'SIX_TENDER_CANONICAL_REQUIREMENT_1009',
  independence_manifest: {
    calibration_overlap: 0,
    validation_v1_overlap: 0,
    safety_control_overlap: 0,
    provider_calls: 0,
    production_db_writes: 0,
    gold_mutations: 0,
    expected_labels: 'NOT_YET_ADJUDICATED'
  },
  cases: selected
};

const output = path.join(root, 'docs/V43_REQUIREMENT_POST_FIX_VALIDATION_V2_PRESEAL.json');
fs.writeFileSync(output, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ output, validation_v2_count: selected.length, independence_manifest: artifact.independence_manifest }, null, 2));
