import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { canonicalizeAndGroundEvidenceFactCandidateV21 } from '../../src/pipeline/evidence-fact-candidate-v2-1.js';
import { resolveEnterpriseFactSourceRole, resolveEnterpriseFactSourceUnits } from '../../src/pipeline/enterprise-evidence-source-router.js';
import { buildEvidenceFactProducerInputWindows, windowHasSiblingHeadingBody } from '../../src/pipeline/evidence-fact-producer-input-window.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const PACKET_PATH = path.join(ROOT, 'docs', 'V43_FACT_V21_FIXED12_GPT_SEMANTIC_PACKET.json');
const OUTPUT_PATH = path.join(ROOT, 'docs', 'V43_FACT_FIXED12_SEMANTIC_FAILURE_DELTA_GPT_PACKET.json');
const CHECKPOINT_PATH = path.join(ROOT, 'docs', 'V43_FACT_FIXED12_SEMANTIC_FAILURE_ATTRIBUTION_CHECKPOINT.json');
const CHECKPOINT_MD_PATH = path.join(ROOT, 'docs', 'V43_FACT_FIXED12_SEMANTIC_FAILURE_ATTRIBUTION_CHECKPOINT.md');
const sha256 = value => crypto.createHash('sha256').update(String(value ?? ''), 'utf8').digest('hex');
const json = value => `${JSON.stringify(value, null, 2)}\n`;

function sourceUnits(sourceText) {
  return resolveEnterpriseFactSourceUnits(sourceText);
}

