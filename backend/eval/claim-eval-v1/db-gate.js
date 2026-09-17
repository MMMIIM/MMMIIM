import { createHash, randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PgRepository, createPool } from '../../src/db.js';
import { createApp } from '../../src/app.js';
import { ProjectAuthorizationService } from '../../src/project-authorization-service.js';
import { ProductionBetaService } from '../../src/pipeline/production-beta-service.js';
import { createClaimAssertion } from '../../src/pipeline/claim-assertion-contract-v1.js';
import { createClaimGateIdentity } from '../../src/pipeline/claim-gate-input-adapter-v1.js';
import { evaluateEnterpriseClaimV2 } from '../../src/pipeline/enterprise-claim-gate-v2.js';
import { createWriterSafeContext, isCurrentAllowClaim } from '../../src/pipeline/writer-input-authorization-v1.js';

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDirectory = resolve(here, '../../migrations');
const sha = value => createHash('sha256').update(String(value)).digest('hex');
const hashId = (prefix, value) => `${prefix}-${sha(value).slice(0, 32).toUpperCase()}`;

const DIMENSIONS = {
  subject_match: 'match',
  scope_match: 'match',
  status_match: 'match',
  quantitative_match: 'not_applicable',
  entity_match: 'match',
  validity_match: 'match',
  support_sufficiency: 'sufficient',
  source_authority: 'usable'
};

async function migrationFiles() {
  return (await readdir(migrationsDirectory))
    .filter(name => name.endsWith('.sql'))
    .sort();
}

async function isolatedMigrationRun(pool, files, { requireIdentity = true } = {}) {
  const schema = `claim_eval_${randomUUID().replaceAll('-', '')}`;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET LOCAL search_path TO "${schema}", public`);
    for (const file of files) {
      await client.query(await readFile(resolve(migrationsDirectory, file), 'utf8'));
    }
    const tables = (await client.query(`
      SELECT count(*)::int AS count
      FROM information_schema.tables
      WHERE table_schema=current_schema()
        AND table_name IN ('claims','claim_decisions','claim_gate_evaluations')
    `)).rows[0].count;
    const identityColumns = (await client.query(`
      SELECT count(*)::int AS count
      FROM information_schema.columns
      WHERE table_schema=current_schema()
        AND table_name='claim_gate_evaluations'
        AND column_name=ANY($1::text[])
    `, [['claim_assertion_hash', 'gate_result_id', 'input_snapshot_hash', 'source_hashes', 'lineage_current']])).rows[0].count;
    await client.query('ROLLBACK');
    const validTables = tables === 3;
    const validIdentity = requireIdentity ? identityColumns === 5 : identityColumns === 0;
    return { status: validTables && validIdentity ? 'PASS' : 'FAIL', tables, identity_columns: identityColumns };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    return { status: 'FAIL', error_code: error.code || 'MIGRATION_FAILED', error_message: 'Isolated migration failed.' };
  } finally {
    client.release();
  }
}

async function isolatedUpgradeRun(pool, files, migrationIndex) {
  const schema = `claim_eval_upgrade_${randomUUID().replaceAll('-', '')}`;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET LOCAL search_path TO "${schema}", public`);
    for (const file of files.slice(0, migrationIndex)) {
      await client.query(await readFile(resolve(migrationsDirectory, file), 'utf8'));
    }
    const before = (await client.query(`
      SELECT count(*)::int AS count
      FROM information_schema.columns
      WHERE table_schema=current_schema()
        AND table_name='claim_gate_evaluations'
        AND column_name=ANY($1::text[])
    `, [['claim_assertion_hash', 'gate_result_id', 'input_snapshot_hash', 'source_hashes', 'lineage_current']])).rows[0].count;
    const migration = await readFile(resolve(migrationsDirectory, files[migrationIndex]), 'utf8');
    await client.query(migration);
    await client.query(migration);
    const after = (await client.query(`
      SELECT count(*)::int AS count
      FROM information_schema.columns
      WHERE table_schema=current_schema()
        AND table_name='claim_gate_evaluations'
        AND column_name=ANY($1::text[])
    `, [['claim_assertion_hash', 'gate_result_id', 'input_snapshot_hash', 'source_hashes', 'lineage_current']])).rows[0].count;
    await client.query('ROLLBACK');
    return { status: before === 0 && after === 5 ? 'PASS' : 'FAIL', before_identity_columns: before, after_identity_columns: after };
  } catch (_error) {
    await client.query('ROLLBACK').catch(() => {});
    return { status: 'FAIL', error_code: 'MIGRATION_049_UPGRADE_FAILED', error_message: 'Isolated 048 to 049 upgrade failed.' };
  } finally {
    client.release();
  }
}

