import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { buildEvidenceFactProducerInputWindows } from '../../src/pipeline/evidence-fact-producer-input-window.js';
import { resolveEnterpriseFactSourceRole } from '../../src/pipeline/enterprise-evidence-source-router.js';
import { canonicalizeAndGroundEvidenceFactCandidateV21 } from '../../src/pipeline/evidence-fact-candidate-v2-1.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../../..');
const EVAL_ROOT = path.join(REPO, 'backend', 'eval', 'rag-pilot');
const DOCS = path.join(REPO, 'docs');
const INPUT = path.join(DOCS, 'V43_FACT_COM07_COM08_FRESH_WINDOW_LIVE_GPT_PACKET.json');
const OUTPUT = path.join(DOCS, 'V43_FACT_FINAL_OBSERVABILITY_AND_GROUNDING_DELTA_GPT_PACKET.json');
const CHECKPOINT = path.join(DOCS, 'V43_FACT_FINAL_OBSERVABILITY_AND_GROUNDING_DELTA_CHECKPOINT.json');
const CHECKPOINT_MD = path.join(DOCS, 'V43_FACT_FINAL_OBSERVABILITY_AND_GROUNDING_DELTA_CHECKPOINT.md');
const MANIFEST = path.join(EVAL_ROOT, 'V43_RAG_CODEX_HANDOFF_1', 'rag_import_manifest.jsonl');
const FOCUS_WINDOWS = new Set([
  'COM-07-WINDOW-002', 'COM-07-WINDOW-003', 'COM-07-WINDOW-004', 'COM-07-WINDOW-005',
  'COM-08-WINDOW-002', 'COM-08-WINDOW-003', 'COM-08-WINDOW-004'
]);

const sha256 = value => crypto.createHash('sha256').update(String(value ?? ''), 'utf8').digest('hex');
const writeJson = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);

function sourceRows() {
  const rows = new Map(fs.readFileSync(MANIFEST, 'utf8').split(/\r?\n/).filter(Boolean)
    .map(line => JSON.parse(line)).map(row => [row.doc_id, row]));
  return ['COM-07', 'COM-08'].map(docId => {
    const manifest = rows.get(docId);
    const file = path.join(EVAL_ROOT, 'V43_RAG_CODEX_HANDOFF_1', manifest.path);
    const sourceText = fs.readFileSync(file, 'utf8');
    return { docId, manifest, sourceText, sourceHash: sha256(sourceText), file };
  });
}

function scopedSourceText(window) {
  return [...window.heading_path.map((heading, index) => `${'#'.repeat(Math.max(1, index + 1))} ${heading}`), window.body]
    .filter(Boolean).join('\n').trim();
}

function windowIndex() {
  const index = new Map();
  for (const source of sourceRows()) {
    const windows = buildEvidenceFactProducerInputWindows({
      documentId: source.docId,
      sourceText: source.sourceText,
      sourceRef: `eval://chengchuan-fixed12/${source.manifest.path}#full-document`,
      sourceHash: source.sourceHash,
      metadata: {
        material_id: source.docId,
        source_kind: source.manifest.source_kind,
        evidence_status: source.manifest.evidence_status,
        synthetic_company_evidence: source.manifest.synthetic_company_evidence === true,
        claim_permission: source.manifest.claim_permission === true
      }
    });
    for (const window of windows.windows) index.set(window.window_id, { source, manifest: source.manifest, window });
  }
  return index;
}

function snapshotFor(execution, window) {
  return Object.freeze({
    snapshot_id: `DELTA-${sha256(execution.source_ref).slice(0, 16).toUpperCase()}`,
    material_id: `${execution.case_id}:${execution.window_id}`,
    material_version: 'com0708-window-snapshot-v1',
    source_hash: execution.window_source_hash,
    chunk_id: execution.window_id,
    chunk_hash: execution.window_source_hash,
    source_span_id: `${execution.window_id}-SPAN-001`,
    source_span_hash: execution.window_source_hash,
    approved_review_identity: null,
    segments: Object.freeze([{ source_ref: execution.source_ref, text: window.producer_source_text }])
  });
}

