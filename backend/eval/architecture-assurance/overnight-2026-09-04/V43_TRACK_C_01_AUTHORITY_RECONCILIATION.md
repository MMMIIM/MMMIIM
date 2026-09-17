# V43 Track C — Authority Reconciliation

**Phase:** `TRACK_C_AUTHORITY_RECONCILIATION`
**Mode:** read-only / eval-only / forensic decision support
**Branch:** `feat/v4.3-semantic-boundary-routing`
**HEAD:** `f5095148b1f2ed2a3ac139c418f3aa7fba03dc3e`

## Safety and baseline

This checkpoint was produced from the existing Track A and Track B artifacts
only. No Provider, Dify, LLM, Requirement extraction, Fact/Mapping/Claim
creation, production database write, production-code change, Gold mutation, or
Git history operation was performed. The pre-existing dirty worktree was not
overwritten.

| Field | Result |
|---|---|
| `TRACK_C_STATUS` | `DECISION_SUPPORT_COMPLETE_BLOCKED` |
| `BASELINE_DRIFT` | `NO` |
| `PROVIDER_CALLS` | `0` |
| `PRODUCTION_DB_WRITES` | `0` |
| `PRODUCTION_CODE_CHANGES` | `0` |
| `GOLD_MUTATIONS` | `0` |
| `WORKTREE_PRESERVED` | `YES` |

Evidence read:

* Track A: `V43_P0_RAG_MATERIAL_AUTHORITY_FAIL_CLOSED_ROOT_CAUSE_CHECKPOINT.md`
  and its four supporting forensic/runtime/negative-control/reconciliation
  artifacts.
* Track B: `V43_TRACK_B_SIX_TENDER_AUTHORITATIVE_ARTIFACT_RECOVERY_MASTER_CHECKPOINT.md`
  plus the known-good and three recovery checkpoints.
* Source foundation: `backend/eval/gold-human-review/v2/mapping-real-rebuild/07_real_requirement_source_universe_v2.json`.

## 1. Track A reconciliation

| Authority surface | Production enforcement | Eval/source-role projection | Reconciliation |
|---|---|---|---|
| Material | The owning quarantine transition uses the centralized Material Authority Gate. | 4 materials are projected as `QUARANTINED`; other corpus rows are role projections, not production lifecycle. | `PARTIAL`; downstream propagation is not uniform. |
| Retrieval | New retrieval is gated by active material; historical `getRetrievalRun` reload lacks the lifecycle predicate. | Source-role reports retain historical retrieval rows for audit. | `BYPASS_FOUND`; not a blanket quarantine failure. |
| Fact | Canonical Fact approval is fail-closed, but draft/legacy Fact paths remain open. | Fact reports contain synthetic and historical candidate results, not automatic real authority. | `PARTIAL`. |
| Mapping | Canonical V1.1 owner is fail-closed; a legacy decision path is a separate bypass. | Gold packets and projections are immutable Eval artifacts. | `FAIL_CLOSED` for canonical owner; legacy bypass remains. |
| Claim | Canonical Claim support and Claim Gate are fail-closed. | Claim Gold/eval artifacts remain separately governed. | `FAIL_CLOSED` on canonical path. |
| Writer exposure | Canonical assertable enterprise claims currently have zero quarantined exposure. | Writer semantic and engineering fixtures are separate denominators. | `ZERO` canonical exposure; Provider fidelity is not established. |

The Track A root cause remains `D — PARTIAL_PRODUCTION_ENFORCEMENT` and
`P0_RAG_001_FINAL_CLASSIFICATION=P1_GOVERNANCE_GAP`. A single shared Material
Authority Gate should be reused, with currentness/lineage predicates retained
as defense-in-depth at reload, review, Fact, and Mapping boundaries.

## 2. Real Enterprise Evidence / Fact authority

The repository does not currently prove an independent, current, human-
adjudicated Real Enterprise Fact authority. The following are the observed
families; classification is conservative and does not promote historical
candidate seeds.

