import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const repoRoot = process.cwd();
const governanceDir = path.join(repoRoot, 'docs', 'repository-governance');
const v3Path = path.join(governanceDir, 'FIRST_GITHUB_SYNC_MANIFEST_V3.json');
const outputJsonPath = path.join(governanceDir, 'FIRST_GITHUB_SYNC_MANIFEST_V4.json');
const outputMdPath = path.join(governanceDir, 'FIRST_GITHUB_SYNC_MANIFEST_V4.md');
const allowlistPath = path.join(governanceDir, 'FIRST_GITHUB_SYNC_MANIFEST_V4_ALLOWLIST.txt');
const localSecrets = [
  { path: 'backend/.env', classification: 'FIRST_SYNC_LOCAL_SECRET' },
  { path: 'services/semantic-gateway/.env', classification: 'FIRST_SYNC_LOCAL_SECRET' },
];
const knownOutputs = [
  'docs/repository-governance/build-first-sync-v4-manifest.mjs',
  'docs/repository-governance/FIRST_GITHUB_SYNC_MANIFEST_V4.json',
  'docs/repository-governance/FIRST_GITHUB_SYNC_MANIFEST_V4.md',
  'docs/repository-governance/FIRST_GITHUB_SYNC_MANIFEST_V4_ALLOWLIST.txt',
];

function runGit(args) {
  return execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' });
}

function sha256File(relativePath) {
  try {
    return crypto.createHash('sha256').update(fs.readFileSync(path.join(repoRoot, relativePath))).digest('hex').toUpperCase();
  } catch {
    return null;
  }
}

function fileRecord(relativePath) {
  try {
    const stat = fs.statSync(path.join(repoRoot, relativePath));
    return { bytes: stat.size, sha256: sha256File(relativePath) };
  } catch {
    return { bytes: null, sha256: null };
  }
}

function topDirectory(relativePath) {
  const index = relativePath.indexOf('/');
  return index === -1 ? '<root>' : relativePath.slice(0, index);
}

function extensionOf(relativePath) {
  return path.posix.extname(relativePath).toLowerCase();
}

function matchesGoldArtifact(relativePath) {
  const lower = relativePath.toLowerCase();
  const ext = extensionOf(relativePath);
  if (!new Set(['.json', '.jsonl', '.csv', '.md', '.txt', '.yaml', '.yml']).has(ext)) return false;
  if (lower === 'backend/eval/evidence-gold/readme.md') return false;
  if (lower === 'backend/eval/retrieval-quality-p0/gpt_semantic_gold_v1.json') return false;
  if (lower.includes('/gold-governance/') && lower.endsWith('.js')) return false;
  if (lower.includes('/gold-human-review/') && lower.endsWith('.js')) return false;
  return /(^|\/)(gold|semantic-gold)(\/|$)/i.test(relativePath)
    || /(^|\/).*gold.*\.(json|jsonl|csv|md|txt|yaml|yml)$/i.test(relativePath)
    || /(^|\/)requirement_gold.*\.(json|jsonl|csv|md|txt|yaml|yml)$/i.test(relativePath);
}

function classify(relativePath) {
  const lower = relativePath.toLowerCase();
  const ext = extensionOf(relativePath);
  const stats = fileRecord(relativePath);
  if (localSecrets.some((item) => item.path === relativePath)) {
    return { category: 'FIRST_SYNC_LOCAL_SECRET', reason: 'local .env is excluded from Git' };
  }
  if (['.pdf', '.docx', '.html'].includes(ext)) {
    return { category: 'FIRST_SYNC_COPYRIGHT_LINK_ONLY', reason: 'public external original material; raw redistribution rights not frozen' };
  }
  if (/(^|\/)(node_modules|\.cache|cache|tmp|temp|logs)(\/|$)/i.test(relativePath)
    || /\.(db|sqlite|sqlite3|log)$/i.test(relativePath)) {
    return { category: 'FIRST_SYNC_IGNORE', reason: 'local cache/runtime/database/log artifact' };
  }
  if ((stats.bytes !== null && stats.bytes >= 10_000_000)
    || /(^|\/)(raw_responses|provider_call_ledger|source-candidates|inbox|raw|extracted)(\/|$)/i.test(relativePath)
    || ['.zip', '.rar', '.7z'].includes(ext)) {
    return { category: 'FIRST_SYNC_EXTERNAL_RAW', reason: 'generated/raw/external payload retained outside first-sync Git content' };
  }
  if (lower.startsWith('.codex/')) {
    return { category: 'FIRST_SYNC_INCLUDE', original_classification: 'FIRST_SYNC_REVIEW_REQUIRED', reason: 'GPT-approved project-local Codex governance skill; authority preserved, not Gold promotion' };
  }
  if (matchesGoldArtifact(relativePath)) {
    return { category: 'FIRST_SYNC_INCLUDE', original_classification: 'FIRST_SYNC_REVIEW_REQUIRED', reason: 'GPT-approved Gold/Eval/Human Review artifact; authority preserved, not Gold promotion' };
  }
  return { category: 'FIRST_SYNC_INCLUDE', reason: 'source, test, schema, governance, synthetic material, or deterministic evaluation artifact' };
}

