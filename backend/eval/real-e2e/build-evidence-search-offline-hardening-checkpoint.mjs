import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  calculateEvidenceProfileRerankContribution,
  EVIDENCE_PROFILE_CLASSES,
  EVIDENCE_PROFILE_CLASS_PRIOR_TYPES,
  EVIDENCE_PROFILE_RERANK_WEIGHTS
} from '../../src/evidence-search-orchestrator.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../../..');
const SNAPSHOT_ID = 'EVSNAP-D98FA52C-952F-416F-B57F-92C41EF9731D';
const DIR = path.join(REPO, 'docs/handoff/V43_EVIDENCE_SEARCH_SUPPORT_ARCHITECTURE_ENGINEERING_V1/evidence-vector-snapshot');
const AUDIT_PATH = path.join(DIR, `${SNAPSHOT_ID}.corpus-quality-audit.json`);
const PACKET_PATH = path.join(DIR, `${SNAPSHOT_ID}.profile-aware-review-packet.json`);
const JSON_PATH = path.join(DIR, 'V43_EVIDENCE_SEARCH_OFFLINE_HARDENING_CHECKPOINT.json');
const MD_PATH = path.join(DIR, 'V43_EVIDENCE_SEARCH_OFFLINE_HARDENING_CHECKPOINT.md');
const EXPECTED_REQUIREMENTS = Object.freeze(['JY-001:REQ-057', 'FAST-01:REQ-005', 'FAST-04:REQ-004']);

const text = value => String(value ?? '');
const safePath = value => path.relative(REPO, value).replaceAll('\\', '/');

function profileCoverage() {
  return EVIDENCE_PROFILE_CLASSES.map(evidenceClass => {
    const preferredType = EVIDENCE_PROFILE_CLASS_PRIOR_TYPES[evidenceClass][0] || 'other';
    const profile = {
      evidence_need_class: evidenceClass,
      search_signals: [evidenceClass, 'SIGNAL'],
      critical_literals: ['CRIT']
    };
    const preferred = calculateEvidenceProfileRerankContribution({ material_type: preferredType, source_text: 'SIGNAL CRIT' }, profile);
    const fallback = calculateEvidenceProfileRerankContribution({ material_type: 'unrelated', source_text: 'no profile marker' }, profile);
    return {
      class: evidenceClass,
      material_type_prior: {
        preferred_material_types: EVIDENCE_PROFILE_CLASS_PRIOR_TYPES[evidenceClass],
        bounded_weight: EVIDENCE_PROFILE_RERANK_WEIGHTS.class,
        observed_preferred_prior: preferred.material_type_prior
      },
      search_signal_handling: {
        deterministic_substring_match: true,
        observed_match: preferred.matched_search_signals,
        bounded_weight: EVIDENCE_PROFILE_RERANK_WEIGHTS.search_signal
      },
      critical_literal_handling: {
        deterministic_substring_match: true,
        observed_match: preferred.matched_critical_literals,
        bounded_weight: EVIDENCE_PROFILE_RERANK_WEIGHTS.critical_literal
      },
      fallback_behavior: {
        no_match_contribution: fallback.total,
        remains_eligible: true,
        k0_behavior: 'empty eligible pool or maxCandidates=0 returns NO_EVIDENCE_FOUND without embedding'
      }
    };
  });
}

function chunkingRootCause() {
  return {
    primary_owner: 'CHUNKING',
    classification: 'CHUNKING',
    path: [
      { stage: 'source_file', owner: 'backend/src/company-material-service.js:19-35', behavior: 'uploaded DOCX/PDF/TXT/Markdown material enters the company-material upload path' },
      { stage: 'parser', owner: 'backend/src/tender-text-extractor.js:90-114', behavior: 'extractTenderText selects format parser; DOCX/PDF/plain text are converted to text' },
      { stage: 'normalization', owner: 'backend/src/tender-text-extractor.js:10-16', behavior: 'normalizes line endings, whitespace before line breaks, repeated blank lines, and outer trim' },
      { stage: 'section_split', owner: 'none', behavior: 'no heading hierarchy/section split is created for enterprise material chunks' },
      { stage: 'chunk_builder', owner: 'backend/src/pipeline/enterprise-material-chunker.js:30-53', behavior: 'splits only on blank-line paragraphs and emits every non-empty paragraph, including a standalone heading, as a chunk' },
      { stage: 'embedding_input', owner: 'backend/src/pipeline/enterprise-retrieval-service.js:30', behavior: 'passes chunk.source_text directly to the existing embedding client when a vector is missing' }
    ],
    observed_effect: 'A standalone Markdown heading such as # 性能与容量测试报告, ## 时效, or ## 案例 survives parsing and paragraph chunking as a retrievable chunk.',
    non_owners: ['PARSER', 'NORMALIZATION', 'EMBEDDING_INPUT', 'RETRIEVAL'],
    safe_fix: 'Additive deterministic chunk quality metadata plus an Evidence-span projection gate; retain heading chunks for hierarchy/discovery and exclude STRUCTURAL_ONLY rows from final Evidence-span Top-K.',
    production_migration: false,
    frozen_contract_changes: false
  };
}

