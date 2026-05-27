# TAG

TAG Vehicle Systems — AI-powered vehicle configuration agent for Account Managers and clients.

## Overview

- **Backend** (`backend/`) — Express + LangChain agent on OpenRouter, Postgres/Supabase storage, SSE streaming.
- **Frontend** (`frontend/`) — React + Vite chat UI with live thinking, tool traces, and document artifacts (spec / quote / engineering).

## Quick start

### Backend

```bash
cd backend
cp .env.example .env   # fill in OPENROUTER_API_KEY and DATABASE_URL
npm install
npm run dev            # http://localhost:3001
```

### Frontend

```bash
cd frontend
npm install
npm run dev            # http://localhost:3000 (proxies /api → :3001)
```

## Configuration

See `backend/.env.example` for all variables. Critical ones:

| Variable | Purpose |
|----------|----------|
| `OPENROUTER_API_KEY` | LLM provider key (never commit) |
| `OPENROUTER_MODEL_DEV` | Default `minimax/minimax-m2.5` |
| `OPENROUTER_PROVIDER_IGNORE` | `Novita` (avoids broken Qwen routes) |
| `DATABASE_URL` | Supabase Postgres URI (session pooler, port 5432) |
| `TAG_API_KEY` | Optional — require this header on `/api/*` |
| `TAG_ACCESS_PASSWORD` | Optional — enables login + JWT session |

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for Railway (backend) + Vercel (frontend) checklists, secure-proxy mode, and security tiers.

## Tests

```bash
cd backend && npm test
cd frontend && npm run build
```
