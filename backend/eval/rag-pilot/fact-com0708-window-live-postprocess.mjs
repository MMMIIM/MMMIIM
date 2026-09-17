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
const PACKET_PATH = path.join(DOCS, 'V43_FACT_COM07_COM08_FRESH_WINDOW_LIVE_GPT_PACKET.json');
const CHECKPOINT_PATH = path.join(DOCS, 'V43_FACT_COM07_COM08_FRESH_WINDOW_LIVE_CHECKPOINT.json');
const MARKDOWN_PATH = path.join(DOCS, 'V43_FACT_COM07_COM08_FRESH_WINDOW_LIVE_CHECKPOINT.md');
const MANIFEST_PATH = path.join(EVAL_ROOT, 'V43_RAG_CODEX_HANDOFF_1', 'rag_import_manifest.jsonl');
const DOCS_TO_PROCESS = ['COM-07', 'COM-08'];
const sha256 = value => crypto.createHash('sha256').update(String(value ?? ''), 'utf8').digest('hex');
const json = value => `${JSON.stringify(value, null, 2)}\n`;

function sourceRows() {
  const rows = new Map(fs.readFileSync(MANIFEST_PATH, 'utf8').split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line)).map(row => [row.doc_id, row]));
  return DOCS_TO_PROCESS.map(docId => {
    const manifest = rows.get(docId);
    const file = path.join(EVAL_ROOT, 'V43_RAG_CODEX_HANDOFF_1', manifest.path);
    const sourceText = fs.readFileSync(file, 'utf8');
    return { docId, manifest, sourceText, sourceHash: sha256(sourceText), file };
  });
}

function scopedSourceText(window) {
  return [...window.heading_path.map((heading, index) => `${'#'.repeat(Math.max(1, index + 1))} ${heading}`), window.body].filter(Boolean).join('\n').trim();
}

function windowIndex() {
  const index = new Map();
  for (const source of sourceRows()) {
    const windows = buildEvidenceFactProducerInputWindows({
      documentId: source.docId, sourceText: source.sourceText, sourceRef: `eval://chengchuan-fixed12/${source.manifest.path}#full-document`, sourceHash: source.sourceHash,
      metadata: { material_id: source.docId, source_kind: source.manifest.source_kind, evidence_status: source.manifest.evidence_status, synthetic_company_evidence: source.manifest.synthetic_company_evidence === true, claim_permission: source.manifest.claim_permission === true }
    });
    for (const window of windows.windows) index.set(window.window_id, { source, manifest: source.manifest, window });
  }
  return index;
}

function snapshotFor(execution, window) {
  return Object.freeze({
    snapshot_id: `POSTPROCESS-${sha256(execution.source_ref).slice(0, 16).toUpperCase()}`,
    material_id: `${execution.case_id}:${execution.window_id}`,
    material_version: 'com0708-window-snapshot-v1', source_hash: execution.window_source_hash,
    chunk_id: execution.window_id, chunk_hash: execution.window_source_hash,
    source_span_id: `${execution.window_id}-SPAN-001`, source_span_hash: execution.window_source_hash,
    approved_review_identity: null, segments: Object.freeze([{ source_ref: execution.source_ref, text: window.producer_source_text }])
  });
}

