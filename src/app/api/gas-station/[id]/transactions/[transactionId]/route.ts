import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { HttpErrors, getErrorMessage } from '@/lib/api-error';

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; transactionId: string }> }
) {
    try {
        const { id, transactionId } = await params;
        const stationId = `station-${id}`;

        // Find the transaction first
        const transaction = await prisma.transaction.findFirst({
            where: {
                id: transactionId,
                stationId: stationId,
                deletedAt: null,
            }
        });

        if (!transaction) {
            return HttpErrors.notFound('ไม่พบรายการ');
        }

        // Soft delete the transaction
        await prisma.transaction.update({
            where: { id: transactionId },
            data: { deletedAt: new Date() }
        });

        return NextResponse.json({ success: true, message: 'ลบรายการเรียบร้อย' });
    } catch (error) {
        console.error('[Gas Station Transaction DELETE]:', error);
        return HttpErrors.internal(getErrorMessage(error));
    }
}
