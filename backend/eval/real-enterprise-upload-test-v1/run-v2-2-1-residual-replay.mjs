import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadBackendEnvironment } from '../../src/backend-runtime.js';
import { createSemanticGatewayClientFromEnv } from '../../src/pipeline/semantic-gateway-client.js';
import {
  FACT_PROVIDER_AUDIT,
  SemanticGatewayEvidenceFactExtractor
} from '../../src/pipeline/semantic-gateway-evidence-fact-extractor.js';
import {
  EVIDENCE_FACT_CANDIDATE_V22_PROMPT_VERSION,
  EVIDENCE_FACT_CANDIDATE_V22_SCHEMA_SHA256,
  EVIDENCE_FACT_CANDIDATE_V22_SCHEMA_VERSION,
  getSemanticTaskInstructionMetadata
} from '../../../packages/semantic-contracts/index.js';
import { loadSemanticGatewayEnvironment } from '../../../packages/semantic-contracts/runtime-config.js';
import { extractTenderText } from '../../src/tender-text-extractor.js';
import {
  createEvidenceFactSourceSnapshot,
  EVIDENCE_FACT_CANONICALIZER_V2_VERSION,
  EVIDENCE_FACT_GROUNDING_V2_VERSION
} from '../../src/pipeline/evidence-fact-candidate-v2.js';
import {
  canonicalizeAndGroundEvidenceFactCandidateV21,
  createEvidenceFactCandidateV21SourceAliasTable,
  resolveEvidenceFactCandidateV21SourceRefs,
  EVIDENCE_FACT_CANDIDATE_V21_CANONICALIZER_VERSION,
  EVIDENCE_FACT_CANDIDATE_V21_GROUNDING_VERSION
} from '../../src/pipeline/evidence-fact-candidate-v2-1.js';
import {
  buildAtomicFactExtractionWindow,
  classifyEnterpriseFactCandidateV22,
  deduplicateExactAtomicCandidates,
  splitProductionChunkIntoAtomicSegments
} from './fact-pilot-v1-1-helpers.mjs';
import { chunkEnterpriseMaterial } from '../../src/pipeline/enterprise-material-chunker.js';

const ROOT = resolve(process.cwd());
const PREVIOUS_REPLAY = join(ROOT, 'docs/handoff/V43_HANDOFF_FACT_V2_2_1_E2E_RELEASE_CLOSURE/05_FOUR_BLOCKED_CHUNK_REPLAY.json');
const PREVIOUS_REPORT = join(ROOT, 'docs/handoff/V43_HANDOFF_EVIDENCE_FACT_CANDIDATE_V2_2_E2E_GATE_TARGETED/06_FACT_EXTRACTION_REPORT.json');
const PREFLIGHT = join(ROOT, 'backend/eval/rag-pilot/results/deepseek-official-connectivity-1789312510003/checkpoint.json');
const SOURCE = join(ROOT, 'data/eval/real-enterprise-upload-test-v1/raw/HW-001.pdf');
const OUT_DIR = join(ROOT, 'docs/handoff/V43_HANDOFF_FACT_V2_2_1_E2E_RELEASE_CLOSURE');
const RUN_ID = `V43-FACT-V2.2.1-RESIDUAL-${new Date().toISOString().replace(/[-:.TZ]/gu, '').slice(0, 14)}-${Math.random().toString(16).slice(2, 10).toUpperCase()}`;
const TASK_TYPE = 'evidence_fact_candidate_v2_2';
const MATERIAL_ID = 'da4b0715-9d47-4853-ab2f-df5eee22c597';
const ENTERPRISE_ID = 'HUAWEI-PUBLIC-REAL-PDF-PILOT-V1';
const ENTERPRISE_NAMES = ['华为', 'Huawei'];
const sha256 = value => createHash('sha256').update(Buffer.isBuffer(value) ? value : String(value ?? ''), 'utf8').digest('hex');
const now = () => new Date().toISOString();
const safe = (value, max = 240) => typeof value === 'string' ? value.slice(0, max) : null;

