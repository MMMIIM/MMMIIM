export function buildBidPilotReadOnlyFoundation({ requirementSource, factFoundation, writerFoundation, architecture } = {}) {
  const classifications = requirementSource?.source_classifications ?? {};
  const eligibleSources = Number(factFoundation?.eligibleCount ?? factFoundation?.manifest?.eligible_count ?? 0);
  return {
    status: 'PASS',
    mode: 'READ_ONLY',
    projections: {
      requirement_sources: {
        authoritative_packet_count: Object.values(classifications).filter(value => value === 'A_AUTHORITATIVE_PACKET_RECOVERED').length,
        reconstruction_candidate_count: Object.values(classifications).filter(value => value === 'B_HUMAN_RECONSTRUCTION_POSSIBLE').length,
        evidence: 'backend/eval/gold-governance/v43-gold-v2-foundation/requirement-source-foundation-checkpoint.json'
      },
      fact_candidates: {
        eligible_source_count: eligibleSources,
        authority: 'CANDIDATE_ONLY',
        evidence: 'backend/eval/gold-governance/v43-gold-v2-foundation/REAL_FACT_V2_BLIND_HUMAN_REVIEW_PACKET.json'
      },
      writer: {
        provider_execution: 'OFF',
        provider_off_status: writerFoundation?.status ?? 'NOT_VERIFIED',
        evidence: 'backend/eval/gold-governance/v43-gold-v2-foundation/V43_WRITER_EVAL_PROVIDER_OFF_FOUNDATION_CHECKPOINT.json'
      },
      authority_boundary: {
        track_a_remediation: architecture?.track_a_remediation ?? 'NOT_VERIFIED',
        evidence: 'backend/eval/architecture-assurance/overnight-2026-09-04/V43_TRACK_A_REMEDIATION_CLOSURE_CHECKPOINT.json'
      }
    },
    fixture_evidence: [
      'backend/test/agent-foundation.test.js',
      'backend/test/agent-actions.test.js',
      'backend/src/pipeline/agent-tools.js',
      'backend/src/pipeline/bid-copilot-orchestrator.js'
    ],
    explanations: [
      'Relevant material remains distinct from Evidence, Fact, Mapping, Claim and Writer permission.',
      'Zero eligible enterprise source candidates means no Human Fact V2 review can be exposed.',
      'Provider-off Writer evaluation does not authorize live Writer execution.',
      'This projection exposes no HITL approval, reject, override, confirmation or mutation action.'
    ],
    exposed_actions: ['VIEW_FOUNDATION_STATUS', 'VIEW_SOURCE_GAPS', 'VIEW_WRITER_PROVIDER_OFF_RESULTS'],
    authority_writes_exposed: 0,
    approval_actions_exposed: 0,
    provider_calls: 0,
    db_writes: 0,
    gold_mutations: 0,
    production_files_changed: 0
  };
}
