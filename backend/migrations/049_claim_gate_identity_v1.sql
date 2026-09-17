-- Claim/Gate identity is persisted separately from the legacy decision
-- projection. Existing rows remain fail-closed until a fresh evaluation writes
-- complete identity fields.
ALTER TABLE claims
  ADD COLUMN IF NOT EXISTS claim_assertion_hash text;

ALTER TABLE claim_gate_evaluations
  ADD COLUMN IF NOT EXISTS claim_assertion_hash text,
  ADD COLUMN IF NOT EXISTS gate_result_id text,
  ADD COLUMN IF NOT EXISTS input_snapshot_hash text,
  ADD COLUMN IF NOT EXISTS source_hashes jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS lineage_current boolean NOT NULL DEFAULT false;

ALTER TABLE claim_decisions DROP CONSTRAINT IF EXISTS claim_decisions_gate_decision_check;
ALTER TABLE claim_decisions ADD CONSTRAINT claim_decisions_gate_decision_check
  CHECK(gate_decision IS NULL OR gate_decision IN ('approved','rejected','allow','restrict','needs_review'));

ALTER TABLE claim_gate_evaluations DROP CONSTRAINT IF EXISTS claim_gate_evaluations_identity_shape_check;
ALTER TABLE claim_gate_evaluations ADD CONSTRAINT claim_gate_evaluations_identity_shape_check CHECK(
  (claim_assertion_hash IS NULL OR claim_assertion_hash ~ '^[0-9a-f]{64}$') AND
  (input_snapshot_hash IS NULL OR input_snapshot_hash ~ '^[0-9a-f]{64}$') AND
  jsonb_typeof(source_hashes)='array'
);

CREATE INDEX IF NOT EXISTS claim_gate_evaluations_gate_result_idx
  ON claim_gate_evaluations(gate_result_id);
