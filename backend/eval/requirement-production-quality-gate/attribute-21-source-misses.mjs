import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const MISS_CLASSIFICATIONS = Object.freeze([
  'S0_SOURCE_SCOPE_MISS',
  'S1_INPUT_CONTEXT_DAMAGE',
  'S2_GENUINE_MODEL_SEMANTIC_MISS',
  'S3_POST_MODEL_FILTER_LOSS',
  'S4_CANONICAL_MERGE_DEDUP_LOSS',
  'S5_EVAL_ALIGNMENT_ERROR',
  'UNRESOLVED_ARTIFACT_LIMITATION'
]);

export const AUTHORITATIVE_MISS_MANIFEST_CANDIDATES = Object.freeze([
  'docs/V43_REQUIREMENT_21_MISS_MANIFEST.json',
  'docs/V43_REQUIREMENT_SOURCE_SIDE_MISS_MANIFEST.json',
  'docs/V43_REQUIREMENT_21_MISS_S0_S5_MANIFEST.json'
]);

const SOURCE_SIDE_ARTIFACT = 'docs/V43_REQUIREMENT_SOURCE_SIDE_BLIND_RECALL.jsonl';
const SOURCE_SIDE_ADJUDICATED_ARTIFACT = 'docs/V43_REQUIREMENT_SOURCE_SIDE_BLIND_RECALL_ADJUDICATED.jsonl';
const CANONICAL_ARTIFACTS = Object.freeze([
  'backend/eval/requirement-semantic-quality-v1/deterministic-census.json',
  'docs/V43_REQUIREMENT_GOLD_V2_SIX_TENDER_CANONICAL_INPUT.json'
]);
const CANDIDATE_ARTIFACTS = Object.freeze([
  'backend/eval/requirement-extraction-real-tender-pilot-v1/recovered-source-authority-v1/packets/JY-001.json',
  'backend/eval/requirement-extraction-real-tender-pilot-v1/recovered-source-authority-v1/packets/TB-003.json',
  'backend/eval/requirement-extraction-real-tender-pilot-v1/recovered-source-authority-v1/packets/FAST-04.json',
  'backend/eval/requirement-extraction-real-tender-pilot-v1/packets/FAST-01.json',
  'backend/eval/requirement-extraction-real-tender-pilot-v1/packets/FAST-WATER-01.json',
  'backend/eval/requirement-extraction-real-tender-pilot-v1/packets/TB-006.json',
  'docs/REQUIREMENT_CANDIDATE_POOL_V2_COMPLETED.json',
  'backend/eval/reports/FAST-01-adjudication-offline-gpt-v1.json',
  'backend/eval/reports/FAST-WATER-01-adjudication-offline-gpt-v1.json',
  'backend/eval/reports/TB-006-adjudication-offline-gpt-v1.json'
]);

function existingManifest(repoRoot) {
  return AUTHORITATIVE_MISS_MANIFEST_CANDIDATES
    .map((relativePath) => ({ relativePath, absolutePath: path.join(repoRoot, relativePath) }))
    .find(({ absolutePath }) => fs.existsSync(absolutePath)) || null;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function readJsonIfPresent(repoRoot, relativePath) {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(absolutePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
  } catch {
    return null;
  }
}

function readJsonlIfPresent(repoRoot, relativePath) {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(absolutePath)) return [];
  return fs.readFileSync(absolutePath, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line)];
      } catch {
        return [];
      }
    });
}

function normalizeText(value) {
  return String(value || '').replace(/\s+/gu, '').toLowerCase();
}

function candidateText(row) {
  return row?.requirement_text || row?.canonical_requirement_text || row?.text
    || row?.candidate_text || row?.gold_text || '';
}

function candidateId(row) {
  return row?.candidate_id || row?.canonical_requirement_id || row?.gold_id || null;
}

function rowsFromArtifact(artifact) {
  if (!artifact || typeof artifact !== 'object') return [];
  return [
    ...asArray(artifact.candidates),
    ...asArray(artifact.gold_requirements),
    ...asArray(artifact.items),
    ...asArray(artifact.rows),
    ...asArray(artifact.requirements)
  ];
}

