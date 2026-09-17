import test from 'node:test';
import assert from 'node:assert/strict';
import {
  REQUIREMENT_QUALITY_GATE_VERSION,
  evaluateRequirementCandidateQuality
} from '../src/pipeline/requirement-quality-gate.js';
import { aggregateRequirementCandidates } from '../src/pipeline/requirement-chunker.js';
import { buildCanonicalRequirements } from '../src/pipeline/canonical-requirements.js';

const source = '系统应支持数据接口，响应时间不超过3秒，覆盖全市区域。';

test('quality gate accepts an unchanged source-backed candidate', () => {
  const result = evaluateRequirementCandidateQuality({
    text: source,
    source_text: source,
    source_verified: true,
    source_range: { start_ref: 'C001-S001', end_ref: 'C001-S001' }
  });
  assert.equal(result.quality_gate_version, REQUIREMENT_QUALITY_GATE_VERSION);
  assert.equal(result.decision, 'PASS');
  assert.deepEqual(result.reason_codes, []);
});

test('quality gate routes quantity, negation and scope mutations for review', () => {
  for (const text of [
    '系统应支持数据接口，响应时间不超过999秒，覆盖全市区域。',
    '系统应支持数据接口，响应时间不超过3秒，覆盖全市区域，不得满足。',
    '系统应支持数据接口，响应时间不超过3秒，覆盖全国所有区域。'
  ]) {
    const result = evaluateRequirementCandidateQuality({ text, source_text: source, source_verified: true,
      source_range: { start_ref: 'C001-S001', end_ref: 'C001-S001' } });
    assert.equal(result.decision, 'REVIEW_REQUIRED');
    assert.ok(result.reason_codes.length > 0);
  }
});

test('quality gate keeps unresolved source explicit instead of fabricating a pass', () => {
  const result = evaluateRequirementCandidateQuality({ text: '系统应支持接口。', source_verified: false });
  assert.equal(result.decision, 'REVIEW_REQUIRED');
  assert.ok(result.reason_codes.includes('SOURCE_NOT_VERIFIED'));
});

test('production aggregate annotates quality review and disables writer eligibility only for flagged candidates', () => {
  const unchanged = aggregateRequirementCandidates([{
    chunk_number: 1,
    candidates: [{ text: source, source_refs: ['C001-S001'], source_text: source,
      source_verified: true, source_resolution_status: 'verified', source_match_type: 'verified',
      source_page: 1, source_page_start: 1, source_page_end: 1,
      category: 'technical', mandatory_observed: false, requires_confirmation: false }]
  }]);
  assert.equal(unchanged[0].quality_gate_decision, 'PASS');
  assert.equal(unchanged[0].writer_eligible, true);

  const mutated = aggregateRequirementCandidates([{
    chunk_number: 1,
    candidates: [{ text: '系统应支持数据接口，响应时间不超过999秒，覆盖全市区域。', source_refs: ['C001-S001'], source_text: source,
      source_verified: true, source_resolution_status: 'verified', source_match_type: 'verified',
      source_page: 1, source_page_start: 1, source_page_end: 1,
      category: 'technical', mandatory_observed: false, requires_confirmation: false }]
  }]);
  assert.equal(mutated[0].quality_gate_decision, 'REVIEW_REQUIRED');
  assert.equal(mutated[0].semantic_quality_review_required, true);
  assert.equal(mutated[0].writer_eligible, false);
});

test('safe structural list numbers are suppressible only with sufficient context', () => {
  const sourceText = '1. 系统应支持统一身份认证。';
  const candidate = {
    text: '系统应支持统一身份认证。',
    source_text: sourceText,
    source_verified: true,
    source_range: { start_ref: 'C001-S001', end_ref: 'C001-S001' }
  };
  const sufficient = evaluateRequirementCandidateQuality(candidate, { semanticContextSufficient: true });
  assert.equal(sufficient.decision, 'PASS');
  assert.equal(sufficient.reason_codes.includes('NUMBER_OMISSION_REVIEW'), false);
  assert.equal(sufficient.normalization.ignored_structural_numbers.length, 1);

  const insufficient = evaluateRequirementCandidateQuality(candidate, { semanticContextSufficient: false });
  assert.equal(insufficient.decision, 'REVIEW_REQUIRED');
  assert.ok(insufficient.reason_codes.includes('NUMBER_OMISSION_REVIEW'));
});

test('business numbers and identifier-like values remain fail-closed', () => {
  const base = {
    source_text: '系统应支持接口，响应时间不超过3秒。',
    source_verified: true,
    source_range: { start_ref: 'C001-S001', end_ref: 'C001-S001' }
  };
  const quantityMutation = evaluateRequirementCandidateQuality({ ...base, text: '系统应支持接口，响应时间不超过1001秒。' });
  assert.ok(quantityMutation.reason_codes.includes('NUMBER_DISTORTION'));

  const identifierMutation = evaluateRequirementCandidateQuality({
    ...base,
    source_text: '项目编号为12345，系统应支持接口。',
    text: '项目编号为1001，系统应支持接口。'
  });
  assert.ok(identifierMutation.reason_codes.includes('NUMBER_DISTORTION'));
});

