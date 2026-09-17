import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  EVIDENCE_FACT_CANDIDATE_V21_SCHEMA,
  EVIDENCE_FACT_CANDIDATE_V21_SCHEMA_VERSION,
  EVIDENCE_FACT_CANDIDATE_V21_PROMPT_VERSION,
  EVIDENCE_FACT_CANDIDATE_V21_SCHEMA_SHA256,
  getSemanticTaskContract,
  getSemanticTaskInstructionMetadata,
  validateTaskData
} from '../../packages/semantic-contracts/index.js';
import {
  resolveEvidenceFactCandidateV21SourceRefs,
  createEvidenceFactCandidateV21SourceAliasTable,
  projectEvidenceFactCandidateV21,
  canonicalizeAndGroundEvidenceFactCandidateV21,
  MODEL_FACING_MAX_NESTING_V21
} from '../src/pipeline/evidence-fact-candidate-v2-1.js';
import {
  normalizeGroundingComparisonText,
  canonicalizeEvidenceFactCandidateV2,
  groundCanonicalEvidenceFactCandidateV2,
  parseCanonicalQuantityValue
} from '../src/pipeline/evidence-fact-candidate-v2.js';
import { buildEvidenceFactCandidateV21SemanticInput } from '../src/pipeline/semantic-gateway-evidence-fact-extractor.js';
import { validateEvidenceFactCandidateV2Data } from '../../packages/semantic-contracts/index.js';
import { buildOpenAICompatibleRequestBody } from '../../services/semantic-gateway/src/provider/openai-compatible-provider.js';

const snapshot = {
  snapshot_id: 'SNAP-1',
  segments: [
    { source_ref: 'snapshot://material/window/chunk-001', text: '澄川平台支持不低于1000个并发用户。' },
    { source_ref: 'snapshot://material/window/chunk-002', text: '已于2026-08-01完成安全测试。' }
  ]
};

const candidate = {
  statement: '澄川平台支持不低于1000个并发用户。',
  source_refs: ['S001'],
  subject_name: '澄川平台',
  subject_type_hint: 'product',
  subject_source_refs: ['S001'],
  entity_mentions: [{ name: '澄川平台', type_hint: 'product', source_refs: ['S001'] }],
  status_text: '完成安全测试',
  status_source_refs: ['S002'],
  scope_items: [],
  quantity_items: [{ name: '并发用户数', value_text: '1000', unit_text: '用户', condition_text: '不低于', source_refs: ['S001'] }],
  temporal_items: [{ value_text: '2026-08-01', event_text: '完成安全测试', source_refs: ['S002'] }]
};

test('Candidate V2.1 is registered with a distinct strict contract and prompt', () => {
  assert.equal(EVIDENCE_FACT_CANDIDATE_V21_SCHEMA_VERSION, '4.3-evidence-fact-candidate-v2.1');
  assert.equal(EVIDENCE_FACT_CANDIDATE_V21_PROMPT_VERSION, '4.3-evidence-fact-candidate-v2.1-prompt-v1');
  assert.equal(EVIDENCE_FACT_CANDIDATE_V21_SCHEMA.additionalProperties, false);
  assert.equal(typeof EVIDENCE_FACT_CANDIDATE_V21_SCHEMA_SHA256, 'string');
  assert.ok(getSemanticTaskContract('evidence_fact_candidate_v2_1'));
  assert.equal(getSemanticTaskContract('evidence_fact_candidate_v2').contract_version, '4.3-evidence-fact-candidate-v2');
  assert.match(getSemanticTaskInstructionMetadata('evidence_fact_candidate_v2_1').instruction, /source_refs/);
});

test('Candidate V2.1 accepts fixed shape and rejects source text or authority metadata', () => {
  assert.deepEqual(validateTaskData('evidence_fact_candidate_v2_1', { facts: [candidate] }), { facts: [candidate] });
  for (const forbidden of ['source_text', 'source_hash', 'chunk_hash', 'span_hash', 'material_id', 'material_version', 'source_snapshot_id', 'domain_metadata', 'authority', 'lifecycle', 'fact_id', 'claim_permission']) {
    const invalid = structuredClone({ facts: [candidate] });
    invalid.facts[0][forbidden] = 'forbidden';
    assert.throws(() => validateTaskData('evidence_fact_candidate_v2_1', invalid), /unsupported|additional|unknown|forbidden/i);
  }
});

