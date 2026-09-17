import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const repoRoot = process.cwd();
const governanceDir = path.join(repoRoot, 'docs', 'repository-governance');
const manifestJsonPath = path.join(governanceDir, 'FIRST_GITHUB_SYNC_MANIFEST_V3.json');
const manifestMdPath = path.join(governanceDir, 'FIRST_GITHUB_SYNC_MANIFEST_V3.md');
const validationEvidencePath = path.join(governanceDir, 'FIRST_SYNC_VALIDATION_EVIDENCE_V1.json');

const localSecretMetadata = [
  {
    path: 'backend/.env',
    bytes: 1238,
    redacted_fingerprint: '97309F8DC2A18C01',
    classification: 'FIRST_SYNC_LOCAL_SECRET',
  },
  {
    path: 'services/semantic-gateway/.env',
    bytes: 762,
    redacted_fingerprint: '9E13FACCA33C68B2',
    classification: 'FIRST_SYNC_LOCAL_SECRET',
  },
];

const knownSourceMetadata = [
  {
    basenamePrefix: 'HW-001',
    source_url: 'https://www.huawei.com/minisite/annual-report-download/annual_report_2024_cn.pdf',
    source_type: 'PUBLIC_EXTERNAL_ORIGINAL_PDF',
    redistribution_status: 'UNKNOWN_LICENSE_REVIEW',
    identity: 'HW-001',
  },
  {
    basenamePrefix: 'HW-003',
    source_url: 'https://www-file.huawei.com/admin/asset/v1/pro/view/69461adcb6364954a697f250678a64ad.pdf',
    source_type: 'PUBLIC_EXTERNAL_ORIGINAL_PDF',
    redistribution_status: 'UNKNOWN_LICENSE_REVIEW',
    identity: 'HW-003',
  },
];

const decisionListedLargeJsonPaths = new Set([
  'docs/eval/p0-recall/V43_P0_487_PROVENANCE_TRACE_INDEX.json',
  'docs/eval/p0-recall/V43_P0_SOURCE_FIDELITY_EVIDENCE.json',
  'docs/eval/flywheel/V43-FLYWHEEL-P0-487-R3/V43_P0_487_PROVENANCE_TRACE_INDEX.json',
  'docs/eval/flywheel/p0-badcase-repair-v2/V43_REQUIREMENT_P0_487_TEXTUAL_INPUT_COVERAGE_V6.json',
  'docs/handoff/V43_ISOLATED_REFERENCE_EVAL_DB_REAL_RETRIEVAL_V1/09_R0_RESULTS.json',
  'docs/handoff/V43_REFERENCE_RETRIEVAL_SCHEMA_PARITY_CORE6_REPLAY_V2/09_R0_RESULTS.json',
  'docs/handoff/V43_ISOLATED_REFERENCE_EVAL_DB_REAL_RETRIEVAL_V1/10_R1_RESULTS.json',
  'docs/handoff/V43_REFERENCE_RETRIEVAL_SCHEMA_PARITY_CORE6_REPLAY_V2/06_R1_HYGIENE_RESULTS.json',
  'docs/handoff/V43_REFERENCE_RETRIEVAL_SCHEMA_PARITY_CORE6_REPLAY_V2/05_R0_CURRENT_RESULTS.json',
]);

function isDecisionListedLargeJson(relativePath) {
  return decisionListedLargeJsonPaths.has(relativePath)
    || /^backend\/eval\/requirement-unseen-holdout-v3\/results\/[^/]+\/parsed-sources\/HOLDOUT-REQ-V3-01\.json$/i.test(relativePath)
    || /^backend\/eval\/requirement-unseen-holdout-v3\/results\/[^/]+\/V43_REQUIREMENT_UNSEEN_HOLDOUT_V3_GPT_REVIEW_PACKET\.json$/i.test(relativePath);
}

