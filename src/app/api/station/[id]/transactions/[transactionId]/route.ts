import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET single transaction
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; transactionId: string }> }
) {
    try {
        const { transactionId } = await params;

        const transaction = await prisma.transaction.findUnique({
            where: { id: transactionId },
            include: {
                owner: { select: { name: true, code: true } },
            }
        });

        if (!transaction) {
            return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
        }

        return NextResponse.json(transaction);
    } catch (error) {
        console.error('Transaction GET error:', error);
        return NextResponse.json({ error: 'Failed to fetch transaction' }, { status: 500 });
    }
}

// UPDATE transaction
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; transactionId: string }> }
) {
    try {
        const { transactionId } = await params;
        const body = await request.json();
        const {
            licensePlate,
            ownerName,
            paymentType,
            nozzleNumber,
            liters,
            pricePerLiter,
            amount,
            billBookNo,
            billNo,
            transferProofUrl,
        } = body;

        const transaction = await prisma.transaction.update({
            where: { id: transactionId },
            data: {
                licensePlate,
                ownerName,
                paymentType,
                nozzleNumber,
                liters,
                pricePerLiter,
                amount,
                billBookNo,
                billNo,
                transferProofUrl,
            }
        });

        return NextResponse.json({ success: true, transaction });
    } catch (error) {
        console.error('Transaction PUT error:', error);
        return NextResponse.json({ error: 'Failed to update transaction' }, { status: 500 });
    }
}

// DELETE transaction
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; transactionId: string }> }
) {
    try {
        const { transactionId } = await params;

        await prisma.transaction.delete({
            where: { id: transactionId }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Transaction DELETE error:', error);
        return NextResponse.json({ error: 'Failed to delete transaction' }, { status: 500 });
    }
}
