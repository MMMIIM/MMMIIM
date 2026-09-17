import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '../../..');
const CENSUS_PATH = path.join(REPO_ROOT, 'backend/eval/tender-benchmark-v1/reports/tender-benchmark-pilot-census-v1.json');
const FOUNDATION_CHECKPOINT_PATH = path.join(REPO_ROOT, 'backend/eval/gold-governance/v43-gold-v2-foundation/requirement-source-foundation-checkpoint.json');
const JY_HISTORICAL_PATH = path.join(REPO_ROOT, 'backend/eval/reports/jiangyin-full-requirement-rag-fitness-v1.json');
const OUTPUT_DIR = path.join(REPO_ROOT, 'backend/eval/gold-governance/v43-gold-v2-foundation');

export const RECONSTRUCTION_TENDER_IDS = Object.freeze(['JY-001', 'TB-003', 'FAST-04']);
export const RECONSTRUCTION_SCHEMA_VERSION = 'v43-requirement-source-reconstruction-v1';
export const BLIND_PACKET_FILE = 'REQUIREMENT_SOURCE_RECONSTRUCTION_BLIND_PACKET.json';
export const BLIND_PACKET_MARKDOWN_FILE = 'REQUIREMENT_SOURCE_RECONSTRUCTION_BLIND_PACKET.md';
export const CHECKPOINT_FILE = 'REQUIREMENT_SOURCE_RECONSTRUCTION_CHECKPOINT.json';
export const CHECKPOINT_MARKDOWN_FILE = 'REQUIREMENT_SOURCE_RECONSTRUCTION_CHECKPOINT.md';

const json = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const sha256File = file => fs.existsSync(file) ? sha256(fs.readFileSync(file)) : null;
const relative = file => path.relative(REPO_ROOT, file).replaceAll('\\', '/');
const stable = value => Array.isArray(value)
  ? value.map(stable)
  : (value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]))
    : value);

function censusIndex() {
  const census = json(CENSUS_PATH);
  return new Map((census.tenders ?? []).map(row => [row.tender_id, row]));
}

function sourceIdentity(tenderId, census) {
  const sourceDir = path.join(REPO_ROOT, 'backend/eval/tender-benchmark-v1/sources');
  const sourceName = fs.existsSync(sourceDir)
    ? fs.readdirSync(sourceDir).find(name => name.toLowerCase().startsWith(`${tenderId.toLowerCase()}-`) && name.toLowerCase().endsWith('.pdf'))
    : null;
  const sourceFile = census?.source_file
    ? path.resolve(REPO_ROOT, census.source_file)
    : (sourceName ? path.join(sourceDir, sourceName) : path.join(sourceDir, `${tenderId}.pdf`));
  const actualSha = sha256File(sourceFile);
  return {
    tender_id: tenderId,
    title: census?.title ?? null,
    source_file: fs.existsSync(sourceFile) ? relative(sourceFile) : null,
    source_file_sha256: census?.file_sha256 ?? null,
    actual_source_file_sha256: actualSha,
    source_hash_match: actualSha !== null && actualSha === census?.file_sha256,
    official_source_type: census?.official_source_type ?? null,
    official_source_verified: census?.official_source_verified === true,
    source_identity_status: actualSha !== null && actualSha === census?.file_sha256
      ? 'CONFIRMED_RAW_SOURCE_IDENTITY'
      : 'SOURCE_IDENTITY_NOT_VERIFIED'
  };
}

function existingFoundationIdentity(tenderId) {
  if (!fs.existsSync(FOUNDATION_CHECKPOINT_PATH)) return null;
  const foundation = json(FOUNDATION_CHECKPOINT_PATH);
  return foundation.requirement_source?.tender_sources?.find(row => row.tender_id === tenderId)?.source_identity ?? null;
}

function historicalProvenance() {
  if (!fs.existsSync(JY_HISTORICAL_PATH)) return null;
  const artifact = json(JY_HISTORICAL_PATH);
  return {
    artifact: relative(JY_HISTORICAL_PATH),
    artifact_sha256: sha256File(JY_HISTORICAL_PATH),
    schema_version: artifact.schema_version ?? null,
    evaluation_only: artifact.evaluation_only === true,
    source_file_name: artifact.source?.file_name ?? null,
    parse_job_id: artifact.source?.parse_job_id ?? null,
    extraction_text_sha256: artifact.source?.extraction_text_sha256 ?? null,
    extractor_version: artifact.source?.extractor_version ?? null,
    canonical_requirement_count_observed: artifact.extraction_quality?.canonical_requirement_count ?? null,
    authority_status: 'NON_AUTHORITATIVE_RECONSTRUCTION_EVIDENCE',
    human_authority: 'NOT_PRESENT_IN_ARTIFACT'
  };
}

