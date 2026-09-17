import test from 'node:test';
import assert from 'node:assert/strict';
import { buildArtifactManifest, snapshotArtifact } from '../../src/eval/flywheel/artifact-snapshot.js';

test('artifact snapshot and manifest hashes are deterministic', () => {
  const first = snapshotArtifact({ bytes: 'fixture', producer: 'test' });
  const second = snapshotArtifact({ bytes: 'fixture', producer: 'test' });
  assert.equal(first.sha256, second.sha256);
  assert.equal(buildArtifactManifest([first]).sha256, buildArtifactManifest([second]).sha256);
});
