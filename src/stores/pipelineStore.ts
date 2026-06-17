import { create } from 'zustand';
import { StorageManager } from '../lib/storage';
import { markStale, EMPTY_STALE, pipelinePhaseToLegacyFlags } from '../lib/pipelineGraph';
import type {
  AcquisitionMode,
  ArtifactLayer,
  AvatarOfferRecord,
  CompanyPipelineState,
  PipelineIntent,
  PipelinePhase,
  PipelineRun,
  ProvenanceLink,
  StaleFlags,
} from '../types/pipeline';
import type { MarketIntelligenceData } from '../types';
import type { CompanyMVAProfile } from '../services/mvaAggregationService';
import type { ConversionIntelligenceProfile } from '../services/conversionIntelligenceService';

const PIPELINE_KEY = 'mis_pipeline_by_company';
const AVATAR_OFFERS_KEY = 'mis_avatar_offers';
const PROVENANCE_KEY = 'mis_provenance';
const INTEL_KEY = 'mis_market_intelligence';


function defaultPipelineState(companyId: string): CompanyPipelineState {
  return {
    companyId,
    phase: 'company_complete',
    acquisitionMode: 'hybrid',
    stale: { ...EMPTY_STALE },
    activeRunId: null,
    lastRunId: null,
    updatedAt: new Date().toISOString(),
  };
}

interface PipelineStoreState {
  byCompany: Record<string, CompanyPipelineState>;
  runs: Record<string, PipelineRun>;
  avatarOffers: Record<string, AvatarOfferRecord>;  provenance: Record<string, ProvenanceLink[]>;
  marketIntelligence: Record<string, MarketIntelligenceData & { corpusVersion?: number }>;
  mvaProfiles: Record<string, CompanyMVAProfile>;
  conversionIntelligence: Record<string, ConversionIntelligenceProfile>;
  hydrated: boolean;

  ensureCompany: (companyId: string) => CompanyPipelineState;
  setPhase: (companyId: string, phase: PipelinePhase) => void;
  setAcquisitionMode: (companyId: string, mode: AcquisitionMode) => void;
  markLayerStale: (companyId: string, layer: ArtifactLayer) => void;
  clearStale: (companyId: string, keys?: (keyof StaleFlags)[]) => void;

  startRun: (companyId: string, intent: PipelineIntent) => PipelineRun;
  updateRunProgress: (runId: string, step: string, current: number, total: number) => void;
  finishRun: (runId: string, status: PipelineRun['status'], error?: string) => void;
  getActiveRun: (companyId: string) => PipelineRun | null;

  setAvatarOffer: (record: AvatarOfferRecord) => void;
  getAvatarOffersForCompany: (companyId: string) => AvatarOfferRecord[];
  addProvenance: (
    companyId: string,
    link: Omit<ProvenanceLink, 'id' | 'createdAt' | 'companyId'>
  ) => void;
  getProvenance: (companyId: string, artifactId?: string) => ProvenanceLink[];

  setMarketIntelligence: (companyId: string, data: MarketIntelligenceData, corpusVersion?: number) => void;
  setMVAProfile: (companyId: string, profile: CompanyMVAProfile) => void;
  setConversionIntelligence: (companyId: string, profile: ConversionIntelligenceProfile) => void;
  getMVAProfile: (companyId: string) => CompanyMVAProfile | null;
  getConversionIntelligence: (companyId: string) => ConversionIntelligenceProfile | null;

  getLegacyProgressFlags: (companyId: string) => {
    stage1Complete: boolean;
    stage2Complete: boolean;
    stage3Complete: boolean;
  };

  setSystemState: (companyId: string, state: 'up-to-date' | 'new-evidence' | 'analysing') => void;
  getSystemState: (companyId: string) => 'up-to-date' | 'new-evidence' | 'analysing';

  loadFromStorage: () => Promise<void>;
  persist: () => Promise<void>;
}

