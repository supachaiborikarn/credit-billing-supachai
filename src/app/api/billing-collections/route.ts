import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminApi, requireApiSession } from '@/lib/api-auth';

// GET /api/billing-collections — ดึงรายการใบวางบิลรวม
export async function GET(request: Request) {
    try {
        const auth = await requireApiSession();
        if (auth.response) return auth.response;

        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status');
        const search = searchParams.get('search');
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '50');

        const where: Record<string, unknown> = {};
        if (status && status !== 'all') {
            where.status = status;
        }
        if (search) {
            where.OR = [
                { ownerName: { contains: search, mode: 'insensitive' } },
                { collectionNo: { contains: search, mode: 'insensitive' } },
            ];
        }

        const [collections, total] = await Promise.all([
            prisma.billingCollection.findMany({
                where,
                include: {
                    owner: { select: { id: true, name: true, code: true, phone: true } },
                    _count: { select: { items: true, paymentSlips: true } },
                },
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma.billingCollection.count({ where }),
        ]);

        return NextResponse.json({ collections, total, page, limit });
    } catch (error) {
        console.error('Error fetching billing collections:', error);
        return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 });
    }
}

// POST /api/billing-collections — สร้างใบวางบิลรวมใหม่
export async function POST(request: Request) {
    try {
        const auth = await requireAdminApi();
        if (auth.response) return auth.response;

        const body = await request.json();
        const { ownerId, periodStart, periodEnd, periodLabel, dueDate, notes, items } = body;

        if (!ownerId || !periodStart || !periodEnd || !items || items.length === 0) {
            return NextResponse.json(
                { error: 'กรุณากรอกข้อมูลให้ครบ (ลูกค้า, ช่วงเวลา, รายการบิล)' },
                { status: 400 }
            );
        }

        // Get owner info
        const owner = await prisma.owner.findUnique({ where: { id: ownerId } });
        if (!owner) {
            return NextResponse.json({ error: 'ไม่พบลูกค้า' }, { status: 404 });
        }

        // Calculate total amount from items
        const totalAmount = items.reduce((sum: number, item: { amount: number }) => sum + Number(item.amount), 0);

        // Generate collection number: BC-YYYY-MM-NNN
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const prefix = `BC-${year}-${month}`;

        const lastCollection = await prisma.billingCollection.findFirst({
            where: { collectionNo: { startsWith: prefix } },
            orderBy: { collectionNo: 'desc' },
        });

        let nextNum = 1;
        if (lastCollection) {
            const lastNum = parseInt(lastCollection.collectionNo.split('-').pop() || '0');
            nextNum = lastNum + 1;
        }
        const collectionNo = `${prefix}-${String(nextNum).padStart(3, '0')}`;

        // Create billing collection with items
        const collection = await prisma.billingCollection.create({
            data: {
                collectionNo,
                ownerId,
                ownerName: owner.name,
                periodStart: new Date(periodStart),
                periodEnd: new Date(periodEnd),
                periodLabel: periodLabel || null,
                totalAmount,
                dueDate: dueDate ? new Date(dueDate) : null,
                notes: notes || null,
                items: {
                    create: items.map((item: { sourceDescription: string; sourceStation?: string; sourceInvoiceNo?: string; amount: number; notes?: string }) => ({
                        sourceDescription: item.sourceDescription,
                        sourceStation: item.sourceStation || null,
                        sourceInvoiceNo: item.sourceInvoiceNo || null,
                        amount: item.amount,
                        notes: item.notes || null,
                    })),
                },
            },
            include: {
                items: true,
                owner: { select: { id: true, name: true, code: true } },
            },
        });

        return NextResponse.json(collection, { status: 201 });
    } catch (error) {
        console.error('Error creating billing collection:', error);
        return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการสร้างใบวางบิลรวม' }, { status: 500 });
    }
}
