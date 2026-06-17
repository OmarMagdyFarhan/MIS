# CHANGELOG — Phase 15: Guided Workspace

Transforms the application from a gated, wizard-based sequential flow into a
Guided Workspace / meta-level SaaS experience (Meta Business Suite / HubSpot /
Notion / Linear style), per `PHASE15_WORKSPACE_AUDIT.md`. All existing stores,
AI services, pipeline orchestration, and types are preserved — this phase is
primarily a presentation-layer re-architecture plus targeted bug fixes
required to make lint/test/build pass.

## Priority 1 — Workspace Layout

- **New `src/components/WorkspaceSidebar.tsx`**: persistent left sidebar
  (Linear/Notion style) with a company switcher and five always-visible
  workspace tabs (Overview, Evidence, Segments, Intelligence, Strategy).
  "Locked" steps show a subtle lock icon instead of being hidden/blocked.
- **`src/views/StageShell.tsx` rewritten**: now renders the workspace canvas
  driven by `uiStore.activeTab` instead of the old gated `JourneyIndicator`
  stepper. Existing `Stage1Routes` / `Stage2Routes` / `Stage3Routes` /
  `Stage4View` / `FoundationView` are reused unchanged and mapped onto the
  five tabs:
  - Overview → Stage1Routes (company setup)
  - Evidence → Stage2Routes (corpus mining)
  - Segments → Stage3Routes (clusters & avatars)
  - Intelligence → new `IntelligenceTab` (FeelWheel hero + market/buying
    insights)
  - Strategy → Stage4View, with a link into FoundationView
- **`src/App.tsx`**: removed double navigation. `ModuleHeader` and the
  `JourneyIndicator` stepper are no longer mounted; `stage4`/`foundation`
  are now rendered inside the workspace shell (via `StageShell`) rather than
  as separate full-page views. The floating Intelligence Hub FAB and
  full-screen `IntelligenceHub` overlay have been removed in favor of the
  Intelligence tab + global search. `currentView`/`stageStep` are preserved
  internally so existing orchestration (`useWorkflowOrchestration`) continues
  to work unchanged; a small sync effect keeps the sidebar's active tab in
  step with orchestration-driven navigation (e.g. after synthesis).
