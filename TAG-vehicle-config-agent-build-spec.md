# TAG Vehicle Configuration Agent — Build Specification

**Version:** 0.1 — Draft
**Stage:** Pre-build
**Owner:** DQ — Sharavi
**Last Updated:** 2026-05-25

---

## 1. Overview

### Purpose
An AI agent embedded in TAG's Vehicle Configurator platform. The agent performs four discrete generation tasks across the order workflow:

| Task | Trigger | Output |
|---|---|---|
| **Recommend** | Client + vehicle type selected | Ranked list of matching past orders as starting configuration |
| **Spec Generation** | Configuration confirmed | Structured vehicle specification document |
| **Quote Generation** | Spec confirmed | Line-item commercial quote |
| **Engineering Output** | Order approved by client | Structured engineering requirements document for design handover |

### Design Principles
- One agent, four scoped capability modes — not four separate agents in v1
- Each agent call is stateless per request; conversational state is managed by the application layer
- All outputs are structured JSON — rendered by the UI, not free-text blobs
- Data reads are from Supabase (synchronised from source systems); the agent does not query Odoo or CAD systems in real time
- IP protection: no client data or CAD assets leave the Supabase + Anthropic API boundary

---

## 2. Architecture Recommendation

### LLM: Claude Sonnet 4.5 (claude-sonnet-4-5)
**Why:**
- Native tool use (function calling) — clean separation between reasoning and data retrieval
- Structured JSON output via tool results — no regex parsing of free text
- Long context window — can ingest full configuration tables, past order history, and PDF extracts in a single call
- Anthropic API hosted in region — satisfies IP containment requirement

**Not LangGraph:** Deployment target is Supabase Edge Functions (Deno/TypeScript). LangGraph is Python-only. The workflow is linear (7 wizard steps), not a branching graph. LangGraph adds complexity without value at this stage. Revisit at v2 if multi-agent orchestration is needed.

**Not OpenAI:** TAG is an Anthropic API customer via DQ; no additional vendor relationship required.

### Framework: Claude Tool Use — Direct Anthropic TypeScript SDK
```
UI (React/Lovable)
    │
    ▼  HTTPS
Supabase Edge Functions (Deno/TypeScript)
    │  Anthropic TS SDK
    ▼
Claude API (claude-sonnet-4-5)
    │  tool_use blocks
    ▼
Tool Executors (in Edge Function)
    │
    ├── Supabase PostgreSQL  (orders, catalogue, clients, config options)
    ├── Supabase Storage     (uploaded files — Excel, PDF, CAD metadata)
    └── Parsed data tables   (ingested from Odoo sync, Excel upload, PDF extract, CAD metadata)
```

### Deployment: Supabase Edge Functions + Lovable
- Frontend (React/Vite): Lovable → deployed on Vercel
- Agent runtime: Supabase Edge Functions (Deno) — co-located with the database
- Storage: Supabase Storage buckets (uploads) + pgvector (PDF embeddings, v2)
- Secrets: Anthropic API key stored as Supabase Edge Function secret

---

## 3. Agent Design

### 3.1 Agent Capability Modes

The agent operates in one of four modes per call, set by the `mode` field in the request payload.

| Mode | Function | Tools Invoked |
|---|---|---|
| `recommend` | Surface past orders matching client + vehicle type | `search_past_orders`, `get_vehicle_model` |
| `generate_spec` | Generate structured vehicle spec from configuration | `get_vehicle_model`, `get_configuration_options`, `get_custom_requirements`, `search_build_context` |
| `generate_quote` | Generate line-item quote from confirmed configuration | `calculate_quote_line_items`, `get_vehicle_model`, `get_active_pricing_rules` |
| `generate_engineering_output` | Generate engineering requirements doc from finalised order | `get_order_spec`, `get_cad_metadata`, `get_build_book_context`, `get_configuration_options` |

---

### 3.2 Tool Definitions

Each tool is implemented as a function in the Edge Function. Claude calls tools via `tool_use` blocks; the Edge Function executes the function and returns the result in `tool_result` blocks.

---

#### `search_past_orders`
Retrieves past orders for a client and vehicle type, ranked by recency and configuration similarity.

**Input schema:**
```json
{
  "client_id": "string",
  "vehicle_model_id": "string",
  "limit": "integer — default 3"
}
```

