import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveGasStation, getNonGasStationError } from '@/lib/gas/station-resolver';
import { requireStationAccessApi } from '@/lib/api-auth';
import { shiftBelongsToStation, gasStationSupportsProducts } from '@/lib/gas/api-guards';
import { resolveDailyGasPrice } from '@/lib/gas/v2-workflow';
import { buildGasVarianceNote } from '@/lib/gas/admin-analytics';

function toNonNegativeAmount(value: unknown): number | null {
    if (value === null || value === undefined || value === '') {
        return 0;
    }

    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
        return null;
    }

    return Number(parsed.toFixed(2));
}

function toNonNegativeInt(value: unknown): number | null {
    if (value === null || value === undefined || value === '') {
        return 0;
    }

    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0 || !Number.isInteger(parsed)) {
        return null;
    }

    return parsed;
}

interface SubmittedProductCount {
    productId: string;
    received: number; // รับของเข้าระหว่างกะ
    closingQty: number; // นับคงเหลือตอนปิดกะ
}

/**
 * POST /api/v2/gas/[stationId]/shift/close
 * Close the current shift with reconciliation data (GAS stations only)
 *
 * ยอดแยกตามประเภท:
 * - แก๊ส: คำนวณจากมิเตอร์ (expectedFuelAmount)
 * - สินค้าอื่น (เครื่องดื่มฯ): คำนวณจากการนับสต็อก products[] (ยกมา + รับเข้า - คงเหลือ = ขายได้)
 * - รายรับอื่น: otherIncomeAmount (+ หมายเหตุ)
 * - ค่าใช้จ่ายจากเงินสด: otherExpensesAmount (+ หมายเหตุ)
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ stationId: string }> }
) {
    try {
        const { stationId } = await params;

        // Validate GAS station
        const station = await resolveGasStation(stationId);
        if (!station) {
            return NextResponse.json(getNonGasStationError(), { status: 403 });
        }
        const auth = await requireStationAccessApi(station.dbId);
        if (auth.response) return auth.response;

        const body = await request.json();
        const { shiftId, reconciliation } = body;
        const userId = auth.user.id;

        if (!shiftId) {
            return NextResponse.json({ error: 'shiftId is required' }, { status: 400 });
        }

        // Get shift
        const shift = await prisma.shift.findUnique({
            where: { id: shiftId },
            include: {
                meters: true,
                dailyRecord: true
            }
        });

        if (!shift) {
            return NextResponse.json({ error: 'Shift not found' }, { status: 404 });
        }
        if (!shiftBelongsToStation(shift, station)) {
            return NextResponse.json({ error: 'Shift does not belong to this station' }, { status: 403 });
        }

        if (shift.status !== 'OPEN') {
            return NextResponse.json({ error: 'Shift is not open' }, { status: 400 });
        }

        // Validate all meters have end readings
        const missingEndMeters = shift.meters.filter(m => m.endReading === null);
        if (missingEndMeters.length > 0) {
            return NextResponse.json({
                error: `Missing end readings for nozzles: ${missingEndMeters.map(m => m.nozzleNumber).join(', ')}`
            }, { status: 400 });
        }

        // Check gauge end readings exist
        const endGaugeCount = await prisma.gaugeReading.count({
            where: {
                stationId: station.dbId,
                dailyRecordId: shift.dailyRecordId,
                shiftNumber: shift.shiftNumber,
                notes: 'end'
            }
        });

        if (endGaugeCount < 3) {
            return NextResponse.json({ error: 'ต้องบันทึกเกจปิดกะให้ครบ 3 ถัง' }, { status: 400 });
        }

        // Calculate expected amount from meters
        const gasPrice = await resolveDailyGasPrice(prisma, station.dbId, shift.dailyRecord.gasPrice);
        const totalLiters = shift.meters.reduce((sum, m) => {
            if (m.soldQty !== null && m.soldQty !== undefined) return sum + Number(m.soldQty);
            if (m.startReading !== null && m.endReading !== null) {
                return sum + (Number(m.endReading) - Number(m.startReading));
            }
            return sum;
        }, 0);
        const expectedFuelAmount = totalLiters * gasPrice;

        // Create or update reconciliation
        const {
            cashReceived: rawCashReceived,
            creditReceived: rawCreditReceived,
            cardReceived: rawCardReceived,
            transferReceived: rawTransferReceived,
            expectedOtherAmount: rawExpectedOtherAmount = 0,
            nonGasSalesAmount: rawNonGasSalesAmount = rawExpectedOtherAmount,
            otherSalesAmount: rawOtherSalesAmount,
            otherIncomeAmount: rawOtherIncomeAmount,
            otherIncomeNote: rawOtherIncomeNote,
            otherExpensesAmount: rawOtherExpensesAmount = 0,
            otherExpenseNote: rawOtherExpenseNote,
            products: rawProducts,
            productTransferAmount: rawProductTransferAmount = 0,
            varianceNote,
        } = reconciliation || {};
        const cashReceived = toNonNegativeAmount(rawCashReceived);
        const creditReceived = toNonNegativeAmount(rawCreditReceived);
        const cardReceived = toNonNegativeAmount(rawCardReceived);
        const transferReceived = toNonNegativeAmount(rawTransferReceived);
        const otherExpensesAmount = toNonNegativeAmount(rawOtherExpensesAmount);
        const productTransferAmount = toNonNegativeAmount(rawProductTransferAmount);
        const otherIncomeNote = typeof rawOtherIncomeNote === 'string' ? rawOtherIncomeNote.trim() : '';
        const otherExpenseNote = typeof rawOtherExpenseNote === 'string' ? rawOtherExpenseNote.trim() : '';

        // --- นับสต็อกสินค้า (ถ้าสาขาเปิดใช้งานสินค้าเสริมและมีการส่ง products มา) ---
        const supportsProducts = gasStationSupportsProducts(station);
        const submittedProducts: SubmittedProductCount[] = supportsProducts && Array.isArray(rawProducts)
            ? rawProducts
            : [];

        type NormalizedProductCount = {
            productId: string;
            productName: string;
            openingQty: number;
            received: number;
            closingQty: number;
            soldQty: number;
            salePrice: number;
            amount: number;
        };
        const normalizedProducts: NormalizedProductCount[] = [];

        if (submittedProducts.length > 0) {
            const inventories = await prisma.productInventory.findMany({
                where: { stationId: station.dbId },
                include: { product: true },
            });
            const inventoryByProductId = new Map(inventories.map(inv => [inv.productId, inv]));

            for (const item of submittedProducts) {
                if (!item || typeof item.productId !== 'string') {
                    return NextResponse.json({ error: 'ข้อมูลสินค้าไม่ถูกต้อง' }, { status: 400 });
                }

                const inventory = inventoryByProductId.get(item.productId);
                if (!inventory) {
                    return NextResponse.json({ error: 'ไม่พบสินค้าในสาขานี้' }, { status: 400 });
                }

                const received = toNonNegativeInt(item.received);
                const closingQty = toNonNegativeInt(item.closingQty);
                if (received === null || closingQty === null) {
                    return NextResponse.json({
                        error: `จำนวนรับเข้า/คงเหลือของ "${inventory.product.name}" ต้องเป็นจำนวนเต็มไม่ติดลบ`,
                    }, { status: 400 });
                }

                const openingQty = inventory.quantity;
                const soldQty = openingQty + received - closingQty;
                if (soldQty < 0) {
                    return NextResponse.json({
                        error: `"${inventory.product.name}" นับคงเหลือ (${closingQty}) มากกว่า ยกมา (${openingQty}) + รับเข้า (${received}) กรุณาตรวจสอบ`,
                    }, { status: 400 });
                }

                const salePrice = Number(inventory.product.salePrice);
                normalizedProducts.push({
                    productId: item.productId,
                    productName: inventory.product.name,
                    openingQty,
                    received,
                    closingQty,
                    soldQty,
                    salePrice,
                    amount: Number((soldQty * salePrice).toFixed(2)),
                });
            }
        }

        const productSalesAmount = Number(
            normalizedProducts.reduce((sum, p) => sum + p.amount, 0).toFixed(2)
        );

        // รายรับอื่น: ถ้าส่งแบบใหม่ (otherIncomeAmount) ใช้ค่านั้น
        // ถ้าเป็น client แบบเก่า (ส่ง nonGasSalesAmount ก้อนเดียว ไม่มี products) map เป็นรายรับอื่นเพื่อให้ยอดรวมเท่าเดิม
        const legacyNonGasSalesAmount = toNonNegativeAmount(rawOtherSalesAmount ?? rawNonGasSalesAmount);
        const otherIncomeAmount = rawOtherIncomeAmount !== undefined
            ? toNonNegativeAmount(rawOtherIncomeAmount)
            : (submittedProducts.length > 0 ? 0 : legacyNonGasSalesAmount);

        if (
            cashReceived === null
            || creditReceived === null
            || cardReceived === null
            || transferReceived === null
            || otherIncomeAmount === null
            || otherExpensesAmount === null
            || productTransferAmount === null
        ) {
            return NextResponse.json({
                error: 'ยอดรับจริง ยอดขายอื่น และค่าใช้จ่ายต้องเป็นจำนวนไม่ติดลบ',
            }, { status: 400 });
        }

        if (productTransferAmount > productSalesAmount) {
            return NextResponse.json({
                error: 'ยอดสินค้าที่รับโอน/สแกนต้องไม่เกินยอดขายสินค้ารวม',
            }, { status: 400 });
        }

        const nonGasSalesAmount = Number((productSalesAmount + otherIncomeAmount).toFixed(2));
        const expectedOtherAmount = Number((nonGasSalesAmount - otherExpensesAmount).toFixed(2));
        const combinedTransferReceived = Number((transferReceived + cardReceived).toFixed(2));
        const normalizedVarianceNote = buildGasVarianceNote(
            varianceNote,
            cardReceived,
            {
                nonGasSalesAmount,
                otherExpensesAmount,
            }
        );

        const totalExpected = Number((expectedFuelAmount + expectedOtherAmount).toFixed(2));
        const totalReceived = Number((cashReceived + creditReceived + combinedTransferReceived).toFixed(2));
        const variance = Number((totalReceived - totalExpected).toFixed(2));

        // Determine variance status
        let varianceStatus: 'GREEN' | 'YELLOW' | 'RED' = 'GREEN';
        if (Math.abs(variance) > 500) {
            varianceStatus = 'RED';
        } else if (Math.abs(variance) > 100) {
            varianceStatus = 'YELLOW';
        }

        const reconciliationData = {
            expectedFuelAmount,
            expectedOtherAmount,
            totalExpected,
            cashReceived,
            creditReceived,
            transferReceived: combinedTransferReceived,
            totalReceived,
            variance,
            varianceStatus,
            productSalesAmount,
            productTransferAmount,
            otherIncomeAmount,
            otherIncomeNote: otherIncomeNote || null,
            otherExpensesAmount,
            otherExpenseNote: otherExpenseNote || null,
        };

        const now = new Date();

        await prisma.$transaction(async (tx) => {
            // บันทึกผลนับสต็อก: สร้างรายการขาย/รับเข้า และอัปเดตคงเหลือ
            for (const product of normalizedProducts) {
                if (product.soldQty > 0) {
                    await tx.productSale.create({
                        data: {
                            productId: product.productId,
                            stationId: station.dbId,
                            shiftId,
                            quantity: product.soldQty,
                            salePrice: product.salePrice,
                            // มาจากการนับสต็อกจึงไม่รู้วิธีชำระรายชิ้น
                            // ยอดแยกเงินสด/โอนดูจาก reconciliation (productTransferAmount)
                            paymentType: 'CASH',
                            date: now,
                        },
                    });
                }

                if (product.received > 0) {
                    await tx.productReceipt.create({
                        data: {
                            productId: product.productId,
                            stationId: station.dbId,
                            quantity: product.received,
                            date: now,
                        },
                    });
                }

                await tx.productInventory.update({
                    where: {
                        productId_stationId: {
                            productId: product.productId,
                            stationId: station.dbId,
                        },
                    },
                    data: { quantity: product.closingQty },
                });
            }

            await tx.shiftReconciliation.upsert({
                where: { shiftId },
                update: reconciliationData,
                create: {
                    shiftId,
                    ...reconciliationData,
                },
            });

            // Close shift
            await tx.shift.update({
                where: { id: shiftId },
                data: {
                    status: 'CLOSED',
                    closedAt: now,
                    closedById: userId,
                    varianceNote: normalizedVarianceNote || null
                }
            });
        }, { timeout: 30_000 });

        return NextResponse.json({
            success: true,
            message: 'ปิดกะสำเร็จ',
            summary: {
                liters: totalLiters,
                expectedFuel: Number(expectedFuelAmount.toFixed(2)),
                expectedOther: expectedOtherAmount,
                productSalesAmount,
                productTransferAmount,
                otherIncomeAmount,
                otherExpensesAmount,
                nonGasSalesAmount,
                products: normalizedProducts.map(p => ({
                    productId: p.productId,
                    name: p.productName,
                    openingQty: p.openingQty,
                    received: p.received,
                    closingQty: p.closingQty,
                    soldQty: p.soldQty,
                    amount: p.amount,
                })),
                expected: totalExpected,
                received: totalReceived,
                variance
            }
        });
    } catch (error) {
        console.error('[Shift Close]:', error);
        return NextResponse.json({ error: 'Failed to close shift' }, { status: 500 });
    }
}
