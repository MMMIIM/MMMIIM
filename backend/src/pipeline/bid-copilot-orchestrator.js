import { randomUUID } from 'node:crypto';
import { AppError } from '../errors.js';

const sanitizeRequest = (value) => String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 1000);

export function classifyCopilotIntent(message) {
  const text = String(message || '').trim();
  if (/自动批准|批准|确认.*正式|绕过.*Claim\s*Gate|绕过.*内容风险/i.test(text)) return text.includes('绕过') ? 'formal_claim_gate_bypass' : 'formal_decision_request';
  if (/新材料.*补哪些需求|这份.*材料.*需求|材料.*补哪些/.test(text)) return 'material_matches';
  if (/推进.*(?:可以|能够)?生成|帮我.*推进.*生成|能处理的都处理/.test(text)) return 'advance_to_generation';
  if (/安全.*修|投标检查.*处理|检查问题.*处理/.test(text)) return 'safe_bid_check';
  if (/重写.*章|重新生成.*章|按评分点加强|章节.*加强|第三章.*泛/.test(text)) return 'chapter_revision';
  if (/为什么.*不能生成|不能生成|无法生成|生成.*阻塞/.test(text)) return 'generation_blockers';
  if (/什么材料|哪些材料|证明|支撑/.test(text)) return 'requirement_materials';
  if (/打开|进入|跳转/.test(text)) return 'navigate';
  if (/缺什么|还缺|下一步|先做什么|待处理/.test(text)) return 'project_next_steps';
  return 'project_next_steps';
}

function baseResponse(context, audit) {
  return { status: 'SUCCESS', summary: '', tasks: [], actions: [], sources: [], blockers: [], context: { project_id: context.project_id, current_route: context.current_route, requirement_id: context.requirement_id || null }, audit };
}

const ACTION_LABELS = Object.freeze({
  refreshProjectReadiness: '刷新项目准备度',
  refreshGenerationStatus: '刷新生成状态',
  runMaterialRetrieval: '查找相关企业材料',
  prepareRequirementMaterialMatch: '准备需求与材料匹配',
  runBidCheck: '查看投标检查结果',
  prepareBidCheckFix: '准备格式问题修复',
  prepareChapterRevision: '准备章节修订预览',
  validateChapterRevision: '校验章节修订',
  applyApprovedChapterRevision: '应用已确认的章节修订'
});

export class BidCopilotOrchestrator {
  constructor({ contextResolver, tools, actionExecutor, auditRepository, reconciliationService = null, clock = () => Date.now() } = {}) {
    this.contextResolver = contextResolver;
    this.tools = tools;
    this.actionExecutor = actionExecutor;
    this.auditRepository = auditRepository;
    this.reconciliationService = reconciliationService;
    this.clock = clock;
  }

  async audit(value) {
    if (!this.auditRepository?.createAgentExecutionAudit) return null;
    try { return await this.auditRepository.createAgentExecutionAudit(value); } catch (_error) { return null; }
  }

