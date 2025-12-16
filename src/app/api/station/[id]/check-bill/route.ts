import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Check if bill number already exists for a station
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const stationId = `station-${id}`;
        const { searchParams } = new URL(request.url);
        const bookNo = searchParams.get('bookNo');
        const billNo = searchParams.get('billNo');

        if (!bookNo || !billNo) {
            return NextResponse.json({ exists: false });
        }

        // Find existing transactions with the same book and bill number
        const existingTransactions = await prisma.transaction.findMany({
            where: {
                stationId,
                billBookNo: bookNo,
                billNo: billNo,
            },
            select: {
                id: true,
                date: true,
                licensePlate: true,
                ownerName: true,
                amount: true,
            },
            take: 5, // Limit to 5 results
        });

        return NextResponse.json({
            exists: existingTransactions.length > 0,
            count: existingTransactions.length,
            transactions: existingTransactions.map(t => ({
                id: t.id,
                date: t.date.toISOString(),
                licensePlate: t.licensePlate || '',
                ownerName: t.ownerName || '',
                amount: Number(t.amount),
            })),
        });
    } catch (error) {
        console.error('Check bill error:', error);
        return NextResponse.json({ error: 'Failed to check bill' }, { status: 500 });
    }
}
