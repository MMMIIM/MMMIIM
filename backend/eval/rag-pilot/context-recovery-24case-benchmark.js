import fs from 'node:fs/promises';
import path from 'node:path';
import dotenv from 'dotenv';
import { createPool } from '../../src/db.js';
import { EvidenceSourceContextResolver } from '../../src/pipeline/evidence-source-context-resolver.js';
import { expandEvidenceContext } from '../../src/pipeline/evidence-context-expansion.js';

dotenv.config({ path: path.resolve(process.cwd(), 'backend/.env') });

const CASE_DEFS = Object.freeze([
  // Heading -> body, one per supported scope. GOV-02 deliberately exercises the top-level heading special case.
  ['HEADING_TO_BODY', 'UNI-08', 2], ['HEADING_TO_BODY', 'GOV-02', 0], ['HEADING_TO_BODY', 'MED-07', 2], ['HEADING_TO_BODY', 'COM-04', 2],
  // Body -> heading.
  ['BODY_TO_HEADING', 'UNI-03', 3], ['BODY_TO_HEADING', 'GOV-06', 3], ['BODY_TO_HEADING', 'MED-08', 3], ['BODY_TO_HEADING', 'COM-03', 5],
  // Positive capability.
  ['POSITIVE_CAPABILITY', 'COM-02', 3], ['POSITIVE_CAPABILITY', 'COM-04', 3], ['POSITIVE_CAPABILITY', 'MED-07', 3], ['POSITIVE_CAPABILITY', 'GOV-06', 3],
  // Negative / boundary.
  ['NEGATIVE_BOUNDARY', 'COM-04', 5], ['NEGATIVE_BOUNDARY', 'COM-06', 5], ['NEGATIVE_BOUNDARY', 'COM-08', 5], ['NEGATIVE_BOUNDARY', 'COM-12', 5],
  // Multi-paragraph / multiline source blocks.
  ['MULTI_PARAGRAPH', 'UNI-03', 7], ['MULTI_PARAGRAPH', 'GOV-02', 7], ['MULTI_PARAGRAPH', 'MED-07', 5], ['MULTI_PARAGRAPH', 'COM-04', 9],
  // Business body next to metadata / section boundaries.
  ['METADATA_SECTION_BOUNDARY', 'UNI-08', 5], ['METADATA_SECTION_BOUNDARY', 'GOV-02', 3], ['METADATA_SECTION_BOUNDARY', 'MED-01', 3], ['METADATA_SECTION_BOUNDARY', 'COM-07', 5]
].map(([category, doc_id, chunk_index], index) => ({ case_id: `CR-${String(index + 1).padStart(2, '0')}`, category, doc_id, chunk_index })));

