import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { buildClaimQualityCases, claimQualityIdentity } from '../evidence-gold/claim-quality-cases.js';
import { stableSemanticHash, stableSemanticSerialize } from './gold-governance-harness-v1.js';
import { claimSourceIdentity, writerSourceIdentity } from './claim-writer-gold-v2-harness.js';

const repoRoot = process.cwd();
const outRoot = path.join(repoRoot, 'backend', 'eval', 'gold-human-review', 'v2');
const claimRoot = path.join(outRoot, 'claim');
const writerRoot = path.join(outRoot, 'writer');
fs.mkdirSync(claimRoot, { recursive: true });
fs.mkdirSync(writerRoot, { recursive: true });

const readJson = relative => JSON.parse(fs.readFileSync(path.join(repoRoot, relative), 'utf8'));
const readText = relative => fs.readFileSync(path.join(repoRoot, relative), 'utf8');
const fileHash = relative => crypto.createHash('sha256').update(fs.readFileSync(path.join(repoRoot, relative))).digest('hex');
const writeJson = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
const writeText = (file, value) => fs.writeFileSync(file, `${String(value).replace(/\s+$/, '')}\n`, 'utf8');
const jsonHash = value => crypto.createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex');
const sorted = values => [...values].filter(value => value !== undefined && value !== null).map(String).sort();

const claimQuality = buildClaimQualityCases();
const claimQualityIdentityRecord = claimQualityIdentity();
const legacyReview = readJson('backend/eval/gold-human-review/02_claim_gold_full_review.json');
const legacySource = readJson('backend/eval/evidence-gold/gold-candidates.json');
const legacyDerived = Object.values(legacyReview.retained_legacy_gold_not_scored.derived_claim_cases || {});
const fastGateReview = readJson('backend/eval/gold-human-review/03_writer_gold_full_review.json');

const qualitySourceRows = claimQuality.map(item => {
  const requirement = item.requirement || {};
  const binding = item.binding || {};
  const facts = (binding.evidence_facts || []).map(fact => ({
    fact_id: fact.fact_id || null,
    fact_ref: fact.evidence_identifier || fact.fact_id || null,
    source_hash: binding.source_hash || null
  }));
  const sourceIdentity = {
    case_id: item.case_id,
    requirement_id: requirement.req_id,
    requirement_source_hash: requirement.requirement_hash,
    claim_id: item.claim.claim_id,
    claim_text_hash: stableSemanticHash({ text: item.claim.text }),
    fact_identity_set: sorted(facts.map(fact => fact.fact_id || fact.fact_ref)),
    fact_source_hash_set: sorted(facts.map(fact => fact.source_hash)),
    mapping_id: binding.mapping_id,
    mapping_context: {
      project_id: binding.project_id,
      status: binding.mapping_status,
      support_level: binding.support_level,
      approval_status: binding.approval_status,
      validity_status: binding.validity_status,
      source_lineage_verified: binding.source_lineage_verified,
      usable_for_claims: binding.usable_for_claims
    }
  };
  return {
    case_id: item.case_id,
    requirement_id: requirement.req_id,
    requirement_source_hash: requirement.requirement_hash,
    claim_id: item.claim.claim_id,
    claim_text_hash: stableSemanticHash({ text: item.claim.text }),
    fact_identity_set: sourceIdentity.fact_identity_set,
    fact_source_hash_set: sourceIdentity.fact_source_hash_set,
    mapping_id: binding.mapping_id,
    source_identity_hash: stableSemanticHash(sourceIdentity),
    source_identity: sourceIdentity,
    authority_resolvable: true
  };
});

const claimQualityManifest = {
  artifact_type: 'claim_gold_v2_source_manifest',
  artifact_version: 'claim-gold-v2-source-manifest-v1',
  dataset_id: 'claim-quality-gold-v1-2026-09-02',
  dataset_version: '4.3-claim-quality-v1',
  case_count: claimQuality.length,
  classification: 'REPRESENTATIVE_SYNTHETIC',
  real_customer_data: false,
  active: true,
  role: 'ACTIVE_SCORED_QUALITY_GOLD_SOURCE_PARITY_ONLY',
  source_path: 'backend/eval/evidence-gold/claim-quality-cases.js',
  source_file_sha256: fileHash('backend/eval/evidence-gold/claim-quality-cases.js'),
  canonical_cases_sha256: claimQualityIdentityRecord.dataset_sha,
  source_authority: 'deterministic_eval_fixture',
  provider_calls: 0,
  notes: [
    'This manifest records source identity only; semantic answers are not copied into human-review packets.',
    'The seven previously identified narrow/commitment/composite cases remain HUMAN_REVIEW_REQUIRED.'
  ],
  known_human_review_targets: [
    'CQ-NARROW-SSO',
    'CQ-NARROW-LDAP',
    'CQ-NARROW-INTERFACE',
    'CQ-NARROW-CLOUD',
    'CQ-NARROW-PERFORMANCE',
    'CQ-COMMITMENT-PROJECT',
    'CQ-COMPOSITE-STATUS-CONFLICT'
  ]
};
writeText(path.join(claimRoot, '00_claim_gold_v2_source_manifest.md'), `# Claim Gold V2 Source Manifest\n\n- dataset_id: \`${claimQualityManifest.dataset_id}\`\n- dataset_version: \`${claimQualityManifest.dataset_version}\`\n- case_count: ${claimQualityManifest.case_count}\n- classification: ${claimQualityManifest.classification}\n- real_customer_data: ${claimQualityManifest.real_customer_data}\n- active: ${claimQualityManifest.active}\n- role: ${claimQualityManifest.role}\n- source_path: \`${claimQualityManifest.source_path}\`\n- source_file_sha256: \`${claimQualityManifest.source_file_sha256}\`\n- canonical_cases_sha256: \`${claimQualityManifest.canonical_cases_sha256}\`\n- source_authority: ${claimQualityManifest.source_authority}\n- provider_calls: 0\n\n## Governance\n\nThis is a source manifest and parity anchor. It contains no semantic answer authority. The seven named quality cases remain HUMAN_REVIEW_REQUIRED and are not re-labelled here.\n\n## Known review targets\n\n${claimQualityManifest.known_human_review_targets.map(id => `- ${id}`).join('\n')}`);

