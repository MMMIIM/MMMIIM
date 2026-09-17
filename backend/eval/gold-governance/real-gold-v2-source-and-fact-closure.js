import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { buildRequirementReconstructionFoundation } from './requirement-source-reconstruction.js';
import { buildTrackBSourceFactClosure } from './real-gold-v2-source-fact-closure.js';

/**
 * Eval-only closure for the two Real Gold V2 source foundations.
 *
 * This is an orchestration/reporting layer: it composes the independently
 * verified Track A and Track B builders and never imports data into the
 * production database, mutates Gold, or calls a Provider.
 */
export const CLOSURE_SCHEMA_VERSION = 'v43-real-gold-v2-source-and-fact-closure-v1';
export const CLOSURE_CHECKPOINT = 'V43_REAL_GOLD_V2_SOURCE_AND_FACT_CLOSURE_CHECKPOINT';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_OUTPUT_DIR = path.join(HERE, 'v43-real-gold-v2-source-and-fact-closure');
const sha256 = value => crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
const stable = value => Array.isArray(value)
  ? value.map(stable)
  : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]))
    : value;

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(stable(value), null, 2)}\n`, 'utf8');
}

function renderMarkdown(result) {
  const lines = [
    '# V43 Real Gold V2 Source and Fact Closure',
    '',
    'Eval-only closure report. No Requirement authority, Enterprise Fact, Gold, Mapping, Claim, or Production state is promoted by this artifact.',
    '',
    '## Requirement source foundation',
    '',
    `- REQUIREMENT_SOURCE_A_COUNT: ${result.REQUIREMENT_SOURCE_A_COUNT}`,
    `- REQUIREMENT_SOURCE_B_COUNT: ${result.REQUIREMENT_SOURCE_B_COUNT}`,
    `- REQUIREMENT_SOURCE_C_COUNT: ${result.REQUIREMENT_SOURCE_C_COUNT}`,
    `- SIX_TENDER_SOURCE_PARITY: ${result.SIX_TENDER_SOURCE_PARITY}`,
    `- SAFE_TO_START_HUMAN_REQUIREMENT_RECONSTRUCTION: ${result.SAFE_TO_START_HUMAN_REQUIREMENT_RECONSTRUCTION}`,
    '',
    '## Enterprise source / Fact V2 foundation',
    '',
    `- REAL_ENTERPRISE_SOURCE_CANDIDATES: ${result.REAL_ENTERPRISE_SOURCE_CANDIDATES}`,
    `- REAL_ENTERPRISE_SOURCE_ELIGIBLE: ${result.REAL_ENTERPRISE_SOURCE_ELIGIBLE}`,
    `- REAL_FACT_V2_ELIGIBLE_CANDIDATES: ${result.REAL_FACT_V2_ELIGIBLE_CANDIDATES}`,
    `- REAL_FACT_V2_BLIND_PACKET: ${result.REAL_FACT_V2_BLIND_PACKET}`,
    `- SAFE_TO_START_HUMAN_FACT_V2_REVIEW: ${result.SAFE_TO_START_HUMAN_FACT_V2_REVIEW}`,
    '',
    '## Readiness gates',
    '',
    `- SAFE_TO_FREEZE_REAL_FACT_V2: ${result.SAFE_TO_FREEZE_REAL_FACT_V2}`,
    `- SAFE_TO_BUILD_MAPPING_GOLD_V2: ${result.SAFE_TO_BUILD_MAPPING_GOLD_V2}`,
    `- SAFE_TO_RUN_WRITER_LIVE_EVAL: ${result.SAFE_TO_RUN_WRITER_LIVE_EVAL}`,
    `- SAFE_TO_START_BID_PILOT_HITL: ${result.SAFE_TO_START_BID_PILOT_HITL}`,
    '',
    '## Gaps and decisions required',
    '',
    ...result.CORPUS_GAP.map(value => `- CORPUS_GAP: ${value}`),
    ...result.SOURCE_AUTHORITY_GAP.map(value => `- SOURCE_AUTHORITY_GAP: ${value}`),
    ...result.HUMAN_DECISION_REQUIRED.map(value => `- HUMAN_DECISION_REQUIRED: ${value}`),
    '',
    '## Side effects',
    '',
    `- PROVIDER_CALLS: ${result.PROVIDER_CALLS}`,
    `- PRODUCTION_DB_WRITES: ${result.PRODUCTION_DB_WRITES}`,
    `- GOLD_MUTATIONS: ${result.GOLD_MUTATIONS}`,
    `- PRODUCTION_SEMANTIC_CHANGES: ${result.PRODUCTION_SEMANTIC_CHANGES}`,
    '',
    `- FINAL_VERDICT: ${result.FINAL_VERDICT}`,
    ''
  ];
  return lines.join('\n');
}

function flattenUnique(values) {
  return [...new Set(values.flat().filter(Boolean))];
}

export function buildRealGoldV2SourceAndFactClosure({ outputDir = DEFAULT_OUTPUT_DIR, now = '2026-09-04T00:00:00.000Z' } = {}) {
  const requirement = buildRequirementReconstructionFoundation({ write: false, now });
  const enterprise = buildTrackBSourceFactClosure({ outputDir: null, now });
  const result = {
    schema_version: CLOSURE_SCHEMA_VERSION,
    checkpoint: CLOSURE_CHECKPOINT,
    generated_at: now,
    eval_only: true,
    REQUIREMENT_SOURCE_A_COUNT: requirement.source_a_count,
    REQUIREMENT_SOURCE_B_COUNT: requirement.source_b_count,
    REQUIREMENT_SOURCE_C_COUNT: requirement.source_c_count,
    SIX_TENDER_SOURCE_PARITY: requirement.gates.SIX_TENDER_SOURCE_PARITY,
    SAFE_TO_START_HUMAN_REQUIREMENT_RECONSTRUCTION: requirement.gates.SAFE_TO_START_HUMAN_REQUIREMENT_RECONSTRUCTION,
    REAL_ENTERPRISE_SOURCE_CANDIDATES: enterprise.manifest.source_candidate_count,
    REAL_ENTERPRISE_SOURCE_ELIGIBLE: enterprise.manifest.authority_eligible_count,
    REAL_FACT_V2_ELIGIBLE_CANDIDATES: enterprise.manifest.real_fact_v2_eligible_candidates,
    REAL_FACT_V2_BLIND_PACKET: enterprise.packet.status,
    SAFE_TO_START_HUMAN_FACT_V2_REVIEW: enterprise.packet.status === 'SOURCE_READY_FOR_HUMAN_FACT_REVIEW' ? 'YES' : 'NO',
    SAFE_TO_FREEZE_REAL_FACT_V2: 'NO',
    SAFE_TO_BUILD_MAPPING_GOLD_V2: 'NO',
    SAFE_TO_RUN_WRITER_LIVE_EVAL: 'NO',
    SAFE_TO_START_BID_PILOT_HITL: 'NO',
    CORPUS_GAP: flattenUnique([
      enterprise.manifest.corpus_gaps,
      requirement.source_c_count > 0 ? ['authoritative requirement packets missing for: TB-003, FAST-04'] : []
    ]),
    SOURCE_AUTHORITY_GAP: flattenUnique([
      enterprise.checkpoint.source_authority_gaps,
      enterprise.manifest.sources.flatMap(row => row.blocking_reasons.filter(reason => reason.includes('AUTHORITY')))
    ]),
    HUMAN_DECISION_REQUIRED: flattenUnique([
      ['Human Authority must review JY-001 reconstruction candidates against the original PDF source spans.'],
      ['TB-003 and FAST-04 require a separately authorized source packet or manual reconstruction; no automatic extraction is performed.'],
      enterprise.checkpoint.human_decision_required
    ]),
    PROVIDER_CALLS: 0,
    PRODUCTION_DB_WRITES: 0,
    GOLD_MUTATIONS: 0,
    PRODUCTION_SEMANTIC_CHANGES: 0,
    FINAL_VERDICT: 'REAL_GOLD_V2_SOURCE_AND_FACT_CLOSURE_BLOCKED_BY_HUMAN_AUTHORITY_AND_SOURCE_AUTHORITY_GAPS',
    component_checkpoints: {
      requirement_source: 'backend/eval/gold-governance/v43-gold-v2-foundation/REQUIREMENT_SOURCE_RECONSTRUCTION_CHECKPOINT.json',
      enterprise_source_fact: 'backend/eval/gold-governance/v43-real-gold-v2-source-fact-closure/track-b-source-fact-closure-checkpoint.json'
    }
  };
  if (outputDir) {
    writeJson(path.join(outputDir, 'V43_REAL_GOLD_V2_SOURCE_AND_FACT_CLOSURE_CHECKPOINT.json'), result);
    fs.writeFileSync(path.join(outputDir, 'V43_REAL_GOLD_V2_SOURCE_AND_FACT_CLOSURE_CHECKPOINT.md'), `${renderMarkdown(result)}\n`, 'utf8');
    fs.writeFileSync(path.join(outputDir, 'V43_REAL_GOLD_V2_SOURCE_AND_FACT_CLOSURE_REPORT.md'), `${renderMarkdown(result)}\n`, 'utf8');
    writeJson(path.join(outputDir, 'V43_REAL_GOLD_V2_SOURCE_AND_FACT_CLOSURE_INPUT_DIGEST.json'), {
      schema_version: CLOSURE_SCHEMA_VERSION,
      generated_at: now,
      requirement_component_digest: sha256(JSON.stringify(requirement)),
      enterprise_component_digest: sha256(JSON.stringify(enterprise)),
      provider_calls: 0,
      production_db_writes: 0,
      gold_mutations: 0
    });
  }
  return { ...result, requirement, enterprise };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = buildRealGoldV2SourceAndFactClosure();
  console.log(JSON.stringify({
    checkpoint: result.checkpoint,
    requirement_source_a: result.REQUIREMENT_SOURCE_A_COUNT,
    requirement_source_b: result.REQUIREMENT_SOURCE_B_COUNT,
    requirement_source_c: result.REQUIREMENT_SOURCE_C_COUNT,
    six_tender_source_parity: result.SIX_TENDER_SOURCE_PARITY,
    enterprise_source_candidates: result.REAL_ENTERPRISE_SOURCE_CANDIDATES,
    enterprise_source_eligible: result.REAL_ENTERPRISE_SOURCE_ELIGIBLE,
    real_fact_v2_eligible_candidates: result.REAL_FACT_V2_ELIGIBLE_CANDIDATES,
    blind_packet: result.REAL_FACT_V2_BLIND_PACKET,
    provider_calls: result.PROVIDER_CALLS,
    production_db_writes: result.PRODUCTION_DB_WRITES,
    gold_mutations: result.GOLD_MUTATIONS,
    final_verdict: result.FINAL_VERDICT
  }, null, 2));
}
