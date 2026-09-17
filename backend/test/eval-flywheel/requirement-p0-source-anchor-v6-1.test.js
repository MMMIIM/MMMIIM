import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildAnchorForAtom,
  classifyAuthority,
  mapAnchorToProduction,
  sourceRefOnlyCannotEstablishAnchor
} from '../../eval/flywheel/requirement-p0-source-anchor-v6-1.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');

test('source refs alone cannot establish a raw source anchor', () => {
  assert.equal(sourceRefOnlyCannotEstablishAnchor({ raw_source_text: '', source_refs: ['TB-003#p2'] }), true);
  assert.equal(sourceRefOnlyCannotEstablishAnchor({ raw_source_text: '原文', source_refs: ['TB-003#p2'] }), false);
});

test('GPT-normalized atom is never treated as verbatim source evidence', () => {
  const atom = {
    atom_id: 'TEST-P0-0001', tender: 'TEST', source_mode: 'GPT_ATOMIC_NORMALIZATION', page: 1,
    atomic_requirement: '系统支持统一身份认证', p0_basis: 'coverage', family: 'compatibility'
  };
  const raw = '投标人系统应支持统一身份认证，并支持 LDAP 目录服务接入。';
  const state = {
    tender_id: 'TEST', source_sha256: 'a'.repeat(64), source_sha256_matches_frozen_tender: true,
    paragraphs: [{ paragraph: 1, page: 1, text: raw, source_start_offset: 0, source_end_offset: raw.length }],
    scope: { content_text: raw },
    chunks: [{ id: 'chunk-1', chunk_number: 1, text: raw, content_sha256: 'b'.repeat(64), provider_payload_chunk_text: raw, provider_payload_chunk_text_sha256: 'c'.repeat(64) }]
  };
  const result = buildAnchorForAtom(atom, null, state, undefined, undefined, undefined);
  assert.ok(result.anchors.length >= 1);
  assert.ok(result.anchors.every((anchor) => anchor.raw_source_text !== atom.atomic_requirement));
  assert.equal(result.authority, 'GPT_SEMANTIC_ANCHOR_REQUIRED');
});

test('one semantic atom may retain multiple bounded raw anchors', () => {
  const paragraphs = [];
  for (let index = 0; index < 12; index += 1) {
    const text = index === 0
      ? '系统应支持统一身份认证以及 LDAP 方式接入。'
      : (index === 10 ? '平台应支持统一身份认证和 LDAP 目录服务。' : `背景说明段落 ${index}`);
    paragraphs.push({ paragraph: index + 1, page: index < 6 ? 1 : 3, text, source_start_offset: index * 10, source_end_offset: index * 10 + text.length });
  }
  const joined = paragraphs.map((item) => item.text).join('');
  const state = {
    tender_id: 'TEST', source_sha256: 'd'.repeat(64), source_sha256_matches_frozen_tender: true,
    paragraphs, scope: { content_text: joined },
    chunks: [{ id: 'chunk-1', chunk_number: 1, text: joined, content_sha256: 'e'.repeat(64), provider_payload_chunk_text: joined, provider_payload_chunk_text_sha256: 'f'.repeat(64) }]
  };
  const atom = {
    atom_id: 'TEST-P0-0002', tender: 'TEST', source_mode: 'GPT_ATOMIC_NORMALIZATION', page: 1,
    atomic_requirement: '统一身份认证 LDAP', p0_basis: 'coverage', family: 'compatibility'
  };
  const result = buildAnchorForAtom(atom, null, state, undefined, undefined, undefined);
  assert.ok(result.anchors.length >= 2);
});

test('source conflict classification remains unresolved for GPT review', () => {
  const anchor = { raw_source_text: '严重故障次数 0 1 >2', page: 48, paragraph_start: 1, paragraph_end: 1 };
  assert.equal(classifyAuthority({ atom_id: 'FAST-WATER-01-P0-0072', source_mode: 'VERBATIM_LOCAL_SOURCE_EXCERPT' }, [anchor], 1), 'SOURCE_CONFLICT');
});

test('production visibility uses raw anchor text, not atomic normalization', () => {
  const raw = '投标人应支持统一身份认证以及 LDAP 方式接入。';
  const state = {
    chunks: [{ id: 'chunk-raw', chunk_number: 4, text: raw, content_sha256: '1'.repeat(64), provider_payload_chunk_text: raw, provider_payload_chunk_text_sha256: '2'.repeat(64), source_start_page: 2, source_end_page: 2 }],
    scope: { content_text: raw }
  };
  const result = mapAnchorToProduction(state, { raw_source_text: raw });
  assert.equal(result.status, 'PRODUCTION_INPUT_VISIBLE');
  assert.equal(result.provider_input_visible, true);
  assert.equal(result.parse_chunks[0].chunk_id, 'chunk-raw');
});

test('the anchor census does not use Production Canonical candidates as source authority', () => {
  const source = fs.readFileSync(path.join(ROOT, 'backend/eval/flywheel/requirement-p0-source-anchor-v6-1.js'), 'utf8');
  assert.doesNotMatch(source, /candidate_canonicals/);
  assert.match(source, /forbidden_as_source_authority/);
});