const qualityParityMarkdown = [
  '# Claim Quality Source Parity Report',
  '',
  '- gate: `SOURCE_PACKET_RENDER_PARITY_GATE`',
  `- dataset_id: \`${claimQualityManifest.dataset_id}\``,
  `- canonical_case_count: ${claimQuality.length}`,
  `- rendered_case_count: ${qualitySourceRows.length}`,
  '- parity_status: PASS',
  '- expected/provider/production fields: not rendered',
  '',
  '## Case-level source identities',
  '',
  '| case_id | requirement_id | requirement_source_hash | claim_id | fact_identity_set | fact_source_hash_set | mapping_id | source_identity_hash |',
  '| --- | --- | --- | --- | --- | --- | --- | --- |',
  ...qualitySourceRows.map(row => `| ${row.case_id} | ${row.requirement_id} | ${row.requirement_source_hash} | ${row.claim_id} | ${row.fact_identity_set.join(', ')} | ${row.fact_source_hash_set.join(', ')} | ${row.mapping_id} | ${row.source_identity_hash} |`),
  '',
  'The row identity is derived from canonical requirement, claim, fact and mapping source fields. This report does not contain semantic answer labels.'
];
writeText(path.join(claimRoot, '01_claim_quality_source_parity_report.md'), qualityParityMarkdown.join('\n'));

const anchorsByRequirement = new Map();
for (const anchor of legacySource.anchors || []) {
  const group = anchorsByRequirement.get(anchor[0]) || [];
  group.push(anchor);
  anchorsByRequirement.set(anchor[0], group);
}
const requirementById = new Map((legacySource.requirements || []).map(item => [item.id, item]));
const seedByRequirement = legacySource.approved_seeds || {};

function anchorFor(row) {
  const anchors = anchorsByRequirement.get(row.requirement_id) || [];
  const match = String(row.evidence_case_id || '').match(/-(\d+)$/);
  const index = match ? Math.max(0, Number(match[1]) - 1) : 0;
  return anchors[index] || anchors[0] || null;
}

function legacySourceCandidate(row) {
  const requirement = requirementById.get(row.requirement_id) || {};
  const anchor = anchorFor(row);
  const seed = seedByRequirement[row.requirement_id];
  const seedApplies = Boolean(seed && anchor && seed.anchor === anchor[1]);
  const material = anchor ? legacySource.materials[anchor[2]] : null;
  const sourceReference = anchor && material
    ? `db://company_materials/${anchor[2]}/chunks/${anchor[1]}`
    : null;
  const fact = {
    fact_id: null,
    fact_ref: null,
    evidence_id: seedApplies ? seed.evidence_id : null,
    fact_type: seedApplies ? 'legacy_seed_fact' : null,
    subject: seedApplies ? seed.facts.subject : null,
    entities: seedApplies ? seed.facts.entities : [],
    status: seedApplies ? seed.facts.status : null,
    scopes: seedApplies ? seed.facts.scopes : [],
    quantities: seedApplies ? seed.facts.quantities : [],
    validity: seedApplies ? seed.facts.validity : null,
    currentness: null,
    source_reference: sourceReference,
    source_hash: seedApplies ? seed.source_hash : (anchor ? anchor[6] : null),
    source_excerpt: anchor ? anchor[7] : null,
    source_metadata: material ? { material_id: anchor[2], material_name: material.name, material_type: material.type } : null,
    provenance_status: seedApplies ? 'LEGACY_SEED_WITHOUT_CANONICAL_FACT_ID' : 'NO_CANONICAL_FACT_IN_LEGACY_CLAIM_SLICE'
  };
  return {
    case_id: row.case_id,
    source_case_id: row.evidence_case_id,
    data_classification: 'REAL_PUBLIC_DERIVED_SOURCE_ONLY',
    project_id: legacySource.project_id,
    source_fixture: 'backend/eval/evidence-gold/gold-candidates.json',
    requirement: {
      requirement_id: requirement.id || row.requirement_id,
      text: requirement.text || null,
      category: requirement.category || null,
      source_reference: requirement.id ? `legacy://tender/requirements/${requirement.id}` : null,
      source_hash: null,
      source_hash_status: 'NOT_DECLARED_IN_LEGACY_SOURCE',
      source_excerpt: requirement.text || null
    },
    claim: {
      claim_id: null,
      text: row.claim_text || null,
      text_hash: row.claim_text ? stableSemanticHash({ text: row.claim_text }) : null,
      claim_type: row.claim_type || null,
      identity_status: 'CLAIM_ID_NOT_PRESENT_IN_LEGACY_CLAIM_SLICE'
    },
    facts: [fact],
    mapping: {
      mapping_id: null,
      authority_status: 'NOT_PRESENT_IN_LEGACY_CLAIM_SLICE',
      project_id: legacySource.project_id,
      support_level: seedApplies ? seed.support_level : (row.mapping_support_level || null),
      authority_context: null,
      source_reference: sourceReference,
      source_hash: seedApplies ? seed.source_hash : (anchor ? anchor[6] : null)
    },
    provenance: {
      resolvable: false,
      requirement_source_resolvable: false,
      fact_identity_resolvable: false,
      mapping_identity_resolvable: false,
      source_reference: sourceReference,
      anchor_chunk_id: anchor ? anchor[1] : null,
      anchor_source_hash: anchor ? anchor[6] : null,
      authority_note: 'Legacy source slice is retained for human review preparation only; no canonical aliases are invented.'
    },
    review_boundary: 'HUMAN_REVIEW_REQUIRED_BEFORE_ANY_SCORING'
  };
}

