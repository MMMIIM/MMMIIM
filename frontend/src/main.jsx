import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { marked } from 'marked';
import { ArrowLeft, CheckCircle2, Clipboard, Download, FilePlus2, FileSearch, FolderPlus, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import { api } from './api.js';
import { EvidenceReview } from './evidence-review.jsx';
import { ReviewWorkbench } from './review-workbench.jsx';
import { EvidenceReadiness } from './evidence-readiness.jsx';
import { MaterialProcessingCenter } from './material-processing-center.jsx';
import { BidCopilot } from './bid-copilot.jsx';
import { MATERIAL_TYPES, formatMaterialType } from './material-types.js';
import './styles.css';

const tabs = ['概览', '材料准备度', '材料处理', '审核中心', '招标文件', '需求解析', '响应决策', '响应矩阵', '响应规划', '企业材料', '企业证据复核', '标书', '风险复核', '版本记录'];
const flowStages = [
  { label: '项目准备', tabs: ['概览', '招标文件', '需求解析', '企业材料'] },
  { label: '审核与补充', tabs: ['材料准备度', '材料处理', '审核中心', '企业证据复核'] },
  { label: '标书生成', tabs: ['响应决策', '响应矩阵', '标书', '响应规划'] },
  { label: '投标检查', tabs: ['风险复核', '版本记录'] },
];
const projectTypes = ['智慧城市', '数据治理', '系统集成', '园区运营', '应急管理', 'AI 应用'];
const outputModes = ['技术标初稿', '售前方案', '响应矩阵', '风险清单'];
const statusLabels = { draft: '草稿', generating: '生成中', review: '待复核', requirements_review: '需求待确认', requirements_confirmed: '需求已确认', confirmed: '已确认', candidate: '候选', queued: '排队中', running: '进行中', succeeded: '成功', failed: '失败' };
const riskLabels = { pass: '通过', warning: '警告', critical: '严重' };
const requirementCategories = ['technical','performance','implementation','delivery','service','contractual','commercial','qualification','context'];

function formatDate(value, fallback = '—') {
  return value ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : fallback;
}
function sanitizeFileName(name) { return (name || 'AI标书技术响应').replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, '-').slice(0, 60); }
function Badge({ type = 'neutral', children }) { return <span className={`badge ${type}`}>{children}</span>; }
function Notice({ kind, children }) { return <div className={`notice ${kind}`}>{children}</div>; }
function Empty({ title, text }) { return <div className="empty-state"><strong>{title}</strong><p>{text}</p></div>; }
function EmptyCard(props) { return <section className="card"><Empty {...props} /></section>; }
function Loading({ text, full }) { return <div className={`loading ${full ? 'full' : ''}`}><Loader2 className="spin" size={24} /><span>{text}</span></div>; }
function Stat({ label, value }) { return <div><span>{label}</span><strong>{value}</strong></div>; }

function PageShell({ title, subtitle, onBack, children }) {
  return <main className="app-shell"><header className="app-header"><div className="brand-row">{onBack ? <button className="icon-button" onClick={onBack}><ArrowLeft size={20} /></button> : null}<div><p className="eyebrow">政企投标辅助工作台</p><h1>{title}</h1>{subtitle ? <p className="subtitle">{subtitle}</p> : null}</div></div><Badge>4.3 后端确定性流程</Badge></header>{children}</main>;
}

function flowStageStatus(stage, data, active) {
  if (active) return '当前';
  if (stage === '项目准备') {
    if (data.requirementBaseline) return '需求已确认';
    if (data.tenderFiles?.length) return '文件已上传';
    return '待上传';
  }
  if (stage === '审核与补充') return data.requirementBaseline ? '可处理' : '待需求确认';
  if (stage === '标书生成') return data.versions?.length ? '已有版本' : '待生成';
  if (stage === '投标检查') return data.versions?.length ? '待核验' : '待版本';
  return '可查看';
}

export function ProjectNavigation({ activeTab, setActiveTab, data }) {
  const activeStage = flowStages.findIndex((stage) => stage.tabs.includes(activeTab));
  const openStage = (stage) => setActiveTab(stage.tabs[0]);
  return <nav className="flow-stepper" aria-label="项目流程">
      {flowStages.map((stage, index) => <button type="button" key={stage.label} className={`flow-step ${index === activeStage ? 'active' : ''}`} onClick={() => openStage(stage)} aria-current={index === activeStage ? 'step' : undefined}>
        <span className="flow-step-number">{index + 1}</span><span className="flow-step-copy"><strong>{stage.label}</strong><small>{flowStageStatus(stage.label, data, index === activeStage)}</small></span>
      </button>)}
    </nav>;
}

export function ProfessionalWorkspaceNav({ activeTab, setActiveTab }) {
  return <aside className="professional-nav"><h2>专业工作区</h2><p>需要查看规则、来源或审计时，从这里进入。</p><nav aria-label="专业工作区">{tabs.map((tab) => <button type="button" className={activeTab === tab ? 'active' : ''} key={tab} onClick={() => setActiveTab(tab)}>{tab}</button>)}</nav></aside>;
}

const platformModules = ['工作台', '投标项目', '企业资料库', '标书检查'];
export const MATERIAL_LIBRARY_SCOPES = [
  { key: 'general', label: '通用资料', description: '可跨项目复用的标准、法规和通用技术参考。' },
  { key: 'industry', label: '行业资料', description: '按项目所属行业复用的参考材料，帮助理解行业要求。' },
  { key: 'enterprise', label: '企业资料', description: '本企业的简介、资质、案例和能力材料，需完成证明确认后使用。' },
];
export const INDUSTRY_LIBRARY_SCOPES = [
  { key: 'government', label: '政企平台', description: '数字政府、智慧城市、数据共享和系统集成相关资料。' },
  { key: 'healthcare', label: '医疗行业', description: '医院信息平台、电子病历和医疗数据互联互通相关资料。' },
];
const materialStatusLabels = {
  succeeded: '已处理，可进入证明确认',
  processing: '正在处理',
  failed: '需要人工处理',
  pending: '等待处理',
};

export function IndustryLibraryScopeTabs({ industryScope, setIndustryScope }) {
  return <div className="library-scope-tabs library-industry-tabs" role="tablist" aria-label="行业范围">{INDUSTRY_LIBRARY_SCOPES.map((item) => <button type="button" role="tab" aria-selected={industryScope === item.key} className={`library-scope-tab ${industryScope === item.key ? 'active' : ''}`} key={item.key} onClick={() => setIndustryScope(item.key)}>{item.label}</button>)}</div>;
}

export function PlatformShell({ active, onNavigate, onCreate, title, subtitle, children }) {
  return <main className="app-shell platform-shell"><header className="app-header"><div><p className="eyebrow">政企投标辅助平台</p><h1>{title}</h1>{subtitle ? <p className="subtitle">{subtitle}</p> : null}</div><Badge>4.3 确定性流程</Badge></header><nav className="platform-nav" aria-label="平台主导航">{platformModules.map((module) => <button type="button" key={module} className={active === module ? 'active' : ''} onClick={() => onNavigate(module)}>{module}</button>)}<button type="button" className="system-nav" disabled title="系统管理将在权限基础具备后开放">系统管理</button></nav>{children}</main>;
}

function Workbench({ onCreate, onOpen, onNavigate }) {
  const [state, setState] = useState({ loading: true, projects: [], error: '' });
  useEffect(() => { api.listProjects().then((payload) => setState({ loading: false, projects: payload.projects || [], error: '' })).catch((error) => setState({ loading: false, projects: [], error: error.message })); }, []);
  const attention = state.projects.filter((project) => ['requirements_review', 'review', 'generating'].includes(project.status) || (project.risk_status && project.risk_status !== 'pass'));
  const recent = state.projects.slice(0, 5);
  return <PlatformShell active="工作台" onNavigate={onNavigate} onCreate={onCreate} title="工作台" subtitle="今天先处理最重要的项目事项"><div className="page-actions"><button className="primary-inline" onClick={onCreate}><FolderPlus size={17} />新建投标项目</button><button className="secondary-button" onClick={() => onNavigate('投标项目')}>查看全部项目</button></div>{state.error ? <Notice kind="error">{state.error}</Notice> : null}{state.loading ? <Loading text="正在读取工作台" /> : <div className="workbench-grid"><section className="card"><h2>待我处理</h2>{attention.length ? <div className="action-list">{attention.map((project) => <button type="button" key={project.id} onClick={() => onOpen(project.id)}><span><strong>{project.name}</strong><small>{project.status === 'requirements_review' ? '需求待确认' : project.status === 'generating' ? '正在生成标书' : project.risk_status && project.risk_status !== 'pass' ? '有投标检查事项' : '有待处理事项'}</small></span><span>进入项目 →</span></button>)}</div> : <Empty title="暂时没有待办" text="新的项目事项会出现在这里。" />}</section><section className="card"><h2>最近项目</h2>{recent.length ? <div className="action-list">{recent.map((project) => <button type="button" key={project.id} onClick={() => onOpen(project.id)}><span><strong>{project.name}</strong><small>{project.deadline ? `截止 ${formatDate(project.deadline)}` : '未设置截止时间'}</small></span><span>{statusLabels[project.status] || '查看'} →</span></button>)}</div> : <Empty title="还没有项目" text="创建第一个投标项目，开始准备招标文件和企业资料。" />}</section></div>}</PlatformShell>;
}

function ProjectList({ onCreate, onOpen, onNavigate }) {
  const [state, setState] = useState({ loading: true, projects: [], error: '' });
  async function load() {
    setState((current) => ({ ...current, loading: true, error: '' }));
    try { const payload = await api.listProjects(); setState({ loading: false, projects: payload.projects || [], error: '' }); }
    catch (error) { setState({ loading: false, projects: [], error: error.message }); }
  }
  useEffect(() => { load(); }, []);
  return <PlatformShell active="投标项目" onNavigate={onNavigate} onCreate={onCreate} title="投标项目" subtitle="管理项目、截止时间和当前处理阶段">
    <div className="page-actions"><button className="secondary-button" onClick={load}><RefreshCw size={16} />刷新</button><button className="primary-inline" onClick={onCreate}><FolderPlus size={17} />新建项目</button></div>
    {state.error ? <Notice kind="error">{state.error}</Notice> : null}
    <section className="card table-card">{state.loading ? <Loading text="正在加载项目" /> : state.projects.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>项目名称</th><th>状态</th><th>截止时间</th><th>当前版本</th><th>风险状态</th><th>更新时间</th></tr></thead><tbody>{state.projects.map((project) => <tr key={project.id} onClick={() => onOpen(project.id)}><td><button className="link-button">{project.name}</button></td><td><Badge type={project.status}>{statusLabels[project.status] || project.status}</Badge></td><td>{formatDate(project.deadline)}</td><td>{project.current_version ? `V${project.current_version}` : '—'}</td><td>{project.risk_status ? <Badge type={project.risk_status}>{riskLabels[project.risk_status]}</Badge> : '—'}</td><td>{formatDate(project.updated_at)}</td></tr>)}</tbody></table></div> : <Empty title="还没有项目" text="创建第一个项目并上传招标文件，开始建立可追溯的生成归档。" />}</section>
  </PlatformShell>;
}

