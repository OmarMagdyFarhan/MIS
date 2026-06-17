/**
 * Central AI execution engine — single server entry point for all AI modes.
 * @module server/ai/engine
 */

import type { AIExecuteContext, AIExecuteInput, AIExecuteMeta, AIExecuteResult } from "./types.js";
import {
  AIAbortError,
  AIProviderError,
  AISaturationError,
  normalizeAIError,
} from "./errors.js";
import {
  deletePending,
  getCached,
  getCacheKey,
  getPending,
  pendingRequests,
  setCached,
  setPending,
} from "./resilience/cache.js";
import {
  getClientConcurrency,
  MAX_GLOBAL_CONCURRENCY,
  MAX_PER_CLIENT_CONCURRENCY,
  updateConcurrency,
} from "./resilience/concurrency.js";
import { DEFAULT_GENERATE_MODEL } from "./routing/modelRouter.js";
import { callGemini } from "./providers/geminiProvider.js";
import {
  callOpenRouter,
  callOpenRouterChat,
  recordOpenRouterFailure,
} from "./providers/openrouterProvider.js";
import { estimateCost } from "./telemetry/costEstimator.js";
import {
  emitRequestError,
  emitRequestStart,
  emitRequestSuccess,
} from "./telemetry/hooks.js";
import { aiLogDebug, aiLogInfo } from "./telemetry/logger.js";

function createMeta(
  traceId: string,
  startedAt: number,
  fields: Omit<AIExecuteMeta, "traceId" | "startedAt" | "estimatedCostUsd"> & {
    latencyMs?: number;
  }
): AIExecuteMeta {
  const meta: AIExecuteMeta = {
    traceId,
    startedAt,
    latencyMs: fields.latencyMs ?? Date.now() - startedAt,
    provider: fields.provider,
    model: fields.model,
    retries: fields.retries,
    cached: fields.cached,
    fromDedup: fields.fromDedup,
    usage: fields.usage,
  };
  meta.estimatedCostUsd = estimateCost(meta.model, meta.usage);
  return meta;
}

/**
 * Executes an AI request according to mode (generate, stream, or chat).
 * All HTTP AI routes must delegate to this function.
 */
