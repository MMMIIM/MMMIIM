import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateRequirementCandidateQuality } from '../src/pipeline/requirement-quality-gate.js';
import { NUMBER_OMISSION_TRUE_ERROR_CONTROLS } from '../eval/requirement-p1-semantic-calibration/number-omission-controls-v2.mjs';

const range = { start_ref: 'C008-S034', end_ref: 'C008-S035' };
const evaluate = (sourceText, text) => evaluateRequirementCandidateQuality({
  text,
  source_text: sourceText,
  source_verified: true,
  source_range: range
}, { semanticContextSufficient: true });

test('sibling numeric assertions in one source span do not trigger omission review', () => {
  const source = '满足全市在线用户量>=10000人。满足全市同时支持并发量100次/秒，普通话智能识别率≥98%。';
  const result = evaluate(source, '系统需支持并发量100次/秒。');
  assert.equal(result.decision, 'PASS');
  assert.equal(result.reason_codes.includes('NUMBER_OMISSION_REVIEW'), false);
});

test('sibling interface and page latency numbers are aligned to their own clauses', () => {
  const source = '数据服务类接口响应时间需<=1秒。常规页面展示响应时间需<=3秒。';
  const api = evaluate(source, '数据服务类接口响应时间需<=1秒。');
  const page = evaluate(source, '常规页面展示响应时间需<=3秒。');
  assert.equal(api.decision, 'PASS');
  assert.equal(page.decision, 'PASS');
  assert.equal(api.reason_codes.includes('NUMBER_OMISSION_REVIEW'), false);
  assert.equal(page.reason_codes.includes('NUMBER_OMISSION_REVIEW'), false);
});

test('sibling query latency number is not owned by another canonical requirement', () => {
  const source = '数据查询：网格、网格要素查询时间<1秒。统计分析类查询响应时间需<=10秒。';
  const result = evaluate(source, '统计分析类查询响应时间需<=10秒。');
  assert.equal(result.decision, 'PASS');
  assert.equal(result.reason_codes.includes('NUMBER_OMISSION_REVIEW'), false);
});

test('same atomic business number omissions remain fail closed', () => {
  for (const control of NUMBER_OMISSION_TRUE_ERROR_CONTROLS) {
    const result = evaluate(control.source_text, control.candidate_text);
    assert.equal(result.decision, control.expected_decision, control.control_id);
    assert.ok(result.reason_codes.includes(control.expected_reason), control.control_id);
  }
});
