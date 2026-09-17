# V43 Chengchuan Enterprise Corpus V2 Extension

This package is the **safe pre-ingestion replacement** for the previously generated but not imported Xinglan bundle.

- Existing Chengchuan baseline already present: 16 synthetic company-case materials (`COM-01`–`COM-16`)
- New normalized extension: 76 materials
- Expected synthetic enterprise total after import: 92
- U01–U34 extension coverage: 34/34
- Cross-theme evidence packages: 8
- Authority: `SYNTHETIC_DEVELOPMENT_ONLY`

Import **only `materials/` + `00_meta/extension_import_manifest.jsonl` from this package**.
Do not re-import COM-01–COM-16.
Do not import the old Xinglan package.

Safety controls:
- Single canonical synthetic enterprise identity: `SYNTH-CHENGCHUAN-001`
- No document concatenation
- No Fact auto-merge
- Numeric/version/currentness variants remain source-isolated
- No six-tender or REQ-driven corpus construction
- No Synthetic → Real authority promotion

See:
- `00_meta/MERGE_RULES.md`
- `00_meta/REAL_FACT_ZERO_AUDIT.md`
- `00_meta/merge_manifest.json`
- `00_meta/MERGE_CHECKPOINT.json`
