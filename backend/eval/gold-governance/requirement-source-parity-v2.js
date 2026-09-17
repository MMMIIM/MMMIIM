import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const TARGET_TENDER_IDS = Object.freeze([
  'JY-001',
  'TB-003',
  'TB-006',
  'FAST-01',
  'FAST-04',
  'FAST-WATER-01'
]);

const RECOVERY_MANIFEST = 'backend/eval/requirement-extraction-real-tender-pilot-v1/recovered-source-authority-v1/manifest.json';
const FROZEN_MANIFEST = 'backend/eval/requirement-extraction-real-tender-pilot-v1/manifest.json';
const CANONICAL_INPUT = 'docs/V43_REQUIREMENT_GOLD_V2_SIX_TENDER_CANONICAL_INPUT.json';

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const rel = (repoRoot, file) => path.relative(repoRoot, file).replaceAll('\\', '/');
const stable = (value) => Array.isArray(value)
  ? value.map(stable)
  : (value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]))
    : value);

function resolvePath(repoRoot, baseDir, declared) {
  if (!declared || typeof declared !== 'string') return null;
  const candidates = path.isAbsolute(declared)
    ? [declared]
    : [path.resolve(baseDir, declared), path.resolve(repoRoot, declared)];
  return candidates.find((candidate) => fs.existsSync(candidate)) || candidates[0];
}

function loadManifest(repoRoot, relativePath) {
  const file = path.resolve(repoRoot, relativePath);
  return { file, data: readJson(file) };
}

function packetMap(repoRoot, relativePath) {
  const manifest = loadManifest(repoRoot, relativePath);
  const byTender = new Map();
  for (const meta of manifest.data.packets || []) {
    const packetFile = resolvePath(repoRoot, path.dirname(manifest.file), meta.packet_file);
    if (!packetFile || !fs.existsSync(packetFile)) continue;
    byTender.set(meta.tender_id, {
      lane: relativePath === RECOVERY_MANIFEST ? 'RECOVERY' : 'FROZEN',
      manifest_file: manifest.file,
      meta,
      packet_file: packetFile,
      packet: readJson(packetFile),
      packet_raw: fs.readFileSync(packetFile)
    });
  }
  return byTender;
}

function canonicalMap(repoRoot, relativePath = CANONICAL_INPUT) {
  const file = path.resolve(repoRoot, relativePath);
  const data = readJson(file);
  const byTender = new Map();
  for (const row of data.requirements || []) {
    if (!byTender.has(row.tender_id)) byTender.set(row.tender_id, []);
    byTender.get(row.tender_id).push(row);
  }
  return { file, data, byTender };
}

function packetRequirementCount(packet) {
  if (Array.isArray(packet.canonical_requirements)) return packet.canonical_requirements.length;
  if (Array.isArray(packet.gold_requirements)) return packet.gold_requirements.length;
  if (Array.isArray(packet.requirements)) return packet.requirements.length;
  return 0;
}

function packetSourceHash(packet, meta) {
  return packet.source_file_sha256 || meta.source_file_sha256 || null;
}

