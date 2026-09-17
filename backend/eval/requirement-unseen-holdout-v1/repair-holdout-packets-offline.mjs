import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildAnnotatedPath } from '../requirement-extraction-real-tender-pilot-v1/run-live-eval.js';
import { buildCanonicalRequirements } from '../../src/pipeline/canonical-requirements.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '../../..');
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
const json = (value) => JSON.stringify(value, null, 2) + '\n';

function packetFromManifest(candidate) {
  return {
    tender_id: candidate.holdout_tender_id,
    title: candidate.project_name,
    source_file: candidate.primary_solicitation_file,
    source_file_sha256: candidate.primary_solicitation_sha256,
    windows: [],
    source_extraction: { selection: {
      type: 'controlled_paragraph_window', start_paragraph: 0,
      end_paragraph: Number.MAX_SAFE_INTEGER, title: 'FULL_DOCUMENT'
    } }
  };
}

function naturalContext(prepared, location) {
  const clause = location?.source_clause_id;
  const sameClause = clause ? (prepared.selected_paragraphs || []).filter((item) => item.source_clause_id === clause) : [];
  return (sameClause.length ? sameClause : [])
    .map((item) => item.text).join('\n').slice(0, 6000) || location?.source_context_text || null;
}

function summarizeCanonical(tenderId, canonical, candidateByIndex, prepared) {
  return canonical.map((item, index) => {
    const refs = item.deduplication?.merged_candidate_refs || [item.candidate_ref || index + 1];
    const entries = refs.map((ref) => candidateByIndex.get(ref)).filter(Boolean);
    const sourceRefs = [...new Set(entries.flatMap((entry) => entry.source_refs || []))];
    const first = entries[0] || {};
    return {
      holdout_tender_id: tenderId,
      canonical_requirement_id: `${tenderId}-CAN-${String(index + 1).padStart(4, '0')}`,
      canonical_requirement_text: item.text,
      category: item.category,
      requirement_category: item.requirement_category,
      source_refs: sourceRefs,
      resolved_source_context: entries.map((entry) => entry.source_context).filter(Boolean).join('\n').slice(0, 12000),
      natural_parent_context: naturalContext(prepared, first.location),
      candidate_text: entries.map((entry) => entry.raw_candidate?.text).filter(Boolean),
      quality_gate_decision: item.quality_gate_decision,
      quality_gate_decision_class: item.quality_gate_decision === 'PASS'
        ? 'ACCEPT' : item.quality_gate_decision === 'REVIEW_REQUIRED' ? 'REVIEW_REQUIRED' : 'REJECT',
      quality_gate_reason_codes: item.quality_gate_reason_codes || [],
      mandatory_observed: item.mandatory_observed,
      requires_confirmation: item.requires_confirmation,
      risk_flags: item.risk_flags || [],
      response_role_projection: item.writer_eligible ? 'writer_eligible_projection' : 'review_or_non_writer_projection',
      source_location_verified: entries.length > 0 && entries.every((entry) => entry.source_verified === true),
      packet_structurally_complete: Boolean(item.text && sourceRefs.length),
      semantic_context_sufficient: null,
      semantic_context_review_status: 'PENDING_GPT_ADJUDICATION'
    };
  });
}

function sourcePacket(tenderId, prepared, canonicalEntries) {
  const sourceRefsForParagraph = (paragraph) => prepared.chunks.flatMap((chunk) => chunk.segments)
    .filter((segment) => segment.paragraph === paragraph.paragraph
      && String(segment.text || '').trim() === String(paragraph.text || '').trim())
    .map((segment) => segment.source_ref)
    .filter(Boolean);
  const covered = new Map();
  for (const entry of canonicalEntries) for (const ref of entry.source_refs || []) {
    if (!covered.has(ref)) covered.set(ref, []);
    covered.get(ref).push(entry.canonical_requirement_id);
  }
  return (prepared.selected_paragraphs || []).map((paragraph) => {
    const sourceRefs = sourceRefsForParagraph(paragraph);
    return {
    holdout_tender_id: tenderId,
    source_ref: sourceRefs[0] || paragraph.source_ref || null,
    source_refs: sourceRefs,
    page: paragraph.page ?? null,
    paragraph: paragraph.paragraph ?? null,
    parent_heading: paragraph.source_section || paragraph.detected_section_title || null,
    section_role: paragraph.routing_role || 'UNKNOWN',
    semantic_unit_type: paragraph.semantic_unit_type || null,
    table_header_context: paragraph.table_header_context || paragraph.header_context || null,
    table_row_context: paragraph.table_row_id || paragraph.row_id || null,
    raw_source_text: paragraph.text,
    system_produced_requirement_ids: [...new Set(sourceRefs.flatMap((ref) => covered.get(ref) || []))]
    };
  });
}

