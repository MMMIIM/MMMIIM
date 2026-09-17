import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { loadBackendEnvironment } from '../../src/backend-runtime.js';
import { readSemanticGatewayRuntimeConfig } from '../../../packages/semantic-contracts/runtime-config.js';
import { getSemanticTaskContract, resolveSemanticTaskInstruction } from '../../../packages/semantic-contracts/index.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const CHECKPOINT = path.join(ROOT, 'docs/eval/flywheel/p0-badcase-repair-v2/V43_REQUIREMENT_V6_4_BOUNDED_PRODUCER_SCOPE_ALIGNMENT_CHECKPOINT.json');
const sha = value => createHash('sha256').update(String(value), 'utf8').digest('hex');

async function main() {
  const env = loadBackendEnvironment();
  const runtime = readSemanticGatewayRuntimeConfig(env);
  const localContract = getSemanticTaskContract('requirement_extraction');
  const localInstructionHash = sha(resolveSemanticTaskInstruction('requirement_extraction'));
  let info = null;
  try {
    const response = await fetch(`${String(runtime.gatewayApiBase).replace(/\/+$/u, '')}/info`);
    info = await response.json();
  } catch (error) {
    info = { fetch_error: error?.name || 'NETWORK_ERROR' };
  }
  const gatewayTask = info?.semantic_tasks?.requirement_extraction || {};
  const gatewayInstructionHash = info?.requirement_extraction_instruction_hash || gatewayTask.instruction_hash || info?.requirement_extraction_prompt_hash || null;
  const checkpoint = JSON.parse(fs.readFileSync(CHECKPOINT, 'utf8'));
  checkpoint.runtime_identity = {
    gateway_info_http_status: info?.fetch_error ? null : 200,
    gateway_build_revision: info?.build_revision || info?.commit || null,
    gateway_working_tree_dirty: info?.working_tree_dirty === true,
    gateway_requirement_contract_version: info?.requirement_extraction_contract_version || gatewayTask.contract_version || null,
    gateway_requirement_instruction_hash: gatewayInstructionHash,
    local_requirement_contract_version: localContract.contract_version,
    local_requirement_instruction_hash: localInstructionHash,
    instruction_hash_match: gatewayInstructionHash === localInstructionHash,
    gateway_fact_provider: info?.fact_provider || null,
    gateway_fact_model: info?.fact_model || null
  };
  checkpoint.runtime_identity_gate = checkpoint.runtime_identity.instruction_hash_match ? 'PASS' : 'BLOCKED_GATEWAY_RUNTIME_PROMPT_IDENTITY_MISMATCH';
  checkpoint.final_status = checkpoint.runtime_identity.instruction_hash_match
    ? 'READY_FOR_GPT_REQUIREMENT_V6_4_FINAL_ADJUDICATION'
    : 'BLOCKED_GATEWAY_RUNTIME_PROMPT_IDENTITY_MISMATCH';
  checkpoint.blockers = checkpoint.runtime_identity.instruction_hash_match ? [] : [
    'Gateway /info requirement instruction hash does not match the current local producer instruction after the minimal general repair; replay results are retained as evidence but cannot certify the repair until the current runtime is reloaded.'
  ];
  fs.writeFileSync(CHECKPOINT, `${JSON.stringify(checkpoint, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ final_status: checkpoint.final_status, runtime_identity_gate: checkpoint.runtime_identity_gate, local_requirement_instruction_hash: localInstructionHash, gateway_requirement_instruction_hash: gatewayInstructionHash }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) main();

export { main };
