/**
 * Normalizes token usage from Gemini and OpenRouter responses.
 * @module server/ai/telemetry/usage
 */

import type { AIUsageMetadata } from "../types.js";

/** Gemini usageMetadata shape (SDK). */
interface GeminiUsageMetadata {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
}

/** OpenRouter usage shape. */
interface OpenRouterUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

/**
 * Extracts usage from a Gemini generate response.
 */
export function usageFromGeminiResponse(response: {
  usageMetadata?: GeminiUsageMetadata;
}): AIUsageMetadata | undefined {
  const u = response.usageMetadata;
  if (!u) return undefined;
  const promptTokens = u.promptTokenCount;
  const completionTokens = u.candidatesTokenCount;
  const totalTokens = u.totalTokenCount;
  if (promptTokens === undefined && completionTokens === undefined) return undefined;
  return {
    promptTokens,
    completionTokens,
    totalTokens: totalTokens ?? (promptTokens ?? 0) + (completionTokens ?? 0),
  };
}

/**
 * Extracts usage from an OpenRouter chat completion payload.
 */
export function usageFromOpenRouter(data: { usage?: OpenRouterUsage }): AIUsageMetadata | undefined {
  const u = data.usage;
  if (!u) return undefined;
  return {
    promptTokens: u.prompt_tokens,
    completionTokens: u.completion_tokens,
    totalTokens: u.total_tokens,
  };
}
