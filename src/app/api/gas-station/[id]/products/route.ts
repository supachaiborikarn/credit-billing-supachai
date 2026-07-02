import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireGasProductsEnabled, requireGasStationAccess } from '@/lib/gas/api-guards';
import { normalizeGasPaymentType } from '@/lib/gas/payment-utils';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const auth = await requireGasStationAccess(id);
        if (auth.response) return auth.response;
        const productsDisabled = requireGasProductsEnabled(auth.station);
        if (productsDisabled) return productsDisabled;
        const stationId = auth.station.dbId;

        const station = await prisma.station.upsert({
            where: { id: stationId },
            update: { hasProducts: true },
            create: {
                id: stationId,
                name: auth.station.name,
                type: 'GAS',
                hasProducts: true,
                gasPrice: 15.50,
                gasStockAlert: 1000,
            }
        });

        // Get product inventory for this station
        const inventory = await prisma.productInventory.findMany({
            where: { stationId: station.id },
            include: {
                product: true
            }
        });

        return NextResponse.json(inventory.map(i => ({
            id: i.id,
            productId: i.productId,
            product: {
                ...i.product,
                salePrice: Number(i.product.salePrice),
                costPrice: i.product.costPrice ? Number(i.product.costPrice) : null,
            },
            quantity: i.quantity,
            alertLevel: i.alertLevel,
        })));
    } catch (error) {
        console.error('Product inventory GET error:', error);
        return NextResponse.json({ error: 'Failed to fetch inventory' }, { status: 500 });
    }
}

