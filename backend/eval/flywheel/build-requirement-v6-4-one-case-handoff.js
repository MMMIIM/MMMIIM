/** Build the self-contained V6.4 one-case GPT handoff without any Provider call. */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const OUT_DIR = path.join(ROOT, 'docs', 'eval', 'flywheel', 'p0-badcase-repair-v2');
const REPLAY = path.join(OUT_DIR, 'V43_REQUIREMENT_V6_4_ONE_CASE_SELECTOR_REPLAY.json');
const CORRECTION = path.join(OUT_DIR, 'V43_REQUIREMENT_V6_4_ONE_CASE_SELECTOR_CORRECTION.json');
const CHECKPOINT = path.join(OUT_DIR, 'V43_REQUIREMENT_V6_4_ONE_CASE_SELECTOR_CHECKPOINT.json');
const GPT_V63 = path.join(ROOT, 'docs', 'handoff', 'V43_REQUIREMENT_V6_3_SEMANTIC_ADJUDICATION', '02_GPT_DECISION_PACKET.json');
const GPT_ROOT_V63 = path.join(OUT_DIR, 'V43_P0_BADCASE_43_GPT_SEMANTIC_ROOT_CAUSE_PACKET_V6_3.json');
const EVIDENCE_BASE = path.join(OUT_DIR, 'v6-4-one-case-evidence-20260913');
const HANDOFF_DIR = path.join(ROOT, 'docs', 'handoff', 'V43_REQUIREMENT_V6_4_FINAL_ONE_CASE_RECERT');
const ZIP_PATH = path.join(ROOT, 'docs', 'handoff', 'V43_HANDOFF_REQUIREMENT_V6_4_FINAL_ONE_CASE_RECERT.zip');

