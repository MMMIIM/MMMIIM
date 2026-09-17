import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildArtifacts, SOURCE_CANDIDATES, TARGET_TENDER_IDS } from '../gold-human-review/v2/mapping-real-rebuild/build-real-gold-source-foundation.js';
import { buildRealFactV2Foundation } from './real-fact-v2-foundation.js';
import { runWriterProviderOffFoundation } from './writer-eval-provider-off-foundation.js';
import { buildArchitectureMaterialization } from './architecture-materialization.js';
import { buildFactControlReconciliation } from './fact-control-reconciliation.js';
import { buildBidPilotReadOnlyFoundation } from './bid-pilot-read-only-foundation.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_OUTPUT_DIR = path.join(HERE, 'v43-gold-v2-foundation');

export const FOUNDATION_TENDER_IDS = Object.freeze(['JY-001', 'TB-003', 'TB-006', 'FAST-01', 'FAST-04', 'FAST-WATER-01']);
if (JSON.stringify(FOUNDATION_TENDER_IDS) !== JSON.stringify(TARGET_TENDER_IDS)) {
  throw new Error('FOUNDATION_TENDER_IDS_TARGET_TENDER_IDS_MISMATCH');
}

export function classifyRequirementSources({ tenderSources = [] } = {}) {
  return Object.fromEntries(tenderSources.map(source => {
    const packet = source.packet_available === true;
    const file = source.source_file_exists === true;
    const identity = source.source_identity?.source_hash_match === true;
    const verified = source.source_verified === true || source.source_identity?.official_source_verified === true;
    let classification;
    if (packet && file && identity && verified) classification = 'A_AUTHORITATIVE_PACKET_RECOVERED';
    else if (!packet && file && identity) classification = 'B_HUMAN_RECONSTRUCTION_POSSIBLE';
    else if (file) classification = 'C_REEXTRACTION_REQUIRED';
    else classification = 'D_SOURCE_INSUFFICIENT_OR_BLOCKED';
    return [source.tender_id, classification];
  }));
}

const stable = value => Array.isArray(value)
  ? value.map(stable)
  : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]))
    : value;

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(stable(value), null, 2)}\n`, 'utf8');
}

function markdown(checkpoint) {
  return `# ${checkpoint.checkpoint}\n\n${Object.entries(checkpoint)
    .filter(([key]) => key !== 'checkpoint')
    .map(([key, value]) => `- ${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`)
    .join('\n')}\n`;
}

function unifiedMarkdown(checkpoint) {
  const foundationRows = Object.entries(checkpoint.foundation_statuses)
    .map(([key, value]) => `| ${key} | ${value} |`)
    .join('\n');
  const gateRows = Object.entries(checkpoint.readiness_gates)
    .map(([key, value]) => `| ${key} | ${value} | ${checkpoint.gate_evidence[key]} |`)
    .join('\n');
  const architectureRows = checkpoint.read_only_reports.architecture.rows
    .map(row => `| ${row.surface} | ${row.status} | ${row.evidence.join('; ')} |`)
    .join('\n');
  const factRows = checkpoint.read_only_reports.fact_control_reconciliation.rows
    .map(row => `| ${row.capability} | ${row.status} | ${row.evidence.join('; ')} |`)
    .join('\n');
  return `# V43 Gold V2 Foundation and Writer Eval Preparation Checkpoint

Generated at: ${checkpoint.generated_at}

This is an Eval-only, read-only decision checkpoint. It does not approve a Fact, freeze Gold, authorize a Provider, or expose Bid Pilot HITL.

## Foundation status

| Foundation | Status |
|---|---|
${foundationRows}

## Readiness gates

| Gate | Decision | Evidence-derived reason |
|---|---|---|
${gateRows}

## Architecture materialization

| Surface | Status | Evidence |
|---|---|---|
${architectureRows}

The local path manifest is explicitly pre-remediation. The later Track A closure checkpoint is the current evidence and is preserved as \`TRACK_A_REMEDIATION=CLOSED\`; neither input checkpoint is rewritten.

## Fact control reconciliation

| Capability | Classification | Evidence |
|---|---|---|
${factRows}

## Bid Pilot read-only projection

- status: ${checkpoint.read_only_reports.bid_pilot.status}
- mode: ${checkpoint.read_only_reports.bid_pilot.mode}
- authority writes exposed: ${checkpoint.read_only_reports.bid_pilot.authority_writes_exposed}
- approval actions exposed: ${checkpoint.read_only_reports.bid_pilot.approval_actions_exposed}

## Side effects

- provider_calls: ${checkpoint.side_effects.provider_calls}
- db_writes: ${checkpoint.side_effects.db_writes}
- gold_mutations: ${checkpoint.side_effects.gold_mutations}
- production_files_changed: ${checkpoint.side_effects.production_files_changed}

## Stop decision

Stop after this checkpoint. Human Fact V2 review, Real Fact V2 freeze, Mapping Gold V2, Writer live Eval and Bid Pilot HITL are not authorized by the available evidence.
`;
}

