import { hashJson } from './contract.js';

const SCOPES = Object.freeze(['targeted', 'family', 'core6', 'holdout']);

export function runRegression({
  scope,
  caseIds = [],
  familyId = null,
  evalDatasetId,
  datasetPartition,
  baselineIdentity,
  currentIdentity,
  cases = [],
  evaluator = null
} = {}) {
  if (!SCOPES.includes(scope)) throw Object.assign(new Error(`Unsupported regression scope: ${scope}`), { code: 'INVALID_REGRESSION_SCOPE' });
  if (!evalDatasetId || !datasetPartition) throw Object.assign(new Error('Dataset identity and partition are required.'), { code: 'REGRESSION_DATASET_IDENTITY_REQUIRED' });
  if (scope === 'core6' && datasetPartition !== 'CORE6') throw Object.assign(new Error('Core6 regression requires CORE6 partition.'), { code: 'CORE6_PARTITION_REQUIRED' });
  if (scope === 'holdout' && datasetPartition !== 'FRESH_HOLDOUT') throw Object.assign(new Error('Holdout regression requires FRESH_HOLDOUT partition.'), { code: 'HOLDOUT_PARTITION_REQUIRED' });
  if (baselineIdentity && currentIdentity && hashJson(baselineIdentity) !== hashJson(currentIdentity)) throw Object.assign(new Error('Regression baseline/current identity mismatch.'), { code: 'REGRESSION_IDENTITY_MISMATCH' });
  let selected = [...cases];
  if (scope === 'targeted' && caseIds.length) selected = selected.filter((item) => caseIds.includes(item.case_id));
  if (scope === 'family' && familyId) selected = selected.filter((item) => item.failure_family_id === familyId);
  const results = selected.map((item) => {
    const observations = typeof evaluator === 'function' ? evaluator(item) : (Array.isArray(item.observations) ? item.observations : []);
    const status = observations.length === 0 ? 'NOT_EVALUATED' : observations.some((row) => row.result === 'FAIL') ? 'FAIL' : observations.some((row) => row.result === 'REVIEW_REQUIRED') ? 'REVIEW_REQUIRED' : 'PASS';
    return {
      regression_result_id: `regression:${hashJson({ evalDatasetId, scope, case_id: item.case_id }).slice(-24)}`,
      eval_dataset_id: evalDatasetId,
      dataset_partition: datasetPartition,
      scope,
      case_id: item.case_id,
      baseline_identity: baselineIdentity || null,
      current_identity: currentIdentity || null,
      observations,
      status
    };
  });
  return { scope, eval_dataset_id: evalDatasetId, dataset_partition: datasetPartition, results, result_count: results.length };
}

export { SCOPES };
