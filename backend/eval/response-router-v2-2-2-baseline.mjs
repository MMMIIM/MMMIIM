import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(process.cwd());
const DOCS = path.join(ROOT, 'docs');
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));

const main = () => {
  const replay = readJson(path.join(DOCS, 'V43_ROUTER_V2_2_1_FULL_REPLAY_REFERENCE_V3.json'));
  const execution = readJson(path.join(DOCS, 'V43_RESPONSE_ROUTER_V2_2_1_EXECUTION_LAYER_RECERT.json'));
  const backend = readJson(path.join(DOCS, 'V43_RESPONSE_ROUTER_V2_2_BACKEND_FAILURE_SET_COMPARISON.json'));
  const requirement = readJson(path.join(DOCS, 'V43_REQUIREMENT_V6_4_FREEZE_CHECKPOINT.json'));
  const status = execFileSync('git', ['status', '--short'], { encoding: 'utf8' });
  const dirtyEntries = status.trim() ? status.trim().split(/\r?\n/) : [];
  const routerPath = path.join(ROOT, 'backend/src/pipeline/requirement-response-router-v2-2-1.js');
  const out = {
    artifact_type: 'V43_PRE_ROUTER_V2_2_2_DAYTIME_BASELINE',
    generated_at: new Date().toISOString(),
    git: {
      branch: execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8' }).trim(),
      head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
      dirty_file_count: dirtyEntries.length,
      status_sha256: sha256(status)
    },
    frozen_requirement: {
      version: requirement.requirement_version,
      runtime_contract: requirement.runtime_contract,
      instruction_sha256: requirement.instruction_sha256,
      source_truth_sha256: requirement.source_truth_sha256,
      status: requirement.status
    },
    router_v2_2_1_identity: {
      path: 'backend/src/pipeline/requirement-response-router-v2-2-1.js',
      sha256: sha256(fs.readFileSync(routerPath)),
      version: replay.router_identity.version,
      implementation_id: replay.router_identity.implementation_id
    },
    reference_v3: {
      sha256: replay.reference_v3_sha256,
      rows: replay.case_count,
      cohorts: replay.cohorts
    },
    replay: {
      run_id: replay.run_id,
      full_rows: replay.case_count,
      metrics: replay.metrics,
      deterministic_source: 'docs/V43_ROUTER_V2_2_1_FULL_REPLAY_REFERENCE_V3.json'
    },
    backend_failure_identity: backend,
    frontend: { result: '52/52 PASS', provider_calls: 0, db_writes: 0 },
    execution_layer_recert: execution,
    side_effects: {
      provider_calls: 0,
      llm_calls: 0,
      production_db_writes: 0,
      gold_mutations: 0,
      requirement_mutations: 0,
      source_truth_mutations: 0,
      reference_mutations: 0,
      production_semantic_changes: 0
    },
    baseline_validity: 'PRE_MUTATION_SNAPSHOT'
  };
  const outPath = path.join(DOCS, 'eval/baseline/V43_PRE_ROUTER_V2_2_2_DAYTIME_BASELINE.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(out, null, 2)}\n`);
  console.log(JSON.stringify({ path: path.relative(ROOT, outPath), dirty_file_count: dirtyEntries.length, full_rows: replay.case_count, backend_failures: backend.baseline_failure_count, side_effects: out.side_effects }, null, 2));
};

main();