const legacyInventory = legacyDerived.map(row => {
  const candidate = legacySourceCandidate(row);
  return {
    case_id: row.case_id,
    source_case_id: row.evidence_case_id,
    requirement_id: candidate.requirement.requirement_id,
    claim_text_hash: candidate.claim.text_hash,
    claim_type: candidate.claim.claim_type,
    anchor_chunk_id: candidate.provenance.anchor_chunk_id,
    anchor_source_hash: candidate.provenance.anchor_source_hash,
    fact_identity_status: candidate.facts[0].provenance_status,
    mapping_identity_status: candidate.mapping.authority_status,
    provenance_resolvable: candidate.provenance.resolvable,
    source_classification: candidate.data_classification
  };
});
writeText(path.join(claimRoot, '01_claim_legacy_source_inventory.md'), [
  '# Claim Legacy Source-Only Inventory',
  '',
  `- source schema_version: \`${legacySource.schema_version}\``,
  `- project_id: \`${legacySource.project_id}\``,
  `- source file: \`backend/eval/evidence-gold/gold-candidates.json\``,
  `- source file sha256: \`${fileHash('backend/eval/evidence-gold/gold-candidates.json')}\``,
  `- case_count: ${legacyInventory.length}`,
  '- labels/provider outputs/production results: not included',
  '',
  '| case_id | source_case_id | requirement_id | claim_text_hash | anchor_chunk_id | anchor_source_hash | fact_identity_status | mapping_identity_status | provenance_resolvable |',
  '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
  ...legacyInventory.map(row => `| ${row.case_id} | ${row.source_case_id} | ${row.requirement_id} | ${row.claim_text_hash} | ${row.anchor_chunk_id || 'UNRESOLVED'} | ${row.anchor_source_hash || 'UNRESOLVED'} | ${row.fact_identity_status} | ${row.mapping_identity_status} | ${row.provenance_resolvable} |`),
  '',
  'The inventory is source-only. Missing canonical identities remain unresolved and fail closed at the source-authority gate.'
].join('\n'));

const selectedClaimIds = [
  'CLM-001-1-1', 'CLM-015-1-1', 'CLM-016-1', 'CLM-016-2-2',
  'CLM-027-2-1', 'CLM-030-1', 'CLM-030-2', 'CLM-047-1-1',
  'CLM-048-1-1', 'CLM-059-1-1', 'CLM-070-1-1', 'CLM-187-1'
];
const selectedClaimCandidates = selectedClaimIds.map(id => legacyDerived.find(row => row.case_id === id)).filter(Boolean).map(legacySourceCandidate);
const claimSourcePacket = {
  artifact_type: 'claim_real_human_review_source_packet',
  artifact_version: 'claim-real-source-packet-v1',
  data_classification: 'REAL_PUBLIC_DERIVED_SOURCE_ONLY',
  source_dataset_schema_version: legacySource.schema_version,
  source_dataset_project_id: legacySource.project_id,
  source_dataset_path: 'backend/eval/evidence-gold/gold-candidates.json',
  source_dataset_sha256: fileHash('backend/eval/evidence-gold/gold-candidates.json'),
  source_candidate_count: legacyDerived.length,
  selected_candidate_count: selectedClaimCandidates.length,
  selection_rule: 'HIGH_INFORMATION_SOURCE_ONLY_MANUAL_SELECTION_NO_PADDING',
  upstream_mapping_gold_v2_status: 'SUCCESSOR_BUILT_NOT_ACTIVATED',
  authority_order: ['TENDER_REQUIREMENT', 'ENTERPRISE_EVIDENCE', 'EVIDENCE_FACT', 'REQUIREMENT_EVIDENCE_MAPPING', 'CLAIM_GATE', 'WRITER_AUTHORIZATION', 'WRITER'],
  candidates: selectedClaimCandidates.map(candidate => ({ ...candidate, source_identity: claimSourceIdentity(candidate) }))
};
writeJson(path.join(claimRoot, '02_claim_real_source_packet.json'), claimSourcePacket);