function sourceEvidence({ sourceRows, adjudicatedRows, miss }) {
  const row = sourceRows.find((item) => (
    item?.tender_id === miss.tender_id && item?.window_id === miss.window_id
  ));
  const adjudicatedRow = adjudicatedRows.find((item) => (
    item?.tender_id === miss.tender_id && item?.window_id === miss.window_id
  ));
  return {
    row,
    adjudicatedRow,
    found: Boolean(row?.source_excerpt && row?.source_refs?.length),
    path: row ? SOURCE_SIDE_ARTIFACT : null,
    adjudicatedPath: adjudicatedRow ? SOURCE_SIDE_ADJUDICATED_ARTIFACT : null
  };
}

function collectTextMatches({ repoRoot, relativePaths, miss }) {
  const expected = normalizeText(miss.expected_requirement);
  if (!expected) return [];
  const matches = [];
  for (const relativePath of relativePaths) {
    const artifact = readJsonIfPresent(repoRoot, relativePath);
    for (const row of rowsFromArtifact(artifact)) {
      const text = normalizeText(candidateText(row));
      if (!text || text !== expected) continue;
      matches.push({
        id: candidateId(row),
        tender_id: row?.tender_id || null,
        path: relativePath
      });
    }
  }
  return matches;
}

function recoverCase({ repoRoot, miss, sourceRows, adjudicatedRows }) {
  const source = sourceEvidence({ sourceRows, adjudicatedRows, miss });
  const candidateMatches = collectTextMatches({
    repoRoot,
    relativePaths: CANDIDATE_ARTIFACTS,
    miss
  });
  const canonicalMatches = collectTextMatches({
    repoRoot,
    relativePaths: CANONICAL_ARTIFACTS,
    miss
  });

  const evidencePaths = [
    source.path,
    ...candidateMatches.map((item) => item.path),
    ...canonicalMatches.map((item) => item.path)
  ].filter(Boolean);

  // A canonical exact-text match is deterministic evidence of an alignment
  // issue. A cross-tender match is intentionally retained as S5 evidence; it
  // is never treated as a valid Requirement for the miss's tender.
  if (canonicalMatches.length > 0) {
    const uniqueCanonicalIds = [...new Set(canonicalMatches.map((item) => item.id).filter(Boolean))];
    const uniqueTenders = [...new Set(canonicalMatches.map((item) => item.tender_id).filter(Boolean))];
    return {
      expected_id: miss.expected_id,
      tender_id: miss.tender_id,
      window_id: miss.window_id,
      expected_requirement: miss.expected_requirement,
      source_excerpt: miss.source_excerpt,
      classification: 'S5_EVAL_ALIGNMENT_ERROR',
      classification_confidence: 'HIGH',
      source_block_found: source.found,
      eval_evidence_status: source.adjudicatedRow
        ? 'SOURCE_SIDE_ADJUDICATION_PRESENT_NO_EXPECTED_ID'
        : 'NOT_RECOVERED',
      router_evidence_status: 'NOT_RECOVERED',
      model_input_evidence_status: 'NOT_RECOVERED',
      candidate_evidence_status: candidateMatches.length ? 'RECOVERED_EXACT_TEXT' : 'NOT_RECOVERED',
      canonical_evidence_status: 'RECOVERED_EXACT_TEXT',
      recovered_candidate_ids: [...new Set(candidateMatches.map((item) => item.id).filter(Boolean))],
      recovered_canonical_ids: uniqueCanonicalIds,
      missing_artifact_stage: null,
      missing_artifact_stages: [],
      evidence_paths: [...new Set([...evidencePaths, source.adjudicatedPath].filter(Boolean))],
      reason: uniqueTenders.includes(miss.tender_id)
        ? 'Exact expected semantic unit exists in the current canonical universe for this tender; the historical miss is an eval alignment error.'
        : `Exact expected semantic unit exists only under different tender identity (${uniqueTenders.join(', ')}); source/tender alignment is inconsistent.`,
      alignment_tenders: uniqueTenders
    };
  }

  const missingStages = ['ROUTER', 'MODEL_INPUT', 'CANDIDATE_OUTPUT', 'CANONICAL_HISTORY'];
  return {
    expected_id: miss.expected_id,
    tender_id: miss.tender_id,
    window_id: miss.window_id,
    expected_requirement: miss.expected_requirement,
    source_excerpt: miss.source_excerpt,
    classification: 'UNRESOLVED_ARTIFACT_LIMITATION',
    classification_confidence: 'HIGH',
    source_block_found: source.found,
    eval_evidence_status: source.adjudicatedRow
      ? 'SOURCE_SIDE_ADJUDICATION_PRESENT_NO_EXPECTED_ID'
      : 'NOT_RECOVERED',
    router_evidence_status: 'NOT_RECOVERED',
    model_input_evidence_status: 'NOT_RECOVERED',
    candidate_evidence_status: 'NOT_RECOVERED',
    canonical_evidence_status: 'NOT_RECOVERED',
    recovered_candidate_ids: [],
    recovered_canonical_ids: [],
    missing_artifact_stage: missingStages[0],
    missing_artifact_stages: missingStages,
    evidence_paths: [...new Set((evidencePaths.length
      ? [...evidencePaths, source.adjudicatedPath]
      : [SOURCE_SIDE_ARTIFACT, source.adjudicatedPath]).filter(Boolean))],
    reason: source.found
      ? 'Source window is recoverable, but no case-linked historical router, model-input, candidate, or canonical evidence was found; S0-S4 and S2 are not inferable.'
      : 'The case-linked source window and downstream historical evidence could not be recovered.'
  };
}

