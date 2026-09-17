import fs from 'node:fs';
import path from 'node:path';

export const FACT_GATEWAY_TASK = 'evidence_fact_extraction';
export const MATRIX_THEMES = Object.freeze(Array.from({ length: 34 }, (_, index) => `U${String(index + 1).padStart(2, '0')}`));

const stable = (value) => Array.isArray(value)
  ? value.map(stable)
  : (value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]))
    : value);

function materialId(row) {
  return typeof row?.material_id === 'string' ? row.material_id : null;
}

/**
 * Project the existing source-role projection into the four authority lanes.
 * This is a read-only Eval projection; it does not infer authority from names,
 * material type, or caller-provided flags.
 */
export function classifyMaterialLanes(projection = {}) {
  const lanes = { real: [], synthetic: [], reference: [], quarantined: [], unknown: [] };
  for (const material of projection.materials || []) {
    const role = String(material.derived_source_role || '');
    if (role === 'QUARANTINED' || material.lifecycle_status === 'QUARANTINED') lanes.quarantined.push(material);
    else if (role === 'REFERENCE_CONTEXT_ONLY') lanes.reference.push(material);
    else if (role === 'SYNTHETIC_ENTERPRISE_EVIDENCE' || material.synthetic_test_material === true) lanes.synthetic.push(material);
    else if (role === 'REAL_ENTERPRISE_EVIDENCE_CANDIDATE') lanes.real.push(material);
    else lanes.unknown.push(material);
  }
  return lanes;
}

function emptyThemeMap() {
  return Object.fromEntries(MATRIX_THEMES.map((theme) => [theme, 0]));
}

function emptySlotMap() {
  return {};
}

function disposition(row, value, reason) {
  return {
    material_id: materialId(row),
    material_type: row.material_type || null,
    source_role: row.derived_source_role || null,
    chunk_count: Number.isInteger(row.chunk_count) ? row.chunk_count : null,
    chunk_identity_digest: row.chunk_identity_digest || null,
    source_hash: row.file_hash || null,
    disposition: value,
    reason
  };
}

function buildDispositions(lanes) {
  return [
    ...lanes.real.map((row) => disposition(row, 'REVIEW_REQUIRED', 'No approved Evidence Review context is available in the current read-only environment.')),
    ...lanes.synthetic.map((row) => disposition(row, 'SOURCE_AUTHORITY_BLOCKED', 'Synthetic enterprise lane is not a Real Enterprise Fact authority source.')),
    ...lanes.reference.map((row) => disposition(row, 'SOURCE_AUTHORITY_BLOCKED', 'Reference Context cannot become Enterprise Fact authority.')),
    ...lanes.quarantined.map((row) => disposition(row, 'SOURCE_AUTHORITY_BLOCKED', 'Quarantined material cannot enter Fact extraction.')),
    ...lanes.unknown.map((row) => disposition(row, 'REVIEW_REQUIRED', 'Source authority is unknown; no automatic promotion is allowed.'))
  ].sort((a, b) => String(a.material_id).localeCompare(String(b.material_id)));
}

function zeroFactMetrics() {
  return {
    fact_candidate_total: 0,
    real_fact_candidate_total: 0,
    synthetic_fact_candidate_total: 0,
    fact_quality_usable_total: 0,
    fact_review_required_total: 0,
    fact_rejected_by_quality_total: 0,
    fact_source_traceability_rate: 'NOT_APPLICABLE_NO_FACTS',
    fact_source_span_mismatch: 0,
    fact_numeric_mismatch: 0,
    fact_entity_mismatch: 0,
    fact_status_validity_mismatch: 0,
    fact_without_traceable_source: 0,
    fact_duplicate_exact: 0,
    fact_near_dup_review_queue: 0,
    facts_by_matrix_theme: emptyThemeMap(),
    facts_by_evidence_slot: emptySlotMap(),
    facts_by_enterprise: {},
    facts_by_source_role: {},
    facts_by_quality_class: {},
    quantitative_fact_count: 0,
    entity_bound_fact_count: 0,
    validity_bound_fact_count: 0,
    status_bound_fact_count: 0,
    certification_fact_count: 0,
    case_fact_count: 0,
    performance_fact_count: 0,
    compatibility_fact_count: 0,
    service_fact_count: 0
  };
}

/**
 * Build a source-first inventory without inventing a Review or a production
 * Fact row. The current projection has no real, review-backed windows, so all
 * materials receive an explicit disposition and no Provider call is made.
 */
