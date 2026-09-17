import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolveMaterialSourceRole, MATERIAL_SOURCE_ROLE_POLICY_VERSION } from '../../src/pipeline/material-source-authority-policy.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const outDir = path.join(repoRoot, 'docs', 'handoff', 'V43_RAG_SEMANTIC_USEFULNESS_BASELINE_V1');
const readJson = relative => JSON.parse(fs.readFileSync(path.join(repoRoot, relative), 'utf8'));
const sha256File = relative => createHash('sha256').update(fs.readFileSync(path.join(repoRoot, relative))).digest('hex');
const writeJson = (name, value) => fs.writeFileSync(path.join(outDir, name), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
const git = command => { try { return execFileSync('git', command, { cwd: repoRoot, encoding: 'utf8' }).trim(); } catch { return null; } };

fs.mkdirSync(outDir, { recursive: true });

const branch = git(['branch', '--show-current']);
const head = git(['rev-parse', 'HEAD']);
const statusLines = (git(['status', '--short']) || '').split(/\r?\n/).filter(Boolean);
const retrieval40Path = 'backend/eval/rag-pilot/results/overnight/01_retrieval_context_40case.json';
const retrieval40 = readJson(retrieval40Path);
const fixturePath = 'backend/eval/rag-pilot/retrieval_40case_fixture.json';
const baseline = readJson('backend/eval/retrieval-baseline/retrieval-benchmark-v1.json');
const quality = readJson('backend/eval/reports/stage20-retrieval-quality-experiments.json');
const stage17 = readJson('backend/eval/evidence-support/calibration-v2/GPT_REVIEW_PACKET_STAGE17_FINAL_LIVE_6.json');
const hygiene = readJson('backend/eval/evidence-support/calibration-v2/GPT_REVIEW_PACKET_RETRIEVAL_HYGIENE_PRE_POST.json');
const candidateRerank = readJson('backend/eval/candidate-rerank/candidate-rerank-benchmark-v1.json');
const sufficiency = readJson('backend/eval/reports/stage20-sufficiency-experiment.json');
const jiangyin = readJson('backend/eval/reports/jiangyin-full-requirement-rag-fitness-v1.json');
const smoke = readJson('backend/eval/rag-pilot/V43_REAL_RAG_IMPORT_RETRIEVAL_SMOKE_REPORT.json');

const roleFor = row => {
  const material = {
    id: row.material_id,
    material_type: row.material_type,
    source_type: row.source_type,
    source_role: row.source_role,
    explicit_human_role: row.explicit_human_role,
    synthetic_test_material: row.synthetic_test_material,
    synthetic_company_evidence: row.synthetic_company_evidence,
    metadata: row.metadata
  };
  const resolved = resolveMaterialSourceRole(material);
  return { role: resolved.role, reason: resolved.reason, policy_version: MATERIAL_SOURCE_ROLE_POLICY_VERSION };
};

const runtimeAudit = {
  artifact_type: 'V43_RAG_CURRENT_RUNTIME_AUDIT',
  audit_mode: 'READ_ONLY_DIRTY_WORKTREE',
  generated_from: { branch, head, dirty: statusLines.length > 0, status_entry_count: statusLines.length },
  production_path: {
    material_upload: 'backend/src/company-material-service.js::CompanyMaterialService.upload',
    material_authority: 'backend/src/pipeline/material-source-authority-policy.js::materialAuthorityStatus/isRetrievalEligible',
    project_binding: 'backend/src/project-material-binding-service.js::ProjectMaterialBindingService.create',
    retrieval: 'backend/src/pipeline/enterprise-retrieval-service.js::EnterpriseRetrievalService.retrieve',
    embedding: 'backend/src/pipeline/embedding-client.js::EmbeddingClient.embed',
    chunking: 'backend/src/pipeline/enterprise-material-chunker.js::chunkEnterpriseMaterial',
    repository: 'backend/src/db.js::listChunksForRetrieval/prepareRetrievalCandidates',
    writer_reference: 'backend/src/pipeline/writer-reference-selector.js::WriterReferenceSelector.select',
    source_role_routing: 'backend/src/pipeline/enterprise-evidence-source-router.js::routeEnterpriseProofCandidates'
  },
  embedding: {
    provider: 'openai_compatible',
    model: 'Qwen/Qwen3-Embedding-0.6B',
    version: '1',
    dimension: 1024,
    client_config_source: 'backend/src/pipeline/embedding-client.js::parseEmbeddingConfig',
    similarity_metric: 'cosine distance via pgvector: similarity_score = 1 - (embedding <=> query_vector)',
    transport: 'EmbeddingClient -> configured gateway/provider endpoint (runtime env supplied)',
    candidate_k: 20,
    final_k: 8,
    request_top_k: '1..50; final selection is min(PRODUCTION_REVIEW_K, request top_k)',
    writer_reference_k: 4
  },
  metadata_filters: {
    retrieval: [
      'project ownership or ACTIVE project_material_bindings',
      'ENTERPRISE_PRIVATE authority eligibility for private materials',
      'public corpus project + requested corpus_scopes',
      'lifecycle_status=ACTIVE',
      'review_status=approved',
      'usage_status in ACTIVE_FULLTEXT/ACTIVE_EXCERPT',
      'extraction_status=succeeded',
      'public index_status=INDEXED',
      'material_types/material_ids when supplied',
      'embedding_model/version/dimension identity'
    ],
    source_authority_owner: 'backend/src/pipeline/material-source-authority-policy.js'
  },
  ranking_and_hygiene: {
    raw_candidate_order: 'pgvector cosine similarity, embedding_id tie-break',
    production_rerank: { implemented: true, version: '4.3-role-need-rerank-v1', method: 'bounded deterministic role/need compatibility rank shift (max shift 4)' },
    mmr: { implemented_in_production: false, lambda: null, evidence: 'no MMR implementation in current retrieval service/reranker' },
    dedup: { implemented: 'partial', evidence: 'WriterReferenceSelector deduplicates by chunk_hash; EnterpriseRetrievalService does not run an MMR/dedup stage before rerank' },
    diversity: { implemented: 'bounded role compatibility only', semantic_diversity: false },
    exact_or_lexical: { implemented_in_production: false, eval_only_evidence: ['backend/eval/jiangyin-full-requirement-rag-fitness-v1/runner.js lexicalScore/corpusMatch'] },
    hybrid: { implemented_in_production: false },
    reranker: { implemented: 'deterministic bounded reranker', not_cross_encoder: true, not_llm: true }
  },
  source_role_boundary: {
    policy_version: MATERIAL_SOURCE_ROLE_POLICY_VERSION,
    roles: ['REFERENCE_ONLY', 'EVIDENCE_CANDIDATE'],
    downstream_rule: 'REFERENCE_ONLY is context-only; EVIDENCE_CANDIDATE is still a candidate and cannot become Fact/Mapping/Claim without later authority gates',
    no_authority_expansion: true
  },
  eval_boundary: { provider_calls_added: 0, llm_calls_added: 0, db_writes: 0, production_changes: 0, semantic_labels_created: 0 }
};
writeJson('01_CURRENT_RAG_RUNTIME_AUDIT.json', runtimeAudit);

const historicalExperiments = [
  {
    experiment_id: 'retrieval-benchmark-v1', dataset_identity: baseline.datasets, query_count: baseline.probe_count,
    corpus_identity: baseline.datasets.representative_sme, algorithm: 'dense embedding baselines A/B/C', parameters: baseline.embedding_identity,
    result_summary: Object.fromEntries(Object.entries(baseline.baselines).map(([key, value]) => [key, value.metrics])),
    artifact_path: retrieval40Path.replace('results/overnight/01_retrieval_context_40case.json', 'retrieval-baseline/retrieval-benchmark-v1.json'),
    artifact_sha256: sha256File('backend/eval/retrieval-baseline/retrieval-benchmark-v1.json'), reproducibility: 'ARTIFACT_PRESENT_RESULT_REPLAYABLE_RAW_PROVIDER_RESPONSE_NOT_SAVED'
  },
  {
    experiment_id: 'stage20-retrieval-quality-experiments', dataset_identity: { source: 'persisted raw Top20', query_count: 139 },
    corpus_identity: quality.baseline_contract, algorithm: 'BASELINE, MMR lambda 0.7/0.8/0.9, Hybrid RRF k60, coverage soft penalty',
    parameters: quality.summary.map(item => ({ strategy: item.strategy, params: item.params })),
    result_summary: quality.summary.map(item => ({ strategy: item.strategy, metrics: item.metrics })),
    artifact_path: 'backend/eval/reports/stage20-retrieval-quality-experiments.json', artifact_sha256: sha256File('backend/eval/reports/stage20-retrieval-quality-experiments.json'),
    reproducibility: 'ARTIFACT_PRESENT_OFFLINE_REPLAY'
  },
  {
    experiment_id: 'candidate-rerank-benchmark-v1', dataset_identity: { tiers: ['S', 'M', 'L'], chunk_count: 60 },
    corpus_identity: candidateRerank.embedding_identity, algorithm: 'deterministic candidate rerank benchmark',
    parameters: { tiers: Object.keys(candidateRerank.tiers), configs: 'candidate_k 10/20/30/50; review_k 5/8; D0-D3 deterministic variants' },
    result_summary: { report: 'see tier/config metrics in source artifact', provider_audit: candidateRerank.provider_audit },
    artifact_path: 'backend/eval/candidate-rerank/candidate-rerank-benchmark-v1.json', artifact_sha256: sha256File('backend/eval/candidate-rerank/candidate-rerank-benchmark-v1.json'),
    reproducibility: 'ARTIFACT_PRESENT_RESULT_ONLY_RAW_TEXT_AND_VECTORS_NOT_SAVED'
  },
  {
    experiment_id: 'stage17-final-live-retrieval-6', dataset_identity: stage17.schema_version,
    corpus_identity: stage17.runtime, algorithm: 'dense embedding + deterministic hygiene + role/need rerank', parameters: stage17.runtime,
    result_summary: { retrieval: stage17.retrieval, live_quality: stage17.live_quality },
    artifact_path: 'backend/eval/evidence-support/calibration-v2/GPT_REVIEW_PACKET_STAGE17_FINAL_LIVE_6.json', artifact_sha256: sha256File('backend/eval/evidence-support/calibration-v2/GPT_REVIEW_PACKET_STAGE17_FINAL_LIVE_6.json'),
    reproducibility: 'ARTIFACT_PRESENT_LIVE_RECORDED'
  },
  {
    experiment_id: 'retrieval-hygiene-pre-post', dataset_identity: { cases: hygiene.comparison?.length || null, source: hygiene.pre_fix_baseline?.source || null },
    corpus_identity: 'captured candidate pools', algorithm: 'deterministic substantive/chunk-role/source-eligibility hygiene', parameters: { pre_post: true },
    result_summary: hygiene.acceptance, artifact_path: 'backend/eval/evidence-support/calibration-v2/GPT_REVIEW_PACKET_RETRIEVAL_HYGIENE_PRE_POST.json', artifact_sha256: sha256File('backend/eval/evidence-support/calibration-v2/GPT_REVIEW_PACKET_RETRIEVAL_HYGIENE_PRE_POST.json'),
    reproducibility: 'ARTIFACT_PRESENT_OFFLINE_REPLAY'
  },
  {
    experiment_id: 'stage20-sufficiency-experiment', dataset_identity: { calibration_cases: sufficiency.calibration.case_count, validation_cases: sufficiency.validation.case_count },
    corpus_identity: 'fixture-only calibration and no-answer forensics', algorithm: 'score-only/deterministic metadata/fixture semantic/hybrid fixture', parameters: { external_model_calls: sufficiency.external_model_calls },
    result_summary: { calibration: sufficiency.calibration.results, validation: sufficiency.validation.results }, artifact_path: 'backend/eval/reports/stage20-sufficiency-experiment.json', artifact_sha256: sha256File('backend/eval/reports/stage20-sufficiency-experiment.json'),
    reproducibility: 'ARTIFACT_PRESENT_FIXTURE_ONLY_NOT_REAL_RAG_SEMANTIC_PROOF'
  },
  {
    experiment_id: 'overnight-retrieval-context-40case', dataset_identity: { fixture_sha256: retrieval40.fixture_sha256, cases: retrieval40.cases.length },
    corpus_identity: retrieval40.embedding_config, algorithm: 'captured dense retrieval Top20 + selected TopK/context recovery', parameters: retrieval40.embedding_config,
    result_summary: retrieval40.metrics, artifact_path: retrieval40Path, artifact_sha256: sha256File(retrieval40Path), reproducibility: 'ARTIFACT_PRESENT_CAPTURED_RESULTS_NO_NEW_CALL'
  }
];
const historicalAudit = {
  artifact_type: 'V43_RAG_HISTORICAL_EXPERIMENT_AUDIT', audit_mode: 'READ_ONLY_REPOSITORY_AND_GIT_HISTORY', experiments: historicalExperiments,
  git_history_evidence: [
    { commit: '20ca35a', subject: 'test: add deterministic candidate rerank benchmark' },
    { commit: 'd1427f0', subject: 'eval: add retrieval sufficiency architecture experiment' },
    { commit: '6649ed9', subject: 'eval: record retrieval hygiene comparison' },
    { commit: '7a2b2b0', subject: 'fix: enforce retrieval candidate hygiene' },
    { commit: '1528298', subject: 'docs: rebase Stage17 retrieval metrics' },
    { commit: '6e074cd', subject: 'eval: capture stage17 final live retrieval' }
  ],
  searched_but_not_found: [
    { experiment: 'RRF-only independent artifact', status: 'HISTORICAL_RESULT_NOT_REPRODUCIBLE', note: 'RRF appears only as a strategy inside stage20-retrieval-quality-experiments; no separate raw experiment artifact found' },
    { experiment: 'GPT semantic usefulness labels for Reference Retrieval', status: 'HISTORICAL_RESULT_NOT_REPRODUCIBLE', note: 'Existing packets contain deterministic relevance/context fields but no frozen GPT Useful@K labels' }
  ],
  chat_percentages_used_as_frozen_metrics: false
};
writeJson('02_HISTORICAL_RAG_EXPERIMENT_AUDIT.json', historicalAudit);

const dualMetric = {
  artifact_type: 'V43_RAG_DUAL_METRIC_CONTRACT', version: 'v1', authority: 'Eval contract only; no semantic labels created',
  L1_RETRIEVAL_RECALL: {
    question: 'Did the expected material enter the candidate set?', metrics: {
      HIT_AT_K: 'count(cases with expected source rank <= K) / scored cases',
      EXPECTED_SOURCE_RECALL: 'expected source identities recovered / expected source identities',
      MRR: 'mean(1 / first expected-source rank) over cases with an expected source',
      MULTI_SOURCE_RECALL: 'cases where every expected source identity is in candidate set / multi-source cases'
    }, semantic_interpretation: 'none; candidate inclusion only'
  },
  L2_SEMANTIC_USEFULNESS: {
    question: 'Are the final Top-K items useful for their authorized lane?',
    reference: { REFERENCE_USEFUL_AT_K: 'GPT/Human label required per query', OFF_TOPIC_RATE: 'off-topic items / reviewed items', REDUNDANCY_RATE: 'redundant items / reviewed items', WRONG_SCOPE_RATE: 'wrong corpus scope items / reviewed items', WRONG_ROLE_RATE: 'wrong source role items / reviewed items' },
    evidence: { EVIDENCE_RELEVANCE_AT_K: 'GPT/Human label required per requirement', EXACT_IDENTIFIER_HIT: 'exact certificate/model/standard/identifier hit', NUMERIC_SIGNAL_HIT: 'number+unit/operator signal hit', WRONG_ENTERPRISE_ESCAPE: 'foreign/unapproved enterprise item rate', REFERENCE_ROLE_ESCAPE: 'Reference-only item in Evidence lane rate', QUARANTINED_ESCAPE: 'quarantined/ineligible item returned rate' },
    semantic_label_owner: 'GPT proposes; Human may freeze; Codex does not label'
  },
  hard_boundary: 'L1 high does not imply L2 high; corpus absence is distinct from search failure; Reference Material is not Enterprise Assertion Authority'
};
writeJson('03_DUAL_METRIC_CONTRACT.json', dualMetric);

const domains = ['architecture', 'security', 'deployment', 'integration', 'data governance', 'migration', 'operations', 'testing', 'training', 'acceptance', 'performance', 'AI/model', 'disaster recovery'];
const querySet = retrieval40.cases.map(item => ({
  case_id: item.case_id, query: item.query,
  requirement: { text: null, status: 'NOT_CAPTURED_AS_SEPARATE_FIELD', note: 'The captured artifact contains a query but no separate canonical Requirement row; do not infer one.' },
  section: { theme: item.theme, scope: item.scope, project_kind: item.project_kind },
  requested_scopes: item.requested_scopes,
  corpus_identity: { fixture_path: fixturePath, fixture_sha256: retrieval40.fixture_sha256, expected_doc_ids_retained_for_mechanical_audit: item.expected_doc_ids },
  human_semantic_label: null
}));
writeJson('04_REFERENCE_QUERY_SET.json', { artifact_type: 'V43_REFERENCE_QUERY_SET', query_count: querySet.length, required_domain_coverage: domains, query_origin: 'existing captured 40-case retrieval fixture; no new queries generated', queries: querySet });

const topRows = item => (item.selected_topk?.length ? item.selected_topk : item.raw_top20.slice(0, 5)).map((row, index) => {
  const role = roleFor(row);
  return {
    rank: Number(row.reranked_rank ?? row.rank ?? index + 1), raw_vector_rank: Number(row.raw_vector_rank ?? row.rank ?? index + 1), similarity: Number(row.similarity_score ?? row.raw_similarity ?? 0),
    material_id: row.material_id, chunk_id: row.chunk_id, material_type: row.material_type, source_role: role.role, source_role_reason: role.reason, source_role_policy_version: role.policy_version,
    corpus_scope: row.corpus_scope, original_name: row.original_name, source_excerpt: row.source_text, source_lineage: { project_id: row.project_id, source_document_id: row.source_document_id, source_chunk_id: row.source_chunk_id, chunk_hash: row.chunk_hash, embedding_model: row.embedding_model, embedding_version: row.embedding_version, chunk_role: row.chunk_role, lifecycle_status: row.lifecycle_status, review_status: row.review_status, usage_status: row.usage_status, index_status: row.index_status },
    mechanical_eligibility: row.candidate_eligibility ?? null
  };
});
const results = retrieval40.cases.map(item => ({ case_id: item.case_id, query: item.query, requested_scopes: item.requested_scopes, top_k: topRows(item), expected_doc_ids_for_metric_audit: item.expected_doc_ids, semantic_usefulness_label: null }));
writeJson('05_REFERENCE_RETRIEVAL_RESULTS.json', { artifact_type: 'V43_REFERENCE_RETRIEVAL_RESULTS', source_artifact: retrieval40Path, source_sha256: sha256File(retrieval40Path), query_count: results.length, result_count: results.reduce((n, x) => n + x.top_k.length, 0), results, semantic_labels_created: 0, provider_calls_added: 0 });

const reviewCases = results.map(result => ({
  case_id: result.case_id, query: result.query, requirement: querySet.find(q => q.case_id === result.case_id)?.requirement || null, section: querySet.find(q => q.case_id === result.case_id)?.section || null,
  top_k: result.top_k.map(({ mechanical_eligibility, ...row }) => row),
  review_dimensions: { reference_useful_at_k: null, off_topic: null, redundant: null, wrong_scope: null, wrong_role: null, corpus_gap: null, reviewer_notes: null },
  semantic_label_status: 'PENDING_GPT_HUMAN_REVIEW'
}));
writeJson('06_GPT_SEMANTIC_REVIEW_PACKET.json', { artifact_type: 'V43_GPT_RAG_SEMANTIC_USEFULNESS_REVIEW_PACKET', blind_to_semantic_labels: true, review_owner: 'GPT proposes / Human may freeze', case_count: reviewCases.length, no_gold_or_semantic_labels_included: true, review_instructions: ['Assess Reference usefulness at K using only the supplied query, section context and retrieved source evidence.', 'Do not convert Reference material into Enterprise Assertion Authority.', 'Record corpus gap separately from search failure.', 'Leave any uncertain judgment as REVIEW_REQUIRED.'], cases: reviewCases });

writeJson('07_FAILURE_FAMILY_TEMPLATE.json', { artifact_type: 'V43_RAG_FAILURE_FAMILY_TEMPLATE', labels: ['RECALL_MISS', 'SEMANTIC_NEAR_MISS', 'REDUNDANCY', 'EXACT_IDENTIFIER_MISS', 'NUMERIC_SIGNAL_MISS', 'WRONG_SCOPE', 'WEAK_CORPUS', 'RANKING_FAILURE', 'OTHER'], definitions: { RECALL_MISS: 'expected source absent from candidate pool', SEMANTIC_NEAR_MISS: 'similar but business-inapplicable item', REDUNDANCY: 'repeated/near-duplicate Top-K content', EXACT_IDENTIFIER_MISS: 'certificate/model/standard/identifier absent despite source', NUMERIC_SIGNAL_MISS: 'number/unit/operator signal absent despite source', WRONG_SCOPE: 'wrong corpus/industry/project scope', WEAK_CORPUS: 'no suitable source exists in corpus', RANKING_FAILURE: 'correct candidate present but outside final K', OTHER: 'only with explicit evidence' }, authority: 'Codex may propose mechanical family; GPT/Human adjudicates semantic membership', labels_created: 0 });

writeJson('08_EVIDENCE_RETRIEVAL_TEST_PLAN.json', { artifact_type: 'V43_EVIDENCE_RETRIEVAL_TEST_PLAN', lane: 'EVIDENCE_CANDIDATE_ONLY', authority_boundary: { output: 'EVIDENCE_RETRIEVAL_CANDIDATE', prohibited: ['Fact approval', 'Mapping approval', 'Claim permission', 'Writer authorization'] }, cases: { enterprise_identity: 'same enterprise vs foreign enterprise', material_type: ['qualification', 'project_case', 'product_documentation', 'personnel', 'delivery_capability'], exact_identifier: ['certificate', 'standard', 'product/model', 'acronym'], numeric_signal: ['number + unit + operator'], lifecycle: ['ACTIVE approved usable', 'quarantined', 'expired/revoked', 'superseded'], provenance: ['source hash/span/lineage complete', 'missing or mismatched lineage'], reference_boundary: 'Reference-only material must not enter enterprise assertion authority' }, metrics: dualMetric.L2_SEMANTIC_USEFULNESS.evidence, execution_policy: { provider_calls: 0, db_writes: 0, semantic_labels_by_codex: 0 } });

writeJson('09_PRODUCT_KPI_DEFINITION.json', { artifact_type: 'V43_RAG_PRODUCT_KPI_DEFINITION', lanes: { reference: { recall_at_k: 'L1 expected source hit', useful_at_k: 'L2 GPT/Human useful label', off_topic_rate: 'L2', redundancy_rate: 'L2', empty_reference_rate: 'no final reference candidate / reference queries' }, evidence: { candidate_recall_at_k: 'L1 expected evidence candidate hit', exact_identifier_recall: 'L2 exact signal', wrong_enterprise_escape: 'L2 authority safety', wrong_role_escape: 'L2 source-role safety', quarantined_escape: 'L2 lifecycle safety' }, e2e: { writer_reference_usefulness: 'downstream product metric', claim_authority_escape: 'downstream safety metric', final_section_quality: 'downstream semantic/product metric' } }, denominator_policy: 'Never combine Reference and Evidence denominators; do not collapse L1 and L2 into one Recall KPI', release_boundary: 'No KPI is release-valid before source identity and GPT/Human semantic review are complete' });

const recommendation = {
  artifact_type: 'V43_RAG_DEVELOPMENT_RECOMMENDATION', status: 'WAITING_GPT_SEMANTIC_REVIEW', champion: { name: 'embedding-based Reference Retrieval', status: 'KEEP_AS_BASELINE_CANDIDATE', reason: 'current production path and captured runtime evidence' },
  no_implementation_this_round: ['MMR', 'Exact Signal challenger', 'Hybrid', 'Reranker', 'new vector database', 'new embedding model', 'full re-embedding', 'LLM query rewrite'],
  routing_after_review: { REDUNDANCY: 'MMR candidate only after measured redundancy', EXACT_IDENTIFIER_MISS: 'Exact Signal candidate', NUMERIC_SIGNAL_MISS: 'bounded exact/numeric signal candidate', RECALL_MISS: 'embedding/query/corpus analysis', RANKING_FAILURE: 'ranking analysis; reranker only if deterministic options fail', WEAK_CORPUS: 'corpus gap remediation', SEMANTIC_NEAR_MISS: 'query/metadata/ranking analysis' },
  hybrid_gate: 'HYBRID_JUSTIFIED remains UNDECIDED until same corpus/query/metric A/B with no critical regression; not default', reranker_gate: 'RERANKER_JUSTIFIED remains UNDECIDED; no implementation', evidence_lane: 'Use separate Evidence Retrieval profile for EVIDENCE_CANDIDATE only; output remains candidate', corpus_gap_rule: 'CORPUS_GAP is distinct from SEARCH_FAILURE', semantic_authority: 'GPT proposes; Human may freeze; Codex does not promote labels'
};
writeJson('10_DEVELOPMENT_RECOMMENDATION.json', recommendation);

const checkpoint = `# V43 RAG Semantic Usefulness Baseline V1\n\n- Branch: ${branch}\n- HEAD: ${head}\n- Dirty worktree entries observed: ${statusLines.length}\n- Runtime audit: embedding ${runtimeAudit.embedding.model}, dimension ${runtimeAudit.embedding.dimension}, candidateK ${runtimeAudit.embedding.candidate_k}, finalK ${runtimeAudit.embedding.final_k}; production MMR/Hybrid/Exact Signal/Cross-Encoder Reranker: not implemented.\n- Historical experiment artifacts audited: ${historicalExperiments.length}; missing/unfrozen semantic usefulness labels are explicitly not reconstructed.\n- Reference query set: ${querySet.length} captured cases; retrieval results: ${results.length} cases / ${results.reduce((n, x) => n + x.top_k.length, 0)} Top-K rows.\n- GPT semantic review packet: ${reviewCases.length} cases, semantic labels created: 0, Gold mutations: 0.\n- Source-role handling: reused Backend material-source policy (${MATERIAL_SOURCE_ROLE_POLICY_VERSION}); Reference-only material is not Enterprise Assertion Authority.\n- Provider calls added: 0; LLM calls: 0; Production DB writes: 0; Eval DB writes: 0; Fact/Mapping/Claim/Writer actions: 0.\n- No MMR, Exact Signal, Hybrid, Reranker, embedding-model, corpus, or production semantic change was implemented.\n\n## Status\n\nREADY_FOR_GPT_RAG_SEMANTIC_USEFULNESS_ADJUDICATION\n`;
fs.writeFileSync(path.join(outDir, '10_CHECKPOINT.md'), checkpoint, 'utf8');

console.log(JSON.stringify({ outDir, query_count: querySet.length, result_count: results.length, top_k_rows: results.reduce((n, x) => n + x.top_k.length, 0), semantic_labels: 0, provider_calls: 0, db_writes: 0, status: 'READY_FOR_GPT_RAG_SEMANTIC_USEFULNESS_ADJUDICATION' }, null, 2));
