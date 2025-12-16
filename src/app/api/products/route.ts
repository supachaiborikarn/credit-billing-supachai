import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
    try {
        const products = await prisma.product.findMany({
            orderBy: { name: 'asc' },
        });

        return NextResponse.json(products.map(p => ({
            ...p,
            costPrice: p.costPrice ? Number(p.costPrice) : null,
            salePrice: Number(p.salePrice),
        })));
    } catch (error) {
        console.error('Products GET error:', error);
        return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { name, unit, costPrice, salePrice } = body;

        if (!name || !unit || !salePrice) {
            return NextResponse.json({ error: 'กรุณากรอกชื่อ หน่วย และราคาขาย' }, { status: 400 });
        }

        const product = await prisma.product.create({
            data: {
                name,
                unit,
                costPrice: costPrice || null,
                salePrice,
            }
        });

        return NextResponse.json({
            ...product,
            costPrice: product.costPrice ? Number(product.costPrice) : null,
            salePrice: Number(product.salePrice),
        });
    } catch (error) {
        console.error('Product POST error:', error);
        return NextResponse.json({ error: 'Failed to create product' }, { status: 500 });
    }
}
