export const ENTERPRISE_PROOF_ROUTING_VERSION = 'enterprise-proof-routing-v2';
export const ENTERPRISE_PROOF_INTENTS = Object.freeze([
  'ENTERPRISE_CAPABILITY_PROOF',
  'ENTERPRISE_QUALIFICATION',
  'ENTERPRISE_PROJECT_EXPERIENCE',
  'ENTERPRISE_PRODUCT_CAPABILITY'
]);
export const ENTERPRISE_EVIDENCE_ROUTES = Object.freeze([
  'PROOF_ELIGIBLE',
  'REFERENCE_CONTEXT',
  'OUT_OF_SCOPE'
]);

import { materialAuthorityStatus } from './material-source-authority-policy.js';

const text = value => String(value ?? '').trim();
const bool = value => value === true || value === false ? value : null;
const ACTIVE_USAGE = new Set(['ACTIVE_FULLTEXT', 'ACTIVE_EXCERPT']);
const EXTERNAL_PROOF_SOURCE_TYPES = new Set([
  'third_party_certification',
  'third_party_certificate',
  'customer_acceptance',
  'customer_acceptance_record',
  'acceptance_record',
  'authoritative_test_report',
  'test_report',
  'manufacturer_authorization',
  'original_equipment_authorization',
  'public_project_award',
  'public_award',
  'public_project_proof',
  'qualification_certificate',
  'certification'
]);
const GENERIC_REFERENCE_SOURCE_TYPES = new Set([
  'official_standard',
  'government_guidance',
  'industry_guidance',
  'industry_reference',
  'policy',
  'whitepaper'
]);

function normalizedScope(candidate) {
  return text(candidate.corpus_scope ?? candidate.source_scope ?? candidate.material_scope).toUpperCase();
}

function sourceType(candidate) {
  return text(candidate.source_type ?? candidate.material_source_type).toLowerCase();
}

export const ENTERPRISE_FACT_SOURCE_ROLES = Object.freeze([
  'ENTERPRISE_PROFILE_ELIGIBLE',
  'ENTERPRISE_CAPABILITY_ELIGIBLE',
  'ENTERPRISE_PROJECT_ELIGIBLE',
  'ENTERPRISE_QUALIFICATION_ELIGIBLE',
  'ENTERPRISE_PERFORMANCE_ELIGIBLE',
  'REFERENCE_CONTEXT_ONLY',
  'GOVERNANCE_CONTEXT_ONLY',
  'SOURCE_ROLE_UNKNOWN'
]);

const SOURCE_ROLE_HEADING_PATTERNS = Object.freeze([
  ['REFERENCE_CONTEXT_ONLY', /官方来源|依据|标准|法规|政策|规范|参考|official|standard|policy|guidance|source/i],
  ['GOVERNANCE_CONTEXT_ONLY', /时效|使用规则|治理|有效期|当前性|复核|governance|validity|currentness|review/i],
  ['ENTERPRISE_PROFILE_ELIGIBLE', /公司|企业|概况|简介|profile|company/i],
  ['ENTERPRISE_QUALIFICATION_ELIGIBLE', /资质|认证|证书|qualification|certif/i],
  ['ENTERPRISE_PERFORMANCE_ELIGIBLE', /性能|测试|响应|可核验|核验记录|指标|结果|演练|容灾|备份恢复|performance|test|dr/i],
  ['ENTERPRISE_PROJECT_ELIGIBLE', /项目|案例|中标|合同|实施|验收|project|case|award|contract|implementation|acceptance/i],
  ['ENTERPRISE_CAPABILITY_ELIGIBLE', /范围|能力|产品|服务|运维|记录对象|边界|capability|product|service|scope|operations/i]
]);

