import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminApi } from '@/lib/api-auth';

const PAYMENT_TOLERANCE = 0.01;
const COLLECTION_OVERPAYMENT = 'BILLING_COLLECTION_OVERPAYMENT';

// PATCH /api/billing-collections/[id]/payment-slips/[slipId] — ยืนยัน/ปฏิเสธสลิป
export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string; slipId: string }> }
) {
    try {
        const auth = await requireAdminApi();
        if (auth.response) return auth.response;

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

        const { updatedSlip, totalPaid, newStatus } = await prisma.$transaction(async (tx) => {
            const updatedSlip = await tx.paymentSlip.update({
                where: { id: slipId },
                data: {
                    status,
                    verifiedAt: new Date(),
                    notes: notes !== undefined ? notes : slip.notes,
                },
            });

            const verifiedSlips = await tx.paymentSlip.findMany({
                where: {
                    billingCollectionId: id,
                    status: 'VERIFIED',
                },
            });

            const totalPaid = verifiedSlips.reduce(
                (sum, s) => sum + Number(s.amount),
                0
            );

            const collection = await tx.billingCollection.findUnique({
                where: { id },
            });

            if (!collection) {
                throw new Error('BILLING_COLLECTION_NOT_FOUND');
            }

            let newStatus: 'PENDING' | 'PARTIAL' | 'PAID' | 'OVERDUE' = 'PENDING';
            const totalAmount = Number(collection.totalAmount);
            if (totalPaid > totalAmount + PAYMENT_TOLERANCE) {
                throw new Error(COLLECTION_OVERPAYMENT);
            }
            if (totalPaid >= totalAmount) {
                newStatus = 'PAID';
            } else if (totalPaid > 0) {
                newStatus = 'PARTIAL';
            }

            await tx.billingCollection.update({
                where: { id },
                data: {
                    paidAmount: totalPaid,
                    status: newStatus,
                },
            });

            return { updatedSlip, totalPaid, newStatus };
        });

        return NextResponse.json({
            slip: updatedSlip,
            paidAmount: totalPaid,
            collectionStatus: newStatus,
        });
    } catch (error) {
        if (error instanceof Error && error.message === COLLECTION_OVERPAYMENT) {
            return NextResponse.json(
                { error: 'ยอดสลิปที่ยืนยันรวมกันเกินยอดใบวางบิล กรุณาตรวจสอบสลิปก่อนยืนยัน' },
                { status: 409 }
            );
        }
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
        const auth = await requireAdminApi();
        if (auth.response) return auth.response;

        const { id, slipId } = await params;

        const slip = await prisma.paymentSlip.findFirst({
            where: { id: slipId, billingCollectionId: id },
            select: { id: true },
        });

        if (!slip) {
            return NextResponse.json({ error: 'ไม่พบสลิป' }, { status: 404 });
        }

        await prisma.$transaction(async (tx) => {
            await tx.paymentSlip.delete({ where: { id: slipId } });

            const verifiedSlips = await tx.paymentSlip.findMany({
                where: { billingCollectionId: id, status: 'VERIFIED' },
            });

            const totalPaid = verifiedSlips.reduce(
                (sum, s) => sum + Number(s.amount),
                0
            );

            const collection = await tx.billingCollection.findUnique({ where: { id } });
            if (!collection) {
                throw new Error('BILLING_COLLECTION_NOT_FOUND');
            }

            const totalAmount = Number(collection.totalAmount);
            let newStatus: 'PENDING' | 'PARTIAL' | 'PAID' | 'OVERDUE' = 'PENDING';
            if (totalPaid >= totalAmount) newStatus = 'PAID';
            else if (totalPaid > 0) newStatus = 'PARTIAL';

            await tx.billingCollection.update({
                where: { id },
                data: { paidAmount: totalPaid, status: newStatus },
            });
        });

        return NextResponse.json({ message: 'ลบสลิปเรียบร้อย' });
    } catch (error) {
        console.error('Error deleting payment slip:', error);
        return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 });
    }
}
