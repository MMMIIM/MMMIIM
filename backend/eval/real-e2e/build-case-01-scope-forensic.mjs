import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { extractTenderText } from '../../src/tender-text-extractor.js';
import { classifyTenderSections } from '../../src/pipeline/tender-section-classifier.js';
import { combineRequirementExtractionSections } from '../../src/pipeline/requirement-scope-router.js';
import { chunkExtractedText, resolveRequirementChunkBudget } from '../../src/pipeline/requirement-chunker.js';

const root = resolve(process.cwd());
const handoffDir = join(root, 'docs', 'handoff', 'V43_HANDOFF_REAL_E2E_CASE_01_REQUIREMENT_HUMAN_GATE');
const freshPath = join(handoffDir, '03_TB006_REQUIREMENT_RUN_V2.json');
const frozenPath = join(root, 'docs', 'eval', 'requirement-production-core6-20260911', 'TB-006.production-requirements.json');
const sourcePath = join(root, 'backend', 'eval', 'tender-benchmark-v1', 'sources', 'TB-006-beijing-emergency-model-cloud.pdf');
const outPath = join(handoffDir, '02_22_REJECTION_FORENSIC.json');
const normalize = value => String(value || '').replace(/\s+/g, ' ').trim();
const compact = value => String(value || '').replace(/\s+/g, '');
const hash = value => createHash('sha256').update(Buffer.isBuffer(value) ? value : String(value || '')).digest('hex');
const array = value => Array.isArray(value) ? value : [];

const actorPattern = /投标人|投标单位|供应商|响应方|报价人|中标人|乙方|服务方|承包方|拟派项目团队/gu;
const actionPattern = /必须|应当|应|须|不得|需提供|提供|提交|递交|签署|签字|盖章|报价|承诺|承担|完成|履行|保证|满足|符合|缴纳|交付|验收|维护|保修|响应|恢复|达到|不低于|不少于|不超过|超过|列入|不接受|不允许|不响应|确认参加投标/gu;
const consequencePattern = /无效|废标|不予受理|拒绝|取消资格|不得参加|不能通过|违约|违约金|罚款|承担[^。；]{0,20}责任|赔偿|不接受|不允许|不得参与/gu;
const conditionalPattern = /如果|若|如|否则|未|不符合|未按|未提供|未提交|在.*情况下|除非|一旦/gu;
const pureContextPattern = /采购流程|采购过程|评审时间|开标时间|联系人|联系电话|联系地址|通讯地址|邮编|邮箱|评分|评标|评审|得分|分值|权重|以下简称|是指|系指|采购人|评审委员会|代理机构/gu;

function refs(candidate = {}) {
  return [...new Set([
    ...array(candidate.source_refs),
    ...array(candidate.sources_json).flatMap(source => array(source.source_refs))
  ])].sort();
}

function sourceRows(candidate = {}) {
  return array(candidate.sources_json).map(source => ({
    ...source,
    requirement_id: candidate.requirement_id || candidate.req_id || null,
    requirement_text: candidate.requirement_text || candidate.content || null
  }));
}

function classifyFamily(text, roles) {
  if (/评分|评标|评审|得分|分值|权重/.test(text) && /提供|提交|证书|方案|证明|技术/.test(text)) return 'BID_SCORING_ACTION';
  if (/无效|废标|不予受理|取消资格|不得参加|不能通过/.test(text)) return 'BID_INVALIDITY';
  if (/报价|投标价|最高限价|付款|支付|税率|结算|发票|保修|质保|服务费/.test(text)) return 'BID_COMMERCIAL';
  if (/资格|资质|营业执照|证书|业绩|认证|信用|联合体/.test(text)) return 'BID_QUALIFICATION';
  if (/签署|签字|盖章|递交|提交|解密|格式|电子件|文件/.test(text)) return 'BID_FORMALITY';
  if (/合同|乙方|中标人|供应商|履约|违约|保密|知识产权/.test(text)) return 'BID_CONTRACTUAL';
  if (roles.includes('SCORING') || roles.includes('QUALIFICATION')) return 'AMBIGUOUS';
  return 'AMBIGUOUS';
}

function classify(text, roles, sourceText) {
  const actors = [...new Set((sourceText.match(actorPattern) || []).map(normalize))];
  const actions = [...new Set((sourceText.match(actionPattern) || []).map(normalize))];
  const consequences = [...new Set((sourceText.match(consequencePattern) || []).map(normalize))];
  const hasBidderSignal = actors.length > 0 || /投标文件|响应文件|报价文件|技术方案|投标报价|投标产品/.test(sourceText);
  if (hasBidderSignal && (actions.length > 0 || consequences.length > 0)) return 'DETERMINISTIC_IN_SCOPE';
  if (!hasBidderSignal && consequences.length === 0 && actions.length === 0 && pureContextPattern.test(sourceText)) return 'DETERMINISTIC_OUT_OF_SCOPE';
  if (!hasBidderSignal && /采购人|评审委员会|代理机构/.test(sourceText) && !actions.length && !consequences.length) return 'DETERMINISTIC_OUT_OF_SCOPE';
  void text; void roles;
  return 'AMBIGUOUS_GPT_REVIEW';
}