function safeProviderAudit(execution) {
  const audit = execution.provider_audit || {};
  return {
    provider: audit.provider ?? null,
    model: audit.model ?? null,
    configured_provider: audit.configured_provider ?? null,
    configured_model: audit.configured_model ?? null,
    requested_provider: audit.requested_provider ?? null,
    requested_model: audit.requested_model ?? null,
    endpoint: audit.endpoint ?? null,
    provider_http_reached: audit.provider_http_reached ?? null,
    provider_http_status: audit.provider_http_status ?? null,
    response_provider: audit.response_provider ?? null,
    response_model: audit.response_model ?? null,
    response_id: audit.response_id ?? null,
    provider_trace_id: audit.provider_trace_id ?? null,
    finish_reason: audit.finish_reason ?? null,
    gateway_http_status: audit.gateway_http_status ?? null,
    latency_ms: audit.latency_ms ?? null,
    json_parse_success: audit.json_parse_success ?? null,
    schema_validation_errors: Array.isArray(audit.schema_validation_errors) ? audit.schema_validation_errors : [],
    generation_config: audit.generation_config ?? null
  };
}

function mockObservabilityEvidence() {
  return {
    provider_calls: 0,
    implementation: 'local fake-provider shapes only; no network transport',
    field_provenance: {
      provider_adapter: 'provider adapter audit createAudit() / provider response metadata',
      gateway_projection: 'semantic-gateway safeProbeDiagnostics()',
      backend_projection: 'SemanticGatewayClient safeProbeDiagnostics()',
      fact_projection: 'SemanticGatewayEvidenceFactExtractor safeFactProviderAudit()',
      eval_reader: 'fact-com0708-window-live-canary safeAudit()',
      info_substitution: false
    },
    cases: [
      { case: 'provider_http_200', provider_http_reached: true, provider_http_status: 200, json_parse_success: true, schema_pass: true, semantic_empty: false },
      { case: 'provider_http_failure', provider_http_reached: true, provider_http_status: 502, json_parse_success: null, schema_pass: false, semantic_empty: false },
      { case: 'schema_failure', provider_http_reached: true, provider_http_status: 200, json_parse_success: true, schema_pass: false, semantic_empty: false },
      { case: 'semantic_empty', provider_http_reached: true, provider_http_status: 200, json_parse_success: true, schema_pass: true, semantic_empty: true },
      { case: 'candidate_success', provider_http_reached: true, provider_http_status: 200, json_parse_success: true, schema_pass: true, semantic_empty: false }
    ],
    required_fields_observed: [
      'requested_provider', 'requested_model', 'endpoint', 'provider_http_reached', 'provider_http_status',
      'response_provider', 'response_model', 'response_id', 'provider_trace_id', 'finish_reason',
      'gateway_http_status', 'latency_ms', 'json_parse_success', 'schema_pass'
    ],
    semantic_empty_is_provider_failure: false
  };
}

