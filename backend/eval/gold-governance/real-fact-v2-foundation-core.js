import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  validateSourceManifest,
  buildImportPlan,
  assertEnterpriseIsolation
} from '../gold-human-review/v2/mapping-real-rebuild/real-enterprise-source-import-harness.js';

export const REAL_FACT_V2_SCHEMA_VERSION = 'v43-real-fact-v2-foundation-v1';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_OUTPUT_DIR = path.join(HERE, 'v43-gold-v2-foundation');
const PROJECTION_PATH = path.resolve(HERE, '../gold-human-review/v2/mapping-real-rebuild/00_source_role_projection.json');
const text = value => value == null ? '' : String(value);
const stable = value => Array.isArray(value) ? value.map(stable) : (value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value);

function authorityProjection() {
  try { return JSON.parse(fs.readFileSync(PROJECTION_PATH, 'utf8')); } catch { return { materials: [] }; }
}

function snapshotFor(snapshots, id) {
  if (snapshots instanceof Map) return snapshots.get(id);
  return snapshots?.[id];
}

function snapshotParts(value) {
  if (value == null) return { body: null, hash: null };
  if (typeof value === 'string') return { body: value, hash: null };
  return { body: value.text ?? value.body ?? value.content ?? value.snapshot_text ?? null, hash: value.hash ?? value.source_hash ?? value.snapshot_hash ?? null };
}

function auditRow(candidate, status, code, message, extra = {}) {
  return { source_id: candidate?.source_id ?? null, status, code: code ?? null, message: message ?? null, ...extra };
}

function reject(candidate, code, message) { return auditRow(candidate, 'REJECTED', code, message); }

function isAuthorityEligible(candidate, projection) {
  const materialId = candidate.material_id;
  const material = materialId && (projection.materials ?? []).find(material => material.material_id === materialId &&
    material.derived_source_role === 'REAL_ENTERPRISE_EVIDENCE_CANDIDATE' &&
    String(material.lifecycle_status ?? '').toUpperCase() === 'ACTIVE' && material.synthetic_test_material === false &&
    material.quarantined !== true && String(material.derived_source_role).toUpperCase() !== 'REFERENCE_CONTEXT_ONLY');
  if (!material) return null;
  const projectionIdentity = material.enterprise_identity ?? material.enterprise ?? {};
  const projectedId = material.enterprise_id ?? projectionIdentity.enterprise_id;
  const projectedName = material.enterprise_name ?? projectionIdentity.enterprise_name ?? projectionIdentity.name;
  if (!projectedId || text(candidate.enterprise_id).trim() !== text(projectedId).trim()) return null;
  if (projectedName && text(candidate.enterprise_name).trim() !== text(projectedName).trim()) return null;
  const projectedHash = material.file_hash ?? material.source_hash;
  if (!projectedHash || text(candidate.source_hash || candidate.snapshot_hash).trim() !== text(projectedHash).trim()) return null;
  return material;
}

export function renderRealFactV2Manifest(manifest) {
  const lines = ['# Real Fact V2 Candidate Manifest', '', 'Eval-only source admission manifest. Candidates are source records pending Human Fact review; no Fact, Mapping, Claim, Writer, Provider, or Production result is created.', '', `Candidates: ${manifest.candidate_count}`, `Eligible for Human Fact review: ${manifest.eligible_count}`, `Rejected: ${manifest.rejected_count}`, ''];
  for (const row of manifest.candidates) lines.push(`## ${row.source_id}`, `- status: ${row.status}`, `- enterprise_identity: ${JSON.stringify(row.enterprise_identity)}`, `- source_location: ${JSON.stringify(row.source_location)}`, `- sha256: ${row.sha256 ?? 'null'}`, `- snapshot: ${JSON.stringify(row.snapshot)}`, `- material_lifecycle: ${row.material_lifecycle ?? 'null'}`, `- authority_eligible: ${row.authority_eligible}`, `- fact_projection: ${JSON.stringify(row.fact_projection)}`, `- chunk_count: ${row.chunk_count ?? 0}`, `- chunk_identity: ${JSON.stringify(row.chunk_identity ?? [])}`, `- reason: ${row.reason ?? 'none'}`, '');
  lines.push('', '## Rejection audit', '', ...manifest.rejection_audit.map(row => `- ${JSON.stringify(row)}`));
  lines.push('## Corpus gaps', '', ...(manifest.corpus_gaps.length ? manifest.corpus_gaps.map(gap => `- ${gap.source_class}: ${gap.code}`) : ['- none']), '', 'Promotion status: SOURCE_READY_FOR_HUMAN_FACT_REVIEW only; FACT_READY is never emitted.');
  return lines.join('\n');
}

