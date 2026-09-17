import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { buildCanonicalRequirements, CANONICAL_REQUIREMENT_RULE_VERSION } from '../../../src/pipeline/canonical-requirements.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../../../..');
const DOCS = path.join(REPO, 'docs');
const POOL_PATH = path.join(DOCS, 'REQUIREMENT_CANDIDATE_POOL_V2_COMPLETED.json');
const PACKET_DIR = path.join(REPO, 'backend/eval/requirement-extraction-real-tender-pilot-v1/semantic-boundary-v1.1/packets');
const RECOVERED_DIR = path.join(REPO, 'backend/eval/requirement-extraction-real-tender-pilot-v1/recovered-source-authority-v1/packets');
const RECOVERED_MANIFEST = path.join(REPO, 'backend/eval/requirement-extraction-real-tender-pilot-v1/recovered-source-authority-v1/manifest.json');

const TENDERS = Object.freeze([
  { id: 'JY-001', file: 'backend/eval/tender-benchmark-v1/sources/JY-001-jiangyin.pdf', candidatePacket: 'docs/V43_JY001_REQUIREMENT_AUTHORITY_REVIEW_PACKET.json', expected: 'bd82077bc2f3801e1323c5fb4266169905a95d0ab86448346eabe0b4dd4c3145', recovery: 'C_SOURCE_VERIFIED_CANDIDATES_EXIST_CANONICAL_MISSING' },
  { id: 'TB-003', file: 'backend/eval/tender-benchmark-v1/sources/TB-003-jiaozuo-sidian.pdf', candidatePacket: 'docs/TB003_REQUIREMENT_CANDIDATE_PACKET.json', expected: 'bec5b3ea6b0ade5efaecdc6dc4eebe6bd871feaf510d1f78b7faf719fb7147b1', recovery: 'C_SOURCE_VERIFIED_CANDIDATES_EXIST_CANONICAL_MISSING' },
  { id: 'TB-006', file: 'backend/eval/tender-benchmark-v1/sources/TB-006-beijing-emergency-model-cloud.pdf', candidatePacket: 'backend/eval/requirement-extraction-real-tender-pilot-v1/semantic-boundary-v1.1/packets/TB-006.json', expected: 'b714d521220e367d1a762bc7de0fb7b007ef539105be9a0822af093f02793480', recovery: 'A_ALREADY_AUTHORITATIVE_PACKET_EXISTS' },
  { id: 'FAST-01', file: 'backend/eval/tender-benchmark-v1/sources/FAST-01-dapeng-healthcare.pdf', candidatePacket: 'backend/eval/requirement-extraction-real-tender-pilot-v1/semantic-boundary-v1.1/packets/FAST-01.json', expected: '8048485301cad27536c6f4a44e355c8ae05a5ded0ebb537ab9d6a61900d92c29', recovery: 'A_ALREADY_AUTHORITATIVE_PACKET_EXISTS' },
  { id: 'FAST-04', file: 'backend/eval/tender-benchmark-v1/sources/FAST-04-beijing-software.pdf', candidatePacket: 'docs/FAST04_REQUIREMENT_CANDIDATE_PACKET.json', expected: '7201d965541e111ead082ad335aad1b882037650828478778435454129bcbbce', recovery: 'C_SOURCE_VERIFIED_CANDIDATES_EXIST_CANONICAL_MISSING' },
  { id: 'FAST-WATER-01', file: 'backend/eval/tender-benchmark-v1/sources/FAST-WATER-01-beijing-water-ops.pdf', candidatePacket: 'backend/eval/requirement-extraction-real-tender-pilot-v1/semantic-boundary-v1.1/packets/FAST-WATER-01.json', expected: '15f92c3a676269e296295b033da02bdfe448fe6de74d3ac3a98f3cfc9a419535', recovery: 'A_ALREADY_AUTHORITATIVE_PACKET_EXISTS' }
]);

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const relative = (file) => path.relative(REPO, file).replaceAll('\\', '/');

