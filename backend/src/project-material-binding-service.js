import { AppError } from './errors.js';
import { isAuthorityEligible, materialAuthorityAllowedForMode } from './pipeline/material-source-authority-policy.js';
import { requireFormalActorId } from './request-actor.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function assertUuid(value, code, message) { if (!UUID.test(String(value || ''))) throw new AppError(code, message, 400); }

export class ProjectMaterialBindingService {
  constructor({ repository, authorityMode = 'PRODUCTION' }) { this.repository = repository; this.authorityMode = authorityMode; }

  async create(input = {}) {
    assertUuid(input.projectId, 'INVALID_PROJECT_ID', '项目 ID 格式无效。');
    assertUuid(input.materialId, 'INVALID_MATERIAL_ID', '材料 ID 格式无效。');
    requireFormalActorId(input.actor || input.createdBy || input.created_by);
    const material = await this.repository.getCompanyMaterial(input.materialId);
    if (!material) throw new AppError('MATERIAL_NOT_FOUND', '材料不存在。', 404);
    if (material.corpus_scope && material.corpus_scope !== 'ENTERPRISE_PRIVATE') throw new AppError('MATERIAL_BINDING_SCOPE_INVALID', '只有 ENTERPRISE_PRIVATE 材料可建立跨项目绑定。', 422);
    if (!isAuthorityEligible(material)) throw new AppError('MATERIAL_NOT_AUTHORITY_ELIGIBLE', '材料未通过当前 Material Authority Gate。', 409);
    if (!materialAuthorityAllowedForMode(material, { authorityMode: this.authorityMode })) throw new AppError('MATERIAL_SYNTHETIC_PRODUCTION_AUTHORITY_NONE', 'Synthetic 材料不具备 Production authority。', 422);
    const bindingSource = String(input.bindingSource || input.binding_source || 'REAL_E2E_CASE_01').trim();
    if (!bindingSource) throw new AppError('MATERIAL_BINDING_SOURCE_REQUIRED', '绑定来源不能为空。', 422);
    return this.repository.upsertProjectMaterialBinding({
      projectId: input.projectId,
      materialId: input.materialId,
      bindingSource
    });
  }

  async remove({ projectId, materialId }) {
    assertUuid(projectId, 'INVALID_PROJECT_ID', '项目 ID 格式无效。');
    assertUuid(materialId, 'INVALID_MATERIAL_ID', '材料 ID 格式无效。');
    return this.repository.removeProjectMaterialBinding({ projectId, materialId });
  }

  async list(projectId) {
    assertUuid(projectId, 'INVALID_PROJECT_ID', '项目 ID 格式无效。');
    return this.repository.listProjectMaterialBindings(projectId);
  }
}