test('frozen tender role aliases are normalized while unauthorized entities remain review', () => {
  const base = {
    source_verified: true,
    source_range: { start_ref: 'C001-S001', end_ref: 'C001-S001' }
  };
  const alias = evaluateRequirementCandidateQuality({
    ...base,
    source_text: '我单位应提供项目实施服务。',
    text: '投标人应提供项目实施服务。'
  });
  assert.equal(alias.reason_codes.includes('ENTITY_MISMATCH_REVIEW'), false);

  const unauthorized = evaluateRequirementCandidateQuality({
    ...base,
    source_text: '投标人应提供项目实施服务。',
    text: '某公司应提供项目实施服务。'
  });
  assert.ok(unauthorized.reason_codes.includes('ENTITY_MISMATCH_REVIEW'));
});

test('requirement-bearing modality insertion is safe only without optional qualifiers', () => {
  const base = {
    source_verified: true,
    source_range: { start_ref: 'C001-S001', end_ref: 'C001-S001' }
  };
  const safe = evaluateRequirementCandidateQuality({
    ...base,
    source_text: '提供数据交换接口。',
    text: '应提供数据交换接口。'
  }, { semanticContextSufficient: true });
  assert.equal(safe.reason_codes.includes('MODALITY_ADDITION_REVIEW'), false);

  const cooperate = evaluateRequirementCandidateQuality({
    ...base,
    source_text: '配合院方完成安全检查。',
    text: '应配合院方完成安全检查。'
  }, { semanticContextSufficient: true });
  assert.equal(cooperate.reason_codes.includes('MODALITY_ADDITION_REVIEW'), false);

  const optional = evaluateRequirementCandidateQuality({
    ...base,
    source_text: '可提供数据交换接口。',
    text: '应提供数据交换接口。'
  }, { semanticContextSufficient: true });
  assert.ok(optional.reason_codes.includes('MODALITY_ADDITION_REVIEW'));
});

test('table header dependency remains review-required when context is incomplete', () => {
  const result = evaluateRequirementCandidateQuality({
    text: '并发数量为100。',
    source_text: '数量 | 并发 | 100',
    source_verified: true,
    source_range: { start_ref: 'T001-S001', end_ref: 'T001-S001' }
  }, {
    semanticContextSufficient: false,
    tableContext: { required_header_count: 1, missing_header_count: 1, semantic_context_sufficient: false }
  });
  assert.equal(result.decision, 'REVIEW_REQUIRED');
  assert.ok(result.reason_codes.includes('TABLE_HEADER_CONTEXT_MISSING'));
});

test('presentation-only 可选择 wording is not treated as an explicit mutation', () => {
  const result = evaluateRequirementCandidateQuality({
    text: '安装过程中可选择Oracle模式。',
    source_text: '安装过程中可选择 Oracle 模式。',
    source_verified: true,
    source_range: { start_ref: 'C001-S001', end_ref: 'C001-S001' }
  });
  assert.equal(result.decision, 'PASS');
  assert.equal(result.reason_codes.includes('OBVIOUS_SEMANTIC_MUTATION'), false);
});

test('parent critical consequence omission routes CAN-0149-shaped atomic rows to review', () => {
  const source = '5) 投标有效期不满足招标文件要求的；';
  const parent = '如发现下列情况之一的，其投标将被否决：\n' + source;
  const result = evaluateRequirementCandidateQuality({
    text: '投标有效期须满足招标文件要求。',
    source_text: source,
    source_verified: true,
    source_range: { start_ref: 'C014-S009', end_ref: 'C014-S009' }
  }, { parentContext: parent });
  assert.equal(result.decision, 'REVIEW_REQUIRED');
  assert.ok(result.reason_codes.includes('PARENT_CRITICAL_CONSEQUENCE_OMISSION_REVIEW'));
});

test('parent critical detector covers non-negation child conditions', () => {
  const parent = '如发现下列情况之一的，其投标将被否决：\n6) 超过项目预算金额或招标控制价的；\n20) 低价恶意竞争。';
  for (const [source, text] of [
    ['6) 超过项目预算金额或招标控制价的；', '投标总价不得超过项目预算金额或招标控制价。'],
    ['20) 低价恶意竞争。', '投标人不得进行低价恶意竞争。']
  ]) {
    const result = evaluateRequirementCandidateQuality({
      text,
      source_text: source,
      source_verified: true,
      source_range: { start_ref: 'C014-S010', end_ref: 'C014-S010' }
    }, { parentContext: parent });
    assert.equal(result.decision, 'REVIEW_REQUIRED');
    assert.ok(result.reason_codes.includes('PARENT_CRITICAL_CONSEQUENCE_OMISSION_REVIEW'));
  }
});

