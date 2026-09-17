import {
  EVIDENCE_FACT_CANDIDATE_V2_SCHEMA_VERSION,
  EVIDENCE_FACT_CANDIDATE_V2_PROMPT_VERSION,
  EVIDENCE_FACT_CANDIDATE_V2_SCHEMA_SHA256,
  validateEvidenceFactCandidateV2Data,
  stableSha256
} from '../../../packages/semantic-contracts/index.js';

export const EVIDENCE_FACT_CANDIDATE_V2_VERSION = EVIDENCE_FACT_CANDIDATE_V2_SCHEMA_VERSION;
export const EVIDENCE_FACT_CANONICALIZER_V2_VERSION = '4.3-evidence-fact-canonicalizer-v2';
export const EVIDENCE_FACT_GROUNDING_V2_VERSION = '4.3-evidence-fact-grounding-v2';
export const MODEL_FACING_MAX_NESTING = 3;

const DECIMAL = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/;
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const STATUS_RULES = Object.freeze([
  ['award', /中标|award/i],
  ['selected', /入选|selected/i],
  ['contracted', /合同|签约|contract/i],
  ['participated', /参与|参加|participat/i],
  ['in_progress', /实施中|进行中|in.?progress/i],
  ['completed', /完成|完工|completed/i],
  ['accepted', /验收|accepted/i],
  ['verified', /验证|核验|verified/i],
  ['registered', /注册|registered/i],
  ['certified', /认证|certif/i]
]);
const CONDITION_RULES = Object.freeze([
  [/不低于|不少于|至少|不小于/, '>='],
  [/不超过|至多|最多|不大于/, '<='],
  [/大于|超过/, '>'],
  [/小于|少于/, '<'],
  [/等于|为/, '=']
]);
const UNIT_RULES = Object.freeze(new Map([
  ['秒', 'SECOND'], ['毫秒', 'MILLISECOND'], ['分钟', 'MINUTE'],
  ['用户', 'users'], ['人', 'people'], ['个', 'items']
]));
const ACTION_EVENT_STATUS_PATTERN = /发布|获得|建立|制订|制定|更新|上线|覆盖|构筑|开展|进行|参与|打造|分享|举办|评估|管理|学习/u;
const EXPLICIT_LIFECYCLE_STATUS_PATTERN = /中标|入选|合同|签约|实施中|进行中|完成|完工|验收|验证|核验|注册|认证|有效|失效|过期|撤销|吊销|暂停|终止|停用|有效期|当前状态|award|selected|contract|in.?progress|completed|accepted|verified|registered|certif|active|expired|revoked|suspend|terminate|inactive/i;
const VALIDITY_TEMPORAL_PATTERN = /有效期|有效至|生效|到期|失效日期|起止日期|valid(?:ity|_until|_from)|expires?/i;
const CHINESE_DIGITS = Object.freeze({ 零: 0, 〇: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 });
const CHINESE_SMALL_UNITS = Object.freeze({ 十: 10, 百: 100, 千: 1000 });
const CHINESE_LARGE_UNITS = Object.freeze({ 万: 10000, 亿: 100000000 });

// A status carrier containing a bounded negation/limitation must never be
// promoted to a positive enum merely because it also contains a positive
// keyword such as “验证” or “认证”.  Keep this list semantic and narrow: it
// is a canonicalization safety boundary, not a generic text filter.
const NEGATED_OR_UNCERTAIN_STATUS_PATTERN = /未(?:验证|核验|完成|验收|认证)|不(?:代表|等于|等同于|构成|证明|提供|支持)|不能(?:证明|直接)|不得(?:使用|作为)|不应(?:作为|视为)|仅用于历史/i;
const NEGATED_OR_LIMITED_SCOPE_PATTERN = /不(?:证明|代表|等于|等同于|构成|提供|支持)|不能(?:证明|直接)|不得(?:使用|作为)|不应(?:作为|视为)|未(?:形成|覆盖|验证)/i;

const text = value => typeof value === 'string' ? value.trim() : '';

function required(value, label) {
  const result = text(value);
  if (!result) throw new Error(`${label} is required`);
  return result;
}

function nullable(value) {
  if (value === null || value === undefined) return null;
  return required(value, 'text');
}

function sourceSnapshotValue(value, label, { nullableValue = false } = {}) {
  if (nullableValue && (value === null || value === undefined || value === '')) return null;
  return required(value, label);
}

function parseChineseInteger(value) {
  const input = String(value ?? '').trim();
  if (!input || !/^[零〇一二两三四五六七八九十百千万亿]+$/.test(input)) return null;
  let total = 0;
  let section = 0;
  let number = 0;
  for (const character of input) {
    if (Object.hasOwn(CHINESE_DIGITS, character)) {
      number = CHINESE_DIGITS[character];
      continue;
    }
    const smallUnit = CHINESE_SMALL_UNITS[character];
    if (smallUnit) {
      section += (number || 1) * smallUnit;
      number = 0;
      continue;
    }
    const largeUnit = CHINESE_LARGE_UNITS[character];
    if (largeUnit) {
      section = (section + number) || 1;
      total += section * largeUnit;
      section = 0;
      number = 0;
    }
  }
  return String(total + section + number);
}

function normalizeQuantityUnitSuffix(value, unitText) {
  const normalized = String(value ?? '').normalize('NFKC').replace(/[\s,，]/g, '');
  const unit = text(unitText).normalize('NFKC').replace(/[\s,，]/g, '');
  if (unit && normalized.endsWith(unit)) return normalized.slice(0, -unit.length);
  return normalized;
}

function applyChineseScale(value, scaleText) {
  if (!scaleText) return value;
  const scale = CHINESE_LARGE_UNITS[scaleText];
  if (!scale) return null;
  const base = Number(value);
  if (!Number.isSafeInteger(base)) return null;
  return String(base * scale);
}

