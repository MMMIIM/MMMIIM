import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildEvidenceNeedProfile } from '../../src/evidence-need-profile-builder.js';
import { deduplicateRankedEvidenceCandidates } from '../../src/evidence-search-orchestrator.js';
import { loadFrozenChengchuanEvidenceSources } from './chengchuan-evidence-source-loader.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../../..');
const SNAPSHOT_DIR = path.join(REPO, 'docs/handoff/V43_EVIDENCE_SEARCH_SUPPORT_ARCHITECTURE_ENGINEERING_V1/evidence-vector-snapshot');
const SNAPSHOT_ID = 'EVSNAP-D98FA52C-952F-416F-B57F-92C41EF9731D';
const SNAPSHOT_PATH = path.join(SNAPSHOT_DIR, `${SNAPSHOT_ID}.json`);
const PACKET_JSON_PATH = path.join(SNAPSHOT_DIR, `${SNAPSHOT_ID}.dedup-review-packet.json`);
const PACKET_MD_PATH = path.join(SNAPSHOT_DIR, `${SNAPSHOT_ID}.dedup-review-packet.md`);
const ROUTER_PATH = path.join(REPO, 'docs/handoff/V43_RESPONSE_ROUTER_V2_2_3_FINAL_AUTHORITY_CLOSURE/07_FULL_REPLAY.json');
const ENTERPRISE_ID = 'SYNTH-CHENGCHUAN-001';
const AUTHORITY = 'SYNTHETIC_EVAL_ONLY';
const PRODUCTION_AUTHORITY = 'NONE';
const EXPECTED_IDENTITY_HASH = 'ec659099e70e6c00e5cebd664732be815b8447de3e4a86dca3ed16c6f28772e8';
const EXPECTED_MODEL = 'Qwen/Qwen3-Embedding-0.6B';
const EXPECTED_VERSION = '1';
const EXPECTED_DIMENSION = 1024;
const REQUIREMENT_IDS = Object.freeze(['JY-001:REQ-057', 'FAST-01:REQ-005', 'FAST-04:REQ-004']);
const TOP_K = 5;

const sha256 = value => createHash('sha256').update(String(value), 'utf8').digest('hex');
const text = value => String(value ?? '').trim();
const json = value => JSON.stringify(value, null, 2) + '\n';
const keyOf = item => `${item.material_id}|${item.chunk_id}|${item.chunk_hash}`;
const fail = (code, details = {}) => Object.assign(new Error(code), { code, details });

function cosine(left, right) {
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftNorm += left[index] * left[index];
    rightNorm += right[index] * right[index];
  }
  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}

function assertVector(vector, label) {
  if (!Array.isArray(vector) || vector.length !== EXPECTED_DIMENSION || vector.some(value => !Number.isFinite(value))) {
    throw fail('BLOCKED_EVIDENCE_SEARCH_FROZEN_VECTOR_INVALID', {
      label,
      observed_dimension: Array.isArray(vector) ? vector.length : null,
      expected_dimension: EXPECTED_DIMENSION
    });
  }
}

function sourceIdentityHash(sources) {
  const rows = sources.flatMap(source => source.chunks.map(chunk => ({
    material_id: chunk.material_id,
    chunk_id: chunk.chunk_id,
    chunk_hash: chunk.chunk_hash
  })));
  return sha256(JSON.stringify(rows));
}

function loadQuerySpecifications(sources) {
  const router = JSON.parse(readFileSync(ROUTER_PATH, 'utf8'));
  const projectId = sources[0]?.project_id || null;
  return REQUIREMENT_IDS.map(requirementId => {
    const row = (router.rows || []).find(item => item.requirement_id === requirementId);
    if (!row || !text(row.requirement_text)) throw fail('EVIDENCE_SEARCH_CANONICAL_REQUIREMENT_NOT_FOUND', { requirement_id: requirementId });
    const requirement = {
      requirement_id: requirementId,
      text: row.requirement_text,
      project_id: projectId
    };
    const profile = buildEvidenceNeedProfile({
      requirement,
      responseDecision: {
        response_mode: row.v223?.response_mode || 'NEED_REVIEW',
        risk_tier: row.v223?.risk_tier || 'HIGH',
        response_required: row.v223?.response_required
      },
      enterpriseId: ENTERPRISE_ID
    });
    return {
      requirement,
      profile,
      query_text: row.requirement_text,
      query_hash: sha256(row.requirement_text)
    };
  });
}

