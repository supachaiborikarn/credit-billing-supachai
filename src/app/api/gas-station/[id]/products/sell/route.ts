import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireGasProductsEnabled, requireGasStationAccess } from '@/lib/gas/api-guards';
import { normalizeGasPaymentType } from '@/lib/gas/payment-utils';

// POST - Sell product (decrease inventory)
export async function POST(
    request: NextRequest,
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
        const { inventoryId, quantity, paymentType = 'CASH' } = body;
        const normalizedPaymentType = normalizeGasPaymentType(paymentType);
        if (!normalizedPaymentType) {
            return NextResponse.json({ error: 'Invalid payment type' }, { status: 400 });
        }

        if (!inventoryId || !quantity || quantity <= 0) {
            return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });
        }

        // Get inventory item
        const inventory = await prisma.productInventory.findUnique({
            where: { id: inventoryId },
            include: { product: true }
        });

        if (!inventory) {
            return NextResponse.json({ error: 'ไม่พบสินค้า' }, { status: 404 });
        }

        if (inventory.stationId !== stationId) {
            return NextResponse.json({ error: 'ไม่พบสินค้าในสถานีนี้' }, { status: 404 });
        }

        if (inventory.quantity < quantity) {
            return NextResponse.json({ error: 'สินค้าไม่เพียงพอ' }, { status: 400 });
        }

        // Transaction: decrease inventory and create sale record
        const [updatedInventory, sale] = await prisma.$transaction([
            prisma.productInventory.update({
                where: { id: inventoryId },
                data: { quantity: { decrement: quantity } }
            }),
            prisma.productSale.create({
                data: {
                    productId: inventory.productId,
                    stationId: stationId,
                    quantity,
                    salePrice: inventory.product.salePrice,
                    paymentType: normalizedPaymentType,
                }
            })
        ]);

        return NextResponse.json({
            success: true,
            sale,
            newQuantity: updatedInventory.quantity
        });
    } catch (error) {
        console.error('Product sell error:', error);
        return NextResponse.json({ error: 'Failed to sell product' }, { status: 500 });
    }
}
