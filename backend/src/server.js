import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { createPool, PgRepository } from './db.js';
import { createDifyClient } from './dify.js';
import { GenerationService } from './service.js';
import { LocalFileStorage } from './storage.js';
import { extractTenderText } from './tender-text-extractor.js';
import { RequirementParseService } from './requirement-parse-service.js';
import { createRequirementExtractionGateway } from './pipeline/requirement-extraction.js';
import { createBackendRuntime } from './backend-runtime.js';
import { ProductionBetaService } from './pipeline/production-beta-service.js';
import { RequirementSourceService } from './requirement-source-service.js';
import { CompanyMaterialService } from './company-material-service.js';
import { EvidenceService } from './evidence-service.js';
import { EvidenceFactService } from './evidence-fact-service.js';
import { createWriterProvider } from './pipeline/writer-provider.js';
import { DocumentGenerationService } from './pipeline/document-generation-service.js';
import { createEmbeddingClientFromEnv, createEmbeddingFetchFromEnv } from './pipeline/embedding-client.js';
import { EnterpriseRetrievalService } from './pipeline/enterprise-retrieval-service.js';
import { ConnectivityPreflight } from './runtime/connectivity-preflight.js';
import { EvidenceReviewService } from './evidence-review-service.js';
import { EvidenceSupportReviewEvaluator } from './pipeline/evidence-support-review-evaluator.js';
import { EvidenceSourceFactService } from './evidence-source-fact-service.js';
import { SemanticGatewayEvidenceFactExtractor } from './pipeline/semantic-gateway-evidence-fact-extractor.js';
import { ProjectFactControlService } from './project-fact-control-service.js';
import { ReviewCenterService } from './review-center-service.js';
import { EvidenceReadinessService } from './evidence-readiness-service.js';
import { MaterialProcessingCenterService } from './material-processing-center-service.js';
import { RequirementEvidenceFactMappingService } from './requirement-evidence-fact-mapping-service.js';
import { MappingCandidateBuilder } from './pipeline/mapping-candidate-builder.js';
import { SemanticGatewayMappingEvaluator } from './pipeline/semantic-gateway-mapping-evaluator.js';
import { DocumentDeliveryService } from './pipeline/document-delivery-service.js';
import { AgentContextResolver } from './pipeline/agent-context-resolver.js';
import { AgentToolLayer } from './pipeline/agent-tools.js';
import { BidCopilotOrchestrator } from './pipeline/bid-copilot-orchestrator.js';
import { AgentActionService } from './pipeline/agent-action-service.js';
import { AgentActionExecutor } from './pipeline/agent-action-executor.js';
import { createServerActorResolver } from './request-actor.js';
import { ProjectAuthorizationService } from './project-authorization-service.js';
import { ResponseRouterService } from './pipeline/response-router-service.js';
import { SafeResponsePacketService } from './pipeline/safe-response-packet-builder.js';
import { FinalRequirementReconciliationService } from './pipeline/final-requirement-reconciliation.js';
import { FlowProjectionService } from './pipeline/flow-projection-service.js';
import { RequirementScopeAuthorityService } from './requirement-scope-authority-service.js';
import { ProjectMaterialBindingService } from './project-material-binding-service.js';

const directory = dirname(fileURLToPath(import.meta.url));
const runtime = createBackendRuntime();
const runtimeEnv = runtime.env;

