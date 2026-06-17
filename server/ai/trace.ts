/**
 * Trace ID resolution for AI requests (client → server propagation).
 * @module server/ai/trace
 */

import crypto from "crypto";
import type { Request } from "express";

const TRACE_HEADER = "x-neural-trace";

/**
 * Resolves trace id from incoming request or generates a new short id.
 */
export function resolveTraceId(req: Request): string {
  const incoming = req.headers[TRACE_HEADER] as string | undefined;
  if (incoming && incoming.trim().length > 0) {
    return incoming.trim().slice(0, 64);
  }
  return crypto.randomUUID().slice(0, 8);
}

/**
 * Applies trace and observability headers to an HTTP response.
 */
export function applyTraceHeaders(
  res: { setHeader: (name: string, value: string) => void },
  meta: {
    traceId: string;
    latencyMs?: number;
    provider?: string;
    model?: string;
    retries?: number;
    cached?: boolean;
  }
): void {
  res.setHeader("X-Neural-Trace", meta.traceId);
  if (meta.latencyMs !== undefined) {
    res.setHeader("X-AI-Latency-Ms", String(meta.latencyMs));
  }
  if (meta.provider) {
    res.setHeader("X-AI-Provider", meta.provider);
  }
  if (meta.model) {
    res.setHeader("X-AI-Model", meta.model);
  }
  if (meta.retries !== undefined) {
    res.setHeader("X-AI-Retries", String(meta.retries));
  }
  if (meta.cached) {
    res.setHeader("X-Cache-Hit", "true");
  }
}
