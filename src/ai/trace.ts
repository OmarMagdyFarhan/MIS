/**
 * Trace ID generation and propagation for browser AI requests.
 * @module src/ai/trace
 */

const TRACE_HEADER = "X-Neural-Trace";

/**
 * Creates a short trace id compatible with server {@link resolveTraceId}.
 */
export function createTraceId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID().slice(0, 8);
  }
  return `t_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Reads trace metadata from a fetch Response.
 */
export function readTraceFromResponse(response: Response): {
  traceId?: string;
  latencyMs?: number;
  provider?: string;
  model?: string;
  retries?: number;
  cached?: boolean;
} {
  const traceId = response.headers.get(TRACE_HEADER) || undefined;
  const latencyHeader = response.headers.get("X-AI-Latency-Ms");
  const retriesHeader = response.headers.get("X-AI-Retries");
  return {
    traceId: traceId ?? undefined,
    latencyMs: latencyHeader ? Number(latencyHeader) : undefined,
    provider: response.headers.get("X-AI-Provider") || undefined,
    model: response.headers.get("X-AI-Model") || undefined,
    retries: retriesHeader ? Number(retriesHeader) : undefined,
    cached: response.headers.get("X-Cache-Hit") === "true",
  };
}

/**
 * Appends trace header to request headers.
 */
export function withTraceHeader(headers: HeadersInit, traceId: string): HeadersInit {
  const base = headers instanceof Headers ? Object.fromEntries(headers.entries()) : { ...(headers as Record<string, string>) };
  return { ...base, [TRACE_HEADER]: traceId };
}
