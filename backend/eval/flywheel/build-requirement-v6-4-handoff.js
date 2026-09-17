import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const DIR = path.join(ROOT, 'docs', 'eval', 'flywheel', 'p0-badcase-repair-v2');
const DEST = path.join(ROOT, 'docs', 'handoff', 'V43_REQUIREMENT_V6_4_RUNTIME_RECERT');
const PACKET = path.join(DIR, 'V43_REQUIREMENT_V6_4_GPT_SEMANTIC_REVIEW_PACKET.json');
const CHECKPOINT = path.join(DIR, 'V43_REQUIREMENT_V6_4_BOUNDED_PRODUCER_SCOPE_ALIGNMENT_CHECKPOINT.json');
const BACKEND_FAILURES = path.join(ROOT, 'docs', 'eval', 'baseline', 'V43_POST_REQUIREMENT_V6_4_FULL_BACKEND_FAILURE_SET.json');
const REPLAY = path.join(DIR, 'V43_REQUIREMENT_V6_4_TARGETED_REPLAY.json');
const EVIDENCE = path.join(DIR, 'v6-4-evidence-rerun-20260912151026');
const sha256File = (filePath) => createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
const rel = (filePath) => path.relative(DEST, filePath).replaceAll('\\', '/');
const repoRel = (filePath) => path.relative(ROOT, filePath).replaceAll('\\', '/');

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function copyTree(source, target) {
  fs.mkdirSync(target, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const from = path.join(source, entry.name);
    const to = path.join(target, entry.name);
    if (entry.isDirectory()) copyTree(from, to);
    else fs.copyFileSync(from, to);
  }
}

function allFiles(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...allFiles(filePath));
    else files.push(filePath);
  }
  return files;
}

