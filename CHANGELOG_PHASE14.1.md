# Phase 14.1 — Addendum A: Determinism & Apple-Level UX

> Applied to: Phase 14 (Customer Intelligence Engine)
> Date: June 11, 2026

---

## Summary

Phase 14.1 applies all rules from **Addendum A: Determinism & Apple-Level UX** to the Phase 14 codebase.
Two domains are addressed: **Three-Lock AI Determinism** (ensures reproducible, schema-safe AI outputs)
and **Apple-Level UX Rules** (ensures every interaction feels intentional, contextual, and trustworthy).

---

## Section 1 — Determinism: Three AI Locks

### Lock 1 — Intent Lock (Temperature Control)

**Rule:** Every AI call must declare its `taskType`. Classification and structure tasks use
temperature 0.0. Generation tasks (long-form copy only) use temperature 0.3.

**Changes:**
- **`src/types/determinism.ts`** *(new)* — Defines `AITaskType` (`'classification' | 'structure' | 'generation'`),
  `AICallContext`, and the full problem taxonomy (`PROBLEM_TAXONOMY` with 25 entries).
- **`src/ai/types.ts`** — Added `AITaskType` type and `taskType?: AITaskType` field to `AIExecuteRequest`.
- **`src/ai/legacy.ts`** — Added `taskType?: AITaskType` to `AIContentParamsBase`; propagated to `aiClient.execute()`.
- **`src/ai/client.ts`** — `taskType` now included in all outbound AI request bodies (defaults to `"structure"`).
- **`server/ai/engine.ts`** — `taskType` destructured from input and forwarded to all provider calls
  (`callGemini`, `callOpenRouter`, `callOpenRouterChat`).
- **`src/features/corpus/services/messageMiningService.ts`** — All analysis calls now declare `taskType: 'classification'`.
- **`src/features/corpus/services/clusteringService.ts`** — Clustering calls declare `taskType: 'structure'`.
- **`src/services/offerSynthesisService.ts`** — Offer formula calls declare `taskType: 'structure'`.

---

### Lock 2 — Corpus Version Lock

**Rule:** The corpus version is locked at run start. If the corpus is modified during an in-flight
pipeline run, the run is aborted with a user-visible error requiring explicit restart.

**Changes:**
- **`src/types/determinism.ts`** — Defines `CorpusModifiedDuringRunError` (thrown when corpus changes
  during run) and `assertCorpusVersion()` utility.