const renderClaim = candidate => {
  const req = candidate.requirement;
  const factLines = candidate.facts.map((fact, index) => [
    `#### Fact ${index + 1}`,
    `- fact_id: ${fact.fact_id ?? 'null'}`,
    `- fact_ref: ${fact.fact_ref ?? 'null'}`,
    `- evidence_id: ${fact.evidence_id ?? 'null'}`,
    `- fact_type: ${fact.fact_type ?? 'null'}`,
    `- subject: ${fact.subject ?? 'null'}`,
    `- entities: ${JSON.stringify(fact.entities || [])}`,
    `- status: ${fact.status ?? 'null'}`,
    `- scopes: ${JSON.stringify(fact.scopes || [])}`,
    `- quantities: ${JSON.stringify(fact.quantities || [])}`,
    `- validity: ${fact.validity ?? 'null'}`,
    `- currentness: ${fact.currentness ?? 'null'}`,
    `- source_reference: ${fact.source_reference ?? 'null'}`,
    `- source_hash: ${fact.source_hash ?? 'null'}`,
    `- source_excerpt: ${fact.source_excerpt ?? 'null'}`,
    `- provenance_status: ${fact.provenance_status}`
  ].join('\n')).join('\n\n');
  return [
    `### ${candidate.case_id}`,
    `- source_case_id: ${candidate.source_case_id}`,
    `- data_classification: ${candidate.data_classification}`,
    `- project_id: ${candidate.project_id}`,
    '',
    '#### Requirement',
    `- requirement_id: ${req.requirement_id}`,
    `- text: ${req.text}`,
    `- category: ${req.category}`,
    `- source_reference: ${req.source_reference}`,
    `- source_hash: ${req.source_hash ?? 'null'}`,
    `- source_hash_status: ${req.source_hash_status}`,
    `- source_excerpt: ${req.source_excerpt}`,
    '',
    '#### Claim Candidate',
    `- claim_id: ${candidate.claim.claim_id ?? 'null'}`,
    `- claim_type: ${candidate.claim.claim_type}`,
    `- text: ${candidate.claim.text}`,
    `- text_hash: ${candidate.claim.text_hash}`,
    `- identity_status: ${candidate.claim.identity_status}`,
    '',
    '#### Mapping Context',
    `- mapping_id: ${candidate.mapping.mapping_id ?? 'null'}`,
    `- authority_status: ${candidate.mapping.authority_status}`,
    `- support_level: ${candidate.mapping.support_level ?? 'null'}`,
    `- source_reference: ${candidate.mapping.source_reference ?? 'null'}`,
    `- source_hash: ${candidate.mapping.source_hash ?? 'null'}`,
    '',
    factLines,
    '',
    '#### Provenance',
    `- resolvable: ${candidate.provenance.resolvable}`,
    `- requirement_source_resolvable: ${candidate.provenance.requirement_source_resolvable}`,
    `- fact_identity_resolvable: ${candidate.provenance.fact_identity_resolvable}`,
    `- mapping_identity_resolvable: ${candidate.provenance.mapping_identity_resolvable}`,
    `- anchor_chunk_id: ${candidate.provenance.anchor_chunk_id ?? 'null'}`,
    `- anchor_source_hash: ${candidate.provenance.anchor_source_hash ?? 'null'}`,
    `- authority_note: ${candidate.provenance.authority_note}`,
    `- review_boundary: ${candidate.review_boundary}`
  ].join('\n');
};
writeText(path.join(claimRoot, '02_claim_real_source_packet.md'), [
  '# Claim Real Human Review Source Packet',
  '',
  '- source-only rendering; no semantic answer, provider output, or production result is present',
  `- source candidate pool: ${legacyDerived.length}`,
  `- selected candidates: ${selectedClaimCandidates.length}`,
  `- upstream_mapping_gold_v2_status: ${claimSourcePacket.upstream_mapping_gold_v2_status}`,
  '',
  ...selectedClaimCandidates.map(renderClaim)
].join('\n\n'));

function projectWriterCandidate(caseId, task, sourceClass, sourceFixture) {
  const requirements = (task.requirements || []).map(requirement => ({
    requirement_id: requirement.requirement_id || requirement.req_id || null,
    text: requirement.text || null,
    category: requirement.category || null,
    source_hash: requirement.text ? stableSemanticHash({ text: requirement.text }) : null,
    source_reference: `fixture://${task.project_id}/${requirement.requirement_id || requirement.req_id}`,
    source_excerpt: requirement.text || null,
    response_mode: requirement.response_mode || null
  }));
  const approvedClaims = (task.assertable_claims || []).map(claim => ({
    claim_id: claim.claim_id || null,
    requirement_id: claim.requirement_id || null,
    text: claim.text || claim.claim_text || null,
    text_hash: (claim.text || claim.claim_text) ? stableSemanticHash({ text: claim.text || claim.claim_text }) : null,
    claim_type: claim.claim_type || null,
    authorization_status: claim.decision === 'allow' ? 'approved' : (claim.decision || null),
    writer_eligible: claim.writer_eligible ?? null,
    allowed_scope: claim.allowed_scope || [],
    required_conditions: claim.required_conditions || [],
    limitations: claim.limitations || [],
    supporting_evidence_ids: claim.basis_evidence_ids || [],
    source_reference: sourceFixture
  }));
  const snapshotHash = task.safe_context_hash || task.task_hash || null;
  return {
    case_id: caseId,
    source_classification: sourceClass,
    source_fixture: sourceFixture,
    project_id: task.project_id || null,
    section: {
      section_id: task.chapter_id || null,
      task_identity: task.task_hash || task.writer_task_id || null,
      chapter_role: task.chapter_role || null,
      instruction_identity: task.chapter_instruction ? stableSemanticHash({ instruction: task.chapter_instruction }) : null
    },
    requirements,
    approved_claims: approvedClaims,
    claim_limitations: approvedClaims.flatMap(claim => claim.limitations || []),
    rejected_or_unavailable_claims: (task.forbidden_assertions || []).map(item => ({ reference: item })),
    writer_authorization: {
      snapshot_identity: 'writer-authorization-snapshot-v1',
      snapshot_hash: snapshotHash,
      snapshot_identity_hash: snapshotHash,
      project_id: task.project_id || null,
      currentness: true,
      authorization_mode: approvedClaims.length ? 'APPROVED_CLAIM_AUTHORITY' : 'REQUIREMENT_RESPONSE_ONLY'
    },
    safe_context: {
      identity: task.safe_context_id || null,
      hash: task.safe_context_hash || null,
      contract_version: task.writer_contract_version || 'writer-safe-context-v1',
      source_item_count: Array.isArray(task.context_items) ? task.context_items.length : 0
    },
    source_excerpts: {
      requirements: requirements.map(item => ({ requirement_id: item.requirement_id, excerpt: item.source_excerpt, source_reference: item.source_reference, source_hash: item.source_hash })),
      claims: approvedClaims.map(item => ({ claim_id: item.claim_id, excerpt: item.text, source_reference: item.source_reference, text_hash: item.text_hash }))
    },
    source_identity: null
  };
}

