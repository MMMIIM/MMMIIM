import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { sha256, stableSerialize } from './contract.js';

export function hashBytes(value) {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

export function snapshotArtifact({ filePath = null, path: artifactPath = null, bytes = null, mediaType = 'application/json', producer = 'eval-flywheel', sourceRunId = null, redactionPolicy = 'registry-safe' } = {}) {
  const resolved = (filePath || artifactPath) ? path.resolve(filePath || artifactPath) : null;
  const content = bytes ?? (resolved && fs.existsSync(resolved) ? fs.readFileSync(resolved) : null);
  if (content === null || content === undefined) throw Object.assign(new Error('Artifact bytes are unavailable.'), { code: 'ARTIFACT_NOT_FOUND' });
  const buffer = Buffer.isBuffer(content) ? content : Buffer.from(String(content), 'utf8');
  return {
    artifact_id: `artifact:${sha256(`${resolved || '<memory>'}:${hashBytes(buffer)}`)}`,
    path_or_key: resolved,
    byte_length: buffer.byteLength,
    sha256: hashBytes(buffer),
    media_type: mediaType,
    producer,
    captured_at: new Date().toISOString(),
    source_run_id: sourceRunId,
    redaction_policy: redactionPolicy
  };
}

export function buildArtifactManifest(entries = []) {
  const sorted = [...entries].sort((a, b) => String(a.artifact_id).localeCompare(String(b.artifact_id)));
  const value = { artifact_version: 'v1', entries: sorted };
  const identityValue = {
    artifact_version: value.artifact_version,
    entries: sorted.map((entry) => {
      const { captured_at, ...immutable } = entry;
      return immutable;
    })
  };
  return { ...value, sha256: `sha256:${sha256(stableSerialize(identityValue))}` };
}
