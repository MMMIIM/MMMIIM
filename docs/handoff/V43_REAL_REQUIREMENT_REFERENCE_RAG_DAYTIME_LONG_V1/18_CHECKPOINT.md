# V43 Real Requirement Reference RAG Daytime Long Checkpoint

Status: BLOCKED_REAL_REQUIREMENT_SOURCE_BREADTH

Real tender source breadth: 0/6 (blocked; Production authority did not expose tender-identifiable Core6 requirements).
Real eval requirements/cases: 0/0.

Writer hygiene: deterministic final projection, 0–4 references, heading/front-matter/citation-index exclusion enforced.
A. WriterReferenceSelector useful-content eligibility: ENFORCED_BY_DETERMINISTIC_CONTENT_GATE.
B. Final reference count may be below 4: YES.
C. HEADING / FRONT_MATTER / citation-index-only slot consumption: PREVENTED.
D. Real tenders entered: 0. E. Real Requirements entered: 0.
F. Production query semantics used: NO (real source breadth gate stopped before query execution).
G. True embedding vectors available: NO. H. R2 true MMR executed: NO.
I. Reference authority escape count: 0.
J. Safe Context lane separation: NOT_EXECUTED_REAL_REQUIREMENT_SOURCE_BREADTH.
K. Embedding provider calls/failures/retries/latency: 0/0/0/none.
L. Production/Eval DB writes: 0/0.
M. Gold/Requirement/Fact/Mapping/Claim/Writer mutations: 0/0/0/0/0/0.
R0 baseline metrics: {"case_count":30,"final_count_distribution":{"4":30},"zero_final_rate":0,"mean_final_count":4,"heading_final_escape":2,"front_matter_final_escape":1,"citation_index_final_escape":23,"wrong_role_or_scope_escape":0,"lineage_completeness_rate":1,"duplicate_escape":2,"same_material_max":4,"unique_material_count_mean":3.2666666666666666,"expected_doc_hit_at_4_count":28,"expected_doc_hit_at_4_rate":0.9333333333333333,"rank_movement_mean":2.2083333333333335}
R1 hygiene metrics: {"case_count":30,"final_count_distribution":{"2":1,"4":29},"zero_final_rate":0,"mean_final_count":3.933333333333333,"heading_final_escape":0,"front_matter_final_escape":0,"citation_index_final_escape":0,"wrong_role_or_scope_escape":0,"lineage_completeness_rate":1,"duplicate_escape":0,"same_material_max":2,"unique_material_count_mean":3.5,"expected_doc_hit_at_4_count":27,"expected_doc_hit_at_4_rate":0.9,"rank_movement_mean":3.2796610169491527}
Final reference count policy: 0–4; fewer than four is allowed and no minimum fill is applied.
Final eligibility excludes heading/front-matter/metadata/citation-index/source-list/empty content; lineage remains available on eligible rows.
Real Requirement source breadth: 0/6 tender-identifiable Production sources; no real Requirement Eval set was constructed.
Query identity, Safe Context dry run, and Embedding retrieval were not executed because the real source breadth gate stopped the real phase.
A14 remains an honest ranking/corpus observation; no semantic improvement is inferred.
R2 true vector MMR: NOT_EXECUTED (raw candidate vectors unavailable).

Safety: provider calls 0; generative calls 0; production DB writes 0; Eval DB writes 0; Gold/Requirement/Mapping/Claim/Writer mutations 0.

Semantic labels and Writer generation were not run. GPT adjudication remains pending.
