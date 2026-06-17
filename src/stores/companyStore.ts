import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import type { Company } from '../types';
import { StorageManager, STORAGE_KEYS } from '../lib/storage';

/**
 * Company domain store.
 *
 * Scope (Step 4):
 *  - `companies`             : Company[]                — persisted in IndexedDB
 *  - `activeCompanyId`       : string | null            — persisted in localStorage
 *  - `draftCompany`          : Partial<Company>         — transient form state, NOT persisted
 *  - `needsOfferUpdate`      : Record<string, boolean>  — persisted in IndexedDB
 *
 * Persistence semantics are intentionally identical to the previous useEffect-based
 * approach in App.tsx:
 *   - companies is only persisted when length > 0 (matches old guard)
 *   - activeCompanyId is removed from localStorage when set to null
 *   - needsOfferUpdate is always persisted on every change
 *
 * Out of scope for Step 4 (still in App / future stores):
 *   - offers, progress      → Step 5 (offerStore)
 */

const EMPTY_DRAFT: Partial<Company> = {
  name: '',
  industry: '',
  logoUrl: '',
  specializations: [],
  usp: '',
  country: 'Global',
  websiteUrl: '',
  isGlobalMode: true,
};

interface CompanyState {
  companies: Company[];
  activeCompanyId: string | null;
  draftCompany: Partial<Company>;
  needsOfferUpdate: Record<string, boolean>;
  hydrated: boolean;

  // Hydration (call once on app mount). Returns the loaded companies so callers
  // can branch on first-run vs returning user without an extra read.
  hydrate: () => Promise<{ companies: Company[]; activeCompanyId: string | null }>;

  // Mutations — each handles its own persistence side effect.
  setCompanies: (next: Company[] | ((prev: Company[]) => Company[])) => void;
  setActiveCompanyId: (id: string | null) => void;
  setDraftCompany: (
    next: Partial<Company> | ((prev: Partial<Company>) => Partial<Company>)
  ) => void;
  resetDraftCompany: () => void;
  setNeedsOfferUpdate: (
    next:
      | Record<string, boolean>
      | ((prev: Record<string, boolean>) => Record<string, boolean>)
  ) => void;
  markNeedsOfferUpdate: (companyId: string) => void;
  clearNeedsOfferUpdate: (companyId: string) => void;
}

// ─── Persistence side effects (mirror old useEffects) ────────────────────────

function persistCompanies(companies: Company[]) {
  // Match old guard: only write when non-empty (no destructive clears).
  if (companies.length > 0) {
    void StorageManager.save(STORAGE_KEYS.COMPANIES, companies);
  }
}

function persistActiveCompanyId(id: string | null) {
  try {
    if (id) localStorage.setItem(STORAGE_KEYS.ACTIVE_COMPANY, id);
    else localStorage.removeItem(STORAGE_KEYS.ACTIVE_COMPANY);
  } catch {
    /* ignore */
  }
}

function persistNeedsOfferUpdate(map: Record<string, boolean>) {
  void StorageManager.save(STORAGE_KEYS.NEEDS_OFFER_UPDATE, map);
}

export const useCompanyStore = create<CompanyState>((set, get) => ({
  companies: [],
  activeCompanyId: null,
  draftCompany: { ...EMPTY_DRAFT },
  needsOfferUpdate: {},
  hydrated: false,

  hydrate: async () => {
    const [savedCompanies, savedNeedsUpdate] = await Promise.all([
      StorageManager.load<Company[]>(STORAGE_KEYS.COMPANIES, []),
      StorageManager.load<Record<string, boolean>>(STORAGE_KEYS.NEEDS_OFFER_UPDATE, {}),
    ]);

    let savedActiveId: string | null = null;
    try {
      savedActiveId = localStorage.getItem(STORAGE_KEYS.ACTIVE_COMPANY);
    } catch {
      /* ignore */
    }

    set({
      companies: savedCompanies,
      activeCompanyId: savedActiveId,
      needsOfferUpdate: savedNeedsUpdate,
      hydrated: true,
    });

    return { companies: savedCompanies, activeCompanyId: savedActiveId };
  },

  setCompanies: (next) => {
    const prev = get().companies;
    const value = typeof next === 'function' ? (next as (p: Company[]) => Company[])(prev) : next;
    persistCompanies(value);
    set({ companies: value });
  },

  setActiveCompanyId: (id) => {
    persistActiveCompanyId(id);
    set({ activeCompanyId: id });
  },

  setDraftCompany: (next) => {
    const prev = get().draftCompany;
    const value =
      typeof next === 'function'
        ? (next as (p: Partial<Company>) => Partial<Company>)(prev)
        : next;
    set({ draftCompany: value });
  },

  resetDraftCompany: () => set({ draftCompany: { ...EMPTY_DRAFT } }),

  setNeedsOfferUpdate: (next) => {
    const prev = get().needsOfferUpdate;
    const value =
      typeof next === 'function'
        ? (next as (p: Record<string, boolean>) => Record<string, boolean>)(prev)
        : next;
    persistNeedsOfferUpdate(value);
    set({ needsOfferUpdate: value });
  },

  markNeedsOfferUpdate: (companyId) => {
    const value = { ...get().needsOfferUpdate, [companyId]: true };
    persistNeedsOfferUpdate(value);
    set({ needsOfferUpdate: value });
  },

  clearNeedsOfferUpdate: (companyId) => {
    const value = { ...get().needsOfferUpdate };
    delete value[companyId];
    persistNeedsOfferUpdate(value);
    set({ needsOfferUpdate: value });
  },
}));

// ─── Selector hooks (minimize rerenders) ─────────────────────────────────────

export const useCompanies = () => useCompanyStore((s) => s.companies);
export const useActiveCompanyId = () => useCompanyStore((s) => s.activeCompanyId);
export const useDraftCompany = () => useCompanyStore((s) => s.draftCompany);
export const useNeedsOfferUpdate = () => useCompanyStore((s) => s.needsOfferUpdate);

export const useActiveCompany = () =>
  useCompanyStore((s) =>
    s.activeCompanyId ? s.companies.find((c) => c.id === s.activeCompanyId) : undefined
  );

export const useCompanyActions = () =>
  useCompanyStore(
    useShallow((s) => ({
      setCompanies: s.setCompanies,
      setActiveCompanyId: s.setActiveCompanyId,
      setDraftCompany: s.setDraftCompany,
      resetDraftCompany: s.resetDraftCompany,
      setNeedsOfferUpdate: s.setNeedsOfferUpdate,
      markNeedsOfferUpdate: s.markNeedsOfferUpdate,
      clearNeedsOfferUpdate: s.clearNeedsOfferUpdate,
      hydrate: s.hydrate,
    }))
  );