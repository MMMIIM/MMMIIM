import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildAnnotatedPath } from '../requirement-extraction-real-tender-pilot-v1/run-live-eval.js';
import { loadBackendEnvironment } from '../../src/backend-runtime.js';
import { createSemanticGatewayClientFromEnv } from '../../src/pipeline/semantic-gateway-client.js';
import {
  createRequirementExtractionGateway
} from '../../src/pipeline/requirement-extraction.js';
import { SourceLocationResolver } from '../../src/pipeline/source-location-resolver.js';
import { mapValidatedCandidatesToCanonicalInput } from '../../src/verification/requirement-extraction-verifier.js';

/**
 * Bounded, Eval-only execution for the three B-class tenders.  This module is
 * deliberately not imported by production services and never writes a
 * database, Gold packet, Requirement, or quarantine state.
 */
export const AUTHORITY_ADJUDICATION_SCHEMA = 'v43-real-gold-v2-authority-adjudication-v1';
export const AUTHORITY_ADJUDICATION_TENDER_IDS = Object.freeze(['JY-001', 'TB-003', 'FAST-04']);
export const AUTHORITY_ADJUDICATION_OUTPUT_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  'v43-real-gold-v2-authority-adjudication'
);

const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const CENSUS_PATH = path.resolve(REPOSITORY_ROOT, 'backend/eval/tender-benchmark-v1/reports/tender-benchmark-pilot-census-v1.json');
const SOURCE_DIR = path.resolve(REPOSITORY_ROOT, 'backend/eval/tender-benchmark-v1/sources');
const TRACK_B_MANIFEST = path.resolve(REPOSITORY_ROOT, 'backend/eval/gold-governance/v43-real-gold-v2-source-fact-closure/track-b-real-enterprise-source-manifest.json');
const SNAPSHOT = path.resolve(REPOSITORY_ROOT, 'backend/eval/semantic-boundary/snapshot-v1.partial.json');
const MAX_PREVIEW_CHARS = 500;

const text = value => value == null ? '' : String(value);
const sha256 = value => crypto.createHash('sha256').update(Buffer.isBuffer(value) ? value : text(value), 'utf8').digest('hex');
const stable = value => Array.isArray(value)
  ? value.map(stable)
  : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]))
    : value;
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));

function safeDiagnostic(value = {}) {
  const probe = value && typeof value === 'object' ? value : {};
  return {
    provider_http_status: Number.isInteger(probe.provider_http_status) ? probe.provider_http_status : null,
    provider_adapter_invoked: probe.provider_adapter_invoked === true,
    fetch_invoked: probe.fetch_invoked === true,
    provider_http_reached: probe.provider_http_reached === true,
    response_model: typeof probe.response_model === 'string' ? probe.response_model.slice(0, 120) : null,
    finish_reason: typeof probe.finish_reason === 'string' ? probe.finish_reason.slice(0, 40) : null,
    json_parse_success: typeof probe.json_parse_success === 'boolean' ? probe.json_parse_success : null,
    output_truncated: probe.output_truncated === true,
    completion_tokens: Number.isInteger(probe.completion_tokens) ? probe.completion_tokens : null,
    total_tokens: Number.isInteger(probe.total_tokens) ? probe.total_tokens : null,
    error_code: typeof probe.safe_error_code === 'string' ? probe.safe_error_code.slice(0, 100) : null
  };
}

function safeError(error) {
  return {
    code: typeof error?.code === 'string' ? error.code.slice(0, 120) : 'REQUIREMENT_EXTRACTION_FAILED',
    message: typeof error?.message === 'string' ? error.message.slice(0, 240) : 'bounded extraction failed',
    http_status: Number.isInteger(error?.audit?.http_status) ? error.audit.http_status : null,
    diagnostic: safeDiagnostic(error?.audit?.probe_diagnostics)
  };
}

