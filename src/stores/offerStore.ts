import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import type { Offer, Progress } from '../types';
import { StorageManager, STORAGE_KEYS } from '../lib/storage';

/**
 * Offer domain store (Step 5).
 *
 * Scope:
 *  - `offers`              : Record<companyId, Offer>     — persisted in IndexedDB
 *  - `progress`            : Record<companyId, Progress>  — persisted in IndexedDB
 *  - `draftOffer`          : Partial<Offer>               — transient wizard state
 *  - `transientResultOffer`: string | null                — last generated copy
 *  - `isGenerating`        : boolean                      — runtime flag
 *  - `generationError`     : string | null                — runtime flag
 *
 * Persistence semantics mirror the previous App.tsx useEffects exactly:
 *   - `offers` and `progress` are written on every change (no empty guard,
 *     matching the prior behavior so deletions persist).
 *
 * Out of scope: synthesis state, navigation state, stage insights.
 */

export const EMPTY_DRAFT_OFFER: Partial<Offer> = {
  product: '',
  relevance: '',
  reason: '',
  audience: '',
  transformation: '',
};

interface OfferState {
  offers: Record<string, Offer>;
  progress: Record<string, Progress>;
  draftOffer: Partial<Offer>;
  transientResultOffer: string | null;
  isGenerating: boolean;
  generationError: string | null;
  hydrated: boolean;

  hydrate: () => Promise<{
    offers: Record<string, Offer>;
    progress: Record<string, Progress>;
  }>;

  setOffers: (
    next:
      | Record<string, Offer>
      | ((prev: Record<string, Offer>) => Record<string, Offer>)
  ) => void;
  setProgress: (
    next:
      | Record<string, Progress>
      | ((prev: Record<string, Progress>) => Record<string, Progress>)
  ) => void;
  setDraftOffer: (
    next: Partial<Offer> | ((prev: Partial<Offer>) => Partial<Offer>)
  ) => void;
  resetDraftOffer: () => void;
  setTransientResultOffer: (value: string | null) => void;
  setIsGenerating: (value: boolean) => void;
  setGenerationError: (value: string | null) => void;

  // Convenience: scoped removal used when deleting a company.
  removeCompanyData: (companyId: string) => void;
}

function persistOffers(offers: Record<string, Offer>) {
  void StorageManager.save(STORAGE_KEYS.OFFERS, offers);
}

function persistProgress(progress: Record<string, Progress>) {
  void StorageManager.save(STORAGE_KEYS.PROGRESS, progress);
}

export const useOfferStore = create<OfferState>((set, get) => ({
  offers: {},
  progress: {},
  draftOffer: { ...EMPTY_DRAFT_OFFER },
  transientResultOffer: null,
  isGenerating: false,
  generationError: null,
  hydrated: false,

  hydrate: async () => {
    const [savedOffers, savedProgress] = await Promise.all([
      StorageManager.load<Record<string, Offer>>(STORAGE_KEYS.OFFERS, {}),
      StorageManager.load<Record<string, Progress>>(STORAGE_KEYS.PROGRESS, {}),
    ]);
    set({ offers: savedOffers, progress: savedProgress, hydrated: true });
    return { offers: savedOffers, progress: savedProgress };
  },

  setOffers: (next) => {
    const prev = get().offers;
    const value =
      typeof next === 'function'
        ? (next as (p: Record<string, Offer>) => Record<string, Offer>)(prev)
        : next;
    persistOffers(value);
    set({ offers: value });
  },

  setProgress: (next) => {
    const prev = get().progress;
    const value =
      typeof next === 'function'
        ? (next as (p: Record<string, Progress>) => Record<string, Progress>)(prev)
        : next;
    persistProgress(value);
    set({ progress: value });
  },

  setDraftOffer: (next) => {
    const prev = get().draftOffer;
    const value =
      typeof next === 'function'
        ? (next as (p: Partial<Offer>) => Partial<Offer>)(prev)
        : next;
    set({ draftOffer: value });
  },

  resetDraftOffer: () => set({ draftOffer: { ...EMPTY_DRAFT_OFFER } }),

  setTransientResultOffer: (value) => set({ transientResultOffer: value }),
  setIsGenerating: (value) => set({ isGenerating: value }),
  setGenerationError: (value) => set({ generationError: value }),

  removeCompanyData: (companyId) => {
    const nextOffers = { ...get().offers };
    delete nextOffers[companyId];
    const nextProgress = { ...get().progress };
    delete nextProgress[companyId];
    persistOffers(nextOffers);
    persistProgress(nextProgress);
    set({ offers: nextOffers, progress: nextProgress });
  },
}));

// ─── Selector hooks ──────────────────────────────────────────────────────────

export const useOffers = () => useOfferStore((s) => s.offers);
export const useProgress = () => useOfferStore((s) => s.progress);
export const useDraftOffer = () => useOfferStore((s) => s.draftOffer);
export const useTransientResultOffer = () =>
  useOfferStore((s) => s.transientResultOffer);
export const useIsGenerating = () => useOfferStore((s) => s.isGenerating);
export const useGenerationError = () => useOfferStore((s) => s.generationError);

export const useOfferActions = () =>
  useOfferStore(
    useShallow((s) => ({
      setOffers: s.setOffers,
      setProgress: s.setProgress,
      setDraftOffer: s.setDraftOffer,
      resetDraftOffer: s.resetDraftOffer,
      setTransientResultOffer: s.setTransientResultOffer,
      setIsGenerating: s.setIsGenerating,
      setGenerationError: s.setGenerationError,
      removeCompanyData: s.removeCompanyData,
      hydrate: s.hydrate,
    }))
  );