export function renderRealFactV2BlindPacket(packet) {
  return ['# Real Fact V2 Blind Human Review Packet', '', 'Eval-only blind packet. It contains source identity and mechanical chunk previews only. Human reviewers must supply Fact decisions separately.', '', `Sources: ${packet.sources.length}`, '', ...packet.sources.map(row => `## ${row.source_id}\n- enterprise_identity: ${JSON.stringify(row.enterprise_identity)}\n- source_location: ${JSON.stringify(row.source_location)}\n- snapshot: ${JSON.stringify(row.snapshot)}\n- sha256: ${row.sha256 ?? 'null'}\n- material_lifecycle: ${row.material_lifecycle ?? 'null'}\n- authority_eligible: ${row.authority_eligible}\n- fact_projection: ${JSON.stringify(row.fact_projection)}\n- chunk_count: ${row.chunk_count ?? 0}\n- chunk_identity: ${JSON.stringify(row.chunk_identity ?? [])}`), '', '## Rejection audit', '', ...packet.rejection_audit.map(row => `- ${JSON.stringify(row)}`), '', 'No expected answer, Provider output, or Production result is included.'].join('\n');
}

export function buildRealFactV2FoundationInternal({ candidates = [], snapshots = new Map(), outputDir = DEFAULT_OUTPUT_DIR, projection } = {}) {
  const rejectionAudit = [];
  const admissionAudit = [];
  const records = [];
  const gaps = [];
  for (const candidate of candidates ?? []) {
    const sourceId = text(candidate?.source_id).trim();
    if (!sourceId) { rejectionAudit.push(reject(candidate, 'SOURCE_MANIFEST_INVALID', 'source_id is required')); continue; }
    if (candidate.synthetic_test_material === true || candidate.source_type === 'synthetic_company_evidence') { rejectionAudit.push(reject(candidate, 'SYNTHETIC_SOURCE_REJECTED', 'synthetic source cannot enter real Fact V2 review')); continue; }
    if (String(candidate.lifecycle_status ?? candidate.lifecycle ?? '').toUpperCase() === 'QUARANTINED' || candidate.quarantined === true) { rejectionAudit.push(reject(candidate, 'QUARANTINED_SOURCE_REJECTED', 'quarantined source cannot enter review')); continue; }
    if (candidate.requirement_derived === true || candidate.source_type === 'requirement_derived' || candidate.derived_from_requirement === true) { rejectionAudit.push(reject(candidate, 'REQUIREMENT_DERIVED_SOURCE_REJECTED', 'Requirement-derived source cannot establish enterprise Facts')); continue; }
    if (/industry|reference/i.test(`${candidate.source_type ?? ''} ${candidate.material_type ?? ''} ${candidate.corpus_scope ?? ''}`)) { rejectionAudit.push(reject(candidate, 'REFERENCE_SOURCE_REJECTED', 'industry/reference source cannot establish enterprise Facts')); continue; }
    try { assertEnterpriseIsolation([candidate]); } catch (error) { rejectionAudit.push(reject(candidate, error.code ?? 'ENTERPRISE_IDENTITY_REQUIRED', error.message)); continue; }
    const { body, hash } = snapshotParts(snapshotFor(snapshots, sourceId));
    const candidateSourceHash = text(candidate.source_hash).trim();
    const candidateSnapshotHash = text(candidate.snapshot_hash).trim();
    if (candidateSourceHash && candidateSnapshotHash && candidateSourceHash !== candidateSnapshotHash) { rejectionAudit.push(reject(candidate, 'SOURCE_SNAPSHOT_HASH_MISMATCH', 'candidate source_hash and snapshot_hash differ')); continue; }
    const candidateDeclaredHash = candidateSourceHash || candidateSnapshotHash;
    const snapshotDeclaredHash = text(hash).trim();
    if (candidateSourceHash && snapshotDeclaredHash && candidateSourceHash !== snapshotDeclaredHash) { rejectionAudit.push(reject(candidate, 'SOURCE_SNAPSHOT_HASH_MISMATCH', 'candidate source_hash and snapshot declared hash differ')); continue; }
    if (candidateSnapshotHash && snapshotDeclaredHash && candidateSnapshotHash !== snapshotDeclaredHash) { rejectionAudit.push(reject(candidate, 'SOURCE_SNAPSHOT_HASH_MISMATCH', 'candidate snapshot_hash and snapshot declared hash differ')); continue; }
    const declaredHash = snapshotDeclaredHash || candidateDeclaredHash;
    if (!declaredHash) { rejectionAudit.push(reject(candidate, 'SOURCE_SNAPSHOT_HASH_REQUIRED', 'declared immutable snapshot SHA-256 is required')); continue; }
    const authorityMaterial = isAuthorityEligible({ ...candidate, source_hash: declaredHash }, projection);
    if (!authorityMaterial) { rejectionAudit.push(reject(candidate, 'AUTHORITY_INELIGIBLE', 'Material Authority eligibility, identity, or hash is not established')); continue; }
    const validation = validateSourceManifest(candidate, { snapshotText: body });
    if (!validation.ready) { rejectionAudit.push(auditRow(candidate, validation.status, validation.code, validation.message)); continue; }
    const computedHash = validation.source_hash;
    if (declaredHash !== computedHash) { rejectionAudit.push(reject(candidate, 'SOURCE_SNAPSHOT_HASH_MISMATCH', 'declared snapshot hash does not match immutable snapshot body')); continue; }
    const projectionHash = authorityMaterial?.file_hash ?? authorityMaterial?.source_hash;
    if (projectionHash && projectionHash !== computedHash) { rejectionAudit.push(reject(candidate, 'SOURCE_SNAPSHOT_HASH_MISMATCH', 'authority projection hash does not match immutable snapshot body')); continue; }
    const plan = buildImportPlan(candidate, { snapshotText: body });
    const row = { source_id: sourceId, enterprise_identity: { enterprise_id: candidate.enterprise_id, enterprise_name: candidate.enterprise_name }, source_location: { url: candidate.source_url, organization: candidate.source_org || candidate.source_organization }, snapshot: { retrieved_at: candidate.retrieved_at, version_or_date: candidate.version_or_date || candidate.version || candidate.document_date || null, currentness: candidate.currentness || candidate.review_status || null }, sha256: computedHash, source_type: candidate.source_type, material_type: candidate.material_type, material_lifecycle: candidate.lifecycle_status || candidate.lifecycle || 'ACTIVE', authority_eligible: true, synthetic: false, quarantined: false, status: 'SOURCE_READY_FOR_HUMAN_FACT_REVIEW', fact_ready: false, fact_projection: { fact_text: null, subject: null, entities: [], status: 'PENDING_HUMAN_FACT_REVIEW', quantity: null, scope: null, validity: null, currentness: null, source_id: sourceId, source_span: null, source_sha256: computedHash, conflict_state: 'UNRESOLVED' }, chunk_count: plan.chunk_count, chunk_identity: plan.chunk_identity, eval_only: true };
    records.push(row);
    admissionAudit.push(auditRow(candidate, 'ADMITTED', null, null, { source_hash: computedHash }));
  }
  const classes = ['product_documentation', 'qualification', 'project_case', ...((candidates ?? []).map(c => c?.material_type).filter(Boolean))];
  const uniqueClasses = [...new Set(classes)];
  for (const source_class of uniqueClasses) if (!records.some(r => r.material_type === source_class)) gaps.push({ source_class, code: 'CORPUS_GAP', message: 'No complete authority-eligible immutable source snapshot is available' });
  const manifest = { schema_version: REAL_FACT_V2_SCHEMA_VERSION, eval_only: true, candidate_count: (candidates ?? []).length, eligible_count: records.length, rejected_count: rejectionAudit.length, candidates: records, admission_audit: admissionAudit, rejection_audit: rejectionAudit, corpus_gaps: gaps, provider_calls: 0, db_writes: 0 };
  const blindPacket = { schema_version: REAL_FACT_V2_SCHEMA_VERSION, eval_only: true, blind: true, sources: records, admission_audit: admissionAudit, rejection_audit: rejectionAudit, corpus_gaps: gaps };
  if (outputDir) { fs.mkdirSync(outputDir, { recursive: true }); fs.writeFileSync(path.join(outputDir, 'REAL_FACT_V2_CANDIDATE_MANIFEST.json'), `${JSON.stringify(stable(manifest), null, 2)}\n`); fs.writeFileSync(path.join(outputDir, 'REAL_FACT_V2_CANDIDATE_MANIFEST.md'), `${renderRealFactV2Manifest(manifest)}\n`); fs.writeFileSync(path.join(outputDir, 'REAL_FACT_V2_BLIND_HUMAN_REVIEW_PACKET.json'), `${JSON.stringify(stable(blindPacket), null, 2)}\n`); fs.writeFileSync(path.join(outputDir, 'REAL_FACT_V2_BLIND_HUMAN_REVIEW_PACKET.md'), `${renderRealFactV2BlindPacket(blindPacket)}\n`); }
  return { manifest, blindPacket, eligibleCount: records.length, rejectionAudit, provider_calls: 0, db_writes: 0 };
}
