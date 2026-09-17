import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { PgRepository } from '../src/db.js';
import { EvidenceSourceFactService } from '../src/evidence-source-fact-service.js';
import { RequirementEvidenceFactMappingService } from '../src/requirement-evidence-fact-mapping-service.js';

const PROJECT = '11111111-1111-4111-8111-111111111111';
const MATERIAL = '22222222-2222-4222-8222-222222222222';
const SOURCE = '平台支持 50 用户并发，平均响应时间 1.4 秒。';
const sha = value => createHash('sha256').update(String(value)).digest('hex');
const actor = { actor_id: 'atomicity-owner', actor_type: 'test', source: 'test' };
const authorization = { assertProjectAccess: async () => ({ membership: { role: 'OWNER', status: 'ACTIVE' } }) };

const reviewContext = () => ({
  review_id: 'EREVIEW-ATOMIC', project_id: PROJECT, source_span_id: 'ESPAN-ATOMIC',
  material_id: MATERIAL, anchor_chunk_id: 'MCH-ATOMIC', source_text: SOURCE,
  source_text_hash: sha(SOURCE), current_source_text_hash: sha(SOURCE),
  review_status: 'approved', evidence_review_contract_version: 'evidence-review-v1',
  evidence_capability: 'capable', support_level: 'partial_support', material_type: 'project_case'
});

const factCandidate = overrides => ({
  subject: { type: 'product', name: '平台' }, entities: [], status: 'unknown', scopes: [],
  quantities: [], validity: { status: 'unknown' }, domain_metadata: {}, ...overrides
});

const currentFact = () => ({
  fact_id: 'EFACT-OLD', project_id: PROJECT, evidence_review_id: 'EREVIEW-ATOMIC',
  source_span_id: 'ESPAN-ATOMIC', material_id: MATERIAL, source_text: SOURCE,
  source_text_hash: sha(SOURCE), current_source_text_hash: sha(SOURCE), anchor_chunk_id: 'MCH-ATOMIC',
  contract_version: 'evidence-fact-v1', extractor_type: 'human', extractor_version: 'human-edit:owner',
  evidence_review_status: 'approved', evidence_review_contract_version: 'evidence-review-v1',
  review_status: 'approved', version: 1
});

const mappingContext = () => ({
  project_id: PROJECT, requirement_db_id: '33333333-3333-4333-8333-333333333333',
  requirement_id: 'REQ-001', requirement_text: '平台应支持 50 用户并发。',
  requirement_hash: 'a'.repeat(64), requirement_contract_version: 'canonical-requirement-v1',
  requirement_valid: true, fact_id: 'EFACT-NEW', fact_payload_hash: 'b'.repeat(64),
  fact_contract_version: 'evidence-fact-v1', fact_review_status: 'approved'
});

const mappingCandidate = () => ({
  semantic_relationship: 'direct', support_level: 'full_support',
  dimensions: {
    subject_match: 'match', entity_match: 'match', scope_match: 'match',
    quantitative_match: 'match', status_match: 'match', validity_match: 'match'
  },
  reason_codes: []
});

test('FACT-TX01: two valid candidates are prepared then persisted as one atomic set', async () => {
  const persisted = [];
  const repository = {
    getEvidenceReviewForFact: async () => reviewContext(),
    upsertEvidenceSourceFactsAtomic: async facts => { persisted.push([...facts]); return facts; }
  };
  const service = new EvidenceSourceFactService({
    repository, projectAuthorizationService: authorization,
    extractor: { version: 'atomic-fixture-v1', extract: async () => [
      factCandidate({ quantities: [{ metric: 'concurrency', value: '50', unit: 'user' }] }),
      factCandidate({ quantities: [{ metric: 'average_response_time', value: '1.4', unit: 'second' }] })
    ] }
  });
  const result = await service.extract({ projectId: PROJECT, reviewId: 'EREVIEW-ATOMIC', actor });
  assert.equal(result.facts.length, 2);
  assert.equal(persisted.length, 1);
  assert.equal(persisted[0].length, 2);
});

test('FACT-TX02: later canonical validation failure produces zero canonical writes', async () => {
  let persistenceCalls = 0;
  const service = new EvidenceSourceFactService({
    repository: {
      getEvidenceReviewForFact: async () => reviewContext(),
      upsertEvidenceSourceFactsAtomic: async () => { persistenceCalls += 1; }
    },
    projectAuthorizationService: authorization,
    extractor: { version: 'atomic-fixture-v1', extract: async () => [
      factCandidate({ quantities: [{ metric: 'concurrency', value: '50', unit: 'user' }] }),
      factCandidate({ quantities: [{ metric: 'invalid', value: 50, unit: 'user' }] })
    ] }
  });
  await assert.rejects(
    () => service.extract({ projectId: PROJECT, reviewId: 'EREVIEW-ATOMIC', actor }),
    error => error.code === 'EVIDENCE_FACT_QUANTITY_INVALID'
  );
  assert.equal(persistenceCalls, 0);
});