function normalizedSourceRoleText(value) {
  return text(value).normalize('NFKC')
    .replace(/[（(][^）)]*[）)]/g, '')
    .replace(/[\s`*_#|：:，,。；;、/\\()[\]{}<>《》"“”'‘’\-]/g, '')
    .toLowerCase();
}

function normalizedStatementVariants(value) {
  const raw = text(value);
  if (!raw) return [];
  const normalized = normalizedSourceRoleText(raw);
  const referentialSuffix = raw.replace(/^(?:该|本)(?:项|次)?(?:测试|安全|性能|验收)?(?:报告|材料|记录|文档)/, '');
  const suffix = normalizedSourceRoleText(referentialSuffix);
  return [...new Set([normalized, suffix].filter(Boolean))];
}

function boundedRoleAtomMatch(atom, unitText) {
  const needle = normalizedSourceRoleText(atom);
  const haystack = normalizedSourceRoleText(unitText);
  if (!needle || !haystack) return false;
  if (haystack.includes(needle)) return true;
  const starts = [];
  for (let index = haystack.indexOf(needle[0]); index >= 0; index = haystack.indexOf(needle[0], index + 1)) starts.push(index);
  return starts.some(start => {
    let cursor = start + 1;
    let inserted = 0;
    let gap = 0;
    for (const character of needle.slice(1)) {
      const found = haystack.indexOf(character, cursor);
      if (found < 0) return false;
      inserted += found - cursor;
      gap = Math.max(gap, found - cursor);
      cursor = found + 1;
    }
    return inserted <= 24 && gap <= 16;
  });
}

/**
 * Parse the Backend-owned Markdown heading structure into bounded semantic
 * units. A unit contains the body text emitted before the next blank line or
 * heading; sibling heading bodies are never joined. Source-role resolution and
 * producer input-window construction intentionally share this parser.
 */
export function resolveEnterpriseFactSourceUnits(sourceText) {
  const source = text(sourceText).replace(/^---\s*[\r\n]+[\s\S]*?[\r\n]+---\s*/u, '');
  const lines = source.split(/\r?\n/);
  const headingPath = [];
  const units = [];
  let block = [];
  let blockHeadingLevel = null;
  const flush = () => {
    const value = block.join('\n').trim();
    if (value) units.push({ text: value, heading_path: [...headingPath], heading_level: blockHeadingLevel });
    block = [];
    blockHeadingLevel = null;
  };
  for (const line of lines) {
    const heading = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
    if (heading) {
      flush();
      const level = heading[1].length;
      headingPath.splice(level - 1);
      headingPath[level - 1] = heading[2];
      blockHeadingLevel = level;
      continue;
    }
    if (!line.trim()) flush();
    else block.push(line);
  }
  flush();
  return units;
}

function sourceRoleUnits(sourceText) {
  return resolveEnterpriseFactSourceUnits(sourceText);
}

function candidateSourceRoleAtoms(candidate = {}) {
  return [...new Set([
    candidate.subject_name,
    candidate.status_text,
    ...(candidate.entity_mentions || []).map(item => item.name ?? item.value),
    ...(candidate.scope_items || []).map(item => item.text ?? item.value),
    ...(candidate.quantity_items || []).flatMap(item => [item.value_text, item.unit_text]),
    ...(candidate.temporal_items || []).map(item => item.value_text),
    candidate.statement
  ].map(value => text(value)).filter(value => value.length >= 2))];
}

function headingRole(headingPath = []) {
  const heading = [...headingPath].reverse().find(Boolean) || '';
  return SOURCE_ROLE_HEADING_PATTERNS.find(([, pattern]) => pattern.test(heading))?.[0] || 'SOURCE_ROLE_UNKNOWN';
}

function explicitSourceRole(candidate = {}) {
  const value = text(candidate.source_role ?? candidate.material_source_role ?? candidate.section_role
    ?? candidate.metadata?.source_role ?? candidate.metadata?.material_source_role).toUpperCase();
  if (value === 'REFERENCE_CONTEXT' || value === 'REFERENCE_CONTEXT_ONLY') return 'REFERENCE_CONTEXT_ONLY';
  if (value === 'GOVERNANCE_CONTEXT' || value === 'GOVERNANCE_CONTEXT_ONLY') return 'GOVERNANCE_CONTEXT_ONLY';
  if (ENTERPRISE_FACT_SOURCE_ROLES.includes(value)) return value;
  return null;
}

/**
 * Resolve a Candidate V2 observation to the nearest deterministic source role.
 * This reuses the existing enterprise-source routing boundary; it does not
 * create lifecycle or claim authority and is intentionally safe for Eval use.
 */
export function resolveEnterpriseFactSourceRole({ candidate = {}, sourceText = '', material = {} } = {}) {
  const explicit = explicitSourceRole(candidate);
  if (explicit) return {
    role: explicit,
    eligibility: explicit.endsWith('_ELIGIBLE') ? 'ENTERPRISE_FACT_ELIGIBLE' : explicit,
    heading_path: [],
    source_unit: null,
    source_role_evidence: 'EXPLICIT_METADATA',
    synthetic: material.synthetic_company_evidence === true,
    claim_permission: material.claim_permission === true
  };
  const atoms = candidateSourceRoleAtoms(candidate).map(normalizedSourceRoleText);
  const units = sourceRoleUnits(sourceText);
  const normalizedStatements = normalizedStatementVariants(candidate.statement);
  // The statement is the source-owned anchor.  Subject/status/scope/entity
  // fields can legitimately be rendered from a heading, table header, or a
  // neighbouring context line; requiring every observation atom in one block
  // would turn valid source-role resolution into a false unknown.  Grounding
  // still enforces bounded composition separately.  Resolve the role from the
  // smallest unit containing the statement first, then use the stricter atom
  // match only when a statement anchor is unavailable.
  const statementResolved = normalizedStatements.length
    ? units.find(unit => {
      const normalized = normalizedSourceRoleText(unit.text);
      return normalizedStatements.some(statement => normalized.includes(statement));
    })
    : null;
  const resolved = statementResolved || units.find(unit => {
    // Heading context is part of the Backend-owned bounded source unit for
    // role resolution.  It lets structured fields under “运维/边界/时效”
    // resolve their role without treating adjacent sections as one fact.
    const normalized = normalizedSourceRoleText(`${unit.heading_path.join(' ')}\n${unit.text}`);
    const substantive = atoms.filter(atom => atom !== normalizedSourceRoleText(candidate.statement));
    return (substantive.length ? substantive : atoms).every(atom => boundedRoleAtomMatch(atom, `${unit.heading_path.join(' ')}\n${unit.text}`));
  });
  if (!resolved) return {
    role: 'SOURCE_ROLE_UNKNOWN', eligibility: 'SOURCE_ROLE_UNKNOWN', heading_path: [], source_unit: null,
    source_role_evidence: 'NO_BOUNDED_UNIT', synthetic: material.synthetic_company_evidence === true,
    claim_permission: material.claim_permission === true
  };
  const role = headingRole(resolved.heading_path);
  return {
    role,
    eligibility: role.endsWith('_ELIGIBLE') ? 'ENTERPRISE_FACT_ELIGIBLE' : role,
    heading_path: resolved.heading_path,
    source_unit: resolved.text,
    source_role_evidence: 'BOUNDED_HEADING_ALIGNMENT',
    synthetic: material.synthetic_company_evidence === true,
    claim_permission: material.claim_permission === true
  };
}

function lifecycleAllowed(candidate) {
  // Database retrieval rows carry the complete material lifecycle projection.
  // Reuse the central policy when that projection is present so a quarantined
  // material cannot be re-admitted by this downstream routing helper. Legacy
  // unit fixtures may intentionally omit material lifecycle fields; those
  // continue through the local compatibility checks below.
  const hasMaterialProjection = Boolean(candidate?.material_id)
    && ['lifecycle_status', 'review_status', 'usage_status', 'extraction_status']
      .every(key => candidate[key] != null);
  if (hasMaterialProjection) {
    const authority = materialAuthorityStatus({ ...candidate, id: candidate.material_id }, { retrieval: true });
    if (!authority.eligible) return false;
  }
  if (candidate.lifecycle_status != null && text(candidate.lifecycle_status) !== 'ACTIVE') return false;
  if (candidate.review_status != null && text(candidate.review_status) !== 'approved') return false;
  if (candidate.usage_status != null && !ACTIVE_USAGE.has(text(candidate.usage_status))) return false;
  // Private project materials are indexed through the project retrieval path;
  // their corpus index_status may remain NOT_INDEXED even when the chunk has a
  // valid embedding. Public corpus candidates must be explicitly indexed.
  if (candidate.index_status != null && text(candidate.index_status) !== 'INDEXED'
    && normalizedScope(candidate) !== 'ENTERPRISE_PRIVATE') return false;
  if (candidate.effective_status != null
    && !['current', 'current_status_required', 'amended'].includes(text(candidate.effective_status))) return false;
  if (candidate.validity_status != null && ['expired', 'revoked'].includes(text(candidate.validity_status))) return false;
  return true;
}

function candidateMetadata(candidate) {
  const metadata = candidate.metadata ?? candidate.material_metadata ?? {};
  return metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : {};
}

function explicitOrMetadataBoolean(candidate, key) {
  const direct = bool(candidate[key]);
  if (direct != null) return direct;
  return bool(candidateMetadata(candidate)[key]);
}

function classifySourceAuthority(candidate) {
  const authority = text(candidate.source_authority ?? candidate.authority_level).toLowerCase();
  const type = sourceType(candidate);
  if (['official', 'authoritative', 'third_party_authority', 'customer_authority', 'manufacturer_authority', 'enterprise_private'].includes(authority)) return true;
  if (EXTERNAL_PROOF_SOURCE_TYPES.has(type)) return true;
  return false;
}

function classifyEvidenceCapability(candidate, intent) {
  const explicit = text(candidate.evidence_capability ?? candidate.capability).toLowerCase();
  if (explicit === 'capable' || explicit === 'proof_capable') return true;
  if (explicit === 'not_capable' || explicit === 'reference_only') return false;
  const type = sourceType(candidate);
  if (GENERIC_REFERENCE_SOURCE_TYPES.has(type)) return false;
  if (EXTERNAL_PROOF_SOURCE_TYPES.has(type)) return true;
  return normalizedScope(candidate) === 'ENTERPRISE_PRIVATE'
    && text(candidate.material_type).toLowerCase() !== 'historical_bid'
    && Boolean(intent);
}

function classifySubjectMatch(candidate, requirement) {
  const explicit = explicitOrMetadataBoolean(candidate, 'subject_match');
  if (explicit != null) return explicit;
  const projectMatch = candidate.project_id && requirement?.project_id && String(candidate.project_id) === String(requirement.project_id);
  return normalizedScope(candidate) === 'ENTERPRISE_PRIVATE' && Boolean(projectMatch);
}

function classifyEntityMatch(candidate, requirement) {
  const explicit = explicitOrMetadataBoolean(candidate, 'entity_match');
  if (explicit != null) return explicit;
  const projectMatch = candidate.project_id && requirement?.project_id && String(candidate.project_id) === String(requirement.project_id);
  return normalizedScope(candidate) === 'ENTERPRISE_PRIVATE' && Boolean(projectMatch);
}

function classifyScopeMatch(candidate, requirement) {
  const explicit = explicitOrMetadataBoolean(candidate, 'scope_match');
  if (explicit != null) return explicit;
  const projectMatch = candidate.project_id && requirement?.project_id && String(candidate.project_id) === String(requirement.project_id);
  return normalizedScope(candidate) === 'ENTERPRISE_PRIVATE' && Boolean(projectMatch);
}

function classifyIntent(requirement = {}) {
  const explicit = text(requirement.evidence_intent ?? requirement.requirement_role);
  if (ENTERPRISE_PROOF_INTENTS.includes(explicit)) return explicit;
  const category = text(requirement.requirement_category ?? requirement.category).toLowerCase();
  const value = text(requirement.text);
  if (/qualification|资质|认证|证书/.test(category) || /认证|证书|资质/.test(value)) return 'ENTERPRISE_QUALIFICATION';
  if (/project|case|项目经验|案例/.test(category) || /同类项目|项目经验|实施及验收/.test(value)) return 'ENTERPRISE_PROJECT_EXPERIENCE';
  if (/product|capability|产品能力|企业能力/.test(category) || /企业自身.*能力|产品.*能力|具备.*能力/.test(value)) return 'ENTERPRISE_PRODUCT_CAPABILITY';
  return null;
}

export function classifyEnterpriseEvidenceIntent(requirement = {}) {
  return classifyIntent(requirement);
}

function routeCandidate({ requirement, intent, candidate }) {
  const reasons = [];
  if (!lifecycleAllowed(candidate)) return { route: 'OUT_OF_SCOPE', proof_eligible: false, proof_capable: false, reasons: ['LIFECYCLE_OR_VALIDITY_INVALID'] };
  const scope = normalizedScope(candidate);
  const type = sourceType(candidate);
  const authority = classifySourceAuthority(candidate);
  const capability = classifyEvidenceCapability(candidate, intent);
  const subject = classifySubjectMatch(candidate, requirement);
  const entity = classifyEntityMatch(candidate, requirement);
  const scopeMatch = classifyScopeMatch(candidate, requirement);
  if (!authority) reasons.push('SOURCE_AUTHORITY_INSUFFICIENT');
  if (!capability) reasons.push('EVIDENCE_CAPABILITY_INSUFFICIENT');
  if (!subject) reasons.push('SUBJECT_MISMATCH');
  if (!entity) reasons.push('ENTITY_MISMATCH');
  if (!scopeMatch) reasons.push('SCOPE_MISMATCH');
  if (type === 'historical_bid' || candidate.material_type === 'historical_bid') reasons.push('HISTORICAL_REFERENCE_ONLY');
  const eligible = authority && capability && subject && entity && scopeMatch
    && type !== 'historical_bid' && candidate.material_type !== 'historical_bid';
  if (eligible) return {
    route: 'PROOF_ELIGIBLE', proof_eligible: true, proof_capable: true,
    reasons: ['EVIDENCE_INTENT_AND_SOURCE_QUALIFIED'], source_scope: scope
  };
  return {
    route: reasons.includes('LIFECYCLE_OR_VALIDITY_INVALID') ? 'OUT_OF_SCOPE' : 'REFERENCE_CONTEXT',
    proof_eligible: false,
    proof_capable: false,
    reasons,
    source_scope: scope
  };
}

export function routeEnterpriseProofCandidates({ requirement = {}, candidates = [] } = {}) {
  const intent = classifyIntent(requirement);
  const input = Array.isArray(candidates) ? candidates : [];
  if (!intent) {
    return {
      routing_version: ENTERPRISE_PROOF_ROUTING_VERSION,
      intent: null,
      proof_candidates: input,
      proof_eligible_candidates: input,
      reference_candidates: [],
      out_of_scope_candidates: [],
      all_candidates: input,
      routing_false_positive_count: 0,
      enterprise_source_precision: null
    };
  }
  const proof = [];
  const reference = [];
  const outOfScope = [];
  for (const candidate of input) {
    const route = routeCandidate({ requirement, intent, candidate });
    const routed = {
      ...candidate,
      source_route: route.route,
      proof_eligibility: route.route,
      proof_eligible: route.proof_eligible,
      proof_capable: route.proof_capable,
      routing_reason: route.reasons,
      source_scope: route.source_scope ?? normalizedScope(candidate)
    };
    if (route.route === 'PROOF_ELIGIBLE') proof.push(routed);
    else if (route.route === 'OUT_OF_SCOPE') outOfScope.push(routed);
    else reference.push(routed);
  }
  return {
    routing_version: ENTERPRISE_PROOF_ROUTING_VERSION,
    intent,
    proof_candidates: proof,
    proof_eligible_candidates: proof,
    reference_candidates: reference,
    out_of_scope_candidates: outOfScope,
    all_candidates: input,
    routing_false_positive_count: proof.filter(item => item.proof_eligibility !== 'PROOF_ELIGIBLE').length,
    enterprise_source_precision: input.length ? proof.length / input.length : null
  };
}
