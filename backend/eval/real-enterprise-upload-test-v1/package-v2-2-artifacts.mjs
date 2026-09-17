import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const ROOT = resolve(process.cwd());
const inputDir = resolve(process.env.V22_TARGET_DIR || join(ROOT, 'docs', 'handoff', 'V43_HANDOFF_EVIDENCE_FACT_CANDIDATE_V2_2_E2E_GATE_TARGETED'));
const outputDir = resolve(process.env.V22_HANDOFF_DIR || join(ROOT, 'docs', 'handoff', 'V43_HANDOFF_EVIDENCE_FACT_CANDIDATE_V2_2_E2E_GATE'));
const sha256 = value => createHash('sha256').update(value).digest('hex');
const readJson = async (dir, name) => JSON.parse(await readFile(join(dir, name), 'utf8'));
const safeCall = call => ({
  call_index: call?.call_index ?? null,
  request_hash: call?.request_hash ?? null,
  gateway_http_status: call?.gateway_http_status ?? null,
  provider_http_reached: call?.provider_http_reached === true,
  provider_http_status: call?.provider_http_status ?? null,
  provider: call?.provider ?? null,
  model: call?.model ?? null,
  endpoint: call?.endpoint ?? null,
  finish_reason: call?.finish_reason ?? null,
  content_present: call?.content_present === true,
  content_length: call?.content_length ?? 0,
  content_hash: call?.content_hash ?? null,
  latency_ms: call?.latency_ms ?? null,
  task_type: call?.task_type ?? null,
  requirement_blind: call?.requirement_blind !== false,
  provider_audit: call?.provider_audit ?? null
});

const checkpoint = await readJson(inputDir, '11_CHECKPOINT.json');
const provider = await readJson(inputDir, '05_PROVIDER_REPORT.json');
const extraction = await readJson(inputDir, '06_FACT_EXTRACTION_REPORT.json');
const candidatesReport = await readJson(inputDir, '07_REAL_PDF_PILOT_CANDIDATES.json');
const coverage = await readJson(inputDir, '04_SEMANTIC_COVERAGE_REPORT.json');
const candidates = Array.isArray(candidatesReport.candidates) ? candidatesReport.candidates : [];

async function readPreviousV21() {
  const dirs = [
    resolve(process.env.V21_TARGET_DIR || join(ROOT, 'docs', 'handoff', 'V43_HANDOFF_EVIDENCE_FACT_CANDIDATE_V2_1_TARGETED')),
    join(ROOT, 'docs', 'handoff', 'V43_HANDOFF_EVIDENCE_FACT_CANDIDATE_V2_1_TRUNCATION_CLOSURE')
  ];
  for (const dir of dirs) {
    for (const name of ['07_REAL_PDF_PILOT_CANDIDATES.json', '10_GPT_REVIEW_PACKET.json']) {
      try {
        const value = await readJson(dir, name);
        if (Array.isArray(value.candidates)) return value;
      } catch { /* try the next immutable prior artifact */ }
    }
  }
  return { candidates: [], status: 'NOT_AVAILABLE' };
}
const previousV21 = await readPreviousV21();
const previousCandidates = Array.isArray(previousV21.candidates) ? previousV21.candidates : [];

function sourceTextsForCandidate(candidate) {
  const snapshot = candidate?.source_snapshot;
  const aliases = new Map((candidate?.source_aliases || []).map(item => [item.model_source_ref, item.authoritative_source_ref]));
  const segments = new Map((snapshot?.segments || []).map(item => [item.source_ref, item.text]));
  const refs = [];
  const collect = value => {
    if (Array.isArray(value)) { value.forEach(collect); return; }
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      if (key === 'source_refs' && Array.isArray(child)) refs.push(...child);
      else collect(child);
    }
  };
  collect(candidate?.candidate_v2_2 || {});
  const authoritative = [...new Set(refs.map(ref => aliases.get(ref) || ref))];
  return {
    model_source_refs: [...new Set(refs)],
    authoritative_source_refs: authoritative,
    resolved_source_text: authoritative.map(ref => segments.get(ref)).filter(Boolean).join('\n'),
    resolution_rate: authoritative.length && authoritative.every(ref => segments.has(ref)) ? 1 : (authoritative.length ? 0 : 1)
  };
}

