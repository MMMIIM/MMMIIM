import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  annotateTableSemanticUnits,
  chunkExtractedText,
  classifyBoundary
} from '../src/pipeline/requirement-chunker.js';
import {
  classifyRequirementClauseRole,
  classifyRequirementSectionRole,
  isRequirementExtractionEligibleRole,
  routeRequirementExtractionSections,
  validateCandidateSourceScope
} from '../src/pipeline/requirement-scope-router.js';
import { classifyTenderSections } from '../src/pipeline/tender-section-classifier.js';
import { SourceLocationResolver } from '../src/pipeline/source-location-resolver.js';
import { buildRealProductionPath } from '../eval/requirement-extraction-real-tender-pilot-v1/production-path.js';

function section(section_key, title, paragraphs = []) {
  return { section_key, title, archive_role: null, content_text: paragraphs.map((item) => item.text).join('\n'), paragraphs };
}

test('section routing assigns the six deterministic scope roles and keeps only eligible/unknown views', () => {
  const routed = routeRequirementExtractionSections([
    section('technical_requirements', '项目技术要求'),
    section('evaluation_method', '评标方法和标准'),
    section('bidder_instructions', '投标人资格要求'),
    section('contract', '合同违约责任'),
    section('tender_invitation', '采购公告'),
    section('other', '未识别章节')
  ]);
  assert.deepEqual(routed.sections.map((item) => item.routing_role), [
    'REQUIREMENT_ELIGIBLE', 'SCORING', 'QUALIFICATION', 'LEGAL', 'PROCUREMENT', 'UNKNOWN'
  ]);
  assert.deepEqual(routed.requirementSections.map((item) => item.section_key), [
    'technical_requirements', 'other'
  ]);
  assert.deepEqual(routed.scoringSections.map((item) => item.section_key), ['evaluation_method']);
  assert.equal(isRequirementExtractionEligibleRole('REQUIREMENT_ELIGIBLE'), true);
  assert.equal(isRequirementExtractionEligibleRole('SCORING'), false);
});

test('section routing uses structural metadata before title heuristics', () => {
  assert.equal(classifyRequirementSectionRole({ section_key: 'custom', routing_role: 'SCORING', title: '技术要求' }), 'SCORING');
  assert.equal(classifyRequirementSectionRole({ section_key: 'custom', title: '暂无法识别' }), 'UNKNOWN');
});

test('classifier keeps an unrecognized chapter as UNKNOWN alongside technical scope', () => {
  const values = ['第一章 项目技术要求', '系统应支持审计。', '第二章 其他说明', '平台应提供接口。'];
  const extraction = {
    text: values.join('\n'),
    paragraphs: values.map((text, index) => ({ text, paragraph: index + 1, page: 1 })),
    pages: [], warnings: []
  };
  const analysis = classifyTenderSections(extraction);
  assert.ok(analysis.sections.some((item) => item.routing_role === 'UNKNOWN'));
  assert.deepEqual(analysis.requirementExtractionSections.map((item) => item.routing_role), [
    'REQUIREMENT_ELIGIBLE', 'UNKNOWN'
  ]);
});

test('pure scoring/qualification/commercial/procurement/legal clauses are excluded', () => {
  const cases = [
    ['评分标准：满足条件得5分。', 'SCORING'],
    ['投标人须提供营业执照和资质证书。', 'QUALIFICATION'],
    ['投标报价不得超过最高限价。', 'COMMERCIAL'],
    ['投标截止时间为2026年12月1日。', 'PROCUREMENT'],
    ['违约责任按合同约定执行。', 'LEGAL']
  ];
  for (const [text, expected] of cases) assert.equal(classifyRequirementClauseRole({ text }), expected, text);
});

test('structural scope routing excludes credit qualification and bid-preparation policy clauses', () => {
  assert.equal(
    classifyRequirementClauseRole({
      text: '供应商信用信息查询结果以开标当日为准，列入失信被执行人名单的不得参加本项目。',
      clause_title: '供应商信用资格审查'
    }),
    'QUALIFICATION'
  );
  assert.equal(
    classifyRequirementClauseRole({
      text: '投标人应自行承担所有与准备和参加投标有关的费用，无论投标结果如何。',
      clause_title: '投标费用'
    }),
    'PROCUREMENT'
  );
});

