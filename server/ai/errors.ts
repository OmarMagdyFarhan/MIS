/**
 * Typed AI errors for the server execution layer.
 * @module server/ai/errors
 */

import { z } from "zod";
import type { AIProviderId } from "./types.js";
import type { AIErrorCode } from "@shared/api/errors";
export type { AIErrorCode };

/** Normalized public error shape for HTTP responses. */
export interface AIPublicErrorBody {
  error: string;
  traceId?: string;
  type?: string;
  code?: AIErrorCode;
}

/**
 * Base typed error for all AI infrastructure failures.
 */
export class AIError extends Error {
  readonly code: AIErrorCode;
  readonly retryable: boolean;
  readonly traceId?: string;
  readonly publicMessage: string;
  readonly status?: number;
  readonly type?: string;
  override readonly cause?: unknown;

  constructor(options: {
    code: AIErrorCode;
    message: string;
    publicMessage?: string;
    retryable?: boolean;
    traceId?: string;
    status?: number;
    type?: string;
    cause?: unknown;
  }) {
    super(options.message);
    this.name = "AIError";
    this.code = options.code;
    this.retryable = options.retryable ?? false;
    this.traceId = options.traceId;
    this.publicMessage = options.publicMessage ?? options.message;
    this.status = options.status;
    this.type = options.type;
    this.cause = options.cause;
    if (options.cause instanceof Error && options.cause.stack) {
      this.stack = `${this.stack}\nCaused by: ${options.cause.stack}`;
    }
  }

  toJSON(): AIPublicErrorBody {
    return {
      error: this.publicMessage,
      traceId: this.traceId,
      type: this.type,
      code: this.code,
    };
  }
}

/** Provider call failed or returned no usable output. */
export class AIProviderError extends AIError {
  readonly provider?: AIProviderId;

  constructor(options: {
    message: string;
    publicMessage?: string;
    traceId?: string;
    provider?: AIProviderId;
    retryable?: boolean;
    cause?: unknown;
  }) {
    super({
      code: "PROVIDER",
      message: options.message,
      publicMessage: options.publicMessage ?? options.message,
      traceId: options.traceId,
      retryable: options.retryable ?? true,
      cause: options.cause,
    });
    this.name = "AIProviderError";
    this.provider = options.provider;
  }
}

/** Rate limit or backpressure (HTTP 429). */
export class AIRateLimitError extends AIError {
  constructor(options: {
    message: string;
    publicMessage?: string;
    traceId?: string;
    type?: string;
    retryable?: boolean;
    cause?: unknown;
  }) {
    super({
      code: "RATE_LIMIT",
      message: options.message,
      publicMessage: options.publicMessage ?? options.message,
      traceId: options.traceId,
      status: 429,
      type: options.type ?? "RATE_LIMIT",
      retryable: options.retryable ?? true,
      cause: options.cause,
    });
    this.name = "AIRateLimitError";
  }
}

/** JSON could not be parsed or validated. */
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

/** Request aborted by client. */
export class AIAbortError extends AIError {
  constructor(options: { message?: string; traceId?: string; cause?: unknown }) {
    super({
      code: "ABORT",
      message: options.message ?? "Request aborted",
      publicMessage: options.message ?? "Request aborted",
      traceId: options.traceId,
      retryable: false,
      cause: options.cause,
    });
    this.name = "AIAbortError";
  }
}

/** Provider deadline exceeded. */
export class AITimeoutError extends AIError {
  constructor(options: { message?: string; traceId?: string; cause?: unknown }) {
    super({
      code: "TIMEOUT",
      message: options.message ?? "Neural Timeout",
      publicMessage:
        options.message ??
        "Neural core synthesis deadline exceeded (95s). The strategic complexity may be too high for the current provider window.",
      traceId: options.traceId,
      retryable: false,
      cause: options.cause,
    });
    this.name = "AITimeoutError";
  }
}

/** Request schema validation failed. */
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

/** Streaming failure or disconnect. */
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

/** Circuit breaker is open for a provider. */
export class AICircuitOpenError extends AIError {
  readonly provider: AIProviderId;

  constructor(options: { provider: AIProviderId; traceId?: string }) {
    super({
      code: "CIRCUIT_OPEN",
      message: `Neural provider capacity reached (Circuit Breaker: OPEN). ID: ${options.traceId ?? "unknown"}`,
      publicMessage: `Neural provider capacity reached (Circuit Breaker: OPEN). ID: ${options.traceId ?? "unknown"}`,
      traceId: options.traceId,
      retryable: false,
    });
    this.name = "AICircuitOpenError";
    this.provider = options.provider;
  }
}

/** Global or per-client concurrency saturation. */
export class AISaturationError extends AIError {
  constructor(options: {
    message: string;
    traceId?: string;
    type?: string;
    status?: number;
    cause?: unknown;
  }) {
    super({
      code: options.status === 429 ? "BACKPRESSURE" : "SATURATION",
      message: options.message,
      publicMessage: options.message,
      traceId: options.traceId,
      status: options.status ?? 503,
      type: options.type,
      retryable: true,
      cause: options.cause,
    });
    this.name = "AISaturationError";
  }
}

/**
 * Returns true if the error is an {@link AIError} marked retryable.
 */
export function isRetryableAIError(error: unknown): boolean {
  return error instanceof AIError && error.retryable;
}

/**
 * Coerces unknown thrown values into {@link AIError} instances.
 */
export function normalizeAIError(error: unknown, traceId?: string): AIError {
  if (error instanceof AIError) {
    if (traceId && !error.traceId) {
      return new AIError({
        code: error.code,
        message: error.message,
        publicMessage: error.publicMessage,
        retryable: error.retryable,
        traceId,
        status: error.status,
        type: error.type,
        cause: error.cause,
      });
    }
    return error;
  }

  if (error instanceof z.ZodError) {
    return new AIValidationError({ traceId, cause: error });
  }

  const err = error as {
    name?: string;
    message?: string;
    status?: number;
    traceId?: string;
    type?: string;
  };

  if (err.name === "AbortError") {
    return new AIAbortError({ traceId: traceId ?? err.traceId, cause: error });
  }

  const message = err.message || String(error);

  if (message.includes("Neural Timeout")) {
    return new AITimeoutError({ traceId: traceId ?? err.traceId, cause: error });
  }

  if (message.includes("Circuit Breaker: OPEN")) {
    return new AICircuitOpenError({ provider: "gemini", traceId: traceId ?? err.traceId });
  }

  if (err.status === 429 || err.type === "BACKPRESSURE_ADAPTIVE") {
    return new AIRateLimitError({
      message,
      traceId: traceId ?? err.traceId,
      type: err.type,
      cause: error,
    });
  }

  if (err.status === 503 || err.type === "SYSTEM_SATURATION") {
    return new AISaturationError({
      message,
      traceId: traceId ?? err.traceId,
      type: err.type,
      status: 503,
      cause: error,
    });
  }

  if (message.includes("Neural capacity threshold")) {
    return new AIProviderError({
      message,
      traceId: traceId ?? err.traceId,
      cause: error,
    });
  }

  return new AIProviderError({
    message,
    publicMessage: message,
    traceId: traceId ?? err.traceId,
    cause: error,
  });
}