export function EnterpriseLibrary({ onNavigate, onOpen }) {
  const [scope, setScope] = useState('enterprise');
  const [industryScope, setIndustryScope] = useState('government');
  const [state, setState] = useState({ projects: [], selected: '', materials: [], loading: true, error: '' });
  useEffect(() => { api.listProjects().then((payload) => { const projects = payload.projects || []; setState((current) => ({ ...current, projects, selected: current.selected || projects[0]?.id || '', loading: false })); }).catch((error) => setState((current) => ({ ...current, loading: false, error: error.message }))); }, []);
  useEffect(() => {
    if (scope === 'enterprise') {
      if (!state.selected) return;
      api.listCompanyMaterials(state.selected).then((payload) => setState((current) => ({ ...current, materials: payload.materials || [] }))).catch((error) => setState((current) => ({ ...current, error: error.message })));
      return;
    }
    const publicScope = scope === 'general' ? 'GENERAL' : (industryScope === 'government' ? 'GOVERNMENT_ENTERPRISE' : 'HEALTHCARE');
    api.listPublicCorpusMaterials(publicScope).then((payload) => setState((current) => ({ ...current, materials: payload.materials || [], loading: false }))).catch((error) => setState((current) => ({ ...current, loading: false, error: error.message })));
  }, [state.selected, scope, industryScope]);
  const selectedProject = state.projects.find((project) => project.id === state.selected);
  const selectedScope = MATERIAL_LIBRARY_SCOPES.find((item) => item.key === scope) || MATERIAL_LIBRARY_SCOPES[2];
  const selectedIndustry = INDUSTRY_LIBRARY_SCOPES.find((item) => item.key === industryScope) || INDUSTRY_LIBRARY_SCOPES[0];
  const scopeEmptyState = scope === 'general'
    ? { title: '当前还没有通用资料', text: '可补充标准、法规或通用技术参考，之后可跨项目复用。' }
    : { title: `当前还没有${selectedIndustry.label}资料`, text: `可补充${selectedIndustry.description.replace('相关资料。', '参考资料。')}` };
  return <PlatformShell active="企业资料库" onNavigate={onNavigate} title="企业资料库" subtitle="按资料范围查找能帮助当前项目的证明材料">
    <section className="card library-card">
      <div className="section-heading"><div><h2>资料范围</h2><p>范围只控制材料可见性；实际使用前仍需完成证明确认。</p></div></div>
      <div className="library-scope-tabs" role="tablist" aria-label="资料范围">
        {MATERIAL_LIBRARY_SCOPES.map((item) => <button type="button" role="tab" aria-selected={scope === item.key} className={`library-scope-tab ${scope === item.key ? 'active' : ''}`} key={item.key} onClick={() => setScope(item.key)}>{item.label}</button>)}
      </div>
      <div className="library-scope-summary"><strong>{selectedScope.label}</strong><p>{selectedScope.description}</p></div>
      {scope === 'industry' ? <IndustryLibraryScopeTabs industryScope={industryScope} setIndustryScope={setIndustryScope} /> : null}
      {scope === 'enterprise' ? <div className="section-heading library-project-heading"><div><h2>企业资料</h2><p>选择项目，查看本项目可用的企业材料。</p></div><select aria-label="选择项目" value={state.selected} onChange={(event) => setState({ ...state, selected: event.target.value })}><option value="">选择项目</option>{state.projects.map((project) => <option value={project.id} key={project.id}>{project.name}</option>)}</select></div> : null}
      {state.error ? <Notice kind="error">暂时无法读取资料，请稍后再试。</Notice> : null}
      {scope !== 'enterprise' ? state.loading ? <Loading text="正在读取公开资料" /> : state.materials.length ? <div className="library-list">{state.materials.map((material) => <div className="library-list-item" key={material.id}><span><strong>{material.original_name}</strong><small className="library-item-meta"><span>{formatMaterialType(material.material_type)}</span><span>{material.source_org || '官方公开来源'}</span><span>{material.effective_status === 'current' ? '现行有效' : '待复核'}</span></small><small>{material.source_org || '官方公开来源'} · {material.corpus_scope === 'GENERAL' ? '通用资料' : material.industry || '行业资料'} · {material.usage_status === 'ACTIVE_EXCERPT' ? '可使用已审核摘录' : '可用于检索'}</small></span><span>{material.updated_at ? formatDate(material.updated_at) : '已入库'}</span></div>)}</div> : <Empty {...scopeEmptyState} /> : state.loading ? <Loading text="正在读取企业资料" /> : state.selected ? state.materials.length ? <div className="library-list">{state.materials.map((material) => <button type="button" key={material.id} onClick={() => onOpen(state.selected)}><span><strong>{material.original_name}</strong><small className="library-item-meta"><span>{formatMaterialType(material.material_type)}</span><span>企业资料</span><span>{materialStatusLabels[material.extraction_status] || '待处理'}</span></small><small>{selectedProject?.name ? `可用于：${selectedProject.name}` : '可用于当前项目'} · 完成证明确认后才能作为正式依据</small></span><span>进入项目 →</span></button>)}</div> : <Empty title="这个项目还没有企业资料" text="进入项目准备，上传企业简介、资质、案例或技术能力材料，再完成证明确认。" /> : <Empty title="请选择项目" text="选择项目后查看本次可用的企业资料。" />}
    </section>
  </PlatformShell>;
}

function BidCheck({ onNavigate, onOpen }) {
  const [state, setState] = useState({ projects: [], selected: '', project: null, loading: true, error: '' });
  useEffect(() => { api.listProjects().then((payload) => { const projects = payload.projects || []; setState((current) => ({ ...current, projects, selected: current.selected || projects[0]?.id || '', loading: false })); }).catch((error) => setState((current) => ({ ...current, loading: false, error: error.message }))); }, []);
  useEffect(() => { if (!state.selected) return; api.getProject(state.selected).then((project) => setState((current) => ({ ...current, project }))).catch((error) => setState((current) => ({ ...current, error: error.message }))); }, [state.selected]);
  return <PlatformShell active="标书检查" onNavigate={onNavigate} title="标书检查" subtitle="集中查看已有项目的风险、完整性和交付准备"><section className="card"><div className="section-heading"><div><h2>检查已有项目</h2><p>本阶段复用项目内正式检查结果，不创建第二套检查引擎。</p></div><select aria-label="选择项目" value={state.selected} onChange={(event) => setState({ ...state, selected: event.target.value })}><option value="">选择项目</option>{state.projects.map((project) => <option value={project.id} key={project.id}>{project.name}</option>)}</select></div>{state.error ? <Notice kind="error">{state.error}</Notice> : null}{state.loading ? <Loading text="正在读取检查结果" /> : state.project ? state.project.versions?.[0] ? <RiskReview version={state.project.versions[0]} baseline={state.project.requirementBaseline} onConfirmed={() => {}} /> : <Empty title="这个项目还没有正式版本" text="先在项目内完成标书生成，正式版本会在这里进入投标检查。" /> : <Empty title="请选择项目" text="选择项目后查看风险与交付准备。" />}</section></PlatformShell>;
}

function CreateProject({ onBack, onCreated }) {
  const [form, setForm] = useState({ name: '', deadline: '', file: null });
  const [state, setState] = useState({ loading: false, error: '' });
  async function submit(event) {
    event.preventDefault();
    if (!form.name.trim()) return setState({ loading: false, error: '请填写项目名称。' });
    setState({ loading: true, error: '' });
    try { const result = await api.createProject(form); onCreated(result.project.id); }
    catch (error) { setState({ loading: false, error: error.message }); }
  }
  return <PageShell title="新建项目" subtitle="建立项目归档并关联首份招标文件" onBack={onBack}><form className="card form-card" onSubmit={submit}><label className="field"><span>项目名称 *</span><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="例如：某市智慧城市综合治理平台" /></label><label className="field"><span>截止时间</span><input type="datetime-local" value={form.deadline} onChange={(event) => setForm({ ...form, deadline: event.target.value })} /></label><label className="field"><span>招标文件</span><input type="file" onChange={(event) => setForm({ ...form, file: event.target.files?.[0] || null })} /></label><p className="helper">文件保存在后端配置的存储目录，不进入 Git。单个文件最大 50 MB。</p>{state.error ? <Notice kind="error">{state.error}</Notice> : null}<button className="primary-button" disabled={state.loading}>{state.loading ? <Loader2 className="spin" size={18} /> : <FolderPlus size={18} />}{state.loading ? '创建中…' : '创建项目'}</button></form></PageShell>;
}

function ResponseDecisionProjection({ projectId, baseline }) {
  const requirements = baseline?.requirements || [];
  const [selected, setSelected] = useState(requirements[0]?.req_id || '');
  const [state, setState] = useState({ loading: false, decision: null, tasks: [], compliance: null, error: '' });
  useEffect(() => { if (!selected) return; let active = true; setState((current) => ({ ...current, loading: true, error: '' })); Promise.all([api.getResponseDecision(projectId, selected), api.getGateATasks(projectId), api.getComplianceMatrix(projectId)]).then(([decision, tasks, compliance]) => { if (active) setState({ loading: false, decision, tasks: tasks.tasks || [], compliance, error: '' }); }).catch((error) => { if (active) setState((current) => ({ ...current, loading: false, error: error.message })); }); return () => { active = false; }; }, [projectId, selected]);
  const decision = state.decision?.decision;
  const row = (state.compliance?.rows || []).find((item) => item.requirement_id === selected);
  return <div className="document-layout"><section className="card"><div className="section-heading"><div><h2>响应决策投影</h2><p>Router V2.1 仅提供 advisory suggestion；正式 authority 仍来自后端服务与人工审核。</p></div><select aria-label="选择 Requirement" value={selected} onChange={(event) => setSelected(event.target.value)}><option value="">选择 Requirement</option>{requirements.map((item) => <option key={item.req_id} value={item.req_id}>{item.req_id}</option>)}</select></div>{state.error ? <Notice kind="error">{state.error}</Notice> : null}{state.loading ? <Loading text="正在读取响应投影" /> : decision ? <><div className="parse-summary"><Stat label="建议模式" value={decision.response_mode} /><Stat label="风险" value={decision.risk_tier} /><Stat label="需要响应" value={decision.response_required ? '是' : '否'} /><Stat label="人工处理" value={decision.human_required ? '需要' : '暂不需要'} /><Stat label="权限状态" value={decision.authority?.status || 'ADVISORY_ONLY'} /></div><Notice kind={decision.authority?.granted ? 'error' : 'warning'}>这是 AI/Router 建议，不是批准或 Claim/Writer 权限。</Notice><p><strong>下一步：</strong>{decision.next_action}</p><p><strong>路由原因：</strong>{(decision.routing_reasons || []).join('、') || '—'}</p><p><strong>Evidence dependency：</strong>{decision.evidence_dependency ? '是' : '否'}</p>{row?.human_action_required ? <Notice kind="warning">当前 Requirement 仍有人工处理或最终核对事项。</Notice> : null}</> : <Empty title="暂无响应投影" text="请先确认 Requirement Baseline。" />}</section><section className="card"><h2>Gate A / 合规待办</h2>{state.tasks.length ? <div className="action-list">{state.tasks.slice(0, 12).map((task) => <div className="task-item" key={task.task_id}><div><strong>{task.requirement_id || task.kind}</strong><p>{task.reason}</p></div><Badge type={String(task.severity || '').toLowerCase()}>{task.severity}</Badge></div>)}</div> : <Empty title="暂无待办" text="现有领域服务未返回需要人工处理的任务。" />}</section></div>;
}