test('structural scope routing excludes score-evidence clauses while retaining technical obligations', () => {
  assert.equal(
    classifyRequirementClauseRole({
      text: '技术方案应提供相关证明材料，评审委员会依据评标标准进行评分。',
      clause_title: '评审评分标准'
    }),
    'SCORING'
  );
  assert.equal(
    classifyRequirementClauseRole({
      text: '系统应在2小时内响应故障并提供处理记录。',
      clause_title: '服务级别要求'
    }),
    'REQUIREMENT_ELIGIBLE'
  );
  assert.equal(
    classifyRequirementClauseRole({
      text: '供应商未按期履约的，应按合同总额支付违约金。',
      section_title: '技术与项目要求'
    }, { sectionRole: 'REQUIREMENT_ELIGIBLE' }),
    'LEGAL'
  );
});

test('clause and heading provenance outranks an eligible section fallback for procurement policy', () => {
  const routed = routeRequirementExtractionSections([section(
    'technical_requirements',
    '技术与项目要求',
    [
      { text: '5.3 政府采购节能产品、环境标志产品', source_section: '《采购需求》。', source_clause_id: '5.3' },
      { text: '投标人所报产品必须获得有效认证证书。', source_section: '《采购需求》。', source_clause_id: '5.3.3' },
      { text: '系统应稳定运行并提供维护服务。', source_section: '采购需求', source_clause_id: '1.1' }
    ]
  )]);
  assert.deepEqual(routed.sections[0].paragraphs.map((item) => item.routing_role), [
    'PROCUREMENT', 'PROCUREMENT', 'REQUIREMENT_ELIGIBLE'
  ]);
});

test('scoring blocks inside an eligible section are excluded as a structural unit', () => {
  const routed = routeRequirementExtractionSections([section(
    'technical_requirements',
    '采购需求',
    [
      { text: '供应商应结合本项目实际编制组织方案：', source_clause_id: '5.2' },
      { text: '6.1 组织方案及解决方案', source_clause_id: '6.1' },
      { text: '（1）应用软件系统维护服务工作方法及解决方案', source_clause_id: '6.1' },
      { text: '第一等次：能提出完整方案。', source_clause_id: '6.1' },
      { text: '第二等次：方案存在缺项。', source_clause_id: '6.1' },
      { text: '第三等次：方案不全面。', source_clause_id: '6.1' },
      { text: '第四等次：没有提出方案。', source_clause_id: '6.1' },
      { text: '系统应在2小时内响应故障。', source_clause_id: '7.1' }
    ]
  )]);
  assert.deepEqual(routed.sections[0].paragraphs.slice(0, 7).map((item) => item.routing_role), [
    'SCORING', 'SCORING', 'SCORING', 'SCORING', 'SCORING', 'SCORING', 'SCORING'
  ]);
  assert.equal(routed.sections[0].paragraphs[7].routing_role, 'REQUIREMENT_ELIGIBLE');
});

test('qualification certificate scoring blocks remain excluded while technical rows remain eligible', () => {
  const routed = routeRequirementExtractionSections([section(
    'technical_requirements',
    '采购需求',
    [
      { text: '6.7 供应商拟任项目负责人（项目经理）能力', source_clause_id: '6.7' },
      { text: '第一等次：取得信息系统项目管理师（高级）资格证书；', source_clause_id: '6.7' },
      { text: '第二等次：取得信息系统管理工程师（中级）资格证书；', source_clause_id: '6.7' },
      { text: '第三等次：其他。', source_clause_id: '6.7' },
      { text: '注：需提供资格证书复印件或扫描件。', source_clause_id: '6.7' },
      { text: '服务人员应按要求提供现场维护。', source_clause_id: '6.8' }
    ]
  )]);
  assert.deepEqual(routed.sections[0].paragraphs.slice(0, 5).map((item) => item.routing_role), [
    'QUALIFICATION', 'QUALIFICATION', 'QUALIFICATION', 'QUALIFICATION', 'QUALIFICATION'
  ]);
  assert.equal(routed.sections[0].paragraphs[5].routing_role, 'REQUIREMENT_ELIGIBLE');
});

