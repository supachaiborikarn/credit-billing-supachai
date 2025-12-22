import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { getStartOfDayBangkok, getEndOfDayBangkok, createTransactionDate, getTodayBangkok } from '@/lib/date-utils';
import { buildTruckCodeMap, findCodeByPlate } from '@/lib/truck-utils';
import { HttpErrors, getErrorMessage } from '@/lib/api-error';
import { PaymentType } from '@prisma/client';

interface TransactionInput {
    date: string;
    licensePlate?: string;
    ownerName?: string;
    paymentType: string;
    nozzleNumber?: number;
    liters: number;
    pricePerLiter: number;
    amount: number;
    billBookNo?: string;
    billNo?: string;
    productType?: string;
    fuelType?: string;
    transferProofUrl?: string;
}

// GET transactions for a station by date
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const stationId = `station-${id}`;
        const { searchParams } = new URL(request.url);
        const dateStr = searchParams.get('date') || getTodayBangkok();

        // Get transactions for the day (Bangkok timezone)
        const startOfDay = getStartOfDayBangkok(dateStr);
        const endOfDay = getEndOfDayBangkok(dateStr);

        // Get user from session to filter by staff
        const cookieStore = await cookies();
        const sessionId = cookieStore.get('session')?.value;

        let userId: string | null = null;
        let userRole: string = 'STAFF';

        if (sessionId) {
            const session = await prisma.session.findUnique({
                where: { id: sessionId },
                include: { user: { select: { id: true, role: true } } }
            });
            if (session && session.expiresAt > new Date()) {
                userId = session.user.id;
                userRole = session.user.role;
            }
        }

        // Build where clause - Staff sees only their own, Admin sees all
        const whereClause: Record<string, unknown> = {
            stationId,
            date: { gte: startOfDay, lte: endOfDay },
            deletedAt: null,
        };

        // Get optional staffId filter for admin
        const filterStaffId = searchParams.get('staffId');

        if (userRole === 'STAFF' && userId) {
            whereClause.recordedById = userId;
        } else if (userRole === 'ADMIN' && filterStaffId) {
            const staffUser = await prisma.user.findFirst({
                where: { name: filterStaffId }
            });
            if (staffUser) {
                whereClause.recordedById = staffUser.id;
            }
        }

        const transactions = await prisma.transaction.findMany({
            where: whereClause,
            orderBy: { date: 'asc' },
            include: {
                owner: { select: { name: true, code: true } },
                truck: { select: { licensePlate: true, code: true } },
                recordedBy: { select: { name: true } }
            }
        });

        // Build truck code map for C-Code lookup
        const truckCodeMap = await buildTruckCodeMap();

        const formattedTransactions = transactions.map(t => {
            const plate = t.licensePlate || t.truck?.licensePlate || '';
            return {
                id: t.id,
                date: t.date.toISOString(),
                licensePlate: plate,
                ownerName: t.owner?.name || t.ownerName || '',
                ownerCode: t.truck?.code || findCodeByPlate(plate, truckCodeMap) || t.owner?.code || null,
                paymentType: t.paymentType,
                fuelType: t.productType || 'DIESEL',
                liters: Number(t.liters),
                pricePerLiter: Number(t.pricePerLiter),
                amount: Number(t.amount),
                bookNo: t.billBookNo || '',
                billNo: t.billNo || '',
                recordedByName: t.recordedBy?.name || '-',
            };
        });

        return NextResponse.json(formattedTransactions);
    } catch (error) {
        console.error('[Station Transactions GET]:', error);
        return HttpErrors.internal(getErrorMessage(error));
    }
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const stationId = `station-${id}`;
        const body: TransactionInput = await request.json();
        const {
            date: dateStr,
            licensePlate,
            ownerName,
            paymentType,
            nozzleNumber,
            liters,
            pricePerLiter,
            amount,
            billBookNo,
            billNo,
            productType,
            fuelType,
            transferProofUrl,
        } = body;

        // Use fuelType if provided, fallback to productType
        const actualProductType = fuelType || productType;

        // Get user from session - REQUIRE authentication
        const cookieStore = await cookies();
        const sessionId = cookieStore.get('session')?.value;

        if (!sessionId) {
            return HttpErrors.unauthorized('กรุณาเข้าสู่ระบบ');
        }

        const session = await prisma.session.findUnique({
            where: { id: sessionId },
            select: { userId: true, expiresAt: true }
        });

        if (!session) {
            return HttpErrors.unauthorized('Session ไม่ถูกต้อง');
        }

        if (session.expiresAt < new Date()) {
            return HttpErrors.unauthorized('Session หมดอายุ กรุณาเข้าสู่ระบบใหม่');
        }

        const userId = session.userId;

        // Get or create daily record for FULL station
        const date = getStartOfDayBangkok(dateStr);

        let dailyRecordId = null;
        const station = await prisma.station.findUnique({ where: { id: stationId } });

        if (station?.type === 'FULL') {
            const dailyRecord = await prisma.dailyRecord.upsert({
                where: { stationId_date: { stationId, date } },
                update: {},
                create: {
                    stationId,
                    date,
                    retailPrice: 31.34,
                    wholesalePrice: 30.5,
                    status: 'OPEN',
                }
            });
            dailyRecordId = dailyRecord.id;
        }

        // Find owner by name if credit
        let ownerId = null;
        if (paymentType === 'CREDIT' && ownerName) {
            const owner = await prisma.owner.findFirst({
                where: { name: { contains: ownerName } }
            });
            if (owner) ownerId = owner.id;
        }

        // Check for duplicates
        const startOfDay = getStartOfDayBangkok(dateStr);
        const endOfDay = getEndOfDayBangkok(dateStr);

        // Bill duplicate logging (informational only)
        if (billBookNo && billNo) {
            const billDuplicate = await prisma.transaction.findFirst({
                where: {
                    stationId,
                    billBookNo: billBookNo,
                    billNo: billNo,
                    deletedAt: null,
                }
            });

            if (billDuplicate) {
                console.log(`[Bill Duplicate Info] เล่ม ${billBookNo} เลขที่ ${billNo} exists`);
            }
        }

        // Plate duplicate check (blocking)
        const hasValidPlate = licensePlate && licensePlate.trim() !== '' && licensePlate !== '0';

        if (hasValidPlate) {
            const plateDuplicate = await prisma.transaction.findFirst({
                where: {
                    stationId,
                    date: { gte: startOfDay, lte: endOfDay },
                    licensePlate: licensePlate,
                    amount: amount,
                    paymentType: paymentType as PaymentType,
                    deletedAt: null,
                }
            });

            if (plateDuplicate) {
                return HttpErrors.conflict(
                    `รายการซ้ำ: พบรายการ ${paymentType} ทะเบียน ${licensePlate} ยอด ${amount} บาท ในวันที่ ${dateStr} แล้ว`
                );
            }
        }

        // Create transaction
        const transaction = await prisma.transaction.create({
            data: {
                stationId,
                dailyRecordId,
                date: createTransactionDate(dateStr),
                licensePlate,
                ownerName,
                ownerId,
                paymentType: paymentType as PaymentType,
                nozzleNumber,
                liters,
                pricePerLiter,
                amount,
                billBookNo,
                billNo,
                productType: actualProductType,
                transferProofUrl,
                recordedById: userId,
            }
        });

        return NextResponse.json({ success: true, transaction });
    } catch (error) {
        console.error('[Station Transaction POST]:', error);
        return HttpErrors.internal(getErrorMessage(error));
    }
}
