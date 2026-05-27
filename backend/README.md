# TAG Vehicle Configuration Agent — Backend API

Backend for the TAG Vehicle Configurator frontend. **Supabase Postgres** + **LangChain** tool-calling + **OpenRouter**.

No UI in this repo — the frontend (Lovable/Vite) calls this API over HTTP.

## Stack

| Layer | Technology |
|-------|------------|
| API | Express + TypeScript |
| Database | Supabase Postgres (`pg`) |
| Agent | LangChain JS → OpenRouter |
| Validation | Zod |
| Tests | Vitest (in-memory store, no DB cost) |

## Supabase setup

### Which connection method? (your screenshot)

| Method | Port | Use for TAG backend? |
|--------|------|----------------------|
| **Direct** | 5432 (`db.*.supabase.co`) | Yes — long-lived Express server. Can fail on some networks (IPv6-only DNS). |
| **Session pooler** | 5432 (`*.pooler.supabase.com`) | **Best choice** — Express API + fixes IPv4/DNS issues. |
| **Transaction pooler** | 6543 | **No** — for serverless (Edge Functions). Not ideal for always-on Express. |

**Pick Session pooler** in the dashboard, type **URI**, paste into `.env`:

```env
DATABASE_URL=postgresql://postgres.yddxbmqisbknhrzfccon:[YOUR-PASSWORD]@aws-1-eu-north-1.pooler.supabase.com:5432/postgres
```

If you only have Transaction pooler (6543), it works but use port **5432 Session** when available.

We use the official [`postgres`](https://github.com/piasetzky/postgres) package (not `pg`), per Supabase’s Node guide.

1. Create a project at [supabase.com](https://supabase.com).
2. **Connect → Database → Session pooler → URI** — copy the full string.
3. Add to `.env` with your password (replace `[YOUR-PASSWORD]`).
4. Also set:

```env
USE_MEMORY_STORE=false
CORS_ORIGIN=http://localhost:5173
```

4. Apply schema + seed:

```bash
npm run db:setup
```

5. Start API:

```bash
npm run dev
```

`GET /health` should show `"database": "connected"`.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev server (port 3001) |
| `npm run db:setup` | Run `sql/001_schema.sql` + `sql/002_seed.sql` on Supabase |
| `npm test` | Tests (memory store, no Supabase required) |

## API (for frontend)

Base URL: `http://localhost:3001`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | API + DB status |
| GET | `/api/clients` | Client list |
| GET | `/api/vehicles?vehicle_model_id=VEH-TUV-1200` | Vehicles + options |
| GET | `/api/orders` | Orders (`?client_id=`, `?status=`) |
| GET | `/api/orders/:id` | Order detail + spec/quote if generated |
| POST | `/api/agent` | Agent: `recommend`, `generate_spec`, `generate_quote` |

### Agent request

```json
{
  "mode": "recommend",
  "client_id": "CLI-UAE-MOD",
  "vehicle_model_id": "VEH-TUV-1200"
}
```

```json
{
  "mode": "generate_quote",
  "order_id": "ORD-2026-POC",
  "vehicle_model_id": "VEH-TUV-1200",
  "configuration_option_ids": ["opt-4wd", "opt-level3"],
  "qty": 10
}
```

Response:

```json
{
  "mode": "generate_quote",
  "result": { ... },
  "engine": "langchain",
  "record_id": "uuid-if-saved"
}
```

Specs and quotes are **saved to Supabase** when `order_id` is provided.

## Architecture

```
Frontend (Lovable / Vite)
        │  HTTP + CORS
        ▼
Express API  ──►  LangChain agent  ──►  OpenRouter (Qwen)
        │
        ▼
Supabase Postgres  (catalogue, orders, specs, quotes)
```

- **Prices** always from `calculate_quote_line_items` (SQL + arithmetic), never invented by the LLM.
- **Dev model** (`OPENROUTER_MODEL_DEV`) for fast iteration; **397B** for demos (`USE_PRODUCTION_MODEL=true`).

## Project layout

```
sql/              Schema + seed for Supabase
src/data/         Postgres + memory data stores
src/domain/       Tool functions (agent calls these)
src/agent/        LangChain runner + stub
src/app.ts        Routes
tests/            Vitest
```
