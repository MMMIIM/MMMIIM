import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { chunkEnterpriseMaterial } from '../../src/pipeline/enterprise-material-chunker.js';
import { buildRealFactV2Foundation } from './real-fact-v2-foundation.js';
import { computeSourceHash } from '../gold-human-review/v2/mapping-real-rebuild/real-enterprise-source-import-harness.js';

/**
 * Track B is intentionally an Eval-only adapter around the existing source
 * snapshot and Real Fact V2 admission foundation.  It does not import a
 * Material, create a Fact, or change the source-role projection.
 */
export const TRACK_B_SCHEMA_VERSION = 'v43-real-gold-v2-source-fact-closure-v1';
export const TRACK_B_CHECKPOINT = 'V43_REAL_GOLD_V2_SOURCE_AND_FACT_CLOSURE_TRACK_B_CHECKPOINT';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = path.resolve(HERE, '../../..');
const CORPUS_MANIFEST = path.resolve(REPOSITORY_ROOT, 'backend/eval/semantic-boundary/corpus-manifest-v1.json');
const SNAPSHOT = path.resolve(REPOSITORY_ROOT, 'backend/eval/semantic-boundary/snapshot-v1.partial.json');
const PROJECTION = path.resolve(REPOSITORY_ROOT, 'backend/eval/gold-human-review/v2/mapping-real-rebuild/00_source_role_projection.json');
const DEFAULT_OUTPUT_DIR = path.join(HERE, 'v43-real-gold-v2-source-fact-closure');

const text = value => value == null ? '' : String(value);
const sha256 = value => crypto.createHash('sha256').update(text(value), 'utf8').digest('hex');
const stable = value => Array.isArray(value)
  ? value.map(stable)
  : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]))
    : value;

function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }

