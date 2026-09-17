# V43_WRITER_ENGINEERING_FULL_CHAIN_AUDIT_CHECKPOINT

This is a read-only engineering audit artifact. It does not alter production
business code, tests, prompts, schemas, migrations, provider configuration, or
database business state.

## Initial checkpoint

- BASELINE: `f5095148b1f2ed2a3ac139c418f3aa7fba03dc3e`
- BRANCH: `feat/v4.3-semantic-boundary-routing`
- HEAD: `f5095148b1f2ed2a3ac139c418f3aa7fba03dc3e`
- WORKTREE: dirty before audit; 304 status entries, 0 staged; preserved
- NODE: `v24.19.0`
- NPM: `11.17.0`
- BACKEND_HEALTH: HTTP 200 at `127.0.0.1:3001/api/health`, database connected
- SEMANTIC_GATEWAY: `127.0.0.1:18080` unavailable during audit; no provider call made
- ENV_TRACKING: `backend/.env` and root `.env` are not tracked
- DIFF_CHECK: exit 0 (line-ending warnings only)

Detailed findings and test evidence are appended as the audit proceeds.

## Final audit checkpoint

### Scope and safety

- MODE: `READ_ONLY`
- PRODUCTION_CODE_CHANGED: `NO`
- TEST_CODE_CHANGED: `NO`
- PROMPT_CHANGED: `NO`
- SCHEMA_CHANGED: `NO`
- MIGRATION_CHANGED: `NO`
- PROVIDER_CALL: `0`
- PRODUCTION_DB_WRITE: `0`
- TEST_DB_WRITES: `YES (isolated PostgreSQL fixtures only)`
- CHECKOUT/MERGE/REBASE/CHERRY_PICK/RESET/CLEAN/STASH/PUSH: `NONE`
- CURRENT_WORKTREE: dirty state preserved; 307 status entries after the
  existing eval result artifacts were created, 0 staged

### Active production path

The canonical HTTP mutation is:

`POST /api/projects/:projectId/document-generations`
→ trusted project authorization
→ `DocumentGenerationService.generate()`
→ V2 gate and input snapshot
→ `DocumentPlan`
→ `WriterGenerationBatchBuilderV2`
→ `batch-generation-router`
→ deterministic template or `WriterProvider.draft()`
→ strict Writer output validation and assertion guard
→ atomic Writer execution persistence
→ strict section assembly/sanitizer/validator
→ atomic `pending_review` DocumentVersion.

Legacy generation routes are guarded by `V43_LEGACY_GENERATION_COMPAT` and
are inactive by default in the server runtime. No legacy result/text/answer
fallback is active in the V2 path. The server wires Writer and Revision from
their separate gateway environment variables; neither falls back to
`DIFY_API_KEY`.

### Authority graph

| Object | Producer | Consumer / gate | Persisted authority |
|---|---|---|---|
| Canonical Requirement | requirement pipeline/backend | DocumentPlan, Writer context | requirement snapshot |
| Response Plan | backend deterministic planner | DocumentPlan/batch builder | plan snapshot |
| Claim | backend claim builder + Claim Gate | current allow gate / safe context | claim + gate identity |
| Enterprise Evidence/Fact | reviewed services | input gate, safe context | lineage, approval, fact state |
| Mapping | Evidence Review / Claim Gate | evidence-support claims | mapping + evaluation |
| Writer Authorization | `WriterInputAuthorizationService` | safe context and currentness checks | safe-context hash/version |
| Writer output | Writer Provider or deterministic template | strict contract, guard, validator | task/output/mentions |
| DocumentVersion | backend finalizer | human review | atomic `pending_review` version |

The Writer cannot grant claim permission, approve evidence/mapping, mutate
requirements, or finalize a document. Enterprise facts without a current
allow evaluation are blocked from assertable context; pending facts are
context-only and null-valued.

### Confirmed findings

#### WRITER-ENG-001 — P1

**Requirement-response Claim lacks v2 gate projection and is dropped before
V2 routing.**

`ProductionBetaService.generateClaims()` preserves `requirement_response`
items but only creates/persists a v2 gate evaluation for `evidence_support`.
`DocumentGenerationService.generateV2()` therefore sees no current allow
evaluation for a normal persisted requirement-response claim. The safe-context
projection drops that claim, `authorized_project_responses` is empty, and the
batch builder emits no approved claim. The router consequently selects
`semantic_gateway` instead of the eligible `deterministic_template` route.

This was reproduced with a production-shaped approved requirement-response
claim and one empty plan (read-only inline reproduction):

