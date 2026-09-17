import { AppError } from '../errors.js';
import { buildWriterBatches, mergeWriterSections, sanitizeDocument, validateDocument, replaceChapter, hashText } from './document-generation.js';
import { chapterConfig, CHAPTER_RULE_VERSION } from './chapter-config.js';
import { routeBatchGeneration, BATCH_GENERATION_RULE_VERSION } from './batch-generation-router.js';
import { assertFormalEvidenceEligible } from '../evidence-lifecycle.js';
import { createClaimGate } from './claim-gate.js';
import { sanitizeDocument as sanitizeSections } from './document-sanitizer.js';
import { validateDocument as validateSections } from './document-validator.js';
import { buildDocumentPlan } from './document-plan.js';
import { buildSectionContext } from './section-context-builder.js';
import { WriterReferenceSelector } from './writer-reference-selector.js';
import { buildGenerationBatches, mergePlannedSections } from './writer-generation-batch-builder-v2.js';
import { parseSectionMarkers } from './writer-output-markers.js';
import { WriterInputAuthorizationService } from '../writer-input-authorization-service.js';
import { WriterExecutionService } from '../writer-execution-service.js';
import { materializeMentions, validateWriterOutput, verifyMentionSlices, guardCriticalAssertions, verifyWriterPropagation } from './writer-execution-contract-v1.js';
import { buildWriterTaskWithLineage } from './writer-lineage-v1.js';
import { buildResponseUnitsV1 } from './response-unit-v1.js';
import { projectResponseDecisionV1 } from './response-decision-v1.js';
import { markdownBlocks } from './bid-document-model.js';
import { validateDocumentStructure } from './document-structure-validator.js';
import { buildWriterAuthorizationSnapshot, writerAuthorizationSnapshotHash } from './writer-authorization-snapshot.js';
import { SafeResponsePacketBuilder } from './safe-response-packet-builder.js';

const RULE_VERSIONS = { chapters: CHAPTER_RULE_VERSION, document: '4.3-document-1', writer_contract: '4.3-section-drafting', batch_generation: BATCH_GENERATION_RULE_VERSION };
export const WRITER_V2_MAX_MANUAL_RETRIES = 1;

function snapshotReferences(source, sectionId) {
  return (source || [])
    .flatMap((task) => task?.input_snapshot?.sections || task?.input?.sections || [])
    .filter((item) => (item.section?.section_id || item.section_id) === sectionId)
    .flatMap((item) => Array.isArray(item.reference_materials) ? item.reference_materials : []);
}

const sortedBy = key => (left, right) => String(left?.[key] ?? '').localeCompare(String(right?.[key] ?? ''));
const list = value => Array.isArray(value) ? value : [];
const hashValue = value => hashText(JSON.stringify(value));
const generationInputIdentity = (snapshot, ruleVersions, writerAuthorizationSnapshot, { includeLegacyEligibility = true } = {}) => hashText(JSON.stringify({
  coverage: snapshot.coverage || {},
  requirements: list(snapshot.requirements).map(item => ({ req_id: item.req_id, text_hash: hashValue(item.text ?? item.content ?? ''), requirement_category: item.requirement_category ?? null, ...(includeLegacyEligibility ? { writer_eligible: item.writer_eligible === true } : {}), writer_authorized: item.writer_authorized === true, response_mode: item.response_mode ?? null, readiness_status: item.response_decision?.readiness_status ?? null, is_mandatory: item.is_mandatory === true, source_status: item.source_status ?? null, confirmation_type: item.confirmation_type ?? null, target_sections: list(item.target_sections) })).sort(sortedBy('req_id')),
  plans: list(snapshot.plans).map(item => ({ requirement_id: item.requirement_id ?? item.req_id, response_status: item.response_status ?? null, response_summary_hash: hashValue(item.response_summary ?? null), implementation_actions_hash: hashValue(item.implementation_actions ?? []), optional_design_hash: hashValue(item.optional_design ?? []), deliverables_hash: hashValue(item.deliverables ?? []), acceptance_methods_hash: hashValue(item.acceptance_methods ?? []), conditions_hash: hashValue(item.conditions ?? []), responsibility_boundaries_hash: hashValue(item.responsibility_boundaries ?? []), capability_gap_hash: hashValue(item.capability_gap ?? ''), target_sections: list(item.target_sections) })).sort(sortedBy('requirement_id')),
  claims: list(snapshot.claims).map(item => ({ claim_id: item.claim_id, requirement_id: item.requirement_id, claim_type: item.claim_type, text_hash: hashValue(item.claim_text ?? item.text ?? ''), claim_assertion_hash: item.claim_assertion_hash ?? item.assertion_hash ?? null, basis_requirement_ids: [...(item.basis_requirement_ids || [])].sort(), basis_evidence_ids: [...(item.basis_evidence_ids || [])].sort(), target_sections: list(item.target_sections), requested_commitment: item.requested_commitment ?? null, decision: item.decision ?? item.gate_result_decision ?? null, current: item.current !== false, ...(includeLegacyEligibility ? { writer_eligible: item.writer_eligible === true } : {}), gate_result_id: item.gate_result_id ?? null, allowed_scope: [...(item.allowed_scope || [])].sort(), required_conditions: [...(item.required_conditions || [])].sort(), limitations: [...(item.limitations || [])].sort(), input_snapshot_hash: item.input_snapshot_hash ?? null, source_hashes: [...(item.source_hashes || [])].sort(), lineage_current: item.lineage_current === true })).sort(sortedBy('claim_id')),
  evidence: list(snapshot.evidence).map(item => ({ evidence_id: item.evidence_id, content_hash: hashValue(item.content ?? ''), source_hash: item.source_hash ?? null, applicable_requirement_ids: [...(item.applicable_requirement_ids || [])].sort(), usage_scope: item.usage_scope ?? item.module ?? null, approval_status: item.approval_status ?? null, validity_status: item.validity_status ?? null })).sort(sortedBy('evidence_id')),
  safe_response_packets: list(snapshot.safe_response_packets).map(item => ({ requirement_id: item.requirement_id, packet_hash: item.packet_hash, response_mode: item.response_mode })).sort(sortedBy('requirement_id')),
  response_units: list(snapshot.response_units).map(item => ({ response_unit_id: item.response_unit_id, section_key: item.section_key, response_mode: item.response_mode, requirement_ids: [...(item.requirement_ids || [])].sort() })).sort(sortedBy('response_unit_id')),
  writer_authorization_snapshot: writerAuthorizationSnapshot || null,
  writer_composition: ruleVersions.writer_composition || 'writer-v1',
  writer_contract: ruleVersions.writer_contract || null,
  document_plan_version: ruleVersions.document_plan_version || null,
  batch_generation: ruleVersions.batch_generation || null,
  chapters: ruleVersions.chapters || null,
  document: ruleVersions.document || null
}));

