import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Check for potential duplicate owners by name or phone
export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const name = searchParams.get('name') || '';
        const phone = searchParams.get('phone') || '';

        if (!name && !phone) {
            return NextResponse.json({ duplicates: [] });
        }

        const conditions = [];

        // Check similar names (case insensitive contains)
        if (name.length >= 3) {
            conditions.push({
                name: { contains: name.trim(), mode: 'insensitive' as const }
            });
        }

        // Check exact phone match
        if (phone.length >= 6) {
            conditions.push({
                phone: { contains: phone.replace(/[-\s]/g, ''), mode: 'insensitive' as const }
            });
        }

        if (conditions.length === 0) {
            return NextResponse.json({ duplicates: [] });
        }

        const duplicates = await prisma.owner.findMany({
            where: {
                OR: conditions
            },
            select: {
                id: true,
                name: true,
                phone: true,
                code: true,
                status: true,
                _count: { select: { trucks: true, transactions: true } }
            },
            take: 5,
            orderBy: { name: 'asc' }
        });

        return NextResponse.json({
            duplicates,
            hasDuplicates: duplicates.length > 0
        });
    } catch (error) {
        console.error('Duplicate check error:', error);
        return NextResponse.json({ error: 'Failed to check duplicates', duplicates: [] }, { status: 500 });
    }
}
