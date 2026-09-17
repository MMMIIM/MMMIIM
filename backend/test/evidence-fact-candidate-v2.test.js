import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  EVIDENCE_FACT_CANDIDATE_V2_SCHEMA,
  EVIDENCE_FACT_CANDIDATE_V2_SCHEMA_VERSION,
  EVIDENCE_FACT_CANDIDATE_V2_SCHEMA_SHA256,
  getSemanticTaskContract,
  validateTaskData
} from '../../packages/semantic-contracts/index.js';
import {
  MODEL_FACING_MAX_NESTING,
  createEvidenceFactSourceSnapshot,
  createEvidenceFactProducerVersionSnapshot,
  evidenceFactSourceSnapshotMatches,
  stableEvidenceFactProducerVersionIdentity,
  canonicalizeEvidenceFactCandidateV2,
  groundCanonicalEvidenceFactCandidateV2,
  stableCanonicalEvidenceFactIdentity
} from '../src/pipeline/evidence-fact-candidate-v2.js';
import {
  buildEvidenceFactCandidateV2SemanticInput,
  FACT_CANDIDATE_V2_AUDIT,
  SemanticGatewayEvidenceFactExtractor
} from '../src/pipeline/semantic-gateway-evidence-fact-extractor.js';

const sourceText = '澄川平台支持不低于1000个并发用户，已于2026-08-01完成安全测试，部署范围为测试环境。';
const provenance = source => ({ source_text: source, source_refs: ['chunk-001/span-001'] });
const candidate = {
  statement: sourceText,
  subject_name: '澄川平台',
  subject_type_hint: 'product',
  entity_mentions: [{ value: '澄川平台', type_hint: 'product', provenance: provenance('澄川平台') }],
  status_text: '完成安全测试',
  scope_items: [{ value: '测试环境', provenance: provenance('部署范围为测试环境') }],
  quantity_items: [{
    name: '并发用户数', value_text: '1000', unit_text: '用户', condition_text: '不低于',
    provenance: provenance('不低于1000个并发用户')
  }],
  temporal_items: [{ value_text: '2026-08-01', context_text: '完成安全测试', provenance: provenance('已于2026-08-01完成安全测试') }]
};

test('Candidate V2 contract is strict and model-facing surface excludes authority metadata', () => {
  assert.equal(EVIDENCE_FACT_CANDIDATE_V2_SCHEMA_VERSION, '4.3-evidence-fact-candidate-v2');
  assert.equal(EVIDENCE_FACT_CANDIDATE_V2_SCHEMA.additionalProperties, false);
  assert.equal(EVIDENCE_FACT_CANDIDATE_V2_SCHEMA.properties.facts.items.additionalProperties, false);
  assert.equal(MODEL_FACING_MAX_NESTING, 3);
  assert.equal(typeof EVIDENCE_FACT_CANDIDATE_V2_SCHEMA_SHA256, 'string');
  assert.deepEqual(getSemanticTaskContract('evidence_fact_candidate_v2').data_schema, EVIDENCE_FACT_CANDIDATE_V2_SCHEMA);
  assert.deepEqual(validateTaskData('evidence_fact_candidate_v2', { facts: [] }), { facts: [] });
});

test('Candidate V2 requires one unified provenance shape for every substantive observation', () => {
  assert.deepEqual(validateTaskData('evidence_fact_candidate_v2', { facts: [candidate] }, { source_text: sourceText }), { facts: [candidate] });
  const missingProvenance = structuredClone(candidate);
  delete missingProvenance.quantity_items[0].provenance;
  assert.throws(() => validateTaskData('evidence_fact_candidate_v2', { facts: [missingProvenance] }, { source_text: sourceText }), /provenance/);
});

for (const field of ['domain_metadata', 'claim_permission', 'human_review_required', 'fact_id', 'lifecycle']) {
  test(`Candidate V2 rejects authority field ${field}`, () => {
    const invalid = structuredClone(candidate);
    invalid[field] = field === 'domain_metadata' ? {} : true;
    assert.throws(() => validateTaskData('evidence_fact_candidate_v2', { facts: [invalid] }, { source_text: sourceText }), /unsupported fields|contains unsupported|additional|data\.facts/);
  });
}

