import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildRealProductionPath } from '../eval/requirement-extraction-real-tender-pilot-v1/production-path.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const evalRoot = resolve(repoRoot, 'backend/eval/requirement-extraction-real-tender-pilot-v1');

async function packet(id) {
  return JSON.parse(await readFile(resolve(evalRoot, 'semantic-boundary-v1.1', 'packets', `${id}.json`), 'utf8'));
}

function historicalParagraphRange(sourcePacket, goldId) {
  const gold = sourcePacket.gold_requirements.find((item) => item.gold_id === goldId);
  const spans = new Map(sourcePacket.windows.flatMap((window) => window.spans).map((span) => [span.span_id, span]));
  return {
    start: spans.get(gold.source_range.start_ref).paragraph,
    end: spans.get(gold.source_range.end_ref).paragraph
  };
}

function chunksForParagraphRange(productionPath, range) {
  return productionPath.chunks.filter((chunk) => chunk.segments.some((segment) => (
    segment.paragraph >= range.start && segment.paragraph <= range.end
  )));
}

test('real-path preflight uses frozen source windows and shared production chunking offline', async () => {
  const fast = await buildRealProductionPath(await packet('FAST-01'), { repoRoot });
  const water = await buildRealProductionPath(await packet('FAST-WATER-01'), { repoRoot });
  const tb = await buildRealProductionPath(await packet('TB-006'), { repoRoot });

  assert.equal(fast.budget.sourceSpanBudget, 100);
  assert.equal(water.budget.sourceSpanBudget, 100);
  assert.equal(tb.budget.sourceSpanBudget, 100);

  assert.deepEqual(
    [fast.raw_selected_character_count, fast.parsed_span_count],
    [4930, 255]
  );
  assert.deepEqual(
    [water.raw_selected_character_count, water.parsed_span_count],
    [16769, 747]
  );
  assert.deepEqual(
    [tb.raw_selected_character_count, tb.parsed_span_count],
    [4921, 237]
  );
  for (const path of [fast, water, tb]) {
    assert.equal(path.routing.router_invoked, true);
    assert.equal(path.routing.span_conservation_pass, true);
    assert.equal(path.chunks.length > 0, true);
    assert.equal(path.chunking.source_resolution_failure_count, 0);
    assert.equal(path.chunks.flatMap((chunk) => chunk.segments).length, path.scope.paragraphs.length);
    assert.equal(new Set(path.chunks.flatMap((chunk) => chunk.segments.map((segment) => segment.source_ref))).size,
      path.scope.paragraphs.length);
  }
  assert.deepEqual(fast.chunks.map((chunk) => [chunk.character_count, chunk.segments.length]), [
    [1224, 64], [1513, 95], [1530, 66]
  ]);
  assert.equal(water.chunks.length, 7);
  assert.equal(water.chunks.filter((chunk) => chunk.character_count < 250).length, 0);
  assert.equal(water.chunks.filter((chunk) => chunk.character_count < 500).length, 0);
  assert.equal(water.table.parser_table_metadata_count, 0);
  assert.equal(water.table.table_semantic_units_created, 0);
  assert.equal(fast.table.parser_table_metadata_count, 0);
  assert.equal(fast.table.table_semantic_units_created, 0);
  assert.equal(tb.table.parser_table_metadata_count, 0);
  assert.equal(tb.table.table_semantic_units_created, 0);
  assert.equal(fast.table.sla_gold_traces.length, 4);
  assert.deepEqual(fast.table.sla_gold_traces.map((trace) => trace.provider_ready_chunks), [[2], [2], [2], [2]]);
  assert.deepEqual(fast.table.sla_gold_traces.map((trace) => trace.complete_sla_visible_in_one_provider_chunk), [true, true, true, true]);

  const fastG033 = chunksForParagraphRange(fast, historicalParagraphRange(await packet('FAST-01'), 'FAST-01-G033'));
  assert.equal(fastG033.length, 1);
  assert.match(fastG033[0].text, /及时向负\n责人报告。/);

  const tbPacket = await packet('TB-006');
  const tbG028 = chunksForParagraphRange(tb, historicalParagraphRange(tbPacket, 'TB-006-G028'));
  assert.equal(tbG028.length, 1);
  assert.match(tbG028[0].text, /故障处理完毕后提供相关系统宕\n机报告。/);

  for (const [goldId, marker] of [
    ['TB-006-G030', /7\s*个工作日/],
    ['TB-006-G037', /承担保密义务/]
  ]) {
    const range = historicalParagraphRange(tbPacket, goldId);
    const paragraphs = tb.selected_paragraphs.filter((item) => item.paragraph >= range.start && item.paragraph <= range.end);
    assert.ok(paragraphs.some((item) => item.routing_role === 'UNKNOWN'), `${goldId} interior fragment was not retained as UNKNOWN`);
    assert.match(tb.scope.content_text, marker);
  }
});

test('live evaluator no longer constructs provider input from historical packet windows', async () => {
  const source = await readFile(resolve(evalRoot, 'run-live-eval.js'), 'utf8');
  assert.match(source, /buildRealProductionPath/);
  assert.doesNotMatch(source, /function\s+chunkFromPacket/);
  assert.doesNotMatch(source, /packet\.windows\.map\(chunkFromPacket\)/);
});