function materialFor(sourceByKey, row) {
  const source = sourceByKey.get(keyOf(row));
  if (!source) throw fail('BLOCKED_EVIDENCE_SEARCH_SOURCE_LINEAGE_MISSING', { chunk_id: row.chunk_id, chunk_hash: row.chunk_hash });
  return source;
}

function candidate(sourceByKey, row, similarity, requirementId, profileHash, searchRunId, rank) {
  const source = materialFor(sourceByKey, row);
  return {
    requirement_id: requirementId,
    rank,
    similarity: Number(similarity.toFixed(12)),
    material_id: row.material_id,
    material_logical_identity: {
      com_id: source.doc_id,
      original_name: source.original_name,
      source_file: source.source_file
    },
    material_type: source.material_type,
    chunk_id: row.chunk_id,
    chunk_hash: row.chunk_hash,
    source_role: row.source_role,
    enterprise_id: row.enterprise_id,
    source_span: `${row.chunk_id}:FULL`,
    exact_candidate_source_text: source.source_text || null,
    search_run_id: searchRunId,
    profile_hash: profileHash
  };
}

function assertSnapshot(snapshot) {
  const manifest = snapshot?.manifest;
  if (manifest?.snapshot_id !== SNAPSHOT_ID
    || manifest?.enterprise_id !== ENTERPRISE_ID
    || manifest?.authority !== AUTHORITY
    || manifest?.production_authority !== PRODUCTION_AUTHORITY
    || manifest?.material_count !== 9
    || manifest?.chunk_count !== 94
    || manifest?.identity_hash !== EXPECTED_IDENTITY_HASH
    || manifest?.embedding_model !== EXPECTED_MODEL
    || String(manifest?.embedding_version) !== EXPECTED_VERSION
    || Number(manifest?.vector_dimension) !== EXPECTED_DIMENSION
    || !Array.isArray(snapshot?.vectors)
    || snapshot.vectors.length !== 94
    || !Array.isArray(snapshot?.query_vectors)
    || snapshot.query_vectors.length !== 3) {
    throw fail('BLOCKED_EVIDENCE_SEARCH_FROZEN_VECTOR_SNAPSHOT_INVALID', {
      snapshot_id: manifest?.snapshot_id || null,
      material_count: manifest?.material_count || null,
      chunk_count: manifest?.chunk_count || null,
      identity_hash: manifest?.identity_hash || null,
      model: manifest?.embedding_model || null,
      version: manifest?.embedding_version || null,
      dimension: manifest?.vector_dimension || null,
      vector_count: snapshot?.vectors?.length || 0,
      query_vector_count: snapshot?.query_vectors?.length || 0
    });
  }
  for (const row of snapshot.vectors) {
    if (row.enterprise_id !== ENTERPRISE_ID || row.source_role !== 'EVIDENCE_CANDIDATE' || row.authority !== AUTHORITY || row.production_authority !== PRODUCTION_AUTHORITY
      || row.embedding_model !== EXPECTED_MODEL || String(row.embedding_version) !== EXPECTED_VERSION || Number(row.vector_dimension) !== EXPECTED_DIMENSION) {
      throw fail('BLOCKED_EVIDENCE_SEARCH_FROZEN_VECTOR_IDENTITY_INVALID', { chunk_id: row.chunk_id });
    }
    assertVector(row.vector, `chunk:${row.chunk_id}`);
  }
  for (const row of snapshot.query_vectors) {
    if (!REQUIREMENT_IDS.includes(row.requirement_id) || row.snapshot_id !== SNAPSHOT_ID || row.embedding_model !== EXPECTED_MODEL
      || String(row.embedding_version) !== EXPECTED_VERSION || Number(row.vector_dimension) !== EXPECTED_DIMENSION) {
      throw fail('BLOCKED_EVIDENCE_SEARCH_FROZEN_QUERY_VECTOR_IDENTITY_INVALID', { requirement_id: row.requirement_id || null });
    }
    assertVector(row.vector, `query:${row.requirement_id}`);
  }
}

