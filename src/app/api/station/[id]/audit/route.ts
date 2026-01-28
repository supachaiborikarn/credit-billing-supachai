import { NextRequest, NextResponse } from 'next/server';

// Simplified audit log - in production, this would query an actual audit_logs table
// For now, we return mock data to demonstrate the UI

interface MockAuditLog {
    id: string;
    timestamp: string;
    action: 'CREATE' | 'UPDATE' | 'DELETE';
    entityType: 'TRANSACTION' | 'METER' | 'DAILY_RECORD';
    entityId: string;
    userId: string;
    userName: string;
    changes: { field: string; oldValue: string; newValue: string }[];
    isPostClose: boolean;
    reason?: string;
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const { searchParams } = new URL(request.url);
        const date = searchParams.get('date');

        if (!date) {
            return NextResponse.json({ error: 'Date is required' }, { status: 400 });
        }

        // In production, you would query an audit_logs table like:
        // const logs = await prisma.auditLog.findMany({
        //     where: {
        //         stationId: parseInt(id),
        //         date: new Date(date),
        //     },
        //     orderBy: { timestamp: 'desc' },
        // });

        // For now, return empty array (no mock data)
        // The UI will show "ไม่มีประวัติการแก้ไข"
        const logs: MockAuditLog[] = [];

        return NextResponse.json({ logs });
    } catch (error) {
        console.error('Error fetching audit logs:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