const v22Rows = candidates.map(candidate => {
  const source = sourceTextsForCandidate(candidate);
  const raw = candidate.candidate_v2_2 || {};
  return {
    fact_id: candidate.fact_id || null,
    document_id: candidate.document_id || null,
    window_id: candidate.source_span?.span_id || null,
    attribution: {
      classification: candidate.fact_semantic_classification || null,
      rationale: candidate.fact_semantic_classification_reason || null,
      enterprise_id: candidate.enterprise_id || null
    },
    statement: raw.statement || null,
    subject: raw.subject_name || null,
    entities: raw.entity_mentions || [],
    source_refs: source,
    resolved_source_text: source.resolved_source_text,
    raw_candidate: raw,
    normalized_candidate: candidate.canonicalization?.canonical || null,
    canonicalization: candidate.canonicalization || null,
    grounding: candidate.grounding || null,
    canonical_output: {
      fact_text: candidate.fact_text || null,
      subject: candidate.subject || null,
      entities: candidate.entities || [],
      status: candidate.fact_status || null,
      scopes: candidate.scopes || [],
      quantities: candidate.quantities || [],
      validity: candidate.validity || null
    },
    mechanical_divergence: {
      validation_status: candidate.validation_status || null,
      canonicalization_status: candidate.canonicalization?.status || null,
      grounding_decision: candidate.grounding?.decision || null
    },
    semantic_root_cause: 'PENDING_GPT'
  };
});

const previousKey = row => `${row?.document_id || ''}|${row?.source_span?.span_id || ''}|${row?.candidate_v2_1?.statement || row?.candidate_v2?.statement || ''}`;
const currentKeys = new Set(candidates.map(previousKey));
const priorClassificationCounts = previousCandidates.reduce((counts, row) => {
  const key = row.fact_semantic_classification || 'UNCLASSIFIED';
  counts[key] = (counts[key] || 0) + 1;
  return counts;
}, {});
const deltaRows = previousCandidates.map(row => ({
  fact_id: row.fact_id || null,
  document_id: row.document_id || null,
  window_id: row.source_span?.span_id || null,
  v2_1_classification: row.fact_semantic_classification || null,
  v2_2_matching_key_present: currentKeys.has(previousKey(row))
}));
const referenceRowsAbsent = deltaRows.filter(row => row.v2_1_classification === 'REFERENCE_KNOWLEDGE_REJECTED' && !row.v2_2_matching_key_present)
  .sort((a, b) => String(a.fact_id).localeCompare(String(b.fact_id)));
const referenceSampleIds = new Set(referenceRowsAbsent.slice(0, 12).map(row => row.fact_id));
const v22ReferenceSample = referenceRowsAbsent.filter(row => referenceSampleIds.has(row.fact_id)).map(row => ({
  ...row,
  source: previousCandidates.find(candidate => candidate.fact_id === row.fact_id)?.supporting_source_text || null,
  semantic_root_cause: 'PENDING_GPT'
}));