function mapJiangyinRequirement(row, identity, provenance) {
  const actual = row.source_audit?.actual ?? {};
  return {
    candidate_id: `JY-001:${row.req_id}`,
    requirement: {
      requirement_id: null,
      historical_requirement_id: row.req_id ?? null,
      text: row.summary ?? null,
      category: row.type ?? null,
      mandatory_observed: row.mandatory === true,
      requires_confirmation_observed: row.requires_confirmation === true
    },
    source: {
      source_file: identity.source_file,
      source_file_sha256: identity.source_file_sha256,
      source_span: {
        page_start: actual.page_start ?? row.source_page ?? null,
        page_end: actual.page_end ?? row.source_page ?? null,
        paragraph_start: actual.paragraph_start ?? null,
        paragraph_end: actual.paragraph_end ?? null,
        clause: actual.source_clause ?? row.source_clause ?? null
      },
      source_span_hash: actual.source_hash ?? null,
      exact_source_text: null,
      source_text_capture_status: 'NOT_CAPTURED_IN_HISTORICAL_ARTIFACT',
      human_source_check_required: true
    },
    historical_provenance: {
      ...provenance,
      historical_source_audit: 'SOURCE_AUDIT_RECORDED_AS_CORRECT',
      historical_source_match_type: row.source_audit?.match_type ?? null
    },
    ambiguity_or_conflict: {
      status: row.source_audit?.warning ? 'SOURCE_LOCATION_WARNING_REQUIRES_HUMAN_CHECK' : 'NO_RECORDED_COMPETING_SOURCE_IN_HISTORICAL_AUDIT',
      warning: row.source_audit?.warning ?? null,
      source_location_match_type: row.source_audit?.match_type ?? null,
      notes: 'Historical source audit is reconstruction evidence only; no authoritative packet or human decision is inferred.'
    },
    proposed_reconstruction: {
      requirement_text: row.summary ?? null,
      formal_requirement_id: null,
      status: 'CANDIDATE_FOR_HUMAN_RECONSTRUCTION',
      authority_decision: 'PENDING_HUMAN_AUTHORITY'
    }
  };
}

function mapBlockedHistoricalRow(row, identity, provenance) {
  const actual = row.source_audit?.actual ?? {};
  return {
    candidate_id: `JY-001:${row.req_id}`,
    historical_requirement_id: row.req_id ?? null,
    candidate_text: row.summary ?? null,
    source: {
      source_file: identity.source_file,
      source_file_sha256: identity.source_file_sha256,
      source_span: {
        page_start: actual.page_start ?? row.source_page ?? null,
        page_end: actual.page_end ?? row.source_page ?? null,
        paragraph_start: actual.paragraph_start ?? null,
        paragraph_end: actual.paragraph_end ?? null,
        clause: actual.source_clause ?? row.source_clause ?? null
      },
      source_span_hash: actual.source_hash ?? null,
      exact_source_text: null,
      source_text_capture_status: 'NOT_CAPTURED_IN_HISTORICAL_ARTIFACT'
    },
    historical_provenance: {
      ...provenance,
      historical_source_audit: 'SOURCE_AUDIT_NOT_CLEAR',
      historical_source_match_type: row.source_audit?.match_type ?? null
    },
    blocker: 'HISTORICAL_SOURCE_AUDIT_REQUIRES_HUMAN_RECONSTRUCTION'
  };
}

