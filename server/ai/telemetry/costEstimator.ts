/**
 * Internal USD cost estimation from token usage (no billing UI).
 * @module server/ai/telemetry/costEstimator
 */

import type { AIUsageMetadata } from "../types.js";

/** USD per 1M tokens — static estimates for observability only. */
const PRICE_PER_MILLION: Record<string, { input: number; output: number }> = {
  "gemini-2.0-flash": { input: 0.1, output: 0.4 },
  "gemini-2.0-flash-lite": { input: 0.075, output: 0.3 },
  "gemini-1.5-flash": { input: 0.075, output: 0.3 },
  "gemini-1.5-pro": { input: 1.25, output: 5.0 },
  "openai/gpt-4o-mini": { input: 0.15, output: 0.6 },
  "openai/gpt-4o": { input: 2.5, output: 10.0 },
};

const DEFAULT_PRICING = { input: 0.1, output: 0.4 };

/**
 * Estimates USD cost for a completed request from usage metadata.
 */
export function estimateCost(model: string, usage?: AIUsageMetadata): number | undefined {
  if (!usage) return undefined;

  const prompt = usage.promptTokens ?? 0;
  const completion = usage.completionTokens ?? 0;
  if (prompt === 0 && completion === 0) return undefined;

  const pricing = PRICE_PER_MILLION[model] ?? DEFAULT_PRICING;
  const inputCost = (prompt / 1_000_000) * pricing.input;
  const outputCost = (completion / 1_000_000) * pricing.output;
  return Math.round((inputCost + outputCost) * 1_000_000) / 1_000_000;
}
