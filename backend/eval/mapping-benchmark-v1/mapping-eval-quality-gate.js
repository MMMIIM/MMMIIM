import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  loadMappingGold,
  goldIdentity,
  scoreMappingCases
} from './mapping-eval-metrics.js';
import {
  createRequirementEvidenceMapping,
  MAPPING_DIMENSIONS,
  MAPPING_DIMENSION_VALUES
} from '../../src/pipeline/requirement-evidence-mapping-contract-v1.js';
import {
  applyMappingDecisionPolicy,
  projectMappingTransportResult
} from '../../src/pipeline/mapping-decision-policy-v1.js';
import { MappingCandidateBuilder } from '../../src/pipeline/mapping-candidate-builder.js';
import { SemanticGatewayMappingEvaluator } from '../../src/pipeline/semantic-gateway-mapping-evaluator.js';
import { validateTaskData } from '../../../packages/semantic-contracts/index.js';
import { evaluateClaimGateBridge } from '../../src/pipeline/claim-gate-input-adapter-v1.js';
import {
  authorizeProjectFact,
  createWriterSafeContext
} from '../../src/pipeline/writer-input-authorization-v1.js';
import { buildWriterTask } from '../../src/pipeline/writer-execution-contract-v1.js';
import { deriveReadiness } from '../../src/evidence-readiness-service.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const H = 'a'.repeat(64);
const mappingTransportDimensions = ['subject', 'scope', 'status', 'quantity', 'entity', 'validity'];
const sha256 = value => createHash('sha256').update(String(value), 'utf8').digest('hex');

const decisionToSupport = {
  direct_full: 'full_support',
  partial_support: 'partial_support',
  related_reference: 'reference_only',
  related_insufficient: 'insufficient',
  conflict: 'conflict',
  unrelated: 'insufficient',
  unknown: 'unknown'
};

function fixtureFact(gold, index = 0) {
  const source = gold.facts?.[index] || {};
  return {
    fact_id: source.fact_ref || `${gold.case_id}-F${index + 1}`,
    project_id: `EVAL-${gold.case_id}`,
    evidence_review_id: `${gold.case_id}-REVIEW`,
    source_span_id: `${gold.case_id}-SPAN-${index + 1}`,
    material_id: `${gold.case_id}-MATERIAL`,
    fact_payload_hash: H,
    fact_contract_version: 'evidence-fact-v1',
    fact_review_status: 'approved',
    fact_current: true,
    source_lineage_verified: true,
    upstream_support_level: 'full_support',
    subject: source.subject || null,
    entities: source.entities || [],
    fact_status: source.fact_status || 'unknown',
    scopes: source.scopes || [],
    quantities: source.quantities || [],
    validity: source.validity || { status: 'unknown' }
  };
}

function fixtureRequirement(gold) {
  const text = gold.requirement?.text || '';
  return {
    requirement_id: gold.case_id,
    text,
    requirement_hash: sha256(`${gold.case_id}\u0000${text}`)
  };
}

function fixtureContext(gold, fact) {
  return {
    project_id: fact.project_id,
    requirement_db_id: `${gold.case_id}-DB`,
    requirement_id: gold.case_id,
    requirement_hash: H,
    requirement_contract_version: 'canonical-requirement-v1',
    requirement_valid: true,
    fact_id: fact.fact_id,
    fact_payload_hash: fact.fact_payload_hash,
    fact_contract_version: fact.fact_contract_version,
    fact_review_status: fact.fact_review_status,
    evidence_review_id: fact.evidence_review_id,
    source_span_id: fact.source_span_id,
    material_id: fact.material_id
  };
}

function projectExpected(gold) {
  const fact = fixtureFact(gold);
  const context = fixtureContext(gold, fact);
  const expected = gold.expected;
  const transport = {
    fact_ref: fact.fact_id,
    decision: expected.decision,
    dimensions: Object.fromEntries(mappingTransportDimensions.map(name => [name, expected.dimensions[name]]))
  };
  const projected = projectMappingTransportResult(transport, context);
  const policy = applyMappingDecisionPolicy(projected, {
    requirement: { text: gold.requirement?.text || '' },
    upstream_support_level: null
  });
  const canonical = createRequirementEvidenceMapping(context, policy, {
    evaluatorVersion: 'mapping-eval-offline-policy-v1'
  });
  return { fact, context, transport, projected, policy, canonical };
}

function checkTransportContract(gold) {
  const transport = projectExpected(gold).transport;
  validateTaskData('requirement_evidence_mapping', { results: [transport] });
  return true;
}