function main() {
  if (fs.existsSync(DEST)) throw new Error('HANDOFF_DESTINATION_ALREADY_EXISTS');
  for (const required of [PACKET, CHECKPOINT, BACKEND_FAILURES, REPLAY, EVIDENCE]) {
    if (!fs.existsSync(required)) throw new Error(`HANDOFF_INPUT_MISSING:${repoRel(required)}`);
  }
  const checkpoint = JSON.parse(fs.readFileSync(CHECKPOINT, 'utf8'));
  const replay = JSON.parse(fs.readFileSync(REPLAY, 'utf8'));
  const packet = JSON.parse(fs.readFileSync(PACKET, 'utf8'));
  fs.mkdirSync(DEST, { recursive: true });
  fs.mkdirSync(path.join(DEST, 'evidence'), { recursive: true });
  fs.copyFileSync(PACKET, path.join(DEST, '02_GPT_SEMANTIC_REVIEW_PACKET.json'));
  fs.copyFileSync(CHECKPOINT, path.join(DEST, '04_CHECKPOINT.json'));
  fs.copyFileSync(BACKEND_FAILURES, path.join(DEST, '05_BACKEND_FAILURE_SET_COMPARISON.json'));
  copyTree(EVIDENCE, path.join(DEST, 'evidence'));

  const rows = replay.rows || [];
  const unique = (values) => [...new Set(values.filter((value) => value != null))];
  writeJson(path.join(DEST, '03_RUNTIME_IDENTITY.json'), {
    artifact_type: 'V43_REQUIREMENT_V6_4_RUNTIME_IDENTITY',
    run_id: replay.run_id,
    gateway_info_http_status: checkpoint.runtime_identity?.gateway_info_http_status || null,
    gateway_build_revision: checkpoint.runtime_identity?.gateway_build_revision || null,
    requirement_contract_version: checkpoint.runtime_identity?.gateway_requirement_contract_version || null,
    runtime_instruction_sha256: checkpoint.runtime_identity?.gateway_requirement_instruction_hash || null,
    local_instruction_sha256: checkpoint.runtime_identity?.local_requirement_instruction_hash || null,
    instruction_hash_match: checkpoint.runtime_identity?.instruction_hash_match === true,
    provider: unique(rows.map((row) => row.provider)),
    requested_provider: unique(rows.map((row) => row.requested_provider)),
    model: unique(rows.map((row) => row.model)),
    requested_model: unique(rows.map((row) => row.requested_model)),
    response_model: unique(rows.map((row) => row.response_model)),
    endpoint: unique(rows.map((row) => row.endpoint)),
    generation_configs: unique(rows.map((row) => JSON.stringify(row.probe_audit?.generation_config || null))).map((value) => JSON.parse(value)),
    provider_calls: replay.provider_calls,
    retries: replay.retry_count,
    provider_failures: replay.provider_failures
  });

  fs.writeFileSync(path.join(DEST, '00_GPT_README.md'), [
    '# V43 Requirement V6.4 Runtime Recertification Handoff',
    '',
    'This package contains the hash-matched development Gateway replay for the 15 GPT-authorized bounded producer cases.',
    '',
    `Final status: ${checkpoint.final_status || 'PENDING'}`,
    `Runtime identity gate: ${checkpoint.runtime_identity_gate || 'PENDING'}`,
    `Replay run: ${replay.run_id}`,
    `Cases: ${packet.target_case_count}`,
    `Unique chunks: ${packet.target_unique_chunk_count}`,
    `Provider calls: ${replay.provider_calls}; retries: ${replay.retry_count}`,
    '',
    'All semantic_root_cause fields remain PENDING_GPT. The four Human Authority exceptions remain HUMAN_REVIEW_REQUIRED.',
    'JY-001-P0-0023 is evidence-only and was not rerun.',
    'No Gold, Source Truth, Production DB, Fact, Mapping, Claim, or Writer mutation is included.',
    'Evidence files are restricted safe snapshots; credentials and authorization headers are excluded.'
  ].join('\n') + '\n', 'utf8');

  const filesBeforeManifest = allFiles(DEST).filter((filePath) => path.basename(filePath) !== 'SHA256SUMS.txt');
  const manifest = {
    artifact_type: 'V43_HANDOFF_REQUIREMENT_V6_4_RUNTIME_RECERT',
    artifact_version: 'v1',
    source_truth_sha256: replay.source_truth_sha256,
    runtime_instruction_sha256: checkpoint.runtime_identity?.gateway_requirement_instruction_hash || null,
    replay_run_id: replay.run_id,
    case_count: packet.target_case_count,
    unique_chunk_count: packet.target_unique_chunk_count,
    provider_calls: replay.provider_calls,
    retries: replay.retry_count,
    provider_failures: replay.provider_failures,
    semantic_root_cause: 'PENDING_GPT',
    human_authority_exceptions: checkpoint.gpt_authority?.human_authority_exceptions || [],
    evidence_file_count: filesBeforeManifest.filter((filePath) => rel(filePath).startsWith('evidence/')).length,
    side_effects: {
      production_db_writes: 0,
      gold_mutations: 0,
      source_truth_mutations: 0,
      fact_actions: 0,
      mapping_actions: 0,
      claim_actions: 0,
      writer_actions: 0,
      commits: 0,
      pushes: 0,
      merges: 0,
      deploys: 0
    },
    files: filesBeforeManifest.map((filePath) => ({
      path: rel(filePath),
      bytes: fs.statSync(filePath).size,
      sha256: sha256File(filePath)
    })).sort((left, right) => left.path.localeCompare(right.path))
  };
  writeJson(path.join(DEST, '01_MANIFEST.json'), manifest);
  const sums = allFiles(DEST)
    .filter((filePath) => path.basename(filePath) !== 'SHA256SUMS.txt')
    .map((filePath) => `${sha256File(filePath)}  ${rel(filePath)}`)
    .sort()
    .join('\n') + '\n';
  fs.writeFileSync(path.join(DEST, 'SHA256SUMS.txt'), sums, 'utf8');
  process.stdout.write(JSON.stringify({ handoff: repoRel(DEST), case_count: packet.target_case_count, evidence_file_count: manifest.evidence_file_count, runtime_identity_gate: checkpoint.runtime_identity_gate, final_status: checkpoint.final_status }) + '\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) main();

export { main };
