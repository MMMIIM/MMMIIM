import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractTenderText } from '../../src/tender-text-extractor.js';
import { classifyTenderSections } from '../../src/pipeline/tender-section-classifier.js';
import {
  combineRequirementExtractionSections,
  routeRequirementExtractionSections,
  REQUIREMENT_SCOPE_ROLES
} from '../../src/pipeline/requirement-scope-router.js';
import {
  chunkExtractedText,
  estimateTokenCount,
  resolveRequirementChunkBudget
} from '../../src/pipeline/requirement-chunker.js';
import { SourceLocationResolver } from '../../src/pipeline/source-location-resolver.js';

export const REAL_TENDER_IDS = Object.freeze(['FAST-01', 'FAST-WATER-01', 'TB-006']);
const defaultRepoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

const ROLE_SET = new Set(REQUIREMENT_SCOPE_ROLES);

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function textOf(value) {
  return String(value ?? '').trim();
}

function normalizedText(value) {
  return textOf(value).normalize('NFKC').replace(/\s+/g, '');
}

function nonEmptyParagraphs(paragraphs = []) {
  return paragraphs.filter((paragraph) => textOf(paragraph?.text));
}

function selectedText(paragraphs) {
  return nonEmptyParagraphs(paragraphs).map((paragraph) => textOf(paragraph.text)).join('\n');
}

function tableMetadataFields(paragraph = {}) {
  const table = paragraph.table && typeof paragraph.table === 'object' && !Array.isArray(paragraph.table)
    ? paragraph.table : null;
  const candidates = [
    ['table', table],
    ['table_id', paragraph.table_id ?? paragraph.tableId ?? table?.table_id ?? table?.id],
    ['table_row_id', paragraph.table_row_id ?? paragraph.row_id ?? paragraph.rowId
      ?? table?.table_row_id ?? table?.row_id ?? table?.rowId],
    ['table_header_context', paragraph.table_header_context ?? paragraph.header_context ?? table?.header_context],
    ['table_cells', paragraph.table_cells ?? paragraph.cells ?? table?.cells]
  ];
  return candidates.filter(([, value]) => value != null).map(([name]) => name);
}

function roleDistribution(paragraphs) {
  const distribution = Object.fromEntries(REQUIREMENT_SCOPE_ROLES.map((role) => [role, 0]));
  for (const paragraph of paragraphs) {
    const role = ROLE_SET.has(paragraph.routing_role) ? paragraph.routing_role : 'UNKNOWN';
    distribution[role] += 1;
  }
  return distribution;
}

function sourceSpanByHistoricalRef(packet) {
  return new Map(packet.windows.flatMap((window) => window.spans).map((span) => [span.span_id, span]));
}

function buildSelectedWindow(packet, extraction, fullAnalysis) {
  const selection = packet.source_extraction?.selection || {};
  if (selection.type === 'controlled_paragraph_window') {
    const paragraphs = extraction.paragraphs.filter((paragraph) => (
      paragraph.paragraph >= selection.start_paragraph
      && paragraph.paragraph <= selection.end_paragraph
    ));
    return {
      type: selection.type,
      paragraphs,
      source_section: null,
      source_section_title: packet.tender_id
    };
  }
  if (selection.type === 'classified_technical_section') {
    const technicalSection = fullAnalysis.technicalSection;
    if (!technicalSection) {
      throw Object.assign(new Error(`${packet.tender_id}: technical section unavailable in production parser`), {
        code: 'REAL_PATH_TECHNICAL_SECTION_UNAVAILABLE'
      });
    }
    return {
      type: selection.type,
      paragraphs: technicalSection.paragraphs,
      source_section: technicalSection.section_key,
      source_section_title: technicalSection.title
    };
  }
  throw Object.assign(new Error(`${packet.tender_id}: unsupported frozen source selection`), {
    code: 'REAL_PATH_SELECTION_UNSUPPORTED'
  });
}

function routeSelectedWindow(packet, selected) {
  if (selected.type === 'controlled_paragraph_window') {
    const selectedExtraction = {
      text: selectedText(selected.paragraphs),
      paragraphs: selected.paragraphs,
      pages: [],
      warnings: []
    };
    const analysis = classifyTenderSections(selectedExtraction);
    return {
      analysis,
      sections: analysis.sections,
      used_fulltext_fallback: analysis.usedFullTextFallback
    };
  }
  // The technical section has already passed through the production section
  // classifier. Re-run only the shared router on this frozen section view so
  // this benchmark window observes the same boundary code as production.
  const routed = routeRequirementExtractionSections([selected.source_section_object]);
  return {
    analysis: null,
    sections: routed.sections,
    used_fulltext_fallback: false
  };
}

