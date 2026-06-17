/**
 * Express route handlers for AI endpoints; delegates to {@link executeAI}.
 * @module server/ai/routes
 */

import type { Express, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { executeAI } from "./engine.js";
import { AIError, AIValidationError, normalizeAIError } from "./errors.js";
import { pendingRequests } from "./resilience/cache.js";
import { CIRCUIT_BREAKER } from "./resilience/circuitBreaker.js";
import { AIChatRequestSchema, AIRequestSchema, DEFAULT_GENERATE_MODEL } from "./routing/modelRouter.js";
import { getProviderHealth } from "./telemetry/providerHealth.js";
import { MAX_GLOBAL_CONCURRENCY } from "./resilience/concurrency.js";
import { resolveTraceId, applyTraceHeaders } from "./trace.js";
import { logger } from "../logger.js";

/**
 * Registers AI HTTP routes and the health monitor on the Express app.
 * Rate limiting for `/api/ai` must be applied by the caller before this runs.
 *
 * NOTE: The `x-client-id` header is used for rate limiting only — any caller
 * can forge it. Full JWT/session authentication is a Phase 4 item.
 * For production deployments, set MIS_API_KEY in env to enable the lightweight
 * API key guard in server.ts.
 */
export function registerAIRoutes(app: Express): void {

  // Dev-only: allow client to supply API keys via headers
  // NEVER allowed in production — returns 403 if attempted
  if (process.env.NODE_ENV !== 'production') {
    app.use('/api/ai', (req: Request, _res, next: NextFunction) => {
      const clientGeminiKey = req.headers['x-dev-gemini-key'] as string | undefined;
      const clientOpenRouterKey = req.headers['x-dev-openrouter-key'] as string | undefined;
      const clientOpenAIKey = req.headers['x-dev-openai-key'] as string | undefined;

      // Temporarily store dev keys on the request object for this request only.
      // We do NOT mutate process.env — this is request-scoped only.
      (req as any).devKeys = {
        gemini: clientGeminiKey || process.env.GEMINI_API_KEY,
        openrouter: clientOpenRouterKey || process.env.OPENROUTER_API_KEY,
        openai: clientOpenAIKey || process.env.OPENAI_API_KEY,
      };
      if (req.headers['x-dev-model']) {
        (req as any).devModel = req.headers['x-dev-model'] as string;
      }
      next();
    });
  }

  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      uptime: process.uptime(),
      version: process.env.npm_package_version || "unknown",
      breakers: CIRCUIT_BREAKER,
      concurrency: { active: pendingRequests.size, max: MAX_GLOBAL_CONCURRENCY },
      providers: getProviderHealth(),
    });
  });

  app.post("/api/ai/generate", async (req: Request, res: Response, next: NextFunction) => {
    const traceId = resolveTraceId(req);
    const clientId = (req.headers["x-client-id"] as string) || req.ip || "unknown";

    try {
      const parsed = AIRequestSchema.parse(req.body);
      const {
        systemPrompt = "",
        userMessage,
        jsonResponse,
        model: requestedModel = DEFAULT_GENERATE_MODEL,
      } = parsed;

      const abortController = new AbortController();
      req.on("close", () => abortController.abort());

      const result = await executeAI(
        {
          mode: "generate",
          systemPrompt,
          userMessage,
          jsonResponse,
          model: requestedModel,
        },
        { req, traceId, clientId, abortController }
      );

      applyTraceHeaders(res, {
        traceId: result.meta.traceId,
        latencyMs: result.meta.latencyMs,
        provider: result.meta.provider,
        model: result.meta.model,
        retries: result.meta.retries,
        cached: result.cached,
      });

      const body: { text?: string; cached?: boolean } = { text: result.text };
      if (result.cached || result.fromDedup) {
        body.cached = true;
      }
      res.json(body);
      logger.info({
        event: "request_complete", mode: "generate",
        traceId: result.meta.traceId, latencyMs: result.meta.latencyMs,
        provider: result.meta.provider, model: result.meta.model,
        cached: result.cached ?? false,
      });
    } catch (error: unknown) {
      handleRouteError(error, req, res, next, traceId);
    }
  });

  app.post("/api/ai/stream", async (req: Request, res: Response, next: NextFunction) => {
    const traceId = resolveTraceId(req);
    const clientId = (req.headers["x-client-id"] as string) || req.ip || "unknown";

    try {
      const { systemPrompt, userMessage } = AIRequestSchema.parse(req.body);
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const result = await executeAI(
        { mode: "stream", systemPrompt, userMessage },
        { req, res, traceId, clientId }
      );

      applyTraceHeaders(res, {
        traceId: result.meta.traceId,
        latencyMs: result.meta.latencyMs,
        provider: result.meta.provider,
        model: result.meta.model,
        retries: result.meta.retries,
      });

      res.end();
      logger.info({
        event: "request_complete", mode: "stream",
        traceId: result.meta.traceId, latencyMs: result.meta.latencyMs,
        provider: result.meta.provider, model: result.meta.model,
        cached: result.cached ?? false,
      });
    } catch (error: unknown) {
      handleRouteError(error, req, res, next, traceId);
    }
  });

  app.post("/api/ai/chat", async (req: Request, res: Response, next: NextFunction) => {
    const traceId = resolveTraceId(req);
    const clientId = (req.headers["x-client-id"] as string) || req.ip || "unknown";

    try {
      const { systemPrompt, message, history } = AIChatRequestSchema.parse(req.body);

      const result = await executeAI(
        { mode: "chat", systemPrompt, message, history },
        { req, traceId, clientId }
      );

      applyTraceHeaders(res, {
        traceId: result.meta.traceId,
        latencyMs: result.meta.latencyMs,
        provider: result.meta.provider,
        model: result.meta.model,
        retries: result.meta.retries,
      });

      res.json({ text: result.text ?? "" });
      logger.info({
        event: "request_complete", mode: "chat",
        traceId: result.meta.traceId, latencyMs: result.meta.latencyMs,
        provider: result.meta.provider, model: result.meta.model,
        cached: result.cached ?? false,
      });
    } catch (error: unknown) {
      handleRouteError(error, req, res, next, traceId);
    }
  });

  if (process.env.NODE_ENV !== "production") {
    app.get("/api/ai/debug", (_req, res) => {
      res.json({
        circuitBreakers: CIRCUIT_BREAKER,
        providerHealth: getProviderHealth(),
        concurrency: { active: pendingRequests.size, max: MAX_GLOBAL_CONCURRENCY },
      });
    });
  }
}

function handleRouteError(
  error: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
  traceId: string
): void {
  if (error instanceof z.ZodError) {
    const validation = new AIValidationError({ traceId, cause: error });
    res.status(400).json(validation.toJSON());
    return;
  }

  const aiError = normalizeAIError(error, traceId);
  req.headers["x-neural-trace"] = aiError.traceId ?? traceId;
  applyTraceHeaders(res, { traceId: aiError.traceId ?? traceId });

  const status =
    aiError.status ??
    (aiError.code === "RATE_LIMIT" ? 429 : aiError.code === "VALIDATION" ? 400 : 503);
  res.status(status).json(aiError.toJSON());
}
