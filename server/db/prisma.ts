/**
 * Prisma client singleton.
 *
 * In development, the client is stored on `globalThis` to survive hot-reload
 * without opening extra connections. In production a single module-level
 * instance is created.
 *
 * Usage:
 *   import { prisma } from './prisma.js';
 *   const count = await prisma.evidenceMessage.count();
 *
 * @module server/db/prisma
 */

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "warn", "error"]
        : ["warn", "error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

/** Gracefully disconnect on process exit. */
process.on("beforeExit", async () => {
  await prisma.$disconnect();
});
