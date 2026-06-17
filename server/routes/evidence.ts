/**
 * Evidence routes — CRUD for EvidenceMessage rows in the database.
 *
 * These routes persist evidence to Supabase via Prisma and mirror the
 * Three-Lock system: every message is tied to the current active CorpusVersion
 * (Lock 2). Adding a message bumps the version counter, signalling to
 * in-flight pipeline runs that they must abort (Lock 1 enforcement is done
 * at the service layer, not here).
 *
 * @module server/routes/evidence
 */

import type { Express, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { logger } from "../logger.js";

// ─── Validation schemas ───────────────────────────────────────────────────────

const AddEvidenceSchema = z.object({
  text:      z.string().min(1).max(10_000),
  source:    z.string().max(200).optional(),
  sentiment: z.enum(["positive", "negative", "neutral"]).optional(),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns the active CorpusVersion row, creating one if none exists. */
async function getOrCreateActiveVersion() {
  const existing = await prisma.corpusVersion.findFirst({
    where: { status: "active" },
    orderBy: { version: "desc" },
  });
  if (existing) return existing;
  return prisma.corpusVersion.create({ data: { version: 1 } });
}

// ─── Route registration ───────────────────────────────────────────────────────

export function registerEvidenceRoutes(app: Express): void {

  /**
   * POST /api/evidence
   * Add a new evidence message to the active corpus version.
   */
  app.post("/api/evidence", async (req: Request, res: Response) => {
    const parse = AddEvidenceSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: "Invalid request", details: parse.error.flatten() });
      return;
    }

    const { text, source, sentiment } = parse.data;

    try {
      const version = await getOrCreateActiveVersion();

      const message = await prisma.evidenceMessage.create({
        data: {
          text,
          source,
          sentiment,
          corpusVersionId: version.id,
        },
      });

      // Keep messageCount accurate (best-effort — not used for Lock logic)
      await prisma.corpusVersion.update({
        where: { id: version.id },
        data: { messageCount: { increment: 1 } },
      });

      logger.info({ messageId: message.id, corpusVersion: version.version }, "evidence.added");
      res.status(201).json({ success: true, messageId: message.id, corpusVersion: version.version });
    } catch (err) {
      logger.error({ err }, "evidence.add.failed");
      res.status(500).json({ error: "Failed to add evidence" });
    }
  });

  /**
   * GET /api/evidence/summary
   * Returns total count and breakdown by sentiment for the active corpus version.
   */
  app.get("/api/evidence/summary", async (_req: Request, res: Response) => {
    try {
      const version = await prisma.corpusVersion.findFirst({
        where: { status: "active" },
        orderBy: { version: "desc" },
        include: { messages: true },
      });

      if (!version) {
        res.json({ total: 0, corpusVersion: null, bySentiment: {} });
        return;
      }

      const messages = version.messages;
      const bySentiment = {
        positive: messages.filter(m => m.sentiment === "positive").length,
        negative: messages.filter(m => m.sentiment === "negative").length,
        neutral:  messages.filter(m => m.sentiment === "neutral").length,
        unknown:  messages.filter(m => !m.sentiment).length,
      };

      res.json({
        corpusVersion: version.version,
        status: version.status,
        total: messages.length,
        bySentiment,
      });
    } catch (err) {
      logger.error({ err }, "evidence.summary.failed");
      res.status(500).json({ error: "Failed to fetch summary" });
    }
  });

  /**
   * GET /api/evidence
   * List all evidence messages for the active corpus version (paginated).
   * Query params: page (default 1), limit (default 50, max 200)
   */
  app.get("/api/evidence", async (req: Request, res: Response) => {
    const page  = Math.max(1, parseInt(String(req.query.page  ?? "1"), 10));
    const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit ?? "50"), 10)));
    const skip  = (page - 1) * limit;

    try {
      const version = await prisma.corpusVersion.findFirst({
        where: { status: "active" },
        orderBy: { version: "desc" },
      });

      if (!version) {
        res.json({ data: [], total: 0, page, limit });
        return;
      }

      const [data, total] = await Promise.all([
        prisma.evidenceMessage.findMany({
          where: { corpusVersionId: version.id },
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
        prisma.evidenceMessage.count({ where: { corpusVersionId: version.id } }),
      ]);

      res.json({ data, total, page, limit, corpusVersion: version.version });
    } catch (err) {
      logger.error({ err }, "evidence.list.failed");
      res.status(500).json({ error: "Failed to list evidence" });
    }
  });
}