- **`src/services/pipelineOrchestrator.ts`** — Locks `corpusVersion` at run start; calls `checkCorpusVersion()`
  before clustering and before avatar materialization; catches `CorpusModifiedDuringRunError` specifically
  and surfaces a clear human-readable message ("New evidence was added while analysis was running.
  Please restart the analysis.").
- **`src/features/corpus/store.ts`** — `addMessage()` now marks the company system state as
  `'new-evidence'` via a lazy `pipelineStore` import (avoids circular dependency).

---

### Lock 3 — Schema Lock

**Rule:** Every AI response must be validated against its expected schema before use.
On first validation failure, retry once with a corrective prompt. On second failure, fall back
to the heuristic path (clustering) or re-throw (offer synthesis).

**Changes:**
- **`src/types/determinism.ts`** — Defines `SchemaValidationError` and three schema validators:
  `validateClusterResponse()`, `validateOfferFormulaResponse()`, `validateMessageAnalysisResponse()`.
- **`src/features/corpus/services/clusteringService.ts`** — Wraps AI call in a retry loop; calls
  `validateClusterResponse()` before use; on `SchemaValidationError` appends corrective prompt and
  retries once; falls back to heuristic clusters on second failure.
- **`src/services/offerSynthesisService.ts`** — Same retry pattern with `validateOfferFormulaResponse()`.

---

### Problem Taxonomy

**Rule:** AI assigns clusters to a predefined taxonomy entry (by ID). Labels are display only —
never compared programmatically. "ID is identity. Label is display."

**Changes:**
- **`src/types/determinism.ts`** — Defines `PROBLEM_TAXONOMY` (25 entries, `TAX_01`–`TAX_25`),
  `ProblemTaxonomyId` type, `getTaxonomyEntry()` and `getTaxonomyLabel()` utilities.

---

## Section 2 — Apple-Level UX Rules

### Rule 1 — Journey Indicator (5-Step User Journey)

**Rule:** Replace the technical stage/view navigation with a user-facing 5-step journey map.
Steps: Setup → Research → Patterns → Profiles → Intelligence.

**Changes:**
- **`src/components/JourneyIndicator.tsx`** *(new)* — Full 5-step journey indicator with:
  - Completed steps show a check; locked steps show a lock icon.
  - Active step highlighted with animated underline (`layoutId="journeyIndicator"`).
  - Navigable only to unlocked steps.
  - Maps `currentView` prop to active step number and journey step IDs back to app views.
- **`src/views/StageShell.tsx`** — `PhaseNav` replaced by `JourneyIndicator`.

---

### Rule 2 — Empty States Guide, Not Apologise

**Changes:**
- **`src/features/corpus/components/ClusterReviewPanel.tsx`** — Empty state now reads:
  *"Add 5 or more pieces of customer feedback to discover your first pattern. The system needs
  enough evidence to find a real signal — not just one person's opinion."*

---

### Rule 3 & 5 — System State Indicator (No Surprise Reanalysis)

**Rule:** The user always knows the analysis state. No background AI runs. The user is always
in control of when analysis runs.

**Changes:**
- **`src/components/SystemStateIndicator.tsx`** *(new)* — Persistent badge showing one of three
  states: `up-to-date` (green), `new-evidence` (amber + "Update" button), `analysing` (blue spinner
  with operation name). State transitions are driven by `pipelineStore.systemState`.
- **`src/stores/pipelineStore.ts`** — Added `setSystemState()` and `getSystemState()` methods;
  `systemState: 'up-to-date' | 'new-evidence' | 'analysing'` persisted per company.
- **`src/services/pipelineOrchestrator.ts`** — Sets `'analysing'` at run start, `'up-to-date'`
  on success, `'new-evidence'` on `CorpusModifiedDuringRunError`.
- **`src/features/corpus/store.ts`** — `addMessage()` sets `'new-evidence'` (lazy import, non-critical).
- **`src/views/StageShell.tsx`** — Shows `SystemStateIndicator` in Research and Patterns views;
  "Update" button triggers `runPipelineIntent` (explicit user action only — no background analysis).

---

### Rule 4 — Contextual Card Actions

**Rule:** Cards expose the right action at the right moment. No dead ends.

**Changes:**
- **`src/features/corpus/components/ClusterReviewPanel.tsx`** — Added `CardAction` interface and
  `CardActionsMenu` dropdown. Pattern cards now expose contextual actions: add evidence, split,
  merge, generate profile, see all evidence, remove. Actions appear only when meaningful (e.g.
  "Generate Customer Profile" only when cluster has enough messages).
- **`src/components/stage3/AvatarDashboard.tsx`** — Added `AvatarCardActionsMenu` dropdown on each
  Customer Profile card. Actions: add related evidence, view buying triggers, view full profile,
  see source patterns. Callbacks passed as optional props so callers opt-in.

---

### Rule 6 — Progress Reward (First Profile Milestone)

**Rule:** The product rewards meaningful progress. The first Customer Profile is a genuine milestone
that deserves a moment — not a confetti animation, but a real summary of what the system discovered.

**Changes:**
- **`src/components/ProgressRewardModal.tsx`** *(new)* — Shows evidence count, pattern count,
  profile name + description, most powerful verbatim quote, top insight, and a direct CTA to
  "View Buying Intelligence".
- **`src/views/Stage3Routes.tsx`** — Detects first avatar generation and shows `ProgressRewardModal`
  once (tracked by `useRef` to avoid repeat shows).

---

## Files Added

| File | Purpose |
|------|---------|
| `src/types/determinism.ts` | Three-Lock types, validators, problem taxonomy |
| `src/components/JourneyIndicator.tsx` | 5-step user journey indicator |
| `src/components/SystemStateIndicator.tsx` | System state badge (up-to-date / new-evidence / analysing) |
| `src/components/ProgressRewardModal.tsx` | First Customer Profile milestone modal |

## Files Modified

| File | What changed |
|------|-------------|
| `src/ai/types.ts` | `AITaskType` + `taskType` field on `AIExecuteRequest` |
| `src/ai/legacy.ts` | `taskType` on `AIContentParamsBase`, propagated to client |
| `src/ai/client.ts` | `taskType` sent in request body |
| `server/ai/engine.ts` | `taskType` forwarded to all AI providers |
| `src/features/corpus/services/clusteringService.ts` | Schema validation + retry + taskType |
| `src/services/offerSynthesisService.ts` | Schema validation + retry + taskType |
| `src/features/corpus/services/messageMiningService.ts` | taskType on all AI calls |
| `src/services/pipelineOrchestrator.ts` | Corpus version lock + system state transitions |
| `src/stores/pipelineStore.ts` | `setSystemState` / `getSystemState` |
| `src/features/corpus/store.ts` | `addMessage` marks `'new-evidence'` |
| `src/views/StageShell.tsx` | `PhaseNav` → `JourneyIndicator` + `SystemStateIndicator` |
| `src/features/corpus/components/ClusterReviewPanel.tsx` | Contextual card actions + improved empty state |
| `src/components/stage3/AvatarDashboard.tsx` | Contextual card actions |
| `src/views/Stage3Routes.tsx` | `ProgressRewardModal` on first profile |
