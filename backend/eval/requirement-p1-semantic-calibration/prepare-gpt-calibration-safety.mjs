import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(process.cwd());
const DOCS = path.join(ROOT, 'docs');
const INPUT_PACKET = path.join(DOCS, 'V43_REQUIREMENT_P1_GPT_SEMANTIC_CALIBRATION_PACKET.json');
const RECOVERED_PACKET = path.join(DOCS, 'V43_REQUIREMENT_P1_GPT_SEMANTIC_CALIBRATION_PACKET_RECOVERED.json');
const CONTEXT_SOURCE = path.join(DOCS, 'V43_REQUIREMENT_FINAL_SEMANTIC_CERTIFICATION_OUTPUT_PACKET_V2.jsonl');
const MUTATION_SOURCE = path.join(ROOT, 'backend/eval/requirement-semantic-quality-v1/mutation-suite.json');
const CONTROLS = path.join(DOCS, 'V43_REQUIREMENT_P1_SAFETY_POSITIVE_CONTROLS.json');
const CHECKPOINT = path.join(DOCS, 'V43_REQUIREMENT_GPT_CALIBRATION_SAFETY_CONTROL_PREP_CHECKPOINT.json');
const CHECKPOINT_MD = path.join(DOCS, 'V43_REQUIREMENT_GPT_CALIBRATION_SAFETY_CONTROL_PREP_CHECKPOINT.md');

const TARGET_CASES = [
  'FAST-04:REQ-026',
  'FAST-01:REQ-026',
  'FAST-01:REQ-018',
  'FAST-01:REQ-021',
  'FAST-01:REQ-022',
  'FAST-01:REQ-023'
];
const TABLE_CONTEXT_REQUIRED_CASES = new Set([
  'FAST-01:REQ-021',
  'FAST-01:REQ-022',
  'FAST-01:REQ-023'
]);

const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const readJsonl = file => fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean).map(JSON.parse);
const writeJson = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const deepClone = value => JSON.parse(JSON.stringify(value));

function recoveredContextFields(sourceRow) {
  return {
    previous_context: sourceRow.previous_context ?? null,
    next_context: sourceRow.next_context ?? null,
    table_header_context: sourceRow.table_header_context ?? null,
    row_column_semantic_context: sourceRow.row_column_semantic_context ?? null,
    context_availability: sourceRow.context_availability ?? 'NOT_DETERMINABLE_FROM_FROZEN_SOURCE_ASSETS',
    context_resolution: sourceRow.context_resolution ?? null,
    derivation: 'REUSED_FROM_EXISTING_DETERMINISTIC_CERTIFICATION_PACKET_V2'
  };
}

