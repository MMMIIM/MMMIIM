import { createHash, randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { AppError } from './errors.js';
import { chunkEnterpriseMaterial } from './pipeline/enterprise-material-chunker.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MATERIAL_TYPES = new Set(['company_profile','qualification','case','project_case','product','product_documentation','personnel','technical_solution','technical_whitepaper','delivery_capability','historical_bid','other']);
const SUPPORTED_EXTENSIONS = new Set(['.docx','.pdf','.txt','.md']);

function assertUuid(value, code, message) {
  if (!UUID_PATTERN.test(String(value || ''))) throw new AppError(code, message, 400);
}

export class CompanyMaterialService {
  constructor({ repository, storage, textExtractor }) {
    this.repository = repository; this.storage = storage; this.textExtractor = textExtractor;
  }

  async upload({ projectId, file, materialType }) {
    assertUuid(projectId, 'INVALID_PROJECT_ID', '项目 ID 格式无效。');
    if (!await this.repository.getProject(projectId)) throw new AppError('PROJECT_NOT_FOUND', '项目不存在。', 404);
    if (!file?.buffer) throw new AppError('MATERIAL_FILE_REQUIRED', '请选择企业材料文件。', 422);
    if (!MATERIAL_TYPES.has(materialType)) throw new AppError('MATERIAL_TYPE_INVALID', '企业材料类型无效。', 422);
    const extension = extname(String(file.originalname || '')).toLowerCase();
    if (!SUPPORTED_EXTENSIONS.has(extension)) throw new AppError('MATERIAL_FILE_TYPE_UNSUPPORTED', '企业材料仅支持 DOCX、文本型 PDF、TXT 和 Markdown。', 422);
    const fileHash = createHash('sha256').update(file.buffer).digest('hex');
    const duplicate = await this.repository.findCompanyMaterialByHash(projectId, fileHash);
    if (duplicate) throw new AppError('MATERIAL_DUPLICATE', '该企业材料已经上传，请勿重复添加。', 409);
    const storageKey = await this.storage.save({ projectId, originalName: file.originalname, buffer: file.buffer });
    const material = await this.repository.createCompanyMaterial({ projectId, originalName: file.originalname,
      storageKey, materialType, mimeType: file.mimetype || 'application/octet-stream', sizeBytes: file.size ?? file.buffer.length, fileHash });
    try {
      const extraction = await this.textExtractor({ fileName: file.originalname, mimeType: file.mimetype, buffer: file.buffer });
      const completed = await this.repository.completeCompanyMaterialExtraction(material.id, extraction.text);
      await this.repository.replaceMaterialChunks(material.id, chunkEnterpriseMaterial(material.id, extraction.text));
      return completed;
    } catch (error) {
      const ocrRequired = extension === '.pdf' && ['TENDER_TEXT_EMPTY','TENDER_TEXT_EXTRACTION_FAILED'].includes(error?.code);
      const code = ocrRequired ? 'OCR_REQUIRED' : (error?.code || 'MATERIAL_EXTRACTION_FAILED');
      const message = ocrRequired ? '该 PDF 未提取到可用文本，请完成 OCR 后重新上传。' : '企业材料文本提取失败，请确认文件未损坏。';
      await this.repository.failCompanyMaterialExtraction(material.id, { status: ocrRequired ? 'ocr_required' : 'failed', code, message });
      throw new AppError(code, message, 422);
    }
  }

  async list(projectId) {
    assertUuid(projectId, 'INVALID_PROJECT_ID', '项目 ID 格式无效。');
    if (!await this.repository.getProject(projectId)) throw new AppError('PROJECT_NOT_FOUND', '项目不存在。', 404);
    return { materials: await this.repository.listCompanyMaterials(projectId) };
  }

  async listChunks(materialId) {
    assertUuid(materialId, 'INVALID_MATERIAL_ID', '企业材料 ID 格式无效。');
    const material=await this.repository.getCompanyMaterial(materialId);
    if(!material) throw new AppError('MATERIAL_NOT_FOUND', '企业材料不存在。', 404);
    return { material, chunks:await this.repository.listMaterialChunks(materialId) };
  }

  /**
   * Quarantine is an owning-service transition. It preserves the material,
   * chunks and historical lineage while removing the material from the central
   * source-authority policy. The repository operation is idempotent.
   */
  async quarantine(materialId, { reason } = {}) {
    assertUuid(materialId, 'INVALID_MATERIAL_ID', '企业材料 ID 格式无效。');
    const normalizedReason = String(reason || '').trim();
    if (!normalizedReason) throw new AppError('MATERIAL_QUARANTINE_REASON_REQUIRED', '隔离材料必须提供原因。', 422);
    const current = await this.repository.getCompanyMaterial(materialId);
    if (!current) throw new AppError('MATERIAL_NOT_FOUND', '企业材料不存在。', 404);
    if (typeof this.repository.quarantineCompanyMaterial !== 'function') {
      throw new AppError('MATERIAL_QUARANTINE_UNAVAILABLE', '材料隔离服务尚未配置。', 503);
    }
    return this.repository.quarantineCompanyMaterial({ materialId, reason: normalizedReason });
  }

  async quarantineMatching({ predicate, reason } = {}) {
    if (typeof this.repository.listAllCompanyMaterials !== 'function') {
      throw new AppError('MATERIAL_QUARANTINE_UNAVAILABLE', '材料隔离服务尚未配置。', 503);
    }
    if (typeof predicate !== 'function') throw new AppError('MATERIAL_QUARANTINE_SELECTOR_REQUIRED', '材料隔离选择器无效。', 422);
    const materials = await this.repository.listAllCompanyMaterials();
    const selected = materials.filter(predicate);
    const quarantined = [];
    for (const material of selected) quarantined.push(await this.quarantine(material.id, { reason }));
    return { materials: quarantined };
  }
}

export function createEvidenceIdentifier() {
  return `EVI-${randomUUID().toUpperCase()}`;
}
