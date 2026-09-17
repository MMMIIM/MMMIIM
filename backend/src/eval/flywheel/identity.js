import { sha256, hashJson } from './contract.js';

function safeFingerprintText(value) {
  return String(value ?? '')
    .split(/\r?\n/)
    .filter((line) => !/(^|[\\/])(?:\.env(?:\.|$)|.*(?:secret|credential|apikey|api_key|token|authorization))/i.test(line))
    .map((line) => line.replace(/(authorization|bearer|api[_-]?key|secret|token)\s*[:=]\s*\S+/ig, '$1=<redacted>'))
    .join('\n');
}

export function buildDirtyWorktreeIdentity({
  gitHead = null,
  statusText = '',
  diffText = '',
  untrackedManifest = ''
} = {}) {
  const safeStatus = safeFingerprintText(statusText);
  const safeDiff = safeFingerprintText(diffText);
  const safeUntracked = safeFingerprintText(untrackedManifest);
  return {
    git_head: gitHead || null,
    git_dirty: Boolean(String(statusText).trim()),
    git_status_sha256: `sha256:${sha256(safeStatus)}`,
    git_diff_sha256: `sha256:${sha256(safeDiff)}`,
    git_untracked_manifest_sha256: `sha256:${sha256(safeUntracked)}`
  };
}

export function buildRunIdentityHash(value) {
  return hashJson(value);
}

export function compareRunIdentity(left, right) {
  const a = buildRunIdentityHash(left);
  const b = buildRunIdentityHash(right);
  return { equal: a === b, left: a, right: b };
}