function runV2DocumentValidation(sectionOutputs, generation) {
  const rawSections = sectionOutputs.map((section) => ({
    id: section.section_id,
    title: section.title,
    requirement_ids: section.requirement_ids || [],
    draft_text: section.content_markdown
  }));
  const claimGate = createClaimGate(generation.requirement_snapshot || []);
  const sanitizedSections = sanitizeSections(rawSections, claimGate);
  const sanitizedText = sanitizedSections.map((section) => `## ${section.title}\n\n${section.final_text}`).join('\n\n');
  // Some in-memory fixtures predate persisted target_sections. Derive only a
  // validation view from the already-built DocumentPlan; the canonical
  // Requirement snapshot itself is never changed.
  const assignedSections = new Map();
  for (const section of rawSections) for (const requirementId of section.requirement_ids) {
    const list = assignedSections.get(requirementId) || [];
    list.push(section.id);
    assignedSections.set(requirementId, list);
  }
  const validationRequirements = (generation.requirement_snapshot || []).map((requirement) => ({
    ...requirement,
    source_text: requirement.source_text || requirement.source_excerpt || requirement.text,
    is_mandatory: typeof requirement.is_mandatory === 'boolean' ? requirement.is_mandatory : false,
    mandatory_marker: requirement.mandatory_marker ?? null,
    mandatory_scope_source_text: requirement.mandatory_scope_source_text ?? null,
    mandatory_scope_section: requirement.mandatory_scope_section ?? null,
    exception_clause_ids: Array.isArray(requirement.exception_clause_ids) ? requirement.exception_clause_ids : [],
    target_sections: Array.isArray(requirement.target_sections) && requirement.target_sections.length
      ? requirement.target_sections
      : [...new Set(assignedSections.get(requirement.req_id) || [])]
  }));
  const structural = validateSections({
    baselineRequirements: validationRequirements,
    requirements: validationRequirements,
    sections: sanitizedSections,
    claimGate,
    phase: 'final'
  });
  const documentStructure = validateDocumentStructure(sanitizedSections.map((section) => ({
    section_id: section.id,
    title: section.title,
    content_blocks: markdownBlocks(section.final_text)
  })), { throwOnError: false });
  const existing = validateDocument({
    text: sanitizedText,
    requirements: generation.requirement_snapshot || [],
    approvedClaims: generation.claim_snapshot || [],
    approvedEvidence: generation.evidence_snapshot || [],
    chapterConfig
  });
  const errors = [...(structural.errors || []), ...(existing.errors || [])];
  if (!documentStructure.valid) errors.push(...documentStructure.violations.map((violation) => ({ code: violation.code, message: '文档结构未通过确定性校验。', details: violation })));
  const warnings = [...(structural.warnings || []), ...(existing.warnings || [])];
  return {
    sanitizedSections,
    sanitizedText,
    removedItems: sanitizedSections.flatMap((section) => (section.sanitization_events || []).map((event) => ({ code: event.code, action: event.action, section_id: section.id }))),
    validation: {
      ...existing,
      validation_status: errors.length ? 'critical' : warnings.length ? 'warning' : 'pass',
      validation_pass: errors.length === 0,
      errors,
      warnings,
      structural_validation: structural,
      document_structure_validation: documentStructure,
      rule_version: existing.rule_version || '4.3-document-1'
    }
  };
}

async function pool(items, limit, worker) {
  let cursor = 0;
  const run = async () => { while (cursor < items.length) await worker(items[cursor++]); };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
}

export class DocumentGenerationService {
  constructor({ repository, provider, concurrency = 2, writerV2 = false, embeddingClient = null, referenceSelector = null, writerInputAuthorizationService = null, writerExecutionService = null, responseRouterService = null, safeResponsePacketBuilder = null }) {
    this.repository = repository; this.provider = provider; this.concurrency = Math.max(1, Math.min(3, Number(concurrency) || 2)); this.writerV2 = writerV2 === true;
    this.writerInputAuthorizationService = writerInputAuthorizationService || new WriterInputAuthorizationService({ repository });
    this.writerExecutionService = writerExecutionService || new WriterExecutionService({ repository });
    this.referenceSelector = referenceSelector || new WriterReferenceSelector({ repository, embeddingClient });
    this.responseRouterService = responseRouterService;
    this.safeResponsePacketBuilder = safeResponsePacketBuilder || new SafeResponsePacketBuilder();
  }