const responseModeLabels = { SOLUTION: '方案响应', EVIDENCE: '证据响应', COMMITMENT: '承诺响应', COMPLIANCE: '合规处理' };
const readinessLabels = { READY_FOR_WRITER: '可生成方案', EVIDENCE_REQUIRED: '缺企业证据', HUMAN_DECISION_REQUIRED: '需负责人确认', COMPLIANCE_ACTION_REQUIRED: '需合规处理', NO_RESPONSE_REQUIRED: '无需响应', NEED_REVIEW: '待确认' };
const matrixFilters = [
  { key: 'all', label: '全部' },
  { key: 'action', label: '需处理' },
  { key: 'risk', label: 'P0 / HIGH' },
  { key: 'scoring', label: '评分相关' },
  { key: 'human', label: '需人工' },
  { key: 'evidence', label: '缺企业证据' },
  { key: 'review', label: '待确认' }
];

export function ResponseMatrixWorkspace({ projectId }) {
  const [state, setState] = useState({ loading: true, rows: [], error: '', filter: 'all' });
  useEffect(() => {
    let active = true;
    api.getBidResponseMatrix(projectId).then((payload) => { if (active) setState((current) => ({ ...current, loading: false, rows: payload.rows || [], error: '' })); }).catch((error) => { if (active) setState((current) => ({ ...current, loading: false, error: error.message })); });
    return () => { active = false; };
  }, [projectId]);
  const rows = state.rows.filter((row) => {
    const decision = row.response_decision || {};
    if (state.filter === 'action') return row.response_required !== false;
    if (state.filter === 'risk') return ['P0', 'HIGH'].includes(decision.risk_tier);
    if (state.filter === 'scoring') return row.scoring_related === true;
    if (state.filter === 'human') return decision.human_required === true || ['HUMAN_DECISION_REQUIRED', 'NEED_REVIEW'].includes(row.readiness_status);
    if (state.filter === 'evidence') return row.readiness_status === 'EVIDENCE_REQUIRED';
    if (state.filter === 'review') return row.readiness_status === 'NEED_REVIEW';
    return true;
  });
  return <section className="card response-matrix-workspace">
    <div className="section-heading"><div><h2>响应矩阵</h2><p>按 Requirement 查看响应方式、风险和下一步处理；这是只读流程投影，不会自动批准证据或承诺。</p></div><Badge>只读</Badge></div>
    <div className="response-matrix-filters" role="group" aria-label="响应矩阵筛选">{matrixFilters.map((item) => <button type="button" key={item.key} className={state.filter === item.key ? 'active' : ''} onClick={() => setState((current) => ({ ...current, filter: item.key }))}>{item.label}</button>)}</div>
    {state.error ? <Notice kind="error">暂时无法读取响应矩阵：{state.error}</Notice> : null}
    <div className="response-matrix-table-wrap"><table className="response-matrix-table"><thead><tr><th>Requirement</th><th>来源</th><th>内容类型</th><th>风险</th><th>响应方式</th><th>需要处理</th><th>准备状态</th></tr></thead><tbody>{state.loading ? <tr><td colSpan="7"><Loading text="正在读取响应矩阵" /></td></tr> : rows.length ? rows.map((row) => { const decision = row.response_decision || {}; return <tr key={row.requirement_id}><td><strong>{row.requirement_id}</strong><small>{row.requirement_text}</small></td><td>{row.source?.page ? `第 ${row.source.page} 页` : '—'}<small>{row.source?.source_verified ? '来源已核验' : '来源待核验'}</small></td><td>{row.content_category || '—'}</td><td><Badge type={String(decision.risk_tier || '').toLowerCase()}>{decision.risk_tier || '—'}</Badge></td><td>{decision.response_mode ? responseModeLabels[decision.response_mode] || decision.response_mode : '待确认'}</td><td>{row.response_required === false ? '无需响应' : decision.human_required ? '需人工' : '系统处理'}</td><td><Badge type={row.readiness_status === 'READY_FOR_WRITER' ? 'success' : 'warning'}>{readinessLabels[row.readiness_status] || row.readiness_status}</Badge></td></tr>; }) : <tr><td colSpan="7"><Empty title="暂无匹配 Requirement" text="可切换筛选条件，或先确认 Requirement Baseline。" /></td></tr>}</tbody></table></div>
  </section>;
}

