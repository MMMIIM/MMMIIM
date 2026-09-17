# V43 P0 Failure Trace Checkpoint

- Run ID: V43-CORE6-20260911
- Frozen source truth: docs/eval/p0-recall/GPT_SOURCE_TRUTH_P0_CORE6_V1.json
- Frozen source truth SHA256: 9337ecac323176ddcdf70a6012f522d24cc7d1930765290300bcc0d1d540cba0
- Frozen atoms: 487; unique atom IDs: 487
- Production export identity: PASS (six exports, run_id V43-CORE6-20260911, source SHA matched current PDFs)

## Mechanical trace summary

- Production source lineage found on atom page: 472/487
- No persisted production source lineage link: 15/487
- Canonical records mechanically linked: 472/487 atoms; 5286 linked records
- Link method counts: normalized exact substring 32; shared n-gram 335; same-page span only 105; no persisted source link 15
- Canonicalizer exclusion warnings observed: 66

## Evidence gaps

- Raw provider input and raw provider response are not persisted in the current production exports; each affected trace record is marked EVIDENCE_NOT_PERSISTED.
- Raw pre-canonical candidate records are not persisted; only aggregate candidate counts and canonicalization warnings are available.
- Atom-page source lineage not mechanically linked: 15
- Chunk/source span not observable for atoms without persisted lineage: 15
- Canonical requirement hash not persisted: 472

## Safety and scope

- Provider calls added: 0
- LLM calls added: 0
- Production DB writes: 0
- Gold mutations: 0
- Semantic labels, Recall, and any semantic match/miss classification were not calculated or selected.

## Final status

READY_FOR_GPT_P0_FAILURE_44_ROOT_CAUSE_ADJUDICATION

This checkpoint is evidence assembly only; GPT/Human adjudication is required for semantic root-cause classification.
