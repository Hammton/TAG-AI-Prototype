-- TAG Procurement schema (from TAG_Procurement_ERD-1)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Reference / catalogue
CREATE TABLE vehicle_class (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code              TEXT NOT NULL UNIQUE,
  label             TEXT NOT NULL,
  spec_template     JSONB NOT NULL DEFAULT '{}'::jsonb,
  stage1_questions  JSONB NOT NULL DEFAULT '[]'::jsonb,
  stage3_sections   JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE protection_standard (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            TEXT NOT NULL UNIQUE,
  framework       TEXT NOT NULL,
  threat_type     TEXT NOT NULL,
  test_procedure  JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE vehicle_model (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_code       TEXT UNIQUE,
  class_id          UUID NOT NULL REFERENCES vehicle_class(id),
  name              TEXT NOT NULL,
  oem_platform      TEXT,
  drive_config      TEXT,
  base_weight_kg    NUMERIC,
  max_payload_kg    NUMERIC,
  stanag_base_level TEXT,
  base_specs        JSONB NOT NULL DEFAULT '{}'::jsonb,
  active            BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE vehicle_model_spec (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id        UUID NOT NULL REFERENCES vehicle_model(id) ON DELETE CASCADE,
  param_code      TEXT NOT NULL,
  value_text      TEXT,
  value_numeric   NUMERIC,
  value_unit      TEXT,
  operator        TEXT NOT NULL DEFAULT 'EQ',
  source          TEXT,
  standard_ref    TEXT,
  confirmed       BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (model_id, param_code)
);

CREATE TABLE vehicle_option (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_code       TEXT UNIQUE,
  vehicle_model_id  UUID NOT NULL REFERENCES vehicle_model(id) ON DELETE CASCADE,
  category          TEXT NOT NULL,
  option_name       TEXT NOT NULL,
  add_on_price_usd  INTEGER NOT NULL DEFAULT 0,
  incompatible_with TEXT[] NOT NULL DEFAULT '{}',
  requires          TEXT[] NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE document_chunks (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_model_id UUID NOT NULL REFERENCES vehicle_model(id) ON DELETE CASCADE,
  chunk_text       TEXT NOT NULL,
  chunk_index      INTEGER,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Parties
CREATE TABLE organisation (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_code      TEXT UNIQUE,
  name             TEXT NOT NULL,
  type             TEXT NOT NULL,
  country          TEXT,
  contact_details  JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE contact (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organisation(id) ON DELETE CASCADE,
  first_name  TEXT NOT NULL,
  last_name   TEXT NOT NULL,
  title       TEXT,
  role        TEXT,
  email       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE app_user (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_code TEXT UNIQUE,
  name        TEXT NOT NULL,
  email       TEXT UNIQUE,
  role        TEXT NOT NULL,
  org_id      UUID REFERENCES organisation(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Stage 1
CREATE TABLE engagement (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference           TEXT NOT NULL UNIQUE,
  customer_org_id     UUID NOT NULL REFERENCES organisation(id),
  customer_contact_id UUID REFERENCES contact(id),
  account_manager_id  UUID REFERENCES app_user(id),
  vehicle_class_id    UUID REFERENCES vehicle_class(id),
  status              TEXT NOT NULL DEFAULT 'DRAFT',
  engagement_date     DATE,
  country_of_use      TEXT,
  theatre             TEXT,
  am_notes            TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE requirement (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id  UUID NOT NULL REFERENCES engagement(id) ON DELETE CASCADE,
  section        TEXT NOT NULL,
  parameter      TEXT NOT NULL,
  value_text     TEXT,
  value_code     TEXT,
  priority       TEXT NOT NULL DEFAULT 'MANDATORY',
  confirmed      BOOLEAN NOT NULL DEFAULT FALSE,
  source         TEXT NOT NULL DEFAULT 'CUSTOMER',
  created_by     UUID REFERENCES app_user(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE action_item (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id  UUID NOT NULL REFERENCES engagement(id) ON DELETE CASCADE,
  description    TEXT NOT NULL,
  owner_id       UUID REFERENCES app_user(id),
  due_date       DATE,
  status         TEXT NOT NULL DEFAULT 'OPEN'
);

CREATE TABLE engagement_signature (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id  UUID NOT NULL REFERENCES engagement(id) ON DELETE CASCADE,
  contact_id     UUID REFERENCES contact(id),
  role           TEXT NOT NULL,
  signed_at      TIMESTAMPTZ,
  signature_ref  TEXT
);

-- Stage 2
CREATE TABLE sales_order (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_code       TEXT UNIQUE,
  reference         TEXT NOT NULL UNIQUE,
  engagement_id     UUID REFERENCES engagement(id),
  customer_org_id   UUID NOT NULL REFERENCES organisation(id),
  account_manager_id UUID REFERENCES app_user(id),
  vehicle_class_id  UUID REFERENCES vehicle_class(id),
  status            TEXT NOT NULL DEFAULT 'DRAFT',
  contract_type     TEXT,
  incoterms         TEXT,
  total_value_usd   NUMERIC,
  payment_schedule  JSONB NOT NULL DEFAULT '[]'::jsonb,
  commercial_terms  JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE order_batch (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id                 UUID NOT NULL REFERENCES sales_order(id) ON DELETE CASCADE,
  batch_number             INTEGER NOT NULL,
  batch_type               TEXT NOT NULL,
  quantity                 INTEGER NOT NULL,
  vehicle_model_id         UUID REFERENCES vehicle_model(id),
  configuration            TEXT,
  delivery_target          DATE,
  option_exercise_deadline DATE,
  status                   TEXT NOT NULL DEFAULT 'FIRM',
  UNIQUE (order_id, batch_number)
);

CREATE TABLE line_item (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID NOT NULL REFERENCES sales_order(id) ON DELETE CASCADE,
  batch_id        UUID REFERENCES order_batch(id) ON DELETE SET NULL,
  line_number     INTEGER NOT NULL,
  description     TEXT NOT NULL,
  category        TEXT NOT NULL,
  quantity        INTEGER NOT NULL DEFAULT 1,
  unit_price_usd  NUMERIC,
  total_price_usd NUMERIC,
  status          TEXT NOT NULL DEFAULT 'MANDATORY',
  UNIQUE (order_id, line_number)
);

CREATE TABLE order_risk (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    UUID NOT NULL REFERENCES sales_order(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  likelihood  TEXT,
  impact      TEXT,
  mitigation  TEXT,
  owner_id    UUID REFERENCES app_user(id),
  status      TEXT NOT NULL DEFAULT 'OPEN'
);

CREATE TABLE order_approval (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    UUID NOT NULL REFERENCES sales_order(id) ON DELETE CASCADE,
  approver_id UUID REFERENCES app_user(id),
  role        TEXT NOT NULL,
  decision    TEXT NOT NULL DEFAULT 'PENDING',
  comments    TEXT,
  decided_at  TIMESTAMPTZ
);

-- Stage 3
CREATE TABLE specification (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_number    TEXT NOT NULL,
  revision           INTEGER NOT NULL DEFAULT 1,
  order_id           UUID NOT NULL REFERENCES sales_order(id) ON DELETE CASCADE,
  vehicle_model_id   UUID REFERENCES vehicle_model(id),
  vehicle_class_id   UUID REFERENCES vehicle_class(id),
  status             TEXT NOT NULL DEFAULT 'DRAFT',
  classification     TEXT,
  authored_by        UUID REFERENCES app_user(id),
  chief_engineer_id  UUID REFERENCES app_user(id),
  issued_at          TIMESTAMPTZ,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE spec_section (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spec_id         UUID NOT NULL REFERENCES specification(id) ON DELETE CASCADE,
  section_code    TEXT NOT NULL,
  section_title   TEXT NOT NULL,
  depth           TEXT NOT NULL,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  narrative       TEXT,
  requirements    JSONB NOT NULL DEFAULT '[]'::jsonb,
  tables          JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_edited_by  UUID REFERENCES app_user(id),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE spec_requirement (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spec_id                 UUID NOT NULL REFERENCES specification(id) ON DELETE CASCADE,
  section_id              UUID REFERENCES spec_section(id) ON DELETE SET NULL,
  source_requirement_id   UUID REFERENCES requirement(id),
  req_id                  TEXT,
  parameter               TEXT NOT NULL,
  requirement_text        TEXT NOT NULL,
  tolerance               TEXT,
  verification_method     TEXT,
  standard_ref            TEXT,
  protection_standard_id  UUID REFERENCES protection_standard(id),
  mandatory               BOOLEAN NOT NULL DEFAULT TRUE,
  status                  TEXT NOT NULL DEFAULT 'DRAFT',
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE deviation (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spec_id         UUID NOT NULL REFERENCES specification(id) ON DELETE CASCADE,
  requirement_id  UUID REFERENCES spec_requirement(id) ON DELETE CASCADE,
  type            TEXT NOT NULL,
  description     TEXT,
  justification   TEXT,
  status          TEXT NOT NULL DEFAULT 'REQUESTED',
  raised_by       UUID REFERENCES app_user(id),
  approved_by     UUID REFERENCES app_user(id),
  raised_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at      TIMESTAMPTZ
);

CREATE TABLE spec_approval (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spec_id     UUID NOT NULL REFERENCES specification(id) ON DELETE CASCADE,
  approver_id UUID REFERENCES app_user(id),
  role        TEXT NOT NULL,
  decision    TEXT NOT NULL DEFAULT 'PENDING',
  comments    TEXT,
  decided_at  TIMESTAMPTZ
);

CREATE TABLE weight_budget (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spec_id               UUID NOT NULL REFERENCES specification(id) ON DELETE CASCADE UNIQUE,
  max_combat_weight_kg  NUMERIC,
  growth_reserve_kg     NUMERIC,
  growth_reserve_pct    NUMERIC,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE weight_budget_line (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id     UUID NOT NULL REFERENCES weight_budget(id) ON DELETE CASCADE,
  system        TEXT NOT NULL,
  estimated_kg  NUMERIC,
  allocated_kg  NUMERIC,
  status        TEXT,
  notes         TEXT
);

CREATE TABLE test_plan (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spec_id             UUID NOT NULL REFERENCES specification(id) ON DELETE CASCADE,
  phase               TEXT NOT NULL,
  authority           TEXT,
  status              TEXT NOT NULL DEFAULT 'PLANNED',
  planned_date        DATE,
  actual_date         DATE,
  witness_contact_id  UUID REFERENCES contact(id),
  result_summary      TEXT,
  result_data         JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE test_req_link (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_plan_id    UUID NOT NULL REFERENCES test_plan(id) ON DELETE CASCADE,
  requirement_id  UUID NOT NULL REFERENCES spec_requirement(id) ON DELETE CASCADE
);

-- Recommendation engine
CREATE TABLE recommendation (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id         UUID NOT NULL REFERENCES engagement(id) ON DELETE CASCADE,
  agent_session_id      UUID,
  status                TEXT NOT NULL DEFAULT 'DRAFT',
  strategy              TEXT,
  requirements_total    INTEGER,
  requirements_met      INTEGER,
  requirements_partial  INTEGER,
  requirements_unmet    INTEGER,
  match_score           REAL,
  agent_rationale       TEXT,
  generated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  presented_at          TIMESTAMPTZ
);

CREATE TABLE recommendation_candidate (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_id   UUID NOT NULL REFERENCES recommendation(id) ON DELETE CASCADE,
  vehicle_model_id    UUID NOT NULL REFERENCES vehicle_model(id),
  rank                INTEGER NOT NULL,
  match_score         REAL,
  match_tier          TEXT,
  matched_mandatory   INTEGER,
  total_mandatory     INTEGER,
  matched_desired     INTEGER,
  total_desired       INTEGER,
  gaps                JSONB NOT NULL DEFAULT '[]'::jsonb,
  overages            JSONB NOT NULL DEFAULT '[]'::jsonb,
  summary             TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE requirement_match (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id     UUID NOT NULL REFERENCES recommendation_candidate(id) ON DELETE CASCADE,
  requirement_id   UUID NOT NULL REFERENCES requirement(id) ON DELETE CASCADE,
  model_spec_id    UUID REFERENCES vehicle_model_spec(id),
  result           TEXT NOT NULL,
  match_type       TEXT,
  required_value   NUMERIC,
  actual_value     NUMERIC,
  gap_direction    TEXT,
  gap_magnitude    NUMERIC,
  gap_severity     TEXT,
  notes            TEXT
);

CREATE TABLE customisation_option (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id         UUID NOT NULL REFERENCES recommendation_candidate(id) ON DELETE CASCADE,
  requirement_id       UUID REFERENCES requirement(id),
  type                 TEXT NOT NULL,
  description          TEXT,
  estimated_cost_usd   NUMERIC,
  lead_time_weeks_delta INTEGER,
  weight_delta_kg      NUMERIC,
  feasibility          TEXT,
  notes                TEXT
);

-- Agent runtime
CREATE TABLE agent_session (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stage             TEXT NOT NULL,
  agent_role        TEXT NOT NULL,
  engagement_id     UUID REFERENCES engagement(id),
  order_id          UUID REFERENCES sales_order(id),
  spec_id           UUID REFERENCES specification(id),
  user_id           UUID REFERENCES app_user(id),
  status            TEXT NOT NULL DEFAULT 'ACTIVE',
  context_snapshot  JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at          TIMESTAMPTZ
);

CREATE TABLE agent_message (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID NOT NULL REFERENCES agent_session(id) ON DELETE CASCADE,
  role            TEXT NOT NULL,
  content         TEXT NOT NULL,
  tool_calls      JSONB,
  tool_results    JSONB,
  extracted_data  JSONB,
  turn_index      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE agent_extraction (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       UUID NOT NULL REFERENCES agent_session(id) ON DELETE CASCADE,
  message_id       UUID REFERENCES agent_message(id) ON DELETE SET NULL,
  entity_type      TEXT NOT NULL,
  target_record_id UUID,
  target_table     TEXT,
  confidence       REAL,
  status           TEXT NOT NULL DEFAULT 'DRAFT',
  confirmed_by     UUID REFERENCES app_user(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE agent_handoff (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_session_id  UUID NOT NULL REFERENCES agent_session(id) ON DELETE CASCADE,
  to_session_id    UUID REFERENCES agent_session(id),
  from_stage       TEXT NOT NULL,
  to_stage         TEXT NOT NULL,
  handoff_payload  JSONB NOT NULL DEFAULT '{}'::jsonb,
  status           TEXT NOT NULL DEFAULT 'PENDING',
  triggered_by     UUID REFERENCES app_user(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE recommendation
  ADD CONSTRAINT recommendation_agent_session_fk
  FOREIGN KEY (agent_session_id) REFERENCES agent_session(id) ON DELETE SET NULL;

-- Documents & audit
CREATE TABLE document (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type  TEXT NOT NULL,
  entity_id    UUID NOT NULL,
  doc_type     TEXT NOT NULL,
  filename     TEXT NOT NULL,
  storage_ref  TEXT,
  version      INTEGER NOT NULL DEFAULT 1,
  uploaded_by  UUID REFERENCES app_user(id),
  uploaded_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE audit_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type  TEXT NOT NULL,
  entity_id    UUID NOT NULL,
  action       TEXT NOT NULL,
  actor_id     UUID REFERENCES app_user(id),
  actor_type   TEXT NOT NULL,
  before_state JSONB,
  after_state  JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes (FKs and legacy_code)
CREATE INDEX idx_vehicle_model_class_id ON vehicle_model(class_id);
CREATE INDEX idx_vehicle_model_legacy_code ON vehicle_model(legacy_code);
CREATE INDEX idx_vehicle_model_spec_model_id ON vehicle_model_spec(model_id);
CREATE INDEX idx_vehicle_option_vehicle_model_id ON vehicle_option(vehicle_model_id);
CREATE INDEX idx_vehicle_option_legacy_code ON vehicle_option(legacy_code);
CREATE INDEX idx_document_chunks_vehicle_model_id ON document_chunks(vehicle_model_id);
CREATE INDEX idx_organisation_legacy_code ON organisation(legacy_code);
CREATE INDEX idx_app_user_legacy_code ON app_user(legacy_code);
CREATE INDEX idx_app_user_org_id ON app_user(org_id);
CREATE INDEX idx_contact_org_id ON contact(org_id);
CREATE INDEX idx_engagement_customer_org_id ON engagement(customer_org_id);
CREATE INDEX idx_engagement_account_manager_id ON engagement(account_manager_id);
CREATE INDEX idx_engagement_vehicle_class_id ON engagement(vehicle_class_id);
CREATE INDEX idx_requirement_engagement_id ON requirement(engagement_id);
CREATE INDEX idx_action_item_engagement_id ON action_item(engagement_id);
CREATE INDEX idx_sales_order_legacy_code ON sales_order(legacy_code);
CREATE INDEX idx_sales_order_engagement_id ON sales_order(engagement_id);
CREATE INDEX idx_sales_order_customer_org_id ON sales_order(customer_org_id);
CREATE INDEX idx_order_batch_order_id ON order_batch(order_id);
CREATE INDEX idx_order_batch_vehicle_model_id ON order_batch(vehicle_model_id);
CREATE INDEX idx_line_item_order_id ON line_item(order_id);
CREATE INDEX idx_line_item_batch_id ON line_item(batch_id);
CREATE INDEX idx_order_risk_order_id ON order_risk(order_id);
CREATE INDEX idx_order_approval_order_id ON order_approval(order_id);
CREATE INDEX idx_specification_order_id ON specification(order_id);
CREATE INDEX idx_spec_section_spec_id ON spec_section(spec_id);
CREATE INDEX idx_spec_requirement_spec_id ON spec_requirement(spec_id);
CREATE INDEX idx_deviation_spec_id ON deviation(spec_id);
CREATE INDEX idx_spec_approval_spec_id ON spec_approval(spec_id);
CREATE INDEX idx_weight_budget_line_budget_id ON weight_budget_line(budget_id);
CREATE INDEX idx_test_plan_spec_id ON test_plan(spec_id);
CREATE INDEX idx_test_req_link_test_plan_id ON test_req_link(test_plan_id);
CREATE INDEX idx_recommendation_engagement_id ON recommendation(engagement_id);
CREATE INDEX idx_recommendation_candidate_recommendation_id ON recommendation_candidate(recommendation_id);
CREATE INDEX idx_requirement_match_candidate_id ON requirement_match(candidate_id);
CREATE INDEX idx_agent_session_engagement_id ON agent_session(engagement_id);
CREATE INDEX idx_agent_session_order_id ON agent_session(order_id);
CREATE INDEX idx_agent_message_session_id ON agent_message(session_id);
CREATE INDEX idx_agent_extraction_session_id ON agent_extraction(session_id);
CREATE INDEX idx_document_entity ON document(entity_type, entity_id);
CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id);
