# Phase 16.10 — Production Build Fix

Single-issue release. The v16.9 audit verified the security fixes from that
phase were real (MIS_API_KEY guard, redacted GEMINI_API_KEY) but found one new
bug in the v16.9 build pipeline itself: the production server crashed on
startup before serving a single request. This release fixes that, and only
that — no other code changed.

---

## 🔴 Critical (production blocker)

### 1. Production server crashed immediately on `npm start` — `package.json`

**Root cause:** `server.ts` computes its own directory with:

```ts
const __dir = dirname(fileURLToPath(import.meta.url));
```

This is correct ESM and works fine under `npm run dev` (`tsx server.ts`, which
runs the file as ESM, matching this project's `"type": "module"`). But the
`build` script compiled the server with `esbuild --format=cjs`. esbuild has no
way to represent `import.meta` in CommonJS output, so it rewrote it to an
empty object literal (`var import_meta = {}`) and printed a warning at build
time:

```
▲ [WARNING] "import.meta" is not available with the "cjs" output format and will be empty [empty-import-meta]
    server.ts:37:38:
      37 │ const __dir   = dirname(fileURLToPath(import.meta.url));
```

The warning was easy to miss because `npm run build` still exited 0 — esbuild
treats this as non-fatal. The actual failure only showed up one step later, at
`npm start`:

```
TypeError [ERR_INVALID_ARG_TYPE]: The "path" argument must be of type string
or an instance of URL. Received undefined
    at fileURLToPath (node:internal/url:...)
```

This threw at module-load time, before the Express app finished wiring up —
meaning `dist/public` (the built frontend) could never be located or served.
Every `npm run build && npm start` deploy would have failed immediately, with
no requests served at all.

**Fix:** Changed the server bundle's output format from CJS to ESM, matching
what the rest of the project already assumes:

```diff
- "build": "vite build && esbuild server.ts --bundle --platform=node --format=cjs --packages=external --sourcemap --outfile=dist/server.cjs",
- "start": "node dist/server.cjs",
+ "build": "vite build && esbuild server.ts --bundle --platform=node --format=esm --packages=external --sourcemap --outfile=dist/server.js",
+ "start": "node dist/server.js",
```

No changes were needed in `server.ts` itself — the code was already correct
ESM; only the build target was wrong. This was the lower-risk of the two
options (the alternative — rewriting `__dir` to a CJS-safe computation —
would have worked too, but would fight the project's existing `"type": "module"`
setup and `tsx`-based dev workflow rather than align with it).

**Verification performed:**
- Rebuilt and confirmed the `empty-import-meta` esbuild warning is gone.
- Inspected the compiled bundle: `import.meta.url` is preserved as real ESM
  (no `import_meta = {}` shim).
- Ran `node dist/server.js` directly — it no longer throws on the
  directory-resolution line. (It now proceeds to Prisma client
  initialization, which is the separate, already-tracked `DATABASE_URL`
  item below — not a new issue.)
- Full re-run after the fix: `npx tsc --noEmit` — 0 errors. `npx vitest run`
  — 405/405 tests, 51/51 files, no regressions.

**Files changed:** `package.json` (`build` and `start` scripts only),
`README.md` (updated two references from `dist/server.cjs` to `dist/server.js`
to match)

---

## Unchanged from v16.9 (re-verified, not re-fixed)

These were already fixed in v16.9 and were re-confirmed still intact in this
build — they did not need any changes for 16.10:

- `MIS_API_KEY` bearer-token guard on `/api/ai/*` (`server.ts`)
- Redacted `GEMINI_API_KEY` in `.env`
- Dark-mode/⌘K data-corruption fixes from Phase 16.3
- `npx tsc --noEmit`: 0 errors
- Full test suite: 405/405 passing across 51 files

---

## Remaining items (require a live environment — not fixable by static edit)

| Item | Status | Notes |
|---|---|---|
| Set `DATABASE_URL` | Pending | Must be set before `npx prisma db push` / `prisma generate` against a real schema-engine binary |
| Set `ALLOWED_ORIGINS` in prod | Pending | Required if frontend is CDN-hosted |
| Run `npx prisma generate` / `db push` | Pending | Needs network access to Prisma's engine binaries and a live DB connection |
| Configure Supabase RLS | Pending | Done in the Supabase dashboard, not in codebase |
| Rotate the previously-exposed `GEMINI_API_KEY` | **Urgent if not already done** | Carried over from v16.9 — do this in Google AI Studio regardless of code state |

Once `DATABASE_URL` is set and `npx prisma generate && npx prisma db push`
have been run against a real database, `npm run build && npm start` should
come up clean end-to-end.