**Returns:**
```json
[
  {
    "order_id": "ORD-2025-019",
    "date": "2025-07-22",
    "qty": 12,
    "status": "Delivered",
    "configuration_summary": "4WD, Diesel 2.4L, Long WB, 1800kg, Level III, 2-seat, Full Accessory Pack",
    "unit_price_usd": 448600,
    "similarity_score": 0.94
  }
]
```

**SQL query (Supabase):**
```sql
SELECT o.id, o.created_at, o.qty, o.status,
       json_agg(co.option_name ORDER BY co.category) AS config_options,
       oq.unit_price
FROM orders o
JOIN order_configurations oc ON oc.order_id = o.id
JOIN configuration_options co ON co.id = oc.option_id
LEFT JOIN order_quotes oq ON oq.order_id = o.id
WHERE o.client_id = $1
  AND o.vehicle_model_id = $2
  AND o.status IN ('Delivered', 'Client Approved', 'In Production')
ORDER BY o.created_at DESC
LIMIT $3;
```

---

#### `get_vehicle_model`
Returns full model data including base price, lead time, and available option categories.

**Input:** `{ "vehicle_model_id": "string" }`

**Returns:** Full vehicle model record from `vehicle_models` table.

---

#### `get_configuration_options`
Returns all configuration options for a vehicle model, grouped by category, with compatibility rules.

**Input:** `{ "vehicle_model_id": "string" }`

**Returns:**
```json
{
  "categories": {
    "Drive": [
      { "id": "opt-001", "name": "4WD", "add_on_price": 0, "incompatible_with": [] },
      { "id": "opt-002", "name": "2WD", "add_on_price": -8000, "incompatible_with": ["Level III Protection"] }
    ],
    "Protection": [ ... ]
  }
}
```

---

#### `get_custom_requirements`
Retrieves structured custom requirements entered by the AM in Step 5 of the wizard.

**Input:** `{ "order_id": "string" }`

**Returns:**
```json
{
  "delivery": "Muscat port, Oman — DDP Incoterms",
  "compliance": "UAE MOD desert operations specification MIL-STD-461G",
  "notes": "All vehicles to be fitted with tracking transponder pre-delivery. RAL 7013 paint on all external metalwork.",
  "files_attached": ["spec-ref-UAE-MOD-2025.pdf"]
}
```

---

#### `calculate_quote_line_items`
Deterministic calculation — not LLM-generated. Computes base + add-ons + qty + fees.

**Input:**
```json
{
  "vehicle_model_id": "string",
  "configuration_option_ids": ["array of option IDs"],
  "qty": "integer",
  "custom_fees": [{ "label": "string", "amount_usd": "number", "type": "fixed | percentage" }]
}
```

**Returns:**
```json
{
  "base_price": 320000,
  "options_subtotal": 35600,
  "unit_price": 355600,
  "qty": 10,
  "subtotal": 3556000,
  "custom_fees": [{ "label": "Expedite fee (5%)", "amount": 177800 }],
  "total_usd": 3733800,
  "lead_time_days": 90
}
```

**Note:** This is pure arithmetic executed in the Edge Function. Claude formats and narrates the output — it does not compute the numbers.

---

#### `get_active_pricing_rules`
Returns any pricing overrides, discount rules, or regional uplift rates active for the client or territory.

**Input:** `{ "client_id": "string", "vehicle_model_id": "string" }`

**Returns:** Pricing rule records from `pricing_rules` table (empty array if none).

---

#### `get_order_spec`
Returns the confirmed vehicle spec JSON for a finalised order.

**Input:** `{ "order_id": "string" }`

**Returns:** Full spec document from `order_specs` table.

---

#### `get_cad_metadata`
Returns extracted CAD metadata for a vehicle model (if uploaded).

**Input:** `{ "vehicle_model_id": "string" }`

**Returns:**
```json
{
  "model_code": "TUV-1200",
  "assemblies": [
    { "id": "ASM-001", "name": "Chassis Assembly", "part_count": 84, "material": "HSLA Steel 350MPa" },
    { "id": "ASM-002", "name": "Drive Train", "part_count": 47, "material": "Mixed" }
  ],
  "bom_reference": "BOM-TUV-1200-v3.2",
  "drawing_set_reference": "DWG-TUV-1200-PROD-v3.2",
  "weight_kg": 2840,
  "length_mm": 5200,
  "width_mm": 2100,
  "height_mm": 1980
}
```

---

#### `search_build_context`
Semantic search over ingested PDF build books and spec documents (v1: keyword; v2: pgvector RAG).

**Input:** `{ "query": "string", "vehicle_model_id": "string", "limit": "integer" }`

