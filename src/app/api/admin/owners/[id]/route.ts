import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// PATCH - อัปเดต Owner (รวมถึง creditLimit)
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { creditLimit, name, phone } = body;

        const updateData: Record<string, unknown> = {};
        if (creditLimit !== undefined) updateData.creditLimit = creditLimit;
        if (name !== undefined) updateData.name = name;
        if (phone !== undefined) updateData.phone = phone;

        const owner = await prisma.owner.update({
            where: { id },
            data: updateData,
            select: {
                id: true,
                name: true,
                creditLimit: true,
                currentCredit: true
            }
        });

        return NextResponse.json({
            ...owner,
            creditLimit: Number(owner.creditLimit),
            currentCredit: Number(owner.currentCredit)
        });
    } catch (error) {
        console.error('Owner PATCH error:', error);
        return NextResponse.json({ error: 'Failed to update owner' }, { status: 500 });
    }
}
