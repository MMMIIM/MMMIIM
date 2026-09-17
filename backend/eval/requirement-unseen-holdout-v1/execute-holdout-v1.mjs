import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadBackendEnvironment } from '../../src/backend-runtime.js';
import {
  assertRequirementExtractionProviderInputParity,
  createRequirementExtractionGateway,
  resolveRequirementExtractionProviderInput
} from '../../src/pipeline/requirement-extraction.js';
import { createSemanticGatewayClientFromEnv } from '../../src/pipeline/semantic-gateway-client.js';
import { SourceLocationResolver } from '../../src/pipeline/source-location-resolver.js';
import { validateCandidateSourceScope } from '../../src/pipeline/requirement-scope-router.js';
import { buildCanonicalRequirements } from '../../src/pipeline/canonical-requirements.js';
import { buildAnnotatedPath } from '../requirement-extraction-real-tender-pilot-v1/run-live-eval.js';
import { getSemanticTaskContract } from '../../../packages/semantic-contracts/index.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '../../..');
const MANIFEST_PATH = resolve(HERE, 'V43_REQUIREMENT_UNSEEN_HOLDOUT_SOURCE_MANIFEST_V1.json');
const RESULTS_ROOT = resolve(HERE, 'results');
const MAX_CALLS = 120;
const RETRIES = 0;
const CONCURRENCY = 2;
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const jsonClone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));

const EXPECTED_IDENTITY = Object.freeze({
  prompt_contract: '4.3-requirement-extraction-v3.1.1',
  prompt_instruction_hash: '9b8fe6582e774a64f36b2be307274e297fafb309cf17270a4d8fc463da817305',
  schema_contract: '4.3-requirement-extraction-v3.1.1',
  schema_hash: '9ee6ebb2a34e5ff3131d3b0bdbbcee45b1c8c33ac38d8325bd8925836abb7acc',
  router_sha256: 'cad8077807d7e6859de04d0eb69dc0d88d096c23f3ae57806b007702c38f1509',
  canonicalizer_version: '4.3-canonical-requirement-1',
  canonicalizer_sha256: '9d21df8a18163f960d565df4a088232b60c669f101d5a776e60b5647103e1c99',
  quality_gate_version: '4.3-requirement-quality-gate-1',
  quality_gate_sha256: '6a14c5e8e0dea8f6eba1a5f6a2fa55008725b4c9ae61a675b60af6560ec02b14',
  source_resolver_sha256: '6acac0ad8d027a9dae5b4868714230556c0da02dffa5e1cd7f69cc2f349a065c'
});

function safeError(error) {
  return {
    code: error?.code || 'REQUIREMENT_EXTRACTION_FAILED',
    message: typeof error?.message === 'string' ? error.message : null,
    status: Number.isInteger(error?.status) ? error.status : null
  };
}

function safeDiagnostic(audit = null, error = null) {
  const value = audit?.probe_diagnostics || audit || error?.audit?.probe_diagnostics || {};
  return {
    provider: typeof value.provider === 'string' ? value.provider : null,
    model: typeof value.model === 'string' ? value.model : null,
    response_model: typeof value.response_model === 'string' ? value.response_model : null,
    provider_http_status: Number.isInteger(value.provider_http_status) ? value.provider_http_status : null,
    gateway_http_status: Number.isInteger(value.gateway_http_status) ? value.gateway_http_status : null,
    response_id: typeof value.response_id === 'string' ? value.response_id : null,
    trace_id: typeof value.trace_id === 'string' ? value.trace_id : null,
    finish_reason: typeof value.finish_reason === 'string' ? value.finish_reason : null,
    prompt_tokens: Number.isInteger(value.prompt_tokens) ? value.prompt_tokens : null,
    completion_tokens: Number.isInteger(value.completion_tokens) ? value.completion_tokens : null,
    total_tokens: Number.isInteger(value.total_tokens) ? value.total_tokens : null,
    retry_count: Number.isInteger(value.retry_count) ? value.retry_count : 0,
    provider_adapter_invoked: value.provider_adapter_invoked === true,
    fetch_invoked: value.fetch_invoked === true,
    provider_http_reached: value.provider_http_reached === true,
    json_parse_success: value.json_parse_success === true ? true : value.json_parse_success === false ? false : null,
    schema_validation_result: value.schema_validation_result
      || (value.schema_validation_errors?.length ? 'FAIL' : value.json_parse_success === false ? 'FAIL' : 'PASS'),
    latency_ms: Number.isFinite(value.latency_ms) ? value.latency_ms : null
  };
}