test('Candidate V2.1 preserves source refs and backend dereference is authoritative', () => {
  const resolved = resolveEvidenceFactCandidateV21SourceRefs(candidate, snapshot);
  assert.deepEqual(resolved.fact_source_text, snapshot.segments[0].text);
  assert.deepEqual(resolved.observation_source_texts.status_text, snapshot.segments[1].text);
  assert.deepEqual(resolved.authoritative_source_refs, ['snapshot://material/window/chunk-001', 'snapshot://material/window/chunk-002']);
  assert.deepEqual(resolved.source_alias_resolution, { total: 6, resolved: 6, unresolved: 0, rate: 1 });
  const projected = projectEvidenceFactCandidateV21(candidate, snapshot);
  assert.equal(projected.statement, candidate.statement);
  assert.equal(projected.quantity_items[0].provenance.source_text, snapshot.segments[0].text);
  assert.equal(projected.status_text, candidate.status_text);
});

test('Candidate V2.1 unknown source ref fails closed', () => {
  const invalid = structuredClone(candidate);
  invalid.source_refs = ['S999'];
  assert.throws(() => resolveEvidenceFactCandidateV21SourceRefs(invalid, snapshot), error => error.code === 'UNKNOWN_SOURCE_ALIAS');
});

test('Candidate V2.1 exposes deterministic window-local compact aliases only', () => {
  const tableA = createEvidenceFactCandidateV21SourceAliasTable(snapshot);
  const tableB = createEvidenceFactCandidateV21SourceAliasTable(snapshot);
  assert.deepEqual(tableA.segments, [
    { source_ref: 'S001', text: snapshot.segments[0].text },
    { source_ref: 'S002', text: snapshot.segments[1].text }
  ]);
  assert.equal(tableA.aliasToSourceRef.get('S001'), 'snapshot://material/window/chunk-001');
  assert.equal(tableA.aliasToSourceRef.get('S002'), 'snapshot://material/window/chunk-002');
  assert.deepEqual([...tableA.aliasToSourceRef], [...tableB.aliasToSourceRef]);
});

test('Candidate V2.1 model input exposes aliases while Backend retains authoritative refs', () => {
  const context = {
    review_status: 'approved',
    evidence_review_contract_version: 'evidence-review-v1',
    project_id: 'P-1',
    review_id: 'REV-1',
    source_span_id: 'SPAN-1',
    anchor_chunk_id: 'CH-1',
    material_id: 'MAT-1',
    material_type: 'product_documentation',
    source_text: snapshot.segments.map(segment => segment.text).join('\n'),
    source_text_hash: createHash('sha256').update(snapshot.segments.map(segment => segment.text).join('\n')).digest('hex')
  };
  const input = buildEvidenceFactCandidateV21SemanticInput(context, { sourceSnapshot: snapshot });
  assert.deepEqual(input.source_segments.map(segment => segment.source_ref), ['S001', 'S002']);
  assert.equal(JSON.stringify(input).includes('snapshot://material/window/chunk-001'), false);
  assert.equal(JSON.stringify(input).includes('snapshot://material/window/chunk-002'), false);
});

test('Candidate V2.1 rejects full URI, malformed, and cross-window aliases fail closed', () => {
  for (const badAlias of ['snapshot://material/window/chunk-001', 'S1', 'S003']) {
    const invalid = structuredClone(candidate);
    invalid.source_refs = [badAlias];
    assert.throws(() => resolveEvidenceFactCandidateV21SourceRefs(invalid, snapshot), error => error.code === 'UNKNOWN_SOURCE_ALIAS');
  }
});

test('Candidate V2.1 quantity and temporal values are fixed strings with shallow shape', () => {
  assert.equal(typeof candidate.quantity_items[0].value_text, 'string');
  assert.equal(typeof candidate.quantity_items[0].unit_text, 'string');
  assert.equal(typeof candidate.quantity_items[0].condition_text, 'string');
  assert.equal(typeof candidate.temporal_items[0].value_text, 'string');
  assert.equal(typeof candidate.temporal_items[0].event_text, 'string');
  assert.equal(Object.hasOwn(candidate.quantity_items[0], 'conditions'), false);
  assert.ok(MODEL_FACING_MAX_NESTING_V21 <= 6);
});

