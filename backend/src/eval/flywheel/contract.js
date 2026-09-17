import { createHash } from 'node:crypto';

export const FLYWHEEL_VERSION = 'v1';
export const MODULES = Object.freeze(['requirement', 'fact', 'mapping', 'claim', 'writer', 'rag']);
export const DATASET_PARTITIONS = Object.freeze(['TARGETED_BADCASE', 'CORE6', 'FRESH_HOLDOUT', 'OTHER']);
export const EVAL_RUN_STATUSES = Object.freeze(['OPEN', 'COMPLETED', 'BLOCKED', 'SUPERSEDED']);
export const BADCASE_SEVERITIES = Object.freeze(['P0', 'P1', 'P2', 'INFO']);
export const BADCASE_STATUSES = Object.freeze([
  'OPEN', 'ROOT_CAUSE_CONFIRMED', 'REPAIR_PLANNED', 'REPAIRED',
  'REGRESSION_PASS', 'REGRESSION_FAIL', 'WONT_FIX', 'DISPUTED'
]);

const SENSITIVE_KEY = /(api[_-]?key|authorization|bearer|secret|password|token|raw[_-]?(prompt|response|provider)|model[_-]?content|task[_-]?(instruction|payload))/i;

export function stableSerialize(value) {
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function sha256(value) {
  return createHash('sha256').update(String(value ?? ''), 'utf8').digest('hex');
}

export function hashJson(value) {
  return `sha256:${sha256(stableSerialize(value))}`;
}

function assertSafeKeys(value, path = '$') {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertSafeKeys(item, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, nested] of Object.entries(value)) {
    if (SENSITIVE_KEY.test(key)) {
      throw Object.assign(new Error(`Sensitive registry field is not allowed: ${path}.${key}`), { code: 'SENSITIVE_REGISTRY_FIELD' });
    }
    assertSafeKeys(nested, `${path}.${key}`);
  }
}

function requireString(value, field) {
  if (typeof value !== 'string' || !value.trim()) {
    throw Object.assign(new Error(`${field} is required.`), { code: 'INVALID_EVAL_RUN_IDENTITY' });
  }
  return value.trim();
}

function requireSha(value, field) {
  const normalized = requireString(value, field).replace(/^sha256:/, '');
  if (!/^[a-f0-9]{64}$/i.test(normalized)) {
    throw Object.assign(new Error(`${field} must be a SHA-256 hex string.`), { code: 'INVALID_EVAL_RUN_HASH' });
  }
  return `sha256:${normalized.toLowerCase()}`;
}

export function validateEvalRunInput(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw Object.assign(new Error('EvalRun input must be an object.'), { code: 'INVALID_EVAL_RUN_INPUT' });
  }
  assertSafeKeys(input);
  const module = requireString(input.module, 'module');
  if (!MODULES.includes(module)) throw Object.assign(new Error(`Unsupported module: ${module}`), { code: 'INVALID_EVAL_RUN_MODULE' });
  const datasetId = requireString(input.dataset_id, 'dataset_id');
  const partition = requireString(input.dataset_partition, 'dataset_partition');
  if (!DATASET_PARTITIONS.includes(partition)) throw Object.assign(new Error(`Unsupported dataset partition: ${partition}`), { code: 'INVALID_DATASET_PARTITION' });
  const createdAt = requireString(input.created_at, 'created_at');
  if (Number.isNaN(Date.parse(createdAt))) throw Object.assign(new Error('created_at must be ISO-8601.'), { code: 'INVALID_EVAL_RUN_TIMESTAMP' });

  const sourceCorpus = input.source_corpus;
  if (!sourceCorpus || typeof sourceCorpus !== 'object') throw Object.assign(new Error('source_corpus is required.'), { code: 'INVALID_EVAL_RUN_SOURCE' });
  const gold = input.gold_or_source_truth;
  if (!gold || typeof gold !== 'object') throw Object.assign(new Error('gold_or_source_truth is required.'), { code: 'INVALID_EVAL_RUN_GOLD' });
  const gitDirty = input.git_dirty === true;
  if (typeof input.git_dirty !== 'boolean') throw Object.assign(new Error('git_dirty is required.'), { code: 'INVALID_EVAL_RUN_GIT_STATE' });
  const value = {
    eval_run_id: requireString(input.eval_run_id, 'eval_run_id'),
    module,
    dataset_id: datasetId,
    dataset_partition: partition,
    created_at: new Date(createdAt).toISOString(),
    git_head: input.git_head === null ? null : requireString(input.git_head, 'git_head'),
    git_dirty: gitDirty,
    git_status_sha256: requireSha(input.git_status_sha256, 'git_status_sha256'),
    git_diff_sha256: requireSha(input.git_diff_sha256, 'git_diff_sha256'),
    git_untracked_manifest_sha256: requireSha(input.git_untracked_manifest_sha256, 'git_untracked_manifest_sha256'),
    source_corpus: {
      id: requireString(sourceCorpus.id, 'source_corpus.id'),
      version: requireString(sourceCorpus.version, 'source_corpus.version'),
      sha256: requireSha(sourceCorpus.sha256, 'source_corpus.sha256')
    },
    gold_or_source_truth: {
      id: requireString(gold.id, 'gold_or_source_truth.id'),
      version: requireString(gold.version, 'gold_or_source_truth.version'),
      sha256: requireSha(gold.sha256, 'gold_or_source_truth.sha256'),
      semantic_status: gold.semantic_status || 'NOT_APPLICABLE'
    },
    production_artifact_identity: input.production_artifact_identity || { run_id: null, artifact_id: null, sha256: null },
    contract_versions: input.contract_versions || { prompt: null, schema: null, task: null, rules: {} },
    provider_model: input.provider_model || { provider: null, model: null, endpoint_category: null },
    evaluator_version: requireString(input.evaluator_version || `v43-flywheel-${FLYWHEEL_VERSION}`, 'evaluator_version'),
    artifact_manifest: input.artifact_manifest || { path: null, sha256: null },
    status: input.status || 'OPEN'
  };
  if (!EVAL_RUN_STATUSES.includes(value.status)) throw Object.assign(new Error(`Unsupported EvalRun status: ${value.status}`), { code: 'INVALID_EVAL_RUN_STATUS' });
  const datasetUpper = value.dataset_id.toUpperCase();
  const conflatesCore6AndHoldout = (value.dataset_partition === 'CORE6' && datasetUpper.includes('HOLDOUT'))
    || (value.dataset_partition === 'FRESH_HOLDOUT' && datasetUpper.includes('CORE6'));
  if (conflatesCore6AndHoldout) throw Object.assign(new Error('CORE6 and holdout dataset identities cannot be conflated.'), { code: 'CORE6_HOLDOUT_CONFLATION' });
  const identityHash = hashJson(value);
  return { value, identity_hash: identityHash };
}