function countChars(paragraphs) {
  return selectedText(paragraphs).length;
}

function paragraphKey(paragraph) {
  return `${paragraph.paragraph ?? ''}\u0000${normalizedText(paragraph.text)}`;
}

function buildParagraphSegmentIndex(chunks) {
  const byParagraph = new Map();
  for (const chunk of chunks) {
    for (const segment of chunk.segments) {
      const key = paragraphKey(segment);
      if (!byParagraph.has(key)) byParagraph.set(key, []);
      byParagraph.get(key).push({ chunk_number: chunk.chunk_number, source_ref: segment.source_ref });
    }
  }
  return byParagraph;
}

function goldParagraphs(packet, gold) {
  const historical = sourceSpanByHistoricalRef(packet);
  return {
    start: historical.get(gold.source_range?.start_ref) || null,
    end: historical.get(gold.source_range?.end_ref) || null
  };
}

function tableTrace(packet, path, goldIds) {
  const traces = [];
  const byParagraph = buildParagraphSegmentIndex(path.chunks);
  for (const gold of packet.gold_requirements.filter((item) => goldIds.includes(item.gold_id))) {
    const { start, end } = goldParagraphs(packet, gold);
    const sourceParagraphs = path.selected_paragraphs.filter((paragraph) => (
      start && end
      && paragraph.paragraph >= start.paragraph
      && paragraph.paragraph <= end.paragraph
    ));
    const metadata = sourceParagraphs.map((paragraph) => ({
      paragraph: paragraph.paragraph ?? null,
      fields: tableMetadataFields(paragraph),
      semantic_unit_type: paragraph.semantic_unit_type || null
    }));
    const providerChunks = [...new Set(sourceParagraphs.flatMap((paragraph) => (
      byParagraph.get(paragraphKey(paragraph)) || []
    )).map((item) => item.chunk_number))].sort((a, b) => a - b);
    const resolvedRefs = sourceParagraphs.flatMap((paragraph) => byParagraph.get(paragraphKey(paragraph)) || []);
    traces.push({
      gold_id: gold.gold_id,
      raw_source_refs: { ...gold.source_range },
      source_paragraphs: [start?.paragraph ?? null, end?.paragraph ?? null],
      parser_table_metadata: metadata,
      parser_table_metadata_count: metadata.filter((item) => item.fields.length > 0).length,
      table_semantic_unit_created: resolvedRefs.some((item) => {
        const chunk = path.chunks.find((candidate) => candidate.chunk_number === item.chunk_number);
        return chunk?.segments.some((segment) => segment.source_ref === item.source_ref
          && segment.semantic_unit_type === 'TABLE_ROW');
      }),
      provider_ready_chunks: providerChunks,
      complete_sla_visible_in_one_provider_chunk: sourceParagraphs.length > 0
        && resolvedRefs.length === sourceParagraphs.length
        && providerChunks.length === 1
    });
  }
  return traces;
}

