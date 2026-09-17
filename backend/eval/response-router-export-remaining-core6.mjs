import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const CWD = path.resolve(process.cwd());
const ROOT = fs.existsSync(path.join(CWD, 'docs')) ? CWD : path.resolve(CWD, '..');
const SOURCE = path.join(ROOT, 'docs/V43_REQUIREMENT_GOLD_V2_SIX_TENDER_CANONICAL_INPUT.json');
const CALIBRATION = path.join(ROOT, 'docs/V43_RESPONSE_PROJECTION_GPT_CALIBRATION_PACKET.json');
const OUTPUT = path.join(ROOT, 'docs/V43_RESPONSE_ROUTER_GPT_BLIND_CORE6_REMAINING_398_INPUT.json');
const CHECKPOINT = path.join(ROOT, 'docs/V43_RESPONSE_ROUTER_GPT_BLIND_CORE6_REMAINING_398_CHECKPOINT.json');

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeJson = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
const sorted = (values) => [...values].sort((a, b) => a.localeCompare(b));
const same = (a, b) => a.length === b.length && a.every((value, index) => value === b[index]);

function main() {
  const sourceRaw = readJson(SOURCE);
  const full = Array.isArray(sourceRaw) ? sourceRaw : sourceRaw.requirements;
  const calibrationRaw = readJson(CALIBRATION);
  const calibration = Array.isArray(calibrationRaw) ? calibrationRaw : calibrationRaw.cases;
  if (!Array.isArray(full) || !Array.isArray(calibration)) throw new Error('INPUT_SHAPE_INVALID');

  const fullIds = full.map((row) => row.canonical_requirement_id || row.requirement_id);
  const includedRows = calibration.filter((row) => row.cohort === 'CORE6');
  const includedIds = includedRows.map((row) => row.requirement_id || row.canonical_requirement_id);
  if (fullIds.some((id) => !id) || includedIds.some((id) => !id)) throw new Error('MISSING_REQUIREMENT_ID');
  const fullSorted = sorted(fullIds);
  const includedSorted = sorted(includedIds);
  const fullUnique = new Set(fullIds).size === fullIds.length;
  const includedUnique = new Set(includedIds).size === includedIds.length;
  if (!fullUnique || !includedUnique) throw new Error('DUPLICATE_REQUIREMENT_ID');
  const fullSet = new Set(fullIds);
  const includedSet = new Set(includedIds);
  const outsideIncluded = includedIds.filter((id) => !fullSet.has(id));
  if (outsideIncluded.length) throw new Error(`INCLUDED_ID_NOT_IN_FULL:${outsideIncluded.join(',')}`);
  const remainingIds = fullIds.filter((id) => !includedSet.has(id));
  const remainingSorted = sorted(remainingIds);
  const remainingUnique = new Set(remainingIds).size === remainingIds.length;
  const intersection = remainingSorted.filter((id) => includedSet.has(id));
  const unionSorted = sorted([...new Set([...remainingIds, ...includedIds])]);
  const unionEqualsFull = same(unionSorted, fullSorted);
  if (full.length !== 1009 || includedRows.length !== 611 || remainingIds.length !== 398) throw new Error(`COUNT_MISMATCH:full=${full.length}:included=${includedRows.length}:remaining=${remainingIds.length}`);
  if (!remainingUnique || intersection.length !== 0 || !unionEqualsFull) throw new Error('SET_IDENTITY_MISMATCH');

  const remainingSet = new Set(remainingIds);
  const requirements = full.filter((row) => remainingSet.has(row.canonical_requirement_id || row.requirement_id));
  if (requirements.length !== 398) throw new Error(`REMAINING_ROW_MISMATCH:${requirements.length}`);
  if (requirements.some((row) => Object.hasOwn(row, 'deterministic_projection'))) throw new Error('DETERMINISTIC_PROJECTION_LEAK');

  const artifact = {
    artifact_type: 'V43_RESPONSE_ROUTER_GPT_BLIND_CORE6_REMAINING_INPUT',
    artifact_version: 'v1',
    blind: true,
    source_artifact: 'docs/V43_REQUIREMENT_GOLD_V2_SIX_TENDER_CANONICAL_INPUT.json',
    source_artifact_sha256: sha256(fs.readFileSync(SOURCE)),
    calibration_artifact: 'docs/V43_RESPONSE_PROJECTION_GPT_CALIBRATION_PACKET.json',
    calibration_artifact_sha256: sha256(fs.readFileSync(CALIBRATION)),
    full_core6_count: full.length,
    already_adjudicated_core6_count: includedRows.length,
    remaining_core6_count: requirements.length,
    requirements
  };
  const checkpoint = {
    artifact_type: 'V43_RESPONSE_ROUTER_GPT_BLIND_CORE6_REMAINING_CHECKPOINT',
    artifact_version: 'v1',
    source_artifact: artifact.source_artifact,
    source_artifact_sha256: artifact.source_artifact_sha256,
    calibration_artifact: artifact.calibration_artifact,
    calibration_artifact_sha256: artifact.calibration_artifact_sha256,
    FULL_CORE6_COUNT: full.length,
    ALREADY_INCLUDED_CORE6_COUNT: includedRows.length,
    REMAINING_CORE6_COUNT: requirements.length,
    FULL_IDS_UNIQUE: fullUnique,
    INCLUDED_IDS_UNIQUE: includedUnique,
    REMAINING_IDS_UNIQUE: remainingUnique,
    INTERSECTION_REMAINING_INCLUDED_COUNT: intersection.length,
    INTERSECTION_REMAINING_INCLUDED_EMPTY: intersection.length === 0,
    UNION_EQUALS_FULL: unionEqualsFull,
    ID_SET_DIFFERENCE: 'FULL_CORE6_1009 - CALIBRATION_CORE6_611 = REMAINING_CORE6_398',
    deterministic_projection_excluded: requirements.every((row) => !Object.hasOwn(row, 'deterministic_projection')),
    PROVIDER_CALLS: 0,
    LLM_CALLS: 0,
    PRODUCTION_DB_WRITES: 0,
    GOLD_MUTATIONS: 0,
    COMMIT: 0,
    PUSH: 0,
    MERGE: 0,
    DEPLOY: 0,
    status: 'READY_FOR_GPT_CORE6_REMAINING_398_ADJUDICATION'
  };
  writeJson(OUTPUT, artifact);
  writeJson(CHECKPOINT, checkpoint);
  console.log(JSON.stringify({
    status: checkpoint.status,
    FULL_CORE6_COUNT: full.length,
    ALREADY_INCLUDED_CORE6_COUNT: includedRows.length,
    REMAINING_CORE6_COUNT: requirements.length,
    FULL_IDS_UNIQUE: fullUnique,
    INCLUDED_IDS_UNIQUE: includedUnique,
    REMAINING_IDS_UNIQUE: remainingUnique,
    INTERSECTION_REMAINING_INCLUDED_COUNT: intersection.length,
    UNION_EQUALS_FULL: unionEqualsFull,
    deterministic_projection_excluded: checkpoint.deterministic_projection_excluded,
    provider_calls: 0,
    llm_calls: 0,
    production_db_writes: 0,
    gold_mutations: 0
  }, null, 2));
}

main();
