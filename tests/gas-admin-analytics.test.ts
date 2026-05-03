import { describe, expect, it } from 'vitest';
import {
    buildGasDailyAnalytics,
    buildGasNozzlePerformance,
    buildGasStaffPerformance,
    buildGasShiftAnalytics,
    buildGasVarianceNote,
    parseGasVarianceNote,
} from '../src/lib/gas/admin-analytics';

describe('gas admin analytics helpers', () => {
    it('extracts and rebuilds card amounts stored in variance notes', () => {
        expect(parseGasVarianceNote('นับเงินใหม่ | cardReceived=123.45 | nonGasSalesAmount=50 | otherExpensesAmount=12.5')).toEqual({
            cardReceived: 123.45,
            nonGasSalesAmount: 50,
            otherExpensesAmount: 12.5,
            cleanNote: 'นับเงินใหม่',
        });

        expect(buildGasVarianceNote('หมายเหตุเดิม', 88, {
            nonGasSalesAmount: 50,
            otherExpensesAmount: 12.5,
        })).toBe('หมายเหตุเดิม | cardReceived=88.00 | nonGasSalesAmount=50.00 | otherExpensesAmount=12.50');
        expect(buildGasVarianceNote('ขายอื่นเดิม | nonGasSalesAmount=40.00 | otherExpensesAmount=5.00', 0))
            .toBe('ขายอื่นเดิม | nonGasSalesAmount=40.00 | otherExpensesAmount=5.00');
        expect(buildGasVarianceNote('cardReceived=12.00', 0)).toBeNull();
    });

    it('maps transactions into shifts and keeps payment mix consistent', () => {
        const shifts = buildGasShiftAnalytics([
            {
                id: 'shift-1',
                shiftNumber: 1,
                status: 'CLOSED',
                createdAt: new Date('2026-04-23T01:00:00.000Z'),
                closedAt: new Date('2026-04-23T08:00:00.000Z'),
                varianceNote: 'เงินขาดเล็กน้อย | cardReceived=50 | nonGasSalesAmount=100 | otherExpensesAmount=30',
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
                    expectedOtherAmount: 70,
                    totalExpected: 1260,
                    totalReceived: 1200,
                    cashReceived: 1000,
                    creditReceived: 100,
                    transferReceived: 100,
                    variance: 10,
                    varianceStatus: 'GREEN',
                },
            },
            {
                id: 'shift-2',
                shiftNumber: 2,
                status: 'OPEN',
                createdAt: new Date('2026-04-23T09:00:00.000Z'),
                closedAt: null,
                varianceNote: null,
                staff: { name: 'เล็ก' },
                dailyRecord: {
                    id: 'daily-1',
                    stationId: 'station-5',
                    date: new Date('2026-04-22T17:00:00.000Z'),
                    gasPrice: 17,
                    station: { name: 'ปั๊มแก๊สพงษ์อนันต์' },
                },
                meters: [
                    { nozzleNumber: 1, startReading: 140, endReading: 150, soldQty: 10 },
                ],
                reconciliation: null,
            },
        ], [
            {
                id: 'tx-1',
                stationId: 'station-5',
                dailyRecordId: 'daily-1',
                shiftId: null,
                date: new Date('2026-04-23T03:00:00.000Z'),
                paymentType: 'CASH',
                liters: 40,
                amount: 680,
            },
            {
                id: 'tx-2',
                stationId: 'station-5',
                dailyRecordId: 'daily-1',
                shiftId: null,
                date: new Date('2026-04-23T05:00:00.000Z'),
                paymentType: 'CREDIT_CARD',
                liters: 30,
                amount: 510,
            },
            {
                id: 'tx-3',
                stationId: 'station-5',
                dailyRecordId: 'daily-1',
                shiftId: null,
                date: new Date('2026-04-23T10:00:00.000Z'),
                paymentType: 'TRANSFER',
                liters: 10,
                amount: 170,
            },
        ]);

        expect(shifts).toHaveLength(2);
        expect(shifts[0].sales.transactions).toBe(2);
        expect(shifts[0].sales.cash).toBe(680);
        expect(shifts[0].sales.card).toBe(510);
        expect(shifts[0].reconciliation?.cardReceived).toBe(50);
        expect(shifts[0].reconciliation?.transferReceived).toBe(50);
        expect(shifts[0].reconciliation?.nonGasSalesAmount).toBe(100);
        expect(shifts[0].reconciliation?.otherExpensesAmount).toBe(30);
        expect(shifts[0].reconciliation?.expectedOtherAmount).toBe(70);
        expect(shifts[1].sales.transactions).toBe(1);
        expect(shifts[1].sales.transfer).toBe(170);

        const daily = buildGasDailyAnalytics(shifts);
        expect(daily).toHaveLength(1);
        expect(daily[0]).toMatchObject({
            totalSales: 1360,
            transactionCount: 3,
            cashAmount: 680,
            cardAmount: 510,
            transferAmount: 170,
        });

        const staff = buildGasStaffPerformance(shifts);
        expect(staff[0]).toMatchObject({
            staffName: 'กุ้ง',
            shiftCount: 1,
            totalSales: 1190,
            totalLiters: 70,
        });

        const nozzles = buildGasNozzlePerformance(shifts);
        expect(nozzles[0]).toMatchObject({
            stationId: 'station-5',
            nozzleNumber: 1,
            totalLiters: 50,
        });
    });

    it('keeps unassigned gas transactions visible in manager daily analytics', () => {
        const shifts = buildGasShiftAnalytics([], [
            {
                id: 'tx-orphan-1',
                stationId: 'station-5',
                dailyRecordId: 'daily-orphan',
                shiftId: null,
                date: new Date('2026-04-25T06:21:49.168Z'),
                paymentType: 'CASH',
                liters: 60.64,
                amount: 999.95,
            },
            {
                id: 'tx-orphan-2',
                stationId: 'station-5',
                dailyRecordId: 'daily-orphan',
                shiftId: null,
                date: new Date('2026-04-25T06:22:47.240Z'),
                paymentType: 'CREDIT_CARD',
                liters: 491.81,
                amount: 8110,
            },
        ]);

        expect(shifts).toHaveLength(1);
        expect(shifts[0]).toMatchObject({
            id: 'orphan:station-5:2026-04-25',
            stationId: 'station-5',
            dateKey: '2026-04-25',
            shiftNumber: 0,
            status: 'UNASSIGNED',
            isSyntheticOrphan: true,
            transactionCount: 2,
            sales: expect.objectContaining({
                total: 9109.95,
                cash: 999.95,
                card: 8110,
                transactions: 2,
            }),
        });

        const daily = buildGasDailyAnalytics(shifts);
        expect(daily).toHaveLength(1);
        expect(daily[0]).toMatchObject({
            dateKey: '2026-04-25',
            totalSales: 9109.95,
            transactionCount: 2,
            shiftCount: 0,
            cashAmount: 999.95,
            cardAmount: 8110,
        });
    });

    it('keeps after-midnight night-shift transactions on the shift business date', () => {
        const shifts = buildGasShiftAnalytics([
            {
                id: 'shift-night',
                shiftNumber: 2,
                status: 'CLOSED',
                createdAt: new Date('2026-04-24T07:00:00.000Z'),
                closedAt: new Date('2026-04-24T23:00:00.000Z'),
                varianceNote: null,
                staff: { name: 'กะค่ำ' },
                dailyRecord: {
                    id: 'daily-24',
                    stationId: 'station-5',
                    date: new Date('2026-04-23T17:00:00.000Z'),
                    gasPrice: 20,
                    station: { name: 'ปั๊มแก๊สพงษ์อนันต์' },
                },
                meters: [
                    { nozzleNumber: 1, startReading: 1000, endReading: 1010, soldQty: 10 },
                ],
                reconciliation: null,
            },
        ], [
            {
                id: 'tx-after-midnight',
                stationId: 'station-5',
                dailyRecordId: 'daily-24',
                shiftId: 'shift-night',
                date: new Date('2026-04-24T18:30:00.000Z'),
                paymentType: 'CASH',
                liters: 10,
                amount: 200,
            },
        ]);

        expect(shifts).toHaveLength(1);
        expect(shifts[0]).toMatchObject({
            id: 'shift-night',
            dateKey: '2026-04-24',
            transactionCount: 1,
            sales: expect.objectContaining({
                total: 200,
                cash: 200,
                transactions: 1,
            }),
        });

        const daily = buildGasDailyAnalytics(shifts);
        expect(daily).toHaveLength(1);
        expect(daily[0]).toMatchObject({
            dateKey: '2026-04-24',
            totalSales: 200,
            transactionCount: 1,
        });
    });

    it('flags meter start readings that do not continue from the previous shift', () => {
        const shifts = buildGasShiftAnalytics([
            {
                id: 'shift-morning',
                shiftNumber: 1,
                status: 'CLOSED',
                createdAt: new Date('2026-04-24T01:00:00.000Z'),
                closedAt: new Date('2026-04-24T06:00:00.000Z'),
                varianceNote: null,
                staff: { name: 'กุ้ง' },
                dailyRecord: {
                    id: 'daily-continuity',
                    stationId: 'station-5',
                    date: new Date('2026-04-23T17:00:00.000Z'),
                    gasPrice: 17,
                    station: { name: 'ปั๊มแก๊สพงษ์อนันต์' },
                },
                meters: [
                    { nozzleNumber: 1, startReading: 1000, endReading: 1040, soldQty: 40 },
                    { nozzleNumber: 2, startReading: 2000, endReading: 2025, soldQty: 25 },
                ],
                reconciliation: null,
            },
            {
                id: 'shift-afternoon',
                shiftNumber: 2,
                status: 'OPEN',
                createdAt: new Date('2026-04-24T07:00:00.000Z'),
                closedAt: null,
                varianceNote: null,
                staff: { name: 'เล็ก' },
                dailyRecord: {
                    id: 'daily-continuity',
                    stationId: 'station-5',
                    date: new Date('2026-04-23T17:00:00.000Z'),
                    gasPrice: 17,
                    station: { name: 'ปั๊มแก๊สพงษ์อนันต์' },
                },
                meters: [
                    { nozzleNumber: 1, startReading: 1040, endReading: null, soldQty: 0 },
                    { nozzleNumber: 2, startReading: 2031.5, endReading: null, soldQty: 0 },
                ],
                reconciliation: null,
            },
        ], []);

        const afternoon = shifts.find((shift) => shift.id === 'shift-afternoon');
        expect(afternoon?.meters.continuity).toMatchObject({
            checked: true,
            isContinuous: false,
            issueCount: 1,
            maxGap: 6.5,
            issues: [
                expect.objectContaining({
                    nozzleNumber: 2,
                    previousShiftNumber: 1,
                    previousEndReading: 2025,
                    currentStartReading: 2031.5,
                    gap: 6.5,
                }),
            ],
        });
    });
});
