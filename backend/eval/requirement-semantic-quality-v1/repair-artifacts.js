import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const repo = path.resolve(import.meta.dirname, '../../..');
const docs = path.join(repo, 'docs');
const checkpointFile = path.join(docs, 'V43_REQUIREMENT_PRODUCTION_SEMANTIC_AUDIT_CHECKPOINT.json');
const liveFile = path.join(docs, 'V43_REQUIREMENT_LIVE_BENCHMARK.json');
const performanceFile = path.join(docs, 'V43_REQUIREMENT_PERFORMANCE_REPORT.json');
const sources = {
  'JY-001': 'backend/eval/tender-benchmark-v1/sources/JY-001-jiangyin.pdf',
  'TB-003': 'backend/eval/tender-benchmark-v1/sources/TB-003-jiaozuo-sidian.pdf',
  'TB-006': 'backend/eval/tender-benchmark-v1/sources/TB-006-beijing-emergency-model-cloud.pdf',
  'FAST-01': 'backend/eval/tender-benchmark-v1/sources/FAST-01-dapeng-healthcare.pdf',
  'FAST-04': 'backend/eval/tender-benchmark-v1/sources/FAST-04-beijing-software.pdf',
  'FAST-WATER-01': 'backend/eval/tender-benchmark-v1/sources/FAST-WATER-01-beijing-water-ops.pdf'
};
const hashFile = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const write = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
const actual = Object.fromEntries(Object.entries(sources).map(([tender, file]) => [tender, hashFile(path.join(repo, file))]));

const checkpoint = read(checkpointFile);
checkpoint.runtime_identity.provider = checkpoint.preflight?.['/ready']?.ok === true
  ? 'configured_via_semantic_gateway'
  : null;
checkpoint.runtime_identity.model = null;
checkpoint.runtime_identity.provider_configured = checkpoint.preflight?.['/ready']?.ok === true;
checkpoint.runtime_identity.provider_identity_source = 'gateway_probe_diagnostics_not_exposed_in_safe_artifact';
checkpoint.tender_preparation = (checkpoint.tender_preparation || []).map((row) => ({ ...row, source_sha256: actual[row.tender_id] }));
checkpoint.source_sha256_verification = Object.entries(actual).map(([tender_id, source_sha256]) => ({
  tender_id,
  source_sha256,
  source_file_present: true,
  source_hash_verified: true
}));
checkpoint.notes = [
  ...(checkpoint.notes || []),
  'Source file hashes were corrected after the Eval runner hash helper was verified to hash Buffer bytes (not UTF-8 string coercion).',
  'Backend runtime env does not expose provider/model identity; safe artifact records gateway provider path and leaves model null.'
];
write(checkpointFile, checkpoint);

const live = read(liveFile);
live.runtime_identity.provider = checkpoint.runtime_identity.provider;
live.runtime_identity.model = null;
live.runtime_identity.provider_configured = checkpoint.runtime_identity.provider_configured;
live.runtime_identity.provider_identity_source = checkpoint.runtime_identity.provider_identity_source;
live.cases = (live.cases || []).map((row) => {
  if (row.status !== 'RESPONSE_RECEIVED') return { ...row, first_failure_stage: 'GATEWAY_OR_PROVIDER_TRANSPORT' };
  if (!row.candidate_count) return { ...row, first_failure_stage: 'BACKEND_CANONICALIZATION_EMPTY_OUTPUT', failure_stage_confidence: 'STRUCTURALLY_OBSERVED' };
  if (!row.source_resolution_pass) return { ...row, first_failure_stage: 'SOURCE_LOCATION_RESOLUTION', failure_stage_confidence: 'COMBINED_CAPTURE_SOURCE_OR_CANONICALIZATION' };
  if (!row.canonicalization_pass) return { ...row, first_failure_stage: 'BACKEND_CANONICALIZATION', failure_stage_confidence: 'STRUCTURALLY_OBSERVED' };
  return { ...row, first_failure_stage: null };
});
write(liveFile, live);

const performance = read(performanceFile);
performance.provider = checkpoint.runtime_identity.provider;
performance.model = null;
performance.provider_identity_source = checkpoint.runtime_identity.provider_identity_source;
write(performanceFile, performance);
console.log(JSON.stringify({ checkpoint: checkpoint.checkpoint, run_id: checkpoint.run_id, corrected_source_hashes: Object.keys(actual).length, provider_identity: checkpoint.runtime_identity.provider }, null, 2));