`section_claims=0`, `authorized_project_responses=0`, `batch_claims=0`,
`route.generation_mode=semantic_gateway`.

Impact: an authorized requirement response is silently absent from Writer
input and an unexpected external Writer call may occur. Existing tests inject
a synthetic allow gate result and therefore do not cover this persisted
production shape.

Smallest remediation (not applied in this audit): preserve
`requirement_response` as an explicitly authorized project-response lane (or
persist an equivalent current gate identity) before safe-context projection;
add a real HTTP/DB regression asserting visibility, deterministic routing, and
zero provider calls. Do not grant enterprise-fact authority.

#### WRITER-ENG-002 — P1

**V2 generation identity excludes project-fact/authorization snapshot.**

`generateV2()` hashes only coverage, requirements, plans, claims, evidence,
composition rules, and Writer contract. Facts, bindings, gate results, and
reference authorization are used to construct Writer safe context but are not
part of the idempotency identity. Fact edits invalidate safe contexts/tasks/
outputs, but do not invalidate `document_generations` or versions. Since the
database reuses an active generation for the same
`(project_id,generation_type,input_snapshot_hash)`, a changed approved project
fact can return a stale finalized generation/version on a repeated POST.

Impact: stale authorization/content may be reused after a fact correction;
this violates changed-authorization identity and is a material idempotency
defect.

Smallest remediation (not applied in this audit): include deterministic fact,
binding, gate, and reference authorization identity in the generation snapshot,
or explicitly invalidate generation/version on fact change; add a same-input
versus changed-fact HTTP/DB regression.

### Invariant and gate matrix

| Check | Result | Evidence / scope |
|---|---|---|
| Canonical requirement authority | PASS | V2 gate requires confirmed baseline and writer-eligible categories |
| Evidence approval/lineage gate | PASS | approved formal evidence only; lineage checks in input gate |
| Claim Gate authority | PASS | current allow identity required for assertable enterprise claims |
| Requirement laundering guard | PASS | focused Writer guard tests |
| Enterprise commitment authorization | PASS | blocked without current allow; response-only lane is P1 gap |
| Restricted/rejected preservation | PASS | focused negative controls for status/scope/quantity/authority |
| Claim retention on production-shaped response | FAIL | WRITER-ENG-001 |
| Route authority parity | PASS_WITH_GAP | shared strict guard/validator; pre-route response projection gap remains |
| Batch completeness | PASS_WITH_GAP | builder tests pass; upstream response claim loss remains |
| Batch failure/partial failure | PASS | failed task fails generation, no version |
| Section order/assembly | PASS | strict planned-section merge, duplicate/missing/unknown rejection |
| Sanitizer/validator | PASS | V2 finalization blocks critical validation errors |
| Revision policy | PASS | no automatic V2 revision; inactive legacy path only |
| Writer execution persistence | PASS | PostgreSQL atomic transaction and current-safe-context check |
| Finalization transaction | PASS | generation/version atomic transaction, pending_review output |
| Idempotency on unchanged input | PASS | unique active snapshot identity |
| Idempotency after fact/authorization change | FAIL | WRITER-ENG-002 |
| Concurrency bound | PASS | bounded pool, max 3; no cartesian call expansion |
| Retry policy | PASS | no automatic V2 retry; one explicit manual retry only |
| Cross-project isolation | PASS | HTTP authorization and PostgreSQL integration coverage |
| Mention ledger/lineage | PASS_WITH_SCOPE | task/output/mentions persisted; deterministic route has no Writer output task |
| Secret safety | PASS | env files untracked; safe audit fields; no raw payload logging |
| Context/token budget | PASS | budget estimate, max sections, fail-closed over-budget behavior |
| Cross-section leakage | NOT_FULLY_VERIFIED | no dedicated concurrent/cross-section negative control |
| Stale authorization race | NOT_FULLY_VERIFIED | currentness checked before persistence, after provider call |
| External error classification | PASS | safe error codes/messages and no retry/fallback |
| Legacy drift | PASS | legacy compat inactive by default |

### Production-shaped routing result

- SIMPLE_ROUTE_EXPECTATION: `FAIL for normal persisted requirement_response`
- COMPLEX_ROUTE: `semantic_gateway` only when enriched context remains
- DETERMINISTIC_TEMPLATE: implementation is present and tested, but the
  ordinary requirement-response production shape is currently unreachable due
  to WRITER-ENG-001
