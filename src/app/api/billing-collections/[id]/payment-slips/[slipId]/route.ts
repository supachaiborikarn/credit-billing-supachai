import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// PATCH /api/billing-collections/[id]/payment-slips/[slipId] — ยืนยัน/ปฏิเสธสลิป
export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string; slipId: string }> }
) {
    try {
        const { id, slipId } = await params;
        const body = await request.json();
        const { status, notes } = body; // status: 'VERIFIED' | 'REJECTED'

        if (!status || !['VERIFIED', 'REJECTED'].includes(status)) {
            return NextResponse.json(
                { error: 'กรุณาระบุสถานะ VERIFIED หรือ REJECTED' },
                { status: 400 }
            );
        }

        // Verify the slip belongs to this collection
        const slip = await prisma.paymentSlip.findFirst({
            where: { id: slipId, billingCollectionId: id },
        });

        if (!slip) {
            return NextResponse.json({ error: 'ไม่พบสลิป' }, { status: 404 });
        }

        // Update slip status
        const updatedSlip = await prisma.paymentSlip.update({
            where: { id: slipId },
            data: {
                status,
                verifiedAt: new Date(),
                notes: notes !== undefined ? notes : slip.notes,
            },
        });

        // Recalculate paidAmount from all VERIFIED slips
        const verifiedSlips = await prisma.paymentSlip.findMany({
            where: {
                billingCollectionId: id,
                status: 'VERIFIED',
            },
        });

        const totalPaid = verifiedSlips.reduce(
            (sum, s) => sum + Number(s.amount),
            0
        );

        // Get the billing collection to check totalAmount
        const collection = await prisma.billingCollection.findUnique({
            where: { id },
        });

        if (!collection) {
            return NextResponse.json({ error: 'ไม่พบใบวางบิลรวม' }, { status: 404 });
        }

        // Determine new status
        let newStatus: 'PENDING' | 'PARTIAL' | 'PAID' | 'OVERDUE' = 'PENDING';
        const totalAmount = Number(collection.totalAmount);
        if (totalPaid >= totalAmount) {
            newStatus = 'PAID';
        } else if (totalPaid > 0) {
            newStatus = 'PARTIAL';
        }

        // Update billing collection
        await prisma.billingCollection.update({
            where: { id },
            data: {
                paidAmount: totalPaid,
                status: newStatus,
            },
        });

        return NextResponse.json({
            slip: updatedSlip,
            paidAmount: totalPaid,
            collectionStatus: newStatus,
        });
    } catch (error) {
        console.error('Error verifying payment slip:', error);
        return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 });
    }
}

// DELETE /api/billing-collections/[id]/payment-slips/[slipId] — ลบสลิป
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string; slipId: string }> }
) {
    try {
        const { id, slipId } = await params;

        // Delete the slip
        await prisma.paymentSlip.delete({ where: { id: slipId } });

        // Recalculate paidAmount
        const verifiedSlips = await prisma.paymentSlip.findMany({
            where: { billingCollectionId: id, status: 'VERIFIED' },
        });

        const totalPaid = verifiedSlips.reduce(
            (sum, s) => sum + Number(s.amount),
            0
        );

        const collection = await prisma.billingCollection.findUnique({ where: { id } });
        if (collection) {
            const totalAmount = Number(collection.totalAmount);
            let newStatus: 'PENDING' | 'PARTIAL' | 'PAID' | 'OVERDUE' = 'PENDING';
            if (totalPaid >= totalAmount) newStatus = 'PAID';
            else if (totalPaid > 0) newStatus = 'PARTIAL';

            await prisma.billingCollection.update({
                where: { id },
                data: { paidAmount: totalPaid, status: newStatus },
            });
        }

        return NextResponse.json({ message: 'ลบสลิปเรียบร้อย' });
    } catch (error) {
        console.error('Error deleting payment slip:', error);
        return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 });
    }
}
