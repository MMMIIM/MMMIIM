import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveSemanticTaskInstruction } from '../../packages/semantic-contracts/index.js';

test('Requirement Producer 指令覆盖投标资格、无效后果及其关联义务', () => {
  const instruction = resolveSemanticTaskInstruction('requirement_extraction');

  assert.match(instruction, /资格|符合性/);
  assert.match(instruction, /无效|拒绝|否决|不予受理/);
  assert.match(instruction, /签署|盖章|签字/);
  assert.match(instruction, /报价.*(限价|预算|上限)|付款/);
});

test('Requirement Producer 指令要求保留表格行与共享表头的实质关联', () => {
  const instruction = resolveSemanticTaskInstruction('requirement_extraction');

  assert.match(instruction, /表格.*行/);
  assert.match(instruction, /表头|合并单元格|共享/);
  assert.match(instruction, /数量|期限|频率|阈值|性能/);
});