test('procurement policy subsection is excluded without dropping the following technical subsection', () => {
  const routed = routeRequirementExtractionSections([section(
    'technical_requirements',
    '采购需求',
    [
      { text: '一、采购标的', source_section: '采购需求', source_clause_id: '7.1' },
      { text: '网络与信息系统运行维护服务。', source_section: '采购需求', source_clause_id: '7.1' },
      { text: '二、落实政府采购政策需满足的要求', source_section: '采购需求', source_clause_id: '7.1' },
      { text: '★6.不接受进口产品。', source_section: '采购需求', source_clause_id: '7.1' },
      { text: '三、技术要求', source_section: '采购需求', source_clause_id: '7.1' },
      { text: '系统应提供稳定运行能力。', source_section: '采购需求', source_clause_id: '1.1' }
    ]
  )]);
  assert.deepEqual(routed.sections[0].paragraphs.map((item) => item.routing_role), [
    'REQUIREMENT_ELIGIBLE', 'REQUIREMENT_ELIGIBLE', 'PROCUREMENT', 'PROCUREMENT',
    'REQUIREMENT_ELIGIBLE', 'REQUIREMENT_ELIGIBLE'
  ]);
});

test('candidate provenance scope gate rejects excluded-only ranges without text keyword filtering', () => {
  const candidate = { source_range: { start_ref: 'C001-S001', end_ref: 'C001-S001' } };
  assert.throws(() => validateCandidateSourceScope(candidate, {
    segments: [{ source_ref: 'C001-S001', text: '价格条款原文', routing_role: 'COMMERCIAL' }]
  }), { code: 'REQUIREMENT_SCOPE_EXCLUDED' });
  assert.doesNotThrow(() => validateCandidateSourceScope(candidate, {
    segments: [{ source_ref: 'C001-S001', text: '价格条款中包含系统性能要求', routing_role: 'UNKNOWN' }]
  }));
  assert.doesNotThrow(() => validateCandidateSourceScope(candidate, {
    segments: [{ source_ref: 'C001-S001', text: '技术要求', routing_role: 'REQUIREMENT_ELIGIBLE' }]
  }));
});

test('scope gate preserves bidder-facing obligations even when source role is excluded metadata', () => {
  const cases = [
    ['供应商须提供有效营业执照，否则投标无效。', 'QUALIFICATION'],
    ['投标人应提交加盖公章的技术方案。', 'PROCUREMENT'],
    ['评分项要求投标人提供相关认证证书作为证明。', 'SCORING'],
    ['投标人报价不得超过最高限价。', 'COMMERCIAL'],
    ['乙方应在合同期限内完成系统维护服务。', 'LEGAL']
  ];
  for (const [text, role] of cases) assert.doesNotThrow(() => validateCandidateSourceScope({
    source_range: { start_ref: 'C001-S001', end_ref: 'C001-S001' }
  }, { segments: [{ source_ref: 'C001-S001', text, routing_role: role }] }), text);
});

test('scope gate still rejects pure context without bidder action or consequence', () => {
  const cases = [
    ['评审委员会按照评分标准计算得分。', 'SCORING'],
    ['采购代理机构联系人：张三，联系电话：010-00000000。', 'PROCUREMENT'],
    ['本文件所称平台是指采购人使用的信息系统。', 'LEGAL'],
    ['采购流程包括开标、评审和定标。', 'PROCUREMENT']
  ];
  for (const [text, role] of cases) assert.throws(() => validateCandidateSourceScope({
    source_range: { start_ref: 'C001-S001', end_ref: 'C001-S001' }
  }, { segments: [{ source_ref: 'C001-S001', text, routing_role: role }] }), { code: 'REQUIREMENT_SCOPE_EXCLUDED' }, text);
});

