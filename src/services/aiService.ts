/**
 * Thin compatibility wrapper — re-exports the centralized browser AI layer.
 * All execution logic lives in `src/ai/`.
 * @module src/services/aiService
 */

export {
  generateAIContent,
  generateAIChat,
  generateAIContentStream,
  generateWithSelfCorrection,
} from "../ai/legacy";

export type { AIContentParams, AIChatParams } from "../ai/legacy";

/** Production should use Redis or persistent backend cache. */
export const createAICache = async (_params: {
  model?: string;
  systemPrompt: string;
  userMessage?: string;
  ttlSeconds?: number;
}): Promise<null> => null;

/** No-op for now. */
export const deleteAICache = async (_cacheName: string): Promise<void> => {
  /* no-op */
};