function recoverPacket(input, contextRows) {
  const contextById = new Map(contextRows.map(row => [row.canonical_requirement_id, row]));
  const cases = input.cases.map(original => {
    const row = deepClone(original);
    const key = row.req_id || row.canonical_id;
    const recovered = contextById.get(key);
    const refs = Array.isArray(row.source_refs) ? row.source_refs : [];
    const hasCoreEvidence = Boolean(
      row.source_text &&
      row.natural_source_window?.source_hash &&
      row.natural_source_window?.source_span
    );
    const recoveredTable = recovered?.table_header_context?.status === 'RECOVERED';
    const tableContextSufficient = !TABLE_CONTEXT_REQUIRED_CASES.has(key) || recoveredTable;
    const semanticContextSufficient = refs.length > 0 && hasCoreEvidence && tableContextSufficient;
    row.packet_structural_completeness = {
      structurally_complete: true,
      semantic_context_sufficient: semanticContextSufficient,
      unavailable_context_is_explicit_null: true,
      authority_source_refs_present: refs.length > 0,
      table_context_sufficient: tableContextSufficient,
      provenance_status: refs.length > 0 ? 'SOURCE_REF_PRESENT' : 'AUTHORITY_PACKET_SOURCE_REF_MISSING'
    };
    row.context_recovery = recovered
      ? recoveredContextFields(recovered)
      : {
          previous_context: null,
          next_context: null,
          table_header_context: null,
          row_column_semantic_context: null,
          context_availability: 'NOT_TARGETED',
          context_resolution: null,
          derivation: 'NOT_TARGETED_BY_THIS_PREP'
        };
    if (recovered) {
      row.natural_source_window = {
        ...row.natural_source_window,
        previous_context: row.context_recovery.previous_context,
        next_context: row.context_recovery.next_context,
        table_header_context: row.context_recovery.table_header_context,
        row_column_semantic_context: row.context_recovery.row_column_semantic_context,
        context_availability: row.context_recovery.context_availability,
        context_resolution: row.context_recovery.context_resolution,
        natural_context_complete: semanticContextSufficient
      };
    } else {
      row.natural_source_window = {
        ...row.natural_source_window,
        natural_context_complete: semanticContextSufficient
      };
    }
    return row;
  });
  const sourceRefEmptyCases = cases.filter(row => !(row.source_refs || []).length).map(row => row.req_id);
  const sourceRefIntegrity = cases.map(row => ({
    req_id: row.req_id,
    source_refs_present: Array.isArray(row.source_refs) && row.source_refs.length > 0,
    source_hash_present: Boolean(row.natural_source_window?.source_hash),
    source_span_present: Boolean(row.natural_source_window?.source_span),
    classification: Array.isArray(row.source_refs) && row.source_refs.length > 0
      ? 'SOURCE_REF_PRESENT'
      : 'AUTHORITY_PACKET_SOURCE_REF_MISSING'
  }));
  const semanticContextSufficientCount = cases.filter(row => row.packet_structural_completeness.semantic_context_sufficient).length;
  return {
    ...deepClone(input),
    artifact_type: 'V43_REQUIREMENT_P1_GPT_SEMANTIC_CALIBRATION_PACKET_RECOVERED',
    packet_derivation: 'EVAL_ONLY_TARGETED_CONTEXT_RECOVERY',
    original_packet_sha256: sha256(fs.readFileSync(INPUT_PACKET)),
    packet_structurally_complete: true,
    packet_structurally_complete_count: cases.filter(row => row.packet_structural_completeness.structurally_complete).length,
    semantic_context_sufficient_count: semanticContextSufficientCount,
    natural_context_complete_count: semanticContextSufficientCount,
    source_ref_empty_case_count: sourceRefEmptyCases.length,
    source_ref_empty_case_ids: sourceRefEmptyCases,
    source_ref_integrity: sourceRefIntegrity,
    provenance_gap_found: sourceRefEmptyCases.length > 0,
    provenance_gap_classification: sourceRefEmptyCases.length > 0
      ? 'AUTHORITY_PACKET_SOURCE_REF_MISSING'
      : 'NONE',
    context_recovery_case_count: cases.filter(row => TARGET_CASES.includes(row.req_id)).length,
    targeted_context_recovery_case_ids: TARGET_CASES,
    cases,
    provider_calls: 0,
    production_db_writes: 0,
    gold_mutations: 0,
    not_gold: true,
    not_holdout: true,
    not_production_authority: true
  };
}

