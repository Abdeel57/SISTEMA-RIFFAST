import { PrismaClient } from '@prisma/client';
import { env } from '../config/env.js';

// Singleton para evitar múltiples conexiones en dev (hot-reload con tsx watch).
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: env.isProd ? ['warn', 'error'] : ['warn', 'error'],
  });

if (!env.isProd) globalForPrisma.prisma = prisma;

export type { Prisma } from '@prisma/client';
