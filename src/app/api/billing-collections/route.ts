import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminApi, requireApiSession } from '@/lib/api-auth';
import { Prisma } from '@prisma/client';
import { buildBillingCollectionNumberPrefix } from '@/lib/billing/document-number';

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
        const { ownerId, periodStart, periodEnd, periodLabel, dueDate, notes, items } = body as {
            ownerId?: string;
            periodStart?: string;
            periodEnd?: string;
            periodLabel?: string;
            dueDate?: string;
            notes?: string;
            items?: Array<{
                sourceDescription?: string;
                sourceStation?: string;
                sourceInvoiceNo?: string;
                amount?: number;
                notes?: string;
            }>;
        };

        if (!ownerId || !periodStart || !periodEnd || !Array.isArray(items) || items.length === 0) {
            return NextResponse.json(
                { error: 'กรุณากรอกข้อมูลให้ครบ (ลูกค้า, ช่วงเวลา, รายการบิล)' },
                { status: 400 }
            );
        }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(periodStart) || !/^\d{4}-\d{2}-\d{2}$/.test(periodEnd) || periodStart > periodEnd) {
            return NextResponse.json({ error: 'ช่วงวันที่ไม่ถูกต้อง' }, { status: 400 });
        }
        if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
            return NextResponse.json({ error: 'วันครบกำหนดไม่ถูกต้อง' }, { status: 400 });
        }
        if (items.length > 100) {
            return NextResponse.json({ error: 'ใบวางบิลรวมรองรับไม่เกิน 100 รายการต่อครั้ง' }, { status: 400 });
        }

        const normalizedItems = items.map((item) => ({
            sourceDescription: item.sourceDescription?.trim() || '',
            sourceStation: item.sourceStation?.trim() || null,
            sourceInvoiceNo: item.sourceInvoiceNo?.trim() || null,
            amount: Number(item.amount),
            notes: item.notes?.trim() || null,
        }));
        if (normalizedItems.some((item) => !item.sourceDescription || !Number.isFinite(item.amount) || item.amount <= 0)) {
            return NextResponse.json({ error: 'ทุกรายการต้องมีรายละเอียดและยอดเงินมากกว่า 0' }, { status: 400 });
        }

        const totalAmount = normalizedItems.reduce((sum, item) => sum + item.amount, 0);
        const collection = await prisma.$transaction(async (tx) => {
            const owner = await tx.owner.findUnique({
                where: { id: ownerId },
                select: { id: true, name: true, status: true },
            });
            if (!owner) throw new Error('OWNER_NOT_FOUND');
            if (owner.status !== 'ACTIVE') throw new Error('OWNER_INACTIVE');

            const prefix = buildBillingCollectionNumberPrefix();
            const lastCollection = await tx.billingCollection.findFirst({
                where: { collectionNo: { startsWith: prefix } },
                orderBy: { collectionNo: 'desc' },
                select: { collectionNo: true },
            });
            const lastNum = lastCollection
                ? Number.parseInt(lastCollection.collectionNo.split('-').pop() || '0', 10)
                : 0;
            const nextNum = Number.isFinite(lastNum) ? lastNum + 1 : 1;
            const collectionNo = `${prefix}-${String(nextNum).padStart(3, '0')}`;

            const created = await tx.billingCollection.create({
                data: {
                    collectionNo,
                    ownerId,
                    ownerName: owner.name,
                    periodStart: new Date(`${periodStart}T00:00:00+07:00`),
                    periodEnd: new Date(`${periodEnd}T23:59:59.999+07:00`),
                    periodLabel: periodLabel?.trim() || null,
                    totalAmount,
                    dueDate: dueDate ? new Date(`${dueDate}T23:59:59.999+07:00`) : null,
                    notes: notes?.trim() || null,
                    items: { create: normalizedItems },
                },
                include: {
                    items: true,
                    owner: { select: { id: true, name: true, code: true } },
                },
            });

            await tx.auditLog.create({
                data: {
                    userId: auth.user.id,
                    action: 'CREATE',
                    model: 'BillingCollection',
                    recordId: created.id,
                    newData: {
                        collectionNo: created.collectionNo,
                        ownerId,
                        totalAmount,
                        itemCount: normalizedItems.length,
                        periodStart,
                        periodEnd,
                    },
                },
            });
            return created;
        }, {
            maxWait: 5000,
            timeout: 20000,
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });

        return NextResponse.json(collection, { status: 201 });
    } catch (error) {
        if (error instanceof Error && error.message === 'OWNER_NOT_FOUND') {
            return NextResponse.json({ error: 'ไม่พบลูกค้า' }, { status: 404 });
        }
        if (error instanceof Error && error.message === 'OWNER_INACTIVE') {
            return NextResponse.json({ error: 'ลูกค้าที่เลือกไม่ได้อยู่สถานะใช้งาน' }, { status: 400 });
        }
        if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === 'P2002' || error.code === 'P2034')) {
            return NextResponse.json({ error: 'มีการสร้างใบวางบิลพร้อมกัน กรุณารีเฟรชแล้วลองใหม่' }, { status: 409 });
        }
        console.error('Error creating billing collection:', error);
        return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการสร้างใบวางบิลรวม' }, { status: 500 });
    }
}