function transactionalPool({ failFactInsertAt = null, failMappingInsert = false } = {}) {
  const state = {
    facts: new Map([['EFACT-OLD', { review_status: 'approved' }]]),
    mappings: new Map([['EMAP-OLD', { review_status: 'approved' }]])
  };
  let snapshot = null;
  let factInsertCount = 0;
  const client = {
    async query(sql, params = []) {
      const normalized = String(sql).replace(/\s+/g, ' ').trim();
      if (normalized === 'BEGIN') {
        snapshot = { facts: structuredClone(state.facts), mappings: structuredClone(state.mappings) };
        return { rows: [] };
      }
      if (normalized === 'COMMIT') { snapshot = null; return { rows: [] }; }
      if (normalized === 'ROLLBACK') {
        state.facts = snapshot.facts;
        state.mappings = snapshot.mappings;
        snapshot = null;
        return { rows: [] };
      }
      if (normalized.startsWith('SELECT 1 FROM company_materials')) return { rows: [{ ok: 1 }] };
      if (normalized.startsWith('INSERT INTO evidence_source_facts')) {
        factInsertCount += 1;
        if (factInsertCount === failFactInsertAt) throw new Error('forced fact insert failure');
        const row = { fact_id: params[0], review_status: params[14] };
        state.facts.set(row.fact_id, row);
        return { rows: [row] };
      }
      if (normalized.startsWith('UPDATE evidence_source_facts SET review_status')) {
        const row = state.facts.get(params[0]);
        if (row) row.review_status = 'invalidated';
        return { rows: row ? [{ fact_id: params[0], ...row }] : [] };
      }
      if (normalized.startsWith('UPDATE requirement_evidence_fact_mappings SET review_status')) {
        for (const row of state.mappings.values()) row.review_status = 'invalidated';
        return { rows: [] };
      }
      if (normalized.startsWith('INSERT INTO requirement_evidence_fact_mappings')) {
        if (failMappingInsert) throw new Error('forced mapping insert failure');
        const row = { mapping_id: params[0], review_status: params[10] };
        state.mappings.set(row.mapping_id, row);
        return { rows: [row] };
      }
      throw new Error(`Unexpected SQL: ${normalized}`);
    },
    release() {}
  };
  return { state, connect: async () => client };
}

function repositoryFact(overrides = {}) {
  return {
    fact_id: 'EFACT-NEW', project_id: PROJECT, evidence_review_id: 'EREVIEW-ATOMIC',
    source_span_id: 'ESPAN-ATOMIC', material_id: MATERIAL, subject: { type: 'product', name: '平台' },
    entities: [], status: 'unknown', scopes: [], quantities: [], validity: { status: 'unknown' },
    domain_metadata: {}, source: {}, payload_hash: 'c'.repeat(64), review_status: 'draft',
    extractor_type: 'machine', extractor_version: 'fixture', contract_version: 'evidence-fact-v1',
    version: 1, supersedes_fact_id: null, edited: false, edited_by: null, edit_note: null, ...overrides
  };
}

test('FACT-TX03: second DB insert failure rolls back the full Fact set', async () => {
  const pool = transactionalPool({ failFactInsertAt: 2 });
  const repository = new PgRepository(pool);
  await assert.rejects(
    () => repository.upsertEvidenceSourceFactsAtomic([
      repositoryFact({ fact_id: 'EFACT-A' }), repositoryFact({ fact_id: 'EFACT-B' })
    ]),
    /forced fact insert failure/
  );
  assert.deepEqual([...pool.state.facts.keys()], ['EFACT-OLD']);
});

test('FACT-TX04/TX05: edit replacement is atomic and successful lifecycle is preserved', async () => {
  const failedPool = transactionalPool({ failFactInsertAt: 1 });
  await assert.rejects(
    () => new PgRepository(failedPool).replaceEvidenceSourceFactAtomic({
      predecessorFactId: 'EFACT-OLD', replacement: repositoryFact({ fact_id: 'EFACT-REPLACEMENT', supersedes_fact_id: 'EFACT-OLD', version: 2, edited: true })
    }),
    /forced fact insert failure/
  );
  assert.equal(failedPool.state.facts.get('EFACT-OLD').review_status, 'approved');
  assert.equal(failedPool.state.facts.has('EFACT-REPLACEMENT'), false);

  const successPool = transactionalPool();
  const replacement = await new PgRepository(successPool).replaceEvidenceSourceFactAtomic({
    predecessorFactId: 'EFACT-OLD', replacement: repositoryFact({ fact_id: 'EFACT-REPLACEMENT', supersedes_fact_id: 'EFACT-OLD', version: 2, edited: true })
  });
  assert.equal(successPool.state.facts.get('EFACT-OLD').review_status, 'invalidated');
  assert.equal(replacement.fact_id, 'EFACT-REPLACEMENT');
  assert.equal(replacement.review_status, 'draft');
});

