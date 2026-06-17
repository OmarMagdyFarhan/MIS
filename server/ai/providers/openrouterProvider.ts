/**
 * OpenRouter chat-completions provider used as primary for generate when configured.
 * @module server/ai/providers/openrouterProvider
 */

import {
  AIAbortError,
  AIProviderError,
  AIRateLimitError,
  AICircuitOpenError,
  AITimeoutError,
} from "../errors.js";
import { REQUEST_TIMEOUT_MS } from "./geminiProvider.js";
import { checkBreaker, recordFailure, recordSuccess } from "../resilience/circuitBreaker.js";
import type { ProviderCallResult } from "../types.js";
import { aiLogDebug } from "../telemetry/logger.js";
import { recordProviderFailure, recordProviderSuccess } from "../telemetry/providerHealth.js";
import { usageFromOpenRouter } from "../telemetry/usage.js";
import { toOpenRouterModel } from "../routing/openrouterModels.js";
import type { AIChatHistoryTurn } from "../types.js";

export interface OpenRouterParams {
  systemPrompt: string;
  userMessage: string;
  jsonResponse?: boolean;
  model: string;
  traceId: string;
  signal?: AbortSignal | undefined;
  /** Optional task classification, used for logging/telemetry by callers */
  taskType?: string;
}

export interface OpenRouterChatParams {
  systemPrompt: string;
  message: string;
  history?: AIChatHistoryTurn[];
  model?: string;
  traceId: string;
  signal?: AbortSignal;
  /** Optional task classification, used for logging/telemetry by callers */
  taskType?: string;
}

async function postOpenRouterChat(
  traceId: string,
  openRouterModel: string,
  messages: Array<{ role: string; content: string }>,
  signal?: AbortSignal,
  jsonResponse?: boolean,
  taskType?: string
): Promise<ProviderCallResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new AIProviderError({
      message: "OpenRouter unavailable",
      traceId,
      provider: "openrouter",
      retryable: true,
    });
  }

  if (!checkBreaker("openrouter")) {
    throw new AICircuitOpenError({ provider: "openrouter", traceId });
  }

  const started = Date.now();

  aiLogDebug({
    traceId,
    event: "provider_attempt",
    provider: "openrouter",
    model: openRouterModel,
  });

  try {
    const timeoutSignal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  const combined = AbortSignal.any(
    [timeoutSignal, signal].filter(Boolean) as AbortSignal[]
  );
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      signal: combined,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "X-Neural-Trace": traceId,
      },
      body: JSON.stringify({
        model: openRouterModel,
        temperature: taskType === 'generation' ? 0.3 : 0.0,
        messages,
        response_format: jsonResponse ? { type: "json_object" } : undefined,
      }),
    });

    if (!response.ok) {
      const errorBody = (await response.json().catch(() => ({}))) as {
        error?: { message?: string };
      };
      const detail = errorBody.error?.message || `HTTP ${response.status}`;
      if (response.status === 429) {
        throw new AIRateLimitError({
          message: `OpenRouter rate limit: ${detail}`,
          traceId,
          cause: new Error(detail),
        });
      }
      throw new AIProviderError({
        message: `OpenRouter error: ${detail}`,
        publicMessage: `OpenRouter error: ${detail}`,
        traceId,
        provider: "openrouter",
        cause: new Error(detail),
      });
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
      };
    };

    const text = data.choices?.[0]?.message?.content || "";
    const latencyMs = Date.now() - started;
    recordSuccess("openrouter");
    recordProviderSuccess("openrouter", latencyMs);

    return {
      text,
      provider: "openrouter",
      model: openRouterModel,
      usage: usageFromOpenRouter(data),
      retries: 0,
    };
  } catch (err: unknown) {
    const errAny = err as { name?: string };
    if (errAny.name === "AbortError") {
      throw new AIAbortError({ traceId, cause: err });
    }
    if (err instanceof AICircuitOpenError || err instanceof AIRateLimitError) {
      throw err;
    }
    recordProviderFailure("openrouter");
    throw err;
  }
}

/**
 * Calls OpenRouter and returns provider result with usage metadata.
 */
export async function callOpenRouter(params: OpenRouterParams, devApiKey?: string): Promise<ProviderCallResult> {
  const apiKey = devApiKey || process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new AIProviderError({
      message: "OpenRouter unavailable",
      traceId: params.traceId,
      provider: "openrouter",
      retryable: true,
    });
  }

  if (!checkBreaker("openrouter")) {
    throw new AICircuitOpenError({ provider: "openrouter", traceId: params.traceId });
  }

  const { systemPrompt, userMessage, jsonResponse, model, traceId, signal, taskType } = params;
  const openRouterModel = toOpenRouterModel(model);

  return postOpenRouterChat(
    traceId,
    openRouterModel,
    [
      ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
      { role: "user", content: userMessage },
    ],
    signal,
    jsonResponse,
    taskType
  );
}

/**
 * Multi-turn chat via OpenRouter (offer wizard consultation).
 */
export async function callOpenRouterChat(params: OpenRouterChatParams, apiKey?: string): Promise<ProviderCallResult> {
  const { systemPrompt, message, history = [], model = "openai/gpt-4o-mini", traceId, signal } =
    params;
  const openRouterModel = toOpenRouterModel(model);

  const messages: Array<{ role: string; content: string }> = [];
  if (systemPrompt) {
    messages.push({ role: "system", content: systemPrompt });
  }
  for (const turn of history) {
    const content = turn.content || turn.text || "";
    if (!content) continue;
    messages.push({
      role: turn.role === "user" ? "user" : "assistant",
      content,
    });
  }
  messages.push({ role: "user", content: message });

  return postOpenRouterChat(traceId, openRouterModel, messages, signal);
}

/**
 * Records OpenRouter failure for circuit breaker (fallback path).
 */
export function recordOpenRouterFailure(error: unknown, traceId: string): void {
  aiLogDebug({
    traceId,
    event: "provider_fallback",
    provider: "openrouter",
    message: "OpenRouter failure, fallback triggered",
  });
  recordFailure("openrouter", error, traceId);
  recordProviderFailure("openrouter");
}