**Returns:** Array of relevant text extracts from `document_chunks` table with source filename.

---

### 3.3 System Prompt Design

One system prompt per mode. Injected at call time by the Edge Function.

#### Base context (prepended to all modes):
```
You are the TAG Vehicle Systems Configuration Agent. TAG manufactures tactical and utility
vehicles for defence, government, and commercial operators across MENA and the USA.

Your role is to assist Account Managers and clients in generating accurate, professional
vehicle configuration documents. You work from structured data provided via tools.
Do not invent specifications, prices, part numbers, or compliance references.
If a tool returns no data, say so explicitly — do not fill gaps with assumptions.

Output format: Always return valid JSON matching the schema specified in the user message.
Language: English. Tone: Precise, professional, direct. No filler phrases.
```

---

#### Mode: `recommend`
```
You are helping an Account Manager identify the best starting configuration for a new order.

1. Call search_past_orders to retrieve past orders for this client and vehicle type.
2. Call get_vehicle_model to get the base vehicle specification.
3. Rank the past orders by relevance (recency + configuration completeness).
4. Return a ranked array of recommendation objects.
5. If no past orders exist, return an empty array with reason "no_history".

Return JSON:
{
  "recommendations": [
    {
      "order_id": "string",
      "rank": 1,
      "match_reason": "Most recent delivered order — same client, same vehicle model",
      "configuration_summary": "string — human readable",
      "configuration_option_ids": ["array"],
      "unit_price_usd": number,
      "date": "YYYY-MM-DD"
    }
  ],
  "has_history": true | false
}
```

---

#### Mode: `generate_spec`
```
You are generating a formal vehicle specification document for a confirmed order configuration.
This document will be reviewed by the client before approval.

1. Call get_vehicle_model for base model data.
2. Call get_configuration_options to get full descriptions of selected options.
3. Call get_custom_requirements for any AM-entered requirements.
4. Call search_build_context with the vehicle model to retrieve relevant build book extracts.
5. Synthesise all retrieved data into a structured specification.

Rules:
- Every specification field must be sourced from tool results. Do not infer specifications.
- Include exact option names, prices, and incompatibility notes as provided.
- Custom requirements must appear verbatim in the requirements section.
- Dimensions and weights must come from CAD metadata if available; otherwise omit.

Return JSON:
{
  "spec_version": "1.0",
  "generated_at": "ISO timestamp",
  "vehicle": {
    "model": "string",
    "type": "string",
    "base_model_code": "string"
  },
  "configuration": [
    { "category": "string", "option": "string", "spec_detail": "string" }
  ],
  "custom_requirements": {
    "delivery": "string",
    "compliance": "string",
    "notes": "string"
  },
  "technical_data": {
    "weight_kg": number | null,
    "length_mm": number | null,
    "width_mm": number | null,
    "height_mm": number | null,
    "bom_reference": "string | null",
    "drawing_set_reference": "string | null"
  },
  "build_context_references": ["array of source filenames"]
}
```

---

#### Mode: `generate_quote`
```
You are generating a commercial quote for a confirmed vehicle order.
All financial calculations are performed by the calculate_quote_line_items tool.
Your role is to format the results and write the narrative sections only.

1. Call calculate_quote_line_items with the confirmed configuration.
2. Call get_active_pricing_rules to check for applicable discounts or uplifts.
3. Apply any pricing rules to the computed totals (arithmetic only — show your working in notes).
4. Format the structured quote output below.

Rules:
- Do not compute or modify any dollar amounts beyond applying retrieved pricing rules.
- Lead time is taken from the vehicle model record — do not estimate.
- Payment terms default to "30% deposit, 70% on delivery" unless a pricing rule overrides.

Return JSON:
{
  "quote_reference": "QUO-{order_id}-v1",
  "generated_at": "ISO timestamp",
  "validity_days": 30,
  "client": "string",
  "vehicle_model": "string",
  "qty": number,
  "line_items": [
    { "description": "string", "unit_price_usd": number, "qty": number, "total_usd": number }
  ],
  "subtotal_usd": number,
  "fees": [{ "label": "string", "amount_usd": number }],
  "total_usd": number,
  "lead_time_days": number,
  "payment_terms": "string",
  "notes": "string — any pricing rule applications, assumptions"
}
```

---