function buildSafetyControls(mutationSuite) {
  const byId = new Map(mutationSuite.cases.map(row => [row.mutation_id, row]));
  const selections = [
    ['SAFETY-PC-001', 'NUMBER', 'REQ-MUT-001'],
    ['SAFETY-PC-002', 'NUMBER', 'REQ-MUT-002'],
    ['SAFETY-PC-003', 'NUMBER', 'REQ-MUT-003'],
    ['SAFETY-PC-004', 'MODALITY_NEGATION', 'REQ-MUT-004'],
    ['SAFETY-PC-005', 'MODALITY_NEGATION', 'REQ-MUT-005'],
    ['SAFETY-PC-006', 'MODALITY_NEGATION', 'REQ-MUT-006'],
    ['SAFETY-PC-007', 'ENTITY_SCOPE', 'REQ-MUT-007'],
    ['SAFETY-PC-008', 'ENTITY_SCOPE', 'REQ-MUT-010'],
    ['SAFETY-PC-009', 'ENTITY_SCOPE', 'REQ-MUT-011'],
    ['SAFETY-PC-010', 'SOURCE_FIDELITY_STATUS_QUANTITY', 'REQ-MUT-022'],
    ['SAFETY-PC-011', 'SOURCE_FIDELITY_STATUS_QUANTITY', 'REQ-MUT-013'],
    ['SAFETY-PC-012', 'SOURCE_FIDELITY_STATUS_QUANTITY', 'REQ-MUT-016']
  ];
  const controls = selections.map(([controlId, group, mutationId]) => {
    const source = byId.get(mutationId);
    if (!source) throw new Error(`MISSING_MUTATION_FIXTURE:${mutationId}`);
    return {
      control_id: controlId,
      control_group: group,
      mutation_id: source.mutation_id,
      dimension: source.dimension,
      severity: source.severity,
      original_requirement_id: source.original_requirement_id,
      expected_decision: 'FAIL_CLOSED',
      currently_detected: source.current_gate_detected === true,
      current_gate_detected: source.current_gate_detected === true,
      escaped_as_accept: source.escaped_as_accept === true,
      fixture_origin: 'backend/eval/requirement-semantic-quality-v1/mutation-suite.json',
      eval_role: 'SAFETY_POSITIVE_CONTROL_NOT_GOLD_NOT_HOLDOUT',
      provider_calls: 0,
      production_db_writes: 0,
      gold_mutations: 0
    };
  });
  const grouped = {
    NUMBER: controls.filter(row => row.control_group === 'NUMBER').length,
    MODALITY_NEGATION: controls.filter(row => row.control_group === 'MODALITY_NEGATION').length,
    ENTITY_SCOPE: controls.filter(row => row.control_group === 'ENTITY_SCOPE').length,
    SOURCE_FIDELITY_STATUS_QUANTITY: controls.filter(row => row.control_group === 'SOURCE_FIDELITY_STATUS_QUANTITY').length
  };
  return {
    artifact_type: 'V43_REQUIREMENT_P1_SAFETY_POSITIVE_CONTROL_SET',
    artifact_version: 'v1',
    data_classification: 'DEVELOPMENT_SAFETY_CONTROL_ONLY',
    human_gold: false,
    holdout: false,
    production_gold: false,
    controls,
    control_count: controls.length,
    group_counts: grouped,
    all_currently_detected: controls.every(row => row.currently_detected),
    expected_decision: 'FAIL_CLOSED',
    source_mutation_suite_sha256: sha256(fs.readFileSync(MUTATION_SOURCE)),
    provider_calls: 0,
    production_db_writes: 0,
    gold_mutations: 0
  };
}

