# V43 Fact Candidate v2 Identity / Contract Checkpoint

- Model identity root: `OTHER_EXACT_CAUSE`
- Configured / resolved / dry request model: `deepseek-v4-pro`
- Historical success-log model: `deepseek-v4-flash`
- Exact historical request/response model pairing: unavailable; live identity remains blocked.
- Current gateway reload: PASS; `/ready` PASS; v2.1 task registered; endpoint `/responses`.
- Candidate v2.1 schema/prompt: `4.3-evidence-fact-candidate-v2.1` / `4.3-evidence-fact-candidate-v2-prompt-v2`.
- Source text in model contract: removed; source refs are resolved by the Backend against the frozen snapshot.
- Model-facing shape: max nesting 6, optional properties 0, union constructs 0.
- Focused offline tests: **75/75 PASS**, Provider calls 0.
- Live 4-case canary: not run; blocked by unresolved historical model-identity conflict.
- Side effects: production DB writes 0, Fact persistence 0, Gold mutations 0, Mapping/Claim/Writer actions 0.

See the JSON checkpoint for the complete version/hash and telemetry record.