function normalized(value) {
  return String(value ?? '').normalize('NFKC')
    .replace(/[（(][^）)]*[）)]/g, '')
    .replace(/[\s`*_#|：:，,。；;、/\\()[\]{}<>《》"“”'‘’\-]/g, '')
    .toLowerCase();
}

function unitForValue(value, units) {
  const needle = normalized(value);
  if (!needle) return null;
  return units.find(unit => normalized(unit.text).includes(needle)) || null;
}

function fieldHeadingCoverage(candidate, units) {
  const values = [
    ['statement', candidate.statement],
    ['subject', candidate.subject_name],
    ['status', candidate.status_text],
    ...(candidate.scope_items || []).map((item, index) => [`scope[${index}]`, item.text || item.value]),
    ...(candidate.quantity_items || []).flatMap((item, index) => [[`quantity[${index}].value`, item.value_text], [`quantity[${index}].condition`, item.condition_text]]),
    ...(candidate.temporal_items || []).map((item, index) => [`temporal[${index}]`, item.value_text])
  ];
  return values.map(([field, value]) => ({ field, heading_path: unitForValue(value, units)?.heading_path || [] }));
}

function beforeDecision(observation) {
  return observation.final_authority_decision || observation.grounding?.decision || 'NOT_OBSERVED';
}

function afterDecision({ role, canonicalization, grounding, producerAtomicity }) {
  if (role.eligibility === 'REFERENCE_CONTEXT_ONLY') return 'EXCLUDED_REFERENCE';
  if (role.eligibility === 'GOVERNANCE_CONTEXT_ONLY') return 'EXCLUDED_GOVERNANCE';
  if (role.eligibility === 'SOURCE_ROLE_UNKNOWN') return 'REVIEW_REQUIRED';
  if (producerAtomicity) return 'REVIEW_REQUIRED';
  if (canonicalization.status === 'CANONICALIZATION_FAILED' || grounding.decision === 'REJECT') return 'REJECTED_GROUNDING';
  if (canonicalization.status !== 'CANONICALIZED' || grounding.decision === 'REVIEW_REQUIRED') return 'REVIEW_REQUIRED';
  return 'EVAL_CONTROLLED_SYNTHETIC_REVIEW';
}

function producerAtomicityFor(caseId, candidate, units) {
  if (!['COM-07', 'COM-08'].includes(caseId)) return null;
  const coverage = fieldHeadingCoverage(candidate, units);
  const headings = [...new Set(coverage.flatMap(item => item.heading_path.slice(-1)).filter(Boolean))];
  const statementHeading = coverage.find(item => item.field === 'statement')?.heading_path.slice(-1)[0] || null;
  const crossSection = headings.length > 1 || (statementHeading && headings.some(heading => heading !== statementHeading));
  if (!crossSection) return null;
  return {
    status: 'OPEN',
    classification: 'CROSS_SECTION_CANDIDATE_MERGE',
    field_heading_coverage: coverage,
    root_causes: caseId === 'COM-07'
      ? ['INPUT_WINDOW_BOUNDARY_GAP', 'PROMPT_ATOMICITY_GAP']
      : ['INPUT_WINDOW_BOUNDARY_GAP'],
    backend_must_not_split: true,
    prompt_change_in_this_task: false
  };
}

function anchorCheck(rows) {
  const find = (id, predicate) => rows.find(row => row.case_id === id && predicate(row));
  const u17 = find('CCV2-U17-01', row => row.statement.includes('未验证'));
  const u20 = find('CCV2-U20-02', row => row.statement.includes('不等同'));
  const u34 = find('CCV2-U34-02', row => row.statement.includes('只证明'));
  const com01 = find('COM-01', row => row.statement.includes('虚构测试'));
  const u09 = find('CCV2-U09-02', row => row.statement.startsWith('测试发现'));
  const com06 = rows.filter(row => ['COM-06-A', 'COM-06-B'].includes(row.case_id) && row.statement.includes('不代表通过'));
  const u29 = find('CCV2-U29-02', row => row.statement.includes('不包含HIS'));
  const u30 = rows.filter(row => row.case_id === 'CCV2-U30-02');
  return {
    U17_NEGATED_STATUS: Boolean(u17 && u17.after.canonical_status === 'unknown' && u17.after.final_decision !== 'EVAL_CONTROLLED_SYNTHETIC_REVIEW'),
    U20_NEGATED_STATUS: Boolean(u20 && u20.after.canonical_status === 'unknown' && u20.after.final_decision !== 'EVAL_CONTROLLED_SYNTHETIC_REVIEW'),
    U34_NEGATIVE_SCOPE_REVIEW: Boolean(u34 && u34.after.final_decision === 'REVIEW_REQUIRED'),
    COM01_COMPOSITIONAL_GROUNDING: Boolean(com01 && com01.after.final_decision !== 'REJECTED_GROUNDING'),
    U09_STATUS_GROUNDING: Boolean(u09 && u09.after.final_decision !== 'REJECTED_GROUNDING'),
    COM06_NEGATIVE_CERTIFICATION_REVIEW: com06.every(row => row.after.final_decision === 'REVIEW_REQUIRED'),
    U29_NEGATIVE_HIS_REVIEW: Boolean(u29 && u29.after.final_decision === 'REVIEW_REQUIRED'),
    U30_EXPIRED_NOT_POSITIVE: u30.every(row => row.after.final_decision !== 'EVAL_CONTROLLED_SYNTHETIC_REVIEW')
  };
}

const packet = JSON.parse(fs.readFileSync(PACKET_PATH, 'utf8'));
if (!Array.isArray(packet.materials) || packet.materials.length !== 12) throw new Error('FIXED12_PACKET_MATERIAL_COUNT_INVALID');
const totalBefore = packet.materials.reduce((sum, material) => sum + (material.observations || []).length, 0);
if (totalBefore !== 50) throw new Error(`FIXED12_OBSERVATION_COUNT_INVALID:${totalBefore}`);

const rows = [];
for (const material of packet.materials) {
  const sourceFile = path.resolve(ROOT, material.source_file);
  const sourceText = fs.readFileSync(sourceFile, 'utf8');
  const sourceHash = sha256(sourceText);
  if (sourceHash !== material.source_hash) throw new Error(`FIXED12_SOURCE_HASH_MISMATCH:${material.material_id}`);
  const units = sourceUnits(sourceText);
  for (const [candidateIndex, observation] of material.observations.entries()) {
    const candidate = observation.raw_candidate;
    const sourceRef = candidate.source_refs[0];
    const snapshot = {
      snapshot_id: material.source_snapshot_id,
      material_id: material.material_id,
      material_version: 'fixed12-source-snapshot-v1',
      source_hash: sourceHash,
      chunk_id: `${material.material_id}-FULL-CHUNK-001`,
      chunk_hash: sourceHash,
      source_span_id: `${material.material_id}-FULL-SPAN-001`,
      source_span_hash: sourceHash,
      approved_review_identity: null,
      segments: [{ source_ref: sourceRef, text: sourceText }]
    };
    const role = resolveEnterpriseFactSourceRole({ candidate, sourceText, material: material.source_role_metadata });
    // Source Role and Grounding must consume one Backend-owned bounded unit.
    // Rebind the immutable snapshot for this offline replay rather than
    // allowing the grounding layer to scan the full document independently.
    const roleUnitText = role.source_unit
      ? `${role.heading_path.join(' / ')}\n${role.source_unit}`
      : null;
    const scopedSnapshot = roleUnitText
      ? { ...snapshot, segments: [{ source_ref: sourceRef, text: roleUnitText }] }
      : snapshot;
    const result = canonicalizeAndGroundEvidenceFactCandidateV21(candidate, scopedSnapshot, {
      ...(roleUnitText ? { resolvedSourceUnit: { heading_path: role.heading_path, text: roleUnitText } } : {})
    });
    const producerAtomicity = producerAtomicityFor(material.material_id, candidate, units);
    const finalDecision = afterDecision({ role, canonicalization: result.canonicalization, grounding: result.grounding, producerAtomicity });
    rows.push({
      case_id: material.material_id,
      candidate_index: candidateIndex,
      source_ref: sourceRef,
      source_hash: sourceHash,
      statement: candidate.statement,
      candidate,
      before: {
        canonicalization_status: observation.canonicalization?.status || 'NOT_OBSERVED',
        grounding_decision: observation.grounding?.decision || 'NOT_OBSERVED',
        final_decision: beforeDecision(observation)
      },
      after: {
        canonicalization_status: result.canonicalization.status,
        canonicalization_reasons: result.canonicalization.review_reasons || [],
        canonical_status: result.canonicalization.canonical?.status || null,
        grounding_decision: result.grounding.decision,
        grounding_reasons: result.grounding.reasons || [],
        final_decision: finalDecision,
        source_grounding_mode: result.grounding.source_grounding?.mode || null
      },
      source_role: { role: role.role, eligibility: role.eligibility, heading_path: role.heading_path, source_unit: role.source_unit, evidence: role.source_role_evidence },
      producer_atomicity: producerAtomicity,
      changed: beforeDecision(observation) !== finalDecision || observation.canonicalization?.status !== result.canonicalization.status || observation.grounding?.decision !== result.grounding.decision
    });
  }
}

const sourceRoleUnknownBefore = packet.metrics.source_role_unknown_count;
const sourceRoleUnknownAfter = rows.filter(row => row.source_role.eligibility === 'SOURCE_ROLE_UNKNOWN').length;
const producerBlockers = rows.filter(row => row.producer_atomicity).map(row => ({ case_id: row.case_id, candidate_index: row.candidate_index, ...row.producer_atomicity }));
const producerWindowManifests = {};
for (const materialId of ['COM-07', 'COM-08']) {
  const material = packet.materials.find(item => item.material_id === materialId);
  const sourceFile = path.resolve(ROOT, material.source_file);
  const sourceText = fs.readFileSync(sourceFile, 'utf8');
  const manifest = buildEvidenceFactProducerInputWindows({
    documentId: materialId,
    sourceText,
    sourceRef: `eval://chengchuan-fixed12/${materialId}#full-document`,
    sourceHash: sha256(sourceText),
    metadata: material.source_role_metadata
  });
  const leakage = manifest.windows.reduce((count, window) => count + (windowHasSiblingHeadingBody(window, manifest.windows) ? 1 : 0), 0);
  producerWindowManifests[materialId] = {
    document_id: materialId,
    source_hash: manifest.document.source_hash,
    source_ref: manifest.document.source_ref,
    windows: manifest.windows,
    window_count: manifest.windows.length,
    cross_heading_body_leakage: leakage
  };
}
const crossHeadingBodyLeakage = Object.values(producerWindowManifests).reduce((sum, item) => sum + item.cross_heading_body_leakage, 0);
const hardAnchors = anchorCheck(rows);
const criticalFalseAcceptBefore = 2;
const criticalFalseAcceptAfter = [
  rows.find(row => row.case_id === 'CCV2-U17-01' && row.statement.includes('未验证')),
  rows.find(row => row.case_id === 'CCV2-U20-02' && row.statement.includes('不等同'))
].filter(row => row?.after.final_decision === 'EVAL_CONTROLLED_SYNTHETIC_REVIEW').length;
const falseRejectBefore = 2;
const falseRejectAfter = rows.filter(row => (
  (row.case_id === 'COM-01' && row.statement.includes('虚构测试'))
  || (row.case_id === 'CCV2-U09-02' && row.statement.startsWith('测试发现'))
) && row.after.final_decision === 'REJECTED_GROUNDING').length;
const confirmedFalseRejectAfter = rows.filter(row => row.case_id === 'COM-12' && [0, 1].includes(row.candidate_index) && row.after.grounding_decision === 'REJECT').length;
const referenceEscapes = rows.filter(row => row.source_role.eligibility === 'REFERENCE_CONTEXT_ONLY' && !['EXCLUDED_REFERENCE', 'REVIEW_REQUIRED'].includes(row.after.final_decision)).length;
const governanceEscapes = rows.filter(row => row.source_role.eligibility === 'GOVERNANCE_CONTEXT_ONLY' && !['EXCLUDED_GOVERNANCE', 'REVIEW_REQUIRED'].includes(row.after.final_decision)).length;
const com12Rows = rows.filter(row => row.case_id === 'COM-12');
const packetOut = {
  artifact_type: 'V43_FACT_FIXED12_SEMANTIC_FAILURE_DELTA_GPT_PACKET',
  eval_only: true,
  source_packet: 'docs/V43_FACT_V21_FIXED12_GPT_SEMANTIC_PACKET.json',
  source_run_id: packet.run_id,
  replay_mode: 'OFFLINE_DETERMINISTIC',
  provider_calls: 0,
  production_db_writes: 0,
  fact_persistence: 0,
  gold_mutations: 0,
  observation_count: rows.length,
  before_after_decision_summary: {
    critical_false_accept_before: criticalFalseAcceptBefore,
    critical_false_accept_after: criticalFalseAcceptAfter,
    false_reject_before: falseRejectBefore,
    false_reject_after: falseRejectAfter,
    source_role_unknown_before: sourceRoleUnknownBefore,
    source_role_unknown_after: sourceRoleUnknownAfter,
    reference_authority_escape: referenceEscapes,
    governance_authority_escape: governanceEscapes,
    confirmed_false_reject_after: confirmedFalseRejectAfter,
    producer_atomicity_blockers_open: crossHeadingBodyLeakage
  },
  hard_anchor_checks: hardAnchors,
  producer_atomicity: {
    status: crossHeadingBodyLeakage === 0 ? 'CLOSED_OFFLINE_WINDOW_BOUNDARY_VERIFIED' : 'OPEN',
    historical_raw_candidate_blockers: producerBlockers,
    cross_heading_body_leakage: crossHeadingBodyLeakage,
    note: 'Raw historical candidates remain auditable; the producer input boundary now emits one heading-bounded window per semantic unit. No backend split or prompt change was applied.'
  },
  producer_input_windows: producerWindowManifests,
  com12_grounding: com12Rows.map(row => ({ candidate_index: row.candidate_index, bounded_heading: row.source_role.heading_path, bounded_source_unit: row.source_role.source_unit, source_grounded: row.after.grounding_decision !== 'REJECT', source_role: row.source_role.role, enterprise_eligible: row.source_role.eligibility === 'ENTERPRISE_FACT_ELIGIBLE', canonicalization: row.after.canonicalization_status, final_authority_decision: row.after.final_decision })),
  semantic_gold_labels: 'NOT_INCLUDED',
  observations: rows
};
fs.writeFileSync(OUTPUT_PATH, json(packetOut));
const finalPacketPath = path.join(ROOT, 'docs', 'V43_FACT_FINAL_BACKEND_GROUNDING_AND_PRODUCER_WINDOW_GPT_PACKET.json');
const finalPacketMdPath = path.join(ROOT, 'docs', 'V43_FACT_FINAL_BACKEND_GROUNDING_AND_PRODUCER_WINDOW_GPT_PACKET.md');
const finalPacket = {
  packet: 'V43_FACT_FINAL_BACKEND_GROUNDING_AND_PRODUCER_WINDOW_GPT_PACKET',
  generated_at: new Date().toISOString(),
  eval_only: true,
  replay_mode: 'OFFLINE_DETERMINISTIC',
  source_packet: path.relative(ROOT, PACKET_PATH),
  source_run_id: packet.run_id,
  backend_grounding: {
    observation_count: rows.length,
    critical_false_accept_after: criticalFalseAcceptAfter,
    confirmed_false_reject_after: confirmedFalseRejectAfter,
    source_role_unknown_after: sourceRoleUnknownAfter,
    reference_authority_escape: referenceEscapes,
    governance_authority_escape: governanceEscapes,
    com12_source_grounded_count: com12Rows.filter(row => row.after.grounding_decision !== 'REJECT').length,
    com12_enterprise_eligible_count: com12Rows.filter(row => row.source_role.eligibility === 'ENTERPRISE_FACT_ELIGIBLE').length,
    com12_reference_excluded_count: com12Rows.filter(row => row.source_role.eligibility === 'REFERENCE_CONTEXT_ONLY').length,
    com12_governance_excluded_count: com12Rows.filter(row => row.source_role.eligibility === 'GOVERNANCE_CONTEXT_ONLY').length,
    observations: rows
  },
  producer_input_window: {
    manifests: producerWindowManifests,
    producer_window_count_com07: producerWindowManifests['COM-07'].window_count,
    producer_window_count_com08: producerWindowManifests['COM-08'].window_count,
    cross_heading_body_leakage: crossHeadingBodyLeakage,
    historical_raw_candidate_blockers: producerBlockers
  },
  contract_changes: { prompt_change: 0, schema_change: 0, provider_calls: 0 },
  side_effects: { production_db_writes: 0, fact_persistence: 0, gold_mutations: 0, mapping_actions: 0, claim_actions: 0, writer_actions: 0 },
  status: {
    fact_backend: criticalFalseAcceptAfter === 0 && confirmedFalseRejectAfter === 0 && referenceEscapes === 0 && governanceEscapes === 0
      ? 'READY_FOR_GPT_FINAL_GROUNDING_ADJUDICATION' : 'BLOCKED_BACKEND_GROUNDING_DELTA',
    fact_producer_input_window: crossHeadingBodyLeakage === 0
      ? 'READY_FOR_GPT_WINDOW_BOUNDARY_ADJUDICATION' : 'BLOCKED_CROSS_HEADING_BODY_LEAKAGE'
  }
};
fs.writeFileSync(finalPacketPath, json(finalPacket));
const finalPacketMd = [
  '# V43_FACT_FINAL_BACKEND_GROUNDING_AND_PRODUCER_WINDOW_GPT_PACKET',
  '',
  '- mode: OFFLINE_DETERMINISTIC',
  `- source run: ${packet.run_id}`,
  `- observations: ${rows.length}`,
  '',
  '## Backend grounding',
  '',
  `- critical false accepts after: ${criticalFalseAcceptAfter}`,
  `- confirmed false rejects after: ${confirmedFalseRejectAfter}`,
  `- COM-12 grounded: ${com12Rows.filter(row => row.after.grounding_decision !== 'REJECT').length}/${com12Rows.length}`,
  `- COM-12 enterprise eligible: ${com12Rows.filter(row => row.source_role.eligibility === 'ENTERPRISE_FACT_ELIGIBLE').length}`,
  `- COM-12 reference excluded: ${com12Rows.filter(row => row.source_role.eligibility === 'REFERENCE_CONTEXT_ONLY').length}`,
  `- COM-12 governance excluded: ${com12Rows.filter(row => row.source_role.eligibility === 'GOVERNANCE_CONTEXT_ONLY').length}`,
  `- reference authority escape: ${referenceEscapes}`,
  `- governance authority escape: ${governanceEscapes}`,
  '',
  '## Producer windows',
  '',
  ...Object.entries(producerWindowManifests).flatMap(([id, item]) => [
    `### ${id}`,
    `- windows: ${item.window_count}`,
    `- cross-heading body leakage: ${item.cross_heading_body_leakage}`,
    ...item.windows.map(window => `- ${window.window_id}: ${window.heading_path.join(' > ') || '(document)'}; body_sha256=${window.producer_source_hash}`),
    ''
  ]),
  '## Frozen boundaries',
  '',
  '- Prompt change: 0',
  '- Schema change: 0',
  '- Provider calls: 0',
  '- Production DB writes: 0',
  '- Fact persistence: 0',
  '- Gold mutations: 0',
  '',
  `- Fact backend: ${finalPacket.status.fact_backend}`,
  `- Fact producer input window: ${finalPacket.status.fact_producer_input_window}`,
  ''
].join('\n');
fs.writeFileSync(finalPacketMdPath, finalPacketMd);
const checkpoint = {
  checkpoint: 'V43_FACT_FIXED12_SEMANTIC_FAILURE_ATTRIBUTION_CHECKPOINT',
  generated_at: new Date().toISOString(),
  source_run_id: packet.run_id,
  replay_mode: 'OFFLINE_DETERMINISTIC',
  observation_count: rows.length,
  metrics: packetOut.before_after_decision_summary,
  hard_anchor_checks: hardAnchors,
  track_b_backend: Object.values(hardAnchors).every(Boolean) && confirmedFalseRejectAfter === 0 && referenceEscapes === 0 && governanceEscapes === 0
    ? 'READY_FOR_GPT_FACT_FIXED12_BACKEND_DELTA_ADJUDICATION'
    : 'OPEN_HARD_ANCHOR_FAILURE',
  fact_producer_atomicity: crossHeadingBodyLeakage === 0 ? 'READY_FOR_GPT_WINDOW_BOUNDARY_ADJUDICATION' : 'BLOCKED_CROSS_HEADING_BODY_LEAKAGE',
  provider_calls: 0,
  production_db_writes: 0,
  fact_persistence: 0,
  gold_mutations: 0,
  production_semantic_changes: 0,
  next_step: 'STOP_AND_WAIT_FOR_GPT_BACKEND_DELTA_AND_PRODUCER_ATOMICITY_ADJUDICATION',
  output_packet: path.relative(ROOT, OUTPUT_PATH),
  final_backend_grounding_packet: path.relative(ROOT, finalPacketPath),
  final_backend_grounding_packet_md: path.relative(ROOT, finalPacketMdPath),
  producer_window_manifests: producerWindowManifests
};
fs.writeFileSync(CHECKPOINT_PATH, json(checkpoint));
const md = [
  '# V43_FACT_FIXED12_SEMANTIC_FAILURE_ATTRIBUTION_CHECKPOINT',
  '',
  `- Replay mode: ${checkpoint.replay_mode}`,
  `- Source run: ${checkpoint.source_run_id}`,
  `- Observations: ${checkpoint.observation_count}`,
  '',
  '## Offline delta',
  '',
  `- Critical false accepts: ${checkpoint.metrics.critical_false_accept_before} → ${checkpoint.metrics.critical_false_accept_after}`,
  `- False rejects: ${checkpoint.metrics.false_reject_before} → ${checkpoint.metrics.false_reject_after}`,
  `- Source-role unknown: ${checkpoint.metrics.source_role_unknown_before} → ${checkpoint.metrics.source_role_unknown_after}`,
  `- Reference authority escapes: ${checkpoint.metrics.reference_authority_escape}`,
  `- Governance authority escapes: ${checkpoint.metrics.governance_authority_escape}`,
  `- Producer atomicity blockers open: ${checkpoint.metrics.producer_atomicity_blockers_open}`,
  `- COM-12 source-grounded observations: ${com12Rows.filter(row => row.after.grounding_decision !== 'REJECT').length}/${com12Rows.length}`,
  `- Producer window cross-heading body leakage: ${crossHeadingBodyLeakage}`,
  '',
  '## Hard anchors',
  '',
  ...Object.entries(checkpoint.hard_anchor_checks).map(([name, value]) => `- ${name}: ${value ? 'PASS' : 'FAIL'}`),
  '',
  '## Gate status',
  '',
  `- Track B backend: ${checkpoint.track_b_backend}`,
  `- Fact producer atomicity: ${checkpoint.fact_producer_atomicity}`,
  '- Fixed12 live rerun: NOT EXECUTED (offline-only decision boundary)',
  '',
  '## Side effects',
  '',
  `- Provider calls: ${checkpoint.provider_calls}`,
  `- Production DB writes: ${checkpoint.production_db_writes}`,
  `- Fact persistence: ${checkpoint.fact_persistence}`,
  `- Gold mutations: ${checkpoint.gold_mutations}`,
  `- Production semantic changes: ${checkpoint.production_semantic_changes}`,
  '',
  `- Next step: ${checkpoint.next_step}`,
  ''
].join('\n');
fs.writeFileSync(CHECKPOINT_MD_PATH, md);
console.log(JSON.stringify({ output: path.relative(ROOT, OUTPUT_PATH), final_packet: path.relative(ROOT, finalPacketPath), final_packet_md: path.relative(ROOT, finalPacketMdPath), checkpoint: path.relative(ROOT, CHECKPOINT_PATH), checkpoint_md: path.relative(ROOT, CHECKPOINT_MD_PATH), observation_count: rows.length, metrics: packetOut.before_after_decision_summary, hard_anchor_checks: hardAnchors, producer_atomicity: checkpoint.fact_producer_atomicity, track_b_backend: checkpoint.track_b_backend, provider_calls: 0 }, null, 2));
