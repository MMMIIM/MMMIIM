import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(process.cwd());
const REPO = path.resolve(ROOT, '..');
const DOCS = path.join(REPO, 'docs');
const prior = JSON.parse(fs.readFileSync(path.join(DOCS, 'V43_BID_RESPONSE_EXECUTION_LAYER_V1_POST_REQUIREMENT_FREEZE_RECERT_CHECKPOINT.json'), 'utf8'));
const result = spawnSync(process.execPath, ['--test'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 100 * 1024 * 1024 });
const output = `${result.stdout || ''}\n${result.stderr || ''}`;
const lines = output.split(/\r?\n/);
const summary = [];
for (const line of lines) {
  if (!line.startsWith('✖ ') || line === '✖ failing tests:') continue;
  const value = line.slice(2).replace(/\s+\([^)]*\)\s*$/, '').trim();
  if (!value || value.startsWith('failing tests')) continue;
  if (!summary.includes(value)) summary.push(value);
}
const baseline = [...(prior.baseline?.current_failure_test_ids || [])];
const normalize = value => String(value).replace(/\\/g, '/').trim();
const bSet = new Set(baseline.map(normalize));
const cSet = new Set(summary.map(normalize));
const unchanged = [...cSet].filter(id => bSet.has(id)).sort();
const resolved = [...bSet].filter(id => !cSet.has(id)).sort();
const newlyFailed = [...cSet].filter(id => !bSet.has(id)).sort();
const artifact = {
  artifact_type: 'V43_RESPONSE_ROUTER_V2_2_BACKEND_FAILURE_SET_COMPARISON',
  generated_at: new Date().toISOString(),
  baseline_source: 'docs/V43_BID_RESPONSE_EXECUTION_LAYER_V1_POST_REQUIREMENT_FREEZE_RECERT_CHECKPOINT.json',
  baseline_failure_count: baseline.length,
  current_failure_count: summary.length,
  current_test_count: (output.match(/ℹ tests\s+\d+/)?.[0] || null),
  current_pass_count: (output.match(/ℹ pass\s+\d+/)?.[0] || null),
  current_exit_code: result.status,
  comparison: {
    confirmed_pre_existing_unchanged: unchanged,
    resolved_by_task: resolved,
    new_task_regression: newlyFailed,
    signature_changed_or_unknown: [],
    set_equivalent: resolved.length === 0 && newlyFailed.length === 0 && unchanged.length === baseline.length,
    note: 'Failure identity comparison is mechanical by normalized test identity. Existing failures remain outside Router V2.2 scope.'
  },
  output_sha256: crypto.createHash('sha256').update(output).digest('hex')
};
fs.writeFileSync(path.join(DOCS, 'V43_RESPONSE_ROUTER_V2_2_BACKEND_FAILURE_SET_COMPARISON.json'), `${JSON.stringify(artifact, null, 2)}\n`);
console.log(JSON.stringify({ exit_code: result.status, baseline: baseline.length, current: summary.length, unchanged: unchanged.length, resolved: resolved.length, new_failures: newlyFailed.length, set_equivalent: artifact.comparison.set_equivalent }, null, 2));
process.exitCode = result.status === 0 ? 0 : 1;
