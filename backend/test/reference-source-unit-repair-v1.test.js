import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chunkEnterpriseMaterial } from '../src/pipeline/enterprise-material-chunker.js';
import { loadSourceManifest } from '../eval/rag-governance/reference-eval-ingest-v4.mjs';
import {
  H3C_SOURCE_UNIT_RULES,
  CANONICAL_HTML_SOURCE_UNIT_VERSION,
  prepareCanonicalHtmlSource
} from '../eval/rag-governance/reference-source-unit-repair-v1.js';

const TARGETS = ['H3C-003', 'H3C-004', 'H3C-010', 'H3C-011', 'H3C-012', 'H3C-013'];

test('six H3C HTML snapshots resolve to one deterministic structural source unit', async () => {
  const { entries } = await loadSourceManifest();
  const byId = new Map(entries.map(entry => [entry.source_id, entry]));
  for (const sourceId of TARGETS) {
    const entry = byId.get(sourceId);
    assert.ok(entry, sourceId + ' is present in frozen manifest');
    const raw = await readFile(entry.local_file, 'utf8');
    const first = prepareCanonicalHtmlSource({ sourceId, rawHtml: raw });
    const second = prepareCanonicalHtmlSource({ sourceId, rawHtml: raw });
    assert.equal(first.preparation_version, CANONICAL_HTML_SOURCE_UNIT_VERSION);
    assert.equal(first.selector, H3C_SOURCE_UNIT_RULES[sourceId].selector);
    assert.equal(first.canonical_text_sha256, second.canonical_text_sha256);
    assert.ok(first.canonical_text_chars > 0);
    assert.equal(first.ambiguity, null);
    assert.equal(first.exclusions.mechanical_only, true);
    assert.equal(first.source_text.includes('JY-001') || first.source_text.includes('TB-003') || first.source_text.includes('FAST-'), false);
  }
});
test('source-unit exclusions remove only structural chrome controls', async () => {
  const raw010 = await readFile('data/eval/h3c-public-real-v1/raw/H3C-010_数据备份与保护.html', 'utf8');
  const prepared010 = prepareCanonicalHtmlSource({ sourceId: 'H3C-010', rawHtml: raw010 });
  assert.equal(prepared010.source_text.includes('首页 产品与解决方案'), false);
  assert.equal(prepared010.source_text.includes('提交项目需求'), false);
  assert.match(prepared010.source_text, /数据备份与保护/u);
  const raw013 = await readFile('data/eval/h3c-public-real-v1/raw/H3C-013_电子政务外网乡镇延伸.html', 'utf8');
  const prepared013 = prepareCanonicalHtmlSource({ sourceId: 'H3C-013', rawHtml: raw013 });
  assert.match(prepared013.source_text, /电子政务外网乡镇延伸建设背景/u);
  assert.equal(prepared013.source_text.includes('版权所有'), false);
});

test('canonical text continues to use the unchanged production chunker', async () => {
  const raw = await readFile('data/eval/h3c-public-real-v1/raw/H3C-011_新一代电子政务外网方案.html', 'utf8');
  const prepared = prepareCanonicalHtmlSource({ sourceId: 'H3C-011', rawHtml: raw });
  const chunks = chunkEnterpriseMaterial('source-unit-test-material', prepared.source_text);
  assert.ok(chunks.length > 0);
  assert.equal(chunks[0].chunker_version, 'enterprise-material-v1');
  assert.equal(chunkEnterpriseMaterial('source-unit-test-material', prepared.source_text)[0].chunk_id, chunks[0].chunk_id);
});
