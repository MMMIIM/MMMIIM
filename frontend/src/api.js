const API_BASE = import.meta.env.VITE_API_BASE || '';

export async function request(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body && !(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const text = await response.text();
  let payload = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch (_error) {
    const code = response.ok ? 'API_RESPONSE_INVALID' : `HTTP_${response.status}`;
    const message = response.ok
      ? '服务响应格式无效，请确认前后端接口版本一致。'
      : `后端接口不可用（HTTP ${response.status}），请确认前后端版本和 API 地址。`;
    const error = new Error(message);
    error.code = code;
    error.status = response.status;
    throw error;
  }
  if (!response.ok || payload.ok === false) {
    const detail = payload.error && typeof payload.error === 'object' ? payload.error : payload;
    const error = new Error(detail.message || '请求失败，请稍后重试。');
    error.code = detail.code || `HTTP_${response.status}`;
    error.status = response.status;
    throw error;
  }
  return payload.ok === true && payload.data && typeof payload.data === 'object' ? payload.data : payload;
}

export async function downloadWord(projectId, versionId) {
  const response = await fetch(`${API_BASE}/api/projects/${projectId}/document-versions/${versionId}/export-word`);
  if (!response.ok) {
    let detail = {};
    try { detail = await response.json(); } catch (_error) { /* safe fallback */ }
    const error = new Error(detail?.error?.message || 'Word 文件暂时无法导出，请稍后重试。');
    error.code = detail?.error?.code || `HTTP_${response.status}`;
    error.status = response.status;
    throw error;
  }
  const blob = await response.blob();
  const disposition = response.headers.get('content-disposition') || '';
  const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const fileName = encoded ? decodeURIComponent(encoded) : '技术标.docx';
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = fileName; link.click();
  URL.revokeObjectURL(url);
  return { fileName, size: blob.size, exportId: response.headers.get('x-document-export-id') };
}

export const api = {
  listProjects: () => request('/api/projects'),
  getProject: (id) => request(`/api/projects/${id}`),
  createProject(data) {
    const body = new FormData();
    body.append('name', data.name);
    if (data.deadline) body.append('deadline', data.deadline);
    if (data.file) body.append('tender_file', data.file);
    return request('/api/projects', { method: 'POST', body });
  },
  uploadTenderFile(projectId, file) {
    const body = new FormData();
    body.append('file', file);
    return request(`/api/projects/${projectId}/tender-files`, { method: 'POST', body });
  },
  startTenderParse(projectId, tenderFileId) {
    return request(`/api/projects/${projectId}/tender-parse-jobs`, {
      method: 'POST', body: JSON.stringify({ tender_file_id: tenderFileId })
    });
  },
  getTenderParseJob(jobId) {
    return request(`/api/tender-parse-jobs/${jobId}`);
  },
  listRequirementCandidates(jobId, sourceStatus = '') {
    const query = sourceStatus ? `?source_status=${encodeURIComponent(sourceStatus)}` : '';
    return request(`/api/tender-parse-jobs/${jobId}/requirement-candidates${query}`);
  },
  getRequirementConfirmationRisk(jobId) {
    return request(`/api/tender-parse-jobs/${jobId}/confirmation-risk`);
  },
  confirmRequirementBaseline(jobId, confirmedBy = 'current_user') {
    return request(`/api/tender-parse-jobs/${jobId}/confirm`, { method: 'POST', body: JSON.stringify({ confirmed_by: confirmedBy }) });
  },
  includeProvisionalBatch(jobId, confirmedBy = 'current_user') {
    return request(`/api/tender-parse-jobs/${jobId}/confirm-provisional`, { method: 'POST', body: JSON.stringify({ confirmed_by: confirmedBy }) });
  },
  confirmProvisionalCandidate(candidateId, confirmedBy = 'current_user') {
    return request(`/api/requirement-candidates/${candidateId}/confirm-provisional`, { method: 'POST', body: JSON.stringify({ confirmed_by: confirmedBy }) });
  },
  excludeRequirementCandidate(candidateId, confirmedBy = 'current_user') {
    return request(`/api/requirement-candidates/${candidateId}/exclude`, { method: 'POST', body: JSON.stringify({ confirmed_by: confirmedBy }) });
  },
  restoreRequirementCandidate(candidateId) {
    return request(`/api/requirement-candidates/${candidateId}/restore`, { method: 'POST', body: '{}' });
  },
  setRequirementSourceStatus(candidateId, sourceStatus, confirmedBy = 'current_user') {
    return request(`/api/requirement-candidates/${candidateId}/source-status`, { method: 'PATCH', body: JSON.stringify({ source_status: sourceStatus, confirmed_by: confirmedBy }) });
  },
  updateRequirementClassification(candidateId, requirementCategory) {
    return request(`/api/requirement-candidates/${candidateId}/classification`, { method: 'PATCH', body: JSON.stringify({ requirement_category: requirementCategory }) });
  },
  listCompanyMaterials(projectId) {
    return request(`/api/projects/${projectId}/company-materials`);
  },
  listPublicCorpusMaterials(scope, industry) {
    const params = new URLSearchParams();
    if (scope) params.set('scope', scope);
    if (industry) params.set('industry', industry);
    return request(`/api/material-library/public${params.toString() ? `?${params.toString()}` : ''}`);
  },
  uploadCompanyMaterial(projectId, file, materialType) {
    const body = new FormData(); body.append('file', file); body.append('material_type', materialType);
    return request(`/api/projects/${projectId}/company-materials`, { method:'POST', body });
  },
  listEvidences(projectId) {
    return request(`/api/projects/${projectId}/evidences`);
  },
  createEvidence(projectId, input) {
    return request(`/api/projects/${projectId}/evidences`, { method:'POST', body:JSON.stringify(input) });
  },
  decideEvidence(evidenceId, decision, decidedBy = 'current_user') {
    return request(`/api/evidences/${evidenceId}/${decision}`, { method:'POST', body:JSON.stringify({ decided_by:decidedBy }) });
  },
  reviewEvidenceValidity(evidenceId, validityStatus, reviewedBy='current_user') {
    return request(`/api/evidences/${evidenceId}/validity`, { method:'PATCH', body:JSON.stringify({ validity_status:validityStatus, reviewed_by:reviewedBy }) });
  },
  getRequirementEvidenceReview(projectId,requirementId,retrievalRunId='') {
    const query=retrievalRunId?`?retrieval_run_id=${encodeURIComponent(retrievalRunId)}`:'';
    return request(`/api/projects/${projectId}/requirements/${encodeURIComponent(requirementId)}/evidence-review${query}`);
  },
  createEvidenceCandidateFromRetrieval(projectId,requirementId,input) {
    return request(`/api/projects/${projectId}/requirements/${encodeURIComponent(requirementId)}/evidence-candidates/from-retrieval`,{method:'POST',body:JSON.stringify(input)});
  },
  proposeEvidenceMapping(projectId,input) {
    return request(`/api/projects/${projectId}/evidence-mappings`,{method:'POST',body:JSON.stringify(input)});
  },
  listEvidenceMappings(projectId,requirementId) {
    return request(`/api/projects/${projectId}/requirements/${encodeURIComponent(requirementId)}/evidence-mappings`);
  },
  decideEvidenceMapping(mappingId,decision,reviewedBy='current_user',input={}) {
    return request(`/api/evidence-mappings/${mappingId}/${decision}`,{method:'POST',body:JSON.stringify({...input,reviewed_by:reviewedBy})});
  },
  getCandidateSourceReview(candidateId) {
    return request(`/api/requirement-candidates/${candidateId}/source-review`);
  },
  decideCandidateSource(candidateId, decision) {
    return request(`/api/requirement-candidates/${candidateId}/source-decision`, {
      method: 'POST', body: JSON.stringify(decision)
    });
  },
  getProductionBeta(projectId) {
    return request(`/api/projects/${projectId}/production-beta`);
  },
  getResponsePlans(projectId) { return request(`/api/projects/${projectId}/response-plans`); },
  generateResponsePlans(projectId) { return request(`/api/projects/${projectId}/response-plans/generate`, { method:'POST', body:'{}' }); },
  editResponsePlan(projectId,requirementId,input){return request(`/api/projects/${projectId}/response-plans/${encodeURIComponent(requirementId)}`,{method:'PATCH',body:JSON.stringify(input)});},
  getClaims(projectId) { return request(`/api/projects/${projectId}/claims`); },
  generateClaims(projectId) { return request(`/api/projects/${projectId}/claims/generate`, { method:'POST', body:'{}' }); },
  getCoverage(projectId) { return request(`/api/projects/${projectId}/coverage`); },
  getReviewCenter(projectId) { return request(`/api/projects/${projectId}/review-center`); },
  getResponseDecision(projectId, requirementId) { return request(`/api/projects/${projectId}/requirements/${encodeURIComponent(requirementId)}/response-decision`); },
  getSafeResponsePacket(projectId, requirementId) { return request(`/api/projects/${projectId}/requirements/${encodeURIComponent(requirementId)}/safe-response-packet`); },
  getFinalRequirementReconciliation(projectId, versionId = '') { const query = versionId ? `?version_id=${encodeURIComponent(versionId)}` : ''; return request(`/api/projects/${projectId}/final-reconciliation${query}`); },
  getGateATasks(projectId) { return request(`/api/projects/${projectId}/gate-a/tasks`); },
  getComplianceMatrix(projectId) { return request(`/api/projects/${projectId}/compliance-matrix`); },
  getBidResponseMatrix(projectId) { return request(`/api/projects/${projectId}/bid-response-matrix`); },
  getEvidenceReadiness(projectId) { return request(`/api/projects/${projectId}/evidence-readiness`); },
  getMaterialProcessing(projectId) { return request(`/api/projects/${projectId}/material-processing`); },
  getCopilotContext(projectId, context = {}) {
    const query = new URLSearchParams(Object.entries(context).filter(([, value]) => value !== undefined && value !== null && value !== '')).toString();
    return request(`/api/projects/${projectId}/copilot/context${query ? `?${query}` : ''}`);
  },
  askCopilot(projectId, message, context = {}) {
    return request(`/api/projects/${projectId}/copilot`, { method: 'POST', body: JSON.stringify({ message, context: { ...context, project_id: projectId } }) });
  },
  executeCopilotAction(projectId, tool, args = {}, context = {}, humanApproved = false, idempotencyKey = '') {
    return request(`/api/projects/${projectId}/copilot/actions/execute`, {
      method: 'POST',
      body: JSON.stringify({ tool, args, context: { ...context, project_id: projectId }, human_approved: humanApproved, idempotency_key: idempotencyKey || undefined })
    });
  },
  executeCopilotPlan(projectId, actions = [], context = {}) {
    return request(`/api/projects/${projectId}/copilot/actions/execute-plan`, {
      method: 'POST',
      body: JSON.stringify({ actions, context: { ...context, project_id: projectId } })
    });
  },
  listCopilotActionAudits(projectId, limit = 50) {
    return request(`/api/projects/${projectId}/copilot/action-audits?limit=${encodeURIComponent(limit)}`);
  },
  getCopilotActionPreview(projectId, previewId) {
    return request(`/api/projects/${projectId}/copilot/action-previews/${encodeURIComponent(previewId)}`);
  },
  decideEvidenceReview(reviewId,decision,note='') { return request(`/api/evidence-reviews/${reviewId}/${decision}`,{method:'POST',body:JSON.stringify({reviewer:'current_user',note})}); },
  extractEvidenceSourceFact(reviewId) { return request(`/api/evidence-reviews/${reviewId}/facts`,{method:'POST',body:'{}'}); },
  decideEvidenceSourceFact(factId,decision,note='') { return request(`/api/evidence-source-facts/${factId}/${decision}`,{method:'POST',body:JSON.stringify({reviewer:'current_user',note})}); },
  proposeRequirementFactMapping(projectId,input) { return request(`/api/projects/${projectId}/requirement-evidence-fact-mappings`,{method:'POST',body:JSON.stringify(input)}); },
  decideRequirementFactMapping(mappingId,decision,note='') { return request(`/api/requirement-evidence-fact-mappings/${mappingId}/${decision}`,{method:'POST',body:JSON.stringify({reviewer:'current_user',note})}); },
  getProjectFactImpact(projectId,factId) { return request(`/api/projects/${projectId}/project-facts/${factId}/impact`); },
  decideProjectFact(factId,decision,note='') { return request(`/api/project-facts/${factId}/${decision}`,{method:'POST',body:JSON.stringify({reviewer:'current_user',note})}); },
  editProjectFact(factId,fact,note) { return request(`/api/project-facts/${factId}/edit`,{method:'POST',body:JSON.stringify({editor:'current_user',note,fact})}); },
  decideClaim(claimId, decision, decidedBy='current_user') { return request(`/api/claims/${claimId}/${decision}`, { method:'POST', body:JSON.stringify({decided_by:decidedBy}) }); },
  createDocumentGeneration(projectId){return request(`/api/projects/${projectId}/document-generations`,{method:'POST',body:'{}'});},
  getDocumentGeneration(id){return request(`/api/document-generations/${id}`);},
  retryDocumentBatches(id){return request(`/api/document-generations/${id}/retry-batches`,{method:'POST',body:'{}'});},
  listDocumentVersions(projectId){return request(`/api/projects/${projectId}/document-versions`);},
  getDocumentVersion(id){return request(`/api/document-versions/${id}`);},
  confirmDocumentVersion(id,text=''){return request(`/api/document-versions/${id}/confirm`,{method:'POST',body:JSON.stringify({confirmation_text:text})});},
  regenerateChapter(id,chapterId){return request(`/api/document-versions/${id}/chapters/${chapterId}/regenerate`,{method:'POST',body:'{}'});},
  generate(projectId, inputs) {
    return request(`/api/projects/${projectId}/generation-jobs`, { method: 'POST', body: JSON.stringify(inputs) });
  },
  confirmVersion(versionId, confirmationText) {
    return request(`/api/document-versions/${versionId}/review-decisions`, {
      method: 'POST', body: JSON.stringify({ decision: 'confirmed', confirmation_text: confirmationText })
    });
  },
  downloadWord,
  generateBid(inputs) {
    return request('/api/generate-bid', { method: 'POST', body: JSON.stringify(inputs) });
  }
};

export const generateBid = api.generateBid;
