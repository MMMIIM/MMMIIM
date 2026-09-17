import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  buildEvidenceSourceRoutingGapPacket,
  buildFactReviewCandidate,
  flushCanaryArtifacts,
  groupFactContextsBySource,
  providerAuditFrom
} from '../eval/real-e2e/run-requirement-retrieval-fact-canary.mjs';
import { buildDiagnosticArtifacts } from '../eval/real-e2e/build-fact-canary-diagnostics.mjs';

function sourceRow(overrides = {}) {
  return {
    material_id: 'material-1',
    chunk_id: 'chunk-1',
    chunk_hash: 'hash-1',
    source_ref: 'chunk-1',
    source_text: '企业来源上下文。',
    ...overrides
  };
}

test('Fact contexts deduplicate identical material/chunk/hash while retaining all requirements', () => {
  const queries = [
    { requirement_id: 'REQ-014' },
    { requirement_id: 'REQ-023' },
    { requirement_id: 'REQ-099' }
  ];
  const rows = new Map([
    ['REQ-014', [sourceRow()]],
    ['REQ-023', [sourceRow()]],
    ['REQ-099', [sourceRow({ chunk_id: 'chunk-2', chunk_hash: 'hash-2' })]]
  ]);
  const groups = groupFactContextsBySource(queries, rows);
  assert.equal(groups.length, 2);
  assert.deepEqual(groups[0].requirement_ids, ['REQ-014', 'REQ-023']);
  assert.deepEqual(groups[1].requirement_ids, ['REQ-099']);
});

test('routing gap packet leaves semantic applicability pending when no Backend field owns it', () => {
  const packet = {
    requirements: [{ requirement_id: 'REQ-1', requirement_text: '事实要求', response_mode: 'EVIDENCE', evidence_dependency: true }]
  };
  const result = buildEvidenceSourceRoutingGapPacket(packet);
  assert.equal(result.requirements.length, 1);
  assert.equal(result.requirements[0].retrieval_semantic_applicability, null);
  assert.equal(result.requirements[0].classification_status, 'PENDING_GPT');
  assert.equal(result.semantic_classification_by_codex, false);
});

test('GPT review candidate projection contains required source and semantic fields without provider raw payload', () => {
  const row = sourceRow();
  const result = buildFactReviewCandidate({
    candidate: {
      statement: '产品支持并发用户。', subject_name: '产品', subject_type_hint: 'software_product',
      subject_source_refs: ['S001'], entity_mentions: [], status_text: null, status_source_refs: [],
      scope_items: [], quantity_items: [], temporal_items: [], source_refs: ['S001']
    },
    candidateIndex: 0,
    sourceRow: row,
    requirementIds: ['REQ-014'],
    canonicalization: { status: 'CANONICALIZED', canonical: { subject: { name: '产品' }, quantities: [] }, review_reasons: [] },
    grounding: { decision: 'ACCEPT', reasons: [] }
  });
  assert.equal(result.source_excerpt, row.source_text);
  assert.equal(result.fact_source_refs[0], 'S001');
  assert.equal(result.canonicalization_status, 'CANONICALIZED');
  assert.equal(result.grounding_decision, 'ACCEPT');
  assert.equal(Object.hasOwn(result, 'raw_provider_content'), false);
});

test('provider audit hashes an available envelope and preserves only safe diagnostics', () => {
  const audit = providerAuditFrom(null, {
    details: {
      provider_audit: {
        provider: 'semantic_gateway',
        raw_response_payload_json: '{"data":{}}',
        provider_http_reached: true,
        provider_http_status: 200,
        gateway_http_status: 200,
        json_parse_success: false
      },
      schema_validation_errors: [{ keyword: 'additionalProperties' }]
    }
  });
  assert.match(audit.response_envelope_hash, /^[a-f0-9]{64}$/);
  assert.equal(audit.contract_validation_failure_family, 'additionalProperties');
  assert.equal(Object.hasOwn(audit, 'raw_response_payload_json'), false);
});

test('artifact durability flush writes retrieval, fact, and checkpoint files', () => {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fact-canary-closure-'));
  try {
    const files = flushCanaryArtifacts({ outputDir, runId: 'run-1', error: { code: 'TEST_FAILURE', message: 'safe' } });
    for (const file of Object.values(files)) {
      assert.equal(fs.existsSync(file), true);
      assert.doesNotThrow(() => JSON.parse(fs.readFileSync(file, 'utf8')));
    }
    assert.equal(JSON.parse(fs.readFileSync(files.checkpoint, 'utf8')).provider_calls, 0);
  } finally {
    fs.rmSync(outputDir, { recursive: true, force: true });
  }
});

test('historical diagnostic preparation deduplicates 20 observed requirements to 13 contexts and limits replay to three chunks', () => {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fact-canary-diagnostics-'));
  try {
    const result = buildDiagnosticArtifacts({
      selection: { requirements: Array.from({ length: 20 }, (_, index) => ({ requirement_id: `REQ-${index + 1}`, requirement_text: '候选需求' })) },
      retrieval: { queries: [] },
      fact: { status: 'NOT_RUN', cases: [] },
      outputDir
    });
    assert.equal(result.groups.length, 13);
    assert.equal(result.reviewPacket.candidates.length, 0);
    assert.equal(result.reviewPacket.provider_calls_added_by_diagnostics, 0);
    assert.equal(result.replayPlan.chunk_ids.length, 3);
    assert.equal(result.replayPlan.no_provider_calls_in_preparation, true);
    assert.equal(result.routingPacket.requirements.length, 20);
    assert.equal(result.routingPacket.requirements.every(item => item.retrieval_semantic_applicability === null), true);
  } finally {
    fs.rmSync(outputDir, { recursive: true, force: true });
  }
});