test('scope gate keeps generic bidder obligation families in excluded containers', () => {
  const cases = [
    ['供应商应具备三级资质。', 'QUALIFICATION'],
    ['投标人必须提供有效认证证书。', 'QUALIFICATION'],
    ['投标人须提交加盖公章的投标文件。', 'PROCUREMENT'],
    ['否则投标无效，投标人不得参加。', 'PROCUREMENT'],
    ['投标人应签署并盖章响应文件。', 'PROCUREMENT'],
    ['投标人应在截止时间前递交电子投标文件。', 'PROCUREMENT'],
    ['评分要求投标人提供技术方案和证明材料。', 'SCORING'],
    ['投标人报价不得超过最高限价。', 'COMMERCIAL'],
    ['中标人应按合同约定提供一年保修服务。', 'LEGAL'],
    ['乙方不得泄露项目保密信息。', 'LEGAL'],
    ['服务商不得实施商业贿赂，否则承担违约责任。', 'LEGAL'],
    ['承包方应在合同期限内完成交付并通过验收。', 'LEGAL']
  ];
  for (const [text, role] of cases) assert.doesNotThrow(() => validateCandidateSourceScope({
    source_range: { start_ref: 'C001-S001', end_ref: 'C001-S001' }
  }, { segments: [{ source_ref: 'C001-S001', text, routing_role: role }] }), text);
});

test('scope gate rejects generic non-bidder context families', () => {
  const cases = [
    ['采购人组织开标和评审。', 'PROCUREMENT'],
    ['评审委员会按照评分标准计算得分。', 'SCORING'],
    ['评分权重按技术、商务分别计算。', 'SCORING'],
    ['采购代理机构联系人及联系电话见本表。', 'PROCUREMENT'],
    ['本政策背景仅用于说明行业发展。', 'LEGAL'],
    ['本文件所称平台是指采购人使用的信息系统。', 'LEGAL'],
    ['采购人有权根据需要调整采购计划。', 'LEGAL'],
    ['项目名称：________。', 'PROCUREMENT'],
    ['建议适当增加服务内容。', 'COMMERCIAL']
  ];
  for (const [text, role] of cases) assert.throws(() => validateCandidateSourceScope({
    source_range: { start_ref: 'C001-S001', end_ref: 'C001-S001' }
  }, { segments: [{ source_ref: 'C001-S001', text, routing_role: role }] }), { code: 'REQUIREMENT_SCOPE_EXCLUDED' }, text);
});

test('scope gate excludes an explicitly non-applicable obligation', () => {
  assert.throws(() => validateCandidateSourceScope({
    source_range: { start_ref: 'S-1', end_ref: 'S-1' },
    requirement_text: '投标保证金（本项目不涉及）。'
  }, { segments: [{
    source_ref: 'S-1',
    text: '投标保证金（本项目不涉及）。',
    routing_role: 'PROCUREMENT'
  }] }), (error) => error.code === 'REQUIREMENT_SCOPE_EXCLUDED'
    && error.scope_reason === 'REQUIREMENT_SCOPE_NON_APPLICABLE');
});

test('scope gate applies a project-specific non-applicability override to a generic template clause', () => {
  assert.throws(() => validateCandidateSourceScope({
    source_range: { start_ref: 'S-1', end_ref: 'S-1' },
    requirement_text: '投标人应说明投标保证金形式。'
  }, { segments: [
    { source_ref: 'S-1', text: '投标人应说明投标保证金形式。', routing_role: 'PROCUREMENT' },
    { source_ref: 'S-2', text: '本项目投标保证金金额：无须提交。', routing_role: 'PROCUREMENT' }
  ] }), (error) => error.code === 'REQUIREMENT_SCOPE_EXCLUDED'
    && error.scope_reason === 'REQUIREMENT_SCOPE_NON_APPLICABLE');
});

