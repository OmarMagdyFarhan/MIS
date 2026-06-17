import type { ModelConfig } from '../stores/apiKeyStore';

export const AI_MODELS: ModelConfig[] = [
  // ─── Gemini ──────────────────────────────────────────────────────────────
  {
    id: 'gemini-2.5-flash-preview-05-20',
    label: 'Gemini 2.5 Flash Preview',
    provider: 'gemini',
    contextWindow: '1M tokens',
    costTier: 'low',
    recommended: true,
  },
  {
    id: 'gemini-2.0-flash',
    label: 'Gemini 2.0 Flash',
    provider: 'gemini',
    contextWindow: '1M tokens',
    costTier: 'low',
  },
  {
    id: 'gemini-2.0-flash-lite',
    label: 'Gemini 2.0 Flash Lite',
    provider: 'gemini',
    contextWindow: '1M tokens',
    costTier: 'free',
  },
  {
    id: 'gemini-1.5-pro',
    label: 'Gemini 1.5 Pro',
    provider: 'gemini',
    contextWindow: '2M tokens',
    costTier: 'mid',
  },
  {
    id: 'gemini-1.5-flash',
    label: 'Gemini 1.5 Flash',
    provider: 'gemini',
    contextWindow: '1M tokens',
    costTier: 'low',
  },

  // ─── OpenRouter ───────────────────────────────────────────────────────────
  {
    id: 'openai/gpt-4o',
    label: 'GPT-4o (via OpenRouter)',
    provider: 'openrouter',
    contextWindow: '128K tokens',
    costTier: 'high',
  },
  {
    id: 'openai/gpt-4o-mini',
    label: 'GPT-4o Mini (via OpenRouter)',
    provider: 'openrouter',
    contextWindow: '128K tokens',
    costTier: 'low',
    recommended: true,
  },
  {
    id: 'anthropic/claude-3.5-sonnet',
    label: 'Claude 3.5 Sonnet (via OpenRouter)',
    provider: 'openrouter',
    contextWindow: '200K tokens',
    costTier: 'mid',
  },
  {
    id: 'anthropic/claude-3-haiku',
    label: 'Claude 3 Haiku (via OpenRouter)',
    provider: 'openrouter',
    contextWindow: '200K tokens',
    costTier: 'low',
  },
  {
    id: 'meta-llama/llama-3.1-70b-instruct',
    label: 'Llama 3.1 70B (via OpenRouter)',
    provider: 'openrouter',
    contextWindow: '131K tokens',
    costTier: 'low',
  },
  {
    id: 'mistralai/mistral-large',
    label: 'Mistral Large (via OpenRouter)',
    provider: 'openrouter',
    contextWindow: '128K tokens',
    costTier: 'mid',
  },
  {
    id: 'google/gemini-2.0-flash-001',
    label: 'Gemini 2.0 Flash (via OpenRouter)',
    provider: 'openrouter',
    contextWindow: '1M tokens',
    costTier: 'low',
  },

  // ─── OpenAI Direct ────────────────────────────────────────────────────────
  {
    id: 'gpt-4o',
    label: 'GPT-4o (direct)',
    provider: 'openai',
    contextWindow: '128K tokens',
    costTier: 'high',
  },
  {
    id: 'gpt-4o-mini',
    label: 'GPT-4o Mini (direct)',
    provider: 'openai',
    contextWindow: '128K tokens',
    costTier: 'low',
    recommended: true,
  },
  {
    id: 'gpt-4-turbo',
    label: 'GPT-4 Turbo (direct)',
    provider: 'openai',
    contextWindow: '128K tokens',
    costTier: 'high',
  },
];

export function getModelsForProvider(provider: string): ModelConfig[] {
  return AI_MODELS.filter(m => m.provider === provider);
}
