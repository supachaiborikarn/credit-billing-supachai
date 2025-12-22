import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { getStartOfDayBangkok, getEndOfDayBangkok, createTransactionDate, getTodayBangkok } from '@/lib/date-utils';
import { buildTruckCodeMap, findCodeByPlate } from '@/lib/truck-utils';

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
        const viewAll = searchParams.get('viewAll') === 'true'; // For admin toggle

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

        // Build where clause - Staff sees only their own, Admin sees all (with optional filter)
        const whereClause: Record<string, unknown> = {
            stationId,
            date: { gte: startOfDay, lte: endOfDay },
            deletedAt: null,
        };

        // Get optional staffId filter for admin
        const filterStaffId = searchParams.get('staffId');

        // Staff role: filter by recordedById (always)
        // Admin role: show all by default, or filter by specific staffId
        if (userRole === 'STAFF' && userId) {
            whereClause.recordedById = userId;
        } else if (userRole === 'ADMIN') {
            // Admin can filter by specific staff using staffId param
            if (filterStaffId) {
                // Find user by name to get their ID
                const staffUser = await prisma.user.findFirst({
                    where: { name: filterStaffId }
                });
                if (staffUser) {
                    whereClause.recordedById = staffUser.id;
                }
            }
            // If no staffId filter and viewAll=true (default), show all transactions
        }
        // viewAll param is now only used for backward compatibility

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

        // Format response for simple-station page
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
        console.error('Transactions GET error:', error);
        return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
    }
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const stationId = `station-${id}`;
        const body = await request.json();
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
            fuelType,  // BillEntryForm sends fuelType
            transferProofUrl,
        } = body;

        // Use fuelType if provided, fallback to productType
        const actualProductType = fuelType || productType;

        // Get user from session - REQUIRE authentication
        const cookieStore = await cookies();
        const sessionId = cookieStore.get('session')?.value;

        if (!sessionId) {
            return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
        }

        const session = await prisma.session.findUnique({
            where: { id: sessionId },
            select: { userId: true, expiresAt: true }
        });

        if (!session) {
            return NextResponse.json({ error: 'Session ไม่ถูกต้อง' }, { status: 401 });
        }

        // Check session expiry
        if (session.expiresAt < new Date()) {
            return NextResponse.json({ error: 'Session หมดอายุ กรุณาเข้าสู่ระบบใหม่' }, { status: 401 });
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

        // Check for duplicates - be more strict to avoid false positives
        // Only consider duplicate if SAME bill book+number OR same plate+amount+type on same day
        const startOfDay = getStartOfDayBangkok(dateStr);
        const endOfDay = getEndOfDayBangkok(dateStr);

        // First check: exact same bill book + bill number (if provided)
        // NOTE: This is now just informational - we don't block because same bill numbers can exist for different owners
        if (billBookNo && billNo) {
            const billDuplicate = await prisma.transaction.findFirst({
                where: {
                    stationId,
                    billBookNo: billBookNo,
                    billNo: billNo,
                    deletedAt: null,
                }
            });

            // Log duplicate for reference but don't block - different owners can have same bill numbers
            if (billDuplicate) {
                console.log(`Bill duplicate info: เล่ม ${billBookNo} เลขที่ ${billNo} exists (date: ${billDuplicate.date.toLocaleDateString('th-TH')}), but allowing different owner entry`);
            }
        }

        // Second check: same plate + same amount + same type on same day
        // This catches true duplicates like double-clicking submit
        // Only check if licensePlate is a valid non-empty string (not "0", not empty)
        const hasValidPlate = licensePlate && licensePlate.trim() !== '' && licensePlate !== '0';

        if (hasValidPlate) {
            const plateDuplicate = await prisma.transaction.findFirst({
                where: {
                    stationId,
                    date: { gte: startOfDay, lte: endOfDay },
                    licensePlate: licensePlate,
                    amount: amount,
                    paymentType: paymentType,
                    deletedAt: null,
                }
            });

            if (plateDuplicate) {
                return NextResponse.json({
                    error: `รายการซ้ำ: พบรายการ ${paymentType} ทะเบียน ${licensePlate} ยอด ${amount} บาท ในวันที่ ${dateStr} แล้ว`
                }, { status: 409 });
            }
        }

        // Create transaction
        const transaction = await prisma.transaction.create({
            data: {
                stationId,
                dailyRecordId,
                date: createTransactionDate(dateStr), // Use selected date with current Bangkok time
                licensePlate,
                ownerName,
                ownerId,
                paymentType,
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
        console.error('Transaction POST error:', error);
        return NextResponse.json({ error: 'Failed to save transaction' }, { status: 500 });
    }
}
