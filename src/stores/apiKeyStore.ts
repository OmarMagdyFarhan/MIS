/**
 * API Key Manager Store
 *
 * Stores user-entered API keys in localStorage (not IndexedDB — intentional,
 * faster for repeated reads on every AI call).
 * Keys are NEVER sent to any third party. They are only sent to /api/ai
 * via the x-api-key header, which the server reads from env OR from the
 * request header when DEV_KEY_OVERRIDE is enabled.
 *
 * Keys are stored in localStorage as-is. This is a developer/power-user
 * feature — warn users that localStorage is not encrypted.
 */

import { create } from 'zustand';

export type AIProvider = 'gemini' | 'openrouter' | 'openai';

export interface ProviderKeyConfig {
  provider: AIProvider;
  label: string;
  apiKey: string;
  isActive: boolean;
  addedAt: string;
}

export interface ModelConfig {
  id: string;
  label: string;
  provider: AIProvider;
  contextWindow: string;
  costTier: 'free' | 'low' | 'mid' | 'high';
  recommended?: boolean;
}

interface ApiKeyState {
  keys: Record<AIProvider, ProviderKeyConfig>;
  activeProvider: AIProvider;
  activeModelId: string;
  isDevMode: boolean;

  setKey: (provider: AIProvider, apiKey: string) => void;
  removeKey: (provider: AIProvider) => void;
  setActiveProvider: (provider: AIProvider) => void;
  setActiveModel: (modelId: string) => void;
  setDevMode: (on: boolean) => void;
  getActiveKey: () => string | null;
  exportConfig: () => string;
}

const STORAGE_KEY = 'mis_api_keys_v1';

function loadFromStorage(): Partial<ApiKeyState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Partial<ApiKeyState>;
  } catch {
    return {};
  }
}

function persist(state: Partial<ApiKeyState>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      keys: state.keys,
      activeProvider: state.activeProvider,
      activeModelId: state.activeModelId,
      isDevMode: state.isDevMode,
    }));
  } catch { /* ignore */ }
}

const saved = loadFromStorage();

export const useApiKeyStore = create<ApiKeyState>((set, get) => ({
  keys: (saved.keys as Record<AIProvider, ProviderKeyConfig>) ?? {
    gemini: { provider: 'gemini', label: 'Google Gemini', apiKey: '', isActive: false, addedAt: '' },
    openrouter: { provider: 'openrouter', label: 'OpenRouter', apiKey: '', isActive: false, addedAt: '' },
    openai: { provider: 'openai', label: 'OpenAI (direct)', apiKey: '', isActive: false, addedAt: '' },
  },
  activeProvider: (saved.activeProvider as AIProvider) ?? 'gemini' as AIProvider,
  activeModelId: saved.activeModelId ?? 'gemini-2.5-flash-preview-05-20',
  isDevMode: saved.isDevMode ?? false,

  setKey: (provider, apiKey) => {
    set(s => {
      const updated = {
        ...s.keys,
        [provider]: { ...s.keys[provider], apiKey, isActive: !!apiKey, addedAt: new Date().toISOString() },
      };
      persist({ ...s, keys: updated });
      return { keys: updated };
    });
  },

  removeKey: (provider) => {
    set(s => {
      const updated = { ...s.keys, [provider]: { ...s.keys[provider], apiKey: '', isActive: false } };
      persist({ ...s, keys: updated });
      return { keys: updated };
    });
  },

  setActiveProvider: (provider) => {
    set(s => { persist({ ...s, activeProvider: provider }); return { activeProvider: provider }; });
  },

  setActiveModel: (modelId) => {
    set(s => { persist({ ...s, activeModelId: modelId }); return { activeModelId: modelId }; });
  },

  setDevMode: (on) => {
    set(s => { persist({ ...s, isDevMode: on }); return { isDevMode: on }; });
  },

  getActiveKey: () => {
    const { keys, activeProvider } = get();
    return keys[activeProvider]?.apiKey || null;
  },

  exportConfig: () => {
    const { keys, activeProvider, activeModelId } = get();
    const lines = [
      `# MIS API Configuration`,
      `# Generated: ${new Date().toISOString()}`,
      ``,
      activeProvider === 'gemini' && keys.gemini.apiKey
        ? `GEMINI_API_KEY=${keys.gemini.apiKey}` : null,
      activeProvider === 'openrouter' && keys.openrouter.apiKey
        ? `OPENROUTER_API_KEY=${keys.openrouter.apiKey}` : null,
      activeProvider === 'openai' && keys.openai.apiKey
        ? `OPENAI_API_KEY=${keys.openai.apiKey}` : null,
      `DEFAULT_MODEL=${activeModelId}`,
    ].filter(Boolean);
    return lines.join('\n');
  },
}));
