import fs from 'node:fs/promises';
import path from 'node:path';
import dotenv from 'dotenv';
import { createPool } from '../../src/db.js';
import { EvidenceSourceContextResolver } from '../../src/pipeline/evidence-source-context-resolver.js';
import { expandEvidenceContext } from '../../src/pipeline/evidence-context-expansion.js';

dotenv.config({ path: path.resolve(process.cwd(), 'backend/.env') });

const FIXTURES = Object.freeze({
  COM04: '2511c8f9-fff1-489d-b385-2ddc522c548c',
  GOV02: '08d5580a-d81b-491f-8c9b-d37ca4251840'
});

const queries = Object.freeze({
  COM04: '企业是否具备 API 接口集成、第三方系统对接和数据治理能力？有哪些可核验材料？',
  GOV02: '政务数据共享、数据目录、跨部门协同和系统接口建设通常需要哪些能力？'
});

const contains = (value, needle) => String(value ?? '').includes(needle);
const json = value => JSON.stringify(value, null, 2);

function contextText(items = []) {
  return items.map(item => item.text).filter(Boolean).join('\n');
}

function provenance(span) {
  const location = span?.source_location || {};
  return {
    material_id: span?.material_id ?? null,
    source_chunk_ids: span?.source_chunk_ids ?? [],
    char_start: span?.start_offset ?? location.char_start ?? null,
    char_end: span?.end_offset ?? location.char_end ?? null,
    paragraph_start: location.paragraph_start ?? null,
    paragraph_end: location.paragraph_end ?? null,
    heading_path: span?.heading_path ?? location.heading_path ?? []
  };
}

function fixtureResult({ key, material, chunks, retrievalHits, resolver }) {
  const byIndex = index => chunks.find(chunk => Number(chunk.chunk_index) === index) || null;
  const finalHit = retrievalHits.find(hit => hit.is_final) || null;
  const resolveAndExpand = (hit, label) => {
    if (!hit) return null;
    const span = resolver.resolve({ material, chunks, anchorChunkId: hit.chunk_id, strategy: 'auto' });
    const expanded = expandEvidenceContext({
      exactSpan: {
        ...span,
        source_id: span.span_id,
        source_span_id: span.span_id,
        anchor_chunk_id: hit.chunk_id,
        source_text: span.source_text
      },
      material,
      chunks,
      missingDimensions: []
    });
    const allRecoveredText = `${span.source_text}\n${contextText(expanded.context_window)}`;
    return {
      label,
      retrieval_hit: {
        chunk_id: hit.chunk_id,
        chunk_index: hit.chunk_index,
        role: hit.chunk_role ?? null,
        candidate_eligibility: hit.candidate_eligibility ?? null,
        text: hit.source_text
      },
      resolved_span: {
        span_id: span.span_id,
        resolver_strategy: span.resolver_strategy,
        source_text: span.source_text,
        provenance: provenance(span)
      },
      expanded_context: {
        exact_evidence_span: expanded.exact_evidence_span,
        context_window: expanded.context_window,
        recovery_state: expanded.recovery_state,
        recovered_context_chars: allRecoveredText.length,
        source_chunk_ids: [
          ...(span.source_chunk_ids || []),
          ...expanded.context_window.map(item => item.chunk_id).filter(Boolean)
        ].filter((value, index, values) => values.indexOf(value) === index)
      },
      semantic_checks: {
        heading_recovered: /(?:^|\n)#/.test(allRecoveredText) || /(?:接口|边界|目录与共享)/.test(allRecoveredText),
        positive_capability_recovered: contains(allRecoveredText, '支持REST API、Webhook和批量文件交换'),
        negative_boundary_recovered: contains(allRecoveredText, '不代表已对接任何真实政务或医院系统'),
        body_recovered: contains(allRecoveredText, '需明确数据目录、共享属性、使用条件、授权、安全和记录'),
        boundary_treated_as_positive: 'NOT_DETERMINED_BY_CONTEXT_COMPONENT'
      },
      component_observation: {
        anchor_chunk: byIndex(hit.chunk_index),
        adjacent_policy: 'previous one + next one, same material/document only'
      }
    };
  };

  const final = resolveAndExpand(finalHit, 'actual_retrieval_final_hit');
  const positiveProbe = key === 'COM04' ? resolveAndExpand({
    ...byIndex(3),
    is_final: true,
    chunk_role: 'BUSINESS_CONTENT',
    candidate_eligibility: 'EVIDENCE_ELIGIBLE'
  }, 'positive_span_probe_using_production_resolver') : null;
  return {
    key,
    material_id: material.id,
    material_name: material.original_name,
    query: queries[key],
    material_metadata: {
      material_type: material.material_type,
      corpus_scope: material.corpus_scope,
      industry: material.industry,
      source_type: material.source_type,
      source_org: material.source_org,
      authority_level: material.authority_level
    },
    chunks: chunks.map(chunk => ({
      chunk_id: chunk.chunk_id,
      chunk_index: chunk.chunk_index,
      char_start: chunk.char_start,
      char_end: chunk.char_end,
      paragraph_start: chunk.paragraph_start,
      paragraph_end: chunk.paragraph_end,
      section: chunk.section,
      source_text: chunk.source_text
    })),
    retrieval: {
      run_count: new Set(retrievalHits.map(hit => hit.retrieval_run_id)).size,
      hits: retrievalHits.map(hit => ({
        retrieval_run_id: hit.retrieval_run_id,
        requirement_id: hit.requirement_id,
        rank: hit.rank,
        is_final: hit.is_final,
        chunk_id: hit.chunk_id,
        chunk_index: hit.chunk_index,
        chunk_role: hit.chunk_role,
        candidate_eligibility: hit.candidate_eligibility,
        source_text: hit.source_text
      }))
    },
    production_path_observation: final,
    positive_span_probe: positiveProbe,
    database_source_spans: 0,
    database_reviews: 0
  };
}

