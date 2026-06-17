/**
 * Server-Sent Events (SSE) consumer for `/api/ai/stream` responses.
 * @module src/ai/sseConsumer
 */

import { AIAbortError, AIStreamError } from "./errors";
import { emitAITelemetry } from "./telemetry";

export interface SSEConsumerOptions {
  onChunk: (accumulatedText: string) => void;
  signal?: AbortSignal;
  traceId?: string;
}

export interface SSEConsumerResult {
  fullText: string;
}

/**
 * Reads an SSE response body and accumulates `text` fields from `data:` events.
 */
export async function consumeSSEStream(
  body: ReadableStream<Uint8Array>,
  options: SSEConsumerOptions
): Promise<SSEConsumerResult> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let fullText = "";
  let aborted = false;

  const onAbort = () => {
    aborted = true;
    reader.cancel().catch(() => undefined);
  };

  if (options.signal) {
    if (options.signal.aborted) {
      reader.releaseLock();
      throw new AIAbortError({ traceId: options.traceId });
    }
    options.signal.addEventListener("abort", onAbort, { once: true });
  }

  try {
    while (!aborted) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n");

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;

        const dataStr = line.replace("data: ", "").trim();
        if (dataStr === "[DONE]") {
          return { fullText };
        }

        try {
          const data = JSON.parse(dataStr) as { error?: string; text?: string };
          if (data.error) {
            throw new AIStreamError({
              message: data.error,
              traceId: options.traceId,
            });
          }
          if (data.text) {
            fullText += data.text;
            options.onChunk(fullText);
          }
        } catch (parseErr) {
          if (parseErr instanceof AIStreamError) throw parseErr;
          /* partial chunk — matches legacy stream parser */
        }
      }
    }

    if (aborted) {
      emitAITelemetry({
        type: "error",
        mode: "stream",
        traceId: options.traceId,
        errorType: "ABORT",
      });
      throw new AIAbortError({ traceId: options.traceId });
    }
  } catch (err) {
    if (aborted || (options.signal?.aborted ?? false)) {
      throw new AIAbortError({ traceId: options.traceId, cause: err });
    }
    if (err instanceof AIStreamError || err instanceof AIAbortError) {
      throw err;
    }
    throw new AIStreamError({
      message: err instanceof Error ? err.message : "Stream read failed",
      traceId: options.traceId,
      cause: err,
    });
  } finally {
    if (options.signal) {
      options.signal.removeEventListener("abort", onAbort);
    }
    try {
      reader.releaseLock();
    } catch {
      /* already released */
    }
  }

  return { fullText };
}