function sourceFileFor(tenderId) {
  const name = fs.readdirSync(SOURCE_DIR)
    .find(candidate => candidate.toLowerCase().startsWith(`${tenderId.toLowerCase()}-`) && candidate.toLowerCase().endsWith('.pdf'));
  return name ? path.relative(REPOSITORY_ROOT, path.join(SOURCE_DIR, name)).replaceAll('\\', '/') : null;
}

function buildTenderPacket(tenderId, censusRow) {
  const sourceFile = sourceFileFor(tenderId);
  if (!sourceFile) throw Object.assign(new Error(`${tenderId}: raw source PDF is unavailable`), { code: 'SOURCE_FILE_MISSING' });
  const selection = tenderId === 'TB-003'
    ? {
      type: 'controlled_paragraph_window',
      start_paragraph: censusRow.chunks[0].paragraph_start,
      end_paragraph: censusRow.chunks.at(-1).paragraph_end,
      title: censusRow.technical_section.title
    }
    : {
      type: 'classified_technical_section',
      section_key: 'technical_requirements',
      title: censusRow.technical_section.title,
      source_start_page: censusRow.technical_section.page_start,
      source_end_page: censusRow.technical_section.page_end
    };
  return {
    packet_version: 'v43-bounded-requirement-reextraction-packet-v1',
    annotation_status: 'SOURCE_ONLY_NOT_GOLD',
    tender_id: tenderId,
    title: censusRow.title,
    source_file: sourceFile,
    source_file_sha256: censusRow.file_sha256,
    source_extraction: {
      extractor: censusRow.extractor_version,
      selection
    },
    windows: [],
    gold_requirements: [],
    historical_provenance: null,
    eval_only: true,
    blind: true,
    authority_status: 'NO_AUTHORITATIVE_UPGRADE'
  };
}

export function loadBoundedTenderPackets({ censusPath = CENSUS_PATH } = {}) {
  const census = readJson(censusPath);
  return AUTHORITY_ADJUDICATION_TENDER_IDS.map(tenderId => {
    const row = census.tenders.find(item => item.tender_id === tenderId);
    if (!row) throw Object.assign(new Error(`${tenderId}: census row is unavailable`), { code: 'CENSUS_ROW_MISSING' });
    return buildTenderPacket(tenderId, row);
  });
}

function candidateRecord(tenderId, index, candidate, resolution, chunkNumber) {
  return {
    candidate_id: `${tenderId}-EXTRACT-C${String(index).padStart(3, '0')}`,
    formal_requirement_id: null,
    text: text(candidate.text).trim(),
    category: candidate.category ?? null,
    source_range: clone(candidate.source_range),
    mandatory_observed: candidate.mandatory_observed === true,
    requires_confirmation: candidate.requires_confirmation === true,
    source_verified: resolution.location.source_verified === true,
    source_match_type: resolution.location.source_match_type ?? null,
    source_excerpt: resolution.location.source_text ?? null,
    source_span: {
      start_ref: candidate.source_range?.start_ref ?? null,
      end_ref: candidate.source_range?.end_ref ?? null,
      source_start_offset: resolution.location.source_start_offset ?? null,
      source_end_offset: resolution.location.source_end_offset ?? null
    },
    chunk_number: chunkNumber,
    authority_status: 'PENDING_HUMAN_AUTHORITY',
    proposed_reconstruction: 'CANDIDATE_FOR_HUMAN_AUTHORITY',
    prior_semantic_decision: null
  };
}

function sourceIdentity(packet) {
  const file = path.resolve(REPOSITORY_ROOT, packet.source_file);
  const actual = fs.existsSync(file) ? sha256(fs.readFileSync(file)) : null;
  return {
    source_file: packet.source_file,
    declared_sha256: packet.source_file_sha256,
    actual_sha256: actual,
    sha_match: Boolean(actual && actual === packet.source_file_sha256)
  };
}

/**
 * Run one sequential Provider request per production chunk, with no retry and
 * a hard upper bound derived before the first call.  A Provider error stops
 * the remaining tenders so a failed run cannot silently become a partial
 * authority packet.
 */
