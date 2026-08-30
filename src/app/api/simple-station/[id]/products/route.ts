import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStationAccessApi } from '@/lib/api-auth';

function normalizeLegacyStationId(id: string) {
    return id.startsWith('station-') ? id : `station-${id}`;
}

// GET - Fetch products for this station
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const stationId = normalizeLegacyStationId(id);
        const auth = await requireStationAccessApi(stationId);
        if (auth.response) return auth.response;

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
async function retiredSimpleProductWriteResponse(id: string) {
    const stationId = normalizeLegacyStationId(id);
    const auth = await requireStationAccessApi(stationId);
    if (auth.response) return auth.response;

    const replacement = stationId === 'station-1'
        ? '/stations/station-1'
        : `/stations/${stationId}/history`;

    return NextResponse.json({
        error: 'Legacy SIMPLE product write API retired',
        retired: true,
        replacement,
        message: stationId === 'station-1'
            ? 'station-1 ไม่มี product inventory ใน canonical capability; ใช้ Station Overview'
            : 'สถานี SIMPLE นี้ย้ายงานหน้าปั๊มและสต็อก operational ไป POS แล้ว',
    }, { status: 410 });
}

// Mutation methods are intentionally retired. GET above remains read compatibility.
export async function POST(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    return retiredSimpleProductWriteResponse(id);
}

export async function PUT(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    return retiredSimpleProductWriteResponse(id);
}

export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    return retiredSimpleProductWriteResponse(id);
}