  async gate(projectId) {
    const input = await this.repository.getDocumentGenerationInput(projectId);
    if (!input.project) throw new AppError('PROJECT_NOT_FOUND', '项目不存在。', 404);
    if (!input.baseline) throw new AppError('REQUIREMENT_BASELINE_REQUIRED', '请先确认 Requirement Baseline。', 409);
    for (const evidence of input.evidence || []) assertFormalEvidenceEligible(evidence, '正文生成只能使用完成 Evidence Review 的正式来源。');
    const eligible = this.writerV2 ? input.requirements : input.requirements.filter((r) => r.writer_eligible && ['technical', 'performance', 'implementation', 'delivery', 'service'].includes(r.requirement_category));
    const approved = input.claims.filter((c) => c.decision === 'approved');
    const covered = new Set(approved.flatMap((c) => c.basis_requirement_ids || []));
    if (!this.writerV2 && eligible.some((r) => r.is_mandatory && !covered.has(r.req_id))) throw new AppError('COVERAGE_CRITICAL', 'mandatory Requirement 缺少 approved Claim，未创建正文任务。', 409);
    return { ...input, requirements: eligible, claims: approved, evidence: input.evidence.filter((e) => e.approval_status === 'approved') };
  }

  async generate(projectId) {
    if (this.writerV2) return this.generateV2(projectId);
    const input = await this.gate(projectId);
    const snapshot = { coverage: input.coverage, requirements: input.requirements, plans: input.plans, claims: input.claims, evidence: input.evidence };
    const generation = await this.repository.createDocumentGeneration(projectId, snapshot, RULE_VERSIONS);
    const batches = buildWriterBatches({ project: input.project, claims: input.claims, plans: input.plans, evidence: input.evidence });
    for (const batch of batches) batch.input.requirement_anchors = batch.input.response_plans.map((p) => ({ requirement_id: p.requirement_id, requirement_anchor: p.requirement_anchor }));
    await this.repository.createDocumentTasks(generation.id, batches); await this.runBatches(generation.id, batches); return this.finalize(generation.id);
  }

  async generateV2(projectId) {
    const input = await this.gate(projectId);
    const [facts, bindings, gateResults] = await Promise.all([this.repository.listProjectFacts ? this.repository.listProjectFacts(projectId) : [], this.repository.listProjectFactPropagationBindings ? this.repository.listProjectFactPropagationBindings(projectId) : [], this.repository.listLatestClaimGateEvaluations ? this.repository.listLatestClaimGateEvaluations(projectId) : []]);
    const responseDecisions = new Map((input.requirements || []).map((requirement) => {
      const id = requirement.req_id;
      const relatedClaims = (input.claims || []).filter((claim) => (claim.basis_requirement_ids || claim.requirement_ids || [claim.requirement_id]).map(String).includes(String(id)));
      return [id, this.responseRouterService?.project(requirement, { baseline: input.baseline, claims: relatedClaims, projectFacts: facts }) || projectResponseDecisionV1(requirement, { baseline: input.baseline, claims: relatedClaims, projectFacts: facts })];
    }));
    const unitInputs = (input.requirements || []).map((requirement) => ({ ...responseDecisions.get(requirement.req_id), requirement_id: requirement.req_id, target_section: requirement.target_section_id ?? requirement.target_section ?? requirement.target_sections?.[0] ?? 'default' }));
    const responseUnits = buildResponseUnitsV1(unitInputs);
    const unitByRequirement = new Map(responseUnits.flatMap((unit) => unit.requirement_ids.map((id) => [id, unit])));
    const routedRequirements = (input.requirements || []).map((requirement) => {
      const decision = responseDecisions.get(requirement.req_id) || {};
      const unit = unitByRequirement.get(String(requirement.req_id));
      return { ...requirement, response_decision: decision, response_mode: decision.response_mode, writer_authorized: decision.readiness_status === 'READY_FOR_WRITER' && decision.response_mode !== 'COMPLIANCE', response_unit_id: unit?.response_unit_id ?? null, target_section: requirement.target_section_id ?? requirement.target_section ?? requirement.target_sections?.[0] ?? null };
    });
    const responsePackets = new Map(routedRequirements.map((requirement) => [requirement.req_id, this.safeResponsePacketBuilder.build({ projectId, requirement, responseDecision: responseDecisions.get(requirement.req_id), responseUnitId: requirement.response_unit_id, requirementIds: requirement.response_unit_id ? unitByRequirement.get(String(requirement.req_id))?.requirement_ids : [requirement.req_id], projectContext: input.project, claims: input.claims, gateResults, projectFacts: facts })]));
    const routes = { ...(input.routes || {}) };
    // ResponsePlan routing is the existing deterministic Requirement route. Claims
    // remain a secondary signal because older stored Claims may not carry targets.
    for (const responsePlan of input.plans || []) {
      const targets = Array.isArray(responsePlan.target_sections) ? responsePlan.target_sections : [];
      if (targets.length && responsePlan.requirement_id && !routes[responsePlan.requirement_id]) routes[responsePlan.requirement_id] = targets[0];
    }
    for (const claim of input.claims) for (const requirementId of claim.basis_requirement_ids || []) if (claim.target_sections?.length && !routes[requirementId]) routes[requirementId] = claim.target_sections[0];
    const plan = buildDocumentPlan({ requirements: routedRequirements, structureSignals: input.structureSignals || [], routes });
    const contexts = [];
    for (const section of plan.sections) {
      const sectionRequirements = routedRequirements.filter((r) => section.requirement_ids.includes(r.req_id));
      // A default template may contain empty chapters. They are not Writer work
      // and must not trigger reference selection or an otherwise empty batch.
      if (!sectionRequirements.length) continue;
      const references = await this.referenceSelector.select({ projectId, section, requirements: sectionRequirements });
      const writerTaskId = `WT-${hashText(`${projectId}:${section.section_id}`).slice(0, 32).toUpperCase()}`;
      const context = buildSectionContext({ project: input.project, section, requirements: routedRequirements, claims: input.claims, facts, bindings, gateResults, versions: input.versions || {}, referenceMaterials: references, writerTaskId }, { authorizationService: this.writerInputAuthorizationService });
      context.covered_requirement_ids = [...section.requirement_ids].sort();
      context.response_unit_id = sectionRequirements.find((item) => item.response_unit_id)?.response_unit_id ?? null;
      const sectionPackets = sectionRequirements.map((requirement) => responsePackets.get(requirement.req_id)).filter(Boolean);
      contexts.push({ ...context, safe_response_packets: sectionPackets, safe_response_packet_hash: hashValue(sectionPackets.map((packet) => packet.packet_hash).sort()) });
      if (this.repository.saveWriterSafeContext) await this.writerInputAuthorizationService.persist(context.safe_context);
      if (this.repository.upsertFactMentionLedger) await this.writerInputAuthorizationService.persistMentions(context.safe_context);
    }
    const batches = buildGenerationBatches({ plan, sectionContexts: contexts, responsePlans: input.plans || [], approvedEvidence: input.evidence || [], maxTokens: input.writer_max_tokens || 20000 });
    const snapshot = { coverage: input.coverage, requirements: routedRequirements, plans: input.plans, claims: input.claims, evidence: input.evidence, safe_response_packets: [...responsePackets.values()], response_units: responseUnits };
    const writerAuthorizationSnapshot = buildWriterAuthorizationSnapshot({ projectId, requirements: routedRequirements, plans: input.plans, claims: input.claims, evidence: input.evidence, sectionContexts: contexts });
    const authorizationSnapshotHash = writerAuthorizationSnapshotHash(writerAuthorizationSnapshot);
    const generationRules = { ...RULE_VERSIONS, writer_composition: 'writer-v2', document_plan_version: plan.contract_version, writer_authorization_snapshot_hash: authorizationSnapshotHash };
    const generation = await this.repository.createDocumentGeneration(projectId, snapshot, generationRules, { generation_type: 'writer-v2', input_snapshot_hash: generationInputIdentity(snapshot, generationRules, writerAuthorizationSnapshot, { includeLegacyEligibility: false }) });
    if (generation.idempotent_replay === true) return this.repository.getDocumentGeneration(generation.id);
    for (const batch of batches) batch.section_contexts = contexts.filter((context) => batch.section_ids.includes(context.section.section_id));
    await this.repository.createDocumentTasks(generation.id, batches); await this.runBatchesV2(generation.id, batches); return this.finalizeV2(generation.id, plan);
  }