- CALL_EXPLOSION: bounded by batch pool and one call per semantic batch
- PROVIDER_FIDELITY_READINESS: `BLOCKED` by both P1 findings

### Test and evaluation evidence

| Command / suite | Result | Network / provider |
|---|---|---|
| Focused Writer/authority suites (8 files) | 132 pass, 0 fail | no network; 0 provider calls |
| `npm run eval:writer-fast-gate -w backend` | PASS, 8/8 | no network; provider_calls=0 |
| deterministic/mapping/claim integration | 17/17 PASS | isolated DB; no provider |
| `npm run eval:claim -w backend` | PASS, 24 cases; db_gate NOT_EXECUTED | no provider; produced existing eval result artifacts |
| `npm test -w frontend` | 51/51 PASS | no network |
| `npm run test:postgres -w backend` | 56/56 PASS | isolated PostgreSQL writes; no provider |
| `npm test -w backend` | 1112 pass, 7 pre-existing failures, 1119 total | no provider; same historical baseline |
| `npm run eval:requirements -w backend` | PASS; recall/precision/source verified 100% | no provider |
| `npm run build` | PASS | no network |
| `npm run lint` | PASS | no network |
| `git diff --check` | PASS (line-ending warnings only) | local |

The seven backend failures are unchanged historical governance/eval baseline
failures and are unrelated to Writer changes: Parity review wording,
canonical input parity, cross-run identity certification, extraction audit
unknown gold metrics, frozen Gold source-span routing, DS Flash decision
record, and project-instructions routing.

### Runtime and database evidence

- `GET /api/health`: HTTP 200, database connected.
- Semantic Gateway `127.0.0.1:18080`: unavailable during audit; no external
  model invocation was attempted.
- Dedicated `writer-db-gate` script: absent. Database evidence is supplied by
  PostgreSQL integration (56/56), including atomic persistence/finalization,
  idempotency, concurrency, stale-context, and cross-project cases.
- Production PostgreSQL business writes: none.
- No live provider, Dify, Writer, or Revision calls.

### Audit status

- P0 FINDINGS: `0 confirmed`
- P1 FINDINGS: `2 confirmed` (`WRITER-ENG-001`, `WRITER-ENG-002`)
- P2 / verification gaps: cross-section leakage, stale-auth race, and absence
  of a dedicated DB-gate command; these are not promoted to confirmed P1/P0
  without a production-entry regression.
- FAST_GATE_AUDIT: `PASS`
- DATABASE_GATE_AUDIT: `PASS_VIA_POSTGRESQL_INTEGRATION`
- EVAL_PRODUCTION_PARITY: `PASS_WITH_SCOPE` (shared canonical guard/validator
  modules plus service-composition tests; no eval-only authority)
- WRITER_ENGINEERING_FULL_CHAIN_AUDIT: `REMEDIATION_REQUIRED`
- WRITER_PROVIDER_FIDELITY_READINESS: `BLOCKED`
- WRITER_MODULE_PRODUCTION_READY: `NOT_CLAIMED`

### Preservation and handoff

No business source, requirement, claim, evidence, project fact, provider
configuration, test code, production code, prompt, schema, migration, or
database business state was modified. The audit artifacts created/updated are
checkpoint and existing eval-result outputs only. Before any remediation,
add the two production-entry regressions above and re-run the full authority,
database, and provider-fidelity gates on the authoritative branch.

CHECKPOINT: `V43_WRITER_ENGINEERING_FULL_CHAIN_AUDIT_CHECKPOINT`
FINAL_VERDICT: `WRITER_ENGINEERING_AUDIT_REMEDIATION_REQUIRED`

### Required named outputs

- REQUIREMENT_LAUNDERING_PRODUCTION_PATH: `PASS`
- PROJECT_COMMITMENT: `PASS` (requirement response is not enterprise capability)
- RESTRICT_PRESERVATION_MATRIX: `PASS` for product, geography, validity,
  protocol/capability, quantity, and status expansion negatives
- AUTHORIZED_CLAIM_RETENTION: `FAIL` in the persisted production-shaped
  requirement-response case (WRITER-ENG-001)
- FACT_TO_WRITER_ASSERTION_BYPASS: `0`
- MAPPING_TO_WRITER_ASSERTION_BYPASS: `0`
- REFERENCE_BOUNDARY: `PASS` (`CONTEXT_ONLY` in deterministic and Provider routes)
- STALE_WRITER_AUTHORIZATION: `NOT_FULLY_VERIFIED`; currentness is checked at
  persistence, but no concurrent invalidation/Provider-entry regression exists