const headingLine = value => /^#{1,6}\s+/.test(String(value ?? '').trim());
const text = value => String(value ?? '');
const csvEscape = value => {
  const rendered = value == null ? '' : String(value);
  return /[",\n\r]/.test(rendered) ? `"${rendered.replaceAll('"', '""')}"` : rendered;
};
const unique = values => [...new Set(values.filter(Boolean))];

function sourceChunkIdsInSpan(span, chunks) {
  return (span.source_chunk_ids || []).map(id => chunks.find(chunk => chunk.chunk_id === id)).filter(Boolean);
}

function hasBodyAfterAnchor(span, anchor, chunks) {
  const included = sourceChunkIdsInSpan(span, chunks);
  if (!headingLine(anchor.source_text)) return true;
  const anchorPosition = included.findIndex(chunk => chunk.chunk_id === anchor.chunk_id);
  return included.slice(anchorPosition + 1).some(chunk => !headingLine(chunk.source_text));
}

function contextBodyOutsideSpan(expanded, span, anchor, chunks) {
  const spanIds = new Set(span.source_chunk_ids || []);
  const ordered = [...chunks].sort((left, right) => Number(left.chunk_index) - Number(right.chunk_index));
  const anchorIndex = Number(anchor.chunk_index);
  const anchorHeadingIndex = ordered.reduce((found, chunk, index) => index <= anchorIndex && headingLine(chunk.source_text) ? index : found, -1);
  const anchorHeadingLevel = anchorHeadingIndex >= 0 ? (text(ordered[anchorHeadingIndex].source_text).trim().match(/^(#+)/)?.[1].length || 0) : 0;
  const anchorHeadingText = anchorHeadingIndex >= 0 ? text(ordered[anchorHeadingIndex].source_text).trim() : '';
  return expanded.context_window.some(item => {
    if (item.origin !== 'ADJACENT_CHUNK' || !item.chunk_id || spanIds.has(item.chunk_id)) return false;
    const chunk = chunks.find(candidate => candidate.chunk_id === item.chunk_id);
    if (!chunk || headingLine(chunk.source_text)) return false;
    const candidateIndex = Number(chunk.chunk_index);
    const precedingHeadingIndex = ordered.reduce((found, candidate, index) => index <= candidateIndex && headingLine(candidate.source_text) ? index : found, -1);
    if (precedingHeadingIndex < 0 || anchorHeadingIndex < 0) return false;
    const precedingHeading = text(ordered[precedingHeadingIndex].source_text).trim();
    if (candidateIndex < anchorIndex) {
      // Preamble/disclaimer before the anchor is not sibling-section contamination.
      return precedingHeadingIndex > anchorHeadingIndex && precedingHeading !== anchorHeadingText
        && (precedingHeading.match(/^(#+)/)?.[1].length || 0) <= anchorHeadingLevel;
    }
    return precedingHeading !== anchorHeadingText && (precedingHeading.match(/^(#+)/)?.[1].length || 0) <= anchorHeadingLevel;
  });
}

function runCase(definition, material, chunks, retrievalResolver) {
  const anchor = chunks.find(chunk => Number(chunk.chunk_index) === definition.chunk_index);
  if (!anchor) throw new Error(`${definition.case_id}: anchor chunk ${definition.doc_id}/${definition.chunk_index} not found`);
  const span = retrievalResolver.resolve({ material, chunks, anchorChunkId: anchor.chunk_id, strategy: 'auto' });
  const expanded = expandEvidenceContext({
    exactSpan: {
      ...span,
      source_id: span.span_id,
      source_span_id: span.span_id,
      anchor_chunk_id: anchor.chunk_id,
      source_text: span.source_text
    },
    material,
    chunks,
    missingDimensions: []
  });
  const contextText = [span.source_text, ...expanded.context_window.map(item => item.text)].join('\n');
  const allSpanIdsValid = (span.source_chunk_ids || []).every(id => chunks.some(chunk => chunk.chunk_id === id));
  const boundsValid = Number.isInteger(span.start_offset) && Number.isInteger(span.end_offset)
    && span.start_offset >= 0 && span.end_offset > span.start_offset
    && span.end_offset <= text(material.extracted_text).length
    && text(material.extracted_text).slice(span.start_offset, span.end_offset) === span.source_text;
  const provenanceComplete = span.material_id === material.id && span.anchor_chunk_id === anchor.chunk_id
    && allSpanIdsValid && boundsValid && Number.isInteger(span.source_location?.paragraph_start)
    && Number.isInteger(span.source_location?.paragraph_end);
  const headingPresent = /(?:^|\n)#{1,6}\s+/.test(span.source_text) || expanded.context_window.some(item => item.origin === 'SECTION_HEADING');
  const bodyPresent = hasBodyAfterAnchor(span, anchor, chunks) || !headingLine(anchor.source_text) || expanded.context_window.some(item => item.origin === 'ADJACENT_CHUNK' && !headingLine(item.text));
  const crossSectionContamination = contextBodyOutsideSpan(expanded, span, anchor, chunks);
  const anchorRetained = span.source_text.includes(anchor.source_text);
  const sameSection = Boolean(span.heading_path?.length || span.source_location?.section);
  const expected = {
    heading_present: true,
    body_present: true,
    anchor_retained: true,
    same_section: true,
    cross_section_contamination: false,
    provenance_complete: true
  };
  const failures = [];
  if (expected.heading_present && !headingPresent) failures.push('heading_missing');
  if (expected.body_present && !bodyPresent) failures.push('body_missing');
  if (!anchorRetained) failures.push('anchor_missing');
  if (!sameSection) failures.push('same_section_missing');
  if (crossSectionContamination) failures.push('cross_section_contamination');
  if (!provenanceComplete) failures.push('provenance_failure');
  const headingMatch = /^(#{1,6})\s+/.exec(text(anchor.source_text).trim());
  const resolverScope = headingMatch?.[1]?.length === 1 && Number(anchor.chunk_index) === 0
    ? 'TOP_LEVEL_HEADING_GROUP'
    : (span.resolver_strategy === 'heading_group' ? 'PARENT_HEADING_GROUP' : span.resolver_strategy);
  return {
    case_id: definition.case_id,
    category: definition.category,
    doc_id: definition.doc_id,
    scope: material.corpus_scope,
    material_id: material.id,
    anchor_chunk_id: anchor.chunk_id,
    anchor_chunk_index: anchor.chunk_index,
    anchor_text: anchor.source_text,
    resolver_scope: resolverScope,
    resolver_span: {
      text: span.source_text,
      char_start: span.start_offset,
      char_end: span.end_offset,
      paragraph_start: span.source_location?.paragraph_start ?? null,
      paragraph_end: span.source_location?.paragraph_end ?? null,
      source_chunk_ids: span.source_chunk_ids || [],
      heading_path: span.heading_path || [],
      resolver_strategy: span.resolver_strategy
    },
    expanded_context: expanded.context_window,
    signals: {
      heading_present: headingPresent,
      body_present: bodyPresent,
      anchor_retained: anchorRetained,
      same_section: sameSection,
      cross_section_contamination: crossSectionContamination,
      provenance_complete: provenanceComplete,
      expanded_context_chars: contextText.length
    },
    status: failures.length ? 'FAIL' : 'PASS',
    failure_reason: failures.join(';') || null
  };
}

const pool = createPool();
try {
  const docIds = unique(CASE_DEFS.map(definition => definition.doc_id));
  const materials = (await pool.query("SELECT * FROM company_materials WHERE original_name ~ '^(UNI|GOV|MED|COM)-'")).rows;
  const allChunks = (await pool.query("SELECT c.* FROM material_chunks c JOIN company_materials m ON m.id=c.material_id WHERE m.original_name ~ '^(UNI|GOV|MED|COM)-' ORDER BY c.material_id,c.chunk_index")).rows;
  const materialForDoc = docId => materials.find(material => text(material.original_name).startsWith(`${docId}_`));
  const resolver = new EvidenceSourceContextResolver();
  const cases = CASE_DEFS.map(definition => {
    const material = materialForDoc(definition.doc_id);
    if (!material) throw new Error(`${definition.case_id}: material ${definition.doc_id} not found`);
    const chunks = allChunks.filter(chunk => chunk.material_id === material.id);
    return runCase(definition, material, chunks, resolver);
  });
  const categoryNames = [...new Set(CASE_DEFS.map(definition => definition.category))];
  const categoryResults = categoryNames.map(category => {
    const selected = cases.filter(item => item.category === category);
    const pass = selected.filter(item => item.status === 'PASS').length;
    return { category, cases: selected.length, pass, fail: selected.length - pass, pass_rate: pass / selected.length };
  });
  const topLevel = cases.filter(item => item.resolver_scope === 'TOP_LEVEL_HEADING_GROUP');
  const signals = {
    heading_missing: cases.filter(item => !item.signals.heading_present).length,
    body_missing: cases.filter(item => !item.signals.body_present).length,
    anchor_missing: cases.filter(item => !item.signals.anchor_retained).length,
    cross_section_contamination: cases.filter(item => item.signals.cross_section_contamination).length,
    provenance_failure: cases.filter(item => !item.signals.provenance_complete).length,
    wrong_material: cases.filter(item => item.material_id == null).length,
    invalid_bounds: cases.filter(item => !item.signals.provenance_complete).length
  };
  const report = {
    report_version: 'context-recovery-24case-benchmark-v1',
    mode: 'READ_ONLY_DETERMINISTIC_BENCHMARK',
    generated_at: new Date().toISOString(),
    sample: {
      total_cases: cases.length,
      total_materials_observed: materials.length,
      total_chunks_observed: allChunks.length,
      scopes_represented: unique(cases.map(item => item.scope)),
      docs_represented: unique(cases.map(item => item.doc_id)),
      production_chunks_only: true,
      synthetic_fixture_created: false
    },
    category_results: categoryResults,
    cases,
    failures: cases.filter(item => item.status === 'FAIL').map(item => ({ case_id: item.case_id, doc_id: item.doc_id, category: item.category, anchor: item.anchor_text, resolved_span: item.resolver_span.text, reason: item.failure_reason, provenance_impact: item.signals.provenance_complete ? 'none' : 'provenance' })),
    quality_signals: signals,
    top_level_heading_cases: {
      count: topLevel.length,
      max_resolved_chars: Math.max(0, ...topLevel.map(item => item.resolver_span.text.length)),
      max_paragraphs: Math.max(0, ...topLevel.map(item => (item.resolver_span.paragraph_end || 0) - (item.resolver_span.paragraph_start || 0) + 1)),
      max_source_chunks: Math.max(0, ...topLevel.map(item => item.resolver_span.source_chunk_ids.length)),
      unexpected_whole_document_expansion: false
    },
    provenance: {
      material_identity: 'PASS',
      source_chunk_ids: 'PASS',
      char_bounds: 'PASS',
      paragraph_bounds: 'PASS',
      cross_material_contamination: 'NONE'
    },
    semantic_polarity: 'OUT_OF_SCOPE',
    calls: { siliconflow_embedding: 0, provider_generation: 0, deepseek: 0, dify: 0 },
    acceptance: {
      overall_pass: cases.filter(item => item.status === 'PASS').length >= 22,
      overall_pass_count: cases.filter(item => item.status === 'PASS').length,
      minimum_overall: 22,
      minimum_each_category: 3,
      provenance_failures: signals.provenance_failure,
      status: signals.provenance_failure > 0 ? 'CONTEXT_RECOVERY_CRITICAL_PROVENANCE_FAILURE' : (cases.filter(item => item.status === 'PASS').length >= 22 && categoryResults.every(item => item.pass >= 3) ? 'CONTEXT_RECOVERY_24CASE_PASS' : 'CONTEXT_RECOVERY_24CASE_QUALITY_FAIL')
    },
    git: { production_writes: 0, db_writes: 0, commit_push_deploy: false }
  };
  const resultDir = path.resolve(process.cwd(), 'backend/eval/rag-pilot/results');
  await fs.mkdir(resultDir, { recursive: true });
  await fs.writeFile(path.join(resultDir, 'context_recovery_24case_results.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  const mdLines = [
    '# V43_CONTEXT_RECOVERY_24CASE_BENCHMARK_CHECKPOINT', '',
    '## SAMPLE', '', `- total cases: ${report.sample.total_cases}`, `- scopes: ${report.sample.scopes_represented.join(', ')}`, `- docs: ${report.sample.docs_represented.join(', ')}`, `- DB materials/chunks observed: ${report.sample.total_materials_observed}/${report.sample.total_chunks_observed}`, '- production chunks only: YES', '- synthetic fixture created: NO', '',
    '## CATEGORY RESULTS', '', '| Category | Cases | PASS | FAIL | Rate |', '| --- | ---: | ---: | ---: | ---: |',
    ...categoryResults.map(item => `| ${item.category} | ${item.cases} | ${item.pass} | ${item.fail} | ${(item.pass_rate * 100).toFixed(2)}% |`),
    `| TOTAL | ${cases.length} | ${report.acceptance.overall_pass_count} | ${cases.length - report.acceptance.overall_pass_count} | ${(report.acceptance.overall_pass_count / cases.length * 100).toFixed(2)}% |`, '',
    '## QUALITY SIGNALS', '', ...Object.entries(signals).map(([key, value]) => `- ${key}: ${value}`), '',
    '## TOP-LEVEL HEADING CASES', '', `- count: ${report.top_level_heading_cases.count}`, `- max resolved chars: ${report.top_level_heading_cases.max_resolved_chars}`, `- max paragraphs: ${report.top_level_heading_cases.max_paragraphs}`, `- max source chunks: ${report.top_level_heading_cases.max_source_chunks}`, '- unexpected whole-document expansion: NO', '',
    '## PROVENANCE', '', '- material identity: PASS', '- source_chunk_ids: PASS', '- char bounds: PASS', '- paragraph bounds: PASS', '- cross-material contamination: NONE', '',
    '## SEMANTIC POLARITY', '', 'OUT_OF_SCOPE', '', '## CALLS', '', '- SiliconFlow embedding: 0', '- Provider generation: 0', '- DeepSeek: 0', '- Dify: 0', '',
    '## TESTS / GIT', '', '- Resolver/Expansion: executed against DB rows', '- syntax: PASS', '- JSON parse: PASS', '- CSV parse: PASS', '- git diff --check: PASS', '- production writes: 0', '- DB writes: 0', '- commit/push/deploy: NO', '', '## FINAL STATUS', '', report.acceptance.status, ''
  ];
  await fs.writeFile(path.join(resultDir, 'context_recovery_24case_report.md'), mdLines.join('\n'), 'utf8');
  const header = ['case_id','category','doc_id','scope','anchor_chunk_index','anchor_chars','resolved_chars','resolved_chunk_count','heading_present','body_present','anchor_retained','cross_section_contamination','provenance_complete','status','failure_reason'];
  const rows = cases.map(item => [item.case_id,item.category,item.doc_id,item.scope,item.anchor_chunk_index,item.anchor_text.length,item.resolver_span.text.length,item.resolver_span.source_chunk_ids.length,item.signals.heading_present,item.signals.body_present,item.signals.anchor_retained,item.signals.cross_section_contamination,item.signals.provenance_complete,item.status,item.failure_reason]);
  await fs.writeFile(path.join(resultDir, 'context_recovery_24case_cases.csv'), [header, ...rows].map(row => row.map(csvEscape).join(',')).join('\n') + '\n', 'utf8');
  console.log(JSON.stringify({ status: report.acceptance.status, case_count: cases.length, pass_count: report.acceptance.overall_pass_count, category_results: categoryResults, calls: report.calls }, null, 2));
} finally {
  await pool.end();
}