const pool = createPool(runtimeEnv.DATABASE_URL);
const repository = new PgRepository(pool);
const storage = new LocalFileStorage(
  runtimeEnv.UPLOAD_DIR ? resolve(directory, '..', runtimeEnv.UPLOAD_DIR) : resolve(directory, '../../uploads')
);
const difyClient = createDifyClient({ apiBase: runtimeEnv.DIFY_API_BASE, apiKey: runtimeEnv.DIFY_API_KEY });
const generationService = new GenerationService({
  repository,
  difyClient,
  workflowVersion: runtimeEnv.DIFY_WORKFLOW_VERSION || '4.2'
});
const requirementParseService = new RequirementParseService({
  repository,
  storage,
  textExtractor: extractTenderText,
  extractionGateway: createRequirementExtractionGateway(runtime.createSemanticGatewayClient({ taskType: 'requirement_extraction' })),
  env: runtimeEnv
});
const productionBetaService = new ProductionBetaService({ repository, ordinaryUncoveredSeverity:runtimeEnv.V43_ORDINARY_UNCOVERED_SEVERITY });
const requirementSourceService = new RequirementSourceService({ repository, storage, textExtractor: extractTenderText });
const requirementScopeAuthorityService = new RequirementScopeAuthorityService({ repository });
const projectMaterialBindingService = new ProjectMaterialBindingService({ repository });
const companyMaterialService = new CompanyMaterialService({ repository, storage, textExtractor: extractTenderText });
// Production Evidence Review proposals must cross the deterministic
// Evidence Support boundary.  No semantic adjudicator is configured until
// semantic_adjudication_v1 is formally published; ambiguous cases fail closed.
const evidenceSupportReviewEvaluator = new EvidenceSupportReviewEvaluator();
const evidenceReviewService = new EvidenceReviewService({ repository, evidenceSupportEvaluator:evidenceSupportReviewEvaluator });
const projectAuthorizationService = new ProjectAuthorizationService({ repository });
const evidenceService = new EvidenceService({ repository, evidenceReviewService, requireReviewTransition:true });
const evidenceFactService = new EvidenceFactService({ repository });
const embeddingTransport = createEmbeddingFetchFromEnv({ env: runtimeEnv });
const embeddingClient = createEmbeddingClientFromEnv({ env: runtimeEnv, fetchImpl: embeddingTransport.fetchImpl });
const enterpriseRetrievalService = new EnterpriseRetrievalService({ repository, embeddingClient, defaultTopK:runtimeEnv.V43_RETRIEVAL_TOP_K || 5 });
const connectivityPreflight = new ConnectivityPreflight({
  env: runtimeEnv,
  repository,
  logger: (event) => console.info('[runtime-connectivity]', JSON.stringify(event))
});
const responseRouterService = new ResponseRouterService({ repository });
const documentGenerationService = new DocumentGenerationService({ repository, provider:createWriterProvider({env:runtimeEnv}), embeddingClient, writerV2:true, concurrency:runtimeEnv.V43_WRITER_CONCURRENCY || 2, responseRouterService });
const evidenceSourceFactService = new EvidenceSourceFactService({
  repository,
  projectAuthorizationService,
  extractor: new SemanticGatewayEvidenceFactExtractor({
    client: runtime.createSemanticGatewayClient({ taskType: 'evidence_fact_extraction' })
  })
});
const projectFactControlService = new ProjectFactControlService({ repository });
const reviewCenterService = new ReviewCenterService({ repository });
const safeResponsePacketService = new SafeResponsePacketService({ repository, responseRouterService });
const finalRequirementReconciliationService = new FinalRequirementReconciliationService({ repository, responseRouterService, reviewCenterService });
const flowProjectionService = new FlowProjectionService({ repository, responseRouterService, reviewCenterService, reconciliationService: finalRequirementReconciliationService });
const evidenceReadinessService = new EvidenceReadinessService({ repository });
const materialProcessingCenterService = new MaterialProcessingCenterService({ repository, evidenceReadinessService });
const mappingCandidateBuilder = new MappingCandidateBuilder({ repository });
const mappingEvaluator = new SemanticGatewayMappingEvaluator({
  client: runtime.createSemanticGatewayClient({ taskType: 'requirement_evidence_mapping' })
});
const requirementEvidenceFactMappingService = new RequirementEvidenceFactMappingService({
  repository,
  candidateBuilder: mappingCandidateBuilder,
  evaluator: mappingEvaluator
});
const documentDeliveryService = new DocumentDeliveryService({ repository, storage });
const agentContextResolver = new AgentContextResolver({ repository });
const agentTools = new AgentToolLayer({
  repository,
  evidenceReadinessService,
  reviewCenterService,
  materialProcessingCenterService,
  enterpriseRetrievalService,
  documentGenerationService,
  productionBetaService
});
const agentActionService = new AgentActionService({ repository, tools: agentTools, evidenceReadinessService, reviewCenterService, productionBetaService, documentGenerationService });
const agentActionExecutor = new AgentActionExecutor({ actionService: agentActionService, repository });
const agentOrchestrator = new BidCopilotOrchestrator({ contextResolver: agentContextResolver, tools: agentTools, actionExecutor: agentActionExecutor, auditRepository: repository, reconciliationService: finalRequirementReconciliationService });
const actorResolver = createServerActorResolver({ actorId: runtimeEnv.BACKEND_DEV_ACTOR_ID, actorType: 'development' });
const app = createApp({
  repository,
  storage,
  generationService,
  requirementParseService,
  productionBetaService,
  requirementSourceService,
  requirementScopeAuthorityService,
  projectMaterialBindingService,
  companyMaterialService,
  evidenceService,
  evidenceFactService,
  enterpriseRetrievalService,
  documentGenerationService,
  reviewCenterService,
  evidenceReadinessService,
  materialProcessingCenterService,
  requirementEvidenceFactMappingService,
  evidenceReviewService,
  evidenceSourceFactService,
  projectAuthorizationService,
  projectFactControlService,
  documentDeliveryService,
  responseRouterService,
  safeResponsePacketService,
  finalRequirementReconciliationService,
  flowProjectionService,
  agentContextResolver,
  agentOrchestrator,
  agentActionExecutor,
  connectivityPreflight,
  actorResolver,
  legacyGenerationCompat: runtimeEnv.V43_LEGACY_GENERATION_COMPAT === 'true',
  corsOrigin: runtimeEnv.CORS_ORIGIN
});

const port = Number(runtimeEnv.PORT || 3001);
const host = runtimeEnv.HOST || '127.0.0.1';
const server = app.listen(port, host, () => console.log(`Backend listening on http://${host}:${port}`));
void connectivityPreflight.run().catch((error) => console.error('[runtime-connectivity]', JSON.stringify({ result: 'fail', error_class: error?.code || 'PREFLIGHT_FAILED' })));

async function shutdown() {
  server.close(async () => {
    await embeddingTransport.close();
    await pool.end();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