async function checkAliasIntegrity(gold) {
  const fact = fixtureFact(gold);
  const evaluator = new SemanticGatewayMappingEvaluator({
    client: { run: async () => ({ envelope: { data: { results: [{ ...projectExpected(gold).transport }, { ...projectExpected(gold).transport }] } } }) }
  });
  try {
    await evaluator.evaluate({ requirement: fixtureRequirement(gold), facts: [fact] });
    return false;
  } catch (error) {
    return error.code === 'MAPPING_RESULT_SET_INVALID';
  }
}

async function checkBatchSplit(gold) {
  const facts = gold.facts.map((_, index) => fixtureFact(gold, index));
  const calls = [];
  const evaluator = new SemanticGatewayMappingEvaluator({
    batchSize: 6,
    client: {
      run: async request => {
        const payload = JSON.parse(request.task_payload_json);
        calls.push(payload);
        return { envelope: { data: { results: payload.facts.map(fact => ({
          fact_ref: fact.fact_ref,
          decision: 'direct_full',
          dimensions: Object.fromEntries(mappingTransportDimensions.map(name => [name, 'match']))
        })) } } };
      }
    }
  });
  const results = await evaluator.evaluate({
    requirement: fixtureRequirement(gold),
    facts
  });
  const refs = results.map(result => result.fact_id || result.fact_ref);
  return calls.length === 2
    && calls[0].facts.length === 6
    && calls[1].facts.length === 1
    && refs.length === 7
    && refs.every((ref, index) => ref === facts[index].fact_id);
}

export async function runDownstreamSafetyGate() {
  const violations = [];
  const projectId = 'SAFETY-PROJECT';
  const fact = {
    fact_id: 'SAFETY-F1', project_id: projectId, evidence_review_id: 'SAFETY-R1', review_status: 'approved',
    version: 1, payload_hash: H, contract_version: 'evidence-fact-v1',
    subject: { type: 'project', name: '项目A' }, entities: [], fact_status: 'participated',
    scopes: ['enterprise'], quantities: [], validity: { status: 'unknown' }
  };
  const requirement = { req_id: 'SAFETY-REQ', requirement_hash: H, contract_version: 'canonical-requirement-v1' };
  const claim = {
    claim_id: 'SAFETY-C1', project_id: projectId, requirement_id: requirement.req_id,
    text: '参与项目A', assertions: [{ subject: fact.subject, entities: [], status: 'participated', scopes: [], quantities: [], validity: { status: 'unknown' } }],
    referenced_fact_ids: [fact.fact_id], referenced_mapping_ids: ['SAFETY-M1']
  };
  for (const supportLevel of ['partial_support', 'reference_only', 'insufficient', 'conflict', 'unknown']) {
    const mapping = {
      mapping_id: 'SAFETY-M1', review_status: 'approved', support_level: supportLevel,
      semantic_relationship: supportLevel === 'conflict' ? 'conflict' : supportLevel === 'unknown' ? 'unknown' : supportLevel === 'reference_only' ? 'reference' : 'partial',
      dimensions: Object.fromEntries(MAPPING_DIMENSIONS.map(name => [name, 'unknown'])), contract_version: 'requirement-evidence-mapping-v1.1'
    };
    const bridge = evaluateClaimGateBridge({ projectId, requirement, claim, facts: [fact], mappings: [mapping], lineage: { verified: true, usable: true, material_type: 'project_case' } });
    if (bridge.evaluation.decision === 'allow' || bridge.evaluation.writer_eligible === true) violations.push({ type: 'AUTHORITY_ESCALATION', supportLevel });
  }

  const enterpriseFact = {
    project_fact_id: 'SAFETY-PF1', project_id: projectId, version: 1, key: 'private_value', fact_role: 'enterprise_fact',
    value_type: 'string', value: 'sensitive synthetic value', value_status: 'known', review_status: 'approved', conflict_status: 'none', payload_hash: H,
    provenance_refs: [{ source_type: 'evidence_fact', source_id: fact.fact_id, snapshot_hash: H }]
  };
  const authorization = authorizeProjectFact(enterpriseFact);
  const safeContext = createWriterSafeContext({
    projectId, chapterId: 'SAFETY-CHAPTER', facts: [enterpriseFact],
    bindings: [{ project_fact_id: enterpriseFact.project_fact_id, target_type: 'chapter', target_id: 'SAFETY-CHAPTER', binding_role: 'required', binding_status: 'active' }]
  });
  if (authorization.authorization_mode !== 'claim_required' || safeContext.context_items.some(item => item.project_fact_id === enterpriseFact.project_fact_id)
    || !safeContext.blocked_items.some(item => item.authorization_mode === 'claim_required')) violations.push({ type: 'WRITER_AUTHORITY_BYPASS' });
  try {
    buildWriterTask({ safeContext, bindings: [] });
  } catch (error) {
    if (error.code !== 'WRITER_UNAUTHORIZED_CONTEXT') violations.push({ type: 'WRITER_ASSERTION_UNEXPECTED', code: error.code });
  }

  const readiness = [
    { review_status: 'approved', fact_review_status: 'approved', evidence_review_status: 'approved', mapping_current: true, fact_current: true, support_level: 'full_support' }
  ];
  if (deriveReadiness(readiness) !== 'SUPPORTED') violations.push({ type: 'READINESS_REGRESSION' });

  const builder = new MappingCandidateBuilder({ repository: {
    getMappingCandidateContext: async () => ({
      requirement: { requirement_db_id: 'RDB', requirement_id: 'REQ', requirement_hash: H, requirement_valid: true, project_id: 'P' },
      reviews: [{ review_id: 'R', requirement_id: 'RDB', requirement_text_hash: H, review_status: 'approved' }],
      facts: [{ ...fixtureFact({ case_id: 'CROSS', facts: [] }), project_id: 'OTHER', evidence_review_id: 'R' }]
    })
  } });
  const crossProject = await builder.build({ projectId: 'P', requirementId: 'REQ' });
  if (crossProject.facts.length !== 0) violations.push({ type: 'CROSS_PROJECT_CANDIDATE_LEAKAGE' });

  return {
    status: violations.length ? 'FAIL' : 'PASS',
    metrics: {
      false_full: violations.filter(item => item.type === 'FALSE_FULL').length,
      authority_escalation: violations.filter(item => item.type === 'AUTHORITY_ESCALATION').length,
      unauthorized_claim_allow: violations.filter(item => item.type === 'UNAUTHORIZED_CLAIM_ALLOW').length,
      writer_authority_bypass: violations.filter(item => item.type === 'WRITER_AUTHORITY_BYPASS').length,
      cross_project_candidate_leakage: violations.filter(item => item.type === 'CROSS_PROJECT_CANDIDATE_LEAKAGE').length
    },
    violations,
    provider_calls: 0,
    db_writes: 0
  };
}

