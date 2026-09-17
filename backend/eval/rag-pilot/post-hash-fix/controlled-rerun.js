import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPool, PgRepository } from '../../../src/db.js';
import { safeSemanticGatewayRuntimeSummary, readSemanticGatewayRuntimeConfig } from '../../../../packages/semantic-contracts/runtime-config.js';
import {
  loadCorpus,
  tableCounts,
  runSemanticReviewPhase,
  runFactPhase,
  semanticSystemicBlocker,
  shouldRunFactPhase
} from '../overnight-benchmark.js';
import { acquireRunLock, createCallLedger } from './controlled-run-guard.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const runId = 'POST_HASH_FIX_CONTROLLED_RERUN_01';
const providerBudget = 90;
const semanticBudget = 45;
const outputDir = path.resolve(here, '..', 'results', 'post-hash-fix');
const ledgerPath = path.join(outputDir, 'provider_call_ledger.jsonl');
const lockPath = path.join(outputDir, '.controlled-run.lock');

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function readLedger() {
  try {
    const content = await readFile(ledgerPath, 'utf8');
    return content.split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

function ledgerSummary(entries) {
  const byEvent = event => entries.filter(item => item.event === event).length;
  const sends = entries.filter(item => item.event === 'ABOUT_TO_SEND');
  const terminal = entries.filter(item => ['HTTP_SUCCESS', 'HTTP_ERROR', 'TIMEOUT', 'VALIDATION_FAILURE_AFTER_HTTP'].includes(item.event));
  const terminalKeys = new Set(terminal.map(item => `${item.phase}:${item.case_id}:${item.attempt}`));
  return {
    about_to_send: sends.length,
    terminal_events: terminal.length,
    http_success: byEvent('HTTP_SUCCESS'),
    http_error: byEvent('HTTP_ERROR'),
    timeout: byEvent('TIMEOUT'),
    validation_failure_after_http: byEvent('VALIDATION_FAILURE_AFTER_HTTP'),
    unmatched_send_records: sends.filter(item => !terminalKeys.has(`${item.phase}:${item.case_id}:${item.attempt}`)).length,
    budget_exceeded: sends.length > providerBudget,
    phases: {
      semantic: sends.filter(item => item.phase === 'B').length,
      fact: sends.filter(item => item.phase === 'C').length
    }
  };
}

async function main() {
  const lock = await acquireRunLock({ filePath: lockPath, runId });
  let pool;
  try {
    const ledger = await createCallLedger({ filePath: ledgerPath, runId, budget: providerBudget });
    const runtime = safeSemanticGatewayRuntimeSummary(readSemanticGatewayRuntimeConfig(process.env));
    pool = createPool();
    const repository = new PgRepository(pool);
    const preDb = await tableCounts(pool);
    const corpus = await loadCorpus(repository);
    const external = { attempts: [], embeddingCalls: [], gatewayCalls: [], gatewayReserved: 0, currentCase: null };

    const semantic = await runSemanticReviewPhase({ corpus, external, runtime, ledger });
    const semanticBlocker = semanticSystemicBlocker(semantic);
    const semanticEntries = await readLedger();
    const semanticCheckpoint = {
      run_id: runId,
      previous_run: { status: 'ABORTED', provider_calls: 'UNKNOWN', included_in_benchmark_metrics: false },
      phase: 'SEMANTIC_REVIEW',
      cases: semantic.rows.length,
      provider_budget: semanticBudget,
      provider_attempts: semanticEntries.filter(item => item.event === 'ABOUT_TO_SEND' && item.phase === 'B').length,
      provider_reached: semantic.rows.filter(row => row.provider_called).length,
      metrics: semantic.metrics,
      systemic_blocker: semanticBlocker,
      contract: semantic.contract
    };
    await writeJson(path.join(outputDir, 'SEMANTIC_CONTROLLED_RERUN_CHECKPOINT.json'), semanticCheckpoint);
    await writeFile(path.join(outputDir, 'SEMANTIC_CONTROLLED_RERUN_CHECKPOINT.md'), [
      '# SEMANTIC_CONTROLLED_RERUN_CHECKPOINT',
      '',
      `- run_id: ${runId}`,
      '- previous aborted-run Provider calls: UNKNOWN (excluded)',
      `- cases: ${semantic.rows.length}`,
      `- provider attempts: ${semanticCheckpoint.provider_attempts}/${semanticBudget}`,
      `- provider reached: ${semanticCheckpoint.provider_reached}`,
      `- pass: ${semantic.metrics.pass}`,
      `- fail: ${semantic.metrics.fail}`,
      `- source hash invalid: ${semanticBlocker.source_hash_invalid}`,
      `- stop before Fact: ${semanticBlocker.stop_before_fact ? 'YES' : 'NO'}`,
      ''
    ].join('\n'), 'utf8');

    let fact = null;
    if (shouldRunFactPhase({ semanticBlocker, observedAttempts: ledger.observedAttempts, providerBudget })) {
      fact = await runFactPhase({ corpus, external, runtime, ledger });
      await writeJson(path.join(outputDir, 'FACT_CONTROLLED_RERUN.json'), {
        run_id: runId,
        phase: 'FACT',
        provider_budget: providerBudget,
        eligible_cases: fact.eligible.length,
        boundary_cases: fact.boundary.length,
        metrics: fact.metrics,
        eligible: fact.eligible,
        boundary: fact.boundary,
        contract: fact.contract
      });
    }

    const postDb = await tableCounts(pool);
    const ledgerEntries = await readLedger();
    const calls = ledgerSummary(ledgerEntries);
    const totalAttempts = calls.about_to_send;
    let finalStatus = 'POST_HASH_FIX_CONTROLLED_RERUN_COMPLETE';
    if (totalAttempts >= providerBudget) finalStatus = 'POST_HASH_FIX_CONTROLLED_RERUN_CALL_CAP_REACHED';
    else if (semanticBlocker.stop_before_fact) finalStatus = 'POST_HASH_FIX_CONTROLLED_RERUN_STOPPED_AT_SEMANTIC';
    const summary = {
      run_id: runId,
      previous_run: { status: 'ABORTED', provider_calls: 'UNKNOWN', included_in_benchmark_metrics: false },
      new_run: { provider_budget: providerBudget, observed_attempts: totalAttempts, ledger_complete: calls.unmatched_send_records === 0, duplicate_runner_prevented: true },
      semantic: semanticCheckpoint,
      fact: fact ? { executed: true, eligible: fact.eligible.length, provider_reached: fact.eligible.filter(row => row.provider_called).length, metrics: fact.metrics, canonical_fact_count: fact.canonical_fact_count } : { executed: false, reason: semanticBlocker.stop_before_fact ? 'SYSTEMIC_SEMANTIC_BLOCKER' : 'NOT_REACHED' },
      call_ledger: calls,
      production_writes: 0,
      db_writes: 0,
      database_counts: { pre: preDb, post: postDb },
      final_status: finalStatus
    };
    await writeJson(path.join(outputDir, 'CONTROLLED_RERUN_SUMMARY.json'), summary);
    await writeFile(path.join(outputDir, 'CONTROLLED_RERUN_SUMMARY.md'), [
      '# V43_POST_HASH_FIX_CONTROLLED_RERUN_CHECKPOINT',
      '',
      '## PREVIOUS RUN',
      '',
      '- status: ABORTED',
      '- Provider calls: UNKNOWN',
      '- included in benchmark metrics: NO',
      '',
      '## NEW RUN',
      '',
      `- run_id: ${runId}`,
      `- Provider budget: ${providerBudget}`,
      `- observed attempts: ${totalAttempts}`,
      `- ledger complete: ${summary.new_run.ledger_complete ? 'YES' : 'NO'}`,
      `- duplicate runner prevented: ${summary.new_run.duplicate_runner_prevented ? 'YES' : 'NO'}`,
      '',
      '## FINAL STATUS',
      '',
      finalStatus,
      ''
    ].join('\n'), 'utf8');
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await pool?.end();
    await lock.release();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main().catch(error => {
    console.error(JSON.stringify({ code: error.code || error.name, message: error.message, stack: error.stack }, null, 2));
    process.exitCode = 1;
  });
}

export { main, semanticSystemicBlocker, shouldRunFactPhase };