#### Mode: `generate_engineering_output`
```
You are generating an engineering requirements document for a finalised, client-approved vehicle order.
This document is handed to the design engineering team to begin vehicle production.

1. Call get_order_spec for the approved specification.
2. Call get_cad_metadata for the vehicle model.
3. Call get_configuration_options to get full technical descriptions of all selected options.
4. Call search_build_context to retrieve relevant build book extracts for this model.
5. Call get_custom_requirements for delivery, compliance, and special notes.

Rules:
- This document is for engineering, not for the client. Language is technical.
- Part numbers, assembly IDs, and BOM references must appear exactly as returned by tools.
- Configuration deltas (deviations from base model) must be explicitly flagged.
- Compliance requirements must appear in full, verbatim.
- Do not generate drawing specifications — reference drawing set IDs only.

Return JSON:
{
  "document_reference": "ENG-REQ-{order_id}-v1",
  "generated_at": "ISO timestamp",
  "order_id": "string",
  "vehicle_model": "string",
  "qty": number,
  "sections": {
    "vehicle_summary": "string",
    "base_model_reference": {
      "model_code": "string",
      "bom_reference": "string",
      "drawing_set_reference": "string"
    },
    "configuration_requirements": [
      {
        "category": "string",
        "option": "string",
        "technical_spec": "string",
        "delta_from_base": true | false,
        "delta_note": "string | null"
      }
    ],
    "dimensional_spec": {
      "weight_kg": number | null,
      "length_mm": number | null,
      "width_mm": number | null,
      "height_mm": number | null
    },
    "compliance_requirements": ["array of strings"],
    "delivery_requirements": "string",
    "special_instructions": "string",
    "build_context_references": ["array of source filenames"]
  }
}
```

---

### 3.4 Agent Call Flow Per Mode

```
Edge Function receives request
    │
    ├── Validate request payload + auth (Supabase JWT)
    │
    ├── Load system prompt for mode
    │
    ├── Build user message from request data
    │
    ├── Call Claude API (messages.create)
    │     model: claude-sonnet-4-5
    │     max_tokens: 4096
    │     tools: [all tools for this mode]
    │     system: <mode system prompt>
    │     messages: [{ role: user, content: <context + instruction> }]
    │
    ├── Loop: Claude returns tool_use block
    │     │
    │     ├── Execute tool function locally (Supabase query / calculation)
    │     ├── Append tool_result to messages
    │     └── Call Claude API again
    │
    ├── Claude returns final text/JSON (no more tool_use)
    │
    ├── Parse and validate output JSON against schema
    │
    ├── Persist result to relevant table (order_specs, order_quotes, engineering_outputs)
    │
    └── Return structured response to UI
```

**Max tool call iterations:** 5 (hard limit — prevents infinite loops). If limit reached, return `{ "error": "agent_loop_limit", "partial_result": ... }`.

---

## 4. Data Model

### Supabase PostgreSQL Schema