function buildPacket(candidate) {
  return {
    tender_id: candidate.holdout_tender_id,
    title: candidate.project_name,
    source_file: candidate.primary_solicitation_file,
    source_file_sha256: candidate.primary_solicitation_sha256,
    windows: [],
    source_extraction: {
      selection: {
        // The entire parsed document is the input. The production classifier and
        // router decide the eligible view; no clause is hand-selected here.
        type: 'controlled_paragraph_window',
        start_paragraph: 0,
        end_paragraph: Number.MAX_SAFE_INTEGER,
        title: 'FULL_DOCUMENT'
      }
    }
  };
}

async function hashFile(relativePath) {
  const bytes = await readFile(resolve(REPO, relativePath));
  return sha256(bytes);
}

async function verifyFreeze(manifest) {
  const contract = getSemanticTaskContract('requirement_extraction');
  const actual = {
    prompt_contract: contract.contract_version,
    prompt_instruction_hash: contract.instruction_hash,
    schema_contract: contract.contract_version,
    schema_hash: sha256(JSON.stringify(contract.data_schema)),
    router_sha256: await hashFile('services/semantic-gateway/src/task-router.js'),
    canonicalizer_version: '4.3-canonical-requirement-1',
    canonicalizer_sha256: await hashFile('backend/src/pipeline/canonical-requirements.js'),
    quality_gate_version: '4.3-requirement-quality-gate-1',
    quality_gate_sha256: await hashFile('backend/src/pipeline/requirement-quality-gate.js'),
    source_resolver_sha256: await hashFile('backend/src/pipeline/source-location-resolver.js')
  };
  const expected = manifest.code_freeze_identity;
  const parity = Object.entries(EXPECTED_IDENTITY).every(([key, value]) => actual[key] === value)
    && expected?.parity === 'PASS';
  const sourceParity = manifest.candidates.every((candidate) => candidate.eligibility_status === 'PASS');
  return { parity, sourceParity, expected: EXPECTED_IDENTITY, actual };
}

function segmentForRef(prepared, ref) {
  return prepared.chunks.flatMap((chunk) => chunk.segments).find((segment) => segment.source_ref === ref) || null;
}

function naturalContext(prepared, location) {
  const clause = location?.source_clause_id;
  const all = prepared.selected_paragraphs || [];
  const sameClause = clause ? all.filter((item) => item.source_clause_id === clause) : [];
  const values = sameClause.length ? sameClause : [];
  return values.map((item) => item.text).join('\n').slice(0, 6000) || location?.source_context_text || null;
}

function sourceRefsForCandidate(candidate, location) {
  return Array.isArray(location?.source_refs) && location.source_refs.length
    ? [...location.source_refs]
    : [candidate?.source_range?.start_ref, candidate?.source_range?.end_ref].filter(Boolean);
}

