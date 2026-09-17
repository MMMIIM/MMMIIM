# Real Enterprise Source Import Contract V1

This is an Eval-oriented, non-persistent harness. It prepares a mechanically checked source import plan and never creates Material, Chunk, Embedding, Evidence Fact, Mapping, Claim or Writer state.

## Reused production foundations

- CompanyMaterialService remains the only future production import owner.
- Existing extraction, source hash, material chunker and indexing conventions are reused.
- The harness calls the existing deterministic enterprise material chunker only to preview chunk identity.
- No second material store, chunk format, vector index or Fact store is introduced.

## Manifest fields

Required: source_id, enterprise_id, enterprise_name, source_type, material_type, expected_source_authority. A ready snapshot additionally requires source_url, retrieved_at, source organization, immutable snapshot text, source_hash and review metadata.

## Mechanical precheck

The precheck rejects synthetic_test_material, QUARANTINED lifecycle, internal process artifacts, missing enterprise identity and snapshot hash mismatch. A complete source is labelled SOURCE_READY_FOR_GPT_REVIEW, never FACT_READY.

## Enterprise isolation

Every logical source scope has exactly one enterprise_id. Mixed enterprise entries fail with CROSS_ENTERPRISE_CONTAMINATION. Enterprise identity is not inferred from a Requirement or from source text.

## Source snapshot and mutation

The immutable source body, URL, retrieval timestamp, source organization/title and SHA-256 hash are retained. If the same URL later has a different body hash, the old version remains immutable and the importer returns NEW_SOURCE_VERSION_REQUIRED.

## Source-first and review boundary

A source must exist independently before it can be reviewed. The harness does not select Requirements, extract Facts, pair Requirement-Fact records, decide Mapping, or approve any lifecycle object. Later import must call CompanyMaterialService, then extraction/chunk/index paths, followed by GPT/Human Fact review.

## Candidate seed

The companion manifest contains only PENDING_SOURCE_CANDIDATE metadata for seven candidate source classes. URLs and bodies are intentionally null; no direct import or Evidence/Fact assertion is made.
