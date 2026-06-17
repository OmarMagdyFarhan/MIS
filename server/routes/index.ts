/**
 * DB routes barrel — registers all database-backed routes on the Express app.
 *
 * Call registerDbRoutes(app) once, after middleware and the AI routes, to
 * mount all Supabase/Prisma-backed endpoints.
 *
 * Registered endpoints:
 *   GET  /health
 *   POST /api/evidence
 *   GET  /api/evidence
 *   GET  /api/evidence/summary
 *   POST /api/avatars
 *   GET  /api/avatars
 *   GET  /api/avatars/:id
 *   DELETE /api/avatars/:id
 *   GET  /api/corpus/status
 *   POST /api/corpus/lock
 *   POST /api/corpus/unlock
 *   GET  /api/corpus/runs
 *
 * @module server/routes
 */

import type { Express } from "express";
import { registerHealthRoute }   from "./health.js";
import { registerEvidenceRoutes } from "./evidence.js";
import { registerAvatarDbRoutes } from "./avatarsDb.js";
import { registerCorpusRoutes }   from "./corpus.js";

export function registerDbRoutes(app: Express): void {
  registerHealthRoute(app);
  registerEvidenceRoutes(app);
  registerAvatarDbRoutes(app);
  registerCorpusRoutes(app);
}
