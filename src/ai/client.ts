/**
 * Single browser entry point for all AI HTTP execution.
 * @module src/ai/client
 */

import { aiDebugLog } from "./debug";
import {
  AIJSONParseError,
  AIProviderError,
  AIStreamError,
  errorFromHttpResponse,
  normalizeClientAIError,
} from "./errors";
import {
  appendJsonRetryPrompt,
  JSON_SCHEMA_FAILURE_MESSAGE,
  parseModelJson,
  stripJsonFences,
} from "./jsonRecover";
import { isRetrySafeError, MAX_JSON_PARSE_ATTEMPTS, waitForJsonRetry } from "./retryPolicy";
import { consumeSSEStream } from "./sseConsumer";
import { emitAITelemetry } from "./telemetry";
import { createTimeoutLink, rethrowAbortError, TIMEOUT_EXCEEDED_MESSAGE } from "./timeoutLink";
import { createTraceId, readTraceFromResponse, withTraceHeader } from "./trace";
import type { AIExecuteRequest } from "./types";
import { useApiKeyStore } from '../stores/apiKeyStore';


const DEFAULT_MODEL = "gemini-2.0-flash";

/**
 * Returns a stable per-browser client id for rate limiting and tracing.
 */
export function getClientId(): string {
  if (typeof window === "undefined") return "server";
  let id = localStorage.getItem("neural_client_id");
  if (!id) {
    id = `client_${Math.random().toString(36).slice(2)}_${Date.now()}`;
    localStorage.setItem("neural_client_id", id);
  }
  return id;
}

function buildBaseHeaders(traceId: string): HeadersInit {
  const apiKeyStore = useApiKeyStore.getState();
  const devHeaders: Record<string, string> = {};
  if (apiKeyStore.isDevMode) {
    const { keys, activeModelId } = apiKeyStore;
    if (keys.gemini.apiKey) devHeaders['x-dev-gemini-key'] = keys.gemini.apiKey;
    if (keys.openrouter.apiKey) devHeaders['x-dev-openrouter-key'] = keys.openrouter.apiKey;
    if (keys.openai.apiKey) devHeaders['x-dev-openai-key'] = keys.openai.apiKey;
    devHeaders['x-dev-model'] = activeModelId;
  }
  return withTraceHeader(
    {
      "Content-Type": "application/json",
      "X-Client-ID": getClientId(),
      ...devHeaders,
    },
    traceId
  );
}

async function parseErrorResponse(
  response: Response,
  fallbackPrefix: string,
  traceId: string
): Promise<never> {
  const errorData = (await response.json().catch(() => ({}))) as {
    error?: string;
    traceId?: string;
  };
  const resolvedTrace = response.headers.get("X-Neural-Trace") || errorData.traceId || traceId;
  const message =
    errorData.error || `${fallbackPrefix} (${response.status})${resolvedTrace ? ` [Trace: ${resolvedTrace}]` : ""}`;
  throw errorFromHttpResponse(response.status, message, resolvedTrace);
}

function emitSuccessTelemetry(
  mode: AIExecuteRequest["mode"],
  traceId: string,
  started: number,
  response?: Response
): void {
  const headers = response ? readTraceFromResponse(response) : {};
  emitAITelemetry({
    type: "success",
    mode,
    traceId: headers.traceId ?? traceId,
    durationMs: Date.now() - started,
    provider: headers.provider,
    model: headers.model,
    retries: headers.retries,
    cached: headers.cached,
  });
}

async function executeGenerate(request: AIExecuteRequest): Promise<unknown> {
  const traceId = createTraceId();
  const timeout = createTimeoutLink({
    externalSignal: request.signal,
    enableDeadline: true,
  });

  if (request.signal?.aborted) {
    timeout.cleanup();
    throw normalizeClientAIError(new DOMException("The operation was aborted", "AbortError"), traceId);
  }

  const started = Date.now();
  emitAITelemetry({ type: "start", mode: "generate", traceId });

  let userMessage = request.userMessage;
  let attempt = 0;
  let jsonRecoveryCount = 0;

  try {
    while (true) {
      try {
        const response = await fetch("/api/ai/generate", {
          method: "POST",
          headers: buildBaseHeaders(traceId),
          signal: timeout.signal,
          body: JSON.stringify({
            systemPrompt: request.systemPrompt,
            userMessage,
            jsonResponse: request.json,
            model: request.model || DEFAULT_MODEL,
            taskType: request.taskType ?? "structure",
          }),
        });

        if (!response.ok) {
          await parseErrorResponse(response, "Synthesis core failed", traceId);
        }

        const data = (await response.json()) as { text?: string };
        const text = data.text || "";

        if (!request.json) {
          emitSuccessTelemetry("generate", traceId, started, response);
          return text;
        }

        try {
          const parsed = parseModelJson({
            text,
            schema: request.schema,
          });
          emitSuccessTelemetry("generate", traceId, started, response);
          return parsed;
        } catch (parseErr) {
          if (!isRetrySafeError(parseErr)) throw parseErr;

          jsonRecoveryCount++;
          // removed: console.warn now gated behind aiDebugLog below
          aiDebugLog({
            traceId,
            event: "json_recovery",
            attempt: jsonRecoveryCount,
            message: String(parseErr),
          });

          attempt++;
          if (attempt >= MAX_JSON_PARSE_ATTEMPTS) {
            throw new AIJSONParseError({
              message: JSON_SCHEMA_FAILURE_MESSAGE,
              traceId,
              cause: parseErr,
            });
          }

          emitAITelemetry({
            type: "retry",
            mode: "generate",
            traceId,
            attempt,
            errorType: "JSON_PARSE",
          });
          userMessage = appendJsonRetryPrompt(userMessage);
          await waitForJsonRetry(attempt, timeout.signal);
          continue;
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          rethrowAbortError(error, timeout.isExternalAbort);
        }
        if (typeof error === "object" && error !== null && (error as { name?: string }).name === "AbortError") {
          rethrowAbortError(error, timeout.isExternalAbort);
        }
        const normalized = normalizeClientAIError(error, traceId);
        emitAITelemetry({
          type: "error",
          mode: "generate",
          traceId,
          error: normalized,
          errorType: normalized.code,
        });
        throw normalized;
      }
    }
  } finally {
    timeout.cleanup();
  }
}