test('Candidate V2 payload uses the existing approved source boundary only', () => {
  const payload = buildEvidenceFactCandidateV2SemanticInput({
    review_status: 'approved',
    evidence_review_contract_version: 'evidence-review-v1',
    source_text: sourceText,
    source_text_hash: createHash('sha256').update(sourceText).digest('hex'),
    project_id: 'project-1', review_id: 'review-1', source_span_id: 'span-1', material_id: 'material-1',
    material_type: 'project_case'
  });
  assert.deepEqual(Object.keys(payload).sort(), ['material', 'source_text']);
  assert.equal(Object.hasOwn(payload, 'claim_permission'), false);
});

test('deterministic quantity normalization maps 不低于1000 to >=1000', () => {
  const result = canonicalizeEvidenceFactCandidateV2(candidate, { sourceText });
  assert.equal(result.status, 'CANONICALIZED');
  assert.deepEqual(result.canonical.quantities[0], {
    metric: '并发用户数', value: '1000', unit: 'users', operator: '>=', source_text: '不低于1000个并发用户'
  });
  assert.equal(groundCanonicalEvidenceFactCandidateV2(result, { sourceText }).decision, 'ACCEPT');
});

test('source-grounded limitation with a generic report prefix is reviewable, not rejected', () => {
  const source = '不代表通过等保、密评或第三方认证。';
  const limitation = {
    statement: '该测试报告不代表通过等保、密评或第三方认证。',
    subject_name: '权限、安全与审计测试报告',
    subject_type_hint: '测试报告',
    entity_mentions: [{ value: '等保', type_hint: '认证类型', provenance: provenance(source) }],
    status_text: '不代表通过',
    scope_items: [], quantity_items: [], temporal_items: []
  };
  const result = canonicalizeEvidenceFactCandidateV2(limitation, { sourceText: `${source}\n权限、安全与审计测试报告` });
  const grounded = groundCanonicalEvidenceFactCandidateV2(result, { sourceText: `${source}\n权限、安全与审计测试报告` });
  assert.equal(grounded.decision, 'REVIEW_REQUIRED');
  assert.ok(grounded.reasons.includes('NEGATED_OR_UNCERTAIN_STATUS'));
  assert.equal(grounded.reasons.some(reason => /statement is not grounded/.test(reason)), false);
});

test('negative certification boundary stays reviewable for equivalent wording', () => {
  const source = '不代表通过等保、密评或第三方认证。';
  for (const statusText of ['不代表通过', '不代表通过等保、密评或第三方认证']) {
    const limitation = {
      statement: statusText === '不代表通过'
        ? '该测试报告不代表通过等保、密评或第三方认证。'
        : '不代表通过等保、密评或第三方认证。',
      subject_name: '权限、安全与审计测试报告',
      subject_type_hint: '测试报告',
      entity_mentions: [],
      status_text: statusText,
      scope_items: [], quantity_items: [], temporal_items: []
    };
    const result = canonicalizeEvidenceFactCandidateV2(limitation, { sourceText: `${source}\n权限、安全与审计测试报告` });
    const grounded = groundCanonicalEvidenceFactCandidateV2(result, { sourceText: `${source}\n权限、安全与审计测试报告` });
    assert.equal(grounded.decision, 'REVIEW_REQUIRED');
    assert.ok(grounded.reasons.includes('NEGATED_OR_UNCERTAIN_STATUS'));
  }
});

test('bounded negative status markers never become positive status enums', () => {
  for (const statusText of ['未验证', '不等同于第三方认证', '不得使用过期证书', '不能证明政务事件协同能力']) {
    const limited = {
      statement: statusText,
      subject_name: '边界对象', subject_type_hint: 'record',
      entity_mentions: [], status_text: statusText,
      scope_items: [], quantity_items: [], temporal_items: []
    };
    const result = canonicalizeEvidenceFactCandidateV2(limited, { sourceText: statusText });
    assert.equal(result.canonical.status, 'unknown');
    assert.equal(result.canonical.status_source_text, statusText);
    assert.ok(result.review_reasons.includes('NEGATED_OR_UNCERTAIN_STATUS'));
  }
});