- DETERMINISTIC_PROVIDER_PARITY: `PASS_WITH_SCOPE`; both routes share canonical
  authorization/guard/validator modules, while pre-route response projection is
  the P1 gap
- ROUTING: `FAIL` for the ordinary persisted requirement-response shape;
  enriched batches correctly use `semantic_gateway`
- BATCH_COMPLETENESS: `PASS_WITH_GAP`; builder preserves its supplied inputs,
  but WRITER-ENG-001 removes a requirement-response claim upstream
- BATCH_FAILURE: `PASS`; one failed task prevents finalization/version creation
- ASSEMBLY: `PASS` (`missing=0`, `duplicate=0`, `unknown=0` enforced)
- SECTION_ORDER: `PASS`; deterministic DocumentPlan order, not completion order
- CROSS_SECTION_LEAKAGE: `NOT_FULLY_VERIFIED`
- GUARD: `PASS`; output guard enforces status/scope/entity/quantity/validity/
  protocol/SLA/third-party/delivery/requirement-laundering boundaries
- SANITIZER: `PASS` (deterministic cleanup only)
- VALIDATOR: `PASS` (final safety/contract enforcement, no regeneration)
- REVISION_POLICY: `PASS`; automatic V2 LLM revision disabled
- PERSISTENCE_TRANSACTION: `PASS`
- FINALIZE_TRANSACTION: `PASS`
- IDEMPOTENCY: `FAIL` after changed project-fact/authorization identity
  (WRITER-ENG-002); unchanged snapshot replay is stable
- CONCURRENCY: `PASS` within bounded pool and PostgreSQL checks
- RETRY: `PASS`; no automatic V2 retry, one bounded explicit manual retry
- CROSS_PROJECT: `PASS`
- AUDIT_IDENTITY: `PASS_WITH_GAPS`; safe provider/task metadata, hashes,
  request identity and usage are retained; V2 semantic path does not write the
  separate external-writer lifecycle table
- LINEAGE: `PASS_WITH_SCOPE`; DB task/output/mention/generation/version and
  claim/gate identities are traceable; deterministic template has no Provider
  output task by design
- MENTION_LEDGER: `PASS`
- SECRET_SAFETY: `PASS`; no tracked env, key, Authorization header, full prompt,
  or raw Provider response in audit artifacts
- TOKEN_BUDGET: `PASS`
- PERFORMANCE: `NO_PROVEN_P1`; bounded sections/calls and budget checks; no
  measured N+1 or lock-duration defect promoted
- HTTP_PRODUCTION_COMPOSITION: `PASS_WITH_GAP`; canonical route,
  authorization, failure, duplicate, and negative coverage exists, but no
  persisted requirement-response regression
- FAST_GATE_AUDIT: `PASS` (8/8, provider_calls=0)
- DB_GATE_AUDIT: `PASS_VIA_POSTGRESQL_INTEGRATION`; dedicated
  `writer-db-gate` command is not present
- EVAL_PRODUCTION_PARITY: `PASS_WITH_SCOPE`; no eval-only authority, with the
  production-composition gap recorded above
- PROVIDER_FIDELITY_READINESS: `BLOCKED`
- ERROR_CLASSIFICATION: `PASS`
- STATE_MACHINE: `PASS_WITH_RECOVERY_GAP`; terminal failure and finalize gates
  are explicit; no dedicated stale-running recovery proof
- LEGACY_DRIFT: `PASS`; legacy helpers remain isolated behind inactive compat

### Critical invariants

| ID | Invariant | Result |
|---|---|---|
| I01 | ACTIVE_WRITER_PRODUCTION_PATH_COUNT = 1 | PASS |
| I02 | REQUIREMENT_LAUNDERING = 0 | PASS |
| I03 | FACT_TO_WRITER_ASSERTION_BYPASS = 0 | PASS |
| I04 | MAPPING_TO_WRITER_ASSERTION_BYPASS = 0 | PASS |
| I05 | STALE_AUTHORIZATION_USE = 0 | NOT_VERIFIED (race coverage gap) |
| I06 | RESTRICT_CONDITION_LOSS = 0 | PASS |
| I07 | AUTHORIZED_CLAIM_SILENT_LOSS = 0 | FAIL (WRITER-ENG-001) |
| I08 | ROUTE_AUTHORITY_PARITY | PASS (shared downstream authority) |
| I09 | FAILED_BATCH_FINALIZATION = 0 | PASS |
| I10 | ASSEMBLY_MISSING = 0 | PASS |
| I11 | ASSEMBLY_DUPLICATE = 0 | PASS |
| I12 | ASSEMBLY_UNKNOWN = 0 | PASS |
| I13 | CROSS_PROJECT_LEAKAGE = 0 | PASS |
| I14 | WRITER_PERSISTENCE_ATOMICITY | PASS |
| I15 | FINALIZE_CONSISTENCY | PASS |
| I16 | GENERATION_IDEMPOTENCY | FAIL after changed authorization identity |
| I17 | CONCURRENCY_SMOKE | PASS |
| I18 | EVAL_PRODUCTION_AUTHORITY_PARITY | PASS_WITH_SCOPE |
| I19 | PROVIDER_CALL_INSIDE_DB_TRANSACTION = 0 | PASS |

