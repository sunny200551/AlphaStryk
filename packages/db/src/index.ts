import { PrismaClient } from '@prisma/client';

// Ensure a single instance of PrismaClient is used in development mode (hot reloading)
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export * from '@prisma/client';
