import { create } from 'zustand';
import { StorageManager } from '../lib/storage';
import type { FoundationAnswer, FoundationId } from '../types/foundation';

const STORAGE_KEY = 'mis_foundation_v1';

interface FoundationState {
  answers: Record<string, Record<string, FoundationAnswer>>;  // [companyId][questionId]
  hydrated: boolean;
  getAnswer: (companyId: string, questionId: string) => FoundationAnswer | undefined;
  setAnswer: (companyId: string, answer: FoundationAnswer) => void;
  getAnswersForFoundation: (companyId: string, foundationId: FoundationId) => FoundationAnswer[];
  hydrate: () => Promise<void>;
  persist: () => Promise<void>;
}

export const useFoundationStore = create<FoundationState>((set, get) => ({
  answers: {},
  hydrated: false,

  getAnswer: (companyId, questionId) =>
    get().answers[companyId]?.[questionId],

  setAnswer: (companyId, answer) => {
    set(s => ({
      answers: {
        ...s.answers,
        [companyId]: { ...s.answers[companyId], [answer.questionId]: answer },
      },
    }));
    void get().persist();
  },

  getAnswersForFoundation: (companyId, foundationId) =>
    Object.values(get().answers[companyId] ?? {}).filter(
      a => a.foundationId === foundationId
    ),

  hydrate: async () => {
    const answers = await StorageManager.load<Record<string, Record<string, FoundationAnswer>>>(
      STORAGE_KEY, {}
    );
    set({ answers, hydrated: true });
  },

  persist: async () => {
    await StorageManager.save(STORAGE_KEY, get().answers);
  },
}));
