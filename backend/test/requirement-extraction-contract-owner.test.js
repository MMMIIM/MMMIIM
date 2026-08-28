import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SEMANTIC_TASK_INSTRUCTIONS,
  getSemanticTaskContract,
  getSemanticTaskInstructionMetadata,
  resolveSemanticTaskInstruction,
  validateTaskData
} from '../../packages/semantic-contracts/index.js';
import { createSemanticTaskRouter } from '../../services/semantic-gateway/src/task-router.js';
import { createStandaloneGatewayServer } from '../../services/semantic-gateway/src/gateway.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const requirementExtractionSource = fs.readFileSync(
  path.resolve(here, '../src/pipeline/requirement-extraction.js'),
  'utf8'
);

test('Requirement Extraction has exactly one canonical instruction and explicit hash', () => {
  const metadata = getSemanticTaskInstructionMetadata('requirement_extraction');
  assert.ok(metadata);
  const activeRequirementInstructions = Object.entries(SEMANTIC_TASK_INSTRUCTIONS)
    .filter(([taskType, instruction]) => taskType === 'requirement_extraction' && typeof instruction === 'string' && instruction.trim());
  assert.equal(activeRequirementInstructions.length, 1);
  assert.equal(metadata.instruction, resolveSemanticTaskInstruction('requirement_extraction'));
  assert.equal(metadata.contract_version, getSemanticTaskContract('requirement_extraction').contract_version);
  assert.match(metadata.instruction_hash, /^[a-f0-9]{64}$/);
  const schema = getSemanticTaskContract('requirement_extraction').data_schema;
  assert.deepEqual(schema.properties.requirements.items.required, [
    'text', 'category', 'source_range', 'mandatory_observed', 'requires_confirmation'
  ]);
  assert.equal(schema.properties.requirements.items.additionalProperties, false);
  assert.match(requirementExtractionSource, /resolveSemanticTaskInstruction/);
  assert.doesNotMatch(requirementExtractionSource, /REQUIREMENT_EXTRACTION_INSTRUCTION/);
  assert.doesNotMatch(requirementExtractionSource, /从招标文件文本中提取候选需求。/);
});

