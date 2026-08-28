import { spawnSync } from 'node:child_process';

function runGit(args) {
  const result = spawnSync('git', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true
  });
  return {
    status: Number.isInteger(result.status) ? result.status : 1,
    stdout: result.stdout || '',
    stderr: result.stderr || ''
  };
}

export function readRuntimeSourceIdentity(run = runGit) {
  const revisionResult = run(['rev-parse', '--short', 'HEAD']);
  const statusResult = run(['status', '--porcelain']);
  const revision = revisionResult.status === 0 ? revisionResult.stdout.trim() : '';
  const statusAvailable = statusResult.status === 0;
  return {
    revision: revision || null,
    workingTreeDirty: statusAvailable ? statusResult.stdout.trim().length > 0 : null
  };
}

export function applyRuntimeSourceIdentity(env = process.env, run = runGit) {
  const identity = readRuntimeSourceIdentity(run);
  if (!env.SEMANTIC_GATEWAY_COMMIT && identity.revision) {
    env.SEMANTIC_GATEWAY_COMMIT = identity.revision;
  }
  if (!env.SEMANTIC_GATEWAY_WORKTREE_DIRTY && typeof identity.workingTreeDirty === 'boolean') {
    env.SEMANTIC_GATEWAY_WORKTREE_DIRTY = identity.workingTreeDirty ? 'true' : 'false';
  }
  return identity;
}
