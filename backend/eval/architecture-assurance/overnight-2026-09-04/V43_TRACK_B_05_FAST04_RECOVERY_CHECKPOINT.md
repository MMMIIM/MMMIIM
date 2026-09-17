# V43 Track B — FAST-04 Forensic Recovery

**Tender:** `FAST-04`  
**Title:** 北京市发展和改革委员会2026年能力提升软件采购项目  
**Mode:** READ_ONLY / EVAL_ONLY / NO_PROVIDER / NO_REEXTRACTION

## Identity evidence

- Raw source: `backend/eval/tender-benchmark-v1/sources/FAST-04-beijing-software.pdf`.
- Official source type: `GOVERNMENT_PROCUREMENT_SITE`; census marks the source verified.
- Declared and current source SHA: `7201d965541e111ead082ad335aad1b882037650828478778435454129bcbbce` (match).
- Current Source Foundation record: `packet_available=false`, `packet_requirement_count=0`, `packet_file=null`, `packet_hash=null`.

## Forensic search result

The current repository contains no FAST-04 authoritative packet, source-span packet, frozen source manifest entry, case-level adjudication artifact, or Tender-specific Requirement authority export. Git history/object search did not reveal FAST-04 packet bytes; only neighboring FAST-01/FAST-WATER-01 assets and generic runners were found. Those neighboring artifacts cannot be rebound by filename similarity.

Identity graph:

```text
FAST-04 -> FAST-04-beijing-software.pdf -> source SHA (confirmed)
       -X-> FAST-01 packet
       -X-> FAST-WATER-01 packet
       -X-> FAST-04 frozen packet / human authority
```

## Classification

- **Primary classification:** `E — ONLY_NON_AUTHORITATIVE_ARTIFACT_EXISTS` (raw source only).
- **Source hash status:** raw source parity `SOURCE_HASH_PARITY_PASS`; packet hash `SOURCE_HASH_UNAVAILABLE`.
- **Human authority status:** `NOT_FOUND_IN_CURRENT_ARTIFACT_UNIVERSE`.
- **Identity confidence:** source identity `CONFIRMED`; authority identity `UNKNOWN`.
- **RECOVERABLE_WITHOUT_REEXTRACTION:** `NO`.
- **HUMAN_REVIEW_REQUIRED:** `YES`.
- **REEXTRACTION_REQUIRED:** `NOT_YET_AUTHORIZED`.

No FAST-01 or FAST-WATER-01 content is copied, renamed, or treated as FAST-04. No Gold or manifest mutation occurred.

**Provider/LLM calls:** 0  
**Production DB writes:** 0  
**Production code changes:** 0  
**Gold mutations:** 0
