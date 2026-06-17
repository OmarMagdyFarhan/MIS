# Phase 14 — Changelog

## Summary
Complete audit implementation based on the Customer Intelligence Engine Audit.
All Replit Agent repair regressions fixed. Core Offer fully removed.
New intelligence layers added. UX terminology updated.

---

## Critical Fixes (Runtime Crashes)

### pipelineOrchestrator.ts
- **FIXED** `getOfferContext()` phantom `core` variable — removed function entirely
- Pipeline now passes `Company` directly to analysis functions
- Removed `offer` parameter from `analyzeMessages`, `proposeClustersFromMessages`, `deriveMarketIntelligence`, `deepDiveAvatar` calls

### pipelineMigration.ts
- **FIXED** `getLegacyOfferForCompany()` phantom `core` variable — removed function entirely
- Removed `coreRecordToLegacyOffer` import (export never existed)

### offerSynthesisService.ts
- **FIXED** orphaned function body after dangling template literal
- Removed 300+ chars of syntactically invalid orphaned code
- `buildAvatarOfferRecord` fully restored with correct signature

### offerAdapters.ts
- Removed phantom import stubs for `coreRecordToLegacyOffer` and `legacyOfferToFormula`

### Stage3Routes.tsx
- **FIXED** `getLegacyOfferForCompany` call removed — replaced with direct store lookup

---

## Core Offer Complete Removal

### Deleted Files
- `src/services/offerWizardService.ts`
- `src/components/stage2/OfferStep.tsx`
- `src/components/stage2/OfferResult.tsx`

### Modified Files
- `src/views/FoundationView.tsx` — Core Offer tab removed; replaced with Evidence Summary bar and plain-language Foundation tabs (Market / Product / Brand / Model)
- `src/views/Stage4View.tsx` — "Synthesize your Core Offer" language removed
- `src/views/StageShell.tsx` — `endWizardSession` import removed
- `src/features/corpus/services/clusteringService.ts` — `offer` parameter removed from `proposeClustersFromMessages`
- `src/services/messageMiningService.ts` — `offer` parameters made optional throughout
- `src/services/avatarService.ts` — `deepDiveAvatar` signature updated (offer removed)
- `src/services/planService.ts` — `offer` parameter made optional

### Retained (intentionally)
- `offerAdapters.ts` — `avatarToOfferRecord` still used for pipeline offer records
- `offerStore.ts` — stores pipeline progress state (not offer data)
- `offerSynthesisService.ts` — retained for avatar offer formula synthesis (different from Core Offer)
- `constants/offerSteps.ts` — restored as minimal stub for `FormulaEditorModal`

---

## Intelligence Architecture — New Layers

### New: `src/services/mvaAggregationService.ts`
- Aggregates Motivation / Value / Anxiety signals from analyzed evidence
- `CompanyMVAProfile` — persisted per company in `pipelineStore`
- `aggregateMVAProfile()` — pure aggregation, no AI calls
- `getTopSignals()` — ranked signals for Intelligence Hub summary
- Computes coverage (motivationCovered, valueCovered, anxietyCovered)

### New: `src/services/conversionIntelligenceService.ts`
- Aggregates ConversionSignalTags into `ConversionIntelligenceProfile`
- Buckets: buyingTriggers, trustDrivers, objections, frictionPoints, conversionOpportunities, riskFactors
- Also aggregates from conversionAspects (purchasePrompts → buyingTriggers, objections → objections)
- Pure aggregation, no AI calls

### Updated: `src/stores/pipelineStore.ts`
- Added `mvaProfiles`, `conversionIntelligence` state
- Added `setMVAProfile`, `setConversionIntelligence`, `getMVAProfile`, `getConversionIntelligence`

### Updated: `src/services/pipelineOrchestrator.ts`
- After `corpus_analyzed` phase: computes and stores MVA profile + Conversion Intelligence
- Both update incrementally on every analysis run

---

## New UI Components

