# Phase 16.8 — UX/UI Consistency Pass

Implements the fixes identified in the 16.7 UX/UI audit. No features were
added or removed; this phase is a refinement of the existing surface to
make it consistent, calmer, and easier to use for the daily marketing
workflow.

## 1. Design tokens (`src/index.css`)

- Added a real 3-step border-radius scale: `--radius-sm` (8px, inputs/badges),
  `--radius-md` (12px, cards/panels), `--radius-full` (pills/avatars).
  Eliminated 18 distinct ad-hoc radius values (20/22/24/28/30/32/36/38/40/48/
  50/56/64px) used 350+ times across components.
- Added a 5-step type scale: `--text-xs` (11px) through `--text-xl` (24px),
  each assigned a single semantic role. Eliminated 27 distinct ad-hoc font
  sizes used 700+ times.
- Added a 5-step spacing scale (`--space-xs` through `--space-xl`) for new
  work going forward.
- Standardized the brand accent color. The app previously used two
  different blues (`#0071E3` in ~29 files, `#0A84FF` in ~13 files,
  including mismatched glow/shadow rgba values) for the same semantic
  role. Everything now resolves to `#0A84FF`, the value already defined as
  `--color-accent-blue`.
- Calmed `.btn-primary` / `.btn-secondary` / `.input-premium` / focus rings
  / animation durations — these used 500-700ms transitions and 4px focus
  rings that read as heavy; trimmed to 200-300ms and 2px respectively.

## 2. Copy pass (codebase-wide)

Replaced internal/system jargon with plain language a marketer would use.
Examples: "Initialize Strategy" → "Continue", "Deploy New Project" / "Launch
Project" → "Add company", "Purge" → "Remove", "Strategic Assets" → "Your
companies", "Intelligence Matrix" → "Your Companies", "PROTOCOL_INITIALIZED:
Base repository has been established" → "You're all set", "Economic and
psychological tensors are calibrated against US MARKET BASELINES" → "Your
results are benchmarked against US market data", "{name}_LINKED" → "{name}
is set up", "Intelligence System Alert" (error toast header) → "Something
went wrong".

Also fixed the four onboarding step labels (`stepName`), which were
showing raw internal codes (`AISTUDIO`, `SEGMENTATION`, `CORE CAPABILITIES`,
`DIFFERENTIATION`, `IDENTITY_ESTABLISHED`) instead of words a user would
recognize.

## 3. Typography hierarchy

Removed `font-black` everywhere (38 files) in favor of `font-semibold` /
`font-medium`, and tightened all `tracking-widest` / `tracking-wider` /
ad-hoc wide `tracking-[0.Nem]` values (used on ~80% of secondary text) down
to `tracking-[0.06em]` or less. Per the audit, uppercase + heavy tracking is
now reserved for the one role it was designed for — short section labels —
instead of being applied to nearly all secondary copy in the app.

## 4. Navigation consolidation

- `WorkspaceSidebar` now shows a single 5-step pipeline progress strip
  (with a "Step N of 5" label) directly under the company switcher. This
  was previously invisible to users (shown only as a raw phase string like
  `clusters_validated` in `ReturningUserScreen`) or duplicated across
  `JourneyIndicator` / `PhaseNav`, both of which were legacy top-nav
  patterns superseded by the sidebar but left partially wired in.
- `StageShell`'s inline "Back to Strategy" / "Open Foundation Q&A" links
  were styled with the same heavy uppercase treatment as data labels;
  restyled as ordinary text links and relabeled in plain language.

## 5. Empty states

`EmptyState`'s icon and heading were oversized relative to the description
and action button, pulling attention away from the action-first goal.
Reduced icon from 80px→56px container / 40px→26px glyph, heading from
xl/bold→lg/semibold, and tightened spacing so the call-to-action button is
the visual anchor.

## 6. Verification

No network access was available in this environment, so a full `npm
install` / `vite build` / `tsc --noEmit` could not be run. In place of that,
every file was checked for brace/paren/bracket balance before and after
each edit pass (only one pre-existing, untouched mismatch in
`ai/jsonRecover.ts` — inside a regex literal, unrelated to this phase). All
edits were either single-token utility-class substitutions (radius, font
size, tracking, color) or scoped JSX text replacements, chosen specifically
to keep the change set mechanically safe to apply at this scale. Recommend
running `npm install && npm run typecheck && npm run build` in your own
environment before deploying.