  async executeV2Batch(batch, { persist = true } = {}) {
    const out = await this.provider.draft(batch); let content = String(out.content || '').trim();
    if (batch.section_ids.length === 1 && !/<<<SECTION:/.test(content)) content = `<<<SECTION:${batch.section_ids[0]}>>>\n${content}\n<<<END_SECTION>>>`;
    const sections = parseSectionMarkers(content, batch.section_ids);
    for (const context of batch.section_contexts || []) {
      const task = buildWriterTaskWithLineage({ safeContext: context.safe_context, chapterRole: context.section.role, chapterInstruction: context.section.title, bindings: context.bindings || [], requirements: context.requirements || [], responseUnitId: context.response_unit_id, coveredRequirementIds: context.covered_requirement_ids || context.section.requirement_ids || [] });
      const text = sections[context.section.section_id];
      const usedClaimRefs = context.safe_context.assertable_claims.filter((claim) => text.includes(claim.claim_text)).map((claim) => claim.claim_id);
      const usedContextRefs = context.safe_context.context_items.filter((item) => item.value !== null && String(item.value).trim() && text.includes(String(item.value))).map((item) => item.project_fact_id);
      const raw = { writer_task_id: task.writer_task_id, chapter_id: task.chapter_id, source_context_hash: task.safe_context_hash, blocks: [{ block_id: `${task.chapter_id}-block-1`, text, used_context_refs: usedContextRefs, used_claim_refs: usedClaimRefs }] };
      const output = { ...validateWriterOutput(task, raw, { writerModel: 'writer-v2', promptVersion: 'writer-v2' }), response_unit_id: task.response_unit_id ?? null, covered_requirement_ids: [...(task.covered_requirement_ids || [])], lineage_contract_version: 'writer-requirement-lineage-v1' }; const mentions = materializeMentions(task, output); verifyMentionSlices(output, mentions);
      const guard = guardCriticalAssertions(task, output); const verification = verifyWriterPropagation(task, mentions, guard);
      if (guard.status === 'failed' || verification.coverage_status === 'blocked') throw Object.assign(new Error('Writer Critical Assertion Guard blocked output.'), { code: 'WRITER_OUTPUT_GUARD_FAILED', status: 422 });
      if (persist && this.repository.saveWriterExecutionTask) await this.writerExecutionService.persist({ task, output, mentions, guard, verification });
    }
    return { content, audit: out.audit || { provider: 'writer' } };
  }