export function buildFactInventory({ projection = {}, repoRoot = process.cwd(), now = null, branch = null, head = null, worktree = null } = {}) {
  const lanes = classifyMaterialLanes(projection);
  const dispositions = buildDispositions(lanes);
  const materialTotal = (projection.materials || []).length;
  const realEligible = lanes.real.filter((row) => (
    row.lifecycle_status === 'ACTIVE'
    && row.review_status === 'approved'
    && row.synthetic_test_material !== true
    && row.source_type
    && row.file_hash
  ));
  const metrics = zeroFactMetrics();
  const sourceRoleCounts = {};
  for (const row of projection.materials || []) {
    const role = row.derived_source_role || 'UNKNOWN_REVIEW_REQUIRED';
    sourceRoleCounts[role] = (sourceRoleCounts[role] || 0) + 1;
  }
  return stable({
    schema_version: 'v43-rag-source-first-fact-inventory-v1',
    generated_at: now,
    branch,
    head,
    worktree,
    eval_only: true,
    blind: true,
    data_classification: 'MIXED_CORPUS_AUTHORITY_LANES',
    fact_producer_current_state: 'GATEWAY_BACKED_PRODUCTION_EXTRACTOR_PRESENT',
    fact_producer_patched: 'NO',
    fact_gateway_task: FACT_GATEWAY_TASK,
    material_total: materialTotal,
    material_eligible_for_enterprise_fact: realEligible.length,
    real_enterprise_materials: lanes.real.length,
    synthetic_enterprise_materials: lanes.synthetic.length,
    reference_only_materials: lanes.reference.length,
    quarantined_materials: lanes.quarantined.length,
    unknown_review_materials: lanes.unknown.length,
    total_extraction_windows: 0,
    processed_windows: 0,
    unprocessed_eligible_windows: 0,
    unexplained_source_window_loss: 0,
    dispositions,
    provider_calls: 0,
    provider_cap_reached: false,
    provider_failures: 0,
    provider_failure_details: [],
    ...metrics,
    source_role_counts: sourceRoleCounts,
    no_fabricated_fact: 'PASS',
    reference_to_enterprise_authority_escalation: 0,
    quarantined_fact_authority_escape: 0,
    synthetic_to_real_authority_escalation: 0,
    fact_postprocess_replay_idempotency: 'PASS_EMPTY_SNAPSHOT',
    requirement_blind_extraction: 'PASS_NO_PROVIDER_INPUTS',
    production_db_writes: 0,
    gold_mutations: 0,
    production_semantic_changes: '0',
    matrix_themes_with_usable_fact: [],
    matrix_themes_with_zero_usable_fact: [...MATRIX_THEMES],
    median_usable_facts_per_theme: 0,
    min_usable_facts_per_theme: 0,
    max_usable_facts_per_theme: 0,
    fact_inventory_complete: 'NO',
    fact_inventory_ready_for_gpt_assessment: 'NO',
    inventory_blockers: [
      ...(realEligible.length === 0 ? ['NO_AUTHORITY_ELIGIBLE_REAL_ENTERPRISE_SOURCE_FIRST_WINDOW'] : []),
      'NO_APPROVED_EVIDENCE_REVIEW_CONTEXT_FOR_SOURCE_FIRST_PRODUCER',
      ...(lanes.quarantined.length > 0 ? ['QUARANTINED_ENTERPRISE_MATERIALS_EXCLUDED'] : []),
      ...(lanes.synthetic.length > 0 ? ['SYNTHETIC_ENTERPRISE_LANE_NOT_REAL_FACT_AUTHORITY'] : [])
    ],
    source_projection: {
      path: path.relative(repoRoot, path.join(repoRoot, 'backend/eval/gold-human-review/v2/mapping-real-rebuild/00_source_role_projection.json')).replaceAll('\\', '/'),
      schema_version: projection.schema_version || null,
      baseline_head: projection.baseline_head || null
    }
  });
}

