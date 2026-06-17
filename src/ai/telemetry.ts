/**
 * Lightweight telemetry hooks for the browser AI client (no external providers).
 * @module src/ai/telemetry
 */

import type { AIErrorCode } from "./errors";
import { aiDebugLog } from "./debug";
import type { AIExecuteMode } from "./types";

/** Telemetry event kinds emitted during AI execution. */
export type AITelemetryEventType = "start" | "success" | "retry" | "error";

/** Token usage when returned by the server (future-facing). */
export interface AITelemetryUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

/** Payload for telemetry events. */
export interface AITelemetryEvent {
  type: AITelemetryEventType;
  mode: AIExecuteMode;
  traceId?: string;
  attempt?: number;
  error?: unknown;
  errorType?: AIErrorCode | string;
  durationMs?: number;
  provider?: string;
  model?: string;
  retries?: number;
  cached?: boolean;
  usage?: AITelemetryUsage;
}

export type AITelemetryListener = (event: AITelemetryEvent) => void;

const listeners: AITelemetryListener[] = [];

/**
 * Registers a telemetry listener.
 * @returns Unsubscribe function
 */
export function onAITelemetry(listener: AITelemetryListener): () => void {
  listeners.push(listener);
  return () => {
    const idx = listeners.indexOf(listener);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}

/**
 * Emits an event to all registered listeners.
 */
export function emitAITelemetry(event: AITelemetryEvent): void {
  if (event.type === "retry" || event.type === "start") {
    aiDebugLog({ event: `telemetry_${event.type}`, ...event });
  }

  for (const listener of listeners) {
    try {
      listener(event);
    } catch {
      /* listener errors must not break execution */
    }
  }
}

/** Clears all listeners (test helper). */
export function resetAITelemetry(): void {
  listeners.length = 0;
}
