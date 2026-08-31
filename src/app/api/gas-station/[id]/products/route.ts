import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireGasProductsEnabled, requireGasStationAccess } from '@/lib/gas/api-guards';
import {
    createStationProduct,
    parseNonNegativeInventoryInteger,
    parseOptionalNonNegativePrice,
    parsePositiveInventoryInteger,
    parsePositivePrice,
    receiveStationProduct,
    updateStationProduct,
} from '@/services/product-inventory-write-service';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    void request;
    try {
        const { id } = await params;
        const auth = await requireGasStationAccess(id);
        if (auth.response) return auth.response;
        const productsDisabled = requireGasProductsEnabled(auth.station);
        if (productsDisabled) return productsDisabled;
        const stationId = auth.station.dbId;

        const inventory = await prisma.productInventory.findMany({
            where: { stationId },
            include: { product: true },
        });

        return NextResponse.json(inventory.map((item) => ({
            id: item.id,
            productId: item.productId,
            product: {
                ...item.product,
                salePrice: Number(item.product.salePrice),
                costPrice: item.product.costPrice ? Number(item.product.costPrice) : null,
            },
            quantity: item.quantity,
            alertLevel: item.alertLevel,
        })));
    } catch (error) {
        console.error('Product inventory GET error:', error);
        return NextResponse.json({ error: 'Failed to fetch inventory' }, { status: 500 });
    }
}

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

        const body = await request.json().catch(() => null) as Record<string, unknown> | null;
        if (!body || typeof body.action !== 'string') {
            return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }

        if (body.action === 'create') {
            const name = typeof body.name === 'string' ? body.name.trim() : '';
            const unit = typeof body.unit === 'string' ? body.unit.trim() : '';
            if (!name || name.length > 120 || !unit || unit.length > 40) {
                return NextResponse.json({ error: 'กรุณากรอกชื่อสินค้าและหน่วยให้ถูกต้อง' }, { status: 400 });
            }

            const salePrice = parsePositivePrice(body.salePrice);
            if ('error' in salePrice) return NextResponse.json({ error: salePrice.error }, { status: 400 });
            const costPrice = parseOptionalNonNegativePrice(body.costPrice);
            if ('error' in costPrice) return NextResponse.json({ error: costPrice.error }, { status: 400 });
            const quantity = parseNonNegativeInventoryInteger(body.quantity ?? 0, 'จำนวนเริ่มต้น');
            if ('error' in quantity) return NextResponse.json({ error: quantity.error }, { status: 400 });

            let alertLevel: number | null = null;
            if (body.alertLevel !== undefined && body.alertLevel !== null && body.alertLevel !== '') {
                const parsedAlert = parseNonNegativeInventoryInteger(body.alertLevel, 'จุดแจ้งเตือน');
                if ('error' in parsedAlert) return NextResponse.json({ error: parsedAlert.error }, { status: 400 });
                alertLevel = parsedAlert.value;
            }

            const result = await createStationProduct({
                stationId,
                userId: auth.user.id,
                name,
                unit,
                salePrice: salePrice.value,
                costPrice: costPrice.value,
                quantity: quantity.value,
                alertLevel,
            });
            if (!result.success) return NextResponse.json({ error: result.error }, { status: result.status });

            const inventory = result.value as {
                id: string;
                productId: string;
                quantity: number;
                alertLevel: number | null;
                product: { salePrice: unknown; costPrice: unknown } & Record<string, unknown>;
            };
            return NextResponse.json({
                ...inventory,
                product: {
                    ...inventory.product,
                    salePrice: Number(inventory.product.salePrice),
                    costPrice: inventory.product.costPrice ? Number(inventory.product.costPrice) : null,
                },
            });
        }

        if (body.action === 'sell' || body.action === 'add_to_inventory') {
            return NextResponse.json({
                error: 'action นี้ถูกยกเลิกแล้ว',
                canonicalInventory: '/stations/station-5/inventory',
                closeShiftApi: '/api/v2/gas/[stationId]/shift/close',
            }, { status: 410 });
        }

        const productId = typeof body.productId === 'string' ? body.productId.trim() : '';
        if (!productId) return NextResponse.json({ error: 'กรุณาระบุสินค้า' }, { status: 400 });

        if (body.action === 'update') {
            const salePrice = parsePositivePrice(body.salePrice);
            if ('error' in salePrice) return NextResponse.json({ error: salePrice.error }, { status: 400 });

            let alertLevel: number | null = null;
            if (body.alertLevel !== undefined && body.alertLevel !== null && body.alertLevel !== '') {
                const parsedAlert = parseNonNegativeInventoryInteger(body.alertLevel, 'จุดแจ้งเตือน');
                if ('error' in parsedAlert) return NextResponse.json({ error: parsedAlert.error }, { status: 400 });
                alertLevel = parsedAlert.value;
            }

            const result = await updateStationProduct({
                stationId,
                userId: auth.user.id,
                productId,
                salePrice: salePrice.value,
                alertLevel,
            });
            if (!result.success) return NextResponse.json({ error: result.error }, { status: result.status });
            return NextResponse.json(result.value);
        }

        if (body.action === 'receive') {
            const quantity = parsePositiveInventoryInteger(body.quantity, 'จำนวนรับเข้า');
            if ('error' in quantity) return NextResponse.json({ error: quantity.error }, { status: 400 });
            const result = await receiveStationProduct({
                stationId,
                userId: auth.user.id,
                productId,
                quantity: quantity.value,
            });
            if (!result.success) return NextResponse.json({ error: result.error }, { status: result.status });
            return NextResponse.json({ success: true, newQuantity: result.value.newQuantity });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error) {
        console.error('Product inventory POST error:', error);
        return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
    }
}
