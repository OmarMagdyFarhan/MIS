/**
 * Root Express server — Phase 16.9
 *
 * Mounts:
 *   • AI routes   → /api/ai   (Gemini / OpenRouter, circuit-breaker, cache)
 *   • DB routes   → /api/evidence, /api/avatars, /api/corpus, /health
 *   • Static SPA  → /* (Vite middleware in dev; built output in production)
 *
 * Environment variables (see .env.example for full list):
 *   DATABASE_URL   — Supabase PostgreSQL connection string  (required)
 *   GEMINI_API_KEY — Google Gemini key                      (required for AI)
 *   MIS_API_KEY    — Bearer-token guard for /api/ai/*       (production recommended)
 *   ALLOWED_ORIGINS— Comma-separated prod CORS origins      (required if frontend is CDN-hosted)
 *   PORT           — HTTP port (default 3000)
 *   NODE_ENV       — 'development' | 'production'
 *
 * @module server
 */

import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync } from "node:fs";
import { logger } from "./server/logger.js";
import { registerAIRoutes } from "./server/ai/index.js";
import { registerDbRoutes } from "./server/routes/index.js";
import { prisma } from "./server/db/prisma.js";

// ─── Config ───────────────────────────────────────────────────────────────────

const PORT    = parseInt(process.env.PORT ?? "3000", 10);
const IS_PROD = process.env.NODE_ENV === "production";
const __dir   = dirname(fileURLToPath(import.meta.url));

// ─── App ──────────────────────────────────────────────────────────────────────

const app = express();

// Trust the first proxy hop — required for express-rate-limit to key off the
// real client IP instead of the proxy/load-balancer IP (Render, Railway, Heroku,
// Vercel, Fly.io all sit behind at least one reverse proxy).
app.set("trust proxy", 1);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // SPA handles its own CSP
  crossOriginEmbedderPolicy: false,
}));

// CORS — allow all origins in dev, restrict to an explicit allowlist in prod
app.use(cors({
  origin: IS_PROD
    ? (process.env.ALLOWED_ORIGINS ?? "").split(",").filter(Boolean)
    : true,
  credentials: true,
}));

// Body parsing
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// ─── Rate limiting ────────────────────────────────────────────────────────────

// Tighter limit for the AI routes (expensive per-call)
const aiLimiter = rateLimit({
  windowMs: 60_000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many AI requests — please wait a moment." },
});
app.use("/api/ai", aiLimiter);

// General API limiter
const apiLimiter = rateLimit({
  windowMs: 60_000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api", apiLimiter);

// ─── MIS_API_KEY bearer-token guard for /api/ai/* ────────────────────────────
//
// If MIS_API_KEY is set in the environment, every request to /api/ai/* must
// include an Authorization header of the form:
//
//   Authorization: Bearer <MIS_API_KEY>
//
// Requests without a valid key receive 401 Unauthorized.
// In development, the guard is skipped when MIS_API_KEY is empty so local
// testing works without configuration.

const MIS_API_KEY = process.env.MIS_API_KEY?.trim();

if (MIS_API_KEY) {
  app.use("/api/ai", (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers["authorization"] ?? "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : "";

    if (token !== MIS_API_KEY) {
      res.status(401).json({ error: "Unauthorized — valid API key required." });
      return;
    }
    next();
  });
} else if (IS_PROD) {
  // Warn loudly at startup if deploying to production without the key set
  logger.warn("MIS_API_KEY is not set — /api/ai/* routes are unprotected in production.");
}

// ─── Request logging ──────────────────────────────────────────────────────────

app.use((req: Request, _res: Response, next: NextFunction) => {
  (req as any).log = logger.child({ reqId: Math.random().toString(36).slice(2, 9) });
  next();
});

// ─── AI routes (/api/ai) ─────────────────────────────────────────────────────

registerAIRoutes(app);

// ─── Database-backed routes (/api/evidence, /api/avatars, /api/corpus, /health)

registerDbRoutes(app);

// ─── SPA serving ─────────────────────────────────────────────────────────────

async function mountSpaHandler(): Promise<void> {
  if (IS_PROD) {
    // Production: serve the pre-built Vite output
    const distDir = join(__dir, "dist", "public");
    if (existsSync(distDir)) {
      app.use(express.static(distDir));
      app.get("*", (_req: Request, res: Response) => {
        res.sendFile(join(distDir, "index.html"));
      });
    } else {
      logger.warn({ distDir }, "dist/public not found — run `npm run build` first");
    }
  } else {
    // Development: wire in Vite's dev server as Express middleware.
    // This gives HMR and instant feedback without a separate `npm run dev:vite`
    // and without needing to build before serving the frontend.
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }
}

// ─── Global error handler ─────────────────────────────────────────────────────
//
// In production, never forward raw error messages to the caller — they may
// contain Prisma connection strings, stack fragments, or other internal details.
// Log the real error server-side and return a generic message.

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err }, "unhandled.error");
  const message = IS_PROD
    ? "Internal server error"
    : (err instanceof Error ? err.message : "Internal server error");
  res.status(500).json({ error: message });
});

// ─── Startup ──────────────────────────────────────────────────────────────────

const httpServer = createServer(app);

(async () => {
  await mountSpaHandler();

  httpServer.listen(PORT, async () => {
    logger.info({ port: PORT, env: process.env.NODE_ENV ?? "development" }, "server.started");
    console.log(`\n✅  Server running on http://localhost:${PORT}`);
    console.log(`📊  Database: Supabase (PostgreSQL via Prisma)`);
    console.log(`🔒  Three-Lock System: ACTIVE`);
    if (MIS_API_KEY) {
      console.log(`🔑  MIS_API_KEY guard: ACTIVE on /api/ai/*`);
    }
    console.log(`\n🔗  Endpoints:`);
    console.log(`    GET  http://localhost:${PORT}/health`);
    console.log(`    POST http://localhost:${PORT}/api/evidence`);
    console.log(`    GET  http://localhost:${PORT}/api/evidence/summary`);
    console.log(`    GET  http://localhost:${PORT}/api/corpus/status`);
    console.log(`    POST http://localhost:${PORT}/api/avatars`);
    console.log(`    GET  http://localhost:${PORT}/api/avatars`);
    console.log(`    POST http://localhost:${PORT}/api/ai/generate\n`);

    // Verify database connectivity on startup
    try {
      const count = await prisma.evidenceMessage.count();
      console.log(`📁  Evidence messages in DB: ${count}\n`);
    } catch {
      console.error("⚠️   Database connection failed — set DATABASE_URL in .env");
      console.error("    See .env.example for setup instructions.\n");
    }
  });
})();

// Graceful shutdown
const shutdown = async (signal: string) => {
  logger.info({ signal }, "server.shutdown");
  await prisma.$disconnect();
  httpServer.close(() => process.exit(0));
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));

export default app;