  async runBatchesV2(generationId, batches) {
    await pool(batches, this.concurrency, async (batch) => {
      if (!await this.repository.claimDocumentTask(generationId, batch.chapter_id, batch.batch_index)) return;
      const started = Date.now();
      const route = routeBatchGeneration(batch);
      if (route.generation_mode === 'deterministic_template') {
        const sectionId = batch.section_ids[0];
        const content = `<<<SECTION:${sectionId}>>>\n${route.content}\n<<<END_SECTION>>>`;
        await this.repository.finishDocumentTask(generationId, batch, 'succeeded', {
          output_markdown: content, attempt: Number(batch.attempt || 0), runtime_ms: Date.now() - started,
          generation_mode: route.generation_mode, generation_rule_version: route.rule_version,
          provider_audit: { provider: 'backend', rule_version: route.rule_version, provider_calls: 0 }
        });
        return;
      }
      try {
        const out = await this.executeV2Batch(batch);
        await this.repository.finishDocumentTask(generationId, batch, 'succeeded', {
          output_markdown: out.content, attempt: Number(batch.attempt || 0) + 1, runtime_ms: Date.now() - started,
          generation_mode: 'semantic_gateway', generation_rule_version: 'writer-v2', provider_audit: out.audit
        });
      } catch (error) {
        await this.repository.finishDocumentTask(generationId, batch, 'failed', {
          attempt: Number(batch.attempt || 0) + 1, runtime_ms: Date.now() - started, error_code: error.code || 'WRITER_V2_FAILED',
          error_message: '章节生成失败。', generation_mode: 'semantic_gateway', generation_rule_version: 'writer-v2',
          provider_audit: { ...(error.audit || {}), batch_id: `${generationId}:${batch.chapter_id}:${batch.batch_index}`,
            section_ids: batch.section_ids, error_category: error.code || 'WRITER_V2_FAILED' }
        });
      }
    });
  }

  async runBatches(generationId, batches) {
    await pool(batches, this.concurrency, async (batch) => {
      if (!await this.repository.claimDocumentTask(generationId, batch.chapter_id, batch.batch_index)) return;
      const started = Date.now(); const route = routeBatchGeneration(batch);
      if (route.generation_mode === 'deterministic_template') { await this.repository.finishDocumentTask(generationId, batch, 'succeeded', { output_markdown: route.content, attempt: 0, runtime_ms: Date.now() - started, generation_mode: route.generation_mode, generation_rule_version: route.rule_version, provider_audit: { provider: 'backend', rule_version: route.rule_version } }); return; }
      let attempt = 0;
      while (attempt < 2) { attempt++; try { const out = await this.provider.draft(batch); await this.repository.finishDocumentTask(generationId, batch, 'succeeded', { output_markdown: out.content, attempt, runtime_ms: Date.now() - started, generation_mode: route.generation_mode, generation_rule_version: route.rule_version, provider_audit: out.audit }); return; } catch (error) { const retry = ['GATEWAY_NETWORK_ERROR', 'GATEWAY_TIMEOUT'].includes(error.code) && attempt < 2; if (!retry) await this.repository.finishDocumentTask(generationId, batch, 'failed', { attempt, runtime_ms: Date.now() - started, error_code: error.code || 'WRITER_FAILED', error_message: '章节生成失败。', generation_mode: route.generation_mode, generation_rule_version: route.rule_version }); } }
    });
  }

  async rebuildV2RetryBatches(generation) {
    const failedTasks = generation.tasks.filter((task) => task.status === 'failed');
    if (!failedTasks.length) throw new AppError('NO_FAILED_BATCHES', '没有可重试的失败 Batch。', 409);
    const requirements = generation.requirement_snapshot || [];
    const claims = generation.claim_snapshot || [];
    const routes = {};
    for (const claim of claims) {
      for (const requirementId of claim.basis_requirement_ids || []) {
        if (claim.target_sections?.length && !routes[requirementId]) routes[requirementId] = claim.target_sections[0];
      }
    }
    const signals = generation.tasks
      .flatMap((task) => task.input_snapshot?.sections || [])
      .map((item, index) => ({
        section_id: item.section?.section_id || item.section_id,
        parent_id: item.section?.parent_id ?? null,
        title: item.section?.title || item.title,
        role: item.section?.role || item.role || 'technical_bid_section',
        order: Number.isInteger(item.section?.order) ? item.section.order : index + 1
      }))
      .filter((item) => item.section_id);
    const plan = buildDocumentPlan({ requirements, structureSignals: signals, routes });
    const [facts, bindings, gateResults] = await Promise.all([
      this.repository.listProjectFacts ? this.repository.listProjectFacts(generation.project_id) : [],
      this.repository.listProjectFactPropagationBindings ? this.repository.listProjectFactPropagationBindings(generation.project_id) : [],
      this.repository.listLatestClaimGateEvaluations ? this.repository.listLatestClaimGateEvaluations(generation.project_id) : []
    ]);
    const failedBatches = [];
    for (const task of failedTasks) {
      const sectionIds = (task.input_snapshot?.sections || []).map((item) => item.section?.section_id || item.section_id).filter(Boolean);
      if (!sectionIds.length) throw new AppError('WRITER_V2_RETRY_INPUT_INVALID', '失败 Batch 缺少可恢复的 Section 输入。', 422);
      const taskPlan = { sections: plan.sections.filter((section) => sectionIds.includes(section.section_id)) };
      const taskContexts = [];
      for (const section of taskPlan.sections) {
        const sectionRequirements = requirements.filter((item) => section.requirement_ids.includes(item.req_id));
        if (!sectionRequirements.length) continue;
        const references = snapshotReferences([task], section.section_id);
        const writerTaskId = `WT-${hashText(`${generation.project_id}:${section.section_id}:retry`).slice(0, 32).toUpperCase()}`;
        const context = buildSectionContext({ project: { id: generation.project_id, name: generation.title }, section, requirements, claims, facts, bindings, gateResults, referenceMaterials: references, writerTaskId }, { authorizationService: this.writerInputAuthorizationService });
        taskContexts.push(context);
        if (this.repository.saveWriterSafeContext) await this.writerInputAuthorizationService.persist(context.safe_context);
        if (this.repository.upsertFactMentionLedger) await this.writerInputAuthorizationService.persistMentions(context.safe_context);
      }
      const retryPlans = generation.tasks.flatMap((item) => (item.input_snapshot?.sections || []).flatMap((section) => section.response_plans || []));
      const rebuilt = buildGenerationBatches({ plan: taskPlan, sectionContexts: taskContexts, responsePlans: retryPlans, approvedEvidence: generation.evidence_snapshot || [], maxTokens: 20000 });
      if (rebuilt.length !== 1) throw new AppError('WRITER_V2_RETRY_PLAN_INVALID', '失败 Batch 无法在原有边界内安全恢复。', 422);
      failedBatches.push({ ...rebuilt[0], chapter_id: task.chapter_id, batch_index: task.batch_index, attempt: Number(task.attempt || 0) + 1, section_contexts: taskContexts });
    }
    return { plan, failedBatches };
  }

