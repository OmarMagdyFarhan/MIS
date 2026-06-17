# Phase 2 — Browser AI Layer Changelog

## Summary

Unified all browser-side AI HTTP execution into `src/ai/` with a single `aiClient.execute()` entry point. `src/services/aiService.ts` is now a thin compatibility re-export layer.

## New files

```
src/ai/
  client.ts       — aiClient.execute() (generate | stream | chat)
  index.ts        — public exports
  jsonRecover.ts  — fence strip, brace extract, comma repair, Zod validate
  retryPolicy.ts  — JSON retry limits, backoff, AbortError guard
  timeoutLink.ts  — 95s deadline + external AbortSignal linking
  sseConsumer.ts  — SSE stream reader with [DONE] support
  telemetry.ts    — start | success | retry | error hooks
  types.ts        — AIExecuteRequest, ChatTurn, etc.
  legacy.ts       — generateAIContent, generateAIChat, stream, self-correction

src/test/ai/
  jsonRecover.test.ts
  retryPolicy.test.ts

scripts/
  verify-and-zip.ps1  — lint + test + build + distribution zip
```

## Modified files

- `src/services/aiService.ts` — re-exports only + cache stubs (no execution logic)

## Removed duplicated logic (from former aiService.ts)

| Concern | Was in | Now in |
|---------|--------|--------|
| Fetch `/api/ai/generate` | aiService | `client.ts` |
| JSON fence strip + brace slice | aiService | `jsonRecover.ts` |
| JSON retry + prompt append | aiService | `client.ts` + `retryPolicy.ts` |
| 95s timeout + abort link | aiService | `timeoutLink.ts` |
| Chat fetch | aiService | `client.ts` |
| Stream SSE loop | aiService | `sseConsumer.ts` + `client.ts` |
| getClientId | aiService | `client.ts` |
| Self-correction orchestration | aiService | `legacy.ts` (delegates to generate) |

## Backward compatibility

All existing imports from `./aiService` or `../services/aiService` continue to work:

- `generateAIContent`
- `generateAIContentStream`
- `generateAIChat`
- `generateWithSelfCorrection`
- `createAICache` / `deleteAICache`
- `AIContentParams` / `AIChatParams`

No consumer services were modified.

## Verify & zip

```powershell
cd C:\Users\omarm\remix-of-mis
powershell -ExecutionPolicy Bypass -File .\scripts\verify-and-zip.ps1
```

Produces: `remix-of-mis-phase2-complete.zip` (excludes `node_modules`, `dist`, `.git`).