export async function runMappingFastGate({ gold = loadMappingGold() } = {}) {
  const identity = goldIdentity(gold);
  if (!identity.validation.ok) return { status: 'FAIL', gold: identity, semantic_model_quality: 'NOT_MEASURED', provider_calls: 0, db_writes: 0, errors: identity.validation.errors };
  const cases = [];
  let transportPass = true;
  let projectionPass = true;
  let policyPass = true;
  let batchPass = true;
  for (const item of gold.cases) {
    if (Array.isArray(item.expected?.batch_sizes)) {
      batchPass = batchPass && await checkBatchSplit(item);
      continue;
    }
    try {
      checkTransportContract(item);
      const output = projectExpected(item);
      cases.push({ gold: item, actual: output.transport, canonical: output.canonical });
      if (!output.projected.semantic_relationship || !decisionToSupport[item.expected.decision]) projectionPass = false;
      if (!MAPPING_DIMENSIONS.every(name => MAPPING_DIMENSION_VALUES.includes(output.canonical.dimensions[name]))) policyPass = false;
    } catch (_error) {
      transportPass = false;
    }
  }
  const aliasPass = await checkAliasIntegrity(gold.cases[0]);
  const score = scoreMappingCases(cases);
  const downstream = await runDownstreamSafetyGate();
  const checks = {
    gold_integrity: identity.validation.ok,
    transport: transportPass,
    projection: projectionPass,
    policy: policyPass,
    no_escalation: score.metrics.false_full_count === 0
      && score.taxonomy.primary.AUTHORITY_ESCALATION + score.taxonomy.secondary.AUTHORITY_ESCALATION === 0,
    alias_integrity: aliasPass,
    batch_split: batchPass,
    taxonomy: Object.values(score.taxonomy.primary).reduce((sum, count) => sum + count, 0) === 0,
    metrics: score.metrics.cases === gold.cases.filter(item => item.expected?.decision).length,
    downstream_safety: downstream.status === 'PASS'
  };
  return {
    status: Object.values(checks).every(Boolean) ? 'PASS' : 'FAIL',
    gate: 'MAPPING_FAST_GATE',
    gold: identity,
    checks,
    metrics: score.metrics,
    taxonomy: score.taxonomy,
    case_results: score.case_results,
    failed_gold_ids: score.case_results.filter(row => !row.decision_correct).map(row => row.gold_id),
    negative_controls: { status: downstream.status, metrics: downstream.metrics, violations: downstream.violations },
    semantic_model_quality: 'NOT_MEASURED',
    provider_calls: 0,
    db_writes: 0
  };
}

