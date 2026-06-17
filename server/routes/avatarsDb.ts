/**
 * Avatar DB routes — CRUD for Avatar rows persisted in Supabase via Prisma.
 *
 * Implements Lock 3 (Schema Lock): every avatar records the taskType and
 * temperature used at generation time so the AI call context is auditable.
 *
 * @module server/routes/avatarsDb
 */

import type { Express, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { logger } from "../logger.js";

// ─── Validation schemas ───────────────────────────────────────────────────────

const CreateAvatarSchema = z.object({
  name:        z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
  claims:      z.array(z.string()).default([]),
  clusterId:   z.string().optional(),
  taskType:    z.enum(["classification", "structure", "generation"]).default("structure"),
  temperature: z.number().min(0).max(1).default(0.0),
});

// ─── Route registration ───────────────────────────────────────────────────────

export function registerAvatarDbRoutes(app: Express): void {

  /**
   * POST /api/avatars
   * Persist a newly generated Customer Profile to the database.
   */
  app.post("/api/avatars", async (req: Request, res: Response) => {
    const parse = CreateAvatarSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: "Invalid request", details: parse.error.flatten() });
      return;
    }

    const { name, description, claims, clusterId, taskType, temperature } = parse.data;

    try {
      const avatar = await prisma.avatar.create({
        data: {
          name,
          description,
          claims,
          clusterId: clusterId ?? null,
          taskType,
          temperature,
        },
        include: { cluster: true },
      });

      logger.info({ avatarId: avatar.id, taskType, temperature }, "avatar.created");
      res.status(201).json({ success: true, avatarId: avatar.id, avatar });
    } catch (err) {
      logger.error({ err }, "avatar.create.failed");
      res.status(500).json({ error: "Failed to create avatar" });
    }
  });

  /**
   * GET /api/avatars
   * List all persisted Customer Profiles, newest first.
   */
  app.get("/api/avatars", async (_req: Request, res: Response) => {
    try {
      const avatars = await prisma.avatar.findMany({
        include: { cluster: true },
        orderBy: { createdAt: "desc" },
      });

      res.json(avatars);
    } catch (err) {
      logger.error({ err }, "avatar.list.failed");
      res.status(500).json({ error: "Failed to list avatars" });
    }
  });

  /**
   * GET /api/avatars/:id
   * Fetch a single Customer Profile by ID.
   */
  app.get("/api/avatars/:id", async (req: Request, res: Response) => {
    try {
      const avatar = await prisma.avatar.findUnique({
        where: { id: req.params.id },
        include: { cluster: true },
      });

      if (!avatar) {
        res.status(404).json({ error: "Avatar not found" });
        return;
      }

      res.json(avatar);
    } catch (err) {
      logger.error({ err, id: req.params.id }, "avatar.get.failed");
      res.status(500).json({ error: "Failed to fetch avatar" });
    }
  });

  /**
   * DELETE /api/avatars/:id
   * Remove a persisted Customer Profile by ID.
   *
   * Returns 404 if the avatar does not exist (prevents a blind Prisma throw
   * from falling into the 500 catch block with a misleading error message).
   * Returns 200 { success: true } on successful deletion.
   */
  app.delete("/api/avatars/:id", async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
      // Check existence before deleting so we can return a clean 404
      // rather than letting Prisma throw P2025 into the catch block.
      const existing = await prisma.avatar.findUnique({ where: { id } });
      if (!existing) {
        res.status(404).json({ error: "Avatar not found" });
        return;
      }

      await prisma.avatar.delete({ where: { id } });
      logger.info({ id }, "avatar.deleted");
      res.status(200).json({ success: true });
    } catch (err) {
      logger.error({ err, id }, "avatar.delete.failed");
      res.status(500).json({ error: "Failed to delete avatar" });
    }
  });
}
