import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const runDir = path.resolve('backend/eval/requirement-unseen-holdout-v1/results/unseen-holdout-v1-2026-09-08T06-21-08-203Z-5faac1ab');
const readJson = (name) => JSON.parse(fs.readFileSync(path.join(runDir, name), 'utf8'));
const writeJson = (name, value) => fs.writeFileSync(path.join(runDir, name), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const fileSha256 = (name) => sha256(fs.readFileSync(path.join(runDir, name)));
const uniq = (values) => [...new Set((values || []).filter(Boolean))];

const canonical = readJson('canonical-requirements.json');
const lineage = readJson('candidate-lineage.json');
const plan = readJson('execution-plan.json');
const quality = readJson('quality-gate-results.json');
const sourcePackets = new Map();
for (const tenderId of ['HOLDOUT-REQ-01', 'HOLDOUT-REQ-02']) {
  const packet = readJson(`repaired-blind-review-packets/source-side/${tenderId}.json`);
  for (const entry of packet.entries || []) {
    for (const ref of entry.source_refs || []) sourcePackets.set(`${tenderId}|${ref}`, entry);
  }
}

const byId = new Map(canonical.requirements.map((entry) => [entry.canonical_requirement_id, entry]));
const bySourceRef = new Map();
for (const entry of lineage.candidates) {
  for (const ref of entry.source_refs || []) {
    if (!bySourceRef.has(ref)) bySourceRef.set(ref, []);
    bySourceRef.get(ref).push(entry);
  }
}

const targetIds = Array.from({ length: 18 }, (_, index) => `HOLDOUT-REQ-01-CAN-${String(145 + index).padStart(4, '0')}`);
const comparison = targetIds.map((id) => {
  const entry = byId.get(id);
  const refs = entry?.source_refs || [];
  const sourceEntries = refs.flatMap((ref) => sourcePackets.has(`${entry.holdout_tender_id}|${ref}`)
    ? [sourcePackets.get(`${entry.holdout_tender_id}|${ref}`)] : []);
  const lineageEntries = refs.flatMap((ref) => bySourceRef.get(ref) || []);
  const exactSourceText = uniq(sourceEntries.map((item) => item.raw_source_text));
  const exactLocations = uniq(lineageEntries.map((item) => JSON.stringify(item.location || null))).map((value) => JSON.parse(value));
  return {
    canonical_requirement_id: id,
    source_parent_context: entry?.natural_parent_context || entry?.resolved_source_context || null,
    exact_source_refs: refs,
    exact_source_text: exactSourceText,
    exact_source_locations: exactLocations,
    candidate_text: entry?.candidate_text || [],
    canonical_text: entry?.canonical_requirement_text || null,
    gate_decision: entry?.quality_gate_decision_class || entry?.quality_gate_decision || null,
    reason_codes: entry?.quality_gate_reason_codes || [],
    source_location_verified: entry?.source_location_verified === true
  };
});

const can0149 = byId.get('HOLDOUT-REQ-01-CAN-0149');
const can0208 = byId.get('HOLDOUT-REQ-01-CAN-0208');
const duplicateRelation = {
  first_case_id: 'HOLDOUT-REQ-01-CAN-0149',
  second_case_id: 'HOLDOUT-REQ-01-CAN-0208',
  canonical_text_equal: can0149?.canonical_requirement_text === can0208?.canonical_requirement_text,
  first_source_refs: can0149?.source_refs || [],
  second_source_refs: can0208?.source_refs || [],
  source_identity_distinct: JSON.stringify(can0149?.source_refs || []) !== JSON.stringify(can0208?.source_refs || []),
  first_exact_source_text: sourcePackets.get('HOLDOUT-REQ-01|C014-S009')?.raw_source_text || null,
  second_exact_source_text: sourcePackets.get('HOLDOUT-REQ-01|C015-S100')?.raw_source_text || null,
  classification: 'SAME_UNDERLYING_REQUIREMENT_DUPLICATED_IN_DOCUMENT',
  counted_as_independent_p0_escape: false,
  rationale: 'Canonical text is identical, while source refs and source contexts are distinct locations in the same Tender. The second occurrence is retained for audit but is not double-counted as an independent semantic escape.'
};

const spanByTender = Object.fromEntries((plan.tenders || []).map((tender) => [tender.tender_id, {
  span_conservation_pass: tender.span_conservation_pass,
  parsed_block_count: tender.parsed_block_count,
  source_resolution_failure_count: tender.source_resolution_failure_count,
  exclusion_explanations: (plan.stage_a_exclusion_explanations || []).filter((item) => item.tender_id === tender.tender_id)
}]));
const canonicalVerified = canonical.requirements.filter((entry) => entry.source_location_verified === true).length;
const lineageUnresolved = lineage.candidates.filter((entry) => entry.source_resolution_status !== 'RESOLVED').length;

const adjudication = {
  artifact_type: 'V43_REQUIREMENT_UNSEEN_HOLDOUT_V1_FAIL_ADJUDICATION_AND_CRITICAL_ESCAPE_FORENSIC',
  artifact_version: '1',
  run_id: canonical.run_id,
  holdout_v1_final_status: 'FAIL',
  holdout_v1_status_transition: 'FAILED_DEVELOPMENT_EVIDENCE',
  requirement_production_certified: false,
  gold_v2_ready: false,
  mapping_ready: false,
  confirmed_p0_escape_count: 1,
  confirmed_p0_case_ids: ['HOLDOUT-REQ-01-CAN-0149'],
  adjudication: {
    holdout_tender_id: 'HOLDOUT-REQ-01',
    canonical_requirement_id: 'HOLDOUT-REQ-01-CAN-0149',
    expected_semantic_label: 'TRUE_ERROR',
    semantic_error_class: 'OMITTED_DISQUALIFICATION_CONSEQUENCE',
    severity: 'P0_COMPLIANCE_CRITICAL',
    expected_gate: 'REVIEW_REQUIRED',
    actual_gate: 'ACCEPT',
    critical_escape: true,
    source_text: '5) \t投标有效期不满足招标文件要求的；',
    parent_context: can0149?.natural_parent_context || null,
    candidate_text: can0149?.candidate_text || [],
    canonical_text: can0149?.canonical_requirement_text || null,
    source_refs: can0149?.source_refs || [],
    source_location_verified: can0149?.source_location_verified === true
  },
  duplicate_semantic_review: duplicateRelation,
  forensic_comparison: comparison,
  root_cause_forensic: {
    primary_classification: 'F_COMBINED_CAUSE',
    contributing_classes: [
      'B_PARENT_CONTEXT_CONSEQUENCE_NOT_BOUND_TO_ATOMIC_ROW',
      'C_NEGATION_DETECTOR_COVERAGE_GAP',
      'D_QUALITY_GATE_ALIGNMENT_GAP'
    ],
    producer_semantic_fidelity: 'FAIL',
    quality_gate_safety_net: 'FAIL',
    parent_consequence_ownership: {
      router: 'NOT_BOUND_IN_THIS_PATH',
      source_resolver: 'RESOLVES_ATOMIC_SOURCE_AND_CONTEXT_BUT_DOES_NOT_AUTHORIZE_PARENT_CONSEQUENCE_INHERITANCE',
      canonicalizer: 'PERSISTS_natural_parent_context_FOR_PACKET_RENDERING_BUT_DOES_NOT_BIND_IT_IN_CANONICAL_TEXT_OR_GATE_INPUT',
      quality_gate: 'RECEIVES_ATOMIC_source_text_ONLY; DOES_NOT_EVALUATE_PARENT_CONSEQUENCE'
    },
    evidence: [
      {
        path: 'backend/eval/requirement-unseen-holdout-v1/execute-holdout-v1.mjs:428',
        symbol: 'validForCanonical construction',
        observation: 'source_text is entry.location.source_text (the atomic row), while source_context_text is retained separately.'
      },
      {
        path: 'backend/src/pipeline/canonical-requirements.js:32',
        symbol: 'buildCanonicalRequirements',
        observation: 'evaluateRequirementCandidateQuality(raw, { sourceText: evidence.source_text, ... }) is called with atomic source text; natural_parent_context is not supplied.'
      },
      {
        path: 'backend/src/pipeline/requirement-quality-gate.js:6,312-316',
        symbol: 'NEGATION_PATTERN / evaluateRequirementCandidateQuality',
        observation: 'The frozen negation pattern covers 不得/禁止/不能/不应/不可/无需/无须/未/无/非 but not bare 不; source and candidate token sets for CAN-0149 are therefore both empty. No parent-consequence detector exists.'
      }
    ],
    not_selected_as_primary: 'A_PRODUCER_CONSEQUENCE_OMISSION is subsumed by the demonstrated parent-context binding failure; a lexical-only conclusion would ignore the parent consequence boundary.'
  },
  same_failure_family_as_post_fix_v2_015: {
    value: 'YES',
    reference_case: 'POST-FIX-V2-015',
    reference_failure_family: 'OMITTED_DISQUALIFICATION_CONSEQUENCE',
    evidence: 'POST-FIX-V2-015 source explicitly states 未提供将作为无效投标, canonical text omits that consequence, and the gate routes to REVIEW_REQUIRED via NEGATION_DISTORTION.'
  },
  span_conservation_forensic: {
    root_classification: 'FRONT_MATTER_OR_TOC',
    actual_requirement_bearing_source_loss: 'NO',
    evidence: {
      holdout_01: spanByTender['HOLDOUT-REQ-01'],
      holdout_02: spanByTender['HOLDOUT-REQ-02'],
      canonical_source_locations_verified: `${canonicalVerified}/${canonical.requirements.length}`,
      lineage_unresolved_count: lineageUnresolved,
      explanation: 'Both false span_conservation flags are accompanied by explicit stage-A exclusions of eight front-matter/TOC blocks per Tender; source-bearing blocks remain in the repaired source packets and all 397 canonical source locations resolve.'
    }
  },
  review_burden: {
    quality_gate_review_total: quality.review_required_count,
    total_canonicals: canonical.canonical_count,
    review_rate_percent: Number((quality.review_required_count / canonical.canonical_count * 100).toFixed(4)),
    holdout_01: { review_required: 82, total: 233, rate_percent: 35.1931 },
    holdout_02: { review_required: 57, total: 164, rate_percent: 34.7561 },
    metric_label: 'REVIEW_RATE_NOT_FALSE_POSITIVE_RATE'
  },
  engineering_baseline: {
    code_freeze_parity: 'PASS',
    source_freeze_parity: 'PASS',
    actual_provider_calls: 43,
    transport_retry: 0,
    schema_failure: 0,
    provider_failure: 0,
    source_resolution_rate_percent: 100,
    cross_tender_source_mismatch: 0
  },
  safety: {
    provider_calls_added: 0,
    production_db_writes: 0,
    gold_mutations: 0,
    mapping_actions: 0,
    claim_actions: 0,
    writer_actions: 0
  },
  source_side_upload_artifacts: [
    'HOLDOUT-REQ-01-source-side.json',
    'HOLDOUT-REQ-02-source-side.json'
  ],
  input_artifact_sha256: {
    canonical_requirements: fileSha256('canonical-requirements.json'),
    candidate_lineage: fileSha256('candidate-lineage.json'),
    quality_gate_results: fileSha256('quality-gate-results.json'),
    execution_plan: fileSha256('execution-plan.json'),
    repaired_source_side_holdout_01: fileSha256('repaired-blind-review-packets/source-side/HOLDOUT-REQ-01.json'),
    repaired_source_side_holdout_02: fileSha256('repaired-blind-review-packets/source-side/HOLDOUT-REQ-02.json')
  },
  stop_reason: 'Forensic adjudication and source-side packet preservation complete; no production or Gold remediation performed.'
};

writeJson('holdout-fail-adjudication.json', adjudication);
writeJson('V43_REQUIREMENT_UNSEEN_HOLDOUT_V1_FAIL_FORENSIC_CHECKPOINT.json', {
  ...adjudication,
  checkpoint: 'V43_REQUIREMENT_UNSEEN_HOLDOUT_V1_FAIL_FORENSIC_CHECKPOINT'
});

for (const tenderId of ['HOLDOUT-REQ-01', 'HOLDOUT-REQ-02']) {
  const sourcePath = path.join(runDir, 'repaired-blind-review-packets', 'source-side', `${tenderId}.json`);
  const uploadPath = path.join(runDir, `${tenderId}-source-side.json`);
  if (!fs.existsSync(uploadPath)) fs.copyFileSync(sourcePath, uploadPath);
}

const md = [
  '# V43 Requirement Unseen Holdout v1 Fail Forensic Checkpoint',
  '',
  `- RUN_ID: ${canonical.run_id}`,
  '- HOLDOUT_V1_FINAL_STATUS: FAIL',
  '- CONFIRMED_P0_ESCAPE_COUNT: 1',
  '- CONFIRMED_P0_CASE_IDS: HOLDOUT-REQ-01-CAN-0149',
  '- PRODUCER_SEMANTIC_FIDELITY: FAIL',
  '- QUALITY_GATE_SAFETY_NET: FAIL',
  '- ROOT_CAUSE_CLASSIFICATION: F_COMBINED_CAUSE (B + C + D)',
  '- SAME_FAILURE_FAMILY_AS_V2_015: YES',
  '- CAN_0208_DUPLICATE_RELATIONSHIP: SAME_UNDERLYING_REQUIREMENT_DUPLICATED_IN_DOCUMENT (not double-counted)',
  '- SPAN_CONSERVATION_ROOT_CLASS: FRONT_MATTER_OR_TOC',
  '- ACTUAL_REQUIREMENT_BEARING_SOURCE_LOSS: NO',
  '- REVIEW_RATE: 35.0126% (not false-positive rate)',
  '- PROVIDER_CALLS_ADDED: 0',
  '- PRODUCTION_DB_WRITES: 0',
  '- GOLD_MUTATIONS: 0',
  '',
  '## CAN-0149',
  '',
  `- Source text: ${adjudication.adjudication.source_text}`,
  `- Candidate: ${adjudication.adjudication.candidate_text.join(' | ')}`,
  `- Canonical: ${adjudication.adjudication.canonical_text}`,
  '- Actual gate: ACCEPT; expected gate: REVIEW_REQUIRED',
  '',
  'Source-side packets are preserved as blind artifacts without expected labels, Provider results, or Gold answers.',
  ''
].join('\n');
fs.writeFileSync(path.join(runDir, 'V43_REQUIREMENT_UNSEEN_HOLDOUT_V1_FAIL_FORENSIC_CHECKPOINT.md'), `${md}\n`, 'utf8');

console.log(JSON.stringify({
  run_dir: runDir,
  adjudication_file: path.join(runDir, 'holdout-fail-adjudication.json'),
  checkpoint_file: path.join(runDir, 'V43_REQUIREMENT_UNSEEN_HOLDOUT_V1_FAIL_FORENSIC_CHECKPOINT.json'),
  upload_artifacts: ['HOLDOUT-REQ-01-source-side.json', 'HOLDOUT-REQ-02-source-side.json'],
  source_packet_sha256: {
    holdout_01: sha256(fs.readFileSync(path.join(runDir, 'HOLDOUT-REQ-01-source-side.json'))),
    holdout_02: sha256(fs.readFileSync(path.join(runDir, 'HOLDOUT-REQ-02-source-side.json')))
  },
  provider_calls_added: 0,
  production_db_writes: 0,
  gold_mutations: 0
}, null, 2));