function parseCanonicalQuantityDetails(valueText, conditionText = '', unitText = '') {
  let raw = normalizeQuantityUnitSuffix(valueText, unitText);
  let operator = null;
  let precision = 'exact';
  const explicitCondition = text(conditionText);
  const conditionMatch = CONDITION_RULES.find(([pattern]) => pattern.test(explicitCondition));
  if (conditionMatch) operator = conditionMatch[1];

  const prefix = /^(?:超过|超|大于|多于)/u.exec(raw);
  if (prefix) {
    operator = operator || '>';
    raw = raw.slice(prefix[0].length);
    precision = 'lower_bound';
  }
  const lowerBoundPrefix = /^(?:不少于|不低于|至少|不小于)/u.exec(raw);
  if (lowerBoundPrefix) {
    operator = operator || '>=';
    raw = raw.slice(lowerBoundPrefix[0].length);
    precision = 'lower_bound';
  }
  const upperBoundPrefix = /^(?:不超过|至多|最多|不大于)/u.exec(raw);
  if (upperBoundPrefix) {
    operator = operator || '<=';
    raw = raw.slice(upperBoundPrefix[0].length);
    precision = 'upper_bound';
  }
  if (/[约大约左右近]/u.test(raw)) {
    return { value: null, operator, precision: 'unresolved', qualifier: explicitCondition, unresolvedReason: 'QUANTITY_VALUE_OR_UNIT_UNRESOLVED' };
  }
  if (/多$/u.test(raw)) {
    operator = operator || '>';
    precision = 'lower_bound';
    raw = raw.slice(0, -1);
  }
  if (/余$/u.test(raw)) {
    operator = operator || '>';
    precision = 'lower_bound';
    raw = raw.slice(0, -1);
  }
  const scaleMatch = /([万亿])$/u.exec(raw);
  if (scaleMatch) {
    raw = raw.slice(0, -1);
    const base = /^\d+(?:\.\d+)?$/.test(raw) ? raw : parseChineseInteger(raw);
    const scaled = applyChineseScale(base, scaleMatch[1]);
    if (!scaled) return { value: null, operator, precision: 'unresolved', qualifier: explicitCondition, unresolvedReason: 'QUANTITY_VALUE_OR_UNIT_UNRESOLVED' };
    raw = scaled;
  }
  if (/^\d+(?:\.\d+)?$/.test(raw)) {
    return {
      value: raw.replace(/^(-?)0+(?=\d)/, '$1'),
      operator,
      precision,
      qualifier: explicitCondition && !conditionMatch ? explicitCondition : null,
      unresolvedReason: null
    };
  }
  const chinese = parseChineseInteger(raw);
  if (chinese !== null) {
    return {
      value: chinese,
      operator,
      precision,
      qualifier: explicitCondition && !conditionMatch ? explicitCondition : null,
      unresolvedReason: null
    };
  }
  return { value: null, operator, precision: 'unresolved', qualifier: explicitCondition, unresolvedReason: 'QUANTITY_VALUE_OR_UNIT_UNRESOLVED' };
}

/**
 * Deterministically normalize the bounded numeric forms already accepted by
 * the Canonical Quantity contract.  Qualifier text is intentionally not
 * returned here because the current contract has no textual qualifier slot.
 */
export function parseCanonicalQuantityValue(valueText, conditionText = '', unitText = '') {
  const result = parseCanonicalQuantityDetails(valueText, conditionText, unitText);
  return { value: result.value, operator: result.operator, precision: result.precision };
}

/**
 * Freeze the Backend-owned source identity before a producer is invoked.
 * This helper only records identity; it does not decide material authority.
 */
export function createEvidenceFactSourceSnapshot(input = {}) {
  const snapshot = {
    ...(input.snapshot_id ? { snapshot_id: sourceSnapshotValue(input.snapshot_id, 'snapshot_id') } : {}),
    material_id: sourceSnapshotValue(input.material_id, 'material_id'),
    material_version: sourceSnapshotValue(input.material_version, 'material_version', { nullableValue: true }),
    source_hash: sourceSnapshotValue(input.source_hash || input.source_text_hash, 'source_hash'),
    chunk_id: sourceSnapshotValue(input.chunk_id || input.anchor_chunk_id, 'chunk_id', { nullableValue: true }),
    chunk_hash: sourceSnapshotValue(input.chunk_hash, 'chunk_hash', { nullableValue: true }),
    source_span_id: sourceSnapshotValue(input.source_span_id, 'source_span_id'),
    source_span_hash: sourceSnapshotValue(input.source_span_hash || input.source_hash || input.source_text_hash, 'source_span_hash'),
    approved_review_identity: input.approved_review_identity ?? input.review_identity ?? null,
    ...(Array.isArray(input.segments) ? {
      segments: Object.freeze(input.segments.map(segment => Object.freeze({
        source_ref: sourceSnapshotValue(segment?.source_ref, 'source_ref'),
        text: sourceSnapshotValue(segment?.text, 'source segment text')
      })))
    } : {})
  };
  if (snapshot.chunk_id && !snapshot.chunk_hash) throw new Error('chunk_hash is required when chunk_id is present');
  return Object.freeze(snapshot);
}

/**
 * Record provider/sampling identity without retaining credentials or raw
 * responses. Nulls are intentional: an omitted sampling setting is distinct
 * from a value silently guessed by an evaluator.
 */
