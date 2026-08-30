import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminApi } from '@/lib/api-auth';

export async function POST(request: NextRequest) {
    try {
        const auth = await requireAdminApi();
        if (auth.response) return auth.response;

        const body = await request.json();
        const sourceOwnerId = typeof body?.sourceOwnerId === 'string' ? body.sourceOwnerId.trim() : '';
        const targetOwnerId = typeof body?.targetOwnerId === 'string' ? body.targetOwnerId.trim() : '';

        if (!sourceOwnerId || !targetOwnerId) {
            return NextResponse.json({ error: 'Source and target owner IDs required' }, { status: 400 });
        }
        if (sourceOwnerId === targetOwnerId) {
            return NextResponse.json({ error: 'Cannot merge owner with itself' }, { status: 400 });
        }

        const [sourceOwner, targetOwner] = await Promise.all([
            prisma.owner.findUnique({
                where: { id: sourceOwnerId },
                select: {
                    id: true,
                    name: true,
                    currentCredit: true,
                    lineUserId: true,
                    _count: { select: { trucks: true, transactions: true, invoices: true, billingCollections: true } },
                },
            }),
            prisma.owner.findUnique({
                where: { id: targetOwnerId },
                select: {
                    id: true,
                    name: true,
                    currentCredit: true,
                    lineUserId: true,
                    _count: { select: { trucks: true, transactions: true, invoices: true, billingCollections: true } },
                },
            }),
        ]);

        if (!sourceOwner) return NextResponse.json({ error: 'Source owner not found' }, { status: 404 });
        if (!targetOwner) return NextResponse.json({ error: 'Target owner not found' }, { status: 404 });

        if (sourceOwner.lineUserId && targetOwner.lineUserId) {
            return NextResponse.json({
                error: 'ลูกค้าทั้งสองรายผูก LINE อยู่แล้ว กรุณายกเลิก/รวม LINE mapping ก่อน merge เพื่อป้องกันการผูกผิดคน',
            }, { status: 409 });
        }

        const result = await prisma.$transaction(async (tx) => {
            let lineTransferred = false;
            if (sourceOwner.lineUserId && !targetOwner.lineUserId) {
                await tx.owner.update({ where: { id: sourceOwnerId }, data: { lineUserId: null } });
                await tx.owner.update({ where: { id: targetOwnerId }, data: { lineUserId: sourceOwner.lineUserId } });
                lineTransferred = true;
            }

            const [trucks, transactions, invoices, billingCollections] = await Promise.all([
                tx.truck.updateMany({ where: { ownerId: sourceOwnerId }, data: { ownerId: targetOwnerId } }),
                tx.transaction.updateMany({
                    where: { ownerId: sourceOwnerId },
                    data: { ownerId: targetOwnerId, ownerName: targetOwner.name },
                }),
                tx.invoice.updateMany({ where: { ownerId: sourceOwnerId }, data: { ownerId: targetOwnerId } }),
                // ownerName is a billing-document snapshot; preserve it while moving only the relation key.
                tx.billingCollection.updateMany({ where: { ownerId: sourceOwnerId }, data: { ownerId: targetOwnerId } }),
            ]);

            // currentCredit is legacy-only, but preserve the split indicator instead of silently dropping source value.
            await tx.owner.update({
                where: { id: targetOwnerId },
                data: { currentCredit: { increment: sourceOwner.currentCredit } },
            });

            await tx.auditLog.create({
                data: {
                    userId: auth.user.id,
                    action: 'MERGE',
                    model: 'Owner',
                    recordId: targetOwnerId,
                    oldData: {
                        sourceOwnerId,
                        sourceOwnerName: sourceOwner.name,
                        targetOwnerId,
                        targetOwnerName: targetOwner.name,
                        sourceCurrentCredit: Number(sourceOwner.currentCredit),
                        sourceCounts: sourceOwner._count,
                    },
                    newData: {
                        mergedIntoOwnerId: targetOwnerId,
                        trucksMoved: trucks.count,
                        transactionsMoved: transactions.count,
                        invoicesMoved: invoices.count,
                        billingCollectionsMoved: billingCollections.count,
                        lineTransferred,
                    },
                },
            });

            await tx.owner.delete({ where: { id: sourceOwnerId } });

            return {
                trucksMoved: trucks.count,
                transactionsMoved: transactions.count,
                invoicesMoved: invoices.count,
                billingCollectionsMoved: billingCollections.count,
                lineTransferred,
            };
        }, {
            // Neon/UAT can take >5s for this relation-complete merge; keep one atomic transaction with a bounded timeout.
            maxWait: 5_000,
            timeout: 20_000,
        });

        return NextResponse.json({
            success: true,
            message: `รวม “${sourceOwner.name}” เข้า “${targetOwner.name}” แล้ว`,
            deletedOwner: sourceOwner.name,
            targetOwner: targetOwner.name,
            ...result,
        });
    } catch (error) {
        console.error('Owner merge error:', error);
        return NextResponse.json({ error: 'Failed to merge owners' }, { status: 500 });
    }
}
