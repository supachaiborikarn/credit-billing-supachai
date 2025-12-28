import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - Fetch products for this station
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const stationId = `station-${id}`;

        // Get products with inventory for this station
        const inventory = await prisma.productInventory.findMany({
            where: { stationId },
            include: {
                product: {
                    select: { id: true, name: true, unit: true, salePrice: true }
                }
            },
            orderBy: { product: { name: 'asc' } }
        });

        const products = inventory.map(inv => ({
            id: inv.product.id,
            name: inv.product.name,
            unit: inv.product.unit,
            salePrice: Number(inv.product.salePrice),
            quantity: inv.quantity
        }));

        return NextResponse.json({ products });
    } catch (error) {
        console.error('[Products GET]:', error);
        return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
    }
}

// POST - Add new product to station
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const stationId = `station-${id}`;
        const body = await request.json();

        const { name, unit, salePrice, quantity } = body;

        if (!name) {
            return NextResponse.json({ error: 'กรุณากรอกชื่อสินค้า' }, { status: 400 });
        }

        // Create product
        const productId = `product-${name.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}`;

        const product = await prisma.product.create({
            data: {
                id: productId,
                name,
                unit: unit || 'ชิ้น',
                salePrice: salePrice || 0
            }
        });

        // Create inventory for this station
        await prisma.productInventory.create({
            data: {
                productId: product.id,
                stationId,
                quantity: quantity || 0,
                alertLevel: 3
            }
        });

        return NextResponse.json({ success: true, product });
    } catch (error) {
        console.error('[Products POST]:', error);
        return NextResponse.json({ error: 'Failed to add product' }, { status: 500 });
    }
}

// PUT - Update product
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const stationId = `station-${id}`;
        const body = await request.json();

        const { id: productId, name, unit, salePrice, quantity } = body;

        if (!productId) {
            return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
        }

        // Update product
        await prisma.product.update({
            where: { id: productId },
            data: {
                name,
                unit: unit || 'ชิ้น',
                salePrice: salePrice || 0
            }
        });

        // Update inventory quantity
        await prisma.productInventory.updateMany({
            where: {
                productId,
                stationId
            },
            data: {
                quantity: quantity || 0
            }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[Products PUT]:', error);
        return NextResponse.json({ error: 'Failed to update product' }, { status: 500 });
    }
}

// DELETE - Remove product from station
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const stationId = `station-${id}`;
        const { searchParams } = new URL(request.url);
        const productId = searchParams.get('productId');

        if (!productId) {
            return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
        }

        // Remove inventory for this station only (don't delete product from other stations)
        await prisma.productInventory.deleteMany({
            where: {
                productId,
                stationId
            }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[Products DELETE]:', error);
        return NextResponse.json({ error: 'Failed to delete product' }, { status: 500 });
    }
}