function parseStatus() {
  return runGit(['-c', 'core.quotePath=false', 'status', '--porcelain=v1', '--untracked-files=all'])
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => ({ status: line.slice(0, 2), path: line.slice(3).replaceAll('\\', '/') }));
}

function entryFor(item) {
  const classified = classify(item.path);
  const record = fileRecord(item.path);
  return {
    path: item.path,
    status: item.status,
    bytes: record.bytes,
    sha256: record.sha256,
    is_tracked_modified: item.status[0] !== '?' && item.status[1] !== '?',
    is_untracked: item.status === '??',
    ...classified,
  };
}

function summarize(entries) {
  const result = {};
  for (const category of ['FIRST_SYNC_INCLUDE', 'FIRST_SYNC_IGNORE', 'FIRST_SYNC_EXTERNAL_RAW', 'FIRST_SYNC_COPYRIGHT_LINK_ONLY']) {
    const bucket = entries.filter((item) => item.category === category).sort((a, b) => a.path.localeCompare(b.path));
    const directoryCounts = {};
    for (const item of bucket) directoryCounts[topDirectory(item.path)] = (directoryCounts[topDirectory(item.path)] || 0) + 1;
    const digest = crypto.createHash('sha256').update(bucket.map((item) => `${item.path}\t${item.status}\t${item.category}`).join('\n')).digest('hex');
    result[category] = {
      file_count: bucket.length,
      tracked_modified_count: bucket.filter((item) => item.is_tracked_modified).length,
      untracked_count: bucket.filter((item) => item.is_untracked).length,
      directory_counts: Object.fromEntries(Object.entries(directoryCounts).sort(([a], [b]) => a.localeCompare(b))),
      classification_path_sha256: digest,
      paths: bucket.map((item) => item.path),
      records: bucket,
    };
  }
  return result;
}

function markdown(manifest) {
  const rows = manifest.classification_order.map((category) => {
    const item = manifest.classifications[category];
    return `| \`${category}\` | ${item.file_count} | ${item.tracked_modified_count} | ${item.untracked_count} |`;
  }).join('\n');
  const dirs = manifest.classification_order.map((category) => {
    const item = manifest.classifications[category];
    return `### ${category}\n\n${Object.entries(item.directory_counts).map(([dir, count]) => `- \`${dir}\`: ${count}`).join('\n')}`;
  }).join('\n\n');
  return `# FIRST_GITHUB_SYNC_MANIFEST_V4

Status: \`READY_FOR_FIRST_BASELINE_COMMIT_AND_LOCAL_RECONCILIATION\`

This is the GPT-authorized exact first-sync allowlist. Git inclusion does not
promote Gold, Eval, Human Review, or holdout artifacts. Previous V3 review
entries are included only with authority-preserving metadata.

## Repository and divergence

- Canonical repository: \`${manifest.repository.canonical_full_name}\`
- Origin: \`${manifest.repository.origin}\`
- Branch: \`${manifest.repository.branch}\`
- Local HEAD before baseline commit: \`${manifest.repository.local_head}\`
- Remote HEAD: \`${manifest.repository.remote_head}\`
- Merge base: \`${manifest.repository.merge_base}\`
- AUTH_BLOCKER: \`CLOSED\`
- DIVERGENCE: \`RESOLVED_PENDING_LOCAL_HISTORY_RECONCILIATION\`
- GOVERNANCE_RULE_PORT: \`PASS\`

## Classification summary

| Category | Files | Tracked modified | Untracked |
|---|---:|---:|---:|
${rows}
| **all status entries** | **${manifest.worktree.status_entry_count}** | **${manifest.worktree.tracked_modified_count}** | **${manifest.worktree.untracked_count}** |

${dirs}

## Resolved review set

- Previous V3 review-required entries: ${manifest.review_resolution.previous_count}
- Resolved into FIRST_SYNC_INCLUDE: ${manifest.review_resolution.resolved_count}
- Unresolved review-required entries: ${manifest.review_resolution.unresolved_count}
- FIRST_SYNC_INCLUDE paths: ${manifest.classifications.FIRST_SYNC_INCLUDE.file_count}
- Exact NUL-delimited staging allowlist: \`FIRST_GITHUB_SYNC_MANIFEST_V4_ALLOWLIST.txt\`

## Exclusions

- Local secret paths: ${manifest.local_only_secrets.map((item) => `\`${item.path}\``).join(', ')}
- External raw files: ${manifest.classifications.FIRST_SYNC_EXTERNAL_RAW.file_count}
- Copyright/link-only originals: ${manifest.classifications.FIRST_SYNC_COPYRIGHT_LINK_ONLY.file_count}
- No raw excluded document contents are embedded in this manifest.

## Baseline gates

