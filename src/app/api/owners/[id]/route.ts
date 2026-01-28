import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { HttpErrors, getErrorMessage } from '@/lib/api-error';
import { OwnerGroup } from '@prisma/client';

interface UpdateOwnerInput {
    name?: string;
    phone?: string;
    venderCode?: string;
    groupType?: string;
    creditLimit?: number;
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const owner = await prisma.owner.findUnique({
            where: { id },
            include: {
                trucks: {
                    select: { id: true, licensePlate: true },
                    orderBy: { licensePlate: 'asc' }
                },
                _count: { select: { trucks: true, transactions: true } }
            }
        });

        if (!owner) {
            return HttpErrors.notFound('ไม่พบข้อมูลลูกค้า');
        }

        return NextResponse.json(owner);
    } catch (error) {
        console.error('[Owner GET]:', error);
        return HttpErrors.internal(getErrorMessage(error));
    }
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body: UpdateOwnerInput = await request.json();

        // Check if owner exists
        const existing = await prisma.owner.findUnique({ where: { id } });
        if (!existing) {
            return HttpErrors.notFound('ไม่พบข้อมูลลูกค้า');
        }

        // Build update data
        const updateData: Record<string, unknown> = {};

        if (body.name !== undefined) {
            updateData.name = body.name.trim();
        }
        if (body.phone !== undefined) {
            updateData.phone = body.phone || null;
        }
        if (body.venderCode !== undefined) {
            updateData.venderCode = body.venderCode || null;
        }
        if (body.groupType !== undefined) {
            updateData.groupType = body.groupType as OwnerGroup;
        }
        if (body.creditLimit !== undefined) {
            updateData.creditLimit = body.creditLimit;
        }

        const updated = await prisma.owner.update({
            where: { id },
            data: updateData,
            include: {
                trucks: {
                    select: { id: true, licensePlate: true },
                    orderBy: { licensePlate: 'asc' }
                },
                _count: { select: { trucks: true } }
            }
        });

        return NextResponse.json(updated);
    } catch (error) {
        console.error('[Owner PUT]:', error);
        return HttpErrors.internal(getErrorMessage(error));
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        // Check if owner exists
        const existing = await prisma.owner.findUnique({
            where: { id },
            include: { _count: { select: { trucks: true, transactions: true } } }
        });

        if (!existing) {
            return HttpErrors.notFound('ไม่พบข้อมูลลูกค้า');
        }

        // Soft delete: set status to INACTIVE instead of hard delete
        // This preserves data integrity for historical transactions
        await prisma.owner.update({
            where: { id },
            data: {
                status: 'INACTIVE',
                deletedAt: new Date()
            }
        });

        return NextResponse.json({
            success: true,
            message: 'ปิดการใช้งานลูกค้าสำเร็จ',
            note: existing._count.transactions > 0
                ? `ลูกค้านี้มีประวัติธุรกรรม ${existing._count.transactions} รายการ (ยังเก็บข้อมูลไว้)`
                : undefined
        });
    } catch (error) {
        console.error('[Owner DELETE]:', error);
        return HttpErrors.internal(getErrorMessage(error));
    }
}
