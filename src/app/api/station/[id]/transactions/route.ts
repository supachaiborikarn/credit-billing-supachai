import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { getStartOfDayBangkok, getEndOfDayBangkok, createTransactionDate, getTodayBangkok } from '@/lib/date-utils';
import { buildTruckCodeMap, findCodeByPlate } from '@/lib/truck-utils';
import { HttpErrors, getErrorMessage } from '@/lib/api-error';
import { getSessionUser, getSessionWithError } from '@/lib/auth-utils';
import { PaymentType } from '@prisma/client';

interface TransactionInput {
    date: string;
    licensePlate?: string;
    ownerName?: string;
    ownerId?: string;
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
    products?: Array<{ productId: string; qty: number }>;
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

        // Get user from session to filter by staff (using shared auth helper)
        const sessionUser = await getSessionUser();
        const userId = sessionUser?.id || null;
        const userRole = sessionUser?.role || 'STAFF';

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
                fuelType: t.productType || null,
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

        // CREDIT transactions require owner name
        if (paymentType === 'CREDIT' && !ownerName) {
            return HttpErrors.badRequest('รายการเงินเชื่อต้องระบุชื่อเจ้าของ');
        }

        // Get user from session - REQUIRE authentication (using shared auth helper)
        const { user: sessionUser, error: authError } = await getSessionWithError();

        if (!sessionUser || authError) {
            return HttpErrors.unauthorized(authError || 'กรุณาเข้าสู่ระบบ');
        }

        const userId = sessionUser.id;

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

        // Find owner - prioritize ownerId from frontend, fallback to name search
        let ownerId: string | null = body.ownerId || null;
        if (!ownerId && paymentType === 'CREDIT' && ownerName) {
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
                // Bill duplicate detected - proceeding with different owner entry
            }
        }

        // Plate duplicate check (blocking) - Must also have same bill to be considered duplicate
        const hasValidPlate = licensePlate && licensePlate.trim() !== '' && licensePlate !== '0';

        if (hasValidPlate) {
            // Build duplicate check criteria
            const duplicateWhere: Record<string, unknown> = {
                stationId,
                date: { gte: startOfDay, lte: endOfDay },
                licensePlate: licensePlate,
                amount: amount,
                paymentType: paymentType as PaymentType,
                deletedAt: null,
            };

            // If bill info is provided, add to duplicate check
            // This allows same plate/amount/date if bill is different (e.g., red plate vehicles)
            if (billBookNo && billNo) {
                duplicateWhere.billBookNo = billBookNo;
                duplicateWhere.billNo = billNo;
            }

            const plateDuplicate = await prisma.transaction.findFirst({
                where: duplicateWhere
            });

            if (plateDuplicate) {
                return HttpErrors.conflict(
                    `รายการซ้ำ: พบรายการ ${paymentType} ทะเบียน ${licensePlate} ยอด ${amount} บาท${billBookNo ? ` เล่ม ${billBookNo}/${billNo}` : ''} ในวันที่ ${dateStr} แล้ว`
                );
            }
        }

        // Auto-create truck for owner if license plate is new
        let truckId = null;
        const hasValidPlateForTruck = licensePlate && licensePlate.trim() !== '' && licensePlate !== '0';

        if (hasValidPlateForTruck && ownerId) {
            // Check if this plate already exists for this owner
            const existingTruck = await prisma.truck.findFirst({
                where: {
                    ownerId,
                    licensePlate: licensePlate.trim(),
                }
            });

            if (existingTruck) {
                truckId = existingTruck.id;
            } else {
                // Auto-create new truck for this owner
                const newTruck = await prisma.truck.create({
                    data: {
                        licensePlate: licensePlate.trim(),
                        ownerId,
                    }
                });
                truckId = newTruck.id;
                console.log(`[Auto-create truck] Created new truck ${licensePlate} for owner ${ownerId}`);
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
                truckId,
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

        // Deduct stock for products (if any)
        const products = body.products as Array<{ productId: string; qty: number }> | undefined;
        if (products && products.length > 0) {
            for (const item of products) {
                // Deduct from inventory
                await prisma.productInventory.updateMany({
                    where: {
                        productId: item.productId,
                        stationId,
                    },
                    data: {
                        quantity: {
                            decrement: item.qty
                        }
                    }
                });

                // Log the product sale (optional - for tracking)
                // Product sale recorded
            }
        }

        return NextResponse.json({ success: true, transaction });
    } catch (error) {
        console.error('[Station Transaction POST]:', error);
        return HttpErrors.internal(getErrorMessage(error));
    }
}
