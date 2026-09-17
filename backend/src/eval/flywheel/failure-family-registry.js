import { hashJson } from './contract.js';

export const FAMILY_STATUSES = Object.freeze(['PROPOSED', 'CONFIRMED', 'RETIRED', 'DISPUTED']);

export function registerFailureFamily(input, store = { families: [], memberships: [] }) {
  if (!input?.module || !input?.name || !input?.version) throw Object.assign(new Error('Failure family module, name and version are required.'), { code: 'INVALID_FAILURE_FAMILY' });
  if (!FAMILY_STATUSES.includes(input.status || 'PROPOSED')) throw Object.assign(new Error('Failure family status is invalid.'), { code: 'INVALID_FAILURE_FAMILY_STATUS' });
  const family = {
    failure_family_id: input.failure_family_id || `family:${hashJson({ module: input.module, name: input.name, version: input.version }).slice(-24)}`,
    module: input.module,
    name: input.name,
    description: String(input.description || ''),
    version: String(input.version),
    first_observed_run: input.first_observed_run || null,
    status: input.status || 'PROPOSED',
    root_cause_owner: input.root_cause_owner || null,
    repair_id: input.repair_id || null
  };
  const existing = store.families.find((row) => row.failure_family_id === family.failure_family_id);
  if (existing && hashJson(existing) !== hashJson(family)) throw Object.assign(new Error('Failure family definition conflict.'), { code: 'FAILURE_FAMILY_IDENTITY_CONFLICT' });
  if (!existing) store.families.push(family);
  return { family, created: !existing, store };
}

export function assignFailureFamily({ badcaseId, familyId, evidenceRefs = [], store = { families: [], memberships: [] } } = {}) {
  if (!badcaseId || !familyId || !Array.isArray(evidenceRefs) || evidenceRefs.length === 0) throw Object.assign(new Error('BadCase, family and evidence refs are required.'), { code: 'FAILURE_FAMILY_EVIDENCE_REQUIRED' });
  if (!store.families.some((family) => family.failure_family_id === familyId)) throw Object.assign(new Error('Failure family not found.'), { code: 'FAILURE_FAMILY_NOT_FOUND' });
  const membership = { badcase_id: badcaseId, failure_family_id: familyId, evidence_refs: [...evidenceRefs] };
  const existing = store.memberships.find((row) => row.badcase_id === badcaseId && row.failure_family_id === familyId);
  if (existing && hashJson(existing) !== hashJson(membership)) throw Object.assign(new Error('Failure family membership conflict.'), { code: 'FAILURE_FAMILY_MEMBERSHIP_CONFLICT' });
  if (!existing) store.memberships.push(membership);
  return { membership: existing || membership, created: !existing, store };
}

export function listFamilyMembers(familyId, store) {
  return (store?.memberships || []).filter((row) => row.failure_family_id === familyId).map((row) => ({ ...row }));
}