export function recoverMissAttributions({ repoRoot = process.cwd(), cohort } = {}) {
  const loaded = cohort || loadMissCohort({ repoRoot });
  if (loaded.status !== 'READY') return [];
  const sourceRows = readJsonlIfPresent(repoRoot, SOURCE_SIDE_ARTIFACT);
  const adjudicatedRows = readJsonlIfPresent(repoRoot, SOURCE_SIDE_ADJUDICATED_ARTIFACT);
  return loaded.cases.map((miss) => recoverCase({ repoRoot, miss, sourceRows, adjudicatedRows }));
}

function validateManifest(manifest, relativePath) {
  const cases = asArray(manifest?.cases || manifest?.misses || manifest?.items);
  const expectedIds = cases.map((item) => item?.expected_id).filter(Boolean);
  const requiredFieldsValid = cases.every((item) => (
    item && typeof item === 'object'
      && typeof item.expected_id === 'string' && item.expected_id.trim()
      && typeof item.tender_id === 'string' && item.tender_id.trim()
      && typeof item.window_id === 'string' && item.window_id.trim()
      && typeof item.source_excerpt === 'string' && item.source_excerpt.trim()
      && typeof item.expected_requirement === 'string' && item.expected_requirement.trim()
      && item.expected_label === 'MISSED'
  ));
  const valid = manifest?.case_count === 21
    && cases.length === 21
    && new Set(expectedIds).size === 21
    && requiredFieldsValid;
  return {
    valid,
    cases,
    relativePath,
    validation: {
      case_count: manifest?.case_count ?? null,
      unique_expected_id_count: new Set(expectedIds).size,
      required_fields_valid: requiredFieldsValid,
      expected_label_all_missed: cases.every((item) => item?.expected_label === 'MISSED')
    }
  };
}