```sql
-- Vehicle catalogue
CREATE TABLE vehicle_models (
  id             TEXT PRIMARY KEY,           -- e.g. VEH-TUV-1200
  model_code     TEXT NOT NULL UNIQUE,
  type           TEXT NOT NULL,              -- Tactical Utility Vehicle | Electric | Light Commercial
  base_price_usd INTEGER NOT NULL,
  lead_time_days INTEGER NOT NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Configuration options catalogue
CREATE TABLE configuration_options (
  id               TEXT PRIMARY KEY,
  vehicle_model_id TEXT REFERENCES vehicle_models(id),
  category         TEXT NOT NULL,           -- Drive | Engine | Wheelbase | Payload | Protection | etc.
  option_name      TEXT NOT NULL,
  add_on_price_usd INTEGER NOT NULL DEFAULT 0,
  incompatible_with TEXT[] DEFAULT '{}',    -- array of option_names
  requires         TEXT[] DEFAULT '{}',     -- e.g. 7-seat requires Long wheelbase
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Clients
CREATE TABLE clients (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  organisation TEXT,
  country      TEXT,
  contact_email TEXT,
  am_id        TEXT REFERENCES account_managers(id),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Account managers
CREATE TABLE account_managers (
  id        TEXT PRIMARY KEY,
  name      TEXT NOT NULL,
  territory TEXT,
  email     TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Orders
CREATE TABLE orders (
  id               TEXT PRIMARY KEY,         -- ORD-YYYY-NNN
  client_id        TEXT REFERENCES clients(id),
  am_id            TEXT REFERENCES account_managers(id),
  vehicle_model_id TEXT REFERENCES vehicle_models(id),
  qty              INTEGER NOT NULL,
  status           TEXT NOT NULL DEFAULT 'Draft',
  -- status enum: Draft | Pending Review | Quote Sent | Client Approved | In Production | Delivered
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Selected configuration options per order
CREATE TABLE order_configurations (
  order_id  TEXT REFERENCES orders(id),
  option_id TEXT REFERENCES configuration_options(id),
  PRIMARY KEY (order_id, option_id)
);

-- Custom requirements (AM-entered in Step 5)
CREATE TABLE order_custom_requirements (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     TEXT REFERENCES orders(id),
  delivery     TEXT,
  compliance   TEXT,
  notes        TEXT,
  files_attached TEXT[] DEFAULT '{}'
);

-- AI-generated spec documents
CREATE TABLE order_specs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     TEXT REFERENCES orders(id) UNIQUE,
  spec_json    JSONB NOT NULL,
  version      INTEGER NOT NULL DEFAULT 1,
  generated_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI-generated quotes
CREATE TABLE order_quotes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     TEXT REFERENCES orders(id) UNIQUE,
  quote_json   JSONB NOT NULL,
  unit_price_usd INTEGER,
  total_usd    INTEGER,
  version      INTEGER NOT NULL DEFAULT 1,
  generated_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI-generated engineering outputs
CREATE TABLE engineering_outputs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     TEXT REFERENCES orders(id) UNIQUE,
  output_json  JSONB NOT NULL,
  version      INTEGER NOT NULL DEFAULT 1,
  generated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pricing rules (discounts, uplifts, territory rates)
CREATE TABLE pricing_rules (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  applies_to    TEXT NOT NULL,    -- 'client' | 'vehicle_model' | 'territory'
  reference_id  TEXT NOT NULL,    -- client_id | vehicle_model_id | territory string
  rule_type     TEXT NOT NULL,    -- 'discount_pct' | 'uplift_pct' | 'flat_fee'
  value         NUMERIC NOT NULL,
  label         TEXT,
  active_from   DATE,
  active_until  DATE
);

-- Uploaded files metadata
CREATE TABLE uploaded_files (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type          TEXT NOT NULL,    -- 'excel' | 'pdf' | 'cad_metadata' | 'compliance_doc'
  filename      TEXT NOT NULL,
  storage_path  TEXT NOT NULL,    -- Supabase Storage path
  related_to    TEXT,             -- vehicle_model_id | order_id (context)
  parse_status  TEXT DEFAULT 'pending',  -- pending | parsed | failed
  parsed_data   JSONB,            -- structured extract after parsing
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- CAD metadata (extracted from SolidWorks exports)
CREATE TABLE cad_metadata (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_model_id     TEXT REFERENCES vehicle_models(id),
  model_code           TEXT,
  bom_reference        TEXT,
  drawing_set_reference TEXT,
  weight_kg            NUMERIC,
  length_mm            NUMERIC,
  width_mm             NUMERIC,
  height_mm            NUMERIC,
  assemblies           JSONB,     -- array of { id, name, part_count, material }
  source_file_id       UUID REFERENCES uploaded_files(id),
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

-- Document chunks (for build book search — v1 keyword, v2 pgvector)
CREATE TABLE document_chunks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id         UUID REFERENCES uploaded_files(id),
  vehicle_model_id TEXT,
  chunk_text      TEXT NOT NULL,
  chunk_index     INTEGER,
  -- v2: embedding VECTOR(1536)
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Odoo sync log
CREATE TABLE odoo_sync_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,   -- 'order' | 'client' | 'product'
  odoo_id     INTEGER NOT NULL,
  synced_at   TIMESTAMPTZ DEFAULT NOW(),
  status      TEXT DEFAULT 'success'
);
```

---

## 5. API Design

### Edge Function Endpoints

All endpoints require `Authorization: Bearer <supabase_jwt>`.

---

#### `POST /functions/v1/agent`

The primary agent endpoint. Mode is specified in the request body.

**Request:**
```json
{
  "mode": "recommend | generate_spec | generate_quote | generate_engineering_output",
  "order_id": "string — required for all modes except recommend",
  "client_id": "string — required for recommend",
  "vehicle_model_id": "string — required for recommend",
  "configuration_option_ids": ["array — required for generate_quote"],
  "qty": "integer — required for generate_quote",
  "custom_fees": [{ "label": "string", "amount_usd": "number", "type": "fixed | percentage" }]
}
```

**Response (success):**
```json
{
  "mode": "string",
  "result": { ... },    // mode-specific JSON schema (see §3.3)
  "persisted": true,
  "record_id": "uuid"
}
```

