import test from 'node:test';
import assert from 'node:assert/strict';
import { CanonicalFactResolutionService } from '../src/canonical-fact-resolution-service.js';

const candidate = {
  requirement_id: 'REQ-001', search_run_id: 'ESEARCH-1', material_id: 'material-1',
  chunk_id: 'MCH-1', source_span_id: 'MCH-1:FULL', source_hash: 'a'.repeat(64),
  source_role: 'EVIDENCE_CANDIDATE', enterprise_id: 'SYNTH-CHENGCHUAN-001', project_id: 'project-eval',
  creates_fact_authority: false, creates_claim_authority: false
};
const fact = {
  fact_id: 'EFACT-1', material_id: 'material-1', source_span_id: 'MCH-1:FULL', source_hash: 'a'.repeat(64),
  review_status: 'approved', fact_current: true, source_lineage_verified: true,
  source_material_authority_eligible: true, source_role: 'EVIDENCE_CANDIDATE',
  authority: 'SYNTHETIC_EVAL_ONLY', production_authority: 'NONE'
};

test('exact eligible canonical Fact is reused without invoking the Fact extractor', async () => {
  let extracts = 0;
  const resolver = new CanonicalFactResolutionService({
    repository: { async findCurrentCanonicalFactForSource() { return fact; } },
    evidenceSourceFactService: { async extract() { extracts += 1; } }
  });
  const result = await resolver.resolve({ projectId: 'project-eval', candidate, actor: 'eval-actor' });
  assert.equal(result.status, 'FACT_REUSED');
  assert.equal(result.fact.fact_id, fact.fact_id);
  assert.equal(extracts, 0);
});

test('raw Candidate never becomes a Fact: absent reuse proceeds only through the existing approved Review Fact service', async () => {
  let request;
  const resolver = new CanonicalFactResolutionService({
    repository: { async findCurrentCanonicalFactForSource() { return null; } },
    evidenceSourceFactService: { async extract(value) { request = value; return { facts: [{ fact_id: 'EFACT-DRAFT', review_status: 'draft' }] }; } }
  });
  const result = await resolver.resolve({
    projectId: 'project-eval', candidate: { ...candidate, evidence_review_id: 'EREVIEW-1' }, actor: 'eval-actor'
  });
  assert.deepEqual(request, { projectId: 'project-eval', reviewId: 'EREVIEW-1', actor: 'eval-actor' });
  assert.equal(result.status, 'FACT_REVIEW_REQUIRED');
  assert.equal(result.facts.length, 0);
  assert.equal(result.evidence_gap.status, 'FACT_REVIEW_REQUIRED');
});

test('reference or cross-project candidates cannot enter Fact resolution or Claim authority', async () => {
  const resolver = new CanonicalFactResolutionService({
    repository: { async findCurrentCanonicalFactForSource() { assert.fail('must not lookup'); } },
    evidenceSourceFactService: { async extract() { assert.fail('must not extract'); } }
  });
  await assert.rejects(
    () => resolver.resolve({ projectId: 'project-eval', candidate: { ...candidate, source_role: 'REFERENCE_ONLY' }, actor: 'eval-actor' }),
    error => error.code === 'EVIDENCE_CANDIDATE_AUTHORITY_INVALID'
  );
  await assert.rejects(
    () => resolver.resolve({ projectId: 'other-project', candidate, actor: 'eval-actor' }),
    error => error.code === 'EVIDENCE_CANDIDATE_SCOPE_INVALID'
  );
});
