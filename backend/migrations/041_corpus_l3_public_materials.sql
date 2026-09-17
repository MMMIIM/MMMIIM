-- Corpus L3 public material metadata. Public material still uses the existing
-- company_materials -> material_chunks -> material_chunk_embeddings path.
INSERT INTO projects(id, name, status)
VALUES ('00000000-0000-4000-8000-000000000001', '平台公共知识库（官方公开资料）', 'corpus')
ON CONFLICT(id) DO NOTHING;

ALTER TABLE company_materials
  ADD COLUMN IF NOT EXISTS corpus_scope text NOT NULL DEFAULT 'ENTERPRISE_PRIVATE',
  ADD COLUMN IF NOT EXISTS industry text,
  ADD COLUMN IF NOT EXISTS source_org text,
  ADD COLUMN IF NOT EXISTS source_url text,
  ADD COLUMN IF NOT EXISTS source_type text,
  ADD COLUMN IF NOT EXISTS document_number text,
  ADD COLUMN IF NOT EXISTS published_at date,
  ADD COLUMN IF NOT EXISTS effective_from date,
  ADD COLUMN IF NOT EXISTS effective_to date,
  ADD COLUMN IF NOT EXISTS effective_status text NOT NULL DEFAULT 'current_status_required',
  ADD COLUMN IF NOT EXISTS source_version text,
  ADD COLUMN IF NOT EXISTS supersedes text,
  ADD COLUMN IF NOT EXISTS superseded_by text,
  ADD COLUMN IF NOT EXISTS authority_level text NOT NULL DEFAULT 'enterprise_private',
  ADD COLUMN IF NOT EXISTS usage_status text NOT NULL DEFAULT 'ACTIVE_FULLTEXT',
  ADD COLUMN IF NOT EXISTS quality_score integer NOT NULL DEFAULT 80,
  ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS lifecycle_status text NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS index_status text NOT NULL DEFAULT 'NOT_INDEXED',
  ADD COLUMN IF NOT EXISTS review_notes text,
  ADD COLUMN IF NOT EXISTS synthetic_test_material boolean NOT NULL DEFAULT false;

ALTER TABLE company_materials DROP CONSTRAINT IF EXISTS company_materials_corpus_scope_check;
ALTER TABLE company_materials ADD CONSTRAINT company_materials_corpus_scope_check
  CHECK (corpus_scope IN ('GENERAL','GOVERNMENT_ENTERPRISE','HEALTHCARE','ENTERPRISE_PRIVATE'));
ALTER TABLE company_materials DROP CONSTRAINT IF EXISTS company_materials_effective_status_check;
ALTER TABLE company_materials ADD CONSTRAINT company_materials_effective_status_check
  CHECK (effective_status IN ('current','expired','revoked','amended','superseded','draft','current_status_required'));
ALTER TABLE company_materials DROP CONSTRAINT IF EXISTS company_materials_usage_status_check;
ALTER TABLE company_materials ADD CONSTRAINT company_materials_usage_status_check
  CHECK (usage_status IN ('ACTIVE_FULLTEXT','ACTIVE_EXCERPT','METADATA_ONLY','REFERENCE_ONLY','REJECTED','PENDING_REVIEW'));
ALTER TABLE company_materials DROP CONSTRAINT IF EXISTS company_materials_review_status_check;
ALTER TABLE company_materials ADD CONSTRAINT company_materials_review_status_check
  CHECK (review_status IN ('pending','approved','rejected'));
ALTER TABLE company_materials DROP CONSTRAINT IF EXISTS company_materials_lifecycle_status_check;
ALTER TABLE company_materials ADD CONSTRAINT company_materials_lifecycle_status_check
  CHECK (lifecycle_status IN ('DISCOVERED','SCREENED','APPROVED_FOR_PROCESSING','PROCESSED','EVAL_PASSED','ACTIVE','QUARANTINED'));
ALTER TABLE company_materials DROP CONSTRAINT IF EXISTS company_materials_index_status_check;
ALTER TABLE company_materials ADD CONSTRAINT company_materials_index_status_check
  CHECK (index_status IN ('NOT_INDEXED','INDEXED','FAILED'));
ALTER TABLE company_materials DROP CONSTRAINT IF EXISTS company_materials_quality_score_check;
ALTER TABLE company_materials ADD CONSTRAINT company_materials_quality_score_check
  CHECK (quality_score >= 0 AND quality_score <= 100);

CREATE INDEX IF NOT EXISTS company_materials_corpus_active_idx
  ON company_materials(corpus_scope, industry, lifecycle_status, usage_status, index_status, created_at DESC);