const pool = createPool();
try {
  const ids = Object.values(FIXTURES);
  const materials = (await pool.query('SELECT * FROM company_materials WHERE id=ANY($1::uuid[])', [ids])).rows;
  const chunks = (await pool.query('SELECT * FROM material_chunks WHERE material_id=ANY($1::uuid[]) ORDER BY material_id,chunk_index', [ids])).rows;
  const retrievalHits = (await pool.query(`
    SELECT er.retrieval_run_id,er.requirement_id,rr.rank,rr.is_final,rr.chunk_role,
      rr.candidate_eligibility,rr.chunk_id,c.chunk_index,c.source_text
    FROM enterprise_retrieval_runs er
    JOIN enterprise_retrieval_results rr ON rr.retrieval_run_id=er.retrieval_run_id
    JOIN material_chunks c ON c.chunk_id=rr.chunk_id
    WHERE c.material_id=ANY($1::uuid[])
    ORDER BY c.material_id,rr.created_at,rr.rank
  `, [ids])).rows;
  const resolver = new EvidenceSourceContextResolver();
  const fixture = key => {
    const material = materials.find(item => item.id === FIXTURES[key]);
    const fixtureChunks = chunks.filter(item => item.material_id === FIXTURES[key]);
    return fixtureResult({ key, material, chunks: fixtureChunks, retrievalHits: retrievalHits.filter(item => fixtureChunks.some(chunk => chunk.chunk_id === item.chunk_id)), resolver });
  };
  const report = {
    report_version: 'context-recovery-runtime-verification-v1',
    generated_at: new Date().toISOString(),
    mode: 'READ_ONLY_RUNTIME_VERIFICATION',
    implementation: {
      component_exists: true,
      components: [
        {
          file: 'backend/src/pipeline/evidence-context-expansion.js',
          function: 'expandEvidenceContext',
          responsibility: 'retain exact span and add same-sentence/paragraph, header, section, same-chunk and bounded adjacent context',
          input_contract: 'exactSpan + material + ordered material chunks + missing dimensions',
          output_contract: 'exact_evidence_span + context_window + dimension recovery state',
          bounded_rule: 'same material/document; adjacent chunk_index only previous and next one; each added text is bounded by maxContextChars (default 2400); no recursive traversal',
          provenance_fields: 'exact span source_text_hash/source_span_id/anchor_chunk_id; context entries origin/chunk_id; no char offsets on context entries'
        },
        {
          file: 'backend/src/pipeline/evidence-source-context-resolver.js',
          function: 'EvidenceSourceContextResolver.resolve',
          responsibility: 'deterministically resolve retrieval anchor to exact source range before Evidence creation',
          input_contract: 'material + material chunks + anchorChunkId + resolution strategy',
          output_contract: 'span_id + source_text/hash + source_location + heading_path + source_chunk_ids',
          bounded_rule: 'SOURCE_SPAN_MAX_CHARS=4000; EVIDENCE_SOURCE_MAX_PARAGRAPHS=12; stops at heading boundaries',
          provenance_fields: 'material_id, source_chunk_ids, start/end offsets, paragraph/page bounds, heading path, resolver version'
        }
      ]
    },
    wiring: {
      chain: 'Retriever -> EnterpriseRetrievalService -> EvidenceService.createFromRetrieval -> EvidenceSourceContextResolver.resolve -> EvidenceSourceFact/Review boundary -> EvidenceReviewService.propose -> expandEvidenceContext -> semantic evidence support review -> createEvidenceReviewContract -> review persistence',
      runtime_callers: [
        'backend/src/evidence-service.js:createFromRetrieval',
        'backend/src/evidence-review-service.js:propose'
      ],
      phase: 'source review / evidence span, before Fact extraction; not raw retrieval and not Mapping',
      raw_retrieval_atomic: true,
      final_context_expanded: true,
      formal_review_rows_for_fixtures: false
    },
    fixtures: {
      COM04: fixture('COM04'),
      GOV02: fixture('GOV02')
    },
    heading_behavior: {
      case_a: false,
      case_b: false,
      case_c: true,
      case_d: false,
      explanation: 'A heading anchor is resolved by EvidenceSourceContextResolver before Evidence creation. For GOV-02 top-level heading, auto heading_group spans the material and includes body. For a persisted span, expandEvidenceContext then adds only one adjacent chunk on each side. The helper itself does not classify polarity.'
    },
    calls: {
      siliconflow_embedding: 0,
      provider_generation: 0,
      deepseek: 0,
      dify: 0
    },
    tests: {
      executed: false,
      note: 'Report generation exercised the production resolver and expansion functions directly against read-only DB rows; no mock recovery algorithm or external call was used.'
    },
    git: {
      production_writes: 0,
      db_writes: 0,
      commit_push_deploy: false
    }
  };
  const resultDir = path.resolve(process.cwd(), 'backend/eval/rag-pilot/results');
  await fs.mkdir(resultDir, { recursive: true });
  await fs.writeFile(path.join(resultDir, 'context_recovery_runtime_verification.json'), `${json(report)}\n`, 'utf8');
  const com = report.fixtures.COM04;
  const gov = report.fixtures.GOV02;
  const comHit = com.production_path_observation?.retrieval_hit;
  const comSpan = com.production_path_observation?.resolved_span;
  const comExpandedIds = (com.production_path_observation?.expanded_context?.source_chunk_ids || []).join(', ');
  const govHits = (gov.retrieval.hits || []).filter(item => item.is_final).map(item => ['chunk ', item.chunk_index, ': ', item.source_text].join('')).join('；');
  const govExpandedIds = (gov.production_path_observation?.expanded_context?.source_chunk_ids || []).join(', ');
  const md = [
    '# V43_CONTEXT_RECOVERY_RUNTIME_VERIFICATION_CHECKPOINT',
    '', '## IMPLEMENTATION', '', '- component exists: YES', '- components: EvidenceSourceContextResolver.resolve and expandEvidenceContext',
    '- bounded rule: same material/document; previous/next one adjacent chunk; each added item bounded by maxContextChars (default 2400); no recursive traversal',
    '- provenance: resolver retains material/chunk IDs, offsets, paragraph bounds, heading path; expansion entries retain origin/chunk_id but not char offsets',
    '', '## WIRING', '', 'Retriever → EvidenceService.createFromRetrieval → EvidenceSourceContextResolver → EvidenceReviewService.propose → expandEvidenceContext → semantic review → review persistence → Fact boundary',
    '', '- phase: source review / evidence span, before Fact', '- raw retrieval remains atomic: YES',
    '- final context expanded: YES when the formal Evidence/Review path is entered', '- DB source spans/reviews for these fixtures: 0 / 0 (read-only fixture observation)',
    '', '## COM-04', '', `- material_id: ${com.material_id}`,
    `- actual retrieval final hit: chunk ${comHit?.chunk_index ?? 'none'}, ${comHit?.text ?? ''}`,
    `- resolved exact span: ${comSpan?.source_text ?? ''}`, `- recovered source_chunk_ids: ${comExpandedIds}`,
    `- positive capability recovered on actual hit: ${com.production_path_observation?.semantic_checks?.positive_capability_recovered ? 'YES' : 'NO'}`,
    `- negative/boundary sentence retained on actual hit: ${com.production_path_observation?.semantic_checks?.negative_boundary_recovered ? 'YES' : 'NO'}`,
    '- boundary treated as positive evidence: NOT THIS LAYER\'S RESPONSIBILITY / NOT DETERMINED',
    `- positive-span probe (anchor chunk 3) recovers positive: ${com.positive_span_probe?.semantic_checks?.positive_capability_recovered ? 'YES' : 'NO'}`,
    `- positive-span probe recovers boundary sentence: ${com.positive_span_probe?.semantic_checks?.negative_boundary_recovered ? 'YES' : 'NO'}`,
    '- PASS/FAIL: FAIL for the stated combined-context acceptance; current one-hop expansion cannot retain both bodies from a positive exact span, and does not provide polarity semantics',
    '', '## GOV-02', '', `- material_id: ${gov.material_id}`, `- actual final hits: ${govHits}`,
    `- heading/body recovered by production resolver: ${gov.production_path_observation?.semantic_checks?.body_recovered ? 'YES' : 'NO'}`,
    `- resolved context chars: ${gov.production_path_observation?.expanded_context?.recovered_context_chars ?? 0}`, `- source_chunk_ids: ${govExpandedIds}`,
    '- heading-only final context: NO', '- PASS/FAIL: PASS for non-heading-only recovery',
    '', '## HEADING BEHAVIOR', '', '- Actual: CASE C for the resolver (heading locates a source span containing its body); the expansion helper itself is bounded one-hop behavior.',
    '- GOV-02 top-level heading auto-resolves to its heading group, which includes the body.', '- No component assigns semantic polarity; a boundary sentence must be interpreted by the semantic review layer.',
    '', '## PROVENANCE', '', '- multi-chunk provenance retained: YES at resolver span; expanded context carries chunk IDs', '- char bounds retained: YES for resolved span', '- paragraph bounds retained: YES for resolved span', '- source_chunk_ids complete: YES for resolved span; context entries are chunk-level only',
    '', '## CALLS', '', '- SiliconFlow embedding: 0', '- Provider generation: 0', '- DeepSeek: 0', '- Dify: 0',
    '', '## TESTS / GIT', '', '- production component invocation: PASS (read-only DB rows)', '- production writes: 0', '- DB writes: 0', '- commit/push/deploy: NO',
    '', '## FINAL STATUS', '', 'CONTEXT_RECOVERY_USABILITY_FAIL — component exists and is wired post-review/span, GOV-02 is not heading-only, but COM-04 does not satisfy the required combined positive-plus-boundary context/polarity acceptance.', ''
  ].join('\n');
  await fs.writeFile(path.join(resultDir, 'context_recovery_runtime_verification.md'), md, 'utf8');
  console.log(JSON.stringify({ json: path.join(resultDir, 'context_recovery_runtime_verification.json'), markdown: path.join(resultDir, 'context_recovery_runtime_verification.md'), calls: report.calls, status: 'CONTEXT_RECOVERY_USABILITY_FAIL' }, null, 2));
} finally {
  await pool.end();
}
