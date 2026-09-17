# ADR-024: Requirement Gold v1.1 Known Annotation Debt and Deferred Remediation

**Date:** 2026-09-03  
**Status:** Accepted  
**Scope:** Requirement Eval / Gold Governance  
**Decision Type:** Evaluation baseline governance; no production behavior change

## Context

The current Requirement evaluation baseline remains the original Requirement Gold dataset used by the V4.3 Requirement Eval.

Current known baseline:

* Dataset: `reqx-v3-real-tender-gold-pilot-v1.1-semantic-boundary`
* Gold items: 199
* Current Requirement Eval against this baseline:

  * Recall: 100%
  * Precision: 100%
  * Source Verified: 100%

No human-audited Requirement Gold v1.2 has been created or activated.

The current v1.1 Gold remains unchanged from the existing baseline.

A subsequent human review identified several annotation-quality issues in the Gold dataset. These findings indicate that the dataset is still useful as an engineering regression baseline, but it must not be treated as a fully human-certified semantic ground truth.

## Known Annotation Debt

The following issues have been identified for future remediation.

### 1. Subject attribution issue

`FAST-WATER-01-G005-06`

The Gold appears to attribute the "使用技术咨询" requirement to the wrong system subject.

Human review indicates that the source context should be revalidated before any future Gold correction.

### 2. Harmful merge / atomicity issues

The following Gold items may combine independently respondable obligations that should potentially be represented as separate canonical requirements:

* `FAST-WATER-01-G029`
* `FAST-WATER-01-G058`
* `TB-006-G031`
* `TB-006-G034`

These cases require source-backed re-adjudication before modification.

### 3. Duplicate semantic obligation

The following items appear to represent substantially the same canonical obligation in different source locations:

* `FAST-WATER-01-G042`
* `FAST-WATER-01-G060`

Future remediation should preserve multiple provenance locations without double-counting the same canonical requirement where appropriate.

### 4. Table semantic completeness

The following Gold items require source-table revalidation:

* `TB-006-G006`
* `TB-006-G007`
* `TB-006-G008`
* `TB-006-G009`
* `TB-006-G010`
* `TB-006-G011`
* `TB-006-G012`
* `TB-006-G013`

Some current Gold texts use expressions such as "按表列数量" or omit table semantics that may be relevant to a meaning-complete requirement representation.

Any future correction must be derived from the actual source table header, row cells, and table semantic presentation.

No value may be inferred or guessed from an ambiguous table extraction.

### 5. TB-006-G043

`TB-006-G043` remains an active Requirement Gold item.

The source is located under a section titled "政策性采购需求", but the content contains an explicit supplier obligation requiring the supplier to provide project-level ESG implementation measures.

Section title alone is not sufficient reason to exclude an otherwise actionable and independently respondable requirement.

Therefore:

`TB-006-G043` is not currently classified as known scope pollution.

## Decision

Requirement Gold v1.1 will not be modified at the current development stage.

The existing dataset remains frozen and continues to serve as the Requirement engineering regression baseline.

The known annotation issues are recorded as deferred Gold debt.

No Requirement Gold v1.2 will be activated during the current Writer remediation and Writer Eval work.

## Rationale

The current priority is remediation and validation of confirmed Writer production-chain issues.

Changing the Requirement Gold baseline at the same time would introduce an additional independent variable:

* Gold item text changes
* Gold item count changes
* Gold identity changes
* atomicity changes
* metric denominator changes
* Requirement Eval result changes

This would make subsequent regression failures harder to attribute to either:

1. production-code changes, or
2. evaluation-baseline changes.

For engineering isolation, the Requirement regression baseline remains stable until the downstream semantic and Writer chains are sufficiently stable.

## Interpretation of Current Requirement Eval Results

The statement:

`Requirement Eval Recall / Precision / Source Verified = 100%`

means:

> Current Requirement extraction behavior is 100% against the frozen Requirement Gold v1.1 regression baseline.