async function verifyMigration049(pool) {
  const files = await migrationFiles();
  const expected = '049_claim_gate_identity_v1.sql';
  if (!files.includes(expected)) return { status: 'FAIL', error_code: 'MIGRATION_049_MISSING' };
  const fresh = await isolatedMigrationRun(pool, files, { requireIdentity: true });
  // Apply 049 twice inside an isolated 048-shaped schema to prove a real
  // upgrade and replay, without touching project data.
  const upgrade = await isolatedUpgradeRun(pool, files, files.indexOf(expected));
  let replay = { status: 'PASS' };
  try {
    const sql = await readFile(resolve(migrationsDirectory, expected), 'utf8');
    await pool.query(sql);
    await pool.query(sql);
  } catch (_error) {
    replay = { status: 'FAIL', error_code: 'MIGRATION_049_REPLAY_FAILED' };
  }
  return {
    status: [fresh, upgrade, replay].every(item => item.status === 'PASS') ? 'PASS' : 'FAIL',
    fresh: fresh.status,
    upgrade_from_048: upgrade.status,
    replay: replay.status
  };
}

async function createRequirementFixture(pool, projectId, suffix) {
  const tender = (await pool.query(`
    INSERT INTO tender_files(project_id,original_name,storage_key,mime_type,size_bytes)
    VALUES($1,$2,$3,'text/plain',1) RETURNING id
  `, [projectId, `claim-eval-${suffix}.txt`, `claim-eval-${projectId}-${suffix}`])).rows[0];
  const job = (await pool.query(`
    INSERT INTO tender_parse_jobs(project_id,tender_file_id,status,phase)
    VALUES($1,$2,'succeeded','succeeded') RETURNING id
  `, [projectId, tender.id])).rows[0];
  const baseline = (await pool.query(`
    INSERT INTO requirement_baselines(project_id,parse_job_id,status)
    VALUES($1,$2,'building') RETURNING id
  `, [projectId, job.id])).rows[0];
  const requirement = (await pool.query(`
    INSERT INTO requirements(
      baseline_id,project_id,req_id,content,source_excerpt,source_text,is_mandatory,
      target_sections,ordinal,source_status,confirmation_type,requirement_category,
      writer_eligible,classification_review_required,atomicity_review_required,
      canonical_rule_version
    ) VALUES($1,$2,$3,'系统应支持单点登录。','系统应支持单点登录。','系统应支持单点登录。',false,
      '["chapter-claim-eval"]',1,'verified','verified','technical',true,false,false,
      'canonical-requirement-v1') RETURNING *
  `, [baseline.id, projectId, `REQ-DB-${suffix}`])).rows[0];
  await pool.query(`
    UPDATE requirement_baselines
    SET status='confirmed',confirmed_at=now(),confirmed_by='claim-db-gate',confirmation_type='verified'
    WHERE id=$1
  `, [baseline.id]);
  return requirement;
}

function makeFact({ factId, projectId, subject = 'SSO', status = 'completed', scopes = ['capability_fact', 'completion_fact'] }) {
  return {
    fact_id: factId,
    evidence_identifier: factId,
    project_id: projectId,
    review_status: 'approved',
    is_current: true,
    version: 1,
    fact_type: 'capability',
    subject: { type: 'capability', name: subject },
    entities: [{ type: 'capability', name: '统一身份认证平台' }],
    status,
    scopes,
    quantities: [],
    validity: { status: 'not_applicable' },
    subject_json: { type: 'capability', name: subject },
    entities_json: [{ type: 'capability', name: '统一身份认证平台' }],
    fact_status: status,
    fact_scopes_json: scopes,
    quantities_json: [],
    validity_json: { status: 'not_applicable' }
  };
}