- Staging must use only the exact allowlist; no \`git add .\`.
- Staged .env, secret, external raw, and copyright/link-only counts must be zero.
- Run staged secret scan and \`git diff --check\` before commit.
- Backend full-suite status remains \`KNOWN_TEST_DEBT\`; release certification remains blocked.

## Safety

No commit, push, merge, rebase, reset, force push, clean, or deploy is recorded
by this manifest generator. The only later authorized history action is the
single audited \`git merge -s ours --no-ff origin/feat/v4.3-semantic-boundary-routing\`.
`;
}

const v3 = JSON.parse(fs.readFileSync(v3Path, 'utf8'));
const statusEntries = parseStatus();
const entries = statusEntries.map(entryFor);
const classifications = summarize(entries);
const includePaths = new Set(classifications.FIRST_SYNC_INCLUDE.paths);
for (const output of knownOutputs) includePaths.add(output);
const previousReviewPaths = (v3.review_required?.paths || []).map((item) => item.path);
const resolvedReviewPaths = previousReviewPaths.filter((item) => includePaths.has(item));
const unresolvedReviewPaths = previousReviewPaths.filter((item) => !includePaths.has(item));
const localOnlySecrets = localSecrets.map((item) => ({ ...item, ...fileRecord(item.path) }));
const externalRecords = classifications.FIRST_SYNC_EXTERNAL_RAW.records;
const copyrightRecords = classifications.FIRST_SYNC_COPYRIGHT_LINK_ONLY.records;
const remoteHead = runGit(['rev-parse', 'origin/feat/v4.3-semantic-boundary-routing']).trim();
const localHead = runGit(['rev-parse', 'HEAD']).trim();
const mergeBase = runGit(['merge-base', localHead, remoteHead]).trim();
const manifest = {
  manifest_id: 'FIRST_GITHUB_SYNC_MANIFEST_V4',
  status: 'READY_FOR_FIRST_BASELINE_COMMIT_AND_LOCAL_RECONCILIATION',
  generated_at_utc: new Date().toISOString(),
  repository: {
    canonical_full_name: 'MMMIIM/MMMIIM',
    canonical_url: 'https://github.com/MMMIIM/MMMIIM.git',
    origin: runGit(['remote', 'get-url', 'origin']).trim(),
    branch: runGit(['branch', '--show-current']).trim(),
    local_head: localHead,
    remote_head: remoteHead,
    merge_base: mergeBase,
  },
  worktree: {
    status_entry_count: statusEntries.length,
    tracked_modified_count: statusEntries.filter((item) => item.status[0] !== '?' && item.status[1] !== '?').length,
    untracked_count: statusEntries.filter((item) => item.status === '??').length,
  },
  classification_order: ['FIRST_SYNC_INCLUDE', 'FIRST_SYNC_IGNORE', 'FIRST_SYNC_EXTERNAL_RAW', 'FIRST_SYNC_COPYRIGHT_LINK_ONLY'],
  classifications,
  local_only_secrets: localOnlySecrets,
  review_resolution: {
    previous_manifest: 'FIRST_GITHUB_SYNC_MANIFEST_V3',
    previous_count: previousReviewPaths.length,
    resolved_count: resolvedReviewPaths.length,
    unresolved_count: unresolvedReviewPaths.length,
    unresolved_paths: unresolvedReviewPaths,
    resolved_paths: resolvedReviewPaths,
    semantics: 'SYNC_ALLOWED_AS_EXISTING_PROJECT_ARTIFACTS; GIT_INCLUSION != GOLD_PROMOTION',
  },
  external_raw: { file_count: externalRecords.length, records: externalRecords },
  copyright_link_only: { file_count: copyrightRecords.length, records: copyrightRecords },
  secret_history: v3.secret_history,
  validation: { status: 'FIRST_BASELINE_SNAPSHOT_GATE_PASS_WITH_KNOWN_TEST_DEBT', release_certification: 'BLOCKED' },
  safety_counts: { commit: 0, push: 0, merge: 0, rebase: 0, reset: 0, force_push: 0, history_rewrite: 0, destructive_git: 0, clean: 0, deploy: 0 },
  exclusions_preserved: ['FIRST_SYNC_LOCAL_SECRET', 'FIRST_SYNC_EXTERNAL_RAW', 'FIRST_SYNC_COPYRIGHT_LINK_ONLY'],
  allowlist_path: 'docs/repository-governance/FIRST_GITHUB_SYNC_MANIFEST_V4_ALLOWLIST.txt',
};

fs.mkdirSync(governanceDir, { recursive: true });
fs.writeFileSync(outputJsonPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
fs.writeFileSync(outputMdPath, markdown(manifest), 'utf8');
const finalPaths = [...includePaths].sort((a, b) => a.localeCompare(b));
fs.writeFileSync(allowlistPath, Buffer.from(`${finalPaths.join('\0')}\0`, 'utf8'));
console.log(JSON.stringify({
  manifest_id: manifest.manifest_id,
  include_count: finalPaths.length,
  external_raw_count: externalRecords.length,
  copyright_link_only_count: copyrightRecords.length,
  local_secret_count: localOnlySecrets.length,
  previous_review_count: previousReviewPaths.length,
  unresolved_review_count: unresolvedReviewPaths.length,
  remote_head: remoteHead,
  merge_base: mergeBase,
}, null, 2));
