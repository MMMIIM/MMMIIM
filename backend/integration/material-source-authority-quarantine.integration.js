import test from 'node:test';
import assert from 'node:assert/strict';
import dotenv from 'dotenv';
import { createHash, randomUUID } from 'node:crypto';
import { createPool, PgRepository } from '../src/db.js';
import { CompanyMaterialService } from '../src/company-material-service.js';
import { chunkEnterpriseMaterial } from '../src/pipeline/enterprise-material-chunker.js';

dotenv.config({ path: new URL('../.env', import.meta.url) });

test('material authority quarantine excludes production retrieval while preserving lineage', async () => {
  assert.ok(process.env.DATABASE_URL, 'DATABASE_URL is required for PostgreSQL integration tests');
  const pool = createPool();
  const repository = new PgRepository(pool);
  const project = await repository.createProject({ name: `Material authority quarantine ${Date.now()}` });
  try {
    const source = 'Synthetic authority quarantine fixture; no external provider is used.';
    const material = await repository.createCompanyMaterial({
      projectId: project.id,
      originalName: `authority-${randomUUID()}.md`,
      storageKey: `authority-${project.id}`,
      materialType: 'project_case',
      mimeType: 'text/markdown',
      sizeBytes: Buffer.byteLength(source),
      fileHash: createHash('sha256').update(source).digest('hex')
    });
    await repository.completeCompanyMaterialExtraction(material.id, source);
    const chunks = chunkEnterpriseMaterial(material.id, source);
    await repository.replaceMaterialChunks(material.id, chunks);
    const before = await repository.listChunksForRetrieval({
      projectId: project.id,
      materialIds: [material.id],
      materialTypes: [],
      model: '__authority_test__',
      version: '1',
      corpusScopes: ['ENTERPRISE_PRIVATE']
    });
    assert.equal(before.length, chunks.length);

    const service = new CompanyMaterialService({ repository, storage: null, textExtractor: null });
    const quarantined = await service.quarantine(material.id, { reason: 'TEST_QUARANTINE' });
    assert.equal(quarantined.lifecycle_status, 'QUARANTINED');
    const after = await repository.listChunksForRetrieval({
      projectId: project.id,
      materialIds: [material.id],
      materialTypes: [],
      model: '__authority_test__',
      version: '1',
      corpusScopes: ['ENTERPRISE_PRIVATE']
    });
    assert.equal(after.length, 0);
    const retained = (await pool.query(`
      SELECT m.lifecycle_status,m.quarantine_reason,m.quarantined_at,
             (SELECT count(*)::int FROM material_chunks c WHERE c.material_id=m.id) AS chunks
      FROM company_materials m WHERE m.id=$1
    `, [material.id])).rows[0];
    assert.deepEqual(retained, {
      lifecycle_status: 'QUARANTINED',
      quarantine_reason: 'TEST_QUARANTINE',
      quarantined_at: retained.quarantined_at,
      chunks: chunks.length
    });
    assert.ok(retained.quarantined_at);
  } finally {
    await pool.query(`DELETE FROM projects WHERE id=$1`, [project.id]);
    await pool.end();
  }
});

test('Neusoft historical lineage is readable but never current authority', async () => {
  assert.ok(process.env.DATABASE_URL, 'DATABASE_URL is required for PostgreSQL integration tests');
  const pool = createPool();
  const repository = new PgRepository(pool);
  const projectId = '112b3805-df67-4483-b1aa-c8941a111465';
  try {
    const materials = (await pool.query(`
      SELECT id FROM company_materials
      WHERE project_id=$1 AND original_name ILIKE ANY($2::text[])
    `, [projectId, ['%neusoft%', '%东软%']])).rows;
    assert.equal(materials.length, 4);
    assert.equal((await pool.query(`
      SELECT count(*)::int FROM material_chunks WHERE material_id=ANY($1::uuid[])
    `, [materials.map(row => row.id)])).rows[0].count, 81);
    const facts = await repository.listApprovedCurrentEvidenceFacts(projectId);
    assert.equal(facts.length, 6);
    assert.equal(facts.every(row => row.source_material_authority_eligible === false && row.current_authority === false), true);
    const mappings = await repository.listEnterpriseEvidenceBindings(projectId);
    assert.equal(mappings.length, 6);
    assert.equal(mappings.every(row => row.source_material_authority_eligible === false && row.usable_for_claims === false), true);
    const claims = (await repository.listClaims(projectId)).filter(row => row.claim_type === 'evidence_support');
    assert.equal(claims.length, 6);
    assert.equal(claims.every(row => row.source_material_authority_eligible === false && row.current === false && row.writer_eligible === false), true);
  } finally {
    await pool.end();
  }
});