test('Candidate V2.1 empty arrays are legal and arbitrary extras fail closed', () => {
  const empty = structuredClone(candidate);
  empty.entity_mentions = [];
  empty.subject_source_refs = [];
  empty.status_text = '';
  empty.status_source_refs = [];
  empty.scope_items = [];
  empty.quantity_items = [];
  empty.temporal_items = [];
  assert.deepEqual(validateTaskData('evidence_fact_candidate_v2_1', { facts: [empty] }), { facts: [empty] });
  const extra = structuredClone({ facts: [candidate] });
  extra.facts[0].unknown_field_xyz = 'nope';
  assert.throws(() => validateTaskData('evidence_fact_candidate_v2_1', extra), /unsupported|additional/i);
});

test('Historical Candidate V2 artifact remains auditable and is not overwritten', () => {
  const legacy = {
    facts: [{
      statement: '澄川平台支持不低于1000个并发用户。', subject_name: '澄川平台', subject_type_hint: 'product',
      entity_mentions: [{ value: '澄川平台', type_hint: 'product', provenance: { source_text: '澄川平台', source_refs: ['S017'] } }],
      status_text: null, scope_items: [], quantity_items: [], temporal_items: []
    }]
  };
  assert.deepEqual(validateEvidenceFactCandidateV2Data(legacy), legacy);
  assert.equal(EVIDENCE_FACT_CANDIDATE_V21_SCHEMA_VERSION, '4.3-evidence-fact-candidate-v2.1');
});

test('Canonicalizer and grounding use Backend-resolved source, not model source text', () => {
  const result = canonicalizeAndGroundEvidenceFactCandidateV21(candidate, snapshot);
  assert.equal(result.canonicalization.status, 'CANONICALIZED');
  assert.equal(result.grounding.decision, 'ACCEPT');
  const tampered = structuredClone(candidate);
  tampered.statement = '模型伪造的企业能力';
  const tamperedResult = canonicalizeAndGroundEvidenceFactCandidateV21(tampered, snapshot);
  assert.equal(tamperedResult.grounding.decision, 'REVIEW_REQUIRED');
  assert.ok(tamperedResult.grounding.reasons.includes('STATEMENT_SEMANTIC_GROUNDING_UNRESOLVED'));
});

test('Grounding accepts PDF soft line-wraps without widening semantic support', () => {
  const wrappedSnapshot = {
    snapshot_id: 'SNAP-WRAPPED',
    segments: [
      { source_ref: 'snapshot://wrapped/001', text: '澄\n川平台支持不低于1000个并发用\n户。' },
      { source_ref: 'snapshot://wrapped/002', text: '已于2026-08-01完成安全测\n试。' }
    ]
  };
  const wrappedCandidate = structuredClone(candidate);
  wrappedCandidate.statement = '澄川平台支持不低于1000个并发用户。';
  wrappedCandidate.subject_name = '澄川平台';
  wrappedCandidate.entity_mentions = [{ name: '澄川平台', type_hint: 'product', source_refs: ['S001'] }];
  const wrappedResult = canonicalizeAndGroundEvidenceFactCandidateV21(wrappedCandidate, wrappedSnapshot);
  assert.equal(wrappedResult.grounding.decision, 'ACCEPT');

  const unsupported = structuredClone(candidate);
  unsupported.statement = '澄川平台支持不低于1000个并发用户并提供量子计算。';
  const unsupportedResult = canonicalizeAndGroundEvidenceFactCandidateV21(unsupported, wrappedSnapshot);
  assert.notEqual(unsupportedResult.grounding.decision, 'ACCEPT');
});