| Source/fact family | Classification | Evidence observed | Authority conclusion |
|---|---|---|---|
| Four Neusoft public-material rows and their 81-chunk/Fact lineage | `E QUARANTINED` | Source files exist and metadata-only public inventory rows exist, but current DB projection is `QUARANTINED`; source type/authority is not bound to a current production-authorized material. | Cannot qualify as current Real Enterprise Fact. |
| `real-derived-gold-v1.json` (12 accepted Eval cases) | `E QUARANTINED` (real-derived Eval, not production authority) | `REAL_DERIVED_EVAL`, user-provided adjudication fields, and Fact source metadata point to the quarantined Neusoft materials. | Eval labels remain auditable; they do not establish independent Real Fact Gold authority. |
| Representative SME corpus (16 enterprise-evidence materials/facts) | `C SYNTHETIC` | Explicit `REPRESENTATIVE_SYNTHETIC / NOT_REAL_CUSTOMER_DATA`; fictional 澄明数科 corpus. | Synthetic only; never Real Enterprise Fact. |
| Official/general/industry corpus (34 reference rows) | `D REFERENCE_ONLY` | `REFERENCE_CONTEXT_ONLY`, official or industry guidance. | Can inform context; cannot prove bidder capability. |
| Enterprise source candidate manifest (7 candidates) | `F PROVENANCE_INCOMPLETE` | `NOT_IMPORTED`, `NOT_CAPTURED`, null source snapshot/hash/URL/identity. | Candidate discovery only; no Fact authority. |
| Two `UNKNOWN_REVIEW_REQUIRED` material rows and historical seed artifacts | `G UNKNOWN` | Missing/ambiguous source metadata or legacy candidate-only records. | Must remain unresolved/candidate. |

`REAL_ENTERPRISE_FACT_AUTHORITY_READY=NO`. Approval/status fields alone do not
override quarantine, missing source snapshots, synthetic classification, or the
absence of independent human Fact adjudication.

## 3. Requirement authority matrix

Track B confirms the raw source identity for all six PDFs. Only three have the
known-good packet pattern. Packet existence is not treated as human authority:
the packet contract has no independent adjudication field, and the shared
199-item adjudication artifact is structurally certified but freeze-blocked by
one critical omission.

| Tender | Source exists | SHA verified | Authoritative packet | Human authority proven | Requirement authority ready |
|---|---|---|---|---|---|
| `FAST-01` | YES | YES (`80484853…00d92c29`) | YES; 39 requirements | `UNKNOWN / NOT_PROVEN` | NO — independent authority linkage absent |
| `TB-006` | YES | YES (`b714d521…2793480`) | YES; 46 requirements | `UNKNOWN / NOT_PROVEN` | NO — independent authority linkage absent |
| `FAST-WATER-01` | YES | YES (`15f92c3a…9a419535`) | YES; 114 requirements | `UNKNOWN / NOT_PROVEN` | NO — independent authority linkage absent |
| `JY-001` | YES | YES (`bd82077b…4c3145`) | NO | NOT FOUND | NO — raw-only; historical Eval is evaluation-only |
| `TB-003` | YES | YES (`bec5b3ea…fb7147b1`) | NO | NOT FOUND | NO — raw-only |
| `FAST-04` | YES | YES (`7201d965…bcbbce`) | NO | NOT FOUND | NO — raw-only |

For `JY-001`, `TB-003`, and `FAST-04`, Track B records
`E_ONLY_NON_AUTHORITATIVE_ARTIFACT_EXISTS`, `RECOVERABLE_WITHOUT_REEXTRACTION=NO`,
and `HUMAN_REVIEW_REQUIRED=YES`. Re-extraction is not authorized.

## 4. Mapping prerequisites

* Canonical Requirement identity is deterministic in the source-foundation
  resolver (`tender_id:gold_id` for Eval source records) and packet source
  spans retain source hashes.
* Canonical Fact identities and the Mapping V1.1 support/dimension taxonomy
  exist in Eval artifacts, but Fact authority is not established for the real-
  derived rows because their source materials are quarantined and the Fact
  pipeline still has partial legacy enforcement.
* Blind Mapping source packets and Gold governance ADRs exist. They do not
  constitute a promotion decision; semantic certification and source parity
  gates remain prerequisites.
* Human adjudication capability exists, but no independent human-authority
  proof is attached to each known-good Tender packet in the current resolver
  contract.

## 5. Gold entry analysis

### PATH A — three known-good Tenders