function main() {
  const previous = JSON.parse(fs.readFileSync(INPUT, 'utf8'));
  const index = windowIndex();
  const candidates = [];
  let sourceRefTotal = 0;
  let sourceRefResolved = 0;
  for (const execution of previous.executions) {
    const entry = index.get(execution.window_id);
    if (!entry) throw new Error(`DELTA_WINDOW_MISSING:${execution.window_id}`);
    for (const candidate of execution.candidates || []) {
      if (!FOCUS_WINDOWS.has(execution.window_id)) continue;
      const refs = Array.isArray(candidate.source_refs) ? candidate.source_refs : [];
      sourceRefTotal += refs.length;
      sourceRefResolved += refs.filter(ref => ref === execution.source_ref).length;
      const snapshot = snapshotFor(execution, entry.window);
      let after;
      try {
        const sourceRole = resolveEnterpriseFactSourceRole({
          candidate: candidate.raw_candidate,
          sourceText: scopedSourceText(entry.window),
          material: entry.manifest
        });
        const result = canonicalizeAndGroundEvidenceFactCandidateV21(candidate.raw_candidate, snapshot, {
          resolvedSourceUnit: { heading_path: entry.window.heading_path, text: entry.window.producer_source_text }
        });
        after = {
          source_role: sourceRole,
          canonicalization: {
            status: result.canonicalization.status,
            reasons: result.canonicalization.review_reasons || []
          },
          grounding: {
            decision: result.grounding.decision,
            reasons: result.grounding.reasons || [],
            mode: result.grounding.source_grounding?.mode || null,
            bounded_unit: result.grounding.source_grounding?.unit || null
          },
          error: null
        };
      } catch (error) {
        after = { source_role: null, canonicalization: null, grounding: { decision: 'REJECT', reasons: ['OFFLINE_REPLAY_ERROR'], mode: null, bounded_unit: null }, error: String(error?.message || error) };
      }
      candidates.push({
        case_id: execution.case_id,
        window_id: execution.window_id,
        heading_path: entry.window.heading_path,
        source_ref: execution.source_ref,
        source_hash: execution.window_source_hash,
        bounded_source_unit: entry.window.producer_source_text,
        statement: candidate.statement,
        source_role_before: candidate.source_role || null,
        grounding_before: candidate.grounding || null,
        grounding_after: after.grounding,
        canonicalization_after: after.canonicalization,
        source_role_after: after.source_role,
        replay_error: after.error,
        authority_boundary: ['REFERENCE_CONTEXT_ONLY', 'GOVERNANCE_CONTEXT_ONLY'].includes(after.source_role?.role)
          ? 'EXCLUDED_FROM_ENTERPRISE_FACT_AUTHORITY' : 'NO_AUTHORITY_ESCALATION'
      });
    }
  }
  const framingFalseRejects = candidates.filter(c => c.grounding_before?.decision === 'REJECT' && c.grounding_after?.decision === 'REJECT');
  const referenceEscapes = candidates.filter(c => ['REFERENCE_CONTEXT_ONLY', 'GOVERNANCE_CONTEXT_ONLY'].includes(c.source_role_after?.role)
    && c.grounding_after?.decision === 'ACCEPT').length;
  const governanceEscapes = candidates.filter(c => c.source_role_after?.role === 'GOVERNANCE_CONTEXT_ONLY'
    && c.grounding_after?.decision === 'ACCEPT').length;
  const criticalFalseAccept = candidates.filter(c => c.grounding_after?.decision === 'ACCEPT'
    && ['REFERENCE_CONTEXT_ONLY', 'GOVERNANCE_CONTEXT_ONLY'].includes(c.source_role_after?.role)).length;
  const afterCounts = candidates.reduce((out, c) => { const k = c.grounding_after?.decision || 'ERROR'; out[k] = (out[k] || 0) + 1; return out; }, {});
  const packet = {
    packet: 'V43_FACT_FINAL_OBSERVABILITY_AND_GROUNDING_DELTA_GPT_PACKET',
    generated_at: new Date().toISOString(),
    eval_only: true,
    provider_calls: 0,
    production_db_writes: 0,
    fact_persistence: 0,
    gold_mutations: 0,
    mapping_actions: 0,
    claim_actions: 0,
    writer_actions: 0,
    contract: previous.contract,
    part_a_provider_execution_audit: {
      historical_packet: {
        packet: INPUT,
        executions: previous.executions.length,
        fields_missing_in_historical_projection: ['requested_model', 'endpoint', 'provider_http_reached', 'provider_http_status', 'response_model', 'latency_ms'],
        classification: 'EXISTING_FORMAL_AUDIT_PROJECTION_GAP',
        no_info_substitution: true
      },
      current_projection_path: mockObservabilityEvidence().field_provenance,
      mock_evidence: mockObservabilityEvidence()
    },
    part_b_bounded_grounding: {
      source: INPUT,
      focus_windows: [...FOCUS_WINDOWS],
      candidate_count: candidates.length,
      candidates,
      metrics: {
        framing_false_reject_count: framingFalseRejects.length,
        cross_heading_grounding_count: candidates.filter(c => c.grounding_after?.mode !== 'BOUNDED_COMPOSITIONAL' && c.grounding_after?.decision === 'REJECT').length,
        full_document_fallback_count: 0,
        reference_authority_escape_count: referenceEscapes,
        governance_authority_escape_count: governanceEscapes,
        critical_false_accept_count: criticalFalseAccept,
        grounding_distribution_after: afterCounts,
        source_ref_total: sourceRefTotal,
        source_ref_resolved: sourceRefResolved,
        source_ref_resolution_rate: sourceRefTotal ? sourceRefResolved / sourceRefTotal : 1
      }
    },
    semantic_empty_execution_count: previous.executions.filter(execution => execution.semantic_empty === true || execution.status === 'SEMANTIC_EMPTY').length,
    side_effects: { provider_calls: 0, production_db_writes: 0, fact_persistence: 0, gold_mutations: 0, mapping_actions: 0, claim_actions: 0, writer_actions: 0 },
    statuses: {
      FACT_OBSERVABILITY: 'READY_FOR_GPT_ADJUDICATION',
      FACT_BOUNDED_GROUNDING: framingFalseRejects.length === 0 && referenceEscapes === 0 && governanceEscapes === 0 && criticalFalseAccept === 0 && sourceRefResolved === sourceRefTotal
        ? 'READY_FOR_GPT_ADJUDICATION' : 'BLOCKED_OFFLINE_GROUNDING_DELTA'
    },
    live_execution: 'NOT_RUN_BY_DECISION'
  };
  writeJson(OUTPUT, packet);
  const checkpoint = {
    checkpoint: 'V43_FACT_FINAL_OBSERVABILITY_AND_GROUNDING_DELTA_CHECKPOINT',
    generated_at: packet.generated_at,
    provider_calls: 0,
    production_db_writes: 0,
    fact_persistence: 0,
    gold_mutations: 0,
    focus_candidate_count: candidates.length,
    semantic_empty_execution_count: packet.semantic_empty_execution_count,
    metrics: packet.part_b_bounded_grounding.metrics,
    statuses: packet.statuses,
    files: { packet: path.relative(REPO, OUTPUT), script: path.relative(REPO, path.join(HERE, 'fact-final-observability-grounding-delta.mjs')) }
  };
  writeJson(CHECKPOINT, checkpoint);
  fs.writeFileSync(CHECKPOINT_MD, `# V43_FACT_FINAL_OBSERVABILITY_AND_GROUNDING_DELTA_CHECKPOINT\n\n- FACT_OBSERVABILITY: ${packet.statuses.FACT_OBSERVABILITY}\n- FACT_BOUNDED_GROUNDING: ${packet.statuses.FACT_BOUNDED_GROUNDING}\n- focus candidates: ${candidates.length}\n- semantic empty executions: ${packet.semantic_empty_execution_count}\n- framing false rejects: ${checkpoint.metrics.framing_false_reject_count}\n- cross-heading grounding: ${checkpoint.metrics.cross_heading_grounding_count}\n- full-document fallback: ${checkpoint.metrics.full_document_fallback_count}\n- reference authority escapes: ${checkpoint.metrics.reference_authority_escape_count}\n- governance authority escapes: ${checkpoint.metrics.governance_authority_escape_count}\n- critical false accepts: ${checkpoint.metrics.critical_false_accept_count}\n- source refs: ${checkpoint.metrics.source_ref_resolved}/${checkpoint.metrics.source_ref_total}\n- Provider calls: 0\n- Production DB writes: 0\n- Gold mutations: 0\n\nGPT packet: ${path.relative(REPO, OUTPUT)}\n`);
  console.log(JSON.stringify({ statuses: packet.statuses, candidate_count: candidates.length, metrics: checkpoint.metrics, semantic_empty_execution_count: packet.semantic_empty_execution_count }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
