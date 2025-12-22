import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST - Add product to inventory (receive stock)
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const stationId = `station-${id}`;
        const body = await request.json();
        const { inventoryId, quantity, note, supplier, invoiceNo, costPrice } = body;

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

        // Transaction: increase inventory and create receipt record
        const [updatedInventory, receipt] = await prisma.$transaction([
            prisma.productInventory.update({
                where: { id: inventoryId },
                data: { quantity: { increment: quantity } }
            }),
            prisma.productReceipt.create({
                data: {
                    productId: inventory.productId,
                    stationId: stationId,
                    quantity,
                    costPrice: costPrice || inventory.product.costPrice,
                    supplier: supplier || null,
                    invoiceNo: invoiceNo || note || null,
                }
            })
        ]);

        return NextResponse.json({
            success: true,
            receipt,
            newQuantity: updatedInventory.quantity
        });
    } catch (error) {
        console.error('Product add error:', error);
        return NextResponse.json({ error: 'Failed to add product' }, { status: 500 });
    }
}