### Edge-by-edge authority / fail-closed summary

1. HTTP → ProjectAuthorization: trusted server actor and project-scoped
   permission; missing/foreign actor fails before mutation.
2. ProjectAuthorization → GenerationService: canonical route only; absent
   project/baseline/mandatory approval fails closed.
3. Generation snapshot → Requirement/Plan/Claim inputs: backend-owned snapshot;
   ineligible categories and missing approved mandatory claims block.
4. Claim Gate → WriterInputAuthorization: current allow, assertion hash, gate
   identity, snapshot hash, writer eligibility and current lineage are required.
5. Authorization → Safe Context: only current allow claims are assertable;
   pending/claim-required facts are context-only or blocked.
6. Safe Context → Writer Task: hashes and authorized reference IDs are bound;
   current-safe-context is checked before persistence.
7. Writer Task → Router: deterministic predicate is strict; otherwise exactly
   one semantic batch call is allowed; over-budget input fails closed.
8. Router → Provider/template: template has no Provider call; Provider route
   receives strict task contract and separate Writer gateway configuration.
9. Output → Guard/Mention: unauthorized refs, authority expansion,
   requirement laundering, and stale hashes fail closed.
10. Sections → Assembly/Sanitizer/Validator: planned IDs must match exactly;
    structural and safety failures block finalization.
11. Finalizer → PostgreSQL: task/output and generation/version writes use
    owning-service atomic boundaries; final version is `pending_review`.

### Final test matrix and global baseline

- FOCUSED_TESTS: `132 pass / 0 fail`
- WRITER_FAST_GATE: `8/8 PASS`, Provider calls `0`
- DETERMINISTIC/MAPPING/CLAIM_INTEGRATION: `17/17 PASS`
- POSTGRES: `56/56 PASS` (isolated fixtures; production writes `0`)
- BACKEND: `1112 pass / 7 fail / 1119`; the same seven pre-existing governance,
  runtime, and evaluation failures as the prior checkpoint; no new Writer test
  failure
- FRONTEND: `51/51 PASS`
- REQUIREMENT_EVAL: `PASS` (Recall 100%, Precision 100%, Source Verified 100%)
- BUILD: `PASS`
- LINT: `PASS`
- DIFF_CHECK: `PASS` (LF/CRLF conversion warnings only)
- ROOT `npm test`: `FAIL` only because backend terminates on the same seven
  pre-existing failures; frontend was independently `51/51 PASS`
- GLOBAL_FAILURE_BASELINE: unchanged seven tests; no Writer regression added

### Changed files and safety handoff

- AUDIT_ARTIFACT: `backend/eval/rag-pilot/results/overnight/10_writer_engineering_full_chain_audit_checkpoint.md`
- EVAL_ARTIFACTS: existing claim-eval result JSON/Markdown emitted by the
  repository eval command; no source/test code was edited
- CHANGED_PRODUCTION_FILES_BY_THIS_AUDIT: `0`
- CHANGED_TEST_FILES_BY_THIS_AUDIT: `0`
- CHANGED_PROMPTS/SCHEMAS/MIGRATIONS_BY_THIS_AUDIT: `0`
- SECRET_FILES_TRACKED: `0` (`backend/.env` and root `.env` remain untracked)
- WORKTREE: intentionally dirty and preserved; no staging or destructive Git
  operation performed

FINAL CHECKPOINT: `V43_WRITER_ENGINEERING_FULL_CHAIN_AUDIT_CHECKPOINT`
FINAL VERDICT: `WRITER_ENGINEERING_AUDIT_REMEDIATION_REQUIRED`
WRITER_PROVIDER_FIDELITY_READINESS: `BLOCKED`
WRITER_MODULE_PRODUCTION_READY: `NOT_CLAIMED`