function Workspace({ projectId, onBack }) {
  const [activeTab, setActiveTab] = useState('概览');
  const [materialGapContext, setMaterialGapContext] = useState(null);
  const [focusMaterialId, setFocusMaterialId] = useState(null);
  const [focusReviewMaterialId, setFocusReviewMaterialId] = useState(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  async function load() { setError(''); try { setData(await api.getProject(projectId)); } catch (requestError) { setError(requestError.message); } }
  useEffect(() => {
    let active = true;
    const refresh = async () => { if (active) await load(); };
    refresh();
    const timer = window.setInterval(refresh, 2500);
    return () => { active = false; window.clearInterval(timer); };
  }, [projectId]);
  if (!data && !error) return <Loading text="正在加载项目工作台" full />;
  if (!data) return <PageShell title="项目工作台" onBack={onBack}><Notice kind="error">{error}</Notice></PageShell>;
  const latestVersion = data.versions?.[0];
  const navigation = <ProjectNavigation activeTab={activeTab} setActiveTab={setActiveTab} data={data} />;
  let content;
  if (activeTab === '材料准备度') content = <EvidenceReadiness projectId={projectId} onOpenReview={()=>setActiveTab('审核中心')} onSupplementMaterial={(gap)=>{setMaterialGapContext(gap);setActiveTab('企业材料');}} />;
  else if (activeTab === '材料处理') content = <MaterialProcessingCenter projectId={projectId} focusMaterialId={focusMaterialId} onOpenReview={(materialId)=>{setFocusReviewMaterialId(materialId);setActiveTab('审核中心');}} onOpenReadiness={()=>setActiveTab('材料准备度')} />;
  else if (activeTab === '审核中心') content = <ReviewWorkbench projectId={projectId} focusMaterialId={focusReviewMaterialId} onClearMaterialFocus={()=>setFocusReviewMaterialId(null)} />;
  else content = <>{activeTab === '概览' ? <Overview data={data} /> : null}{activeTab === '招标文件' ? <TenderFiles projectId={projectId} files={data.tenderFiles} onChanged={load} /> : null}{activeTab === '需求解析' ? <RequirementParsing projectId={projectId} files={data.tenderFiles} parseJobs={data.parseJobs || []} baseline={data.requirementBaseline} onChanged={load} /> : null}{activeTab === '响应决策' ? <ResponseDecisionProjection projectId={projectId} baseline={data.requirementBaseline} /> : null}{activeTab === '响应矩阵' ? <ResponseMatrixWorkspace projectId={projectId} /> : null}{activeTab === '响应规划' ? <ProductionBeta projectId={projectId} baseline={data.requirementBaseline} /> : null}{activeTab === '企业材料' ? <CompanyMaterials projectId={projectId} baseline={data.requirementBaseline} gapContext={materialGapContext} onUploaded={(material)=>{setFocusMaterialId(material?.id||null);setMaterialGapContext(null);setActiveTab('材料处理');}} /> : null}{activeTab === '企业证据复核' ? <EvidenceReview projectId={projectId} requirements={data.requirementBaseline?.requirements||[]} /> : null}{activeTab === '标书' ? <BidDocument project={data.project} generations={data.documentGenerations || []} version={latestVersion} onGenerated={load} onStartCheck={()=>setActiveTab('风险复核')} /> : null}{activeTab === '风险复核' ? <RiskReview version={latestVersion} baseline={data.requirementBaseline} onConfirmed={load} /> : null}{activeTab === '版本记录' ? <Versions versions={data.versions} /> : null}</>;
  return <PageShell title={data.project.name} subtitle={`项目工作台 · ${activeTab === '概览' ? (statusLabels[data.project.status] || data.project.status) : activeTab}`} onBack={onBack}>{navigation}<div className="workspace-layout"><ProfessionalWorkspaceNav activeTab={activeTab} setActiveTab={setActiveTab} /><section className="workspace-main">{error ? <Notice kind="error">{error}</Notice> : null}{content}<BidCopilot projectId={projectId} context={{ current_route: activeTab, requirement_id: activeTab === '需求解析' ? undefined : undefined }} onNavigate={(action) => { if (action?.route) { const next = action.route.split('/').pop(); const tab = { 'evidence-readiness': '材料准备度', 'review-center': '审核中心', materials: '企业材料', requirements: '需求解析', generation: '标书', 'document-delivery': '版本记录', 'bid-check': '风险复核' }[next]; if (tab) setActiveTab(tab); } }} /></section></div></PageShell>;
}

function PlanEditor({plan,onSave}){const [edit,setEdit]=useState(false);const [form,setForm]=useState({response_status:plan.response_status,implementation_actions:(plan.implementation_actions||[]).join('\n'),conditions:(plan.conditions||[]).join('\n'),capability_gap:plan.capability_gap||'',supporting_evidence_ids:(plan.supporting_evidence_ids||[]).join(','),edit_reason:''});if(!edit)return <button onClick={()=>setEdit(true)}>编辑</button>;const submit=()=>onSave(plan.requirement_id,{response_status:form.response_status,implementation_actions:form.implementation_actions.split('\n').map(x=>x.trim()).filter(Boolean),conditions:form.conditions.split('\n').map(x=>x.trim()).filter(Boolean),capability_gap:form.capability_gap,supporting_evidence_ids:form.supporting_evidence_ids.split(',').map(x=>x.trim()).filter(Boolean),edit_reason:form.edit_reason,edited_by:'current_user'}).then(()=>setEdit(false));return <div className="plan-editor"><select value={form.response_status} onChange={e=>setForm({...form,response_status:e.target.value})}><option>full</option><option>partial</option><option>confirm</option></select><textarea placeholder="实施动作，每行一项" value={form.implementation_actions} onChange={e=>setForm({...form,implementation_actions:e.target.value})}/><textarea placeholder="条件，每行一项" value={form.conditions} onChange={e=>setForm({...form,conditions:e.target.value})}/><input placeholder="capability gap" value={form.capability_gap} onChange={e=>setForm({...form,capability_gap:e.target.value})}/><input placeholder="approved Evidence ID，逗号分隔" value={form.supporting_evidence_ids} onChange={e=>setForm({...form,supporting_evidence_ids:e.target.value})}/><input placeholder="编辑原因" value={form.edit_reason} onChange={e=>setForm({...form,edit_reason:e.target.value})}/><button disabled={!form.edit_reason.trim()} onClick={submit}>提交人工审核</button><button onClick={()=>setEdit(false)}>取消</button></div>;}

export function ProductionBeta({ projectId, baseline }) {
  const [state,setState]=useState({loading:true,running:false,plans:{plans:[],summary:{}},claims:{claims:[],summary:{}},coverage:{},error:null});
  async function load(){try{const [plans,claims,coverage]=await Promise.all([api.getResponsePlans(projectId),api.getClaims(projectId),api.getCoverage(projectId)]);setState((current)=>({...current,loading:false,running:false,plans,claims,coverage,error:null}));}catch(error){setState((current)=>({...current,loading:false,running:false,error}));}}
  useEffect(()=>{load();},[projectId]);
  async function run(){setState((current)=>({...current,running:true,error:null}));try{await api.generateResponsePlans(projectId);await api.generateClaims(projectId);await load();}catch(error){setState((current)=>({...current,running:false,error}));}}
  async function decide(claimId,decision){try{await api.decideClaim(claimId,decision);await load();}catch(error){setState((current)=>({...current,error}));}}
  async function savePlan(requirementId,input){try{await api.editResponsePlan(projectId,requirementId,input);await load();}catch(error){setState((current)=>({...current,error}));throw error;}}
  if(state.loading)return <EmptyCard title="正在读取响应规划" text="加载 ResponsePlan、Claim Gate 与 Coverage。" />;
  const summary={...state.plans.summary,...state.claims.summary};const claims=state.claims.claims||[];const coverage=state.coverage||{};const confirmed=Boolean(baseline||state.plans.has_confirmed_baseline);
  return <div className="document-layout"><section className="card">
      <div className="section-heading"><div><h2>ResponsePlan → Claim → Coverage</h2><p>系统依据已确认需求建立保守响应骨架，用户可补充实施动作、条件和已批准证据。基础声明由需求原文确定性建立，只有已批准声明可以进入正文。</p></div><button className="primary-inline" disabled={!confirmed||state.running} onClick={run}>{state.running?'建立中…':'建立响应计划'}</button></div>
    {!confirmed?<Notice kind="warning">请先确认 Requirement Baseline，响应规划按钮已禁用。</Notice>:null}{state.error?<Notice kind="error">{state.error.code} · {state.error.message}</Notice>:null}
    <div className="parse-summary"><Stat label="基线 Requirement" value={summary.baseline_requirement_count||0}/><Stat label="writer eligible" value={summary.writer_eligible_requirement_count||0}/><Stat label="Plan" value={summary.plan_count||0}/><Stat label="full / partial / confirm" value={`${summary.full_count||0} / ${summary.partial_count||0} / ${summary.confirm_count||0}`}/><Stat label="Approved / Rejected Claim" value={`${summary.approved_claim_count||0} / ${summary.rejected_claim_count||0}`}/><Stat label="mandatory uncovered" value={(coverage.mandatory_uncovered_ids||[]).length}/><Stat label="普通 uncovered" value={(coverage.uncovered_requirement_ids||[]).filter((id)=>!(coverage.mandatory_uncovered_ids||[]).includes(id)).length}/><Stat label="provisional" value={summary.provisional_requirement_count||0}/><Stat label="待分类" value={summary.classification_review_count||0}/><Stat label="待原子性复核" value={summary.atomicity_review_count||0}/></div>
    {(coverage.mandatory_uncovered_ids||[]).length?<Notice kind="error">mandatory 未覆盖：{coverage.mandatory_uncovered_ids.join('、')}</Notice>:null}
    <details><summary>人工编辑 ResponsePlan</summary>{(state.plans.plans||[]).map((plan)=><div key={`edit-${plan.requirement_id}`}><strong>{plan.requirement_id}</strong><small>{plan.requirement_anchor}</small><PlanEditor plan={plan} onSave={savePlan}/></div>)}</details>
    <h3>ResponsePlan 明细</h3><div className="table-scroll"><table className="data-table"><thead><tr><th>Requirement</th><th>来源/分类</th><th>状态</th><th>摘要与条件</th><th>Evidence</th><th>章节</th></tr></thead><tbody>{(state.plans.plans||[]).map((plan)=><tr key={plan.requirement_id}><td>{plan.requirement_id}</td><td>{plan.source_status} · {plan.requirement_category}</td><td>{plan.response_status}</td><td>{plan.response_summary}{plan.conditions?.length?<small>条件：{plan.conditions.join('；')}</small>:null}</td><td>{plan.supporting_evidence_ids?.join('、')||'—'}</td><td>{plan.target_sections?.join('、')}</td></tr>)}</tbody></table></div>
  </section><section className="card"><h2>Claim Gate 明细</h2><div className="table-scroll"><table className="data-table"><thead><tr><th>Claim</th><th>Requirement / Evidence</th><th>承诺</th><th>内容</th><th>决策与原因</th><th>人工处理</th></tr></thead><tbody>{claims.map((claim)=><tr key={claim.claim_id}><td>{claim.claim_id}</td><td>{claim.requirement_id}<small>{claim.basis_evidence_ids?.join('、')||'无 Evidence'}</small></td><td>{claim.requested_commitment}</td><td>{claim.text}</td><td><Badge type={claim.decision}>{claim.decision}</Badge><small>{claim.reason_code||'PASS'} · {claim.reason_message}</small></td><td><button disabled={claim.gate_decision==='rejected'} onClick={()=>decide(claim.claim_id,'approve')}>批准</button><button onClick={()=>decide(claim.claim_id,'reject')}>拒绝</button></td></tr>)}</tbody></table></div></section></div>;
}

function Overview({ data }) {
  const auditsByJob = new Map((data.generations || []).map((generation) => [generation.job_id, generation]));
  const tasks = [
    ...data.jobs.map((job) => ({ ...job, type: '标书生成', audit: auditsByJob.get(job.id) })),
    ...(data.parseJobs || []).map((job) => ({ ...job, type: `需求解析 · ${job.file_name}` })),
    ...data.tenderFiles.map((file) => ({ id: `file-${file.id}`, type: `文件上传 · ${file.original_name}`, status: file.status, created_at: file.created_at }))
  ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  return <div className="overview-grid"><section className="card stats"><Stat label="项目状态" value={statusLabels[data.project.status] || data.project.status} /><Stat label="招标文件" value={`${data.tenderFiles.length} 份`} /><Stat label="文档版本" value={`${data.versions.length} 个`} /><Stat label="风险状态" value={data.versions[0] ? riskLabels[data.versions[0].risk_status] : '待生成'} /></section><section className="card"><h2>任务中心</h2>{tasks.length ? <div className="task-list">{tasks.map((task) => <div key={task.id} className="task-item"><div><strong>{task.type}</strong><p>{formatDate(task.created_at)}</p>{task.audit ? <p className="audit-summary">审计已归档 · Workflow {task.audit.workflow_version} · {task.audit.runtime_ms} ms{task.audit.error_code ? ` · ${task.audit.error_code}` : ''}</p> : null}</div><Badge type={task.status}>{statusLabels[task.status] || task.status}</Badge>{task.error_message ? <span className="task-error">{task.error_message}</span> : null}</div>)}</div> : <Empty title="暂无任务" text="上传招标文件或在“标书”页发起生成。" />}</section></div>;
}

function TenderFiles({ projectId, files, onChanged }) {
  const [state, setState] = useState({ file: null, loading: false, error: '' });
  async function uploadFile() {
    if (!state.file) return setState({ ...state, error: '请选择文件。' });
    setState({ ...state, loading: true, error: '' });
    try { await api.uploadTenderFile(projectId, state.file); setState({ file: null, loading: false, error: '' }); await onChanged(); }
    catch (error) { setState({ ...state, loading: false, error: error.message }); }
  }
  return <section className="card"><div className="section-heading"><div><h2>招标文件</h2><p>文件内容保存在后端存储，不进入版本库。</p></div><div className="upload-actions"><input type="file" onChange={(event) => setState({ ...state, file: event.target.files?.[0] || null, error: '' })} /><button className="primary-inline" onClick={uploadFile} disabled={state.loading}><FilePlus2 size={16} />上传</button></div></div>{state.error ? <Notice kind="error">{state.error}</Notice> : null}{files.length ? <div className="file-list">{files.map((file) => <div key={file.id}><strong>{file.original_name}</strong><span>{Math.ceil(Number(file.size_bytes) / 1024)} KB · {formatDate(file.created_at)}</span><Badge type={file.status}>{statusLabels[file.status] || file.status}</Badge></div>)}</div> : <Empty title="暂无招标文件" text="上传文件后会关联到当前项目。" />}</section>;
}

export function CompanyMaterials({ projectId, baseline, onUploaded, gapContext=null }) {
  const materialTypes = MATERIAL_TYPES;
  const [state, setState] = useState({ loading:true, error:'', materials:[], evidences:[], counts:{draft:0,approved:0,rejected:0} });
  const [upload, setUpload] = useState({ file:null, material_type:'company_profile' });
  const [form, setForm] = useState({ material_id:'', evidence_type:'technical_solution', title:'', content:'', source_text:'', source_page:'', source_paragraph:'', applicable_requirement_ids:[], usage_scope:'', risk_notes:'' });
  async function load() {
    try {
      const [materials, catalog] = await Promise.all([api.listCompanyMaterials(projectId), api.listEvidences(projectId)]);
      setState({ loading:false, error:'', materials:materials.materials || [], evidences:catalog.evidences || [], counts:catalog.counts || {draft:0,approved:0,rejected:0} });
    } catch (error) { setState((current) => ({ ...current, loading:false, error:error.message })); }
  }
  useEffect(() => { load(); }, [projectId]);
  async function uploadFile() {
    if (!upload.file) return setState((current) => ({ ...current, error:'请选择企业材料文件。' }));
    try { const result=await api.uploadCompanyMaterial(projectId, upload.file, upload.material_type); setUpload({ ...upload, file:null }); await load(); onUploaded?.(result.material); }
    catch (error) { setState((current) => ({ ...current, error:error.message })); await load(); }
  }
  async function createEvidence() {
    try { await api.createEvidence(projectId, { ...form, source_page:form.source_page || null, source_paragraph:form.source_paragraph || null }); setForm({ ...form, title:'', content:'', source_text:'', source_page:'', source_paragraph:'', risk_notes:'' }); await load(); }
    catch (error) { setState((current) => ({ ...current, error:error.message })); }
  }
  async function decide(id, decision) { try { await api.decideEvidence(id, decision); await load(); } catch (error) { setState((current) => ({ ...current, error:error.message })); } }
  const requirements = baseline?.requirements || [];
  return <div className="document-layout"><section className="card"><div className="section-heading"><div><h2>企业材料</h2><p>保存原文件并在本地提取文本；扫描 PDF 会标记 OCR_REQUIRED。</p></div></div>{gapContext?<Notice kind="warning">正在为 {gapContext.requirement_id} 补充材料。系统已保留相关需求；上传后仍需经过证据确认、材料证明内容确认和需求匹配确认。</Notice>:null}{state.error ? <Notice kind="error">{state.error}</Notice> : null}<div className="upload-actions"><input type="file" accept=".docx,.pdf,.txt,.md" onChange={(event) => setUpload({ ...upload, file:event.target.files?.[0] || null })} /><select value={upload.material_type} onChange={(event) => setUpload({ ...upload, material_type:event.target.value })}>{materialTypes.map((type) => <option key={type}>{type}</option>)}</select><button className="primary-inline" onClick={uploadFile}>上传并解析</button></div>{state.loading ? <Loading text="正在读取企业材料" /> : <div className="file-list">{state.materials.map((material) => <div key={material.id}><strong>{material.original_name}</strong><span>{material.material_type} · {material.extraction_status}</span><Badge type={material.extraction_status === 'succeeded' ? 'succeeded' : material.extraction_status === 'ocr_required' ? 'warning' : 'neutral'}>{material.extraction_status}</Badge>{material.extraction_error_message ? <small>{material.extraction_error_message}</small> : null}{material.extracted_text ? <details><summary>预览提取文本</summary><p>{material.extracted_text.slice(0,1000)}</p></details> : null}</div>)}</div>}</section><section className="card"><h2>材料依据</h2><div className="parse-summary"><Stat label="待审核" value={state.counts.draft || 0} /><Stat label="已确认" value={state.counts.approved || 0} /><Stat label="已拒绝" value={state.counts.rejected || 0} /></div><label className="field"><span>来源材料</span><select value={form.material_id} onChange={(event) => setForm({ ...form, material_id:event.target.value })}><option value="">请选择已解析材料</option>{state.materials.filter((item) => item.extraction_status === 'succeeded').map((item) => <option key={item.id} value={item.id}>{item.original_name}</option>)}</select></label><label className="field"><span>材料类别</span><select value={form.evidence_type} onChange={(event) => setForm({ ...form, evidence_type:event.target.value })}>{materialTypes.map((type) => <option key={type}>{type}</option>)}</select></label><label className="field"><span>标题</span><input value={form.title} onChange={(event) => setForm({ ...form, title:event.target.value })} /></label><label className="field"><span>内容</span><textarea value={form.content} onChange={(event) => setForm({ ...form, content:event.target.value })} /></label><label className="field"><span>来源原文（未知可留空）</span><textarea value={form.source_text} onChange={(event) => setForm({ ...form, source_text:event.target.value })} /></label><div className="compact-actions"><input type="number" placeholder="来源页" value={form.source_page} onChange={(event) => setForm({ ...form, source_page:event.target.value })} /><input type="number" placeholder="来源段" value={form.source_paragraph} onChange={(event) => setForm({ ...form, source_paragraph:event.target.value })} /></div><fieldset><legend>关联已确认招标要求</legend>{requirements.map((requirement) => <label key={requirement.req_id}><input type="checkbox" checked={form.applicable_requirement_ids.includes(requirement.req_id)} onChange={(event) => setForm({ ...form, applicable_requirement_ids:event.target.checked ? [...form.applicable_requirement_ids,requirement.req_id] : form.applicable_requirement_ids.filter((id) => id !== requirement.req_id) })} />{requirement.req_id} · {requirement.content}</label>)}</fieldset><label className="field"><span>使用范围</span><input value={form.usage_scope} onChange={(event) => setForm({ ...form, usage_scope:event.target.value })} /></label><label className="field"><span>风险备注</span><textarea value={form.risk_notes} onChange={(event) => setForm({ ...form, risk_notes:event.target.value })} /></label><button className="primary-inline" onClick={createEvidence}>保存材料依据</button><div className="version-list">{state.evidences.map((evidence) => <div key={evidence.id}><div><strong>{evidence.title}</strong><p>{evidence.content}</p><small>{evidence.material_name || '材料'} · {evidence.approval_status} · 关联 {(evidence.applicable_requirement_ids || []).join('、') || '无'}</small></div><Badge type={evidence.approval_status}>{evidence.approval_status}</Badge>{evidence.approval_status === 'draft' ? <div className="compact-actions"><button onClick={() => decide(evidence.id,'approve')}>确认</button><button onClick={() => decide(evidence.id,'reject')}>拒绝</button></div> : null}</div>)}</div></section></div>;
}

export function formatTenderParseError(value) {
  const code = value?.code || value?.error_code;
  const message = value?.message || value?.error_message;
  if (code && message) return `需求提取失败：${code} · ${message}`;
  if (code) return `需求提取失败：${code}`;
  return message ? `需求提取失败：${message}` : '需求提取失败，请稍后重试。';
}

export function formatTenderParsePhase(job) {
  if (!job) return '等待开始';
  if (job.status === 'failed') {
    return job.failed_chunk_number
      ? `分片 ${job.failed_chunk_number}/${job.total_chunks || '?'} 失败`
      : '处理失败';
  }
  const labels = {
    queued: '等待执行',
    text_extraction: '文本提取',
    section_classification: '文档章节分类',
    chunking: '文本分片',
    aggregating: '汇总校验',
    succeeded: '解析完成'
  };
  if (job.phase === 'extracting') {
    return `分片进度 ${job.completed_chunks || 0}/${job.total_chunks || 0}`;
  }
  return labels[job.phase] || labels[job.status] || '处理中';
}

export function formatRequirementLevel(requirement) {
  if (requirement?.is_mandatory && requirement?.mandatory_scope_source_text) {
    return '章节级实质性要求';
  }
  return requirement?.is_mandatory
    ? `${requirement.mandatory_marker || '★'} 实质性要求`
    : '一般要求';
}

export function formatRequirementSource(requirement) {
  if (requirement?.source_resolution_status === 'suggested') return '建议匹配';
  if (requirement?.source_verified === false) return '未定位';
  if (!Object.hasOwn(requirement || {}, 'source_page_start')) {
    return [requirement?.source_section, requirement?.source_clause_id,
      requirement?.source_page ? `第 ${requirement.source_page} 页` : null,
      requirement?.source_paragraph ? `第 ${requirement.source_paragraph} 段` : null
    ].filter(Boolean).join(' · ') || '未标注';
  }
  const pageStart = requirement.source_page_start ?? requirement.source_page;
  const pageEnd = requirement.source_page_end ?? pageStart;
  const paragraphStart = requirement.source_paragraph_start ?? requirement.source_paragraph;
  const paragraphEnd = requirement.source_paragraph_end ?? paragraphStart;
  if (pageStart && paragraphStart) {
    const pages = pageEnd && pageEnd !== pageStart ? `第${pageStart}–${pageEnd}页` : `第${pageStart}页`;
    const paragraphs = paragraphEnd && paragraphEnd !== paragraphStart ? `第${paragraphStart}–${paragraphEnd}段` : `第${paragraphStart}段`;
    return `${pages}·${paragraphs}`;
  }
  return [
    requirement?.source_section,
    requirement?.source_clause_id,
    requirement?.source_page ? `第 ${requirement.source_page} 页` : null,
    requirement?.source_paragraph ? `第 ${requirement.source_paragraph} 段` : null
  ].filter(Boolean).join(' · ') || '未标注';
}

export function summarizeRequirementSources(candidates = []) {
  const statusOf = (item) => item.candidate_decision === 'exclude' || item.source_status === 'excluded'
    ? 'excluded' : item.source_status || (item.source_verified === true || (item.source_verified === undefined && (item.source_page || item.source_paragraph)) ? 'verified' : 'provisional');
  return {
    total: candidates.length,
    verified: candidates.filter((item) => statusOf(item) === 'verified').length,
    provisional: candidates.filter((item) => statusOf(item) === 'provisional').length,
    suggested: candidates.filter((item) => statusOf(item) === 'provisional' && item.source_resolution_status === 'suggested').length,
    unresolved: candidates.filter((item) => statusOf(item) === 'provisional' && item.source_resolution_status !== 'suggested').length,
    excluded: candidates.filter((item) => statusOf(item) === 'excluded').length,
    pending: candidates.filter((item) => item.candidate_decision === 'pending').length
  };
}

function RequirementCandidatePanel({ candidates, visibleCandidates, sourceSummary, sourceFilter, setSourceFilter,
  displayJob, isConfirmed, isLoading, state, safeWarnings, review, setReview, openSourceReview,
  saveSourceDecision, decideCandidate, updateClassification, includeProvisionalBatch, confirmBaseline, startParse, selectedFileId,
  setSelectedFileId, files, actionLabel, emptyText, confirmBlocked, mandatoryPending, provisionalPending }) {
  const statusOf = (candidate) => candidate.candidate_decision === 'exclude' || candidate.source_status === 'excluded'
    ? 'excluded' : candidate.source_status || (candidate.source_verified === true || (candidate.source_verified === undefined && (candidate.source_page || candidate.source_paragraph)) ? 'verified' : 'provisional');
  return <section className="card requirement-panel">
    <div className="section-heading"><div><h2>需求解析与基线确认</h2><p>来源状态独立保留；暂定需求不会生成页码或段落号。</p></div><div className="parse-actions"><select value={selectedFileId} onChange={(event) => setSelectedFileId(event.target.value)} disabled={isConfirmed || isLoading}><option value="">选择招标文件</option>{files.map((file) => <option value={file.id} key={file.id}>{file.original_name}</option>)}</select><button className="primary-inline" onClick={startParse} disabled={isConfirmed || isLoading || !files.length}>{isLoading ? <Loader2 className="spin" size={16} /> : <FileSearch size={16} />}{actionLabel}</button></div></div>
    {state.error ? <Notice kind="error">{formatTenderParseError(state.error)}</Notice> : null}{state.message ? <Notice kind="success">{state.message}</Notice> : null}
    {displayJob ? <div className="parse-summary"><Stat label="总候选数" value={`${sourceSummary.total || displayJob.requirement_count || 0} 条`} /><Stat label="verified" value={`${sourceSummary.verified} 条`} /><Stat label="provisional" value={`${sourceSummary.provisional} 条`} /><Stat label="excluded" value={`${sourceSummary.excluded} 条`} /><Stat label="处理阶段" value={isConfirmed ? '基线已确认' : formatTenderParsePhase(displayJob)} /></div> : null}
    {displayJob?.status === 'failed' && !state.error ? <Notice kind="error">{formatTenderParseError(displayJob)}</Notice> : null}{safeWarnings.map((warning, index) => <Notice kind="warning" key={index}>{warning.message || String(warning)}</Notice>)}
    {candidates.length ? <>
      <div className="source-filter"><label>来源状态筛选 <select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)}><option value="all">全部</option><option value="verified">verified</option><option value="provisional">provisional</option><option value="excluded">excluded</option></select></label>{!isConfirmed && provisionalPending.some((item) => !item.is_mandatory) ? <button className="secondary-button" onClick={includeProvisionalBatch}>批量纳入 provisional</button> : null}</div>
      <div className="table-scroll"><table className="data-table requirement-table"><thead><tr><th>REQ-ID</th><th>需求内容</th><th>来源位置</th><th>要求等级</th><th>用途分类</th><th>来源状态</th><th>处理</th></tr></thead><tbody>{visibleCandidates.map((candidate) => <tr key={candidate.req_id}><td><strong>{candidate.req_id}</strong></td><td>{candidate.content}</td><td>{statusOf(candidate) === 'provisional' ? '—' : formatRequirementSource(candidate)}</td><td><div>{formatRequirementLevel(candidate)}</div>{candidate.mandatory_scope_source_text ? <small>依据：{candidate.mandatory_scope_source_text}</small> : null}</td><td><select value={candidate.requirement_category || ''} disabled={isConfirmed} onChange={(event) => updateClassification(candidate, event.target.value)}><option value="">待复核</option>{requirementCategories.map((category) => <option key={category} value={category}>{category}</option>)}</select><small>{candidate.writer_eligible ? '可用于技术正文' : '不直接进入技术正文'}{candidate.atomicity_review_required ? ' · 待原子性复核' : ''}</small></td><td><Badge type={statusOf(candidate) === 'verified' ? 'succeeded' : 'neutral'}>{statusOf(candidate)}</Badge></td><td>{isConfirmed ? '已冻结' : statusOf(candidate) === 'excluded' ? <button onClick={() => decideCandidate(candidate, 'restore')}>恢复</button> : <div className="compact-actions">{statusOf(candidate) === 'provisional' && candidate.candidate_decision === 'pending' ? <button onClick={() => decideCandidate(candidate, 'include_provisional')}>{candidate.is_mandatory ? '逐条确认纳入' : '纳入'}</button> : null}<button onClick={() => decideCandidate(candidate, 'exclude')}>排除</button>{statusOf(candidate) === 'provisional' ? <button onClick={() => openSourceReview(candidate)}>定位来源</button> : null}</div>}</td></tr>)}</tbody></table></div>
      {review ? <div className="source-review"><h3>处理 {review.candidate.req_id} 来源</h3><p><strong>候选需求：</strong>{review.candidate.content}</p><p><strong>模型引用：</strong>{review.candidate.source_text}</p>{review.error ? <Notice kind="error">{review.error}</Notice> : null}<div className="review-paragraphs">{review.paragraphs.map((item) => <p key={item.paragraph_number}>第{item.page_number || '—'}页·第{item.paragraph_number}段：{item.text}</p>)}</div><div className="compact-actions"><input type="number" placeholder="起始段" value={review.start} onChange={(event) => setReview({ ...review, start: event.target.value })} /><input type="number" placeholder="结束段" value={review.end} onChange={(event) => setReview({ ...review, end: event.target.value })} /><button onClick={() => saveSourceDecision('associate')}>关联连续段落</button><button onClick={() => saveSourceDecision('exclude')}>排除此候选</button><button onClick={() => setReview(null)}>取消</button></div></div> : null}
      {!isConfirmed ? <div className="warning-summary"><strong>确认前风险摘要</strong><p>暂定需求 {sourceSummary.provisional} 条；其中待确认 {provisionalPending.length} 条。</p>{mandatoryPending.length ? <Notice kind="warning">{mandatoryPending.length} 条 mandatory 暂定需求禁止自动确认，必须逐条人工确认或排除。</Notice> : null}<p>暂定需求的来源位置保持为空，进入响应规划后仍保留 provisional 状态。</p></div> : null}
      <div className="baseline-actions"><p>{isConfirmed ? '该基线已冻结，不可增删改或合并 REQ-ID。' : sourceSummary.pending ? `仍有 ${sourceSummary.pending} 条候选待明确纳入或排除。` : '全部候选已处理，可按门禁确认。'}</p><button className="primary-inline" onClick={confirmBaseline} disabled={isConfirmed || isLoading || displayJob?.status !== 'succeeded' || confirmBlocked}><CheckCircle2 size={16} />{isConfirmed ? '需求基线已确认' : '确认需求基线'}</button></div>
    </> : <Empty title="暂无候选需求" text={emptyText} />}
  </section>;
}

