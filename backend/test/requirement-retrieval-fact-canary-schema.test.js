import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  CANARY_SCHEMA_REQUIREMENTS,
  assertCanaryPreflight,
  buildRetrievalQueryRow,
  lineageFromRow,
  runCanary,
  sourceSnapshotFor,
  verifyCanarySchema
} from '../eval/real-e2e/run-requirement-retrieval-fact-canary.mjs';
import { selectAuthorizedMaterialChunks } from '../eval/real-e2e/retrieval-runner-utils.mjs';

const runnerPath = new URL('../eval/real-e2e/run-requirement-retrieval-fact-canary.mjs', import.meta.url);
const runnerSource = fs.readFileSync(runnerPath, 'utf8');

function schemaRows() {
  return Object.entries(CANARY_SCHEMA_REQUIREMENTS).flatMap(([table_name, columns]) =>
    columns.map(column_name => ({ table_name, column_name }))
  );
}

function fakeSchemaPool(rows = schemaRows()) {
  const queries = [];
  return {
    queries,
    async query(sql, params) {
      queries.push({ sql: String(sql), params });
      return { rows };
    }
  };
}

test('Eval runner projects canonical source_version and never references absent material_version column', () => {
  assert.doesNotMatch(runnerSource, /m\.material_version/);
  assert.doesNotMatch(runnerSource, /row\.material_version/);
  assert.match(runnerSource, /m\.source_version/);
  assert.match(runnerSource, /row\.source_version/);
  assert.equal(CANARY_SCHEMA_REQUIREMENTS.company_materials.includes('material_version'), false);
  assert.equal(CANARY_SCHEMA_REQUIREMENTS.company_materials.includes('source_version'), true);

  const row = {
    material_id: 'material-1', chunk_id: 'chunk-1', chunk_hash: 'chunk-sha',
    source_text: '企业材料', source_version: '2026.01', original_name: 'HW-01.pdf',
    project_id: 'project-1', material_type: 'product_documentation', corpus_scope: 'GENERAL', score: 0.9
  };
  assert.equal(sourceSnapshotFor(row, 'run-1').material_version, '2026.01');
  assert.equal(sourceSnapshotFor({ ...row, source_version: undefined }, 'run-1').material_version, null);
  assert.equal(lineageFromRow(row).source_version, '2026.01');
  assert.equal(buildRetrievalQueryRow(row, 1).source_lineage.source_version, '2026.01');
});
test('read-only canary schema preflight matches current migration-owned columns', async () => {
  const pool = fakeSchemaPool();
  const result = await verifyCanarySchema(pool);
  assert.equal(result.status, 'PASS');
  assert.deepEqual(result.missing_columns, { company_materials: [], material_chunks: [], material_chunk_embeddings: [] });
  assert.equal(result.unexpected_runner_columns.includes('material_version'), true);
  assert.equal(pool.queries.length, 1);
  assert.match(pool.queries[0].sql, /^\s*SELECT\b/i);
});

test('schema preflight fails closed when source_version migration is absent', async () => {
  const rows = schemaRows().filter(row => !(row.table_name === 'company_materials' && row.column_name === 'source_version'));
  await assert.rejects(() => verifyCanarySchema(fakeSchemaPool(rows)), error => {
    assert.equal(error.code, 'CANARY_SCHEMA_PREFLIGHT_FAILED');
    assert.deepEqual(error.details.schema_preflight.missing_columns.company_materials, ['source_version']);
    return true;
  });
});

test('canonical project-material selection retains six authorized materials and 590 chunks', () => {
  const rows = Array.from({ length: 590 }, (_, index) => ({
    material_id: `material-${index % 6}`,
    original_name: `HW-${String(index % 6 + 1).padStart(2, '0')}.pdf`,
    chunk_id: `chunk-${index}`
  }));
  const selected = selectAuthorizedMaterialChunks(rows, 'HW-');
  assert.equal(selected.materialIds.length, 6);
  assert.equal(selected.chunks.length, 590);
});

test('material selection does not grant access to unbound/non-selected rows', () => {
  const selected = selectAuthorizedMaterialChunks([
    { material_id: 'bound', original_name: 'HW-01.pdf', chunk_id: 'bound-chunk' },
    { material_id: 'unbound', original_name: 'OTHER-01.pdf', chunk_id: 'unbound-chunk' }
  ], 'HW-');
  assert.deepEqual(selected.materialIds, ['bound']);
  assert.deepEqual(selected.chunks.map(row => row.chunk_id), ['bound-chunk']);
});

test('frozen canary preflight reaches READY_FOR_PROVIDER without a Provider call', () => {
  const checks = assertCanaryPreflight({
    database: 'bid_platform_flow_audit_test',
    packet: { requirements: Array.from({ length: 20 }, (_, index) => ({ requirement_id: `REQ-${index + 1}` })) },
    materialIds: Array.from({ length: 6 }, (_, index) => `material-${index + 1}`),
    chunks: Array.from({ length: 590 }, (_, index) => ({ chunk_id: `chunk-${index}` })),
    schemaPreflight: { status: 'PASS' }
  });
  assert.deepEqual(checks, {
    database: true, selected_requirements: true, authorized_materials: true,
    authorized_chunks: true, schema_preflight: true
  });
});

test('host guard stops before database/provider setup when live flags are absent', async () => {
  const oldHost = process.env.V43_HOST_EXECUTION;
  const oldLive = process.env.V43_REQUIREMENT_RETRIEVAL_LIVE;
  delete process.env.V43_HOST_EXECUTION;
  delete process.env.V43_REQUIREMENT_RETRIEVAL_LIVE;
  try {
    await assert.rejects(() => runCanary(), error => error.code === 'HOST_EXECUTION_REQUIRED');
  } finally {
    if (oldHost === undefined) delete process.env.V43_HOST_EXECUTION; else process.env.V43_HOST_EXECUTION = oldHost;
    if (oldLive === undefined) delete process.env.V43_REQUIREMENT_RETRIEVAL_LIVE; else process.env.V43_REQUIREMENT_RETRIEVAL_LIVE = oldLive;
  }
});
