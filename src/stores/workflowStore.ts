import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';

/**
 * Workflow / navigation store (Step 8).
 *
 * Scope (pure UI navigation, no persistence):
 *  - `currentView` : top-level route inside the SPA shell
 *  - `stageStep`   : 1-based step pointer within the active stage
 *  - `avatarMethod`: selected avatar-generation method in stage 3
 *
 * Out of scope: data domain (companies/offers/synthesis/insights), modals,
 * theme. Those live in their dedicated stores.
 *
 * No persistence: navigation is intentionally session-local and resets on
 * reload — identical to the previous useState behavior in App.tsx.
 */

export type WorkflowView =
  | 'welcome'
  | 'returning'
  | 'stage1'
  | 'stage2'
  | 'stage3'
  | 'stage4'
  | 'foundation';

interface WorkflowState {
  currentView: WorkflowView;
  stageStep: number;
  avatarMethod: string | null;

  setCurrentView: (view: WorkflowView) => void;
  setStageStep: (
    next: number | ((prev: number) => number)
  ) => void;
  setAvatarMethod: (value: string | null) => void;

  /** Atomic helper: set view + step in one transition (one re-render). */
  goTo: (view: WorkflowView, step?: number) => void;
}

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  currentView: 'welcome',
  stageStep: 1,
  avatarMethod: null,

  setCurrentView: (view) => set({ currentView: view }),
  setStageStep: (next) => {
    const value =
      typeof next === 'function'
        ? (next as (p: number) => number)(get().stageStep)
        : next;
    set({ stageStep: value });
  },
  setAvatarMethod: (value) => set({ avatarMethod: value }),

  goTo: (view, step) =>
    set(step === undefined ? { currentView: view } : { currentView: view, stageStep: step }),
}));

// ─── Selector hooks ──────────────────────────────────────────────────────────

export const useCurrentView = () => useWorkflowStore((s) => s.currentView);
export const useStageStep = () => useWorkflowStore((s) => s.stageStep);
export const useAvatarMethod = () => useWorkflowStore((s) => s.avatarMethod);

export const useWorkflowActions = () =>
  useWorkflowStore(
    useShallow((s) => ({
      setCurrentView: s.setCurrentView,
      setStageStep: s.setStageStep,
      setAvatarMethod: s.setAvatarMethod,
      goTo: s.goTo,
    }))
  );