test('scope gate does not confuse active prohibitions with non-applicability', () => {
  assert.doesNotThrow(() => validateCandidateSourceScope({
    source_range: { start_ref: 'S-1', end_ref: 'S-1' }
  }, { segments: [{
    source_ref: 'S-1',
    text: '投标人不得分包本项目，否则投标无效。',
    routing_role: 'PROCUREMENT'
  }] }));
});

test('scope gate preserves buyer-side rejection consequences and excludes buyer-only duties', () => {
  assert.doesNotThrow(() => validateCandidateSourceScope({
    source_range: { start_ref: 'S-1', end_ref: 'S-1' }
  }, { segments: [{
    source_ref: 'S-1',
    text: '未按要求提交的投标文件，采购人有权拒绝接受。',
    routing_role: 'PROCUREMENT'
  }] }));
  assert.throws(() => validateCandidateSourceScope({
    source_range: { start_ref: 'S-1', end_ref: 'S-1' }
  }, { segments: [{
    source_ref: 'S-1',
    text: '采购人应在终止采购后退还投标保证金。',
    routing_role: 'PROCUREMENT'
  }] }), { code: 'REQUIREMENT_SCOPE_EXCLUDED' });
});

test('interior excluded fragment with shared clause metadata is downgraded to UNKNOWN and retained', () => {
  const routed = routeRequirementExtractionSections([section(
    'technical_requirements',
    '技术要求',
    [
      { paragraph: 1, page: 1, source_clause_id: '2.2', routing_role: 'REQUIREMENT_ELIGIBLE', text: '迁移应保障业务系统正常运行。' },
      { paragraph: 2, page: 1, source_clause_id: '2.2', routing_role: 'LEGAL', text: '自合同生效之日起7个工作日内完成全部系统迁移。' },
      { paragraph: 3, page: 1, source_clause_id: '2.2', routing_role: 'REQUIREMENT_ELIGIBLE', text: '并提供迁移服务承诺函。' }
    ]
  )]);
  const paragraphs = routed.sections[0].paragraphs;
  assert.deepEqual(paragraphs.map((item) => item.routing_role), [
    'REQUIREMENT_ELIGIBLE', 'UNKNOWN', 'REQUIREMENT_ELIGIBLE'
  ]);
  assert.match(routed.requirementSections[0].content_text, /7个工作日内完成全部系统迁移/);
});

test('retained-excluded-retained without structural proof remains excluded', () => {
  const routed = routeRequirementExtractionSections([section(
    'technical_requirements',
    '技术要求',
    [
      { paragraph: 1, text: '迁移应保障业务系统正常运行。', routing_role: 'REQUIREMENT_ELIGIBLE' },
      { paragraph: 2, text: '自合同生效之日起7个工作日内完成全部系统迁移。', routing_role: 'LEGAL' },
      { paragraph: 3, text: '并提供迁移服务承诺函。', routing_role: 'REQUIREMENT_ELIGIBLE' }
    ]
  )]);
  assert.deepEqual(routed.sections[0].paragraphs.map((item) => item.routing_role), [
    'REQUIREMENT_ELIGIBLE', 'LEGAL', 'REQUIREMENT_ELIGIBLE'
  ]);
  assert.doesNotMatch(routed.requirementSections[0].content_text, /7个工作日内完成全部系统迁移/);
});

test('mixed clauses remain UNKNOWN so a substantive technical obligation is not dropped', () => {
  assert.equal(
    classifyRequirementClauseRole({ text: '评分项：系统应支持统一身份认证，并按评分细则计分。' }),
    'UNKNOWN'
  );
  assert.equal(
    classifyRequirementClauseRole({ text: '合同条款中，平台应提供完整审计日志。' }),
    'UNKNOWN'
  );
  const routed = routeRequirementExtractionSections([section(
    'evaluation_method', '评标方法和标准', [{ text: '评分项：系统应支持统一身份认证。' }]
  )]);
  assert.equal(routed.requirementSections.length, 1);
  assert.equal(routed.requirementSections[0].archive_role, 'requirement_extraction_routed_view');
});