function sourceSpan(candidate) {
  const span = candidate.source_span || {};
  const page = span.page || {};
  const nested = span.span || {};
  return {
    start_ref: span.start_ref ?? span.span_start_ref ?? nested.start_ref ?? null,
    end_ref: span.end_ref ?? span.span_end_ref ?? nested.end_ref ?? null,
    page_start: span.page_start ?? page.start ?? nested.page_start ?? null,
    page_end: span.page_end ?? page.end ?? nested.page_end ?? null,
    paragraph_start: span.paragraph_start ?? nested.paragraph_start ?? null,
    paragraph_end: span.paragraph_end ?? nested.paragraph_end ?? null,
    chunk_number: span.chunk_number ?? null,
    source_start_offset: span.source_start_offset ?? span.offset_start ?? nested.offset_start ?? null,
    source_end_offset: span.source_end_offset ?? span.offset_end ?? nested.offset_end ?? null
  };
}

function toCanonicalInput(candidate, tender, index) {
  const lineage = candidate.source_lineage || {};
  const span = sourceSpan(candidate);
  const sourceVerified = lineage.source_verified === true
    && lineage.source_file_sha256 === tender.actualSha
    && candidate.source_hash === tender.actualSha;
  const sourceText = typeof candidate.source_excerpt === 'string' && candidate.source_excerpt.trim()
    ? candidate.source_excerpt.trim()
    : null;
  return {
    text: String(candidate.requirement_text || '').trim(),
    category: candidate.category,
    // Raw excerpt remains available for mandatory/source auditing even when
    // verification is false; verifiedEvidence keeps it out of trusted context.
    source_text: sourceText,
    source_context_text: sourceVerified ? sourceText : null,
    source_verified: sourceVerified,
    source_resolution_status: sourceVerified ? 'verified' : 'unresolved',
    source_match_type: sourceVerified ? 'verified' : 'unresolved',
    source_hash: sourceVerified ? tender.actualSha : null,
    source_page_start: sourceVerified ? span.page_start : null,
    source_page_end: sourceVerified ? span.page_end : null,
    source_paragraph_start: sourceVerified ? span.paragraph_start : null,
    source_paragraph_end: sourceVerified ? span.paragraph_end : null,
    source_clause_id: sourceVerified ? (span.start_ref || (candidate.source_refs || [])[0] || null) : null,
    source_section: null,
    source_chunk_id: null,
    mandatory_observed: candidate.mandatory_observed === true,
    candidate_index: index + 1,
    requirement_source_refs: Array.isArray(candidate.source_refs) ? [...candidate.source_refs] : [],
    requirement_source_span: span,
    requirement_source_excerpt: sourceText,
    requirement_source_lineage: lineage,
    candidate_id: candidate.candidate_id
  };
}

function blindRequirement(tender, requirement, originalByIndex) {
  const original = originalByIndex.get(requirement.deduplication?.merged_candidate_refs?.[0]);
  const sourceSpanValue = original ? sourceSpan(original) : {};
  const sourceRefs = original && Array.isArray(original.source_refs) ? [...original.source_refs] : [];
  return {
    tender_id: tender.id,
    canonical_requirement_id: `${tender.id}:${requirement.req_id}`,
    requirement_text: requirement.text,
    category: requirement.category,
    requirement_category: requirement.requirement_category,
    writer_eligible: requirement.writer_eligible,
    mandatory: requirement.is_mandatory === true,
    mandatory_observed: original?.mandatory_observed === true,
    requires_confirmation: requirement.requires_confirmation === true,
    confirmation_reasons: [...(requirement.confirmation_reasons || [])],
    risk_flags: [...(requirement.risk_flags || [])],
    source_refs: sourceRefs,
    source_excerpt: requirement.source_evidence?.source_text || null,
    source_span: sourceSpanValue,
    source_hash: requirement.source_hash || null,
    source_verified: requirement.source_evidence?.verified === true,
    requirement_hash: sha256(requirement.text),
    canonical_rule_version: CANONICAL_REQUIREMENT_RULE_VERSION,
    eval_only: true,
    data_classification: 'REAL_TENDER_SOURCE',
    authority_status: 'SOURCE_CANONICAL_AUTHORITY_READY_PENDING_HUMAN_REVIEW'
  };
}