function buildTenderRow({ repoRoot, tenderId, selected, canonicalRows, sourceOverrides }) {
  const override = sourceOverrides?.get?.(tenderId) || sourceOverrides?.[tenderId] || {};
  if (!selected) {
    return {
      tender_id: tenderId,
      status: 'UNRESOLVED_TENDER_SOURCE',
      source_identity: {
        packet_file: null,
        source_file: null,
        source_file_exists: false,
        declared_source_file_sha256: null,
        actual_source_file_sha256: null,
        source_hash_match: false,
        packet_hash_match: false,
        packet_identity_match: false
      },
      canonical_linkage: {
        canonical_requirement_count: canonicalRows.length,
        source_hashes: [...new Set(canonicalRows.map((row) => row.source_hash).filter(Boolean))].sort(),
        source_hash_match: false,
        source_verified_all: false,
        canonical_ids_present: false
      },
      source_lineage: 'UNRESOLVED'
    };
  }

  const packetBytesHash = sha256(selected.packet_raw);
  const declaredPacketHash = selected.meta.packet_sha256 || selected.meta.gold_file_sha256 || null;
  const packetIdentityMatch = selected.packet.tender_id === tenderId;
  const declaredSourceHash = override.declaredSourceHash || packetSourceHash(selected.packet, selected.meta);
  const sourceFile = resolvePath(repoRoot, repoRoot, selected.packet.source_file || selected.meta.source_file);
  const sourceExists = Boolean(sourceFile && fs.existsSync(sourceFile));
  const actualSourceHash = sourceExists ? sha256(fs.readFileSync(sourceFile)) : null;
  const sourceHashMatch = Boolean(actualSourceHash && declaredSourceHash && actualSourceHash === declaredSourceHash);
  const packetHashMatch = Boolean(declaredPacketHash && packetBytesHash === declaredPacketHash);
  const canonicalHashes = [...new Set(canonicalRows.map((row) => row.source_hash).filter(Boolean))].sort();
  const canonicalSourceHashMatch = canonicalRows.length > 0
    && canonicalHashes.length === 1
    && canonicalHashes[0] === declaredSourceHash;
  const canonicalVerified = canonicalRows.length > 0 && canonicalRows.every((row) => row.source_verified === true);
  const canonicalIdsPresent = canonicalRows.length > 0 && canonicalRows.every((row) => (
    typeof row.canonical_requirement_id === 'string' && row.canonical_requirement_id.trim()
  ));
  const sourceAuthority = selected.meta.source_authority || selected.packet.authority_status || 'SOURCE_PACKET';
  const allPass = sourceExists && sourceHashMatch && packetHashMatch && packetIdentityMatch
    && canonicalSourceHashMatch && canonicalVerified && canonicalIdsPresent;
  const status = allPass
    ? 'SOURCE_AUTHORITY_READY'
    : !sourceExists
      ? 'UNRESOLVED_TENDER_SOURCE'
      : !sourceHashMatch
        ? 'SOURCE_HASH_MISMATCH'
        : !packetHashMatch
          ? 'PACKET_HASH_MISMATCH'
          : !packetIdentityMatch
            ? 'PACKET_IDENTITY_MISMATCH'
            : !canonicalSourceHashMatch
              ? 'CANONICAL_SOURCE_LINKAGE_MISMATCH'
              : 'CANONICAL_AUTHORITY_LINKAGE_INCOMPLETE';
  return {
    tender_id: tenderId,
    status,
    packet_lane: selected.lane,
    source_authority: sourceAuthority,
    packet_requirement_count: packetRequirementCount(selected.packet),
    canonical_requirement_count: canonicalRows.length,
    source_identity: {
      packet_file: rel(repoRoot, selected.packet_file),
      packet_sha256: packetBytesHash,
      declared_packet_sha256: declaredPacketHash,
      packet_hash_match: packetHashMatch,
      packet_tender_id: selected.packet.tender_id || null,
      packet_identity_match: packetIdentityMatch,
      source_file: sourceFile ? rel(repoRoot, sourceFile) : null,
      source_file_exists: sourceExists,
      declared_source_file_sha256: declaredSourceHash,
      actual_source_file_sha256: actualSourceHash,
      source_hash_match: sourceHashMatch
    },
    source_lineage: allPass ? 'VERIFIED_SOURCE_FILE_PACKET_CANONICAL' : 'SOURCE_REVIEW_REQUIRED',
    canonical_linkage: {
      canonical_requirement_count: canonicalRows.length,
      source_hashes: canonicalHashes,
      source_hash_match: canonicalSourceHashMatch,
      source_verified_all: canonicalVerified,
      canonical_ids_present: canonicalIdsPresent,
      canonical_rule_versions: [...new Set(canonicalRows.map((row) => row.canonical_rule_version).filter(Boolean))].sort(),
      canonical_requirement_hash_count: canonicalRows.filter((row) => typeof row.requirement_hash === 'string' && row.requirement_hash).length
    },
    authority_status: 'PENDING_HUMAN_AUTHORITY_REVIEW'
  };
}