function main() {
  const packet = JSON.parse(fs.readFileSync(PACKET_PATH, 'utf8'));
  const index = windowIndex();
  const roleDistribution = {};
  const canonicalizationDistribution = {};
  const groundingDistribution = {};
  let candidateCount = 0;
  let sourceRefTotal = 0;
  let sourceRefResolved = 0;
  for (const execution of packet.executions) {
    const entry = index.get(execution.window_id);
    if (!entry) throw new Error(`POSTPROCESS_WINDOW_MISSING:${execution.window_id}`);
    const snapshot = snapshotFor(execution, entry.window);
    for (const candidate of execution.candidates || []) {
      candidateCount += 1;
      const fact = candidate.raw_candidate;
      const refs = Array.isArray(candidate.source_refs) ? candidate.source_refs : [];
      sourceRefTotal += refs.length;
      if (refs.every(ref => ref === execution.source_ref)) sourceRefResolved += refs.length;
      const sourceRole = resolveEnterpriseFactSourceRole({ candidate: fact, sourceText: scopedSourceText(entry.window), material: entry.manifest });
      const result = canonicalizeAndGroundEvidenceFactCandidateV21(fact, snapshot, { resolvedSourceUnit: { heading_path: entry.window.heading_path, text: entry.window.producer_source_text } });
      candidate.source_role = sourceRole;
      candidate.canonicalization = { status: result.canonicalization.status, reasons: result.canonicalization.review_reasons || [], canonical_fact: result.canonicalization.canonical || null };
      candidate.grounding = { decision: result.grounding.decision, reasons: result.grounding.reasons || [], source_grounding_mode: result.grounding.source_grounding_mode || null };
      candidate.full_document_fallback_used = false;
      candidate.cross_heading_grounding = false;
      roleDistribution[sourceRole.role] = (roleDistribution[sourceRole.role] || 0) + 1;
      canonicalizationDistribution[result.canonicalization.status] = (canonicalizationDistribution[result.canonicalization.status] || 0) + 1;
      groundingDistribution[result.grounding.decision] = (groundingDistribution[result.grounding.decision] || 0) + 1;
    }
  }
  const telemetryMissing = packet.executions.flatMap(execution => {
    const audit = execution.provider_audit || {};
    const missing = [];
    if (audit.provider !== 'deepseek_official') missing.push('provider');
    if (audit.requested_model !== 'deepseek-v4-pro') missing.push('requested_model');
    if (audit.endpoint !== '/responses') missing.push('endpoint');
    if (audit.provider_http_reached !== true) missing.push('provider_http_reached');
    if (!Number.isInteger(audit.provider_http_status)) missing.push('provider_http_status');
    return missing.length ? [{ window_id: execution.window_id, missing }] : [];
  });
  const telemetryComplete = telemetryMissing.length === 0;
  packet.postprocess = { mode: 'OFFLINE_GROUNDING_RECALCULATION_ONLY', generated_at: new Date().toISOString(), provider_calls: 0, grounding_source_unit: 'producer_source_text', telemetry_complete: telemetryComplete, telemetry_missing: telemetryMissing };
  packet.metrics.candidate_count = candidateCount;
  packet.metrics.source_ref_total = sourceRefTotal;
  packet.metrics.source_ref_resolved = sourceRefResolved;
  packet.metrics.source_ref_resolution_rate = sourceRefTotal ? sourceRefResolved / sourceRefTotal : 1;
  packet.metrics.source_role_distribution = roleDistribution;
  packet.metrics.canonicalization_distribution = canonicalizationDistribution;
  packet.metrics.grounding_distribution = groundingDistribution;
  packet.metrics.full_document_grounding_fallback_count = 0;
  packet.metrics.cross_heading_grounding_count = 0;
  packet.failure = telemetryComplete ? null : { code: 'PROVIDER_EXECUTION_AUDIT_UNOBSERVABLE', message: 'The 11 live executions did not expose provider HTTP/model identity telemetry required by the frozen canary gate.', windows: telemetryMissing.map(item => item.window_id) };
  packet.final_status = telemetryComplete ? 'READY_FOR_GPT_FACT_WINDOW_LIVE_ADJUDICATION' : 'BLOCKED_PROVIDER_EXECUTION_AUDIT_UNOBSERVABLE';
  fs.writeFileSync(PACKET_PATH, json(packet));

  const checkpoint = JSON.parse(fs.readFileSync(CHECKPOINT_PATH, 'utf8'));
  checkpoint.postprocess = packet.postprocess;
  checkpoint.candidate_count = candidateCount;
  checkpoint.source_ref_resolution_rate = packet.metrics.source_ref_resolution_rate;
  checkpoint.source_role_distribution = roleDistribution;
  checkpoint.canonicalization_distribution = canonicalizationDistribution;
  checkpoint.grounding_distribution = groundingDistribution;
  checkpoint.provider_execution_identity_observable = telemetryComplete;
  checkpoint.provider_execution_identity_missing = telemetryMissing;
  checkpoint.failure = packet.failure;
  checkpoint.status = packet.final_status;
  fs.writeFileSync(CHECKPOINT_PATH, json(checkpoint));
  fs.writeFileSync(MARKDOWN_PATH, `# V43_FACT_COM07_COM08_FRESH_WINDOW_LIVE_CHECKPOINT\n\n- status: ${checkpoint.status}\n- run_id: ${checkpoint.run_id}\n- COM-07 windows: ${checkpoint.window_counts['COM-07']}\n- COM-08 windows: ${checkpoint.window_counts['COM-08']}\n- planned provider calls: ${checkpoint.planned_provider_calls}\n- actual provider calls: ${checkpoint.actual_provider_calls}\n- candidate count: ${candidateCount}\n- source ref resolution rate: ${checkpoint.source_ref_resolution_rate}\n- cross-window candidate count: ${checkpoint.cross_window_candidate_count}\n- full-document grounding fallback: ${checkpoint.full_document_grounding_fallback_count}\n- provider failures: ${checkpoint.provider_failures}\n- schema failures: ${checkpoint.schema_failures}\n- provider execution identity observable: ${telemetryComplete}\n- grounding recalculation provider calls: 0\n- production DB writes: 0\n- Fact persistence: 0\n- Gold mutations: 0\n\nGPT packet: docs/V43_FACT_COM07_COM08_FRESH_WINDOW_LIVE_GPT_PACKET.json\n`);
  console.log(JSON.stringify({ status: checkpoint.status, provider_calls: checkpoint.actual_provider_calls, candidate_count: candidateCount, source_ref_resolution_rate: checkpoint.source_ref_resolution_rate, grounding_distribution: groundingDistribution, telemetry_missing_windows: telemetryMissing.map(item => item.window_id) }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();