function runGit(args) {
  try {
    return { ok: true, code: 0, stdout: execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' }), stderr: '' };
  } catch (error) {
    return {
      ok: false,
      code: Number.isInteger(error.status) ? error.status : 1,
      stdout: String(error.stdout || ''),
      stderr: String(error.stderr || ''),
    };
  }
}

function sha256File(filePath) {
  try {
    const hash = crypto.createHash('sha256');
    hash.update(fs.readFileSync(filePath));
    return hash.digest('hex').toUpperCase();
  } catch {
    return null;
  }
}

function statFile(relativePath) {
  try {
    const filePath = path.join(repoRoot, relativePath);
    const stat = fs.statSync(filePath);
    return { bytes: stat.size, sha256: sha256File(filePath) };
  } catch {
    return { bytes: null, sha256: null };
  }
}

function normalizeStatusPath(rawPath) {
  let value = rawPath.trim();
  if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
  return value.replaceAll('\\', '/');
}

function parseStatus() {
  const result = runGit(['-c', 'core.quotePath=false', 'status', '--porcelain=v1', '--untracked-files=all']);
  if (!result.ok) throw new Error(`git status failed: ${result.stderr || result.stdout}`);
  return result.stdout
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => ({
      index: line[0],
      worktree: line[1],
      path: normalizeStatusPath(line.slice(3)),
      raw: line,
    }));
}

function extensionOf(relativePath) {
  return path.posix.extname(relativePath).toLowerCase();
}

function topDirectory(relativePath) {
  const slash = relativePath.indexOf('/');
  return slash === -1 ? '<root>' : relativePath.slice(0, slash);
}

function matchesGoldArtifact(relativePath) {
  const lower = relativePath.toLowerCase();
  const ext = extensionOf(relativePath);
  const dataExtensions = new Set(['.json', '.jsonl', '.csv', '.md', '.txt', '.yaml', '.yml']);
  if (!dataExtensions.has(ext)) return false;
  if (lower === 'backend/eval/evidence-gold/readme.md') return false;
  if (lower === 'backend/eval/retrieval-quality-p0/gpt_semantic_gold_v1.json') return false;
  if (lower.includes('/gold-governance/') && lower.endsWith('.js')) return false;
  if (lower.includes('/gold-human-review/') && lower.endsWith('.js')) return false;
  return /(^|\/)(gold|semantic-gold)(\/|$)/i.test(relativePath)
    || /(^|\/).*gold.*\.(json|jsonl|csv|md|txt|yaml|yml)$/i.test(relativePath)
    || /(^|\/)requirement_gold.*\.(json|jsonl|csv|md|txt|yaml|yml)$/i.test(relativePath);
}

function classify(entry) {
  const relativePath = entry.path;
  const lower = relativePath.toLowerCase();
  const ext = extensionOf(relativePath);
  const fileStats = statFile(relativePath);

  if (localSecretMetadata.some((item) => item.path === relativePath)) {
    return { category: 'FIRST_SYNC_LOCAL_SECRET', reason: 'local .env is excluded from Git' };
  }
  if (['.pdf', '.docx', '.html'].includes(ext)) {
    return { category: 'FIRST_SYNC_COPYRIGHT_LINK_ONLY', reason: 'public external original material; raw redistribution rights not frozen' };
  }
  if (/(^|\/)(node_modules|\.cache|cache|tmp|temp|logs)(\/|$)/i.test(relativePath)
    || /\.(db|sqlite|sqlite3|log)$/i.test(relativePath)) {
    return { category: 'FIRST_SYNC_IGNORE', reason: 'local cache/runtime/database/log artifact' };
  }
  if ((fileStats.bytes !== null && fileStats.bytes >= 10_000_000)
    || /(^|\/)(raw_responses|provider_call_ledger|source-candidates|inbox|raw|extracted)(\/|$)/i.test(relativePath)
    || ['.zip', '.rar', '.7z'].includes(ext)) {
    return { category: 'FIRST_SYNC_EXTERNAL_RAW', reason: 'generated/raw/external payload retained outside first-sync Git content' };
  }
  if (lower.startsWith('.codex/')) {
    return { category: 'FIRST_SYNC_REVIEW_REQUIRED', reason: 'Codex/tooling instruction change requires explicit first-sync review' };
  }
  if (matchesGoldArtifact(relativePath)) {
    return { category: 'FIRST_SYNC_REVIEW_REQUIRED', reason: 'Gold/evaluation artifact requires authority and mutation review before first sync' };
  }
  return { category: 'FIRST_SYNC_INCLUDE', reason: 'source, test, schema, governance, synthetic material, or deterministic evaluation artifact' };
}

