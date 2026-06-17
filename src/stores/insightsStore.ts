import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import type { Company, ActionableInsight }  from '../types';
import type { InsightStage }  from '../services/insightService';

/**
 * Insights domain store (Step 9).
 *
 * Scope:
 *  - `stageInsights`    : Record<"{companyId}-{stage}", ActionableInsight[]>  — per-stage insight cache
 *  - `isInsightsLoading`: boolean                                              — loading spinner for insight cards
 *
 * The async `loadStageInsights` action mirrors the prior App.tsx helper:
 *   - sets isInsightsLoading true/false around the service call
 *   - stores results under `${company.id}-${stage}`
 *
 * Out of scope: insight rendering, action handlers (onAction), cross-store orchestration.
 */

interface InsightsState {
  stageInsights: Record<string, ActionableInsight[]>;
  isInsightsLoading: boolean;

  setStageInsights: (
    next:
      | Record<string, ActionableInsight[]>
      | ((prev: Record<string, ActionableInsight[]>) => Record<string, ActionableInsight[]>)
  ) => void;
  setIsInsightsLoading: (value: boolean) => void;

  /** Async helper: load insights for a given stage + data + company. */
  loadStageInsights: (
    stage: InsightStage,
    data: any,
    company: Company
  ) => Promise<void>;

  /** Clear all cached insights (e.g. on logout / reset). */
  clearInsights: () => void;
}

export const useInsightsStore = create<InsightsState>((set) => ({
  stageInsights: {},
  isInsightsLoading: false,

  setStageInsights: (next) => {
    set((state) => ({
      stageInsights:
        typeof next === 'function'
          ? next(state.stageInsights)
          : next,
    }));
  },

  setIsInsightsLoading: (value) => set({ isInsightsLoading: value }),

  loadStageInsights: async (stage, data, company) => {
    set({ isInsightsLoading: true });
    try {
      const { generateStageInsights } = await import('../services/insightService');
      const insights = await generateStageInsights(stage, data, company);
      set((state) => ({
        stageInsights: {
          ...state.stageInsights,
          [`${company.id}-${stage}`]: insights,
        },
        isInsightsLoading: false,
      }));
    } catch (err) {
      console.error('Insights load failed', err);
      set({ isInsightsLoading: false });
    }
  },

  clearInsights: () => set({ stageInsights: {}, isInsightsLoading: false }),
}));

// ─── Selector hooks ──────────────────────────────────────────────────────────

export const useStageInsights = () => useInsightsStore((s) => s.stageInsights);
export const useIsInsightsLoading = () => useInsightsStore((s) => s.isInsightsLoading);

export const useInsightsActions = () =>
  useInsightsStore(
    useShallow((s) => ({
      setStageInsights: s.setStageInsights,
      setIsInsightsLoading: s.setIsInsightsLoading,
      loadStageInsights: s.loadStageInsights,
      clearInsights: s.clearInsights,
    }))
  );
