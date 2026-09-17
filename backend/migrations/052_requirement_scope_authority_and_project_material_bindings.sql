-- V43 bounded authority-loop closure. Apply only to isolated Eval/test databases.
CREATE TABLE IF NOT EXISTS requirement_scope_authority_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  candidate_identity text NOT NULL,
  source_chunk_id text NOT NULL,
  source_hash text NOT NULL,
  source_page_start integer NOT NULL CHECK (source_page_start > 0),
  source_page_end integer NOT NULL CHECK (source_page_end >= source_page_start),
  decision text NOT NULL CHECK (decision IN ('IN_SCOPE', 'OUT_OF_SCOPE')),
  reason_codes jsonb NOT NULL DEFAULT '[]'::jsonb,
  authority_type text NOT NULL DEFAULT 'HUMAN' CHECK (authority_type = 'HUMAN'),
  authority_reference text NOT NULL DEFAULT 'explicit_user_confirmation',
  decision_source text NOT NULL DEFAULT 'REAL_E2E_CASE_01',
  confirmed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, candidate_identity)
);

CREATE INDEX IF NOT EXISTS requirement_scope_authority_project_idx
  ON requirement_scope_authority_decisions(project_id, candidate_identity);

CREATE TABLE IF NOT EXISTS project_material_bindings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  material_id uuid NOT NULL REFERENCES company_materials(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'REMOVED')),
  binding_source text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  removed_at timestamptz,
  UNIQUE (project_id, material_id),
  CHECK ((status = 'ACTIVE' AND removed_at IS NULL) OR (status = 'REMOVED'))
);

CREATE INDEX IF NOT EXISTS project_material_bindings_material_idx
  ON project_material_bindings(material_id, status);