function readJson(filePath) { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
function sha256File(filePath) { return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex'); }
function rel(filePath) { return path.relative(ROOT, filePath).replaceAll('\\', '/'); }
function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}
function findEvidenceDir(runId) {
  const runDir = path.join(EVIDENCE_BASE, runId, 'restricted-evidence');
  if (!fs.existsSync(runDir)) throw new Error(`EVIDENCE_NOT_FOUND:${runDir}`);
  return runDir;
}
function findEvidenceFile(dir, prefix) {
  const file = fs.readdirSync(dir).find((name) => name.startsWith(prefix) && name.endsWith('.json'));
  if (!file) throw new Error(`EVIDENCE_STAGE_NOT_FOUND:${prefix}`);
  return path.join(dir, file);
}
function copyEvidenceFiles(sourceDir, destinationDir) {
  fs.mkdirSync(destinationDir, { recursive: true });
  for (const name of fs.readdirSync(sourceDir).sort()) {
    const source = path.join(sourceDir, name);
    const target = path.join(destinationDir, name);
    if (!fs.statSync(source).isFile()) continue;
    fs.copyFileSync(source, target);
  }
}
function zipDirectory(directory, zipPath) {
  const manifest = [];
  function walk(dir, prefix = '') {
    for (const name of fs.readdirSync(dir).sort()) {
      const full = path.join(dir, name);
      const relative = `${prefix}${name}`;
      if (fs.statSync(full).isDirectory()) walk(full, `${relative}/`);
      else manifest.push({ full, relative });
    }
  }
  walk(directory);
  const files = manifest.map((entry) => entry.full);
  const args = ['-NoProfile', '-Command', `$files=@(${files.map((file) => `'${file.replaceAll("'", "''")}'`).join(',')}); Compress-Archive -LiteralPath $files -DestinationPath '${zipPath.replaceAll("'", "''")}' -Force`];
  execFileSync('powershell.exe', args, { stdio: 'inherit' });
}

async function main() {
  const replay = readJson(REPLAY);
  const correction = readJson(CORRECTION);
  const checkpoint = readJson(CHECKPOINT);
  const gptV63 = readJson(GPT_V63);
  const gptRootV63 = readJson(GPT_ROOT_V63);
  const row = replay.rows?.find((item) => item.atom_id === 'FAST-01-P0-0019');
  if (!row || replay.provider_calls !== 1 || row.chunk_id !== 'FAST-01:reconstructed:1') throw new Error('ONE_CASE_REPLAY_IDENTITY_INVALID');
  const gptRow = gptV63.rows?.find((item) => item.atom_id === row.atom_id);
  const rootRow = gptRootV63.rows?.find((item) => item.atom_id === row.atom_id);
  const evidenceDir = findEvidenceDir(replay.run_id);
  const rawResponseFile = findEvidenceFile(evidenceDir, 'RAW_PROVIDER_RESPONSE_SNAPSHOT-');
  const normalizedFile = findEvidenceFile(evidenceDir, 'NORMALIZED_CANDIDATE_SNAPSHOT-');
  const sourceResolutionFile = findEvidenceFile(evidenceDir, 'SOURCE_RESOLUTION_SNAPSHOT-');
  const canonicalizationFile = findEvidenceFile(evidenceDir, 'CANONICALIZATION_DECISION_SNAPSHOT-');
  const canonicalOutputFile = findEvidenceFile(evidenceDir, 'CANONICAL_OUTPUT_SNAPSHOT-');
  const rawResponse = readJson(rawResponseFile).evidence?.response_payload_json;
  let rawCandidates = [];
  try { rawCandidates = JSON.parse(rawResponse)?.data?.requirements || []; } catch (_error) { rawCandidates = []; }
  const normalized = readJson(normalizedFile).evidence || {};
  const sourceResolution = readJson(sourceResolutionFile).evidence || {};
  const canonicalization = readJson(canonicalizationFile).evidence || {};
  const canonicalOutput = readJson(canonicalOutputFile).evidence || {};

  if (fs.existsSync(HANDOFF_DIR)) throw new Error(`HANDOFF_DESTINATION_EXISTS:${HANDOFF_DIR}`);
  fs.mkdirSync(path.join(HANDOFF_DIR, 'evidence'), { recursive: true });
  copyEvidenceFiles(evidenceDir, path.join(HANDOFF_DIR, 'evidence'));
  const sourceTruth = gptRow?.source_truth || rootRow?.source_truth || null;
  const frozenAnchorDecision = rootRow?.frozen_anchor_decision || gptRow?.frozen_anchor_decision || null;
  const frozenLabel = rootRow?.frozen_semantic_label || gptRow?.frozen_semantic_label || null;
  const frozenReason = rootRow?.frozen_semantic_reason || gptRow?.frozen_semantic_reason || null;
  const packet = {
    artifact_type: 'V43_REQUIREMENT_V6_4_FINAL_ONE_CASE_GPT_SEMANTIC_REVIEW_PACKET',
    artifact_version: 'v6.4-one-case',
    blind_semantic_adjudication: true,
    run_id: replay.run_id,
    source_truth_sha256: replay.source_truth_sha256,
    case_count: 1,
    rows: [{
      atom_id: row.atom_id,
      tender_id: row.tender_id,
      frozen_stage1_gpt_context: {
        frozen_anchor_decision: frozenAnchorDecision,
        frozen_semantic_label: frozenLabel,
        frozen_semantic_reason: frozenReason,
        source_truth: sourceTruth
      },
      selector_correction: correction,
      production_provider_input: {
        task_type: 'requirement_extraction',
        chunk_id: row.chunk_id,
        replay_input_authority_level: row.replay_input_authority_level,
        source_refs: row.source_refs,
        input_sha256: row.input_sha256,
        input_length: row.input_length,
        input_excerpt: (() => {
          const inputFile = findEvidenceFile(evidenceDir, 'PROVIDER_INPUT_SNAPSHOT-');
          return readJson(inputFile).evidence?.model_text || null;
        })()
      },
      raw_provider_candidate_text: rawCandidates,
      normalized_candidate_text: normalized.candidates || [],
      canonical_output_text: (normalized.candidates || []).map((candidate) => candidate.text),
      canonical_output_provenance: 'MECHANICAL_IDENTITY_PROJECTION_FROM_NORMALIZED_CANDIDATE_TEXT; NO_NEW_SEMANTIC_JUDGMENT',
      canonicalization_outcome: canonicalization,
      source_resolution_outcome: sourceResolution,
      canonical_output_outcome: canonicalOutput,
      current_mechanical_divergence: {
        previous_wrong_chunk_id: correction.previous_wrong_chunk_id,
        corrected_chunk_id: correction.corrected_chunk_id,
        quality_gate_decision: row.quality_gate_decision,
        quality_gate_reason_codes: canonicalization.quality_gate_reason_codes || [],
        mechanical_failure_stage: row.error_class || canonicalization.failure_stage || null,
        semantic_root_cause: 'PENDING_GPT'
      },
      runtime_observation: {
        contract_version: checkpoint.runtime_identity?.contract_version || null,
        instruction_hash: checkpoint.runtime_identity?.instruction_hash || null,
        candidate_schema_hash: checkpoint.runtime_identity?.candidate_schema_hash || null,
        provider: row.provider,
        requested_provider: row.requested_provider,
        model: row.model,
        requested_model: row.requested_model,
        response_model: row.response_model,
        endpoint: row.endpoint,
        finish_reason: row.finish_reason,
        provider_http_status: row.provider_http_status,
        gateway_http_status: row.gateway_http_status,
        schema_pass: row.schema_pass,
        source_resolution_pass: row.source_resolution_pass,
        canonicalization_pass: row.canonicalization_pass,
        quality_gate_decision: row.quality_gate_decision,
        candidate_count: row.candidate_count,
        probe_audit: row.probe_audit,
        provider_calls: row.provider_calls,
        retries: row.retries,
        duration_ms: row.duration_ms,
        semantic_root_cause: 'PENDING_GPT'
      },
      evidence_refs: row.restricted_evidence_refs.map((ref) => ({ ...ref, path: `evidence/${path.basename(ref.path)}` })),
      semantic_root_cause: 'PENDING_GPT'
    }]
  };
  writeJson(path.join(HANDOFF_DIR, '02_GPT_SEMANTIC_REVIEW_PACKET.json'), packet);
  writeJson(path.join(HANDOFF_DIR, '03_SELECTOR_CORRECTION.json'), correction);
  writeJson(path.join(HANDOFF_DIR, '04_RUNTIME_IDENTITY.json'), checkpoint.runtime_identity || {});
  writeJson(path.join(HANDOFF_DIR, '05_CHECKPOINT.json'), {
    artifact_type: 'V43_REQUIREMENT_V6_4_FINAL_ONE_CASE_RECERT_CHECKPOINT',
    run_id: replay.run_id,
    case_count: 1,
    targeted_case: row.atom_id,
    previous_wrong_chunk_id: correction.previous_wrong_chunk_id,
    corrected_chunk_id: correction.corrected_chunk_id,
    provider_calls: 1,
    final_authoritative_replay_provider_calls: 1,
    retries: 0,
    provider_http_status: row.provider_http_status,
    gateway_http_status: row.gateway_http_status,
    finish_reason: row.finish_reason,
    schema: row.schema_pass ? 'PASS' : 'FAIL',
    source_resolution: row.source_resolution_pass ? 'PASS' : 'FAIL',
    canonicalization: row.canonicalization_pass ? 'PASS' : 'FAIL',
    quality_gate_decision: row.quality_gate_decision,
    prior_stage1_verdicts_preserved: true,
    other_cases_rerun: 0,
    production_db_writes: 0,
    gold_mutations: 0,
    production_semantic_changes: 0,
    prompt_changes: 0,
    schema_changes: 0,
    postgres: 'NOT_RUN_NO_ISOLATED_TEST_DB',
    final_status: 'READY_FOR_GPT_REQUIREMENT_V6_4_FINAL_ONE_CASE_ADJUDICATION'
  });
  fs.writeFileSync(path.join(HANDOFF_DIR, '00_GPT_README.md'), [
    '# V43 Requirement V6.4 Final One-Case Recertification', '',
    `- Case: ${row.atom_id}`,
    `- Run: ${replay.run_id}`,
    '- Scope: Eval-only selector correction and one production-shaped replay.',
    '- Semantic adjudication: PENDING_GPT; Codex did not assign a new label.',
    '- Corrected selector: FAST-01:reconstructed:1 (previous V6.4 selector: FAST-01:reconstructed:23).',
    '- Prior Stage-1 verdicts are preserved; no other cases were rerun.',
    '- JY-001-P0-0023 remains evidence-only and was not replayed in this one-case run.',
    '- Provider call cap: 1; retries: 0; production DB writes: 0; Gold mutations: 0.',
    '', 'All files in this directory are self-contained for GPT review. Restricted evidence is copied under `evidence/`.'
  ].join('\n') + '\n');
  const artifactPaths = [];
  for (const name of fs.readdirSync(HANDOFF_DIR).sort()) {
    const full = path.join(HANDOFF_DIR, name);
    if (fs.statSync(full).isFile() && name !== 'SHA256SUMS.txt' && name !== '01_MANIFEST.json') {
      artifactPaths.push({ full, relative: name });
    }
  }
  for (const name of fs.readdirSync(path.join(HANDOFF_DIR, 'evidence')).sort()) {
    const full = path.join(HANDOFF_DIR, 'evidence', name);
    if (fs.statSync(full).isFile()) artifactPaths.push({ full, relative: `evidence/${name}` });
  }
  const manifest = {
    artifact_type: 'V43_HANDOFF_REQUIREMENT_V6_4_FINAL_ONE_CASE_RECERT',
    run_id: replay.run_id,
    source_truth_sha256: replay.source_truth_sha256,
    case_count: 1,
    included_files: artifactPaths.map((entry) => entry.relative).concat(['01_MANIFEST.json', 'SHA256SUMS.txt']),
    artifact_hashes: Object.fromEntries(artifactPaths.map((entry) => [entry.relative, sha256File(entry.full)])),
    provider_calls: 1,
    retries: 0,
    production_db_writes: 0,
    gold_mutations: 0,
    prompt_changes: 0,
    schema_changes: 0,
    semantic_root_cause: 'PENDING_GPT'
  };
  writeJson(path.join(HANDOFF_DIR, '01_MANIFEST.json'), manifest);
  const entries = [];
  for (const name of fs.readdirSync(HANDOFF_DIR).sort()) {
    const full = path.join(HANDOFF_DIR, name);
    if (fs.statSync(full).isFile() && name !== 'SHA256SUMS.txt') entries.push(`${sha256File(full)}  ${name}`);
  }
  for (const name of fs.readdirSync(path.join(HANDOFF_DIR, 'evidence')).sort()) {
    const full = path.join(HANDOFF_DIR, 'evidence', name);
    if (fs.statSync(full).isFile()) entries.push(`${sha256File(full)}  evidence/${name}`);
  }
  fs.writeFileSync(path.join(HANDOFF_DIR, 'SHA256SUMS.txt'), `${entries.join('\n')}\n`, 'utf8');
  zipDirectory(HANDOFF_DIR, ZIP_PATH);
  process.stdout.write(`${JSON.stringify({ handoff_dir: rel(HANDOFF_DIR), zip_path: rel(ZIP_PATH), zip_sha256: sha256File(ZIP_PATH), decision_packet_sha256: sha256File(path.join(HANDOFF_DIR, '02_GPT_SEMANTIC_REVIEW_PACKET.json')), case_count: 1, evidence_file_count: fs.readdirSync(path.join(HANDOFF_DIR, 'evidence')).length })}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) main().catch((error) => { process.stderr.write(`${error?.code || error?.message || error}\n`); process.exitCode = 1; });

export { main };
