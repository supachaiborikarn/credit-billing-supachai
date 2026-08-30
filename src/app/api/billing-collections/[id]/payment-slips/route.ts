import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminApi } from '@/lib/api-auth';

const PAYMENT_TOLERANCE = 0.01;

// POST /api/billing-collections/[id]/payment-slips — เพิ่มสลิปการชำระเงิน
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const auth = await requireAdminApi();
        if (auth.response) return auth.response;

        const { id } = await params;
        const body = await request.json();
        const { slipImageUrl, amount, transferDate, senderName, bankName, notes } = body;
        const paymentAmount = Number(amount);

        if (!slipImageUrl || !Number.isFinite(paymentAmount) || paymentAmount <= 0) {
            return NextResponse.json(
                { error: 'กรุณาอัพโหลดรูปสลิปและกรอกยอดเงินที่มากกว่า 0' },
                { status: 400 }
            );
        }

        const collection = await prisma.billingCollection.findUnique({
            where: { id },
            select: {
                id: true,
                totalAmount: true,
                paidAmount: true,
                paymentSlips: {
                    where: { status: 'PENDING' },
                    select: { id: true },
                    take: 1,
                },
            },
        });
        if (!collection) {
            return NextResponse.json({ error: 'ไม่พบใบวางบิลรวม' }, { status: 404 });
        }

        if (collection.paymentSlips.length > 0) {
            return NextResponse.json(
                { error: 'มีสลิปรอตรวจอยู่แล้ว กรุณาตรวจสลิปเดิมก่อนเพิ่มสลิปใหม่' },
                { status: 409 }
            );
        }

        const remainingAmount = Number(collection.totalAmount) - Number(collection.paidAmount);
        if (paymentAmount > remainingAmount + PAYMENT_TOLERANCE) {
            return NextResponse.json(
                { error: `ยอดในสลิปเกินยอดคงเหลือ (เหลือ ${remainingAmount.toLocaleString()} บาท)` },
                { status: 400 }
            );
        }

        const slip = await prisma.paymentSlip.create({
            data: {
                billingCollectionId: id,
                slipImageUrl,
                amount: paymentAmount,
                transferDate: transferDate ? new Date(transferDate) : null,
                senderName: senderName || null,
                bankName: bankName || null,
                notes: notes || null,
            },
        });

        return NextResponse.json(slip, { status: 201 });
    } catch (error) {
        console.error('Error creating payment slip:', error);
        return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 });
    }
}