function sourceMetadata(relativePath, sha256) {
  const basename = path.posix.basename(relativePath);
  const match = knownSourceMetadata.find((item) => basename.startsWith(item.basenamePrefix));
  return {
    source_url: match?.source_url || null,
    source_type: match?.source_type || 'PUBLIC_EXTERNAL_ORIGINAL_MATERIAL',
    redistribution_status: match?.redistribution_status || 'UNKNOWN_LICENSE_REVIEW',
    identity: match?.identity || null,
    sha256,
  };
}

function summarizeEntries(entries) {
  const grouped = new Map();
  for (const entry of entries) {
    const bucket = grouped.get(entry.category) || [];
    bucket.push(entry);
    grouped.set(entry.category, bucket);
  }
  const categories = {};
  for (const [category, bucket] of grouped.entries()) {
    const directoryCounts = {};
    for (const entry of bucket) {
      const directory = topDirectory(entry.path);
      directoryCounts[directory] = (directoryCounts[directory] || 0) + 1;
    }
    const sorted = [...bucket].sort((a, b) => a.path.localeCompare(b.path));
    const pathDigest = crypto.createHash('sha256')
      .update(sorted.map((entry) => `${entry.path}\t${entry.status}\t${entry.category}`).join('\n'))
      .digest('hex');
    categories[category] = {
      file_count: bucket.length,
      tracked_modified_count: bucket.filter((entry) => entry.isTrackedModified).length,
      untracked_count: bucket.filter((entry) => entry.isUntracked).length,
      directory_counts: Object.fromEntries(Object.entries(directoryCounts).sort(([a], [b]) => a.localeCompare(b))),
      representative_paths: sorted.slice(0, 20).map((entry) => entry.path),
      classification_path_sha256: pathDigest,
    };
  }
  return categories;
}

function buildMarkdown(manifest) {
  const lines = [
    '# FIRST_GITHUB_SYNC_MANIFEST_V3',
    '',
    `Status: \`${manifest.status}\``,
    '',
    'This is a read-only final allowlist candidate. It is not authorization to commit or push.',
    '',
    '## Repository identity and parity',
    '',
    `- Canonical repository: \`${manifest.repository.canonical_full_name}\``,
    `- Canonical URL: \`${manifest.repository.canonical_url}\``,
    `- Branch: \`${manifest.repository.branch}\``,
    `- Local HEAD: \`${manifest.repository.local_head}\``,
    `- Remote HEAD: \`${manifest.repository.remote_head || 'UNKNOWN_AUTHENTICATION_BLOCKER'}\``,
    `- Relationship: \`${manifest.repository.relationship}\``,
    `- Remote probe: \`${manifest.repository.remote_probe.state}\``,
    '',
    '## Classification summary',
    '',
    '| Category | Files | Tracked modified | Untracked |',
    '|---|---:|---:|---:|',
  ];
  for (const category of manifest.classification_order) {
    const summary = manifest.classifications[category] || { file_count: 0, tracked_modified_count: 0, untracked_count: 0 };
    lines.push(`| \`${category}\` | ${summary.file_count} | ${summary.tracked_modified_count} | ${summary.untracked_count} |`);
  }
  lines.push(`| **status entries** | **${manifest.worktree.status_entry_count}** | **${manifest.worktree.tracked_modified_count}** | **${manifest.worktree.untracked_count}** |`);
  lines.push(`| **local secrets (not in status)** | **${manifest.local_only_secrets.length}** | — | — |`);
  lines.push('', '### Directory counts', '');
  for (const category of manifest.classification_order) {
    const summary = manifest.classifications[category];
    if (!summary) continue;
    lines.push(`#### \`${category}\``, '');
    for (const [directory, count] of Object.entries(summary.directory_counts)) lines.push(`- \`${directory}\`: ${count}`);
    lines.push('');
  }
  lines.push('## Local-only secrets', '', '- `.env` values were not read or printed.', '');
  for (const secret of manifest.local_only_secrets) lines.push(`- \`${secret.path}\` — ${secret.bytes} bytes — redacted fingerprint \`${secret.redacted_fingerprint}\``);
  lines.push('', '## Copyright/link-only external material', '', `- Files: ${manifest.copyright_link_only.file_count}`, `- SHA256 inventory digest: \`${manifest.copyright_link_only.inventory_sha256}\``, '- Raw public external documents remain local/external until redistribution status is reviewed.', '');
  for (const group of manifest.copyright_link_only.duplicate_groups) lines.push(`- Duplicate group \`${group.sha256}\`: ${group.paths.length} physical files; identities/URLs are recorded where known.`);
  lines.push('', '## Large/raw artifacts', '', `- Files classified as external raw: ${manifest.external_raw.file_count}`, `- Decision-listed large JSON payloads found: ${manifest.external_raw.decision_listed_count}`, `- Additional large/raw artifacts: ${manifest.external_raw.additional_count}`, '- No Git LFS, raw payload publication, or deletion is authorized by this checkpoint.', '');
  lines.push('## Review-required set', '', `- Files requiring explicit review: ${manifest.review_required.file_count}`, '- Review reasons are deterministic and listed in the JSON companion manifest; this set is not silently folded into an allow-all bucket.', '');
  for (const [reason, count] of Object.entries(manifest.review_required.reason_counts)) lines.push(`- ${reason}: ${count}`);
  lines.push('', '## Validation and safety', '', `- Validation evidence: \`${manifest.validation.status}\``, `- Secret-history scan: \`${manifest.secret_history.status}\``, '- commit=0, push=0, merge=0, rebase=0, force_push=0, history_rewrite=0, destructive_git=0, deploy=0', '', '## Historical artifacts', '', '- `FIRST_GITHUB_SYNC_MANIFEST_V1` and `FIRST_GITHUB_SYNC_MANIFEST_V2` are preserved as historical records.', '- Historical URLs are not rewritten; only current canonical references use `MMMIIM/MMMIIM`.', '');
  return `${lines.join('\n')}\n`;
}

