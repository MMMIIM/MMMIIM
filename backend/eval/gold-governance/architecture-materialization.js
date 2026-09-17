import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = path.resolve(HERE, '../../..');
const TRACK_A_DIR = path.join(HERE, '../architecture-assurance/overnight-2026-09-04');
const PATH_MANIFEST_PATH = path.join(TRACK_A_DIR, 'V43_CHAIN_CLOSURE_00_LOCAL_PATH_MANIFEST.json');
const TRACK_A_CLOSURE_PATH = path.join(TRACK_A_DIR, 'V43_TRACK_A_REMEDIATION_CLOSURE_CHECKPOINT.json');

export const ARCHITECTURE_ROW_STATUSES = Object.freeze([
  'ENFORCED',
  'PARTIAL',
  'BYPASS_FOUND',
  'NOT_ENFORCED',
  'NOT_VERIFIED'
]);

const relative = value => path.relative(REPOSITORY_ROOT, value).replaceAll('\\', '/');
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const allPass = (value, keys) => keys.every(key => value?.[key] === 'PASS');
const allEnforced = (value, keys) => keys.every(key => String(value?.[key] ?? '').startsWith('ENFORCED'));

function row(surface, status, asIs, target, evidence) {
  if (!ARCHITECTURE_ROW_STATUSES.includes(status)) throw new Error(`ARCHITECTURE_STATUS_INVALID:${status}`);
  return { surface, status, as_is: asIs, target, evidence };
}

export function buildArchitectureMaterialization({
  pathManifest = readJson(PATH_MANIFEST_PATH),
  trackAClosure = readJson(TRACK_A_CLOSURE_PATH)
} = {}) {
  const pathManifestEvidence = relative(PATH_MANIFEST_PATH);
  const closureEvidence = relative(TRACK_A_CLOSURE_PATH);
  const authorityClosed = trackAClosure?.TRACK_A_REMEDIATION === 'CLOSED'
    && allPass(trackAClosure, ['NC02', 'NC03', 'NC04', 'NC05']);
  const authorityGates = allEnforced(trackAClosure, [
    'HISTORICAL_RETRIEVAL_GATE',
    'REVIEW_AUTHORITY_GATE',
    'CANONICAL_FACT_DRAFT_EDIT_GATE',
    'LEGACY_FACT_AUTHORITY',
    'LEGACY_MAPPING_AUTHORITY'
  ]);
  const canonicalRegressions = allPass(trackAClosure, [
    'CANONICAL_MAPPING_REGRESSION',
    'CANONICAL_CLAIM_REGRESSION',
    'WRITER_AUTHORIZATION_REGRESSION'
  ]);
  const singleAuthorityPolicy = pathManifest?.material_authority_gate?.single_source === true
    && pathManifest?.material_authority_gate?.status === 'ENFORCED';
  const priorBypassCount = (pathManifest?.paths ?? []).filter(item => item.status === 'BYPASS_FOUND').length;

  const rows = [
    row(
      'DOMAIN',
      singleAuthorityPolicy ? 'ENFORCED' : 'NOT_VERIFIED',
      'Material, Retrieval, Evidence, Fact, Mapping, Claim and Writer remain distinct lifecycle objects.',
      'Retain the existing domain separation; this Eval creates no business object.',
      [pathManifestEvidence, 'backend/eval/architecture-assurance/overnight-2026-09-04/03_AUTHORITY_OBJECT_CHECKPOINT.md']
    ),
    row(
      'AUTHORITY',
      authorityClosed && authorityGates ? 'ENFORCED' : priorBypassCount > 0 ? 'BYPASS_FOUND' : 'NOT_VERIFIED',
      authorityClosed && authorityGates
        ? 'The later Track A closure proves the previously inventoried authority re-entry gaps fail closed.'
        : 'The pre-remediation path manifest contains unresolved authority re-entry findings.',
      'Keep owning services and the single Material Authority Gate authoritative.',
      [pathManifestEvidence, closureEvidence, 'backend/integration/track-a-authority-remediation.integration.js']
    ),
    row(
      'HUMAN_GATE',
      authorityClosed && trackAClosure?.REVIEW_AUTHORITY_GATE === 'ENFORCED' ? 'ENFORCED' : 'NOT_VERIFIED',
      'Review, canonical Fact, Mapping and Project Fact decisions remain human-controlled service operations.',
      'No Eval, Agent or Provider may approve or confirm formal state.',
      [closureEvidence, 'backend/test/formal-mutation-authorization.test.js', 'backend/test/project-fact-control-v1.test.js']
    ),
    row(
      'AGENT_BOUNDARY',
      authorityClosed && canonicalRegressions ? 'ENFORCED' : 'NOT_VERIFIED',
      'Agent read tools project formal state; authority-bearing actions route through policy and owning services.',
      'Bid Pilot remains read-only in this task.',
      ['backend/src/pipeline/agent-tools.js', 'backend/src/pipeline/agent-action-policy.js', 'backend/test/agent-foundation.test.js', 'backend/test/agent-actions.test.js']
    ),
    row(
      'PROVENANCE',
      singleAuthorityPolicy && canonicalRegressions ? 'ENFORCED' : 'NOT_VERIFIED',
      'Canonical Mapping, Claim and Writer authorization retain source, hash, contract and currentness lineage.',
      'Derived Eval projections must not redefine canonical identity or provenance.',
      [closureEvidence, 'backend/test/mapping-to-claim-entrypoint.test.js', 'backend/test/writer-input-authorization-v1.test.js']
    ),
    row(
      'RUNTIME_ENFORCEMENT',
      authorityClosed && authorityGates && canonicalRegressions ? 'ENFORCED' : 'NOT_VERIFIED',
      'NC02-NC05 and canonical downstream regressions are recorded as passing at real entry points and persistence boundaries.',
      'Retain fail-closed enforcement; no live runtime claim is created by this offline materialization.',
      [closureEvidence, 'backend/integration/track-a-authority-remediation.integration.js']
    )
  ];

  return {
    status: rows.length === 6 && rows.every(item => ARCHITECTURE_ROW_STATUSES.includes(item.status)) ? 'PASS' : 'FAIL',
    mode: 'READ_ONLY_MATERIALIZATION',
    track_a_remediation: trackAClosure?.TRACK_A_REMEDIATION ?? 'NOT_VERIFIED',
    prior_path_manifest: {
      path: pathManifestEvidence,
      phase: 'PRE_REMEDIATION_AS_IS',
      bypass_findings: priorBypassCount
    },
    current_closure_checkpoint: closureEvidence,
    rows,
    provider_calls: 0,
    db_writes: 0,
    gold_mutations: 0,
    production_files_changed: 0
  };
}
