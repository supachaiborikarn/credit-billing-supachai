import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { HttpErrors, getErrorMessage } from '@/lib/api-error';
import { OwnerGroup } from '@prisma/client';

interface OwnerInput {
    name: string;
    phone?: string;
    venderCode?: string;
    groupType?: string;
}

export async function GET() {
    try {
        const owners = await prisma.owner.findMany({
            orderBy: { name: 'asc' },
            include: {
                trucks: {
                    select: {
                        id: true,
                        licensePlate: true,
                    },
                    orderBy: { licensePlate: 'asc' }
                },
                _count: { select: { trucks: true, transactions: true } }
            }
        });

        // Get unpaid invoice totals for each owner
        const ownerIds = owners.map(o => o.id);
        const invoiceBalances = await prisma.invoice.groupBy({
            by: ['ownerId'],
            where: {
                ownerId: { in: ownerIds },
                status: { in: ['PENDING', 'PARTIAL'] }
            },
            _sum: { totalAmount: true, paidAmount: true }
        });

        const balanceMap = new Map(
            invoiceBalances.map(b => [
                b.ownerId,
                (Number(b._sum?.totalAmount) || 0) - (Number(b._sum?.paidAmount) || 0)
            ])
        );

        const result = owners.map(owner => ({
            ...owner,
            balance: balanceMap.get(owner.id) || 0
        }));

        return NextResponse.json(result);
    } catch (error) {
        console.error('[Owners GET]:', error);
        return HttpErrors.internal(getErrorMessage(error));
    }
}

export async function POST(request: Request) {
    try {
        const body: OwnerInput = await request.json();
        const { name, phone, venderCode, groupType } = body;

        if (!name || !name.trim()) {
            return HttpErrors.badRequest('กรุณากรอกชื่อลูกค้า');
        }

        // Check for duplicate owner name
        const existingOwner = await prisma.owner.findFirst({
            where: {
                name: {
                    equals: name.trim(),
                    mode: 'insensitive'
                }
            }
        });

        if (existingOwner) {
            return HttpErrors.conflict(
                `ลูกค้าชื่อ "${name}" มีในระบบแล้ว (${existingOwner.code || 'ไม่มีรหัส'})`
            );
        }

        // Generate C-code ONLY for SUGAR_FACTORY group
        let newCode: string | null = null;

        if (groupType === 'SUGAR_FACTORY') {
            const lastOwner = await prisma.owner.findFirst({
                where: {
                    code: { startsWith: 'C' },
                    groupType: 'SUGAR_FACTORY'
                },
                orderBy: { code: 'desc' },
            });

            newCode = 'C001';
            if (lastOwner?.code) {
                const num = parseInt(lastOwner.code.replace('C', ''), 10);
                newCode = `C${String(num + 1).padStart(3, '0')}`;
            }
        }

        const owner = await prisma.owner.create({
            data: {
                name: name.trim(),
                phone: phone || null,
                venderCode: venderCode || null,
                groupType: (groupType as OwnerGroup) || 'GENERAL_CREDIT',
                code: newCode,
            },
            include: {
                _count: { select: { trucks: true } }
            }
        });

        return NextResponse.json(owner);
    } catch (error) {
        console.error('[Owner POST]:', error);
        return HttpErrors.internal(getErrorMessage(error));
    }
}
