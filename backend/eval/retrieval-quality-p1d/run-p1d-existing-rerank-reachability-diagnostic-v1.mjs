import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const p1cReplayPath = path.join(
  repoRoot,
  'backend/eval/retrieval-quality-p1c/results/V43_RAG_RETRIEVAL_P1C_BOUNDED_OVERFETCH_REPLAY_V1.json'
);
const p1cQueryFreezePath = path.join(
  repoRoot,
  'backend/eval/retrieval-quality-p1c/results/V43_RAG_RETRIEVAL_P1C_BOUNDED_OVERFETCH_QUERY_BATCH_FREEZE_V1.json'
);
const goldPath = path.join(repoRoot, 'backend/eval/retrieval-quality-p0/GPT_SEMANTIC_GOLD_V1.json');
const snapshotPath = path.join(
  repoRoot,
  'docs/handoff/V43_EVIDENCE_SEARCH_SUPPORT_ARCHITECTURE_ENGINEERING_V1/evidence-vector-snapshot/EVSNAP-D98FA52C-952F-416F-B57F-92C41EF9731D.json'
);

const implementationPaths = {
  reranker: 'backend/src/pipeline/semantic-retrieval-reranker.js',
  retrievalService: 'backend/src/pipeline/enterprise-retrieval-service.js',
  profileBuilder: 'backend/src/evidence-need-profile-builder.js',
  chunkRole: 'backend/src/pipeline/retrieval-chunk-role.js',
  route: 'backend/src/app.js',
  evalContract: 'backend/eval/production-retrieval-contract/production-retrieval-contract-v1.js'
};

const candidateDepths = [20, 32, 48, 64];
const metricK = [1, 3, 5, 8];
const specialRequirementIds = [
  'FAST-01:REQ-005',
  'TB-003:REQ-119',
  'TB-003:REQ-170',
  'JY-001:REQ-027'
];

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

async function sha256(filePath) {
  return createHash('sha256').update(await readFile(filePath)).digest('hex').toUpperCase();
}

function stableJson(value) {
  return JSON.stringify(value, Object.keys(value ?? {}).sort());
}