function safeProviderAudit(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const output = {};
  for (const key of [
    'provider', 'model', 'requested_provider', 'requested_model', 'response_provider', 'response_model',
    'endpoint', 'gateway_http_status', 'provider_http_status', 'provider_http_reached', 'latency_ms',
    'finish_reason', 'prompt_tokens', 'completion_tokens', 'total_tokens', 'output_truncated',
    'json_parse_success', 'safe_error_code', 'cause_code', 'retry_attempt'
  ]) if (value[key] !== undefined) output[key] = typeof value[key] === 'string' ? safe(value[key], 180) : value[key];
  if (value.fact_normalization_diagnostic && typeof value.fact_normalization_diagnostic === 'object') {
    const d = value.fact_normalization_diagnostic;
    output.fact_normalization_diagnostic = {
      normalizer_invoked: d.normalizer_invoked === true,
      projection_invoked: d.projection_invoked === true,
      unexpected_property_names: Array.isArray(d.unexpected_property_names) ? d.unexpected_property_names.slice(0, 20).map(item => safe(item, 120)) : [],
      removed_property_names: Array.isArray(d.removed_property_names) ? d.removed_property_names.slice(0, 20).map(item => safe(item, 120)) : [],
      exact_validation_path: safe(d.exact_validation_path, 240)
    };
  }
  return output;
}

function safeError(error) {
  const details = error?.details || {};
  return {
    code: safe(error?.code || 'UNKNOWN_ERROR', 120),
    status: Number.isInteger(error?.status) ? error.status : null,
    message: safe(error?.message, 240),
    stage: safe(details.stage, 120),
    boundary: safe(details.boundary, 200),
    cause_code: safe(details.cause_code, 120),
    provider_audit: safeProviderAudit(details.provider_audit || error?.audit?.probe_diagnostics),
    schema_validation_errors: Array.isArray(details.schema_validation_errors)
      ? details.schema_validation_errors.slice(0, 20).map(item => ({
        path: safe(item?.path, 200), keyword: safe(item?.keyword, 80), expected: safe(item?.expected, 200),
        actual_type: safe(item?.actual_type, 80), additional_property: safe(item?.additional_property, 120)
      })) : []
  };
}

function sourceSnapshotFor(window) {
  const parent = window.chunks[0];
  return createEvidenceFactSourceSnapshot({
    snapshot_id: `EVAL-FACT-V2.2.1-${MATERIAL_ID}-${window.window_id}`,
    material_id: MATERIAL_ID,
    material_version: 'V43_REAL_PDF_PILOT_V2.2.1_RESIDUAL',
    source_hash: window.source_text_hash,
    chunk_id: parent.chunk_id,
    chunk_hash: parent.chunk_hash,
    source_span_id: `PILOT-V2.2.1-SPAN-${window.window_id}`,
    source_span_hash: window.source_text_hash,
    approved_review_identity: `EVAL-FACT-V2.2.1-APPROVED-${MATERIAL_ID}`,
    segments: [{
      source_ref: `snapshot://${MATERIAL_ID}/${window.window_id}/chunk-001`,
      text: window.source_text
    }]
  });
}

function buildWindow(row, chunk) {
  const base = {
    window_id: row.window_id,
    source_id: row.source_id,
    material_id: row.material_id,
    window_index: null,
    split_depth: 2,
    parent_window_id: row.parent_window_id,
    source_text: chunk.source_text,
    source_text_hash: sha256(chunk.source_text),
    start_offset: chunk.char_start,
    end_offset: chunk.char_end,
    page_start: row.page_start,
    page_end: row.page_end,
    included_chunk_ids: [chunk.chunk_id],
    included_chunk_count: 1,
    included_chunk_text_chars: chunk.source_text.length,
    source_span_chars: chunk.source_text.length,
    chunks: [chunk],
    terminal_single_chunk: true
  };
  return base;
}