test('Grounding safety mutations remain fail-closed after line-wrap normalization', () => {
  const safetySnapshot = {
    snapshot_id: 'SNAP-SAFETY',
    segments: [
      { source_ref: 'snapshot://safety/001', text: '华为平台支持100个用户并获得ISO 9001证书。' }
    ]
  };
  const base = {
    statement: '华为平台支持100个用户并获得ISO 9001证书。',
    source_refs: ['S001'],
    subject_name: '华为平台',
    subject_type_hint: 'product',
    subject_source_refs: ['S001'],
    entity_mentions: [{ name: '华为平台', type_hint: 'product', source_refs: ['S001'] }],
    status_text: '',
    status_source_refs: [],
    scope_items: [],
    quantity_items: [{ name: '用户数', value_text: '100', unit_text: '用户', condition_text: '', source_refs: ['S001'] }],
    temporal_items: []
  };
  const mutationCases = [
    ['unsupported_suffix', candidate => { candidate.statement = '华为平台支持100个用户并获得ISO 9001证书及ISO 27001证书。'; }],
    ['wrong_number', candidate => { candidate.quantity_items[0].value_text = '101'; }],
    ['wrong_certificate', candidate => { candidate.statement = '华为平台支持100个用户并获得ISO 27001证书。'; }],
    ['wrong_product', candidate => {
      candidate.subject_name = '华为另一平台';
      candidate.entity_mentions[0].name = '华为另一平台';
    }],
    ['wrong_enterprise', candidate => {
      candidate.subject_name = '某企业平台';
      candidate.entity_mentions[0].name = '某企业平台';
    }],
    ['negation_mutation', candidate => { candidate.statement = '华为平台不支持100个用户并获得ISO 9001证书。'; }]
  ];
  for (const [label, mutate] of mutationCases) {
    const mutated = structuredClone(base);
    mutate(mutated);
    const result = canonicalizeAndGroundEvidenceFactCandidateV21(mutated, safetySnapshot);
    assert.notEqual(result.grounding.decision, 'ACCEPT', label);
  }
  const sourceRefMismatch = structuredClone(base);
  sourceRefMismatch.source_refs = ['S002'];
  assert.throws(() => canonicalizeAndGroundEvidenceFactCandidateV21(sourceRefMismatch, safetySnapshot), /unknown source alias/i);
});

test('Grounding comparison normalization is limited to layout whitespace', () => {
  assert.equal(normalizeGroundingComparisonText('智能汽\n车解决方案业务'), '智能汽车解决方案业务');
  assert.equal(normalizeGroundingComparisonText('服\n务类质保'), '服务类质保');
  assert.equal(normalizeGroundingComparisonText('建\n立了采购CSR管理体系'), '建立了采购CSR管理体系');
  assert.equal(normalizeGroundingComparisonText('社\n会责任'), '社会责任');
  assert.equal(normalizeGroundingComparisonText('1\n000'), '1000');
  assert.equal(normalizeGroundingComparisonText('1 000'), '1 000');
  assert.equal(normalizeGroundingComparisonText('甲\n，乙'), '甲\n,乙');
});

test('Grounding removes only a single continuation-punctuation line break', () => {
  assert.equal(
    normalizeGroundingComparisonText('提升安全意识和能力，\n共同保障客户网络的安全稳定运行'),
    '提升安全意识和能力,共同保障客户网络的安全稳定运行'
  );
  assert.equal(
    normalizeGroundingComparisonText('第一段。\n第二段。'),
    '第一段。\n第二段。'
  );
  assert.equal(
    normalizeGroundingComparisonText('第一段。\n\n第二段。'),
    '第一段。\n\n第二段。'
  );
  assert.equal(
    normalizeGroundingComparisonText('# 标题\n正文内容'),
    '# 标题\n正文内容'
  );
});

