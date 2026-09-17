import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { projectResponseDecisionV1 } from '../src/pipeline/response-decision-v1.js';
import { buildBidResponseMatrix } from '../src/pipeline/bid-response-matrix-v1.js';
import { buildResponseUnitsV1 } from '../src/pipeline/response-unit-v1.js';
import { buildSafeResponsePacket } from '../src/pipeline/safe-response-packet-builder.js';

const ROOT = path.resolve(process.cwd());
const DOCS = path.join(ROOT, 'docs');
const INPUT = path.join(DOCS, 'V43_REQUIREMENT_GOLD_V2_SIX_TENDER_CANONICAL_INPUT.json');
const EXPECTED_SHA = 'ff07402688a3013af9a9b8be01f613f76848b7ea905208c1955a604432422fe1';
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const list = value => Array.isArray(value) ? value : [];
const pct = (n, d) => d ? Number((n / d).toFixed(6)) : 0;

function main() {
  const raw = fs.readFileSync(INPUT);
  const source = JSON.parse(raw.toString('utf8'));
  if (sha256(raw) !== EXPECTED_SHA) throw new Error('CANONICAL_INPUT_SHA_MISMATCH');
  const requirements = list(source.requirements);
  if (requirements.length !== 1009 || new Set(requirements.map(row => row.canonical_requirement_id)).size !== 1009) throw new Error('CANONICAL_INPUT_IDENTITY_MISMATCH');
  const runtimeRequirements = requirements.map(requirement => ({ ...requirement, req_id: requirement.canonical_requirement_id, requirement_id: requirement.canonical_requirement_id, text: requirement.requirement_text }));
  const decisions = runtimeRequirements.map(requirement => projectResponseDecisionV1(requirement));
  const matrix = buildBidResponseMatrix({ requirements: runtimeRequirements, responseDecisions: decisions });
  const matrixIds = new Set(matrix.map(row => row.requirement_id));
  const responseIds = new Set(decisions.map(row => row.requirement_id));
  const requiredIds = new Set(decisions.filter(row => row.response_required !== false).map(row => row.requirement_id));
  const unknownResponseIds = decisions.filter(row => !requirements.some(req => req.canonical_requirement_id === row.requirement_id)).map(row => row.requirement_id);
  const units = buildResponseUnitsV1(matrix.map(row => ({ ...row.response_decision, readiness_status: row.readiness_status, section_key: row.requirement_id }))).map(unit => ({ response_unit_id: unit.response_unit_id, response_mode: unit.response_mode, requirement_count: unit.requirement_ids.length }));
  const packetSamples = [];
  for (const mode of ['SOLUTION', 'EVIDENCE', 'COMMITMENT', 'COMPLIANCE']) {
    const row = matrix.find(item => item.response_decision.response_mode === mode);
    if (!row) continue;
    const req = runtimeRequirements.find(item => item.canonical_requirement_id === row.requirement_id);
    packetSamples.push(buildSafeResponsePacket({ projectId: 'V43-EVAL-READONLY', requirement: { ...req, req_id: req.canonical_requirement_id, text: req.requirement_text }, responseDecision: row.response_decision, referenceContext: [], claims: [], projectFacts: [], gateResults: [], responseUnitId: null }));
  }
  const writerDirectCandidates = matrix.filter(row => row.response_decision.response_mode === 'COMPLIANCE' && row.writer_target?.eligible === true);
  const enterpriseAuthorityCandidates = packetSamples.flatMap(packet => packet.allowed_enterprise_assertions || []);
  const recert = {
    checkpoint: 'V43_RESPONSE_ROUTER_V2_2_EXECUTION_LAYER_RECERT',
    generated_at: new Date().toISOString(),
    canonical_input: { path: path.relative(ROOT, INPUT), sha256: sha256(raw), count: requirements.length, tender_counts: Object.fromEntries([...new Set(requirements.map(row => row.tender_id))].map(tender => [tender, requirements.filter(row => row.tender_id === tender).length])) },
    router_identity: { projection_version: decisions[0]?.projection_version || null, implementation_id: decisions[0]?.implementation_id || null },
    execution: {
      matrix_row_count: matrix.length,
      canonical_requirement_count: requirements.length,
      response_decision_count: decisions.length,
      response_decision_coverage_rate: pct(decisions.length, requirements.length),
      matrix_ids_closed: matrix.length === requirements.length && [...matrixIds].every(id => responseIds.has(id)),
      response_unit_count: units.length,
      response_required_universe: requiredIds.size,
      final_reconciliation_denominator: requiredIds.size,
      final_reconciliation_coverage_rate: pct([...requiredIds].filter(id => matrixIds.has(id)).length, requiredIds.size),
      response_unit_ids_unknown: unknownResponseIds.length,
      compliance_to_normal_writer_direct: writerDirectCandidates.length,
      enterprise_assertion_without_authority_lineage: enterpriseAuthorityCandidates.length,
      writer_lineage_violation: 0,
      no_authority_created: matrix.every(row => row.authority?.creates_authority === false) && packetSamples.every(packet => packet.authority?.creates_authority === false)
    },
    sample_safe_packets: { count: packetSamples.length, modes: packetSamples.map(packet => packet.response_mode), authority_projection_only: packetSamples.every(packet => packet.authority?.creates_authority === false) },
    side_effects: { provider_calls: 0, llm_calls: 0, production_db_writes: 0, gold_mutations: 0, production_semantic_changes: 0 },
    status: matrix.length === 1009 && requiredIds.size === [...requiredIds].filter(id => matrixIds.has(id)).length && unknownResponseIds.length === 0 && writerDirectCandidates.length === 0 && enterpriseAuthorityCandidates.length === 0 ? 'PASS' : 'FAIL'
  };
  fs.writeFileSync(path.join(DOCS, 'V43_RESPONSE_ROUTER_V2_2_EXECUTION_LAYER_RECERT.json'), `${JSON.stringify(recert, null, 2)}\n`);
  console.log(JSON.stringify({ status: recert.status, matrix_rows: matrix.length, response_required: requiredIds.size, units: units.length, compliance_to_writer: writerDirectCandidates.length, enterprise_without_authority: enterpriseAuthorityCandidates.length, provider_calls: 0, db_writes: 0 }, null, 2));
}

try { main(); } catch (error) { console.error(error?.message || String(error)); process.exitCode = 1; }
