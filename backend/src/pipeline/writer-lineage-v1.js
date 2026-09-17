import { buildWriterTask, validateWriterOutput } from './writer-execution-contract-v1.js';

export const WRITER_LINEAGE_VERSION = 'writer-requirement-lineage-v1';

export function buildWriterTaskWithLineage(input = {}) {
  const covered_requirement_ids = [...new Set((input.coveredRequirementIds || input.requirements || []).map((item) => String(item?.requirement_id ?? item?.req_id ?? item)).filter(Boolean))].sort();
  const task = buildWriterTask(input);
  return { ...task, response_unit_id: input.responseUnitId ?? null, covered_requirement_ids, lineage_contract_version: WRITER_LINEAGE_VERSION };
}

export function validateWriterOutputWithLineage(task, input, options = {}) {
  const output = validateWriterOutput(task, input, options);
  return { ...output, response_unit_id: task.response_unit_id ?? null, covered_requirement_ids: [...(task.covered_requirement_ids || [])], lineage_contract_version: WRITER_LINEAGE_VERSION };
}