function buildDuplicateGroups(sourceByKey, ranked) {
  const groups = new Map();
  ranked.forEach((row, index) => {
    const group = groups.get(row.chunk_hash);
    const member = {
      rank: index + 1,
      material_id: row.material_id,
      material_logical_identity: {
        com_id: materialFor(sourceByKey, row).doc_id,
        original_name: materialFor(sourceByKey, row).original_name
      },
      chunk_id: row.chunk_id,
      chunk_hash: row.chunk_hash,
      similarity: Number(row.similarity.toFixed(12)),
      source_span: `${row.chunk_id}:FULL`
    };
    if (group) group.members.push(member);
    else groups.set(row.chunk_hash, { chunk_hash: row.chunk_hash, members: [member] });
  });
  return [...groups.values()]
    .filter(group => group.members.length > 1)
    .map(group => ({
      chunk_hash: group.chunk_hash,
      retained_candidate: group.members[0],
      removed_candidates: group.members.slice(1),
      removed_count: group.members.length - 1,
      raw_top_k_affected: group.members.some(member => member.rank <= TOP_K)
    }));
}

function markdown(packet) {
  const lines = [
    '# V43 Evidence Search Content-Dedup Semantic Review Packet',
    '',
    `Status: ${packet.status}`,
    `Snapshot: ${packet.snapshot_id}`,
    `Mode: ${packet.retrieval_mode}`,
    '',
    'This packet contains mechanical retrieval evidence only. No semantic labels, support relationship, Fact truth, or Claim eligibility were assigned.',
    ''
  ];
  for (const item of packet.requirements) {
    const profile = item.evidence_need_profile;
    lines.push(`## ${item.requirement_id}`, '', `Canonical Requirement: ${item.canonical_requirement_text}`, '');
    lines.push(`EvidenceNeedProfile: ${profile.class}; required=${profile.required_dimensions.join(', ') || 'none'}; conditional=${profile.conditional_dimensions.join(', ') || 'none'}`);
    lines.push(`Search signals: ${profile.search_signals.join(', ') || 'none'}`);
    lines.push(`Critical literals: ${profile.critical_literals.join(', ') || 'none'}`);
    lines.push(`Profile hash: ${profile.profile_hash}`, `Search query: ${item.search_query_text}`, `Search query hash: ${item.search_query_hash}`, '');
    lines.push(`Raw candidates: ${item.raw_candidate_count}; raw Top-K: ${item.raw_top_k.length}; duplicate groups: ${item.content_duplicate_groups.length}; deduplicated candidates: ${item.deduplicated_candidate_count}; final Top-K: ${item.final_top_k.length}; recovered slots: ${item.slots_recovered_by_chunk_hash_dedup}`, '');
    if (!item.content_duplicate_groups.length) lines.push('Content duplicate groups: none', '');
    else {
      lines.push('Content duplicate groups:');
      for (const group of item.content_duplicate_groups) {
        lines.push(`- ${group.chunk_hash}: retained ${group.retained_candidate.chunk_id}; removed ${group.removed_count}; raw Top-K affected=${group.raw_top_k_affected}`);
      }
      lines.push('');
    }
    lines.push('Final Top-K:');
    for (const row of item.final_top_k) {
      lines.push(`- ${row.rank}. ${row.material_logical_identity.com_id}/${row.material_id} ${row.chunk_id} score=${row.similarity} hash=${row.chunk_hash} span=${row.source_span}`);
      lines.push(`  Exact source text: ${row.exact_candidate_source_text}`);
    }
    lines.push('');
  }
  lines.push('## Mechanical gates', '', `Reference-only escape: ${packet.reference_only_escape}`, `Cross-enterprise escape: ${packet.cross_enterprise_escape}`, `Quarantine escape: ${packet.quarantine_escape}`, `K=0 count: ${packet.k0_count}`, `Duplicate candidate count after final dedup: ${packet.duplicate_candidate_count}`, `Search-run lineage complete: ${packet.search_run_lineage_complete}`, '', 'Side effects: external Provider 0; Embedding 0; Fact 0; Mapping 0; Claim 0; Writer 0; Production DB writes 0; Eval DB writes 0; Gold mutations 0.');
  return lines.join('\n') + '\n';
}