test('table metadata becomes deterministic TABLE_ROW semantic units without guessing plain paragraphs', () => {
  const units = annotateTableSemanticUnits([
    { text: '普通段落' },
    { text: '响应时间 | 2小时', table: { id: 'sla-1', row_id: 'r-1', header_context: '服务级别|响应时间', cells: ['服务级别', '2小时'] } }
  ]);
  assert.equal(units[0].semantic_unit_type, 'PARAGRAPH');
  assert.deepEqual(units[1], {
    text: '响应时间 | 2小时',
    table: { id: 'sla-1', row_id: 'r-1', header_context: '服务级别|响应时间', cells: ['服务级别', '2小时'] },
    semantic_unit_type: 'TABLE_ROW', table_id: 'sla-1', table_row_id: 'r-1',
    table_header_context: '服务级别|响应时间', table_cells: ['服务级别', '2小时']
  });
});

test('table row boundaries are protected while distinct rows remain safe cut points', () => {
  assert.deepEqual(classifyBoundary(
    { text: 'SLA=2小时', table_id: 'sla', table_row_id: 'r1' },
    { text: '响应=4小时', table_id: 'sla', table_row_id: 'r1' }
  ), { classification: 'UNSAFE', reason: 'SAME_TABLE_ROW' });
  assert.deepEqual(classifyBoundary(
    { text: 'SLA=2小时', table_id: 'sla', table_row_id: 'r1' },
    { text: '响应=4小时', table_id: 'sla', table_row_id: 'r2' }
  ), { classification: 'STRONG', reason: 'TABLE_ROW_CHANGE' });
});

test('table-aware chunking keeps complete rows, header context, and source refs', () => {
  const paragraphs = [
    { text: '服务级别|响应时间|解决时间', table_id: 'sla', table_row_id: 'header', table_header_context: '服务级别|响应时间|解决时间', table_cells: ['服务级别', '响应时间', '解决时间'] },
    { text: '一级|2小时|4小时', table_id: 'sla', table_row_id: 'r1', table_header_context: '服务级别|响应时间|解决时间', table_cells: ['一级', '2小时', '4小时'] },
    { text: '二级|4小时|8小时', table_id: 'sla', table_row_id: 'r2', table_header_context: '服务级别|响应时间|解决时间', table_cells: ['二级', '4小时', '8小时'] }
  ];
  const text = paragraphs.map((item) => item.text).join('\n');
  const chunks = chunkExtractedText({
    text, paragraphs, singleCallThreshold: 1, characterBudget: 30, tokenBudget: 8000, sourceSpanBudget: 50
  });
  assert.deepEqual(chunks.map((chunk) => chunk.segments.map((segment) => segment.table_row_id)), [
    ['header', 'r1'], ['r2']
  ]);
  assert.ok(chunks.every((chunk) => chunk.table_units.length > 0));
  assert.match(chunks[1].model_text, /表头：服务级别\|响应时间\|解决时间/);
  assert.deepEqual(chunks.flatMap((chunk) => chunk.segments).map((segment) => segment.source_ref), [
    'C001-S001', 'C001-S002', 'C002-S001'
  ]);
  assert.deepEqual(chunks.flatMap((chunk) => chunk.segments).map((segment) => segment.text), paragraphs.map((item) => item.text));
});

test('table semantic source refs resolve through the existing resolver without synthetic provenance', () => {
  const paragraphs = [
    { text: '一级|2小时', table_id: 'sla', table_row_id: 'r1', table_header_context: '服务级别|响应时间' },
    { text: '二级|4小时', table_id: 'sla', table_row_id: 'r2', table_header_context: '服务级别|响应时间' }
  ];
  const text = paragraphs.map((item) => item.text).join('\n');
  const chunk = chunkExtractedText({ text, paragraphs, singleCallThreshold: 1, characterBudget: 100, tokenBudget: 8000, sourceSpanBudget: 50 })[0];
  const resolved = new SourceLocationResolver().resolve({ source_range: {
    start_ref: 'C001-S001', end_ref: 'C001-S002'
  } }, chunk);
  assert.equal(resolved.location.source_verified, true);
  assert.equal(resolved.location.source_text, text);
  assert.deepEqual(resolved.location.source_refs, ['C001-S001', 'C001-S002']);
});