export const usePipelineStore = create<PipelineStoreState>((set, get) => ({
  byCompany: {},
  runs: {},
  avatarOffers: {},  provenance: {},
  marketIntelligence: {},
  mvaProfiles: {},
  conversionIntelligence: {},
  hydrated: false,

  ensureCompany: companyId => {
    const existing = get().byCompany[companyId];
    if (existing) return existing;
    const state = defaultPipelineState(companyId);
    set(s => ({ byCompany: { ...s.byCompany, [companyId]: state } }));
    void get().persist();
    return state;
  },

  setPhase: (companyId, phase) => {
    const state = get().ensureCompany(companyId);
    set(s => ({
      byCompany: {
        ...s.byCompany,
        [companyId]: { ...state, phase, updatedAt: new Date().toISOString() },
      },
    }));
    void get().persist();
  },

  setAcquisitionMode: (companyId, mode) => {
    const state = get().ensureCompany(companyId);
    set(s => ({
      byCompany: {
        ...s.byCompany,
        [companyId]: { ...state, acquisitionMode: mode, updatedAt: new Date().toISOString() },
      },
    }));
    void get().persist();
  },

  markLayerStale: (companyId, layer) => {
    const state = get().ensureCompany(companyId);
    set(s => ({
      byCompany: {
        ...s.byCompany,
        [companyId]: {
          ...state,
          stale: markStale(state.stale, layer),
          updatedAt: new Date().toISOString(),
        },
      },
    }));
    void get().persist();
  },

  clearStale: (companyId, keys) => {
    const state = get().ensureCompany(companyId);
    const stale = { ...state.stale };
    if (!keys) {
      Object.keys(stale).forEach(k => {
        stale[k as keyof StaleFlags] = false;
      });
    } else {
      keys.forEach(k => {
        stale[k] = false;
      });
    }
    set(s => ({
      byCompany: {
        ...s.byCompany,
        [companyId]: { ...state, stale, updatedAt: new Date().toISOString() },
      },
    }));
    void get().persist();
  },

  startRun: (companyId, intent) => {
    const run: PipelineRun = {
      id: `run_${crypto.randomUUID()}`,
      companyId,
      intent,
      status: 'running',
      progress: { step: 'starting', current: 0, total: 1 },
      startedAt: new Date().toISOString(),
    };
    const state = get().ensureCompany(companyId);
    set(s => ({
      runs: { ...s.runs, [run.id]: run },
      byCompany: {
        ...s.byCompany,
        [companyId]: { ...state, activeRunId: run.id, updatedAt: new Date().toISOString() },
      },
    }));
    void get().persist();
    return run;
  },

  updateRunProgress: (runId, step, current, total) => {
    set(s => {
      const run = s.runs[runId];
      if (!run) return s;
      return {
        runs: {
          ...s.runs,
          [runId]: { ...run, progress: { step, current, total } },
        },
      };
    });
  },

  finishRun: (runId, status, error) => {
    set(s => {
      const run = s.runs[runId];
      if (!run) return s;
      const companyId = run.companyId;
      const state = s.byCompany[companyId];
      return {
        runs: {
          ...s.runs,
          [runId]: {
            ...run,
            status,
            error,
            finishedAt: new Date().toISOString(),
          },
        },
        byCompany: state
          ? {
              ...s.byCompany,
              [companyId]: {
                ...state,
                activeRunId: null,
                lastRunId: runId,
                updatedAt: new Date().toISOString(),
              },
            }
          : s.byCompany,
      };
    });
    void get().persist();
  },

  getActiveRun: companyId => {
    const state = get().byCompany[companyId];
    if (!state?.activeRunId) return null;
    return get().runs[state.activeRunId] ?? null;
  },

  setAvatarOffer: record => {
    set(s => ({ avatarOffers: { ...s.avatarOffers, [record.id]: record } }));
    void get().persist();
  },

  getAvatarOffersForCompany: companyId =>
    Object.values(get().avatarOffers).filter(o => o.companyId === companyId),

  addProvenance: (companyId, link) => {
    const full: ProvenanceLink = {
      ...link,
      id: `prov_${crypto.randomUUID()}`,
      companyId,
      createdAt: new Date().toISOString(),
    };
    set(s => ({
      provenance: {
        ...s.provenance,
        [companyId]: [...(s.provenance[companyId] || []), full],
      },
    }));
    void get().persist();
  },

  getProvenance: (companyId, artifactId) => {
    const links = get().provenance[companyId] || [];
    return artifactId ? links.filter(l => l.artifactId === artifactId) : links;
  },

  setMVAProfile: (companyId, profile) => {
    set(s => ({ mvaProfiles: { ...s.mvaProfiles, [companyId]: profile } }));
  },
  setConversionIntelligence: (companyId, profile) => {
    set(s => ({ conversionIntelligence: { ...s.conversionIntelligence, [companyId]: profile } }));
  },
  getMVAProfile: (companyId) => {
    return get().mvaProfiles[companyId] ?? null;
  },
  getConversionIntelligence: (companyId) => {
    return get().conversionIntelligence[companyId] ?? null;
  },
  setMarketIntelligence: (companyId, data, corpusVersion) => {
    set(s => ({
      marketIntelligence: {
        ...s.marketIntelligence,
        [companyId]: { ...data, corpusVersion },
      },
    }));
    void get().persist();
  },

  getLegacyProgressFlags: companyId => {
    const state = get().byCompany[companyId];
    if (!state) {
      return { stage1Complete: false, stage2Complete: false, stage3Complete: false };
    }
    return pipelinePhaseToLegacyFlags(state.phase);
  },

  setSystemState: (companyId, state) => {
    const existing = get().ensureCompany(companyId);
    set(s => ({
      byCompany: {
        ...s.byCompany,
        [companyId]: { ...(s.byCompany[companyId] || existing), systemState: state, updatedAt: new Date().toISOString() },
      },
    }));
    void get().persist();
  },

  getSystemState: (companyId) => {
    const state = get().byCompany[companyId];
    return (state as any)?.systemState ?? 'up-to-date';
  },

  loadFromStorage: async () => {
    const [byCompany, avatarOffers, provenance, marketIntelligence] = await Promise.all([
      StorageManager.load<Record<string, CompanyPipelineState>>(PIPELINE_KEY, {}),
      StorageManager.load<Record<string, AvatarOfferRecord>>(AVATAR_OFFERS_KEY, {}),
      StorageManager.load<Record<string, ProvenanceLink[]>>(PROVENANCE_KEY, {}),
      StorageManager.load<Record<string, MarketIntelligenceData>>(INTEL_KEY, {}),
    ]);
    set({ byCompany, avatarOffers, provenance, marketIntelligence, hydrated: true });
  },

  persist: async () => {
    const s = get();
    await Promise.all([
      StorageManager.save(PIPELINE_KEY, s.byCompany),
      StorageManager.save(AVATAR_OFFERS_KEY, s.avatarOffers),      StorageManager.save(PROVENANCE_KEY, s.provenance),
      StorageManager.save(INTEL_KEY, s.marketIntelligence),
    ]);
  },
}));
