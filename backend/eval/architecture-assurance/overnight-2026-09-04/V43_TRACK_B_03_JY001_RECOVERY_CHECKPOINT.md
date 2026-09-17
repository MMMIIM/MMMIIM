# V43 Track B — JY-001 Forensic Recovery

**Tender:** `JY-001`  
**Title:** 江阴市国有企业集中采购  
**Mode:** READ_ONLY / EVAL_ONLY / NO_PROVIDER / NO_REEXTRACTION

## Identity evidence

- Raw source: `backend/eval/tender-benchmark-v1/sources/JY-001-jiangyin.pdf`.
- Official source type: `PUBLIC_RESOURCE_TRADING_CENTER`; census marks the source verified.
- Declared and current source SHA: `bd82077bc2f3801e1323c5fb4266169905a95d0ab86448346eabe0b4dd4c3145` (match).
- Current Source Foundation record: `packet_available=false`, `packet_requirement_count=0`, `packet_file=null`, `packet_hash=null`.

## Candidates found

Historical read-only reports reference the same source identity and a prior production-shaped snapshot:

- `backend/eval/reports/jiangyin-extraction-defect-packet-v2.json`: `evaluation_only=true`, project `112b3805-df67-4483-b1aa-c8941a111465`, parse job `7ffedbae-4381-4d6b-90dc-9bc77c444d07`, canonical count 221, source hash matches, independent Gold unavailable, case-level evidence false, production state mutated false.
- `backend/eval/reports/jiangyin-ambiguity-prevalence-v1.json`, `jiangyin-full-requirement-rag-fitness-v1.json`, and `jiangyin-source-traceability-gate-v1.json`: historical Eval/fitness reports; they do not provide a frozen Source Foundation packet or a human-authority packet link for JY-001.
- Git history/object search found historical JY runner/test paths only; no JY-001 frozen packet, source manifest, or adjudication packet.

Identity graph therefore ends at:

```text
JY-001 -> JY-001-jiangyin.pdf -> source SHA (confirmed)
      -> historical production/Eval snapshot (non-authoritative)
      -X-> frozen packet / source-audit authority / human authority
```

## Classification

- **Primary classification:** `E — ONLY_NON_AUTHORITATIVE_ARTIFACT_EXISTS`.
- **Source hash status:** raw source parity `SOURCE_HASH_PARITY_PASS`; packet hash `SOURCE_HASH_UNAVAILABLE`.
- **Human authority status:** `NOT_FOUND_IN_CURRENT_ARTIFACT_UNIVERSE`.
- **Identity confidence:** source identity `CONFIRMED`; authority identity `UNKNOWN`.
- **RECOVERABLE_WITHOUT_REEXTRACTION:** `NO` (the required authority and Requirement identity packet are absent).
- **HUMAN_REVIEW_REQUIRED:** `YES`.
- **REEXTRACTION_REQUIRED:** `NOT_YET_AUTHORIZED`; do not infer that a rerun is necessary or sufficient.

The 221-record historical canonical snapshot must not be promoted to the six-Tender frozen Source Foundation or Gold. No source text, Requirement, or human label was reconstructed.

**Provider/LLM calls:** 0  
**Production DB writes:** 0  
**Production code changes:** 0  
**Gold mutations:** 0
