import { describe, expect, it } from 'vitest';
import {
    addDaysToDateKey,
    buildDailyMetrics,
    buildFuelTypeMetrics,
    buildHourlyMetrics,
    listDateKeys,
    normalizeOperationalFuelType,
} from '../src/lib/operational-sales';

describe('operational sales helpers', () => {
    it('normalizes diesel labels from internal and external sources into one bucket', () => {
        expect(normalizeOperationalFuelType('DIESEL')).toBe('ดีเซล');
        expect(normalizeOperationalFuelType('ดีเซล B7')).toBe('ดีเซล');
        expect(normalizeOperationalFuelType(null, 'DIESEL')).toBe('ดีเซล');
    });

    it('builds inclusive date ranges correctly', () => {
        expect(addDaysToDateKey('2026-04-18', -2)).toBe('2026-04-16');
        expect(listDateKeys('2026-04-16', '2026-04-18')).toEqual([
            '2026-04-16',
            '2026-04-17',
            '2026-04-18',
        ]);
    });

    it('aggregates daily metrics across sources using the merged date key', () => {
        const rows = [
            {
                source: 'internal' as const,
                stationId: 'station-2',
                dateKey: '2026-04-17',
                soldAt: new Date('2026-04-17T02:00:00.000Z'),
                liters: 100,
                revenue: 3200,
                paymentType: 'CASH',
                pricePerLiter: 32,
                billBookNo: 'A1',
                billNo: '1001',
                nozzleNumber: 1,
                fuelType: 'ดีเซล',
                ownerId: null,
                ownerName: null,
            },
            {
                source: 'watchara_external' as const,
                stationId: 'station-2',
                dateKey: '2026-04-17',
                soldAt: new Date('2026-04-17T03:00:00.000Z'),
                liters: 25,
                revenue: 800,
                paymentType: 'CASH',
                pricePerLiter: 32,
                billBookNo: null,
                billNo: 'X-1',
                nozzleNumber: 2,
                fuelType: 'ดีเซล',
                ownerId: null,
                ownerName: null,
            },
        ];

        expect(buildDailyMetrics(['2026-04-17'], rows)).toEqual([
            {
                date: '2026-04-17',
                liters: 125,
                revenue: 4000,
                count: 2,
            },
        ]);
    });

    it('groups merged rows by Bangkok hour', () => {
        const rows = [
            {
                source: 'watchara_external' as const,
                stationId: 'station-2',
                dateKey: '2026-04-17',
                soldAt: new Date('2026-04-17T01:30:00.000Z'),
                liters: 10,
                revenue: 320,
                paymentType: 'CASH',
                pricePerLiter: 32,
                billBookNo: null,
                billNo: 'X-2',
                nozzleNumber: 1,
                fuelType: 'ดีเซล',
                ownerId: null,
                ownerName: null,
            },
        ];

        const hourly = buildHourlyMetrics(rows);

        expect(hourly[8]).toMatchObject({
            hour: 8,
            liters: 10,
            revenue: 320,
            count: 1,
        });
    });

    it('merges normalized fuel buckets', () => {
        const rows = [
            {
                source: 'internal' as const,
                stationId: 'station-2',
                dateKey: '2026-04-17',
                soldAt: new Date('2026-04-17T01:00:00.000Z'),
                liters: 10,
                revenue: 320,
                paymentType: 'CASH',
                pricePerLiter: 32,
                billBookNo: 'A1',
                billNo: '1002',
                nozzleNumber: 1,
                fuelType: normalizeOperationalFuelType('ดีเซล'),
                ownerId: null,
                ownerName: null,
            },
            {
                source: 'watchara_external' as const,
                stationId: 'station-2',
                dateKey: '2026-04-17',
                soldAt: new Date('2026-04-17T02:00:00.000Z'),
                liters: 15,
                revenue: 480,
                paymentType: 'CASH',
                pricePerLiter: 32,
                billBookNo: null,
                billNo: 'X-3',
                nozzleNumber: 2,
                fuelType: normalizeOperationalFuelType(null, 'DIESEL'),
                ownerId: null,
                ownerName: null,
            },
        ];

        expect(buildFuelTypeMetrics(rows)).toEqual([
            {
                fuelType: 'ดีเซล',
                liters: 25,
                revenue: 800,
                count: 2,
            },
        ]);
    });
});
