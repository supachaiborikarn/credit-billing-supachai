import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/admin/daily-anomalies
 * Get daily anomalies for review
 */
export async function GET(request: NextRequest) {
    try {
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