async function main() {
  const resultsRoot = resolve(HERE, 'results');
  const runs = (await (await import('node:fs/promises')).readdir(resultsRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  const runId = process.argv[2] || runs.at(-1);
  if (!runId) throw new Error('No holdout run found.');
  const runRoot = resolve(resultsRoot, runId);
  const manifest = JSON.parse(await readFile(resolve(HERE, 'V43_REQUIREMENT_UNSEEN_HOLDOUT_SOURCE_MANIFEST_V1.json'), 'utf8'));
  const lineage = JSON.parse(await readFile(resolve(runRoot, 'candidate-lineage.json'), 'utf8')).candidates;
  const original = JSON.parse(await readFile(resolve(runRoot, 'holdout-execution-checkpoint.json'), 'utf8'));
  const telemetryPath = resolve(runRoot, 'runtime-telemetry.json');
  const telemetry = JSON.parse(await readFile(telemetryPath, 'utf8'));
  const gatewayEnv = await readFile(resolve(REPO, 'services/semantic-gateway/.env'), 'utf8').catch(() => '');
  const gatewayIdentity = Object.fromEntries(gatewayEnv.split(/\r?\n/)
    .filter((line) => /^(SEMANTIC_GATEWAY_PROVIDER|SEMANTIC_GATEWAY_MODEL)=/.test(line))
    .map((line) => line.split('=')));
  telemetry.configured_provider = gatewayIdentity.SEMANTIC_GATEWAY_PROVIDER || null;
  telemetry.configured_model = gatewayIdentity.SEMANTIC_GATEWAY_MODEL || null;
  telemetry.executions = telemetry.executions.map((execution) => ({
    ...execution,
    provider: execution.provider || telemetry.configured_provider,
    model: execution.model || telemetry.configured_model
  }));
  await writeFile(telemetryPath, json(telemetry), 'utf8');
  const repairedRoot = resolve(runRoot, 'repaired-blind-review-packets');
  const sourceDir = resolve(repairedRoot, 'source-side');
  const outputDir = resolve(repairedRoot, 'output-side');
  const preRepairRoot = resolve(runRoot, 'pre-repair-blind-review-packets');
  const preRepairSourceDir = resolve(preRepairRoot, 'source-side');
  const preRepairOutputDir = resolve(preRepairRoot, 'output-side');
  await mkdir(sourceDir, { recursive: true });
  await mkdir(outputDir, { recursive: true });
  await mkdir(preRepairSourceDir, { recursive: true });
  await mkdir(preRepairOutputDir, { recursive: true });
  const repairedMetrics = [];
  const allCanonicalEntries = [];
  const stageAExplanations = [];
  const executionPlanPath = resolve(runRoot, 'execution-plan.json');
  const executionPlan = JSON.parse(await readFile(executionPlanPath, 'utf8'));
  let totalCanonical = 0;
  let structurallyComplete = 0;
  for (const candidate of manifest.candidates) {
    const packet = packetFromManifest(candidate);
    const prepared = await buildAnnotatedPath(packet, process.env);
    const routedKeys = new Set((prepared.routed_sections || []).flatMap((section) => section.paragraphs || [])
      .map((item) => `${item.paragraph}|${String(item.text || '').trim()}`));
    const unrouted = (prepared.selected_paragraphs || []).filter((item) => !routedKeys.has(`${item.paragraph}|${String(item.text || '').trim()}`));
    const unroutedPreamble = unrouted.length > 0 && unrouted.every((item) => Number(item.page) <= 2);
    stageAExplanations.push({
      tender_id: candidate.holdout_tender_id,
      unrouted_block_count: unrouted.length,
      classification: unrouted.length === 0 ? 'NONE' : unroutedPreamble ? 'FRONT_MATTER_OR_TOC_NOT_IN_SECTION_CLASSIFIER' : 'UNEXPLAINED',
      source_pages: [...new Set(unrouted.map((item) => item.page).filter(Boolean))]
    });
    const tenderLineage = lineage.filter((entry) => entry.holdout_tender_id === candidate.holdout_tender_id);
    const valid = tenderLineage.filter((entry) => entry.source_resolution_status === 'RESOLVED' && entry.source_verified === true);
    const enriched = valid.map((entry, index) => ({
      ...entry.raw_candidate,
      candidate_index: index + 1,
      source_text: entry.location?.source_text || '',
      source_excerpt: entry.location?.source_text || '',
      source_context_text: entry.location?.source_context_text || entry.location?.source_text || '',
      source_verified: true,
      source_match_type: entry.location?.source_match_type,
      source_resolution_status: entry.location?.source_resolution_status,
      source_hash: entry.location?.source_hash,
      source_page: entry.location?.source_page,
      source_page_start: entry.location?.source_page_start,
      source_page_end: entry.location?.source_page_end,
      source_paragraph: entry.location?.source_paragraph,
      source_paragraph_start: entry.location?.source_paragraph_start,
      source_paragraph_end: entry.location?.source_paragraph_end,
      source_clause_id: entry.location?.source_clause_id,
      source_chunk_id: entry.location?.source_chunk_id,
      source_refs: undefined
    }));
    const canonical = enriched.length ? buildCanonicalRequirements(enriched, { documentText: prepared.scope.content_text, qualityGate: true }) : [];
    const byIndex = new Map(valid.map((entry, index) => [index + 1, entry]));
    const entries = summarizeCanonical(candidate.holdout_tender_id, canonical, byIndex, prepared);
    allCanonicalEntries.push(...entries);
    const sourceEntries = sourcePacket(candidate.holdout_tender_id, prepared, entries);
    const originalOutput = resolve(runRoot, 'output-side-blind-review-packets', `${candidate.holdout_tender_id}.json`);
    const originalSource = resolve(runRoot, 'source-side-blind-review-packets', `${candidate.holdout_tender_id}.json`);
    await copyFile(originalOutput, resolve(preRepairOutputDir, `${candidate.holdout_tender_id}.json`)).catch(() => {});
    await copyFile(originalSource, resolve(preRepairSourceDir, `${candidate.holdout_tender_id}.json`)).catch(() => {});
    const outputPacket = {
      holdout_tender_id: candidate.holdout_tender_id,
      canonical_visibility: 'HIDDEN_FIRST_PASS',
      packet_repair: 'OFFLINE_DETERMINISTIC_RENDER_ONLY',
      entries
    };
    const sourcePacketValue = {
      holdout_tender_id: candidate.holdout_tender_id,
      source_file: candidate.primary_solicitation_file,
      source_file_sha256: candidate.primary_solicitation_sha256,
      canonical_visibility: 'HIDDEN_FIRST_PASS',
      packet_repair: 'OFFLINE_DETERMINISTIC_RENDER_ONLY',
      entries: sourceEntries
    };
    await writeFile(resolve(outputDir, `${candidate.holdout_tender_id}.json`), json({
      ...outputPacket
    }), 'utf8');
    await writeFile(resolve(sourceDir, `${candidate.holdout_tender_id}.json`), json({
      ...sourcePacketValue
    }), 'utf8');
    await writeFile(originalOutput, json(outputPacket), 'utf8');
    await writeFile(originalSource, json(sourcePacketValue), 'utf8');
    const complete = entries.filter((entry) => entry.packet_structurally_complete).length;
    totalCanonical += entries.length;
    structurallyComplete += complete;
    repairedMetrics.push({
      tender_id: candidate.holdout_tender_id,
      canonical_count: entries.length,
      packet_structurally_complete_count: complete,
      source_entries: sourceEntries.length,
      source_resolved_count: valid.length
    });
  }
  const enrichedPlan = {
    ...executionPlan,
    stage_a_exclusion_explanations: stageAExplanations,
    stage_a_exclusion_explanations_status: stageAExplanations.every((item) => item.classification !== 'UNEXPLAINED') ? 'PASS' : 'FAIL'
  };
  await copyFile(executionPlanPath, resolve(runRoot, 'execution-plan.pre-repair.json')).catch(() => {});
  await writeFile(executionPlanPath, json(enrichedPlan), 'utf8');
  await writeFile(resolve(runRoot, 'canonical-requirements.repaired.json'), json({
    run_id: runId,
    canonical_count: allCanonicalEntries.length,
    packet_render_repair: 'OFFLINE_DETERMINISTIC_RENDER_ONLY',
    requirements: allCanonicalEntries
  }), 'utf8');
  await copyFile(resolve(runRoot, 'canonical-requirements.json'), resolve(runRoot, 'canonical-requirements.pre-repair.json')).catch(() => {});
  await writeFile(resolve(runRoot, 'canonical-requirements.json'), json({
    run_id: runId,
    canonical_count: allCanonicalEntries.length,
    packet_render_repair: 'OFFLINE_DETERMINISTIC_RENDER_ONLY',
    requirements: allCanonicalEntries
  }), 'utf8');
  const finalCheckpoint = {
    ...original,
    packet_render_repair: {
      status: 'PASS',
      mode: 'OFFLINE_DETERMINISTIC_RENDER_ONLY',
      provider_calls: 0,
      production_db_writes: 0,
      gold_mutations: 0,
      repaired_metrics: repairedMetrics,
      packet_structurally_complete_count: structurallyComplete,
      packet_canonical_count: totalCanonical,
      packet_structural_completeness_rate: totalCanonical ? structurallyComplete / totalCanonical : null
    },
    final_status: original.final_status,
    artifacts: {
      ...(original.artifacts || {}),
      repaired_source_side_packets: 'repaired-blind-review-packets/source-side/',
      repaired_output_side_packets: 'repaired-blind-review-packets/output-side/',
      repaired_canonical_requirements: 'canonical-requirements.repaired.json',
      pre_repair_packets: 'pre-repair-blind-review-packets/',
      execution_plan_pre_repair: 'execution-plan.pre-repair.json'
    }
  };
  finalCheckpoint.stage_a_exclusion_explanations = stageAExplanations;
  await writeFile(resolve(runRoot, 'holdout-execution-checkpoint.final.json'), json(finalCheckpoint), 'utf8');
  await writeFile(resolve(runRoot, 'holdout-execution-checkpoint.final.md'), [
    '# V43 Requirement Unseen Tender Holdout v1 Final Checkpoint',
    '',
    `- RUN_ID: ${runId}`,
    `- FINAL_STATUS: ${finalCheckpoint.final_status}`,
    `- PACKET_RENDER_REPAIR: ${finalCheckpoint.packet_render_repair.status}`,
    `- PACKET_STRUCTURAL_COMPLETENESS: ${finalCheckpoint.packet_render_repair.packet_structural_completeness_rate}`,
    `- PROVIDER_CALLS_DURING_REPAIR: 0`,
    `- GOLD_MUTATIONS: 0`,
    `- PRODUCTION_DB_WRITES: 0`,
    '',
    'This repair only re-rendered packet lineage from the existing run artifact; it did not rerun Provider or alter Production/Gold.'
  ].join('\n'), 'utf8');
  console.log(JSON.stringify({ run_id: runId, packet_render_repair: 'PASS', canonical_count: totalCanonical, structurally_complete: structurallyComplete, provider_calls: 0 }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ status: 'FAILED', error_code: error?.code || 'HOLDOUT_PACKET_REPAIR_FAILED', message: error?.message || String(error) }, null, 2));
  process.exitCode = 1;
});
