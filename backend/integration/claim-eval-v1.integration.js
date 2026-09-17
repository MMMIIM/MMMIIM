import test from 'node:test';
import assert from 'node:assert/strict';
import dotenv from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createPool } from '../src/db.js';
import { runClaimDbGate } from '../eval/claim-eval-v1/db-gate.js';

const directory = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(directory, '../.env') });

test('Claim DB Gate proves migration, identity, reconstruction, stale and authorization boundaries', async () => {
  assert.ok(process.env.DATABASE_URL, 'DATABASE_URL is required for Claim DB Gate');
  const pool = createPool();
  try {
    const result = await runClaimDbGate({ pool });
    assert.equal(result.status, 'PASS', JSON.stringify(result));
    assert.equal(result.checks.migration_049, 'PASS');
    assert.equal(result.checks.identity_roundtrip, 'PASS');
    assert.equal(result.checks.current_allow_reconstruction, 'PASS');
    assert.equal(result.checks.stale_authorization, 'PASS');
    assert.equal(result.checks.gate_decision_parity, 'PASS');
    assert.equal(result.checks.unauthorized_mutation, 'PASS');
    assert.equal(result.checks.cross_project_mutation, 'PASS');
    assert.equal(result.metrics.stale_claim_writer_use, 0);
    assert.equal(result.metrics.gate_decision_parity_errors, 0);
    assert.equal(result.metrics.unauthorized_mutation, 0);
    assert.equal(result.metrics.cross_project_mutation, 0);
    assert.equal(result.provider_calls, 0);
    assert.equal(result.embedding_calls, 0);
    assert.equal(result.retrieval_calls, 0);
    assert.equal(result.production_db_writes, 0);
    assert.equal(result.fixture_db_writes, 'ephemeral_synthetic_fixture_only');
  } finally {
    await pool.end();
  }
});
