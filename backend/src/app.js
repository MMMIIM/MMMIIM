import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { AppError, ERROR_MESSAGES } from './errors.js';
import { normalizeUtf8FileName } from './file-name.js';
import { createServerActorResolver, requireTrustedActor, withTrustedActor } from './request-actor.js';
import { ProjectAuthorizationService } from './project-authorization-service.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024, files: 1 } });

function requireText(value, fieldName) {
  const normalized = String(value || '').trim();
  if (!normalized) throw new AppError('VALIDATION_ERROR', `${fieldName}不能为空。`, 400);
  return normalized;
}

function sendData(res, data, status = 200) {
  return res.status(status).json({ ok: true, data });
}

function safeFactDiagnostic(error) {
  const details = error?.details;
  if (!details || details.stage !== 'FACT') return null;
  const diagnostic = {
    error_code: typeof error.code === 'string' ? error.code : null,
    stage: 'FACT',
    boundary: typeof details.boundary === 'string' ? details.boundary.slice(0, 160) : null,
    cause_code: typeof details.cause_code === 'string' ? details.cause_code.slice(0, 80) : null,
    provider_invocation: typeof details.provider_invocation === 'string' ? details.provider_invocation.slice(0, 80) : null
  };
  if (details.provider_audit && typeof details.provider_audit === 'object' && !Array.isArray(details.provider_audit)) {
    const audit = details.provider_audit;
    diagnostic.provider_audit = {
      provider_adapter_invoked: audit.provider_adapter_invoked === true,
      fetch_invoked: audit.fetch_invoked === true,
      provider_http_reached: audit.provider_http_reached === true,
      provider_http_status: Number.isInteger(audit.provider_http_status) ? audit.provider_http_status : null,
      finish_reason: typeof audit.finish_reason === 'string' ? audit.finish_reason.slice(0, 40) : null,
      prompt_tokens: Number.isInteger(audit.prompt_tokens) ? audit.prompt_tokens : null,
      completion_tokens: Number.isInteger(audit.completion_tokens) ? audit.completion_tokens : null,
      output_truncated: audit.output_truncated === true,
      json_parse_success: typeof audit.json_parse_success === 'boolean' ? audit.json_parse_success : null,
      safe_error_code: typeof audit.safe_error_code === 'string' ? audit.safe_error_code.slice(0, 80) : null,
      cause_code: typeof audit.cause_code === 'string' ? audit.cause_code.slice(0, 80) : null
    };
  }
  if (Array.isArray(details.schema_validation_errors)) {
    diagnostic.schema_validation_errors = details.schema_validation_errors.slice(0, 20).map(item => ({
      stage: item?.stage === 'FACT' ? 'FACT' : null,
      path: typeof item?.path === 'string' ? item.path.slice(0, 200) : null,
      keyword: typeof item?.keyword === 'string' ? item.keyword.slice(0, 80) : null,
      expected: typeof item?.expected === 'string' ? item.expected.slice(0, 240) : null,
      actual_type: typeof item?.actual_type === 'string' ? item.actual_type.slice(0, 80) : null,
      additional_property: typeof item?.additional_property === 'string' ? item.additional_property.slice(0, 120) : null,
      missing_property: typeof item?.missing_property === 'string' ? item.missing_property.slice(0, 120) : null,
      pattern: typeof item?.pattern === 'string' ? item.pattern.slice(0, 160) : null
    }));
  }
  if (Number.isInteger(details.attempt_count)) {
    const safeFailure = failure => {
      if (!failure || typeof failure !== 'object' || Array.isArray(failure)) return null;
      return {
        stage: failure.stage === 'FACT' ? 'FACT' : null,
        boundary: typeof failure.boundary === 'string' ? failure.boundary.slice(0, 160) : null,
        error_code: typeof failure.error_code === 'string' ? failure.error_code.slice(0, 100) : null,
        cause_code: typeof failure.cause_code === 'string' ? failure.cause_code.slice(0, 100) : null,
        ...(Array.isArray(failure.schema_validation_errors) ? {
          schema_validation_errors: failure.schema_validation_errors.slice(0, 20).map(item => ({
            path: typeof item?.path === 'string' ? item.path.slice(0, 200) : null,
            keyword: typeof item?.keyword === 'string' ? item.keyword.slice(0, 80) : null,
            expected: typeof item?.expected === 'string' ? item.expected.slice(0, 240) : null,
            actual_type: typeof item?.actual_type === 'string' ? item.actual_type.slice(0, 80) : null
          }))
        } : {})
      };
    };
    diagnostic.retry = {
      attempt_count: details.attempt_count,
      first_pass: details.first_pass === true,
      retry_eligible: details.retry_eligible === true,
      retry_attempted: details.retry_attempted === true,
      retry_success: details.retry_success === true,
      auto_recovered: details.auto_recovered === true,
      final_auto_success: details.final_auto_success === true,
      human_escalation: details.human_escalation === true,
      final_status: typeof details.final_status === 'string' ? details.final_status.slice(0, 80) : null,
      initial_failure: safeFailure(details.initial_failure),
      retry_result: safeFailure(details.retry_result)
    };
  }
  return diagnostic;
}