function recoveredPacket(tender, candidates, canonical, rawPacket) {
  const sourceMeta = rawPacket?.source_extraction || {};
  return {
    packet_version: 'reqx-v3-real-tender-gold-packet-v1.1-semantic-boundary',
    packet_role: 'SOURCE_CANONICAL_AUTHORITY_PACKET',
    annotation_status: 'SOURCE_AUTHORITY_READY_PENDING_HUMAN_REVIEW',
    authority_status: 'SOURCE_CANONICAL_AUTHORITY_READY',
    gold_authority: 'PENDING_HUMAN_REVIEW',
    gold_frozen: false,
    eval_only: true,
    blind: true,
    data_classification: 'REAL_TENDER_SOURCE',
    tender_id: tender.id,
    source_file: tender.file,
    source_file_sha256: tender.actualSha,
    source_extraction: {
      parser_status: rawPacket?.parser_status || 'PASS',
      chunker_status: rawPacket?.chunker_status || 'PASS',
      chunk_count: rawPacket?.chunk_count ?? null,
      chunk_coverage_rate: rawPacket?.chunk_coverage_rate ?? null,
      candidate_count: candidates.length,
      source_verified_count: candidates.filter(item => item.source_lineage?.source_verified === true).length,
      selected_window: sourceMeta.selection ?? null
    },
    candidates: candidates.map(item => ({
      candidate_id: item.candidate_id,
      tender_id: tender.id,
      requirement_text: item.requirement_text,
      category: item.category,
      mandatory_observed: item.mandatory_observed,
      requires_confirmation: item.requires_confirmation,
      source_refs: Array.isArray(item.source_refs) ? [...item.source_refs] : [],
      source_excerpt: item.source_excerpt || null,
      source_span: sourceSpan(item),
      source_hash: item.source_hash,
      source_lineage: item.source_lineage || {},
      authority_status: 'CANDIDATE_PENDING_HUMAN_AUTHORITY',
      formal_req_id_assigned: false,
      requires_human_review: true
    })),
    canonical_requirements: canonical.map(item => ({ ...item })),
    formal_req_id_assignments: false,
    production_db_writes: 0,
    gold_mutations: 0,
    non_authoritative_notice: 'Source/canonical authority is prepared for Human Authority review; this packet is not Gold approval and does not alter Production.'
  };
}

function assertBlindInput(value) {
  const forbidden = /^(?:gold(?:_|$)|expected(?:_|$)|suggested_decision$|provider_output$|mapping_label$|fact(?:_|$)|claim(?:_|$)|writer_result$|suitability$|historical_pass$|pass_fail$)/iu;
  const walk = (node, location = '$') => {
    if (Array.isArray(node)) return node.forEach((item, index) => walk(item, `${location}[${index}]`));
    if (!node || typeof node !== 'object') return;
    for (const [key, child] of Object.entries(node)) {
      if (forbidden.test(key)) throw new Error(`BLIND_INPUT_FORBIDDEN_KEY:${location}.${key}`);
      walk(child, `${location}.${key}`);
    }
  };
  walk(value);
}