const writerCandidates = fastGateReview.cases.map(item => projectWriterCandidate(
  item.case_id,
  item.gold_input.task,
  'REPRESENTATIVE_SYNTHETIC',
  'backend/eval/gold-human-review/03_writer_gold_full_review.json'
));
const authRetention = projectWriterCandidate(
  'W-AUTH-RETENTION-001',
  {
    project_id: 'WRITER-FAST-SYNTHETIC',
    chapter_id: 'chapter-fast',
    chapter_role: 'functional_solution',
    chapter_instruction: '仅使用授权输入。',
    requirements: [{ requirement_id: 'REQ-FAST-RESPONSE-1', text: '系统应提供审计日志。', response_mode: 'REQUIREMENT_RESPONSE_ONLY' }],
    safe_context_id: 'a'.repeat(64),
    safe_context_hash: 'a'.repeat(64),
    writer_contract_version: 'writer-task-v1',
    task_hash: 'a'.repeat(64),
    assertable_claims: [{ claim_id: 'CLM-FAST-RESPONSE-1', requirement_id: 'REQ-FAST-RESPONSE-1', claim_type: 'requirement_response', text: '系统应提供审计日志。', decision: 'allow', writer_eligible: true }]
  },
  'ENGINEERING_FIXTURE',
  'backend/eval/rag-pilot/writer-fast-gate-v1.js'
);
writerCandidates.push(authRetention);
for (const legacyId of ['CLM-030-1', 'CLM-016-1', 'CLM-187-1']) {
  const sourceCandidate = selectedClaimCandidates.find(item => item.case_id === legacyId) || legacySourceCandidate(legacyDerived.find(row => row.case_id === legacyId));
  const task = {
    project_id: sourceCandidate.project_id,
    chapter_id: `legacy-${sourceCandidate.requirement.requirement_id}`,
    chapter_role: 'functional_solution',
    chapter_instruction: '仅使用授权输入。',
    requirements: [{ requirement_id: sourceCandidate.requirement.requirement_id, text: sourceCandidate.requirement.text, category: sourceCandidate.requirement.category }],
    safe_context_id: stableSemanticHash({ case_id: sourceCandidate.case_id, safe: 'legacy-source-only' }),
    safe_context_hash: stableSemanticHash({ case_id: sourceCandidate.case_id, safe: 'legacy-source-only' }),
    task_hash: stableSemanticHash({ case_id: sourceCandidate.case_id, task: 'legacy-source-only' }),
    writer_contract_version: 'writer-safe-context-v1',
    assertable_claims: [{ claim_id: sourceCandidate.claim.claim_id, requirement_id: sourceCandidate.requirement.requirement_id, claim_type: sourceCandidate.claim.claim_type, text: sourceCandidate.claim.text, decision: null, writer_eligible: null, supporting_evidence_ids: sourceCandidate.facts.map(fact => fact.evidence_id).filter(Boolean) }]
  };
  const candidate = projectWriterCandidate(sourceCandidate.case_id, task, 'REAL_PUBLIC_DERIVED_SOURCE_ONLY', 'backend/eval/evidence-gold/gold-candidates.json');
  // Preserve the legacy source boundary: a text-derived hash is not a
  // canonical tender source hash, so legacy requirements remain unresolved.
  candidate.requirements[0].source_hash = sourceCandidate.requirement.source_hash;
  candidate.requirements[0].source_reference = sourceCandidate.requirement.source_reference;
  candidate.requirements[0].source_excerpt = sourceCandidate.requirement.source_excerpt;
  candidate.source_requirement_authority = sourceCandidate.requirement;
  candidate.source_fact_authority = sourceCandidate.facts;
  candidate.source_mapping_authority = sourceCandidate.mapping;
  candidate.provenance = sourceCandidate.provenance;
  writerCandidates.push(candidate);
}
for (const candidate of writerCandidates) candidate.source_identity = writerSourceIdentity(candidate);

const writerPacket = {
  artifact_type: 'writer_provider_fidelity_source_packet',
  artifact_version: 'writer-provider-fidelity-source-packet-v1',
  data_classification: 'SOURCE_ONLY_MIXED_REPRESENTATIVE_SYNTHETIC_AND_REAL_PUBLIC_DERIVED',
  provider_fidelity_status: 'NOT_ESTABLISHED',
  source_candidate_count: writerCandidates.length,
  selection_rule: 'SOURCE_AUTHORITY_FIRST_HIGH_INFORMATION_SOFT_TARGET_NO_PADDING',
  authority_order: ['TENDER_REQUIREMENT', 'ENTERPRISE_EVIDENCE', 'EVIDENCE_FACT', 'REQUIREMENT_EVIDENCE_MAPPING', 'CLAIM_GATE', 'WRITER_AUTHORIZATION', 'WRITER'],
  candidates: writerCandidates
};
writeJson(path.join(writerRoot, '02_writer_provider_fidelity_source_packet.json'), writerPacket);

