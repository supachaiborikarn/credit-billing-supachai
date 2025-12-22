import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { HttpErrors, getErrorMessage } from '@/lib/api-error';

interface ProductInput {
    name: string;
    unit: string;
    costPrice?: number | null;
    salePrice: number;
}

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
        console.error('[Products GET]:', error);
        return HttpErrors.internal(getErrorMessage(error));
    }
}

export async function POST(request: Request) {
    try {
        const body: ProductInput = await request.json();
        const { name, unit, costPrice, salePrice } = body;

        if (!name || !unit || !salePrice) {
            return HttpErrors.badRequest('กรุณากรอกชื่อ หน่วย และราคาขาย');
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
        console.error('[Product POST]:', error);
        return HttpErrors.internal(getErrorMessage(error));
    }
}
