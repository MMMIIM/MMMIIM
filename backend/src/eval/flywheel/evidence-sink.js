import fs from 'node:fs';
import path from 'node:path';
import { snapshotArtifact } from './artifact-snapshot.js';

export const EVIDENCE_STAGES = Object.freeze([
  'PROVIDER_INPUT_SNAPSHOT',
  'RAW_PROVIDER_RESPONSE_SNAPSHOT',
  'RAW_CANDIDATE_SNAPSHOT',
  'NORMALIZED_CANDIDATE_SNAPSHOT',
  'CANONICALIZATION_DECISION_SNAPSHOT',
  'SOURCE_RESOLUTION_SNAPSHOT',
  'CANONICAL_OUTPUT_SNAPSHOT'
]);

const SECRET_KEY = /(api[_-]?key|authorization|bearer|password|secret|credential|access[_-]?token|refresh[_-]?token)/i;
const SECRET_VALUE = /((?:bearer|api[_-]?key|authorization|secret|token)\s*[:=]\s*)[^\s,;]+/ig;

function redact(value) {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value)
      .filter(([key]) => !SECRET_KEY.test(key))
      .map(([key, nested]) => [key, redact(nested)]));
  }
  return typeof value === 'string' ? value.replace(SECRET_VALUE, '$1<redacted>') : value;
}

export function createEvalEvidenceSink({ mode = 'noop', rootDir = null, evalRunId = 'unscoped', allowShareable = false } = {}) {
  if (!['noop', 'restricted'].includes(mode)) throw Object.assign(new Error('Unknown evidence sink mode.'), { code: 'INVALID_EVIDENCE_SINK_MODE' });
  if (mode === 'restricted' && (!rootDir || (!allowShareable && /(^|[\\/])docs([\\/]|$)/i.test(path.resolve(rootDir))))) {
    throw Object.assign(new Error('Restricted Eval evidence requires a non-shareable explicit root.'), { code: 'RESTRICTED_EVIDENCE_ROOT_UNSAFE' });
  }
  return {
    mode,
    async capture(stage, evidence) {
      if (!EVIDENCE_STAGES.includes(stage)) throw Object.assign(new Error(`Unsupported evidence stage: ${stage}`), { code: 'INVALID_EVIDENCE_STAGE' });
      if (mode === 'noop') return { captured: false, stage, artifact_ref: null };
      const safeEvidence = redact(evidence);
      const targetDir = path.join(path.resolve(rootDir), evalRunId, 'restricted-evidence');
      fs.mkdirSync(targetDir, { recursive: true });
      const tempRef = snapshotArtifact({ bytes: JSON.stringify(safeEvidence), mediaType: 'application/json', producer: 'eval-evidence-sink', sourceRunId: evalRunId, redactionPolicy: 'restricted-secret-redacted' });
      const target = path.join(targetDir, `${stage}-${tempRef.sha256.slice(-16)}.json`);
      if (!fs.existsSync(target)) fs.writeFileSync(target, `${JSON.stringify({ stage, eval_run_id: evalRunId, captured_at: new Date().toISOString(), evidence: safeEvidence }, null, 2)}\n`, 'utf8');
      const artifact = snapshotArtifact({ filePath: target, mediaType: 'application/json', producer: 'eval-evidence-sink', sourceRunId: evalRunId, redactionPolicy: 'restricted-secret-redacted' });
      return { captured: true, stage, artifact_ref: artifact };
    }
  };
}

export function isEvidenceSinkSafe(value) {
  const text = JSON.stringify(value);
  return !/(sk-[A-Za-z0-9]|Bearer\s+[A-Za-z0-9._-]+|api[_-]?key\s*[:=]\s*[^<])/i.test(text);
}
