# Customer Intelligence Engine

A local-first AI-powered marketing intelligence workbench. Build customer avatars, craft positioning offers, and synthesise market intelligence — all from a single server with Postgres-backed persistence.

---

## Quick start

```bash
cp .env.example .env   # fill in GEMINI_API_KEY and DATABASE_URL at minimum
npm install
npx prisma db push     # create tables in your Postgres database
npm run dev            # starts Express + Vite on http://localhost:3000
```

Open **http://localhost:3000**.

> **How dev mode works:** `npm run dev` runs `server.ts` via `tsx`. In development,
> `server.ts` wires the Vite dev server in as Express middleware, so the SPA,
> HMR, and the API all share a single port (3000). There is no separate Vite
> dev server to start.

---

## Environment variables

| Name | Required | Default | Description |
|---|---|---|---|
| `GEMINI_API_KEY` | one of the two | — | Google Gemini API key |
| `OPENROUTER_API_KEY` | one of the two | — | OpenRouter API key (enables GPT-4o, etc.) |
| `DATABASE_URL` | **yes** | — | PostgreSQL connection string — `postgresql://user:pass@host:5432/db` |
| `PORT` | No | `3000` | HTTP port |
| `NODE_ENV` | No | `development` | Set to `production` for hardened error responses and static-file serving |
| `MIS_API_KEY` | Recommended in prod | — | Bearer-token guard for `/api/ai/*`. All requests must include `Authorization: Bearer <key>` |
| `ALLOWED_ORIGINS` | Required if frontend is on a CDN | — | Comma-separated CORS origins, e.g. `https://app.example.com` |
| `LOG_LEVEL` | No | `info` | Pino log level: `debug`, `info`, `warn`, `error` |

At least one of `GEMINI_API_KEY` or `OPENROUTER_API_KEY` must be set, or all AI calls will fail.

---

## Architecture

Single Express server on port 3000 backed by Postgres (Prisma ORM, Supabase recommended).

```
http://localhost:3000
  ├── /api/ai/*        AI routes (Gemini / OpenRouter, circuit-breaker, rate limit)
  ├── /api/evidence    Evidence CRUD (paginated — response shape: { data, total, page, limit })
  ├── /api/avatars     Avatar CRUD (DELETE returns 200 { success: true })
  ├── /api/corpus      Corpus version / status
  ├── /health          Health check
  └── /*               SPA (Vite middleware in dev; dist/public/ in production)
```

State lives in Zustand stores, persisted to IndexedDB with LZ-string compression. Domain code is grouped into feature slices under `src/features/`.

See **ARCHITECTURE.md** for the full module map, pipeline data model, and feature-slice rules.

---

## API quick reference

### AI generation
```
POST /api/ai/generate
Authorization: Bearer <MIS_API_KEY>        ← required when MIS_API_KEY is set
Content-Type: application/json

{ "systemPrompt": "...", "userMessage": "...", "jsonResponse": false, "model": "gemini-1.5-flash" }
```

### Evidence
```
GET  /api/evidence?page=1&limit=50         ← returns { data, total, page, limit, corpusVersion }
POST /api/evidence                         ← { text, source?, sentiment? }
GET  /api/evidence/summary
```

### Avatars
```
POST   /api/avatars                        ← { name, description, claims, clusterId?, taskType, temperature }
GET    /api/avatars
GET    /api/avatars/:id
DELETE /api/avatars/:id                    ← 404 if not found; 200 { success: true } on success
```

---

## Development workflow

```bash
npm run dev            # dev server on http://localhost:3000 (Vite middleware + Express)
npm run lint           # tsc --noEmit (zero errors required)
npm test               # Vitest in watch mode
npm run coverage       # Vitest with v8 coverage report
npm run build          # production build → dist/public/ (frontend) + dist/server.js
npm start              # serve the production build (NODE_ENV=production)
```

All three gates must pass before merging: `npm run lint`, `npm test`, `npm run build`.

---

## Database setup

This project uses [Prisma](https://www.prisma.io/) with a PostgreSQL database (Supabase recommended).

```bash
# Create the schema
npx prisma db push

# Seed with example data (optional)
npm run db:seed

# Open the Prisma GUI
npm run db:studio
```

`DATABASE_URL` must be set in `.env` before any of the above commands will work.

---

## Production deploy

```bash
# Minimum required environment variables
NODE_ENV=production
DATABASE_URL=postgresql://...
GEMINI_API_KEY=...       # and/or OPENROUTER_API_KEY
MIS_API_KEY=...          # strong random string — guards /api/ai/*
ALLOWED_ORIGINS=https://yourdomain.com   # only needed if frontend is CDN-hosted

# Build and start
npm run build
npm start                # runs dist/server.js
```

Make sure to:
1. Set `DATABASE_URL` and run `npx prisma db push` before the first deploy.
2. Set `ALLOWED_ORIGINS` if the frontend is served from a different origin than the API.
3. Place `.env` in `.gitignore` (already done in v16.9 — never commit secrets).

---

## AI providers

**Gemini** (default): set `GEMINI_API_KEY`. Uses `gemini-1.5-flash` by default. Supports `gemini-2.0-flash`, `gemini-2.5-flash-preview-05-20`, and `gemini-1.5-pro`.

**OpenRouter**: set `OPENROUTER_API_KEY`. Enables `openai/gpt-4o-mini` and `openai/gpt-4o`. The server falls back to OpenRouter if Gemini's circuit breaker is open.

If neither key is set, the proxy returns a `PROVIDER` error on every request. The allowed model list lives in `src/shared/api/models.ts` and is validated on both client and server.

---

## Adding a feature

Follow the corpus slice as the reference implementation (`src/features/corpus/`):

1. Create `src/features/<domain>/` with `store.ts`, `types.ts`, `components/`, `services/`.
2. Move or create files **one at a time**. After each move, fix broken imports and run `npm run lint`.
3. Update internal imports to reflect the new relative path depth.
4. Delete original files only after the lint gate passes.
5. Create `src/features/<domain>/index.ts` and update all external importers to use it.