  async retry(generationId) {
    const generation = await this.repository.getDocumentGeneration(generationId); if (!generation) throw new AppError('DOCUMENT_GENERATION_NOT_FOUND', '正文生成任务不存在。', 404);
    const failed = generation.tasks.filter((t) => t.status === 'failed').map((t) => ({ chapter_id: t.chapter_id, batch_index: t.batch_index, claim_ids: t.claim_ids, input: t.input_snapshot, attempt: t.attempt })); if (!failed.length) throw new AppError('NO_FAILED_BATCHES', '没有可重试的失败 Batch。', 409);
    if (this.writerV2) {
      if (failed.some((task) => Number(task.attempt || 0) >= 1 + WRITER_V2_MAX_MANUAL_RETRIES)) throw new AppError('WRITER_RETRY_EXHAUSTED', 'Writer Batch 已达到允许的重试次数。', 409);
      const rebuilt = await this.rebuildV2RetryBatches(generation);
      await this.repository.resetDocumentTasks(generationId, failed);
      await this.runBatchesV2(generationId, rebuilt.failedBatches);
      return this.finalizeV2(generationId, rebuilt.plan);
    }
    await this.repository.resetDocumentTasks(generationId, failed); await this.runBatches(generationId, failed); return this.finalize(generationId);
  }

  async finalizeV2(generationId, plan) {
    const generation = await this.repository.getDocumentGeneration(generationId);
    if (generation.tasks.some((task) => task.status === 'failed')) { await this.repository.updateDocumentGeneration(generationId, { status: 'failed', error_code: 'BATCH_FAILED', error_message: '部分章节生成失败。' }); return this.repository.getDocumentGeneration(generationId); }
    const sectionOutputs = [];
    for (const task of generation.tasks) {
      const expected = (task.input_snapshot?.sections || []).map((item) => item.section.section_id); const ids = expected.length ? expected : [task.chapter_id];
      let parsed;
      try { parsed = parseSectionMarkers(task.output_markdown, ids); } catch (error) { await this.repository.updateDocumentGeneration(generationId, { status: 'failed', error_code: error.code || 'WRITER_SECTION_MARKER_INVALID', error_message: 'Writer Batch section marker 无效。' }); return this.repository.getDocumentGeneration(generationId); }
      sectionOutputs.push({ ...task, section_outputs: ids.map((id) => ({ section_id: id, content_markdown: parsed[id] || '' })) });
    }
    let merged;
    try { merged = mergePlannedSections(sectionOutputs, plan); }
    catch (error) {
      await this.repository.updateDocumentGeneration(generationId, {
        status: 'failed', error_code: error.code || 'ASSEMBLY_INCOMPLETE',
        error_message: '章节装配未通过完整性校验。'
      });
      return this.repository.getDocumentGeneration(generationId);
    }
    const composed = runV2DocumentValidation(merged.sections_json, generation);
    const sanitizedSections = composed.sanitizedSections.map((section) => ({
      section_id: section.id,
      chapter_id: section.id,
      title: section.title,
      requirement_ids: section.requirement_ids,
      covered_requirement_ids: [...(section.covered_requirement_ids || section.requirement_ids || [])],
      content_markdown: section.final_text,
      claim_ids: merged.sections_json.find((item) => item.section_id === section.id)?.claim_ids || [],
      sanitization_events: section.sanitization_events || []
    }));
    const sanitized = { sanitized_text: composed.sanitizedText, removed_items: composed.removedItems };
    const validation = composed.validation;
    if (validation.validation_status === 'critical') { await this.repository.updateDocumentGeneration(generationId, { status: 'failed', risk_status: 'critical', error_code: 'DOCUMENT_VALIDATION_CRITICAL', error_message: '正文终检存在 critical 风险。' }); return this.repository.getDocumentGeneration(generationId); }
    const versionInput = { generation, draft_text: merged.markdown, sanitized_text: sanitized.sanitized_text, revised_text: null, final_text: sanitized.sanitized_text, sections_json: sanitizedSections, validation, removed_items: sanitized.removed_items, rule_versions: { ...RULE_VERSIONS, writer_composition: 'writer-v2', document_plan_version: plan.contract_version } };
    if (typeof this.repository.finalizeDocumentGenerationAtomic === 'function') {
      try { const finalized = await this.repository.finalizeDocumentGenerationAtomic(generationId, versionInput); return { ...(await this.repository.getDocumentGeneration(generationId)), version: finalized.version }; }
      catch (error) { await this.repository.updateDocumentGeneration(generationId, { status: 'failed', error_code: error.code || 'FINALIZE_TRANSACTION_FAILED', error_message: '正文终检持久化失败。' }); return this.repository.getDocumentGeneration(generationId); }
    }
    const version = await this.repository.createPipelineDocumentVersion(versionInput);
    await this.repository.updateDocumentGeneration(generationId, { status: 'finalized', risk_status: validation.validation_status }); return { ...(await this.repository.getDocumentGeneration(generationId)), version };
  }

