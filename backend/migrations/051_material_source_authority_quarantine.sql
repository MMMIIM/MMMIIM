-- Material Source Authority Quarantine v1.
-- Historical rows/chunks/evidence remain readable; QUARANTINED is a single
-- non-authoritative material lifecycle state consumed by central policy.
ALTER TABLE company_materials
  ADD COLUMN IF NOT EXISTS quarantine_reason text,
  ADD COLUMN IF NOT EXISTS quarantined_at timestamptz;

ALTER TABLE company_materials
  DROP CONSTRAINT IF EXISTS company_materials_lifecycle_status_check;

ALTER TABLE company_materials
  ADD CONSTRAINT company_materials_lifecycle_status_check
  CHECK (lifecycle_status IN (
    'DISCOVERED','SCREENED','APPROVED_FOR_PROCESSING','PROCESSED',
    'EVAL_PASSED','ACTIVE','QUARANTINED'
  ));

ALTER TABLE company_materials
  DROP CONSTRAINT IF EXISTS company_materials_quarantine_state_check;

ALTER TABLE company_materials
  ADD CONSTRAINT company_materials_quarantine_state_check
  CHECK ((lifecycle_status = 'QUARANTINED' AND quarantined_at IS NOT NULL)
      OR lifecycle_status <> 'QUARANTINED');

CREATE INDEX IF NOT EXISTS company_materials_authority_lookup_idx
  ON company_materials(project_id, lifecycle_status, review_status, usage_status, extraction_status);