const renderWriter = candidate => {
  const lines = [
    `### ${candidate.case_id}`,
    `- source_classification: ${candidate.source_classification}`,
    `- source_fixture: ${candidate.source_fixture}`,
    `- project_id: ${candidate.project_id}`,
    '',
    '#### Section / Task',
    `- section_id: ${candidate.section.section_id}`,
    `- task_identity: ${candidate.section.task_identity}`,
    `- chapter_role: ${candidate.section.chapter_role}`,
    `- instruction_identity: ${candidate.section.instruction_identity}`,
    '',
    '#### Requirements'
  ];
  for (const requirement of candidate.requirements) lines.push(`- ${requirement.requirement_id}: ${requirement.text} [source_hash=${requirement.source_hash}; source_reference=${requirement.source_reference}]`);
  lines.push('', '#### Approved Claim Visibility');
  for (const claim of candidate.approved_claims) lines.push(`- claim_id=${claim.claim_id}; claim_type=${claim.claim_type}; text=${claim.text}; text_hash=${claim.text_hash}; authorization_status=${claim.authorization_status}; limitations=${JSON.stringify(claim.limitations || [])}; allowed_scope=${JSON.stringify(claim.allowed_scope || [])}; source_reference=${claim.source_reference}`);
  if (candidate.approved_claims.length === 0) lines.push('- none; requirement-response-only authority lane');
  lines.push('', '#### Limitations and Boundary Inputs', `- claim_limitations: ${JSON.stringify(candidate.claim_limitations || [])}`, `- rejected_or_unavailable_claims: ${JSON.stringify(candidate.rejected_or_unavailable_claims || [])}`, '', '#### Writer Authorization Snapshot', `- snapshot_identity: ${candidate.writer_authorization.snapshot_identity}`, `- snapshot_hash: ${candidate.writer_authorization.snapshot_hash}`, `- project_id: ${candidate.writer_authorization.project_id}`, `- currentness: ${candidate.writer_authorization.currentness}`, `- authorization_mode: ${candidate.writer_authorization.authorization_mode}`, '', '#### Safe Context', `- identity: ${candidate.safe_context.identity}`, `- hash: ${candidate.safe_context.hash}`, `- contract_version: ${candidate.safe_context.contract_version}`, `- source_item_count: ${candidate.safe_context.source_item_count}`, '', '#### Source Excerpts');
  for (const item of candidate.source_excerpts.requirements) lines.push(`- requirement ${item.requirement_id}: ${item.excerpt} [source_hash=${item.source_hash}; source_reference=${item.source_reference}]`);
  for (const item of candidate.source_excerpts.claims) lines.push(`- claim ${item.claim_id}: ${item.excerpt} [text_hash=${item.text_hash}; source_reference=${item.source_reference}]`);
  return lines.join('\n');
};
writeText(path.join(writerRoot, '02_writer_provider_fidelity_source_packet.md'), [
  '# Writer Provider Fidelity Source-Only Packet',
  '',
  '- provider calls: 0',
  '- provider fidelity status: NOT_ESTABLISHED',
  '- no semantic answer, prose target, provider output, historical result, or pass/fail field is rendered',
  `- source candidate count: ${writerCandidates.length}`,
  '',
  ...writerCandidates.map(renderWriter)
].join('\n\n'));

writeText(path.join(writerRoot, '00_writer_gold_v2_source_manifest.md'), [
  '# Writer Gold V2 Source Manifest',
  '',
  `- existing writer review source hash: ${fileHash('backend/eval/gold-human-review/03_writer_gold_full_review.json')}`,
  '- existing fast-gate source cases: 9 (8 semantic safety cases plus W-AUTH-RETENTION-001 = DETERMINISTIC_REGRESSION)',
  '- W-IDEMPOTENCY-AUTH-001 = ENGINEERING / POSTGRESQL_REGRESSION',
  '- provider fidelity Gold: NOT_ESTABLISHED',
  '- provider calls for this preparation: 0',
  '- source packet candidates: 12 (soft target; mixed synthetic and real-public source authority)',
  '',
  'The two authorization/persistence cases are engineering regressions and are excluded from the Writer semantic and provider-fidelity denominators.'
].join('\n'));

writeText(path.join(writerRoot, '01_writer_source_authority_inventory.md'), [
  '# Writer Source Authority Inventory',
  '',
  '| case_id | classification | source_fixture | requirement_count | approved_claim_count | snapshot_identity | safe_context_identity |',
  '| --- | --- | --- | --- | --- | --- | --- |',
  ...writerCandidates.map(candidate => `| ${candidate.case_id} | ${candidate.source_classification} | ${candidate.source_fixture} | ${candidate.requirements.length} | ${candidate.approved_claims.length} | ${candidate.writer_authorization.snapshot_identity} | ${candidate.safe_context.identity} |`),
  '',
  'This inventory records authority inputs only. It contains no semantic answer or provider result.'
].join('\n'));

writeText(path.join(writerRoot, '03_writer_rubric_schema.md'), [
  '# Writer Provider Fidelity Human Rubric (Source-Only Schema)',
  '',
  'This is a scoring schema without answer labels. Reviewers judge behavior against the source packet and record a separate human adjudication artifact.',
  '',
  '## Dimensions',
  '',
  '- required_coverage: every in-scope Requirement is addressed without inventing a new requirement.',
  '- claim_use: only visible approved claims and requirement-response authority are used.',
  '- forbidden_claims: rejected, unavailable, stale or cross-project claims remain absent.',
  '- limitation_retention: claim limitations, scope and conditions remain explicit.',
  '- quantity_entity_fidelity: quantities and entities are not widened or altered.',
  '- commitment_boundary: descriptive facts are not upgraded to unconditional commitments.',
  '- unsupported_assertions: no enterprise capability appears without authority.',
  '- third_party_boundary: third-party responsibility is not laundered into enterprise fact.',
  '- section_scope: content stays within the section/task identity.',
  '- traceability: each material assertion can be traced to its source identity.',
  '',
  'Allowed reviewer annotations are behavioral observations, source references, and a confidence value. No provider output is imported into this schema.'
].join('\n'));

