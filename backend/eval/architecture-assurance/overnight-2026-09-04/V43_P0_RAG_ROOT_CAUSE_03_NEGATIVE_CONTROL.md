# V43 P0 RAG Root Cause — Negative Controls

These results are an evidence audit, not a new live run. No tests were
executed because the task forbids production database writes and external
calls; statuses below distinguish existing evidence from missing transition
coverage.

| Control | Existing evidence inspected | Status | Limitation |
|---|---|---|---|
| **NC-01** Quarantined Material → new Retrieval = 0 | `backend/integration/material-source-authority-quarantine.integration.js`: quarantine a material, then `listChunksForRetrieval` returns 0; row/chunks retained | **PROVEN** | Covers the new retrieval repository path, not historical run reload. |
| **NC-02** Approved Fact → Material quarantined → current authority false | Same integration’s Neusoft projection checks six canonical Facts have `source_material_authority_eligible=false`/`current_authority=false`; canonical Fact approve branch rejects false authority | **PARTIAL** | No independent test performs the exact quarantine transition after Fact approval and then reloads the row. Draft extraction is not blocked. |
| **NC-03** Approved Mapping → Material quarantined → current authority false | Neusoft integration checks six mappings unusable; canonical mapping `isStale` and V1.1 support projection include source authority | **PARTIAL** | No transition replay test; legacy mapping decision SQL lacks the predicate. |
| **NC-04** Allow Claim → Material quarantined → not authorizable | `listClaims` active query reprojects authority/current/writer flags; canonical Claim Gate requires usable binding and Writer requires current allow/lineage | **PARTIAL** | No transition E2E after a real allow Claim; historical rows remain auditable. |
| **NC-05** New Generation + quarantined lineage → zero assertable claims | `material-source-authority-policy.test.js` excludes a non-current Claim from section context; `listClaims` and writer-safe context contain current/lineage checks | **PARTIAL / NOT_PROVEN** | No full generation transaction against a quarantined transition; coverage snapshots may retain historical coverage rows. |

## Test-level classification

- `material-source-authority-quarantine.integration.js`: PostgreSQL
  integration, with one real repository quarantine/retrieval negative control and
  one persisted Neusoft projection check.
- `material-source-authority-policy.test.js`: unit policy, service ownership,
  section-context negative control and SQL-shape assertions.
- `source-role-projection.test.js`: Eval-only source-role projection and blind
  packet tests; it is not a production lifecycle E2E test.
- `sem-p1-004-canonical-entrypoint.test.js` and its integration matrix:
  canonical Review → Fact → Mapping entry and project authorization, but no
  quarantine transition assertions.
- `requirement-evidence-authority-freeze.test.js`: owner separation and
  canonical support-vs-legacy freeze, not a database lifecycle transition.

Therefore the historical shorthand “Retrieval=0 / Fact=0 / Mapping=0 /
Claim=0 / Writer=0” is proven only at the specific new-retrieval/current-
projection or unit boundary stated above. It is not one end-to-end proof for
all stale reads and legacy mutation surfaces.

## Safety accounting

`PROVIDER_CALLS = 0`  
`PRODUCTION_DB_WRITES = 0`  
`FACT/MAPPING/CLAIM/GOLD_WRITES = 0`  
`PRODUCTION_FILES_CHANGED_BY_THIS_AUDIT = 0`

