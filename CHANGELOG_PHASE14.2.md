# Phase 14.2 Hardening Layer — Changelog

## Summary
11 issues fixed across security, data integrity, UI feedback, and type safety.

---

## Issue 1 — CRITICAL: Relevance Filter (new service)
**File:** `src/features/corpus/services/relevanceFilterService.ts` (new)
**File:** `src/features/corpus/services/messageMiningOrchestrator.ts`

- Created `filterRelevantMessages()` — single AI call batch-classifies messages against company + offer context
- Integrated into `runMessageMiningAnalysis()` after quality gate, before `analyzeMessages()`
- Fails open (returns `isRelevant: true`) on AI parse error to avoid blocking users

---

## Issue 2 — CRITICAL: Clustering now receives Offer context
**File:** `src/features/corpus/services/clusteringService.ts`
**File:** `src/services/pipelineOrchestrator.ts`

- Added optional `offer?: Offer` parameter to `proposeClustersFromMessages()`
- Offer's `generatedOffer` or `product` injected into clustering prompt
- `pipelineOrchestrator.ts` passes `options.currentOffer` through; added `currentOffer` to options type

---

## Issue 3 — CRITICAL: Prompt injection protection expanded
**File:** `src/lib/sanitizePrompt.ts`
**File:** `src/features/corpus/services/messageMiningService.ts`

- Added 11 new injection patterns: `forget all previous`, `act as if you are`, `pretend you are`, `your new role is`, `override all`, `reveal your system prompt`, `[/INST]`, `<|im_end|>`, HTML comments, `<system>` tags
- Added `sanitizeEvidenceText()` — wraps quotes in `<customer_quote>` delimiters, enforces 500-char cap
- `analyzeMessages()` now uses `sanitizeEvidenceText()` instead of raw string interpolation

---

## Issue 4 — HIGH: Duplicate message detection
**File:** `src/features/corpus/store.ts`

- Added `normalizeText()` helper (trim + lowercase + collapse whitespace)
- `addMessage()` performs normalized dedup check before inserting; returns existing message for duplicates
- `setMessages()` (bulk import) deduplicates on normalized key before storing

---

## Issue 5 — HIGH: Avatar Readiness Score includes relevance
**File:** `src/constants/pipelineThresholds.ts`
**File:** `src/types/pipeline.ts`

- Added `relevanceScore` parameter (0–1, default `1.0`) to `computeAvatarReadinessScore()`
- `evidenceVolume` max reduced 30→25 to keep total at 100
- `relevancePoints` = `Math.round(relevanceScore * 20)` — max 20 points
- `sourcePoints` recalibrated (3→5, 2→3, 1→1) to fit new total
- Relevance < 0.6 adds `gaps[]` warning: "Evidence may not be relevant to your business"
- Added `relevanceScore?: number` field to `Cluster` type in `pipeline.ts`

---

## Issue 6 — HIGH: Input rate limiting & corpus size cap
**File:** `src/constants/pipelineThresholds.ts`
**File:** `src/features/corpus/services/messageMiningOrchestrator.ts`
**File:** `src/features/corpus/store.ts`

- Added `MAX_MESSAGES_PER_BATCH: 50` and `MAX_CORPUS_SIZE: 500` to `PIPELINE_THRESHOLDS`
- `runMessageMiningAnalysis()` throws with descriptive error if batch exceeds limit
- `addMessage()` silently rejects and returns last message as sentinel when corpus is at cap

---

## Issue 7 — HIGH: Low confidence warnings visible in UI
**File:** `src/components/stage3/CitedClaimDisplay.tsx`
**File:** `src/components/stage3/AvatarDeepDiveCard.tsx`

- `CitedClaimDisplay` now shows numeric percentage in low-confidence warning badge
- Added SVG triangle warning icon with `!` for confidence < 0.5 (even without `lowConfidence` flag)
- `AvatarDeepDiveCard` shows amber warning banner when `pipelineMetadata.scoreGateDecision === 'insufficient_evidence'`

---

## Issue 8 — IMPORTANT: Source attribution in evidence
**File:** `src/components/stage3/CitedClaimDisplay.tsx`

The component already had full source attribution UI (collapsible "N supporting messages" with quoted evidence). Verified and no additional changes needed — functionality was present in Phase 14.1.

---

## Issue 9 — IMPORTANT: Multi-tenant company isolation
**File:** `src/features/corpus/store.ts`

- Added `activeUserId: string | null` and `companyOwners: Record<string, string>` to store state
- Added `setActiveUser()`, `registerCompanyOwner()`, `assertCompanyAccess()` actions
- `assertCompanyAccess()` is called at the top of `addMessage()`, `removeMessage()`, `setClusters()`
- Skips check when `activeUserId` is null (backward compat for single-user mode)

---

## Issue 10 — IMPORTANT: AI Provider tracking in Avatar metadata
**File:** `src/types/phase10.ts`

- Added `modelUsed?: string` and `providerUsed?: 'gemini' | 'openrouter'` to `AvatarGeneration` interface
- Fields are optional for backward compatibility

---

## Issue 11 — IMPORTANT: Message quality gate
**File:** `src/features/corpus/services/relevanceFilterService.ts`
**File:** `src/features/corpus/services/messageMiningOrchestrator.ts`

- Created `scoreMessageQuality()` in `relevanceFilterService.ts`
- Rejects: < 10 chars, alpha ratio < 30%, repeated-char spam (`.{9,}` repetition), all-caps > 20 chars
- Supports non-Latin alphabets (Arabic, Chinese, Latin Extended) in alpha ratio calculation
- Applied in `runMessageMiningAnalysis()` as first filter before relevance check and batch cap

---

## Tests added
| File | Issues covered |
|------|---------------|
| `src/test/relevanceFilterService.test.ts` | 1, 11 |
| `src/test/sanitizePrompt.test.ts` | 3 (extended + sanitizeEvidenceText) |
| `src/test/corpusStore.test.ts` | 4, 6, 9 |
| `src/test/confidenceService.test.ts` | 5 |
| `src/test/deltaClusteringService.test.ts` | 2 |
| `src/test/phase14_2_hardening.test.ts` | 6, 7, 8, 10 |
