/**
 * Google Gemini provider: generate, stream, and chat modes with model fallback.
 * @module server/ai/providers/geminiProvider
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import type { Request, Response } from "express";
import type { AIExecuteMode, AIChatHistoryTurn, ProviderCallResult } from "../types.js";
import {
  AICircuitOpenError,
  AIAbortError,
  AIProviderError,
  AITimeoutError,
} from "../errors.js";
import { checkBreaker, recordFailure, recordSuccess } from "../resilience/circuitBreaker.js";
import { backoff, MAX_RETRIES } from "../resilience/backoff.js";
import { pushDeadLetter } from "../resilience/deadLetter.js";
import { emitRequestRetry } from "../telemetry/hooks.js";
import { aiLogDebug } from "../telemetry/logger.js";
import { recordProviderFailure, recordProviderSuccess } from "../telemetry/providerHealth.js";
import { usageFromGeminiResponse } from "../telemetry/usage.js";

/** Request timeout for Gemini calls (ms). */
export const REQUEST_TIMEOUT_MS = 95000;

const MODEL_PRIORITY = ["gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-1.5-flash"];

const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

/** Returns a request-scoped Gemini client if a dev key is provided, otherwise returns the module-level client. */
function getGeminiClient(apiKey?: string): GoogleGenerativeAI {
  return apiKey ? new GoogleGenerativeAI(apiKey) : ai;
}

export interface GeminiCallParams {
  systemPrompt?: string;
  userMessage?: string;
  message?: string;
  history?: AIChatHistoryTurn[];
  jsonResponse?: boolean;
  traceId: string;
  clientId?: string;
  /** Optional task classification, used for logging/telemetry by callers */
  taskType?: string;
}

/**
 * Executes a Gemini call with retries, timeouts, and model fallback chain.
 */
export async function callGemini(
  mode: AIExecuteMode,
  params: GeminiCallParams,
  req: Request,
  res?: Response,
  apiKey?: string  // optional: dev-mode per-request key override
): Promise<ProviderCallResult> {
  const { traceId } = params;

  if (!checkBreaker("gemini")) {
    throw new AICircuitOpenError({ provider: "gemini", traceId });
  }

  let lastError: unknown = null;
  let connectionAborted = false;
  let totalRetries = 0;
  let usedModel = MODEL_PRIORITY[0];

  const cleanup = () => {
    connectionAborted = true;
  };
  req.on("close", cleanup);

  const callStarted = Date.now();

  try {
    for (const modelId of MODEL_PRIORITY) {
      if (connectionAborted) break;
      usedModel = modelId;
      let attempts = 0;

      while (attempts < MAX_RETRIES) {
        if (connectionAborted) break;
        try {
          aiLogDebug({
            traceId,
            event: "provider_attempt",
            provider: "gemini",
            model: modelId,
            retries: attempts,
            mode,
          });

          const timeoutSignal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
          const withTimeout = async <T>(promise: Promise<T>): Promise<T> => {
            return new Promise<T>((resolve, reject) => {
              timeoutSignal.addEventListener('abort', () => reject(new AITimeoutError({ traceId })), { once: true });
              promise.then(resolve, reject);
            });
          };

          const genModel = ai.getGenerativeModel({
            model: modelId,
            ...(params.systemPrompt ? { systemInstruction: params.systemPrompt } : {}),
          });

          if (mode === "generate") {
            const result = await withTimeout(
              genModel.generateContent({
                contents: [{ role: "user", parts: [{ text: params.userMessage || "" }] }],
                generationConfig: {
                  responseMimeType: params.jsonResponse ? "application/json" : "text/plain",
                  temperature: (params as any).taskType === 'generation' ? 0.3 : 0.0,
                },
              })
            );
            const latencyMs = Date.now() - callStarted;
            recordSuccess("gemini");
            recordProviderSuccess("gemini", latencyMs);
            return {
              text: result.response.text() || "",
              provider: "gemini",
              model: modelId,
              usage: usageFromGeminiResponse(result.response),
              retries: totalRetries,
            };
          }

          if (mode === "stream" && res) {
            try {
              const result = await genModel.generateContentStream({
                contents: [{ role: "user", parts: [{ text: params.userMessage || "" }] }],
              });

              for await (const chunk of result.stream) {
                if (connectionAborted || req.aborted) break;
                const text = chunk.text();
                if (text) res.write(`data: ${JSON.stringify({ text })}\n\n`);
              }

              if (connectionAborted || req.aborted) {
                aiLogDebug({ traceId, event: "stream_disconnect", provider: "gemini", model: modelId });
                res.end();
                return {
                  streamAborted: true,
                  provider: "gemini",
                  model: modelId,
                  retries: totalRetries,
                };
              }

              const latencyMs = Date.now() - callStarted;
              recordSuccess("gemini");
              recordProviderSuccess("gemini", latencyMs);
              res.write("data: [DONE]\n\n");
              return {
                streamCompleted: true,
                provider: "gemini",
                model: modelId,
                retries: totalRetries,
              };
            } catch (streamErr) {
              if (connectionAborted || req.aborted) {
                return {
                  streamAborted: true,
                  provider: "gemini",
                  model: modelId,
                  retries: totalRetries,
                };
              }
              throw streamErr;
            }
          }

          if (mode === "chat") {
            const chatModel = ai.getGenerativeModel({
              model: modelId,
              systemInstruction: params.systemPrompt,
            });
            const chat = chatModel.startChat({
              history: (params.history || []).map((h) => ({
                role: h.role === "user" ? "user" : "model",
                parts: [{ text: h.content || h.text || "" }],
              })),
            });
            const chatResult = await withTimeout(chat.sendMessage(params.message || ""));
            const latencyMs = Date.now() - callStarted;
            recordSuccess("gemini");
            recordProviderSuccess("gemini", latencyMs);
            return {
              text: chatResult.response.text() || "",
              provider: "gemini",
              model: modelId,
              usage: usageFromGeminiResponse(chatResult.response),
              retries: totalRetries,
            };
          }
        } catch (err: unknown) {
          lastError = err;
          if (err instanceof AITimeoutError || err instanceof AICircuitOpenError) {
            throw err;
          }

          const errAny = err as { message?: string; status?: number; name?: string };
          if (errAny.name === "AbortError") {
            throw new AIAbortError({ traceId, cause: err });
          }

          const errorLower = (errAny.message || String(err)).toLowerCase();
          const isQuota =
            errAny.status === 429 || errorLower.includes("429") || errorLower.includes("quota");

          if (isQuota || errAny.status === 503) {
            recordFailure("gemini", err, traceId);
            recordProviderFailure("gemini");
            if (attempts < MAX_RETRIES) {
              attempts++;
              totalRetries++;
              emitRequestRetry({
                traceId,
                mode,
                clientId: params.clientId ?? "unknown",
                startedAt: callStarted,
                attempt: totalRetries,
                reason: isQuota ? "quota" : "503",
                provider: "gemini",
              });
              await backoff(attempts);
              continue;
            }
          }
          break;
        }
      }
    }
  } finally {
    req.off("close", cleanup);
  }

  if (connectionAborted || req.aborted) {
    if (mode === "stream") {
      return {
        streamAborted: true,
        provider: "gemini",
        model: usedModel,
        retries: totalRetries,
      };
    }
    throw new AIAbortError({ traceId, cause: lastError });
  }

  pushDeadLetter(traceId, lastError, { provider: "Gemini", mode });
  recordProviderFailure("gemini");
  throw new AIProviderError({
    message: `Neural capacity threshold reached. (Trace: ${traceId})`,
    traceId,
    provider: "gemini",
    cause: lastError,
  });
}