export function RequirementParsing({ projectId, files, parseJobs, baseline, onChanged }) {
  const latestJob = parseJobs[0];
  const [selectedFileId, setSelectedFileId] = useState(files[0]?.id || '');
  const [jobDetail, setJobDetail] = useState(latestJob?.candidates ? latestJob : null);
  const [state, setState] = useState({ loading: false, error: null, message: '' });
  const [sourceFilter, setSourceFilter] = useState('all');
  const [review, setReview] = useState(null);

  useEffect(() => {
    if (!selectedFileId && files[0]?.id) setSelectedFileId(files[0].id);
  }, [files, selectedFileId]);

  useEffect(() => {
    let active = true;
    if (!latestJob?.id) { setJobDetail(null); return () => { active = false; }; }
    api.getTenderParseJob(latestJob.id)
      .then((payload) => { if (active) setJobDetail(payload.job); })
      .catch((error) => { if (active) setState((current) => ({ ...current, error })); });
    return () => { active = false; };
  }, [latestJob?.id, latestJob?.updated_at]);

  async function startParse() {
    if (!selectedFileId) return setState({ loading: false, error: { message: '请先上传并选择招标文件。' }, message: '' });
    setState({ loading: true, error: null, message: '' });
    try {
      const payload = await api.startTenderParse(projectId, selectedFileId);
      setJobDetail(payload.job);
      setState({
        loading: false,
        error: null,
        message: payload.job.status === 'succeeded'
          ? '需求解析完成，请核对候选需求后确认基线。'
          : '需求解析任务已创建，请等待状态更新。'
      });
      await onChanged();
    } catch (error) {
      setState({ loading: false, error, message: '' });
      await onChanged();
    }
  }

  async function confirmBaseline() {
    if (!jobDetail?.id) return;
    setState({ loading: true, error: null, message: '' });
    try {
      await api.confirmRequirementBaseline(jobDetail.id);
      setState({ loading: false, error: null, message: '需求基线已确认并冻结。' });
      await onChanged();
    } catch (error) {
      setState({ loading: false, error, message: '' });
    }
  }

  async function decideCandidate(candidate, action) {
    setState({ loading: true, error: null, message: '' });
    try {
      if (action === 'include_provisional') await api.confirmProvisionalCandidate(candidate.id);
      else if (action === 'exclude') await api.excludeRequirementCandidate(candidate.id);
      else await api.restoreRequirementCandidate(candidate.id);
      const payload = await api.getTenderParseJob(displayJob.id);
      setJobDetail(payload.job);
      setState({ loading: false, error: null, message: action === 'exclude' ? '候选需求已排除。' : action === 'restore' ? '候选需求已恢复。' : '候选需求已逐条纳入暂定基线。' });
    } catch (error) { setState({ loading: false, error, message: '' }); }
  }

  async function updateClassification(candidate, requirementCategory) {
    if (!requirementCategory) return;
    try {
      await api.updateRequirementClassification(candidate.id, requirementCategory);
      const payload = await api.getTenderParseJob(displayJob.id); setJobDetail(payload.job);
    } catch (error) { setState((current) => ({ ...current, error })); }
  }

  async function includeProvisionalBatch() {
    setState({ loading: true, error: null, message: '' });
    try {
      const result = await api.includeProvisionalBatch(displayJob.id);
      const payload = await api.getTenderParseJob(displayJob.id);
      setJobDetail(payload.job);
      const mandatoryCount = result.mandatory_manual_required?.length || 0;
      setState({ loading: false, error: null, message: `已批量纳入 ${result.included_count} 条暂定需求${mandatoryCount ? `；${mandatoryCount} 条 mandatory 仍需逐条确认` : ''}。` });
    } catch (error) { setState({ loading: false, error, message: '' }); }
  }

  async function openSourceReview(candidate) {
    try { const payload = await api.getCandidateSourceReview(candidate.id); setReview({ ...payload, start: '', end: '', error: '' }); }
    catch (error) { setState((current) => ({ ...current, error })); }
  }

  async function saveSourceDecision(action) {
    try {
      await api.decideCandidateSource(review.candidate.id, action === 'exclude'
        ? { action, reason: review.reason || '人工排除' }
        : { action, source_paragraph_start: Number(review.start), source_paragraph_end: Number(review.end), reason: review.reason || '人工关联来源' });
      const payload = await api.getTenderParseJob(displayJob.id); setJobDetail(payload.job); setReview(null);
    } catch (error) { setReview((current) => ({ ...current, error: error.message })); }
  }

  const displayJob = jobDetail || latestJob;
  const isConfirmed = Boolean(baseline);
  const isLoading = state.loading || ['queued', 'running'].includes(displayJob?.status);
  const candidates = isConfirmed
    ? baseline.requirements || []
    : displayJob?.status === 'succeeded' ? jobDetail?.candidates || [] : [];
  const sourceSummary = summarizeRequirementSources(candidates);
  const candidateStatus = (candidate) => candidate.candidate_decision === 'exclude' || candidate.source_status === 'excluded'
    ? 'excluded' : candidate.source_status || (candidate.source_verified === true || (candidate.source_verified === undefined && (candidate.source_page || candidate.source_paragraph)) ? 'verified' : 'provisional');
  const visibleCandidates = candidates.filter((candidate) => sourceFilter === 'all' || sourceFilter === candidateStatus(candidate));
  const status = isConfirmed ? 'confirmed' : isLoading ? 'loading' : displayJob?.status;
  const actionLabel = isConfirmed ? '基线已冻结' : isLoading ? '解析中…' : displayJob ? '重新解析' : '发起需求解析';
  const emptyText = status === 'failed'
    ? '本次解析失败，检查安全错误信息后可重新解析。'
    : files.length ? '选择招标文件并发起需求解析。' : '请先在“招标文件”页上传 DOCX、文本型 PDF 或纯文本文件。';
  const safeWarnings = (displayJob?.warnings_json || []).filter((warning) => !String(warning.code || '').startsWith('SOURCE_LOCATION_'));
  const mandatoryPending = candidates.filter((item) => item.is_mandatory && candidateStatus(item) === 'provisional' && item.candidate_decision === 'pending');
  const provisionalPending = candidates.filter((item) => candidateStatus(item) === 'provisional' && item.candidate_decision === 'pending');
  const confirmBlocked = sourceSummary.pending > 0 || !candidates.some((item) => item.candidate_decision === 'include');
  return <RequirementCandidatePanel {...{
    candidates, visibleCandidates, sourceSummary, sourceFilter, setSourceFilter, displayJob, isConfirmed,
    isLoading, state, safeWarnings, review, setReview, openSourceReview, saveSourceDecision,
    decideCandidate, updateClassification, includeProvisionalBatch, confirmBaseline, startParse, selectedFileId,
    setSelectedFileId, files, actionLabel, emptyText, confirmBlocked, mandatoryPending, provisionalPending
  }} />;
  return <section className="card requirement-panel"><div className="section-heading"><div><h2>需求解析与基线确认</h2><p>语义网关只提取候选内容；来源、REQ-ID 与冻结由后端控制。</p></div><div className="parse-actions"><select value={selectedFileId} onChange={(event) => setSelectedFileId(event.target.value)} disabled={isConfirmed || isLoading}><option value="">选择招标文件</option>{files.map((file) => <option value={file.id} key={file.id}>{file.original_name}</option>)}</select><button className="primary-inline" onClick={startParse} disabled={isConfirmed || isLoading || !files.length}>{isLoading ? <Loader2 className="spin" size={16} /> : <FileSearch size={16} />}{actionLabel}</button></div></div>{state.error ? <Notice kind="error">{formatTenderParseError(state.error)}</Notice> : null}{state.message ? <Notice kind="success">{state.message}</Notice> : null}{displayJob ? <div className="parse-summary"><Stat label="总候选数" value={`${sourceSummary.total || displayJob.requirement_count || 0} 条`} /><Stat label="已定位" value={`${sourceSummary.verified} 条`} /><Stat label="建议匹配" value={`${sourceSummary.suggested} 条`} /><Stat label="未定位" value={`${sourceSummary.unresolved} 条`} /><Stat label="已排除" value={`${sourceSummary.excluded} 条`} /><Stat label="处理阶段" value={isConfirmed ? '基线已确认' : formatTenderParsePhase(displayJob)} /></div> : null}{displayJob?.status === 'failed' && !state.error ? <Notice kind="error">{formatTenderParseError(displayJob)}</Notice> : null}{safeWarnings.map((warning, index) => <Notice kind="warning" key={index}>{warning.message || String(warning)}</Notice>)}{candidates.length ? <><div className="source-filter"><label>来源状态筛选 <select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)}><option value="all">全部</option><option value="verified">已定位</option><option value="suggested">建议匹配</option><option value="unresolved">未定位</option><option value="excluded">已排除</option></select></label></div><div className="table-scroll"><table className="data-table requirement-table"><thead><tr><th>REQ-ID</th><th>需求内容</th><th>来源片段</th><th>来源位置</th><th>要求等级</th><th>处理</th></tr></thead><tbody>{visibleCandidates.map((candidate) => <tr key={candidate.req_id}><td><strong>{candidate.req_id}</strong></td><td>{candidate.content}</td><td>{candidate.source_excerpt}</td><td>{formatRequirementSource(candidate)}</td><td><div>{formatRequirementLevel(candidate)}</div>{candidate.mandatory_scope_source_text ? <small>依据：{candidate.mandatory_scope_source_text}</small> : null}</td><td>{candidate.candidate_decision === 'exclude' ? <Badge>已排除</Badge> : candidate.source_verified ? <Badge type="succeeded">已定位</Badge> : <button className="secondary-button" onClick={() => openSourceReview(candidate)}>处理来源</button>}</td></tr>)}</tbody></table></div>{review ? <div className="source-review"><h3>处理 {review.candidate.req_id} 来源</h3><p><strong>候选需求：</strong>{review.candidate.content}</p><p><strong>模型引用：</strong>{review.candidate.source_text}</p>{review.error ? <Notice kind="error">{review.error}</Notice> : null}<div className="review-paragraphs">{review.paragraphs.map((item) => <p key={item.paragraph_number}>第{item.page_number || '—'}页·第{item.paragraph_number}段：{item.text}</p>)}</div><div className="compact-actions"><input type="number" placeholder="起始段" value={review.start} onChange={(event) => setReview({ ...review, start: event.target.value })} /><input type="number" placeholder="结束段" value={review.end} onChange={(event) => setReview({ ...review, end: event.target.value })} /><button onClick={() => saveSourceDecision('associate')}>关联连续段落</button><button onClick={() => saveSourceDecision('exclude')}>排除此候选</button><button onClick={() => setReview(null)}>取消</button></div></div> : null}<div className="baseline-actions"><p>{isConfirmed ? '该基线已冻结，不可增删改或合并 REQ-ID。' : sourceSummary.pending ? `仍有 ${sourceSummary.pending} 条候选待人工关联来源或排除。` : '全部候选已处理，可按门禁确认。'}</p><button className="primary-inline" onClick={confirmBaseline} disabled={isConfirmed || isLoading || displayJob?.status !== 'succeeded' || confirmBlocked}><CheckCircle2 size={16} />{isConfirmed ? '需求基线已确认' : '确认需求基线'}</button></div></> : <Empty title="暂无候选需求" text={emptyText} />}</section>;
}