test('Requirement Extraction prompt requires a complete requirements-only top-level object', () => {
  const instruction = resolveSemanticTaskInstruction('requirement_extraction');
  assert.match(instruction, /【最终输出结构】/);
  assert.match(instruction, /最外层必须且只能是一个 JSON 对象/);
  assert.match(instruction, /最外层只允许 requirements 一个字段/);
  assert.match(instruction, /requirements 必须始终为数组/);
  assert.match(instruction, /不得将以下 Candidate 字段直接放在最外层/);
  assert.match(instruction, /\"requirements\": \[\.\.\.\]/);
  assert.match(instruction, /\"requirements\": \[\]/);
  assert.match(instruction, /必须完整检查整个 chunk_text 后再输出/);
  assert.match(instruction, /不得只提取第一条、前几条或示例性 Requirement/);
  assert.match(instruction, /所有明确存在且符合提取范围的独立响应义务都应进入 requirements/);
});

test('Requirement Extraction v3 prompt forbids placeholder candidates and requires source ranges', () => {
  const contract = getSemanticTaskContract('requirement_extraction');
  const instruction = resolveSemanticTaskInstruction('requirement_extraction');
  assert.equal(contract.contract_version, '4.3-requirement-extraction-v3');
  assert.match(instruction, /只返回实际识别出的 Requirement/);
  assert.match(instruction, /不得生成占位 Candidate/);
  assert.match(instruction, /text 必须是非空/);
  assert.match(instruction, /没有 Requirement 的来源段落不得生成 Candidate/);
  assert.match(instruction, /候选数量不必等于来源段落数量/);
  assert.match(instruction, /不得用空 Candidate 表示已检查的段落/);
  assert.match(instruction, /一个来源段落可以支持零条、一条或多条独立 Requirement/);
  assert.match(instruction, /source_range 表示能够直接证明该 Requirement 的一个最小充分连续原文范围/);
  assert.match(instruction, /start_ref.*end_ref/);
  assert.match(instruction, /不得跳过范围内的中间段落/);
  assert.match(instruction, /不得.*两个不相邻的证据区域/);
  assert.match(instruction, /不得编造不存在的 start_ref 或 end_ref/);
});

test('Gateway Task Router resolves the canonical instruction and emits contract metadata', async () => {
  let invocation;
  const router = createSemanticTaskRouter({
    provider: {
      async invoke(input) {
        invocation = input;
        return { data: { requirements: [] }, provider_audit: { model: 'fixture' } };
      }
    }
  });
  const result = await router.dispatch({ taskType: 'requirement_extraction', payload: {} });
  const contract = getSemanticTaskContract('requirement_extraction');
  assert.equal(invocation.instruction, resolveSemanticTaskInstruction('requirement_extraction'));
  assert.equal(result.provider_audit.semantic_contract_version, contract.contract_version);
  assert.equal(result.provider_audit.instruction_sha256, contract.instruction_hash);
});

test('Requirement Extraction shared validator enforces the five-field Candidate v3 schema', () => {
  const candidate = {
    text: '系统应提供审计日志。',
    category: 'technical',
    source_range: { start_ref: 'C001-S001', end_ref: 'C001-S001' },
    mandatory_observed: true,
    requires_confirmation: false
  };
  assert.deepEqual(validateTaskData('requirement_extraction', { requirements: [candidate] }), { requirements: [candidate] });
  for (const invalid of [
    { ...candidate, legacy: true },
    { ...candidate, mandatory_observed: 'true' },
    { ...candidate, requires_confirmation: 0 },
    { ...candidate, category: 'not-a-category' },
    { ...candidate, text: '' },
    { ...candidate, text: '   ' },
    { ...candidate, source_range: { start_ref: 'C001-S001', end_ref: 'C001-S002', extra: true } },
    { ...candidate, source_range: { start_ref: 'bad', end_ref: 'C001-S001' } },
    { ...candidate, source_refs: ['C001-S001'] },
    (() => { const copy = { ...candidate }; delete copy.source_range; return copy; })()
  ]) {
    assert.throws(() => validateTaskData('requirement_extraction', { requirements: [invalid] }), /unsupported fields|missing|required|canonical categories|boolean|non-empty|deterministic/);
  }
});

test('Gateway rejects supplied contract metadata drift before Provider invocation', async () => {
  let providerCalled = false;
  const router = createSemanticTaskRouter({
    provider: {
      async invoke() {
        providerCalled = true;
        return { data: { requirements: [] } };
      }
    }
  });
  await assert.rejects(
    () => router.dispatch({ taskType: 'requirement_extraction', payload: {}, contractVersion: 'old-contract' }),
    error => error.code === 'SEMANTIC_CONTRACT_DRIFT'
  );
  await assert.rejects(
    () => router.dispatch({
      taskType: 'requirement_extraction',
      payload: {},
      instructionHash: '0'.repeat(64)
    }),
    error => error.code === 'SEMANTIC_CONTRACT_DRIFT'
  );
  assert.equal(providerCalled, false);
});

test('Gateway HTTP path ignores caller prompt text and uses the canonical Requirement instruction', async () => {
  let invocation;
  const apiKey = 'contract-owner-test-key';
  const server = createStandaloneGatewayServer({
    config: {
      apiKey,
      providerName: 'mock',
      provider: {
        model: 'fixture',
        async invoke(input) {
          invocation = input;
          return { data: { requirements: [] } };
        }
      }
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/workflows/run`, {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        inputs: {
          task_type: 'requirement_extraction',
          task_instruction: 'caller-owned competing prompt',
          task_payload_json: '{}'
        }
      })
    });
    assert.equal(response.status, 200);
    assert.equal(invocation.instruction, resolveSemanticTaskInstruction('requirement_extraction'));
    assert.notEqual(invocation.instruction, 'caller-owned competing prompt');
  } finally {
    await new Promise((resolve, reject) => server.close(error => (error ? reject(error) : resolve())));
  }
});

test('Unrelated semantic task instructions continue to resolve through the same registry', () => {
  const metadata = getSemanticTaskInstructionMetadata('section_drafting');
  assert.equal(metadata.instruction, resolveSemanticTaskInstruction('section_drafting'));
  assert.match(metadata.instruction_hash, /^[a-f0-9]{64}$/);
});