**Response (error):**
```json
{
  "error": "string",             // agent_loop_limit | tool_failure | schema_validation_failed | unauthorized
  "message": "string",
  "partial_result": { ... }      // null if no partial result available
}
```

---

#### `POST /functions/v1/files/upload`

Handles file ingestion. Accepts multipart/form-data.

**Fields:** `file` (binary), `type` (excel | pdf | cad_metadata | compliance_doc), `related_to` (vehicle_model_id or order_id, optional)

**Response:**
```json
{
  "file_id": "uuid",
  "filename": "string",
  "storage_path": "string",
  "parse_status": "pending"
}
```

Upload triggers a Supabase Webhook → `POST /functions/v1/files/parse` asynchronously.

---

#### `POST /functions/v1/files/parse`

Internal — triggered by Storage webhook on new file upload. Not called directly by UI.

Parsing pipeline per type:

| Type | Parser | Output |
|---|---|---|
| `excel` | SheetJS (xlsx library in Deno) | Rows → structured JSON → insert/upsert into relevant tables |
| `pdf` | pdf-parse or pdfjs-dist | Text chunks → insert into `document_chunks` |
| `cad_metadata` | Custom XML/CSV parser | Assembly tree + dimensions → insert into `cad_metadata` |
| `compliance_doc` | pdf-parse | Text chunks → insert into `document_chunks` |

---

#### `GET /functions/v1/orders`

Returns order list for the authenticated persona.
- AM: returns all orders for `am_id`
- Client: returns all orders for `client_id`

Query params: `status`, `client_id`, `vehicle_model_id`, `limit`, `offset`

---

#### `GET /functions/v1/orders/:id`

Returns full order detail including linked spec, quote, and engineering output (if generated).

---

#### `PATCH /functions/v1/orders/:id`

Updates order status or configuration. Validates status transition rules server-side.

**Valid status transitions:**
```
Draft → Pending Review (AM submits)
Pending Review → Quote Sent (AM sends quote)
Quote Sent → Client Approved (Client approves)
Quote Sent → Pending Review (Client requests changes)
Client Approved → In Production (AM triggers)
```

---

#### `GET /functions/v1/catalogue/vehicles`

Returns all vehicle models.

#### `GET /functions/v1/catalogue/options?vehicle_model_id=:id`

Returns all configuration options for a model, grouped by category with compatibility rules.

---

## 6. Integration Architecture

### 6.1 Odoo (ERP) — Scheduled Sync

**Pattern:** Scheduled cron sync into Supabase — not real-time. Agent queries Supabase, not Odoo directly.

**Why:** Odoo has latency issues (noted in discovery). Real-time queries would slow agent calls. A synced local copy is faster and more reliable.

**Sync schedule:** Every 4 hours via Supabase pg_cron or an external cron hitting a sync edge function.

**Sync endpoint:** `POST /functions/v1/integrations/odoo/sync`

**Odoo API:** JSON-RPC 2.0 (`/web/dataset/call_kw`) + REST API (`/api/...` for Odoo 17+)

**Entities synced:**

| Odoo Model | Supabase Table | Fields |
|---|---|---|
| `res.partner` (customers) | `clients` | name, email, country |
| `sale.order` | `orders` | client, date, status, lines |
| `sale.order.line` | `order_configurations` (mapped) | product, qty, price |
| `product.product` | `vehicle_models` | name, price, lead time |

**Auth:** Odoo API key stored as Supabase Edge Function secret (`ODOO_API_KEY`), Odoo URL as `ODOO_BASE_URL`.

**Conflict resolution:** Supabase record wins for AM-entered data (configurations, custom requirements). Odoo wins for client master data and historical order prices.

---

### 6.2 Excel / CSV Upload

**Trigger:** AM or admin uploads historical vehicle data export from TAG's current Excel landscape.

**Pipeline:**
1. File uploaded via `POST /files/upload` with `type: excel`
2. Storage webhook fires → parse edge function
3. SheetJS reads workbook → row-by-row validation
4. Validated rows upserted into: `vehicle_models`, `configuration_options`, `orders` (historical), `order_configurations`
5. `uploaded_files.parse_status` updated to `parsed` or `failed` with error detail

**Expected sheets (to confirm with client):**
- `Vehicles` — model catalogue
- `Orders` — historical order list
- `Pricing` — base prices + option prices

**Error handling:** Invalid rows written to `parse_errors` JSONB column on `uploaded_files`. UI shows parse summary after upload.

---