export function getChapterDisplayState(task, generation) {
  const status = String(task?.status || 'queued');
  if (status === 'failed') return { key: 'failed', label: '生成失败' };
  if (status === 'finalized' || (generation?.status === 'finalized' && ['succeeded', 'validated'].includes(status))) return { key: 'completed', label: '已完成' };
  if (status === 'succeeded' && generation?.status === 'failed') return { key: 'completed', label: '已完成' };
  if (['validated', 'revision_required', 'revised', 'merged', 'sanitized'].includes(status) || (status === 'succeeded' && generation?.status && !['finalized', 'failed'].includes(generation.status))) return { key: 'checking', label: '检查中' };
  if (status === 'running') return { key: 'generating', label: '生成中' };
  return { key: 'waiting', label: '等待生成' };
}

export function getGenerationDisplayState(generation) {
  if (!generation) return { key: 'idle', label: '尚未开始' };
  if (generation.status === 'finalized') return { key: 'completed', label: '已完成' };
  if (generation.status === 'failed') return { key: 'attention', label: '需要处理' };
  if (generation.status === 'created' || generation.status === 'queued') return { key: 'waiting', label: '等待生成' };
  return { key: 'running', label: '标书生成中' };
}

export function BidDocument({ project, version, generations = [], generation: initialGeneration = null, onGenerated, onStartCheck }) {
  const [state,setState]=useState({loading:false,error:'',generation:initialGeneration || generations[0] || null,selectedTaskId:(initialGeneration || generations[0])?.tasks?.[0]?.id || null});
  const html=useMemo(()=>marked.parse(version?.final_text||version?.content_markdown||'# 尚未生成正文'),[version]);
  useEffect(() => {
    const latest = initialGeneration || generations[0];
    if (!latest?.id) return undefined;
    let active = true;
    const refresh = () => api.getDocumentGeneration(latest.id).then((detail) => {
      if (!active) return;
      setState((current) => ({ ...current, generation: detail, selectedTaskId: current.selectedTaskId || detail.tasks?.[0]?.id || null }));
    }).catch(() => {});
    refresh();
    if (['finalized', 'failed'].includes(latest.status)) return () => { active = false; };
    const timer = window.setInterval(refresh, 2500);
    return () => { active = false; window.clearInterval(timer); };
  }, [initialGeneration?.id, initialGeneration?.updated_at, generations[0]?.id, generations[0]?.updated_at]);
  async function generate(){setState({...state,loading:true,error:'',generation:null,selectedTaskId:null});try{const generation=await api.createDocumentGeneration(project.id);setState({loading:false,error:'',generation,selectedTaskId:generation.tasks?.[0]?.id||null});await onGenerated();}catch(error){setState({...state,loading:false,error:error.message});}}
  async function retry(){try{const generation=await api.retryDocumentBatches(state.generation.id);setState({...state,generation,error:'',selectedTaskId:generation.tasks?.[0]?.id||null});await onGenerated();}catch(error){setState({...state,error:error.message});}}
  async function regenerate(chapterId){try{await api.regenerateChapter(version.id,chapterId);await onGenerated();}catch(error){setState({...state,error:error.message});}}
  const tasks=state.generation?.tasks||[];const failed=tasks.filter((t)=>t.status==='failed');const completed=tasks.filter((t)=>getChapterDisplayState(t,state.generation).key==='completed').length;const selectedTask=tasks.find((task)=>task.id===state.selectedTaskId)||tasks[0];const taskHtml=useMemo(()=>selectedTask?.output_markdown?marked.parse(selectedTask.output_markdown):'', [selectedTask]);
  const generationStatus=getGenerationDisplayState(state.generation);
  const title = generationStatus.key === 'attention' ? '标书生成需要处理' : generationStatus.key === 'completed' ? '标书已生成' : generationStatus.key === 'idle' ? '标书生成' : '标书生成中';
  return <div className="document-layout"><section className="card generation-form"><h2>{title}</h2><p>系统会按章节完成正文。你可以先查看已完成内容，不必等整份标书结束。</p><div className="generation-summary"><Stat label="当前状态" value={generationStatus.label}/><Stat label="章节进度" value={tasks.length?`${completed}/${tasks.length} 个章节已完成`:'尚未创建章节任务'}/></div>{state.error?<Notice kind="error">{state.error}</Notice>:null}<button className="primary-button" onClick={generate} disabled={state.loading}>{state.loading?<Loader2 className="spin" size={18}/>:<Sparkles size={18}/>}开始生成正文</button>{tasks.length?<div className="chapter-task-list"><strong>章节目录</strong>{tasks.map((task,index)=>{const display=getChapterDisplayState(task,state.generation);return <button type="button" className={`chapter-task ${selectedTask?.id===task.id?'selected':''}`} key={task.id} onClick={()=>setState({...state,selectedTaskId:task.id})}><span><strong>{task.title||task.chapter_title||`第 ${index+1} 章`}</strong><small>{display.label}</small></span><Badge type={display.key}>{display.label}</Badge></button>})}{failed.length?<button className="secondary-button" onClick={retry}>重新处理失败章节</button>:null}</div>:null}<details><summary>查看生成依据（专业信息）</summary><p className="helper">系统只消费已确认需求、已审核响应计划、已通过内容检查和后端章节路由。</p>{tasks.map((task)=><small key={`audit-${task.id}`}>chapter_id={task.chapter_id} · batch={task.batch_index+1} · {task.status}</small>)}</details>{selectedTask?.output_markdown?<div className="chapter-preview"><h3>{getChapterDisplayState(selectedTask,state.generation).key==='completed'?'已完成章节':'生成中预览'}</h3>{selectedTask.error_message?<Notice kind="error">{selectedTask.error_message} 其他已完成章节仍可继续查看。</Notice>:null}<article className="markdown-preview" dangerouslySetInnerHTML={{__html:taskHtml}}/></div>:selectedTask?.error_message?<div className="chapter-preview"><h3>本章节需要处理</h3><Notice kind="error">{selectedTask.error_message} 其他已完成章节仍可继续查看。</Notice></div>:null}{version && generationStatus.key==='completed' && onStartCheck?<button className="primary-inline" onClick={onStartCheck}>开始投标检查</button>:null}</section><section className="card document-card"><div className="section-heading"><div><h2>{version?.title||'正式正文'}</h2><p>{version?`V${version.version_number} · ${riskLabels[version.risk_status]} · ${version.status}`:'生成完成后，这里会显示可阅读的正式正文。'}</p></div></div>{version?.sections_json?.length?<aside className="toc"><strong>章节目录</strong>{version.sections_json.map((section)=><span key={section.chapter_id||section.id}>{section.title}<button onClick={()=>regenerate(section.chapter_id||section.id)}>重新生成</button></span>)}</aside>:null}{version?.removed_items?.length?<div className="warning-summary"><strong>内容检查提醒</strong>{version.removed_items.map((item,index)=><p key={index}>{item.message||item.code}</p>)}</div>:null}{version?.validation_errors?.map((item,index)=><Notice kind="error" key={index}>{item.message}</Notice>)}{version?.warnings_json?.map((item,index)=><Notice kind="warning" key={index}>{item.message}</Notice>)}<article className="markdown-preview" dangerouslySetInnerHTML={{__html:html}}/></section></div>;
}

