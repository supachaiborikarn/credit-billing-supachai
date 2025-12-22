import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - Get product transaction history (sales + receipts)
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const stationId = `station-${id}`;

        // Get sales
        const sales = await prisma.productSale.findMany({
            where: { stationId },
            include: { product: { select: { name: true } } },
            orderBy: { createdAt: 'desc' },
            take: 50
        });

        // Get receipts
        const receipts = await prisma.productReceipt.findMany({
            where: { stationId },
            orderBy: { createdAt: 'desc' },
            take: 50
        });

        // Get product names for receipts
        const productIds = [...new Set(receipts.map(r => r.productId))];
        const products = await prisma.product.findMany({
            where: { id: { in: productIds } },
            select: { id: true, name: true }
        });
        const productMap = Object.fromEntries(products.map(p => [p.id, p.name]));

        // Combine and sort by date
        const history = [
            ...sales.map(s => ({
                id: s.id,
                type: 'OUT' as const,
                productId: s.productId,
                product: { name: s.product.name },
                quantity: s.quantity,
                amount: Number(s.salePrice) * s.quantity,
                createdAt: s.createdAt.toISOString(),
                note: s.paymentType,
            })),
            ...receipts.map(r => ({
                id: r.id,
                type: 'IN' as const,
                productId: r.productId,
                product: { name: productMap[r.productId] || 'Unknown' },
                quantity: r.quantity,
                amount: r.costPrice ? Number(r.costPrice) * r.quantity : 0,
                createdAt: r.createdAt.toISOString(),
                note: r.invoiceNo || r.supplier || null,
            })),
        ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        return NextResponse.json(history.slice(0, 50));
    } catch (error) {
        console.error('Product history error:', error);
        return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
    }
}