test('Statement-only semantic mismatch is reviewable but never auto-accepted', () => {
  const semanticSnapshot = {
    snapshot_id: 'SNAP-STATEMENT-BOUNDARY',
    segments: [{ source_ref: 'snapshot://statement/001', text: '华为平台支持100个用户并获得ISO 9001证书。' }]
  };
  const semanticCandidate = structuredClone(candidate);
  semanticCandidate.source_refs = ['S001'];
  semanticCandidate.statement = '华为平台具备100个用户并获得ISO 9001证书。';
  semanticCandidate.subject_name = '华为平台';
  semanticCandidate.entity_mentions = [{ name: '华为平台', type_hint: 'product', source_refs: ['S001'] }];
  semanticCandidate.status_text = '';
  semanticCandidate.status_source_refs = [];
  semanticCandidate.quantity_items = [{ name: '用户数', value_text: '100', unit_text: '用户', condition_text: '', source_refs: ['S001'] }];
  semanticCandidate.temporal_items = [];
  const result = canonicalizeAndGroundEvidenceFactCandidateV21(semanticCandidate, semanticSnapshot);
  assert.equal(result.grounding.decision, 'REVIEW_REQUIRED');
  assert.ok(result.grounding.reasons.includes('STATEMENT_SEMANTIC_GROUNDING_UNRESOLVED'));
});

test('Statement uncertainty with a hard quantity mismatch remains rejected', () => {
  const semanticSnapshot = {
    snapshot_id: 'SNAP-STATEMENT-HARD',
    segments: [{ source_ref: 'snapshot://statement-hard/001', text: '华为平台支持100个用户并获得ISO 9001证书。' }]
  };
  const invalid = structuredClone(candidate);
  invalid.source_refs = ['S001'];
  invalid.statement = '华为平台具备101个用户并获得ISO 9001证书。';
  invalid.subject_name = '华为平台';
  invalid.entity_mentions = [{ name: '华为平台', type_hint: 'product', source_refs: ['S001'] }];
  invalid.status_text = '';
  invalid.status_source_refs = [];
  invalid.quantity_items = [{ name: '用户数', value_text: '101', unit_text: '用户', condition_text: '', source_refs: ['S001'] }];
  invalid.temporal_items = [];
  const result = canonicalizeAndGroundEvidenceFactCandidateV21(invalid, semanticSnapshot);
  assert.equal(result.grounding.decision, 'REJECT');
  assert.ok(result.grounding.reasons.includes('quantity.value is not grounded'));
});

test('Statement uncertainty with entity, subject, or polarity contradiction remains rejected', () => {
  const semanticSnapshot = {
    snapshot_id: 'SNAP-STATEMENT-CONTRADICTION',
    segments: [{ source_ref: 'snapshot://statement-contradiction/001', text: '华为平台支持100个用户并获得ISO 9001证书。' }]
  };
  const cases = [
    ['entity', candidate => {
      candidate.entity_mentions[0].name = '华为另一平台';
      candidate.subject_name = '华为另一平台';
    }],
    ['subject', candidate => { candidate.subject_name = '某企业平台'; }],
    ['negation', candidate => { candidate.statement = '华为平台不支持100个用户并获得ISO 9001证书。'; }]
  ];
  for (const [label, mutate] of cases) {
    const invalid = structuredClone(candidate);
    invalid.source_refs = ['S001'];
    invalid.statement = '华为平台具备100个用户并获得ISO 9001证书。';
    invalid.subject_name = '华为平台';
    invalid.entity_mentions = [{ name: '华为平台', type_hint: 'product', source_refs: ['S001'] }];
    invalid.status_text = '';
    invalid.status_source_refs = [];
    invalid.quantity_items = [{ name: '用户数', value_text: '100', unit_text: '用户', condition_text: '', source_refs: ['S001'] }];
    invalid.temporal_items = [];
    mutate(invalid);
    const result = canonicalizeAndGroundEvidenceFactCandidateV21(invalid, semanticSnapshot);
    assert.equal(result.grounding.decision, 'REJECT', label);
  }
});

test('Grounding can consume the same Backend-resolved bounded source unit as Source Role', () => {
  const result = canonicalizeAndGroundEvidenceFactCandidateV21(candidate, snapshot, {
    resolvedSourceUnit: { heading_path: ['能力'], text: `${snapshot.segments[0].text}\n${snapshot.segments[1].text}` }
  });
  assert.equal(result.grounding.decision, 'ACCEPT');
  assert.equal(result.grounding.source_grounding.mode, 'EXACT');
});