function hashJson(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function round(value) {
  return typeof value === 'number' ? Number(value.toFixed(12)) : value;
}

function projectedMetrics(metricsByDepth) {
  return Object.fromEntries(
    candidateDepths.map((depth) => {
      const source = metricsByDepth[String(depth)];
      return [String(depth), {
        candidate_k: source.candidate_k,
        raw_candidate_count: source.raw_candidate_count,
        hygiene_filtered_count: source.hygiene_filtered_count,
        hygiene_survivor_count: source.hygiene_survivor_count,
        final_returned_candidate_count: source.final_returned_candidate_count,
        final_pool_fill_rate: source.final_pool_fill_rate,
        cases_final_pool_lt_8: source.cases_final_pool_lt_8,
        raw_to_final_survival_ratio: source.raw_to_final_survival_ratio,
        grade_gte_2_entering_from_gt20: source.grade_gte_2_entering_from_gt20,
        final_review_metrics_at_k: Object.fromEntries(
          metricK.map((k) => [String(k), source.metrics_at_k[String(k)]])
        ),
        MRR_FINAL_AT_8: source.mrr_final_at_8,
        raw_mrr: source.mrr_raw_at_depth
      }];
    })
  );
}

function fallbackCaseProjection(testCase) {
  return {
    case_id: testCase.case_id,
    requirement_id: testCase.requirement_id,
    governance_split: testCase.governance_split,
    fallback_first_grade_gte_2: Object.fromEntries(
      candidateDepths.map((depth) => {
        const item = testCase.depths[String(depth)]?.first_grade_ge_2 ?? null;
        return [String(depth), item ? {
          dense_rank: item.dense_rank,
          post_hygiene_rank: item.post_hygiene_rank,
          final_review_rank: item.final_review_rank,
          entered_final_review: item.entered_final_review
        } : null];
      })
    )
  };
}

function existingBlockedCaseProjection(testCase) {
  return {
    case_id: testCase.case_id,
    requirement_id: testCase.requirement_id,
    governance_split: testCase.governance_split,
    activation: 'BLOCKED_BEFORE_RERANKER_INVOCATION',
    existing_rerank_rank: null,
    existing_rerank_atom_recall: null,
    reason: 'APPROVED_PRODUCTION_EVIDENCE_NEED_PROFILE_UNAVAILABLE'
  };
}

function metadataReachability() {
  return [
    {
      input: 'canonical requirement id/text/query hash',
      production_path: 'EnterpriseRetrievalService.retrieve → repository.getRequirement; query hash is derived from the canonical query path',
      status: 'AVAILABLE_UPSTREAM',
      eval_status: 'AVAILABLE_UPSTREAM',
      note: 'Caller-supplied query_text is not accepted as the canonical production query.'
    },
    {
      input: 'EvidenceNeedProfile.version/profile_hash',
      production_path: 'No buildEvidenceNeedProfile call in EnterpriseRetrievalService.retrieve',
      status: 'NOT_AVAILABLE',
      eval_status: 'NOT_AVAILABLE',
      note: 'The existing profile builder is a separate module and is not invoked by the actual route.'
    },
    {
      input: 'requirement_role.value/status',
      production_path: 'input.semantic_metadata.requirement_role is caller-supplied; no Backend-owned profile projection',
      status: 'UNAUTHORIZED_FOR_EVAL',
      eval_status: 'UNAUTHORIZED_FOR_EVAL',
      note: 'It cannot be supplied from Gold or accepted as a synthetic Eval input.'
    },
    {
      input: 'evidence_needs[].value/status',
      production_path: 'input.semantic_metadata.evidence_needs is caller-supplied; no Backend-owned profile projection',
      status: 'UNAUTHORIZED_FOR_EVAL',
      eval_status: 'UNAUTHORIZED_FOR_EVAL',
      note: 'Production reranker requires approved/non-unknown needs; no approved source is reachable.'
    },
    {
      input: 'candidate.chunk_role/substantive_candidate',
      production_path: 'partitionRetrievalCandidates → applyRetrievalChunkRole',
      status: 'AVAILABLE_UPSTREAM',
      eval_status: 'AVAILABLE_BUT_DROPPED_BY_EVAL_ADAPTER',
      note: 'P1C replay candidates retain hashes/spans but not source text or chunk_role.'
    },
    {
      input: 'semanticMetadata.candidate_roles[chunk_id]',
      production_path: 'Required by semantic-retrieval-reranker.js; no adapter from chunk_role in the production service',
      status: 'NOT_AVAILABLE',
      eval_status: 'NOT_AVAILABLE',
      note: 'The P1C artifact cannot safely reconstruct this map without inventing or adding an unauthorized adapter.'
    },
    {
      input: 'raw_vector_rank/raw_similarity/source ids',
      production_path: 'Dense candidate preparation and reranker normalization',
      status: 'AVAILABLE_UPSTREAM',
      eval_status: 'AVAILABLE_UPSTREAM',
      note: 'These fields are present in the frozen P1C replay.'
    },
    {
      input: 'GPT Gold profile_class / Gold grades',
      production_path: 'Eval-only Gold artifact',
      status: 'UNAUTHORIZED_FOR_EVAL',
      eval_status: 'UNAUTHORIZED_FOR_EVAL',
      note: 'Gold is used only by the frozen matcher after a replay, never to activate rerank inputs.'
    }
  ];
}

function retrievalInputTrace() {
  return [
    {
      required_input: 'canonical requirement query text / requirement_id',
      canonical_requirement: 'AVAILABLE_UPSTREAM',
      evidence_need_profile: 'NOT_AVAILABLE',
      candidate_evidence_packet: 'UNKNOWN',
      retrieval_candidate: 'AVAILABLE_UPSTREAM',
      rerank_input: 'AVAILABLE_UPSTREAM',
      note: 'EnterpriseRetrievalService loads the Canonical Requirement and blocks caller query_text.'
    },
    {
      required_input: 'requirement_role.value/status',
      canonical_requirement: 'AVAILABLE_UPSTREAM',
      evidence_need_profile: 'NOT_AVAILABLE',
      candidate_evidence_packet: 'UNKNOWN',
      retrieval_candidate: 'NOT_AVAILABLE',
      rerank_input: 'UNAUTHORIZED_FOR_EVAL',
      note: 'No Backend-owned Production EvidenceNeedProfile is built in the actual route.'
    },
    {
      required_input: 'evidence_needs[].value/status and profile_hash/version',
      canonical_requirement: 'AVAILABLE_UPSTREAM',
      evidence_need_profile: 'NOT_AVAILABLE',
      candidate_evidence_packet: 'UNKNOWN',
      retrieval_candidate: 'NOT_AVAILABLE',
      rerank_input: 'UNAUTHORIZED_FOR_EVAL',
      note: 'Gold profile_class is Eval-only and cannot populate production semantic metadata.'
    },
    {
      required_input: 'candidate_roles[chunk_id]',
      canonical_requirement: 'NOT_APPLICABLE',
      evidence_need_profile: 'NOT_APPLICABLE',
      candidate_evidence_packet: 'UNKNOWN',
      retrieval_candidate: 'AVAILABLE_BUT_DROPPED_BY_EVAL_ADAPTER',
      rerank_input: 'NOT_AVAILABLE',
      note: 'Production partitioning computes chunk_role, but the actual reranker input requires candidate_roles and P1C did not retain the source fields needed for an adapter.'
    },
    {
      required_input: 'raw_vector_rank/raw_similarity/source ids',
      canonical_requirement: 'NOT_APPLICABLE',
      evidence_need_profile: 'NOT_APPLICABLE',
      candidate_evidence_packet: 'AVAILABLE_UPSTREAM',
      retrieval_candidate: 'AVAILABLE_UPSTREAM',
      rerank_input: 'AVAILABLE_UPSTREAM',
      note: 'Frozen P1C replay preserves deterministic raw identity and rank fields.'
    }
  ];
}

function renderMarkdown(result) {
  const metrics = result.r_fallback.metrics_by_depth;
  const metricRows = candidateDepths.map((depth) => {
    const item = metrics[String(depth)];
    const m = item.final_review_metrics_at_k;
    return `| ${depth} | ${m['1'].evidence_atom_recall.toFixed(6)} | ${m['3'].evidence_atom_recall.toFixed(6)} | ${m['5'].evidence_atom_recall.toFixed(6)} | ${m['8'].evidence_atom_recall.toFixed(6)} | ${m['8'].candidate_precision.toFixed(6)} | ${m['8'].ndcg.toFixed(6)} | ${item.MRR_FINAL_AT_8.value.toFixed(6)} | ${item.final_pool_fill_rate.toFixed(6)} | ${item.cases_final_pool_lt_8} |`;
  }).join('\n');
  const specialRows = result.special_case_diagnostic.map((item) => {
    const ranks = Object.entries(item.fallback_by_depth).map(([depth, rank]) => `${depth}:${rank?.final_review_rank ?? '—'}`).join('<br>');
    return `| ${item.requirement_id} | ${item.governance_split} | ${item.first_grade_gte_2_dense_rank ?? '—'} | ${item.raw_candidate_k_required_for_survivor_entry ?? '—'} | ${ranks} | ${item.atom_recall_at_8_by_depth['20'] ?? '—'}→${item.atom_recall_at_8_by_depth['64'] ?? '—'} |`;
  }).join('\n');

  return `# V43_RAG_RETRIEVAL_P1D_EXISTING_RERANK_REACHABILITY_DIAGNOSTIC_CHECKPOINT_V1

Status: **PROVISIONAL / BLOCKED BEFORE EXISTING-RERANK REPLAY**  
Mode: **EVAL / ENGINEERING DIAGNOSTIC ONLY**  
Decision gate: **${result.decision_gate}**

## Scope and frozen inputs

This checkpoint inspects the actual production rerank path and replays only
the already-frozen P1C fallback results. It does not modify Production
Retrieval and does not invoke the existing reranker with invented metadata.

| Field | Value |
|---|---|
| Snapshot | ${result.frozen_inputs.snapshot.identity} |
| Snapshot SHA256 | ${result.frozen_inputs.snapshot.sha256} |
| Corpus | ${result.frozen_inputs.snapshot.material_count} materials / ${result.frozen_inputs.snapshot.chunk_count} chunks |
| Embedding | ${result.frozen_inputs.embedding.model} / ${result.frozen_inputs.embedding.dimensions} dimensions |
| Gold | ${result.frozen_inputs.gold.path} / ${result.frozen_inputs.gold.sha256} |
| Matcher | ${result.frozen_inputs.matcher.version} / ${result.frozen_inputs.matcher.sha256} |
| Candidate ladder | ${result.frozen_inputs.candidate_k_ladder.join(' / ')} |
| Final K | ${result.frozen_inputs.final_k} |
| Development cases | ${result.frozen_inputs.development_case_count} |
| Provider / embedding / LLM calls | 0 / 0 / 0 |

## Production implementation identity

- Route: \`POST /api/requirements/:requirementId/enterprise-retrieval\`.
- Service: \`EnterpriseRetrievalService.retrieve\`.
- Reranker: \`rerankProductionCandidates\` in \`${implementationPaths.reranker}\`, version \`${result.production_implementation.rerank_version}\`.
- Current shape: dense candidateK=20 → existing Production Hygiene → existing rerank if semantic metadata is usable, otherwise raw-vector fallback → final K=8.
- The reranker requires \`semanticMetadata.requirement_role\`, approved \`evidence_needs\`, and \`candidate_roles[chunk_id]\`. It applies bounded deterministic role/need shifts, then tie-breaks by bounded rank, raw rank, similarity, and source identity.
- Exact shift contract: preferred=-2, compatible=-1, unknown=0, weak=+1, incompatible=+2, with maximum absolute shift 4. Final order is bounded rank → raw vector rank → raw similarity descending → stable source identity; final review is the first 8.
- The semantic-role lookup is keyed by the raw candidate \`chunk_id\` before normalization. The production candidate normalizer also accepts \`source_chunk_id\`, but no current service adapter maps the computed \`chunk_role\` to \`candidate_roles[chunk_id]\`.
- No Gold labels or LLM are part of the production reranker.

## Metadata reachability

| Required input | Production status | Eval status | Finding |
|---|---|---|---|
${result.metadata_reachability.map((row) => `| ${row.input} | ${row.status} | ${row.eval_status} | ${row.note} |`).join('\n')}

The actual route accepts caller-provided \`semantic_metadata\`, but this is not
an approved Production EvidenceNeedProfile. The existing deterministic profile
builder is not called by the actual Enterprise Retrieval path. The frozen P1C
adapter also omitted \`source_text\`, \`chunk_role\`, and \`content_role\`, so a
candidate-role map cannot be reconstructed without a new adapter or invented
metadata. Gold \`profile_class\` was not used.

## R-FALLBACK: frozen current behavior

R-FALLBACK was replayed from the frozen P1C result using the exact current
fallback contract: dense → existing Hygiene → raw-vector fallback → Top8.

| Raw depth | Recall@1 | Recall@3 | Recall@5 | Recall@8 | Precision@8 | nDCG@8 | MRR_FINAL@8 | Fill rate | Final pool <8 |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
${metricRows}

Raw diagnostics remain separate: ${candidateDepths.map((depth) => `MRR_RAW@${depth}=${metrics[String(depth)].raw_mrr.value.toFixed(6)}`).join(', ')}.

The metrics above are Development Validation metrics, not fresh blind-holdout
acceptance. Candidate precision, nDCG, and atom recall use the frozen Evidence
Item/span matcher only.

## Required input trace

The trace is explicit at each boundary; \`UNKNOWN\` means the frozen artifact
does not establish that the intermediate packet exists, not that a missing
field was inferred.

| Required input | Canonical Requirement | EvidenceNeedProfile | Candidate Evidence Packet | Retrieval candidate | Rerank input | Note |
|---|---|---|---|---|---|---|
${result.retrieval_input_trace.map((row) => `| ${row.required_input} | ${row.canonical_requirement} | ${row.evidence_need_profile} | ${row.candidate_evidence_packet} | ${row.retrieval_candidate} | ${row.rerank_input} | ${row.note} |`).join('\n')}

## R-EXISTING: existing rerank replay gate

R-EXISTING was **not invoked**. The replay is blocked before reranker
invocation because no approved Production EvidenceNeedProfile and no safe
candidate-role adapter are reachable from the frozen inputs. Consequently,
there are no R-EXISTING metrics, no claimed rerank rank movement, and no
semantic conclusion about the quality of \`${result.production_implementation.rerank_version}\`.

| Depth | Status | Invocation count | Metrics |
|---:|---|---:|---|
${candidateDepths.map((depth) => `| ${depth} | NOT_EVALUATED | 0 | APPROVED_PRODUCTION_METADATA_UNAVAILABLE |`).join('\n')}

## Special-case diagnostics

These are diagnostic references only and were not used to tune or create
metadata. \`FAST-01:REQ-005\` remains a Calibration case; the other three are
Development Validation cases.

| Requirement | Split | First grade≥2 dense rank | Survivor depth | Fallback final-review rank by depth | Atom Recall@8 |
|---|---|---:|---:|---|---|
${specialRows}

The diagnostics show why a rerank quality claim cannot be made yet: candidates
that are present in the frozen replay still lack the approved semantic inputs
needed to activate the production reranker.

## Safety and authority parity

- Production Retrieval changes: 0; production DB writes: 0.
- Gold mutations: 0; corpus/vector mutations: 0; source span/lineage changes: 0.
- Fact / Mapping / Claim / Writer / Router / profile mutations: 0.
- Gold was not used in rerank activation logic; no Gold-aware filter or ranking was added.
- Provider, embedding, and LLM calls: 0.

## Recommendation

**${result.decision_gate}**

Return to GPT for an architecture/metadata decision. If GPT authorizes a
follow-up, it must define a Backend-owned Production EvidenceNeedProfile and a
deterministic candidate-role adapter before any R-EXISTING replay. No P2, P3,
P4, hybrid, MMR, cross-encoder, or Production Retrieval change is authorized
by this checkpoint.

No commit, push, merge, deploy, or production modification was performed.
`;
}

async function main() {
  const p1c = await readJson(p1cReplayPath);
  const p1cQueryFreeze = await readJson(p1cQueryFreezePath);
  const devCases = p1c.cases.filter((item) => item.governance_split === 'DEVELOPMENT_VALIDATION_SET');
  const specialDiagnostics = p1c.special_case_diagnostic
    .filter((item) => specialRequirementIds.includes(item.requirement_id))
    .map((item) => ({
      ...item,
      governance_split: p1c.cases.find((candidate) => candidate.requirement_id === item.requirement_id)?.governance_split,
      fallback_by_depth: Object.fromEntries(
        candidateDepths.map((depth) => [String(depth), {
          post_hygiene_rank: item.post_hygiene_rank_by_depth[String(depth)],
          final_review_rank: item.final_review_rank_by_depth[String(depth)]
        }])
      ),
      existing_rerank_by_depth: Object.fromEntries(candidateDepths.map((depth) => [String(depth), {
        rank: null,
        atom_recall_at_8: null,
        status: 'BLOCKED_BEFORE_INVOCATION'
      }]))
    }));

  const sourceHashes = {};
  for (const [name, relativePath] of Object.entries(implementationPaths)) {
    sourceHashes[name] = { path: relativePath, sha256: await sha256(path.join(repoRoot, relativePath)) };
  }

  const result = {
    artifact_type: 'V43_RAG_RETRIEVAL_P1D_EXISTING_RERANK_REACHABILITY_DIAGNOSTIC_CHECKPOINT_V1',
    artifact_version: '1.0.0',
    status: 'PROVISIONAL_BLOCKED_BEFORE_EXISTING_RERANK_REPLAY',
    execution_mode: 'EVAL_ENGINEERING_DIAGNOSTIC_ONLY',
    decision_gate: 'EXISTING_RERANK_NOT_EVALUABLE',
    recommendation: 'RETURN_TO_GPT_ARCHITECTURE_DECISION',
    frozen_inputs: {
      snapshot: {
        identity: 'EVSNAP-D98FA52C-952F-416F-B57F-92C41EF9731D',
        path: 'docs/handoff/V43_EVIDENCE_SEARCH_SUPPORT_ARCHITECTURE_ENGINEERING_V1/evidence-vector-snapshot/EVSNAP-D98FA52C-952F-416F-B57F-92C41EF9731D.json',
        sha256: await sha256(snapshotPath),
        material_count: 9,
        chunk_count: 94
      },
      embedding: { model: 'Qwen/Qwen3-Embedding-0.6B', dimensions: 1024 },
      gold: { path: 'backend/eval/retrieval-quality-p0/GPT_SEMANTIC_GOLD_V1.json', sha256: await sha256(goldPath), authority: 'DEVELOPMENT_EVAL_ONLY' },
      matcher: { version: 'EVIDENCE_MATCHER_V1_EXACT_ACCEPTED_SPAN_GRADE', sha256: 'ce675a8756ea325fe208a32a8143d5889586fb26a343c7dd430dce378fe5c4f2' },
      p1c_replay: { path: 'backend/eval/retrieval-quality-p1c/results/V43_RAG_RETRIEVAL_P1C_BOUNDED_OVERFETCH_REPLAY_V1.json', sha256: await sha256(p1cReplayPath) },
      query_batch_freeze: { path: p1cQueryFreezePath.replace(`${repoRoot}${path.sep}`, '').replaceAll('\\', '/'), sha256: await sha256(p1cQueryFreezePath), content_hash: p1cQueryFreeze.deterministic_content_hash },
      candidate_k_ladder: candidateDepths,
      final_k: 8,
      development_case_count: devCases.length,
      development_case_order: devCases.map((item) => item.requirement_id)
    },
    production_implementation: {
      contract_version: '4.3-production-retrieval-v1',
      rerank_version: '4.3-role-need-rerank-v1',
      route: 'POST /api/requirements/:requirementId/enterprise-retrieval',
      service_function: 'EnterpriseRetrievalService.retrieve',
      reranker_function: 'rerankProductionCandidates',
      raw_candidate_k: 20,
      final_k: 8,
      activation: 'semantic_metadata usable predicate; otherwise RAW_VECTOR_FALLBACK',
      fallback: 'bounded shift 0; deterministic raw rank/similarity/source-id order',
      compatibility_shift_contract: { preferred: -2, compatible: -1, unknown: 0, weak: 1, incompatible: 2, max_absolute_shift: 4 },
      final_order: ['bounded_rank', 'raw_vector_rank', 'raw_similarity_desc', 'stable_source_identity'],
      role_lookup_key_before_normalization: 'chunk_id',
      candidate_normalization_accepts: ['source_chunk_id', 'chunk_id'],
      source_hashes: sourceHashes,
      reranker_uses_gold: false,
      reranker_uses_llm: false,
      actual_route_builds_production_profile: false
    },
    activation_contract: {
      requirement_role: 'approved and non-unknown',
      evidence_needs: 'non-empty; every need approved and non-unknown',
      candidate_roles: 'every candidate role approved and non-unknown',
      if_not_usable: 'RAW_VECTOR_FALLBACK'
    },
    metadata_reachability: metadataReachability(),
    retrieval_input_trace: retrievalInputTrace(),
    r_fallback: {
      status: 'EXECUTED_FROM_FROZEN_P1C_REPLAY',
      shape: 'dense → existing Production Hygiene → raw-vector fallback → final Top8',
      metrics_by_depth: projectedMetrics(p1c.selection.development_metrics_by_depth),
      cases: devCases.map(fallbackCaseProjection)
    },
    r_existing: {
      status: 'NOT_EXECUTED_METADATA_BLOCKED',
      invocation_count: 0,
      metrics_by_depth: Object.fromEntries(candidateDepths.map((depth) => [String(depth), {
        status: 'NOT_EVALUATED',
        reason: 'APPROVED_PRODUCTION_EVIDENCE_NEED_PROFILE_UNAVAILABLE'
      }])),
      cases: devCases.map(existingBlockedCaseProjection),
      no_synthetic_metadata: true,
      gold_profile_used: false
    },
    special_case_diagnostic: specialDiagnostics,
    safety: {
      provider_calls: 0,
      embedding_calls: 0,
      llm_calls: 0,
      production_retrieval_changes: 0,
      production_db_writes: 0,
      eval_db_writes: 0,
      gold_mutations: 0,
      corpus_mutations: 0,
      embedding_mutations: 0,
      source_span_identity_changes: 0,
      lineage_changes: 0,
      authority_changes: 0,
      fact_mapping_claim_writer_mutations: 0,
      router_profile_mutations: 0
    },
    generated_by: 'backend/eval/retrieval-quality-p1d/run-p1d-existing-rerank-reachability-diagnostic-v1.mjs'
  };

  result.deterministic_content_hash = hashJson(result);
  const resultDir = path.join(repoRoot, 'backend/eval/retrieval-quality-p1d/results');
  const handoffDir = path.join(repoRoot, 'docs/handoff/V43_RAG_RETRIEVAL_P1D_EXISTING_RERANK_REACHABILITY_DIAGNOSTIC_V1');
  await mkdir(resultDir, { recursive: true });
  await mkdir(handoffDir, { recursive: true });
  const json = JSON.stringify(result, null, 2) + '\n';
  const markdown = renderMarkdown(result);
  await writeFile(path.join(resultDir, 'V43_RAG_RETRIEVAL_P1D_EXISTING_RERANK_REACHABILITY_DIAGNOSTIC_V1.json'), json);
  await writeFile(path.join(handoffDir, 'V43_RAG_RETRIEVAL_P1D_EXISTING_RERANK_REACHABILITY_DIAGNOSTIC_CHECKPOINT_V1.json'), json);
  await writeFile(path.join(handoffDir, 'V43_RAG_RETRIEVAL_P1D_EXISTING_RERANK_REACHABILITY_DIAGNOSTIC_CHECKPOINT_V1.md'), markdown);
  process.stdout.write(JSON.stringify({
    status: result.status,
    decision_gate: result.decision_gate,
    r_fallback_depths: candidateDepths,
    r_existing_invocations: result.r_existing.invocation_count,
    development_case_count: result.frozen_inputs.development_case_count,
    deterministic_content_hash: result.deterministic_content_hash
  }, null, 2) + '\n');
}

await main();
