import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { getSemanticTaskContract, resolveSemanticTaskInstruction } from '../../../packages/semantic-contracts/index.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const OUT_DIR = path.join(ROOT, 'docs', 'eval', 'flywheel', 'p0-badcase-repair-v2');
const REPLAY_PATH = path.join(OUT_DIR, 'V43_REQUIREMENT_V6_4_TARGETED_REPLAY.json');
const GPT_PATH = path.join(ROOT, 'docs', 'handoff', 'V43_REQUIREMENT_V6_3_SEMANTIC_ADJUDICATION', '02_GPT_DECISION_PACKET.json');
const TRACE_PATH = path.join(OUT_DIR, 'V43_REQUIREMENT_V6_4_ROOT_CAUSE_TRACE.json');
const SOURCE_TRUTH_SHA = '9337ecac323176ddcdf70a6012f522d24cc7d1930765290300bcc0d1d540cba0';
const SHA = (value) => createHash('sha256').update(value).digest('hex');
const read = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));
const rel = (value) => path.relative(ROOT, value).replaceAll('\\', '/');
const targetActions = new Map([
  ['JY-001-P0-0013', 'INCLUDE_IN_GENERIC_PRODUCER_SCOPE_REPAIR'], ['JY-001-P0-0015', 'INCLUDE_IN_GENERIC_PRODUCER_SCOPE_REPAIR'],
  ['JY-001-P0-0016', 'INCLUDE_IN_GENERIC_PRODUCER_SCOPE_REPAIR'], ['JY-001-P0-0019', 'INCLUDE_IN_GENERIC_PRODUCER_SCOPE_REPAIR'],
  ['JY-001-P0-0020', 'INCLUDE_IN_GENERIC_PRODUCER_SCOPE_REPAIR'], ['JY-001-P0-0022', 'INCLUDE_IN_GENERIC_PRODUCER_SCOPE_REPAIR'],
  ['TB-003-P0-0001', 'INCLUDE_IN_GENERIC_PRODUCER_SCOPE_REPAIR'], ['TB-003-P0-0006', 'INCLUDE_IN_GENERIC_PRODUCER_SCOPE_REPAIR'],
  ['TB-003-P0-0023', 'INCLUDE_IN_GENERIC_PRODUCER_SCOPE_REPAIR'], ['TB-003-P0-0024', 'INCLUDE_IN_GENERIC_PRODUCER_SCOPE_REPAIR'],
  ['TB-003-P0-0025', 'INCLUDE_IN_GENERIC_PRODUCER_SCOPE_REPAIR'], ['TB-006-P0-0014', 'INCLUDE_IN_GENERIC_PRODUCER_SCOPE_REPAIR'],
  ['FAST-01-P0-0019', 'INCLUDE_IN_GENERIC_GOVERNING_CONTEXT_REPAIR'], ['FAST-01-P0-0022', 'INCLUDE_IN_GENERIC_TABLE_ROW_SCOPE_REPAIR'],
  ['FAST-WATER-01-P0-0097', 'INCLUDE_IN_GENERIC_PRODUCER_SCOPE_REPAIR']
]);

function main() {
  const replay = read(REPLAY_PATH);
  const gpt = read(GPT_PATH);
  const gptByAtom = new Map((gpt.rows || []).map((row) => [row.atom_id, row]));
  const replayByAtom = new Map();
  for (const row of replay.rows || []) for (const atomId of row.atom_ids || []) replayByAtom.set(atomId, row);
  const atoms = [...targetActions.keys()];
  const rows = atoms.map((atomId) => {
    const authority = gptByAtom.get(atomId) || {};
    const current = replayByAtom.get(atomId) || null;
    return {
      atom_id: atomId,
      tender_id: authority.tender_id || current?.tender_id || atomId.split('-P0-')[0],
      gpt_authority_action: targetActions.get(atomId),
      frozen_semantic_label: authority.frozen_semantic_label || null,
      frozen_semantic_reason: authority.frozen_semantic_reason || null,
      historical_mechanical_first_divergence: authority.current_mechanical_divergence || null,
      current_replay: current ? {
        run_id: current.run_id,
        chunk_id: current.chunk_id,
        replay_input_authority_level: current.replay_input_authority_level,
        input_sha256: current.input_sha256,
        source_ref_count: current.source_refs?.length || 0,
        source_hash_count: current.source_hashes?.length || 0,
        provider_chain_reached: current.provider_chain_reached,
        provider_http_status: current.provider_http_status,
        gateway_http_status: current.gateway_http_status,
        response_received: current.status === 'RESPONSE_RECEIVED',
        finish_reason: current.finish_reason,
        schema_pass: current.schema_pass,
        candidate_count: current.candidate_count,
        source_resolution_pass: current.source_resolution_pass,
        canonicalization_pass: current.canonicalization_pass,
        quality_gate_decision: current.quality_gate_decision,
        error_class: current.error_class,
        restricted_evidence_refs: current.restricted_evidence_refs
      } : { status: 'NOT_REPLAYED' },
      semantic_root_cause: 'PENDING_GPT'
    };
  });
  const trace = {
    artifact_type: 'V43_REQUIREMENT_V6_4_ROOT_CAUSE_TRACE',
    artifact_version: 'v6.4',
    source_truth_sha256: SOURCE_TRUTH_SHA,
    gpt_authority_artifact: rel(GPT_PATH),
    replay_artifact: rel(REPLAY_PATH),
    target_case_count: rows.length,
    targeted_unique_chunk_count: replay.replay_chunk_count,
    provider_calls: replay.provider_calls,
    retry_count: replay.retry_count,
    prompt_sha256: SHA(resolveSemanticTaskInstruction('requirement_extraction')),
    contract_version: getSemanticTaskContract('requirement_extraction').contract_version,
    contract_schema_sha256: SHA(JSON.stringify(getSemanticTaskContract('requirement_extraction').data_schema)),
    rows,
    evidence_only_case: {
      atom_id: 'JY-001-P0-0023',
      action: 'REEXPORT_EXISTING_EVIDENCE_ONLY_NO_PROVIDER_CALL',
      status: 'EXISTING_V6_3_EVIDENCE_RETAINED_NO_NEW_PROVIDER_CALL'
    },
    production_db_writes: 0,
    gold_mutations: 0,
    prompt_changes: 0,
    schema_changes: 0
  };
  fs.writeFileSync(TRACE_PATH, `${JSON.stringify(trace, null, 2)}\n`, 'utf8');
  process.stdout.write(JSON.stringify({ trace: rel(TRACE_PATH), target_case_count: rows.length, provider_calls: replay.provider_calls }) + '\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) main();

export { main };
