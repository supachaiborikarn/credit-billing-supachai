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
        expect(parseGasVarianceNote('นับเงินใหม่ | cardReceived=123.45')).toEqual({
            cardReceived: 123.45,
            cleanNote: 'นับเงินใหม่',
        });

        expect(buildGasVarianceNote('หมายเหตุเดิม', 88)).toBe('หมายเหตุเดิม | cardReceived=88.00');
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
                varianceNote: 'เงินขาดเล็กน้อย | cardReceived=50',
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
});
