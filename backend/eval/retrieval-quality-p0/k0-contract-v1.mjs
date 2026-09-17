import { createHash } from 'node:crypto';

export const K0_AMENDMENT_ID = 'V43_RAG_RETRIEVAL_P0_K0_CONTRACT_AMENDMENT_V1';
export const FROZEN_GOLD_ARTIFACT_TYPE = 'GPT_SEMANTIC_GOLD_V1';
export const FROZEN_GOLD_SHA256 = '7576C1D9A9FECD19F032AD49085E61E48BB008EFF4788E225A2CCEE3087492E7';

const sha256 = value => createHash('sha256').update(String(value), 'utf8').digest('hex');
const stable = value => Array.isArray(value)
  ? value.map(stable)
  : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]))
    : value;

/**
 * Additive Eval projection only.  It deliberately leaves the frozen Gold
 * case fields and evidence spans untouched.
 */
export function projectK0Expectation(caseGold) {
  const hasGradeTwoEvidence = (caseGold.evidence_items || []).some(item => Number(item.grade) >= 2);
  return {
    case_id: caseGold.case_id,
    requirement_id: caseGold.requirement_id,
    split: caseGold.split,
    case_class: caseGold.case_class,
    profile_class: caseGold.profile_class,
    original_expected_k0: caseGold.expected_k0,
    expected_retrieval_k0: !hasGradeTwoEvidence,
    expected_no_sufficient_evidence: caseGold.has_sufficient_evidence !== true,
    grade_gte_2_evidence_item_count: (caseGold.evidence_items || []).filter(item => Number(item.grade) >= 2).length,
    projection_rule: 'expected_retrieval_k0=true iff frozen corpus has no Gold evidence item with grade >= 2; expected_no_sufficient_evidence is independent and reflects full Requirement sufficiency.'
  };
}

export function buildK0Amendment({ gold, goldFileSha256 = FROZEN_GOLD_SHA256 } = {}) {
  if (!gold || gold.artifact_type !== FROZEN_GOLD_ARTIFACT_TYPE) throw new Error('K0 amendment requires GPT_SEMANTIC_GOLD_V1');
  const projections = gold.cases.map(projectK0Expectation);
  const holdout = projections.filter(item => item.split === 'UNTOUCHED_HOLDOUT_SET');
  const artifact = {
    artifact_type: K0_AMENDMENT_ID,
    artifact_version: 'v1',
    contract_status: 'ADDITIVE_EVAL_ONLY',
    created_by: 'Codex',
    basis: {
      gold_artifact_type: gold.artifact_type,
      gold_artifact_version: gold.artifact_version,
      gold_file_sha256: String(goldFileSha256).toUpperCase(),
      gold_mutated: false,
      original_evidence_spans_and_atoms_unchanged: true
    },
    rules: {
      expected_retrieval_k0: 'TRUE only when the frozen corpus contains no grade >= 2 evidence-bearing candidate that Search should usefully surface.',
      expected_no_sufficient_evidence: 'TRUE when the frozen corpus cannot fully support the Requirement.',
      partial_case: 'A case with grade >= 2 evidence but incomplete Requirement support has expected_retrieval_k0=FALSE and expected_no_sufficient_evidence=TRUE.',
      corpus_gap_or_true_negative: 'A case with no grade >= 2 evidence has expected_retrieval_k0=TRUE; no-sufficient-evidence is reported independently.',
      retrieval_k0_is_not_support_sufficiency: true
    },
    projection_count: projections.length,
    expected_retrieval_k0_count: holdout.filter(item => item.expected_retrieval_k0).length,
    expected_no_sufficient_evidence_count: holdout.filter(item => item.expected_no_sufficient_evidence).length,
    projections,
    amendment_content_hash: null
  };
  const hashInput = { ...artifact };
  delete hashInput.amendment_content_hash;
  artifact.amendment_content_hash = sha256(JSON.stringify(stable(hashInput)));
  return artifact;
}