`FAST-01`, `TB-006`, and `FAST-WATER-01` have matching raw source hashes,
resolver-discoverable frozen packets, source spans, and source-audit linkage.
They still fail the complete dependency chain because Requirement human
authority is `NOT_PROVEN`, Real Enterprise Fact authority is `NO`, and the
canonical/legacy quarantine transition controls have open P1 gaps. Therefore
PATH A is **NOT_YET**, not a currently valid Real Mapping Gold path.

### PATH B — six Tenders

The three additional Tenders have no authoritative packet, manifest linkage,
or human authority. Raw source parity cannot substitute for a Requirement
packet. Historical JY-001 reports are explicitly evaluation-only. PATH B is
**NO** under the current evidence.

### Minimal valid path

`MINIMAL_VALID_ENTRY_PATH=NEITHER_PATH_CURRENTLY_VALID`.

Neither path currently satisfies:

```text
Authoritative Tender Requirement
 + independent Real Enterprise Evidence/Fact authority
 + canonical identities
 + human Mapping adjudication
 + Gold governance promotion gates
```

The eventual smallest scope may be the three known-good Tenders after all
prerequisites are supplied, but that conditional future option is not a present
authorization.

## 6. RAG P1 remediation boundary (decision only)

| Surface | Before Real Fact Gold | Before Real Mapping Gold | Classification |
|---|---|---|---|
| Historical Retrieval reload | Required | Required | Add the shared active-material predicate to reload/currentness paths. |
| Review context/proposal/decision | Required | Required | Reject stale/quarantined candidates at every review transition. |
| Canonical Fact draft/edit and legacy Fact writes | Required | Required | Preserve lineage/currentness and prevent draft/legacy rows from becoming authority. |
| Legacy `evidence_facts` / `requirement_evidence_mappings` writes | Required where they can feed Facts | Required | Close the legacy predicate bypass; do not add a second lifecycle. |
| Canonical Claim/Writer paths | Can defer further behavior changes | Can defer after transition tests | Current canonical paths are fail-closed; keep regression coverage. |

This is a governance remediation boundary, not an implementation authorization.

## 7. Human decisions required

Codex cannot decide any of the following:

1. Whether `JY-001`, `TB-003`, or `FAST-04` should be rebuilt from source.
2. Whether a controlled three-Tender benchmark is acceptable as an interim
   benchmark after authority evidence is attached.
3. Which enterprise source snapshot is acceptable as Real Evidence and which
   Fact interpretation is authoritative.
4. Which Requirement semantic interpretation is Gold for each Tender.
5. Which Requirement × Fact Mapping interpretation is Gold.
6. Whether quarantined Neusoft material may be re-authorized after independent
   source/identity review.

## 8. Final decision matrix

| Decision | Current state | Blocking dependency | Owner |
|---|---|---|---|
| RAG P1 remediation | `SAFE_TO_RUN=YES` (decision approved; not executed here) | Owner-approved implementation and transition tests | Engineering + Human authority |
| Real Enterprise Fact Gold | `BLOCKED` | Independent source snapshot, enterprise identity, currentness, lineage, and human Fact adjudication | Human Gold authority |
| 3-Tender Mapping Gold | `NOT_YET` | Requirement human authority, Real Fact authority, and promotion gates | Human Gold authority + Engineering |
| 6-Tender Mapping Gold | `BLOCKED` | Three missing authoritative packets plus human authority for all six | Human Gold authority |
| Requirement rebuild for missing 3 | `NOT_AUTHORIZED` | Explicit Human decision and controlled packet delivery | Human |
| Claim Gold | `DEFERRED / BLOCKED` | Real Fact/Mapping authority and Claim Gold governance | Human Gold authority |
| Writer Gold | `DEFERRED / NOT_ESTABLISHED` | Provider fidelity Gold and upstream real authority | Human Gold authority |

## 9. Final fields

```text
TRACK_C_FINAL_VERDICT=NO_REAL_MAPPING_GOLD_PATH_YET
SAFE_TO_RUN_P1_RAG_REMEDIATION=YES
SAFE_TO_QUALIFY_REAL_FACTS=NO
SAFE_TO_REOPEN_REAL_MAPPING_GOLD=NO
SAFE_TO_REEXTRACT_MISSING_TENDERS=NO
SAFE_TO_CREATE_MAPPING_GOLD=NO
```

No Real Mapping Gold, Real Enterprise Fact Gold, Claim Gold, or Writer
production-readiness claim is made by this checkpoint.