export function resolveSixTenderSourceParity({
  repoRoot,
  tenderIds = TARGET_TENDER_IDS,
  canonicalInputPath = CANONICAL_INPUT,
  sourceOverrides = new Map()
} = {}) {
  const recovery = packetMap(repoRoot, RECOVERY_MANIFEST);
  const frozen = packetMap(repoRoot, FROZEN_MANIFEST);
  const canonical = canonicalMap(repoRoot, canonicalInputPath);
  const rows = tenderIds.map((tenderId) => {
    const selected = recovery.get(tenderId) || frozen.get(tenderId);
    return buildTenderRow({
      repoRoot,
      tenderId,
      selected,
      canonicalRows: canonical.byTender.get(tenderId) || [],
      sourceOverrides
    });
  });
  const ready = rows.filter((row) => row.status === 'SOURCE_AUTHORITY_READY').length;
  const hashMismatch = rows.filter((row) => ['SOURCE_HASH_MISMATCH', 'PACKET_HASH_MISMATCH', 'CANONICAL_SOURCE_LINKAGE_MISMATCH'].includes(row.status)).length;
  const unresolved = rows.filter((row) => row.status === 'UNRESOLVED_TENDER_SOURCE').length;
  return {
    schema_version: 'v43-six-tender-source-authority-parity-v2',
    eval_only: true,
    blind: true,
    data_classification: 'REAL_TENDER_SOURCE',
    target_tender_ids: [...tenderIds],
    target_tender_count: tenderIds.length,
    tenders: rows,
    gates: {
      SIX_TENDER_SOURCE_PARITY: `${ready}/${tenderIds.length}`,
      SOURCE_HASH_MISMATCH: hashMismatch,
      UNRESOLVED_TENDER_SOURCE: unresolved,
      NO_FABRICATED_TENDER_SOURCE: hashMismatch === 0 && unresolved === 0 ? 'PASS' : 'FAIL'
    },
    production_db_writes: 0,
    provider_calls: 0,
    gold_mutations: 0,
    historical_manifest_untouched: true,
    canonical_input: {
      path: rel(repoRoot, canonical.file),
      sha256: sha256(fs.readFileSync(canonical.file)),
      requirement_count: (canonical.data.requirements || []).length
    }
  };
}

export function buildSuccessorManifest({ repoRoot, generatedAt = null, ...options } = {}) {
  const report = resolveSixTenderSourceParity({ repoRoot, ...options });
  return stable({
    ...report,
    generated_at: generatedAt,
    manifest_role: 'SUCCESSOR_SOURCE_AUTHORITY_MANIFEST_ONLY',
    historical_manifest_semantics: 'PRESERVED'
  });
}

export function renderParityCheckpoint(report) {
  const lines = [
    '# V43 Six-Tender Source Authority Parity V2',
    '',
    'Eval-only successor report. Historical manifests and Gold semantics are unchanged.',
    '',
    `SIX_TENDER_SOURCE_PARITY = ${report.gates.SIX_TENDER_SOURCE_PARITY}`,
    `SOURCE_HASH_MISMATCH = ${report.gates.SOURCE_HASH_MISMATCH}`,
    `UNRESOLVED_TENDER_SOURCE = ${report.gates.UNRESOLVED_TENDER_SOURCE}`,
    `NO_FABRICATED_TENDER_SOURCE = ${report.gates.NO_FABRICATED_TENDER_SOURCE}`,
    '',
    '## Tender rows',
    ''
  ];
  for (const row of report.tenders) {
    lines.push(
      `- ${row.tender_id}: status=${row.status}; lane=${row.packet_lane || 'UNRESOLVED'}; packet_requirements=${row.packet_requirement_count ?? 0}; canonical_requirements=${row.canonical_requirement_count ?? 0}; source_hash_match=${row.source_identity.source_hash_match}; packet_hash_match=${row.source_identity.packet_hash_match}; canonical_source_hash_match=${row.canonical_linkage.source_hash_match}`
    );
  }
  lines.push('', '## Side-effect gates', '', '- provider_calls: 0', '- production_db_writes: 0', '- gold_mutations: 0', '- historical_manifest_untouched: true', '', 'Promotion: NOT_AUTHORIZED_PENDING_HUMAN_AUTHORITY_REVIEW');
  return `${lines.join('\n')}\n`;
}

export function writeParityArtifacts({ repoRoot, outputDir = path.join(repoRoot, 'docs'), generatedAt = null, ...options } = {}) {
  const report = buildSuccessorManifest({ repoRoot, generatedAt, ...options });
  fs.writeFileSync(path.join(outputDir, 'V43_REQUIREMENT_SIX_TENDER_SOURCE_PARITY_V2_MANIFEST.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(path.join(outputDir, 'V43_REQUIREMENT_SIX_TENDER_SOURCE_PARITY_V2_CHECKPOINT.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(path.join(outputDir, 'V43_REQUIREMENT_SIX_TENDER_SOURCE_PARITY_V2_CHECKPOINT.md'), renderParityCheckpoint(report), 'utf8');
  return report;
}