export async function executeAI(
  input: AIExecuteInput,
  ctx: AIExecuteContext
): Promise<AIExecuteResult> {
  const { mode, systemPrompt = "", userMessage, message, history, jsonResponse, model, taskType } = input;
  const { req, res, traceId, clientId, abortController } = ctx;
  const startedAt = Date.now();

  emitRequestStart({
    traceId,
    mode,
    clientId,
    model: model || DEFAULT_GENERATE_MODEL,
    startedAt,
  });

  try {
    if (mode === "stream") {
      if (!res) {
        throw normalizeAIError(new Error("Stream mode requires an Express response"), traceId);
      }

      const providerResult = await callGemini(
        "stream",
        { systemPrompt, userMessage, jsonResponse, traceId, clientId, taskType },
        req,
        res
      );

      const latencyMs = Date.now() - startedAt;
      const meta = createMeta(traceId, startedAt, {
        latencyMs,
        provider: providerResult.provider,
        model: providerResult.model,
        retries: providerResult.retries,
        cached: false,
        usage: providerResult.usage,
      });

      const result: AIExecuteResult = {
        streamCompleted: providerResult.streamCompleted,
        streamAborted: providerResult.streamAborted,
        meta,
      };

      emitRequestSuccess({ traceId, mode, clientId, model: meta.model, startedAt, meta });
      aiLogInfo({
        traceId,
        event: providerResult.streamAborted ? "stream_disconnect" : "stream_complete",
        provider: meta.provider,
        model: meta.model,
        latencyMs,
        retries: meta.retries,
      });

      return result;
    }

    if (mode === "chat") {
      let providerResult: Awaited<ReturnType<typeof callGemini>>;
      const chatModel = model || "openai/gpt-4o-mini";

      if (process.env.OPENROUTER_API_KEY) {
        try {
          providerResult = await callOpenRouterChat({
            systemPrompt: systemPrompt || "",
            message: message || "",
            history,
            model: chatModel,
            traceId,
            signal: abortController?.signal,
            taskType,
          });
        } catch (err: unknown) {
          if (err instanceof AIAbortError) throw err;
          recordOpenRouterFailure(err, traceId);
          aiLogDebug({ traceId, event: "provider_fallback", provider: "openrouter", message: "gemini" });
          if (!process.env.GEMINI_API_KEY) {
            throw new AIProviderError({
              message: "OpenRouter chat failed and GEMINI_API_KEY is not set",
              publicMessage:
                "Consultation unavailable. Check OPENROUTER_API_KEY or add GEMINI_API_KEY on the server.",
              traceId,
              retryable: false,
            });
          }
          req.headers["x-neural-trace"] = traceId;
          providerResult = await callGemini(
            "chat",
            { systemPrompt, message, history, traceId, clientId, taskType },
            req
          );
        }
      } else if (process.env.GEMINI_API_KEY) {
        req.headers["x-neural-trace"] = traceId;
        providerResult = await callGemini(
          "chat",
          { systemPrompt, message, history, traceId, clientId },
          req
        );
      } else {
        throw new AIProviderError({
          message: "No AI provider configured for chat",
          publicMessage: "Consultation requires OPENROUTER_API_KEY or GEMINI_API_KEY on the server.",
          traceId,
          retryable: false,
        });
      }

      const latencyMs = Date.now() - startedAt;
      const meta = createMeta(traceId, startedAt, {
        latencyMs,
        provider: providerResult.provider,
        model: providerResult.model,
        retries: providerResult.retries,
        cached: false,
        usage: providerResult.usage,
      });

      const result: AIExecuteResult = {
        text: providerResult.text,
        meta,
      };

      emitRequestSuccess({ traceId, mode, clientId, model: meta.model, startedAt, meta });
      aiLogInfo({
        traceId,
        event: "request_success",
        provider: meta.provider,
        model: meta.model,
        latencyMs,
        retries: meta.retries,
        mode,
      });

      return result;
    }

    // --- generate mode ---
    const requestedModel = model || DEFAULT_GENERATE_MODEL;
    const resolvedUserMessage = userMessage || "";

    const currentConcurrency = getClientConcurrency(clientId);
    if (currentConcurrency >= MAX_PER_CLIENT_CONCURRENCY) {
      throw new AISaturationError({
        message:
          "Concurrent synthesis limit reached for this session. Please await current task completion.",
        traceId,
        type: "BACKPRESSURE_ADAPTIVE",
        status: 429,
      });
    }

    if (pendingRequests.size >= MAX_GLOBAL_CONCURRENCY) {
      throw new AISaturationError({
        message: "Neural core at target capacity. Global queue threshold active.",
        traceId,
        type: "SYSTEM_SATURATION",
        status: 503,
      });
    }

    const cacheKey = getCacheKey(systemPrompt, resolvedUserMessage, requestedModel);
    const cachedText = getCached(cacheKey);
    if (cachedText !== null) {
      aiLogDebug({ traceId, event: "cache_hit", cached: true, model: requestedModel, mode });
      const latencyMs = Date.now() - startedAt;
      const meta = createMeta(traceId, startedAt, {
        latencyMs,
        provider: "gemini",
        model: requestedModel,
        retries: 0,
        cached: true,
      });
      const result: AIExecuteResult = { text: cachedText, cached: true, meta };
      emitRequestSuccess({ traceId, mode, clientId, model: requestedModel, startedAt, meta });
      return result;
    }

    aiLogDebug({ traceId, event: "cache_miss", cached: false, model: requestedModel, mode });

    const existingPending = getPending(cacheKey);
    if (existingPending) {
      aiLogDebug({ traceId, event: "dedup_merge", cached: false, model: requestedModel });
      const text = await existingPending;
      const latencyMs = Date.now() - startedAt;
      const meta = createMeta(traceId, startedAt, {
        latencyMs,
        provider: "gemini",
        model: requestedModel,
        retries: 0,
        cached: false,
        fromDedup: true,
      });
      const result: AIExecuteResult = { text, fromDedup: true, meta };
      emitRequestSuccess({ traceId, mode, clientId, model: requestedModel, startedAt, meta });
      return result;
    }

    updateConcurrency(clientId, 1);

    const executeRequest = (async (): Promise<{
      text: string;
      provider: AIExecuteMeta["provider"];
      model: string;
      usage?: AIExecuteMeta["usage"];
      retries: number;
      fallback: boolean;
    }> => {
      let totalRetries = 0;
      const apiKey = process.env.OPENROUTER_API_KEY;

      if (apiKey) {
        try {
          const orResult = await callOpenRouter({
            systemPrompt,
            userMessage: resolvedUserMessage,
            jsonResponse,
            model: requestedModel,
            traceId,
            signal: abortController?.signal,
            taskType,
          });
          if (orResult.text) {
            return {
              text: orResult.text,
              provider: orResult.provider,
              model: orResult.model,
              usage: orResult.usage,
              retries: orResult.retries,
              fallback: false,
            };
          }
        } catch (err: unknown) {
          if (err instanceof AIAbortError) throw err;
          recordOpenRouterFailure(err, traceId);
          aiLogDebug({ traceId, event: "provider_fallback", provider: "openrouter", message: "gemini" });
        }
      }

      if (!process.env.GEMINI_API_KEY) {
        throw new AIProviderError({
          message: "No AI provider available (OpenRouter failed and GEMINI_API_KEY is not set)",
          publicMessage:
            "AI provider unavailable. Check OPENROUTER_API_KEY credits or add GEMINI_API_KEY on the server.",
          traceId,
          retryable: false,
        });
      }

      req.headers["x-neural-trace"] = traceId;
      const geminiResult = await callGemini(
        "generate",
        { systemPrompt, userMessage: resolvedUserMessage, jsonResponse, traceId, clientId, taskType },
        req
      );
      totalRetries += geminiResult.retries;

      return {
        text: geminiResult.text ?? "",
        provider: geminiResult.provider,
        model: geminiResult.model,
        usage: geminiResult.usage,
        retries: totalRetries,
        fallback: true,
      };
    })();

    const pendingText = executeRequest.then((r) => r.text);
    setPending(cacheKey, pendingText);
    pendingText.catch(() => {});

    try {
      const executed = await executeRequest;
      setCached(cacheKey, executed.text);

      const latencyMs = Date.now() - startedAt;
      const meta = createMeta(traceId, startedAt, {
        latencyMs,
        provider: executed.provider,
        model: executed.model,
        retries: executed.retries,
        cached: false,
        usage: executed.usage,
      });

      const result: AIExecuteResult = { text: executed.text, meta };

      emitRequestSuccess({ traceId, mode, clientId, model: meta.model, startedAt, meta });
      aiLogInfo({
        traceId,
        event: "request_success",
        provider: meta.provider,
        model: meta.model,
        latencyMs,
        retries: meta.retries,
        cached: false,
        mode,
      });

      if (executed.fallback) {
        aiLogDebug({ traceId, event: "provider_fallback_complete", provider: meta.provider });
      }

      return result;
    } finally {
      deletePending(cacheKey);
      updateConcurrency(clientId, -1);
    }
  } catch (error: unknown) {
    const aiError = normalizeAIError(error, traceId);
    const latencyMs = Date.now() - startedAt;
    emitRequestError({
      traceId,
      mode,
      clientId,
      model: model || DEFAULT_GENERATE_MODEL,
      startedAt,
      error: aiError,
      latencyMs,
    });
    aiLogInfo({
      traceId,
      event: "request_error",
      errorType: aiError.code,
      latencyMs,
      mode,
      message: aiError.publicMessage,
    });
    throw aiError;
  }
}
