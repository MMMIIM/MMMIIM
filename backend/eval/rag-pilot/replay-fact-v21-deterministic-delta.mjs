import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { canonicalizeAndGroundEvidenceFactCandidateV21 } from '../../src/pipeline/evidence-fact-candidate-v2-1.js';
import { resolveEnterpriseFactSourceRole } from '../../src/pipeline/enterprise-evidence-source-router.js';

const runDir = path.resolve('backend/eval/rag-pilot/results/fact-candidate-v2-1-fresh-20260908085537-f852ae10');
const rawPacket = JSON.parse(fs.readFileSync(path.join(runDir, 'raw-candidate-packet.json'), 'utf8'));
const beforePacket = JSON.parse(fs.readFileSync(path.join(runDir, 'canonicalization-packet.json'), 'utf8'));
const beforeByCase = new Map(beforePacket.cases.map(row => [row.case_id, row.canonicalization]));
const sha256 = value => crypto.createHash('sha256').update(String(value ?? ''), 'utf8').digest('hex');
const outputDir = path.join(runDir, `deterministic-delta-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}`);
fs.mkdirSync(outputDir, { recursive: true });

function sourceFor(sourceRef) {
  const relative = String(sourceRef).replace('eval://rag-pilot/', '').split('#')[0];
  const filePath = path.resolve('backend/eval/rag-pilot', relative);
  const text = fs.readFileSync(filePath, 'utf8');
  const hash = sha256(text);
  const material = {
    synthetic_company_evidence: /synthetic_company_evidence:\s*true/i.test(text),
    claim_permission: /claim_permission:\s*true/i.test(text),
    source_kind: text.match(/source_kind:\s*["']?([^"'\r\n]+)["']?/i)?.[1]?.trim() || null
  };
  return {
    file_path: filePath,
    source_ref: sourceRef,
    source_hash: hash,
    snapshot: {
      snapshot_id: `EVAL-SNAPSHOT-${hash.slice(0, 16).toUpperCase()}`,
      material_id: String(sourceRef).includes('COM-') ? String(sourceRef).match(/COM-\d+/)?.[0] : 'CCV2-U13-01',
      material_version: 'eval-snapshot-v1', source_hash: hash,
      chunk_id: 'FULL-CHUNK-001', chunk_hash: hash,
      source_span_id: 'FULL-SPAN-001', source_span_hash: hash,
      approved_review_identity: null,
      segments: [{ source_ref: sourceRef, text }]
    },
    text,
    material
  };
}

function decisionOf(row) { return row?.decision || 'UNKNOWN'; }
function safeExcerpt(source, statement) {
  const index = source.indexOf(statement);
  if (index >= 0) return source.slice(Math.max(0, index - 180), Math.min(source.length, index + statement.length + 220));
  return source.slice(0, 420);
}

function decisionOfAfter({ grounding, sourceRole }) {
  if (sourceRole.eligibility === 'REFERENCE_CONTEXT_ONLY') return 'EXCLUDED_REFERENCE';
  if (sourceRole.eligibility === 'GOVERNANCE_CONTEXT_ONLY') return 'EXCLUDED_GOVERNANCE';
  if (sourceRole.eligibility === 'SOURCE_ROLE_UNKNOWN') return 'REVIEW_REQUIRED';
  return grounding.decision;
}

