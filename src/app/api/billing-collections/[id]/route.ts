import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminApi, requireApiSession } from '@/lib/api-auth';

// GET /api/billing-collections/[id] — ดึงรายละเอียด
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const auth = await requireApiSession();
        if (auth.response) return auth.response;

        const { id } = await params;
        const collection = await prisma.billingCollection.findUnique({
            where: { id },
            include: {
                owner: { select: { id: true, name: true, code: true, phone: true } },
                items: { orderBy: { createdAt: 'asc' } },
                paymentSlips: { orderBy: { createdAt: 'desc' } },
            },
        });

        if (!collection) {
            return NextResponse.json({ error: 'ไม่พบใบวางบิลรวม' }, { status: 404 });
        }

        return NextResponse.json(collection);
    } catch (error) {
        console.error('Error fetching billing collection:', error);
        return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 });
    }
}

// PATCH /api/billing-collections/[id] — อัพเดตข้อมูล
export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const auth = await requireAdminApi();
        if (auth.response) return auth.response;

        const { id } = await params;
        const body = await request.json();
        const { status, notes, dueDate, periodLabel } = body;

        const updateData: Record<string, unknown> = {};
        if (status) updateData.status = status;
        if (notes !== undefined) updateData.notes = notes;
        if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;
        if (periodLabel !== undefined) updateData.periodLabel = periodLabel;

        const updated = await prisma.billingCollection.update({
            where: { id },
            data: updateData,
            include: {
                owner: { select: { id: true, name: true, code: true } },
                _count: { select: { items: true, paymentSlips: true } },
            },
        });

        return NextResponse.json(updated);
    } catch (error) {
        console.error('Error updating billing collection:', error);
        return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการอัพเดต' }, { status: 500 });
    }
}

// DELETE /api/billing-collections/[id] — ลบใบวางบิลรวม
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const auth = await requireAdminApi();
        if (auth.response) return auth.response;

        const { id } = await params;

        await prisma.billingCollection.delete({ where: { id } });

        return NextResponse.json({ message: 'ลบใบวางบิลรวมเรียบร้อย' });
    } catch (error) {
        console.error('Error deleting billing collection:', error);
        return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการลบ' }, { status: 500 });
    }
}
