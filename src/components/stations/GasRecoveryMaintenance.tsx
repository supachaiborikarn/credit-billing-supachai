'use client';

import * as React from 'react';
import Link from 'next/link';
import { Camera, Gauge, RefreshCw, ShieldAlert } from 'lucide-react';
import { Button, Input, Notice, Section } from '@/components/ui';
import {
    saveGasGaugeRecovery,
    saveGasMeterRecovery,
    type GasRecoveryGaugeInput,
    type GasRecoveryMeterInput,
    type GasRecoveryType,
} from '@/lib/stations/gas-recovery';
import type { StationContextPayload } from '@/types/station';

type CurrentGasShift = {
    id: string;
    shiftNumber: number;
    status: string;
    businessDate: string;
    startBaselineLocked?: boolean;
    startBaselineLockReason?: string | null;
    meters?: Array<{
        nozzleNumber: number;
        startReading: number | null;
        endReading: number | null;
    }>;
};

type MeterApiRow = {
    nozzleNumber: number;
    startReading: number | string | null;
    endReading: number | string | null;
    startPhoto?: string | null;
    endPhoto?: string | null;
};

type GaugeApiRow = {
    tankNumber: number;
    percentage: number | string;
    photoUrl?: string | null;
};

function numericOrNull(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function createMeterInputs(rows: MeterApiRow[], type: GasRecoveryType): GasRecoveryMeterInput[] {
    return [1, 2, 3, 4].map((number) => {
        const row = rows.find((item) => item.nozzleNumber === number);
        const startReading = numericOrNull(row?.startReading);
        const selected = type === 'start' ? startReading : numericOrNull(row?.endReading);
        return {
            number,
            value: selected === null ? '' : String(selected),
            startReading,
            existingPhoto: (type === 'start' ? row?.startPhoto : row?.endPhoto) || null,
            file: null,
        };
    });
}

function createGaugeInputs(rows: GaugeApiRow[]): GasRecoveryGaugeInput[] {
    return [1, 2, 3].map((number) => {
        const row = rows.find((item) => item.tankNumber === number);
        const selected = numericOrNull(row?.percentage);
        return {
            number,
            value: selected === null ? '' : String(selected),
            existingPhoto: row?.photoUrl || null,
        };
    });
}

export function GasRecoveryMaintenance({
    context,
    onSaved,
}: {
    context: StationContextPayload;
    onSaved: () => Promise<void>;
}) {
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState<'meter' | 'gauge' | null>(null);
    const [error, setError] = React.useState<string | null>(null);
    const [success, setSuccess] = React.useState<string | null>(null);
    const [shift, setShift] = React.useState<CurrentGasShift | null>(null);
    const [meterRows, setMeterRows] = React.useState<MeterApiRow[]>([]);
    const [startGaugeRows, setStartGaugeRows] = React.useState<GaugeApiRow[]>([]);
    const [endGaugeRows, setEndGaugeRows] = React.useState<GaugeApiRow[]>([]);
    const [meterType, setMeterType] = React.useState<GasRecoveryType>('end');
    const [gaugeType, setGaugeType] = React.useState<GasRecoveryType>('end');
    const [meters, setMeters] = React.useState<GasRecoveryMeterInput[]>([]);
    const [gauges, setGauges] = React.useState<GasRecoveryGaugeInput[]>([]);

    const load = React.useCallback(async () => {
        if (context.station.type !== 'GAS' || context.currentShift?.status !== 'OPEN') return;
        setLoading(true);
        setError(null);
        try {
            const currentResponse = await fetch(`/api/v2/gas/${context.station.number}/shift/current`, { cache: 'no-store' });
            const currentPayload = await currentResponse.json().catch(() => null) as { shift?: CurrentGasShift | null; error?: string } | null;
            if (!currentResponse.ok) throw new Error(currentPayload?.error || 'โหลดกะ GAS ไม่สำเร็จ');
            const currentShift = currentPayload?.shift;
            if (!currentShift || currentShift.status !== 'OPEN' || currentShift.id !== context.currentShift.id) {
                throw new Error('กะปัจจุบันเปลี่ยนไปแล้ว กรุณารีเฟรช Operations ก่อนแก้ข้อมูล');
            }

            const [meterResponse, gaugeResponse] = await Promise.all([
                fetch(`/api/v2/gas/${context.station.number}/meters?shiftId=${encodeURIComponent(currentShift.id)}`, { cache: 'no-store' }),
                fetch(`/api/v2/gas/${context.station.number}/gauge?shiftId=${encodeURIComponent(currentShift.id)}`, { cache: 'no-store' }),
            ]);
            const meterPayload = await meterResponse.json().catch(() => null) as { meters?: MeterApiRow[]; error?: string } | null;
            const gaugePayload = await gaugeResponse.json().catch(() => null) as { readings?: { start?: GaugeApiRow[]; end?: GaugeApiRow[] }; error?: string } | null;
            if (!meterResponse.ok) throw new Error(meterPayload?.error || 'โหลดมิเตอร์ GAS ไม่สำเร็จ');
            if (!gaugeResponse.ok) throw new Error(gaugePayload?.error || 'โหลดเกจ GAS ไม่สำเร็จ');

            const nextMeterRows = meterPayload?.meters || [];
            const nextStartGaugeRows = gaugePayload?.readings?.start || [];
            const nextEndGaugeRows = gaugePayload?.readings?.end || [];
            const preferredType: GasRecoveryType = context.openingState.status === 'READY' || currentShift.startBaselineLocked ? 'end' : 'start';
            setShift(currentShift);
            setMeterRows(nextMeterRows);
            setStartGaugeRows(nextStartGaugeRows);
            setEndGaugeRows(nextEndGaugeRows);
            setMeterType(preferredType);
            setGaugeType(preferredType);
            setMeters(createMeterInputs(nextMeterRows, preferredType));
            setGauges(createGaugeInputs(preferredType === 'start' ? nextStartGaugeRows : nextEndGaugeRows));
        } catch (loadError) {
            setShift(null);
            setError(loadError instanceof Error ? loadError.message : 'โหลดข้อมูล recovery ไม่สำเร็จ');
        } finally {
            setLoading(false);
        }
    }, [context.currentShift?.id, context.currentShift?.status, context.openingState.status, context.station.number, context.station.type]);

    React.useEffect(() => {
        void load();
    }, [load]);

    if (context.station.type !== 'GAS' || context.currentShift?.status !== 'OPEN') return null;

    const startLocked = Boolean(shift?.startBaselineLocked);
    const lockReason = shift?.startBaselineLockReason || null;

    const selectMeterType = (type: GasRecoveryType) => {
        if (type === 'start' && startLocked) return;
        setMeterType(type);
        setMeters(createMeterInputs(meterRows, type));
        setError(null);
        setSuccess(null);
    };

    const selectGaugeType = (type: GasRecoveryType) => {
        if (type === 'start' && startLocked) return;
        setGaugeType(type);
        setGauges(createGaugeInputs(type === 'start' ? startGaugeRows : endGaugeRows));
        setError(null);
        setSuccess(null);
    };

    const saveMeters = async () => {
        if (!shift) return;
        setSaving('meter');
        setError(null);
        setSuccess(null);
        try {
            await saveGasMeterRecovery({
                stationId: context.station.id,
                stationNumber: context.station.number,
                shiftId: shift.id,
                businessDate: shift.businessDate,
                type: meterType,
                meters,
                startBaselineLocked: startLocked,
                startBaselineLockReason: lockReason,
            });
            setSuccess(`บันทึกมิเตอร์${meterType === 'start' ? 'เปิด' : 'ปิด'}กะครบ 4 หัวแล้ว`);
            await load();
            await onSaved();
        } catch (saveError) {
            setError(saveError instanceof Error ? saveError.message : 'บันทึกมิเตอร์ไม่สำเร็จ');
        } finally {
            setSaving(null);
        }
    };

    const saveGauges = async () => {
        if (!shift) return;
        setSaving('gauge');
        setError(null);
        setSuccess(null);
        try {
            await saveGasGaugeRecovery({
                stationNumber: context.station.number,
                shiftId: shift.id,
                type: gaugeType,
                gauges,
                startBaselineLocked: startLocked,
                startBaselineLockReason: lockReason,
            });
            setSuccess(`บันทึกเกจ${gaugeType === 'start' ? 'เปิด' : 'ปิด'}กะครบ 3 ถังแล้ว`);
            await load();
            await onSaved();
        } catch (saveError) {
            setError(saveError instanceof Error ? saveError.message : 'บันทึกเกจไม่สำเร็จ');
        } finally {
            setSaving(null);
        }
    };

    return (
        <Section
            title="กู้/บันทึกมิเตอร์และเกจ GAS"
            description={`กะ ${context.currentShift.shiftNumber} · ${context.currentShift.businessDate} · ใช้เมื่อต้องบันทึกแยกหรือทำข้อมูลที่ค้างต่อ โดยไม่สร้างกะใหม่`}
        >
            <div className="space-y-5">
                {loading && (
                    <Notice tone="info" title="กำลังตรวจข้อมูลกะล่าสุด">
                        ยังปิดการบันทึกไว้จนกว่าจะยืนยัน exact OPEN Shift และสถานะ lock สำเร็จ
                    </Notice>
                )}
                {error && <Notice tone="danger" title="ทำรายการไม่ได้">{error}</Notice>}
                {success && <Notice tone="success" title="บันทึกแล้ว">{success}</Notice>}
                {startLocked && (
                    <Notice tone="warning" title="เลขเปิดถูกล็อกแล้ว">
                        <div className="space-y-2">
                            <p>{lockReason || 'กะนี้เริ่มถูกใช้งานแล้ว จึงแก้เลขเปิดผ่าน recovery ปกติไม่ได้'}</p>
                            {context.user.role === 'ADMIN' && shift && (
                                <Link
                                    href={`/admin/gas/meters/${shift.id}/edit`}
                                    className="inline-flex min-h-11 items-center gap-2 font-semibold underline underline-offset-4 focus-visible:outline-none focus-visible:shadow-[var(--ui-shadow-focus)]"
                                >
                                    <ShieldAlert className="h-4 w-4" aria-hidden="true" /> แก้เลขเปิดมิเตอร์แบบมี Audit Log
                                </Link>
                            )}
                        </div>
                    </Notice>
                )}

                <div className="rounded-[var(--ui-radius-md)] border border-[var(--ui-border)] p-3 sm:p-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <div>
                            <h3 className="font-semibold text-[var(--ui-text)]">มิเตอร์ 4 หัวจ่าย</h3>
                            <p className="text-xs text-[var(--ui-text-muted)]">บันทึก START ก่อน lock หรือ END แยกจาก flow ปิดกะได้ รูปเดิมจะถูกเก็บไว้ถ้าไม่เลือกรูปใหม่</p>
                        </div>
                        <div className="flex gap-2" aria-label="เลือกชนิดมิเตอร์">
                            {(['start', 'end'] as const).map((type) => (
                                <button
                                    key={type}
                                    type="button"
                                    onClick={() => selectMeterType(type)}
                                    disabled={loading || saving !== null || (type === 'start' && startLocked)}
                                    className={`min-h-11 rounded-[var(--ui-radius-md)] border px-4 text-sm font-semibold focus-visible:outline-none focus-visible:shadow-[var(--ui-shadow-focus)] disabled:cursor-not-allowed disabled:opacity-50 ${meterType === type ? 'border-[var(--ui-primary-700)] bg-[var(--ui-primary-50)] text-[var(--ui-primary-800)]' : 'border-[var(--ui-border-strong)] text-[var(--ui-text-secondary)]'}`}
                                >
                                    {type === 'start' ? 'เลขเปิด' : 'เลขปิด'}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                        {meters.map((meter, index) => (
                            <div key={meter.number} className="rounded-[var(--ui-radius-md)] bg-[var(--ui-surface-subtle)] p-3">
                                <Input
                                    label={`หัวจ่าย ${meter.number}${meterType === 'end' && meter.startReading !== null ? ` · เปิด ${meter.startReading.toLocaleString('th-TH')}` : ''}`}
                                    inputMode="decimal"
                                    value={meter.value}
                                    onChange={(event) => setMeters((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, value: event.target.value } : item))}
                                    disabled={loading || saving !== null}
                                    required
                                />
                                <label className="mt-2 flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-[var(--ui-radius-md)] border border-dashed border-[var(--ui-border-strong)] px-3 py-2 text-sm font-semibold text-[var(--ui-text-secondary)] focus-within:shadow-[var(--ui-shadow-focus)]">
                                    <Camera className="h-4 w-4" aria-hidden="true" />
                                    {meter.file ? meter.file.name : meter.existingPhoto ? 'เลือกรูปใหม่ (ใช้รูปเดิมได้)' : 'แนบรูป (ถ้ามี)'}
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className="sr-only"
                                        disabled={loading || saving !== null}
                                        onChange={(event) => {
                                            const file = event.target.files?.[0] || null;
                                            setMeters((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, file } : item));
                                        }}
                                    />
                                </label>
                                {meter.existingPhoto && !meter.file && (
                                    <a href={meter.existingPhoto} target="_blank" rel="noreferrer" className="mt-2 inline-flex min-h-9 items-center text-xs font-semibold text-[var(--ui-info-text)] underline underline-offset-4">
                                        ดูรูปเดิม
                                    </a>
                                )}
                            </div>
                        ))}
                    </div>
                    <Button className="mt-3 w-full sm:w-auto" loading={saving === 'meter'} disabled={loading || saving !== null || !shift} onClick={() => void saveMeters()}>
                        บันทึกมิเตอร์{meterType === 'start' ? 'เปิด' : 'ปิด'}
                    </Button>
                </div>

                <div className="rounded-[var(--ui-radius-md)] border border-[var(--ui-border)] p-3 sm:p-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <div>
                            <h3 className="flex items-center gap-2 font-semibold text-[var(--ui-text)]"><Gauge className="h-4 w-4" aria-hidden="true" /> เกจ 3 ถัง</h3>
                            <p className="text-xs text-[var(--ui-text-muted)]">บันทึก START ก่อน lock หรือ END แยกเพื่อ retry ได้ โดยไม่ปิดกะทันที</p>
                        </div>
                        <div className="flex gap-2" aria-label="เลือกชนิดเกจ">
                            {(['start', 'end'] as const).map((type) => (
                                <button
                                    key={type}
                                    type="button"
                                    onClick={() => selectGaugeType(type)}
                                    disabled={loading || saving !== null || (type === 'start' && startLocked)}
                                    className={`min-h-11 rounded-[var(--ui-radius-md)] border px-4 text-sm font-semibold focus-visible:outline-none focus-visible:shadow-[var(--ui-shadow-focus)] disabled:cursor-not-allowed disabled:opacity-50 ${gaugeType === type ? 'border-[var(--ui-primary-700)] bg-[var(--ui-primary-50)] text-[var(--ui-primary-800)]' : 'border-[var(--ui-border-strong)] text-[var(--ui-text-secondary)]'}`}
                                >
                                    {type === 'start' ? 'เกจเปิด' : 'เกจปิด'}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                        {gauges.map((gauge, index) => (
                            <Input
                                key={gauge.number}
                                label={`ถัง ${gauge.number} (%)`}
                                inputMode="decimal"
                                value={gauge.value}
                                onChange={(event) => setGauges((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, value: event.target.value } : item))}
                                disabled={loading || saving !== null}
                                required
                            />
                        ))}
                    </div>
                    <Button className="mt-3 w-full sm:w-auto" loading={saving === 'gauge'} disabled={loading || saving !== null || !shift} onClick={() => void saveGauges()}>
                        บันทึกเกจ{gaugeType === 'start' ? 'เปิด' : 'ปิด'}
                    </Button>
                </div>

                <button
                    type="button"
                    onClick={() => void load()}
                    disabled={loading || saving !== null}
                    className="inline-flex min-h-11 items-center gap-2 rounded-[var(--ui-radius-md)] px-3 text-sm font-semibold text-[var(--ui-text-secondary)] hover:bg-[var(--ui-surface-subtle)] focus-visible:outline-none focus-visible:shadow-[var(--ui-shadow-focus)] disabled:opacity-50"
                >
                    <RefreshCw className="h-4 w-4" aria-hidden="true" /> โหลดสถานะกะใหม่
                </button>
            </div>
        </Section>
    );
}