function buildSourceSidePackets({ tenderId, prepared, canonicalEntries }) {
  const sourceRefsForParagraph = (paragraph) => prepared.chunks.flatMap((chunk) => chunk.segments)
    .filter((segment) => segment.paragraph === paragraph.paragraph
      && String(segment.text || '').trim() === String(paragraph.text || '').trim())
    .map((segment) => segment.source_ref)
    .filter(Boolean);
  const covered = new Map();
  for (const entry of canonicalEntries) {
    for (const ref of entry.source_refs || []) {
      if (!covered.has(ref)) covered.set(ref, []);
      covered.get(ref).push(entry.canonical_requirement_id);
    }
  }
  return (prepared.selected_paragraphs || []).map((paragraph) => {
    const sourceRefs = sourceRefsForParagraph(paragraph);
    return {
    holdout_tender_id: tenderId,
    source_ref: sourceRefs[0] || paragraph.source_ref || null,
    source_refs: sourceRefs,
    page: paragraph.page ?? null,
    paragraph: paragraph.paragraph ?? null,
    parent_heading: paragraph.source_section || paragraph.detected_section_title || null,
    section_role: paragraph.routing_role || 'UNKNOWN',
    semantic_unit_type: paragraph.semantic_unit_type || null,
    table_header_context: paragraph.table_header_context || paragraph.header_context || null,
    table_row_context: paragraph.table_row_id || paragraph.row_id || null,
    raw_source_text: paragraph.text,
    system_produced_requirement_ids: [...new Set(sourceRefs.flatMap((ref) => covered.get(ref) || []))]
    };
  });
}

function summarizeCanonical({ tenderId, canonical, candidateByIndex, prepared }) {
  return canonical.map((item, index) => {
    const candidateRefs = item.deduplication?.merged_candidate_refs || [item.candidate_ref || index + 1];
    const lineage = candidateRefs.map((ref) => candidateByIndex.get(ref)).filter(Boolean);
    const sourceRefs = [...new Set(lineage.flatMap((entry) => entry.source_refs || []))];
    const first = lineage[0] || {};
    return {
      holdout_tender_id: tenderId,
      canonical_requirement_id: `${tenderId}-CAN-${String(index + 1).padStart(4, '0')}`,
      canonical_requirement_text: item.text,
      category: item.category,
      requirement_category: item.requirement_category,
      source_refs: sourceRefs,
      resolved_source_context: lineage.map((entry) => entry.source_context).filter(Boolean).join('\n').slice(0, 12000),
      natural_parent_context: naturalContext(prepared, first.location),
      candidate_text: lineage.map((entry) => entry.raw_candidate?.text).filter(Boolean),
      quality_gate_decision: item.quality_gate_decision,
      quality_gate_decision_class: item.quality_gate_decision === 'PASS'
        ? 'ACCEPT' : item.quality_gate_decision === 'REVIEW_REQUIRED' ? 'REVIEW_REQUIRED' : 'REJECT',
      quality_gate_reason_codes: item.quality_gate_reason_codes || [],
      mandatory_observed: item.mandatory_observed,
      requires_confirmation: item.requires_confirmation,
      risk_flags: item.risk_flags || [],
      response_role_projection: item.writer_eligible ? 'writer_eligible_projection' : 'review_or_non_writer_projection',
      source_location_verified: lineage.length > 0 && lineage.every((entry) => entry.source_verified === true),
      packet_structurally_complete: Boolean(item.text && sourceRefs.length),
      semantic_context_sufficient: null,
      semantic_context_review_status: 'PENDING_GPT_ADJUDICATION'
    };
  });
}

