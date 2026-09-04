import { prisma } from '@/lib/prisma';
import { PaymentType } from '@prisma/client';

type AmountLike = number | string | { toString(): string } | null | undefined;

export interface ShiftPaymentBreakdown {
    cash: number;
    credit: number;
    transfer: number;
    card: number;
    boxTruck: number;
    oilTruckSupachai: number;
    total: number;
}

interface TransactionLike {
    amount: AmountLike;
    paymentType: PaymentType | string;
}

interface ShiftWindowInput {
    shiftId: string;
    stationId: string;
    openedAt: Date;
    closedAt: Date | null;
    fallbackClosedAt?: Date;
}

function toNumber(value: AmountLike): number {
    if (value == null) return 0;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

export function summarizeShiftPayments(transactions: TransactionLike[]): ShiftPaymentBreakdown {
    const summary: ShiftPaymentBreakdown = {
        cash: 0,
        credit: 0,
        transfer: 0,
        card: 0,
        boxTruck: 0,
        oilTruckSupachai: 0,
        total: 0,
    };

    for (const transaction of transactions) {
        const amount = toNumber(transaction.amount);

        switch (transaction.paymentType) {
            case 'CASH':
                summary.cash += amount;
                break;
            case 'CREDIT':
                summary.credit += amount;
                break;
            case 'BOX_TRUCK':
                summary.credit += amount;
                summary.boxTruck += amount;
                break;
            case 'OIL_TRUCK_SUPACHAI':
                summary.credit += amount;
                summary.oilTruckSupachai += amount;
                break;
            case 'TRANSFER':
                summary.transfer += amount;
                break;
            case 'CREDIT_CARD':
                summary.card += amount;
                break;
            default:
                break;
        }
    }

    summary.total =
        summary.cash +
        summary.credit +
        summary.transfer +
        summary.card;

    return summary;
}

export async function listTransactionsForShiftWindow({
    shiftId,
    stationId,
    openedAt,
    closedAt,
    fallbackClosedAt,
}: ShiftWindowInput) {
    const effectiveClosedAt = closedAt ?? fallbackClosedAt ?? new Date();

    return prisma.transaction.findMany({
        where: {
            stationId,
            deletedAt: null,
            isVoided: false,
            OR: [
                { shiftId },
                {
                    shiftId: null,
                    date: {
                        gte: openedAt,
                        lte: effectiveClosedAt,
                    },
                },
            ],
        },
        orderBy: { date: 'asc' },
    });
}

export async function listTransactionsForShift(shiftId: string) {
    const shift = await prisma.shift.findUnique({
        where: { id: shiftId },
        include: {
            dailyRecord: {
                select: { stationId: true },
            },
        },
    });

    if (!shift?.dailyRecord) {
        throw new Error('ไม่พบกะนี้');
    }

    return listTransactionsForShiftWindow({
        shiftId,
        stationId: shift.dailyRecord.stationId,
        openedAt: shift.createdAt,
        closedAt: shift.closedAt,
    });
}
