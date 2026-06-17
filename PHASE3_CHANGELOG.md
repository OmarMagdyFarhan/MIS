# Phase 3 — Intelligence Pipeline Spine

## Architecture

Evidence-first derivation chain:

```
Company → Mining Corpus → Clusters → Avatars → Avatar Offers (OfferFormula) → Market Intel → Core Offer → Rendered Copy
```

- **Canonical:** `OfferFormula`, clusters, evidence messages, provenance
- **Derived:** `generatedOffer`, hooks, `targetedOffer` display fields

## New modules

| Path | Role |
|------|------|
| `src/types/pipeline.ts` | Pipeline types |
| `src/stores/corpusStore.ts` | Company-level corpus L1–L3 |
| `src/stores/pipelineStore.ts` | Phase, stale flags, runs, core/avatar offers |
| `src/lib/pipelineGraph.ts` | DAG invalidation + nav unlocks |
| `src/lib/offerAdapters.ts` | Legacy ↔ formula adapters |
| `src/lib/pipelineMigration.ts` | Per-company backfill |
| `src/lib/runPipelineMigration.ts` | Hydration migration runner |
| `src/services/clusteringService.ts` | Cluster proposals |
| `src/services/confidenceService.ts` | Confidence scoring |
| `src/services/offerSynthesisService.ts` | Formula-first synthesis |
| `src/services/pipelineOrchestrator.ts` | Intent-based orchestration |
| `src/components/corpus/*` | Mining workspace, cluster review, core consolidation |

## UX flow (same shells)

1. **Stage 1** — Company (unchanged)
2. **Stage 2 step 0** — Company message mining + cluster review
3. **Stage 2 step 1–5** — Advanced manual core formula (bootstrap)
4. **Stage 2 step 6** — Core offer consolidation
5. **Stage 3** — Segments (mining / AI / manual / competitor)
6. **Stage 4 / Hub** — Launch & intelligence

## Backward compatibility

On load, legacy projects receive synthetic clusters for existing avatars and formula adapters for offers. Legacy `stage1/2/3Complete` flags mirror pipeline phase.

- Existing offers without corpus → hybrid corpus v1
- Avatars without `clusterId` → synthetic validated cluster (`source: ai`)
- `Offer` / `targetedOffer` → `CoreOfferRecord` / `AvatarOfferRecord` via `offerAdapters.ts`

## Quality defaults (`src/constants/pipelineThresholds.ts`)

| Constant | Default |
|----------|---------|
| `MIN_MESSAGES_VALIDATED_CLUSTER` | 3 |
| `HIGH_CONFIDENCE_MESSAGE_COUNT` | 10 |
| `CORPUS_VALIDATED_MESSAGE_COUNT` | 10 |
| `AUTO_VALIDATE_COHESION` | 0.8 |
| `AVATAR_DEDUPE_SIMILARITY` | 0.72 |
| `BOOTSTRAP_CONFIDENCE_CAP` | 0.45 |

Stale downstream artifacts require explicit **Recalculate** (no silent wipe of validated offers).

## Refinement pass (explainability)

- **ProvenancePanel** — `AvatarDeepDiveCard`, `CoreOfferConsolidation` (`src/components/provenance/`, `src/lib/provenanceResolver.ts`)
- **Cluster split** — `ClusterSplitModal` + review panel actions
- **Avatar dedupe** — `AvatarMergePanel` + `avatarDedupeService.ts`
- **Orchestrator mining** — `MessageMiningWorkspace` uses `runPipelineIntent('legacy_mining_run')`
- **PhaseNav** — pipeline phase / mode / stale strip; stage4 unlock no longer uses `stage2Complete` when pipeline state exists

## Acquisition modes

- `evidence_first` — corpus drives segments (default when 10+ messages)
- `hybrid` — legacy projects with offers but thin corpus
- `bootstrap` — cold start; provisional badges until evidence linked

## Run locally

```bash
npm install
npm run dev          # Vite + API proxy
npm run lint
npm test
npm run build
```

## Zip

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\zip-phase3.ps1
```

Output: `remix-of-mis-phase3-complete.zip` (no `node_modules`, PDFs, PSDs, ebooks, loose images, `.env`).
