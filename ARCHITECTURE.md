# Architecture — Marketing Intelligence SPA (MIS)

## Current Structure (Phase 3 / Phase 4)

The codebase currently follows a **service + store** layout:

```
src/
  components/      # UI components, grouped by stage (stage1/, stage2/, stage3/)
  hooks/           # React hooks (useWorkflowOrchestration.ts is the main orchestrator)
  services/        # Domain logic (avatarService, messageMiningService, pipelineOrchestrator, …)
  stores/          # Zustand stores (pipelineStore, corpusStore, synthesisStore, …)
  lib/             # Pure utilities (storage, sanitizePrompt, pipelineGraph, …)
  views/           # Route-level components / stage shells
  ai/              # Client-side AI error types and fetch wrappers
  types/           # Shared TypeScript types
server/
  ai/              # Express AI routes, providers, resilience (circuit breaker, cache, concurrency)
  logger.ts        # Shared pino logger instance
```

## Intended Feature-Slice Layout (Future Goal)

A feature-slice migration is planned but not yet started. The target structure:

```
src/features/
  avatar/          # Avatar generation, sub-avatar management, offer targeting
  company/         # Company CRUD, industry intelligence, USP builder
  corpus/          # Message mining, clustering, corpus management
  intelligence/    # Synthesis reports, scoring, competitive analysis
  offer/           # Offer formula, offer wizard, offer scoring
  scaling/         # Pipeline orchestration, scaling automation
src/shared/
  hooks/           # Cross-feature React hooks
  ui/              # Shared UI primitives (buttons, modals, toasts)
```

### Migration Plan

When migrating a domain to feature-slice layout:
1. Move `src/components/<domain>/` → `src/features/<domain>/components/`
2. Move `src/stores/<domain>Store.ts` → `src/features/<domain>/store.ts`
3. Move `src/services/<domain>*.ts` → `src/features/<domain>/services/`
4. Update all import paths and run `npm run lint && npm test` before committing.

The `corpus` domain is the recommended first migration candidate:
- `src/components/corpus/` → `src/features/corpus/components/`
- `src/stores/corpusStore.ts` → `src/features/corpus/store.ts`
- `src/services/clusteringService.ts`, `messageMiningService.ts` → `src/features/corpus/services/`

## Key Design Decisions

- **State management**: Zustand with IndexedDB persistence via `StorageManager` (LZ-compressed envelopes)
- **AI routing**: Server-side provider abstraction (Gemini primary, OpenRouter fallback) with circuit breakers, concurrency caps, and cache
- **Error handling**: Typed `AIError` with `.code` field — never match on `.message` strings
- **Security**: Prompt injection sanitisation via `sanitizeForPrompt()` before all AI interpolations; `MIS_API_KEY` guard for production `/api/ai` routes (Phase 4: full JWT auth)
- **Bundle splitting**: Vite `manualChunks` for vendor libs and lazy-loaded stage views

---

## Feature Slice Layout

The `src/features/` directory groups related code by domain rather than by technical type. The **corpus slice** is the reference implementation.

### Corpus slice file tree

```
src/features/corpus/
├── index.ts               # Public barrel — all external code imports from here only
├── store.ts               # Zustand store (moved from src/stores/corpusStore.ts)
├── types.ts               # Re-exports + domain extensions
├── components/
│   ├── ClusterReviewPanel.tsx
│   ├── ClusterSplitModal.tsx
│   ├── CompanyMiningWorkspace.tsx
│   ├── CoreOfferConsolidation.tsx
│   └── MessageMiningWorkspace.tsx
└── services/
    ├── clusteringService.ts
    ├── messageMiningService.ts
    └── messageMiningOrchestrator.ts
```

### Rule

> **External code imports only from `src/features/<name>/index.ts`**
> Never import directly from `src/features/<name>/store.ts`, `components/`, or `services/`.

### 5-step checklist for migrating future domains

1. Create `src/features/<domain>/` with `store.ts`, `types.ts`, `components/`, `services/`.
2. Move files **one at a time**. After each move, fix all broken imports. Run `npm run lint` to verify.
3. Update internal imports inside moved files to reflect the new relative depth.
4. Delete the old file only after the lint gate passes.
5. Create `src/features/<domain>/index.ts` barrel and update all external importers to use it.