export function createEvidenceFactProducerVersionSnapshot(input = {}) {
  const snapshot = {
    provider: input.provider ?? null,
    model: input.model ?? null,
    endpoint: input.endpoint ?? null,
    protocol: input.protocol ?? null,
    thinking: input.thinking ?? null,
    reasoning: input.reasoning ?? null,
    temperature: input.temperature ?? null,
    top_p: input.top_p ?? null,
    top_k: input.top_k ?? null,
    seed: input.seed ?? null,
    max_output_tokens: input.max_output_tokens ?? null,
    prompt_version: input.prompt_version ?? EVIDENCE_FACT_CANDIDATE_V2_PROMPT_VERSION,
    prompt_hash: input.prompt_hash ?? null,
    candidate_schema_version: input.candidate_schema_version ?? EVIDENCE_FACT_CANDIDATE_V2_SCHEMA_VERSION,
    candidate_schema_hash: input.candidate_schema_hash ?? EVIDENCE_FACT_CANDIDATE_V2_SCHEMA_SHA256,
    canonicalizer_version: input.canonicalizer_version ?? EVIDENCE_FACT_CANONICALIZER_V2_VERSION,
    grounding_version: input.grounding_version ?? EVIDENCE_FACT_GROUNDING_V2_VERSION
  };
  return Object.freeze(snapshot);
}

export function evidenceFactSourceSnapshotMatches(expected, current) {
  if (!expected || !current) return false;
  return stableSha256(expected) === stableSha256(current);
}

export function stableEvidenceFactProducerVersionIdentity(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) throw new Error('producer snapshot is required');
  return `FACT-PRODUCER-V2-${stableSha256(snapshot).slice(0, 32).toUpperCase()}`;
}

function canonicalStatus(statusText) {
  const value = text(statusText);
  if (!value) return { value: 'unknown', source: null, review: false };
  if (NEGATED_OR_UNCERTAIN_STATUS_PATTERN.test(value) || /尚未|not\s+completed|not\s+certif/i.test(value)) {
    return { value: 'unknown', source: value, review: true, reason: 'NEGATED_OR_UNCERTAIN_STATUS' };
  }
  const matches = STATUS_RULES.filter(([, pattern]) => pattern.test(value));
  // A provider may place an event/predicate phrase in status_text even when
  // no lifecycle state is asserted. Preserve it as an unknown structured
  // status without escalating ordinary action wording to review. Explicit
  // lifecycle markers and the existing deterministic enum mapping retain
  // precedence.
  if (ACTION_EVENT_STATUS_PATTERN.test(value)
    && !EXPLICIT_LIFECYCLE_STATUS_PATTERN.test(value)
    && !(matches.length === 1 && matches[0][0] === 'participated' && /参与(?:项目|工程|投标|实施|服务)/u.test(value))) {
    return { value: 'unknown', source: value, review: false, event: true };
  }
  if (matches.length !== 1) {
    return { value: 'unknown', source: value, review: true, reason: 'STATUS_ENUM_UNRESOLVED' };
  }
  return { value: matches[0][0], source: value, review: false };
}

function canonicalCondition(conditionText) {
  const value = text(conditionText);
  if (!value) return { value: null, review: false };
  // Evaluate the specific lower/upper-bound phrases before their shorter
  // substrings (e.g. “不少于” also contains “少于”).
  const match = CONDITION_RULES.find(([pattern]) => pattern.test(value));
  if (!match) return { value: null, review: false, qualifier: value };
  return { value: match[1], review: false };
}

function canonicalUnit(unitText) {
  const value = text(unitText);
  return value ? (UNIT_RULES.get(value) || value) : null;
}

function canonicalDate(valueText) {
  const value = text(valueText);
  const match = DATE.exec(value);
  if (!match) return null;
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return value;
}

function parseEventTemporal(valueText) {
  const value = text(valueText).normalize('NFKC');
  const exact = canonicalDate(value);
  if (exact) return { event_date: exact, precision: 'day' };
  const day = /^(\d{4})年(\d{1,2})月(\d{1,2})日?$/u.exec(value);
  if (day) {
    const normalized = `${day[1]}-${String(day[2]).padStart(2, '0')}-${String(day[3]).padStart(2, '0')}`;
    return canonicalDate(normalized) ? { event_date: normalized, precision: 'day' } : null;
  }
  const month = /^(\d{4})年(\d{1,2})月$/u.exec(value);
  if (month) return { event_date: null, precision: 'month', year: month[1], month: String(month[2]).padStart(2, '0') };
  const year = /^(?:截至)?(\d{4})年(?:底|年末|年底)?$/u.exec(value);
  if (year) return { event_date: null, precision: 'year', year: year[1] };
  return null;
}