function makeBinding({ projectId, requirementId, factId, mappingId, sourceHash, mappingStatus = 'approved' }) {
  return {
    project_id: projectId,
    requirement_id: requirementId,
    mapping_id: mappingId,
    mapping_status: mappingStatus,
    support_level: mappingStatus === 'approved' ? 'full_support' : 'unknown',
    evidence_id: factId,
    approval_status: mappingStatus === 'approved' ? 'approved' : 'draft',
    validity_status: 'active',
    source_lineage_verified: mappingStatus === 'approved',
    usable_for_claims: mappingStatus === 'approved',
    material_type: 'project_case',
    evidence_scope: ['capability_fact', 'completion_fact'],
    source_hash: sourceHash,
    evidence_facts: [makeFact({ factId, projectId })]
  };
}

function makeRawClaim({ claimId, requirementId, factId, mappingId, text, subject = 'SSO' }) {
  return {
    claim_id: claimId,
    requirement_id: requirementId,
    claim_type: 'enterprise_capability',
    basis_requirement_ids: [requirementId],
    basis_evidence_ids: [factId],
    text,
    referenced_fact_ids: [factId],
    referenced_mapping_ids: [mappingId],
    assertions: [{
      subject: { type: 'capability', name: subject },
      entities: [{ type: 'capability', name: '统一身份认证平台' }],
      status: 'completed',
      scopes: ['capability_fact', 'completion_fact'],
      quantities: [],
      validity: { status: 'not_applicable' }
    }]
  };
}

async function insertClaim(pool, { claim, requirement, decision, gateDecision, evaluation }) {
  const row = (await pool.query(`
    INSERT INTO claims(
      claim_id,project_id,requirement_id,claim_type,text,basis_requirement_ids,
      basis_evidence_ids,requested_commitment,target_sections,source_status,
      requirement_category,confirmation_type,provider,provider_warnings,claim_assertion_hash
    ) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,NULL,$8::jsonb,'verified',
      'technical','verified','deterministic','[]'::jsonb,$9) RETURNING id
  `, [claim.claim_id, requirement.project_id, requirement.id, claim.claim_type, claim.text,
    JSON.stringify([requirement.req_id]), JSON.stringify([claim.referenced_fact_ids[0]]),
    JSON.stringify(['chapter-claim-eval']), claim.assertion_hash])).rows[0];
  await pool.query(`
    INSERT INTO claim_decisions(claim_id,decision,gate_decision,rule_version,decided_by)
    VALUES($1,$2,$3,'4.3-claim-gate-v2-contract-1','claim-db-gate')
  `, [row.id, decision, gateDecision]);
  return row.id;
}

async function createProjectFact(repository, projectId, factId) {
  const payloadHash = sha(`project-fact:${projectId}:${factId}`);
  const fact = await repository.upsertProjectFact({
    project_fact_id: hashId('PFACT', `${projectId}:${factId}`),
    project_id: projectId,
    key: 'claim.eval.sso',
    fact_role: 'enterprise_fact',
    value_type: 'string',
    value: 'SSO',
    value_status: 'known',
    scope: ['chapter-claim-eval'],
    provenance_refs: [{ source_type: 'human_input', source_id: factId, snapshot_hash: payloadHash, source_ref: null }],
    source_hashes: [payloadHash],
    payload_hash: payloadHash,
    review_status: 'approved',
    conflict_status: 'none',
    created_by_type: 'human',
    created_by: 'claim-db-gate',
    contract_version: 'project-fact-control-v1',
    candidate_version: 'claim-db-gate-v1',
    version: 1
  });
  const binding = {
    propagation_id: hashId('PFB', `${projectId}:${fact.project_fact_id}`),
    project_id: projectId,
    project_fact_id: fact.project_fact_id,
    project_fact_version: fact.version,
    target_type: 'chapter',
    target_id: 'chapter-claim-eval',
    binding_role: 'required',
    binding_status: 'active',
    source_reason: 'manual_binding',
    source_ref: null,
    propagation_version: 1,
    contract_version: 'project-fact-propagation-v1'
  };
  await repository.upsertProjectFactPropagationBindings([binding]);
  return { fact, binding };
}