function buildJiangyinTender(identity) {
  const provenance = historicalProvenance();
  const historicalRows = provenance ? (json(JY_HISTORICAL_PATH).per_requirement_fitness ?? []) : [];
  const candidateRequirements = historicalRows
    .filter(row => row.source_audit?.status === 'correct' && row.source_audit?.actual?.source_hash)
    .map(row => mapJiangyinRequirement(row, identity, provenance));
  const blockedRows = historicalRows
    .filter(row => !(row.source_audit?.status === 'correct' && row.source_audit?.actual?.source_hash))
    .map(row => mapBlockedHistoricalRow(row, identity, provenance));
  return {
    tender_id: 'JY-001',
    source_identity: identity,
    classification: 'B_HUMAN_RECONSTRUCTION_POSSIBLE',
    reconstruction_status: 'CANDIDATE_PACKET_READY_FOR_HUMAN_AUTHORITY',
    historical_provenance: provenance,
    candidate_requirements: candidateRequirements,
    blocked_historical_rows: blockedRows,
    candidate_count: candidateRequirements.length,
    blocked_historical_count: blockedRows.length,
    human_authority: 'REQUIRED',
    authority_upgrade: 'NOT_PERFORMED'
  };
}

function buildRawOnlyTender(tenderId, identity) {
  return {
    tender_id: tenderId,
    source_identity: identity,
    classification: 'C_REEXTRACTION_REQUIRED',
    reconstruction_status: 'BLOCKED_RAW_SOURCE_ONLY',
    historical_provenance: null,
    candidate_requirements: [],
    blocked_historical_rows: [],
    candidate_count: 0,
    blocked_historical_count: 0,
    reconstruction_blocker: 'NO_HISTORICAL_PACKET_OR_SOURCE_INDEX',
    reextraction_authorization: 'NOT_AUTHORIZED',
    human_authority: 'REQUIRED_AFTER_SOURCE_PACKET_OR_MANUAL_RECONSTRUCTION',
    authority_upgrade: 'NOT_PERFORMED'
  };
}

export function buildRequirementReconstructionFoundation({ outputDir = OUTPUT_DIR, write = true, now = new Date().toISOString() } = {}) {
  const census = censusIndex();
  const tenders = RECONSTRUCTION_TENDER_IDS.map(tenderId => {
    const identity = sourceIdentity(tenderId, census.get(tenderId));
    const foundationIdentity = existingFoundationIdentity(tenderId);
    const resolvedIdentity = foundationIdentity
      ? { ...identity, foundation_source_identity: foundationIdentity }
      : identity;
    return tenderId === 'JY-001' ? buildJiangyinTender(resolvedIdentity) : buildRawOnlyTender(tenderId, resolvedIdentity);
  });
  const sourceClassifications = Object.fromEntries(tenders.map(row => [row.tender_id, row.classification]));
  const packet = {
    schema_version: RECONSTRUCTION_SCHEMA_VERSION,
    checkpoint: 'V43_REAL_GOLD_V2_REQUIREMENT_RECONSTRUCTION_BLIND_PACKET',
    generated_at: now,
    eval_only: true,
    blind: true,
    data_classification: 'REAL_TENDER_SOURCE_RECONSTRUCTION_CANDIDATE',
    authority_status: 'NO_AUTHORITATIVE_UPGRADE',
    tender_ids: RECONSTRUCTION_TENDER_IDS,
    tenders: tenders.map(row => ({
      tender_id: row.tender_id,
      classification: row.classification,
      source_identity: row.source_identity,
      reconstruction_status: row.reconstruction_status,
      historical_provenance: row.historical_provenance,
      candidate_requirements: row.candidate_requirements,
      blocked_historical_rows: row.blocked_historical_rows,
      candidate_count: row.candidate_count,
      blocked_historical_count: row.blocked_historical_count,
      reconstruction_blocker: row.reconstruction_blocker ?? null,
      reextraction_authorization: row.reextraction_authorization ?? null,
      human_authority: row.human_authority,
      authority_upgrade: row.authority_upgrade
    })),
    non_authoritative_notice: 'All candidate text and historical coordinates require independent Human Authority review. This packet does not promote a Requirement, assign a formal REQ-ID, or create Gold.'
  };
  const sourceBCount = tenders.filter(row => row.classification === 'B_HUMAN_RECONSTRUCTION_POSSIBLE').length;
  const sourceCCount = tenders.filter(row => row.classification === 'C_REEXTRACTION_REQUIRED').length;
  const result = {
    schema_version: RECONSTRUCTION_SCHEMA_VERSION,
    checkpoint: 'V43_REAL_GOLD_V2_REQUIREMENT_RECONSTRUCTION_CHECKPOINT',
    generated_at: now,
    eval_only: true,
    blind: true,
    tender_ids: RECONSTRUCTION_TENDER_IDS,
    source_classifications: sourceClassifications,
    source_a_count: 3,
    initial_source_b_count: 3,
    source_b_count: sourceBCount,
    source_c_count: sourceCCount,
    packet_ready_tender_count: tenders.filter(row => row.candidate_count > 0).length,
    total_candidate_requirements: tenders.reduce((sum, row) => sum + row.candidate_count, 0),
    total_blocked_historical_rows: tenders.reduce((sum, row) => sum + row.blocked_historical_count, 0),
    gates: {
      SIX_TENDER_SOURCE_PARITY: 'BLOCKED_HUMAN_AUTHORITY_PENDING',
      REQUIREMENT_SOURCE_A_COUNT: 3,
      REQUIREMENT_SOURCE_B_COUNT: sourceBCount,
      SAFE_TO_START_HUMAN_REQUIREMENT_RECONSTRUCTION: packet_ready_tender_count(tenders) > 0 ? 'YES' : 'NO',
      SAFE_TO_PROMOTE_REQUIREMENT_AUTHORITY: 'NO'
    },
    provider_calls: 0,
    db_writes: 0,
    gold_mutations: 0,
    production_semantic_changes: 0,
    output_files: [BLIND_PACKET_FILE, BLIND_PACKET_MARKDOWN_FILE, CHECKPOINT_FILE, CHECKPOINT_MARKDOWN_FILE],
    packet
  };
  const completed = { ...result, tenders };
  if (write) writeArtifacts(outputDir, completed, packet);
  return completed;
}

