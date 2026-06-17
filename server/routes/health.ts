/**
 * Health check route.
 * Returns server status, database connectivity, and Three-Lock system state.
 *
 * @module server/routes/health
 */

import type { Express, Request, Response } from "express";
import { prisma } from "../db/prisma.js";
import { logger } from "../logger.js";

export function registerHealthRoute(app: Express): void {

  app.get("/health", async (_req: Request, res: Response) => {
    let dbStatus: "connected" | "error" = "error";
    let evidenceCount = 0;
    let activeCorpusVersion: number | null = null;

    try {
      evidenceCount = await prisma.evidenceMessage.count();
      const version = await prisma.corpusVersion.findFirst({
        where: { status: "active" },
        orderBy: { version: "desc" },
      });
      activeCorpusVersion = version?.version ?? null;
      dbStatus = "connected";
    } catch (err) {
      logger.error({ err }, "health.db.failed");
    }

    const body = {
      status: "ok",
      database: dbStatus,
      timestamp: new Date().toISOString(),
      threeLockSystem: {
        lock1_corpusVersioning: dbStatus === "connected",
        lock2_evidenceMessages: dbStatus === "connected",
        lock3_avatarTemperature: true,
      },
      stats: {
        evidenceCount,
        activeCorpusVersion,
      },
    };

    res.status(dbStatus === "connected" ? 200 : 503).json(body);
  });
}
