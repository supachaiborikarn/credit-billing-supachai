import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireApiSession } from '@/lib/api-auth';

// POST /api/billing-collections/[id]/payment-slips — เพิ่มสลิปการชำระเงิน
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const auth = await requireApiSession();
        if (auth.response) return auth.response;

        const { id } = await params;
        const body = await request.json();
        const { slipImageUrl, amount, transferDate, senderName, bankName, notes } = body;

        if (!slipImageUrl || !amount) {
            return NextResponse.json(
                { error: 'กรุณาอัพโหลดรูปสลิปและกรอกยอดเงิน' },
                { status: 400 }
            );
        }

        // Check billing collection exists
        const collection = await prisma.billingCollection.findUnique({ where: { id } });
        if (!collection) {
            return NextResponse.json({ error: 'ไม่พบใบวางบิลรวม' }, { status: 404 });
        }

        const slip = await prisma.paymentSlip.create({
            data: {
                billingCollectionId: id,
                slipImageUrl,
                amount,
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
