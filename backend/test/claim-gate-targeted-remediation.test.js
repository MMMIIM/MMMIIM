import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createApp } from '../src/app.js';
import { PgRepository } from '../src/db.js';
import { createClaimGateIdentity } from '../src/pipeline/claim-gate-input-adapter-v1.js';
import { createClaimAssertion } from '../src/pipeline/claim-assertion-contract-v1.js';
import { evaluateEnterpriseClaimV2 } from '../src/pipeline/enterprise-claim-gate-v2.js';
import { authorizeProjectFact, isCurrentAllowClaim } from '../src/pipeline/writer-input-authorization-v1.js';

const root = new URL('../src/', import.meta.url);
const PROJECT = '00000000-0000-4000-8000-000000000001';

async function withServer(app, fn) {
  const server = await new Promise(resolve => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  try { return await fn(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise(resolve => server.close(resolve)); }
}

test('legacy production-beta mutation is compatibility-gated and canonical claims route remains active', async () => {
  let calls = 0;
  const base = {
    repository: {},
    productionBetaService: { async process() { calls += 1; return { legacy: true }; } },
    projectAuthorizationService: { async assertProjectAccess() {} },
    actorResolver: () => ({ actor_id: 'claim-test', actor_type: 'test', source: 'test' })
  };
  const disabled = createApp(base);
  await withServer(disabled, async url => {
    const response = await fetch(`${url}/api/projects/${PROJECT}/production-beta`, { method: 'POST', body: '{}' });
    assert.equal(response.status, 404);
  });
  const enabled = createApp({ ...base, legacyGenerationCompat: true });
  await withServer(enabled, async url => {
    const response = await fetch(`${url}/api/projects/${PROJECT}/production-beta`, { method: 'POST', body: '{}' });
    assert.equal(response.status, 201);
  });
  assert.equal(calls, 1);
});

test('Claim Gate persistence SQL carries distinct Claim/Gate identity and V2 decision projection', async () => {
  const source = await readFile(new URL('../src/db.js', import.meta.url), 'utf8');
  assert.match(source, /claims\([^)]*claim_assertion_hash/);
  assert.match(source, /claim_gate_evaluations\([^)]*gate_result_id/);
  assert.match(source, /claim_gate_evaluations\([^)]*input_snapshot_hash/);
  assert.match(source, /claim_gate_evaluations\([^)]*source_hashes/);
  assert.match(source, /claim_gate_evaluations\([^)]*lineage_current/);
  assert.match(source, /gate_decision\s*=\s*\$2|gateDecision\s*=\s*v\?\.decision|gate_decision.*v2_evaluation/);
  assert.match(source, /claim_assertion_hash.*gate_result_id.*input_snapshot_hash/);
});

test('forward migration adds identity columns without persisting Writer payload fields', async () => {
  const migration = await readFile(new URL('../migrations/049_claim_gate_identity_v1.sql', import.meta.url), 'utf8');
  for (const field of ['claim_assertion_hash', 'gate_result_id', 'input_snapshot_hash', 'source_hashes', 'lineage_current']) assert.match(migration, new RegExp(`ADD COLUMN IF NOT EXISTS ${field}`));
  assert.match(migration, /gate_decision IN \('approved','rejected','allow','restrict','needs_review'\)/);
  assert.doesNotMatch(migration, /writer_task_id|batch|provider_payload/i);
});

test('reloaded Claim rows expose assertion identity and latest Gate identity for DB-shaped Writer authorization', async () => {
  const source = await readFile(new URL('../src/db.js', import.meta.url), 'utf8');
  assert.match(source, /c\.claim_assertion_hash/);
  assert.match(source, /cge\.gate_result_id/);
  assert.match(source, /cge\.input_snapshot_hash/);
  assert.match(source, /cge\.lineage_current/);
  assert.match(source, /cge\.source_hashes/);
});

test('V2 allow is manually approvable while reject/restrict/needs_review remain immutable', async () => {
  const calls = [];
  const makeRepo = gateDecision => new PgRepository({
    async connect() {
      return {
        async query(sql, params) {
          calls.push({ sql, params });
          if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [] };
          if (sql.includes('SELECT c.id,c.project_id')) return { rows: [{ id: 'db-claim', project_id: PROJECT, gate_decision: gateDecision }] };
          if (sql.includes('UPDATE claim_decisions')) return { rows: [{ decision: 'approved' }] };
          return { rows: [] };
        },
        release() {}
      };
    }
  });
  await assert.doesNotReject(() => makeRepo('allow').decideClaim('CLM-AAAAAAAAAAAAAAAA', 'approved', 'reviewer'));
  await assert.rejects(() => makeRepo('restrict').decideClaim('CLM-AAAAAAAAAAAAAAAA', 'approved', 'reviewer'), { code: 'CLAIM_GATE_REJECTION_IMMUTABLE' });
  await assert.rejects(() => makeRepo('needs_review').decideClaim('CLM-AAAAAAAAAAAAAAAA', 'approved', 'reviewer'), { code: 'CLAIM_GATE_REJECTION_IMMUTABLE' });
  await assert.rejects(() => makeRepo('reject').decideClaim('CLM-AAAAAAAAAAAAAAAA', 'approved', 'reviewer'), { code: 'CLAIM_GATE_REJECTION_IMMUTABLE' });
});

test('Writer authorization remains fail-closed for missing or stale Claim/Gate identity', () => {
  const claim = { claim_id: 'CLM-SAFE', assertion_hash: 'a'.repeat(64), referenced_fact_ids: ['F1'] };
  const gate = { claim_id: 'CLM-SAFE', decision: 'allow', writer_eligible: true, lineage_current: true, claim_assertion_hash: claim.assertion_hash, gate_result_id: 'CGR-1', input_snapshot_hash: 'b'.repeat(64) };
  assert.equal(isCurrentAllowClaim(claim, gate), true);
  for (const change of [{ claim_assertion_hash: 'c'.repeat(64) }, { gate_result_id: null }, { input_snapshot_hash: null }, { lineage_current: false }, { decision: 'restrict' }]) {
    assert.equal(isCurrentAllowClaim(claim, { ...gate, ...change }), false);
  }
  const fact = { fact_role: 'enterprise_fact', review_status: 'approved', conflict_status: 'none', project_fact_id: 'PF-1', provenance_refs: [{ source_type: 'evidence_fact', source_id: 'F1' }] };
  assert.equal(authorizeProjectFact(fact, { claims: [claim], gateResults: [{ ...gate, input_snapshot_hash: null }] }).authorization_mode, 'claim_required');
});

test('Claim/Gate identity is stable and changes with upstream requirement, fact, mapping, or lineage inputs', () => {
  const claim = { claim_id: 'CLM-IDENTITY', text: '系统支持统一认证。', assertions: [], referenced_fact_ids: ['FACT-1'], referenced_mapping_ids: ['MAP-1'] };
  const requirement = { req_id: 'REQ-1', requirement_hash: 'a'.repeat(64), contract_version: 'requirement-v1' };
  const binding = { evidence_id: 'FACT-1', fact_payload_hash: 'b'.repeat(64), fact_contract_version: 'evidence-fact-v1', mapping_id: 'MAP-1', mapping_contract_version: 'requirement-evidence-mapping-v1.1', source_text_hash: 'c'.repeat(64), source_lineage_verified: true, usable_for_claims: true, material_type: 'other', mapping_status: 'approved', approval_status: 'approved', mapping_current: true, is_current: true };
  const first = createClaimGateIdentity({ projectId: PROJECT, requirement, claim, binding });
  assert.equal(first.claim_assertion_hash, createClaimAssertion(claim).assertion_hash);
  assert.equal(first.lineage_current, true);
  assert.match(first.gate_result_id, /^CGR-[A-F0-9]{32}$/);
  for (const change of [
    { requirement: { ...requirement, requirement_hash: 'd'.repeat(64) } },
    { binding: { ...binding, fact_payload_hash: 'e'.repeat(64) } },
    { binding: { ...binding, mapping_id: 'MAP-2' } },
    { binding: { ...binding, source_lineage_verified: false } }
  ]) {
    const next = createClaimGateIdentity({ projectId: PROJECT, requirement: change.requirement || requirement, claim, binding: change.binding || binding });
    assert.notEqual(next.input_snapshot_hash, first.input_snapshot_hash);
    if (change.binding?.source_lineage_verified === false) assert.equal(next.lineage_current, false);
  }
});

test('Claim quality fixtures preserve narrow support and reject authority/semantic overclaim', async () => {
  const source = await readFile(new URL('../src/pipeline/enterprise-claim-gate-v2.js', import.meta.url), 'utf8');
  assert.match(source, /partial_support/);
  assert.match(source, /REFERENCE_ONLY/);
  assert.match(source, /STATUS_OVERCLAIM/);
  assert.match(source, /QUANTITATIVE_UNSUPPORTED/);
  assert.match(source, /ENTITY_MISMATCH/);
  assert.match(source, /EVIDENCE_SCOPE_EXCEEDED/);
});

test('partial SSO support keeps a narrow Claim reviewable and rejects the broader authority claim', () => {
  const fact = { fact_id: 'FACT-SSO', evidence_identifier: 'FACT-SSO', project_id: PROJECT, review_status: 'approved', is_current: true, version: 1, subject_json: { type: 'capability', name: 'SSO' }, entities_json: [], fact_status: 'unknown', fact_scopes_json: ['capability_fact'], quantities_json: [], validity_json: { status: 'not_applicable' } };
  const binding = { project_id: PROJECT, requirement_id: 'REQ-SSO', mapping_id: 'MAP-SSO', mapping_status: 'approved', support_level: 'partial_support', evidence_id: 'FACT-SSO', approval_status: 'approved', validity_status: 'active', source_lineage_verified: true, usable_for_claims: true, material_type: 'project_case', evidence_scope: ['capability_fact'], metadata: { subject: 'SSO' }, evidence_facts: [fact], content: '现有平台具备 SSO 能力。' };
  const narrow = evaluateEnterpriseClaimV2({ projectId: PROJECT, claim: { requirement_id: 'REQ-SSO', basis_evidence_ids: ['FACT-SSO'], text: '我司现有平台具备 SSO 能力。', metadata: { subject: 'SSO' } }, binding });
  assert.equal(narrow.writer_eligible, false);
  assert.equal(narrow.dimensions.support_sufficiency, 'partial');
  assert.notEqual(narrow.decision, 'allow');
  const broad = evaluateEnterpriseClaimV2({ projectId: PROJECT, claim: { requirement_id: 'REQ-SSO', basis_evidence_ids: ['FACT-SSO'], text: '我司现有平台完全满足本项统一身份体系建设要求。', metadata: { subject: '统一身份体系' } }, binding });
  assert.equal(broad.decision, 'reject');
  assert.ok(broad.reason_codes.includes('ENTITY_MISMATCH'));
});
