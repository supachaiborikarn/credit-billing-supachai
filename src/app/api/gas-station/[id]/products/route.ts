import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { STATIONS } from '@/constants';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const stationIndex = parseInt(id) - 1;
        const stationConfig = STATIONS[stationIndex];

        if (!stationConfig || stationConfig.type !== 'GAS') {
            return NextResponse.json({ error: 'Gas station not found' }, { status: 404 });
        }

        // Get or create station with consistent ID
        const stationId = `station-${id}`;
        const station = await prisma.station.upsert({
            where: { id: stationId },
            update: {},
            create: {
                id: stationId,
                name: stationConfig.name,
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
        const stationIndex = parseInt(id) - 1;
        const stationConfig = STATIONS[stationIndex];

        if (!stationConfig || stationConfig.type !== 'GAS') {
            return NextResponse.json({ error: 'Gas station not found' }, { status: 404 });
        }

        const body = await request.json();
        const { action, productId, quantity, alertLevel, paymentType } = body;

        // Get or create station with consistent ID
        const stationId = `station-${id}`;
        const station = await prisma.station.upsert({
            where: { id: stationId },
            update: {},
            create: {
                id: stationId,
                name: stationConfig.name,
                type: 'GAS',
                hasProducts: true,
                gasPrice: 15.50,
                gasStockAlert: 1000,
            }
        });

        if (action === 'add_to_inventory') {
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
                    paymentType: paymentType || 'CASH',
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
