import { describe, expect, it, vi } from 'vitest';
import {
    completeFullOpeningMeters,
    openFullStationShift,
    openGasStationShift,
    validateFullOpeningMeters,
    validateFullOpeningPrices,
    validateGasOpening,
    type FullOpeningMeterInput,
    type GasOpeningInput,
} from '@/lib/stations/shift-opening';

function okJson(payload: unknown = { success: true }) {
    return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    });
}

function fullMeters(): FullOpeningMeterInput[] {
    return [1, 2, 3, 4].map((number) => ({
        number,
        value: String(1000 + number),
        file: new File([`meter-${number}`], `meter-${number}.jpg`, { type: 'image/jpeg' }),
    }));
}

function gasOpening(): GasOpeningInput {
    return {
        shiftNumber: 2,
        gasPrice: '16.49',
        meters: [1, 2, 3, 4].map((number) => ({ number, value: String(2000 + number) })),
        gauges: [1, 2, 3].map((number) => ({ number, value: String(50 + number) })),
    };
}

describe('shift opening validation', () => {
    it('preserves FULL legacy price rule: at least one daily price must be positive', () => {
        expect(validateFullOpeningPrices({ retailPrice: '', wholesalePrice: '' }).valid).toBe(false);
        expect(validateFullOpeningPrices({ retailPrice: '31.50', wholesalePrice: '' }).valid).toBe(true);
        expect(validateFullOpeningPrices({ retailPrice: '', wholesalePrice: '30.90' }).valid).toBe(true);
    });

    it('requires all four FULL start meters with image evidence', () => {
        expect(validateFullOpeningMeters(fullMeters())).toEqual({ valid: true, errors: [] });
        const missingPhoto = fullMeters();
        missingPhoto[2].file = null;
        expect(validateFullOpeningMeters(missingPhoto)).toMatchObject({ valid: false });
    });

    it('accepts existing FULL start-meter photos during partial-opening recovery', () => {
        const recovered = fullMeters().map((meter) => ({
            ...meter,
            file: null,
            existingPhoto: `https://example.test/existing-${meter.number}.webp`,
        }));

        expect(validateFullOpeningMeters(recovered)).toEqual({ valid: true, errors: [] });
    });

    it('requires GAS price, four meters and three gauges in valid ranges', () => {
        expect(validateGasOpening(gasOpening())).toEqual({ valid: true, errors: [] });
        const invalid = gasOpening();
        invalid.gauges[0].value = '101';
        expect(validateGasOpening(invalid)).toMatchObject({ valid: false });
    });
});

describe('shift opening API adapters', () => {
    it('FULL saves daily price before opening the shift', async () => {
        const calls: Array<{ url: string; init?: RequestInit }> = [];
        const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            calls.push({ url: String(input), init });
            return okJson();
        }) as typeof fetch;

        await openFullStationShift({
            stationNumber: 1,
            businessDate: '2026-08-27',
            prices: { retailPrice: '31.50', wholesalePrice: '30.90' },
            fetchImpl,
        });

        expect(calls.map((call) => call.url)).toEqual(['/api/station/1/daily', '/api/station/1/shifts']);
        expect(JSON.parse(String(calls[0].init?.body))).toEqual({ date: '2026-08-27', retailPrice: 31.5, wholesalePrice: 30.9 });
        expect(JSON.parse(String(calls[1].init?.body))).toEqual({ action: 'open' });
    });

    it('FULL uploads four photos before saving start meters', async () => {
        const calls: Array<{ url: string; init?: RequestInit }> = [];
        const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = String(input);
            calls.push({ url, init });
            if (url === '/api/upload/meter-photo') {
                const body = init?.body as FormData;
                return okJson({ url: `https://example.test/nozzle-${body.get('nozzle')}.webp` });
            }
            return okJson({ shiftId: 'shift-test' });
        }) as typeof fetch;

        await completeFullOpeningMeters({
            stationId: 'station-1', stationNumber: 1, shiftId: 'shift-test', businessDate: '2026-08-27', meters: fullMeters(), fetchImpl,
        });

        expect(calls.map((call) => call.url)).toEqual([
            '/api/upload/meter-photo', '/api/upload/meter-photo', '/api/upload/meter-photo', '/api/upload/meter-photo', '/api/station/1/meters',
        ]);
        expect(JSON.parse(String(calls[4].init?.body))).toEqual({
            date: '2026-08-27', shiftId: 'shift-test', type: 'start',
            meters: [1, 2, 3, 4].map((number) => ({ nozzleNumber: number, reading: 1000 + number, photo: `https://example.test/nozzle-${number}.webp` })),
        });
    });

    it('FULL reuses saved photos and uploads only missing evidence during recovery', async () => {
        const calls: Array<{ url: string; init?: RequestInit }> = [];
        const meters = fullMeters();
        meters[0] = { ...meters[0], file: null, existingPhoto: 'https://example.test/existing-1.webp' };
        meters[1] = { ...meters[1], file: null, existingPhoto: 'https://example.test/existing-2.webp' };
        const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = String(input);
            calls.push({ url, init });
            if (url === '/api/upload/meter-photo') {
                const body = init?.body as FormData;
                return okJson({ url: `https://example.test/new-${body.get('nozzle')}.webp` });
            }
            return okJson({ shiftId: 'shift-recovery' });
        }) as typeof fetch;

        await completeFullOpeningMeters({
            stationId: 'station-1',
            stationNumber: 1,
            shiftId: 'shift-recovery',
            businessDate: '2026-08-29',
            meters,
            fetchImpl,
        });

        expect(calls.map((call) => call.url)).toEqual([
            '/api/upload/meter-photo',
            '/api/upload/meter-photo',
            '/api/station/1/meters',
        ]);
        expect(JSON.parse(String(calls[2].init?.body))).toEqual({
            date: '2026-08-29',
            shiftId: 'shift-recovery',
            type: 'start',
            meters: [
                { nozzleNumber: 1, reading: 1001, photo: 'https://example.test/existing-1.webp' },
                { nozzleNumber: 2, reading: 1002, photo: 'https://example.test/existing-2.webp' },
                { nozzleNumber: 3, reading: 1003, photo: 'https://example.test/new-3.webp' },
                { nozzleNumber: 4, reading: 1004, photo: 'https://example.test/new-4.webp' },
            ],
        });
    });

    it('GAS sends the atomic opening payload', async () => {
        const calls: Array<{ url: string; init?: RequestInit }> = [];
        const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            calls.push({ url: String(input), init });
            return okJson({ shiftId: 'gas-shift-test' });
        }) as typeof fetch;

        await openGasStationShift({ stationNumber: 6, businessDate: '2026-08-27', value: gasOpening(), fetchImpl });

        expect(calls).toHaveLength(1);
        expect(calls[0].url).toBe('/api/v2/gas/6/shift/open');
        expect(JSON.parse(String(calls[0].init?.body))).toEqual({
            dateKey: '2026-08-27', shiftNumber: 2, gasPrice: 16.49,
            meters: [1, 2, 3, 4].map((number) => ({ nozzleNumber: number, reading: 2000 + number })),
            gauges: [1, 2, 3].map((number) => ({ tankNumber: number, percentage: 50 + number })),
        });
    });
});
