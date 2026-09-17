# V43 Requirement V6.3 Semantic Adjudication

Self-contained GPT review bundle for the 43 non-conflict P0 replay cases. All semantic root causes remain PENDING_GPT. Frozen semantic labels are supplied as adjudication inputs; this bundle creates no new labels.

Use 02_GPT_DECISION_PACKET.json as the primary packet. Every case in that file inlines the frozen atomic requirement, authoritative minimum-support raw source text, relevant Provider input excerpt, raw Provider candidate text (including an explicit empty result where the Provider returned no candidates), normalized candidate text, deterministic canonical-output text projection, canonicalization/source-resolution outcomes, and current mechanical divergence.

The artifacts and evidence folders preserve supporting replay artifacts and restricted evidence. All packet references are repository-relative; no Windows Temp path is required.

Do not infer a semantic root cause from mechanical divergence.
