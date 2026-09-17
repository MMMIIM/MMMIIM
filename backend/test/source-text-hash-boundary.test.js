import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  adaptApprovedEvidenceFact,
  adaptRetrievalCandidate
} from '../src/pipeline/evidence-support-assessment-contract-v1.js';
import { createEvidenceSupportGatewayInput } from '../src/pipeline/evidence-support-assessment-gateway-contract-v1.js';
import { createEvidenceSupportReviewAdapter } from '../src/pipeline/evidence-support-review-evaluator.js';
import { buildEvidenceFactExtractionPayload } from '../src/pipeline/semantic-gateway-evidence-fact-extractor.js';
import { hashSource } from '../src/pipeline/source-location-resolver.js';

const requirement = { requirement_id: 'REQ-SOURCE-BOUNDARY', text: '来源边界测试。' };
const sourceCases = [
  ['plain', 'abc'],
  ['trailing newline', 'abc\n'],
  ['leading newline', '\nabc'],
  ['surrounding spaces', ' abc '],
  ['COM-04', '## 接口\n\n支持REST API、Webhook和批量文件交换；2026-07-12完成12个模拟接口联调。\n\n'],
  ['GOV-02', '## 目录与共享\n\n需明确数据目录、共享属性、使用条件、授权、安全和记录。\n\n']
];

function sourceContext(sourceText, sourceTextHash = hashSource(sourceText)) {
  return {
    review_id: 'EREVIEW-SOURCE-BOUNDARY',
    project_id: '11111111-1111-4111-8111-111111111111',
    source_span_id: 'ESPAN-SOURCE-BOUNDARY',
    material_id: '22222222-2222-4222-8222-222222222222',
    anchor_chunk_id: 'MCH-SOURCE-BOUNDARY',
    source_text: sourceText,
    source_text_hash: sourceTextHash,
    current_source_text_hash: sourceTextHash,
    review_status: 'approved',
    evidence_review_contract_version: 'evidence-review-v1',
    evidence_capability: 'capable',
    support_level: 'full_support',
    material_type: 'project_case'
  };
}

test('exact source representation and hash stay aligned through Support and Fact boundaries', () => {
  for (const [name, sourceText] of sourceCases) {
    const sourceTextHash = hashSource(sourceText);
    const adapter = adaptRetrievalCandidate({
      requirement,
      candidate: { candidate_id: `CAND-${name}` },
      sourceSpan: {
        source_span_id: `SPAN-${name}`,
        source_text: sourceText,
        source_text_hash: sourceTextHash
      }
    });
    assert.equal(adapter._source_text, sourceText, name);
    assert.equal(adapter.source.source_text_hash, sourceTextHash, name);
    const gatewayInput = createEvidenceSupportGatewayInput({ requirement, adapters: [adapter] });
    assert.equal(gatewayInput.sources[0].source_text, sourceText, name);
    assert.equal(gatewayInput.sources[0].source_text_hash, sourceTextHash, name);

    const reviewAdapter = createEvidenceSupportReviewAdapter({
      requirement_id: requirement.requirement_id,
      requirement_text: requirement.text,
      retrieval_candidate_id: `CAND-${name}`,
      source_span_id: `SPAN-${name}`,
      source_text: sourceText,
      source_text_hash: sourceTextHash,
      project_id: '11111111-1111-4111-8111-111111111111',
      material_id: '22222222-2222-4222-8222-222222222222'
    });
    assert.equal(reviewAdapter._source_text, sourceText, name);
    assert.equal(reviewAdapter.source.source_text_hash, sourceTextHash, name);

    const payload = buildEvidenceFactExtractionPayload(sourceContext(sourceText, sourceTextHash));
    assert.equal(payload.source_text, sourceText, name);
    assert.equal(payload.material.material_type, 'project_case', name);
    assert.equal(Object.hasOwn(payload, 'source_span'), false, name);
  }
});

test('approved Evidence Fact adapter preserves exact source text and provenance hash', () => {
  const sourceText = 'GOV-02 exact source span\n';
  const adapter = adaptApprovedEvidenceFact({
    requirement,
    fact: {
      fact_id: 'EFACT-SOURCE-BOUNDARY',
      review_status: 'approved',
      payload_hash: 'b'.repeat(64),
      contract_version: 'evidence-fact-v1'
    },
    sourceSpan: {
      source_span_id: 'SPAN-GOV-02',
      source_text: sourceText,
      source_text_hash: createHash('sha256').update(sourceText).digest('hex')
    }
  });
  assert.equal(adapter._source_text, sourceText);
  assert.equal(adapter.source.source_text_hash, hashSource(sourceText));
});
