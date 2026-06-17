/**
 * Typed AI errors for the browser execution layer.
 * @module src/ai/errors
 */

import type { AIErrorCode } from '../shared/api/errors';
export type { AIErrorCode };

/**
 * Base typed error for client-side AI failures.
 */
export class AIError extends Error {
  readonly code: AIErrorCode;
  readonly retryable: boolean;
  readonly traceId?: string;
  readonly publicMessage: string;
  readonly status?: number;
  override readonly cause?: unknown;

  constructor(options: {
    code: AIErrorCode;
    message: string;
    publicMessage?: string;
    retryable?: boolean;
    traceId?: string;
    status?: number;
    cause?: unknown;
  }) {
    super(options.message);
    this.name = "AIError";
    this.code = options.code;
    this.retryable = options.retryable ?? false;
    this.traceId = options.traceId;
    this.publicMessage = options.publicMessage ?? options.message;
    this.status = options.status;
    this.cause = options.cause;
    if (options.cause instanceof Error && options.cause.stack) {
      this.stack = `${this.stack}\nCaused by: ${options.cause.stack}`;
    }
  }
}

export class AIProviderError extends AIError {
  constructor(options: {
    message: string;
    publicMessage?: string;
    traceId?: string;
    retryable?: boolean;
    cause?: unknown;
  }) {
    super({
      code: "PROVIDER",
      message: options.message,
      publicMessage: options.publicMessage ?? options.message,
      traceId: options.traceId,
      retryable: options.retryable ?? false,
      cause: options.cause,
    });
    this.name = "AIProviderError";
  }
}

export class AIRateLimitError extends AIError {
  constructor(options: { message: string; traceId?: string; status?: number; cause?: unknown }) {
    super({
      code: "RATE_LIMIT",
      message: options.message,
      publicMessage: options.message,
      traceId: options.traceId,
      status: options.status ?? 429,
      retryable: true,
      cause: options.cause,
    });
    this.name = "AIRateLimitError";
  }
}

export class AIJSONParseError extends AIError {
  constructor(options: { message: string; traceId?: string; cause?: unknown }) {
    super({
      code: "JSON_PARSE",
      message: options.message,
      publicMessage: options.message,
      traceId: options.traceId,
      retryable: true,
      cause: options.cause,
    });
    this.name = "AIJSONParseError";
  }
}

export class AIAbortError extends AIError {
  constructor(options: { message?: string; traceId?: string; cause?: unknown }) {
    super({
      code: "ABORT",
      message: options.message ?? "The operation was aborted",
      publicMessage: options.message ?? "The operation was aborted",
      traceId: options.traceId,
      retryable: false,
      cause: options.cause,
    });
    this.name = "AIAbortError";
  }
}

export class AITimeoutError extends AIError {
  constructor(options: { message?: string; traceId?: string; cause?: unknown }) {
    super({
      code: "TIMEOUT",
      message: options.message ?? "Neural core synthesis deadline exceeded (95s). The strategic complexity may be too high for the current provider window.",
      publicMessage: options.message ?? "Neural core synthesis deadline exceeded (95s). The strategic complexity may be too high for the current provider window.",
      traceId: options.traceId,
      retryable: false,
      cause: options.cause,
    });
    this.name = "AITimeoutError";
  }
}

export class AIValidationError extends AIError {
  constructor(options: { message?: string; traceId?: string; cause?: unknown }) {
    super({
      code: "VALIDATION",
      message: options.message ?? "Schema Validation Error",
      publicMessage: options.message ?? "Schema Validation Error",
      traceId: options.traceId,
      status: 400,
      retryable: false,
      cause: options.cause,
    });
    this.name = "AIValidationError";
  }
}

export class AIStreamError extends AIError {
  constructor(options: { message: string; traceId?: string; cause?: unknown }) {
    super({
      code: "STREAM",
      message: options.message,
      publicMessage: options.message,
      traceId: options.traceId,
      retryable: false,
      cause: options.cause,
    });
    this.name = "AIStreamError";
  }
}

export class AICircuitOpenError extends AIError {
  constructor(options: { message: string; traceId?: string; cause?: unknown }) {
    super({
      code: "CIRCUIT_OPEN",
      message: options.message,
      publicMessage: options.message,
      traceId: options.traceId,
      retryable: false,
      cause: options.cause,
    });
    this.name = "AICircuitOpenError";
  }
}

/**
 * Maps HTTP status + message to typed client errors.
 */
export function errorFromHttpResponse(
  status: number,
  message: string,
  traceId?: string
): AIError {
  if (status === 429) {
    return new AIRateLimitError({ message, traceId, status });
  }
  if (status === 400) {
    return new AIValidationError({ message, traceId });
  }
  if (message.includes("Circuit Breaker: OPEN")) {
    return new AICircuitOpenError({ message, traceId });
  }
  if (message.includes("deadline exceeded") || message.includes("95s")) {
    return new AITimeoutError({ message, traceId });
  }
  return new AIProviderError({ message, traceId, cause: new Error(`HTTP ${status}`) });
}

/**
 * Coerces unknown values to {@link AIError}.
 */
export function normalizeClientAIError(error: unknown, traceId?: string): AIError {
  if (error instanceof AIError) {
    if (traceId && !error.traceId) {
      return new AIError({
        code: error.code,
        message: error.message,
        publicMessage: error.publicMessage,
        retryable: error.retryable,
        traceId,
        status: error.status,
        cause: error.cause,
      });
    }
    return error;
  }

  if (error instanceof DOMException && error.name === "AbortError") {
    return new AIAbortError({ traceId, cause: error });
  }

  const err = error as { name?: string; message?: string };
  if (err.name === "AbortError") {
    return new AIAbortError({ traceId, cause: error });
  }

  const message = err.message || String(error);
  if (message === "Failed to fetch" || message.includes("NetworkError")) {
    return new AIProviderError({
      message,
      publicMessage:
        "Cannot reach the intelligence server. Run `npm run dev` — the app and API both start on http://localhost:3000",
      traceId,
      retryable: true,
      cause: error,
    });
  }
  if (message.includes("Neural core synthesis deadline exceeded")) {
    return new AITimeoutError({ traceId, cause: error });
  }
  if (message.includes("valid strategic schema")) {
    return new AIJSONParseError({ message, traceId, cause: error });
  }

  return new AIProviderError({ message, traceId, cause: error });
}