export function loadMissCohort({ repoRoot = process.cwd() } = {}) {
  const located = existingManifest(repoRoot);
  if (!located) {
    return {
      status: 'BLOCKED_MISSING_AUTHORITATIVE_MISS_MANIFEST',
      known_miss_count: 21,
      cases: [],
      unresolved_artifact_limitation_count: 21,
      missing_artifacts: [
        ...AUTHORITATIVE_MISS_MANIFEST_CANDIDATES,
        'persisted expected_id/source_excerpt/expected_requirement labels for the 21 source-side misses'
      ],
      excluded_near_matches: [
        'docs/V43_REQUIREMENT_SOURCE_SIDE_BLIND_RECALL.jsonl (72 pending windows; no expected labels)',
        'backend/eval/reports/reqx-v3-semantic-boundary-rescore-v1.json (old 199-case dataset; five hard misses)',
        'backend/eval/reports/reqx-v3-real-tender-eval-capture-v2.json (old 199-case dataset; incompatible cohort)'
      ]
    };
  }

  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(located.absolutePath, 'utf8'));
  } catch (error) {
    return {
      status: 'BLOCKED_INVALID_AUTHORITATIVE_MISS_MANIFEST',
      known_miss_count: 21,
      cases: [],
      unresolved_artifact_limitation_count: 21,
      missing_artifacts: [located.relativePath],
      parse_error: error?.code || 'JSON_PARSE_FAILED'
    };
  }

  const checked = validateManifest(manifest, located.relativePath);
  if (!checked.valid) {
    return {
      status: 'BLOCKED_INVALID_AUTHORITATIVE_MISS_MANIFEST',
      known_miss_count: 21,
      cases: [],
      unresolved_artifact_limitation_count: 21,
      missing_artifacts: [
        `${located.relativePath} must contain exactly 21 cases with expected_id and tender_id`
      ]
    };
  }
  return {
    status: 'READY',
    known_miss_count: 21,
    cases: checked.cases,
    unresolved_artifact_limitation_count: 0,
    manifest_path: checked.relativePath,
    manifest_validation: checked.validation,
    missing_artifacts: []
  };
}

export function classifyAttribution({ classification, ...row } = {}) {
  if (!MISS_CLASSIFICATIONS.includes(classification)) {
    throw Object.assign(new Error(`Invalid Requirement miss classification: ${classification}`), {
      code: 'INVALID_MISS_CLASSIFICATION'
    });
  }
  return { ...row, classification };
}

export function buildAttributionCheckpoint({
  cohort,
  attributions = [],
  provider_calls = 0,
  production_db_writes = 0,
  gold_mutations = 0
} = {}) {
  const counts = Object.fromEntries(MISS_CLASSIFICATIONS.map((name) => [name, 0]));
  for (const item of attributions) {
    const classification = item?.classification;
    if (!MISS_CLASSIFICATIONS.includes(classification)) {
      throw Object.assign(new Error(`Invalid Requirement miss classification: ${classification}`), {
        code: 'INVALID_MISS_CLASSIFICATION'
      });
    }
    counts[classification] += 1;
  }
  if (cohort?.known_miss_count === 21 && attributions.length === 0) {
    counts.UNRESOLVED_ARTIFACT_LIMITATION = 21;
  }
  const ranked = [...MISS_CLASSIFICATIONS].sort((a, b) => counts[b] - counts[a]
    || MISS_CLASSIFICATIONS.indexOf(a) - MISS_CLASSIFICATIONS.indexOf(b));
  const dominant = ranked.find((name) => counts[name] > 0) || 'NONE_ESTABLISHED';
  const unresolved = counts.UNRESOLVED_ARTIFACT_LIMITATION;
  const determined = attributions.length - unresolved;
  const phaseBAllowed = attributions.length === 21 && determined >= 18 && unresolved <= 3;
  return {
    checkpoint: 'V43_REQUIREMENT_21_MISS_S0_S5_ATTRIBUTION_CHECKPOINT',
    status: cohort?.status === 'READY' && attributions.length === 21
      ? 'COMPLETE'
      : 'BLOCKED_ARTIFACT_INCOMPLETE',
    known_miss_count: cohort?.known_miss_count ?? null,
    case_level_records_available: attributions.length === 21,
    counts,
    determined_case_count: determined,
    unresolved_case_count: unresolved,
    phase_b_authorized: phaseBAllowed,
    phase_b_decision: phaseBAllowed ? 'CONTINUE_ALLOWED' : 'STOP_UNRESOLVED_ARTIFACT_LIMITATION',
    dominant_root_cause: dominant,
    secondary_root_cause: ranked.find((name) => name !== dominant && counts[name] > 0) || null,
    semantic_remediation: dominant === 'S2_GENUINE_MODEL_SEMANTIC_MISS'
      ? 'STOP_WAITING_FOR_GPT_PROMPT_DECISION'
      : unresolved > 3 || dominant === 'UNRESOLVED_ARTIFACT_LIMITATION'
        ? 'STOP_WAITING_FOR_ARTIFACT'
        : phaseBAllowed
          ? 'PHASE_B_REMEDIATION_ALLOWED'
          : 'NOT_YET_DECIDED',
    side_effects: {
      provider_calls,
      production_db_writes,
      gold_mutations
    },
    missing_artifacts: cohort?.missing_artifacts || []
  };
}