export async function runBoundedRequirementReExtraction({
  packets = loadBoundedTenderPackets(),
  env = loadBackendEnvironment(),
  gateway = null,
  gatewayFactory = null,
  maxProviderCalls = null,
  now = new Date().toISOString()
} = {}) {
  const selectedGateway = gateway || (gatewayFactory
    ? gatewayFactory({ env })
    : createRequirementExtractionGateway(createSemanticGatewayClientFromEnv({ env, taskType: 'requirement_extraction' })));
  const resolver = new SourceLocationResolver();
  const tenders = [];
  let providerCalls = 0;
  let stopReason = null;
  const preflight = new Map();
  for (const packet of packets) {
    const identity = sourceIdentity(packet);
    if (!identity.sha_match) {
      preflight.set(packet.tender_id, { identity, prepared: null, error: { code: 'SOURCE_SHA_MISMATCH', message: 'raw source identity did not verify' } });
      continue;
    }
    try {
      preflight.set(packet.tender_id, { identity, prepared: await buildAnnotatedPath(packet, env), error: null });
    } catch (error) {
      preflight.set(packet.tender_id, { identity, prepared: null, error: safeError(error) });
    }
  }
  const defaultCallBudget = [...preflight.values()].reduce((sum, value) => sum + (value.prepared?.chunks?.length ?? 0), 0) || 24;
  for (const packet of packets) {
    const tender = {
      tender_id: packet.tender_id,
      source_identity: preflight.get(packet.tender_id)?.identity ?? sourceIdentity(packet),
      extraction_status: 'NOT_STARTED',
      production_chunk_count: null,
      provider_calls: 0,
      retry_count: 0,
      candidates: [],
      chunks: [],
      first_failure: null,
      authority_upgrade: 'NOT_PERFORMED'
    };
    const preparedEntry = preflight.get(packet.tender_id);
    if (!tender.source_identity.sha_match) {
      tender.extraction_status = 'BLOCKED_SOURCE_SHA_MISMATCH';
      tender.first_failure = { code: 'SOURCE_SHA_MISMATCH', message: 'raw source identity did not verify' };
      tenders.push(tender);
      stopReason = tender.first_failure;
      break;
    }
    if (!preparedEntry?.prepared) {
      tender.extraction_status = 'BLOCKED_LOCAL_PREPARATION';
      tender.first_failure = preparedEntry?.error ?? { code: 'LOCAL_PREPARATION_FAILED', message: 'production path preflight failed' };
      tenders.push(tender);
      stopReason = tender.first_failure;
      break;
    }
    const prepared = preparedEntry.prepared;
    tender.production_chunk_count = prepared.chunks.length;
    tender.extraction_status = 'RUNNING';
    const runLimit = maxProviderCalls ?? defaultCallBudget;
    for (const chunk of prepared.chunks) {
      if (providerCalls >= runLimit) {
        tender.extraction_status = 'BLOCKED_PROVIDER_CALL_BUDGET';
        tender.first_failure = { code: 'BOUNDED_PROVIDER_CALL_BUDGET_EXCEEDED', message: 'bounded call budget exceeded' };
        stopReason = tender.first_failure;
        break;
      }
      const started = Date.now();
      providerCalls += 1;
      tender.provider_calls += 1;
      try {
        const result = await selectedGateway.extract({
          fileName: packet.source_file,
          text: chunk.model_text || chunk.text,
          paragraphs: chunk.segments,
          chunk,
          projectName: packet.title,
          sectionName: packet.source_extraction.selection.title || packet.tender_id,
          chunkCount: prepared.chunks.length,
          diagnosticMode: 'probe-v1'
        });
        const diagnostics = safeDiagnostic(result.audit?.probe_diagnostics);
        const resolutions = result.candidates.map(candidate => resolver.resolve(candidate, chunk));
        mapValidatedCandidatesToCanonicalInput(result.candidates, { resolutions });
        const startIndex = tender.candidates.length + 1;
        tender.candidates.push(...result.candidates.map((candidate, index) => candidateRecord(
          packet.tender_id, startIndex + index, candidate, resolutions[index], chunk.chunk_number
        )));
        tender.chunks.push({
          chunk_number: chunk.chunk_number,
          candidate_count: result.candidates.length,
          provider_http_status: diagnostics.provider_http_status,
          provider_chain_verified: diagnostics.provider_adapter_invoked && diagnostics.fetch_invoked && diagnostics.provider_http_reached && diagnostics.provider_http_status === 200,
          diagnostic: diagnostics,
          elapsed_ms: Date.now() - started,
          response_payload_json: 'REDACTED_NOT_PERSISTED'
        });
      } catch (error) {
        const failure = safeError(error);
        tender.extraction_status = 'BLOCKED_PROVIDER_OR_CONTRACT';
        tender.first_failure = failure;
        tender.chunks.push({
          chunk_number: chunk.chunk_number,
          candidate_count: 0,
          provider_http_status: failure.http_status ?? failure.diagnostic.provider_http_status,
          diagnostic: failure.diagnostic,
          elapsed_ms: Date.now() - started,
          response_payload_json: 'REDACTED_NOT_PERSISTED'
        });
        stopReason = failure;
        break;
      }
    }
    if (tender.extraction_status === 'RUNNING') tender.extraction_status = 'PROVIDER_EXTRACTION_COMPLETE';
    tenders.push(tender);
    if (stopReason) break;
  }
  const attemptedIds = new Set(tenders.map(row => row.tender_id));
  for (const packet of packets) {
    if (!attemptedIds.has(packet.tender_id)) {
      const pendingPreflight = preflight.get(packet.tender_id);
      tenders.push({
        tender_id: packet.tender_id,
        source_identity: pendingPreflight?.identity ?? sourceIdentity(packet),
        extraction_status: 'NOT_ATTEMPTED_AFTER_FIRST_FAILURE',
        production_chunk_count: pendingPreflight?.prepared?.chunks?.length ?? null,
        provider_calls: 0,
        retry_count: 0,
        candidates: [],
        chunks: [],
        first_failure: null,
        authority_upgrade: 'NOT_PERFORMED'
      });
    }
  }
  tenders.sort((a, b) => AUTHORITY_ADJUDICATION_TENDER_IDS.indexOf(a.tender_id) - AUTHORITY_ADJUDICATION_TENDER_IDS.indexOf(b.tender_id));
  return {
    schema_version: AUTHORITY_ADJUDICATION_SCHEMA,
    checkpoint: 'V43_REAL_GOLD_V2_AUTHORITY_ADJUDICATION',
    generated_at: now,
    eval_only: true,
    blind: true,
    tender_ids: AUTHORITY_ADJUDICATION_TENDER_IDS,
    tenders,
    provider_calls: providerCalls,
    retries: 0,
    production_db_writes: 0,
    gold_mutations: 0,
    production_files_changed: 0,
    gold_files_changed: 0,
    production_semantic_changes: 0,
    formal_requirement_ids_assigned: 0,
    stop_reason: stopReason,
    prior_gold_unchanged: true,
    human_authority_required: true,
    authority_upgrade: 'NOT_PERFORMED'
  };
}