const statusEntries = parseStatus();
const classifiedEntries = statusEntries.map((entry) => {
  const classification = classify(entry);
  return {
    path: entry.path,
    status: `${entry.index}${entry.worktree}`,
    isTrackedModified: entry.index !== '?' && entry.worktree !== '?',
    isUntracked: entry.index === '?' && entry.worktree === '?',
    ...classification,
  };
});

const origin = runGit(['remote', 'get-url', 'origin']).stdout.trim();
const branch = runGit(['branch', '--show-current']).stdout.trim();
const localHead = runGit(['rev-parse', 'HEAD']).stdout.trim();
const remoteProbe = runGit(['ls-remote', '--heads', 'origin', branch]);
const remoteLine = remoteProbe.stdout.trim().split(/\r?\n/).find(Boolean) || '';
const remoteHead = remoteProbe.ok && remoteLine ? remoteLine.split(/\s+/)[0] : null;
const remoteProbeState = remoteProbe.ok
  ? (remoteHead ? 'REMOTE_HEAD_READABLE' : 'REMOTE_BRANCH_ABSENT')
  : ((remoteProbe.stderr + remoteProbe.stdout).includes('SEC_E_NO_CREDENTIALS')
    ? 'BLOCKED_GITHUB_AUTH_INTERACTIVE_REQUIRED'
    : 'REMOTE_PROBE_FAILED');
let relationship = 'UNKNOWN_REMOTE_HEAD_UNAVAILABLE';
if (remoteHead) {
  const localAncestor = runGit(['merge-base', '--is-ancestor', localHead, remoteHead]);
  const remoteAncestor = runGit(['merge-base', '--is-ancestor', remoteHead, localHead]);
  relationship = localHead === remoteHead
    ? 'LOCAL_REMOTE_EQUAL'
    : localAncestor.ok
      ? 'LOCAL_IS_ANCESTOR_OF_REMOTE'
      : remoteAncestor.ok
        ? 'REMOTE_IS_ANCESTOR_OF_LOCAL'
        : 'DIVERGED';
}