async function executeChat(request: AIExecuteRequest): Promise<string> {
  const traceId = createTraceId();
  const started = Date.now();
  emitAITelemetry({ type: "start", mode: "chat", traceId });

  try {
    const response = await fetch("/api/ai/chat", {
      method: "POST",
      headers: buildBaseHeaders(traceId),
      signal: request.signal,
      body: JSON.stringify({
        systemPrompt: request.systemPrompt,
        message: request.userMessage,
        history: request.history,
      }),
    });

    if (!response.ok) {
      await parseErrorResponse(response, "Chat failed", traceId);
    }

    const data = (await response.json()) as { text?: string };
    emitSuccessTelemetry("chat", traceId, started, response);
    return data.text || "";
  } catch (error) {
    const normalized = normalizeClientAIError(error, traceId);
    emitAITelemetry({
      type: "error",
      mode: "chat",
      traceId,
      error: normalized,
      errorType: normalized.code,
    });
    throw normalized;
  }
}

async function executeStream(request: AIExecuteRequest): Promise<unknown> {
  if (!request.onChunk) {
    throw new AIStreamError({ message: "Stream mode requires onChunk callback" });
  }

  const traceId = createTraceId();
  const started = Date.now();
  emitAITelemetry({ type: "start", mode: "stream", traceId });

  try {
    const response = await fetch("/api/ai/stream", {
      method: "POST",
      headers: buildBaseHeaders(traceId),
      signal: request.signal,
      body: JSON.stringify({
        systemPrompt: request.systemPrompt,
        userMessage: request.userMessage,
        jsonResponse: request.json,
        model: request.model,
        tools: request.tools,
        cachedContent: request.cachedContent,
        taskType: request.taskType ?? "structure",
      }),
    });

    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({}))) as { error?: string };
      const message = errorData.error || `Streaming failed: ${response.status}`;
      throw errorFromHttpResponse(response.status, message, traceId);
    }

    const body = response.body;
    if (!body) {
      throw new AIStreamError({ message: "No reader available", traceId });
    }

    const { fullText } = await consumeSSEStream(body, {
      onChunk: request.onChunk,
      signal: request.signal,
      traceId,
    });

    if (request.json) {
      try {
        const cleanedText = stripJsonFences(fullText);
        const parsed = JSON.parse(cleanedText);
        emitSuccessTelemetry("stream", traceId, started, response);
        return parsed;
      } catch (parseErr) {
        throw new AIJSONParseError({
          message: JSON_SCHEMA_FAILURE_MESSAGE,
          traceId,
          cause: parseErr,
        });
      }
    }

    emitSuccessTelemetry("stream", traceId, started, response);
    return fullText;
  } catch (error) {
    const normalized = normalizeClientAIError(error, traceId);
    emitAITelemetry({
      type: "error",
      mode: "stream",
      traceId,
      error: normalized,
      errorType: normalized.code,
    });
    if (normalized.code !== "ABORT") {
      aiDebugLog({ traceId, event: 'stream_error', message: normalized.publicMessage });
    }
    throw normalized;
  }
}

/**
 * Browser AI client — delegates all modes to centralized helpers.
 */
export const aiClient = {
  /**
   * Executes an AI request (generate, stream, or chat).
   */
  async execute<T = unknown>(request: AIExecuteRequest): Promise<T> {
    switch (request.mode) {
      case "generate":
        return (await executeGenerate(request)) as T;
      case "chat":
        return (await executeChat(request)) as T;
      case "stream":
        return (await executeStream(request)) as T;
      default: {
        const _exhaustive: never = request.mode;
        throw new AIProviderError({ message: `Unsupported AI mode: ${String(_exhaustive)}` });
      }
    }
  },
};

export { TIMEOUT_EXCEEDED_MESSAGE };
