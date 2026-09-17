import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { selectOneCaseChunk } from '../eval/flywheel/requirement-v6-4-one-case-selector-recert.js';

const repoRoot = resolve(import.meta.dirname, '../..');
const evalRoot = resolve(repoRoot, 'docs/eval/flywheel/p0-badcase-repair-v2');

async function readJson(name) {
  return JSON.parse(await readFile(resolve(evalRoot, name), 'utf8'));
}

test('FAST-01-P0-0019 selector correction is anchored to the V6.3 authorized chunk', async () => {
  const oldReplay = await readJson('V43_REQUIREMENT_V6_4_TARGETED_REPLAY.json');
  const oldWrong = oldReplay.rows.find((row) => row.chunk_id === 'FAST-01:reconstructed:23'
    && row.atom_ids.includes('FAST-01-P0-0019'));
  assert.ok(oldWrong, 'the prior V6.4 wrong selector evidence must remain auditable');

  const support = await readJson('V43_P0_BADCASE_43_MINIMUM_SUPPORT_SPANS_V6_3.json');
  const supportRow = support.rows.find((row) => row.atom_id === 'FAST-01-P0-0019');
  const plan = await readJson('V43_P0_BADCASE_43_CORRECTED_REPLAY_PLAN_V6_3.json');
  const gptPacket = JSON.parse(await readFile(
    resolve(repoRoot, 'docs/handoff/V43_REQUIREMENT_V6_3_SEMANTIC_ADJUDICATION/02_GPT_DECISION_PACKET.json'),
    'utf8'
  ));
  const selection = selectOneCaseChunk({ atomId: 'FAST-01-P0-0019', supportRow, plan, gptPacket });

  assert.equal(selection.previous_wrong_chunk_id, 'FAST-01:reconstructed:23');
  assert.equal(selection.corrected_chunk_id, 'FAST-01:reconstructed:1');
  assert.equal(selection.authority_source, 'V6_3_GPT_RELEVANT_PROVIDER_INPUT');
  assert.equal(selection.authoritative_support_span_count, 2);
  assert.equal(selection.selected_support_span_present, true);
  assert.equal(selection.selected_support_span.page, 2);
  assert.equal(selection.selected_support_span.paragraph_start, 35);
});