function canonicalizeCandidate(candidate) {
  const reviewReasons = [];
  const status = canonicalStatus(candidate.status_text);
  if (status.review) reviewReasons.push(status.reason);
  if (NEGATED_OR_LIMITED_SCOPE_PATTERN.test(text(candidate.statement))) {
    reviewReasons.push('NEGATED_OR_LIMITED_SCOPE');
  }

  const entities = candidate.entity_mentions.map(item => ({
    type: nullable(item.type_hint) || 'unknown',
    name: required(item.value, 'entity value')
  }));

  const scopes = [];
  const scopeSourceTexts = {};
  for (const item of candidate.scope_items) {
    const value = required(item.value, 'scope value');
    const source = required(item.provenance.source_text, 'scope provenance.source_text');
    if (scopeSourceTexts[value] && scopeSourceTexts[value] !== source) {
      reviewReasons.push('CONFLICTING_SCOPE_PROVENANCE');
      continue;
    }
    if (!scopeSourceTexts[value]) {
      scopes.push(value);
      scopeSourceTexts[value] = source;
    }
  }

  const quantities = [];
  for (const item of candidate.quantity_items) {
    const name = required(item.name, 'quantity name');
    const valueText = nullable(item.value_text);
    const unit = canonicalUnit(item.unit_text);
    const condition = canonicalCondition(item.condition_text);
    const parsed = parseCanonicalQuantityDetails(valueText, item.condition_text, item.unit_text);
    if (condition.review) reviewReasons.push(condition.reason);
    if (parsed.qualifier) reviewReasons.push('QUANTITY_QUALIFIER_CONTRACT_GAP');
    if (!parsed.value || !unit) {
      reviewReasons.push(parsed.unresolvedReason || 'QUANTITY_VALUE_OR_UNIT_UNRESOLVED');
      continue;
    }
    quantities.push({
      metric: name,
      value: parsed.value,
      unit,
      ...(parsed.operator ? { operator: parsed.operator } : {}),
      source_text: item.provenance.source_text
    });
  }

  const temporalObservations = [];
  for (const item of candidate.temporal_items) {
    const temporal = parseEventTemporal(item.value_text);
    const context = nullable(item.context_text);
    const temporalText = `${text(item.value_text)} ${text(item.context_text)}`;
    if (!temporal || !context || VALIDITY_TEMPORAL_PATTERN.test(temporalText)) {
      reviewReasons.push('TEMPORAL_ROLE_OR_DATE_UNRESOLVED');
      continue;
    }
    temporalObservations.push({
      value_text: text(item.value_text),
      context_text: context,
      event_date: temporal.event_date,
      precision: temporal.precision,
      source_text: item.provenance.source_text
    });
  }

  return {
    canonical: {
      subject: {
        type: nullable(candidate.subject_type_hint) || 'unknown',
        name: nullable(candidate.subject_name)
      },
      entities,
      status: status.value,
      ...(status.source ? { status_source_text: status.source } : {}),
      scopes,
      scope_source_texts: scopeSourceTexts,
      quantities,
      validity: { status: 'unknown', valid_from: null, valid_until: null },
      domain_metadata: {}
    },
    observation: { statement: required(candidate.statement, 'statement') },
    temporal_observations: temporalObservations,
    observation_provenance: {
      entity_mentions: candidate.entity_mentions.map(item => item.provenance),
      scope_items: candidate.scope_items.map(item => item.provenance),
      quantity_items: candidate.quantity_items.map(item => item.provenance),
      temporal_items: candidate.temporal_items.map(item => item.provenance)
    },
    reviewReasons
  };
}

function sourceSnapshotIndex(sourceSnapshot) {
  if (!sourceSnapshot || !Array.isArray(sourceSnapshot.segments)) {
    throw new Error('source snapshot segments are required for Candidate V2 source_refs');
  }
  const index = new Map();
  for (const segment of sourceSnapshot.segments) {
    if (!segment || typeof segment.source_ref !== 'string' || !segment.source_ref.trim()) continue;
    if (index.has(segment.source_ref)) throw new Error(`duplicate source_ref ${segment.source_ref}`);
    if (typeof segment.text !== 'string' || !segment.text) throw new Error(`source_ref ${segment.source_ref} has no source text`);
    index.set(segment.source_ref, segment.text);
  }
  return index;
}

function resolveSourceRefs(refs, index, label, { allowEmpty = false } = {}) {
  if (!Array.isArray(refs) || (!allowEmpty && refs.length === 0)) throw new Error(`${label} must reference source_refs`);
  const texts = [];
  for (const ref of refs) {
    if (typeof ref !== 'string' || !ref.trim() || !index.has(ref)) throw new Error(`unknown source_ref ${String(ref)}`);
    texts.push(index.get(ref));
  }
  return [...new Set(texts)].join('\n');
}

function isSourceRefCandidate(candidate) {
  return Boolean(candidate && typeof candidate === 'object' && !Array.isArray(candidate)
    && Object.prototype.hasOwnProperty.call(candidate, 'source_refs'));
}

/**
 * Convert the fixed-shape model output to the historical internal
 * canonicalizer projection.  Every provenance string is resolved from the
 * Backend-owned snapshot; no model-provided source text is accepted.
 */
export function projectEvidenceFactCandidateV2SourceRefs(candidate, sourceSnapshot) {
  const index = sourceSnapshotIndex(sourceSnapshot);
  const provenance = (refs, label, { allowEmpty = false } = {}) => ({
    source_text: resolveSourceRefs(refs, index, label, { allowEmpty }),
    source_refs: Array.isArray(refs) ? [...refs] : []
  });
  const fallbackRefs = Array.isArray(candidate.source_refs) ? candidate.source_refs : [];
  return {
    statement: required(candidate.statement, 'statement'),
    subject_name: text(candidate.subject_name) || null,
    subject_type_hint: text(candidate.subject_type_hint) || null,
    entity_mentions: (candidate.entity_mentions || []).map((item, indexValue) => ({
      value: required(item.name, `entity_mentions[${indexValue}].name`),
      type_hint: text(item.type_hint) || null,
      provenance: provenance(item.source_refs, `entity_mentions[${indexValue}].source_refs`)
    })),
    status_text: text(candidate.status_text) || null,
    scope_items: (candidate.scope_items || []).map((item, indexValue) => ({
      value: required(item.text, `scope_items[${indexValue}].text`),
      provenance: provenance(item.source_refs, `scope_items[${indexValue}].source_refs`)
    })),
    quantity_items: (candidate.quantity_items || []).map((item, indexValue) => ({
      name: required(item.name, `quantity_items[${indexValue}].name`),
      value_text: text(item.value_text) || null,
      unit_text: text(item.unit_text) || null,
      condition_text: text(item.condition_text) || null,
      provenance: provenance(item.source_refs, `quantity_items[${indexValue}].source_refs`)
    })),
    temporal_items: (candidate.temporal_items || []).map((item, indexValue) => ({
      value_text: required(item.value_text, `temporal_items[${indexValue}].value_text`),
      context_text: text(item.event_text) || null,
      provenance: provenance(item.source_refs, `temporal_items[${indexValue}].source_refs`)
    })),
    _source_text: resolveSourceRefs(fallbackRefs, index, 'statement.source_refs')
  };
}

