import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkAndSaveDailyAnomaly } from '@/services/daily-anomaly-detection';

// Track last scan time to avoid scanning too frequently
let lastAutoScanTime: Date | null = null;
const AUTO_SCAN_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes cooldown

/**
 * Auto-scan recent days for anomalies
 * Only scans FULL stations (like station-1 แท๊งลอย) for the last 7 days
 */
async function autoScanRecentDays() {
    // Check cooldown to avoid scanning on every request
    const now = new Date();
    if (lastAutoScanTime && (now.getTime() - lastAutoScanTime.getTime()) < AUTO_SCAN_COOLDOWN_MS) {
        return; // Skip if scanned recently
    }
    lastAutoScanTime = now;

    try {
        // Get FULL stations (stations that use daily meter tracking, not shift-based)
        const fullStations = await prisma.station.findMany({
            where: { type: 'FULL' },
            select: { id: true }
        });

        // Scan last 7 days for each station
        for (const station of fullStations) {
            for (let i = 1; i <= 7; i++) {
                const date = new Date();
                date.setDate(date.getDate() - i);
                await checkAndSaveDailyAnomaly(station.id, date);
            }
        }
        // Auto-scan completed for all full stations
    } catch (error) {
        console.error('[Auto-Scan Error]:', error);
    }
}

/**
 * GET /api/admin/daily-anomalies
 * Get daily anomalies for review (auto-scans recent days first)
 */
export async function GET(request: NextRequest) {
    try {
        // Auto-scan recent days before returning data
        await autoScanRecentDays();

        const { searchParams } = new URL(request.url);
        const stationId = searchParams.get('stationId');
        const status = searchParams.get('status') || 'pending'; // pending | reviewed | all

        const anomalies = await prisma.dailyAnomaly.findMany({
            where: {
                ...(stationId && stationId !== 'all' && { stationId }),
                ...(status === 'pending' && { reviewedAt: null }),
                ...(status === 'reviewed' && { reviewedAt: { not: null } })
            },
            include: {
                station: { select: { name: true } },
                reviewedBy: { select: { name: true } }
            },
            orderBy: { date: 'desc' },
            take: 100
        });

        return NextResponse.json({
            anomalies: anomalies.map(a => ({
                id: a.id,
                stationId: a.stationId,
                stationName: a.station.name,
                date: a.date.toISOString(),
                displayDate: a.date.toLocaleDateString('th-TH', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                }),
                meterTotal: Number(a.meterTotal),
                transTotal: Number(a.transTotal),
                difference: Number(a.difference),
                severity: a.severity,
                note: a.note,
                reviewedAt: a.reviewedAt?.toISOString() || null,
                reviewedBy: a.reviewedBy?.name || null
            }))
        });
    } catch (error) {
        console.error('[Daily Anomalies GET]:', error);
        return NextResponse.json({ error: 'Failed to fetch anomalies' }, { status: 500 });
    }
}

/**
 * POST /api/admin/daily-anomalies
 * Manual trigger to scan for anomalies
 * Body: { days?: number } - default 30 days
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json().catch(() => ({}));
        const days = body.days || 30;

        // Get FULL stations
        const fullStations = await prisma.station.findMany({
            where: { type: 'FULL' },
            select: { id: true, name: true }
        });

        let totalFound = 0;
        const results: { stationId: string; stationName: string; found: number }[] = [];

        for (const station of fullStations) {
            let found = 0;
            for (let i = 1; i <= days; i++) {
                const date = new Date();
                date.setDate(date.getDate() - i);
                const { result } = await checkAndSaveDailyAnomaly(station.id, date);
                if (result.hasAnomaly) found++;
            }
            totalFound += found;
            results.push({ stationId: station.id, stationName: station.name, found });
        }

        // Reset cooldown timer since we just did a full scan
        lastAutoScanTime = new Date();

        return NextResponse.json({
            success: true,
            scanned: fullStations.length,
            days,
            totalFound,
            results
        });
    } catch (error) {
        console.error('[Daily Anomalies POST]:', error);
        return NextResponse.json({ error: 'Failed to scan anomalies' }, { status: 500 });
    }
}
