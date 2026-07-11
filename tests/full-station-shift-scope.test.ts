import { describe, expect, it } from 'vitest';
import {
    buildFullStationDailyMeters,
    selectCanonicalFullStationShift,
    selectFullStationDailyEditShifts,
} from '../src/lib/full-station-shift-scope';

describe('full-station shift scope helpers', () => {
    it('uses a new OPEN shift for live work while historical boundaries ignore one-row artifacts', () => {
        const realClosedShift = {
            id: 'shift-1',
            shiftNumber: 1,
            status: 'CLOSED',
            meters: [1, 2, 3, 4].map(nozzleNumber => ({
                nozzleNumber,
                startReading: 1_000 + nozzleNumber,
                endReading: 1_500 + nozzleNumber,
                startPhoto: `start-${nozzleNumber}`,
                endPhoto: `end-${nozzleNumber}`,
            })),
            _count: { transactions: 8 },
        };
        const newOpenShift = {
            id: 'shift-2',
            shiftNumber: 2,
            status: 'OPEN',
            meters: [{
                nozzleNumber: 1,
                startReading: 0,
                endReading: null,
                startPhoto: 'new-start-1',
                endPhoto: null,
            }],
            _count: { transactions: 0 },
        };

        expect(selectCanonicalFullStationShift([realClosedShift, newOpenShift])?.id).toBe('shift-2');
        expect(selectFullStationDailyEditShifts([realClosedShift, newOpenShift])).toMatchObject({
            startShift: { id: 'shift-1' },
            endShift: { id: 'shift-1' },
        });
    });

    it('uses unscoped legacy meters as a per-nozzle fallback', () => {
        const dailyMeters = buildFullStationDailyMeters([
            {
                id: 'shift-1',
                shiftNumber: 1,
                status: 'OPEN',
                meters: [{
                    nozzleNumber: 1,
                    startReading: 100,
                    endReading: 150,
                    startPhoto: 'shift-start-1',
                    endPhoto: 'shift-end-1',
                }],
            },
        ], [
            {
                nozzleNumber: 2,
                startReading: 200,
                endReading: 250,
                startPhoto: 'legacy-start-2',
                endPhoto: 'legacy-end-2',
            },
        ]);

        expect(dailyMeters).toEqual([
            expect.objectContaining({ nozzleNumber: 1, startReading: 100, endReading: 150 }),
            expect.objectContaining({ nozzleNumber: 2, startReading: 200, endReading: 250 }),
        ]);
    });
});
