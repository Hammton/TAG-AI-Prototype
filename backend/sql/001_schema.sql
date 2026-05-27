-- TAG Vehicle Config Agent — Supabase Postgres schema

CREATE TABLE IF NOT EXISTS account_managers (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  territory  TEXT,
  email      TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS clients (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  organisation  TEXT,
  country       TEXT,
  contact_email TEXT,
  am_id         TEXT REFERENCES account_managers(id),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vehicle_models (
  id             TEXT PRIMARY KEY,
  model_code     TEXT NOT NULL UNIQUE,
  type           TEXT NOT NULL,
  base_price_usd INTEGER NOT NULL,
  lead_time_days INTEGER NOT NULL,
  image_url      TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE vehicle_models ADD COLUMN IF NOT EXISTS image_url TEXT;

CREATE TABLE IF NOT EXISTS configuration_options (
  id                TEXT PRIMARY KEY,
  vehicle_model_id  TEXT REFERENCES vehicle_models(id),
  category          TEXT NOT NULL,
  option_name       TEXT NOT NULL,
  add_on_price_usd  INTEGER NOT NULL DEFAULT 0,
  incompatible_with TEXT[] DEFAULT '{}',
  requires          TEXT[] DEFAULT '{}',
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
  id               TEXT PRIMARY KEY,
  client_id        TEXT REFERENCES clients(id),
  am_id            TEXT REFERENCES account_managers(id),
  vehicle_model_id TEXT REFERENCES vehicle_models(id),
  qty              INTEGER NOT NULL,
  status           TEXT NOT NULL DEFAULT 'Draft',
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_configurations (
  order_id  TEXT REFERENCES orders(id) ON DELETE CASCADE,
  option_id TEXT REFERENCES configuration_options(id),
  PRIMARY KEY (order_id, option_id)
);

CREATE TABLE IF NOT EXISTS order_custom_requirements (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id       TEXT REFERENCES orders(id) ON DELETE CASCADE,
  delivery       TEXT,
  compliance     TEXT,
  notes          TEXT,
  files_attached TEXT[] DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS order_specs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     TEXT REFERENCES orders(id) ON DELETE CASCADE UNIQUE,
  spec_json    JSONB NOT NULL,
  version      INTEGER NOT NULL DEFAULT 1,
  generated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_quotes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id       TEXT REFERENCES orders(id) ON DELETE CASCADE UNIQUE,
  quote_json     JSONB NOT NULL,
  unit_price_usd INTEGER,
  total_usd      INTEGER,
  version        INTEGER NOT NULL DEFAULT 1,
  generated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cad_metadata (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_model_id      TEXT REFERENCES vehicle_models(id),
  model_code            TEXT,
  bom_reference         TEXT,
  drawing_set_reference TEXT,
  weight_kg             NUMERIC,
  length_mm             NUMERIC,
  width_mm              NUMERIC,
  height_mm             NUMERIC,
  assemblies            JSONB,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS document_chunks (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_model_id TEXT,
  chunk_text       TEXT NOT NULL,
  chunk_index      INTEGER,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_client_vehicle ON orders(client_id, vehicle_model_id);
CREATE INDEX IF NOT EXISTS idx_config_options_vehicle ON configuration_options(vehicle_model_id);