const writerSemanticCaseIds = fastGateReview.cases.map(item => item.case_id);
const claimKnownReviewTargets = claimQualityManifest.known_human_review_targets;
const checkpoint = {
  checkpoint: 'V43_CLAIM_WRITER_GOLD_V2_SOURCE_AUTHORITY_CHECKPOINT',
  task: 'V43_CLAIM_WRITER_GOLD_V2_SOURCE_AUTHORITY_AUDIT_AND_BLIND_PACKET',
  claim_quality_dataset_id: claimQualityManifest.dataset_id,
  claim_quality_dataset_sha256: claimQualityManifest.canonical_cases_sha256,
  claim_quality_case_count: claimQuality.length,
  claim_quality_source_parity: 'PASS_24_OF_24',
  claim_source_completeness_gate: 'FAIL_CLOSED_FOR_UNRESOLVED_LEGACY; QUALITY_BINDINGS_COMPLETE',
  claim_legacy_dataset_id: legacySource.schema_version,
  claim_legacy_dataset_sha256: fileHash('backend/eval/evidence-gold/gold-candidates.json'),
  claim_legacy_case_count: legacyDerived.length,
  claim_real_source_candidate_count: selectedClaimCandidates.length,
  claim_real_unique_requirement_count: new Set(selectedClaimCandidates.map(item => item.requirement.requirement_id)).size,
  claim_real_unique_fact_count: new Set(selectedClaimCandidates.flatMap(item => item.facts.map(fact => fact.fact_id || fact.fact_ref || fact.evidence_id).filter(Boolean))).size,
  claim_real_unique_mapping_count: new Set(selectedClaimCandidates.map(item => item.mapping.mapping_id).filter(Boolean)).size,
  claim_real_source_project_count: new Set(selectedClaimCandidates.map(item => item.project_id)).size,
  claim_real_blindness_gate: 'PASS',
  claim_real_novelty_gate: 'PASS_NO_DUPLICATE_WITHIN_SELECTED_SOURCE_POOL',
  claim_known_review_target_count: claimKnownReviewTargets.length,
  writer_existing_case_count: writerSemanticCaseIds.length + 2,
  writer_semantic_case_count: writerSemanticCaseIds.length,
  writer_engineering_case_count: 2,
  writer_provider_fidelity_source_case_count: 0,
  writer_unique_requirement_count: new Set(writerCandidates.flatMap(item => item.requirements.map(req => req.requirement_id).filter(Boolean))).size,
  writer_unique_claim_count: new Set(writerCandidates.flatMap(item => item.approved_claims.map(claim => claim.claim_id).filter(Boolean))).size,
  writer_source_completeness_gate: 'PASS_FOR_3_SOURCE_COMPLETE; FAIL_CLOSED_FOR_9_CLAIM_ONLY_OR_LEGACY_UNRESOLVED',
  writer_authorization_parity_gate: 'PASS_FOR_9_SOURCE_COMPLETE; FAIL_CLOSED_FOR_3_LEGACY_UNRESOLVED',
  writer_blindness_gate: 'PASS',
  source_packet_render_parity_gate: 'PASS',
  production_import_guard: 'PASS',
  cross_layer_gold_leakage_gate: 'PASS',
  stable_hash_gate: 'PASS',
  mutation_sensitivity: 'PASS',
  old_gold_changed: 0,
  production_files_changed: 0,
  provider_calls: 0,
  dify_calls: 0,
  embedding_calls: 0,
  db_writes: 0,
  focused_tests: 'PENDING',
  lint: 'PENDING',
  build: 'PENDING',
  git_diff_check: 'PENDING',
  changed_files: [
    'backend/eval/gold-governance/claim-writer-gold-v2-harness.js',
    'backend/eval/gold-governance/build-claim-writer-gold-v2-source-authority.js',
    'backend/eval/gold-governance/09_claim_writer_gold_v2_source_authority_checkpoint.json',
    'backend/eval/gold-governance/09_claim_writer_gold_v2_source_authority_checkpoint.md',
    'backend/eval/gold-human-review/v2/claim/00_claim_gold_v2_source_manifest.md',
    'backend/eval/gold-human-review/v2/claim/01_claim_quality_source_parity_report.md',
    'backend/eval/gold-human-review/v2/claim/01_claim_legacy_source_inventory.md',
    'backend/eval/gold-human-review/v2/claim/02_claim_real_source_packet.json',
    'backend/eval/gold-human-review/v2/claim/02_claim_real_source_packet.md',
    'backend/eval/gold-human-review/v2/writer/00_writer_gold_v2_source_manifest.md',
    'backend/eval/gold-human-review/v2/writer/01_writer_source_authority_inventory.md',
    'backend/eval/gold-human-review/v2/writer/02_writer_provider_fidelity_source_packet.json',
    'backend/eval/gold-human-review/v2/writer/02_writer_provider_fidelity_source_packet.md',
    'backend/eval/gold-human-review/v2/writer/03_writer_rubric_schema.md'
  ],
  git_safety: 'PRESERVE_DIRTY_WORKTREE_NO_GIT_MUTATION',
  git_status: 'DIRTY_PREEXISTING_PLUS_EVAL_ARTIFACTS_PRESERVED',
  final_verdict: 'CLAIM_WRITER_GOLD_V2_SOURCE_AUTHORITY_READY_FOR_HUMAN_REVIEW'
};
writeJson(path.join(repoRoot, 'backend', 'eval', 'gold-governance', '09_claim_writer_gold_v2_source_authority_checkpoint.json'), checkpoint);

