import { AppError } from './errors.js';
import { requireFormalActorId } from './request-actor.js';

const DECISIONS = new Set(['IN_SCOPE', 'OUT_OF_SCOPE']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertUuid(value, code, message) {
  if (!UUID.test(String(value || ''))) throw new AppError(code, message, 400);
}

function normalizeReasons(value) {
  if (!Array.isArray(value)) throw new AppError('SCOPE_AUTHORITY_REASON_CODES_INVALID', 'reason_codes 必须是数组。', 422);
  const reasons = value.map(item => String(item || '').trim()).filter(Boolean);
  if (!reasons.length) throw new AppError('SCOPE_AUTHORITY_REASON_CODES_INVALID', 'reason_codes 不能为空。', 422);
  return [...new Set(reasons)].sort();
}

export class RequirementScopeAuthorityService {
  constructor({ repository, clock = () => new Date() }) {
    this.repository = repository;
    this.clock = clock;
  }

  async recordDecision(input = {}) {
    assertUuid(input.projectId, 'INVALID_PROJECT_ID', '项目 ID 格式无效。');
    const candidateIdentity = String(input.candidateIdentity || '').trim();
    const sourceChunkId = String(input.sourceChunkId || '').trim();
    const sourceHash = String(input.sourceHash || '').trim();
    if (!candidateIdentity || !sourceChunkId || !sourceHash) throw new AppError('SCOPE_AUTHORITY_IDENTITY_REQUIRED', '候选、Chunk 和来源哈希不能为空。', 422);
    const sourcePageStart = Number(input.sourcePageStart);
    const sourcePageEnd = Number(input.sourcePageEnd);
    if (!Number.isInteger(sourcePageStart) || sourcePageStart < 1 || !Number.isInteger(sourcePageEnd) || sourcePageEnd < sourcePageStart) throw new AppError('SCOPE_AUTHORITY_SOURCE_RANGE_INVALID', '来源页范围无效。', 422);
    const decision = String(input.decision || '').trim().toUpperCase();
    if (!DECISIONS.has(decision)) throw new AppError('SCOPE_AUTHORITY_DECISION_INVALID', 'scope authority decision 无效。', 422);
    requireFormalActorId(input.actor || input.confirmedBy || input.confirmed_by);
    return this.repository.upsertRequirementScopeAuthority({
      projectId: input.projectId,
      candidateIdentity,
      sourceChunkId,
      sourceHash,
      sourcePageStart,
      sourcePageEnd,
      decision,
      reasonCodes: normalizeReasons(input.reasonCodes ?? input.reason_codes),
      authorityType: 'HUMAN',
      authorityReference: 'explicit_user_confirmation',
      decisionSource: 'REAL_E2E_CASE_01',
      confirmedAt: input.confirmedAt || this.clock()
    });
  }

  async getDecision({ projectId, candidateIdentity }) {
    assertUuid(projectId, 'INVALID_PROJECT_ID', '项目 ID 格式无效。');
    const identity = String(candidateIdentity || '').trim();
    if (!identity) throw new AppError('SCOPE_AUTHORITY_IDENTITY_REQUIRED', '候选身份不能为空。', 422);
    return this.repository.getRequirementScopeAuthority({ projectId, candidateIdentity: identity });
  }

  async listDecisions(projectId) {
    assertUuid(projectId, 'INVALID_PROJECT_ID', '项目 ID 格式无效。');
    return this.repository.listRequirementScopeAuthority(projectId);
  }
}