### 6.3 PDF Ingestion (Build Books + Compliance Docs)

**Purpose:** Provide the agent with build book content and compliance specification references when generating spec and engineering output documents.

**v1 — Keyword search:**
1. PDF uploaded → pdfjs-dist extracts text
2. Text chunked at 512 tokens with 64-token overlap
3. Chunks stored in `document_chunks` with `vehicle_model_id` tag
4. `search_build_context` tool: `SELECT chunk_text FROM document_chunks WHERE vehicle_model_id = $1 AND chunk_text ILIKE '%' || $2 || '%' LIMIT $3`

**v2 — Vector search (pgvector):**
1. Same pipeline + embed each chunk with `text-embedding-3-small` (OpenAI) or `voyage-3` (Anthropic)
2. Store embedding in `document_chunks.embedding VECTOR(1536)`
3. `search_build_context` tool: cosine similarity search via `<=>` operator

**PDF types expected:**
- Previous vehicle build books (submodule spec docs)
- UAE / Oman MOD compliance specifications
- Factory production run sheets
- TAG product design spec sheets

---

### 6.4 SolidWorks / CAD Metadata

**Scope (v1):** Metadata extraction only. No CAD file parsing, no geometry processing.

**What TAG can export from SolidWorks:**
- BOM export as CSV or XML (from SolidWorks PDM or direct)
- Custom properties export (XML) — part numbers, materials, assembly references
- eDrawings HTML with embedded properties

**Pipeline:**
1. AM or engineer uploads CAD metadata export (CSV or XML) via `POST /files/upload` with `type: cad_metadata`
2. Parse edge function: detect format (CSV/XML) → extract fields → upsert into `cad_metadata`
3. `get_cad_metadata` tool queries `cad_metadata` by `vehicle_model_id`

**Key fields extracted:**

| SolidWorks Export Field | Mapped To |
|---|---|
| Custom Property: `Description` | assembly name |
| Custom Property: `Part Number` | assembly id |
| Custom Property: `Material` | material |
| BOM: total row count | part_count |
| Custom Property: `Mass` | weight_kg |
| Custom Property: `Overall_Length` | length_mm |
| Drawing title block: `Drawing Number` | drawing_set_reference |
| PDM: `Configuration` | bom_reference |

**File formats accepted:** `.csv` (BOM export), `.xml` (PDM properties export), `.txt` (custom properties export).

**Not in scope (v1):** STEP/IGES geometry, SolidWorks API direct integration, automated BOM generation from CAD.

---

## 7. Deployment Architecture

```
┌─────────────────────────────────────────────────────┐
│  Vercel                                             │
│  React/Vite (Lovable build)                         │
│  → calls Supabase Edge Functions via HTTPS          │
└────────────────────┬────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────┐
│  Supabase                                           │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │  Edge Functions (Deno)                      │   │
│  │  /agent         — AI agent runtime          │   │
│  │  /files/upload  — file ingestion            │   │
│  │  /files/parse   — parse pipeline (webhook)  │   │
│  │  /integrations/odoo/sync — Odoo sync cron   │   │
│  │  /orders        — order CRUD                │   │
│  │  /catalogue     — vehicle/option reads      │   │
│  └──────────────────┬──────────────────────────┘   │
│                     │                               │
│  ┌──────────────────▼──────────────────────────┐   │
│  │  PostgreSQL (+ pgvector v2)                 │   │
│  │  All tables from §4                         │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │  Supabase Storage                           │   │
│  │  Buckets: uploads/, build-books/, cad/      │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │  Auth (Supabase JWT)                        │   │
│  │  RLS policies per persona (AM / Client)     │   │
│  └─────────────────────────────────────────────┘   │
└────────────────────┬────────────────────────────────┘
                     │
        ┌────────────┴──────────────┐
        │                           │
┌───────▼────────┐       ┌──────────▼──────────┐
│ Anthropic API  │       │ Odoo (TAG ERP)       │
│ claude-sonnet  │       │ JSON-RPC sync        │
│ -4-5           │       │ every 4 hours        │
└────────────────┘       └─────────────────────┘
```

**Secrets (Supabase Edge Function environment):**

| Key | Value |
|---|---|
| `ANTHROPIC_API_KEY` | Claude API key |
| `ODOO_BASE_URL` | TAG's Odoo instance URL |
| `ODOO_API_KEY` | Odoo service account key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase admin key (Edge Functions only) |

---

## 8. Security & IP Protection

TAG explicitly raised IP protection as a concern in discovery. The following controls apply:

