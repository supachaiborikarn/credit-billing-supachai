import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Health Check Endpoint
 * ใช้สำหรับตรวจสอบว่าระบบทำงานปกติหรือไม่
 * 
 * GET /api/health
 * 
 * Returns:
 * - status: "ok" | "error"
 * - database: "connected" | "disconnected"
 * - timestamp: เวลาปัจจุบัน
 */
export async function GET() {
    const startTime = Date.now();

    try {
        // ทดสอบเชื่อมต่อ database
        await prisma.$queryRaw`SELECT 1`;

        const responseTime = Date.now() - startTime;

        return NextResponse.json({
            status: 'ok',
            database: 'connected',
            timestamp: new Date().toISOString(),
            responseTimeMs: responseTime,
            version: '1.0.0',
        });
    } catch (error) {
        console.error('[HEALTH] Database connection failed:', error);

        return NextResponse.json(
            {
                status: 'error',
                database: 'disconnected',
                timestamp: new Date().toISOString(),
                error: 'Database connection failed',
            },
            { status: 503 }
        );
    }
}
