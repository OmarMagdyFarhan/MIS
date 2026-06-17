import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import type { EvidenceMessage } from '../types/pipeline';

export type PendingSaveType = 'company' | 'offer' | null;

/** Workspace tabs (Phase 15) — replaces stage1-4 page navigation. */
export type WorkspaceTab = 'overview' | 'evidence' | 'segments' | 'intelligence' | 'strategy';

/** Context passed to the Evidence Drawer describing what's being inspected. */
export interface EvidenceDrawerContext {
  /** Title shown at the top of the drawer, e.g. the claim text */
  title: string;
  /** Optional confidence score (0-1) */
  confidence?: number;
  /** Evidence messages backing this claim/insight */
  messages: EvidenceMessage[];
  /** Optional label describing what kind of artifact this evidence supports */
  sourceLabel?: string;
}

interface UIState {
  // Intelligence Hub
  isHubOpen: boolean;
  openHub: () => void;
  closeHub: () => void;

  // Workspace (Phase 15)
  activeTab: WorkspaceTab;
  setActiveTab: (tab: WorkspaceTab) => void;

  // Evidence Drawer (Phase 15)
  evidenceDrawer: EvidenceDrawerContext | null;
  openEvidenceDrawer: (context: EvidenceDrawerContext) => void;
  closeEvidenceDrawer: () => void;

  // Command Palette / Global Search (Phase 15)
  isCommandPaletteOpen: boolean;
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
  toggleCommandPalette: () => void;

  // Modals
  showFormulaModal: boolean;
  openFormulaModal: () => void;
  closeFormulaModal: () => void;

  showCompanyModal: boolean;
  openCompanyModal: () => void;
  closeCompanyModal: () => void;

  // Conflict modal
  showConflictModal: boolean;
  pendingSaveType: PendingSaveType;
  openConflictModal: (type: Exclude<PendingSaveType, null>) => void;
  closeConflictModal: () => void;

  // Toasts
  successToast: string | null;
  errorToast: string | null;
  showSuccess: (msg: string, ttlMs?: number) => void;
  showError: (msg: string) => void;
  dismissSuccess: () => void;
  dismissError: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  isHubOpen: false,
  openHub: () => set({ isHubOpen: true }),
  closeHub: () => set({ isHubOpen: false }),

  activeTab: 'overview',
  setActiveTab: (tab) => set({ activeTab: tab }),

  evidenceDrawer: null,
  openEvidenceDrawer: (context) => set({ evidenceDrawer: context }),
  closeEvidenceDrawer: () => set({ evidenceDrawer: null }),

  isCommandPaletteOpen: false,
  openCommandPalette: () => set({ isCommandPaletteOpen: true }),
  closeCommandPalette: () => set({ isCommandPaletteOpen: false }),
  toggleCommandPalette: () => set((s) => ({ isCommandPaletteOpen: !s.isCommandPaletteOpen })),

  showFormulaModal: false,
  openFormulaModal: () => set({ showFormulaModal: true }),
  closeFormulaModal: () => set({ showFormulaModal: false }),

  showCompanyModal: false,
  openCompanyModal: () => set({ showCompanyModal: true }),
  closeCompanyModal: () => set({ showCompanyModal: false }),

  showConflictModal: false,
  pendingSaveType: null,
  openConflictModal: (type) => set({ showConflictModal: true, pendingSaveType: type }),
  closeConflictModal: () => set({ showConflictModal: false }),

  successToast: null,
  errorToast: null,
  showSuccess: (msg) => set({ successToast: msg }),
  showError: (msg) => set({ errorToast: msg }),
  dismissSuccess: () => set({ successToast: null }),
  dismissError: () => set({ errorToast: null }),
}));

// Ensure dark class is always applied
if (typeof document !== 'undefined') {
  document.documentElement.classList.add('dark');
}

// ─── Selector hooks (minimize rerenders) ────────────────────────────────

export const useHubOpen = () => useUIStore((s) => s.isHubOpen);
export const useHubControls = () =>
  useUIStore(useShallow((s) => ({ openHub: s.openHub, closeHub: s.closeHub })));

export const useFormulaModal = () =>
  useUIStore(useShallow((s) => ({
    isOpen: s.showFormulaModal,
    open: s.openFormulaModal,
    close: s.closeFormulaModal,
  })));

export const useCompanyModal = () =>
  useUIStore(useShallow((s) => ({
    isOpen: s.showCompanyModal,
    open: s.openCompanyModal,
    close: s.closeCompanyModal,
  })));

export const useConflictModal = () =>
  useUIStore(useShallow((s) => ({
    isOpen: s.showConflictModal,
    pendingSaveType: s.pendingSaveType,
    open: s.openConflictModal,
    close: s.closeConflictModal,
  })));

export const useToasts = () =>
  useUIStore(useShallow((s) => ({
    successToast: s.successToast,
    errorToast: s.errorToast,
    dismissSuccess: s.dismissSuccess,
    dismissError: s.dismissError,
  })));

export const useToastActions = () =>
  useUIStore(useShallow((s) => ({ showSuccess: s.showSuccess, showError: s.showError })));

export const useActiveTab = () => useUIStore((s) => s.activeTab);
export const useWorkspaceTabActions = () =>
  useUIStore(useShallow((s) => ({ setActiveTab: s.setActiveTab })));

export const useEvidenceDrawer = () =>
  useUIStore(useShallow((s) => ({
    context: s.evidenceDrawer,
    isOpen: s.evidenceDrawer !== null,
    open: s.openEvidenceDrawer,
    close: s.closeEvidenceDrawer,
  })));

export const useCommandPalette = () =>
  useUIStore(useShallow((s) => ({
    isOpen: s.isCommandPaletteOpen,
    open: s.openCommandPalette,
    close: s.closeCommandPalette,
    toggle: s.toggleCommandPalette,
  })));