function historicalProvenanceFor(tenderId) {
  if (tenderId !== 'JY-001') return null;
  const file = path.resolve(REPOSITORY_ROOT, 'backend/eval/reports/jiangyin-full-requirement-rag-fitness-v1.json');
  if (!fs.existsSync(file)) return null;
  const artifact = readJson(file);
  return {
    artifact: path.relative(REPOSITORY_ROOT, file).replaceAll('\\', '/'),
    artifact_sha256: sha256(fs.readFileSync(file)),
    schema_version: artifact.schema_version ?? null,
    authority_status: 'NON_AUTHORITATIVE_RECONSTRUCTION_EVIDENCE',
    prior_semantic_decisions_included: false
  };
}

export function buildRequirementHumanAuthorityPacket(run) {
  return {
    schema_version: AUTHORITY_ADJUDICATION_SCHEMA,
    checkpoint: 'V43_REAL_GOLD_V2_REQUIREMENT_HUMAN_AUTHORITY_PACKET',
    generated_at: run.generated_at,
    eval_only: true,
    blind: true,
    authority_status: 'PENDING_HUMAN_AUTHORITY',
    provider_calls: run.provider_calls,
    retries: run.retries,
    production_db_writes: run.production_db_writes,
    gold_mutations: run.gold_mutations,
    tenders: run.tenders.map(tender => ({
      tender_id: tender.tender_id,
      source_identity: tender.source_identity,
      extraction_status: tender.extraction_status,
      production_chunk_count: tender.production_chunk_count,
      provider_calls: tender.provider_calls,
      retry_count: tender.retry_count,
      historical_provenance: historicalProvenanceFor(tender.tender_id),
      candidates: tender.candidates.map(candidate => ({
        ...candidate,
        human_review: {
          decision: null,
          reviewer: null,
          review_notes: null,
          authority_status: 'PENDING_HUMAN_AUTHORITY'
        }
      })),
      first_failure: tender.first_failure
    })),
    non_authoritative_notice: 'Provider candidates and historical provenance are reconstruction evidence only. No formal REQ-ID, Requirement Gold, or source authority is promoted.'
  };
}

