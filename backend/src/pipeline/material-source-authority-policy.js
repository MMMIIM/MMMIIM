/**
 * Material source authority is a single, deterministic lifecycle gate shared by
 * retrieval and downstream enterprise-source consumers.  It deliberately does
 * not create a second eligibility lifecycle for facts, mappings, claims, or
 * writer input.
 */
export const MATERIAL_SOURCE_AUTHORITY_POLICY_VERSION = 'material-source-authority-v1';
export const MATERIAL_SOURCE_ROLE_POLICY_VERSION = 'material-source-role-v1';
export const MATERIAL_SOURCE_ROLES = Object.freeze(['REFERENCE_ONLY', 'EVIDENCE_CANDIDATE']);
export const MATERIAL_AUTHORITY_TIERS = Object.freeze(['SYNTHETIC_EVAL_ONLY', 'REAL_PRODUCTION']);
export const MATERIAL_AUTHORITY_MODES = Object.freeze(['PRODUCTION', 'SYNTHETIC_EVAL_ONLY', 'CONTROLLED_REAL_TEST']);
export const ACTIVE_MATERIAL_USAGE = Object.freeze(['ACTIVE_FULLTEXT', 'ACTIVE_EXCERPT']);

const ACTIVE_USAGE = new Set(ACTIVE_MATERIAL_USAGE);
const text = value => String(value ?? '').trim();
const REFERENCE_MATERIAL_TYPES = new Set([
  'company_profile', 'product', 'technical_solution', 'technical_whitepaper',
  'historical_bid', 'other'
]);
const EVIDENCE_CANDIDATE_MATERIAL_TYPES = new Set([
  'qualification', 'case', 'project_case', 'product_documentation',
  'personnel', 'delivery_capability'
]);

function normalizeRole(value) {
  const role = text(value).toUpperCase();
  if (role === 'REFERENCE_CONTEXT_ONLY' || role === 'REFERENCE') return 'REFERENCE_ONLY';
  if (role === 'REAL_ENTERPRISE_EVIDENCE_CANDIDATE' || role === 'EVIDENCE') return 'EVIDENCE_CANDIDATE';
  return MATERIAL_SOURCE_ROLES.includes(role) ? role : null;
}

function explicitHumanRole(material) {
  const metadata = material?.metadata && typeof material.metadata === 'object' ? material.metadata : {};
  return normalizeRole(material?.explicit_human_role
    ?? material?.source_role
    ?? material?.material_source_role
    ?? metadata.explicit_human_role
    ?? metadata.source_role
    ?? metadata.material_source_role);
}

export function isSyntheticMaterial(material = {}) {
  const metadata = material?.metadata && typeof material.metadata === 'object' ? material.metadata : {};
  return material?.synthetic_test_material === true
    || material?.synthetic_company_evidence === true
    || metadata.synthetic_test_material === true
    || metadata.synthetic_company_evidence === true
    || /^synthetic(?:_|$)/iu.test(text(material?.source_type));
}

/**
 * Synthetic-ness is an authority/data-origin tier, not a semantic source role.
 * The source role still comes from the material taxonomy or an explicit human
 * role.  A synthetic Evidence-candidate may therefore be used by an isolated
 * Eval flow while its Production authority remains NONE.
 */
export function resolveMaterialAuthorityTier(material = {}) {
  const synthetic = isSyntheticMaterial(material);
  const authority = synthetic ? 'SYNTHETIC_EVAL_ONLY' : 'REAL_PRODUCTION';
  return {
    authority,
    authority_tier: authority,
    production_authority: synthetic ? 'NONE' : 'REAL_PRODUCTION',
    synthetic
  };
}

export function materialAuthorityAllowedForMode(material = {}, { authorityMode = 'PRODUCTION' } = {}) {
  const tier = resolveMaterialAuthorityTier(material);
  if (!tier.synthetic) return true;
  return authorityMode === 'SYNTHETIC_EVAL_ONLY' || authorityMode === 'CONTROLLED_REAL_TEST';
}