async function run() {
  const snapshot = JSON.parse(await readFile(SNAPSHOT_PATH, 'utf8'));
  assertSnapshot(snapshot);
  const sources = await loadFrozenChengchuanEvidenceSources({ repoRoot: REPO });
  if (sources.length !== 9 || sourceIdentityHash(sources) !== EXPECTED_IDENTITY_HASH) {
    throw fail('BLOCKED_EVIDENCE_SEARCH_SOURCE_IDENTITY_PARITY', { material_count: sources.length, identity_hash: sourceIdentityHash(sources) });
  }
  const sourceByKey = new Map(sources.flatMap(source => source.chunks.map(chunk => [keyOf({ material_id: chunk.material_id, chunk_id: chunk.chunk_id, chunk_hash: chunk.chunk_hash }), {
    ...chunk,
    doc_id: source.doc_id,
    original_name: source.original_name,
    source_file: source.source_file,
    material_type: source.material_type,
    source_role: source.source_role,
    enterprise_id: source.enterprise_id,
    semantic_review_status: source.semantic_review_status
  }])));
  const queries = loadQuerySpecifications(sources);
  const results = [];
  for (const query of queries) {
    const queryRow = snapshot.query_vectors.find(row => row.requirement_id === query.requirement.requirement_id);
    if (!queryRow || queryRow.query_hash !== query.query_hash || queryRow.profile_hash !== query.profile.profile_hash) {
      throw fail('BLOCKED_EVIDENCE_SEARCH_QUERY_VECTOR_METADATA_MISMATCH', { requirement_id: query.requirement.requirement_id });
    }
    const ranked = snapshot.vectors
      .filter(row => sourceByKey.has(keyOf(row)) && row.source_role === 'EVIDENCE_CANDIDATE' && row.enterprise_id === ENTERPRISE_ID && text(sourceByKey.get(keyOf(row)).semantic_review_status).toUpperCase() !== 'QUARANTINED')
      .map(row => ({ ...row, similarity: cosine(queryRow.vector, row.vector) }))
      .sort((left, right) => right.similarity - left.similarity || keyOf(left).localeCompare(keyOf(right)));
    const searchRunId = `ESEARCH-${sha256(`${SNAPSHOT_ID}|${query.requirement.requirement_id}|${query.profile.profile_hash}`).slice(0, 24).toUpperCase()}`;
    const rawTopK = ranked.slice(0, TOP_K).map((row, index) => candidate(sourceByKey, row, row.similarity, query.requirement.requirement_id, query.profile.profile_hash, searchRunId, index + 1));
    const contentDedup = deduplicateRankedEvidenceCandidates(ranked);
    const rawTopKUniqueContentCount = new Set(rawTopK.map(row => row.chunk_hash)).size;
    const finalTopK = contentDedup.retained.slice(0, TOP_K).map((row, index) => candidate(sourceByKey, row, row.similarity, query.requirement.requirement_id, query.profile.profile_hash, searchRunId, index + 1));
    const duplicateGroups = buildDuplicateGroups(sourceByKey, ranked);
    results.push({
      requirement_id: query.requirement.requirement_id,
      canonical_requirement_text: query.requirement.text,
      evidence_need_profile: {
        class: query.profile.evidence_need_class,
        required_dimensions: query.profile.required_dimensions,
        conditional_dimensions: query.profile.conditional_dimensions,
        search_signals: query.profile.search_signals,
        critical_literals: query.profile.critical_literals,
        profile_hash: query.profile.profile_hash
      },
      search_query_text: query.query_text,
      search_query_hash: query.query_hash,
      search_run_id: searchRunId,
      raw_candidate_count: ranked.length,
      raw_top_k: rawTopK,
      content_duplicate_groups: duplicateGroups,
      deduplicated_candidate_count: contentDedup.retained.length,
      final_top_k: finalTopK,
      slots_recovered_by_chunk_hash_dedup: Math.max(0, finalTopK.length - rawTopKUniqueContentCount),
      duplicate_candidates_removed_count: ranked.length - contentDedup.retained.length,
      k0: finalTopK.length === 0,
      search_run_lineage_complete: finalTopK.every(row => row.requirement_id && Number.isInteger(row.rank) && Number.isFinite(row.similarity) && row.material_id && row.material_logical_identity?.com_id && row.material_type && row.chunk_id && row.chunk_hash && row.source_role && row.enterprise_id && row.source_span && row.exact_candidate_source_text && row.search_run_id && row.profile_hash)
    });
  }
  const packet = {
    status: 'EVIDENCE_SEARCH_DEDUP_AND_GPT_REVIEW_PACKET_READY',
    packet_type: 'V43_EVIDENCE_SEARCH_CONTENT_DEDUP_AND_SEMANTIC_REVIEW_PACKET_V1',
    snapshot_id: SNAPSHOT_ID,
    snapshot_path: SNAPSHOT_PATH,
    packet_json_path: PACKET_JSON_PATH,
    packet_markdown_path: PACKET_MD_PATH,
    retrieval_mode: 'LOCAL_PERSISTED_FROZEN_VECTOR_SNAPSHOT',
    top_k_limit: TOP_K,
    semantic_labels_assigned: false,
    embedding_calls: 0,
    provider_calls: 0,
    requirements: results,
    k0_count: results.filter(item => item.k0).length,
    duplicate_candidate_count: results.reduce((sum, item) => sum + item.duplicate_candidates_removed_count, 0),
    reference_only_escape: snapshot.vectors.filter(row => row.source_role !== 'EVIDENCE_CANDIDATE').length,
    cross_enterprise_escape: snapshot.vectors.filter(row => row.enterprise_id !== ENTERPRISE_ID).length,
    quarantine_escape: snapshot.vectors.filter(row => text(sourceByKey.get(keyOf(row))?.semantic_review_status).toUpperCase() === 'QUARANTINED').length,
    search_run_lineage_complete: results.every(item => item.search_run_lineage_complete),
    fact_calls: 0,
    mapping_calls: 0,
    claim_calls: 0,
    writer_calls: 0,
    production_db_writes: 0,
    eval_db_writes: 0,
    gold_mutations: 0
  };
  await writeFile(PACKET_JSON_PATH, json(packet), 'utf8');
  await writeFile(PACKET_MD_PATH, markdown(packet), 'utf8');
  console.log(JSON.stringify(packet, null, 2));
}

run().catch(error => {
  console.log(JSON.stringify({
    status: error.code || 'BLOCKED_EVIDENCE_SEARCH_DEDUP_REPLAY',
    details: error.details || { message: error.message || 'UNKNOWN_LOCAL_REPLAY_ERROR' },
    embedding_calls: 0,
    provider_calls: 0,
    fact_calls: 0,
    mapping_calls: 0,
    claim_calls: 0,
    writer_calls: 0,
    production_db_writes: 0,
    eval_db_writes: 0,
    gold_mutations: 0
  }, null, 2));
  process.exitCode = 1;
});
