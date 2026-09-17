import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createEvalEvidenceSink, isEvidenceSinkSafe } from '../../src/eval/flywheel/evidence-sink.js';

test('default EvalEvidenceSink is no-op', async () => {
  const sink = createEvalEvidenceSink();
  const result = await sink.capture('RAW_CANDIDATE_SNAPSHOT', { text: 'safe' });
  assert.equal(result.captured, false);
  assert.equal(result.artifact_ref, null);
});

test('restricted sink stores only redacted immutable evidence refs', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'flywheel-evidence-'));
  const sink = createEvalEvidenceSink({ mode: 'restricted', rootDir: root, evalRunId: 'run-a' });
  const result = await sink.capture('RAW_PROVIDER_RESPONSE_SNAPSHOT', { value: 'semantic', api_key: 'sk-secret', authorization: 'Bearer token', notes: 'authorization: Bearer token' });
  assert.equal(result.captured, true);
  assert.equal(isEvidenceSinkSafe(fs.readFileSync(result.artifact_ref.path_or_key, 'utf8')), true);
  const content = fs.readFileSync(result.artifact_ref.path_or_key, 'utf8');
  assert.doesNotMatch(content, /sk-secret|Bearer token/);
  assert.throws(() => createEvalEvidenceSink({ mode: 'restricted', rootDir: path.join(process.cwd(), 'docs') }), (error) => error?.code === 'RESTRICTED_EVIDENCE_ROOT_UNSAFE');
});