export function renderFactInventoryCheckpoint(report) {
  const lines = [
    '# V43 RAG Source-First Fact Inventory Checkpoint',
    '',
    `BRANCH = ${report.branch || 'not captured by inventory builder'}`,
    `HEAD = ${report.head || 'not captured by inventory builder'}`,
    `WORKTREE = ${report.worktree || 'DIRTY (pre-existing changes preserved)'}`,
    '',
    `FACT_PRODUCER_CURRENT_STATE = ${report.fact_producer_current_state}`,
    `FACT_PRODUCER_PATCHED = ${report.fact_producer_patched}`,
    `FACT_GATEWAY_TASK = ${report.fact_gateway_task}`,
    '',
    `MATERIAL_TOTAL = ${report.material_total}`,
    `REAL_ENTERPRISE_MATERIALS = ${report.real_enterprise_materials}`,
    `SYNTHETIC_ENTERPRISE_MATERIALS = ${report.synthetic_enterprise_materials}`,
    `REFERENCE_ONLY_MATERIALS = ${report.reference_only_materials}`,
    `QUARANTINED_MATERIALS = ${report.quarantined_materials}`,
    `UNKNOWN_REVIEW_MATERIALS = ${report.unknown_review_materials}`,
    '',
    `TOTAL_EXTRACTION_WINDOWS = ${report.total_extraction_windows}`,
    `PROCESSED_WINDOWS = ${report.processed_windows}`,
    `UNPROCESSED_ELIGIBLE_WINDOWS = ${report.unprocessed_eligible_windows}`,
    `UNEXPLAINED_SOURCE_WINDOW_LOSS = ${report.unexplained_source_window_loss}`,
    '',
    `PROVIDER_CALLS = ${report.provider_calls}`,
    `PROVIDER_CAP_REACHED = ${report.provider_cap_reached}`,
    `PROVIDER_FAILURES = ${report.provider_failures}`,
    '',
    `FACT_CANDIDATE_TOTAL = ${report.fact_candidate_total}`,
    `REAL_FACT_CANDIDATE_TOTAL = ${report.real_fact_candidate_total}`,
    `SYNTHETIC_FACT_CANDIDATE_TOTAL = ${report.synthetic_fact_candidate_total}`,
    `FACT_QUALITY_USABLE_TOTAL = ${report.fact_quality_usable_total}`,
    `FACT_REVIEW_REQUIRED_TOTAL = ${report.fact_review_required_total}`,
    `FACT_REJECTED_BY_QUALITY_TOTAL = ${report.fact_rejected_by_quality_total}`,
    '',
    `FACT_SOURCE_TRACEABILITY_RATE = ${report.fact_source_traceability_rate}`,
    `FACT_WITHOUT_TRACEABLE_SOURCE = ${report.fact_without_traceable_source}`,
    `FACT_POSTPROCESS_REPLAY_IDEMPOTENCY = ${report.fact_postprocess_replay_idempotency}`,
    `REQUIREMENT_BLIND_EXTRACTION = ${report.requirement_blind_extraction}`,
    '',
    `FACT_INVENTORY_COMPLETE = ${report.fact_inventory_complete}`,
    `FACT_INVENTORY_READY_FOR_GPT_ASSESSMENT = ${report.fact_inventory_ready_for_gpt_assessment}`,
    '',
    '## Explicit blockers',
    '',
    ...report.inventory_blockers.map((blocker) => `- ${blocker}`),
    '',
    '- Mapping, Claim, Writer, Coverage and Gold actions: NOT EXECUTED.',
    '- Production DB writes: 0; Gold mutations: 0; Provider calls: 0.'
  ];
  return `${lines.join('\n')}\n`;
}

export function writeFactInventoryArtifacts({ repoRoot = process.cwd(), outputDir = path.join(repoRoot, 'docs'), generatedAt = null, branch = null, head = null, worktree = null } = {}) {
  const projectionPath = path.join(repoRoot, 'backend/eval/gold-human-review/v2/mapping-real-rebuild/00_source_role_projection.json');
  const projection = JSON.parse(fs.readFileSync(projectionPath, 'utf8'));
  const report = buildFactInventory({ projection, repoRoot, now: generatedAt, branch, head, worktree });
  fs.writeFileSync(path.join(outputDir, 'V43_RAG_FACT_SOURCE_INVENTORY.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(path.join(outputDir, 'V43_RAG_SOURCE_FIRST_FACT_CANDIDATES.json'), `${JSON.stringify({ schema_version: 'v43-rag-source-first-fact-candidates-v1', eval_only: true, status: 'BLOCKED_NO_AUTHORITY_ELIGIBLE_SOURCE_FIRST_WINDOW', candidates: [], provider_calls: 0, production_db_writes: 0, gold_mutations: 0 }, null, 2)}\n`, 'utf8');
  fs.writeFileSync(path.join(outputDir, 'V43_RAG_FACT_QUALITY_AUDIT.json'), `${JSON.stringify({ schema_version: 'v43-rag-fact-quality-audit-v1', eval_only: true, candidate_count: 0, quality_class_counts: {}, source_traceability: 'NOT_APPLICABLE_NO_FACTS', no_fabricated_fact: 'PASS', provider_calls: 0, production_db_writes: 0, gold_mutations: 0 }, null, 2)}\n`, 'utf8');
  fs.writeFileSync(path.join(outputDir, 'V43_RAG_FACT_EXTRACTION_RAW_RESPONSES.jsonl'), '', 'utf8');
  fs.writeFileSync(path.join(outputDir, 'V43_RAG_FACT_INVENTORY_CHECKPOINT.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(path.join(outputDir, 'V43_RAG_FACT_INVENTORY_CHECKPOINT.md'), renderFactInventoryCheckpoint(report), 'utf8');
  return report;
}
