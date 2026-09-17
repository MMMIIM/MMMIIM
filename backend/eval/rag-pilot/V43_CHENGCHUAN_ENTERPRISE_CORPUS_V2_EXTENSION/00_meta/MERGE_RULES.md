# Chengchuan Corpus V2 Merge Rules

1. **Do not import the old Xinglan bundle.** Import only this normalized extension bundle.
2. Existing `COM-01`–`COM-16` are the baseline and must not be re-imported.
3. New V2 depth materials use unique `CCV2-*` document IDs.
4. All extension materials use the single synthetic enterprise identity:
   `SYNTH-CHENGCHUAN-001` / `澄川数智科技有限公司（Synthetic Demo Company）`.
5. Never concatenate two source documents into one document.
6. Never auto-merge Facts merely because two documents discuss the same theme.
7. If two documents contain different quantities, versions, validity periods, SLA values, or project statuses, preserve both with their own source/context and route the relationship to review.
8. Historical/current variants are not contradictions by default; they become conflicts only when they claim the same entity + version + scope + time.
9. Requirement IDs and six-tender names are forbidden in source selection and corpus content.
10. This corpus remains `SYNTHETIC_DEVELOPMENT_ONLY`; renaming identity never upgrades authority.