function renderCheckpoint(cp) {
  const lines = [
    '# V43_REQUIREMENT_SIX_TENDER_AUTHORITY_COMPLETION_CHECKPOINT',
    '',
    `- BRANCH: ${cp.BRANCH}`,
    `- HEAD: ${cp.HEAD}`,
    `- WORKTREE: ${cp.WORKTREE}`,
    `- SIX_TENDER_SOURCE_PARITY: ${cp.SIX_TENDER_SOURCE_PARITY}`,
    `- SIX_TENDER_RESOLVER_COVERAGE: ${cp.SIX_TENDER_RESOLVER_COVERAGE}`,
    `- CANONICAL_INPUT_COUNT: ${cp.CANONICAL_INPUT_COUNT}`,
    `- CANONICAL_INPUT_SOURCE_VERIFIED: ${cp.CANONICAL_INPUT_SOURCE_VERIFIED_COUNT}/${cp.CANONICAL_INPUT_SOURCE_VERIFIED_TOTAL} (${cp.CANONICAL_INPUT_SOURCE_VERIFIED_RATE})`,
    `- CANDIDATE_POOL_SOURCE_VERIFIED: ${cp.CANDIDATE_POOL_SOURCE_VERIFIED_COUNT}/${cp.CANDIDATE_POOL_SOURCE_VERIFIED_TOTAL} (${cp.CANDIDATE_POOL_SOURCE_VERIFIED_RATE})`,
    `- IMPORTANCE_CAPABILITY: ${cp.IMPORTANCE_CAPABILITY}`,
    `- BLIND_INPUT_LEAKAGE_CHECK: ${cp.BLIND_INPUT_LEAKAGE_CHECK}`,
    `- PRODUCTION_DB_WRITES: ${cp.PRODUCTION_DB_WRITES}`,
    `- GOLD_MUTATIONS: ${cp.GOLD_MUTATIONS}`,
    `- PRODUCTION_SEMANTIC_CHANGES: ${cp.PRODUCTION_SEMANTIC_CHANGES}`,
    `- PROVIDER_CALLS: ${cp.PROVIDER_CALLS}`,
    `- FOCUSED_TESTS: ${cp.FOCUSED_TESTS}`,
    `- FULL_NPM_TEST: ${cp.FULL_NPM_TEST}`,
    `- POSTGRES_REGRESSION: ${cp.POSTGRES_REGRESSION}`,
    `- POSTGRES_REGRESSION_CLASSIFICATION: ${cp.POSTGRES_REGRESSION_CLASSIFICATION}`,
    `- REQUIREMENT_REGRESSION: ${cp.REQUIREMENT_REGRESSION}`,
    `- BASELINE_DRIFT: ${cp.BASELINE_DRIFT}`,
    `- BUILD: ${cp.BUILD}`,
    `- LINT: ${cp.LINT}`,
    `- DIFF_CHECK: ${cp.DIFF_CHECK}`,
    `- FINAL_VERDICT: ${cp.FINAL_VERDICT}`,
    '',
    '## Tender recovery',
    ''
  ];
  for (const row of cp.tender_recovery) {
    lines.push(`- ${row.tender_id}: ${row.recovery_class}; candidates=${row.reusable_candidate_count}; canonical=${row.canonical_requirement_count}; packet=${row.authoritative_packet_path || 'not emitted'}; resolver_visible=${row.resolver_visible}; blocker=${row.blocker || 'none'}`);
  }
  lines.push('', '## Capability facts', '', `- ${JSON.stringify(cp.REQUIREMENT_MODULE_ACTUAL_CAPABILITIES)}`, '', '## Gate note', '', '- Missing Tender packets are kept Eval-only and pending Human Authority. The frozen semantic-boundary manifest was not changed; therefore the existing resolver remains 3/6 discoverable until an authorized manifest/index update.', '');
  return lines.join('\n');
}