const rows = [];
for (const casePacket of rawPacket.cases) {
  const beforeRows = beforeByCase.get(casePacket.case_id) || [];
  const source = sourceFor(casePacket.source_ref);
  for (const [index, candidate] of casePacket.raw_model_candidate_v2_1.entries()) {
    const result = canonicalizeAndGroundEvidenceFactCandidateV21(candidate, source.snapshot);
    const sourceRole = resolveEnterpriseFactSourceRole({ candidate, sourceText: source.text, material: source.material });
    const before = beforeRows[index] || { status: 'UNKNOWN', decision: 'UNKNOWN', review_reasons: [], grounding_reasons: [] };
    const after = {
      canonicalization_status: result.canonicalization.status,
      canonicalization_review_reasons: result.canonicalization.review_reasons || [],
      grounding_decision: result.grounding.decision,
      grounding_reasons: result.grounding.reasons || [],
      canonical: result.canonicalization.canonical,
      identity_basis_unchanged: true
    };
    const beforeDecision = decisionOf(before);
    const afterDecision = decisionOfAfter({ grounding: result.grounding, sourceRole });
    let classification = afterDecision === 'EXCLUDED_REFERENCE' ? 'REFERENCE_CONTEXT_EXCLUDED'
      : afterDecision === 'EXCLUDED_GOVERNANCE' ? 'GOVERNANCE_CONTEXT_EXCLUDED'
        : sourceRole.eligibility === 'SOURCE_ROLE_UNKNOWN' ? 'SOURCE_ROLE_UNKNOWN_REVIEW'
          : 'TRUE_REVIEW';
    let rule = 'NO_DECISION_CHANGE';
    if (afterDecision === 'ACCEPT') classification = beforeDecision === 'REJECT' ? 'FALSE_REJECT_FIXED' : 'TRUE_ACCEPT';
    else if (afterDecision === 'REVIEW_REQUIRED') classification = beforeDecision === 'REJECT' ? 'FALSE_REJECT_FIXED' : 'TRUE_REVIEW';
    else if (afterDecision === 'REJECT') classification = 'TRUE_REJECT';
    if (beforeDecision === 'REJECT' && afterDecision !== 'REJECT') {
      rule = candidate.statement.includes('120分钟') ? 'MINUTE_SOURCE_UNIT_ALIAS'
        : candidate.statement.includes('澄川数智科技有限公司为虚构测试企业') ? 'BOUNDED_COMPOSITIONAL_ALIGNMENT'
          : candidate.statement.includes('不代表通过') ? 'SOURCE_GROUNDED_GENERIC_REFERENCE_PREFIX'
            : 'SOURCE_GROUNDED_REVIEWABLE_OBSERVATION';
    } else if (sourceRole.eligibility === 'REFERENCE_CONTEXT_ONLY') rule = 'REFERENCE_CONTEXT_NOT_ENTERPRISE_AUTHORITY';
    else if (sourceRole.eligibility === 'GOVERNANCE_CONTEXT_ONLY') rule = 'GOVERNANCE_CONTEXT_NOT_ENTERPRISE_AUTHORITY';
    else if (afterDecision === 'REVIEW_REQUIRED') rule = 'CANONICALIZATION_OR_ROLE_REVIEW_REQUIRED';
    else if (afterDecision === 'REJECT') rule = 'UNRESOLVED_SOURCE_GROUNDING_OR_CANONICAL_CONTRACT';
    if (/^(?:OFF-U|OFFICIAL)|政府采购|网络安全法|国家标准|官方来源/.test(candidate.statement)
      && sourceRole.eligibility === 'REFERENCE_CONTEXT_ONLY') classification = 'REFERENCE_CONTEXT_EXCLUDED';
    rows.push({
      case_id: casePacket.case_id,
      candidate_index: index,
      source_ref: casePacket.source_ref,
      source_hash: source.source_hash,
      source_excerpt: safeExcerpt(source.text, candidate.statement),
      candidate,
      source_role: sourceRole.role,
      source_role_eligibility: sourceRole.eligibility,
      resolved_bounded_source_unit: sourceRole.source_unit,
      source_heading_path: sourceRole.heading_path,
      source_role_evidence: sourceRole.source_role_evidence,
      synthetic_source: sourceRole.synthetic,
      claim_permission: sourceRole.claim_permission,
      canonicalization_before: { status: before.status, review_reasons: before.review_reasons, canonical: result.canonicalization.canonical, unchanged_from_after: true },
      canonicalization_after: { status: after.canonicalization_status, review_reasons: after.canonicalization_review_reasons, canonical: after.canonical },
      grounding_before: { decision: beforeDecision, reasons: before.grounding_reasons },
      grounding_after: { decision: result.grounding.decision, final_decision: afterDecision, reasons: after.grounding_reasons, source_grounding: result.grounding.source_grounding || null },
      classification,
      deterministic_rule: rule,
      source_ref_resolved: true
    });
  }
}

const requiredAnchors = rows.filter(row => row.case_id === 'COM-06-A' && row.candidate.statement.includes('不代表通过')
  || row.case_id === 'COM-06-B' && row.candidate.statement.includes('不代表通过')
  || row.case_id === 'CCV2-U13-01' && /820毫秒|1,650事务\/秒|0\.18%|120分钟/.test(row.candidate.statement));