export function createApp({ repository, storage, generationService, requirementParseService, requirementSourceService, requirementScopeAuthorityService, projectMaterialBindingService, productionBetaService, companyMaterialService, evidenceService, evidenceFactService, enterpriseRetrievalService, documentGenerationService, reviewCenterService, evidenceReadinessService, materialProcessingCenterService, evidenceReviewService, evidenceSourceFactService, requirementEvidenceFactMappingService, projectFactControlService, documentDeliveryService, responseRouterService, safeResponsePacketService, finalRequirementReconciliationService, flowProjectionService, agentContextResolver, agentOrchestrator, agentActionExecutor, connectivityPreflight, projectAuthorizationService: projectAuthorizationServiceInput, actorResolver = createServerActorResolver({ actorId: process.env.BACKEND_DEV_ACTOR_ID, actorType: 'development' }), legacyGenerationCompat = false, corsOrigin }) {
  const app = express();
  app.use(cors({ origin: corsOrigin || 'http://localhost:5173' }));
  app.use(express.json({ limit: '2mb' }));
  const trustedActor = (req) => requireTrustedActor(actorResolver, req);
  const projectAuthorizationService = projectAuthorizationServiceInput || (repository ? new ProjectAuthorizationService({ repository }) : null);

  const assertProjectWrite = async (req, projectId) => {
    if (!projectAuthorizationService) {
      throw new AppError('PROJECT_AUTHORIZATION_REQUIRED', '项目授权服务尚未配置。', 503);
    }
    return projectAuthorizationService.assertProjectAccess({
      actor: trustedActor(req), projectId, action: 'WRITE'
    });
  };
  const mutationRequest = req => ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
  const authorizeResolvedMutation = (resolver, code, message, { skip = () => false } = {}) => async (req, _res, next) => {
    if (!mutationRequest(req) || skip(req)) return next();
    try {
      const target = await resolver(req);
      if (!target?.project_id) throw new AppError(code, message, 404);
      await assertProjectWrite(req, target.project_id);
      next();
    } catch (error) { next(error); }
  };

  // Formal project-scoped mutations share one HTTP authorization boundary. Canonical
  // Review -> Fact extraction is excluded because its owning service already enforces it.
  app.use('/api/projects/:projectId', async (req, _res, next) => {
    const isExportWrite = req.method === 'GET' && /\/document-versions\/[^/]+\/export-word(?:\?|$)/.test(req.originalUrl);
    const ownedFactExtraction = /\/evidence-reviews\/[^/]+\/facts(?:\?|$)/.test(req.originalUrl);
    if ((!mutationRequest(req) && !isExportWrite) || ownedFactExtraction) return next();
    try { await assertProjectWrite(req, req.params.projectId); next(); }
    catch (error) { next(error); }
  });
  app.use('/api/evidence-reviews/:reviewId', authorizeResolvedMutation(
    req => repository.getEvidenceReviewProject(req.params.reviewId),
    'EVIDENCE_REVIEW_NOT_FOUND', 'Evidence Review 不存在。',
    { skip: req => /^\/facts(?:\?|$)/.test(req.url) }
  ));
  app.use('/api/evidence-source-facts/:factId', authorizeResolvedMutation(
    req => repository.getEvidenceSourceFactCurrent(req.params.factId),
    'EVIDENCE_FACT_NOT_FOUND', 'Fact 不存在。'
  ));
  app.use('/api/requirement-evidence-fact-mappings/:mappingId', authorizeResolvedMutation(
    req => repository.getRequirementEvidenceFactMappingCurrent(req.params.mappingId),
    'MAPPING_NOT_FOUND', 'Mapping 不存在。'
  ));
  app.use('/api/project-facts/:factId', authorizeResolvedMutation(
    req => repository.getProjectFactCurrent(req.params.factId),
    'PROJECT_FACT_NOT_FOUND', 'Project Fact 不存在。'
  ));
  app.use('/api/claims/:claimId', authorizeResolvedMutation(
    req => repository.getClaimProject(req.params.claimId),
    'CLAIM_NOT_FOUND', 'Claim 不存在。'
  ));
  app.use('/api/document-generations/:generationId', authorizeResolvedMutation(
    req => repository.getDocumentGeneration(req.params.generationId),
    'DOCUMENT_GENERATION_NOT_FOUND', '正文生成任务不存在。'
  ));
  app.use('/api/document-versions/:versionId', authorizeResolvedMutation(
    req => repository.getPipelineDocumentVersion(req.params.versionId),
    'VERSION_NOT_FOUND', '文档版本不存在。'
  ));
  app.use('/api/evidences/:evidenceId', authorizeResolvedMutation(
    req => repository.getEvidenceRecord(req.params.evidenceId),
    'EVIDENCE_NOT_FOUND', 'Evidence 不存在。'
  ));
  app.use('/api/evidence-mappings/:mappingId', authorizeResolvedMutation(
    req => repository.getRequirementEvidenceMappingProject(req.params.mappingId),
    'MAPPING_NOT_FOUND', 'Mapping 不存在。'
  ));
  app.use('/api/evidence-facts/:factId', authorizeResolvedMutation(
    req => repository.getEvidenceFactByIdentifier(req.params.factId),
    'EVIDENCE_FACT_NOT_FOUND', 'Fact 不存在。'
  ));
  app.use('/api/tender-parse-jobs/:jobId', authorizeResolvedMutation(
    req => repository.getParseJob(req.params.jobId),
    'PARSE_JOB_NOT_FOUND', '解析任务不存在。'
  ));
  app.use('/api/requirement-candidates/:candidateId', authorizeResolvedMutation(
    async req => {
      const sourceReview = await repository.getCandidateSourceReview(req.params.candidateId);
      return sourceReview?.candidate
        ? repository.getParseJob(sourceReview.candidate.parse_job_id)
        : null;
    },
    'REQUIREMENT_CANDIDATE_NOT_FOUND', 'Requirement Candidate 不存在。'
  ));
  app.use('/api/requirements/:requirementId/enterprise-retrieval', authorizeResolvedMutation(
    req => repository.getCanonicalRequirementForRetrieval(req.params.requirementId),
    'REQUIREMENT_NOT_FOUND', 'Requirement 不存在。'
  ));

  app.get('/api/health', async (_req, res, next) => {
    try {
      await repository.pool.query('SELECT 1');
      res.json({ ok: true, database: 'connected' });
    } catch (error) {
      next(new AppError('DATABASE_UNAVAILABLE', '数据库连接不可用。', 503, error));
    }
  });

  app.post('/api/projects', upload.single('tender_file'), async (req, res, next) => {
    try {
      const actor = projectAuthorizationService
        ? projectAuthorizationService.assertTrustedActor(trustedActor(req))
        : trustedActor(req);
      const project = await repository.createProjectWithOwner({
        name: requireText(req.body?.name, '项目名称'), deadline: req.body?.deadline || null, owner: actor
      });
      let tenderFile = null;
      if (req.file) {
        const originalName = normalizeUtf8FileName(req.file.originalname);
        const storageKey = await storage.save({ projectId: project.id, originalName, buffer: req.file.buffer });
        tenderFile = await repository.addTenderFile({
          projectId: project.id, originalName, storageKey,
          mimeType: req.file.mimetype || 'application/octet-stream', sizeBytes: req.file.size
        });
      }
      res.status(201).json({ project, tenderFile });
    } catch (error) { next(error); }
  });

  app.get('/api/projects', async (_req, res, next) => {
    try { res.json({ projects: await repository.listProjects() }); } catch (error) { next(error); }
  });

  app.get('/api/projects/:projectId', async (req, res, next) => {
    try {
      const project = await repository.getProject(req.params.projectId);
      if (!project) throw new AppError('PROJECT_NOT_FOUND', ERROR_MESSAGES.PROJECT_NOT_FOUND, 404);
      const [tenderFiles, jobs, generations, documentGenerations, versions, parseJobs, requirementBaseline, documentExports] = await Promise.all([
        repository.listTenderFiles(project.id), repository.listJobs(project.id),
        repository.listGenerations(project.id), repository.listDocumentGenerations ? repository.listDocumentGenerations(project.id) : Promise.resolve([]), repository.listVersions(project.id),
        repository.listParseJobs(project.id), repository.getRequirementBaseline(project.id), repository.listDocumentExports ? repository.listDocumentExports(project.id) : Promise.resolve([])
      ]);
      res.json({ project, tenderFiles, jobs, generations, documentGenerations, versions, parseJobs, requirementBaseline, documentExports });
    } catch (error) { next(error); }
  });

  app.post('/api/projects/:projectId/tender-files', upload.single('file'), async (req, res, next) => {
    try {
      const project = await repository.getProject(req.params.projectId);
      if (!project) throw new AppError('PROJECT_NOT_FOUND', ERROR_MESSAGES.PROJECT_NOT_FOUND, 404);
      if (!req.file) throw new AppError('VALIDATION_ERROR', '请选择要上传的招标文件。', 400);
      const originalName = normalizeUtf8FileName(req.file.originalname);
      const storageKey = await storage.save({ projectId: project.id, originalName, buffer: req.file.buffer });
      const file = await repository.addTenderFile({
        projectId: project.id, originalName, storageKey,
        mimeType: req.file.mimetype || 'application/octet-stream', sizeBytes: req.file.size
      });
      res.status(201).json({ file });
    } catch (error) { next(error); }
  });

  if (legacyGenerationCompat) app.post('/api/projects/:projectId/generation-jobs', async (req, res, next) => {
    try {
      const result = await generationService.generate({ projectId: req.params.projectId, inputs: req.body, user: req.body?.user });
      res.status(201).json({
        job: result.job,
        generation: {
          id: result.generation.id,
          status: result.generation.status,
          workflow_version: result.generation.workflow_version,
          runtime_ms: result.generation.runtime_ms,
          created_at: result.generation.created_at
        },
        documentVersion: result.version
      });
    } catch (error) { next(error); }
  });

  app.post('/api/projects/:projectId/tender-parse-jobs', async (req, res, next) => {
    try {
      const tenderFileId = requireText(req.body?.tender_file_id, '招标文件');
      const job = await requirementParseService.start({
        projectId: req.params.projectId,
        tenderFileId
      });
      res.status(201).json({ ok: true, job });
    } catch (error) { next(error); }
  });

  app.get('/api/projects/:projectId/tender-parse-jobs', async (req, res, next) => {
    try {
      const project = await repository.getProject(req.params.projectId);
      if (!project) throw new AppError('PROJECT_NOT_FOUND', ERROR_MESSAGES.PROJECT_NOT_FOUND, 404);
      res.json({ ok: true, jobs: await repository.listParseJobs(project.id) });
    } catch (error) { next(error); }
  });

  app.get('/api/tender-parse-jobs/:jobId', async (req, res, next) => {
    try { sendData(res, { job: await requirementParseService.get(req.params.jobId) }); }
    catch (error) { next(error); }
  });

  app.get('/api/tender-parse-jobs/:jobId/requirement-candidates', async (req, res, next) => {
    try { sendData(res, await requirementSourceService.listCandidates(req.params.jobId, req.query)); }
    catch (error) { next(error); }
  });

  app.get('/api/tender-parse-jobs/:jobId/confirmation-risk', async (req, res, next) => {
    try { sendData(res, await requirementSourceService.getConfirmationRisk(req.params.jobId)); }
    catch (error) { next(error); }
  });

  app.post('/api/tender-parse-jobs/:jobId/confirm', async (req, res, next) => {
    try { sendData(res, await requirementParseService.confirm(req.params.jobId, withTrustedActor(req.body, trustedActor(req), 'confirmed_by')), 201); }
    catch (error) { next(error); }
  });

  app.post('/api/tender-parse-jobs/:jobId/provisional-decisions', async (req, res, next) => {
    try { sendData(res, await requirementSourceService.includeProvisionalBatch(req.params.jobId, withTrustedActor(req.body, trustedActor(req), 'confirmed_by'))); }
    catch (error) { next(error); }
  });

  app.post('/api/tender-parse-jobs/:jobId/confirm-provisional', async (req, res, next) => {
    try { sendData(res, await requirementSourceService.includeProvisionalBatch(req.params.jobId, withTrustedActor(req.body, trustedActor(req), 'confirmed_by'))); }
    catch (error) { next(error); }
  });

  app.get('/api/requirement-candidates/:candidateId/source-review', async (req, res, next) => {
    try { res.json({ ok: true, ...(await requirementSourceService.getCandidateReview(req.params.candidateId)) }); }
    catch (error) { next(error); }
  });

  app.post('/api/requirement-candidates/:candidateId/source-decision', async (req, res, next) => {
    try { sendData(res, { candidate: await requirementSourceService.decideCandidateSource(req.params.candidateId, withTrustedActor(req.body, trustedActor(req), 'confirmed_by')) }); }
    catch (error) { next(error); }
  });

  app.patch('/api/requirement-candidates/:candidateId/source-status', async (req, res, next) => {
    try { sendData(res, { candidate: await requirementSourceService.setCandidateStatus(req.params.candidateId, withTrustedActor(req.body, trustedActor(req), 'confirmed_by')) }); }
    catch (error) { next(error); }
  });

  app.post('/api/requirement-candidates/:candidateId/confirm-provisional', async (req, res, next) => {
    try { sendData(res, { candidate: await requirementSourceService.confirmProvisional(req.params.candidateId, withTrustedActor(req.body, trustedActor(req), 'confirmed_by')) }); }
    catch (error) { next(error); }
  });

  app.post('/api/requirement-candidates/:candidateId/exclude', async (req, res, next) => {
    try { sendData(res, { candidate: await requirementSourceService.excludeCandidate(req.params.candidateId, withTrustedActor(req.body, trustedActor(req), 'confirmed_by')) }); }
    catch (error) { next(error); }
  });

  app.post('/api/requirement-candidates/:candidateId/restore', async (req, res, next) => {
    try { sendData(res, { candidate: await requirementSourceService.restoreCandidate(req.params.candidateId, withTrustedActor(req.body, trustedActor(req), 'confirmed_by')) }); }
    catch (error) { next(error); }
  });

  app.patch('/api/requirement-candidates/:candidateId/classification', async (req, res, next) => {
    try { sendData(res, { candidate: await requirementSourceService.updateClassification(req.params.candidateId, withTrustedActor(req.body, trustedActor(req), 'confirmed_by')) }); }
    catch (error) { next(error); }
  });

  app.get('/api/projects/:projectId/requirement-scope-authority', async (req, res, next) => {
    try {
      if (!requirementScopeAuthorityService) throw new AppError('REQUIREMENT_SCOPE_AUTHORITY_UNAVAILABLE', '需求范围授权服务尚未配置。', 503);
      sendData(res, { decisions: await requirementScopeAuthorityService.listDecisions(req.params.projectId) });
    } catch (error) { next(error); }
  });

  app.post('/api/projects/:projectId/requirement-scope-authority', async (req, res, next) => {
    try {
      if (!requirementScopeAuthorityService) throw new AppError('REQUIREMENT_SCOPE_AUTHORITY_UNAVAILABLE', '需求范围授权服务尚未配置。', 503);
      const body = req.body || {};
      const actor = trustedActor(req);
      sendData(res, { decision: await requirementScopeAuthorityService.recordDecision({
        projectId: req.params.projectId,
        candidateIdentity: body.candidate_identity,
        sourceChunkId: body.source_chunk_id,
        sourceHash: body.source_hash,
        sourcePageStart: body.source_page_start,
        sourcePageEnd: body.source_page_end,
        decision: body.decision,
        reasonCodes: body.reason_codes,
        actor
      }) }, 201);
    } catch (error) { next(error); }
  });

  app.get('/api/projects/:projectId/material-bindings', async (req, res, next) => {
    try {
      if (!projectMaterialBindingService) throw new AppError('PROJECT_MATERIAL_BINDING_UNAVAILABLE', '项目材料绑定服务尚未配置。', 503);
      sendData(res, { bindings: await projectMaterialBindingService.list(req.params.projectId) });
    } catch (error) { next(error); }
  });

  app.post('/api/projects/:projectId/material-bindings', async (req, res, next) => {
    try {
      if (!projectMaterialBindingService) throw new AppError('PROJECT_MATERIAL_BINDING_UNAVAILABLE', '项目材料绑定服务尚未配置。', 503);
      const actor = trustedActor(req);
      sendData(res, { binding: await projectMaterialBindingService.create({ projectId: req.params.projectId, materialId: req.body?.material_id, bindingSource: req.body?.binding_source, actor }) }, 201);
    } catch (error) { next(error); }
  });

  app.delete('/api/projects/:projectId/material-bindings/:materialId', async (req, res, next) => {
    try {
      if (!projectMaterialBindingService) throw new AppError('PROJECT_MATERIAL_BINDING_UNAVAILABLE', '项目材料绑定服务尚未配置。', 503);
      trustedActor(req);
      sendData(res, { binding: await projectMaterialBindingService.remove({ projectId: req.params.projectId, materialId: req.params.materialId }) });
    } catch (error) { next(error); }
  });

  app.get('/api/projects/:projectId/company-materials', async (req, res, next) => {
    try { sendData(res, await companyMaterialService.list(req.params.projectId)); }
    catch (error) { next(error); }
  });

  app.get('/api/runtime/readiness', (_req, res) => {
    res.json(connectivityPreflight?.getSnapshot?.() || {
      status: 'degraded',
      services: {},
      checked_at: null,
      error_class: 'NOT_CONFIGURED'
    });
  });

  app.get('/api/material-library/public', async (req, res, next) => {
    try {
      const scope = req.query.scope ? String(req.query.scope) : null;
      const industry = req.query.industry ? String(req.query.industry) : null;
      sendData(res, { materials: await repository.listPublicCorpusMaterials({ scope, industry }) });
    } catch (error) { next(error); }
  });

  app.post('/api/projects/:projectId/company-materials', upload.single('file'), async (req, res, next) => {
    try { sendData(res, { material: await companyMaterialService.upload({ projectId:req.params.projectId, file:req.file, materialType:String(req.body?.material_type || '') }) }, 201); }
    catch (error) { next(error); }
  });

  app.get('/api/company-materials/:materialId/chunks', async (req,res,next)=>{
    try{sendData(res,await companyMaterialService.listChunks(req.params.materialId));}catch(error){next(error);}
  });

  app.get('/api/projects/:projectId/evidences', async (req, res, next) => {
    try { sendData(res, await evidenceService.list(req.params.projectId)); }
    catch (error) { next(error); }
  });

  app.post('/api/projects/:projectId/evidences', async (req, res, next) => {
    try { sendData(res, { evidence: await evidenceService.create(req.params.projectId, req.body || {}) }, 201); }
    catch (error) { next(error); }
  });

  app.post('/api/evidences/:evidenceId/approve', async (req, res, next) => {
    try { sendData(res, { evidence: await evidenceService.decide(req.params.evidenceId, 'approved', withTrustedActor(req.body, trustedActor(req), 'decided_by')) }); }
    catch (error) { next(error); }
  });

  app.post('/api/evidences/:evidenceId/reject', async (req, res, next) => {
    try { sendData(res, { evidence: await evidenceService.decide(req.params.evidenceId, 'rejected', withTrustedActor(req.body, trustedActor(req), 'decided_by')) }); }
    catch (error) { next(error); }
  });
  app.patch('/api/evidences/:evidenceId/validity',async(req,res,next)=>{
    try{sendData(res,{evidence:await evidenceService.setValidity(req.params.evidenceId,withTrustedActor(req.body,trustedActor(req),'reviewed_by'))});}catch(error){next(error);}
  });

  app.post('/api/projects/:projectId/evidence-mappings',async(req,res,next)=>{
    try{sendData(res,{mapping:await evidenceService.proposeMapping(req.params.projectId,withTrustedActor(req.body,trustedActor(req),'created_by'))},201);}catch(error){next(error);}
  });
  app.post('/api/evidence-mappings/:mappingId/approve',async(req,res,next)=>{
    try{sendData(res,{mapping:await evidenceService.decideMapping(req.params.mappingId,'approved',withTrustedActor(req.body,trustedActor(req),'reviewed_by'))});}catch(error){next(error);}
  });
  app.post('/api/evidence-mappings/:mappingId/reject',async(req,res,next)=>{
    try{sendData(res,{mapping:await evidenceService.decideMapping(req.params.mappingId,'rejected',withTrustedActor(req.body,trustedActor(req),'reviewed_by'))});}catch(error){next(error);}
  });
  app.get('/api/projects/:projectId/requirements/:requirementId/evidence-mappings',async(req,res,next)=>{
    try{sendData(res,await evidenceService.listMappings(req.params.projectId,req.params.requirementId));}catch(error){next(error);}
  });
  app.get('/api/projects/:projectId/requirements/:requirementId/evidence-review',async(req,res,next)=>{
    try{sendData(res,await evidenceService.getRequirementReview(req.params.projectId,req.params.requirementId,req.query||{}));}catch(error){next(error);}
  });
  app.post('/api/projects/:projectId/requirements/:requirementId/evidence-candidates/from-retrieval',async(req,res,next)=>{
    try{const result=await evidenceService.createFromRetrieval(req.params.projectId,req.params.requirementId,req.body||{});sendData(res,result,result.created?201:200);}catch(error){next(error);}
  });
  app.post('/api/projects/:projectId/requirements/:requirementId/evidence-reviews',async(req,res,next)=>{
    try {
      const review = await evidenceReviewService.propose({
        projectId:req.params.projectId,
        requirementId:req.params.requirementId,
        retrievalRunId:req.body?.retrieval_run_id,
        retrievalCandidateId:req.body?.retrieval_candidate_id || req.body?.chunk_id,
        sourceSpanId:req.body?.source_span_id
      });
      sendData(res,{review},201);
    } catch(error) { next(error); }
  });
  app.get('/api/projects/:projectId/requirements/:requirementId/enterprise-evidence',async(req,res,next)=>{
    try{sendData(res,await evidenceService.listApprovedForRequirement(req.params.projectId,req.params.requirementId));}catch(error){next(error);}
  });
  app.post('/api/projects/:projectId/evidences/:evidenceId/facts',async(req,res,next)=>{
    try{sendData(res,{fact:await evidenceFactService.create(req.params.projectId,req.params.evidenceId,withTrustedActor(req.body,trustedActor(req),'created_by'))},201);}catch(error){next(error);}
  });
  app.get('/api/projects/:projectId/evidences/:evidenceId/facts',async(req,res,next)=>{
    try{sendData(res,await evidenceFactService.list(req.params.projectId,req.params.evidenceId));}catch(error){next(error);}
  });
  app.get('/api/projects/:projectId/evidences/:evidenceId/facts/approved',async(req,res,next)=>{
    try{sendData(res,await evidenceFactService.listApproved(req.params.projectId,req.params.evidenceId));}catch(error){next(error);}
  });
  app.get('/api/evidence-facts/:factId',async(req,res,next)=>{
    try{sendData(res,{fact:await evidenceFactService.get(req.params.factId)});}catch(error){next(error);}
  });
  app.post('/api/evidence-facts/:factId/approve',async(req,res,next)=>{
    try{sendData(res,{fact:await evidenceFactService.decide(req.params.factId,'approved',withTrustedActor(req.body,trustedActor(req),'reviewed_by'))});}catch(error){next(error);}
  });
  app.post('/api/evidence-facts/:factId/reject',async(req,res,next)=>{
    try{sendData(res,{fact:await evidenceFactService.decide(req.params.factId,'rejected',withTrustedActor(req.body,trustedActor(req),'reviewed_by'))});}catch(error){next(error);}
  });
  app.post('/api/evidence-facts/:factId/supersede',async(req,res,next)=>{
    try{sendData(res,{fact:await evidenceFactService.supersede(req.params.factId,req.body||{})},201);}catch(error){next(error);}
  });
  app.post('/api/requirements/:requirementId/enterprise-retrieval',async(req,res,next)=>{
    try{sendData(res,await enterpriseRetrievalService.retrieve(req.params.requirementId,req.body||{}),201);}catch(error){next(error);}
  });
  app.get('/api/enterprise-retrieval-runs/:runId',async(req,res,next)=>{
    try{sendData(res,await enterpriseRetrievalService.get(req.params.runId));}catch(error){next(error);}
  });

  app.get('/api/projects/:projectId/production-beta', async (req, res, next) => {
    try { sendData(res, await productionBetaService.get(req.params.projectId)); }
    catch (error) { next(error); }
  });
  app.get('/api/projects/:projectId/review-center',async(req,res,next)=>{try{sendData(res,await reviewCenterService.get(req.params.projectId));}catch(error){next(error);}});
  app.get('/api/projects/:projectId/requirements/:requirementId/response-decision', async (req, res, next) => {
    try {
      if (!responseRouterService) throw new AppError('RESPONSE_ROUTER_UNAVAILABLE', 'Response Router 服务尚未配置。', 503);
      sendData(res, await responseRouterService.get(req.params.projectId, req.params.requirementId));
    } catch (error) { next(error); }
  });
  app.get('/api/projects/:projectId/requirements/:requirementId/safe-response-packet', async (req, res, next) => {
    try {
      if (!safeResponsePacketService) throw new AppError('SAFE_RESPONSE_PACKET_UNAVAILABLE', 'Safe Response Packet 服务尚未配置。', 503);
      sendData(res, await safeResponsePacketService.get(req.params.projectId, req.params.requirementId));
    } catch (error) { next(error); }
  });
  app.get('/api/projects/:projectId/final-reconciliation', async (req, res, next) => {
    try {
      if (!finalRequirementReconciliationService) throw new AppError('RECONCILIATION_UNAVAILABLE', 'Final Requirement Reconciliation 服务尚未配置。', 503);
      sendData(res, await finalRequirementReconciliationService.get(req.params.projectId, req.query.version_id || null));
    } catch (error) { next(error); }
  });
  app.get('/api/projects/:projectId/gate-a/tasks', async (req, res, next) => {
    try {
      if (!flowProjectionService) throw new AppError('FLOW_PROJECTION_UNAVAILABLE', '流程投影服务尚未配置。', 503);
      sendData(res, await flowProjectionService.getTasks(req.params.projectId));
    } catch (error) { next(error); }
  });
  app.get('/api/projects/:projectId/compliance-matrix', async (req, res, next) => {
    try {
      if (!flowProjectionService) throw new AppError('FLOW_PROJECTION_UNAVAILABLE', '流程投影服务尚未配置。', 503);
      sendData(res, await flowProjectionService.getCompliance(req.params.projectId));
    } catch (error) { next(error); }
  });
  app.get('/api/projects/:projectId/bid-response-matrix', async (req, res, next) => {
    try {
      if (!flowProjectionService) throw new AppError('FLOW_PROJECTION_UNAVAILABLE', '流程投影服务尚未配置。', 503);
      sendData(res, await flowProjectionService.getBidResponseMatrix(req.params.projectId));
    } catch (error) { next(error); }
  });
  app.get('/api/projects/:projectId/evidence-readiness',async(req,res,next)=>{try{sendData(res,await evidenceReadinessService.get(req.params.projectId));}catch(error){next(error);}});
  app.get('/api/projects/:projectId/material-processing',async(req,res,next)=>{try{sendData(res,await materialProcessingCenterService.get(req.params.projectId));}catch(error){next(error);}});
  app.post('/api/evidence-reviews/:reviewId/:decision(approve|reject)',async(req,res,next)=>{try{const actor=trustedActor(req);sendData(res,{review:await evidenceReviewService.decide(req.params.reviewId,req.params.decision,{reviewer:actor.actor_id,note:req.body?.note})});}catch(error){next(error);}});
  app.post('/api/projects/:projectId/evidence-reviews/:reviewId/facts',async(req,res,next)=>{try{const actor=trustedActor(req);sendData(res,await evidenceSourceFactService.extract({projectId:req.params.projectId,reviewId:req.params.reviewId,actor}),201);}catch(error){next(error);}});
  app.post('/api/evidence-reviews/:reviewId/facts',async(req,res,next)=>{try{const actor=trustedActor(req);const review=await repository.getEvidenceReviewProject(req.params.reviewId);if(!review)throw new AppError('EVIDENCE_REVIEW_NOT_FOUND','Evidence Review 不存在。',404);sendData(res,await evidenceSourceFactService.extract({projectId:review.project_id,reviewId:req.params.reviewId,actor}),201);}catch(error){next(error);}});
  app.post('/api/evidence-source-facts/:factId/:decision(approve|reject)',async(req,res,next)=>{try{const actor=trustedActor(req);sendData(res,{fact:await evidenceSourceFactService.decide(req.params.factId,req.params.decision,{reviewer:actor.actor_id,note:req.body?.note})});}catch(error){next(error);}});
  app.post('/api/projects/:projectId/requirement-evidence-fact-mappings',async(req,res,next)=>{try{sendData(res,{mapping:await requirementEvidenceFactMappingService.propose({projectId:req.params.projectId,requirementId:req.body?.requirement_id,factId:req.body?.fact_id,sourceType:req.body?.source_type||'manual'})},201);}catch(error){next(error);}});
  app.post('/api/projects/:projectId/requirements/:requirementId/requirement-evidence-fact-mappings/produce',async(req,res,next)=>{try{sendData(res,await requirementEvidenceFactMappingService.produceForRequirement({projectId:req.params.projectId,requirementId:req.params.requirementId}),201);}catch(error){next(error);}});
  app.post('/api/requirement-evidence-fact-mappings/:mappingId/:decision(approve|reject)',async(req,res,next)=>{try{const actor=trustedActor(req);sendData(res,{mapping:await requirementEvidenceFactMappingService.decide(req.params.mappingId,req.params.decision,{reviewer:actor.actor_id,note:req.body?.note})});}catch(error){next(error);}});
  app.get('/api/projects/:projectId/project-facts/:factId/impact',async(req,res,next)=>{try{const impact=await reviewCenterService.factImpact(req.params.projectId,req.params.factId);if(!impact)throw new AppError('PROJECT_FACT_NOT_FOUND','Project Fact 不存在。',404);sendData(res,impact);}catch(error){next(error);}});
  app.post('/api/project-facts/:factId/:decision(approve|reject)',async(req,res,next)=>{try{const actor=trustedActor(req);sendData(res,{fact:await projectFactControlService.decide(req.params.factId,req.params.decision,{reviewer:actor.actor_id,note:req.body?.note})});}catch(error){next(error);}});
  app.post('/api/project-facts/:factId/edit',async(req,res,next)=>{try{const actor=trustedActor(req);const current=await repository.getProjectFactCurrent(req.params.factId);if(!current)throw new AppError('PROJECT_FACT_NOT_FOUND','Project Fact 不存在。',404);const impact=await reviewCenterService.factImpact(current.project_id,current.project_fact_id);const fact=await projectFactControlService.edit(req.params.factId,req.body?.fact||{}, {editor:actor.actor_id,note:req.body?.note});sendData(res,{fact,propagation:{...impact,status:'invalidation_completed'}});}catch(error){next(error);}});

  // The legacy production-beta mutation is retained only as an explicitly
  // opt-in compatibility surface. Canonical Claim authority is
  // /claims/generate below; the default production app must not expose this
  // second mutation path.
  if (legacyGenerationCompat) app.post('/api/projects/:projectId/production-beta', async (req, res, next) => {
    try { sendData(res, await productionBetaService.process(req.params.projectId, req.body), 201); }
    catch (error) { next(error); }
  });

  app.post('/api/projects/:projectId/response-plans/generate', async (req,res,next)=>{
    try{sendData(res,await productionBetaService.generatePlans(req.params.projectId),201);}catch(error){next(error);}
  });
  app.get('/api/projects/:projectId/response-plans',async(req,res,next)=>{
    try{sendData(res,await productionBetaService.getPlans(req.params.projectId));}catch(error){next(error);}
  });
  app.patch('/api/projects/:projectId/response-plans/:requirementId',async(req,res,next)=>{try{const actor=trustedActor(req);const input={...(req.body||{})};delete input.edited_by;sendData(res,await productionBetaService.editPlan(req.params.projectId,req.params.requirementId,input,actor));}catch(error){next(error);}});
  app.post('/api/projects/:projectId/claims/generate',async(req,res,next)=>{
    try{sendData(res,await productionBetaService.generateClaims(req.params.projectId),201);}catch(error){next(error);}
  });
  app.get('/api/projects/:projectId/claims',async(req,res,next)=>{
    try{sendData(res,await productionBetaService.getClaims(req.params.projectId));}catch(error){next(error);}
  });
  app.get('/api/projects/:projectId/coverage',async(req,res,next)=>{
    try{sendData(res,await productionBetaService.coverage(req.params.projectId));}catch(error){next(error);}
  });
  app.post('/api/claims/:claimId/approve',async(req,res,next)=>{
    try{sendData(res,await productionBetaService.decideClaim(req.params.claimId,'approved',withTrustedActor(req.body,trustedActor(req),'decided_by')));}catch(error){next(error);}
  });
  app.post('/api/claims/:claimId/reject',async(req,res,next)=>{
    try{sendData(res,await productionBetaService.decideClaim(req.params.claimId,'rejected',withTrustedActor(req.body,trustedActor(req),'decided_by')));}catch(error){next(error);}
  });
  app.post('/api/projects/:projectId/document-generations',async(req,res,next)=>{try{sendData(res,await documentGenerationService.generate(req.params.projectId),201);}catch(error){next(error);}});
  app.get('/api/document-generations/:generationId',async(req,res,next)=>{try{const value=await repository.getDocumentGeneration(req.params.generationId);if(!value)throw new AppError('DOCUMENT_GENERATION_NOT_FOUND','正文生成任务不存在。',404);sendData(res,value);}catch(error){next(error);}});
  app.post('/api/document-generations/:generationId/retry-batches',async(req,res,next)=>{try{sendData(res,await documentGenerationService.retry(req.params.generationId));}catch(error){next(error);}});
  app.get('/api/projects/:projectId/document-versions',async(req,res,next)=>{try{sendData(res,{versions:await repository.listVersions(req.params.projectId),generations:await repository.listDocumentGenerations(req.params.projectId)});}catch(error){next(error);}});
  app.get('/api/document-versions/:versionId',async(req,res,next)=>{try{const value=await repository.getPipelineDocumentVersion(req.params.versionId);if(!value)throw new AppError('VERSION_NOT_FOUND','文档版本不存在。',404);sendData(res,{version:value});}catch(error){next(error);}});
  app.post('/api/document-versions/:versionId/confirm',async(req,res,next)=>{try{sendData(res,await generationService.confirmVersion(req.params.versionId,req.body?.confirmation_text,trustedActor(req)));}catch(error){next(error);}});
  app.post('/api/document-versions/:versionId/chapters/:chapterId/regenerate',async(req,res,next)=>{try{sendData(res,{version:await documentGenerationService.regenerate(req.params.versionId,req.params.chapterId)},201);}catch(error){next(error);}});
  app.get('/api/projects/:projectId/document-exports', async (req, res, next) => {
    try { sendData(res, { exports: await repository.listDocumentExports(req.params.projectId) }); } catch (error) { next(error); }
  });
  app.get('/api/projects/:projectId/document-versions/:versionId/export-word', async (req, res, next) => {
    try {
      if (!documentDeliveryService) throw new AppError('DOCUMENT_DELIVERY_UNAVAILABLE', 'Word 交付服务尚未配置。', 503);
      const result = await documentDeliveryService.exportWord({ projectId: req.params.projectId, versionId: req.params.versionId });
      const encodedName = encodeURIComponent(result.fileName).replace(/['()]/g, escape);
      res.setHeader('Content-Type', result.mimeType);
      res.setHeader('Content-Length', String(result.buffer.length));
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedName}`);
      res.setHeader('X-Document-Export-Id', result.audit.id);
      res.status(200).send(result.buffer);
    } catch (error) { next(error); }
  });

  if (legacyGenerationCompat) app.get('/api/projects/:projectId/generation-jobs', async (req, res, next) => {
    try { res.json({ jobs: await repository.listJobs(req.params.projectId) }); } catch (error) { next(error); }
  });

  app.get('/api/projects/:projectId/copilot/context', async (req, res, next) => {
    try {
      if (!agentContextResolver) throw new AppError('AGENT_UNAVAILABLE', '项目助手尚未配置。', 503);
      const context = await agentContextResolver.resolve({ project_id: req.params.projectId, user_id: req.query.user_id, current_route: req.query.current_route, material_id: req.query.material_id, requirement_id: req.query.requirement_id, chapter_id: req.query.chapter_id, document_version_id: req.query.document_version_id });
      sendData(res, { context });
    } catch (error) { next(error); }
  });

  app.post('/api/projects/:projectId/copilot', async (req, res, next) => {
    try {
      if (!agentOrchestrator) throw new AppError('AGENT_UNAVAILABLE', '项目助手尚未配置。', 503);
      const message = requireText(req.body?.message, '问题');
      const suppliedContext = req.body?.context && typeof req.body.context === 'object' ? req.body.context : {};
      if (suppliedContext.project_id && suppliedContext.project_id !== req.params.projectId) throw new AppError('AGENT_CONTEXT_MISMATCH', '当前请求的项目上下文不一致，请从项目工作区重新发起。', 400);
      const result = await agentOrchestrator.run({ message, project_id: req.params.projectId, user_id: req.body?.user_id, context: { ...suppliedContext, project_id: req.params.projectId } });
      sendData(res, result);
    } catch (error) { next(error); }
  });

  app.get('/api/projects/:projectId/copilot/audits', async (req, res, next) => {
    try {
      if (!repository.listAgentExecutionAudits) throw new AppError('AGENT_AUDIT_UNAVAILABLE', '当前暂时无法读取助手记录。', 503);
      sendData(res, { audits: await repository.listAgentExecutionAudits(req.params.projectId, req.query.limit) });
    } catch (error) { next(error); }
  });

  app.post('/api/projects/:projectId/copilot/actions/execute', async (req, res, next) => {
    try {
      if (!agentActionExecutor || !agentContextResolver) throw new AppError('AGENT_ACTION_UNAVAILABLE', '项目助手操作能力尚未配置。', 503);
      const action = requireText(req.body?.tool || req.body?.action, '操作');
      const suppliedContext = req.body?.context && typeof req.body.context === 'object' ? req.body.context : {};
      if (suppliedContext.project_id && suppliedContext.project_id !== req.params.projectId) throw new AppError('AGENT_CONTEXT_MISMATCH', '当前请求的项目上下文不一致，请从项目工作区重新发起。', 400);
      const context = await agentContextResolver.resolve({ ...suppliedContext, project_id: req.params.projectId, user_id: req.body?.user_id });
      const result = await agentActionExecutor.execute({ context, tool: action, args: req.body?.args || {}, agent_run_id: req.body?.agent_run_id || null, idempotency_key: req.body?.idempotency_key || null, human_approved: req.body?.human_approved === true });
      sendData(res, result);
    } catch (error) { next(error); }
  });

  app.post('/api/projects/:projectId/copilot/actions/execute-plan', async (req, res, next) => {
    try {
      if (!agentActionExecutor || !agentContextResolver) throw new AppError('AGENT_ACTION_UNAVAILABLE', '项目助手操作能力尚未配置。', 503);
      const suppliedContext = req.body?.context && typeof req.body.context === 'object' ? req.body.context : {};
      if (suppliedContext.project_id && suppliedContext.project_id !== req.params.projectId) throw new AppError('AGENT_CONTEXT_MISMATCH', '当前请求的项目上下文不一致，请从项目工作区重新发起。', 400);
      const context = await agentContextResolver.resolve({ ...suppliedContext, project_id: req.params.projectId, user_id: req.body?.user_id });
      const result = await agentActionExecutor.executePlan({ context, actions: Array.isArray(req.body?.actions) ? req.body.actions : [], agent_run_id: req.body?.agent_run_id || null });
      sendData(res, result);
    } catch (error) { next(error); }
  });

  app.get('/api/projects/:projectId/copilot/action-audits', async (req, res, next) => {
    try {
      if (!repository.listAgentActionAudits) throw new AppError('AGENT_AUDIT_UNAVAILABLE', '当前暂时无法读取操作记录。', 503);
      sendData(res, { audits: await repository.listAgentActionAudits(req.params.projectId, req.query.limit) });
    } catch (error) { next(error); }
  });

  app.get('/api/projects/:projectId/copilot/action-previews/:previewId', async (req, res, next) => {
    try {
      if (!repository.getAgentActionPreview) throw new AppError('AGENT_ACTION_UNAVAILABLE', '当前暂时无法读取操作预览。', 503);
      const row = await repository.getAgentActionPreview(req.params.previewId);
      if (!row || row.project_id !== req.params.projectId) throw new AppError('AGENT_PREVIEW_NOT_FOUND', '操作预览不存在或不属于当前项目。', 404);
      const raw = row.preview_json || {};
      sendData(res, { preview: { preview_id: row.preview_id, action_type: row.action_type, target: row.target_json || {}, original_text: raw.original_text || raw.diff?.original || '', proposed_text: raw.proposed_text || raw.diff?.proposed || '', diff: raw.diff || null, validation_result: row.validation_json || {} } });
    } catch (error) { next(error); }
  });

  app.get('/api/projects/:projectId/document-versions', async (req, res, next) => {
    try { res.json({ versions: await repository.listVersions(req.params.projectId) }); } catch (error) { next(error); }
  });

  app.post('/api/document-versions/:versionId/review-decisions', async (req, res, next) => {
    try {
      if (req.body?.decision !== 'confirmed') throw new AppError('VALIDATION_ERROR', '当前阶段仅支持 confirmed 复核结论。', 400);
      const result = await generationService.confirmVersion(req.params.versionId, req.body?.confirmation_text, trustedActor(req));
      res.status(201).json(result);
    } catch (error) { next(error); }
  });

  if (legacyGenerationCompat) app.post('/api/generate-bid', async (req, res, next) => {
    try {
      const result = await generationService.generate({ projectId: null, inputs: req.body, user: req.body?.user });
      res.json({ markdown: result.parsed.markdown, response_mode: 'streaming', job_id: result.job.id });
    } catch (error) { next(error); }
  });

  app.use('/api', (_req, res) => {
    const notFound = { code: 'API_NOT_FOUND', message: '请求的 API 不存在，请确认前后端版本一致。' };
    res.status(404).json({ ok: false, error: notFound });
  });

  app.use((error, _req, res, _next) => {
    if (error instanceof multer.MulterError) {
      const uploadError = { code: 'UPLOAD_INVALID', message: '文件上传失败，请确认文件不超过 50 MB。' };
      return res.status(400).json({ ok: false, error: uploadError });
    }
    const appError = error instanceof AppError ? error : error?.code && Number.isInteger(error?.status)
      ? new AppError(error.code, error.message, error.status, error.details)
      : new AppError('INTERNAL_ERROR', '服务暂时不可用，请稍后重试。', 500);
    const diagnostic = safeFactDiagnostic(appError);
    const safeError = { code: appError.code, message: appError.message, ...(diagnostic ? { diagnostic } : {}) };
    return res.status(appError.status).json({ ok: false, error: safeError });
  });

  return app;
}