test('V2.1 output removes authoritative source text bytes without a hard SLA', () => {
  const oldBytes = Buffer.byteLength(JSON.stringify({ facts: [{ ...candidate, entity_mentions: [{ value: '澄川平台', type_hint: 'product', provenance: { source_text: snapshot.segments[0].text, source_refs: ['S017'] } }] }] }));
  const newBytes = Buffer.byteLength(JSON.stringify({ facts: [candidate] }));
  const sourceTextBytesRemoved = oldBytes - newBytes;
  const reductionRate = sourceTextBytesRemoved / oldBytes;
  assert.ok(sourceTextBytesRemoved > 0);
  assert.ok(reductionRate > 0);
});

test('Responses request builder uses explicit configured model without network', () => {
  const body = buildOpenAICompatibleRequestBody({
    protocol: 'responses', model: 'deepseek-v4-pro', instruction: 'i', payload: { facts: [] },
    responseFormat: { type: 'json_schema', json_schema: { name: 'candidate', strict: true, schema: EVIDENCE_FACT_CANDIDATE_V21_SCHEMA } },
    generationConfig: { max_tokens: 10, temperature: 0.1, top_p: 0.9 }
  });
  assert.equal(body.model, 'deepseek-v4-pro');
  assert.equal(body.reasoning.effort, 'none');
});

test('source terminal completion is review-required and never accepted', () => {
  const sourceSnapshot = {
    snapshot_id: 'SNAP-SOURCE-BOUNDARY',
    segments: [{ source_ref: 'snapshot://boundary/001', text: '获得ISO 27001' }]
  };
  const incomplete = structuredClone(candidate);
  incomplete.source_refs = ['S001'];
  incomplete.subject_source_refs = ['S001'];
  incomplete.status_text = '';
  incomplete.status_source_refs = [];
  incomplete.entity_mentions = [{ name: 'ISO 27001认证证书', type_hint: 'certificate', source_refs: ['S001'] }];
  incomplete.subject_name = 'ISO 27001认证证书';
  incomplete.statement = '获得ISO 27001认证证书';
  incomplete.quantity_items = [];
  incomplete.temporal_items = [];
  const result = canonicalizeAndGroundEvidenceFactCandidateV21(incomplete, sourceSnapshot);
  assert.equal(result.grounding.decision, 'REVIEW_REQUIRED');
  assert.ok(result.grounding.reasons.includes('SOURCE_BOUNDARY_COMPLETION_UNRESOLVED'));
  assert.notEqual(result.grounding.decision, 'ACCEPT');

  const completeSnapshot = {
    ...sourceSnapshot,
    segments: [{ source_ref: 'snapshot://boundary/001', text: '获得ISO 27001认证证书' }]
  };
  const complete = canonicalizeAndGroundEvidenceFactCandidateV21(incomplete, completeSnapshot);
  assert.equal(complete.grounding.decision, 'ACCEPT');
});

test('ordinary action predicates remain unknown without status escalation', () => {
  const action = structuredClone(candidate);
  action.status_text = '发布';
  const resolved = resolveEvidenceFactCandidateV21SourceRefs(action, snapshot);
  const projected = {
    ...projectEvidenceFactCandidateV21(action, snapshot),
    quantity_items: [],
    temporal_items: [],
    status_text: '发布'
  };
  const result = canonicalizeEvidenceFactCandidateV2(projected, { sourceText: resolved.grounding_source_text });
  assert.equal(result.canonical.status, 'unknown');
  assert.equal(result.review_reasons.includes('STATUS_ENUM_UNRESOLVED'), false);
  assert.equal(result.canonical.status_source_text, '发布');
});

test('event temporal observations preserve year precision without validity escalation', () => {
  const event = structuredClone(candidate);
  event.temporal_items = [{ value_text: '2024年', event_text: '供应商协议更新', source_refs: ['S001'] }];
  event.statement = '2024年更新供应商协议';
  event.source_refs = ['S001'];
  event.subject_source_refs = ['S001'];
  event.status_text = '';
  event.status_source_refs = [];
  event.entity_mentions = [];
  event.quantity_items = [];
  const sourceSnapshot = {
    snapshot_id: 'SNAP-TEMPORAL-EVENT',
    segments: [{ source_ref: 'snapshot://temporal/001', text: '2024年更新供应商协议' }]
  };
  event.temporal_items[0].source_refs = ['S001'];
  const result = canonicalizeAndGroundEvidenceFactCandidateV21(event, sourceSnapshot);
  assert.equal(result.canonicalization.review_reasons.includes('TEMPORAL_ROLE_OR_DATE_UNRESOLVED'), false);
  assert.equal(result.canonicalization.temporal_observations.length, 1);
  assert.equal(result.canonicalization.temporal_observations[0].event_date, null);
  assert.equal(result.canonicalization.temporal_observations[0].precision, 'year');
  assert.deepEqual(result.canonicalization.canonical.validity, { status: 'unknown', valid_from: null, valid_until: null });
});