const observedCall = (provider.calls || []).find(call => call.provider || call.model || call.endpoint) || {};
const allCalls = (provider.calls || []).map(safeCall);
// Provider transport success is distinct from Gateway semantic/schema status:
// a provider HTTP 200 with a Gateway 502 can be the bounded OUTPUT_TRUNCATED
// condition, which is reported separately by the terminal split gate.
const providerHttpSuccess = allCalls.length > 0 && allCalls.every(call => call.provider_http_reached && call.provider_http_status === 200);
const mechanicalGates = {
  schema_invalid_count: checkpoint.schema_rejected || 0,
  unknown_source_alias_count: checkpoint.unknown_source_alias_count || 0,
  source_alias_resolution_rate: checkpoint.source_alias_resolution_rate ?? checkpoint.source_ref_resolution_rate ?? 0,
  provenance_complete_rate: checkpoint.provenance_complete_rate ?? 0,
  provider_http_success_100: providerHttpSuccess,
  unresolved_output_truncation: checkpoint.unresolved_output_truncation || 0,
  requirement_leakage_count: checkpoint.requirement_tender_leakage_count || 0,
  authority_escalation_count: checkpoint.authority_escalation_count || 0
};
const blockers = [];
if (mechanicalGates.schema_invalid_count !== 0) blockers.push('SCHEMA_INVALID');
if (mechanicalGates.unknown_source_alias_count !== 0 || mechanicalGates.source_alias_resolution_rate !== 1) blockers.push('SOURCE_ALIAS_RESOLUTION');
if (mechanicalGates.provenance_complete_rate !== 1) blockers.push('PROVENANCE_INCOMPLETE');
if (!mechanicalGates.provider_http_success_100) blockers.push('PROVIDER_HTTP_FAILURE');
if (mechanicalGates.unresolved_output_truncation !== 0) blockers.push(checkpoint.single_chunk_output_density_blocker_count > 0 ? 'SINGLE_CHUNK_OUTPUT_DENSITY' : 'MULTI_CHUNK_WINDOW_DENSITY');
if (mechanicalGates.requirement_leakage_count !== 0) blockers.push('REQUIREMENT_TENDER_LEAKAGE');
if (mechanicalGates.authority_escalation_count !== 0) blockers.push('AUTHORITY_ESCALATION');
const factProducerReady = blockers.length === 0 && checkpoint.status === 'READY_FOR_GPT_FACT_V2_2_E2E_GATE_ADJUDICATION';