export function renderRequirementHumanAuthorityPacket(packet) {
  const lines = [
    '# Requirement Human Authority — Bounded Re-extraction Packet',
    '',
    'Eval-only blind packet. Candidates are derived from the frozen Requirement Extraction path and require independent Human Authority review. No formal Requirement ID or Gold decision is included.',
    '',
    `Tender count: ${packet.tenders.length}`,
    ''
  ];
  for (const tender of packet.tenders) {
    lines.push(`## ${tender.tender_id}`, '', `- extraction_status: ${tender.extraction_status}`, `- declared_source_sha256: ${tender.source_identity.declared_sha256 ?? 'null'}`, `- actual_source_sha256: ${tender.source_identity.actual_sha256 ?? 'null'}`, `- source_sha_match: ${tender.source_identity.sha_match}`, `- production_chunk_count: ${tender.production_chunk_count ?? 'null'}`, `- provider_calls: ${tender.provider_calls}`, `- retry_count: ${tender.retry_count}`, `- historical_provenance: ${tender.historical_provenance ? tender.historical_provenance.artifact : 'none'}`, '');
    if (tender.first_failure) lines.push(`- first_failure_code: ${tender.first_failure.code}`, `- first_failure_message: ${tender.first_failure.message}`, '');
    for (const candidate of tender.candidates) {
      lines.push(`### ${candidate.candidate_id}`, '', `- formal_requirement_id: null`, `- category: ${candidate.category ?? 'null'}`, `- mandatory_observed: ${candidate.mandatory_observed}`, `- requires_confirmation: ${candidate.requires_confirmation}`, `- source_verified: ${candidate.source_verified}`, `- source_match_type: ${candidate.source_match_type ?? 'null'}`, `- source_range: ${JSON.stringify(candidate.source_range)}`, `- source_excerpt: ${candidate.source_excerpt ?? 'null'}`, '', '#### Candidate text', '', candidate.text, '', '#### Human authority fields', '', '- decision: PENDING', '- reviewer: PENDING', '- review_notes: PENDING', '');
    }
    if (!tender.candidates.length) lines.push('- No candidate was produced before the recorded bounded stop.', '');
  }
  lines.push('## Human review boundary', '', '- Verify each candidate against the original PDF and cited source span.', '- Historical artifacts are reconstruction evidence only.', '- Do not infer a prior expected PASS/FAIL decision.', '- Do not assign a formal REQ-ID or promote Requirement Gold in this packet.', '');
  return lines.join('\n');
}