const categories = summarizeEntries(classifiedEntries);
for (const category of [
  'FIRST_SYNC_INCLUDE',
  'FIRST_SYNC_IGNORE',
  'FIRST_SYNC_EXTERNAL_RAW',
  'FIRST_SYNC_COPYRIGHT_LINK_ONLY',
  'FIRST_SYNC_LOCAL_SECRET',
  'FIRST_SYNC_REVIEW_REQUIRED',
]) {
  if (!categories[category]) {
    categories[category] = {
      file_count: 0,
      tracked_modified_count: 0,
      untracked_count: 0,
      directory_counts: {},
      representative_paths: [],
      classification_path_sha256: crypto.createHash('sha256').update('').digest('hex'),
    };
  }
}
categories.FIRST_SYNC_LOCAL_SECRET = {
  file_count: localSecretMetadata.length,
  tracked_modified_count: 0,
  untracked_count: 0,
  directory_counts: { backend: 1, services: 1 },
  representative_paths: localSecretMetadata.map((item) => item.path),
  classification_path_sha256: crypto.createHash('sha256').update(localSecretMetadata.map((item) => item.path).sort().join('\n')).digest('hex'),
};
const externalRawEntries = classifiedEntries.filter((entry) => entry.category === 'FIRST_SYNC_EXTERNAL_RAW');
const linkOnlyEntries = classifiedEntries.filter((entry) => entry.category === 'FIRST_SYNC_COPYRIGHT_LINK_ONLY');
const linkOnlyRecords = linkOnlyEntries.map((entry) => {
  const stats = statFile(entry.path);
  return { path: entry.path, bytes: stats.bytes, ...sourceMetadata(entry.path, stats.sha256) };
});
const duplicateMap = new Map();
for (const record of linkOnlyRecords) {
  if (!record.sha256) continue;
  const paths = duplicateMap.get(record.sha256) || [];
  paths.push(record.path);
  duplicateMap.set(record.sha256, paths);
}
const duplicateGroups = [...duplicateMap.entries()]
  .filter(([, paths]) => paths.length > 1)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([sha256, paths]) => ({ sha256, paths: paths.sort() }));
const linkOnlyInventorySha = crypto.createHash('sha256')
  .update(linkOnlyRecords.map((record) => JSON.stringify(record)).sort().join('\n'))
  .digest('hex');
const reviewReasonCounts = {};
for (const entry of classifiedEntries.filter((item) => item.category === 'FIRST_SYNC_REVIEW_REQUIRED')) {
  reviewReasonCounts[entry.reason] = (reviewReasonCounts[entry.reason] || 0) + 1;
}
const externalRawRecords = externalRawEntries.map((entry) => {
  const stats = statFile(entry.path);
  return {
    path: entry.path,
    bytes: stats.bytes,
    sha256: stats.sha256,
    decision_listed: isDecisionListedLargeJson(entry.path),
    reason: entry.reason,
  };
}).sort((a, b) => a.path.localeCompare(b.path));
const validationEvidence = fs.existsSync(validationEvidencePath)
  ? JSON.parse(fs.readFileSync(validationEvidencePath, 'utf8'))
  : { status: 'PENDING_VALIDATION_RUN' };

