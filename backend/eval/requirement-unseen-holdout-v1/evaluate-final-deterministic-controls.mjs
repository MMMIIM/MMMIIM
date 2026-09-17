import fs from 'node:fs';
import path from 'node:path';
import { evaluateRequirementCandidateQuality } from '../../src/pipeline/requirement-quality-gate.js';

const outDir = path.resolve('backend/eval/requirement-unseen-holdout-v1/results/unseen-holdout-v1-2026-09-08T06-21-08-203Z-5faac1ab/critical-structure-final-20260908093747');
fs.mkdirSync(outDir, { recursive: true });

const evaluate = ({ sourceText, parentContext = '', candidateText = '投标有效期须满足招标文件要求。', options = {} }) =>
  evaluateRequirementCandidateQuality({
    text: candidateText,
    source_text: sourceText,
    source_verified: true,
    source_range: { start_ref: 'CONTROL-SOURCE', end_ref: 'CONTROL-SOURCE' }
  }, { parentContext, ...options });

const child = '投标有效期满足招标文件要求的。';
const trueCases = [
  ['P0-LIST-01', child, '下列情况之一的，其投标将被否决：\n投标有效期满足招标文件要求的。'],
  ['P0-LIST-02', child, '以下情形，其投标无效：\n投标有效期满足招标文件要求的。'],
  ['P0-LIST-03', child, '如下任一情况的，取消资格：\n投标有效期满足招标文件要求的。'],
  ['P0-LIST-04', child, '附表一所列相应条款不符合的，资格不合格：\n投标有效期满足招标文件要求的。'],
  ['P0-TABLE-01', child, '投标无效情形\n投标人须满足附表二符合性审查表的全部内容，否则其投标无效。\n附表二符合性审查表\n投标有效期满足招标文件要求的。'],
  ['P0-TABLE-02', child, '资格审查表所有项目，如有一项不符合则投标被否决。\n资格审查表\n投标有效期满足招标文件要求的。'],
  ['P0-TABLE-03', child, '评审矩阵任一项不满足，审查不通过。\n评审矩阵\n投标有效期满足招标文件要求的。'],
  ['P0-TABLE-04', child, '检查表任何一项不符合则不予受理。\n检查表\n投标有效期满足招标文件要求的。'],
  ['P0-TABLE-05', child, '符合性审查表以下全部内容，否则其投标将被否决。\n符合性审查表\n投标有效期满足招标文件要求的。'],
  ['P0-TABLE-06', child, '附表三所有项目，如有一项不满足即投标无效。\n附表三\n投标有效期满足招标文件要求的。'],
  ['P0-TABLE-07', child, '审查矩阵任一项不符合则取消资格。\n审查矩阵\n投标有效期满足招标文件要求的。'],
  ['P0-TABLE-08', child, '资格审查表的全部内容，否则资格不合格。\n资格审查表\n投标有效期满足招标文件要求的。']
];

const negativeCases = [
  ['P0-NEG-01', '技术参数表\n响应时间≤1秒。', '技术参数表\n响应时间≤1秒。\n投标有效期满足招标文件要求的。'],
  ['P0-NEG-02', '评分表\n不满足得0分。', '评分表\n不满足得0分。\n投标有效期满足招标文件要求的。'],
  ['P0-NEG-03', '要求列表\n投标有效期满足招标文件要求的。', '要求列表\n投标有效期满足招标文件要求的。'],
  ['P0-NEG-04', '附表二符合性审查表\n投标无效情形\n投标有效期满足招标文件要求的。\n第二章技术参数表\n响应时间≤1秒。', '附表二符合性审查表\n投标无效情形\n投标有效期满足招标文件要求的。\n第二章技术参数表\n投标有效期满足招标文件要求的。']
];

const p0 = [
  ...trueCases.map(([id, source, parent]) => ({ id, expected: 'REVIEW_REQUIRED', result: evaluate({ sourceText: source, parentContext: parent }) })),
  ...negativeCases.map(([id, source, parent]) => ({ id, expected: 'NO_PARENT_REVIEW', result: evaluate({ sourceText: source, parentContext: parent }) }))
];
const p0Results = p0.map(({ id, expected, result }) => ({
  id,
  expected,
  actual: expected === 'REVIEW_REQUIRED'
    ? result.decision
    : result.reason_codes.includes('PARENT_CRITICAL_CONSEQUENCE_OMISSION_REVIEW') ? 'REVIEW_REQUIRED' : 'NO_PARENT_REVIEW',
  reason_codes: result.reason_codes,
  pass: expected === 'REVIEW_REQUIRED'
    ? result.decision === 'REVIEW_REQUIRED' && result.reason_codes.includes('PARENT_CRITICAL_CONSEQUENCE_OMISSION_REVIEW')
    : !result.reason_codes.includes('PARENT_CRITICAL_CONSEQUENCE_OMISSION_REVIEW')
}));

const numberCases = [
  ['NUM-01-STRUCTURAL-SUPPRESS', evaluate({ sourceText: '1. 系统应支持统一身份认证。', candidateText: '系统应支持统一身份认证。', options: { semanticContextSufficient: true } }), 'PASS'],
  ['NUM-02-STRUCTURAL-REVIEW', evaluate({ sourceText: '1. 系统应支持统一身份认证。', candidateText: '系统应支持统一身份认证。', options: { semanticContextSufficient: false } }), 'REVIEW_REQUIRED'],
  ['NUM-03-BUSINESS-DISTORTION', evaluate({ sourceText: '系统应支持接口，响应时间不超过3秒。', candidateText: '系统应支持接口，响应时间不超过1001秒。' }), 'NUMBER_DISTORTION'],
  ['NUM-04-IDENTIFIER-DISTORTION', evaluate({ sourceText: '项目编号为12345，系统应支持接口。', candidateText: '项目编号为1001，系统应支持接口。' }), 'NUMBER_DISTORTION']
].map(([id, result, expected]) => ({ id, expected, actual: expected === 'NUMBER_DISTORTION' && result.reason_codes.includes(expected) ? expected : result.decision, reason_codes: result.reason_codes, pass: expected === 'NUMBER_DISTORTION' ? result.reason_codes.includes(expected) : result.decision === expected }));

const artifact = {
  artifact_type: 'V43_PARALLEL_FINAL_DETERMINISTIC_CONTROL_MATRIX',
  eval_only: true,
  provider_calls: 0,
  production_db_writes: 0,
  gold_mutations: 0,
  p0_controls: {
    total: trueCases.length,
    passed: p0Results.slice(0, trueCases.length).filter(item => item.pass).length,
    results: p0Results.slice(0, trueCases.length)
  },
  negative_containment_controls: {
    total: negativeCases.length,
    passed: p0Results.slice(trueCases.length).filter(item => item.pass).length,
    results: p0Results.slice(trueCases.length)
  },
  combined_structure_controls: { total: p0Results.length, passed: p0Results.filter(item => item.pass).length },
  number_controls: { total: numberCases.length, passed: numberCases.filter(item => item.pass).length, results: numberCases }
};
fs.writeFileSync(path.join(outDir, 'deterministic-controls.json'), `${JSON.stringify(artifact, null, 2)}\n`);
console.log(JSON.stringify({ outDir, p0: artifact.p0_controls, numbers: artifact.number_controls }, null, 2));
