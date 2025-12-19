import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
    try {
        const owners = await prisma.owner.findMany({
            orderBy: { name: 'asc' },
            include: {
                _count: { select: { trucks: true, transactions: true } }
            }
        });

        return NextResponse.json(owners);
    } catch (error) {
        console.error('Owners GET error:', error);
        return NextResponse.json({ error: 'Failed to fetch owners' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { name, phone, venderCode, groupType } = body;

        if (!name || !name.trim()) {
            return NextResponse.json({ error: 'กรุณากรอกชื่อลูกค้า' }, { status: 400 });
        }

        // Check for duplicate owner name (prevent same name with different ID)
        const existingOwner = await prisma.owner.findFirst({
            where: {
                name: {
                    equals: name.trim(),
                    mode: 'insensitive' // case-insensitive comparison
                }
            }
        });

        if (existingOwner) {
            return NextResponse.json({
                error: `ลูกค้าชื่อ "${name}" มีในระบบแล้ว (${existingOwner.code || 'ไม่มีรหัส'})`
            }, { status: 400 });
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
                groupType: groupType || 'GENERAL_CREDIT',
                code: newCode,
            },
            include: {
                _count: { select: { trucks: true } }
            }
        });

        return NextResponse.json(owner);
    } catch (error) {
        console.error('Owner POST error:', error);
        return NextResponse.json({ error: 'Failed to create owner' }, { status: 500 });
    }
}