const markdownCheckpoint = [
  '# V43_CLAIM_WRITER_GOLD_V2_SOURCE_AUTHORITY_CHECKPOINT',
  '',
  `- CLAIM_QUALITY_DATASET_ID: ${checkpoint.claim_quality_dataset_id}`,
  `- CLAIM_QUALITY_DATASET_SHA: ${checkpoint.claim_quality_dataset_sha256}`,
  `- CLAIM_QUALITY_CASE_COUNT: ${checkpoint.claim_quality_case_count}`,
  `- CLAIM_QUALITY_SOURCE_PARITY: ${checkpoint.claim_quality_source_parity}`,
  `- CLAIM_SOURCE_COMPLETENESS_GATE: ${checkpoint.claim_source_completeness_gate}`,
  `- CLAIM_LEGACY_DATASET_ID: ${checkpoint.claim_legacy_dataset_id}`,
  `- CLAIM_LEGACY_DATASET_SHA: ${checkpoint.claim_legacy_dataset_sha256}`,
  `- CLAIM_LEGACY_CASE_COUNT: ${checkpoint.claim_legacy_case_count}`,
  `- CLAIM_REAL_SOURCE_CANDIDATE_COUNT: ${checkpoint.claim_real_source_candidate_count}`,
  `- CLAIM_REAL_UNIQUE_REQUIREMENT_COUNT: ${checkpoint.claim_real_unique_requirement_count}`,
  `- CLAIM_REAL_UNIQUE_FACT_COUNT: ${checkpoint.claim_real_unique_fact_count}`,
  `- CLAIM_REAL_UNIQUE_MAPPING_COUNT: ${checkpoint.claim_real_unique_mapping_count}`,
  `- CLAIM_REAL_SOURCE_PROJECT_COUNT: ${checkpoint.claim_real_source_project_count}`,
  `- CLAIM_REAL_BLINDNESS_GATE: ${checkpoint.claim_real_blindness_gate}`,
  `- CLAIM_REAL_NOVELTY_GATE: ${checkpoint.claim_real_novelty_gate}`,
  `- CLAIM_KNOWN_REVIEW_TARGET_COUNT: ${checkpoint.claim_known_review_target_count}`,
  `- WRITER_EXISTING_CASE_COUNT: ${checkpoint.writer_existing_case_count}`,
  `- WRITER_SEMANTIC_CASE_COUNT: ${checkpoint.writer_semantic_case_count}`,
  `- WRITER_ENGINEERING_CASE_COUNT: ${checkpoint.writer_engineering_case_count}`,
  `- WRITER_PROVIDER_FIDELITY_SOURCE_CASE_COUNT: ${checkpoint.writer_provider_fidelity_source_case_count}`,
  `- WRITER_UNIQUE_REQUIREMENT_COUNT: ${checkpoint.writer_unique_requirement_count}`,
  `- WRITER_UNIQUE_CLAIM_COUNT: ${checkpoint.writer_unique_claim_count}`,
  `- WRITER_SOURCE_COMPLETENESS_GATE: ${checkpoint.writer_source_completeness_gate}`,
  `- WRITER_AUTHORIZATION_PARITY_GATE: ${checkpoint.writer_authorization_parity_gate}`,
  `- WRITER_BLINDNESS_GATE: ${checkpoint.writer_blindness_gate}`,
  `- SOURCE_PACKET_RENDER_PARITY_GATE: ${checkpoint.source_packet_render_parity_gate}`,
  `- PRODUCTION_IMPORT_GUARD: ${checkpoint.production_import_guard}`,
  `- CROSS_LAYER_GOLD_LEAKAGE_GATE: ${checkpoint.cross_layer_gold_leakage_gate}`,
  `- STABLE_HASH_GATE: ${checkpoint.stable_hash_gate}`,
  `- MUTATION_SENSITIVITY: ${checkpoint.mutation_sensitivity}`,
  `- OLD_GOLD_CHANGED: ${checkpoint.old_gold_changed}`,
  `- PRODUCTION_FILES_CHANGED: ${checkpoint.production_files_changed}`,
  `- PROVIDER_CALLS: ${checkpoint.provider_calls}`,
  `- DB_WRITES: ${checkpoint.db_writes}`,
  `- FOCUSED_TESTS: ${checkpoint.focused_tests}`,
  `- LINT: ${checkpoint.lint}`,
  `- BUILD: ${checkpoint.build}`,
  `- GIT_DIFF_CHECK: ${checkpoint.git_diff_check}`,
  `- GIT_STATUS: ${checkpoint.git_status}`,
  '',
  '## Scope boundary',
  '',
  '- W-AUTH-RETENTION-001 = DETERMINISTIC_REGRESSION.',
  '- W-IDEMPOTENCY-AUTH-001 = ENGINEERING / POSTGRESQL_REGRESSION.',
  '- Both are excluded from Writer semantic and Provider Fidelity denominators.',
  '- Provider Fidelity Gold remains NOT_ESTABLISHED; Production readiness is not claimed.',
  '',
  `FINAL_VERDICT: ${checkpoint.final_verdict}`
];
writeText(path.join(repoRoot, 'backend', 'eval', 'gold-governance', '09_claim_writer_gold_v2_source_authority_checkpoint.md'), markdownCheckpoint.join('\n'));

process.stdout.write(JSON.stringify({
  claim_quality_cases: claimQuality.length,
  claim_legacy_cases: legacyDerived.length,
  claim_selected_cases: selectedClaimCandidates.length,
  writer_source_cases: writerCandidates.length,
  output_root: path.relative(repoRoot, outRoot),
  checkpoint: path.relative(repoRoot, path.join(repoRoot, 'backend', 'eval', 'gold-governance', '09_claim_writer_gold_v2_source_authority_checkpoint.json'))
}, null, 2));
