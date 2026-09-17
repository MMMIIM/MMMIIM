/** Rebuild only case-level V6.3 review artifacts from completed replay output. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const DIR = path.join(ROOT, 'docs', 'eval', 'flywheel', 'p0-badcase-repair-v2');
const RESULT = path.join(DIR, 'V43_P0_BADCASE_43_REPLAY_RESULTS_V6_3.json');
const SUPPORT = path.join(DIR, 'V43_P0_BADCASE_43_MINIMUM_SUPPORT_SPANS_V6_3.json');
const ANCHOR = path.join(DIR, 'V43_P0_BADCASE_44_SOURCE_EVIDENCE_ANCHOR_FROZEN_V6_2.json');
const PACKET = path.join(DIR, 'V43_P0_BADCASE_43_GPT_SEMANTIC_ROOT_CAUSE_PACKET_V6_3.json');
const DIVERGENCE = path.join(DIR, 'V43_P0_BADCASE_43_FIRST_DIVERGENCE_V6_3.json');
const FAMILIES = path.join(DIR, 'V43_P0_BADCASE_43_FAILURE_FAMILY_PROPOSALS_V6_3.json');

function read(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function write(file, value) { fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8'); }

function byAtom(result, atomId) {
  return result.rows.find((row) => Array.isArray(row.atom_ids) && row.atom_ids.includes(atomId)) || null;
}

function refsByStage(row, stage) {
  return row?.restricted_evidence_refs?.find((ref) => ref?.path?.includes(stage)) || null;
}

function main() {
  const result = read(RESULT);
  const support = read(SUPPORT);
  const anchor = read(ANCHOR);
  const anchorByAtom = new Map((anchor.rows || []).map((row) => [row.atom_id, row]));
  const atomIds = [...new Set((support.rows || [])
    .filter((row) => row.anchor_decision !== 'SOURCE_CONFLICT_RETAINED')
    .flatMap((row) => row.atom_id))];
  const rows = atomIds.map((atomId) => {
    const replay = byAtom(result, atomId);
    const source = support.rows.find((row) => row.atom_id === atomId);
    const frozen = anchorByAtom.get(atomId);
    return {
      atom_id: atomId,
      tender_id: source?.tender_id || replay?.tender_id || null,
      frozen_anchor_decision: source?.anchor_decision || null,
      frozen_semantic_label: frozen?.frozen_semantic_label || null,
      frozen_semantic_reason: frozen?.p0_basis || null,
      authoritative_source_anchors: (source?.minimum_support_spans || []).map((span) => ({
        support_span_id: span.support_span_id,
        source_document_sha256: span.source_document_sha256,
        source_page_start: span.page,
        source_page_end: span.page,
        paragraph_start: span.paragraph_start,
        paragraph_end: span.paragraph_end,
        raw_source_text_sha256: span.raw_source_text_sha256,
        support_method: span.support_method
      })),
      production_provider_input: replay ? {
        chunk_id: replay.chunk_id,
        input_sha256: replay.input_sha256,
        source_refs: replay.source_refs,
        restricted_evidence_ref: refsByStage(replay, 'PROVIDER_INPUT_SNAPSHOT')
      } : null,
      raw_provider_response_snapshot: replay ? refsByStage(replay, 'RAW_PROVIDER_RESPONSE_SNAPSHOT') : null,
      raw_candidate_snapshot: replay ? refsByStage(replay, 'RAW_CANDIDATE_SNAPSHOT') : null,
      normalized_candidate_snapshot: replay ? refsByStage(replay, 'NORMALIZED_CANDIDATE_SNAPSHOT') : null,
      canonicalization_decision_snapshot: replay ? refsByStage(replay, 'CANONICALIZATION_DECISION_SNAPSHOT') : null,
      source_resolution_snapshot: replay ? refsByStage(replay, 'SOURCE_RESOLUTION_SNAPSHOT') : null,
      canonical_output_snapshot: replay ? refsByStage(replay, 'CANONICAL_OUTPUT_SNAPSHOT') : null,
      mechanical_first_divergence: replay?.divergence || null,
      current_replay_failure_mechanism: replay?.error_class || replay?.quality_gate_decision || null,
      semantic_root_cause: 'PENDING_GPT'
    };
  });
  const packet = {
    artifact_type: 'V43_P0_BADCASE_43_GPT_SEMANTIC_ROOT_CAUSE_PACKET_V6_3',
    run_id: result.run_id,
    source_truth_sha256: result.source_truth_sha256,
    replay_eligible_case_count: rows.length,
    semantic_labels_are_frozen_inputs: true,
    semantic_root_cause: 'PENDING_GPT',
    rows
  };
  write(PACKET, packet);

  const divergence = read(DIVERGENCE);
  const divergenceRows = rows.map((row) => {
    const source = divergence.rows.find((item) => item.atom_ids?.includes(row.atom_id));
    return { ...source, atom_id: row.atom_id, atom_ids: [row.atom_id], frozen_semantic_label: row.frozen_semantic_label };
  });
  write(DIVERGENCE, { ...divergence, rows: divergenceRows, replay_eligible_case_count: rows.length });

  const families = read(FAMILIES);
  const familyRows = rows.map((row) => {
    const source = families.proposals.find((item) => item.atom_ids?.includes(row.atom_id));
    return { ...source, atom_id: row.atom_id, atom_ids: [row.atom_id] };
  });
  write(FAMILIES, { ...families, proposals: familyRows, replay_eligible_case_count: rows.length });
  process.stdout.write(`${JSON.stringify({ packet_rows: rows.length, divergence_rows: divergenceRows.length, family_rows: familyRows.length, provider_calls: 0 })}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  try { main(); } catch (error) { process.stderr.write(`${error?.message || error}\n`); process.exitCode = 1; }
}

export { main };