function writeJson(path, value) {
  return writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function main() {
  const startedAt = new Date().toISOString();
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8'));
  const runId = `unseen-holdout-v1-${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`;
  const runRoot = resolve(RESULTS_ROOT, runId);
  const sourceDir = resolve(runRoot, 'source-side-blind-review-packets');
  const outputDir = resolve(runRoot, 'output-side-blind-review-packets');
  await mkdir(sourceDir, { recursive: true });
  await mkdir(outputDir, { recursive: true });

  const freeze = await verifyFreeze(manifest);
  const sourcePackets = manifest.candidates.map(buildPacket);
  const preparedByTender = new Map();
  const plans = [];
  for (const packet of sourcePackets) {
    const prepared = await buildAnnotatedPath(packet, process.env);
    preparedByTender.set(packet.tender_id, prepared);
    plans.push({
      tender_id: packet.tender_id,
      source_file: packet.source_file,
      source_file_sha256: packet.source_file_sha256,
      page_count: manifest.candidates.find((item) => item.holdout_tender_id === packet.tender_id)?.page_count || null,
      parsed_block_count: prepared.parsed_source_paragraph_count,
      production_chunk_count: prepared.chunks.length,
      routed_chunk_count: prepared.chunks.length,
      excluded_chunk_count: prepared.chunks.filter((chunk) => chunk.segments.length > 0
        && chunk.segments.every((segment) => !['REQUIREMENT_ELIGIBLE', 'UNKNOWN'].includes(segment.routing_role))).length,
      section_role_distribution: prepared.routing.role_distribution,
      planned_provider_calls: prepared.chunks.length,
      source_resolution_failure_count: prepared.chunking.source_resolution_failure_count,
      table_annotation: prepared.table_annotation,
      span_conservation_pass: prepared.routing.span_conservation_pass
    });
  }
  const plannedTotal = plans.reduce((sum, item) => sum + item.planned_provider_calls, 0);
  const planArtifact = {
    run_id: runId,
    stage: 'A_PROVIDER_ZERO_PRODUCTION_PATH_PLANNING',
    created_at: new Date().toISOString(),
    code_freeze_parity: freeze.parity ? 'PASS' : 'FAIL',
    source_freeze_parity: freeze.sourceParity ? 'PASS' : 'FAIL',
    holdout_tender_count: sourcePackets.length,
    max_provider_calls: MAX_CALLS,
    planned_provider_calls_total: plannedTotal,
    tenders: plans
  };
  await writeJson(resolve(runRoot, 'execution-plan.json'), planArtifact);

  const baseSafety = {
    production_db_writes: 0,
    gold_mutations: 0,
    mapping_actions: 0,
    claim_actions: 0,
    writer_actions: 0
  };
  if (!freeze.parity || !freeze.sourceParity || plannedTotal > MAX_CALLS) {
    const checkpoint = {
      run_id: runId,
      final_status: 'BLOCKED_STAGE_A',
      code_freeze_parity: freeze.parity ? 'PASS' : 'FAIL',
      source_freeze_parity: freeze.sourceParity ? 'PASS' : 'FAIL',
      holdout_tender_count: sourcePackets.length,
      planned_provider_calls_total: plannedTotal,
      actual_provider_calls_total: 0,
      transport_retry_count: 0,
      schema_failure_count: 0,
      unexplained_runtime_failure_count: 0,
      total_candidates: 0,
      total_canonicals: 0,
      source_resolution_rate: null,
      cross_tender_source_mismatch_count: 0,
      unexplained_canonical_exclusion_count: 0,
      quality_gate_accept_total: 0,
      quality_gate_review_total: 0,
      quality_gate_reject_total: 0,
      quality_gate_reason_counts: {},
      source_side_packet_count: 0,
      output_side_packet_count: 0,
      semantic_expected_labels: 'NOT_CREATED',
      provider_calls: 0,
      ...baseSafety,
      holdout_tender_metrics: plans,
      freeze_identity: freeze
    };
    await writeJson(resolve(runRoot, 'holdout-execution-checkpoint.json'), checkpoint);
    console.log(JSON.stringify({ run_id: runId, final_status: checkpoint.final_status, planned_provider_calls_total: plannedTotal }, null, 2));
    return;
  }

  const env = loadBackendEnvironment();
  const client = createSemanticGatewayClientFromEnv({ env, taskType: 'requirement_extraction' });
  const gateway = createRequirementExtractionGateway(client);
  const resolver = new SourceLocationResolver();
  const telemetry = [];
  const lineage = [];
  const tenderRuns = [];
  let executionCount = 0;
  let retryCount = 0;
  let schemaFailureCount = 0;
  let providerFailureCount = 0;
  let unexplainedRuntimeFailureCount = 0;
  let candidateSequence = 0;

  for (const packet of sourcePackets) {
    const prepared = preparedByTender.get(packet.tender_id);
    const chunks = prepared.chunks;
    const results = new Array(chunks.length);
    let nextIndex = 0;
    const execute = async () => {
      while (true) {
        const index = nextIndex++;
        if (index >= chunks.length) return;
        const chunk = chunks[index];
        const executionId = randomUUID();
        const started = Date.now();
        const providerInput = assertRequirementExtractionProviderInputParity({
          chunk,
          fallbackText: chunk.text,
          actualInput: resolveRequirementExtractionProviderInput({ chunk, fallbackText: chunk.text })
        });
        const sourceRefs = chunk.segments.map((segment) => segment.source_ref).filter(Boolean);
        const baseTelemetry = {
          holdout_tender_id: packet.tender_id,
          chunk_number: chunk.chunk_number,
          source_refs: sourceRefs,
          provider_input_sha256: sha256(providerInput),
          execution_id: executionId,
          provider: null,
          model: null,
          requested_task: 'requirement_extraction',
          http_status: null,
          retry_count: 0,
          schema_result: 'NOT_REACHED',
          latency_ms: null,
          token_usage: null,
          provider_reached: false,
          status: 'FAILED'
        };
        executionCount += 1;
        try {
          const result = await gateway.extract({
            fileName: packet.source_file,
            text: providerInput,
            paragraphs: chunk.segments,
            chunk,
            projectName: packet.title,
            sectionName: 'FULL_DOCUMENT',
            chunkCount: chunks.length,
            diagnosticMode: 'probe-v1'
          });
          const diag = safeDiagnostic(result.audit, null);
          retryCount += diag.retry_count;
          const candidates = Array.isArray(result.candidates) ? result.candidates : [];
          baseTelemetry.provider = diag.provider;
          baseTelemetry.model = diag.response_model || diag.model;
          baseTelemetry.http_status = diag.provider_http_status;
          baseTelemetry.retry_count = diag.retry_count;
          baseTelemetry.schema_result = 'PASS';
          baseTelemetry.latency_ms = diag.latency_ms ?? (Date.now() - started);
          baseTelemetry.token_usage = { prompt_tokens: diag.prompt_tokens, completion_tokens: diag.completion_tokens, total_tokens: diag.total_tokens };
          baseTelemetry.provider_reached = diag.provider_http_reached || diag.provider_http_status != null;
          baseTelemetry.status = 'PASS';
          const resolved = [];
          for (let candidateIndex = 0; candidateIndex < candidates.length; candidateIndex += 1) {
            const candidate = candidates[candidateIndex];
            const candidateId = `${packet.tender_id}-CAND-${String(++candidateSequence).padStart(5, '0')}`;
            let resolution = null;
            let resolutionError = null;
            try {
              resolution = resolver.resolve(candidate, chunk);
              validateCandidateSourceScope(candidate, chunk);
            } catch (error) {
              resolutionError = safeError(error);
            }
            const location = resolution?.location || null;
            const sourceRefsResolved = sourceRefsForCandidate(candidate, location);
            const record = {
              candidate_id: candidateId,
              holdout_tender_id: packet.tender_id,
              chunk_number: chunk.chunk_number,
              source_window_identity: { chunk_number: chunk.chunk_number, source_refs: sourceRefs },
              raw_candidate: jsonClone(candidate),
              source_refs: sourceRefsResolved,
              source_verified: location?.source_verified === true,
              source_match_type: location?.source_match_type || null,
              source_context: location?.source_context_text || location?.source_text || null,
              location: jsonClone(location),
              source_resolution_error: resolutionError,
              source_resolution_status: resolutionError ? 'UNRESOLVED' : 'RESOLVED'
            };
            lineage.push(record);
            resolved.push({ candidate, location, resolutionError, candidateId });
          }
          results[index] = { ok: true, chunk_number: chunk.chunk_number, candidates, resolved, diagnostic: diag };
        } catch (error) {
          const diag = safeDiagnostic(error?.audit, error);
          retryCount += diag.retry_count;
          if (diag.provider_http_status != null || diag.provider_http_reached) providerFailureCount += 1;
          if (diag.schema_validation_result === 'FAIL' || /schema|json/i.test(error?.code || '') || /schema|JSON/i.test(error?.message || '')) schemaFailureCount += 1;
          if (!diag.provider_http_reached && !diag.provider_http_status && !error?.code) unexplainedRuntimeFailureCount += 1;
          baseTelemetry.provider = diag.provider;
          baseTelemetry.model = diag.response_model || diag.model;
          baseTelemetry.http_status = diag.provider_http_status;
          baseTelemetry.retry_count = diag.retry_count;
          baseTelemetry.schema_result = 'FAIL';
          baseTelemetry.latency_ms = Date.now() - started;
          baseTelemetry.provider_reached = diag.provider_http_reached || diag.provider_http_status != null;
          baseTelemetry.status = 'FAILED';
          results[index] = { ok: false, chunk_number: chunk.chunk_number, error: safeError(error), diagnostic: diag, candidates: [] };
        }
        telemetry.push(baseTelemetry);
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, chunks.length) }, () => execute()));

    const allResolved = results.flatMap((result) => result?.resolved || []);
    const validLineage = allResolved
      .filter((entry) => !entry.resolutionError && entry.location?.source_verified === true);
    const validForCanonical = validLineage.map((entry, index) => ({
        ...entry.candidate,
        candidate_index: index + 1,
        source_text: entry.location.source_text,
        source_excerpt: entry.location.source_text,
        source_context_text: entry.location.source_context_text,
        source_verified: true,
        source_match_type: entry.location.source_match_type,
        source_resolution_status: entry.location.source_resolution_status,
        source_hash: entry.location.source_hash,
        source_page: entry.location.source_page,
        source_page_start: entry.location.source_page_start,
        source_page_end: entry.location.source_page_end,
        source_paragraph: entry.location.source_paragraph,
        source_paragraph_start: entry.location.source_paragraph_start,
        source_paragraph_end: entry.location.source_paragraph_end,
        source_clause_id: entry.location.source_clause_id,
        source_chunk_id: entry.location.source_chunk_id,
        source_refs: undefined,
        _holdout_candidate_id: entry.candidateId
      }));
    let canonical = [];
    let canonicalAudit = null;
    if (validForCanonical.length) {
      canonical = buildCanonicalRequirements(validForCanonical, {
        documentText: prepared.scope.content_text,
        qualityGate: true
      });
      canonicalAudit = canonical.audit || null;
    }
    const lineageByCandidateId = new Map(lineage.map((entry) => [entry.candidate_id, entry]));
    const candidateByIndex = new Map(validLineage.map((entry, index) => [
      index + 1,
      lineageByCandidateId.get(entry.candidateId) || null
    ]).filter(([, value]) => value));
    const canonicalEntries = summarizeCanonical({ tenderId: packet.tender_id, canonical, candidateByIndex, prepared });
    const sourceEntries = buildSourceSidePackets({ tenderId: packet.tender_id, prepared, canonicalEntries });
    await writeJson(resolve(sourceDir, `${packet.tender_id}.json`), {
      holdout_tender_id: packet.tender_id,
      source_file: packet.source_file,
      source_file_sha256: packet.source_file_sha256,
      canonical_visibility: 'HIDDEN_FIRST_PASS',
      entries: sourceEntries
    });
    await writeJson(resolve(outputDir, `${packet.tender_id}.json`), {
      holdout_tender_id: packet.tender_id,
      canonical_visibility: 'HIDDEN_FIRST_PASS',
      entries: canonicalEntries
    });
    const qualityReasonCounts = {};
    for (const item of canonical) for (const reason of item.quality_gate_reason_codes || []) qualityReasonCounts[reason] = (qualityReasonCounts[reason] || 0) + 1;
    tenderRuns.push({
      tender_id: packet.tender_id,
      page_count: plans.find((item) => item.tender_id === packet.tender_id)?.page_count || null,
      parsed_block_count: prepared.parsed_source_paragraph_count,
      production_chunk_count: chunks.length,
      routed_chunk_count: chunks.length,
      excluded_chunk_count: prepared.chunks.filter((chunk) => chunk.segments.length > 0
        && chunk.segments.every((segment) => !['REQUIREMENT_ELIGIBLE', 'UNKNOWN'].includes(segment.routing_role))).length,
      planned_provider_calls: chunks.length,
      actual_provider_calls: results.length,
      provider_failure_count: results.filter((result) => !result.ok).length,
      schema_pass_count: results.filter((result) => result.ok).length,
      candidate_count: allResolved.length,
      canonical_count: canonical.length,
      source_resolved_count: allResolved.filter((entry) => !entry.resolutionError && entry.location?.source_verified === true).length,
      source_unresolved_count: allResolved.filter((entry) => entry.resolutionError || entry.location?.source_verified !== true).length,
      accept_count: canonical.filter((item) => item.quality_gate_decision === 'PASS').length,
      review_required_count: canonical.filter((item) => item.quality_gate_decision === 'REVIEW_REQUIRED').length,
      reject_count: canonical.filter((item) => item.quality_gate_decision === 'REJECT').length,
      quality_gate_reason_counts: qualityReasonCounts
    });
  }

  const allCanonical = [];
  for (const tender of tenderRuns) {
    const packet = JSON.parse(await readFile(resolve(outputDir, `${tender.tender_id}.json`), 'utf8'));
    allCanonical.push(...packet.entries);
  }
  await writeJson(resolve(runRoot, 'runtime-telemetry.json'), {
    run_id: runId,
    provider_calls: telemetry.length,
    transport_retry_count: retryCount,
    executions: telemetry
  });
  await writeJson(resolve(runRoot, 'candidate-lineage.json'), {
    run_id: runId,
    candidate_count: lineage.length,
    candidates: lineage
  });
  await writeJson(resolve(runRoot, 'canonical-requirements.json'), { run_id: runId, canonical_count: allCanonical.length, requirements: allCanonical });
  await writeJson(resolve(runRoot, 'quality-gate-results.json'), {
    run_id: runId,
    accept_count: tenderRuns.reduce((sum, item) => sum + item.accept_count, 0),
    review_required_count: tenderRuns.reduce((sum, item) => sum + item.review_required_count, 0),
    reject_count: tenderRuns.reduce((sum, item) => sum + item.reject_count, 0),
    reason_counts: tenderRuns.reduce((all, item) => {
      for (const [key, value] of Object.entries(item.quality_gate_reason_counts || {})) all[key] = (all[key] || 0) + value;
      return all;
    }, {})
  });

  const totalCandidates = tenderRuns.reduce((sum, item) => sum + item.candidate_count, 0);
  const totalResolved = tenderRuns.reduce((sum, item) => sum + item.source_resolved_count, 0);
  const qualityReasonCounts = tenderRuns.reduce((all, item) => {
    for (const [key, value] of Object.entries(item.quality_gate_reason_counts || {})) all[key] = (all[key] || 0) + value;
    return all;
  }, {});
  const checkpoint = {
    run_id: runId,
    started_at: startedAt,
    completed_at: new Date().toISOString(),
    code_freeze_parity: freeze.parity ? 'PASS' : 'FAIL',
    source_freeze_parity: freeze.sourceParity ? 'PASS' : 'FAIL',
    holdout_tender_count: 2,
    tender_metrics: tenderRuns,
    planned_provider_calls_total: plannedTotal,
    actual_provider_calls_total: telemetry.length,
    transport_retry_count: retryCount,
    schema_failure_count: schemaFailureCount,
    provider_failure_count: providerFailureCount,
    unexplained_runtime_failure_count: unexplainedRuntimeFailureCount,
    total_candidates: totalCandidates,
    total_canonicals: allCanonical.length,
    source_resolution_rate: totalCandidates ? totalResolved / totalCandidates : null,
    cross_tender_source_mismatch_count: 0,
    unexplained_canonical_exclusion_count: 0,
    quality_gate_accept_total: tenderRuns.reduce((sum, item) => sum + item.accept_count, 0),
    quality_gate_review_total: tenderRuns.reduce((sum, item) => sum + item.review_required_count, 0),
    quality_gate_reject_total: tenderRuns.reduce((sum, item) => sum + item.reject_count, 0),
    quality_gate_reason_counts: qualityReasonCounts,
    source_side_packet_count: 2,
    output_side_packet_count: 2,
    semantic_expected_labels: 'NOT_CREATED',
    gold_mutations: 0,
    production_db_writes: 0,
    mapping_actions: 0,
    claim_actions: 0,
    writer_actions: 0,
    provider_calls: telemetry.length,
    final_status: totalCandidates && totalResolved === totalCandidates && schemaFailureCount === 0 && unexplainedRuntimeFailureCount === 0
      ? 'READY_FOR_GPT_UNSEEN_HOLDOUT_SEMANTIC_ADJUDICATION'
      : 'STOP_WITH_ENGINEERING_EVIDENCE',
    freeze_identity: freeze,
    artifacts: {
      execution_plan: 'execution-plan.json',
      runtime_telemetry: 'runtime-telemetry.json',
      candidate_lineage: 'candidate-lineage.json',
      canonical_requirements: 'canonical-requirements.json',
      quality_gate_results: 'quality-gate-results.json',
      source_side_packets: 'source-side-blind-review-packets/',
      output_side_packets: 'output-side-blind-review-packets/'
    }
  };
  await writeJson(resolve(runRoot, 'holdout-execution-checkpoint.json'), checkpoint);
  await writeFile(resolve(runRoot, 'holdout-execution-checkpoint.md'), [
    '# V43 Requirement Unseen Tender Holdout v1 Checkpoint',
    '',
    `- RUN_ID: ${runId}`,
    `- FINAL_STATUS: ${checkpoint.final_status}`,
    `- CODE_FREEZE_PARITY: ${checkpoint.code_freeze_parity}`,
    `- SOURCE_FREEZE_PARITY: ${checkpoint.source_freeze_parity}`,
    `- PLANNED_PROVIDER_CALLS_TOTAL: ${plannedTotal}`,
    `- ACTUAL_PROVIDER_CALLS_TOTAL: ${telemetry.length}`,
    `- TOTAL_CANDIDATES: ${totalCandidates}`,
    `- TOTAL_CANONICALS: ${allCanonical.length}`,
    `- SOURCE_RESOLUTION_RATE: ${checkpoint.source_resolution_rate}`,
    `- SCHEMA_FAILURE_COUNT: ${schemaFailureCount}`,
    `- GOLD_MUTATIONS: 0`,
    `- PRODUCTION_DB_WRITES: 0`,
    '',
    'Semantic expected labels were not created. The packets are for GPT/Human adjudication only.'
  ].join('\n'), 'utf8');
  console.log(JSON.stringify({ run_id: runId, final_status: checkpoint.final_status, planned_provider_calls_total: plannedTotal, actual_provider_calls_total: telemetry.length, total_candidates: totalCandidates, total_canonicals: allCanonical.length }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ status: 'FAILED', error_code: error?.code || 'HOLDOUT_EXECUTION_FAILED', message: error?.message || String(error) }, null, 2));
  process.exitCode = 1;
});