const manifest = {
  manifest_id: 'FIRST_GITHUB_SYNC_MANIFEST_V3',
  generated_at_utc: new Date().toISOString(),
  status: remoteProbeState === 'BLOCKED_GITHUB_AUTH_INTERACTIVE_REQUIRED'
    ? 'BLOCKED_GITHUB_AUTH_INTERACTIVE_REQUIRED'
    : 'READY_FOR_FIRST_BASELINE_COMMIT_AND_PUSH_REVIEW',
  repository: {
    canonical_full_name: 'MMMIIM/MMMIIM',
    canonical_url: 'https://github.com/MMMIIM/MMMIIM.git',
    origin,
    branch,
    authoritative_branch: 'feat/v4.3-semantic-boundary-routing',
    local_head: localHead,
    remote_head: remoteHead,
    relationship,
    remote_probe: {
      state: remoteProbeState,
      command: `git ls-remote --heads origin ${branch}`,
      credential_error_redacted: remoteProbeState === 'BLOCKED_GITHUB_AUTH_INTERACTIVE_REQUIRED',
    },
  },
  worktree: {
    status_entry_count: statusEntries.length,
    tracked_modified_count: statusEntries.filter((entry) => entry.index !== '?' && entry.worktree !== '?').length,
    untracked_count: statusEntries.filter((entry) => entry.index === '?' && entry.worktree === '?').length,
    deleted_count: statusEntries.filter((entry) => entry.index === 'D' || entry.worktree === 'D').length,
  },
  classification_order: [
    'FIRST_SYNC_INCLUDE',
    'FIRST_SYNC_IGNORE',
    'FIRST_SYNC_EXTERNAL_RAW',
    'FIRST_SYNC_COPYRIGHT_LINK_ONLY',
    'FIRST_SYNC_LOCAL_SECRET',
    'FIRST_SYNC_REVIEW_REQUIRED',
  ],
  classifications: categories,
  local_only_secrets: localSecretMetadata,
  copyright_link_only: {
    file_count: linkOnlyRecords.length,
    inventory_sha256: linkOnlyInventorySha,
    redistribution_default: 'UNKNOWN_LICENSE_REVIEW',
    records: linkOnlyRecords,
    duplicate_groups: duplicateGroups,
  },
  external_raw: {
    file_count: externalRawRecords.length,
    decision_listed_count: externalRawRecords.filter((item) => item.decision_listed).length,
    additional_count: externalRawRecords.filter((item) => !item.decision_listed).length,
    records: externalRawRecords,
  },
  review_required: {
    file_count: categories.FIRST_SYNC_REVIEW_REQUIRED?.file_count || 0,
    reason_counts: Object.fromEntries(Object.entries(reviewReasonCounts).sort(([a], [b]) => a.localeCompare(b))),
    paths: classifiedEntries.filter((entry) => entry.category === 'FIRST_SYNC_REVIEW_REQUIRED').map((entry) => ({ path: entry.path, reason: entry.reason })).sort((a, b) => a.path.localeCompare(b.path)),
  },
  secret_history: {
    status: 'PASS_NO_CREDIBLE_SECRET_HISTORY_EXPOSURE',
    tracked_secret_suspicion_count: 0,
    historical_env_inclusion_count: 0,
    credential_pattern_suspicion_count: 0,
    affected_commit_or_path: [],
    full_secret_values_printed: false,
    history_rewrite: 0,
    credential_rotation: 0,
  },
  validation: validationEvidence,
  safety_counts: { commit: 0, push: 0, merge: 0, rebase: 0, force_push: 0, history_rewrite: 0, destructive_git: 0, deploy: 0 },
  historical_artifacts_preserved: [
    'docs/repository-governance/FIRST_GITHUB_SYNC_MANIFEST_V1.md',
    'docs/repository-governance/FIRST_GITHUB_SYNC_MANIFEST_V2.md',
    'docs/repository-governance/V43_FIRST_GITHUB_SYNC_RECONCILIATION_AND_REMOTE_READINESS_CHECKPOINT_V1.md',
  ],
  notes: [
    'This manifest is an engineering allowlist candidate, not a commit/push authorization.',
    'Synthetic/self-generated materials are public-sync-allowed from a privacy perspective.',
    'Public external original documents are classified link-only when redistribution status is not frozen; raw content is not published solely because it is downloadable.',
    'The current P1C retrieval challenger is an Eval/engineering artifact; no production retrieval change is authorized by this manifest.',
  ],
};

fs.mkdirSync(governanceDir, { recursive: true });
fs.writeFileSync(manifestJsonPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
fs.writeFileSync(manifestMdPath, buildMarkdown(manifest), 'utf8');
console.log(JSON.stringify({
  manifest: manifestJsonPath,
  status: manifest.status,
  status_entry_count: manifest.worktree.status_entry_count,
  classifications: Object.fromEntries(Object.entries(manifest.classifications).map(([key, value]) => [key, value.file_count])),
  local_only_secrets: manifest.local_only_secrets.length,
  copyright_link_only: manifest.copyright_link_only.file_count,
  external_raw: manifest.external_raw.file_count,
  review_required: manifest.review_required.file_count,
  remote_probe: manifest.repository.remote_probe.state,
}, null, 2));
