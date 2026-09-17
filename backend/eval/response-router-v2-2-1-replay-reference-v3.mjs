import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import JSZip from 'jszip';
import { execFileSync } from 'node:child_process';
import { projectRequirementResponseV21 } from '../src/pipeline/requirement-response-router-v2-1.js';
import { projectRequirementResponseV22 } from '../src/pipeline/requirement-response-router-v2-2.js';
import { projectRequirementResponseV221, RESPONSE_ROUTER_V221_VERSION, RESPONSE_ROUTER_V221_IMPLEMENTATION_ID } from '../src/pipeline/requirement-response-router-v2-2-1.js';

const ROOT = path.resolve(process.cwd());
const DOCS = path.join(ROOT, 'docs');
const ROUTER_PATH = path.join(ROOT, 'backend/src/pipeline/requirement-response-router-v2-2-1.js');
const REF_ZIP = path.join(DOCS, 'V43_RESPONSE_ROUTER_FULL_CORPUS_GPT_SEMANTIC_REFERENCE_V3_PACKAGE.zip');
const REF_ENTRY = 'V43_RESPONSE_ROUTER_FULL_CORPUS_GPT_SEMANTIC_REFERENCE_V3_2178.json';
const GPT_ZIP = [path.resolve(ROOT, '..', 'V43_GPT_ADJUDICATION_BUNDLE_20260912.zip'), path.resolve(ROOT, '..', '..', 'V43_GPT_ADJUDICATION_BUNDLE_20260912.zip')].find(fs.existsSync);
const GPT_ENTRY = 'V43_GPT_RESPONSE_ROUTER_V2_1_CORE6_HARD_SAFETY_ADJUDICATION.json';
const EXPECTED_REF_SHA = '3c7f151678c8c99aee25ab995d438496b4a0e5fc661386b70204f3be72e2e744';
const EXPECTED_GPT_SHA = '372eeb3f192a47dfa1fe633d1187f25641eabf8c6489b40680508f8d7b97baa5';
const COHORTS = { CORE6: 1009, HOLDOUT_V1: 397, HOLDOUT_V2: 772 };
const MODES = ['SOLUTION', 'EVIDENCE', 'COMMITMENT', 'COMPLIANCE', 'NEED_REVIEW'];
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const pct = (n, d) => d ? Number((n / d).toFixed(6)) : 0;
const stable = value => Array.isArray(value) ? `[${value.map(stable).join(',')}]` : (!value || typeof value !== 'object' ? JSON.stringify(value) : `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${stable(value[k])}`).join(',')}}`);
const jsonHash = value => sha(Buffer.from(stable(value), 'utf8'));
const txt = v => String(v ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim();
const countBy = (rows, fn) => rows.reduce((o, r) => { const k = String(fn(r)); o[k] = (o[k] || 0) + 1; return o; }, {});
const modeOf = r => r.v3_expected_router_mode || (r.v3_semantic_status === 'GENUINE_AMBIGUOUS_BOUNDARY' ? 'NEED_REVIEW' : r.v3_semantic_primary_mode);
const readZipJson = async (zipPath, entry) => { const z = await JSZip.loadAsync(fs.readFileSync(zipPath)); const f = z.file(entry); if (!f) throw new Error(`MISSING_ENTRY:${entry}`); const raw = await f.async('nodebuffer'); return { raw, value: JSON.parse(raw.toString('utf8')) }; };
const expected = (r, g) => ({
  primary_response_mode: g?.gpt_gate_verdict === 'REFERENCE_V3_SEMANTIC_DEBT' ? g.gpt_recommended_primary_mode : modeOf(r),
  evidence_dependency: g?.gpt_gate_verdict === 'REFERENCE_V3_SEMANTIC_DEBT' ? g.gpt_recommended_evidence_dependency : r.v3_evidence_dependency,
  risk_tier: g?.gpt_gate_verdict === 'REFERENCE_V3_SEMANTIC_DEBT' ? (r.v3_risk_tier ?? null) : r.v3_risk_tier,
  response_required: r.v3_response_required,
  human_required: r.v3_human_required,
  scoring_related: r.v3_scoring_related,
  secondary_dependencies: r.v3_secondary_dependencies || [],
  semantic_status: r.v3_semantic_status || null,
  reason: r.v3_reason || null
});
const dimensions = (router, exp) => {
  const out = [];
  if (router.response_mode !== exp.primary_response_mode) out.push('primary_response_mode');
  if (exp.risk_tier != null && router.risk_tier !== exp.risk_tier) out.push('risk_tier');
  if (exp.response_required != null && router.response_required !== exp.response_required) out.push('response_required');
  if (exp.evidence_dependency != null && router.evidence_dependency !== exp.evidence_dependency) out.push('evidence_dependency');
  if (exp.human_required != null && router.human_required !== exp.human_required) out.push('human_required');
  if (exp.scoring_related != null && router.is_scoring_related !== exp.scoring_related) out.push('scoring_related');
  return out;
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function classifyNeedReview(row) {
  const t = txt(row.requirement_text);
  const flags = [];
  if (/投标文件|响应文件|签章|盖章|承诺函|资格|报价|开标|评标|递交|上传/.test(t)) flags.push('CLEAR_COMPLIANCE');
  if (/中标后|合同|履约|服务期|质保期|交付|验收|驻场|派驻|响应|维修|维护|培训|备件/.test(t)) flags.push('CLEAR_COMMITMENT');
  if (/现有|已有|具备|具有|支持|兼容|适配|参数|指标|性能|认证|资质|案例|截图|报告/.test(t)) flags.push('CLEAR_EVIDENCE');
  if (/方案|架构|设计|实施|部署|规划|组织|方法|路线/.test(t)) flags.push('CLEAR_SOLUTION');
  let family = 'OTHER';
  const existing = /现有|已有|具备|具有|支持|兼容|适配|参数|指标|性能|认证|资质|案例|截图|报告/.test(t);
  const future = /中标后|合同|履约|服务期|质保期|交付|验收|驻场|派驻|响应|维修|维护|培训|备件/.test(t);
  if (existing && future) family = 'MIXED_EXISTING_FACT_AND_FUTURE_OBLIGATION';
  else if (flags.length > 1) family = 'MULTIPLE_PRIMARY_SIGNALS';
  else if (!flags.length) family = 'INSUFFICIENT_DOMINANCE';
  else if (row.router?.routing_reasons?.some(x => /AMBIGUOUS|CONFLICT/.test(x))) family = 'RULE_CONFLICT';
  return { case_id: row.case_id, requirement_id: row.requirement_id, reason_family: family, obvious_signals: flags, semantic_adjudication: 'NOT_PERFORMED' };
}

async function main() {
  if (!GPT_ZIP) throw new Error('GPT_ADJUDICATION_BUNDLE_MISSING');
  const ref = await readZipJson(REF_ZIP, REF_ENTRY); const gpt = await readZipJson(GPT_ZIP, GPT_ENTRY);
  if (sha(ref.raw) !== EXPECTED_REF_SHA) throw new Error('REFERENCE_V3_IDENTITY_MISMATCH');
  if (sha(gpt.raw) !== EXPECTED_GPT_SHA) throw new Error('GPT_ADJUDICATION_IDENTITY_MISMATCH');
  if (ref.value.requirements?.length !== 2178 || new Set(ref.value.requirements.map(r => r.case_id)).size !== 2178) throw new Error('REFERENCE_ROW_IDENTITY_MISMATCH');
  if (gpt.value.rows?.length !== 76 || new Set(gpt.value.rows.map(r => r.case_id)).size !== 76) throw new Error('GPT_ROW_IDENTITY_MISMATCH');
  const gptByCase = new Map(gpt.value.rows.map(r => [r.case_id, r]));
  const rows = ref.value.requirements.map(req => {
    const g = gptByCase.get(req.case_id); const v21 = projectRequirementResponseV21(req); const v22 = projectRequirementResponseV22(req); const v221 = projectRequirementResponseV221(req);
    const exp = expected(req, g);
    return { case_id: req.case_id, cohort: req.cohort, tender_id: req.tender_id, requirement_id: req.requirement_id, requirement_text: req.requirement_text, category: req.category, requirement_category: req.requirement_category, expected_view: exp, gpt_adjudication: g ? { verdict: g.gpt_gate_verdict, primary_response_mode: g.gpt_recommended_primary_mode, evidence_dependency: g.gpt_recommended_evidence_dependency, hard_safety_gate: g.hard_safety_gate, reason: g.gpt_reason } : null, v21, v22, v221, v21_correct: dimensions(v21, exp).length === 0, v22_correct: dimensions(v22, exp).length === 0, v221_correct: dimensions(v221, exp).length === 0, v21_to_v22: `${v21.response_mode}→${v22.response_mode}`, v21_to_v221: `${v21.response_mode}→${v221.response_mode}`, changed_dimensions: dimensions(v221, v21).length ? ['router_projection'] : [] };
  });
  const trueRows = gpt.value.rows.filter(r => r.gpt_gate_verdict !== 'REFERENCE_V3_SEMANTIC_DEBT');
  const byCase = new Map(rows.map(r => [r.case_id, r]));
  const high = trueRows.filter(r => r.hard_safety_gate === 'HIGH_RISK_EVIDENCE_FALSE_NEGATIVE');
  const future = trueRows.filter(r => r.hard_safety_gate === 'FUTURE_COMMITMENT_AS_EXISTING_FACT');
  const highBad = high.filter(r => byCase.get(r.case_id).v221.evidence_dependency !== true);
  const futureBad = future.filter(r => byCase.get(r.case_id).v221.response_mode === 'EVIDENCE');
  const overlay = gpt.value.rows.filter(r => r.gpt_gate_verdict === 'REFERENCE_V3_SEMANTIC_DEBT');
  const overlayRows = overlay.map(g => ({ case_id: g.case_id, expected_mode: g.gpt_recommended_primary_mode, expected_evidence_dependency: g.gpt_recommended_evidence_dependency, actual_mode: byCase.get(g.case_id).v221.response_mode, actual_evidence_dependency: byCase.get(g.case_id).v221.evidence_dependency, mode_match: byCase.get(g.case_id).v221.response_mode === g.gpt_recommended_primary_mode, evidence_dependency_match: byCase.get(g.case_id).v221.evidence_dependency === g.gpt_recommended_evidence_dependency }));
  const correctedWrong = rows.filter(r => r.v21_correct && !r.v221_correct);
  const correctedRight = rows.filter(r => !r.v21_correct && r.v221_correct);
  const expectedMode = r => r.expected_view.primary_response_mode;
  const modeAgreement = rs => rs.filter(r => r.v221.response_mode === expectedMode(r)).length;
  const riskMismatches = rows.filter(r => r.expected_view.risk_tier != null && r.v221.risk_tier !== r.expected_view.risk_tier).map(r => ({ case_id: r.case_id, requirement_id: r.requirement_id, expected: r.expected_view.risk_tier, actual: r.v221.risk_tier, higher_or_equal_risk: ['LOW','MEDIUM','HIGH','P0'].indexOf(r.v221.risk_tier) >= ['LOW','MEDIUM','HIGH','P0'].indexOf(r.expected_view.risk_tier), p0_or_invalidity_downgrade: r.expected_view.risk_tier === 'P0' && r.v221.risk_tier !== 'P0' }));
  const routerSha = sha(fs.readFileSync(ROUTER_PATH));
  const iteration = Number(process.env.V221_ITERATION || '1');
  const runId = `V43-RR-V2_2_1-V3-REPLAY-${sha(`${sha(ref.raw)}:${sha(gpt.raw)}:${routerSha}:${iteration}`).slice(0,16)}`;
  const full = { artifact_type: 'V43_ROUTER_V2_2_1_FULL_REPLAY_REFERENCE_V3', router_identity: { version: RESPONSE_ROUTER_V221_VERSION, implementation_id: RESPONSE_ROUTER_V221_IMPLEMENTATION_ID, path: 'backend/src/pipeline/requirement-response-router-v2-2-1.js', sha256: routerSha }, reference_v3_sha256: sha(ref.raw), gpt_adjudication_sha256: sha(gpt.raw), run_id: runId, generated_at: new Date().toISOString(), case_count: rows.length, cohorts: COHORTS, provider_calls: 0, llm_calls: 0, metrics: { overall_primary_mode_agreement: { matched: modeAgreement(rows), total: rows.length, rate: pct(modeAgreement(rows), rows.length) }, per_cohort: Object.fromEntries(Object.entries(COHORTS).map(([k]) => { const rs = rows.filter(r => r.cohort === k); return [k, { matched: modeAgreement(rs), total: rs.length, rate: pct(modeAgreement(rs), rs.length) }]; })), v21_correct_v221_wrong: correctedWrong.length, v21_wrong_v221_correct: correctedRight.length, true_high_risk_evidence_false_negative: highBad.length, true_future_commitment_as_existing_fact: futureBad.length, p0_compliance_escape: rows.filter(r => r.expected_view.primary_response_mode === 'COMPLIANCE' && r.expected_view.risk_tier === 'P0' && !['COMPLIANCE','NEED_REVIEW'].includes(r.v221.response_mode)).length, overlay_primary_mode_mismatch: overlayRows.filter(r => !r.mode_match).length, overlay_evidence_dependency_mismatch: overlayRows.filter(r => !r.evidence_dependency_match).length, need_review_count: rows.filter(r => r.v221.response_mode === 'NEED_REVIEW').length }, distributions: { mode: countBy(rows, r => r.v221.response_mode), risk: countBy(rows, r => r.v221.risk_tier), evidence_dependency: countBy(rows, r => r.v221.evidence_dependency) }, rows };
  const delta = { artifact_type: 'V43_ROUTER_V2_2_1_GLOBAL_SEMANTIC_DELTA', run_id: full.run_id, reference_v3_sha256: full.reference_v3_sha256, rows: rows.map(r => ({ case_id: r.case_id, cohort: r.cohort, tender_id: r.tender_id, requirement_id: r.requirement_id, requirement_text: r.requirement_text, expected_view: r.expected_view, v21: r.v21, v22: r.v22, v221: r.v221, v21_correct: r.v21_correct, v22_correct: r.v22_correct, v221_correct: r.v221_correct, v21_to_v22: r.v21_to_v22, v21_to_v221: r.v21_to_v221, changed_dimensions: r.changed_dimensions })) };
  const needReview = { artifact_type: 'V43_ROUTER_V2_2_1_NEED_REVIEW_AUDIT', run_id: full.run_id, case_count: rows.filter(r => r.v221.response_mode === 'NEED_REVIEW').length, rows: rows.filter(r => r.v221.response_mode === 'NEED_REVIEW').map(classifyNeedReview) };
  const risk = { artifact_type: 'V43_ROUTER_V2_2_1_RISK_TIER_AUDIT', run_id: full.run_id, mismatch_count: riskMismatches.length, p0_or_invalidity_downgrade_count: riskMismatches.filter(r => r.p0_or_invalidity_downgrade).length, rows: riskMismatches };
  const checkpoint = { checkpoint: 'V43_RESPONSE_ROUTER_V2_2_1_OVERNIGHT_CLOSURE', run_id: full.run_id, router_version: RESPONSE_ROUTER_V221_VERSION, repair_iterations: iteration, full_replay_count: rows.length, metrics: full.metrics, need_review: needReview.case_count, risk_tier_mismatches: riskMismatches.length, side_effects: { provider_calls: 0, llm_calls: 0, production_db_writes: 0, gold_mutations: 0, requirement_mutations: 0, source_truth_mutations: 0, reference_v3_mutations: 0 }, status: `ITERATION_${iteration}_FINAL_REPLAY` };
  fs.mkdirSync(path.join(DOCS,'eval'), { recursive: true });
  fs.writeFileSync(path.join(DOCS,'V43_ROUTER_V2_2_1_GLOBAL_SEMANTIC_DELTA.json'), JSON.stringify(delta,null,2)+'\n');
  fs.writeFileSync(path.join(DOCS,'V43_ROUTER_V2_2_1_FULL_REPLAY_REFERENCE_V3.json'), JSON.stringify(full,null,2)+'\n');
  fs.writeFileSync(path.join(DOCS,'V43_ROUTER_V2_2_1_NEED_REVIEW_AUDIT.json'), JSON.stringify(needReview,null,2)+'\n');
  fs.writeFileSync(path.join(DOCS,'V43_ROUTER_V2_2_1_RISK_TIER_AUDIT.json'), JSON.stringify(risk,null,2)+'\n');
  fs.writeFileSync(path.join(DOCS,'V43_RESPONSE_ROUTER_V2_2_1_ITERATION_1_CHECKPOINT.json'), JSON.stringify(checkpoint,null,2)+'\n');
  console.log(JSON.stringify({ run_id: full.run_id, overall: full.metrics.overall_primary_mode_agreement, cohorts: full.metrics.per_cohort, v21_correct_v221_wrong: correctedWrong.length, v21_wrong_v221_correct: correctedRight.length, high_bad: highBad.length, future_bad: futureBad.length, overlay_mode_mismatch: full.metrics.overlay_primary_mode_mismatch, overlay_dep_mismatch: full.metrics.overlay_evidence_dependency_mismatch, need_review: needReview.case_count, risk_mismatch: riskMismatches.length, side_effects: checkpoint.side_effects }, null, 2));
}
try { await main(); } catch (e) { console.error(e?.stack || e); process.exitCode = 1; }