test('MAP-TX01/TX02/TX03: replacement is atomic and rollback leaves old mapping visible', async () => {
  const mapping = {
    mapping_id: 'EMAP-NEW', project_id: PROJECT, requirement_db_id: '33333333-3333-4333-8333-333333333333',
    evidence_fact_id: 'EFACT-NEW', source_type: 'manual', source: {}, semantic_relationship: 'direct',
    support_level: 'full_support', dimensions: {}, reason_codes: [], review_status: 'proposed',
    reviewer_type: 'machine', evaluator_version: 'fixture', contract_version: 'requirement-evidence-mapping-v1',
    requirement_hash: 'a'.repeat(64), requirement_contract_version: 'canonical-requirement-v1',
    fact_payload_hash: 'b'.repeat(64), fact_contract_version: 'evidence-fact-v1'
  };
  const failedPool = transactionalPool({ failMappingInsert: true });
  await assert.rejects(
    () => new PgRepository(failedPool).replaceRequirementEvidenceFactMappingAtomic(mapping),
    /forced mapping insert failure/
  );
  assert.equal(failedPool.state.mappings.get('EMAP-OLD').review_status, 'approved');
  assert.equal(failedPool.state.mappings.has('EMAP-NEW'), false);

  const successPool = transactionalPool();
  const created = await new PgRepository(successPool).replaceRequirementEvidenceFactMappingAtomic(mapping);
  assert.equal(successPool.state.mappings.get('EMAP-OLD').review_status, 'invalidated');
  assert.equal(created.review_status, 'proposed');
});

test('MAP-TX04: requirement-level Mapping set replacement rolls back all rows on insert failure', async () => {
  const pool = transactionalPool({ failMappingInsert: true });
  const mapping = {
    mapping_id: 'EMAP-SET-NEW', project_id: PROJECT,
    evidence_fact_id: 'EFACT-NEW', source_type: 'system_proposed', source: {},
    semantic_relationship: 'partial', support_level: 'partial_support', dimensions: {},
    reason_codes: [], review_status: 'approved', reviewer_type: 'machine',
    evaluator_version: 'mapping-worker-v1', contract_version: 'requirement-evidence-mapping-v1.1',
    requirement_hash: 'a'.repeat(64), requirement_contract_version: 'canonical-requirement-v1',
    fact_payload_hash: 'b'.repeat(64), fact_contract_version: 'evidence-fact-v1'
  };
  const repository = new PgRepository(pool);
  await assert.rejects(
    () => repository.replaceRequirementEvidenceFactMappingSetAtomic({
      projectId: PROJECT, requirementId: 'REQ-001', mappings: [mapping]
    }),
    /forced mapping insert failure/
  );
  assert.deepEqual([...pool.state.mappings.keys()], ['EMAP-OLD']);
  assert.equal(pool.state.mappings.get('EMAP-OLD').review_status, 'approved');
});

test('services require repository-owned atomic persistence boundaries', async () => {
  let factAtomicCalls = 0;
  const factService = new EvidenceSourceFactService({
    repository: {
      getEvidenceReviewForFact: async () => reviewContext(),
      upsertEvidenceSourceFactsAtomic: async facts => { factAtomicCalls += 1; return facts; }
    },
    projectAuthorizationService: authorization,
    extractor: { version: 'atomic-fixture-v1', extract: async () => [factCandidate()] }
  });
  await factService.extract({ projectId: PROJECT, reviewId: 'EREVIEW-ATOMIC', actor });
  assert.equal(factAtomicCalls, 1);

  let mappingAtomicCalls = 0;
  const mappingService = new RequirementEvidenceFactMappingService({
    repository: {
      getRequirementEvidenceFactMappingContext: async () => mappingContext(),
      replaceRequirementEvidenceFactMappingAtomic: async value => { mappingAtomicCalls += 1; return value; }
    },
    evaluator: { version: 'fixture', evaluate: async () => mappingCandidate() }
  });
  const mapping = await mappingService.propose({ projectId: PROJECT, requirementId: 'REQ-001', factId: 'EFACT-NEW' });
  assert.equal(mapping.review_status, 'proposed');
  assert.equal(mappingAtomicCalls, 1);
});