export function renderAttributionCheckpoint(report) {
  return [
    '# V43 Requirement 21 Miss S0-S5 Attribution Checkpoint',
    '',
    `- status: ${report.status}`,
    `- known miss count: ${report.known_miss_count}`,
    `- case-level records available: ${report.case_level_records_available}`,
    `- S0: ${report.counts.S0_SOURCE_SCOPE_MISS}`,
    `- S1: ${report.counts.S1_INPUT_CONTEXT_DAMAGE}`,
    `- S2: ${report.counts.S2_GENUINE_MODEL_SEMANTIC_MISS}`,
    `- S3: ${report.counts.S3_POST_MODEL_FILTER_LOSS}`,
    `- S4: ${report.counts.S4_CANONICAL_MERGE_DEDUP_LOSS}`,
    `- S5: ${report.counts.S5_EVAL_ALIGNMENT_ERROR}`,
    `- unresolved artifact limitation: ${report.counts.UNRESOLVED_ARTIFACT_LIMITATION}`,
    `- dominant root cause: ${report.dominant_root_cause}`,
    `- semantic remediation: ${report.semantic_remediation}`,
    `- provider calls: ${report.side_effects.provider_calls}`,
    `- production DB writes: ${report.side_effects.production_db_writes}`,
    `- Gold mutations: ${report.side_effects.gold_mutations}`,
    `- determined cases: ${report.determined_case_count}`,
    `- unresolved cases: ${report.unresolved_case_count}`,
    `- Phase B authorized: ${report.phase_b_authorized}`,
    '',
    'No candidate/provider output, canonical ID, or semantic label was fabricated; unavailable case-linked history remains unresolved.',
    ''
  ].join('\n');
}

export function writeAttributionArtifacts({ repoRoot = process.cwd() } = {}) {
  const cohort = loadMissCohort({ repoRoot });
  const attributions = recoverMissAttributions({ repoRoot, cohort });
  const report = buildAttributionCheckpoint({ cohort, attributions });
  const manifestPath = cohort.manifest_path
    ? path.join(repoRoot, cohort.manifest_path)
    : null;
  const manifestSha256 = manifestPath && fs.existsSync(manifestPath)
    ? createHash('sha256').update(fs.readFileSync(manifestPath)).digest('hex')
    : null;
  const output = {
    artifact_type: 'V43_REQUIREMENT_21_MISS_S0_S5_ATTRIBUTION',
    artifact_version: 'v1',
    cohort,
    cases: attributions,
    manifest_sha256: manifestSha256,
    source_side_artifact: SOURCE_SIDE_ARTIFACT,
    checkpoint: report,
    provider_calls: 0,
    production_db_writes: 0,
    gold_mutations: 0
  };
  const jsonPath = path.join(repoRoot, 'docs', 'V43_REQUIREMENT_21_MISS_S0_S5_ATTRIBUTION.json');
  const mdPath = path.join(repoRoot, 'docs', 'V43_REQUIREMENT_21_MISS_S0_S5_ATTRIBUTION_CHECKPOINT.md');
  fs.writeFileSync(jsonPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  const unresolved = attributions.filter((item) => item.classification === 'UNRESOLVED_ARTIFACT_LIMITATION');
  const unresolvedLines = unresolved.length === 0
    ? '- none\n'
    : unresolved.map((item) => `- ${item.expected_id}: ${item.missing_artifact_stage} (${item.missing_artifact_stages.join(', ')})`).join('\n') + '\n';
  fs.writeFileSync(mdPath, `${renderAttributionCheckpoint(report)}\n- manifest SHA256: ${manifestSha256 || 'NOT_AVAILABLE'}\n\n## Unresolved case artifact stages\n${unresolvedLines}`, 'utf8');
  return { jsonPath, mdPath, output };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  const result = writeAttributionArtifacts();
  process.stdout.write(`${JSON.stringify(result.output.checkpoint)}\n`);
}
