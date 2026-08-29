import { describe, expect, it } from 'vitest';
import {
    buildFullMeterMaintenancePayload,
    normalizeFullMeterMaintenanceRows,
    validateFullMeterMaintenanceRows,
} from '@/lib/stations/full-meter-maintenance';

describe('FULL meter maintenance payload', () => {
    it('normalizes all four nozzles and preserves saved photos', () => {
        const rows = normalizeFullMeterMaintenanceRows([
            { nozzleNumber: 1, startReading: '1000.5', endReading: 1200.5, startPhoto: ' start-1 ', endPhoto: 'end-1' },
            { nozzleNumber: 4, startReading: 4000, endReading: null, startPhoto: 'start-4', endPhoto: null },
        ]);
        expect(rows).toHaveLength(4);
        expect(rows[0]).toMatchObject({ nozzleNumber: 1, startReading: 1000.5, endReading: 1200.5, startPhoto: 'start-1', endPhoto: 'end-1' });
        expect(rows[1]).toMatchObject({ nozzleNumber: 2, startReading: 0, endReading: 0, startPhoto: null, endPhoto: null });
        expect(rows[3]).toMatchObject({ nozzleNumber: 4, startReading: 4000, endReading: 0, startPhoto: 'start-4', endPhoto: null });
    });

    it('requires photos for the edited side and rejects end below start', () => {
        const rows = [1, 2, 3, 4].map((nozzleNumber) => ({
            nozzleNumber,
            startReading: 1000 + nozzleNumber,
            endReading: 1100 + nozzleNumber,
            startPhoto: `start-${nozzleNumber}`,
            endPhoto: `end-${nozzleNumber}`,
        }));
        rows[0].endReading = 500;
        rows[1].endPhoto = '';
        expect(validateFullMeterMaintenanceRows(rows, 'end')).toEqual(expect.arrayContaining([
            expect.stringContaining('1'),
            expect.stringContaining('2'),
        ]));
    });

    it('builds a shift-bound four-nozzle payload without changing transaction data', () => {
        const rows = [1, 2, 3, 4].map((nozzleNumber) => ({
            nozzleNumber,
            startReading: 1000 + nozzleNumber,
            endReading: 1500 + nozzleNumber,
            startPhoto: `start-${nozzleNumber}`,
            endPhoto: `end-${nozzleNumber}`,
        }));
        expect(buildFullMeterMaintenancePayload({
            date: '2026-08-28', shiftId: 'shift-end', type: 'end', rows,
        })).toEqual({
            date: '2026-08-28',
            shiftId: 'shift-end',
            type: 'end',
            meters: rows.map((row) => ({ nozzleNumber: row.nozzleNumber, reading: row.endReading, photo: row.endPhoto })),
        });
    });

    it('refuses correction without an existing shift binding', () => {
        expect(() => buildFullMeterMaintenancePayload({
            date: '2026-08-28', shiftId: null, type: 'start', rows: [],
        })).toThrow();
    });
});
