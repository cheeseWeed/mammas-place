// Prisma client singleton — prevents serverless cold-start connection storms.
//
// `import 'server-only'` makes the build fail if any 'use client' module
// transitively imports this file — we have repeatedly shipped client crashes
// from server-only imports leaking into client bundles, and the build-time
// guard is the only durable fix.
import 'server-only';
import { PrismaClient } from '@prisma/client';

declare global {

  var __prisma: PrismaClient | undefined;
}

export const prisma = global.__prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  global.__prisma = prisma;
}
