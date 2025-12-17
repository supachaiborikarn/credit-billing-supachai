import { PrismaClient } from '@prisma/client'
import { ensureEnv } from './env'

// Validate environment on first import
ensureEnv();

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
