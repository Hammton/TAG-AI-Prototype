-- Drop legacy TAG vehicle config tables (superseded by procurement schema)
DROP TABLE IF EXISTS order_quotes CASCADE;
DROP TABLE IF EXISTS order_specs CASCADE;
DROP TABLE IF EXISTS order_custom_requirements CASCADE;
DROP TABLE IF EXISTS order_configurations CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS configuration_options CASCADE;
DROP TABLE IF EXISTS cad_metadata CASCADE;
DROP TABLE IF EXISTS document_chunks CASCADE;
DROP TABLE IF EXISTS vehicle_models CASCADE;
DROP TABLE IF EXISTS clients CASCADE;
DROP TABLE IF EXISTS account_managers CASCADE;