function LegacyBidDocument({ project, version, onGenerated }) {
  const [form, setForm] = useState({ project_name: project.name, project_type: projectTypes[0], output_mode: outputModes[0], bid_need: '', focus_points: '' });
  const [state, setState] = useState({ loading: false, error: '', copy: '' });
  const html = useMemo(() => marked.parse(version?.content_markdown || '# 尚未生成正式正文\n\n填写生成参数后发起任务。', { breaks: true, gfm: true }), [version]);
  async function generate(event) {
    event.preventDefault();
    if (Object.values(form).some((value) => !String(value).trim())) return setState({ ...state, error: '请完整填写生成参数。' });
    setState({ loading: true, error: '', copy: '' });
    try { await api.generate(project.id, form); setState({ loading: false, error: '', copy: '' }); await onGenerated(); }
    catch (error) { setState({ loading: false, error: error.message, copy: '' }); await onGenerated(); }
  }
  async function copy() { if (version) { await navigator.clipboard.writeText(version.content_markdown); setState({ ...state, copy: '已复制' }); } }
  function download() { if (!version) return; const url = URL.createObjectURL(new Blob([version.content_markdown], { type: 'text/markdown;charset=utf-8' })); const link = document.createElement('a'); link.href = url; link.download = `${sanitizeFileName(project.name)}-V${version.version_number}.md`; link.click(); URL.revokeObjectURL(url); }
  return <div className="document-layout"><form className="card generation-form" onSubmit={generate}><h2>生成参数</h2><label className="field"><span>项目类型</span><select value={form.project_type} onChange={(e) => setForm({ ...form, project_type: e.target.value })}>{projectTypes.map((item) => <option key={item}>{item}</option>)}</select></label><label className="field"><span>输出类型</span><select value={form.output_mode} onChange={(e) => setForm({ ...form, output_mode: e.target.value })}>{outputModes.map((item) => <option key={item}>{item}</option>)}</select></label><label className="field"><span>招标需求</span><textarea rows="7" value={form.bid_need} onChange={(e) => setForm({ ...form, bid_need: e.target.value })} /></label><label className="field"><span>重点响应要求</span><textarea rows="5" value={form.focus_points} onChange={(e) => setForm({ ...form, focus_points: e.target.value })} /></label>{state.error ? <Notice kind="error">{state.error}</Notice> : null}<button className="primary-button" disabled={state.loading}>{state.loading ? <Loader2 className="spin" size={18} /> : <Sparkles size={18} />}{state.loading ? '生成中…' : '生成新版本'}</button></form><section className="card document-card"><div className="section-heading"><div><h2>{version?.title || '正式正文'}</h2><p>{version ? `V${version.version_number} · ${riskLabels[version.risk_status]}` : '等待生成'}</p></div><div className="compact-actions"><button onClick={copy} disabled={!version}><Clipboard size={16} />{state.copy || '复制'}</button><button onClick={download} disabled={!version}><Download size={16} />下载</button></div></div>{version?.sections_json?.length ? <aside className="toc"><strong>章节目录</strong>{version.sections_json.map((section) => <span key={section.id}>{section.title}</span>)}</aside> : null}{version?.warnings_json?.length ? <div className="warning-summary"><strong>警告摘要</strong>{version.warnings_json.map((warning, index) => <p key={index}>{warning.message}</p>)}</div> : null}<article className="markdown-preview" dangerouslySetInnerHTML={{ __html: html }} /></section></div>;
}

