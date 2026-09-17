import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AUTHORITY_ADJUDICATION_TENDER_IDS,
  buildEnterpriseSourceAuthorityPacket,
  buildRequirementHumanAuthorityPacket,
  loadBoundedTenderPackets,
  renderEnterpriseSourceAuthorityPacket,
  runBoundedRequirementReExtraction
} from '../eval/gold-governance/v43-real-gold-v2-authority-adjudication.js';

test('bounded tender packets use the three frozen raw sources and never assign formal IDs', () => {
  const packets = loadBoundedTenderPackets();
  assert.deepEqual(packets.map(packet => packet.tender_id), [...AUTHORITY_ADJUDICATION_TENDER_IDS]);
  assert.ok(packets.every(packet => packet.eval_only && packet.blind));
  assert.ok(packets.every(packet => packet.authority_status === 'NO_AUTHORITATIVE_UPGRADE'));
  assert.ok(packets.every(packet => packet.source_file_sha256?.length === 64));
  assert.equal(packets.find(packet => packet.tender_id === 'TB-003').source_extraction.selection.type, 'controlled_paragraph_window');
  assert.equal(packets.find(packet => packet.tender_id === 'JY-001').source_extraction.selection.type, 'classified_technical_section');
});

test('bounded extraction invokes the injected gateway sequentially and keeps output Eval-only', async () => {
  const packets = loadBoundedTenderPackets();
  const calls = [];
  const gateway = {
    async extract({ tenderId, chunk }) {
      calls.push({ tenderId: tenderId || null, chunk: chunk.chunk_number });
      const first = chunk.segments[0];
      return {
        candidates: [{
          text: first.text,
          category: 'technical',
          source_range: { start_ref: first.source_ref, end_ref: first.source_ref },
          mandatory_observed: false,
          requires_confirmation: false
        }],
        audit: { probe_diagnostics: { provider_http_status: 200, provider_http_reached: true, provider_adapter_invoked: true, fetch_invoked: true, response_model: 'test-model', json_parse_success: true } }
      };
    }
  };
  // The real adapter does not expose tenderId; call order is still asserted by
  // chunk numbers and the test is entirely offline because gateway is injected.
  const run = await runBoundedRequirementReExtraction({ packets, gateway, maxProviderCalls: 100, now: '2026-09-05T00:00:00.000Z' });
  const expectedCalls = run.tenders.reduce((sum, tender) => sum + tender.production_chunk_count, 0);
  assert.equal(run.provider_calls, expectedCalls);
  assert.equal(run.retries, 0);
  assert.equal(run.production_db_writes, 0);
  assert.equal(run.gold_mutations, 0);
  assert.equal(run.tenders.every(tender => tender.extraction_status === 'PROVIDER_EXTRACTION_COMPLETE'), true);
  assert.equal(run.tenders.reduce((sum, tender) => sum + tender.candidates.length, 0), expectedCalls);
  assert.equal(calls.length, expectedCalls);
  assert.equal(run.tenders.flatMap(tender => tender.candidates).every(candidate => candidate.formal_requirement_id === null), true);
  assert.equal(run.tenders.flatMap(tender => tender.candidates).every(candidate => candidate.authority_status === 'PENDING_HUMAN_AUTHORITY'), true);
});

test('provider failure stops later tenders without retry or fabricated candidates', async () => {
  const packets = loadBoundedTenderPackets();
  let calls = 0;
  const gateway = {
    async extract() {
      calls += 1;
      throw Object.assign(new Error('bounded test provider failure'), { code: 'GATEWAY_HTTP_ERROR', audit: { http_status: 503 } });
    }
  };
  const run = await runBoundedRequirementReExtraction({ packets, gateway, maxProviderCalls: 100 });
  assert.equal(calls, 1);
  assert.equal(run.provider_calls, 1);
  assert.equal(run.retries, 0);
  assert.equal(run.tenders[0].extraction_status, 'BLOCKED_PROVIDER_OR_CONTRACT');
  assert.equal(run.tenders[0].candidates.length, 0);
  assert.equal(run.tenders[1].extraction_status, 'NOT_ATTEMPTED_AFTER_FIRST_FAILURE');
  assert.equal(run.tenders[2].extraction_status, 'NOT_ATTEMPTED_AFTER_FIRST_FAILURE');
});

test('Neusoft source authority packet is blind, non-authoritative, and retains quarantine', () => {
  const packet = buildEnterpriseSourceAuthorityPacket({ now: '2026-09-05T00:00:00.000Z' });
  assert.equal(packet.source_candidate_count, 4);
  assert.equal(packet.quarantined_count, 4);
  assert.equal(packet.provider_calls, 0);
  assert.equal(packet.production_db_writes, 0);
  assert.equal(packet.gold_mutations, 0);
  assert.ok(packet.sources.every(source => source.quarantine_status === 'QUARANTINED'));
  assert.ok(packet.sources.every(source => source.authority_review.decision === null));
  assert.ok(packet.sources.every(source => source.generates_evidence_fact === false && source.grants_claim_permission === false));
  const rendered = renderEnterpriseSourceAuthorityPacket(packet);
  assert.doesNotMatch(rendered, /expected_decision|provider_response|claim_permission_granted/i);
});

test('human packet preserves reconstruction boundary without prior semantic answers', () => {
  const packet = buildRequirementHumanAuthorityPacket({
    generated_at: '2026-09-05T00:00:00.000Z',
    tenders: [{
      tender_id: 'JY-001',
      source_identity: { declared_sha256: 'a'.repeat(64), actual_sha256: 'a'.repeat(64), sha_match: true },
      extraction_status: 'PROVIDER_EXTRACTION_COMPLETE',
      production_chunk_count: 1,
      provider_calls: 1,
      retry_count: 0,
      candidates: [{ candidate_id: 'JY-001-EXTRACT-C001', formal_requirement_id: null, text: '候选需求', category: 'technical', source_range: { start_ref: 'C001-S001', end_ref: 'C001-S001' }, source_verified: true, source_match_type: 'exact', source_excerpt: '候选需求', source_span: {}, chunk_number: 1, authority_status: 'PENDING_HUMAN_AUTHORITY', proposed_reconstruction: 'CANDIDATE_FOR_HUMAN_AUTHORITY', prior_semantic_decision: null }],
      first_failure: null
    }]
  });
  assert.equal(packet.tenders[0].candidates[0].formal_requirement_id, null);
  assert.equal(packet.tenders[0].candidates[0].human_review.decision, null);
  assert.equal(packet.tenders[0].candidates[0].prior_semantic_decision, null);
  assert.match(packet.non_authoritative_notice, /is promoted/i);
});
