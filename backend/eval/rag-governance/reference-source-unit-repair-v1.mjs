import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { basename, dirname, extname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractTenderText } from '../../src/tender-text-extractor.js';
import { chunkEnterpriseMaterial, ENTERPRISE_MATERIAL_CHUNKER_VERSION } from '../../src/pipeline/enterprise-material-chunker.js';
import { loadSourceManifest, parseAndPlanSource, stableUuid } from './reference-eval-ingest-v4.mjs';
import { adaptHtmlToSourceText } from './reference-eval-html-adapter.js';
import { prepareCanonicalHtmlSource, sourceUnitRuleSummary, CANONICAL_HTML_SOURCE_UNIT_VERSION } from './reference-source-unit-repair-v1.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const HANDOFF = resolve(ROOT, 'docs/handoff/V43_REFERENCE_SOURCE_UNIT_REPAIR_V1');
const V3_MANIFEST = resolve(ROOT, 'docs/handoff/V43_ISOLATED_REFERENCE_EVAL_DB_REAL_RETRIEVAL_V1/03_PRODUCTION_CORPUS_SNAPSHOT_MANIFEST.json');
const TARGET_HTML = new Set(['H3C-003', 'H3C-004', 'H3C-010', 'H3C-011', 'H3C-012', 'H3C-013']);
const sha256 = value => createHash('sha256').update(value).digest('hex');
const rel = file => relative(ROOT, file).replaceAll('\\', '/');
const isHtml = file => extname(String(file || '')).toLowerCase() === '.html';

function quantile(sorted, q) {
  if (!sorted.length) return null;
  const i = (sorted.length - 1) * q;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}

function excerpt(value, max = 200) {
  return String(value || '').replace(/\s+/gu, ' ').trim().slice(0, max);
}

function classifyFragment(text) {
  const value = String(text || '').trim();
  if (!value) return 'EMPTY';
  if (value.length < 100) return 'LIKELY_FRAGMENT';
  if (/(?:版权所有|copyright|ICP备|备案号)/iu.test(value)) return 'LIKELY_BOILERPLATE';
  if (/(?:^|[|>／/ ])(?:首页|主页|导航|菜单|登录|注册|返回|上一页|下一页|联系我们)(?:$|[|>／/ ])/u.test(value)) return 'LIKELY_NAVIGATION';
  return 'LIKELY_SUBSTANTIVE';
}

function duplicateReport(rows) {
  const groups = new Map();
  for (const row of rows) groups.set(row.chunk_hash, [...(groups.get(row.chunk_hash) || []), row]);
  const duplicateGroups = [...groups.values()].filter(group => group.length > 1);
  const duplicateCount = duplicateGroups.reduce((sum, group) => sum + group.length - 1, 0);
  const across = duplicateGroups.filter(group => new Set(group.map(row => row.source_id)).size > 1);
  const acrossCount = across.reduce((sum, group) => sum + group.length - 1, 0);
  return {
    total_chunk_count: rows.length,
    unique_chunk_hash_count: groups.size,
    exact_duplicate_group_count: duplicateGroups.length,
    exact_duplicate_count: duplicateCount,
    exact_duplicate_rate: rows.length ? Number((duplicateCount / rows.length).toFixed(6)) : 0,
    cross_source_duplicate_group_count: across.length,
    cross_source_duplicate_count: acrossCount,
    cross_source_duplicate_rate: rows.length ? Number((acrossCount / rows.length).toFixed(6)) : 0,
    dedup_applied: false
  };
}

async function writeJson(name, value) {
  await mkdir(HANDOFF, { recursive: true });
  await writeFile(resolve(HANDOFF, name), JSON.stringify(value, null, 2) + '\n', 'utf8');
}