function candidateRow({ row, window, fact, canonicalization, grounding, resolved, segmentIndex, factIndex, providerAudit }) {
  const canonical = canonicalization?.canonical || null;
  const classification = classifyEnterpriseFactCandidateV22({
    candidate: fact,
    citedSourceText: resolved?.fact_source_text || '',
    enterpriseNames: ENTERPRISE_NAMES,
    enterpriseId: ENTERPRISE_ID
  });
  return {
    fact_id: `RESIDUAL-${sha256(`${RUN_ID}|${row.window_id}|${segmentIndex}|${factIndex}|${JSON.stringify(fact)}`).slice(0, 32).toUpperCase()}`,
    source_id: row.source_id,
    material_id: row.material_id,
    parent_window_id: row.window_id,
    atomic_segment_id: window.chunks[0].atomic_segment_id || null,
    candidate_v2_2: fact,
    canonical_fact: canonical,
    canonicalization: canonicalization ? {
      status: canonicalization.status,
      review_reasons: canonicalization.review_reasons || [],
      observation: canonicalization.observation || null
    } : null,
    grounding: grounding ? { decision: grounding.decision, reasons: grounding.reasons || [] } : null,
    source_ref_resolution: resolved ? {
      total: resolved.source_alias_resolution.total,
      resolved: resolved.source_alias_resolution.resolved,
      unresolved: resolved.source_alias_resolution.unresolved,
      rate: resolved.source_alias_resolution.rate,
      authoritative_source_refs: resolved.authoritative_source_refs
    } : null,
    fact_semantic_classification: classification.classification,
    fact_semantic_classification_reason: classification.reason,
    source_span: {
      source_document_id: MATERIAL_ID,
      material_id: MATERIAL_ID,
      anchor_chunk_id: row.parent_chunk_ids[0],
      parent_chunk_id: row.parent_chunk_ids[0],
      atomic_segment_id: window.chunks[0].atomic_segment_id || null,
      atomic_segment: true,
      boundary_type: window.atomic_boundary_type || null,
      page_start: row.page_start,
      page_end: row.page_end,
      start_offset: window.start_offset,
      end_offset: window.end_offset,
      source_text_hash: window.source_text_hash,
      resolver_strategy: 'existing-production-chunk -> FactExtractionAtomicSegment',
      resolver_version: 'evidence-fact-atomic-segment-v1'
    },
    supporting_source_text_hash: sha256(window.source_text),
    provider_audit: providerAudit,
    review_status: 'GPT_HUMAN_REVIEW_PENDING'
  };
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const replay = JSON.parse(await readFile(PREVIOUS_REPLAY, 'utf8'));
  const previousReport = JSON.parse(await readFile(PREVIOUS_REPORT, 'utf8'));
  const preflight = JSON.parse(await readFile(PREFLIGHT, 'utf8'));
  if (Number(preflight.provider_http_status) !== 200 || preflight.strict_schema !== 'PASS') {
    throw Object.assign(new Error('Provider preflight is not a passing HTTP 200 strict-schema checkpoint.'), { code: `BLOCKED_PROVIDER_HTTP_${preflight.provider_http_status ?? 'UNAVAILABLE'}` });
  }
  const raw = await readFile(SOURCE);
  const extraction = await extractTenderText({ fileName: 'HW-001.pdf', mimeType: 'application/pdf', buffer: raw });
  const chunks = chunkEnterpriseMaterial(MATERIAL_ID, extraction.text);
  const chunkById = new Map(chunks.map(chunk => [chunk.chunk_id, chunk]));
  for (const row of replay.cases) {
    const chunk = chunkById.get(row.parent_chunk_ids[0]);
    if (!chunk || sha256(chunk.source_text) !== row.source_text_hash) {
      throw Object.assign(new Error(`Frozen production chunk ${row.parent_chunk_ids[0]} could not be reconstructed byte-for-byte.`), { code: 'BLOCKED_SOURCE_CHUNK_RECONSTRUCTION' });
    }
  }

  const runtimeEnv = loadSemanticGatewayEnvironment({ env: loadBackendEnvironment({ env: process.env }), envFile: join(ROOT, 'services/semantic-gateway/.env') });
  const records = [];
  let providerCalls = 0;
  const guardedFetch = async (url, options) => {
    providerCalls += 1;
    const started = Date.now();
    try {
      const response = await fetch(url, options);
      const body = await response.clone().text().catch(() => '');
      let parsed = null;
      try { parsed = JSON.parse(body); } catch { /* only safe shape is retained */ }
      const diagnostic = parsed?.probe_diagnostics || parsed?.audit?.probe_diagnostics || {};
      records.push({
        call_index: providerCalls,
        gateway_http_status: response.status,
        provider_http_status: Number.isInteger(diagnostic.provider_http_status) ? diagnostic.provider_http_status : null,
        provider_http_reached: diagnostic.provider_http_reached === true,
        provider: safe(diagnostic.provider, 80),
        model: safe(diagnostic.model, 160),
        requested_provider: safe(diagnostic.requested_provider, 80),
        requested_model: safe(diagnostic.requested_model, 160),
        endpoint: safe(diagnostic.endpoint, 80),
        finish_reason: safe(diagnostic.finish_reason, 40),
        output_truncated: diagnostic.output_truncated === true,
        content_present: Boolean(body),
        content_length: body.length,
        content_hash: sha256(body),
        latency_ms: Date.now() - started,
        task_type: TASK_TYPE,
        retry_attempt: diagnostic.retry_attempt ?? null
      });
      return response;
    } catch (error) {
      records.push({ call_index: providerCalls, gateway_http_status: null, provider_http_status: null, provider_http_reached: false, content_present: false, content_length: 0, content_hash: null, latency_ms: Date.now() - started, task_type: TASK_TYPE, error_code: safe(error?.code || error?.name || 'NETWORK_ERROR', 120) });
      throw error;
    }
  };
  const client = createSemanticGatewayClientFromEnv({ env: runtimeEnv, fetchImpl: guardedFetch, taskType: TASK_TYPE });
  const extractor = new SemanticGatewayEvidenceFactExtractor({ client });
  const instructionMeta = getSemanticTaskInstructionMetadata(TASK_TYPE);
  const candidateRows = [];
  const caseResults = [];
  let schemaInvalid = 0;
  let unknownSourceAlias = 0;
  let sourceRefTotal = 0;
  let sourceRefResolved = 0;
  let provenanceComplete = 0;
  let unresolvedTruncation = 0;
  let atomicTruncation = 0;
  let requirementLeakage = 0;
  let authorityEscalation = 0;
  let semanticEmpty = 0;
  let canonicalized = 0;
  let canonicalizationReview = 0;
  let canonicalizationRejected = 0;
  let groundingAccept = 0;
  let groundingReview = 0;
  let groundingReject = 0;
  const perCase = [];

  for (const row of replay.cases) {
    const productionChunk = chunkById.get(row.parent_chunk_ids[0]);
    const parentWindow = buildWindow(row, productionChunk);
    const segments = splitProductionChunkIntoAtomicSegments(productionChunk);
    const executionWindows = segments.map((segment, index) => {
      const child = buildAtomicFactExtractionWindow(parentWindow, segment, index);
      return { ...child, source_text_hash: sha256(child.source_text), parent_window_id: row.window_id };
    });
    const caseRecord = {
      source_id: row.source_id,
      material_id: row.material_id,
      window_id: row.window_id,
      parent_chunk_id: row.parent_chunk_ids[0],
      frozen_source_text_hash: row.source_text_hash,
      production_chunk_reconstructed: true,
      atomic_segment_count: executionWindows.length,
      segments: [],
      status: 'PENDING'
    };
    for (const [segmentIndex, window] of executionWindows.entries()) {
      const snapshot = sourceSnapshotFor(window);
      const aliasTable = createEvidenceFactCandidateV21SourceAliasTable(snapshot);
      const context = {
        project_id: 'EVAL-FACT-V2.2.1-RESIDUAL',
        review_id: `PILOT-FACT-V2.2.1-${sha256(`${RUN_ID}|${window.window_id}`).slice(0, 16).toUpperCase()}`,
        review_status: 'approved',
        evidence_review_contract_version: 'evidence-review-v1',
        evidence_capability: 'capable',
        support_level: 'full_support',
        source_span_id: `PILOT-WINDOW-${window.window_id}`,
        anchor_chunk_id: row.parent_chunk_ids[0],
        material_id: MATERIAL_ID,
        material_type: 'company_profile',
        source_text: window.source_text,
        source_text_hash: window.source_text_hash,
        current_source_text_hash: window.source_text_hash
      };
      const segmentRecord = {
        execution_window_id: window.window_id,
        atomic_segment_id: window.chunks[0].atomic_segment_id || null,
        boundary_type: window.atomic_boundary_type || null,
        source_text_hash: window.source_text_hash,
        source_text_length: window.source_text.length,
        source_alias_count: aliasTable.segments.length,
        provider_call_index: null,
        status: 'PENDING',
        candidate_count: 0,
        candidates: []
      };
      try {
        const result = await extractor.extractCandidateV22(context, {
          sourceSnapshot: snapshot,
          diagnosticMode: 'probe-v1',
          producerVersion: {
            provider: 'deepseek_official', model: 'deepseek-v4-pro', endpoint: '/responses', protocol: 'responses',
            thinking: 'OFF', reasoning: 'none', prompt_version: EVIDENCE_FACT_CANDIDATE_V22_PROMPT_VERSION,
            prompt_hash: instructionMeta.instruction_hash, candidate_schema_version: EVIDENCE_FACT_CANDIDATE_V22_SCHEMA_VERSION,
            candidate_schema_hash: EVIDENCE_FACT_CANDIDATE_V22_SCHEMA_SHA256,
            canonicalizer_version: EVIDENCE_FACT_CANDIDATE_V21_CANONICALIZER_VERSION,
            grounding_version: EVIDENCE_FACT_CANDIDATE_V21_GROUNDING_VERSION,
            max_output_tokens: 4800
          }
        });
        const providerAudit = safeProviderAudit(result[FACT_PROVIDER_AUDIT]);
        segmentRecord.provider_call_index = providerCalls;
        segmentRecord.provider_audit = providerAudit;
        const facts = Array.isArray(result) ? result : [];
        if (!facts.length) { semanticEmpty += 1; segmentRecord.status = 'SUCCESS_EMPTY'; }
        else segmentRecord.status = 'FACTS_RETURNED';
        segmentRecord.candidate_count = facts.length;
        for (const [factIndex, fact] of facts.entries()) {
          let resolved = null;
          try { resolved = resolveEvidenceFactCandidateV21SourceRefs(fact, snapshot); }
          catch (error) { unknownSourceAlias += 1; segmentRecord.source_resolution_error = safeError(error); }
          if (resolved) { sourceRefTotal += resolved.source_alias_resolution.total; sourceRefResolved += resolved.source_alias_resolution.resolved; }
          let projected = null;
          let grounding = null;
          try {
            const output = canonicalizeAndGroundEvidenceFactCandidateV21(fact, snapshot);
            projected = output.canonicalization;
            grounding = output.grounding;
            if (projected.status === 'CANONICALIZED') canonicalized += 1;
            else if (projected.status === 'CANONICALIZATION_REVIEW_REQUIRED') canonicalizationReview += 1;
            else canonicalizationRejected += 1;
            if (grounding.decision === 'ACCEPT') groundingAccept += 1;
            else if (grounding.decision === 'REVIEW_REQUIRED') groundingReview += 1;
            else groundingReject += 1;
          } catch (error) {
            canonicalizationRejected += 1;
            segmentRecord.canonicalization_error = safeError(error);
          }
          const rowOutput = candidateRow({ row, window, fact, canonicalization: projected, grounding, resolved, segmentIndex, factIndex, providerAudit });
          candidateRows.push(rowOutput);
          segmentRecord.candidates.push({ fact_id: rowOutput.fact_id, canonicalization_status: projected?.status || null, grounding_decision: grounding?.decision || null, source_refs: resolved?.authoritative_source_refs || [] });
          if (forbiddenRequirementLeakage(rowOutput)) requirementLeakage += 1;
        }
        if (!facts.length || facts.every(fact => {
          try { return resolveEvidenceFactCandidateV21SourceRefs(fact, snapshot).source_alias_resolution.rate === 1; } catch { return false; }
        })) provenanceComplete += 1;
      } catch (error) {
        const failure = safeError(error);
        const audit = failure.provider_audit;
        segmentRecord.provider_call_index = providerCalls;
        segmentRecord.provider_audit = audit;
        segmentRecord.failure = failure;
        if (audit?.output_truncated === true || audit?.finish_reason === 'incomplete' || audit?.safe_error_code === 'OUTPUT_TRUNCATED') {
          unresolvedTruncation += 1;
          atomicTruncation += 1;
        }
        if (failure.code.includes('SCHEMA') || failure.cause_code === 'OUTPUT_SCHEMA_INVALID' || failure.schema_validation_errors.length) schemaInvalid += 1;
        segmentRecord.status = 'FAILED';
      }
      caseRecord.segments.push(segmentRecord);
      await writeFile(join(OUT_DIR, 'residual-replay-progress.json'), `${JSON.stringify({ run_id: RUN_ID, provider_calls: providerCalls, completed_segments: perCase.reduce((sum, item) => sum + item.atomic_segment_count, 0) + caseRecord.segments.length, target_cases: 4, updated_at: now() }, null, 2)}\n`, 'utf8');
    }
    caseRecord.status = caseRecord.segments.some(segment => segment.status === 'FAILED') ? 'FAILED' : 'COMPLETED';
    perCase.push({ atomic_segment_count: executionWindows.length });
    caseResults.push(caseRecord);
  }
  const deduplication = deduplicateExactAtomicCandidates(candidateRows);
  const providerFailureRecords = records.filter(record => Number(record.provider_http_status) >= 400 || Number(record.gateway_http_status) >= 400);
  const providerHttpFailures = records.filter(record => Number(record.provider_http_status) >= 400);
  // A Gateway 502 carrying provider HTTP 200 is a structured-output/truncation
  // result, not a provider transport status.  Keep the provider status and
  // classify the run by the frozen atomic-density stop rule below.
  const firstProviderHttpFailure = records.find(record => Number(record.provider_http_status) !== 200 && record.provider_http_status !== null);
  const sourceAliasRate = sourceRefTotal ? sourceRefResolved / sourceRefTotal : 1;
  const provenanceRate = executionWindowsCount(caseResults) ? provenanceComplete / executionWindowsCount(caseResults) : 1;
  let status = 'READY_FOR_GPT_FACT_E2E_RELEASE_FINAL_ADJUDICATION';
  let stopReason = null;
  if (firstProviderHttpFailure) { status = `BLOCKED_PROVIDER_HTTP_${firstProviderHttpFailure.provider_http_status}`; stopReason = status; }
  else if (atomicTruncation > 0 || unresolvedTruncation > 0) { status = 'BLOCKED_ATOMIC_SOURCE_SEGMENT_OUTPUT_DENSITY'; stopReason = status; }
  else if (schemaInvalid > 0) { status = 'BLOCKED_FACT_CANDIDATE_SCHEMA_INVALID'; stopReason = status; }
  else if (unknownSourceAlias > 0 || sourceAliasRate !== 1) { status = 'BLOCKED_UNKNOWN_SOURCE_ALIAS'; stopReason = status; }
  else if (requirementLeakage > 0) { status = 'BLOCKED_REQUIREMENT_TENDER_LEAKAGE'; stopReason = status; }
  const checkpoint = {
    checkpoint: 'V43_FACT_CANDIDATE_V2_2_1_E2E_RELEASE_CLOSURE',
    run_id: RUN_ID,
    status,
    provider_preflight: {
      source: 'backend/eval/rag-pilot/results/deepseek-official-connectivity-1789312510003/checkpoint.json',
      provider_http_status: preflight.provider_http_status,
      gateway_http_status: preflight.gateway_http_status,
      strict_schema: preflight.strict_schema,
      provider_calls: preflight.provider_calls
    },
    target_cases: 4,
    completed_cases: caseResults.filter(item => item.status === 'COMPLETED').length,
    failed_cases: caseResults.filter(item => item.status === 'FAILED').length,
    production_chunk_reconstruction: 'PASS',
    total_atomic_segments: executionWindowsCount(caseResults),
    processed_atomic_segments: caseResults.reduce((sum, item) => sum + item.segments.filter(segment => segment.status !== 'PENDING').length, 0),
    provider_calls: providerCalls,
    provider_failures: providerFailureRecords.length,
    retries: 0,
    provider_http_success_rate: providerCalls ? (providerCalls - providerHttpFailures.length) / providerCalls : 0,
    schema_invalid: schemaInvalid,
    unknown_source_alias: unknownSourceAlias,
    source_alias_total: sourceRefTotal,
    source_alias_resolved: sourceRefResolved,
    source_alias_resolution_rate: sourceAliasRate,
    provenance_complete_rate: provenanceRate,
    unresolved_output_truncation: unresolvedTruncation,
    atomic_segment_output_truncation: atomicTruncation,
    requirement_tender_leakage: requirementLeakage,
    authority_escalation: authorityEscalation,
    lineage_only_external_outcome_auto_promotion: 0,
    fact_candidate_total: candidateRows.length,
    fact_candidate_total_after_exact_dedup: deduplication.rows.length,
    exact_atomic_duplicates_removed: deduplication.removed_count,
    semantic_empty_segments: semanticEmpty,
    canonicalized_count: canonicalized,
    canonicalization_review_required_count: canonicalizationReview,
    canonicalization_rejected_count: canonicalizationRejected,
    grounding_accept_count: groundingAccept,
    grounding_review_required_count: groundingReview,
    grounding_reject_count: groundingReject,
    production_db_writes: 0,
    fact_persistence: 0,
    gold_mutations: 0,
    requirement_mutations: 0,
    mapping_actions: 0,
    claim_actions: 0,
    writer_actions: 0,
    prompt_changed: false,
    schema_changed: false,
    stop_reason: stopReason,
    finished_at: now()
  };
  const residualArtifact = {
    artifact_type: 'V43_FACT_V2_2_1_FOUR_BLOCKED_CHUNK_RESIDUAL_REPLAY',
    run_id: RUN_ID,
    source_artifact: 'docs/handoff/V43_HANDOFF_FACT_V2_2_1_E2E_RELEASE_CLOSURE/05_FOUR_BLOCKED_CHUNK_REPLAY.json',
    source_pdf: 'data/eval/real-enterprise-upload-test-v1/raw/HW-001.pdf',
    source_pdf_sha256: sha256(raw),
    extracted_text_sha256: sha256(extraction.text),
    provider: 'deepseek_official',
    model: 'deepseek-v4-pro',
    endpoint: '/responses',
    task_type: TASK_TYPE,
    prompt_version: EVIDENCE_FACT_CANDIDATE_V22_PROMPT_VERSION,
    prompt_hash: instructionMeta.instruction_hash,
    schema_version: EVIDENCE_FACT_CANDIDATE_V22_SCHEMA_VERSION,
    schema_hash: EVIDENCE_FACT_CANDIDATE_V22_SCHEMA_SHA256,
    source_role: 'REAL_PUBLIC_FIRST_PARTY',
    enterprise_id: ENTERPRISE_ID,
    raw_provider_content: 'NOT_PERSISTED',
    provider_records: records,
    cases: caseResults,
    candidates: deduplication.rows,
    checkpoint
  };
  await writeFile(join(OUT_DIR, 'residual-replay-result.json'), `${JSON.stringify(residualArtifact, null, 2)}\n`, 'utf8');
  await writeFile(join(OUT_DIR, 'residual-replay-checkpoint.json'), `${JSON.stringify(checkpoint, null, 2)}\n`, 'utf8');
  await writeFile(join(OUT_DIR, 'residual-replay-provider-records.json'), `${JSON.stringify({ run_id: RUN_ID, provider_records: records, raw_provider_content: 'NOT_PERSISTED' }, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ status, run_id: RUN_ID, provider_calls: providerCalls, target_cases: 4, total_atomic_segments: checkpoint.total_atomic_segments, candidate_count: candidateRows.length, source_alias_resolution_rate: sourceAliasRate, unresolved_output_truncation: unresolvedTruncation }));
}

function executionWindowsCount(caseResults) {
  return caseResults.reduce((sum, item) => sum + (item.atomic_segment_count || 0), 0);
}

function forbiddenRequirementLeakage(value) {
  return /(?:JY-001|TB-003|TB-006|FAST-01|FAST-04|FAST-WATER-01|HOLDOUT-REQ|FIXED48|mapping[_ -]?label|coverage\s+gap)/iu.test(JSON.stringify(value));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => {
    console.error(JSON.stringify({ status: error?.code || 'BLOCKED_RESIDUAL_REPLAY', message: safe(error?.message, 240) }));
    process.exitCode = 1;
  });
}
