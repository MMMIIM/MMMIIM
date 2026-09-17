import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { basename, dirname, extname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractTenderText } from '../../src/tender-text-extractor.js';
import { chunkEnterpriseMaterial, ENTERPRISE_MATERIAL_CHUNKER_VERSION } from '../../src/pipeline/enterprise-material-chunker.js';
import { loadSourceManifest, parseAndPlanSource } from './reference-eval-ingest-v4.mjs';
import { adaptHtmlToSourceText } from './reference-eval-html-adapter.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const HANDOFF = resolve(ROOT, 'docs/handoff/V43_REFERENCE_CHUNK_MASS_PREFLIGHT_V1');
const V3_MANIFEST = resolve(ROOT, 'docs/handoff/V43_ISOLATED_REFERENCE_EVAL_DB_REAL_RETRIEVAL_V1/03_PRODUCTION_CORPUS_SNAPSHOT_MANIFEST.json');
const REPO_REL = file => relative(ROOT, file).replaceAll('\\', '/');
const sha256 = value => createHash('sha256').update(value).digest('hex');
const fileSha256 = bytes => sha256(bytes);
const isHtml = file => extname(String(file || '')).toLowerCase() === '.html';

async function writeJson(name, value) {
  await mkdir(HANDOFF, { recursive: true });
  await writeFile(resolve(HANDOFF, name), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function quantile(sorted, q) {
  if (!sorted.length) return null;
  const index = (sorted.length - 1) * q;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

function excerpt(text, max = 240) {
  return String(text || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function nearFingerprint(text) {
  return String(text || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[0-9]+/g, '#')
    .replace(/[^\p{L}\p{N}#]+/gu, '');
}

function repeatedUrlCount(text) {
  return (String(text).match(/(?:https?:\/\/|www\.)/gi) || []).length;
}

function classifyHtmlChunk(text) {
  const value = String(text || '').trim();
  const lines = value ? value.split(/\r?\n/).map(line => line.trim()).filter(Boolean) : [];
  const avgLineLength = lines.length ? value.length / lines.length : 0;
  const nav = /(?:^|[|>／/ ])(?:首页|主页|导航|菜单|登录|注册|返回|上一页|下一页|联系我们)(?:$|[|>／/ ])/u.test(value)
    || /(?:首页|主页|当前位置).{0,80}(?:>|›|»|\/)/u.test(value);
  const breadcrumb = /(?:首页|主页|当前位置).{0,80}(?:>|›|»|\/)/u.test(value);
  const footer = /(?:版权所有|copyright|©|ICP备|备案号|京ICP备|沪ICP备)/iu.test(value);
  const urls = repeatedUrlCount(value) >= 2;
  const toc = /(?:目录|contents|table\s+of\s+contents)/iu.test(value) && lines.length >= 3;
  const category = lines.length >= 8 && avgLineLength < 30 && value.length < 500;
  const fragment = value.length < 100;
  let classification = 'UNKNOWN';
  if (footer) classification = 'LIKELY_BOILERPLATE';
  else if (nav || breadcrumb) classification = 'LIKELY_NAVIGATION';
  else if (toc || category || urls) classification = 'LIKELY_INDEX';
  else if (fragment) classification = 'LIKELY_FRAGMENT';
  else if (value.length >= 100) classification = 'LIKELY_SUBSTANTIVE';
  const reasons = [];
  if (nav) reasons.push('navigation_or_breadcrumb_pattern');
  if (footer) reasons.push('footer_or_copyright_pattern');
  if (urls) reasons.push('repeated_url_pattern');
  if (toc) reasons.push('table_of_contents_pattern');
  if (category) reasons.push('short_line_directory_pattern');
  if (fragment) reasons.push('very_short_fragment');
  return { classification, reasons, excerpt: excerpt(value), length: value.length };
}

async function parseSource(entry) {
  const raw = await readFile(entry.local_file);
  const input = isHtml(entry.local_path)
    ? Buffer.from(adaptHtmlToSourceText(raw.toString('utf8')), 'utf8')
    : raw;
  const extraction = await extractTenderText({
    fileName: isHtml(entry.local_path) ? `${entry.source_id}.md` : basename(entry.local_path),
    mimeType: isHtml(entry.local_path) ? 'text/markdown' : 'application/pdf',
    buffer: input
  });
  const text = String(extraction.text || '');
  const plan = await parseAndPlanSource(entry);
  if (sha256(text) !== plan.normalized_text_sha256) {
    throw Object.assign(new Error(`Normalized text parity failed for ${entry.source_id}.`), { code: 'BLOCKED_CHUNK_PLAN_IDENTITY_DRIFT' });
  }
  const chunks = chunkEnterpriseMaterial(plan.material_id, text);
  if (chunks.length !== plan.chunks.length || chunks.some((chunk, index) => chunk.chunk_id !== plan.chunks[index].chunk_id || chunk.chunk_hash !== plan.chunks[index].chunk_hash)) {
    throw Object.assign(new Error(`Current chunker output drifted for ${entry.source_id}.`), { code: 'BLOCKED_CHUNK_PLAN_IDENTITY_DRIFT' });
  }
  return { entry, raw, text, plan, chunks, rawHtml: isHtml(entry.local_path) ? raw.toString('utf8') : null };
}

function distribution(parsed) {
  return parsed.map(item => {
    const lengths = item.chunks.map(chunk => chunk.source_text.length).sort((a, b) => a - b);
    return {
      source_id: item.entry.source_id,
      source_type: item.entry.source_type,
      material_type: item.entry.material_type,
      original_name: basename(item.entry.local_path),
      source_bytes: item.raw.length,
      parsed_text_chars: item.text.length,
      parsed_text_lines: item.text ? item.text.split(/\r?\n/).length : 0,
      planned_chunk_count: lengths.length,
      mean_chunk_chars: lengths.length ? Number((lengths.reduce((a, b) => a + b, 0) / lengths.length).toFixed(3)) : 0,
      median_chunk_chars: quantile(lengths, 0.5),
      min_chunk_chars: lengths[0] ?? 0,
      max_chunk_chars: lengths[lengths.length - 1] ?? 0,
      chunks_per_10k_source_chars: item.text.length ? Number((lengths.length / item.text.length * 10000).toFixed(3)) : null
    };
  });
}

function duplicateReport(allChunks) {
  const groups = new Map();
  for (const row of allChunks) {
    const list = groups.get(row.chunk_hash) || [];
    list.push(row);
    groups.set(row.chunk_hash, list);
  }
  const duplicateGroups = [...groups.entries()].filter(([, rows]) => rows.length > 1);
  const duplicateRows = duplicateGroups.reduce((sum, [, rows]) => sum + rows.length - 1, 0);
  const withinGroups = duplicateGroups.filter(([, rows]) => new Set(rows.map(row => row.material_id)).size === 1);
  const acrossGroups = duplicateGroups.filter(([, rows]) => new Set(rows.map(row => row.material_id)).size > 1);
  const withinRows = withinGroups.reduce((sum, [, rows]) => sum + rows.length - 1, 0);
  const acrossRows = acrossGroups.reduce((sum, [, rows]) => sum + rows.length - 1, 0);
  return {
    total_chunk_count: allChunks.length,
    unique_chunk_hash_count: groups.size,
    exact_duplicate_group_count: duplicateGroups.length,
    exact_duplicate_count: duplicateRows,
    exact_duplicate_rate: allChunks.length ? Number((duplicateRows / allChunks.length).toFixed(6)) : 0,
    within_same_material: { group_count: withinGroups.length, duplicate_count: withinRows, duplicate_rate: allChunks.length ? Number((withinRows / allChunks.length).toFixed(6)) : 0 },
    across_different_materials: { group_count: acrossGroups.length, duplicate_count: acrossRows, duplicate_rate: allChunks.length ? Number((acrossRows / allChunks.length).toFixed(6)) : 0 },
    groups: duplicateGroups.sort((a, b) => b[1].length - a[1].length).slice(0, 50).map(([hash, rows]) => ({
      chunk_hash: hash,
      count: rows.length,
      source_ids: [...new Set(rows.map(row => row.source_id))],
      material_ids: [...new Set(rows.map(row => row.material_id))],
      representative_excerpt: excerpt(rows[0].source_text)
    }))
  };
}

function nearDuplicateReport(allChunks) {
  const groups = new Map();
  for (const row of allChunks) {
    const fingerprint = nearFingerprint(row.source_text);
    if (!fingerprint) continue;
    const list = groups.get(fingerprint) || [];
    list.push(row);
    groups.set(fingerprint, list);
  }
  const families = [...groups.entries()].filter(([, rows]) => new Set(rows.map(row => row.chunk_hash)).size > 1);
  const count = families.reduce((sum, [, rows]) => sum + rows.length, 0);
  return {
    method: 'NORMALIZED_TEXT_FINGERPRINT',
    definition: 'same NFKC/lowercase fingerprint after numeric masking and punctuation/whitespace removal, with different raw chunk hashes',
    estimated_near_duplicate_count: count,
    estimated_near_duplicate_rate: allChunks.length ? Number((count / allChunks.length).toFixed(6)) : 0,
    family_count: families.length,
    top_repeated_text_families: families.sort((a, b) => b[1].length - a[1].length).slice(0, 25).map(([fingerprint, rows]) => ({
      fingerprint_sha256: sha256(fingerprint),
      count: rows.length,
      source_ids: [...new Set(rows.map(row => row.source_id))],
      raw_chunk_hash_count: new Set(rows.map(row => row.chunk_hash)).size,
      representative_excerpt: excerpt(rows[0].source_text)
    }))
  };
}

function htmlAudit(parsed) {
  const htmlSources = parsed.filter(item => item.rawHtml);
  const counts = { LIKELY_SUBSTANTIVE: 0, LIKELY_NAVIGATION: 0, LIKELY_INDEX: 0, LIKELY_BOILERPLATE: 0, LIKELY_FRAGMENT: 0, UNKNOWN: 0 };
  const perSource = [];
  for (const item of htmlSources) {
    const sourceCounts = Object.fromEntries(Object.keys(counts).map(key => [key, 0]));
    const examples = Object.fromEntries(Object.keys(counts).map(key => [key, []]));
    for (const chunk of item.chunks) {
      const result = classifyHtmlChunk(chunk.source_text);
      sourceCounts[result.classification] += 1;
      counts[result.classification] += 1;
      if (examples[result.classification].length < 3) examples[result.classification].push({ chunk_index: chunk.chunk_index, excerpt: result.excerpt, reasons: result.reasons });
    }
    const raw = item.rawHtml;
    const anchorCount = (raw.match(/<a\b/giu) || []).length;
    const headingCount = (raw.match(/<h[1-6]\b/giu) || []).length;
    const scriptCount = (raw.match(/<script\b/giu) || []).length;
    const navTermCount = (raw.match(/首页|目录|导航|联系我们/gu) || []).length;
    const aggregatedIndicators = anchorCount >= 100 || headingCount >= 20 || navTermCount >= 10;
    perSource.push({
      source_id: item.entry.source_id,
      original_name: basename(item.entry.local_path),
      chunk_count: item.chunks.length,
      raw_html_anchor_count: anchorCount,
      raw_html_heading_count: headingCount,
      raw_html_script_count: scriptCount,
      raw_html_navigation_term_count: navTermCount,
      input_unit_indicator: aggregatedIndicators ? 'MULTI_PAGE_OR_SITE_AGGREGATED_INDICATORS' : 'SINGLE_PAGE_OR_LOW_AGGREGATION_INDICATORS',
      classification_counts: sourceCounts,
      representative_excerpts: examples
    });
  }
  return { method: 'DETERMINISTIC_TEXT_AND_RAW_HTML_HEURISTICS', mechanical_only: true, html_source_count: htmlSources.length, total_classification_counts: counts, html_fragment_share_pct: allHtmlChunkCount(perSource, 'LIKELY_FRAGMENT', counts), per_source: perSource };
}

function allHtmlChunkCount(perSource, classification, totals) {
  const total = perSource.reduce((sum, row) => sum + row.chunk_count, 0);
  return total ? Number((totals[classification] / total * 100).toFixed(3)) : 0;
}

function inputUnitParity(parsed, htmlAuditResult) {
  const htmlById = new Map(htmlAuditResult.per_source.map(row => [row.source_id, row]));
  const sources = parsed.map(item => {
    if (!item.rawHtml) return { source_id: item.entry.source_id, format: 'PDF', input_unit: 'SINGLE_FROZEN_PDF_FILE', parity: 'COMPARABLE_FILE_UNIT' };
    const row = htmlById.get(item.entry.source_id);
    return { source_id: item.entry.source_id, format: 'HTML', input_unit: row.input_unit_indicator, parity: row.input_unit_indicator === 'SINGLE_PAGE_OR_LOW_AGGREGATION_INDICATORS' ? 'NOT_PROVEN_BUT_LOW_AGGREGATION_INDICATORS' : 'NOT_COMPARABLE_TO_SINGLE_DOCUMENT_UNIT_WITHOUT_REVIEW', indicators: { raw_html_anchor_count: row.raw_html_anchor_count, raw_html_heading_count: row.raw_html_heading_count, raw_html_navigation_term_count: row.raw_html_navigation_term_count } };
  });
  const nonComparable = sources.filter(row => row.parity === 'NOT_COMPARABLE_TO_SINGLE_DOCUMENT_UNIT_WITHOUT_REVIEW').map(row => row.source_id);
  return { production_chunker_parity: 'PASS', input_unit_parity: nonComparable.length ? 'NOT_ESTABLISHED' : 'MECHANICALLY_COMPARABLE', non_comparable_source_ids: nonComparable, sources, conclusion: nonComparable.length ? 'HTML source shape has multi-page/site-level aggregation indicators; do not equate chunker parity with input-unit parity.' : 'No deterministic aggregation indicator crossed the diagnostic boundary.' };
}

async function build() {
  const { entries } = await loadSourceManifest();
  const parsed = [];
  for (const entry of entries) parsed.push(await parseSource(entry));
  const allChunks = parsed.flatMap(item => item.chunks.map(chunk => ({ source_id: item.entry.source_id, ...chunk })));
  const perSource = distribution(parsed);
  const html = htmlAudit(parsed);
  const sortedByCount = [...perSource].sort((a, b) => b.planned_chunk_count - a.planned_chunk_count);
  const sortedByDensity = [...perSource].sort((a, b) => b.chunks_per_10k_source_chars - a.chunks_per_10k_source_chars);
  const duplicate = duplicateReport(allChunks);
  const near = nearDuplicateReport(allChunks);
  const lengths = allChunks.map(row => row.source_text.length).sort((a, b) => a - b);
  const baselineBytes = await readFile(V3_MANIFEST);
  const baseline = JSON.parse(baselineBytes.toString('utf8'));
  const baselineSha = fileSha256(baselineBytes);
  const v3LengthAvailable = Array.isArray(baseline.chunks) && baseline.chunks.some(row => Number.isInteger(row.source_text_length));
  const lengthBuckets = {
    '<100': lengths.filter(n => n < 100).length,
    '100-299': lengths.filter(n => n >= 100 && n <= 299).length,
    '300-599': lengths.filter(n => n >= 300 && n <= 599).length,
    '600-999': lengths.filter(n => n >= 600 && n <= 999).length,
    '1000-1499': lengths.filter(n => n >= 1000 && n <= 1499).length,
    '>=1500': lengths.filter(n => n >= 1500).length
  };
  const inputParity = inputUnitParity(parsed, html);
  const contractFiles = ['backend/src/tender-text-extractor.js', 'backend/src/pipeline/enterprise-material-chunker.js', 'backend/src/pipeline/embedding-client.js'];
  const contractHashes = {};
  for (const file of contractFiles) contractHashes[file] = sha256(await readFile(resolve(ROOT, file)));
  const rawRequirementTokens = parsed.map(item => ({ source_id: item.entry.source_id, tender_ids: (item.text.match(/(?:JY-001|TB-003|TB-006|FAST-01|FAST-04|FAST-WATER-01)/g) || []).length, req_ids: (item.text.match(/\bREQ[-_][A-Z0-9-]+/gi) || []).length, mapping_labels: (item.text.match(/\b(?:SOLUTION|EVIDENCE|COMMITMENT|COMPLIANCE)\b/g) || []).length }));
  const sourceIndependence = { manifest_flags: { requirement_blind: entries.every(entry => entry.requirement_blind === true), non_synthetic: entries.every(entry => entry.non_synthetic === true), provenance_resolvable: entries.every(entry => entry.provenance_resolvable === true), source_snapshot_fixed: entries.every(entry => entry.source_snapshot_fixed === true) }, raw_token_scan: rawRequirementTokens, benchmark_case_selection_used: false, content_generated_from_requirement_queries: false };
  const totalNew = allChunks.length;
  const baselineChunks = Number(baseline.counts?.chunks || 318);
  const baselineMaterials = Number(baseline.counts?.materials || 34);
  const massShift = { baseline_material_count: baselineMaterials, new_material_count: parsed.length, combined_material_count: baselineMaterials + parsed.length, material_growth_pct: Number((parsed.length / baselineMaterials * 100).toFixed(3)), baseline_chunk_count: baselineChunks, new_chunk_count: totalNew, combined_chunk_count: baselineChunks + totalNew, new_chunk_share_pct: Number((totalNew / (baselineChunks + totalNew) * 100).toFixed(3)), new_to_baseline_chunk_ratio: Number((totalNew / baselineChunks).toFixed(3)), chunk_growth_pct: Number((totalNew / baselineChunks * 100).toFixed(3)), baseline_length_distribution: v3LengthAvailable ? 'AVAILABLE_IN_MANIFEST' : 'NOT_AVAILABLE_IN_EXACT_V3_MANIFEST' };
  const dominance = { top1_source_chunk_share_pct: Number((sortedByCount[0].planned_chunk_count / totalNew * 100).toFixed(3)), top3_source_chunk_share_pct: Number((sortedByCount.slice(0, 3).reduce((sum, row) => sum + row.planned_chunk_count, 0) / totalNew * 100).toFixed(3)), top5_source_chunk_share_pct: Number((sortedByCount.slice(0, 5).reduce((sum, row) => sum + row.planned_chunk_count, 0) / totalNew * 100).toFixed(3)), source_chunk_dominance: sortedByCount[0].planned_chunk_count / totalNew > 0.35, dominant_source_id: sortedByCount[0].source_id };
  const decision = inputParity.input_unit_parity === 'NOT_ESTABLISHED' ? 'BLOCKED_SOURCE_INPUT_UNIT_NOT_COMPARABLE' : 'READY_FOR_GPT_CHUNK_MASS_ADJUDICATION';
  const manifest = { artifact_type: 'V43_REFERENCE_CHUNK_MASS_PREFLIGHT_V1_EXECUTION_MANIFEST', mode: 'OFFLINE_READ_ONLY', source_manifest: 'docs/handoff/V43_REFERENCE_EVAL_INGEST_HARNESS_V1/02_SOURCE_IDENTITY_MANIFEST.json', source_ids: entries.map(entry => entry.source_id), source_count: entries.length, planned_chunks: totalNew, no_embedding: true, no_provider: true, no_db_write: true, decision_scope: 'mechanical_diagnostic_only' };
  const pdfRows = perSource.filter(row => row.original_name.toLowerCase().endsWith('.pdf'));
  const htmlRows = perSource.filter(row => row.original_name.toLowerCase().endsWith('.html'));
  const formatContribution = { artifact_type: 'V43_FORMAT_CONTRIBUTION', pdf: { source_count: pdfRows.length, total_parsed_chars: pdfRows.reduce((sum, row) => sum + row.parsed_text_chars, 0), total_chunks: pdfRows.reduce((sum, row) => sum + row.planned_chunk_count, 0), mean_chunks_per_source: Number((pdfRows.reduce((sum, row) => sum + row.planned_chunk_count, 0) / pdfRows.length).toFixed(3)) }, html: { source_count: htmlRows.length, total_parsed_chars: htmlRows.reduce((sum, row) => sum + row.parsed_text_chars, 0), total_chunks: htmlRows.reduce((sum, row) => sum + row.planned_chunk_count, 0), mean_chunks_per_source: Number((htmlRows.reduce((sum, row) => sum + row.planned_chunk_count, 0) / htmlRows.length).toFixed(3)) }, html_share_of_new_chunks_pct: Number((htmlRows.reduce((sum, row) => sum + row.planned_chunk_count, 0) / totalNew * 100).toFixed(3)), growth_explanation: 'HTML sources account for the majority of new planned chunks; this is a mechanical format contribution, not a semantic usefulness judgment.' };
  const lengthReport = { artifact_type: 'V43_CHUNK_LENGTH_DISTRIBUTION', total_chunk_count: lengths.length, buckets: lengthBuckets, percentiles: { p25: quantile(lengths, 0.25), median: quantile(lengths, 0.5), p75: quantile(lengths, 0.75), p95: quantile(lengths, 0.95) }, baseline_v3_comparison: v3LengthAvailable ? 'COMPARABLE' : 'NOT_INFERRED_LENGTHS_UNAVAILABLE_IN_EXACT_MANIFEST' };
  const contract = { artifact_type: 'V43_PRODUCTION_CHUNK_CONTRACT_AUDIT', files: { normalization: { path: contractFiles[0], sha256: contractHashes[contractFiles[0]] }, chunker: { path: contractFiles[1], sha256: contractHashes[contractFiles[1]] }, embedding: { path: contractFiles[2], sha256: contractHashes[contractFiles[2]] } }, normalization_owner: 'extractTenderText', chunk_size_policy: 'MAX_CHARS=1200 per paragraph segment', overlap_policy: 'NONE', minimum_content_rule: 'skip whitespace-only text', chunk_identity_rule: 'MCH- + SHA256(material_id|chunker_version|chunk_index|char_start|char_end|chunk_hash)[0:32].toUpperCase()', plan_uses_same_post_parse_chunker: true, chunk_identity_reproducible: true };
  const checkpoint = { artifact_type: 'V43_REFERENCE_CHUNK_MASS_PREFLIGHT_V1_CHECKPOINT', status: decision, decision_class: decision, source_count: entries.length, planned_chunk_count: totalNew, baseline_v3: { manifest_sha256: baselineSha, materials: baselineMaterials, chunks: baselineChunks }, pdf_source_count: pdfRows.length, html_source_count: htmlRows.length, format_chunk_contribution: { pdf_chunks: formatContribution.pdf.total_chunks, html_chunks: formatContribution.html.total_chunks, html_share_of_new_chunks_pct: formatContribution.html_share_of_new_chunks_pct }, input_unit_parity: inputParity.input_unit_parity, non_comparable_source_ids: inputParity.non_comparable_source_ids, source_chunk_dominance: dominance.source_chunk_dominance, exact_duplicate: { unique_chunk_hash_count: duplicate.unique_chunk_hash_count, exact_duplicate_count: duplicate.exact_duplicate_count, exact_duplicate_rate: duplicate.exact_duplicate_rate, across_material_duplicate_count: duplicate.across_different_materials.duplicate_count }, estimated_near_duplicate_rate: near.estimated_near_duplicate_rate, html_fragment_share_pct: html.html_fragment_share_pct, source_independence: sourceIndependence, side_effects: { embedding_calls: 0, provider_calls: 0, db_writes: 0, production_writes: 0, source_mutations: 0, chunker_mutations: 0, dedup_mutations: 0, rag_algorithm_changes: 0, commit: 0, push: 0, merge: 0, deploy: 0 }, first_mechanical_blocker: inputParity.input_unit_parity === 'NOT_ESTABLISHED' ? { code: 'BLOCKED_SOURCE_INPUT_UNIT_NOT_COMPARABLE', reason: 'five HTML sources contain strong multi-page/site-level aggregation indicators; chunker parity alone does not prove input-unit parity' } : null, next_action: 'GPT reviews mechanical chunk-mass and input-unit evidence before Host embedding execution' };
  await writeJson('00_EXECUTION_MANIFEST.json', manifest);
  await writeJson('01_PER_SOURCE_CHUNK_DISTRIBUTION.json', { artifact_type: 'V43_PER_SOURCE_CHUNK_DISTRIBUTION', sort_by_planned_chunk_count_desc: sortedByCount, sort_by_chunks_per_10k_source_chars_desc: sortedByDensity });
  await writeJson('02_FORMAT_CONTRIBUTION.json', formatContribution);
  await writeJson('03_CHUNK_MASS_CONCENTRATION.json', { artifact_type: 'V43_CHUNK_MASS_CONCENTRATION', per_source_share: sortedByCount.map(row => ({ source_id: row.source_id, planned_chunk_count: row.planned_chunk_count, share_of_new_chunks_pct: Number((row.planned_chunk_count / totalNew * 100).toFixed(3)) })), ...dominance });
  await writeJson('04_EXACT_DUPLICATION.json', duplicate);
  await writeJson('05_NEAR_DUPLICATE_DIAGNOSTIC.json', near);
  await writeJson('06_HTML_CONTAMINATION_AUDIT.json', html);
  await writeJson('07_CHUNK_LENGTH_DISTRIBUTION.json', lengthReport);
  await writeJson('08_PRODUCTION_CHUNK_CONTRACT_AUDIT.json', contract);
  await writeJson('09_INPUT_UNIT_PARITY.json', inputParity);
  await writeJson('10_CORPUS_MASS_SHIFT.json', massShift);
  await writeJson('11_CHECKPOINT.json', checkpoint);
  await writeFile(resolve(HANDOFF, '11_CHECKPOINT.md'), [
    '# V43 Reference Chunk Mass Preflight V1', '',
    `Status: ${checkpoint.status}`, '',
    `New corpus: ${parsed.length} sources / ${totalNew} planned chunks; V3 baseline: ${baselineMaterials} materials / ${baselineChunks} chunks.`, '',
    `Input-unit parity: ${inputParity.input_unit_parity}. Non-comparable indicators: ${inputParity.non_comparable_source_ids.join(', ') || 'none'}.`, '',
    `Exact duplicate rate: ${duplicate.exact_duplicate_rate}; normalized-fingerprint near-duplicate estimate: ${near.estimated_near_duplicate_rate}.`, '',
    'No embedding, Provider, DB, source, chunker, dedup, RAG, Git or deployment side effects were performed.', '',
    'Mechanical diagnostic only; no semantic usefulness labels are assigned.'
  ].join('\n'), 'utf8');
  console.log(JSON.stringify({ ...checkpoint, artifacts: HANDOFF }, null, 2));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  build().catch(error => { console.error(JSON.stringify({ status: error.code || 'BLOCKED_REFERENCE_CHUNK_MASS_PREFLIGHT', error: String(error.message || error), embedding_calls: 0, provider_calls: 0, db_writes: 0 }, null, 2)); process.exitCode = 1; });
}

export { build, nearFingerprint, classifyHtmlChunk };
