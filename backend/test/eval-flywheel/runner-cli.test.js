import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

test('flywheel CLI rejects unknown commands without external calls', () => {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
  const runnerPath = path.join(repoRoot, 'backend/eval/flywheel/runner.js');
  const result = spawnSync(process.execPath, [runnerPath, 'unknown-command'], { cwd: repoRoot, encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(`${result.stderr}${result.stdout}`, /Unknown flywheel command/);
});
