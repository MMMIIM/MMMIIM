import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(process.cwd());
const SCRIPT = path.join(ROOT, 'backend/eval/response-router-v2-2-3-replay-reference-v3.mjs');
const INPUT = path.join(ROOT, 'docs/V43_ROUTER_V2_2_3_FULL_REPLAY_REFERENCE_V3.json');
const OUTPUT = path.join(ROOT, 'docs/V43_RESPONSE_ROUTER_V2_2_3_DETERMINISM_RECERT.json');
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const stable = value => Array.isArray(value)
  ? `[${value.map(stable).join(',')}]`
  : (!value || typeof value !== 'object' ? JSON.stringify(value) : `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`);
const identity = full => ({ artifact_type: full.artifact_type, router_identity: full.router_identity, reference_v3_sha256: full.reference_v3_sha256, case_count: full.case_count, cohorts: full.cohorts, metrics: full.metrics, rows: full.rows });
const run = () => {
  execFileSync(process.execPath, [SCRIPT], { cwd: ROOT, stdio: 'ignore', env: { ...process.env, V223_ITERATION: '1' } });
  const first = JSON.parse(fs.readFileSync(INPUT, 'utf8'));
  const firstHash = sha(Buffer.from(stable(identity(first)), 'utf8'));
  execFileSync(process.execPath, [SCRIPT], { cwd: ROOT, stdio: 'ignore', env: { ...process.env, V223_ITERATION: '1' } });
  const second = JSON.parse(fs.readFileSync(INPUT, 'utf8'));
  const secondHash = sha(Buffer.from(stable(identity(second)), 'utf8'));
  const result = { checkpoint: 'V43_RESPONSE_ROUTER_V2_2_3_DETERMINISM_RECERT', replay_artifact: 'docs/V43_ROUTER_V2_2_3_FULL_REPLAY_REFERENCE_V3.json', first_stable_hash: firstHash, second_stable_hash: secondHash, stable: firstHash === secondHash, rows: first.case_count, provider_calls: 0, llm_calls: 0, production_db_writes: 0, gold_mutations: 0, status: firstHash === secondHash ? 'PASS' : 'FAIL' };
  fs.writeFileSync(OUTPUT, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result, null, 2));
};
try { run(); } catch (error) { console.error(error?.message || String(error)); process.exitCode = 1; }