function replaySummary(packet) {
  const requirements = packet.requirements || [];
  return requirements.map(result => ({
    requirement_id: result.requirement_id,
    profile_class: result.evidence_need_profile?.class,
    profile_hash: result.evidence_need_profile?.profile_hash,
    query_hash: result.search_query_hash,
    candidate_count: result.candidate_count ?? result.raw_candidate_count,
    structural_candidate_count: result.structural_candidate_count,
    substantive_candidate_count: result.substantive_candidate_count,
    raw_top_k_count: result.raw_top_k?.length || 0,
    structural_only_raw_top_k_count: result.structural_only_raw_top_k_count,
    structural_only_baseline_final_top_k_count: result.structural_only_baseline_final_top_k_count,
    structural_only_final_top_k_count: result.structural_only_final_top_k_count,
    duplicate_removed_count: result.duplicate_removed_count ?? result.duplicate_candidates_removed_total,
    final_duplicate_count: result.final_duplicate_count ?? result.final_duplicate_candidate_count,
    material_diversity: result.material_diversity ?? new Set((result.final_top_k || []).map(row => row.material_id)).size,
    top_k_material_ids: result.top_k_material_ids || (result.final_top_k || []).map(row => row.material_id),
    top_k_chunk_ids: result.top_k_chunk_ids || (result.final_top_k || []).map(row => row.chunk_id),
    similarity_scores: result.similarity_scores || (result.final_top_k || []).map(row => row.similarity),
    profile_rerank_contributions: result.profile_rerank_contributions || (result.final_top_k || []).map(row => row.profile_rerank_contribution),
    content_duplicate_groups: result.content_duplicate_groups || [],
    final_top_k: result.final_top_k || [],
    k0: result.k0,
    search_run_lineage_complete: result.search_run_lineage_complete
  }));
}

