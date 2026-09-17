ALTER TABLE document_generations
  ADD COLUMN IF NOT EXISTS input_snapshot_hash text,
  ADD COLUMN IF NOT EXISTS generation_type text NOT NULL DEFAULT 'writer-v1';

CREATE INDEX IF NOT EXISTS document_generations_identity_lookup_idx
  ON document_generations(project_id, generation_type, input_snapshot_hash);

CREATE UNIQUE INDEX IF NOT EXISTS document_generations_active_identity_idx
  ON document_generations(project_id, generation_type, input_snapshot_hash)
  WHERE input_snapshot_hash IS NOT NULL AND status <> 'failed';