test('bounded quantity parser preserves exact and qualified numeric semantics', () => {
  assert.deepEqual(parseCanonicalQuantityValue('3,000', '', '家'), { value: '3000', operator: null, precision: 'exact' });
  assert.deepEqual(parseCanonicalQuantityValue('零', '', '件'), { value: '0', operator: null, precision: 'exact' });
  assert.deepEqual(parseCanonicalQuantityValue('超过20万', '', '人次'), { value: '200000', operator: '>', precision: 'lower_bound' });
  assert.deepEqual(parseCanonicalQuantityValue('460多', '', '场'), { value: '460', operator: '>', precision: 'lower_bound' });
  assert.deepEqual(parseCanonicalQuantityValue('两年', '', '年'), { value: '2', operator: null, precision: 'exact' });
  assert.deepEqual(parseCanonicalQuantityValue('五道', '', '道'), { value: '5', operator: null, precision: 'exact' });
});

test('grounded textual quantity qualifiers are explicit contract gaps, not dropped', () => {
  const qualified = structuredClone(candidate);
  qualified.statement = '涉及网络安全的150多家供应商';
  qualified.subject_name = '供应商';
  qualified.subject_type_hint = 'organization';
  qualified.entity_mentions = [{ name: '供应商', type_hint: 'organization', source_refs: ['S001'] }];
  qualified.status_text = '';
  qualified.status_source_refs = [];
  qualified.scope_items = [];
  qualified.temporal_items = [];
  qualified.quantity_items = [{ name: '供应商', value_text: '150多', unit_text: '家', condition_text: '涉及网络安全', source_refs: ['S001'] }];
  const sourceSnapshot = {
    snapshot_id: 'SNAP-QUALIFIER-GAP',
    segments: [{ source_ref: 'snapshot://qualifier/001', text: '涉及网络安全的150多家供应商' }]
  };
  const result = canonicalizeAndGroundEvidenceFactCandidateV21(qualified, sourceSnapshot);
  assert.ok(result.canonicalization.review_reasons.includes('QUANTITY_QUALIFIER_CONTRACT_GAP'));
  assert.equal(result.canonicalization.canonical.quantities.length, 1);
  assert.equal(result.canonicalization.canonical.quantities[0].value, '150');
  assert.equal(result.canonicalization.canonical.quantities[0].operator, '>');
});

test('quantity grounding accepts deterministic separator and Chinese-scale forms', () => {
  const source = '系统覆盖超过3,800家供应商，参与超过20万人次。';
  const candidateWithSeparators = {
    statement: source,
    subject_name: '系统', subject_type_hint: 'product',
    entity_mentions: [{ value: '系统', type_hint: 'product', provenance: { source_text: source, source_refs: ['S001'] } }],
    status_text: null, scope_items: [],
    quantity_items: [
      { name: '供应商', value_text: '超过3,800', unit_text: '家', condition_text: null, provenance: { source_text: source, source_refs: ['S001'] } },
      { name: '参与人次', value_text: '超过20万', unit_text: '人次', condition_text: null, provenance: { source_text: source, source_refs: ['S001'] } }
    ],
    temporal_items: []
  };
  const canonical = canonicalizeEvidenceFactCandidateV2(candidateWithSeparators, { sourceText: source });
  const grounded = groundCanonicalEvidenceFactCandidateV2(canonical, { sourceText: source });
  assert.equal(grounded.decision, 'ACCEPT');
  assert.deepEqual(canonical.canonical.quantities.map(item => item.value), ['3800', '200000']);
});