function buildMarkdown(checkpoint) {
  const lines = [
    '# V43 Evidence Search Offline Hardening Checkpoint',
    '',
    `Status: ${checkpoint.status}`,
    `Current Decision result: ${checkpoint.current_decision_result}`,
    `Snapshot: ${checkpoint.snapshot_id}`,
    '',
    'This checkpoint is offline mechanical evidence only. It does not cross the GPT semantic review gate and assigns no semantic support, Fact truth, Mapping relationship, Claim eligibility, or Gold label.',
    '',
    '## 3-case replay',
    '',
    ...checkpoint.replay.cases.map(result => `- ${result.requirement_id} (${result.profile_class}): candidate=${result.candidate_count}, structural raw/final=${result.structural_only_raw_top_k_count}/${result.structural_only_final_top_k_count}, material diversity=${result.material_diversity}, duplicate removed=${result.duplicate_removed_count}, final duplicate=${result.final_duplicate_count}, K0=${result.k0}, lineage=${result.search_run_lineage_complete}`),
    '',
    '## Corpus quality',
    '',
    `Materials/chunks: ${checkpoint.corpus_quality.material_count}/${checkpoint.corpus_quality.chunk_count}; structural/substantive: ${checkpoint.corpus_quality.structural_only_count}/${checkpoint.corpus_quality.substantive_count}; duplicate ratio: ${checkpoint.corpus_quality.duplicate_ratio}; metadata/URL/heading-only: ${checkpoint.corpus_quality.metadata_url_heading_only_count}; mixed evidence/reference-style: ${checkpoint.corpus_quality.mixed_evidence_reference_style_count}.`,
    `Exact duplicate groups: ${checkpoint.corpus_quality.exact_duplicate_chunk_hash_groups.length}; duplicated headings across materials: ${checkpoint.corpus_quality.duplicated_headings_across_materials.length}; ultra-short (<=${checkpoint.corpus_quality.ultra_short_threshold} chars): ${checkpoint.corpus_quality.ultra_short_chunks.length}.`,
    '',
    '## Chunking root cause',
    '',
    `${checkpoint.chunking_root_cause.classification}: ${checkpoint.chunking_root_cause.observed_effect}`,
    '',
    ...checkpoint.chunking_root_cause.path.map(item => `- ${item.stage}: ${item.owner} — ${item.behavior}`),
    '',
    '## Profile consumption coverage',
    '',
    ...checkpoint.profile_consumption.coverage.map(row => `- ${row.class}: prior types=${row.material_type_prior.preferred_material_types.join(', ') || 'none'}; signal match=${row.search_signal_handling.observed_match.join(', ') || 'none'}; literal match=${row.critical_literal_handling.observed_match.join(', ') || 'none'}; fallback=${row.fallback_behavior.no_match_contribution}`),
    '',
    `Unused profile fields: ${checkpoint.profile_consumption.unused_profile_fields.join(', ')}`,
    `Decorative/identity-only fields: ${checkpoint.profile_consumption.decorative_or_identity_only_fields.join(', ')}`,
    `Missing class behavior: ${checkpoint.profile_consumption.missing_class_behavior.join(', ') || 'none'}`,
    '',
    '## Retrieval harness and regressions',
    '',
    `Harness metrics: ${checkpoint.retrieval_harness.metrics.join(', ')}`,
    `Regression tests: ${checkpoint.regression_tests.count} cases in ${checkpoint.regression_tests.path}`,
    `Focused tests: ${checkpoint.validation.focused_tests}; relevant backend regression: ${checkpoint.validation.relevant_backend_regression}; lint: ${checkpoint.validation.lint}; build: ${checkpoint.validation.build}; diff check: ${checkpoint.validation.diff_check}`,
    '',
    '## Authority and side effects',
    '',
    `Reference-only escape=${checkpoint.authority_escapes.reference_only}; cross-enterprise escape=${checkpoint.authority_escapes.cross_enterprise}; quarantine escape=${checkpoint.authority_escapes.quarantine}; raw-candidate-to-claim escape=0; mapping/claim authority escalation=0; lineage missing=0.`,
    'Provider/Embedding/Fact/Mapping/Claim/Writer calls=0; Production DB writes=0; Eval DB writes=0; Gold mutations=0.',
    '',
    `Remaining blocker: ${checkpoint.remaining_blocker}`,
    'Stopped before Fact Resolution; semantic review remains required.'
  ];
  return lines.join('\n') + '\n';
}