async function buildPlan(entry) {
  const raw = await readFile(entry.local_file);
  if (sha256(raw) !== entry.source_sha256) {
    throw Object.assign(new Error('Frozen source SHA mismatch for ' + entry.source_id), { code: 'BLOCKED_SOURCE_IDENTITY_MISMATCH', source_id: entry.source_id });
  }
  if (!isHtml(entry.local_path) || !TARGET_HTML.has(entry.source_id)) {
    const plan = await parseAndPlanSource(entry);
    return {
      entry,
      raw,
      text_length: plan.normalized_text_length,
      text_sha256: plan.normalized_text_sha256,
      material_id: plan.material_id,
      chunks: plan.chunk_objects,
      source_unit: { source_id: entry.source_id, format: 'PDF', selector: null, canonical_source_unit: 'SINGLE_FROZEN_PDF_FILE', source_sha256: plan.source_sha256, canonical_text_sha256: plan.normalized_text_sha256, canonical_text_chars: plan.normalized_text_length }
    };
  }
  const prepared = prepareCanonicalHtmlSource({ sourceId: entry.source_id, rawHtml: raw.toString('utf8') });
  const input = Buffer.from(prepared.source_text, 'utf8');
  const extraction = await extractTenderText({ fileName: entry.source_id + '.md', mimeType: 'text/markdown', buffer: input });
  const text = String(extraction.text || '');
  if (!text.trim()) throw Object.assign(new Error('Canonical source text is empty for ' + entry.source_id), { code: 'BLOCKED_SOURCE_PARSE_EMPTY', source_id: entry.source_id });
  const materialId = stableUuid(entry.source_id + '|' + entry.source_sha256 + '|' + CANONICAL_HTML_SOURCE_UNIT_VERSION);
  const chunks = chunkEnterpriseMaterial(materialId, text);
  if (!chunks.length) throw Object.assign(new Error('Canonical source produced no chunks for ' + entry.source_id), { code: 'BLOCKED_PRODUCTION_CHUNK_CONTRACT_NOT_REUSABLE', source_id: entry.source_id });
  return {
    entry,
    raw,
    text_length: text.length,
    text_sha256: sha256(text),
    material_id: materialId,
    chunks,
    source_unit: {
      ...prepared,
      source_sha256: entry.source_sha256,
      source_file: rel(entry.local_file),
      canonical_text_path: rel(resolve(HANDOFF, 'canonical-sources', entry.source_id + '.txt'))
    }
  };
}

