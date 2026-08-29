import { describe, expect, it } from 'vitest';
import {
    buildGasGaugeRecoveryReadings,
    buildGasMeterRecoveryReadings,
    GasRecoveryError,
} from '../src/lib/stations/gas-recovery';

const meters = [1, 2, 3, 4].map((number) => ({
    number,
    value: String(1000 + number),
    startReading: 900 + number,
    existingPhoto: `https://example.test/meter-${number}.jpg`,
    file: null,
}));

const gauges = [1, 2, 3].map((number) => ({
    number,
    value: String(40 + number),
    existingPhoto: `https://example.test/gauge-${number}.jpg`,
}));

describe('GAS canonical recovery payload', () => {
    it('preserves existing meter photo URLs when no new photo is selected', () => {
        expect(buildGasMeterRecoveryReadings({ type: 'end', meters })).toEqual([
            { nozzleNumber: 1, reading: 1001, photoUrl: 'https://example.test/meter-1.jpg' },
            { nozzleNumber: 2, reading: 1002, photoUrl: 'https://example.test/meter-2.jpg' },
            { nozzleNumber: 3, reading: 1003, photoUrl: 'https://example.test/meter-3.jpg' },
            { nozzleNumber: 4, reading: 1004, photoUrl: 'https://example.test/meter-4.jpg' },
        ]);
    });

    it('preserves existing gauge photo URLs on rewrite', () => {
        expect(buildGasGaugeRecoveryReadings({ type: 'end', gauges })).toEqual([
            { tankNumber: 1, percentage: 41, photoUrl: 'https://example.test/gauge-1.jpg' },
            { tankNumber: 2, percentage: 42, photoUrl: 'https://example.test/gauge-2.jpg' },
            { tankNumber: 3, percentage: 43, photoUrl: 'https://example.test/gauge-3.jpg' },
        ]);
    });

    it('fails closed for START correction when the backend lock state is already known', () => {
        expect(() => buildGasMeterRecoveryReadings({
            type: 'start',
            meters,
            startBaselineLocked: true,
            startBaselineLockReason: 'กะนี้เริ่มมีรายการขายแล้ว',
        })).toThrowError(new GasRecoveryError('กะนี้เริ่มมีรายการขายแล้ว'));
    });

    it('rejects END meter values below their START readings', () => {
        const invalid = meters.map((meter) => ({ ...meter }));
        invalid[1].value = '1';
        expect(() => buildGasMeterRecoveryReadings({ type: 'end', meters: invalid }))
            .toThrow('หัวจ่าย 2: เลขปิดต้องไม่น้อยกว่าเลขเปิด');
    });

    it('validates gauges as exact percentages from 0 to 100', () => {
        const invalid = gauges.map((gauge) => ({ ...gauge }));
        invalid[2].value = '101';
        expect(() => buildGasGaugeRecoveryReadings({ type: 'end', gauges: invalid }))
            .toThrow('ถัง 3: เปอร์เซ็นต์ต้องอยู่ระหว่าง 0-100');
    });
});