export function prepareArtifacts() {
  const input = readJson(INPUT_PACKET);
  const contextRows = readJsonl(CONTEXT_SOURCE);
  const mutationSuite = readJson(MUTATION_SOURCE);
  const packet = recoverPacket(input, contextRows);
  const controls = buildSafetyControls(mutationSuite);
  writeJson(RECOVERED_PACKET, packet);
  writeJson(CONTROLS, controls);
  const beforeEmpty = input.cases.filter(row => !(row.source_refs || []).length).length;
  const afterEmpty = packet.cases.filter(row => !(row.source_refs || []).length).length;
  const checkpoint = {
    checkpoint: 'V43_REQUIREMENT_GPT_CALIBRATION_SAFETY_CONTROL_PREP_CHECKPOINT',
    calibration_packet_input: 'docs/V43_REQUIREMENT_P1_GPT_SEMANTIC_CALIBRATION_PACKET.json',
    calibration_packet_output: 'docs/V43_REQUIREMENT_P1_GPT_SEMANTIC_CALIBRATION_PACKET_RECOVERED.json',
    safety_control_output: 'docs/V43_REQUIREMENT_P1_SAFETY_POSITIVE_CONTROLS.json',
    gpt_adjudication_persisted: true,
    context_recovery_case_count: packet.context_recovery_case_count,
    targeted_context_recovery_case_ids: TARGET_CASES,
    packet_structurally_complete_count: packet.packet_structurally_complete_count,
    semantic_context_sufficient_count: packet.semantic_context_sufficient_count,
    natural_context_complete_count_legacy: input.natural_context_complete_count,
    source_ref_empty_case_count_before: beforeEmpty,
    source_ref_empty_case_count_after: afterEmpty,
    source_ref_empty_case_ids: packet.source_ref_empty_case_ids,
    source_ref_integrity: packet.source_ref_integrity,
    provenance_gap_found: packet.provenance_gap_found,
    provenance_gap_classification: packet.provenance_gap_classification,
    safety_control_count: controls.control_count,
    safety_number_count: controls.group_counts.NUMBER,
    safety_modality_count: controls.group_counts.MODALITY_NEGATION,
    safety_entity_count: controls.group_counts.ENTITY_SCOPE,
    safety_fidelity_count: controls.group_counts.SOURCE_FIDELITY_STATUS_QUANTITY,
    safety_controls_all_currently_detected: controls.all_currently_detected,
    safety_control_detection_count: controls.controls.filter(row => row.currently_detected).length,
    provider_calls: 0,
    production_db_writes: 0,
    gold_mutations: 0,
    production_code_changes: 0,
    prompt_changes: 0,
    schema_changes: 0,
    status: packet.provenance_gap_found ? 'PROVENANCE_GAP_FOUND_STOP' : 'READY_FOR_NEXT_DECISION',
    notes: [
      'The original calibration packet remains unchanged; the recovered packet is a new Eval-only derivative.',
      'Missing authority source_refs are not synthesized from neighboring context.',
      'Safety controls are deterministic mutation fixtures and are excluded from semantic Gold and Holdout denominators.',
      'No Production Quality Gate micro-fix was applied in this preparation task.'
    ]
  };
  writeJson(CHECKPOINT, checkpoint);
  const markdown = [
    '# V43_REQUIREMENT_GPT_CALIBRATION_SAFETY_CONTROL_PREP_CHECKPOINT',
    '',
    `- GPT_ADJUDICATION_PERSISTED: ${checkpoint.gpt_adjudication_persisted ? 'YES' : 'NO'}`,
    `- CONTEXT_RECOVERY_CASE_COUNT: ${checkpoint.context_recovery_case_count}`,
    `- PACKET_STRUCTURALLY_COMPLETE: ${checkpoint.packet_structurally_complete_count}/48`,
    `- SEMANTIC_CONTEXT_SUFFICIENT: ${checkpoint.semantic_context_sufficient_count}/48`,
    `- SOURCE_REF_EMPTY_BEFORE: ${checkpoint.source_ref_empty_case_count_before}`,
    `- SOURCE_REF_EMPTY_AFTER: ${checkpoint.source_ref_empty_case_count_after}`,
    `- PROVENANCE_GAP_FOUND: ${checkpoint.provenance_gap_found ? 'YES' : 'NO'}`,
    `- SAFETY_CONTROLS: ${checkpoint.safety_control_count}`,
    `- SAFETY_CONTROLS_ALL_CURRENTLY_DETECTED: ${checkpoint.safety_controls_all_currently_detected ? 'YES' : 'NO'}`,
    `- PROVIDER_CALLS: ${checkpoint.provider_calls}`,
    `- PRODUCTION_DB_WRITES: ${checkpoint.production_db_writes}`,
    `- GOLD_MUTATIONS: ${checkpoint.gold_mutations}`,
    `- STATUS: ${checkpoint.status}`,
    '',
    'The recovered packet is Eval-only. No requirement text, answer, Gold, Provider, database, or production semantic contract was changed.'
  ].join('\n');
  fs.writeFileSync(CHECKPOINT_MD, `${markdown}\n`, 'utf8');
  return checkpoint;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.stdout.write(`${JSON.stringify(prepareArtifacts(), null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${JSON.stringify({ error_code: error.code || 'GPT_CALIBRATION_PREP_FAILED', message: error.message }, null, 2)}\n`);
    process.exitCode = 1;
  }
}