const freshReport = JSON.parse(await readFile(freshPath, 'utf8'));
const frozen = JSON.parse(await readFile(frozenPath, 'utf8'));
const sourceBuffer = await readFile(sourcePath);
const extraction = await extractTenderText({ fileName: sourcePath, mimeType: 'application/pdf', buffer: sourceBuffer });
const analysis = classifyTenderSections(extraction);
const scope = combineRequirementExtractionSections(analysis.sections, { includeNonScoringSections: true });
const chunks = chunkExtractedText({ text: scope.content_text, paragraphs: scope.paragraphs, ...resolveRequirementChunkBudget(process.env) });
const byRef = new Map(chunks.flatMap(chunk => chunk.segments.map(segment => [segment.source_ref, { ...segment, chunk_number: chunk.chunk_number, chunk_id: null }])));
const frozenSources = frozen.requirements.flatMap(sourceRows);
const frozenByText = new Map();
for (const source of frozenSources) {
  const key = compact(source.source_text || source.source_excerpt || '');
  if (!key) continue;
  if (!frozenByText.has(key)) frozenByText.set(key, []);
  frozenByText.get(key).push(source);
}
const rows = array(freshReport.scope_rejections).map((rejection, index) => {
  const sourceRefs = array(rejection.resolved_source_span?.source_refs);
  const segments = sourceRefs.map(ref => byRef.get(ref)).filter(Boolean);
  const sourceText = segments.map(segment => segment.text).join('\n');
  const first = segments[0] || {};
  const last = segments.at(-1) || first;
  const previous = first.source_ref ? chunks.find(chunk => chunk.chunk_number === rejection.chunk_number)?.segments.findIndex(segment => segment.source_ref === first.source_ref) : -1;
  const chunk = chunks.find(item => item.chunk_number === rejection.chunk_number);
  const chunkSegments = chunk?.segments || [];
  const startIndex = Math.max(0, previous - 2);
  const endIndex = Math.min(chunkSegments.length, (previous < 0 ? 0 : previous + segments.length + 2));
  const sourceContext = chunkSegments.slice(startIndex, endIndex).map(segment => segment.text).join('\n');
  const actors = [...new Set((sourceText.match(actorPattern) || []).map(normalize))];
  const actions = [...new Set((sourceText.match(actionPattern) || []).map(normalize))];
  const consequences = [...new Set((sourceText.match(consequencePattern) || []).map(normalize))];
  const conditionals = [...new Set((sourceText.match(conditionalPattern) || []).map(normalize))];
  const roles = array(rejection.source_role);
  const historicalMatches = frozenByText.get(compact(sourceText)) || [];
  const historical = historicalMatches[0] || null;
  return {
    case_id: 'REAL_E2E_CASE_01',
    rejection_index: index + 1,
    chunk_number: rejection.chunk_number,
    candidate_index: rejection.candidate_index,
    candidate_identity: rejection.candidate_identity ?? null,
    candidate_text: null,
    candidate_text_recoverability: 'NOT_PERSISTED_IN_V2_SCOPE_AUDIT',
    exact_source_text: sourceText || null,
    source_context: sourceContext || null,
    source_role: roles,
    page: { start: first.page ?? null, end: last.page ?? null },
    paragraph_range: { start: first.paragraph ?? null, end: last.paragraph ?? null },
    offset_range: { start: first.source_start_offset ?? null, end: last.source_end_offset ?? null },
    source_refs: sourceRefs,
    source_hash: rejection.source_hash || hash(sourceText),
    source_hash_recomputed_from_reconstructed_span: sourceText ? hash(sourceText) : null,
    detected_actors: actors,
    obligation_markers: actions,
    prohibition_or_consequence_markers: consequences,
    conditionality_markers: conditionals,
    current_scope_rule_path: 'RequirementParseService.processChunk → SourceLocationResolver.resolve → validateCandidateSourceScope',
    current_rejection_rule: 'all resolved source roles are in EXCLUDED_ONLY_ROLES → REQUIREMENT_SCOPE_EXCLUDED',
    historical_auxiliary_overlap: sourceRefs.some(ref => array(freshReport.scope_overlap_refs).includes(ref)),
    historical_matching_source_span: historical ? { source_refs: refs(historical), source_hash: historical.source_hash || null, source_excerpt: historical.source_excerpt || historical.source_text || null } : null,
    historical_requirement_text: historical?.requirement_text || null,
    historical_category: historical?.category || historical?.requirement_category || null,
    contract_family_candidate: classifyFamily(sourceText, roles),
    recertification_classification: classify(sourceText, roles, sourceText),
    scope_decision_basis: 'Frozen Decision negative-filter rule only; source role/category alone is not treated as authority.',
    semantic_root_cause: 'PENDING_GPT'
  };
});
const distribution = Object.fromEntries(['DETERMINISTIC_IN_SCOPE', 'DETERMINISTIC_OUT_OF_SCOPE', 'AMBIGUOUS_GPT_REVIEW'].map(label => [label, rows.filter(row => row.recertification_classification === label).length]));
const output = {
  artifact_type: 'V43_CASE_01_22_ROW_SCOPE_FORENSIC',
  run_id: freshReport.run_id,
  tender_id: 'TB-006',
  source_file: 'TB-006-beijing-emergency-model-cloud.pdf',
  source_sha256: hash(sourceBuffer),
  row_count: rows.length,
  classification_distribution: distribution,
  rows,
  no_semantic_labels_created: true,
  historical_reference_role: 'HISTORICAL_PRODUCTION_AUXILIARY_REFERENCE'
};
await writeFile(outPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ row_count: rows.length, distribution, chunks: chunks.length, source_sha256: output.source_sha256 }, null, 2));