test('negative scope limitation remains reviewable without adding a contract field', () => {
  const statement = '该行业案例只证明医疗接口集成测试能力，不证明政务事件协同能力。';
  const limited = {
    statement,
    subject_name: '该行业案例', subject_type_hint: '案例',
    entity_mentions: [
      { value: '医疗接口集成测试能力', type_hint: '能力', provenance: provenance(statement) },
      { value: '政务事件协同能力', type_hint: '能力', provenance: provenance(statement) }
    ],
    status_text: null,
    scope_items: [{ value: '医疗接口集成测试能力', provenance: provenance(statement) }],
    quantity_items: [], temporal_items: []
  };
  const result = canonicalizeEvidenceFactCandidateV2(limited, { sourceText: statement });
  assert.equal(result.status, 'CANONICALIZATION_REVIEW_REQUIRED');
  assert.ok(result.review_reasons.includes('NEGATED_OR_LIMITED_SCOPE'));
});

test('status source text may be a bounded compositional source phrase', () => {
  const source = '测试发现1项越权缺陷，已在XSA 2.8.3修复并复测通过。';
  const limited = {
    statement: source,
    subject_name: '越权缺陷', subject_type_hint: '缺陷',
    entity_mentions: [{ value: 'XSA 2.8.3', type_hint: '版本', provenance: provenance(source) }],
    status_text: '已修复并复测通过',
    scope_items: [],
    quantity_items: [{ name: '越权缺陷数量', value_text: '1', unit_text: '项', condition_text: null, provenance: provenance(source) }],
    temporal_items: []
  };
  const result = canonicalizeEvidenceFactCandidateV2(limited, { sourceText: source });
  const grounded = groundCanonicalEvidenceFactCandidateV2(result, { sourceText: source });
  assert.notEqual(grounded.decision, 'REJECT');
  assert.equal(grounded.reasons.some(reason => /status_source_text is not grounded/.test(reason)), false);
});

test('bounded compositional grounding accepts a faithful parenthetical alias omission', () => {
  const source = '澄川数智科技有限公司（Synthetic Demo Company） 为虚构测试企业，定位政企与医疗信息化软件服务商。';
  const composed = {
    statement: '澄川数智科技有限公司为虚构测试企业，定位政企与医疗信息化软件服务商。',
    subject_name: '澄川数智科技有限公司',
    subject_type_hint: '公司',
    entity_mentions: [{ value: '澄川数智科技有限公司', type_hint: '公司', provenance: provenance(source) }],
    status_text: '虚构测试企业',
    scope_items: [{ value: '政企与医疗信息化软件服务商', provenance: provenance(source) }],
    quantity_items: [], temporal_items: []
  };
  const result = canonicalizeEvidenceFactCandidateV2(composed, { sourceText: source });
  const grounded = groundCanonicalEvidenceFactCandidateV2(result, { sourceText: source });
  assert.equal(grounded.decision, 'REVIEW_REQUIRED');
  assert.ok(grounded.reasons.includes('STATUS_ENUM_UNRESOLVED'));
  assert.equal(grounded.reasons.some(reason => /statement is not grounded/.test(reason)), false);
  assert.equal(grounded.source_grounding.mode, 'BOUNDED_COMPOSITIONAL');
});

test('bounded compositional grounding rejects fields assembled from separate source units', () => {
  const source = '澄川数智科技有限公司为虚构测试企业。\n\n定位政企与医疗信息化软件服务商。';
  const composed = {
    statement: '澄川数智科技有限公司为虚构测试企业，定位政企与医疗信息化软件服务商。',
    subject_name: '澄川数智科技有限公司',
    subject_type_hint: '公司',
    entity_mentions: [{ value: '澄川数智科技有限公司', type_hint: '公司', provenance: provenance(source) }],
    status_text: '虚构测试企业',
    scope_items: [{ value: '政企与医疗信息化软件服务商', provenance: provenance(source) }],
    quantity_items: [], temporal_items: []
  };
  const result = canonicalizeEvidenceFactCandidateV2(composed, { sourceText: source });
  const grounded = groundCanonicalEvidenceFactCandidateV2(result, { sourceText: source });
  assert.equal(grounded.decision, 'REJECT');
  assert.ok(grounded.reasons.includes('statement is not grounded'));
});

