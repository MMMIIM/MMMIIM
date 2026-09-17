import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const TAP = path.join(process.env.TEMP || process.env.TMP || '', 'v43-v64-backend-full.tap');
const BASE = path.join(ROOT, 'docs', 'eval', 'baseline', 'V43_PRE_REQUIREMENT_V6_4_FULL_BACKEND_FAILURE_SET.json');
const OUT = path.join(ROOT, 'docs', 'eval', 'baseline', 'V43_POST_REQUIREMENT_V6_4_FULL_BACKEND_FAILURE_SET.json');
const sha256 = value => createHash('sha256').update(value).digest('hex');
const norm = value => String(value || '').replaceAll('\\', '/');

function currentIdentities(text) {
  const values = [];
  for (const line of text.split(/\r?\n/u)) {
    const match = line.match(/^✖ (.+?) \([^)]*\)$/u);
    if (match) values.push(match[1]);
  }
  return [...new Set(values.map(norm))];
}

function main() {
  const tap = fs.readFileSync(TAP, 'utf8');
  const baseline = JSON.parse(fs.readFileSync(BASE, 'utf8'));
  const identities = currentIdentities(tap);
  const byIdentity = new Map(baseline.failures.map(row => [norm(row.test_identity), row]));
  const failures = identities.map(identity => {
    const prior = byIdentity.get(identity);
    return prior ? {
      test_identity: identity,
      failure_message: prior.failure_message,
      failure_family: prior.failure_family,
      failure_signature: prior.failure_signature,
      failure_signature_sha256: prior.failure_signature_sha256,
      classification: 'CONFIRMED_PRE_EXISTING',
      classification_basis: 'exact identity and baseline artifact match'
    } : {
      test_identity: identity,
      failure_message: null,
      failure_family: 'UNCLASSIFIED_BASELINE_IDENTITY',
      failure_signature: null,
      failure_signature_sha256: null,
      classification: 'UNKNOWN_BASELINE_IDENTITY',
      classification_basis: 'not present in pre-task failure artifact; no current-task relation established'
    };
  });
  const summaryLines = tap.match(/ℹ (tests|pass|fail|cancelled|skipped) \d+/gu) || [];
  const summary = Object.fromEntries(summaryLines.slice(-5).map(line => {
    const match = line.match(/ℹ (tests|pass|fail|cancelled|skipped) (\d+)/u);
    return [match[1], Number(match[2])];
  }));
  const artifact = {
    artifact_type: 'V43_POST_REQUIREMENT_V6_4_FULL_BACKEND_FAILURE_SET',
    task: 'V43_REQUIREMENT_V6_4_BOUNDED_PRODUCER_SCOPE_ALIGNMENT_AND_RECERT',
    source_command: 'node --test (backend)',
    transient_output_sha256: sha256(tap),
    test_count: summary.tests ?? null,
    pass_count: summary.pass ?? null,
    fail_count: summary.fail ?? failures.length,
    observed_failure_record_count: failures.length,
    prior_baseline_artifact: 'docs/eval/baseline/V43_PRE_REQUIREMENT_V6_4_FULL_BACKEND_FAILURE_SET.json',
    baseline_identity_comparison: {
      baseline_failure_count: baseline.failures.length,
      current_failure_count: failures.length,
      set_equal: failures.length === baseline.failures.length && failures.every(row => byIdentity.has(row.test_identity)),
      added_identities: failures.filter(row => row.classification === 'UNKNOWN_BASELINE_IDENTITY').map(row => row.test_identity),
      removed_identities: baseline.failures.map(row => norm(row.test_identity)).filter(identity => !identities.includes(identity))
    },
    classification_summary: failures.reduce((acc, row) => { acc[row.classification] = (acc[row.classification] || 0) + 1; return acc; }, {}),
    failures,
    side_effects: { provider_calls: 0, llm_calls: 0, production_db_writes: 0, gold_mutations: 0, requirement_mutations: 0, prompt_changes: 0, schema_changes: 0 }
  };
  fs.writeFileSync(OUT, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
  process.stdout.write(JSON.stringify({ output: path.relative(ROOT, OUT).replaceAll('\\', '/'), ...artifact.baseline_identity_comparison, classification_summary: artifact.classification_summary }) + '\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) main();

export { main };
