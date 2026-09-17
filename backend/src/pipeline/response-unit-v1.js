import { createHash } from 'node:crypto';

export const RESPONSE_UNIT_V1_VERSION = 'v43-response-unit-v1';
const WRITER_READY = new Set(['READY_FOR_WRITER']);
const modeOrder = (value) => ({ SOLUTION: 0, EVIDENCE: 1, COMMITMENT: 2, COMPLIANCE: 3 }[value] ?? 9);
const stableHash = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 24).toUpperCase();

/** Deterministic downstream grouping; Requirements remain atomic upstream. */
export function buildResponseUnitsV1(decisions = []) {
  const groups = new Map();
  for (const decision of Array.isArray(decisions) ? decisions : []) {
    if (!decision?.requirement_id || !(WRITER_READY.has(decision.readiness_status) || (decision.response_mode === 'COMPLIANCE' && decision.readiness_status === 'COMPLIANCE_ACTION_REQUIRED'))) continue;
    const mode = decision.response_mode;
    if (!['SOLUTION', 'EVIDENCE', 'COMMITMENT', 'COMPLIANCE'].includes(mode)) continue;
    const sectionKey = String(decision.section_key || decision.target_section || 'default');
    const authorityKey = mode === 'EVIDENCE' ? `claims:${Number(decision.authority?.approved_claim_count || 0) > 0}` : mode === 'COMMITMENT' ? `commitments:${Number(decision.authority?.approved_commitment_count || 0) > 0}` : 'none';
    const key = `${sectionKey}|${mode}|${authorityKey}`;
    if (!groups.has(key)) groups.set(key, { section_key: sectionKey, response_mode: mode, authority_key: authorityKey, requirement_ids: [] });
    groups.get(key).requirement_ids.push(String(decision.requirement_id));
  }
  return [...groups.values()].sort((a, b) => String(a.section_key).localeCompare(String(b.section_key)) || modeOrder(a.response_mode) - modeOrder(b.response_mode)).map((group) => {
    const requirement_ids = [...new Set(group.requirement_ids)].sort();
    const body = { contract_version: RESPONSE_UNIT_V1_VERSION, section_key: group.section_key, response_mode: group.response_mode, execution_target: group.response_mode === 'COMPLIANCE' ? 'compliance_matrix' : 'writer', requirement_ids, source_requirement_count: requirement_ids.length, authority_key: group.authority_key };
    return { ...body, response_unit_id: `RU-${stableHash(body)}` };
  });
}