test('minute unit alias grounds after canonical MINUTE normalization', () => {
  const source = '测试持续时间为120分钟。';
  const candidate = {
    statement: source,
    subject_name: '测试', subject_type_hint: '性能测试',
    entity_mentions: [], status_text: null, scope_items: [],
    quantity_items: [{ name: '持续时间', value_text: '120', unit_text: '分钟', condition_text: '测试', provenance: provenance(source) }],
    temporal_items: []
  };
  const result = canonicalizeEvidenceFactCandidateV2(candidate, { sourceText: source });
  const grounded = groundCanonicalEvidenceFactCandidateV2(result, { sourceText: source });
  assert.equal(grounded.decision, 'REVIEW_REQUIRED');
  assert.ok(grounded.reasons.includes('QUANTITY_QUALIFIER_CONTRACT_GAP'));
  assert.equal(grounded.reasons.some(reason => /quantity\.unit is not grounded/.test(reason)), false);
});

for (const phrase of ['高并发', '响应较快']) {
  test(`${phrase} remains review required instead of inferred quantity`, () => {
    const ambiguous = structuredClone(candidate);
    ambiguous.statement = `系统${phrase}`;
    ambiguous.subject_name = '澄川平台';
    ambiguous.entity_mentions = [{ value: '澄川平台', type_hint: 'product', provenance: provenance('澄川平台') }];
    ambiguous.scope_items = [];
    ambiguous.temporal_items = [];
    ambiguous.quantity_items = [{ name: '性能', value_text: null, unit_text: null, condition_text: null, provenance: provenance(phrase) }];
    ambiguous.statement = `澄川平台${phrase}`;
    const result = canonicalizeEvidenceFactCandidateV2(ambiguous, { sourceText: `澄川平台${phrase}` });
    assert.equal(result.status, 'CANONICALIZATION_REVIEW_REQUIRED');
    assert.equal(result.canonical.quantities.length, 0);
    assert.match(result.review_reasons.join(','), /QUANTITY_VALUE_OR_UNIT_UNRESOLVED/);
  });
}

test('temporal observation records event date without creating validity dates', () => {
  const result = canonicalizeEvidenceFactCandidateV2(candidate, { sourceText });
  assert.deepEqual(result.canonical.validity, { status: 'unknown', valid_from: null, valid_until: null });
  assert.deepEqual(result.temporal_observations[0].event_date, '2026-08-01');
});

test('test environment remains test environment and security test is not certification', () => {
  const result = canonicalizeEvidenceFactCandidateV2(candidate, { sourceText });
  assert.equal(result.canonical.scopes[0], '测试环境');
  assert.notEqual(result.canonical.scopes[0], '生产环境');
  assert.equal(result.canonical.status, 'completed');
  assert.notEqual(result.canonical.status, 'certified');
});

test('unsupported assertion fails grounding rather than being repaired', () => {
  const unsupported = structuredClone(candidate);
  unsupported.statement = '澄川平台通过ISO27001认证';
  unsupported.status_text = '通过ISO27001认证';
  const result = canonicalizeEvidenceFactCandidateV2(unsupported, { sourceText });
  assert.equal(groundCanonicalEvidenceFactCandidateV2(result, { sourceText }).decision, 'REJECT');
});

test('historical structural failure shapes fail closed under Candidate V2', () => {
  for (const extra of ['predicate', 'object', 'domain_metadata', 'additional_property']) {
    const invalid = structuredClone(candidate);
    invalid[extra] = {};
    assert.throws(() => validateTaskData('evidence_fact_candidate_v2', { facts: [invalid] }, { source_text: sourceText }));
  }
  const nested = structuredClone(candidate);
  nested.quantity_items[0].condition_value = { value: '1000' };
  assert.throws(() => validateTaskData('evidence_fact_candidate_v2', { facts: [nested] }, { source_text: sourceText }));
});