function sourcePreview(file) {
  const body = fs.readFileSync(file, 'utf8').replaceAll('\r\n', '\n');
  return body.slice(0, MAX_PREVIEW_CHARS);
}

export function buildEnterpriseSourceAuthorityPacket({
  manifestPath = TRACK_B_MANIFEST,
  snapshotPath = SNAPSHOT,
  now = new Date().toISOString()
} = {}) {
  const manifest = readJson(manifestPath);
  const snapshot = readJson(snapshotPath);
  const snapshotById = new Map(snapshot.materials.map(row => [row.material_id, row]));
  const sources = manifest.sources.map(row => {
    const snapshotRow = snapshotById.get(row.material_id);
    const file = path.resolve(REPOSITORY_ROOT, snapshotRow?.source_asset || row.source_asset);
    return {
      source_id: row.source_id,
      material_id: row.material_id,
      subject: row.subject,
      enterprise_identity: clone(row.enterprise_identity),
      material_type: row.material_type,
      source_type: row.source_type,
      source_authority: row.source_authority,
      source_reference: row.source_reference,
      source_asset: snapshotRow?.source_asset || row.source_asset,
      source_snapshot_sha256: row.source_snapshot_sha256,
      source_snapshot_status: row.source_snapshot_status,
      source_provenance_status: row.source_provenance_status,
      retrieved_at: row.retrieved_at,
      currentness_status: row.currentness_status,
      material_lifecycle: row.material_lifecycle,
      quarantine_status: row.quarantine_status,
      projected_source_role: row.projected_source_role,
      admission_status: row.admission_status,
      chunk_count: row.chunk_count,
      chunk_identity_digest: row.chunk_identity_digest,
      source_preview: fs.existsSync(file) ? sourcePreview(file) : null,
      source_preview_sha256: fs.existsSync(file) ? sha256(sourcePreview(file)) : null,
      authority_review: {
        status: 'PENDING_HUMAN_SOURCE_AUTHORITY',
        decision: null,
        reviewer: null,
        review_notes: null
      },
      generates_evidence_fact: false,
      grants_claim_permission: false,
      requirement_derived: false,
      synthetic_test_material: false
    };
  });
  return {
    schema_version: AUTHORITY_ADJUDICATION_SCHEMA,
    checkpoint: 'V43_REAL_GOLD_V2_ENTERPRISE_SOURCE_AUTHORITY_BLIND_REVIEW_PACKET',
    generated_at: now,
    eval_only: true,
    blind: true,
    authority_status: 'PENDING_HUMAN_SOURCE_AUTHORITY',
    source_candidate_count: sources.length,
    quarantined_count: sources.filter(row => row.quarantine_status === 'QUARANTINED').length,
    sources,
    provider_calls: 0,
    production_db_writes: 0,
    gold_mutations: 0,
    production_quarantine_unchanged: true,
    non_authoritative_notice: 'Source snapshots are presented for Human Source Authority review only. This packet does not admit a Material, create an Evidence Fact, grant Claim permission, or alter quarantine.'
  };
}