function packet_ready_tender_count(tenders) {
  return tenders.filter(row => row.candidate_count > 0).length;
}

export function renderBlindReconstructionPacket(result) {
  const lines = [
    '# Requirement Source Reconstruction — Blind Human Packet',
    '',
    'Eval-only reconstruction candidates. Historical rows and source coordinates are evidence for Human Authority review; no Requirement, formal REQ-ID, or Gold decision is promoted.',
    '',
    `Tender count: ${result.tenders.length}`,
    ''
  ];
  for (const tender of result.tenders) {
    lines.push(`## ${tender.tender_id}`, '', `- classification: ${tender.classification}`, `- reconstruction_status: ${tender.reconstruction_status}`, `- source_file_sha256: ${tender.source_identity.source_file_sha256 ?? 'null'}`, `- actual_source_file_sha256: ${tender.source_identity.actual_source_file_sha256 ?? 'null'}`, `- source_hash_match: ${tender.source_identity.source_hash_match}`, `- human_authority: ${tender.human_authority}`, `- authority_upgrade: ${tender.authority_upgrade}`, `- candidate_count: ${tender.candidate_count}`, `- blocked_historical_count: ${tender.blocked_historical_count}`, '');
    if (tender.reconstruction_blocker) lines.push(`- reconstruction_blocker: ${tender.reconstruction_blocker}`, `- reextraction_authorization: ${tender.reextraction_authorization}`, '');
    if (tender.historical_provenance) {
      lines.push('### Historical provenance', '', `- artifact: ${tender.historical_provenance.artifact}`, `- artifact_sha256: ${tender.historical_provenance.artifact_sha256}`, `- parse_job_id: ${tender.historical_provenance.parse_job_id ?? 'null'}`, `- extraction_text_sha256: ${tender.historical_provenance.extraction_text_sha256 ?? 'null'}`, `- authority_status: ${tender.historical_provenance.authority_status}`, '');
    }
    for (const row of tender.candidate_requirements.slice(0, 250)) {
      lines.push(`### Candidate ${row.candidate_id}`, '', `- historical_requirement_id: ${row.requirement.historical_requirement_id}`, `- formal_requirement_id: null`, `- category: ${row.requirement.category ?? 'null'}`, `- mandatory_observed: ${row.requirement.mandatory_observed}`, `- requires_confirmation_observed: ${row.requirement.requires_confirmation_observed}`, `- source_file_sha256: ${row.source.source_file_sha256}`, `- source_span: ${JSON.stringify(row.source.source_span)}`, `- source_span_hash: ${row.source.source_span_hash}`, `- exact_source_text: null`, `- source_text_capture_status: ${row.source.source_text_capture_status}`, `- ambiguity_or_conflict: ${row.ambiguity_or_conflict.status}`, `- proposed_reconstruction_status: ${row.proposed_reconstruction.status}`, '', '#### Candidate requirement text', '', row.requirement.text ?? '', '', '#### Human review instruction', '', 'Compare the candidate text against the cited source span in the original source. Record authority separately; this packet contains no prior semantic decision.', '');
    }
    if (tender.blocked_historical_rows.length) lines.push('### Historical rows withheld from reconstruction candidates', '', `- count: ${tender.blocked_historical_rows.length}`, '- reason: historical source audit is not clear; Human must not treat these rows as source-confirmed.', '');
    if (tender.candidate_requirements.length === 0) lines.push('### Human review blocker', '', '- No historical Requirement packet or source index is available in the current artifact universe.', '- A new source packet or separately authorized manual reconstruction is required; no automatic extraction is started.', '');
  }
  lines.push('## Boundary', '', '- This packet is blind to prior semantic decisions and Provider outputs.', '- No formal Requirement IDs are assigned.', '- No source text is synthesized from missing content.', '- Human Authority is required before any later source-parity or Gold decision.', '');
  return lines.join('\n');
}