export function canonicalizeEvidenceFactCandidateV2(candidate, { sourceText = '', sourceSnapshot = null } = {}) {
  const sourceRefShape = isSourceRefCandidate(candidate);
  try {
    if (sourceRefShape) {
      validateEvidenceFactCandidateV2Data({ facts: [candidate] });
      const projected = projectEvidenceFactCandidateV2SourceRefs(candidate, sourceSnapshot);
      const result = canonicalizeCandidate(projected);
      return {
        status: result.reviewReasons.length ? 'CANONICALIZATION_REVIEW_REQUIRED' : 'CANONICALIZED',
        canonical: result.canonical,
        observation: result.observation,
        temporal_observations: result.temporal_observations,
        observation_provenance: result.observation_provenance,
        review_reasons: result.reviewReasons
      };
    }
    validateEvidenceFactCandidateV2Data({ facts: [candidate] }, { source_text: sourceText });
    const result = canonicalizeCandidate(candidate);
    return {
      status: result.reviewReasons.length ? 'CANONICALIZATION_REVIEW_REQUIRED' : 'CANONICALIZED',
      canonical: result.canonical,
      observation: result.observation,
      temporal_observations: result.temporal_observations,
      observation_provenance: result.observation_provenance,
      review_reasons: result.reviewReasons
    };
  } catch (error) {
    return {
      status: sourceRefShape ? 'REJECTED' : 'CANONICALIZATION_FAILED',
      canonical: null,
      observation: null,
      temporal_observations: [],
      observation_provenance: null,
      review_reasons: [String(error?.message || 'CANDIDATE_V2_INVALID')]
    };
  }
}

function isGroundingTokenCharacter(value) {
  return typeof value === 'string' && /^[\u3400-\u9fffA-Za-z0-9]$/.test(value);
}

function isAsciiDigit(value) {
  return typeof value === 'string' && /^[0-9]$/.test(value);
}

function isContinuationPunctuation(value) {
  return typeof value === 'string' && /^[，,；;、：:]$/.test(value);
}

function isHeadingLineAt(textValue, index) {
  const lineStart = textValue.lastIndexOf('\n', index - 1) + 1;
  return /^\s*#{1,6}\s/.test(textValue.slice(lineStart, index));
}

function isHeadingLineAfter(textValue, index) {
  return /^\s*#{1,6}\s/.test(textValue.slice(index + 1));
}

function isReviewableSemanticFieldMismatch(value, sourceText) {
  const normalizedValue = normalizeGroundingComparisonText(value);
  const normalizedSource = normalizeGroundingComparisonText(sourceText);
  if (!normalizedValue || !normalizedSource) return false;
  if (normalizedSource.includes(normalizedValue)) return true;
  const compactValue = normalizedValue.replace(/[^\u3400-\u9fffA-Za-z0-9]+/g, '');
  const fragments = compactValue.match(/[\u3400-\u9fff]{2}|[A-Za-z0-9]{2,}/g) || [];
  if (!fragments.length) return false;
  const matched = fragments.filter(fragment => normalizedSource.includes(fragment)).length;
  return matched >= Math.ceil(fragments.length / 2);
}

/**
 * Normalize only layout whitespace introduced by PDF/OCR extraction for
 * deterministic grounding comparisons.  Raw source snapshots remain
 * unchanged, punctuation is preserved, and whitespace inside a numeric
 * token (for example `1 000`) is not removed.
 */
export function normalizeGroundingComparisonText(value) {
  const normalized = String(value ?? '').normalize('NFKC').replace(/\r\n?/g, '\n');
  let result = '';
  for (let index = 0; index < normalized.length; index += 1) {
    const character = normalized[index];
    const previous = result.at(-1) || '';
    const next = normalized[index + 1] || '';
    if (character === '\n') {
      const tokenBreak = isGroundingTokenCharacter(previous) && isGroundingTokenCharacter(next);
      const continuationBreak = isContinuationPunctuation(previous) && isGroundingTokenCharacter(next);
      const headingBoundary = isHeadingLineAt(normalized, index) || isHeadingLineAfter(normalized, index);
      if (!headingBoundary && (tokenBreak || continuationBreak)) {
        // A single line break inside a Chinese/Latin/number token, or after
        // explicit continuation punctuation, is a PDF soft wrap.  Sentence
        // breaks, blank lines, headings, and source-segment boundaries remain.
        continue;
      }
    }
    if (/^[ \t\f\v]$/.test(character)) {
      if (isGroundingTokenCharacter(previous) && isGroundingTokenCharacter(next)
        && !(isAsciiDigit(previous) && isAsciiDigit(next))) {
        // Collapse ordinary inter-token layout whitespace without changing
        // digit grouping semantics.
        continue;
      }
      if (previous === ' ') continue;
      result += ' ';
      continue;
    }
    result += character;
  }
  return result;
}

function requireGrounded(value, sourceText, label) {
  if (!value) throw new Error(`${label} is not grounded`);
  if (sourceText.includes(value)) return;
  const normalizedValue = normalizeGroundingComparisonText(value);
  const normalizedSource = normalizeGroundingComparisonText(sourceText);
  if (!normalizedValue || !normalizedSource.includes(normalizedValue)) {
    // Canonical quantities are normalized to plain decimal strings while
    // source text may retain thousands separators or Chinese scale markers
    // (for example “超过3,800” or “超过20万”).  Compare only deterministic
    // numeric token values; do not relax entity, scope, status, or statement
    // grounding and do not infer an operator from the source.
    const numericTokens = String(sourceText ?? '').match(/[超过超大于多于不少于不低于至少不小于不超过至多最多不大于\d,，.零〇一二两三四五六七八九十百千万亿]+/gu) || [];
    const numericValue = label === 'quantity.value' && DECIMAL.test(String(value))
      ? String(value).replace(/^(-?)0+(?=\d)/, '$1')
      : null;
    const numericMatch = numericValue && numericTokens.some(token => parseCanonicalQuantityDetails(token).value === numericValue);
    if (!numericMatch) throw new Error(`${label} is not grounded`);
  }
}