export function RiskReview({ projectId, version, baseline, onConfirmed = async () => {} }) {
  const [confirmation, setConfirmation] = useState('');
  const [state, setState] = useState({ loading: false, message: '', error: '' });
  const provisional = (baseline?.requirements || []).filter((item) => item.source_status === 'provisional');
  if (!version) return <section className="card review-card"><Empty title="暂无待复核版本" text="生成合法的标书正文后，风险门禁会显示在这里。" /><div className="warning-summary"><strong>暂定基线风险</strong><p>provisional 需求 {provisional.length} 条。</p>{provisional.length ? <ul>{provisional.map((item) => <li key={item.req_id}>{item.content}{item.is_mandatory ? '（mandatory）' : ''}</li>)}</ul> : <p>当前基线无 provisional 需求。</p>}</div></section>;
  async function confirm() { setState({ loading: true, message: '', error: '' }); try { await api.confirmVersion(version.id, confirmation); setState({ loading: false, message: '版本已确认并设为项目当前版本。', error: '' }); await onConfirmed(); } catch (error) { setState({ loading: false, message: '', error: error.message }); } }
  async function exportWord() { setState({ loading: true, message: '', error: '' }); try { const result = await api.downloadWord(projectId || version.project_id, version.id); setState({ loading: false, message: `Word 已下载：${result.fileName}`, error: '' }); } catch (error) { setState({ loading: false, message: '', error: error.message }); } }
  const blocked = version.risk_status === 'critical' || version.status === 'confirmed';
  const exportReady = version.risk_status !== 'critical' && (version.risk_status !== 'warning' || version.status === 'confirmed');
  return <section className="card review-card"><div className="risk-hero"><Badge type={version.risk_status}>{riskLabels[version.risk_status]}</Badge><div><h2>V{version.version_number} 风险门禁</h2><p>{version.risk_status === 'pass' ? '当前版本可直接确认。' : version.risk_status === 'warning' ? '必须填写风险确认说明后才能确认。' : '存在严重风险，禁止确认此版本。'}</p></div></div><div className="warning-summary"><strong>暂定基线风险</strong><p>provisional 需求 {provisional.length} 条。</p>{provisional.length ? <ul>{provisional.map((item) => <li key={item.req_id}>{item.content}{item.is_mandatory ? '（mandatory）' : ''}</li>)}</ul> : <p>当前基线无 provisional 需求。</p>}</div>{version.warnings_json?.map((warning, index) => <Notice kind={warning.level === 'critical' ? 'error' : 'warning'} key={index}>{warning.message}</Notice>)}{version.risk_status === 'warning' ? <label className="field"><span>风险确认说明 *</span><textarea value={confirmation} onChange={(e) => setConfirmation(e.target.value)} placeholder="说明已知风险、接受原因与后续处置责任。" /></label> : null}{state.error ? <Notice kind="error">{state.error}</Notice> : null}{state.message ? <Notice kind="success">{state.message}</Notice> : null}<div className="compact-actions"><button className="primary-inline" disabled={blocked || state.loading || (version.risk_status === 'warning' && !confirmation.trim())} onClick={confirm}>{version.status === 'confirmed' ? '已确认' : version.risk_status === 'critical' ? '严重风险禁止确认' : '确认此版本'}</button><button className="secondary-button" disabled={!exportReady || state.loading} onClick={exportWord}><Download size={16} />导出 Word</button></div>{!exportReady && version.risk_status === 'critical' ? <p className="helper">存在严重风险，处理完成前不能导出交付文件。</p> : null}{version.risk_status === 'warning' && version.status !== 'confirmed' ? <p className="helper">完成风险确认后即可导出 Word。</p> : null}</section>;
  return <section className="card review-card"><div className="risk-hero"><Badge type={version.risk_status}>{riskLabels[version.risk_status]}</Badge><div><h2>V{version.version_number} 风险门禁</h2><p>{version.risk_status === 'pass' ? '当前版本可直接确认。' : version.risk_status === 'warning' ? '必须填写风险确认说明后才能确认。' : '存在严重风险，禁止确认此版本。'}</p></div></div>{version.warnings_json?.map((warning, index) => <Notice kind={warning.level === 'critical' ? 'error' : 'warning'} key={index}>{warning.message}</Notice>)}{version.risk_status === 'warning' ? <label className="field"><span>风险确认说明 *</span><textarea value={confirmation} onChange={(e) => setConfirmation(e.target.value)} placeholder="说明已知风险、接受原因与后续处置责任。" /></label> : null}{state.error ? <Notice kind="error">{state.error}</Notice> : null}{state.message ? <Notice kind="success">{state.message}</Notice> : null}<button className="primary-inline" disabled={blocked || state.loading || (version.risk_status === 'warning' && !confirmation.trim())} onClick={confirm}>{version.status === 'confirmed' ? '已确认' : version.risk_status === 'critical' ? '严重风险禁止确认' : '确认此版本'}</button></section>;
}

function Versions({ versions }) {
  return <section className="card"><h2>版本记录</h2>{versions.length ? <div className="version-list">{versions.map((version) => <div key={version.id}><div><strong>V{version.version_number} · {version.title}</strong><p>{formatDate(version.created_at)}{version.confirmed_at ? ` · 确认于 ${formatDate(version.confirmed_at)}` : ''}</p></div><Badge type={version.risk_status}>{riskLabels[version.risk_status]}</Badge><Badge type={version.status}>{version.status === 'confirmed' ? '已确认' : '待确认'}</Badge></div>)}</div> : <Empty title="暂无版本" text="通过后端契约与风险校验的生成结果会形成可追溯版本。" />}</section>;
}

function App() {
  const [route, setRoute] = useState({ page: 'workbench', projectId: null });
  const navigatePlatform = (module) => setRoute({ page: module === '工作台' ? 'workbench' : module === '投标项目' ? 'list' : module === '企业资料库' ? 'library' : 'bid-check', projectId: null });
  if (route.page === 'create') return <CreateProject onBack={() => setRoute({ page: 'list' })} onCreated={(projectId) => setRoute({ page: 'workspace', projectId })} />;
  if (route.page === 'workspace') return <Workspace projectId={route.projectId} onBack={() => setRoute({ page: 'list' })} />;
  if (route.page === 'library') return <EnterpriseLibrary onNavigate={navigatePlatform} onOpen={(projectId) => setRoute({ page: 'workspace', projectId })} />;
  if (route.page === 'bid-check') return <BidCheck onNavigate={navigatePlatform} />;
  if (route.page === 'list') return <ProjectList onCreate={() => setRoute({ page: 'create' })} onNavigate={navigatePlatform} onOpen={(projectId) => setRoute({ page: 'workspace', projectId })} />;
  return <Workbench onCreate={() => setRoute({ page: 'create' })} onNavigate={navigatePlatform} onOpen={(projectId) => setRoute({ page: 'workspace', projectId })} />;
}

if (typeof document !== 'undefined') {
  createRoot(document.getElementById('root')).render(<App />);
}