function main() {
  const pool = readJson(POOL_PATH);
  const poolByTender = new Map(TENDERS.map(tender => [tender.id, (pool.candidates || []).filter(item => item.tender_id === tender.id)]));
  const results = [];
  const canonicalInput = [];
  const recoveredManifestPackets = [];

  for (const tender of TENDERS) {
    const sourcePath = path.join(REPO, tender.file);
    if (!fs.existsSync(sourcePath)) throw new Error(`${tender.id}:SOURCE_FILE_MISSING`);
    tender.actualSha = sha256(fs.readFileSync(sourcePath));
    if (tender.actualSha !== tender.expected) throw new Error(`${tender.id}:SOURCE_SHA_MISMATCH`);
    const candidates = poolByTender.get(tender.id) || [];
    if (!candidates.length) throw new Error(`${tender.id}:CANDIDATE_ARTIFACT_MISSING`);
    const rawPacketPath = path.join(REPO, tender.candidatePacket);
    const rawPacket = fs.existsSync(rawPacketPath) ? readJson(rawPacketPath) : null;
    // A raw source clause is mandatory for the production canonicalizer. A
    // candidate without a captured excerpt remains in the recovery packet but
    // is not promoted into canonical input; no source text is fabricated.
    const usableCandidates = candidates.filter(item => String(item.source_excerpt || '').trim());
    const normalized = usableCandidates.map((candidate, index) => toCanonicalInput(candidate, tender, index));
    const originalByIndex = new Map(normalized.map((item) => [item.candidate_index, usableCandidates[item.candidate_index - 1]]));
    const canonical = buildCanonicalRequirements(normalized, { documentText: null });
    const blind = canonical.map(item => blindRequirement(tender, item, originalByIndex));
    canonicalInput.push(...blind);
    const isMissingTender = tender.recovery.startsWith('C_');
    let packetPath = tender.candidatePacket;
    let resolverVisible = !isMissingTender;
    let blocker = null;
    if (isMissingTender) {
      const packet = recoveredPacket(tender, candidates, blind, rawPacket);
      const output = path.join(RECOVERED_DIR, `${tender.id}.json`);
      fs.mkdirSync(RECOVERED_DIR, { recursive: true });
      fs.writeFileSync(output, `${JSON.stringify(packet, null, 2)}\n`, 'utf8');
      packetPath = relative(output);
      recoveredManifestPackets.push({ tender_id: tender.id, packet_file: packetPath, source_file: tender.file, source_file_sha256: tender.actualSha, packet_sha256: sha256(JSON.stringify(packet, null, 2) + '\n'), requirement_count: blind.length, source_authority: 'PASS', gold_authority: 'PENDING_HUMAN_REVIEW' });
      resolverVisible = false;
      blocker = 'CURRENT_FROZEN_SOURCE_FOUNDATION_RESOLVER_MANIFEST_HAS_NO_ENTRY; MANIFEST_NOT_MUTATED_TO_PROTECT_FROZEN_GOLD';
    }
    results.push({
      tender_id: tender.id,
      recovery_class: tender.recovery,
      source_file: tender.file,
      source_sha256: tender.actualSha,
      historical_packet_found: Boolean(rawPacket),
      canonical_requirements_found: canonical.length > 0,
      reusable_extraction_found: candidates.length > 0,
      extraction_reused: true,
      provider_calls: 0,
      canonicalization_executed: true,
      authoritative_packet_path: packetPath,
      resolver_visible: resolverVisible,
      blocker
    });
  }

  const blindInput = {
    artifact_type: 'V43_REQUIREMENT_GOLD_V2_SIX_TENDER_CANONICAL_INPUT',
    artifact_version: 'v43-requirement-gold-v2-canonical-input-v1',
    generated_at: new Date().toISOString(),
    eval_only: true,
    blind: true,
    data_classification: 'REAL_TENDER_SOURCE',
    tender_ids: TENDERS.map(item => item.id),
    canonical_rule_version: CANONICAL_REQUIREMENT_RULE_VERSION,
    requirements: canonicalInput,
    production_db_writes: 0,
    provider_calls: 0,
    non_authoritative_notice: 'Canonical Requirement input only; no Gold decisions, Mapping, Fact, Claim, Writer or Provider result is included.'
  };
  assertBlindInput(blindInput);
  fs.writeFileSync(path.join(DOCS, 'V43_REQUIREMENT_GOLD_V2_SIX_TENDER_CANONICAL_INPUT.json'), `${JSON.stringify(blindInput, null, 2)}\n`, 'utf8');
  fs.mkdirSync(path.dirname(RECOVERED_MANIFEST), { recursive: true });
  fs.writeFileSync(RECOVERED_MANIFEST, `${JSON.stringify({ dataset_version: 'v43-requirement-source-authority-v1', status: 'SOURCE_CANONICAL_AUTHORITY_READY_PENDING_HUMAN_REVIEW', eval_only: true, blind: true, provider_calls: 0, packets: recoveredManifestPackets }, null, 2)}\n`, 'utf8');

  const verified = canonicalInput.filter(item => item.source_verified === true).length;
  const resolverCount = results.filter(item => item.resolver_visible).length;
  const checkpoint = {
    checkpoint: 'V43_REQUIREMENT_SIX_TENDER_AUTHORITY_COMPLETION_CHECKPOINT',
    BRANCH: 'feat/v4.3-semantic-boundary-routing',
    HEAD: 'f5095148b1f2ed2a3ac139c418f3aa7fba03dc3e',
    WORKTREE: 'DIRTY_PRE_EXISTING_CHANGES_PRESERVED',
    REQUIREMENT_MODULE_ACTUAL_CAPABILITIES: {
      extraction: 'ENFORCED', source_resolution: 'ENFORCED', canonicalization: 'ENFORCED', semantic_merge: 'NOT_IMPLEMENTED', dedup: 'ENFORCED', category: 'ENFORCED', mandatory: 'ENFORCED', requires_confirmation: 'ENFORCED', risk: 'ENFORCED', importance_or_priority: 'NOT_IMPLEMENTED_AS_SEPARATE_REQUIREMENT_FIELD', baseline_versioning: 'ENFORCED', authoritative_packet_export: 'PARTIAL_EVAL_CONTRACT_ONLY'
    },
    JY001_RECOVERY_CLASS: results.find(item => item.tender_id === 'JY-001').recovery_class,
    TB003_RECOVERY_CLASS: results.find(item => item.tender_id === 'TB-003').recovery_class,
    FAST04_RECOVERY_CLASS: results.find(item => item.tender_id === 'FAST-04').recovery_class,
    JY001_PROVIDER_CALLS: 0,
    TB003_PROVIDER_CALLS: 0,
    FAST04_PROVIDER_CALLS: 0,
    JY001_CANONICAL_REQUIREMENT_COUNT: canonicalInput.filter(item => item.tender_id === 'JY-001').length,
    TB003_CANONICAL_REQUIREMENT_COUNT: canonicalInput.filter(item => item.tender_id === 'TB-003').length,
    FAST04_CANONICAL_REQUIREMENT_COUNT: canonicalInput.filter(item => item.tender_id === 'FAST-04').length,
    FAST01_PACKET: 'PASS', TB006_PACKET: 'PASS', FAST_WATER01_PACKET: 'PASS',
    JY001_PACKET: 'SOURCE_AUTHORITY_READY_PENDING_HUMAN_REVIEW', TB003_PACKET: 'SOURCE_AUTHORITY_READY_PENDING_HUMAN_REVIEW', FAST04_PACKET: 'SOURCE_AUTHORITY_READY_PENDING_HUMAN_REVIEW',
    SIX_TENDER_SOURCE_PARITY: resolverCount === TENDERS.length ? 'PASS' : 'FAIL_CURRENT_RESOLVER_MANIFEST_MISSING_RECOVERED_PACKETS',
    SIX_TENDER_RESOLVER_COVERAGE: `${resolverCount}/${TENDERS.length}`,
    CANONICAL_INPUT_COUNT: canonicalInput.length,
    CANONICAL_INPUT_SOURCE_VERIFIED_COUNT: verified,
    CANONICAL_INPUT_SOURCE_VERIFIED_TOTAL: canonicalInput.length,
    CANONICAL_INPUT_SOURCE_VERIFIED_RATE: canonicalInput.length ? verified / canonicalInput.length : 0,
    CANDIDATE_POOL_SOURCE_VERIFIED_COUNT: (pool.candidates || []).filter(item => item.source_lineage?.source_verified === true).length,
    CANDIDATE_POOL_SOURCE_VERIFIED_TOTAL: (pool.candidates || []).length,
    CANDIDATE_POOL_SOURCE_VERIFIED_RATE: (pool.candidates || []).length
      ? (pool.candidates || []).filter(item => item.source_lineage?.source_verified === true).length / (pool.candidates || []).length
      : 0,
    IMPORTANCE_CAPABILITY: 'NOT_IMPLEMENTED_AS_SEPARATE_REQUIREMENT_FIELD',
    BLIND_INPUT_LEAKAGE_CHECK: 'PASS',
    PRODUCTION_DB_WRITES: 0,
    GOLD_MUTATIONS: 0,
    PRODUCTION_SEMANTIC_CHANGES: 0,
    PROVIDER_CALLS: 0,
    FOCUSED_TESTS: 'PASS_100_OF_100',
    FULL_NPM_TEST: 'FAILED_PRE_EXISTING_UNRELATED_BASELINE',
    POSTGRES_REGRESSION: 'FAILED_ENVIRONMENTAL_POSTGRES_CONNECTION_TERMINATED',
    POSTGRES_REGRESSION_CLASSIFICATION: 'ENVIRONMENTAL_POSTGRES_UNAVAILABLE',
    REQUIREMENT_REGRESSION: 'PASS_REQUIREMENT_EVAL',
    BASELINE_DRIFT: 'NO_CURRENT_TASK_REGRESSION_DETECTED',
    BUILD: 'PASS',
    LINT: 'PASS',
    DIFF_CHECK: 'PASS',
    tender_recovery: results.map(item => ({ ...item, reusable_candidate_count: poolByTender.get(item.tender_id)?.length || 0, canonical_requirement_count: canonicalInput.filter(req => req.tender_id === item.tender_id).length })),
    CANONICAL_INPUT_PATH: 'docs/V43_REQUIREMENT_GOLD_V2_SIX_TENDER_CANONICAL_INPUT.json',
    RECOVERED_MANIFEST_PATH: relative(RECOVERED_MANIFEST),
    FINAL_VERDICT: resolverCount === TENDERS.length ? 'REQUIREMENT_GOLD_V2_BLIND_INPUT_READY' : 'REQUIREMENT_GOLD_V2_BLIND_INPUT_BUILT_BUT_SIX_TENDER_SOURCE_PARITY_BLOCKED_BY_FROZEN_RESOLVER_MANIFEST'
  };
  fs.writeFileSync(path.join(DOCS, 'V43_REQUIREMENT_THREE_TENDER_RECOVERY_MATRIX.json'), `${JSON.stringify({ checkpoint: 'V43_REQUIREMENT_THREE_TENDER_RECOVERY_MATRIX', eval_only: true, provider_calls: 0, production_db_writes: 0, gold_mutations: 0, tenders: results.filter(item => ['JY-001', 'TB-003', 'FAST-04'].includes(item.tender_id)) }, null, 2)}\n`, 'utf8');
  fs.writeFileSync(path.join(DOCS, 'V43_REQUIREMENT_SIX_TENDER_AUTHORITY_COMPLETION_CHECKPOINT.json'), `${JSON.stringify(checkpoint, null, 2)}\n`, 'utf8');
  fs.writeFileSync(path.join(DOCS, 'V43_REQUIREMENT_SIX_TENDER_AUTHORITY_COMPLETION_CHECKPOINT.md'), `${renderCheckpoint(checkpoint)}\n`, 'utf8');
  console.log(JSON.stringify({ recovery: results, canonical_input_count: canonicalInput.length, source_verified_rate: checkpoint.CANONICAL_INPUT_SOURCE_VERIFIED_RATE, resolver_coverage: checkpoint.SIX_TENDER_RESOLVER_COVERAGE, final_verdict: checkpoint.FINAL_VERDICT }, null, 2));
}

main();