export async function buildRealProductionPath(packet, { repoRoot = defaultRepoRoot, env = process.env } = {}) {
  const sourcePath = resolve(repoRoot, packet.source_file);
  const buffer = await readFile(sourcePath);
  const sourceFileSha256 = sha256(buffer);
  if (sourceFileSha256 !== packet.source_file_sha256) {
    throw Object.assign(new Error(`${packet.tender_id}: source SHA mismatch`), {
      code: 'REAL_PATH_SOURCE_SHA_MISMATCH'
    });
  }

  const extraction = await extractTenderText({
    fileName: sourcePath,
    mimeType: 'application/pdf',
    buffer
  });
  const fullAnalysis = classifyTenderSections(extraction);
  const selected = buildSelectedWindow(packet, extraction, fullAnalysis);
  if (selected.type === 'classified_technical_section') {
    selected.source_section_object = fullAnalysis.technicalSection;
  }

  const routed = routeSelectedWindow(packet, selected);
  const routedParagraphs = routed.sections.flatMap((section) => section.paragraphs || []);
  const scope = combineRequirementExtractionSections(routed.sections, { includeNonScoringSections: true });
  if (!scope) {
    throw Object.assign(new Error(`${packet.tender_id}: no requirement extraction scope after routing`), {
      code: 'REAL_PATH_NO_REQUIREMENT_SCOPE'
    });
  }
  const budget = resolveRequirementChunkBudget(env);
  const preRoutingText = selectedText(selected.paragraphs);
  const preRoutingChunks = chunkExtractedText({
    text: preRoutingText,
    paragraphs: selected.paragraphs,
    singleCallThreshold: budget.singleCallThreshold,
    characterBudget: budget.characterBudget,
    tokenBudget: budget.tokenBudget,
    sourceSpanBudget: budget.sourceSpanBudget
  });
  const chunks = chunkExtractedText({
    text: scope.content_text,
    paragraphs: scope.paragraphs,
    singleCallThreshold: budget.singleCallThreshold,
    characterBudget: budget.characterBudget,
    tokenBudget: budget.tokenBudget,
    sourceSpanBudget: budget.sourceSpanBudget
  });
  const excludedParagraphs = routedParagraphs.filter((paragraph) => (
    !['REQUIREMENT_ELIGIBLE', 'UNKNOWN'].includes(paragraph.routing_role)
  ));
  const tableMetadataCount = selected.paragraphs.reduce((count, paragraph) => (
    count + (tableMetadataFields(paragraph).length > 0 ? 1 : 0)
  ), 0);
  const tableSemanticUnits = chunks.reduce((count, chunk) => count + chunk.table_units.length, 0);
  const resolver = new SourceLocationResolver();
  const resolverFailures = chunks.filter((chunk) => {
    if (!chunk.segments.length) return true;
    try {
      resolver.resolve({ source_range: {
        start_ref: chunk.segments[0].source_ref,
        end_ref: chunk.segments.at(-1).source_ref
      } }, chunk);
      return false;
    } catch {
      return true;
    }
  }).length;
  const historicalRefs = sourceSpanByHistoricalRef(packet);
  const selectedParagraphKeys = new Set(selected.paragraphs.map(paragraphKey));
  const historicalWindowCoverage = [...historicalRefs.values()].filter((span) => (
    selectedParagraphKeys.has(paragraphKey(span))
  )).length;

  const path = {
    tender_id: packet.tender_id,
    source_file: packet.source_file,
    source_file_sha256: sourceFileSha256,
    selected_window_type: selected.type,
    selected_window_title: selected.source_section_title,
    raw_selected_character_count: countChars(selected.paragraphs),
    parsed_span_count: selected.paragraphs.length,
    parsed_source_paragraph_count: extraction.paragraphs.length,
    parser_extracted_character_count: extraction.text.length,
    selected_paragraphs: selected.paragraphs,
    routed_sections: routed.sections,
    scope,
    chunks,
    budget,
    routing: {
      router_invoked: true,
      role_distribution: roleDistribution(routedParagraphs),
      excluded_spans: excludedParagraphs.length,
      excluded_chars: excludedParagraphs.reduce((sum, paragraph) => sum + textOf(paragraph.text).length, 0),
      retained_unknown_spans: routedParagraphs.filter((paragraph) => paragraph.routing_role === 'UNKNOWN').length,
      sections_excluded_before_provider: routed.sections.filter((section) => (
        !['REQUIREMENT_ELIGIBLE', 'UNKNOWN'].includes(section.routing_role)
      )).length,
      spans_excluded_before_provider: excludedParagraphs.length,
      characters_excluded_before_provider: excludedParagraphs.reduce((sum, paragraph) => sum + textOf(paragraph.text).length, 0),
      provider_ready_chunks_avoided: Math.max(0, preRoutingChunks.length - chunks.length),
      historical_window_span_count: historicalRefs.size,
      historical_window_coverage: historicalWindowCoverage,
      span_conservation_pass: scope.paragraphs.length + excludedParagraphs.length === selected.paragraphs.length
    },
    table: {
      parser_table_metadata_count: tableMetadataCount,
      table_semantic_units_created: tableSemanticUnits,
      selected_paragraphs_with_table_metadata: tableMetadataCount,
      table_metadata_fields_observed: [...new Set(selected.paragraphs.flatMap(tableMetadataFields))].sort()
    },
    chunking: {
      production_chunk_count: chunks.length,
      pre_routing_chunk_count: preRoutingChunks.length,
      single_call_threshold: budget.singleCallThreshold,
      character_budget: budget.characterBudget,
      token_budget: budget.tokenBudget,
      source_span_budget: budget.sourceSpanBudget,
      source_resolution_failure_count: resolverFailures,
      chunks: chunks.map((chunk) => ({
        chunk_number: chunk.chunk_number,
        character_count: chunk.character_count,
        estimated_token_count: estimateTokenCount(chunk.text),
        span_count: chunk.segments.length,
        boundary_reason: chunk.starts_at_title_boundary ? 'TITLE_BOUNDARY' : 'CONTINUATION',
        table_unit_count: chunk.table_units.length
      }))
    }
  };
  if (packet.tender_id === 'FAST-01') {
    path.table.sla_gold_traces = tableTrace(packet, path, [
      'FAST-01-G021', 'FAST-01-G022', 'FAST-01-G023', 'FAST-01-G024'
    ]);
  }
  return path;
}
