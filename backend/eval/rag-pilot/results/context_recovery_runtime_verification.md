# V43_CONTEXT_RECOVERY_RUNTIME_VERIFICATION_CHECKPOINT

## IMPLEMENTATION

- component exists: YES
- components: EvidenceSourceContextResolver.resolve and expandEvidenceContext
- bounded rule: same material/document; previous/next one adjacent chunk; each added item bounded by maxContextChars (default 2400); no recursive traversal
- provenance: resolver retains material/chunk IDs, offsets, paragraph bounds, heading path; expansion entries retain origin/chunk_id but not char offsets

## WIRING

Retriever → EvidenceService.createFromRetrieval → EvidenceSourceContextResolver → EvidenceReviewService.propose → expandEvidenceContext → semantic review → review persistence → Fact boundary

- phase: source review / evidence span, before Fact
- raw retrieval remains atomic: YES
- final context expanded: YES when the formal Evidence/Review path is entered
- DB source spans/reviews for these fixtures: 0 / 0 (read-only fixture observation)

## COM-04

- material_id: 2511c8f9-fff1-489d-b385-2ddc522c548c
- actual retrieval final hit: chunk 5, 不代表已对接任何真实政务或医院系统。
- resolved exact span: ## 边界

不代表已对接任何真实政务或医院系统。


- recovered source_chunk_ids: MCH-12DA2A7EF1D137EFB87E1170768F9B31, MCH-99497AE6286B2BAC390E35611FEE3A8A, MCH-1AF2E1849D13143E1105E44079F4463E
- positive capability recovered on actual hit: NO
- negative/boundary sentence retained on actual hit: YES
- boundary treated as positive evidence: NOT THIS LAYER'S RESPONSIBILITY / NOT DETERMINED
- positive-span probe (anchor chunk 3) recovers positive: YES
- positive-span probe recovers boundary sentence: NO
- PASS/FAIL: FAIL for the stated combined-context acceptance; current one-hop expansion cannot retain both bodies from a positive exact span, and does not provide polarity semantics

## GOV-02

- material_id: 08d5580a-d81b-491f-8c9b-d37ca4251840
- actual final hits: chunk 0: # 政务数据目录、共享与跨部门协同；chunk 3: 需明确数据目录、共享属性、使用条件、授权、安全和记录。
- heading/body recovered by production resolver: YES
- resolved context chars: 1113
- source_chunk_ids: MCH-9B1EE59AC49517697E22459FF10EF20E, MCH-F10ED69DC3BF77C66D6A0EA805EC99AA, MCH-10E05647593D617773818984CFB50208, MCH-B7204C620F6A0CF603CEE34E625A583C, MCH-839D2B25854C0D1C9B5BB49408B32F22, MCH-257ECF848FECAB04572BF502D68A1173, MCH-26B5F534B4D5091391A9D8B4EC47FFCB, MCH-1FAE191CF4949121A8D999CFF59DB104
- heading-only final context: NO
- PASS/FAIL: PASS for non-heading-only recovery

## HEADING BEHAVIOR

- Actual: CASE C for the resolver (heading locates a source span containing its body); the expansion helper itself is bounded one-hop behavior.
- GOV-02 top-level heading auto-resolves to its heading group, which includes the body.
- No component assigns semantic polarity; a boundary sentence must be interpreted by the semantic review layer.

## PROVENANCE

- multi-chunk provenance retained: YES at resolver span; expanded context carries chunk IDs
- char bounds retained: YES for resolved span
- paragraph bounds retained: YES for resolved span
- source_chunk_ids complete: YES for resolved span; context entries are chunk-level only

## CALLS

- SiliconFlow embedding: 0
- Provider generation: 0
- DeepSeek: 0
- Dify: 0

## TESTS / GIT

- production component invocation: PASS (read-only DB rows)
- production writes: 0
- DB writes: 0
- commit/push/deploy: NO

## FINAL STATUS

CONTEXT_RECOVERY_USABILITY_FAIL — component exists and is wired post-review/span, GOV-02 is not heading-only, but COM-04 does not satisfy the required combined positive-plus-boundary context/polarity acceptance.