function parseFrontMatter(body) {
  const match = /^---\n([\s\S]*?)\n---/u.exec(body);
  const result = {};
  for (const line of (match?.[1] ?? '').split('\n')) {
    const separator = line.indexOf(':');
    if (separator <= 0) continue;
    result[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
  }
  return result;
}

function digestChunkIdentity(chunks) {
  return sha256(JSON.stringify(chunks.map(chunk => ({
    chunk_id: chunk.chunk_id,
    chunk_hash: chunk.chunk_hash,
    char_start: chunk.char_start,
    char_end: chunk.char_end
  }))));
}

function sourceId(material) {
  return `REAL-NEUSOFT-${material.material_id}`;
}

function sourceRow(material, snapshotMaterial, corpusEntry, projection, body) {
  const sourceAsset = path.resolve(REPOSITORY_ROOT, snapshotMaterial.source_asset);
  const normalized = body.replaceAll('\r\n', '\n');
  const actualHash = computeSourceHash(normalized);
  const snapshotHash = text(snapshotMaterial.file_hash).trim();
  const manifestHash = text(corpusEntry.file_hash).trim();
  const projected = (projection.materials ?? []).find(row => row.material_id === material.material_id);
  const chunks = chunkEnterpriseMaterial(material.material_id, normalized);
  const metadata = parseFrontMatter(normalized);
  const integrityErrors = [];
  if (actualHash !== snapshotHash) integrityErrors.push('SNAPSHOT_FILE_HASH_MISMATCH');
  if (actualHash !== manifestHash) integrityErrors.push('CORPUS_MANIFEST_HASH_MISMATCH');
  if (!fs.existsSync(sourceAsset)) integrityErrors.push('SOURCE_SNAPSHOT_FILE_MISSING');
  const projectedRole = projected?.derived_source_role ?? 'NOT_IN_SOURCE_ROLE_PROJECTION';
  const lifecycle = String(projected?.lifecycle_status ?? 'UNKNOWN').toUpperCase();
  const quarantine = projectedRole === 'QUARANTINED' || lifecycle === 'QUARANTINED';
  const blockingReasons = [];
  if (integrityErrors.length) blockingReasons.push(...integrityErrors);
  if (quarantine) blockingReasons.push('MATERIAL_AUTHORITY_QUARANTINED');
  if (projectedRole !== 'REAL_ENTERPRISE_EVIDENCE_CANDIDATE') blockingReasons.push('MATERIAL_AUTHORITY_ROLE_NOT_ENTERPRISE_CANDIDATE');
  return {
    source_id: sourceId(material),
    material_id: material.material_id,
    subject: corpusEntry.subject,
    enterprise_identity: {
      enterprise_id: 'NEUSOFT',
      enterprise_name: corpusEntry.subject,
      identity_status: 'RESOLVED_FROM_SOURCE_METADATA'
    },
    knowledge_origin: corpusEntry.knowledge_origin,
    source_type: corpusEntry.source_type,
    // The corpus manifest intentionally stores roles/topics, while the
    // immutable snapshot carries the upload material type. Keep this
    // projection explicit instead of guessing from a filename or role.
    material_type: snapshotMaterial.material_type ?? corpusEntry.material_type ?? null,
    source_authority: corpusEntry.source_authority,
    source_reference: corpusEntry.source_reference,
    source_asset: snapshotMaterial.source_asset,
    retrieved_at: metadata.retrieved_at ?? null,
    source_snapshot_sha256: actualHash,
    declared_snapshot_sha256: snapshotHash,
    corpus_manifest_sha256: manifestHash,
    source_snapshot_status: integrityErrors.length ? 'INVALID' : 'IMMUTABLE_VERIFIED',
    source_provenance_status: corpusEntry.source_reference ? 'RESOLVABLE' : 'MISSING',
    currentness_status: corpusEntry.validity_applicability ?? 'REVIEW_REQUIRED',
    independent_from_requirement: true,
    requirement_derived: false,
    synthetic_test_material: false,
    material_lifecycle: lifecycle,
    projected_source_role: projectedRole,
    quarantine_status: quarantine ? 'QUARANTINED' : 'NOT_QUARANTINED',
    admission_status: blockingReasons.length ? 'BLOCKED' : 'CANDIDATE_FOR_HUMAN_FACT_REVIEW',
    blocking_reasons: [...new Set(blockingReasons)],
    chunk_count: chunks.length,
    chunk_identity_digest: digestChunkIdentity(chunks),
    chunk_lineage_status: chunks.every(chunk => chunk.material_id === material.material_id && chunk.source_text) ? 'VERIFIED' : 'INVALID',
    review_status: corpusEntry.review_status,
    generates_evidence_fact: false,
    grants_claim_permission: false
  };
}

function candidateForFoundation(row) {
  return {
    source_id: row.source_id,
    material_id: row.material_id,
    enterprise_id: row.enterprise_identity.enterprise_id,
    enterprise_name: row.enterprise_identity.enterprise_name,
    source_type: row.source_type,
    material_type: row.material_type,
    expected_source_authority: row.source_authority,
    source_url: row.source_reference,
    retrieved_at: row.retrieved_at,
    source_org: row.subject,
    source_hash: row.source_snapshot_sha256,
    review_status: 'PENDING_HUMAN_FACT_REVIEW',
    lifecycle_status: row.material_lifecycle,
    synthetic_test_material: row.synthetic_test_material,
    requirement_derived: row.requirement_derived,
    independent_from_requirement: row.independent_from_requirement,
    quarantined: row.quarantine_status === 'QUARANTINED'
  };
}

function renderManifest(manifest) {
  const lines = [
    '# V43 Real Gold V2 Source / Fact Closure — Track B',
    '',
    'Eval-only source inventory. Source snapshots are not Enterprise Facts and no production authority is created.',
    '',
    `Source candidates: ${manifest.source_candidate_count}`,
    `Authority-eligible candidates: ${manifest.authority_eligible_count}`,
    `Real Fact V2 candidates for Human review: ${manifest.real_fact_v2_eligible_candidates}`,
    ''
  ];
  for (const row of manifest.sources) {
    lines.push(`## ${row.source_id}`, `- material_id: ${row.material_id}`, `- material_type: ${row.material_type}`, `- source_authority: ${row.source_authority}`, `- source_reference: ${row.source_reference}`, `- source_snapshot_sha256: ${row.source_snapshot_sha256}`, `- source_snapshot_status: ${row.source_snapshot_status}`, `- material_lifecycle: ${row.material_lifecycle}`, `- projected_source_role: ${row.projected_source_role}`, `- admission_status: ${row.admission_status}`, `- blocking_reasons: ${JSON.stringify(row.blocking_reasons)}`, `- chunk_count: ${row.chunk_count}`, `- chunk_identity_digest: ${row.chunk_identity_digest}`, `- generates_evidence_fact: ${row.generates_evidence_fact}`, `- grants_claim_permission: ${row.grants_claim_permission}`, '');
  }
  lines.push('## Corpus / authority gaps', '', ...manifest.corpus_gaps.map(gap => `- ${gap}`), '', 'Human Fact adjudication and Fact promotion are not performed by this artifact.');
  return lines.join('\n');
}

function renderBlindPacket(packet) {
  const lines = [
    '# V43 Real Fact V2 Blind Human Review Packet — Track B',
    '',
    'Blind Eval-only packet. It contains only sources that pass mechanical authority admission; no expected decision, Fact, Mapping, Claim, Provider, or Production result is included.',
    '',
    `Packet status: ${packet.status}`,
    `Sources: ${packet.sources.length}`,
    ''
  ];
  for (const row of packet.sources) {
    lines.push(`## ${row.source_id}`, `- material_id: ${row.material_id}`, `- subject: ${row.subject}`, `- material_type: ${row.material_type}`, `- source_reference: ${row.source_reference}`, `- source_snapshot_sha256: ${row.source_snapshot_sha256}`, `- source_snapshot_status: ${row.source_snapshot_status}`, `- retrieved_at: ${row.retrieved_at ?? 'null'}`, `- currentness_status: ${row.currentness_status}`, `- chunk_count: ${row.chunk_count}`, `- chunk_identity_digest: ${row.chunk_identity_digest}`, '');
  }
  lines.push('No expected answer, Provider output, or Production result is included.');
  return lines.join('\n');
}

function renderReport(result) {
  const { manifest, packet, checkpoint } = result;
  return [
    '# V43 Real Gold V2 Source / Fact Closure — Track B Report',
    '',
    'This report is Eval-only. It records source admission evidence and does not authorize a Material, Fact, Mapping, Claim, or Writer result.',
    '',
    '## Result',
    '',
    `- real enterprise source candidates: ${manifest.source_candidate_count}`,
    `- authority-eligible sources: ${manifest.authority_eligible_count}`,
    `- REAL_FACT_V2_ELIGIBLE_CANDIDATES: ${manifest.real_fact_v2_eligible_candidates}`,
    `- blind packet: ${packet.status}`,
    `- source snapshot SHA gate: ${checkpoint.source_snapshot_sha_gate}`,
    `- provenance gate: ${checkpoint.source_provenance_gate}`,
    `- enterprise identity gate: ${checkpoint.enterprise_identity_gate}`,
    `- requirement independence gate: ${checkpoint.requirement_independence_gate}`,
    `- Material Authority quarantine gate: ${checkpoint.quarantine_gate}`,
    '',
    '## Root cause / gaps',
    '',
    '- The four existing Neusoft public snapshots are immutable, independently sourced, non-synthetic files and their chunk lineage hashes verify.',
    '- The current Material Authority projection classifies all four corresponding materials as QUARANTINED rather than REAL_ENTERPRISE_EVIDENCE_CANDIDATE.',
    '- Existing Real Fact V2 admission correctly rejects quarantined sources; this task does not re-authorize or rewrite those materials.',
    '- A current, non-quarantined, authority-eligible enterprise source is still required before Human Fact V2 review can begin.',
    '',
    '## Next decisions required',
    '',
    '- HUMAN_DECISION_REQUIRED: resolve whether a future independent enterprise source may be admitted through the existing Material Authority lifecycle.',
    '- CORPUS_GAP: quantitative performance, compatibility, acceptance, personnel, delivery/service, contract, and implementation evidence remain unfilled by this source set.',
    '- This task does not generate a Fact, promote Gold, or call a Provider.',
    ''
  ].join('\n');
}

/** Build the Track B source inventory without any persistence or external call. */
export function buildTrackBSourceFactClosure({ outputDir = DEFAULT_OUTPUT_DIR, now = '2026-09-04T00:00:00.000Z' } = {}) {
  const corpus = readJson(CORPUS_MANIFEST);
  const snapshot = readJson(SNAPSHOT);
  const projection = readJson(PROJECTION);
  const snapshotMaterials = new Map(snapshot.materials.map(row => [row.material_id, row]));
  const sources = [];
  const sourceBodies = new Map();
  for (const corpusEntry of corpus.materials.filter(row => row.knowledge_origin === 'enterprise_real_public')) {
    const snapshotMaterial = snapshotMaterials.get(corpusEntry.material_id);
    if (!snapshotMaterial) continue;
    const file = path.resolve(REPOSITORY_ROOT, snapshotMaterial.source_asset);
    const body = fs.readFileSync(file, 'utf8').replaceAll('\r\n', '\n');
    const row = sourceRow(corpusEntry, snapshotMaterial, corpusEntry, projection, body);
    sources.push(row);
    sourceBodies.set(row.source_id, { text: body, hash: row.source_snapshot_sha256 });
  }
  const foundation = buildRealFactV2Foundation({ candidates: sources.map(candidateForFoundation), snapshots: sourceBodies, outputDir: null });
  const admittedIds = new Set(foundation.manifest.candidates.map(row => row.source_id));
  const corpusGaps = [];
  for (const materialType of ['product_documentation', 'qualification', 'project_case']) {
    if (!sources.some(row => row.material_type === materialType && row.admission_status === 'CANDIDATE_FOR_HUMAN_FACT_REVIEW')) corpusGaps.push(`CORPUS_GAP:${materialType}`);
  }
  if (sources.some(row => row.blocking_reasons.includes('MATERIAL_AUTHORITY_QUARANTINED'))) corpusGaps.push('SOURCE_AUTHORITY_GAP:MATERIAL_AUTHORITY_QUARANTINE_REQUIRES_LIFECYCLE_DECISION');
  const manifest = {
    schema_version: TRACK_B_SCHEMA_VERSION,
    checkpoint: TRACK_B_CHECKPOINT,
    eval_only: true,
    generated_at: now,
    source_candidate_count: sources.length,
    authority_eligible_count: sources.filter(row => row.admission_status === 'CANDIDATE_FOR_HUMAN_FACT_REVIEW').length,
    real_fact_v2_eligible_candidates: foundation.eligibleCount,
    sources,
    admission_audit: foundation.manifest.admission_audit,
    rejection_audit: foundation.manifest.rejection_audit,
    corpus_gaps: [...new Set(corpusGaps)],
    provider_calls: 0,
    production_db_writes: 0,
    gold_mutations: 0,
    production_files_changed: 0,
    source_snapshot_mutations: 0
  };
  const packet = {
    schema_version: TRACK_B_SCHEMA_VERSION,
    eval_only: true,
    blind: true,
    status: foundation.eligibleCount > 0 ? 'SOURCE_READY_FOR_HUMAN_FACT_REVIEW' : 'BLOCKED_NO_ELIGIBLE_REAL_ENTERPRISE_SOURCE',
    sources: sources.filter(row => admittedIds.has(row.source_id)),
    rejected_source_ids: sources.filter(row => !admittedIds.has(row.source_id)).map(row => row.source_id),
    corpus_gaps: manifest.corpus_gaps,
    provider_calls: 0,
    production_db_writes: 0,
    gold_mutations: 0
  };
  const checkpoint = {
    checkpoint: TRACK_B_CHECKPOINT,
    schema_version: TRACK_B_SCHEMA_VERSION,
    generated_at: now,
    source_candidate_count: manifest.source_candidate_count,
    real_enterprise_source_candidates: manifest.source_candidate_count,
    real_enterprise_source_eligible: manifest.authority_eligible_count,
    real_fact_v2_eligible_candidates: manifest.real_fact_v2_eligible_candidates,
    real_fact_v2_blind_packet: packet.status,
    source_readiness: packet.status === 'SOURCE_READY_FOR_HUMAN_FACT_REVIEW' ? 'SOURCE_READY_FOR_HUMAN_FACT_REVIEW' : 'BLOCKED_NO_ELIGIBLE_REAL_ENTERPRISE_SOURCE',
    source_snapshot_sha_gate: sources.every(row => row.source_snapshot_status === 'IMMUTABLE_VERIFIED') ? 'PASS' : 'FAIL',
    source_provenance_gate: sources.every(row => row.source_provenance_status === 'RESOLVABLE') ? 'PASS' : 'FAIL',
    enterprise_identity_gate: sources.every(row => row.enterprise_identity.identity_status === 'RESOLVED_FROM_SOURCE_METADATA') ? 'PASS' : 'FAIL',
    requirement_independence_gate: sources.every(row => row.independent_from_requirement && !row.requirement_derived) ? 'PASS' : 'FAIL',
    quarantine_gate: sources.every(row => row.quarantine_status === 'NOT_QUARANTINED') ? 'PASS' : 'FAIL',
    provider_calls: 0,
    production_db_writes: 0,
    gold_mutations: 0,
    production_files_changed: 0,
    corpus_gaps: manifest.corpus_gaps,
    source_authority_gaps: sources.flatMap(row => row.blocking_reasons.filter(reason => reason.includes('AUTHORITY'))),
    human_decision_required: sources.map(row => `${row.source_id}: HUMAN_FACT_REVIEW_REQUIRED_AFTER_AUTHORITY_ADMISSION`),
    final_verdict: packet.status === 'SOURCE_READY_FOR_HUMAN_FACT_REVIEW' ? 'REAL_FACT_V2_HUMAN_REVIEW_PACKET_READY' : 'BLOCKED_NO_ELIGIBLE_REAL_ENTERPRISE_SOURCE'
  };
  if (outputDir) {
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(path.join(outputDir, 'track-b-real-enterprise-source-manifest.json'), `${JSON.stringify(stable(manifest), null, 2)}\n`);
    fs.writeFileSync(path.join(outputDir, 'track-b-real-enterprise-source-manifest.md'), `${renderManifest(manifest)}\n`);
    fs.writeFileSync(path.join(outputDir, 'track-b-real-fact-v2-blind-human-review-packet.json'), `${JSON.stringify(stable(packet), null, 2)}\n`);
    fs.writeFileSync(path.join(outputDir, 'track-b-real-fact-v2-blind-human-review-packet.md'), `${renderBlindPacket(packet)}\n`);
    fs.writeFileSync(path.join(outputDir, 'track-b-source-fact-closure-checkpoint.json'), `${JSON.stringify(stable(checkpoint), null, 2)}\n`);
    fs.writeFileSync(path.join(outputDir, 'track-b-source-fact-closure-checkpoint.md'), `${renderManifest({ ...manifest, ...checkpoint, source_candidate_count: manifest.source_candidate_count, authority_eligible_count: manifest.authority_eligible_count, real_fact_v2_eligible_candidates: manifest.real_fact_v2_eligible_candidates })}\n`);
    fs.writeFileSync(path.join(outputDir, 'track-b-source-fact-closure-report.md'), `${renderReport({ manifest, packet, checkpoint })}\n`);
  }
  return { manifest, packet, checkpoint, foundation, provider_calls: 0, production_db_writes: 0, gold_mutations: 0 };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = buildTrackBSourceFactClosure();
  console.log(JSON.stringify({
    checkpoint: result.checkpoint.checkpoint,
    source_candidates: result.manifest.source_candidate_count,
    source_eligible: result.manifest.authority_eligible_count,
    real_fact_v2_eligible_candidates: result.manifest.real_fact_v2_eligible_candidates,
    blind_packet: result.packet.status,
    provider_calls: 0,
    production_db_writes: 0,
    gold_mutations: 0
  }, null, 2));
}