async function build() {
  const { entries } = await loadSourceManifest();
  await mkdir(resolve(HANDOFF, 'canonical-sources'), { recursive: true });
  const plans = [];
  for (const entry of entries) {
    const plan = await buildPlan(entry);
    plans.push(plan);
    if (plan.source_unit.source_text) {
      await writeFile(resolve(HANDOFF, 'canonical-sources', entry.source_id + '.txt'), plan.source_unit.source_text, 'utf8');
      await writeFile(resolve(HANDOFF, 'canonical-sources', entry.source_id + '.html'), plan.source_unit.canonical_html, 'utf8');
    }
  }
  const allChunks = plans.flatMap(plan => plan.chunks.map(chunk => ({ source_id: plan.entry.source_id, ...chunk })));
  const targetRows = plans.filter(plan => TARGET_HTML.has(plan.entry.source_id)).map(plan => plan.source_unit);
  const perSource = plans.map(plan => {
    const lengths = plan.chunks.map(chunk => chunk.source_text.length).sort((a, b) => a - b);
    const under100 = lengths.filter(value => value < 100).length;
    return {
      source_id: plan.entry.source_id,
      source_file: rel(plan.entry.local_file),
      format: isHtml(plan.entry.local_path) ? 'HTML' : 'PDF',
      source_sha256: plan.entry.source_sha256,
      canonical_source_unit: plan.source_unit.canonical_source_unit,
      selector: plan.source_unit.selector || null,
      parsed_substantive_chars: plan.text_length,
      normalized_text_sha256: plan.text_sha256,
      planned_chunks: lengths.length,
      median_chunk_length: quantile(lengths, 0.5),
      p95_chunk_length: quantile(lengths, 0.95),
      under_100_char_share: lengths.length ? Number((under100 / lengths.length).toFixed(6)) : 0,
      min_chunk_length: lengths[0] || 0,
      max_chunk_length: lengths[lengths.length - 1] || 0
    };
  });
  const duplicate = duplicateReport(allChunks);
  const htmlChunks = allChunks.filter(row => TARGET_HTML.has(row.source_id));
  const htmlClassCounts = Object.fromEntries(['LIKELY_SUBSTANTIVE', 'LIKELY_NAVIGATION', 'LIKELY_BOILERPLATE', 'LIKELY_FRAGMENT', 'EMPTY'].map(key => [key, 0]));
  for (const row of htmlChunks) htmlClassCounts[classifyFragment(row.source_text)] += 1;
  const requirementLeakageScan = plans.map(plan => ({
    source_id: plan.entry.source_id,
    tender_id_tokens: (plan.chunks.map(chunk => chunk.source_text).join('\n').match(/(?:JY-001|TB-003|TB-006|FAST-01|FAST-04|FAST-WATER-01)/gu) || []).length,
    req_id_tokens: (plan.chunks.map(chunk => chunk.source_text).join('\n').match(/\bREQ[-_][A-Z0-9-]+/giu) || []).length,
    mapping_label_tokens: (plan.chunks.map(chunk => chunk.source_text).join('\n').match(/\b(?:SOLUTION|EVIDENCE|COMMITMENT|COMPLIANCE)\b/gu) || []).length
  }));
  const totalChunks = allChunks.length;
  const baselineBytes = await readFile(V3_MANIFEST);
  const baseline = JSON.parse(baselineBytes.toString('utf8'));
  const baselineSha = sha256(baselineBytes);
  const checkpoint = {
    artifact_type: 'V43_REFERENCE_SOURCE_UNIT_REPAIR_V1_CHECKPOINT',
    status: 'BLOCKED_SOURCE_INPUT_UNIT_NOT_COMPARABLE',
    review_status: 'READY_FOR_GPT_REFERENCE_SOURCE_UNIT_REPAIR_REVIEW',
    source_unit_repair: {
      target_source_count: TARGET_HTML.size,
      target_source_ids: [...TARGET_HTML],
      selectors_unique_and_resolved: targetRows.length === TARGET_HTML.size,
      ambiguity_count: targetRows.filter(row => row.ambiguity).length,
      mechanical_exclusion_only: targetRows.every(row => row.exclusions?.mechanical_only === true),
      status: targetRows.length === TARGET_HTML.size ? 'PASS_MECHANICAL_PREPARATION' : 'BLOCKED',
      semantic_selection_used: false,
      requirement_query_used: false,
      tender_id_used: false
    },
    input_unit_parity: {
      production_chunker_parity: 'PASS',
      input_unit_parity: targetRows.length === TARGET_HTML.size ? 'MECHANICALLY_ESTABLISHED' : 'NOT_ESTABLISHED',
      non_comparable_source_ids: targetRows.length === TARGET_HTML.size ? [] : [...TARGET_HTML].filter(id => !targetRows.some(row => row.source_id === id)),
      canonical_unit_rule: 'one unique structural main-content container per H3C source; no semantic/manual selection'
    },
    corpus: {
      source_count: plans.length,
      html_source_count: plans.filter(plan => isHtml(plan.entry.local_path)).length,
      pdf_source_count: plans.filter(plan => !isHtml(plan.entry.local_path)).length,
      total_planned_chunks: totalChunks,
      html_planned_chunks: htmlChunks.length,
      html_fragment_share: totalChunks ? Number((htmlClassCounts.LIKELY_FRAGMENT / htmlChunks.length).toFixed(6)) : 0,
      html_classification_counts: htmlClassCounts,
      per_source: perSource
    },
    duplication: duplicate,
    baseline_v3: {
      manifest_path: rel(V3_MANIFEST),
      manifest_sha256: baselineSha,
      materials: Number(baseline.counts?.materials || 0),
      chunks: Number(baseline.counts?.chunks || 0),
      lengths_available: Array.isArray(baseline.chunks) && baseline.chunks.some(row => Number.isInteger(row.source_text_length))
    },
    source_independence: {
      source_snapshots_reused: true,
      source_bytes_modified: false,
      requirement_queries_used: false,
      content_generated: false,
      source_role_unchanged: true,
      requirement_blind_scan: requirementLeakageScan,
      requirement_leakage_total: requirementLeakageScan.reduce((sum, row) => sum + row.tender_id_tokens + row.req_id_tokens, 0)
    },
    side_effects: {
      provider_calls: 0,
      embedding_calls: 0,
      db_writes: 0,
      production_db_writes: 0,
      fact_actions: 0,
      mapping_actions: 0,
      claim_actions: 0,
      writer_actions: 0,
      source_mutations: 0,
      chunker_mutations: 0,
      dedup_mutations: 0,
      commit: 0,
      push: 0,
      merge: 0,
      deploy: 0
    },
    next_gate: 'GPT_REVIEW_BEFORE_HOST_EMBEDDING'
  };
  await writeJson('00_EXECUTION_MANIFEST.json', {
    artifact_type: 'V43_REFERENCE_SOURCE_UNIT_REPAIR_V1_EXECUTION_MANIFEST',
    mode: 'OFFLINE_READ_ONLY',
    source_manifest: 'docs/handoff/V43_REFERENCE_EVAL_INGEST_HARNESS_V1/02_SOURCE_IDENTITY_MANIFEST.json',
    target_source_ids: [...TARGET_HTML],
    preparation_version: CANONICAL_HTML_SOURCE_UNIT_VERSION,
    production_chunker: 'backend/src/pipeline/enterprise-material-chunker.js::chunkEnterpriseMaterial',
    no_embedding: true,
    no_provider: true,
    no_db_write: true,
    rule_summary: sourceUnitRuleSummary()
  });
  await writeJson('01_SOURCE_UNIT_RESOLUTION.json', {
    artifact_type: 'V43_CANONICAL_SOURCE_UNIT_RESOLUTION',
    mechanical_only: true,
    rows: targetRows.map(row => {
      const copy = { ...row };
      delete copy.source_text;
      delete copy.canonical_html;
      return copy;
    })
  });
  await writeJson('02_CANONICAL_SOURCE_PARSE.json', {
    artifact_type: 'V43_CANONICAL_SOURCE_PARSE',
    parser: 'backend/src/tender-text-extractor.js::extractTenderText',
    rows: perSource,
    parser_status: perSource.every(row => row.parsed_substantive_chars > 0) ? 'PASS' : 'BLOCKED'
  });
  await writeJson('03_CANONICAL_CHUNK_PLAN.json', {
    artifact_type: 'V43_CANONICAL_CHUNK_PLAN',
    chunker: 'backend/src/pipeline/enterprise-material-chunker.js::chunkEnterpriseMaterial',
    chunker_version: ENTERPRISE_MATERIAL_CHUNKER_VERSION,
    total_chunks: totalChunks,
    rows: allChunks.map(row => ({
      source_id: row.source_id,
      material_id: row.material_id,
      chunk_id: row.chunk_id,
      chunk_index: row.chunk_index,
      chunk_hash: row.chunk_hash,
      source_text_sha256: sha256(row.source_text),
      source_text_length: row.source_text.length,
      char_start: row.char_start,
      char_end: row.char_end,
      chunker_version: row.chunker_version
    }))
  });
  await writeJson('04_CANONICAL_CONTAMINATION_AUDIT.json', {
    artifact_type: 'V43_CANONICAL_SOURCE_CONTAMINATION_AUDIT',
    mechanical_only: true,
    html_chunk_classification_counts: htmlClassCounts,
    raw_html_tag_counts: Object.fromEntries(targetRows.map(row => [row.source_id, {
      selected_html_chars: row.selection.selected_html_chars,
      selected_html_sha256: row.selection.selected_html_sha256,
      canonical_html_sha256: row.canonical_html_sha256,
      excluded_element_count: row.exclusions.removed_element_count,
      excluded_tags: row.exclusions.removed_tags
    }]))
  });
  await writeJson('06_POST_REPAIR_CHUNK_MASS_PREFLIGHT.json', {
    artifact_type: 'V43_POST_REPAIR_CHUNK_MASS_PREFLIGHT',
    status: checkpoint.status,
    review_status: checkpoint.review_status,
    total_planned_chunks: totalChunks,
    per_source: perSource,
    exact_duplicate_rate: duplicate.exact_duplicate_rate,
    cross_source_duplicate_rate: duplicate.cross_source_duplicate_rate,
    html_fragment_share: checkpoint.corpus.html_fragment_share,
    input_unit_parity: checkpoint.input_unit_parity,
    no_dedup_applied: true
  });
  await writeJson('05_CHECKPOINT.json', checkpoint);
  await writeFile(resolve(HANDOFF, '05_CHECKPOINT.md'), [
    '# V43 Reference Source Unit Repair V1',
    '',
    'Status: ' + checkpoint.status,
    '',
    'Six H3C HTML snapshots were resolved using unique structural selectors and mechanical chrome exclusions only.',
    '',
    'Production chunker parity: PASS. Input-unit parity: ' + checkpoint.input_unit_parity.input_unit_parity + '.',
    '',
    'No embedding, Provider, DB, source, chunker, dedup, RAG, Git, or deployment side effects were performed.',
    '',
    'This is an Eval-only source preparation and chunk-mass diagnostic; GPT review is required before Host embedding.'
  ].join('\n'), 'utf8');
  console.log(JSON.stringify(checkpoint, null, 2));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  build().catch(error => {
    console.error(JSON.stringify({ status: error.code || 'BLOCKED_REFERENCE_SOURCE_UNIT_REPAIR', error: String(error.message || error), provider_calls: 0, embedding_calls: 0, db_writes: 0 }, null, 2));
    process.exitCode = 1;
  });
}

export { build, buildPlan };
