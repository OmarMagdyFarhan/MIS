# Phase 16.9 — Security & Production Hardening

All changes in this release are fixes for findings from the v16.8 static code audit.
No feature additions. Every change is keyed to the audit finding that motivated it.

---

## 🔴 Critical (fix before any git push or production deploy)

### 1. Added `.gitignore` — **new file**
The project had no `.gitignore` at all, meaning `.env` (which contained a real
`GEMINI_API_KEY`) would have been committed on the first `git init && git push`.

**Files changed:** `.gitignore` (new)

**Action required:** The `GEMINI_API_KEY` that was in `.env` has been redacted from
this release. **Rotate that key immediately** in the Google AI Studio console — it
appeared in this repository's history and may have been read by the audit tooling.

---

### 2. Implemented `MIS_API_KEY` bearer-token guard — `server.ts`
The file header and `server/ai/routes.ts`'s doc comment both described
`MIS_API_KEY` as "the lightweight API key guard in server.ts." The guard was
never written — every `/api/ai/*` route was open to the public regardless of
whether the env var was set.

**Fix:** When `process.env.MIS_API_KEY` is non-empty, a middleware layer on
`/api/ai` now checks `Authorization: Bearer <key>` and returns `401` for any
request that does not supply it. The guard is skipped in development when the
key is empty, so local testing requires no extra configuration.

**Files changed:** `server.ts`

---

### 3. `.env` — redacted exposed key, added missing variables
The uploaded `.env` contained a live `GEMINI_API_KEY` and was missing
`DATABASE_URL`, `ALLOWED_ORIGINS`, and `LOG_LEVEL`.

**Files changed:** `.env`, `.env.example`

---

## 🟠 Production blockers

### 4. Added `app.set("trust proxy", 1)` — `server.ts`
Without this setting, `express-rate-limit` keys off the proxy/load-balancer's IP
instead of the real client IP on platforms like Render, Railway, Heroku, and
Fly.io. This means all users sharing the same proxy are counted as one client,
making rate-limiting effectively broken in production.

**Files changed:** `server.ts`

---

### 5. Global error handler no longer leaks internal messages in production — `server.ts`
The previous handler returned `err.message` verbatim to callers in all
environments. In production a Prisma error can include the full connection string
or a stack fragment. The handler now returns a generic `"Internal server error"`
in production and logs the real error server-side via pino.

**Files changed:** `server.ts`

---

### 6. Pino redaction config for sensitive request fields — `server/logger.ts`
The logger had no redaction rules. If a dev-mode request object (which carries
`req.devKeys` with raw API key strings from `x-dev-gemini-key` headers) was ever
serialised through `logger.error({ err })`, the keys would appear in the log
output unmasked.

**Fix:** Added a `redact` config covering `x-dev-*-key` headers, the
`authorization` header, and the `devKeys` sub-object properties.

**Files changed:** `server/logger.ts`

---

## 🟡 API contract corrections

### 7. `DELETE /api/avatars/:id` now returns 404 for unknown IDs — `server/routes/avatarsDb.ts`
Previously, deleting a non-existent avatar caused Prisma to throw `P2025`
("Record to delete does not exist"), which fell into the generic `catch` block
and returned `500`. Callers had no way to distinguish "server broken" from
"avatar doesn't exist."

**Fix:** Added a `findUnique` existence check before the `delete` call. Returns
`404 { error: "Avatar not found" }` for missing IDs and the existing
`200 { success: true }` for successful deletes.

**Files changed:** `server/routes/avatarsDb.ts`

---

## 🟢 Developer experience

### 8. `npm run dev` now serves the full app at `http://localhost:3000` — `server.ts`
Previously, `npm run dev` (`tsx server.ts`) started Express on port 3000 but
only mounted API routes — no static serving and no Vite middleware — so the SPA
never loaded. The only working path was `npm run build && npm start`.

**Fix:** In development mode `server.ts` now dynamically imports `vite` and
mounts `vite.middlewares` on the Express app. This gives HMR, instant feedback,
and a single `http://localhost:3000` URL for both the frontend and the API,
with no separate Vite process to manage.

**Files changed:** `server.ts`, `vite.config.ts` (comment updated)

---

### 9. In-app error message corrected — `src/ai/errors.ts`
The `NETWORK` error public message told users to "Start it with `npm run dev`
and open `http://localhost:3000`" — which was accurate about the port but
misleading about what `npm run dev` actually did (previously it didn't serve the
frontend at all). Updated to reflect the corrected behaviour.

**Files changed:** `src/ai/errors.ts`

---

### 10. README rewritten to match current architecture — `README.md`
The previous README described a two-server dev setup (Vite on 5173, Express
proxy on 3001) with `VITE_API_BASE` and `LOG_LEVEL` environment variables. The
actual codebase has been a single Express server on port 3000 with Postgres
persistence for several phases, but the README was never updated.

**Fix:** Full rewrite covering the single-server setup, `DATABASE_URL` / Prisma
setup steps, corrected API shapes (`GET /api/evidence` pagination wrapper,
`DELETE /api/avatars/:id` returning 200 not 204, `POST /api/ai/generate` body
shape), and correct production deploy instructions.

**Files changed:** `README.md`

---

## ⚡ Performance

### 11. Vite `manualChunks` vendor splitting — `vite.config.ts`
`ARCHITECTURE.md` already documented "Bundle splitting: Vite `manualChunks`
for vendor libs and lazy-loaded stage views" as an existing design decision, but
`vite.config.ts` had no `build.rollupOptions.output.manualChunks` configuration
at all. Every dependency rode in the same chunk as app code, which is the likely
cause of the ~922 KB gzipped main bundle noted in the audit.

**Fix:** Added a `manualChunks` function that splits into:
- `vendor-react` — React + ReactDOM (changes least often)
- `vendor-radix` — all `@radix-ui/*` primitives
- `vendor-charts` — Recharts and its D3 dependencies
- `vendor-motion` — Motion / Framer Motion
- `vendor` — all remaining `node_modules`

**Files changed:** `vite.config.ts`

---

## Remaining items (require a live environment — not fixable by static edit)

| Item | Status | Notes |
|---|---|---|
| Set `DATABASE_URL` | Pending | Must be set before `npx prisma db push` |
| Set `ALLOWED_ORIGINS` in prod | Pending | Required if frontend is CDN-hosted |
| Run `npx prisma db push` / seed | Pending | Needs a live DB connection |
| Configure Supabase RLS | Pending | Done in Supabase dashboard, not in codebase |
| Rotate the exposed `GEMINI_API_KEY` | **Urgent** | See finding #1 above |
| Audit doc curl commands | Pending | Update to use correct endpoint shapes (see README API reference) |