### `src/components/IntelligenceCompletenessBar.tsx`
- Shows Motivation / Value / Anxiety coverage bars
- Status: Strong / Building / Missing
- Suggests specific gaps when domains are missing
- Added to `Stage2Routes.tsx` (Research screen)

### `src/components/intel/BuyingInsightsPanel.tsx`
- Replaces old Core Offer / Offers tab in Intelligence Hub
- Surfaces: Buying Triggers, Trust Drivers, Objections, Friction Points, Opportunities
- Shows MVA desired outcomes alongside conversion signals
- Empty state with specific guidance

---

## Determinism Fixes

### AI Providers
- `server/ai/providers/geminiProvider.ts` — temperature enforcement: `0.0` for classification/structure, `0.3` for generation
- `server/ai/providers/openrouterProvider.ts` — same temperature enforcement

### Types
- `server/ai/types.ts` — added `AITaskType = 'classification' | 'structure' | 'generation'` to `AIExecuteInput`

---

## Avatar Quality Gate

### `src/constants/pipelineThresholds.ts`
- `MIN_MESSAGES_VALIDATED_CLUSTER`: 1 → **5**
- `AUTO_VALIDATE_COHESION`: 0.55 → **0.65**
- `MIN_MESSAGES_FOR_CLUSTERING`: 1 → **5**
- Added `AVATAR_READINESS_MIN_SCORE: 60`
- Added `AVATAR_MIN_EVIDENCE_SOURCES: 2`
- New: `computeAvatarReadinessScore()` — returns score (0-100), breakdown, ready flag, gaps

### `src/services/avatarServiceV2.ts`
- Minimum threshold updated to use `PIPELINE_THRESHOLDS.MIN_MESSAGES_VALIDATED_CLUSTER` (5)
- Cohesion threshold updated to use `PIPELINE_THRESHOLDS.AUTO_VALIDATE_COHESION` (0.65)

### `src/components/stage3/AvatarDashboard.tsx`
- Cluster cards now show Avatar Readiness Score (0-100) with progress bar
- Status: "Ready to generate" (≥60) or "Needs more evidence" (<60)
- Specific gap suggestions displayed when not ready
- Button label: "Generate Avatar" → "Generate Profile"

---

## UX Terminology Updates

| Old Term | New Term |
|---|---|
| Core Offer | (removed) |
| Corpus v{n} · {n} messages | Research Library · {n} evidence pieces |
| evidence_first | Start with Research |
| hybrid | Research + Context |
| bootstrap | Start with Knowledge |
| {n}% cohesion | Strong Theme / Developing Theme / Early Signal |
| Low-cohesion clusters produce inaccurate avatars | Plain-language gap explanation |
| provisional | Early Insight |
| validated | Confirmed |
| overview (tab) | Summary |
| avatars (tab) | Customer Profiles |
| offers (tab) | Buying Insights |
| Feel Wheel 🎡 | Emotional Map |

---

## Intelligence Hub

- **Removed** Offers tab (Core Offer content)
- **Added** Buying Insights tab → `BuyingInsightsPanel`
- Tab labels updated to plain language
- Tab type updated from `'offers'` to `'buying-insights'`

---

## Home Page

- `src/views/WelcomeView.tsx` rewritten
- New headline: "Understand why customers buy — and what stops them."
- 3-step visual: Add Evidence → Find Patterns → Get Profiles
- CTA: "Analyse My First Customer"

---

## Routing Fix

- `src/hooks/useWorkflowOrchestration.ts`
- Completed pipelines (`avatar_offers_ready`, `pipeline_complete`) now route to `stage4` (Intelligence Hub)
- Previously incorrectly routed to `stage2` (Research)

---

## Files Added
- `src/services/mvaAggregationService.ts`
- `src/services/conversionIntelligenceService.ts`
- `src/components/IntelligenceCompletenessBar.tsx`
- `src/components/intel/BuyingInsightsPanel.tsx`
- `CHANGELOG_PHASE14.md`

## Files Deleted
- `src/services/offerWizardService.ts`
- `src/components/stage2/OfferStep.tsx`
- `src/components/stage2/OfferResult.tsx`