export function renderEnterpriseSourceAuthorityPacket(packet) {
  const lines = [
    '# Enterprise Source Authority — Neusoft Blind Review Packet',
    '',
    'Eval-only blind packet. It contains source identity, immutable snapshot metadata, a bounded preview, and blank Human authority fields. No Fact, Mapping, Claim, Provider result, or Production decision is included.',
    '',
    `Source count: ${packet.sources.length}`,
    `Quarantined count: ${packet.quarantined_count}`,
    ''
  ];
  for (const source of packet.sources) {
    lines.push(`## ${source.source_id}`, '', `- material_id: ${source.material_id}`, `- subject: ${source.subject}`, `- enterprise_id: ${source.enterprise_identity?.enterprise_id ?? 'null'}`, `- material_type: ${source.material_type}`, `- source_type: ${source.source_type}`, `- source_authority: ${source.source_authority}`, `- source_reference: ${source.source_reference}`, `- source_asset: ${source.source_asset}`, `- source_snapshot_sha256: ${source.source_snapshot_sha256}`, `- source_snapshot_status: ${source.source_snapshot_status}`, `- source_provenance_status: ${source.source_provenance_status}`, `- material_lifecycle: ${source.material_lifecycle}`, `- quarantine_status: ${source.quarantine_status}`, `- projected_source_role: ${source.projected_source_role}`, `- admission_status: ${source.admission_status}`, `- chunk_count: ${source.chunk_count}`, `- chunk_identity_digest: ${source.chunk_identity_digest}`, `- source_preview_sha256: ${source.source_preview_sha256 ?? 'null'}`, '', '### Source preview', '', source.source_preview ?? 'SOURCE_PREVIEW_UNAVAILABLE', '', '### Human authority fields', '', '- decision: PENDING', '- reviewer: PENDING', '- review_notes: PENDING', '');
  }
  lines.push('## Boundary', '', '- Quarantine is unchanged and remains enforced.', '- Human source authority review does not itself authorize Enterprise Evidence or Fact V2.', '- No expected answer, Provider output, or Production result is included.', '');
  return lines.join('\n');
}