test('parent critical consequence does not cross source contexts', () => {
  const result = evaluateRequirementCandidateQuality({
    text: '投标有效期须满足招标文件要求。',
    source_text: '7 投标有效期 投标有效期满足招标文件要求的。',
    source_verified: true,
    source_range: { start_ref: 'C015-S100', end_ref: 'C015-S100' }
  }, { parentContext: '附表二符合性审查表\n投标有效期满足招标文件要求的。' });
  assert.equal(result.reason_codes.includes('PARENT_CRITICAL_CONSEQUENCE_OMISSION_REVIEW'), false);
});

test('parent consequence already retained in candidate is not flagged', () => {
  const source = '未提供将作为无效投标处理。';
  const result = evaluateRequirementCandidateQuality({
    text: '未提供将作为无效投标处理。',
    source_text: source,
    source_verified: true,
    source_range: { start_ref: 'C001-S001', end_ref: 'C001-S001' }
  }, { parentContext: `如发现下列情况之一的，其投标将被否决：\n${source}` });
  assert.equal(result.reason_codes.includes('PARENT_CRITICAL_CONSEQUENCE_OMISSION_REVIEW'), false);
});

test('canonical requirement pipeline forwards parent context only to the dedicated detector', () => {
  const source = '5) 投标有效期不满足招标文件要求的；';
  const [result] = buildCanonicalRequirements([{
    text: '投标有效期须满足招标文件要求。',
    category: 'other',
    source_text: source,
    source_context_text: `如发现下列情况之一的，其投标将被否决：\n${source}`,
    source_verified: true,
    source_match_type: 'exact_single_paragraph',
    source_resolution_status: 'verified',
    source_range: { start_ref: 'C014-S009', end_ref: 'C014-S009' },
    source_page: 14,
    source_paragraph: 484
  }], { qualityGate: true });
  assert.equal(result.quality_gate_decision, 'REVIEW_REQUIRED');
  assert.ok(result.quality_gate_reason_codes.includes('PARENT_CRITICAL_CONSEQUENCE_OMISSION_REVIEW'));
});

test('parent critical detector covers a governed review table child', () => {
  const parent = '投标无效情形\n投标人须满足附表二符合性审查表的全部内容，否则其投标无效。\n附表二符合性审查表\n7 投标有效期 投标有效期满足招标文件要求的。';
  const result = evaluateRequirementCandidateQuality({
    text: '投标有效期须满足招标文件要求。',
    source_text: '7 投标有效期 投标有效期满足招标文件要求的。',
    source_verified: true,
    source_range: { start_ref: 'C0208-S100', end_ref: 'C0208-S100' }
  }, { parentContext: parent });
  assert.equal(result.decision, 'REVIEW_REQUIRED');
  assert.ok(result.reason_codes.includes('PARENT_CRITICAL_CONSEQUENCE_OMISSION_REVIEW'));
  assert.equal(result.parent_consequence.alignment, 'GOVERNING_CRITICAL_TABLE');
});

test('parent critical detector covers direct table consequence relation', () => {
  const parent = '检查表任何一项不符合则不予受理。\n检查表\n投标有效期满足招标文件要求的。';
  const result = evaluateRequirementCandidateQuality({
    text: '投标有效期须满足招标文件要求。',
    source_text: '投标有效期满足招标文件要求的。',
    source_verified: true,
    source_range: { start_ref: 'C0208-S101', end_ref: 'C0208-S101' }
  }, { parentContext: parent });
  assert.equal(result.decision, 'REVIEW_REQUIRED');
  assert.ok(result.reason_codes.includes('PARENT_CRITICAL_CONSEQUENCE_OMISSION_REVIEW'));
  assert.equal(result.parent_consequence.alignment, 'GOVERNING_CRITICAL_TABLE');
});

test('parent critical detector does not propagate through an independent structure', () => {
  const parent = '如发现下列情况之一的，其投标将被否决：\n1 投标保证金满足要求。\n\n第二章 技术参数表\n投标有效期满足招标文件要求的。';
  const result = evaluateRequirementCandidateQuality({
    text: '投标有效期须满足招标文件要求。',
    source_text: '投标有效期满足招标文件要求的。',
    source_verified: true,
    source_range: { start_ref: 'INDEPENDENT-S1', end_ref: 'INDEPENDENT-S1' }
  }, { parentContext: parent });
  assert.equal(result.reason_codes.includes('PARENT_CRITICAL_CONSEQUENCE_OMISSION_REVIEW'), false);
});