export function validateTraceStage(stage = {}) {
  if (!stage || typeof stage !== 'object' || Array.isArray(stage)) throw Object.assign(new Error('TraceStage must be an object.'), { code: 'INVALID_TRACE_STAGE' });
  const ordinal = Number(stage.ordinal);
  if (!Number.isInteger(ordinal) || ordinal < 0) throw Object.assign(new Error('TraceStage ordinal is invalid.'), { code: 'INVALID_TRACE_STAGE_ORDINAL' });
  const status = String(stage.status || 'PRESENT');
  if (!['PRESENT', 'ABSENT', 'NOT_REACHED', 'EVIDENCE_NOT_PERSISTED'].includes(status)) throw Object.assign(new Error('TraceStage status is invalid.'), { code: 'INVALID_TRACE_STAGE_STATUS' });
  return { ...stage, ordinal, status };
}

export function validateBadCaseInput(input = {}) {
  if (!input || typeof input !== 'object') throw Object.assign(new Error('BadCase input must be an object.'), { code: 'INVALID_BADCASE_INPUT' });
  assertSafeKeys(input);
  const value = {
    badcase_id: requireString(input.badcase_id, 'badcase_id'),
    module: requireString(input.module, 'module'),
    eval_run_id: requireString(input.eval_run_id, 'eval_run_id'),
    case_id: requireString(input.case_id, 'case_id'),
    source_truth_atom_id: input.source_truth_atom_id || null,
    severity: requireString(input.severity, 'severity'),
    semantic_label: input.semantic_label ?? null,
    semantic_label_author: input.semantic_label_author ?? null,
    semantic_label_version: input.semantic_label_version ?? null,
    first_divergence_stage: input.first_divergence_stage ?? null,
    failure_family_id: input.failure_family_id ?? null,
    status: input.status || 'OPEN',
    introduced_run_id: input.introduced_run_id ?? null,
    resolved_run_id: input.resolved_run_id ?? null,
    regression_case_id: input.regression_case_id ?? null,
    evidence_refs: Array.isArray(input.evidence_refs) ? input.evidence_refs : [],
    created_at: input.created_at || new Date().toISOString(),
    updated_at: input.updated_at || new Date().toISOString()
  };
  if (!MODULES.includes(value.module)) throw Object.assign(new Error('BadCase module is invalid.'), { code: 'INVALID_BADCASE_MODULE' });
  if (!BADCASE_SEVERITIES.includes(value.severity)) throw Object.assign(new Error('BadCase severity is invalid.'), { code: 'INVALID_BADCASE_SEVERITY' });
  if (!BADCASE_STATUSES.includes(value.status)) throw Object.assign(new Error('BadCase status is invalid.'), { code: 'INVALID_BADCASE_STATUS' });
  if (value.semantic_label !== null && (!value.semantic_label_author || !value.semantic_label_version)) {
    throw Object.assign(new Error('Semantic labels require explicit author and version.'), { code: 'SEMANTIC_LABEL_PROVENANCE_REQUIRED' });
  }
  return value;
}
