import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import type { SynthesisReport } from '../services/synthesisService';

/**
 * Synthesis domain store (Step 7).
 *
 * Scope:
 *  - `isSynthesizing`   : boolean              — drives the synthesis overlay
 *  - `synthesisReport`  : SynthesisReport|null — latest report payload
 *  - `synthesisStage`   : string               — 'Identity' | 'Strategy' | 'Modeling' | ''
 *
 * Non-reactive (kept on the store instance, NOT in React state):
 *  - `abortController`        : current in-flight AbortController
 *  - `lastRequestTimestamp`   : monotonic timestamp of the latest request
 *
 * These mirror the previous `synthesisAbortRef` / `lastSynthesisTimestampRef`
 * in App.tsx exactly. They live on the store object (not in `set`) to avoid
 * unnecessary re-renders while preserving identical race-condition semantics.
 *
 * Orchestration (calling synthesisService, deciding next stageStep, etc.)
 * stays in App.tsx — this store only owns synthesis lifecycle primitives.
 */

interface SynthesisRequestHandle {
  signal: AbortSignal;
  timestamp: number;
  isLatest: () => boolean;
}

interface SynthesisState {
  isSynthesizing: boolean;
  synthesisReport: SynthesisReport | null;
  synthesisStage: string;

  // Non-reactive instance fields.
  _abortController: AbortController | null;
  _lastRequestTimestamp: number;

  /**
   * Begin a new synthesis request:
   *   - aborts any in-flight controller
   *   - allocates a fresh AbortController and timestamp
   *   - sets isSynthesizing=true, synthesisStage=stage, synthesisReport=null
   * Returns a handle the caller uses to check staleness and read the signal.
   */
  beginRequest: (stage: string) => SynthesisRequestHandle;

  /** Abort the current controller without touching reactive state. */
  cancelCurrent: () => void;

  setIsSynthesizing: (value: boolean) => void;
  setSynthesisReport: (value: SynthesisReport | null) => void;
  setSynthesisStage: (value: string) => void;

  /** Clear report + stage + stop synthesizing (used by manual close). */
  reset: () => void;
}

export const useSynthesisStore = create<SynthesisState>((set, get) => ({
  isSynthesizing: false,
  synthesisReport: null,
  synthesisStage: '',
  _abortController: null,
  _lastRequestTimestamp: 0,

  beginRequest: (stage) => {
    const prev = get()._abortController;
    if (prev) prev.abort();

    const controller = new AbortController();
    const timestamp = Date.now();

    // Mutate non-reactive fields directly to avoid re-renders.
    const s = get();
    s._abortController = controller;
    s._lastRequestTimestamp = timestamp;

    set({
      isSynthesizing: true,
      synthesisStage: stage,
      synthesisReport: null,
    });

    return {
      signal: controller.signal,
      timestamp,
      isLatest: () =>
        !controller.signal.aborted &&
        get()._lastRequestTimestamp === timestamp,
    };
  },

  cancelCurrent: () => {
    const c = get()._abortController;
    if (c) c.abort();
  },

  setIsSynthesizing: (value) => set({ isSynthesizing: value }),
  setSynthesisReport: (value) => set({ synthesisReport: value }),
  setSynthesisStage: (value) => set({ synthesisStage: value }),

  reset: () => {
    // Abort in-flight request if any
    const c = get()._abortController;
    if (c) c.abort();
    
    set({
      isSynthesizing: false,
      synthesisReport: null,
    });
  },
}));

// ─── Selector hooks ──────────────────────────────────────────────────────────

export const useIsSynthesizing = () =>
  useSynthesisStore((s) => s.isSynthesizing);
export const useSynthesisReport = () =>
  useSynthesisStore((s) => s.synthesisReport);
export const useSynthesisStage = () =>
  useSynthesisStore((s) => s.synthesisStage);

export const useSynthesisActions = () =>
  useSynthesisStore(
    useShallow((s) => ({
      beginRequest: s.beginRequest,
      cancelCurrent: s.cancelCurrent,
      setIsSynthesizing: s.setIsSynthesizing,
      setSynthesisReport: s.setSynthesisReport,
      setSynthesisStage: s.setSynthesisStage,
      reset: s.reset,
    }))
  );