- **`src/components/JourneyIndicator.tsx`**: `getJourneyStep()` exported for
  reuse by `WorkspaceSidebar` (single source of truth for "how far has this
  company progressed").
- `ModuleHeader.tsx`, `PhaseNav.tsx`, and the old `JourneyIndicator` stepper UI
  are left in place but unmounted from the main flow (no longer part of the
  active navigation).

## Priority 2 — Next Best Action System

- **New `src/services/nextBestActionService.ts`**: pure function
  `getNextBestAction()` derives a single prioritized suggestion from existing
  pipeline phase, stale flags, avatars, and corpus/cluster counts. Never
  triggers pipeline runs — suggestions are navigational only (Rule 4
  preserved).
- **New `src/components/NextBestAction.tsx`**: persistent banner (Shopify
  Setup Guide style) shown at the top of the workspace canvas. Examples:
  "Add 2 more customer quotes", "Review 3 generated segments", "Generate your
  customer profiles", "Deep dive 'Beta'", "You're all caught up".
- New test: `src/test/nextBestActionService.test.ts`.

## Priority 3 — Skeleton Loaders

- **New `src/components/SkeletonLoaders.tsx`**: `ContextualLoadingMessage`,
  `SkeletonCard`, `SkeletonQuote`, `SkeletonFeelWheel`, and
  `ContextualSectionLoader` (rotating contextual messages + skeleton card
  grid), replacing generic `Loader2` full-section spinners.
- `src/components/stage2/GeneratingScreen.tsx` rewritten to use
  `ContextualSectionLoader` with messages like "Reviewing your company
  profile…", "Matching your offer to customer language…".
- `src/components/SectionFallback.tsx` rewritten to use
  `ContextualLoadingMessage` with a contextual `label` instead of a generic
  spinner, while preserving its existing `label`/`compact` API.

## Priority 4 — Evidence Drawer

- **New `src/components/EvidenceDrawer.tsx`**: global right-side drawer
  ("GitHub blame view") showing original quotes, confidence, and supporting
  evidence for any claim. Opened via `uiStore.openEvidenceDrawer(context)`.
- **New `src/components/ConfidenceBadge.tsx`**: shared High/Medium/Low
  confidence badge (>=0.7 / >=0.4 / below), used by the drawer and
  `CitedClaimDisplay`.
- **`src/components/stage3/CitedClaimDisplay.tsx` rewritten**: every cited
  claim is now clickable and opens the Evidence Drawer with its
  `supportingMessageIds`-resolved messages, confidence, and label. Existing
  inline expand-to-quotes behavior is preserved alongside the new drawer
  trigger.
- New `uiStore` slices: `evidenceDrawer` (open/close + context),
  `commandPalette` (see Priority 6), `activeTab` (see Priority 1).

## Priority 5 — FeelWheel Hero

- **New `src/hooks/useCompanyEmotionMessages.ts`**: per-company message
  source for `FeelWheel`, extracted from the cross-company
  `FeelWheelWrapper` previously hidden inside `IntelligenceHub`.
- **New `src/views/IntelligenceTab.tsx`**: FeelWheel is now the hero element
  at the top of the Intelligence tab ("Google Analytics overview" style),
  followed by `MarketIntelligencePanel`, `BuyingInsightsPanel`, and
  `ActionableInsightsCard` — all reused from `components/intel/*` without
  modification to their internals. Empty/loading states use
  `SkeletonFeelWheel` and `EmptyState`.

## Priority 6 — Global Search (Command Palette)

- **New `src/services/globalSearchService.ts`**: `searchWorkspace()` searches
  companies, avatars, segments (clusters), and actionable insights, reading
  directly from `companyStore`, `offerStore`, and the corpus store.
- **New `src/components/CommandPalette.tsx`**: ⌘K / Ctrl+K command palette
  (Linear/Notion style) with keyboard navigation (↑/↓/Enter), mounted
  globally in `App.tsx`. Selecting a result switches the active company and
  workspace tab.
- New test: `src/test/globalSearchService.test.ts`.

## Visual hierarchy, confidence badges, empty states, errors, celebrations

- **`src/components/stage3/AvatarDashboard.tsx`**: avatar cards are now
  grouped by `uiMetadata.priorityLabel` into three visual tiers — primary
  avatars render as large hero cards (2-col grid), secondary avatars as
  medium cards (3-col grid), and low-priority avatars as a compact list
  (GitHub-issue-row style). `AvatarCard` gained a `size: 'hero' | 'medium' |
  'compact'` prop.
- **`ConfidenceBadge`** (new) is used wherever a `CitedClaim` or insight shows
  a confidence score, replacing the previous ad-hoc progress-bar/warning-icon
  markup with a consistent High/Medium/Low badge.
- **New `src/lib/humanizeError.ts`**: converts technical error messages (e.g.
  "Pipeline failed", network/JSON/auth errors) into human-readable
  explanations with a likely cause and next step. Wired into
  `pipelineOrchestrator.ts`, `CompanyMiningWorkspace.tsx`, and
  `EvidenceInbox.tsx`.
- **`src/components/ProgressRewardModal.tsx`**: first-avatar celebration now
  includes a confetti burst (`src/components/ConfettiBurst.tsx`, new),
  Duolingo-style headline ("Your first customer profile is ready."), and a
  suggested next action ("Next up: explore the buying intelligence behind
  it.").
- `EmptyState` usage extended in the new `EvidenceDrawer` and
  `IntelligenceTab` for "no evidence yet" / "no emotional signal yet" states
  (icon + headline + explanation, consistent with existing `EmptyState`
  component).

## Bug fixes required for lint / test / build to pass

These were pre-existing issues uncovered while wiring the new workspace shell
and evidence drawer through the pipeline/corpus layers. None change intended
business behavior; all are either dead-code/syntax bugs or type
mismatches between callers and implementations.

- **`src/features/corpus/store.ts`**: fixed dynamic `import('../stores/...')`
  path (was resolving outside `src/`, silently failing) to
  `import('../../stores/pipelineStore')` — the "mark new-evidence on add"
  side effect now actually runs.
- **`src/lib/pipelineGraph.ts`**:
  - Fixed malformed `DOWNSTREAM` map (`market_intel: [, 'rendered_copy']`
    produced a sparse array with an `undefined` element, crashing
    `markStale` with "DOWNSTREAM[current] is not iterable").
  - Fixed two no-argument `order.indexOf()` calls in
    `pipelinePhaseToLegacyFlags` (`stage2Complete` now correctly derived from
    `corpus_analyzed`) and `isStageUnlockedForPipeline` (`stage5`, which
    doesn't correspond to any real stage, now returns `false`).
- **`src/views/Stage3Routes.tsx`**: fixed an unclosed `<div>`/`<>` fragment
  that broke the production build.
- **`server/ai/providers/geminiProvider.ts` /
  `server/ai/providers/openrouterProvider.ts`**: added optional `taskType?:
  string` to `GeminiCallParams`, `OpenRouterParams`, and
  `OpenRouterChatParams`; threaded `taskType` through
  `postOpenRouterChat`/`callOpenRouter` so the existing
  `temperature: taskType === 'generation' ? 0.3 : 0.0` logic in
  `server/ai/engine.ts` type-checks and works as originally intended.
- **`src/components/FormulaEditorModal.tsx`** /
  **`src/constants/offerSteps.ts`**: fixed references to non-existent
  `OfferStep.name` / `.example` / `Offer.reasonToActNow` fields — now use the
  existing `label`, `description`, and `reason` fields.
- **`src/components/IntelligenceHub.tsx`**: added missing
  `BuyingInsightsPanel` import.
- **`src/components/SystemStateIndicator.tsx`**: fixed reference to
  non-existent `PipelineRun.currentStep` → `PipelineRun.progress.step`.
- **`src/components/stage3/AvatarDashboard.tsx`**:
  - Added missing `runPipelineIntent` and `computeAvatarReadinessScore`
    imports.
  - Fixed `runPipelineIntent(company, 'materialize_avatars', { clusters,
    onAvatarCreated })` call to match the actual options shape
    (`clusterIds: string[]`, `callbacks: { onAvatarCreated }`).
- **`src/components/stage3/AvatarMergePanel.tsx`**: removed a dead
  always-truthy `||` fallback.
- **`src/features/corpus/components/ClusterReviewPanel.tsx`**: fixed
  reference to non-existent `ClusterIntegrityReport.issues` → `.reason`.
- **`src/services/avatarServiceV2.ts`**: added missing
  `PIPELINE_THRESHOLDS` import.
- **`src/services/consistencyCheckService.ts`**: fixed reference to
  non-existent `targetedOffer.formula.transformation` →
  `targetedOffer.transformation`.
- **`src/features/corpus/services/messageMiningService.ts` /
  `messageMiningOrchestrator.ts`**: reordered/relaxed parameters so optional
  `offer?: Offer` no longer precedes required parameters
  (`createAvatarFromMessage`, `runMessageMiningAnalysis`, `analyzeMessages`);
  updated the one internal caller and the corresponding test.
- **Test fixes** (pre-existing failures, not caused by Phase 15 features):
  - `src/test/foundationFeedbackService.test.ts`: the "non-writeback
    question" case used `brand_story`, which *is* a writeback question by
    design — switched to a question id with genuinely no handler.
  - `src/test/provenanceMigrationDedupe.test.ts`: `syncProgressWithPipeline`
    test now seeds `byCompany[COMPANY.id]` with a `corpus_analyzed` phase
    before asserting on the derived legacy flags.
  - `src/test/corpusStore.test.ts`: the `MAX_CORPUS_SIZE` stress test (510
    sequential `addMessage` calls, each now also performing the
    newly-functional async "mark new evidence" side effect) given a longer
    timeout (20s) to avoid flaking under the default 5s limit.

## New files

- `src/components/WorkspaceSidebar.tsx`
- `src/components/NextBestAction.tsx`
- `src/components/EvidenceDrawer.tsx`
- `src/components/ConfidenceBadge.tsx`
- `src/components/CommandPalette.tsx`
- `src/components/ConfettiBurst.tsx`
- `src/components/SkeletonLoaders.tsx`
- `src/views/IntelligenceTab.tsx`
- `src/hooks/useCompanyEmotionMessages.ts`
- `src/services/nextBestActionService.ts`
- `src/services/globalSearchService.ts`
- `src/lib/humanizeError.ts`
- `src/test/nextBestActionService.test.ts`
- `src/test/globalSearchService.test.ts`

## Verification

- `npm run lint` (tsc --noEmit) — passes, 0 errors.
- `npm test` (vitest) — 348/348 tests pass across 47 files.
- `npm run build` — succeeds (client + server bundles).