test('FAST-01 SLA hard-miss regression keeps four table rows and their service-level context intact', () => {
  const rows = [
    ['SLA-01', '一级服务：响应时间不超过2小时，解决时间不超过4小时。'],
    ['SLA-02', '二级服务：响应时间不超过4小时，解决时间不超过8小时。'],
    ['SLA-03', '三级服务：响应时间不超过8小时，解决时间不超过24小时。'],
    ['SLA-04', '重大故障：立即响应，并在约定时限内恢复服务。']
  ].map(([table_row_id, text]) => ({
    text, table_id: 'FAST-01-SLA', table_row_id,
    table_header_context: '服务级别|响应时间|解决时间|恢复要求'
  }));
  const text = rows.map((item) => item.text).join('\n');
  const chunk = chunkExtractedText({
    text, paragraphs: rows, singleCallThreshold: 1, characterBudget: 500, tokenBudget: 8000, sourceSpanBudget: 50
  })[0];
  assert.equal(chunk.segments.length, 4);
  assert.deepEqual(chunk.segments.map((segment) => segment.table_row_id), ['SLA-01', 'SLA-02', 'SLA-03', 'SLA-04']);
  assert.equal(chunk.segments.filter((segment) => segment.table_header_context).length, 4);
  assert.deepEqual(chunk.segments.map((segment) => segment.source_ref), [
    'C001-S001', 'C001-S002', 'C001-S003', 'C001-S004'
  ]);
});

test('table-aware path is additive: plain paragraphs retain the existing model text and span count', () => {
  const text = '系统应提供日志。\n系统应支持审计。';
  const chunks = chunkExtractedText({
    text, paragraphs: text.split('\n').map((item, index) => ({ text: item, paragraph: index + 1 })),
    singleCallThreshold: 1, characterBudget: 100, tokenBudget: 8000, sourceSpanBudget: 50
  });
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0].model_text, '[C001-S001] 系统应提供日志。\n[C001-S002] 系统应支持审计。');
  assert.deepEqual(chunks[0].table_units, []);
});

test('frozen 199 Gold requirements retain an eligible or unknown source span after routing', async () => {
  const ids = ['FAST-01', 'FAST-WATER-01', 'TB-006'];
  const packetRoot = resolve('backend/eval/requirement-extraction-real-tender-pilot-v1/semantic-boundary-v1.1/packets');
  const fullyExcluded = [];
  let goldCount = 0;
  for (const tenderId of ids) {
    const packet = JSON.parse(await readFile(resolve(packetRoot, `${tenderId}.json`), 'utf8'));
    const path = await buildRealProductionPath(packet, { repoRoot: resolve('.') });
    const roleByParagraph = new Map(path.routed_sections.flatMap((section) => (
      (section.paragraphs || []).map((paragraph) => [paragraph.paragraph, paragraph.routing_role])
    )));
    const historicalSpans = packet.windows.flatMap((window) => window.spans);
    const byRef = new Map(historicalSpans.map((span, index) => [span.span_id, index]));
    for (const gold of packet.gold_requirements) {
      goldCount += 1;
      const start = byRef.get(gold.source_range.start_ref);
      const end = byRef.get(gold.source_range.end_ref);
      const roles = Number.isInteger(start) && Number.isInteger(end) && end >= start
        ? historicalSpans.slice(start, end + 1).map((span) => roleByParagraph.get(span.paragraph) || 'UNKNOWN')
        : [];
      if (!roles.some((role) => isRequirementExtractionEligibleRole(role))) {
        fullyExcluded.push(gold.gold_id);
      }
    }
  }
  assert.equal(goldCount, 199);
  assert.deepEqual(fullyExcluded, []);
});