  async run(input = {}) {
    const started = this.clock();
    const message = sanitizeRequest(input.message);
    if (!message) throw new AppError('AGENT_REQUEST_INVALID', '请告诉我你想了解什么。', 400);
    if (input.context?.project_id && input.project_id && input.context.project_id !== input.project_id) throw new AppError('AGENT_CONTEXT_MISMATCH', '当前请求的项目上下文不一致，请从项目工作区重新发起。', 400);
    const context = await this.contextResolver.resolve({ ...(input.context || {}), project_id: input.context?.project_id || input.project_id, user_id: input.user_id || input.context?.user_id });
    const agentRunId = randomUUID();
    context.agent_run_id = agentRunId;
    const intent = classifyCopilotIntent(message);
    const audit = { agent_run_id: agentRunId, user_id: context.user_id, project_id: context.project_id, current_route: context.current_route, user_request: message, intent, selected_tools: [], tool_results: [], actions_proposed: [], actions_executed: [], human_required_actions: [], status: 'running', created_at: new Date().toISOString() };
    const response = baseResponse(context, { agent_run_id: agentRunId, intent });
    if (this.reconciliationService && context.project_id) {
      try {
        const reconciliation = await this.reconciliationService.get(context.project_id, context.document_version_id || null);
        response.context.final_requirement_reconciliation = {
          status: reconciliation.status,
          summary: reconciliation.summary,
          read_only: true
        };
      } catch (error) {
        response.context.final_requirement_reconciliation = { status: 'UNAVAILABLE', read_only: true, reason_code: error.code || 'RECONCILIATION_UNAVAILABLE' };
      }
    }
    const call = async (tool, args = {}) => { audit.selected_tools.push(tool); const result = await this.tools.execute(tool, context, args); audit.tool_results.push({ tool, status: result.status, reason_code: result.reason_code }); return result; };

    const callActions = async (actions) => {
      if (!this.actionExecutor) return { results: [], summary: { failed: 1 }, plan: [] };
      const execution = await this.actionExecutor.executePlan({ context, agent_run_id: agentRunId, actions });
      for (const item of execution.results) { audit.selected_tools.push(item.tool); audit.tool_results.push({ tool: item.tool, status: item.result }); }
      return execution;
    };
    const applyActionExecution = (execution) => {
      const normalizedPreview = (item) => {
        const stored = item.preview || null;
        if (!stored) return null;
        const raw = stored.preview_json || stored.preview || stored;
        return {
          preview_id: stored.preview_id,
          original_text: raw.original_text || raw.diff?.original || '',
          proposed_text: raw.proposed_text || raw.diff?.proposed || '',
          diff: raw.diff || null,
          removed_items: Array.isArray(raw.removed_items) ? raw.removed_items : [],
          validation_result: stored.validation_json || stored.validation_result || item.validation_result || null,
          target: stored.target_json || stored.target || item.target || null
        };
      };
      response.tasks = execution.results.map((item) => ({ title: ACTION_LABELS[item.tool] || '项目操作', reason: item.what_happened || item.data?.what_happened || '', impact: item.next_action || item.data?.next_action || '', action: item.result, navigation: item.preview ? { route: item.tool?.includes('Chapter') ? 'generation' : 'review-center', preview_id: item.preview.preview_id } : null, validation_result: item.validation_result || null }));
      response.actions = execution.results.filter((item) => item.result === 'PREVIEW_READY').map((item) => ({ label: '查看预览差异', type: 'preview', tool: item.tool, preview: normalizedPreview(item), preview_id: normalizedPreview(item)?.preview_id, target: item.target || item.data?.target || normalizedPreview(item)?.target || null, validation_result: item.validation_result || normalizedPreview(item)?.validation_result || null }));
      response.blockers = execution.results.filter((item) => ['HUMAN_REQUIRED', 'BLOCKED', 'STALE'].includes(item.result)).map((item) => ({ title: ACTION_LABELS[item.tool] || '需要处理的操作', reason: item.what_happened || item.data?.what_happened || '当前操作未执行。', impact: item.next_action || item.data?.next_action || '请在对应工作区处理。', action: item.result, navigation: { route: item.tool?.includes('Chapter') ? 'generation' : 'review-center', preview_id: item.preview?.preview_id || null } }));
      response.status = execution.summary.human_required && !execution.summary.executed && !execution.summary.prepared
        ? 'REQUIRES_HUMAN_DECISION'
        : execution.summary.failed && !execution.summary.executed && !execution.summary.prepared ? 'ERROR' : 'SUCCESS';
      response.summary = execution.summary.partial ? `已完成 ${execution.summary.executed} 项，准备 ${execution.summary.prepared} 项，仍有 ${execution.summary.failed + execution.summary.human_required} 项需要处理。` : `已完成 ${execution.summary.executed} 项，准备 ${execution.summary.prepared} 项。`;
    };

    if (intent === 'formal_claim_gate_bypass' || intent === 'formal_decision_request') {
      response.status = intent === 'formal_claim_gate_bypass' ? 'BLOCKED' : 'REQUIRES_HUMAN_DECISION';
      response.summary = intent === 'formal_claim_gate_bypass' ? '内容风险检查不能被绕过。' : '正式确认需要由你在对应工作区完成。';
      response.blockers.push({ title: '需要人工确认', reason: intent === 'formal_claim_gate_bypass' ? '内容风险检查是正式流程的一部分，Copilot不会代替确认。' : '正式确认会改变项目控制状态，Copilot只能引导你进入确认页面。', impact: '在人工确认前，正式状态不会改变。', action: '打开审核中心', navigation: { route: 'review-center' } });
      audit.human_required_actions.push('formal_decision');
    } else if (['advance_to_generation', 'material_matches', 'safe_bid_check', 'chapter_revision'].includes(intent)) {
      const actions = intent === 'advance_to_generation'
        ? [
          { action: 'refreshProjectReadiness', reason: '重新读取正式准备度' },
          { action: 'refreshGenerationStatus', reason: '刷新生成任务状态' },
          { action: 'runBidCheck', reason: '读取最新投标检查结果' },
          ...(context.requirement_id ? [{ action: 'runMaterialRetrieval', args: { requirement_id: context.requirement_id }, reason: '检索相关企业材料' }] : [])
        ]
        : intent === 'material_matches'
          ? [{ action: 'runMaterialRetrieval', args: { requirement_id: context.requirement_id, material_ids: context.material_id ? [context.material_id] : undefined }, reason: '检索材料与需求候选关系' }, { action: 'prepareRequirementMaterialMatch', args: { requirement_id: context.requirement_id }, reason: '准备人工匹配' }]
          : intent === 'safe_bid_check'
            ? [{ action: 'runBidCheck', reason: '读取投标检查问题' }]
            : [{ action: 'prepareChapterRevision', args: { version_id: context.document_version_id, chapter_id: context.chapter_id }, reason: '准备章节修订预览' }];
      if (actions.some((item) => item.action === 'prepareChapterRevision') && (!context.document_version_id || !context.chapter_id)) { response.status = 'BLOCKED'; response.summary = '章节修订需要明确打开的文档版本和章节。'; response.blockers.push({ title: '缺少章节范围', reason: '为了避免误改整份文档，必须先指定一个章节。', impact: '当前正文不会改变。', action: '打开标书章节', navigation: { route: 'generation' } }); }
      else if (!this.actionExecutor) { response.status = 'ERROR'; response.summary = '项目助手操作能力暂时不可用。'; }
      else {
        const pending = intent === 'advance_to_generation' ? await call('getPendingActions') : null;
        const execution = await callActions(actions);
        applyActionExecution(execution);
        if (pending?.data?.actions?.length) response.tasks = [...pending.data.actions.slice(0, 8), ...response.tasks];
        if (intent === 'advance_to_generation') { const reread = await call('getGenerationReadiness'); response.blockers.push(...(reread.data?.gaps || []).slice(0, 8).map((item) => ({ title: item.requirement_id, reason: item.gap_reason, impact: item.is_mandatory ? '必需项仍需处理。' : '处理后可提升准备度。', action: '查看材料准备度', navigation: { route: 'evidence-readiness', requirement_id: item.requirement_id } }))); }
      }
    } else if (intent === 'generation_blockers') {
      const readiness = await call('getGenerationReadiness');
      const blockers = readiness.data?.generation_readiness?.blocker_count || 0;
      response.summary = blockers ? `当前还有 ${blockers} 项待处理，暂不适合生成。` : '当前正式状态未发现生成前阻塞项。';
      response.blockers = (readiness.data?.gaps || []).slice(0, 12).map((item) => ({ title: item.requirement_id, reason: item.gap_reason, impact: item.is_mandatory ? '这是必需项，处理前不能进入正式生成。' : '处理后可提升材料准备度。', action: '查看材料准备度', navigation: { route: 'evidence-readiness', requirement_id: item.requirement_id } }));
      response.status = readiness.status === 'ERROR' ? 'ERROR' : 'SUCCESS'; response.sources = readiness.source_refs || [];
    } else if (intent === 'requirement_materials') {
      if (!context.requirement_id) { response.status = 'NO_RESULT'; response.summary = '请先打开一个具体需求，我再帮你查找可用材料。'; response.actions.push({ label: '查看需求与材料准备度', navigation: { route: 'evidence-readiness' } }); }
      else {
        const [materials, candidates] = await Promise.all([call('findRelevantMaterials', { requirement_id: context.requirement_id }), call('getEvidenceCandidates', { requirement_id: context.requirement_id })]);
        response.status = materials.status === 'ERROR' || candidates.status === 'ERROR' ? 'ERROR' : (materials.status === 'NO_RESULT' && candidates.status === 'NO_RESULT' ? 'NO_RESULT' : 'SUCCESS');
        response.summary = materials.data?.candidates?.length ? '找到了可供确认的材料候选；它们还不是正式证明。' : '当前没有找到可直接证明该需求的材料。';
        response.sources = [...(materials.source_refs || []), ...(candidates.source_refs || [])];
        response.tasks = (materials.data?.candidates || []).map((item) => ({ title: item.material_name || '企业材料', reason: '与当前需求存在检索关联。', impact: item.confirmed ? '已完成确认。' : '仍需人工确认后才能作为正式依据。', action: item.confirmed ? '查看已确认材料' : '进入证据确认', candidate_only: !item.confirmed, source: item.source_location || item.source_page || null }));
      }
    } else if (intent === 'navigate') {
      const route = /材料|证据/.test(message) ? 'evidence-readiness' : /生成|标书/.test(message) ? 'generation' : 'workspace';
      const result = await call('navigateTo', { route }); response.actions = result.data?.action ? [{ label: '打开相关工作区', ...result.data.action }] : []; response.summary = '可以从这里继续处理项目。';
    } else {
      const [status, readiness, pending, gaps] = await Promise.all([call('getProjectStatus'), call('getGenerationReadiness'), call('getPendingActions'), call('getMaterialGaps')]);
      response.summary = pending.data?.actions?.length ? `项目当前有 ${pending.data.actions.length} 项待处理，建议先处理优先级最高的事项。` : '当前项目没有发现需要立即处理的事项。';
      response.tasks = (pending.data?.actions || []).slice(0, 8); response.sources = [...(status.source_refs || []), ...(readiness.source_refs || []), ...(gaps.source_refs || [])]; response.blockers = (readiness.data?.gaps || []).slice(0, 8).map((item) => ({ title: item.requirement_id, reason: item.gap_reason, impact: item.is_mandatory ? '必需项未处理会影响正式生成。' : '处理后可提升准备度。', action: '查看材料准备度', navigation: { route: 'evidence-readiness', requirement_id: item.requirement_id } }));
    }
    audit.status = response.status; audit.latency_ms = Math.max(0, this.clock() - started); response.audit = { agent_run_id: agentRunId, intent, latency_ms: audit.latency_ms };
    await this.audit({ ...audit, context_json: { user_id: context.user_id, project_id: context.project_id, project_stage: context.project_stage, current_route: context.current_route, material_id: context.material_id, requirement_id: context.requirement_id, chapter_id: context.chapter_id, document_version_id: context.document_version_id }, provider: null, model: null });
    return response;
  }
}
