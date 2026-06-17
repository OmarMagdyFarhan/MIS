/**
 * AbortSignal and deadline timeout linking for AI fetches.
 * @module src/ai/timeoutLink
 */

import { AIAbortError, AITimeoutError } from "./errors";

/** Default synthesis deadline (ms), matching the legacy client. */
export const DEFAULT_AI_TIMEOUT_MS = 95000;

export const TIMEOUT_EXCEEDED_MESSAGE =
  "Neural core synthesis deadline exceeded (95s). The strategic complexity may be too high for the current provider window.";

export interface TimeoutLinkOptions {
  externalSignal?: AbortSignal;
  timeoutMs?: number;
  /** When false, only the external signal is used (stream/chat legacy behavior). */
  enableDeadline?: boolean;
}

export interface TimeoutLinkHandle {
  signal: AbortSignal;
  cleanup: () => void;
  isExternalAbort: () => boolean;
}

/**
 * Creates a linked AbortSignal and optional deadline timer.
 */
export function createTimeoutLink(options: TimeoutLinkOptions = {}): TimeoutLinkHandle {
  const { externalSignal, timeoutMs = DEFAULT_AI_TIMEOUT_MS, enableDeadline = true } = options;
  const controller = new AbortController();

  if (externalSignal?.aborted) {
    controller.abort();
  }

  const abortInternal = () => controller.abort();
  if (externalSignal) {
    externalSignal.addEventListener("abort", abortInternal);
  }

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  if (enableDeadline) {
    timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  }

  const cleanup = () => {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
    if (externalSignal) {
      externalSignal.removeEventListener("abort", abortInternal);
    }
  };

  return {
    signal: controller.signal,
    cleanup,
    isExternalAbort: () => Boolean(externalSignal?.aborted),
  };
}

/**
 * Maps AbortError to timeout or re-throws external abort unchanged.
 */
export function rethrowAbortError(error: unknown, isExternalAbort: () => boolean): never {
  if (error instanceof DOMException && error.name === "AbortError") {
    if (isExternalAbort()) throw new AIAbortError({ cause: error });
    throw new AITimeoutError({ cause: error });
  }
  if (typeof error === "object" && error !== null && (error as { name?: string }).name === "AbortError") {
    if (isExternalAbort()) throw new AIAbortError({ cause: error });
    throw new AITimeoutError({ cause: error });
  }
  throw error;
}
