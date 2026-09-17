import { createHash } from 'node:crypto';

export const NUMBER_OMISSION_TRUE_ERROR_CONTROLS = [
  {
    control_id: 'NUMBER-OMISSION-TRUE-001',
    dimension: 'same_atomic_response_time',
    source_text: '系统应支持数据接口，响应时间不超过3秒。',
    candidate_text: '系统应支持数据接口，响应时间不超过秒。'
  },
  {
    control_id: 'NUMBER-OMISSION-TRUE-002',
    dimension: 'same_atomic_sla',
    source_text: '接口服务等级应达到99.9%。',
    candidate_text: '接口服务等级应达到%。'
  },
  {
    control_id: 'NUMBER-OMISSION-TRUE-003',
    dimension: 'same_atomic_duration',
    source_text: '服务期限为3年。',
    candidate_text: '服务期限为。'
  },
  {
    control_id: 'NUMBER-OMISSION-TRUE-004',
    dimension: 'same_atomic_capacity',
    source_text: '系统应支持100个并发用户。',
    candidate_text: '系统应支持并发用户。'
  }
].map((control) => ({
  ...control,
  source_range: { start_ref: 'NUMBER-CONTROL-SOURCE', end_ref: 'NUMBER-CONTROL-SOURCE' },
  source_verified: true,
  source_hash: createHash('sha256').update(control.source_text, 'utf8').digest('hex'),
  candidate_hash: createHash('sha256').update(control.candidate_text, 'utf8').digest('hex'),
  expected_decision: 'REVIEW_REQUIRED',
  expected_reason: 'NUMBER_OMISSION_REVIEW',
  classification: 'DEVELOPMENT_SAFETY_CONTROL_ONLY',
  human_gold: false,
  holdout: false,
  provider_calls: 0,
  production_db_writes: 0,
  gold_mutations: 0
}));