export async function runDbGate({ enabled = false, runner = null } = {}) {
  if (!enabled) return { status: 'NOT_EXECUTED', reason_code: 'DB_OPT_IN_REQUIRED', provider_calls: 0, db_writes: 0 };
  const run = runner || (() => new Promise(resolve => {
    const command = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const child = spawn(command, ['run', 'test:postgres', '-w', 'backend', '--', '--test-reporter=tap'], { cwd: repoRoot, windowsHide: true });
    let stdout = ''; let stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('close', exitCode => resolve({ exitCode, stdout, stderr }));
    child.on('error', error => resolve({ exitCode: 1, stdout, stderr: String(error.message) }));
  }));
  const result = await run();
  const combined = `${result.stdout || ''}\n${result.stderr || ''}`;
  if (result.exitCode === 0) return { status: 'PASS', tests: 'existing-postgres-command', exit_code: 0, provider_calls: 0, db_writes: 0 };
  if (/ECONNREFUSED|connect.*refused|database unavailable/i.test(combined)) return { status: 'NOT_VERIFIED', reason_code: 'DB_UNAVAILABLE', exit_code: result.exitCode, provider_calls: 0, db_writes: 0 };
  return { status: 'FAIL', reason_code: 'DB_TEST_FAILED', exit_code: result.exitCode, provider_calls: 0, db_writes: 0 };
}

export async function runSemanticGate({ mode = 'fast', cases = [], evaluator = null, callCounter = { calls: 0 } } = {}) {
  if (mode !== 'live') return { status: 'NOT_EXECUTED', provider_calls: 0, semantic_model_quality: 'NOT_MEASURED', cases: 0 };
  if (!evaluator || typeof evaluator.evaluate !== 'function') return { status: 'BLOCKED', reason_code: 'LIVE_EVALUATOR_REQUIRED', provider_calls: 0, semantic_model_quality: 'NOT_EVALUATED' };
  const results = [];
  for (const gold of cases.filter(item => item.expected?.decision)) {
    const fact = fixtureFact(gold);
    try {
      const actual = await evaluator.evaluate({ requirement: fixtureRequirement(gold), facts: [fact] });
      results.push({ gold, actual: actual[0] || null });
    } catch (error) {
      results.push({ gold, actual: null, error: { code: error.code || 'LIVE_EVAL_FAILED', message: error.message } });
    }
  }
  const score = scoreMappingCases(results, { qualityMeasured: true });
  return { status: results.every(item => item.actual) ? 'PASS' : 'FAIL', provider_calls: callCounter.calls || 0, ...score };
}

export async function runMappingQualityGate({ mode = 'fast', db = false, gold = loadMappingGold(), evaluator = null, callCounter = { calls: 0 } } = {}) {
  const fast = await runMappingFastGate({ gold });
  const downstream = await runDownstreamSafetyGate();
  const dbGate = await runDbGate({ enabled: db || mode === 'db' || mode === 'release' });
  const semantic = await runSemanticGate({ mode: mode === 'release' ? 'live' : mode, cases: gold.cases, evaluator, callCounter });
  const releaseReady = fast.status === 'PASS' && downstream.status === 'PASS' && dbGate.status === 'PASS'
    && (mode !== 'release' || semantic.status === 'PASS');
  return {
    mode,
    gates: {
      MAPPING_FAST_GATE: fast,
      MAPPING_DB_GATE: dbGate,
      MAPPING_SEMANTIC_GATE: semantic,
      MAPPING_DOWNSTREAM_SAFETY_GATE: downstream,
      MAPPING_RELEASE_GATE: { status: releaseReady ? 'PASS' : 'BLOCKED', reason_code: releaseReady ? null : 'REQUIRED_LAYER_NOT_VERIFIED' }
    },
    provider_calls: (fast.provider_calls || 0) + (semantic.provider_calls || 0),
    db_writes: (fast.db_writes || 0) + (dbGate.db_writes || 0)
  };
}
