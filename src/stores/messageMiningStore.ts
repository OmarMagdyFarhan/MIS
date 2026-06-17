import { create } from 'zustand';
import { StorageManager } from '../lib/storage';
import { MessageMiningSession, MinedMessage, MarketIntelligenceData } from '../types';
import { usePipelineStore } from './pipelineStore';

const STORAGE_KEY = 'mis_message_mining_sessions';

interface MessageMiningState {
  sessions: Record<string, MessageMiningSession>;
  isAnalyzing: boolean;
  analysisError: string | null;

  initSession: (companyId: string, avatarId: string) => void;
  updateMessages: (avatarId: string, messages: MinedMessage[]) => void;
  setAnalyzed: (avatarId: string, messages: MinedMessage[]) => void;
  setAnalyzing: (val: boolean) => void;
  setAnalysisError: (err: string | null) => void;
  // Phase 12: delegates to pipelineStore (single owner of market intelligence)
  setMarketIntelligence: (companyId: string, data: MarketIntelligenceData) => void;
  loadFromStorage: () => Promise<void>;
  persist: () => Promise<void>;
}

export const useMessageMiningStore = create<MessageMiningState>((set, get) => ({
  sessions: {},
  isAnalyzing: false,
  analysisError: null,

  initSession: (companyId, avatarId) => {
    const existing = get().sessions[avatarId];
    if (existing) return;
    const session: MessageMiningSession = {
      id: `mm_${Date.now()}`,
      companyId,
      avatarId,
      messages: [{ id: `msg_${Date.now()}`, text: '', analyzed: false }],
      createdAt: new Date().toISOString(),
    };
    set(s => ({ sessions: { ...s.sessions, [avatarId]: session } }));
    void get().persist();
  },

  updateMessages: (avatarId, messages) => {
    set(s => ({
      sessions: {
        ...s.sessions,
        [avatarId]: { ...s.sessions[avatarId], messages },
      },
    }));
    void get().persist();
  },

  setAnalyzed: (avatarId, messages) => {
    set(s => ({
      sessions: {
        ...s.sessions,
        [avatarId]: {
          ...s.sessions[avatarId],
          messages,
          lastAnalyzedAt: new Date().toISOString(),
        },
      },
    }));
    void get().persist();
  },

  setAnalyzing: (val) => set({ isAnalyzing: val }),
  setAnalysisError: (err) => set({ analysisError: err }),

  // Phase 12: pipelineStore is the single owner of market intelligence data.
  // This method delegates there so existing callers don't break.
  setMarketIntelligence: (companyId, data) => {
    usePipelineStore.getState().setMarketIntelligence(companyId, data, 0);
  },

  loadFromStorage: async () => {
    const sessions = await StorageManager.load<Record<string, MessageMiningSession>>(STORAGE_KEY, {});
    set({ sessions: sessions ?? {} });
  },

  persist: async () => {
    const { sessions } = get();
    await StorageManager.save(STORAGE_KEY, sessions);
  },
}));
