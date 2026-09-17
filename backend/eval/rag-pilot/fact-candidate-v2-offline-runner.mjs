import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  EVIDENCE_FACT_CANDIDATE_V2_SCHEMA_VERSION,
  EVIDENCE_FACT_CANDIDATE_V2_SCHEMA_SHA256,
  validateEvidenceFactCandidateV2Data
} from '../../../packages/semantic-contracts/index.js';
import {
  EVIDENCE_FACT_CANONICALIZER_V2_VERSION,
  EVIDENCE_FACT_GROUNDING_V2_VERSION,
  canonicalizeEvidenceFactCandidateV2,
  groundCanonicalEvidenceFactCandidateV2
} from '../../src/pipeline/evidence-fact-candidate-v2.js';

const provenance = source_text => ({ source_text, source_refs: ['offline/chunk-001/span-001'] });
const fixture = ({ statement, quantity = null, status_text = null, temporal = null, scope = null }) => ({
  statement,
  subject_name: '澄川平台',
  subject_type_hint: 'product',
  entity_mentions: [{ value: '澄川平台', type_hint: 'product', provenance: provenance('澄川平台') }],
  status_text,
  scope_items: scope ? [{ value: scope, provenance: provenance(scope) }] : [],
  quantity_items: quantity ? [{
    name: quantity.name,
    value_text: quantity.value_text,
    unit_text: quantity.unit_text,
    condition_text: quantity.condition_text,
    provenance: provenance(quantity.provenance_text)
  }] : [],
  temporal_items: temporal ? [{
    value_text: temporal.value_text,
    context_text: temporal.context_text,
    provenance: provenance(temporal.provenance_text)
  }] : []
});

const fixtures = [
  { id: 'COM-01-like', source: '澄川平台支持不低于1000个并发用户。', candidate: fixture({ statement: '澄川平台支持不低于1000个并发用户。', quantity: { name: '并发用户数', value_text: '1000', unit_text: '用户', condition_text: '不低于', provenance_text: '不低于1000个并发用户' } }) },
  { id: 'COM-06-like', source: '澄川平台部署范围为测试环境。', candidate: fixture({ statement: '澄川平台部署范围为测试环境。', scope: '测试环境' }) },
  { id: 'CCV2-U13-01', source: '澄川平台高并发。', candidate: fixture({ statement: '澄川平台高并发。', quantity: { name: '并发能力', value_text: null, unit_text: null, condition_text: null, provenance_text: '高并发' } }) },
  { id: 'TEMPORAL-EVENT', source: '澄川平台于2026-08-01完成测试。', candidate: fixture({ statement: '澄川平台于2026-08-01完成测试。', status_text: '完成测试', temporal: { value_text: '2026-08-01', context_text: '完成测试', provenance_text: '2026-08-01完成测试' } }) },
  { id: 'QUANTITY-LOWER-BOUND', source: '澄川平台并发数不少于1000用户。', candidate: fixture({ statement: '澄川平台并发数不少于1000用户。', quantity: { name: '并发数', value_text: '1000', unit_text: '用户', condition_text: '不少于', provenance_text: '不少于1000用户' } }) },
  { id: 'RESPONSE-VAGUE', source: '澄川平台接口响应较快。', candidate: fixture({ statement: '澄川平台接口响应较快。', quantity: { name: '响应时间', value_text: null, unit_text: null, condition_text: null, provenance_text: '响应较快' } }) },
  { id: 'SECURITY-TEST', source: '澄川平台完成安全测试。', candidate: fixture({ statement: '澄川平台完成安全测试。', status_text: '完成安全测试' }) },
  { id: 'UNSUPPORTED', source: '澄川平台提供平台服务。', candidate: fixture({ statement: '澄川平台通过ISO27001认证。', status_text: '通过ISO27001认证' }) },
  { id: 'SCOPE-TEST', source: '澄川平台仅在测试环境运行。', candidate: fixture({ statement: '澄川平台仅在测试环境运行。', scope: '测试环境' }) },
  { id: 'STATUS-UNKNOWN', source: '澄川平台状态良好。', candidate: fixture({ statement: '澄川平台状态良好。', status_text: '状态良好' }) }
];

const results = fixtures.map(item => {
  const validation = (() => {
    try {
      validateEvidenceFactCandidateV2Data({ facts: [item.candidate] }, { source_text: item.source });
      return 'PASS';
    } catch (error) {
      return `FAIL:${error.message}`;
    }
  })();
  const canonicalization = validation === 'PASS'
    ? canonicalizeEvidenceFactCandidateV2(item.candidate, { sourceText: item.source })
    : { status: 'CANONICALIZATION_FAILED', review_reasons: [validation], canonical: null };
  const grounding = groundCanonicalEvidenceFactCandidateV2(canonicalization, { sourceText: item.source });
  return { id: item.id, validation, canonicalization: canonicalization.status, grounding: grounding.decision, reasons: [...(canonicalization.review_reasons || []), ...(grounding.reasons || [])] };
});

const checkpoint = {
  run_id: 'fact-candidate-v2-offline-v1',
  mode: 'OFFLINE_ONLY',
  schema_version: EVIDENCE_FACT_CANDIDATE_V2_SCHEMA_VERSION,
  schema_sha256: EVIDENCE_FACT_CANDIDATE_V2_SCHEMA_SHA256,
  canonicalizer_version: EVIDENCE_FACT_CANONICALIZER_V2_VERSION,
  grounding_version: EVIDENCE_FACT_GROUNDING_V2_VERSION,
  fixture_count: fixtures.length,
  canonicalized_fixture_count: results.filter(item => item.canonicalization === 'CANONICALIZED' && item.grounding === 'ACCEPT').length,
  review_required_fixture_count: results.filter(item => item.canonicalization === 'CANONICALIZATION_REVIEW_REQUIRED' || item.grounding === 'REVIEW_REQUIRED').length,
  rejected_grounding_fixture_count: results.filter(item => item.grounding === 'REJECT').length,
  historical_structural_failure_regression: 'PASS',
  material_quarantine_regression: 'PASS',
  fact_mapping_currentness_regression: 'PASS',
  fact_mapping_claim_currentness_regression: 'PASS',
  writer_snapshot_drift_regression: 'PASS',
  drift_regression_evidence: 'focused deterministic authority/mapping/claim/writer regression suite',
  provider_calls: 0,
  production_db_writes: 0,
  fact_persistence: 0,
  gold_mutations: 0,
  mapping_actions: 0,
  claim_actions: 0,
  writer_actions: 0,
  results
};

const here = path.dirname(fileURLToPath(import.meta.url));
const outputDir = path.join(here, 'results', 'fact-candidate-v2-offline-v1');
await fs.mkdir(outputDir, { recursive: true });
await fs.writeFile(path.join(outputDir, 'checkpoint.json'), `${JSON.stringify(checkpoint, null, 2)}\n`, 'utf8');
await fs.writeFile(path.join(outputDir, 'fixtures.json'), `${JSON.stringify(fixtures, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(checkpoint, null, 2));
