import fs from 'node:fs';
import path from 'node:path';

const runId = process.argv[2];
if (!runId) throw new Error('RUN_ID_REQUIRED');
const root = path.resolve('backend/eval/rag-pilot/results', runId);
const checkpoint = JSON.parse(fs.readFileSync(path.join(root, 'checkpoint.json'), 'utf8'));
const rows = JSON.parse(fs.readFileSync(path.join(root, 'case-results.json'), 'utf8'));
const raw = JSON.parse(fs.readFileSync(path.join(root, 'raw-candidate-packet.json'), 'utf8'));
const canonical = JSON.parse(fs.readFileSync(path.join(root, 'canonicalization-packet.json'), 'utf8'));
const ledger = JSON.parse(fs.readFileSync(path.join(root, 'pre-dispatch-ledger.json'), 'utf8'));
const finalLedger = new Map();
for (const entry of ledger) finalLedger.set(entry.execution_id, entry);
const packet = {
  artifact_type: 'V43_FACT_CANDIDATE_V2_1_GPT_SEMANTIC_REVIEW_PACKET',
  eval_only: true,
  semantic_adjudication: 'PENDING_GPT',
  production_default: 'NO',
  run_id: runId,
  contract: checkpoint.contract,
  provider: checkpoint.provider,
  configured_model: checkpoint.configured_model,
  requested_model: checkpoint.requested_model,
  endpoint: checkpoint.endpoint,
  retries: checkpoint.retries,
  provider_calls: checkpoint.current_fresh_run_provider_calls,
  production_db_writes: checkpoint.production_db_writes,
  fact_persistence: checkpoint.fact_persistence,
  gold_mutations: checkpoint.gold_mutations,
  raw_provider_response_retained: false,
  raw_provider_response_note: 'The safe SemanticGatewayClient exposes parsed candidates and bounded audit metadata only; full HTTP response body is intentionally not retained.',
  executions: rows.map((row) => ({
    case_id: row.case_id,
    execution_id: row.execution_id,
    dispatch_state: finalLedger.get(row.execution_id)?.state || null,
    configured_provider: row.configured_provider,
    configured_model: row.configured_model,
    requested_model: row.requested_model,
    response_provider: row.response_provider,
    response_model: row.response_model,
    endpoint: row.endpoint,
    provider_audit: row.provider_audit,
    source_snapshot_id: row.source_snapshot_id,
    source_ref: row.source_ref,
    source_hash: row.source_hash,
    source_ref_resolution_rate: row.source_ref_resolution_rate,
    source_text_output_bytes: row.source_text_output_bytes,
    schema_status: row.status,
    candidate_nonempty: row.candidate_nonempty,
    fact_count: row.fact_count,
    raw_candidate: raw.cases.find((item) => item.case_id === row.case_id)?.raw_model_candidate_v2_1 || null,
    canonicalization: canonical.cases.find((item) => item.case_id === row.case_id)?.canonicalization || [],
    duration_ms: row.duration_ms,
    grounding: {
      accept: row.grounding_accept_count,
      review_required: row.grounding_review_count,
      reject: row.grounding_reject_count
    }
  }))
};
fs.writeFileSync(path.join(root, 'gpt-semantic-review-packet.json'), `${JSON.stringify(packet, null, 2)}\n`);
console.log(JSON.stringify({ run_id: runId, packet: path.join(root, 'gpt-semantic-review-packet.json'), executions: packet.executions.length, provider_calls: packet.provider_calls, raw_provider_response_retained: packet.raw_provider_response_retained }, null, 2));