function renderCheckpoint(result) {
  return [
    '# Requirement Source Reconstruction Checkpoint', '',
    `Generated: ${result.generated_at}`, `Schema: ${result.schema_version}`,
    '', '## Status', '',
    `- source_classifications: ${JSON.stringify(result.source_classifications)}`,
    `- source_a_count: ${result.source_a_count}`,
    `- initial_source_b_count: ${result.initial_source_b_count}`,
    `- source_b_count: ${result.source_b_count}`,
    `- source_c_count: ${result.source_c_count}`,
    `- packet_ready_tender_count: ${result.packet_ready_tender_count}`,
    `- total_candidate_requirements: ${result.total_candidate_requirements}`,
    `- total_blocked_historical_rows: ${result.total_blocked_historical_rows}`,
    `- SIX_TENDER_SOURCE_PARITY: ${result.gates.SIX_TENDER_SOURCE_PARITY}`,
    `- SAFE_TO_START_HUMAN_REQUIREMENT_RECONSTRUCTION: ${result.gates.SAFE_TO_START_HUMAN_REQUIREMENT_RECONSTRUCTION}`,
    `- SAFE_TO_PROMOTE_REQUIREMENT_AUTHORITY: ${result.gates.SAFE_TO_PROMOTE_REQUIREMENT_AUTHORITY}`,
    '', '## Side effects', '',
    '- provider_calls: 0', '- db_writes: 0', '- gold_mutations: 0', '- production_semantic_changes: 0',
    '', '## Human decisions required', '',
    '- Human Authority must verify each candidate text against its source span.',
    '- JY-001 has a candidate packet but no authority upgrade.',
    '- TB-003 and FAST-04 remain blocked because only raw source identity is available.',
    '- SIX_TENDER_SOURCE_PARITY remains blocked pending Human Authority and complete authoritative packets.', ''
  ].join('\n');
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(stable(value), null, 2)}\n`, 'utf8');
}

function writeArtifacts(outputDir, result, packet) {
  writeJson(path.join(outputDir, BLIND_PACKET_FILE), packet);
  fs.writeFileSync(path.join(outputDir, BLIND_PACKET_MARKDOWN_FILE), `${renderBlindReconstructionPacket(result)}\n`, 'utf8');
  const { tenders: _tenders, packet: _packet, ...checkpoint } = result;
  writeJson(path.join(outputDir, CHECKPOINT_FILE), checkpoint);
  fs.writeFileSync(path.join(outputDir, CHECKPOINT_MARKDOWN_FILE), `${renderCheckpoint(result)}\n`, 'utf8');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = buildRequirementReconstructionFoundation();
  console.log(JSON.stringify({
    source_classifications: result.source_classifications,
    candidate_requirements: result.total_candidate_requirements,
    blocked_historical_rows: result.total_blocked_historical_rows,
    gates: result.gates,
    provider_calls: result.provider_calls,
    db_writes: result.db_writes,
    gold_mutations: result.gold_mutations,
    output_files: result.output_files
  }, null, 2));
}