  async finalize(generationId) {
    const generation = await this.repository.getDocumentGeneration(generationId); if (generation.tasks.some((t) => t.status === 'failed')) { await this.repository.updateDocumentGeneration(generationId, { status: 'failed', error_code: 'BATCH_FAILED', error_message: '部分章节生成失败。' }); return this.repository.getDocumentGeneration(generationId); }
    const merged = mergeWriterSections(generation.tasks); const sectionResults = merged.sections_json.map((section) => ({ section, result: sanitizeDocument(section.content_markdown) })); const sanitizedSections = sectionResults.map(({ section, result }) => ({ ...section, content_markdown: result.sanitized_text }));
    const sanitized = { sanitized_text: sanitizedSections.map((s) => `## ${s.title}\n\n${s.content_markdown}`).join('\n\n'), removed_items: sectionResults.flatMap(({ result }) => result.removed_items), requires_revision: sectionResults.some(({ result }) => result.requires_revision), revision_issues: sectionResults.flatMap(({ result }) => result.revision_issues) }; let finalText = sanitized.sanitized_text; let revisedText = null;
    if (sanitized.requires_revision) { const issue = sanitized.revision_issues[0]; const revision = await this.provider.revise({ chapter_id: generation.tasks[0]?.chapter_id, paragraph: issue.text, errors: sanitized.revision_issues, approved_claims: generation.claim_snapshot, restrictions: ['不得新增事实或承诺'] }); revisedText = finalText.replace(issue.text, revision.content); finalText = sanitizeDocument(revisedText).sanitized_text; }
    const validation = validateDocument({ text: finalText, requirements: generation.requirement_snapshot, approvedClaims: generation.claim_snapshot, approvedEvidence: generation.evidence_snapshot, chapterConfig }); if (validation.validation_status === 'critical') { await this.repository.updateDocumentGeneration(generationId, { status: 'failed', risk_status: 'critical', error_code: 'DOCUMENT_VALIDATION_CRITICAL', error_message: '正文终检存在 critical 风险。' }); return this.repository.getDocumentGeneration(generationId); }
    const finalSections = sanitizedSections.map((section) => { const heading = `## ${section.title}`; const start = finalText.indexOf(heading); if (start < 0) return section; const bodyStart = start + heading.length; const next = finalText.indexOf('\n## ', bodyStart); return { ...section, content_markdown: finalText.slice(bodyStart, next < 0 ? undefined : next).trim() }; });
    const version = await this.repository.createPipelineDocumentVersion({ generation, draft_text: merged.markdown, sanitized_text: sanitized.sanitized_text, revised_text: revisedText, final_text: finalText, sections_json: finalSections, validation, removed_items: sanitized.removed_items, rule_versions: RULE_VERSIONS }); await this.repository.updateDocumentGeneration(generationId, { status: 'finalized', risk_status: validation.validation_status }); return { ...(await this.repository.getDocumentGeneration(generationId)), version };
  }

  async prepareRegeneration(versionId, chapterId) {
    if (this.writerV2) return this.prepareRegenerationV2(versionId, chapterId);
    const version = await this.repository.getPipelineDocumentVersion(versionId); if (!version) throw new AppError('VERSION_NOT_FOUND', '文档版本不存在。', 404); const claims = (version.claim_snapshot || []).filter((c) => (c.target_sections || []).includes(chapterId)); const batches = buildWriterBatches({ project: { id: version.project_id, name: version.title }, claims, plans: [], evidence: version.evidence_snapshot || [] }); const outputs = [];
    for (const batch of batches) { const route = routeBatchGeneration(batch); const out = route.generation_mode === 'deterministic_template' ? { content: route.content, audit: { provider: 'backend' } } : await this.provider.draft(batch); outputs.push({ ...batch, output_markdown: out.content, generation_mode: route.generation_mode, generation_rule_version: route.rule_version, provider_audit: out.audit || null }); }
    const chapter = mergeWriterSections(outputs).sections_json.find((s) => s.chapter_id === chapterId); if (!chapter) throw new AppError('CHAPTER_INPUT_EMPTY', '目标章节没有 approved Claim。', 409); const replaced = replaceChapter(version, chapterId, chapter.content_markdown); const sanitized = sanitizeDocument(replaced.markdown); const validation = validateDocument({ text: sanitized.sanitized_text, requirements: version.requirement_snapshot || [], approvedClaims: version.claim_snapshot || [], approvedEvidence: version.evidence_snapshot || [], chapterConfig }); if (validation.validation_status === 'critical') throw new AppError('DOCUMENT_VALIDATION_CRITICAL', '重生成预览存在 critical 风险。', 409);
    const original = version.sections_json?.find((s) => s.chapter_id === chapterId)?.content_markdown || ''; const proposed = replaced.sections_json?.find((s) => s.chapter_id === chapterId)?.content_markdown || ''; return { before_version_id: version.id, before_version_hash: hashText(version.final_text || version.content_markdown || ''), project_id: version.project_id, chapter_id: chapterId, validation, preview: { before_version_id: version.id, before_version_hash: hashText(version.final_text || version.content_markdown || ''), sections_json: replaced.sections_json, sanitized_text: sanitized.sanitized_text, removed_items: sanitized.removed_items, proposed_text: proposed, original_text: original, diff: { original, proposed }, rule_versions: RULE_VERSIONS, claim_ids: claims.map((c) => c.claim_id) }, source_refs: claims.map((c) => ({ type: 'claim', claim_id: c.claim_id, requirement_ids: c.basis_requirement_ids || [] })) };
  }

