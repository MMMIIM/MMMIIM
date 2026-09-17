# V43 Writer Overnight — 02 Production Composition Checkpoint

Status: `PRODUCTION_COMPOSITION_PASS`

## Run identity

- phase: `PRODUCTION_COMPOSITION`
- branch: `feat/v4.3-semantic-boundary-routing`
- source HEAD: `f5095148b1f2ed2a3ac139c418f3aa7fba03dc3e`
- provider calls in this phase: `0` (mock/deterministic tests only)
- production writes: `0`

## Deterministic routing

- V2 single-section simple batch: `deterministic_template`
- V2 batch with enterprise/context material: `semantic_gateway`
- V2 batch with approved Evidence, ResponsePlan conditions, or responsibility
  boundaries: `semantic_gateway`; these fields are projected before routing.
- legacy routing tests: `PASS`
- provider call reduction for simple batch: `0 provider calls`
- requirement/claim omission in routing tests: `0`

## Assembly boundary

`mergePlannedSections()` now validates only active planned sections (sections with
requirements) and rejects:

- `ASSEMBLY_INCOMPLETE` for missing generated sections;
- `ASSEMBLY_DUPLICATE` for duplicate section output;
- `ASSEMBLY_UNKNOWN_SECTION` for unplanned output.

V2 finalization converts these failures to a terminal failed generation and does
not create a DocumentVersion.

## Evidence

Focused commands:

- `node --test backend/test/writer-overnight.test.js backend/test/batch-generation-router.test.js backend/test/writer-v2-composition.test.js`
- Result: `43/43 PASS` (including the V2 metadata-projection regression)

## Changed files in this phase

- `backend/src/pipeline/batch-generation-router.js`
- `backend/src/pipeline/writer-generation-batch-builder-v2.js`
- `backend/src/pipeline/document-generation-service.js`
- `backend/test/writer-overnight.test.js`

No Prompt, Provider configuration, Claim/Evidence Contract, migration, or
unrelated module was changed.