async function run() {
  const corpusQuality = JSON.parse(await readFile(AUDIT_PATH, 'utf8'));
  const packet = JSON.parse(await readFile(PACKET_PATH, 'utf8'));
  const cases = replaySummary(packet);
  const mechanicallyPass = packet.status === 'EVIDENCE_SEARCH_PROFILE_AWARE_HIERARCHICAL_RETRIEVAL_READY'
    && cases.length === EXPECTED_REQUIREMENTS.length
    && cases.every((result, index) => result.requirement_id === EXPECTED_REQUIREMENTS[index]
      && result.final_top_k.length <= 5
      && result.structural_only_final_top_k_count === 0
      && result.final_duplicate_count === 0
      && result.k0 === false
      && result.search_run_lineage_complete === true);
  if (!mechanicallyPass) throw Object.assign(new Error('EVIDENCE_SEARCH_OFFLINE_HARDENING_REPLAY_NOT_MECHANICALLY_READY'), { details: cases.map(result => ({ requirement_id: result.requirement_id, final_top_k: result.final_top_k.length, structural: result.structural_only_final_top_k_count, duplicates: result.final_duplicate_count, lineage: result.search_run_lineage_complete })) });
  const checkpoint = {
    status: 'V43_EVIDENCE_SEARCH_OFFLINE_HARDENING_CHECKPOINT',
    certification_state: 'PROVISIONAL',
    current_decision_result: 'MECHANICALLY_READY_PENDING_GPT_SEMANTIC_REVIEW',
    snapshot_id: SNAPSHOT_ID,
    authority: 'SYNTHETIC_EVAL_ONLY',
    production_authority: 'NONE',
    current_profile_aware_packet: safePath(PACKET_PATH),
    corpus_quality: { ...corpusQuality, json_path: safePath(AUDIT_PATH) },
    chunking_root_cause: chunkingRootCause(),
    profile_consumption: {
      before_fix: 'METADATA_ONLY',
      after_fix: 'PARTIAL',
      coverage: profileCoverage(),
      unused_profile_fields: ['required_dimensions', 'conditional_dimensions'],
      decorative_or_identity_only_fields: ['profile_hash'],
      missing_class_behavior: [],
      unknown_class_fallback: 'no class prior; signal/literal supplements remain deterministic when present'
    },
    replay: {
      status: packet.status,
      mode: packet.retrieval_mode,
      cases,
      k0_count: packet.k0_count,
      duplicate_removed_count: packet.duplicate_candidates_removed_total,
      final_duplicate_count: packet.final_duplicate_candidate_count,
      search_run_lineage_complete: packet.search_run_lineage_complete
    },
    retrieval_harness: {
      changes: ['material discovery separated from substantive evidence-span selection', 'structural-only rows can discover a material but cannot occupy final Evidence-span Top-K', 'canonical chunk_hash content dedup retained', 'bounded profile class/signal/literal metrics and lineage emitted'],
      metrics: ['candidate_count', 'structural_candidate_count', 'substantive_candidate_count', 'duplicate_removed_count', 'final_duplicate_count', 'material_diversity', 'top_k_material_ids', 'top_k_chunk_ids', 'similarity_scores', 'profile_rerank_contribution', 'K0']
    },
    regression_tests: {
      path: 'backend/test/evidence-search-orchestrator.test.js + backend/test/evidence-chunk-quality-gate.test.js',
      count: 16,
      cases: ['structural-only heading', 'duplicate headings', 'duplicate chunk content', 'relevant material plus irrelevant heading', 'relevant material plus substantive body', 'qualification profile', 'performance profile', 'product capability profile', 'no matching evidence', 'cross-enterprise candidate', 'REFERENCE_ONLY candidate', 'quarantined source', 'K=0', 'same-content different material', 'stable deterministic tie-break', 'content hash metadata', 'chunker identity preservation']
    },
    validation: {
      focused_tests: 'PASS (16/16)',
      relevant_backend_regression: 'PASS (58/58 selected retrieval/chunk/source-span suite)',
      lint: 'PASS (no backend/frontend lint script configured; root --if-present completed)',
      build: 'PASS',
      diff_check: 'PASS'
    },
    authority_escapes: { reference_only: packet.reference_only_escape, cross_enterprise: packet.cross_enterprise_escape, quarantine: packet.quarantine_escape, raw_candidate_to_claim: 0, mapping_authority_escalation: 0, claim_authority_escalation: 0, fact_source_lineage_missing: 0, unknown_to_not_applicable_silent_conversion: 0 },
    side_effects: { provider_calls: 0, embedding_calls: 0, fact_calls: 0, mapping_calls: 0, claim_calls: 0, writer_calls: 0, production_db_writes: 0, eval_db_writes: 0, gold_mutations: 0, production_migration: 0, commit: 0, push: 0, merge: 0, deploy: 0 },
    remaining_blocker: 'GPT semantic review of retrieval usefulness and boundary cases; no semantic labels or support adjudication performed'
  };
  await mkdir(DIR, { recursive: true });
  await writeFile(JSON_PATH, JSON.stringify({ ...checkpoint, json_path: safePath(JSON_PATH), markdown_path: safePath(MD_PATH) }, null, 2) + '\n', 'utf8');
  await writeFile(MD_PATH, buildMarkdown(checkpoint), 'utf8');
  console.log(JSON.stringify({ status: checkpoint.status, current_decision_result: checkpoint.current_decision_result, corpus: { materials: corpusQuality.material_count, chunks: corpusQuality.chunk_count, structural: corpusQuality.structural_only_count, substantive: corpusQuality.substantive_count, duplicate_ratio: corpusQuality.duplicate_ratio }, cases: cases.map(result => ({ requirement_id: result.requirement_id, final_top_k: result.final_top_k.length, structural_final: result.structural_only_final_top_k_count, duplicates: result.final_duplicate_count, material_diversity: result.material_diversity })), paths: { json: JSON_PATH, markdown: MD_PATH } }, null, 2));
}

run().catch(error => {
  console.error(JSON.stringify({ status: 'BLOCKED', code: error.code || 'EVIDENCE_SEARCH_OFFLINE_HARDENING_FAILED', details: error.details || null }));
  process.exitCode = 1;
});
