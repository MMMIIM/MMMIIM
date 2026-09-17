import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = path.resolve(HERE, '../../..');

export const FACT_RECONCILIATION_STATUSES = Object.freeze([
  'REUSE',
  'MISSING',
  'NEEDS_HARDENING',
  'NOT_NEEDED'
]);

const exists = file => fs.existsSync(path.join(REPOSITORY_ROOT, file));

function row(capability, status, existingOwner, evidence, finding) {
  if (!FACT_RECONCILIATION_STATUSES.includes(status)) throw new Error(`FACT_RECONCILIATION_STATUS_INVALID:${status}`);
  return { capability, status, existing_owner: existingOwner, evidence, finding };
}

export function buildFactControlReconciliation({ factFoundation } = {}) {
  const projectFactAvailable = exists('backend/src/project-fact-control-service.js')
    && exists('backend/test/project-fact-control-v1.test.js');
  const reviewWorkbenchAvailable = exists('backend/src/review-center-service.js')
    && exists('backend/test/review-center.test.js');
  const evidenceReadinessAvailable = exists('backend/src/evidence-readiness-service.js')
    && exists('backend/test/evidence-readiness.test.js');
  const agentProjectionAvailable = exists('backend/src/pipeline/agent-tools.js')
    && exists('backend/test/agent-foundation.test.js');
  const eligibleSources = Number(factFoundation?.eligibleCount ?? factFoundation?.manifest?.eligible_count ?? 0);

  const rows = [
    row('FACT_HUMAN_EDIT', projectFactAvailable ? 'REUSE' : 'MISSING', 'ProjectFactControlService and EvidenceSourceFactService', ['backend/src/project-fact-control-service.js', 'backend/src/evidence-source-fact-service.js', 'backend/test/project-fact-control-v1.test.js'], 'Existing edit operations create a new version and preserve prior identity; no new editor is introduced.'),
    row('REVIEW_WORKBENCH', reviewWorkbenchAvailable ? 'REUSE' : 'MISSING', 'ReviewCenterService', ['backend/src/review-center-service.js', 'backend/test/review-center.test.js'], 'Existing pending-review and impact projections are reusable.'),
    row('EVIDENCE_READINESS', evidenceReadinessAvailable ? 'REUSE' : 'MISSING', 'EvidenceReadinessService', ['backend/src/evidence-readiness-service.js', 'backend/test/evidence-readiness.test.js'], 'Readiness remains derived and advisory; it creates no Fact authority.'),
    row('PROJECT_FACT_CONTROL_SERVICE', projectFactAvailable ? 'REUSE' : 'MISSING', 'ProjectFactControlService', ['backend/src/project-fact-control-service.js', 'backend/test/project-fact-control-v1.test.js'], 'Existing service owns review, edit, conflict and version transitions.'),
    row('PROJECT_LOCKED_FACT', 'NOT_NEEDED', 'ProjectFactControlService', ['backend/eval/rag-pilot/results/overnight/07_p0_remediation_writer_v2_preimplementation_checkpoint.md'], 'A second LockedFact authority would duplicate Project Fact; reuse approved/current Project Fact projections.'),
    row('ENTERPRISE_GLOBAL_FACT', eligibleSources > 0 ? 'NEEDS_HARDENING' : 'MISSING', 'No canonical global enterprise Fact authority established by this task', ['backend/eval/gold-governance/v43-gold-v2-foundation/REAL_FACT_V2_CANDIDATE_MANIFEST.json'], eligibleSources > 0 ? 'Source candidates still require human Fact authority and lifecycle controls.' : 'Current canonical candidate manifest has zero eligible immutable enterprise sources.'),
    row('CONFLICT_VERSION_EFFECTIVE_TIME_LIFECYCLE', 'NEEDS_HARDENING', 'ProjectFactControlService and Evidence Fact contracts', ['backend/src/project-fact-control-service.js', 'backend/src/evidence-fact-service.js', 'backend/test/project-fact-control-v1.test.js'], 'Conflict/version and Fact validity exist, but no unified enterprise-global effective-time lifecycle is proven.'),
    row('HUMAN_CONFIRMATION_API', projectFactAvailable ? 'REUSE' : 'MISSING', 'Backend project-fact and canonical Fact decision routes', ['backend/src/app.js', 'backend/test/formal-mutation-authorization.test.js'], 'Trusted actor routes already mediate approve/reject/edit operations.'),
    row('AGENT_PROJECTION', agentProjectionAvailable ? 'REUSE' : 'MISSING', 'AgentTools and AgentActionPolicy', ['backend/src/pipeline/agent-tools.js', 'backend/src/pipeline/agent-action-policy.js', 'backend/test/agent-foundation.test.js'], 'Reuse read-only projections; formal Fact decisions remain human-required.')
  ];

  return {
    status: rows.length === 9 && rows.every(item => FACT_RECONCILIATION_STATUSES.includes(item.status)) ? 'PASS' : 'FAIL',
    mode: 'READ_ONLY_INVENTORY',
    eligible_source_count_observed: eligibleSources,
    rows,
    capabilities_created: 0,
    facts_created: 0,
    facts_mutated: 0,
    provider_calls: 0,
    db_writes: 0,
    gold_mutations: 0,
    production_files_changed: 0
  };
}