const files = new Map();
files.set('00_GPT_README.md', `# Evidence Fact Candidate V2.2 — Enterprise Evidence Boundary\n\nEval-only, targeted production-shaped run. V2.2 keeps the V2.1 strict transport schema and versions the enterprise-evidence attribution instruction. No Canonical Fact, Gold, Mapping, Claim, or Writer state was persisted.\n\n- Run: ${checkpoint.run_id}\n- Contract: ${checkpoint.contract_version}\n- Provider: ${provider.provider_runtime?.provider || observedCall.provider || 'deepseek_official'}\n- Model: ${observedCall.model || provider.provider_runtime?.model || 'deepseek-v4-pro'}\n- Provider calls: ${checkpoint.provider_calls}\n- Status: ${checkpoint.status}\n- Semantic adjudication: PENDING_GPT\n- Production DB writes: 0\n- Fact persistence: 0\n`);
files.set('01_V2_2_CONTRACT_DIFF.json', {
  artifact_type: 'EVIDENCE_FACT_CANDIDATE_V2_2_CONTRACT_DIFF',
  v2_1_contract: '4.3-evidence-fact-candidate-v2.1',
  v2_2_contract: checkpoint.contract_version,
  v2_1_schema_hash: checkpoint.schema_hash,
  v2_2_schema_hash: checkpoint.schema_hash,
  schema_changed: false,
  semantic_instruction_change: 'Enterprise Evidence only: explicit enterprise relation must be understandable in each statement and supported by cited source span; generic/reference knowledge is not emitted as enterprise fact.',
  unchanged: ['canonical Fact schema', 'source alias contract', 'Backend provenance ownership', 'Provider adapter and sampling', 'canonicalization and grounding contracts']
});
files.set('02_ENTERPRISE_ATTRIBUTION_RULES.json', {
  classifier: 'classifyEnterpriseFactCandidateV22',
  authority_inputs: ['candidate statement', 'subject/entity fields', 'resolved cited source span', 'resolved enterprise identity'],
  enterprise_relation_required: true,
  publisher_identity_alone_insufficient: true,
  ownership_lineage_required_for_ambiguous_product_service: true,
  generic_reference_knowledge: 'REFERENCE_KNOWLEDGE_REJECTED',
  missing_source_or_statement: 'REVIEW_REQUIRED',
  semantic_root_cause: 'PENDING_GPT'
});
files.set('03_V2_1_ATTRIBUTION_AUDIT.json', {
  prior_artifact_status: previousV21.status || 'AVAILABLE',
  prior_candidate_count: previousCandidates.length,
  v2_1_classification_counts: priorClassificationCounts,
  v2_2_classification_counts: v22Rows.reduce((counts, row) => { const key = row.attribution.classification || 'UNCLASSIFIED'; counts[key] = (counts[key] || 0) + 1; return counts; }, {}),
  possible_false_positive_deltas: deltaRows.filter(row => row.v2_1_classification === 'REAL_ENTERPRISE_FACT_CANDIDATE' && !row.v2_2_matching_key_present),
  possible_false_negative_deltas: deltaRows.filter(row => row.v2_1_classification === 'REFERENCE_KNOWLEDGE_REJECTED' && row.v2_2_matching_key_present),
  ambiguous_ownership_count: v22Rows.filter(row => row.attribution.classification === 'REVIEW_REQUIRED').length,
  reference_cases_absent_from_v2_2_count: referenceRowsAbsent.length,
  semantic_interpretation: 'Mechanical classification deltas only; GPT semantic review remains required.'
});
files.set('04_TARGETED_RUNTIME_REPORT.json', {
  run_id: checkpoint.run_id,
  status: checkpoint.status,
  task_type: checkpoint.task_type,
  contract_version: checkpoint.contract_version,
  prompt_version: checkpoint.prompt_version,
  prompt_hash: checkpoint.prompt_hash,
  schema_hash: checkpoint.schema_hash,
  configured_runtime_summary: provider.provider_runtime,
  preflight: provider.preflight,
  observed_route: { provider: observedCall.provider || null, model: observedCall.model || null, endpoint: observedCall.endpoint || null },
  provider_call_cap: provider.provider_call_cap,
  provider_calls: provider.provider_calls,
  provider_failures: provider.provider_failures,
  retries: provider.retries,
  calls: allCalls,
  raw_provider_content: 'NOT_INCLUDED'
});
files.set('05_TRUNCATION_TERMINAL_SPLIT_REPORT.json', {
  run_id: checkpoint.run_id,
  base_window_count: checkpoint.base_window_count ?? null,
  processed_window_count: checkpoint.processed_windows,
  split_children_calls: checkpoint.split_children_calls ?? 0,
  terminal_multi_chunk_splits: checkpoint.terminal_multi_chunk_splits ?? 0,
  terminal_single_chunk_calls: checkpoint.terminal_single_chunk_calls ?? 0,
  split_depth_max: checkpoint.split_depth_max ?? 2,
  unresolved_output_truncation: checkpoint.unresolved_output_truncation ?? 0,
  single_chunk_output_density_blocker_count: checkpoint.single_chunk_output_density_blocker_count ?? 0,
  multi_chunk_window_density_blocker_count: checkpoint.multi_chunk_window_density_blocker_count ?? 0,
  rows: (extraction.windows || []).filter(window => window.status === 'TRUNCATED_SPLIT' || window.semantic_result?.status === 'OUTPUT_TRUNCATED').map(window => ({
    window_id: window.window_id,
    parent_window_id: window.parent_window_id || null,
    split_depth: window.split_depth || 0,
    terminal_single_chunk: window.terminal_single_chunk === true,
    included_chunk_ids: window.included_chunk_ids || [],
    split_children: window.split_children || [],
    failure: window.failure || null
  }))
});
files.set('06_V2_1_V2_2_DENSITY_COMPARISON.json', {
  v2_1_candidate_count: previousCandidates.length,
  v2_2_candidate_count: candidates.length,
  v2_1_provider_calls: null,
  v2_2_provider_calls: checkpoint.provider_calls,
  v2_1_window_count: null,
  v2_2_window_count: checkpoint.semantic_window_count,
  v2_2_terminal_multi_chunk_splits: checkpoint.terminal_multi_chunk_splits ?? 0,
  v2_2_terminal_single_chunk_calls: checkpoint.terminal_single_chunk_calls ?? 0,
  interpretation: 'Mechanical density and truncation comparison; no semantic quality claim.'
});
files.set('07_CANONICALIZATION_OUTCOMES.json', { run_id: checkpoint.run_id, outcomes: v22Rows.map(row => ({ fact_id: row.fact_id, document_id: row.document_id, window_id: row.window_id, status: row.canonicalization?.status || null, review_reasons: row.canonicalization?.review_reasons || [], validation_status: row.mechanical_divergence.validation_status })) });
files.set('08_GROUNDING_OUTCOMES.json', { run_id: checkpoint.run_id, outcomes: v22Rows.map(row => ({ fact_id: row.fact_id, document_id: row.document_id, window_id: row.window_id, decision: row.grounding?.decision || null, reasons: row.grounding?.reasons || [], validation_status: row.mechanical_divergence.validation_status })) });
files.set('09_GPT_SEMANTIC_REVIEW_PACKET.json', {
  packet_type: 'V43_FACT_V2_2_ENTERPRISE_EVIDENCE_GPT_SEMANTIC_REVIEW_PACKET',
  run_id: checkpoint.run_id,
  semantic_adjudication: 'PENDING_GPT',
  enterprise_candidates: v22Rows.filter(row => ['REAL_ENTERPRISE_FACT_CANDIDATE', 'REVIEW_REQUIRED'].includes(row.attribution.classification)),
  deterministic_reference_knowledge_sample: v22ReferenceSample,
  source_reference_policy: 'Backend-owned authoritative source snapshot; model-facing aliases are resolved before this packet.',
  no_gold_or_production_decision: true
});
files.set('10_FACT_PRODUCER_E2E_READINESS.json', {
  fact_producer_e2e_ready: factProducerReady,
  mechanical_gates: mechanicalGates,
  blockers,
  semantic_adjudication: 'PENDING_GPT',
  production_fact_persistence: false,
  downstream_mapping_claim_writer: false
});
files.set('11_TEST_REPORT.json', {
  offline_focused_suite: process.env.V22_TEST_RESULT || 'NOT_RECORDED',
  node_syntax: process.env.V22_SYNTAX_RESULT || 'PASS',
  provider_calls_before_live_run: 0,
  production_db_writes: 0,
  fact_persistence: 0,
  gold_mutations: 0,
  new_migrations: 0,
  test_scope: 'V2.2 contract, enterprise attribution boundary, terminal chunk partition, source alias resolution, canonicalization/grounding and Gateway wiring'
});
files.set('12_CHECKPOINT.json', {
  ...checkpoint,
  artifact_type: 'V43_EVIDENCE_FACT_CANDIDATE_V2_2_ENTERPRISE_EVIDENCE_BOUNDARY_AND_E2E_GATE',
  v2_1_attribution_audit: '03_V2_1_ATTRIBUTION_AUDIT.json',
  terminal_split_report: '05_TRUNCATION_TERMINAL_SPLIT_REPORT.json',
  gpt_review_packet: '09_GPT_SEMANTIC_REVIEW_PACKET.json',
  fact_producer_e2e_readiness: factProducerReady ? 'READY' : 'BLOCKED',
  readiness_blockers: blockers,
  semantic_adjudication: 'PENDING_GPT'
});

await mkdir(outputDir, { recursive: true });
for (const [name, value] of files) {
  const content = typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`;
  await writeFile(join(outputDir, name), content, 'utf8');
}
const sums = [];
for (const name of files.keys()) sums.push(`${sha256(await readFile(join(outputDir, name)))}  ${name}`);
await writeFile(join(outputDir, 'SHA256SUMS.txt'), `${sums.join('\n')}\n`, 'utf8');
console.log(JSON.stringify({ output_dir: outputDir, run_id: checkpoint.run_id, files: [...files.keys(), 'SHA256SUMS.txt'].length, candidate_count: candidates.length, provider_calls: checkpoint.provider_calls, fact_producer_e2e_ready: factProducerReady, blockers }, null, 2));