function fixedSnapshotBlindPacketPass(factCandidates) {
  const sources = factCandidates?.blindPacket?.sources ?? [];
  return factCandidates?.blindPacket?.blind === true
    && sources.length > 0
    && sources.every(source => source?.sha256 && source?.snapshot && source?.status === 'SOURCE_READY_FOR_HUMAN_FACT_REVIEW');
}

export function buildGoldV2Foundation({ now = new Date().toISOString(), outputDir = DEFAULT_OUTPUT_DIR } = {}) {
  fs.mkdirSync(outputDir, { recursive: true });
  const builderOutputDir = fs.mkdtempSync(path.join(outputDir, '.source-builder-'));
  let artifacts;
  try {
    artifacts = buildArtifacts({ outputDir: builderOutputDir, now });
  } finally {
    fs.rmSync(builderOutputDir, { recursive: true, force: true });
  }
  const requirementSource = artifacts.universe;
  const sourceClassifications = classifyRequirementSources({ tenderSources: requirementSource.tender_sources });
  const requirementGates = {
    requirement_source: requirementSource.requirement_source_verification_gate,
    source_identity: requirementSource.requirement_source_identity_gate,
    packet_parity: requirementSource.requirement_packet_parity_gate,
    authoritative_packet_recovered: Object.values(sourceClassifications).filter(value => value === 'A_AUTHORITATIVE_PACKET_RECOVERED').length
  };
  const factCandidates = buildRealFactV2Foundation({ candidates: SOURCE_CANDIDATES, outputDir });
  const writerEval = runWriterProviderOffFoundation({ outputDir });
  const architecture = buildArchitectureMaterialization();
  const factReconciliation = buildFactControlReconciliation({ factFoundation: factCandidates });
  const bidPilot = buildBidPilotReadOnlyFoundation({
    requirementSource: { ...requirementSource, source_classifications: sourceClassifications },
    factFoundation: factCandidates,
    writerFoundation: writerEval,
    architecture
  });
  const authoritativePacketCount = Object.values(sourceClassifications).filter(value => value === 'A_AUTHORITATIVE_PACKET_RECOVERED').length;
  const requirementComplete = authoritativePacketCount === FOUNDATION_TENDER_IDS.length
    && requirementSource.requirement_source_verification_gate === 'PASS'
    && requirementSource.requirement_packet_parity_gate === 'PASS';
  const eligibleFactReview = factCandidates.eligibleCount > 0 && fixedSnapshotBlindPacketPass(factCandidates);
  const factFreezeAuthorized = false;
  const noFactSourceGap = (factCandidates.manifest?.corpus_gaps ?? []).length === 0;
  const providerAuthorized = false;
  const gates = {
    SAFE_TO_START_HUMAN_FACT_V2_REVIEW: eligibleFactReview ? 'YES' : 'NO',
    SAFE_TO_FREEZE_REAL_FACT_V2: factFreezeAuthorized ? 'YES' : 'NO',
    SAFE_TO_BUILD_MAPPING_GOLD_V2: requirementComplete && eligibleFactReview && factFreezeAuthorized && noFactSourceGap ? 'YES' : 'NO',
    SAFE_TO_RUN_WRITER_LIVE_EVAL: writerEval.status === 'READY/PASS' && providerAuthorized ? 'YES' : 'NO',
    SAFE_TO_START_BID_PILOT_HITL: bidPilot.mode !== 'READ_ONLY' && bidPilot.approval_actions_exposed > 0 ? 'YES' : 'NO'
  };
  const foundationStatuses = {
    REQUIREMENT_REAL_SOURCE_FOUNDATION: requirementComplete ? 'PASS' : 'PARTIAL',
    REAL_ENTERPRISE_FACT_V2_FOUNDATION: factCandidates.eligibleCount > 0 ? 'CANDIDATE_ONLY/ELIGIBLE_SOURCES_PRESENT' : 'CANDIDATE_ONLY/NO_ELIGIBLE_SOURCES',
    REAL_FACT_V2_ELIGIBLE_CANDIDATES: factCandidates.eligibleCount,
    WRITER_EVAL_PROVIDER_OFF_FOUNDATION: writerEval.status,
    ARCHITECTURE_MATERIALIZATION: architecture.status,
    FACT_CONTROL_RECONCILIATION: factReconciliation.status,
    BID_PILOT_READ_ONLY_FOUNDATION: bidPilot.status
  };
  const trackA = {
    TRACK_A_REMEDIATION: architecture.track_a_remediation,
    source_checkpoint: architecture.current_closure_checkpoint,
    rewritten: false
  };
  const gateEvidence = {
    SAFE_TO_START_HUMAN_FACT_V2_REVIEW: eligibleFactReview
      ? 'At least one eligible source has a fixed snapshot and appears in the blind packet.'
      : `Eligible immutable sources=${factCandidates.eligibleCount}; a non-empty fixed-snapshot blind packet is required.`,
    SAFE_TO_FREEZE_REAL_FACT_V2: 'This task creates no human Fact authority and performs no Fact adjudication.',
    SAFE_TO_BUILD_MAPPING_GOLD_V2: `Requirement foundation complete=${requirementComplete}; Human Fact review eligible=${eligibleFactReview}; Fact freeze authorized=${factFreezeAuthorized}; corpus gaps absent=${noFactSourceGap}.`,
    SAFE_TO_RUN_WRITER_LIVE_EVAL: `Writer provider-off status=${writerEval.status}; provider authorization=${providerAuthorized}.`,
    SAFE_TO_START_BID_PILOT_HITL: `Bid Pilot mode=${bidPilot.mode}; approval actions exposed=${bidPilot.approval_actions_exposed}.`
  };
  const outputFiles = [
    path.join(outputDir, 'requirement-source-foundation-checkpoint.json'),
    path.join(outputDir, 'requirement-source-foundation-checkpoint.md')
  ];
  const checkpoint = {
    checkpoint: 'V43_GOLD_V2_REQUIREMENT_SOURCE_FOUNDATION_CHECKPOINT',
    generated_at: now,
    eval_only: true,
    tender_ids: FOUNDATION_TENDER_IDS,
    requirement_source: requirementSource,
    source_classifications: sourceClassifications,
    gates: requirementGates,
    provider_calls: 0,
    db_writes: 0,
    gold_mutations: 0,
    output_files: ['requirement-source-foundation-checkpoint.json', 'requirement-source-foundation-checkpoint.md']
  };
  writeJson(outputFiles[0], checkpoint);
  fs.writeFileSync(outputFiles[1], markdown(checkpoint), 'utf8');
  const unifiedCheckpoint = {
    checkpoint: 'V43_GOLD_V2_FOUNDATION_AND_WRITER_EVAL_PREP_CHECKPOINT',
    generated_at: now,
    eval_only: true,
    foundation_statuses: foundationStatuses,
    readiness_gates: gates,
    gate_evidence: gateEvidence,
    track_a: trackA,
    task_evidence: {
      requirement_source: {
        artifact: 'requirement-source-foundation-checkpoint.json',
        classifications: sourceClassifications,
        gates: requirementGates
      },
      real_fact_v2: {
        manifest: 'REAL_FACT_V2_CANDIDATE_MANIFEST.json',
        blind_packet: 'REAL_FACT_V2_BLIND_HUMAN_REVIEW_PACKET.json',
        eligible_count: factCandidates.eligibleCount,
        rejected_count: factCandidates.rejectionAudit.length,
        blind_packet_pass: fixedSnapshotBlindPacketPass(factCandidates),
        corpus_gaps: factCandidates.manifest.corpus_gaps
      },
      writer_provider_off: {
        artifact: 'V43_WRITER_EVAL_PROVIDER_OFF_FOUNDATION_CHECKPOINT.json',
        status: writerEval.status,
        metrics: writerEval.metrics,
        source_role_boundary: writerEval.sourceRoleBoundary
      }
    },
    read_only_reports: {
      architecture,
      fact_control_reconciliation: factReconciliation,
      bid_pilot: bidPilot
    },
    side_effects: {
      provider_calls: 0,
      db_writes: 0,
      gold_mutations: 0,
      production_files_changed: 0
    },
    output_files: [
      'V43_GOLD_V2_FOUNDATION_AND_WRITER_EVAL_PREP_CHECKPOINT.json',
      'V43_GOLD_V2_FOUNDATION_AND_WRITER_EVAL_PREP_CHECKPOINT.md'
    ]
  };
  writeJson(path.join(outputDir, unifiedCheckpoint.output_files[0]), unifiedCheckpoint);
  fs.writeFileSync(path.join(outputDir, unifiedCheckpoint.output_files[1]), unifiedMarkdown(unifiedCheckpoint), 'utf8');
  return {
    requirementSource,
    requirementGates,
    factCandidates,
    writerEval,
    architecture,
    factReconciliation,
    bidPilot,
    trackA,
    foundationStatuses,
    gates,
    checkpoint: unifiedCheckpoint,
    provider_calls: 0,
    db_writes: 0,
    gold_mutations: 0,
    production_files_changed: 0
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = buildGoldV2Foundation();
  console.log(JSON.stringify({
    tender_ids: TARGET_TENDER_IDS,
    source_classifications: classifyRequirementSources({ tenderSources: result.requirementSource.tender_sources }),
    foundation_statuses: result.foundationStatuses,
    gates: result.gates,
    track_a: result.trackA,
    provider_calls: result.provider_calls,
    db_writes: result.db_writes,
    gold_mutations: result.gold_mutations,
    production_files_changed: result.production_files_changed
  }, null, 2));
}
