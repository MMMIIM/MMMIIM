# Authority / Invalidation Matrix (Phase 04 input)

| Upstream mutation | Fact | Mapping | Claim/Gate | Writer Auth | Generation reuse |
|---|---|---|---|---|---|
| Material quarantined / lifecycle invalid | source authority query excludes material; fact source authority becomes unusable | candidate builder/query excludes current-authority=false | claim support query requires lineage/current usable | safe context omits blocked facts; stale gate lineage blocks | snapshot/input identity changes only when reloaded; existing generation should not be reused if snapshot changes |
| Material/chunk source hash changes | span/fact current-source hash checks can invalidate review | mapping candidate hash/lineage check excludes stale fact | gate identity stores source hashes/lineage_current | authorization context hash changes when source-derived fact changes | generation identity includes snapshot hashes; lookup behavior depends on persisted input snapshot |
| Fact payload changed/superseded | predecessor invalidated; new version required | mapping rows with old fact payload/version become stale/invalidated | gate identity mismatch / lineage false | writer safe context invalidation helpers target changed gate/fact | generation identity should diverge; no universal DB FK from claim JSON |
| Requirement mutated/invalidated | confirmed baseline is DB-immutable; new baseline is separate | mapping Requirement hash/currentness checks fail | gate identity includes requirement/hash | context requirement projection hash changes | generation snapshot identity diverges |
| Mapping decision/currentness changed | mapping service invalidates obsolete machine mappings | Claim support query requires approved/current mapping | gate evaluation persisted separately; stale mapping should fail lineaged support | safe context only current allow claims | generation snapshot includes claims/evidence; stale lookup relies on hash |
| Claim Gate decision/identity changed | n/a | n/a | `claim_gate_evaluations` identity/currentness and writer invalidation update path | writer contexts can be invalidated on changed gate result | generation input identity includes claim/gate snapshot |
| Project Fact update | new version/supersedes predecessor; propagation plan marks revalidation | n/a | linked Claim revalidation required | propagation invalidates writer contexts/mentions | new generation identity expected |

**Evidence class:** CONFIRMED_BY_CODE and CONFIRMED_BY_SCHEMA for individual gates; end-to-end propagation is PARTIAL/UNKNOWN until runtime DB tests are read.