  async prepareRegenerationV2(versionId, chapterId) {
    const version = await this.repository.getPipelineDocumentVersion(versionId);
    if (!version) throw new AppError('VERSION_NOT_FOUND', '文档版本不存在。', 404);
    const requirements = version.requirement_snapshot || [];
    const claims = version.claim_snapshot || [];
    const routes = {};
    for (const claim of claims) for (const requirementId of claim.basis_requirement_ids || []) if (claim.target_sections?.length) routes[requirementId] = claim.target_sections[0];
    const signals = (version.sections_json || []).map((section, index) => ({ section_id: section.section_id || section.chapter_id, parent_id: section.parent_id || null, title: section.title, role: section.role || 'technical_bid_section', order: index + 1 }));
    const plan = buildDocumentPlan({ requirements, structureSignals: signals.length ? signals : [], routes });
    const target = plan.sections.find((section) => section.section_id === chapterId);
    if (!target) throw new AppError('CHAPTER_INPUT_EMPTY', '目标章节没有有效 DocumentPlan。', 409);
    const [facts, bindings, gateResults] = await Promise.all([this.repository.listProjectFacts ? this.repository.listProjectFacts(version.project_id) : [], this.repository.listProjectFactPropagationBindings ? this.repository.listProjectFactPropagationBindings(version.project_id) : [], this.repository.listLatestClaimGateEvaluations ? this.repository.listLatestClaimGateEvaluations(version.project_id) : []]);
    // Regeneration reuses the frozen read-only reference projection captured in
    // the original generation; it never starts a new retrieval run.
    const references = snapshotReferences(version.chapter_tasks || version.tasks || [], chapterId);
    const writerTaskId = `WT-${hashText(`${version.project_id}:${chapterId}:regeneration`).slice(0, 32).toUpperCase()}`;
    const context = buildSectionContext({ project: { id: version.project_id, name: version.title }, section: target, requirements, claims, facts, bindings, gateResults, referenceMaterials: references, writerTaskId }, { authorizationService: this.writerInputAuthorizationService });
    const batches = buildGenerationBatches({ plan: { sections: [target] }, sectionContexts: [context], maxTokens: 20000 });
    if (!batches.length) throw new AppError('CHAPTER_INPUT_EMPTY', '目标章节没有 authorized Writer 输入。', 409);
    const out = await this.executeV2Batch({ ...batches[0], section_contexts: [context] }, { persist: false });
    const parsed = parseSectionMarkers(out.content, [chapterId]);
    const replaced = replaceChapter(version, chapterId, parsed[chapterId]);
    const replacedSections = replaced.sections_json.map((section) => ({
      section_id: section.chapter_id || section.section_id,
      title: section.title,
      requirement_ids: section.requirement_ids || ((section.chapter_id || section.section_id) === chapterId ? target.requirement_ids : []),
      content_markdown: section.content_markdown
    }));
    const composed = runV2DocumentValidation(replacedSections, { ...version, requirement_snapshot: requirements, claim_snapshot: claims, evidence_snapshot: version.evidence_snapshot || [] });
    const validation = composed.validation;
    if (validation.validation_status === 'critical') throw new AppError('DOCUMENT_VALIDATION_CRITICAL', '重生成预览存在 critical 风险。', 409);
    const original = version.sections_json?.find((s) => (s.chapter_id || s.section_id) === chapterId)?.content_markdown || ''; const proposed = replaced.sections_json?.find((s) => s.chapter_id === chapterId)?.content_markdown || '';
    return { before_version_id: version.id, before_version_hash: hashText(version.final_text || version.content_markdown || ''), project_id: version.project_id, chapter_id: chapterId, validation, preview: { before_version_id: version.id, before_version_hash: hashText(version.final_text || version.content_markdown || ''), sections_json: replaced.sections_json, sanitized_text: composed.sanitizedText, removed_items: composed.removedItems, proposed_text: proposed, original_text: original, diff: { original, proposed }, rule_versions: { ...RULE_VERSIONS, writer_composition: 'writer-v2', document_plan_version: plan.contract_version }, claim_ids: claims.filter((c) => (c.target_sections || []).includes(chapterId)).map((c) => c.claim_id) }, source_refs: claims.filter((c) => (c.target_sections || []).includes(chapterId)).map((c) => ({ type: 'claim', claim_id: c.claim_id, requirement_ids: c.basis_requirement_ids || [] })) };
  }

  async applyRegeneration(preview, versionId, chapterId) { const id = versionId || preview?.before_version_id; const current = await this.repository.getPipelineDocumentVersion(id); if (!current) throw new AppError('VERSION_NOT_FOUND', '文档版本不存在。', 404); if (preview?.before_version_hash && hashText(current.final_text || current.content_markdown || '') !== preview.before_version_hash) throw new AppError('STALE_PREVIEW', '预览基于旧版本，不能覆盖当前正文。', 409); const validation = preview.validation || preview.validation_result || {}; if (validation.validation_status === 'critical') throw new AppError('DOCUMENT_VALIDATION_CRITICAL', '重生成预览未通过终检。', 409); return this.repository.createRegeneratedVersion(current, chapterId, preview.sections_json || [], { sanitized_text: preview.sanitized_text, removed_items: preview.removed_items || [] }, validation, preview.rule_versions || RULE_VERSIONS); }
  async regenerate(versionId, chapterId) { const prepared = await this.prepareRegeneration(versionId, chapterId); return this.applyRegeneration(prepared.preview, prepared.before_version_id, chapterId); }
}