It must not be interpreted as:

> All 199 Requirement Gold annotations have been independently human-certified as semantically perfect.

The following status terminology must be used:

`REQUIREMENT_GOLD_V1_1 = FROZEN_WITH_KNOWN_ANNOTATION_DEBT`

`REQUIREMENT_EVAL_REGRESSION_BASELINE = ACTIVE`

`REQUIREMENT_GOLD_HUMAN_CERTIFIED = NO`

`REQUIREMENT_GOLD_REMEDIATION = DEFERRED`

## Non-Decision / Explicitly Not Changed

This ADR does not authorize changes to:

* Requirement extraction Prompt
* Requirement Candidate schema
* Canonical Requirement contract
* Canonicalizer
* Scope Router business rules
* Requirement production code
* Mapping
* Claim
* Writer
* RAG / Retrieval
* current Requirement Eval authority
* current Requirement Gold dataset

No Gold file is modified by this decision.

## Future Remediation Trigger

Requirement Gold remediation should be resumed before the final authority-chain freeze and Production E2E release decision.

Recommended sequence:

1. Stabilize Writer P1 remediation.
2. Complete Writer targeted engineering re-audit.
3. Complete Mapping / Claim / Writer Gold human review.
4. Complete Writer Eval V1 engineering baseline.
5. Complete required semantic Provider Fidelity checks.
6. Create Requirement Gold human-audited successor dataset.
7. Run Requirement Gold version-drift validation.
8. Run the full Requirement → Fact → Mapping → Claim → Writer authority freeze audit.
9. Proceed to Production E2E.

Requirement Gold remediation must be completed before claiming that the complete semantic authority chain is human-validated and release-ready.

## Future Gold Remediation Requirements

When remediation resumes:

* v1.1 must remain immutable.
* A successor version must be created rather than silently overwriting v1.1.
* Every changed Gold item must be source-backed.
* Old Gold IDs must remain historically traceable.
* Gold annotation metadata should be stored without unnecessarily changing the production Requirement contract.
* Production Requirement code must not import Eval Gold.
* Requirement Prompt, Schema, Canonicalizer, and routing semantics must not change merely to make the new Gold pass.
* The same frozen Requirement Candidate output should be evaluated against both old and new Gold so metric changes caused solely by Gold changes can be isolated.
* Any unexplained metric delta must block Gold-baseline promotion.

## Current Governance State

```text
REQUIREMENT_GOLD_V1_1
= FROZEN_WITH_KNOWN_ANNOTATION_DEBT

REQUIREMENT_GOLD_MUTATION
= DEFERRED

REQUIREMENT_EVAL_REGRESSION_BASELINE
= ACTIVE

REQUIREMENT_GOLD_HUMAN_CERTIFIED
= NO

REQUIREMENT_GOLD_V1_2
= NOT_CREATED / NOT_ACTIVATED

REQUIREMENT_PRODUCTION_BEHAVIOR_CHANGE
= NONE
```

## Consequences

### Positive

* Requirement engineering regression remains stable.
* Writer remediation can be evaluated against an unchanged upstream baseline.
* Known Gold defects are no longer silently forgotten.
* Future developers cannot correctly interpret Requirement Eval 100% as proof of perfect Gold quality.
* Historical Requirement Eval runs remain comparable.

### Accepted debt

* Some Requirement Gold annotations remain known to be imperfect.
* Requirement semantic quality is therefore not considered fully human-certified.
* A future targeted Gold remediation remains mandatory before final authority-chain freeze and Production E2E readiness.

## Final Decision

Keep the original Requirement Gold v1.1 unchanged for the current development phase.

Record the known annotation debt.

Continue using v1.1 only as a frozen engineering regression baseline.

Defer creation and activation of a human-audited successor Gold dataset until the downstream Writer and semantic evaluation chains are stable enough to change the evaluation baseline without confounding active production remediation.
