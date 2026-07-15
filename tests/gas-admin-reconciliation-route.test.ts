import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = {
    $transaction: vi.fn(),
    shift: {
        findUnique: vi.fn(),
        update: vi.fn(),
    },
    transaction: {
        findMany: vi.fn(),
    },
    shiftReconciliation: {
        upsert: vi.fn(),
    },
    auditLog: {
        create: vi.fn(),
    },
};

const requireAdminApiMock = vi.fn();

vi.mock('@/lib/prisma', () => ({
    prisma: prismaMock,
}));

vi.mock('@/lib/api-auth', () => ({
    requireAdminApi: requireAdminApiMock,
}));

function resetMockTree(tree: Record<string, unknown>) {
    for (const value of Object.values(tree)) {
        if (typeof value === 'function' && 'mockReset' in value) {
            (value as ReturnType<typeof vi.fn>).mockReset();
            continue;
        }

        if (value && typeof value === 'object') {
            resetMockTree(value as Record<string, unknown>);
        }
    }
}

beforeEach(() => {
    resetMockTree(prismaMock);
    requireAdminApiMock.mockReset();

    prismaMock.$transaction.mockImplementation(async (operations: Promise<unknown>[]) => Promise.all(operations));
    prismaMock.shiftReconciliation.upsert.mockResolvedValue({});
    prismaMock.shift.update.mockResolvedValue({});
    prismaMock.auditLog.create.mockResolvedValue({});
    requireAdminApiMock.mockResolvedValue({
        user: { id: 'admin-1', role: 'ADMIN' },
    });
});

describe('gas admin reconciliation update route', () => {
    it('stores card received in varianceNote while keeping transfer totals consistent', async () => {
        prismaMock.shift.findUnique.mockResolvedValue({
            id: 'shift-1',
            shiftNumber: 1,
            status: 'CLOSED',
            createdAt: new Date('2026-04-23T01:00:00.000Z'),
            closedAt: new Date('2026-04-23T08:00:00.000Z'),
            varianceNote: 'นับเงินใหม่',
            staff: { name: 'กุ้ง' },
            dailyRecord: {
                id: 'daily-1',
                stationId: 'station-5',
                date: new Date('2026-04-22T17:00:00.000Z'),
                gasPrice: 17,
                station: { name: 'ปั๊มแก๊สพงษ์อนันต์' },
            },
            meters: [
                { nozzleNumber: 1, startReading: 100, endReading: 140, soldQty: 40 },
                { nozzleNumber: 2, startReading: 200, endReading: 230, soldQty: 30 },
            ],
            reconciliation: {
                expectedFuelAmount: 1190,
                expectedOtherAmount: 0,
                totalExpected: 1190,
                totalReceived: 1190,
                cashReceived: 1000,
                creditReceived: 100,
                transferReceived: 90,
                variance: 0,
                varianceStatus: 'GREEN',
            },
        });

        prismaMock.transaction.findMany.mockResolvedValue([
            {
                id: 'tx-1',
                stationId: 'station-5',
                dailyRecordId: 'daily-1',
                shiftId: 'shift-1',
                date: new Date('2026-04-23T03:00:00.000Z'),
                paymentType: 'CASH',
                liters: 40,
                amount: 680,
            },
            {
                id: 'tx-2',
                stationId: 'station-5',
                dailyRecordId: 'daily-1',
                shiftId: 'shift-1',
                date: new Date('2026-04-23T04:00:00.000Z'),
                paymentType: 'TRANSFER',
                liters: 30,
                amount: 510,
            },
        ]);

        const { PUT } = await import('../src/app/api/v2/gas/admin/reconciliation/[shiftId]/route');
        const response = await PUT(new Request('http://localhost/api/test', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                cashReceived: 900,
                creditReceived: 100,
                cardReceived: 50,
                transferReceived: 140,
                nonGasSalesAmount: 120,
                otherExpensesAmount: 20,
                varianceNote: 'ทบทวนรอบบิล',
            }),
        }) as never, {
            params: Promise.resolve({ shiftId: 'shift-1' }),
        });

        expect(response.status).toBe(200);
        expect(prismaMock.shiftReconciliation.upsert).toHaveBeenCalledWith(expect.objectContaining({
            update: expect.objectContaining({
                expectedOtherAmount: 100,
                totalExpected: 1290,
                transferReceived: 190,
                totalReceived: 1190,
                variance: -100,
            }),
        }));
        expect(prismaMock.shift.update).toHaveBeenCalledWith({
            where: { id: 'shift-1' },
            data: {
                varianceNote: 'ทบทวนรอบบิล | cardReceived=50.00 | nonGasSalesAmount=120.00 | otherExpensesAmount=20.00',
            },
        });
        await expect(response.json()).resolves.toMatchObject({
            success: true,
            reconciliation: {
                expectedOtherAmount: 100,
                nonGasSalesAmount: 120,
                otherExpensesAmount: 20,
                cardReceived: 50,
                transferReceived: 140,
                varianceStatus: 'SHORT',
            },
        });
    });
});