// Add product to station inventory
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const auth = await requireGasStationAccess(id);
        if (auth.response) return auth.response;
        const productsDisabled = requireGasProductsEnabled(auth.station);
        if (productsDisabled) return productsDisabled;
        const stationId = auth.station.dbId;

        const body = await request.json();
        const { action, productId, quantity, alertLevel, paymentType, name, unit, salePrice, costPrice } = body;
        const normalizedPaymentType = normalizeGasPaymentType(paymentType || 'CASH');
        if (!normalizedPaymentType) {
            return NextResponse.json({ error: 'Invalid payment type' }, { status: 400 });
        }

        // Get or create station with consistent ID
        const station = await prisma.station.upsert({
            where: { id: stationId },
            update: { hasProducts: true },
            create: {
                id: stationId,
                name: auth.station.name,
                type: 'GAS',
                hasProducts: true,
                gasPrice: 15.50,
                gasStockAlert: 1000,
            }
        });

        if (action === 'create') {
            // สร้างสินค้าใหม่พร้อมเพิ่มเข้าสต็อกสาขาในขั้นตอนเดียว
            const trimmedName = typeof name === 'string' ? name.trim() : '';
            const trimmedUnit = typeof unit === 'string' ? unit.trim() : '';
            const parsedSalePrice = Number(salePrice);
            const parsedCostPrice = costPrice !== undefined && costPrice !== null && costPrice !== ''
                ? Number(costPrice)
                : null;
            const initialQty = Number(quantity) || 0;
            const parsedAlertLevel = alertLevel !== undefined && alertLevel !== null && alertLevel !== ''
                ? Number(alertLevel)
                : null;

            if (!trimmedName || !trimmedUnit) {
                return NextResponse.json({ error: 'กรุณากรอกชื่อสินค้าและหน่วย' }, { status: 400 });
            }
            if (!Number.isFinite(parsedSalePrice) || parsedSalePrice <= 0) {
                return NextResponse.json({ error: 'ราคาขายต้องมากกว่า 0' }, { status: 400 });
            }
            if (!Number.isInteger(initialQty) || initialQty < 0) {
                return NextResponse.json({ error: 'จำนวนเริ่มต้นต้องเป็นจำนวนเต็มไม่ติดลบ' }, { status: 400 });
            }

            const inventory = await prisma.$transaction(async (tx) => {
                const product = await tx.product.create({
                    data: {
                        name: trimmedName,
                        unit: trimmedUnit,
                        salePrice: parsedSalePrice,
                        costPrice: Number.isFinite(parsedCostPrice ?? NaN) ? parsedCostPrice : null,
                    }
                });

                const created = await tx.productInventory.create({
                    data: {
                        stationId: station.id,
                        productId: product.id,
                        quantity: initialQty,
                        alertLevel: Number.isFinite(parsedAlertLevel ?? NaN) ? parsedAlertLevel : null,
                    },
                    include: { product: true }
                });

                if (initialQty > 0) {
                    await tx.productReceipt.create({
                        data: {
                            productId: product.id,
                            stationId: station.id,
                            quantity: initialQty,
                        }
                    });
                }

                return created;
            });

            return NextResponse.json({
                ...inventory,
                product: {
                    ...inventory.product,
                    salePrice: Number(inventory.product.salePrice),
                    costPrice: inventory.product.costPrice ? Number(inventory.product.costPrice) : null,
                }
            });

        } else if (action === 'update') {
            // แก้ไขราคาขาย/จุดแจ้งเตือนของสินค้า
            const inventory = await prisma.productInventory.findFirst({
                where: {
                    stationId: station.id,
                    productId,
                }
            });

            if (!inventory) {
                return NextResponse.json({ error: 'ไม่พบสินค้าในสต็อก' }, { status: 404 });
            }

            if (salePrice !== undefined) {
                const parsedSalePrice = Number(salePrice);
                if (!Number.isFinite(parsedSalePrice) || parsedSalePrice <= 0) {
                    return NextResponse.json({ error: 'ราคาขายต้องมากกว่า 0' }, { status: 400 });
                }
                await prisma.product.update({
                    where: { id: productId },
                    data: { salePrice: parsedSalePrice }
                });
            }

            if (alertLevel !== undefined) {
                const parsedAlertLevel = alertLevel === null || alertLevel === ''
                    ? null
                    : Number(alertLevel);
                if (parsedAlertLevel !== null && (!Number.isInteger(parsedAlertLevel) || parsedAlertLevel < 0)) {
                    return NextResponse.json({ error: 'จุดแจ้งเตือนต้องเป็นจำนวนเต็มไม่ติดลบ' }, { status: 400 });
                }
                await prisma.productInventory.update({
                    where: { id: inventory.id },
                    data: { alertLevel: parsedAlertLevel }
                });
            }

            return NextResponse.json({ success: true });

        } else if (action === 'add_to_inventory') {
            // Add product to station inventory
            const existing = await prisma.productInventory.findFirst({
                where: {
                    stationId: station.id,
                    productId,
                }
            });

            if (existing) {
                return NextResponse.json({ error: 'สินค้านี้มีในสต็อกแล้ว' }, { status: 400 });
            }

            const inventory = await prisma.productInventory.create({
                data: {
                    stationId: station.id,
                    productId,
                    quantity: quantity || 0,
                    alertLevel: alertLevel || null,
                },
                include: { product: true }
            });

            return NextResponse.json({
                ...inventory,
                product: {
                    ...inventory.product,
                    salePrice: Number(inventory.product.salePrice),
                }
            });

        } else if (action === 'receive') {
            // Receive stock (add quantity)
            const inventory = await prisma.productInventory.findFirst({
                where: {
                    stationId: station.id,
                    productId,
                }
            });

            if (!inventory) {
                return NextResponse.json({ error: 'ไม่พบสินค้าในสต็อก' }, { status: 404 });
            }

            // Update quantity
            const updated = await prisma.productInventory.update({
                where: { id: inventory.id },
                data: { quantity: inventory.quantity + quantity }
            });

            // Record receipt
            await prisma.productReceipt.create({
                data: {
                    productId,
                    stationId: station.id,
                    quantity,
                }
            });

            return NextResponse.json({ success: true, newQuantity: updated.quantity });

        } else if (action === 'sell') {
            // Sell product (reduce quantity)
            const inventory = await prisma.productInventory.findFirst({
                where: {
                    stationId: station.id,
                    productId,
                },
                include: { product: true }
            });

            if (!inventory) {
                return NextResponse.json({ error: 'ไม่พบสินค้าในสต็อก' }, { status: 404 });
            }

            if (inventory.quantity < quantity) {
                return NextResponse.json({ error: 'สินค้าในสต็อกไม่พอ' }, { status: 400 });
            }

            // Update quantity
            const updated = await prisma.productInventory.update({
                where: { id: inventory.id },
                data: { quantity: inventory.quantity - quantity }
            });

            // Record sale
            await prisma.productSale.create({
                data: {
                    productId,
                    stationId: station.id,
                    quantity,
                    salePrice: inventory.product.salePrice,
                    paymentType: normalizedPaymentType,
                }
            });

            return NextResponse.json({
                success: true,
                newQuantity: updated.quantity,
                saleAmount: Number(inventory.product.salePrice) * quantity
            });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error) {
        console.error('Product inventory POST error:', error);
        return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
    }
}
