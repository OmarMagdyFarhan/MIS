/**
 * Corpus routes — corpus version status and lock management.
 *
 * The corpus version is the foundation of Lock 1: every pipeline run records
 * the corpus version at start and aborts if the version changes mid-run.
 * These routes expose the current corpus state so clients can display the
 * SystemStateIndicator and gate pipeline start/stop.
 *
 * @module server/routes/corpus
 */

import type { Express, Request, Response } from "express";
import { prisma } from "../db/prisma.js";
import { logger } from "../logger.js";

export function registerCorpusRoutes(app: Express): void {

  /**
   * GET /api/corpus/status
   * Returns the current active corpus version and its lock state.
   */
  app.get("/api/corpus/status", async (_req: Request, res: Response) => {
    try {
      const version = await prisma.corpusVersion.findFirst({
        where: { status: "active" },
        orderBy: { version: "desc" },
        include: {
          _count: {
            select: { messages: true, clusters: true },
          },
        },
      });

      if (!version) {
        res.json({
          version: null,
          status: "no-corpus",
          locked: false,
          messageCount: 0,
          clusterCount: 0,
        });
        return;
      }

      res.json({
        id: version.id,
        version: version.version,
        status: version.status,
        locked: version.status === "locked",
        messageCount: version._count.messages,
        clusterCount: version._count.clusters,
        lockedAt: version.lockedAt,
      });
    } catch (err) {
      logger.error({ err }, "corpus.status.failed");
      res.status(500).json({ error: "Failed to fetch corpus status" });
    }
  });

  /**
   * POST /api/corpus/lock
   * Lock the current active corpus version before starting a pipeline run.
   * Returns the locked version number for the pipeline to record.
   */
  app.post("/api/corpus/lock", async (_req: Request, res: Response) => {
    try {
      const version = await prisma.corpusVersion.findFirst({
        where: { status: "active" },
        orderBy: { version: "desc" },
      });

      if (!version) {
        res.status(404).json({ error: "No active corpus version found" });
        return;
      }

      const locked = await prisma.corpusVersion.update({
        where: { id: version.id },
        data: { status: "locked", lockedAt: new Date() },
      });

      logger.info({ corpusVersion: locked.version }, "corpus.locked");
      res.json({ success: true, version: locked.version, lockedAt: locked.lockedAt });
    } catch (err) {
      logger.error({ err }, "corpus.lock.failed");
      res.status(500).json({ error: "Failed to lock corpus" });
    }
  });

  /**
   * POST /api/corpus/unlock
   * Unlock the corpus after a pipeline run completes or is aborted.
   * Creates a new active version to receive subsequent evidence.
   */
  app.post("/api/corpus/unlock", async (_req: Request, res: Response) => {
    try {
      // Archive any locked versions
      await prisma.corpusVersion.updateMany({
        where: { status: "locked" },
        data: { status: "archived" },
      });

      // Create a fresh active version for new evidence
      const newVersion = await prisma.corpusVersion.create({
        data: {},
      });

      logger.info({ newCorpusVersion: newVersion.version }, "corpus.unlocked");
      res.json({ success: true, newVersion: newVersion.version });
    } catch (err) {
      logger.error({ err }, "corpus.unlock.failed");
      res.status(500).json({ error: "Failed to unlock corpus" });
    }
  });

  /**
   * GET /api/corpus/runs
   * List recent pipeline runs with their status.
   */
  app.get("/api/corpus/runs", async (req: Request, res: Response) => {
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? "10"), 10)));
    try {
      const runs = await prisma.pipelineRun.findMany({
        orderBy: { startedAt: "desc" },
        take: limit,
        include: {
          corpusVersion: { select: { version: true, status: true } },
        },
      });
      res.json(runs);
    } catch (err) {
      logger.error({ err }, "corpus.runs.failed");
      res.status(500).json({ error: "Failed to list runs" });
    }
  });
}
