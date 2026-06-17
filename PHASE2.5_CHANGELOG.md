# Phase 2.5 — Observability & Stability Changelog

## Added

### Server
- `server/ai/errors.ts` — typed errors (`AIProviderError`, `AIRateLimitError`, …)
- `server/ai/trace.ts` — trace resolution + response headers
- `server/ai/telemetry/logger.ts` — structured JSON logs + `AI_DEBUG`
- `server/ai/telemetry/hooks.ts` — pluggable lifecycle hooks
- `server/ai/telemetry/costEstimator.ts` — internal USD estimates
- `server/ai/telemetry/providerHealth.ts` — `getProviderHealth()`
- `server/ai/telemetry/usage.ts` — token usage normalization

### Client
- `src/ai/errors.ts` — mirrored typed client errors
- `src/ai/trace.ts` — `createTraceId`, header propagation
- `src/ai/debug.ts` — `VITE_AI_DEBUG` / verbose logs

### Tests
- `src/test/ai/errors.test.ts`
- `src/test/ai/trace.test.ts`

## Changed
- `executeAI()` returns `meta` on every result (latency, provider, model, retries, usage, cost estimate)
- Routes use `resolveTraceId(req)` (honors client `X-Neural-Trace`)
- Response headers: `X-Neural-Trace`, `X-AI-Latency-Ms`, `X-AI-Provider`, `X-AI-Model`, `X-AI-Retries`, `X-Cache-Hit`
- `/api/health` includes `providers: getProviderHealth()`
- Providers emit structured logs; circuit open emits hooks
- Client sends `X-Neural-Trace`; telemetry events include trace + headers
- `sseConsumer` — abort cancels reader, typed stream errors

## Unchanged
- JSON response bodies for generate/chat (`{ text, cached? }`)
- Business services, UI, prompts, workflows

## Verify & zip

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\verify-and-zip.ps1
```

Output: `remix-of-mis-phase2.5-complete.zip`