| Concern | Control |
|---|---|
| CAD data leaving infrastructure | CAD metadata only (not geometry). Full STEP/IGES files are never uploaded to this system. |
| Client vehicle specs exposed to other clients | Row-level security (RLS) on all tables. Client persona can only read rows where `client_id = auth.uid()`. |
| Anthropic API receiving sensitive data | Spec content (config options, custom requirements) is sent to the Claude API. TAG should review Anthropic's data usage policy. API calls are not used for model training by default (Anthropic's API terms). |
| Odoo credentials | Stored as Edge Function secrets — never in code, never in client response. |
| AM impersonating client | Supabase RLS enforces persona-level access. AM role can read all orders within their `am_id`. Client role can read orders with their `client_id` only. |
| Uploaded PDFs (build books) | Stored in private Supabase Storage bucket. Signed URLs with 1-hour expiry for any download link. |

**Recommendation:** Before production deployment, TAG to confirm whether sending vehicle configuration data to Anthropic API is acceptable under their IP policy. If not, options are: (a) Anthropic Enterprise with data residency / zero data retention, or (b) self-hosted LLM (significant complexity trade-off).

---

## 9. Build Sequence

### Phase 1 — Foundation (Weeks 1–2)
- [ ] Supabase project provisioned
- [ ] Schema deployed (all tables from §4)
- [ ] Fixture data seeded (vehicles, clients, AMs, config options, past orders)
- [ ] Auth configured — AM and Client roles, RLS policies
- [ ] Lovable prototype connected to Supabase (replace in-memory fixture data)

### Phase 2 — Core Agent (Weeks 3–4)
- [ ] Edge Function: `/agent` scaffolded with Anthropic TS SDK
- [ ] Tool implementations: `search_past_orders`, `get_vehicle_model`, `get_configuration_options`, `validate_configuration`, `calculate_quote_line_items`
- [ ] Mode: `recommend` — end-to-end tested
- [ ] Mode: `generate_spec` — end-to-end tested
- [ ] Mode: `generate_quote` — end-to-end tested (arithmetic validated against fixture data)

### Phase 3 — Engineering Output + File Ingestion (Weeks 5–6)
- [ ] File upload endpoint + Supabase Storage buckets
- [ ] Excel parse pipeline (SheetJS) — vehicle catalogue + historical orders
- [ ] PDF parse pipeline (pdfjs-dist) — text extraction + document_chunks
- [ ] CAD metadata parse pipeline (XML/CSV)
- [ ] `search_build_context` tool integrated
- [ ] `get_cad_metadata` tool integrated
- [ ] Mode: `generate_engineering_output` — end-to-end tested

### Phase 4 — Odoo Sync (Weeks 7–8)
- [ ] Odoo JSON-RPC connection validated with TAG's instance
- [ ] Sync edge function for clients, orders, products
- [ ] pg_cron scheduled sync (every 4 hours)
- [ ] Conflict resolution logic
- [ ] Sync log + failure alerting

### Phase 5 — Hardening (Weeks 9–10)
- [ ] RLS policy audit — all tables
- [ ] Agent error handling — loop limit, schema validation, tool failures
- [ ] Pricing rule engine tested against real TAG pricing scenarios
- [ ] Status transition validation
- [ ] Load test: agent endpoints (target: p95 < 8s for spec generation)
- [ ] Signed URL policy for Storage downloads

---

## 10. Open Items

| # | Item | Owner | Priority |
|---|---|---|---|
| 1 | Confirm Anthropic API data residency / IP policy acceptable to TAG | Sharavi + Tariq | High |
| 2 | Confirm exact SolidWorks export formats TAG can produce (BOM CSV? PDM XML?) | Raza (TAG Design Eng) | High |
| 3 | Confirm Odoo version (v16 / v17) — API paths differ | Yameen (TAG COO) | High |
| 4 | Confirm whether Excel landscape template (shared by DQ in discovery follow-up) covers the sheets assumed in §6.2 | Fadil (DQ) | Medium |
| 5 | Confirm primary orange hex with Raza — `#E8621A` is derived | Raza / Sharavi | Medium |
| 6 | Confirm whether client-facing portal requires Arabic (RTL) in v1 | Tariq / Yameen | Medium |
| 7 | v2 scoping: pgvector RAG on build book PDFs — confirm budget and timeline | Sharavi | Low |
| 8 | v2 scoping: real-time Odoo query vs 4-hour sync — confirm acceptable lag | Yameen | Low |
