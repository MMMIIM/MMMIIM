-- Mapping Producer V1.1 keeps the existing table and lifecycle intact while
-- making the approved transport/canonical contract identity explicit.
ALTER TABLE requirement_evidence_fact_mappings
  DROP CONSTRAINT IF EXISTS requirement_evidence_fact_mapping_contract;

UPDATE requirement_evidence_fact_mappings
SET contract_version = 'requirement-evidence-mapping-v1.1'
WHERE contract_version = 'requirement-evidence-mapping-v1';

ALTER TABLE requirement_evidence_fact_mappings
  ADD CONSTRAINT requirement_evidence_fact_mapping_contract
  CHECK (contract_version = 'requirement-evidence-mapping-v1.1');