async function postClaimDecision(app, claimId, body = {}) {
  const server = await new Promise(resolvePromise => {
    const listener = app.listen(0, '127.0.0.1', () => resolvePromise(listener));
  });
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/claims/${claimId}/approve`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });
    return { status: response.status, body: await response.json() };
  } finally {
    await new Promise((resolvePromise, reject) => server.close(error => error ? reject(error) : resolvePromise()));
  }
}

export async function runClaimDbGate({ pool: providedPool } = {}) {
  let pool = providedPool || null;
  const ownsPool = !providedPool;
  let repository = null;
  const projectIds = [];
  try {
    if (!pool) pool = createPool();
    repository = new PgRepository(pool);
    const migration = await verifyMigration049(pool);
    if (migration.status !== 'PASS') return {
      status: 'FAIL', gate: 'CLAIM_DB_GATE', checks: { migration_049: 'FAIL' }, metrics: {}, migration,
      provider_calls: 0, embedding_calls: 0, retrieval_calls: 0,
      production_db_writes: 0, fixture_db_writes: 'none'
    };

    const project = await repository.createProject({ name: `Claim DB Gate ${Date.now()}` });
    const other = await repository.createProject({ name: `Claim DB Gate Other ${Date.now()}` });
    projectIds.push(project.id, other.id);
    await repository.createProjectMembership({ projectId: project.id, actorId: 'claim-db-owner', role: 'OWNER', status: 'ACTIVE', createdBy: 'claim-db-gate' });
    await repository.createProjectMembership({ projectId: other.id, actorId: 'claim-db-other', role: 'OWNER', status: 'ACTIVE', createdBy: 'claim-db-gate' });
    const requirement = await createRequirementFixture(pool, project.id, 'A');
    const factId = 'FACT-DB-SSO';
    const mappingId = 'MAP-DB-SSO';
    const sourceHash = sha('claim-db-gate-source');
    const binding = makeBinding({ projectId: project.id, requirementId: requirement.req_id, factId, mappingId, sourceHash });
    const claim = createClaimAssertion(makeRawClaim({
      claimId: 'CLM-AAAAAAAAAAAAAAAA', requirementId: requirement.req_id, factId, mappingId,
      text: '我司统一身份认证平台已完成 SSO 能力建设。'
    }));
    const baseEvaluation = evaluateEnterpriseClaimV2({ projectId: project.id, claim, binding, evaluatedBy: 'claim-db-gate' });
    const identity = createClaimGateIdentity({ projectId: project.id, requirement, claim, binding, evaluatorVersion: 'claim-db-gate-v1' });
    const evaluation = { ...baseEvaluation, ...identity };
    const claimRowId = await insertClaim(pool, { claim, requirement, decision: 'approved', gateDecision: 'allow', evaluation });
    await repository.createClaimGateEvaluation({ projectId: project.id, claimId: claim.claim_id, requirementId: requirement.req_id, evaluation });
    const loadedClaims = await repository.listClaims(project.id);
    const loaded = loadedClaims.find(item => item.claim_id === claim.claim_id);
    const loadedGate = await repository.getLatestClaimGateEvaluation(project.id, claim.claim_id);
    const identityRoundtrip = Boolean(loaded
      && loaded.assertion_hash === claim.assertion_hash
      && loaded.gate_result_id === identity.gate_result_id
      && loaded.input_snapshot_hash === identity.input_snapshot_hash
      && loaded.claim_assertion_hash === identity.claim_assertion_hash
      && loaded.lineage_current === true
      && loadedGate?.gate_result_id === identity.gate_result_id);
    const parity = loaded?.decision === 'approved'
      && loaded?.gate_decision === 'allow'
      && loaded?.gate_result_decision === 'allow'
      && loadedGate?.decision === 'allow';

    const { fact: projectFact, binding: factBinding } = await createProjectFact(repository, project.id, factId);
    const writerClaim = {
      ...loaded,
      current: true,
      referenced_fact_ids: [projectFact.project_fact_id],
      referenced_mapping_ids: [mappingId],
      target_sections: ['chapter-claim-eval'],
      assertion_hash: loaded.assertion_hash
    };
    const writerGate = { ...loadedGate, claim_id: claim.claim_id, current: true };
    const currentAllow = isCurrentAllowClaim(writerClaim, writerGate);
    const context = createWriterSafeContext({
      projectId: project.id,
      chapterId: 'chapter-claim-eval',
      facts: [projectFact],
      bindings: [factBinding],
      claims: [writerClaim],
      gateResults: [writerGate]
    });
    await repository.saveWriterSafeContext(context);
    const reconstructed = context.assertable_claims.length === 1
      && context.assertable_claims[0].gate_result_id === identity.gate_result_id;

    const staleVariants = [
      { name: 'claim_assertion_hash', gate: { ...writerGate, claim_assertion_hash: sha('changed-claim') } },
      { name: 'gate_result_id', gate: { ...writerGate, gate_result_id: null } },
      { name: 'input_snapshot_hash', gate: { ...writerGate, input_snapshot_hash: null } },
      { name: 'lineage_current', gate: { ...writerGate, lineage_current: false } },
      { name: 'revalidation_required', gate: writerGate, options: { revalidationRequired: [claim.claim_id] } }
    ];
    const staleResults = staleVariants.map(item => ({
      identity: item.name,
      writer_usable: isCurrentAllowClaim(writerClaim, item.gate, item.options)
    }));
    const upstreamIdentities = [
      createClaimGateIdentity({ projectId: project.id, requirement: { ...requirement, requirement_hash: sha('changed-requirement') }, claim, binding }),
      createClaimGateIdentity({ projectId: project.id, requirement, claim, binding: { ...binding, fact_payload_hash: sha('changed-fact') } }),
      createClaimGateIdentity({ projectId: project.id, requirement, claim, binding: { ...binding, mapping_id: 'MAP-DB-CHANGED' } }),
      createClaimGateIdentity({ projectId: project.id, requirement, claim, binding, evaluatorVersion: 'claim-db-gate-v2' })
    ];
    const upstreamChanged = upstreamIdentities.every(item => item.input_snapshot_hash !== identity.input_snapshot_hash);
    const invalidated = await repository.invalidateWriterAuthorization(project.id, {
      projectFactContextHash: 'changed-project-fact-context',
      propagationBindingVersion: 'changed-propagation',
      chapterPlanVersion: 'changed-chapter-plan',
      claimGateIdentity: 'changed-claim-gate-identity',
      authorizationContractVersion: 'writer-input-authorization-v1'
    });
    const contextStatus = (await pool.query(`SELECT status FROM writer_safe_contexts WHERE authorization_snapshot_hash=$1`, [context.authorization_snapshot_hash])).rows[0]?.status;

    const rejectedClaim = createClaimAssertion(makeRawClaim({
      claimId: 'CLM-BBBBBBBBBBBBBBBB', requirementId: requirement.req_id, factId, mappingId,
      text: '我司全部产品均已具备统一身份认证能力。'
    }));
    const rejectedBinding = makeBinding({ projectId: project.id, requirementId: requirement.req_id, factId, mappingId: 'MAP-DB-REJECT', sourceHash, mappingStatus: 'proposed' });
    const rejectedEvaluation = evaluateEnterpriseClaimV2({ projectId: project.id, claim: rejectedClaim, binding: rejectedBinding, evaluatedBy: 'claim-db-gate' });
    await insertClaim(pool, { claim: rejectedClaim, requirement, decision: 'rejected', gateDecision: 'rejected', evaluation: rejectedEvaluation });
    await repository.createClaimGateEvaluation({ projectId: project.id, claimId: rejectedClaim.claim_id, requirementId: requirement.req_id, evaluation: rejectedEvaluation });
    let rejectedOverrideBlocked = false;
    try { await repository.decideClaim(rejectedClaim.claim_id, 'approved', 'ordinary-user'); }
    catch (error) { rejectedOverrideBlocked = error.code === 'CLAIM_GATE_REJECTION_IMMUTABLE'; }

    const ownerApp = createApp({
      repository,
      storage: {},
      productionBetaService: new ProductionBetaService({ repository }),
      projectAuthorizationService: new ProjectAuthorizationService({ repository }),
      actorResolver: () => ({ actor_id: 'claim-db-owner', actor_type: 'test', source: 'integration' })
    });
    const ownerDecision = await postClaimDecision(ownerApp, claim.claim_id, { decided_by: 'spoofed-client' });
    const decidedBy = (await pool.query(`SELECT decided_by FROM claim_decisions WHERE claim_id=$1`, [claimRowId])).rows[0]?.decided_by;
    const actorSpoofIgnored = ownerDecision.status < 300 && decidedBy === 'claim-db-owner';
    const spoofApp = createApp({
      repository,
      storage: {},
      productionBetaService: new ProductionBetaService({ repository }),
      projectAuthorizationService: new ProjectAuthorizationService({ repository }),
      actorResolver: () => null
    });
    const spoofBlocked = (await postClaimDecision(spoofApp, claim.claim_id, { decided_by: 'spoofed-client' })).status === 401;
    const crossProjectApp = createApp({
      repository,
      storage: {},
      productionBetaService: new ProductionBetaService({ repository }),
      projectAuthorizationService: new ProjectAuthorizationService({ repository }),
      actorResolver: () => ({ actor_id: 'claim-db-other', actor_type: 'test', source: 'integration' })
    });
    const crossProjectBlocked = (await postClaimDecision(crossProjectApp, claim.claim_id, {})).status === 403;

    const stalePass = staleResults.every(item => item.writer_usable === false) && upstreamChanged && invalidated === 1 && contextStatus === 'invalidated';
    const currentAllowPass = currentAllow && reconstructed;
    const unauthorizedMutation = rejectedOverrideBlocked && spoofBlocked && actorSpoofIgnored;
    const crossProjectMutation = crossProjectBlocked;
    return {
      status: migration.status === 'PASS' && identityRoundtrip && currentAllowPass && stalePass && parity && unauthorizedMutation && crossProjectMutation ? 'PASS' : 'FAIL',
      gate: 'CLAIM_DB_GATE',
      checks: {
        migration_049: migration.status,
        identity_roundtrip: identityRoundtrip ? 'PASS' : 'FAIL',
        current_allow_reconstruction: currentAllowPass ? 'PASS' : 'FAIL',
        stale_authorization: stalePass ? 'PASS' : 'FAIL',
        gate_decision_parity: parity ? 'PASS' : 'FAIL',
        unauthorized_mutation: unauthorizedMutation ? 'PASS' : 'FAIL',
        cross_project_mutation: crossProjectMutation ? 'PASS' : 'FAIL'
      },
      metrics: {
        stale_claim_writer_use: staleResults.filter(item => item.writer_usable).length,
        stale_authorization_prevented: staleResults.filter(item => !item.writer_usable).length,
        stale_cases: staleResults.length,
        gate_decision_parity_errors: parity ? 0 : 1,
        unauthorized_mutation: unauthorizedMutation ? 0 : 1,
        cross_project_mutation: crossProjectMutation ? 0 : 1
      },
      migration,
      provider_calls: 0,
      embedding_calls: 0,
      retrieval_calls: 0,
      production_db_writes: 0,
      fixture_db_writes: 'ephemeral_synthetic_fixture_only',
      fixture: { synthetic: true, project_count: 2, writer_context_invalidated: contextStatus === 'invalidated' },
      diagnostics: {
        current_allow: currentAllow,
        reconstructed,
        loaded_claim: loaded ? {
          decision: loaded.decision,
          gate_decision: loaded.gate_decision,
          gate_result_decision: loaded.gate_result_decision,
          assertion_hash_present: Boolean(loaded.assertion_hash),
          gate_result_id_present: Boolean(loaded.gate_result_id),
          input_snapshot_hash_present: Boolean(loaded.input_snapshot_hash),
          lineage_current: loaded.lineage_current,
          writer_eligible: loaded.writer_eligible,
          target_sections: loaded.target_sections
        } : null,
        loaded_gate: loadedGate ? {
          decision: loadedGate.decision,
          writer_eligible: loadedGate.writer_eligible,
          lineage_current: loadedGate.lineage_current
        } : null,
        context_assertable_count: context.assertable_claims.length,
        context_blocked_count: context.blocked_items.length
      }
    };
  } catch (error) {
    return {
      status: 'FAIL',
      gate: 'CLAIM_DB_GATE',
      checks: { failure: 'FAIL' },
      failure: {
        owner: error.code === '23505' || error.code === '23514' ? 'CLAIM_GATE_PERSISTENCE' : 'TEST_INFRA_FAILURE',
        error_code: error.message === 'DATABASE_URL is required' ? 'DATABASE_URL_MISSING' : (error.code || 'CLAIM_DB_GATE_FAILED'),
        message: 'Claim DB Gate failed.'
      },
      provider_calls: 0,
      embedding_calls: 0,
      retrieval_calls: 0,
      production_db_writes: 0,
      fixture_db_writes: 'none'
    };
  } finally {
    if (pool && projectIds.length) await pool.query(`DELETE FROM projects WHERE id=ANY($1::uuid[])`, [projectIds]).catch(() => {});
    if (pool && ownsPool) await pool.end();
  }
}
