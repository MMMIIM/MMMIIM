import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolveSemanticTaskInstruction } from '../../../packages/semantic-contracts/index.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const DIR = path.join(ROOT, 'docs', 'eval', 'flywheel', 'p0-badcase-repair-v2');
const REPLAY_PATH = path.join(DIR, 'V43_REQUIREMENT_V6_4_TARGETED_REPLAY.json');
const GPT_PATH = path.join(ROOT, 'docs', 'handoff', 'V43_REQUIREMENT_V6_3_SEMANTIC_ADJUDICATION', '02_GPT_DECISION_PACKET.json');
const OUT_PATH = path.join(DIR, 'V43_REQUIREMENT_V6_4_GPT_SEMANTIC_REVIEW_PACKET.json');
const RUNTIME_INSTRUCTION_SHA256 = createHash('sha256').update(resolveSemanticTaskInstruction('requirement_extraction'), 'utf8').digest('hex');

const read = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));
const rel = (filePath) => path.relative(ROOT, filePath).replaceAll('\\', '/');
const stages = ['PROVIDER_INPUT_SNAPSHOT', 'RAW_PROVIDER_RESPONSE_SNAPSHOT', 'NORMALIZED_CANDIDATE_SNAPSHOT', 'CANONICALIZATION_DECISION_SNAPSHOT', 'SOURCE_RESOLUTION_SNAPSHOT', 'CANONICAL_OUTPUT_SNAPSHOT'];
const filesByStage = new Map(stages.map((stage) => [stage, fs.readdirSync(path.join(DIR, 'v6-4-evidence')).filter((name) => name.startsWith(stage))]));

function loadRef(ref) {
  if (!ref?.path) return null;
  const filePath = path.join(ROOT, ref.path);
  if (!fs.existsSync(filePath)) return null;
  return read(filePath).evidence || null;
}
function refFor(row, stage) {
  const ref = (row.restricted_evidence_refs || []).find((item) => item.path?.includes(stage));
  return ref || null;
}

function main() {
  const replay = read(REPLAY_PATH);
  const gpt = read(GPT_PATH);
  const gptByAtom = new Map((gpt.rows || []).map((row) => [row.atom_id, row]));
  const replayByAtom = new Map();
  for (const row of replay.rows || []) for (const atomId of row.atom_ids || []) replayByAtom.set(atomId, row);
  const targetAtoms = [
    'JY-001-P0-0013', 'JY-001-P0-0015', 'JY-001-P0-0016', 'JY-001-P0-0019', 'JY-001-P0-0020', 'JY-001-P0-0022',
    'TB-003-P0-0001', 'TB-003-P0-0006', 'TB-003-P0-0023', 'TB-003-P0-0024', 'TB-003-P0-0025', 'TB-006-P0-0014',
    'FAST-01-P0-0019', 'FAST-01-P0-0022', 'FAST-WATER-01-P0-0097'
  ];
  const rows = targetAtoms.map((atomId) => {
    const authority = gptByAtom.get(atomId) || {};
    const current = replayByAtom.get(atomId) || {};
    const inputEvidence = loadRef(refFor(current, 'PROVIDER_INPUT_SNAPSHOT'));
    const rawEvidence = loadRef(refFor(current, 'RAW_PROVIDER_RESPONSE_SNAPSHOT'));
    const normalizedEvidence = loadRef(refFor(current, 'NORMALIZED_CANDIDATE_SNAPSHOT'));
    const canonicalEvidence = loadRef(refFor(current, 'CANONICALIZATION_DECISION_SNAPSHOT'));
    const sourceEvidence = loadRef(refFor(current, 'SOURCE_RESOLUTION_SNAPSHOT'));
    const outputEvidence = loadRef(refFor(current, 'CANONICAL_OUTPUT_SNAPSHOT'));
    return {
      atom_id: atomId,
      tender_id: authority.tender_id || current.tender_id,
      frozen_semantic_label: authority.frozen_semantic_label || null,
      frozen_semantic_reason: authority.frozen_semantic_reason || null,
      source_truth: authority.source_truth || null,
      relevant_provider_input: {
        task_type: inputEvidence?.task_type || 'requirement_extraction',
        chunk_id: current.chunk_id || null,
        source_refs: inputEvidence?.source_refs || current.source_refs || [],
        input_sha256: inputEvidence?.input_sha256 || current.input_sha256 || null,
        input_length: inputEvidence?.input_length || current.input_length || null,
        excerpt: typeof inputEvidence?.model_text === 'string' ? inputEvidence.model_text.slice(0, 6000) : null
      },
      raw_provider_candidate: {
        status: current.status,
        candidate_count: current.candidate_count,
        candidates: normalizedEvidence?.candidates || null,
        response_content_present: Boolean(rawEvidence?.response_payload_json)
      },
      normalized_candidate: normalizedEvidence || null,
      canonicalization_decision: canonicalEvidence || null,
      source_resolution: sourceEvidence || null,
      canonical_output: outputEvidence || null,
      current_mechanical_divergence: {
        status: current.status,
        provider_http_status: current.provider_http_status,
        gateway_http_status: current.gateway_http_status,
        schema_pass: current.schema_pass,
        source_resolution_pass: current.source_resolution_pass,
        canonicalization_pass: current.canonicalization_pass,
        quality_gate_decision: current.quality_gate_decision,
        error_class: current.error_class
      },
      runtime_execution: {
        runtime_instruction_sha256: RUNTIME_INSTRUCTION_SHA256,
        provider: current.provider || null,
        requested_provider: current.requested_provider || null,
        model: current.model || null,
        requested_model: current.requested_model || null,
        response_model: current.response_model || null,
        endpoint: current.endpoint || null,
        provider_http_status: current.provider_http_status || null,
        gateway_http_status: current.gateway_http_status || null,
        finish_reason: current.finish_reason || null,
        duration_ms: current.duration_ms || null,
        retries: current.retries || 0,
        token_usage: {
          prompt_tokens: current.probe_audit?.prompt_tokens ?? null,
          completion_tokens: current.probe_audit?.completion_tokens ?? null,
          total_tokens: current.probe_audit?.total_tokens ?? null
        },
        generation_config: current.probe_audit?.generation_config || null,
        provider_chain_reached: current.provider_chain_reached === true
      },
      evidence_refs: current.restricted_evidence_refs || [],
      semantic_root_cause: 'PENDING_GPT'
    };
  });
  const packet = {
    artifact_type: 'V43_REQUIREMENT_V6_4_GPT_SEMANTIC_REVIEW_PACKET',
    artifact_version: 'v6.4',
    blind_for_semantic_root_cause: true,
    source_truth_sha256: '9337ecac323176ddcdf70a6012f522d24cc7d1930765290300bcc0d1d540cba0',
    replay_run_id: replay.run_id,
    target_case_count: rows.length,
    target_unique_chunk_count: replay.replay_chunk_count,
    provider_calls: replay.provider_calls,
    rows
  };
  fs.writeFileSync(OUT_PATH, `${JSON.stringify(packet, null, 2)}\n`, 'utf8');
  process.stdout.write(JSON.stringify({ packet: rel(OUT_PATH), case_count: rows.length, provider_calls: replay.provider_calls }) + '\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) main();

export { main };