export function writeAuthorityAdjudicationArtifacts({ requirementRun, outputDir = AUTHORITY_ADJUDICATION_OUTPUT_DIR, now = requirementRun.generated_at } = {}) {
  const requirementPacket = buildRequirementHumanAuthorityPacket(requirementRun);
  const enterprisePacket = buildEnterpriseSourceAuthorityPacket({ now });
  const checkpoint = {
    checkpoint: 'V43_REAL_GOLD_V2_AUTHORITY_ADJUDICATION_CHECKPOINT',
    schema_version: AUTHORITY_ADJUDICATION_SCHEMA,
    generated_at: now,
    requirement_tender_count: requirementPacket.tenders.length,
    requirement_candidate_count: requirementPacket.tenders.reduce((sum, tender) => sum + tender.candidates.length, 0),
    requirement_extraction_status: requirementPacket.tenders.map(tender => ({ tender_id: tender.tender_id, status: tender.extraction_status, provider_calls: tender.provider_calls })),
    requirement_reextraction_status: requirementPacket.tenders.every(tender => tender.extraction_status === 'PROVIDER_EXTRACTION_COMPLETE')
      ? 'COMPLETE_PENDING_HUMAN_AUTHORITY'
      : 'BLOCKED_PROVIDER_OR_CONTRACT',
    requirement_human_authority_packet: requirementPacket.tenders.some(tender => tender.candidates.length > 0)
      ? 'READY_PENDING_HUMAN_AUTHORITY'
      : 'BLOCKED_NO_EXTRACTED_CANDIDATES',
    requirement_human_authority: 'PENDING',
    enterprise_source_count: enterprisePacket.source_candidate_count,
    enterprise_source_authority: 'PENDING_HUMAN_SOURCE_AUTHORITY',
    enterprise_quarantined_count: enterprisePacket.quarantined_count,
    real_fact_v2_eligible_candidates: 0,
    mapping_gold_v2: 'NOT_STARTED',
    writer_live: 'OFF',
    bid_pilot_hitl: 'OFF',
    provider_calls: requirementRun.provider_calls,
    enterprise_source_provider_calls: 0,
    retries: 0,
    production_db_writes: 0,
    gold_mutations: 0,
    production_files_changed: 0,
    gold_files_changed: 0,
    production_semantic_changes: 0,
    production_quarantine_unchanged: true,
    final_verdict: 'HUMAN_AUTHORITY_REVIEW_REQUIRED'
  };
  fs.mkdirSync(outputDir, { recursive: true });
  const files = {
    requirement_json: path.join(outputDir, 'REQUIREMENT_HUMAN_AUTHORITY_PACKET.json'),
    requirement_md: path.join(outputDir, 'REQUIREMENT_HUMAN_AUTHORITY_PACKET.md'),
    enterprise_json: path.join(outputDir, 'ENTERPRISE_SOURCE_AUTHORITY_BLIND_REVIEW_PACKET.json'),
    enterprise_md: path.join(outputDir, 'ENTERPRISE_SOURCE_AUTHORITY_BLIND_REVIEW_PACKET.md'),
    checkpoint_json: path.join(outputDir, 'V43_REAL_GOLD_V2_AUTHORITY_ADJUDICATION_CHECKPOINT.json'),
    checkpoint_md: path.join(outputDir, 'V43_REAL_GOLD_V2_AUTHORITY_ADJUDICATION_CHECKPOINT.md')
  };
  fs.writeFileSync(files.requirement_json, `${JSON.stringify(stable(requirementPacket), null, 2)}\n`);
  fs.writeFileSync(files.requirement_md, `${renderRequirementHumanAuthorityPacket(requirementPacket)}\n`);
  fs.writeFileSync(files.enterprise_json, `${JSON.stringify(stable(enterprisePacket), null, 2)}\n`);
  fs.writeFileSync(files.enterprise_md, `${renderEnterpriseSourceAuthorityPacket(enterprisePacket)}\n`);
  fs.writeFileSync(files.checkpoint_json, `${JSON.stringify(stable(checkpoint), null, 2)}\n`);
  fs.writeFileSync(files.checkpoint_md, `${[
    '# V43_REAL_GOLD_V2_AUTHORITY_ADJUDICATION_CHECKPOINT', '',
    `Requirement tenders: ${checkpoint.requirement_tender_count}`,
    `Requirement candidates: ${checkpoint.requirement_candidate_count}`,
    `Requirement statuses: ${JSON.stringify(checkpoint.requirement_extraction_status)}`,
    `Requirement re-extraction status: ${checkpoint.requirement_reextraction_status}`,
    `Requirement Human Authority packet: ${checkpoint.requirement_human_authority_packet}`,
    `Requirement Human Authority: ${checkpoint.requirement_human_authority}`,
    `Enterprise sources: ${checkpoint.enterprise_source_count}`,
    `Enterprise Source Authority: ${checkpoint.enterprise_source_authority}`,
    `Real Fact V2 eligible candidates: ${checkpoint.real_fact_v2_eligible_candidates}`,
    `Provider calls: ${checkpoint.provider_calls}`,
    `Enterprise Source Provider calls: ${checkpoint.enterprise_source_provider_calls}`,
    `Production DB writes: ${checkpoint.production_db_writes}`,
    `Gold mutations: ${checkpoint.gold_mutations}`,
    `Final verdict: ${checkpoint.final_verdict}`
  ].join('\n')}\n`);
  return { requirementPacket, enterprisePacket, checkpoint, files };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const packets = loadBoundedTenderPackets();
  const env = loadBackendEnvironment();
  runBoundedRequirementReExtraction({ packets, env })
    .then(run => {
    const output = writeAuthorityAdjudicationArtifacts({ requirementRun: run });
    console.log(JSON.stringify({
      requirement_status: run.tenders.map(tender => ({ tender_id: tender.tender_id, status: tender.extraction_status, provider_calls: tender.provider_calls, candidate_count: tender.candidates.length })),
      provider_calls: run.provider_calls,
      enterprise_source_count: output.enterprisePacket.source_candidate_count,
      enterprise_source_provider_calls: output.enterprisePacket.provider_calls,
      production_db_writes: 0,
      gold_mutations: 0,
      output_files: Object.values(output.files)
    }, null, 2));
    }).catch(error => {
    console.error(JSON.stringify({ code: error.code || 'AUTHORITY_ADJUDICATION_FAILED', message: text(error.message).slice(0, 240) }));
    process.exitCode = 1;
  });
}