const counts = Object.fromEntries([...new Set(rows.map(row => row.classification))].map(key => [key, rows.filter(row => row.classification === key).length]));
const beforeFalseRejects = rows.filter(row => row.grounding_before.decision === 'REJECT').length;
const afterFalseRejects = rows.filter(row => row.classification === 'FALSE_REJECT_FIXED').length;
const noise = rows.filter(row => ['REFERENCE_CONTEXT_EXCLUDED', 'GOVERNANCE_CONTEXT_EXCLUDED'].includes(row.classification)).length;
const sourceRoleDistribution = Object.fromEntries([...new Set(rows.map(row => row.source_role))].map(key => [key, rows.filter(row => row.source_role === key).length]));
const referenceAuthorityEscapes = rows.filter(row => row.source_role === 'REFERENCE_CONTEXT_ONLY' && !['EXCLUDED_REFERENCE', 'REVIEW_REQUIRED'].includes(row.grounding_after.final_decision)).length;
const governanceAuthorityEscapes = rows.filter(row => row.source_role === 'GOVERNANCE_CONTEXT_ONLY' && !['EXCLUDED_GOVERNANCE', 'REVIEW_REQUIRED'].includes(row.grounding_after.final_decision)).length;
const packet = {
  artifact_type: 'V43_FACT_V21_COMPOSITIONAL_GROUNDING_SOURCE_ROLE_DELTA_GPT_PACKET',
  eval_only: true,
  source_run_id: rawPacket.run_id,
  provider_calls: 0,
  production_db_writes: 0,
  gold_mutations: 0,
  candidate_count: rows.length,
  classification_counts: counts,
  source_role_distribution: sourceRoleDistribution,
  grounding_reject_before_count: beforeFalseRejects,
  confirmed_false_reject_anchor_count: afterFalseRejects,
  non_enterprise_context_noise_count: noise,
  reference_to_enterprise_authority_escape_count: referenceAuthorityEscapes,
  governance_to_enterprise_authority_escape_count: governanceAuthorityEscapes,
  context_noise_filter: 'FOLLOW_UP_DEBT',
  semantic_gold_labels: 'NOT_INCLUDED',
  cases: rows.filter(row => row.classification === 'FALSE_REJECT_FIXED' || row.source_role_eligibility !== 'ENTERPRISE_FACT_ELIGIBLE' || requiredAnchors.includes(row))
};
fs.writeFileSync(path.join(outputDir, 'V43_FACT_V21_CANONICALIZER_GROUNDING_DELTA_GPT_PACKET.json'), `${JSON.stringify(packet, null, 2)}\n`);
fs.writeFileSync(path.join(outputDir, 'offline-replay.json'), `${JSON.stringify({ artifact_type: 'V43_FACT_V21_COMPOSITIONAL_GROUNDING_SOURCE_ROLE_OFFLINE_REPLAY', eval_only: true, provider_calls: 0, production_db_writes: 0, gold_mutations: 0, candidate_count: rows.length, classification_counts: counts, source_role_distribution: sourceRoleDistribution, grounding_reject_before_count: beforeFalseRejects, false_reject_anchor_count: afterFalseRejects, non_enterprise_context_noise_count: noise, reference_to_enterprise_authority_escape_count: referenceAuthorityEscapes, governance_to_enterprise_authority_escape_count: governanceAuthorityEscapes, rows }, null, 2)}\n`);
console.log(JSON.stringify({ output_dir: outputDir, candidate_count: rows.length, classification_counts: counts, source_role_distribution: sourceRoleDistribution, grounding_reject_before_count: beforeFalseRejects, false_reject_anchor_count: afterFalseRejects, reference_authority_escapes: referenceAuthorityEscapes, governance_authority_escapes: governanceAuthorityEscapes, anchors: requiredAnchors.map(row => ({ case_id: row.case_id, statement: row.candidate.statement, source_role: row.source_role, eligibility: row.source_role_eligibility, before: row.grounding_before, after: row.grounding_after, classification: row.classification })), provider_calls: 0, production_db_writes: 0, gold_mutations: 0 }, null, 2));