/**
 * Resolve material-level source authority without changing lifecycle
 * eligibility.  Lifecycle/provenance remains owned by materialAuthorityStatus;
 * this function only decides whether an eligible material is a reference or a
 * candidate for the existing Evidence Fact pipeline.
 */
export function resolveMaterialSourceRole(material = {}) {
  const materialType = text(material.material_type).toLowerCase() || 'unknown';
  const explicit = explicitHumanRole(material);
  const base = {
    role: 'REFERENCE_ONLY',
    reason: 'material_type_unmapped_default_reference_only',
    material_type: materialType,
    explicit_human_role: explicit,
    policy_version: MATERIAL_SOURCE_ROLE_POLICY_VERSION
  };
  if (explicit) return { ...base, role: explicit, reason: 'explicit_human_role' };
  if (EVIDENCE_CANDIDATE_MATERIAL_TYPES.has(materialType)) {
    return { ...base, role: 'EVIDENCE_CANDIDATE', reason: 'material_type_evidence_candidate' };
  }
  if (REFERENCE_MATERIAL_TYPES.has(materialType)) {
    return { ...base, reason: 'material_type_reference_only' };
  }
  return base;
}

export function hasMaterialSourceRoleData(material = {}) {
  return [
    'material_type', 'explicit_human_role', 'source_role', 'material_source_role',
    'synthetic_test_material', 'synthetic_company_evidence'
  ].some(field => Object.prototype.hasOwnProperty.call(material, field))
    || Boolean(material?.metadata && typeof material.metadata === 'object'
      && ['explicit_human_role', 'source_role', 'material_source_role', 'synthetic_test_material', 'synthetic_company_evidence']
        .some(field => Object.prototype.hasOwnProperty.call(material.metadata, field)));
}

export function isEvidenceCandidateMaterial(material = {}) {
  return !hasMaterialSourceRoleData(material) || resolveMaterialSourceRole(material).role === 'EVIDENCE_CANDIDATE';
}

function evaluate(material, { retrieval = false } = {}) {
  if (!material || typeof material !== 'object' || !text(material.id)) {
    return { eligible: false, reason: 'MATERIAL_MISSING' };
  }
  if (!text(material.corpus_scope)) {
    return { eligible: false, reason: 'MATERIAL_PROVENANCE_MISSING' };
  }
  if (text(material.lifecycle_status).toUpperCase() !== 'ACTIVE') {
    return { eligible: false, reason: 'MATERIAL_LIFECYCLE_NOT_ACTIVE' };
  }
  if (text(material.review_status).toLowerCase() !== 'approved') {
    return { eligible: false, reason: 'MATERIAL_REVIEW_NOT_APPROVED' };
  }
  if (!ACTIVE_USAGE.has(text(material.usage_status).toUpperCase())) {
    return { eligible: false, reason: 'MATERIAL_USAGE_NOT_ACTIVE' };
  }
  if (text(material.extraction_status).toLowerCase() !== 'succeeded') {
    return { eligible: false, reason: 'MATERIAL_EXTRACTION_NOT_SUCCEEDED' };
  }
  if (retrieval
    && text(material.corpus_scope).toUpperCase() !== 'ENTERPRISE_PRIVATE'
    && text(material.index_status).toUpperCase() !== 'INDEXED') {
    return { eligible: false, reason: 'MATERIAL_INDEX_NOT_READY' };
  }
  return { eligible: true, reason: null };
}

export function materialAuthorityStatus(material, options = {}) {
  return evaluate(material, options);
}

export function materialAuthorityReason(material, options = {}) {
  return evaluate(material, options).reason;
}

export function isRetrievalEligible(material) {
  return evaluate(material, { retrieval: true }).eligible;
}

export function isEvidenceSourceEligible(material) {
  return evaluate(material).eligible;
}

export function isAuthorityEligible(material) {
  return evaluate(material).eligible;
}