function normalizedSourceUnitText(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/[（(][^）)]*[）)]/g, '')
    .replace(/[`*_#|：:，,。；;、/\\()[\]{}<>《》"“”'‘’\-]/g, '')
    .replace(/\s+/g, '')
    .toLowerCase();
}

function resolvedSourceUnitText(value) {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && typeof value.text === 'string') return value.text;
  return '';
}

// A provider may complete a sentence at a source-window boundary (for
// example a PDF chunk ending in “关键” while the next chunk starts with
// “技术”).  This is not proof of support and must remain review-only.  The
// detector is deliberately structural: it looks for an incomplete terminal
// marker and a sufficiently long contiguous overlap with the candidate.  It
// does not name a tender, document, or business phrase.
function sourceBoundaryCompletionInfo(statement, sourceText) {
  const rawSource = String(sourceText ?? '').trim();
  const rawStatement = String(statement ?? '').trim();
  const source = normalizedSourceUnitText(rawSource);
  const candidate = normalizedSourceUnitText(rawStatement);
  if (!source || !candidate || source === candidate) return null;
  if (/[。！？!?；;]$/u.test(rawSource)) return null;
  const terminalIncomplete = /(?:关键|核心|相关|包括|包含|例如|以及|与|和|等|为|在|从|至|通过|支持|获得|提供|采用|基于)$/u.test(source)
    || /[A-Za-z]{2,}\d+(?:\.\d+)?$/u.test(source);
  if (!terminalIncomplete) return null;
  const maxOverlap = Math.min(source.length, candidate.length, 96);
  for (let length = maxOverlap; length >= 8; length -= 1) {
    const suffix = source.slice(-length);
    const index = candidate.indexOf(suffix);
    if (index >= 0 && index + length < candidate.length) {
      return {
        source_terminal: rawSource.slice(-160),
        candidate_overlap: suffix,
        candidate_completion: candidate.slice(index + length),
        overlap_length: length
      };
    }
  }
  return null;
}

function boundedSourceUnits(sourceText) {
  const source = String(sourceText ?? '').replace(/^---\s*[\r\n]+[\s\S]*?[\r\n]+---\s*/u, '');
  const lines = source.split(/\r?\n/);
  const units = [];
  const headingPath = [];
  let block = [];
  const flush = () => {
    const value = block.join('\n').trim();
    if (value) units.push({ text: value, heading_path: [...headingPath] });
    block = [];
  };
  for (const line of lines) {
    const heading = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
    if (heading) {
      flush();
      const level = heading[1].length;
      headingPath.splice(level - 1);
      headingPath[level - 1] = heading[2];
      continue;
    }
    if (!line.trim()) flush();
    else block.push(line);
  }
  flush();
  return units;
}

function canonicalGroundingAtoms(canonicalResult) {
  const canonical = canonicalResult?.canonical || {};
  const atoms = [
    canonical.subject?.name,
    canonical.status_source_text,
    ...(canonical.entities || []).map(item => item.name),
    ...(canonical.scopes || []),
    ...(canonical.quantities || []).flatMap(item => [item.value, item.unit === 'SECOND' ? '秒' : item.unit === 'MILLISECOND' ? '毫秒' : item.unit === 'MINUTE' ? '分钟' : item.unit]),
    ...(canonicalResult.temporal_observations || []).flatMap(item => [item.value_text, item.context_text])
  ];
  return [...new Set(atoms.map(value => text(value)).filter(value => value.length >= 2))];
}

function findBoundedCompositionalUnit(canonicalResult, sourceText) {
  const atoms = canonicalGroundingAtoms(canonicalResult);
  if (!atoms.length) return null;
  const units = boundedSourceUnits(sourceText);
  const atomInUnit = (atom, unit) => {
    const normalized = normalizedSourceUnitText(unit.text);
    if (normalized.includes(normalizedSourceUnitText(atom))) return true;
    // Parenthetical aliases are optional surface detail.  Keep the match
    // bounded to the same source unit rather than weakening grounding across
    // paragraphs or documents.
    return [...String(unit.text).matchAll(/[（(]([^）)]*)[）)]/g)]
      .some(match => normalizedSourceUnitText(match[1]).includes(normalizedSourceUnitText(atom)));
  };
  return units.find(unit => {
    return atoms.every(atom => atomInUnit(atom, unit));
  }) || null;
}

function boundedStatementSupport(value, unitText) {
  const statement = normalizedSourceUnitText(value);
  const unit = normalizedSourceUnitText(unitText);
  if (!statement || !unit) return false;
  if (unit.includes(statement)) return true;
  // A paraphrased observation may differ in punctuation or connective words,
  // but every adjacent semantic character pair must still be present in the
  // same bounded source unit. This is deliberately conservative: it prevents
  // a candidate from combining grounded fields with an unrelated new claim.
  const bigrams = [...new Set(Array.from({ length: Math.max(0, statement.length - 1) }, (_, index) => statement.slice(index, index + 2)))];
  return bigrams.length > 0 && bigrams.every(pair => unit.includes(pair));
}

function isGenericObservationFraming(value) {
  return /^(?:该|本)(?:文档|材料|记录|报告)(?:说明|记录|显示|表明|指出|将)/.test(String(value ?? '').trim());
}

/**
 * Detect a provider's bounded observation framing without enumerating
 * document-specific phrases.  The semantic atoms must be present in the
 * statement and in one Backend-owned source unit; numeric/identifier-like
 * tokens may not be introduced outside that unit.  This permits headings and
 * connective grammar while keeping cross-unit composition and unsupported
 * identifiers fail-closed.
 */
function isBoundedObservationFraming(value, canonicalResult, unitText) {
  const statement = normalizedSourceUnitText(value);
  const unit = normalizedSourceUnitText(unitText);
  const atoms = canonicalGroundingAtoms(canonicalResult);
  if (!statement || !unit || atoms.length < 1) return false;
  const matchedAtoms = atoms.filter(atom => {
    const normalized = normalizedSourceUnitText(atom);
    return normalized && statement.includes(normalized) && unit.includes(normalized);
  });
  if (matchedAtoms.length < 1) return false;
  const statementBigrams = [...new Set(Array.from({ length: Math.max(0, statement.length - 1) }, (_, index) => statement.slice(index, index + 2)))];
  const overlap = statementBigrams.length
    ? statementBigrams.filter(pair => unit.includes(pair)).length / statementBigrams.length
    : 0;
  if (overlap < 0.7) return false;
  const statementMarkers = String(value ?? '').match(/(?:\d+(?:\.\d+)?(?:[A-Za-z%/_-]+)?|[A-Za-z][A-Za-z0-9._/-]*)/g) || [];
  return statementMarkers.every(marker => unit.includes(normalizedSourceUnitText(marker)));
}

function boundedPhraseSupport(value, unitText) {
  const phrase = normalizedSourceUnitText(value);
  const unit = normalizedSourceUnitText(unitText);
  if (!phrase || !unit) return false;
  if (unit.includes(phrase)) return true;
  const starts = [];
  for (let index = unit.indexOf(phrase[0]); index >= 0; index = unit.indexOf(phrase[0], index + 1)) starts.push(index);
  return starts.some(start => {
    let cursor = start + 1;
    let inserted = 0;
    let gap = 0;
    for (const character of phrase.slice(1)) {
      const found = unit.indexOf(character, cursor);
      if (found < 0) return false;
      gap = Math.max(gap, found - cursor);
      inserted += found - cursor;
      cursor = found + 1;
    }
    return inserted <= 24 && gap <= 16;
  });
}

function requireStatusSourceGrounded(value, sourceText, canonicalResult) {
  if (!value) return;
  try {
    requireGrounded(value, sourceText, 'status_source_text');
    return;
  } catch (error) {
    // Keep status grounding inside the same bounded unit that supports the
    // candidate statement.  This permits a provider to omit an inline
    // version/qualifier while preventing status text from being borrowed
    // from an adjacent section or document.
    const statement = canonicalResult?.observation?.statement;
    const unit = boundedSourceUnits(sourceText).find(item => boundedStatementSupport(statement, item.text));
    if (unit && boundedPhraseSupport(value, unit.text)) return;
    throw error;
  }
}

function requireStatementGrounded(value, sourceText, subjectName, canonicalResult, resolvedSourceUnit = null) {
  if (!value) throw new Error('statement is not grounded');
  if (sourceText.includes(value)) return { mode: 'EXACT', unit: null };
  const normalizedValue = normalizeGroundingComparisonText(value);
  const normalizedSource = normalizeGroundingComparisonText(sourceText);
  if (normalizedValue && normalizedSource.includes(normalizedValue)) {
    return { mode: 'NORMALIZED_EXACT', unit: null };
  }
  // Providers occasionally prepend a generic referential subject (for example
  // “该测试报告”) to a source sentence. Accept only that narrow surface
  // variation when the canonical subject itself is independently present in
  // the backend-owned source; all substantive wording still must be grounded.
  const suffix = String(value).replace(/^(?:该|本)(?:项|次)?(?:测试|安全|性能|验收)?(?:报告|材料|记录|文档)/, '');
  if (suffix && subjectName && sourceText.includes(subjectName) && sourceText.includes(suffix)) {
    return { mode: 'GENERIC_REFERENTIAL_PREFIX', unit: null };
  }
  const unit = findBoundedCompositionalUnit(canonicalResult, sourceText)
    || (resolvedSourceUnit && (isGenericObservationFraming(value)
      || isBoundedObservationFraming(value, canonicalResult, resolvedSourceUnitText(resolvedSourceUnit)))
      ? { text: resolvedSourceUnitText(resolvedSourceUnit), heading_path: resolvedSourceUnit.heading_path || [] }
      : null);
  if (!unit || (!boundedStatementSupport(value, unit.text)
    && !isGenericObservationFraming(value)
    && !isBoundedObservationFraming(value, canonicalResult, unit.text))) {
    throw new Error('statement is not grounded');
  }
  return { mode: 'BOUNDED_COMPOSITIONAL', unit };
}

/**
 * Grounding is intentionally conservative and remains separate from
 * canonicalization.  It never assigns lifecycle, review or writer authority.
 */
export function groundCanonicalEvidenceFactCandidateV2(result, { sourceText = '', resolvedSourceUnit = null } = {}) {
  if (!result || result.status === 'CANONICALIZATION_FAILED' || !result.canonical) {
    return { decision: 'REJECT', reasons: ['CANONICALIZATION_FAILED'] };
  }
  const reasons = [];
  // Source Role resolution may already have selected a Backend-owned bounded
  // unit. Reuse that exact unit for grounding when supplied; callers that do
  // not have a handoff retain the existing sourceText behavior.
  const boundedSourceText = resolvedSourceUnitText(resolvedSourceUnit) || sourceText;
  let sourceGrounding = { mode: 'UNKNOWN', unit: null };
  let statementSemanticUnresolved = false;
  const hardGroundingReasons = [];
  const boundaryCompletion = sourceBoundaryCompletionInfo(result.observation?.statement, boundedSourceText);
  const captureHardFailure = error => {
    if (!error?.message) return;
    // The statement/subject/entity surface can be short by exactly the
    // completion at an incomplete source boundary.  Downgrade only those
    // bounded grounding failures; numeric, scope, negation, and other hard
    // contradictions remain fail-closed.
    if (boundaryCompletion && /^(?:statement|subject\.name|entity\.name|status_source_text|(?:entity_mentions|scope_items|quantity_items|temporal_items)\[\d+\]\.provenance\.source_text) is not grounded$/u.test(error.message)) return;
    hardGroundingReasons.push(error.message);
  };
  try {
    sourceGrounding = requireStatementGrounded(result.observation?.statement, boundedSourceText, result.canonical?.subject?.name, result, resolvedSourceUnit);
  } catch (error) {
    // A non-empty statement whose only failure is literal comparison is not
    // enough to prove semantic support, but it is not evidence of a hard
    // contradiction either. Keep it reviewable while checking every other
    // canonical field for hard grounding failures below.
    if (result.observation?.statement && error?.message === 'statement is not grounded') {
      statementSemanticUnresolved = true;
    } else {
      captureHardFailure(error);
    }
  }
  // Even when bounded observation framing happens to find all canonical
  // atoms in the source unit, an incomplete terminal plus appended candidate
  // text is still an unresolved boundary completion.  Keep it review-only.
  if (boundaryCompletion) statementSemanticUnresolved = true;
  for (const [group, entries] of Object.entries(result.observation_provenance || {})) {
    for (const [index, provenance] of entries.entries()) {
      try {
        requireGrounded(provenance?.source_text, boundedSourceText, `${group}[${index}].provenance.source_text`);
      } catch (error) {
        captureHardFailure(error);
      }
    }
  }
  try {
    if (result.canonical.subject.name) requireGrounded(result.canonical.subject.name, boundedSourceText, 'subject.name');
  } catch (error) {
    captureHardFailure(error);
  }
  for (const entity of result.canonical.entities) {
    try {
      requireGrounded(entity.name, boundedSourceText, 'entity.name');
    } catch (error) {
      captureHardFailure(error);
    }
  }
  for (const scope of result.canonical.scopes) {
    try {
      requireGrounded(scope, boundedSourceText, 'scope');
    } catch (error) {
      // A bounded source unit may use a faithful list/compositional surface
      // (for example “不提供可对外使用的 7×24、分钟级响应” while the
      // candidate names “不提供分钟级响应”). Permit only that narrow,
      // same-unit phrase alignment; full-document grounding keeps the exact
      // match requirement and therefore cannot borrow adjacent sections.
      if (resolvedSourceUnit && boundedPhraseSupport(scope, boundedSourceText)) continue;
      if (!statementSemanticUnresolved || !isReviewableSemanticFieldMismatch(scope, boundedSourceText)) captureHardFailure(error);
    }
  }
  for (const quantity of result.canonical.quantities) {
    try {
      requireGrounded(quantity.value, boundedSourceText, 'quantity.value');
    } catch (error) {
      captureHardFailure(error);
    }
    const rawUnit = quantity.unit === 'SECOND' ? '秒'
      : quantity.unit === 'MILLISECOND' ? '毫秒'
        : quantity.unit === 'MINUTE' ? '分钟'
          : quantity.unit === 'users' ? '用户'
            : quantity.unit === 'people' ? '人'
              : quantity.unit === 'items' ? '个' : quantity.unit;
    try {
      requireGrounded(rawUnit, boundedSourceText, 'quantity.unit');
    } catch (error) {
      captureHardFailure(error);
    }
    try {
      requireGrounded(quantity.source_text, boundedSourceText, 'quantity.source_text');
    } catch (error) {
      captureHardFailure(error);
    }
  }
  for (const temporal of result.temporal_observations) {
    try {
      requireGrounded(temporal.value_text, boundedSourceText, 'temporal.value_text');
    } catch (error) {
      captureHardFailure(error);
    }
    try {
      requireGrounded(temporal.source_text, boundedSourceText, 'temporal.source_text');
    } catch (error) {
      captureHardFailure(error);
    }
  }
  if (result.canonical.status_source_text) {
    try {
      requireStatusSourceGrounded(result.canonical.status_source_text, boundedSourceText, result);
    } catch (error) {
      if (!statementSemanticUnresolved
        || !isReviewableSemanticFieldMismatch(result.canonical.status_source_text, boundedSourceText)) {
        captureHardFailure(error);
      }
    }
  }
  if (statementSemanticUnresolved && result.review_reasons.includes('NEGATED_OR_LIMITED_SCOPE')) {
    hardGroundingReasons.push('NEGATED_OR_LIMITED_SCOPE');
  }
  if (statementSemanticUnresolved
    && !boundaryCompletion
    && boundedSourceUnits(boundedSourceText).length > 1
    && !findBoundedCompositionalUnit(result, boundedSourceText)) {
    hardGroundingReasons.push('statement crosses bounded source units');
  }
  if (hardGroundingReasons.length) {
    return {
      decision: 'REJECT',
      reasons: [
        ...(statementSemanticUnresolved ? ['statement is not grounded'] : []),
        ...hardGroundingReasons
      ],
      source_grounding: sourceGrounding
    };
  }
  if (statementSemanticUnresolved) reasons.push(boundaryCompletion
    ? 'SOURCE_BOUNDARY_COMPLETION_UNRESOLVED'
    : 'STATEMENT_SEMANTIC_GROUNDING_UNRESOLVED');
  if (result.review_reasons.length) reasons.push(...result.review_reasons);
  return reasons.length
    ? { decision: 'REVIEW_REQUIRED', reasons, source_grounding: sourceGrounding }
    : { decision: 'ACCEPT', reasons: [], source_grounding: sourceGrounding };
}

export function stableCanonicalEvidenceFactIdentity(canonicalResult, sourceSnapshot) {
  if (!canonicalResult?.canonical || !sourceSnapshot) throw new Error('canonical result and source snapshot are required');
  return `EFACT-CAND-V2-${stableSha256({
    canonical: canonicalResult.canonical,
    source_snapshot: sourceSnapshot
  }).slice(0, 32).toUpperCase()}`;
}

export function canonicalizeAndGroundEvidenceFactCandidateV2(candidate, options = {}) {
  const canonicalization = canonicalizeEvidenceFactCandidateV2(candidate, options);
  const grounding = groundCanonicalEvidenceFactCandidateV2(canonicalization, options);
  return { canonicalization, grounding };
}
