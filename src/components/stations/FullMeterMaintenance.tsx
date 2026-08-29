'use client';

import * as React from 'react';
import { ExternalLink, RefreshCw, Save, Upload } from 'lucide-react';
import { Button, Notice, Section } from '@/components/ui';
import {
    buildFullMeterMaintenancePayload,
    getFullMeterMaintenancePhoto,
    normalizeFullMeterMaintenanceRows,
    type FullMeterMaintenanceRow,
    type FullMeterMaintenanceType,
} from '@/lib/stations/full-meter-maintenance';
import type { StationContextPayload } from '@/types/station';

type DailyMeterRecord = {
    id: string;
    status: string;
    meterStartShiftId?: string | null;
    meterEndShiftId?: string | null;
    isHistoricalDate?: boolean;
    meters: Array<{
        nozzleNumber: number;
        startReading: number;
        endReading: number | null;
        startPhoto?: string | null;
        endPhoto?: string | null;
    }>;
};

type DailyMeterResponse = {
    dailyRecord: DailyMeterRecord | null;
    previousDayMeters?: Array<{ nozzle: number; endReading: number }>;
};

function formatNumber(value: number) {
    return new Intl.NumberFormat('th-TH', { maximumFractionDigits: 3 }).format(value || 0);
}

export function FullMeterMaintenance({
    context,
    onSaved,
}: {
    context: StationContextPayload;
    onSaved: () => Promise<void>;
}) {
    const today = context.saleContext?.businessDate || new Date().toISOString().slice(0, 10);
    const [selectedDate, setSelectedDate] = React.useState(today);
    const [record, setRecord] = React.useState<DailyMeterRecord | null>(null);
    const [rows, setRows] = React.useState<FullMeterMaintenanceRow[]>(() => normalizeFullMeterMaintenanceRows());
    const [previousDayMeters, setPreviousDayMeters] = React.useState<Array<{ nozzle: number; endReading: number }>>([]);
    const [type, setType] = React.useState<FullMeterMaintenanceType>('start');
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const [uploadingKey, setUploadingKey] = React.useState<string | null>(null);
    const [error, setError] = React.useState<string | null>(null);
    const [message, setMessage] = React.useState<string | null>(null);

    const load = React.useCallback(async () => {
        setLoading(true);
        setError(null);
        setMessage(null);
        try {
            const response = await fetch(`/api/station/${context.station.number}/daily?date=${selectedDate}`, { cache: 'no-store' });
            const payload = await response.json().catch(() => null) as DailyMeterResponse | { error?: string } | null;
            if (!response.ok) throw new Error(payload && 'error' in payload ? payload.error || 'โหลดมิเตอร์ไม่สำเร็จ' : 'โหลดมิเตอร์ไม่สำเร็จ');
            const dailyRecord = payload && 'dailyRecord' in payload ? payload.dailyRecord : null;
            setRecord(dailyRecord);
            setRows(normalizeFullMeterMaintenanceRows(dailyRecord?.meters || []));
            setPreviousDayMeters(payload && 'previousDayMeters' in payload ? payload.previousDayMeters || [] : []);
        } catch (loadError) {
            setRecord(null);
            setRows(normalizeFullMeterMaintenanceRows());
            setPreviousDayMeters([]);
            setError(loadError instanceof Error ? loadError.message : 'โหลดมิเตอร์ไม่สำเร็จ');
        } finally {
            setLoading(false);
        }
    }, [context.station.number, selectedDate]);

    React.useEffect(() => {
        void load();
    }, [load]);

    const shiftId = type === 'start'
        ? record?.meterStartShiftId || null
        : record?.meterEndShiftId || null;

    const updateReading = (nozzleNumber: number, value: string) => {
        const parsed = value.trim() === '' ? 0 : Number(value);
        setRows((current) => current.map((row) => row.nozzleNumber === nozzleNumber
            ? { ...row, [type === 'start' ? 'startReading' : 'endReading']: Number.isFinite(parsed) ? parsed : 0 }
            : row));
        setError(null);
        setMessage(null);
    };

    const uploadPhoto = async (nozzleNumber: number, file: File) => {
        if (!record || !shiftId) {
            setError('ไม่พบกะที่ผูกกับมิเตอร์ของวันที่เลือก');
            return;
        }
        const key = `${type}-${nozzleNumber}`;
        setUploadingKey(key);
        setError(null);
        setMessage(null);
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('type', type);
            formData.append('nozzle', String(nozzleNumber));
            formData.append('date', selectedDate);
            formData.append('stationId', context.station.id);
            formData.append('shiftId', shiftId);

            const response = await fetch('/api/upload/meter-photo', { method: 'POST', body: formData });
            const payload = await response.json().catch(() => null) as { url?: string; error?: string } | null;
            if (!response.ok || !payload?.url) throw new Error(payload?.error || 'อัปโหลดรูปมิเตอร์ไม่สำเร็จ');

            setRows((current) => current.map((row) => row.nozzleNumber === nozzleNumber
                ? { ...row, [type === 'start' ? 'startPhoto' : 'endPhoto']: payload.url || null }
                : row));
            setMessage(`อัปโหลดรูปหัวจ่าย ${nozzleNumber} แล้ว กดบันทึกมิเตอร์เพื่อยืนยันการแก้ไข`);
        } catch (uploadError) {
            setError(uploadError instanceof Error ? uploadError.message : 'อัปโหลดรูปมิเตอร์ไม่สำเร็จ');
        } finally {
            setUploadingKey(null);
        }
    };

    const save = async () => {
        setSaving(true);
        setError(null);
        setMessage(null);
        try {
            const body = buildFullMeterMaintenancePayload({ date: selectedDate, shiftId, type, rows });
            const response = await fetch(`/api/station/${context.station.number}/meters`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const payload = await response.json().catch(() => null) as { error?: string } | null;
            if (!response.ok) throw new Error(payload?.error || 'บันทึกมิเตอร์ไม่สำเร็จ');
            await load();
            await onSaved();
            setMessage(`บันทึกมิเตอร์${type === 'start' ? 'เริ่มต้น' : 'สิ้นสุด'}แล้ว`);
        } catch (saveError) {
            setError(saveError instanceof Error ? saveError.message : 'บันทึกมิเตอร์ไม่สำเร็จ');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Section
            title="แก้มิเตอร์และรูป (แอดมิน)"
            description="correction ของ DailyRecord/Shift ที่มีอยู่แล้ว รองรับมิเตอร์เริ่มต้นและสิ้นสุดย้อนหลัง"
        >
            <div className="space-y-4">
                <Notice tone="info" title="แก้เฉพาะหลักฐานมิเตอร์ ไม่สร้างกะย้อนหลัง">
                    ต้องมี DailyRecord และ Shift ของวันที่เลือกอยู่แล้ว ระบบจะบันทึก audit log และคำนวณ soldQty จากเลขมิเตอร์ แต่จะไม่แก้ Transaction.pricePerLiter หรือ Transaction.amount ที่บันทึกไว้เดิม
                </Notice>

                <div className="grid gap-3 md:grid-cols-[minmax(0,220px)_1fr]">
                    <label className="text-sm font-semibold text-[var(--ui-text)]">
                        วันที่
                        <input
                            type="date"
                            value={selectedDate}
                            max={today}
                            onChange={(event) => setSelectedDate(event.target.value)}
                            className="mt-1 min-h-11 w-full rounded-[var(--ui-radius-md)] border border-[var(--ui-border-strong)] bg-[var(--ui-surface)] px-3 font-normal focus-visible:outline-none focus-visible:shadow-[var(--ui-shadow-focus)]"
                        />
                    </label>
                    <div className="grid grid-cols-2 gap-2 self-end">
                        <Button variant={type === 'start' ? 'default' : 'outline'} onClick={() => setType('start')}>
                            มิเตอร์เริ่มต้น
                        </Button>
                        <Button variant={type === 'end' ? 'default' : 'outline'} onClick={() => setType('end')}>
                            มิเตอร์สิ้นสุด
                        </Button>
                    </div>
                </div>

                {loading ? (
                    <div className="text-sm text-[var(--ui-text-muted)]">กำลังโหลดมิเตอร์…</div>
                ) : !record ? (
                    <Notice tone="warning" title="ไม่พบ DailyRecord ของวันที่เลือก">
                        correction นี้ fail-closed และจะไม่สร้าง DailyRecord หรือ Shift ย้อนหลังใหม่
                    </Notice>
                ) : !shiftId ? (
                    <Notice tone="warning" title="ไม่พบกะสำหรับมิเตอร์ชุดนี้">
                        วันที่นี้ไม่มี Shift ที่ผูกกับมิเตอร์{type === 'start' ? 'เริ่มต้น' : 'สิ้นสุด'} จึงไม่อนุญาตให้บันทึกหรืออัปโหลดรูป
                    </Notice>
                ) : (
                    <div className="text-xs text-[var(--ui-text-muted)]">
                        DailyRecord {record.id} · {record.status} · Shift {shiftId}{record.isHistoricalDate ? ' · historical correction' : ''}
                    </div>
                )}

                {previousDayMeters.length > 0 && (
                    <div className="rounded-[var(--ui-radius-md)] bg-[var(--ui-surface-subtle)] p-3 text-xs text-[var(--ui-text-muted)]">
                        มิเตอร์สิ้นสุดวันก่อน: {previousDayMeters.map((item) => `หัว ${item.nozzle}: ${formatNumber(item.endReading)}`).join(' · ')}
                    </div>
                )}

                {record && (
                    <div className="grid gap-3 md:grid-cols-2">
                        {rows.map((row) => {
                            const photo = getFullMeterMaintenancePhoto(row, type);
                            const uploadKey = `${type}-${row.nozzleNumber}`;
                            const reading = type === 'start' ? row.startReading : row.endReading;
                            return (
                                <div key={row.nozzleNumber} className="rounded-[var(--ui-radius-md)] border border-[var(--ui-border)] p-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <strong>หัวจ่าย {row.nozzleNumber}</strong>
                                        {type === 'end' && row.startReading > 0 && row.endReading > 0 && (
                                            <span className="text-xs text-[var(--ui-text-muted)]">ขาย {formatNumber(row.endReading - row.startReading)} L</span>
                                        )}
                                    </div>
                                    <label className="mt-3 block text-xs font-semibold text-[var(--ui-text-muted)]">
                                        เลขมิเตอร์{type === 'start' ? 'เริ่มต้น' : 'สิ้นสุด'}
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.001"
                                            inputMode="decimal"
                                            value={reading}
                                            onChange={(event) => updateReading(row.nozzleNumber, event.target.value)}
                                            disabled={!shiftId || saving}
                                            className="mt-1 min-h-11 w-full rounded-[var(--ui-radius-md)] border border-[var(--ui-border-strong)] bg-[var(--ui-surface)] px-3 text-right text-lg font-semibold tabular-nums disabled:opacity-50 focus-visible:outline-none focus-visible:shadow-[var(--ui-shadow-focus)]"
                                        />
                                    </label>
                                    <div className="mt-3 flex flex-wrap items-center gap-2">
                                        {photo ? (
                                            <a
                                                href={photo}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="inline-flex min-h-10 items-center gap-2 rounded-[var(--ui-radius-md)] border border-[var(--ui-border-strong)] px-3 text-xs font-semibold hover:bg-[var(--ui-surface-subtle)] focus-visible:outline-none focus-visible:shadow-[var(--ui-shadow-focus)]"
                                            >
                                                ดูรูปเดิม <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                                            </a>
                                        ) : (
                                            <span className="text-xs font-semibold text-[var(--ui-warning-text)]">ยังไม่มีรูป</span>
                                        )}
                                        <label className={`inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-[var(--ui-radius-md)] border border-[var(--ui-border-strong)] px-3 text-xs font-semibold ${!shiftId || uploadingKey ? 'pointer-events-none opacity-50' : 'hover:bg-[var(--ui-surface-subtle)]'}`}>
                                            <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                                            {uploadingKey === uploadKey ? 'กำลังอัปโหลด…' : photo ? 'เปลี่ยนรูป' : 'อัปโหลดรูป'}
                                            <input
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                disabled={!shiftId || Boolean(uploadingKey)}
                                                onChange={(event) => {
                                                    const file = event.target.files?.[0];
                                                    event.currentTarget.value = '';
                                                    if (file) void uploadPhoto(row.nozzleNumber, file);
                                                }}
                                            />
                                        </label>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {error && <Notice tone="danger" title="ทำรายการไม่สำเร็จ">{error}</Notice>}
                {message && <Notice tone="success" title="สถานะ">{message}</Notice>}

                <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => void load()} disabled={loading || saving || Boolean(uploadingKey)}>
                        <RefreshCw className="h-4 w-4" aria-hidden="true" /> โหลดใหม่
                    </Button>
                    <Button onClick={() => void save()} disabled={!record || !shiftId || saving || loading || Boolean(uploadingKey)} loading={saving}>
                        <Save className="h-4 w-4" aria-hidden="true" /> บันทึกมิเตอร์{type === 'start' ? 'เริ่มต้น' : 'สิ้นสุด'}
                    </Button>
                </div>
            </div>
        </Section>
    );
}