test('source snapshot and producer telemetry are explicit and credential-free', () => {
  const source = createEvidenceFactSourceSnapshot({
    material_id: 'm1', material_version: 'v1', source_hash: 'sha-material', chunk_id: 'c1',
    chunk_hash: 'sha-chunk', source_span_id: 's1', source_span_hash: 'sha-span', approved_review_identity: 'review:v1'
  });
  const producer = createEvidenceFactProducerVersionSnapshot({
    provider: 'offline-fixture', model: 'candidate-v2', endpoint: '/responses', protocol: 'openai-compatible',
    thinking: false, temperature: 0, top_p: 1, top_k: null, seed: null, max_output_tokens: 1000,
    prompt_version: 'candidate-v2', prompt_hash: 'prompt-sha'
  });
  assert.equal(source.source_span_id, 's1');
  assert.equal(producer.candidate_schema_hash, EVIDENCE_FACT_CANDIDATE_V2_SCHEMA_SHA256);
  assert.equal(Object.hasOwn(producer, 'api_key'), false);
  assert.equal(evidenceFactSourceSnapshotMatches(source, { ...source }), true);
  assert.equal(evidenceFactSourceSnapshotMatches(source, { ...source, source_hash: 'changed' }), false);
  assert.match(stableEvidenceFactProducerVersionIdentity(producer), /^FACT-PRODUCER-V2-/);
});

test('structural identity is stable across key order and changes with source snapshot', () => {
  const result = canonicalizeEvidenceFactCandidateV2(candidate, { sourceText });
  const source = createEvidenceFactSourceSnapshot({ material_id: 'm1', source_hash: 'sha1', chunk_id: 'c1', chunk_hash: 'sha1', source_span_id: 's1', source_span_hash: 'sha1' });
  const reordered = { ...result, canonical: { ...result.canonical, subject: { name: result.canonical.subject.name, type: result.canonical.subject.type } } };
  assert.equal(stableCanonicalEvidenceFactIdentity(result, source), stableCanonicalEvidenceFactIdentity(reordered, source));
  const changed = { ...source, source_hash: 'sha2' };
  assert.notEqual(stableCanonicalEvidenceFactIdentity(result, source), stableCanonicalEvidenceFactIdentity(result, changed));
});

test('optional Candidate V2 extractor is strict and does not persist', async () => {
  let calls = 0;
  const extractor = new SemanticGatewayEvidenceFactExtractor({
    client: { async run() { calls += 1; return { envelope: { data: { facts: [candidate] } }, audit: { probe_diagnostics: { provider_adapter_invoked: false, fetch_invoked: false } } }; } }
  });
  const facts = await extractor.extractCandidateV2({
    review_status: 'approved', evidence_review_contract_version: 'evidence-review-v1', source_text: sourceText,
    source_text_hash: createHash('sha256').update(sourceText).digest('hex'),
    project_id: 'project-1', review_id: 'review-1', source_span_id: 'span-1', material_id: 'material-1'
  });
  assert.equal(facts.length, 1);
  assert.equal(calls, 1);
  assert.equal(facts[FACT_CANDIDATE_V2_AUDIT].semantic_empty_retry, 0);
  assert.equal(facts[FACT_CANDIDATE_V2_AUDIT].schema_retry, 0);
  assert.equal(facts[FACT_CANDIDATE_V2_AUDIT].auto_reextraction, false);
});

test('Candidate V2 semantic empty is successful with zero semantic retry', async () => {
  let calls = 0;
  const extractor = new SemanticGatewayEvidenceFactExtractor({
    client: { async run() { calls += 1; return { envelope: { data: { facts: [] } }, audit: { probe_diagnostics: {} } }; } }
  });
  const facts = await extractor.extractCandidateV2({
      review_status: 'approved', evidence_review_contract_version: 'evidence-review-v1', source_text: sourceText,
      source_text_hash: createHash('sha256').update(sourceText).digest('hex'),
      project_id: 'project-1', review_id: 'review-1', source_span_id: 'span-1', material_id: 'material-1'
    });
  assert.deepEqual(facts, []);
  assert.equal(calls, 1);
});
