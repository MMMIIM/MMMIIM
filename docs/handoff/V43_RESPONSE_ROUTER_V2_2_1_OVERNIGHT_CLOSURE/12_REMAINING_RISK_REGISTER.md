# Remaining risk register

- Risk-tier comparison retains 842 Reference V3 disagreements, including 32 rows mechanically marked as P0/invalidity-tier differences. These are carried as audit evidence; no risk-tier optimization was applied in V2.2.1.
- NEED_REVIEW audit contains 22 rows and remains unadjudicated by Codex.
- Full deterministic replay satisfies V2.1-correct→V2.2.1-wrong = 0, true high-risk evidence false negative = 0, future commitment as existing fact = 0, P0 compliance escape = 0, and GPT overlay mode/dependency mismatches = 0.
- Backend has 29 failures classified as PRE_EXISTING_UNRELATED_BASELINE by identity/signature comparison. PostgreSQL regression is not run without a proven isolated writable database.
- Real Fact V2 eligible candidates remain 0; downstream readiness gates remain closed.
