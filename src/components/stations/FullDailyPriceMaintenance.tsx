'use client';

import * as React from 'react';
import { RefreshCw, Save } from 'lucide-react';
import { Button, Notice, Section } from '@/components/ui';
import type { StationContextPayload } from '@/types/station';

type DailyPriceRecord = {
    id: string;
    date: string;
    status: string;
    retailPrice: number;
    wholesalePrice: number;
};

type DailyPriceResponse = {
    dailyRecord: DailyPriceRecord | null;
};

function parsePositivePrice(value: string) {
    const parsed = Number(value.trim().replace(/,/g, ''));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function FullDailyPriceMaintenance({
    context,
    onSaved,
}: {
    context: StationContextPayload;
    onSaved: () => Promise<void>;
}) {
    const today = context.saleContext?.businessDate || new Date().toISOString().slice(0, 10);
    const [selectedDate, setSelectedDate] = React.useState(today);
    const [record, setRecord] = React.useState<DailyPriceRecord | null>(null);
    const [retailPrice, setRetailPrice] = React.useState('');
    const [wholesalePrice, setWholesalePrice] = React.useState('');
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [message, setMessage] = React.useState<string | null>(null);

    const load = React.useCallback(async () => {
        setLoading(true);
        setError(null);
        setMessage(null);
        try {
            const response = await fetch(`/api/station/${context.station.number}/daily?date=${selectedDate}`, { cache: 'no-store' });
            const payload = await response.json().catch(() => null) as DailyPriceResponse | { error?: string } | null;
            if (!response.ok) throw new Error(payload && 'error' in payload ? payload.error || 'โหลดราคาไม่สำเร็จ' : 'โหลดราคาไม่สำเร็จ');
            const dailyRecord = payload && 'dailyRecord' in payload ? payload.dailyRecord : null;
            setRecord(dailyRecord);
            setRetailPrice(dailyRecord ? String(dailyRecord.retailPrice) : '');
            setWholesalePrice(dailyRecord ? String(dailyRecord.wholesalePrice) : '');
        } catch (loadError) {
            setRecord(null);
            setRetailPrice('');
            setWholesalePrice('');
            setError(loadError instanceof Error ? loadError.message : 'โหลดราคาไม่สำเร็จ');
        } finally {
            setLoading(false);
        }
    }, [context.station.number, selectedDate]);

    React.useEffect(() => {
        void load();
    }, [load]);

    const retail = parsePositivePrice(retailPrice);
    const wholesale = parsePositivePrice(wholesalePrice);
    const canSave = Boolean(record && retail !== null && wholesale !== null && !saving && !loading);

    const save = async () => {
        if (!record || retail === null || wholesale === null) return;
        setSaving(true);
        setError(null);
        setMessage(null);
        try {
            const response = await fetch(`/api/station/${context.station.number}/daily`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date: selectedDate,
                    retailPrice: retail,
                    wholesalePrice: wholesale,
                }),
            });
            const payload = await response.json().catch(() => null) as { error?: string } | null;
            if (!response.ok) throw new Error(payload?.error || 'บันทึกราคาไม่สำเร็จ');
            setMessage('บันทึกราคาประจำวันแล้ว');
            await load();
            if (selectedDate === today) await onSaved();
        } catch (saveError) {
            setError(saveError instanceof Error ? saveError.message : 'บันทึกราคาไม่สำเร็จ');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Section
            title="แก้ราคาประจำวัน (แอดมิน)"
            description="แก้ retail / wholesale ของ DailyRecord ที่มีอยู่แล้ว โดยเลือกวันที่ย้อนหลังได้"
        >
            <div className="space-y-4">
                <Notice tone="info" title="ไม่คำนวณรายการขายย้อนหลังใหม่">
                    การแก้ราคาตรงนี้เปลี่ยนราคาประจำวันของกะ/วันนั้นเท่านั้น รายการขายที่บันทึกแล้วจะคง pricePerLiter และ amount เดิมเพื่อรักษาหลักฐานทางการเงิน
                </Notice>

                <div className="grid gap-3 md:grid-cols-3">
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
                    <label className="text-sm font-semibold text-[var(--ui-text)]">
                        ราคาปลีก (บาท/ลิตร)
                        <input
                            type="number"
                            min="0"
                            step="0.01"
                            inputMode="decimal"
                            value={retailPrice}
                            onChange={(event) => setRetailPrice(event.target.value)}
                            disabled={!record || loading}
                            className="mt-1 min-h-11 w-full rounded-[var(--ui-radius-md)] border border-[var(--ui-border-strong)] bg-[var(--ui-surface)] px-3 font-normal tabular-nums disabled:opacity-50 focus-visible:outline-none focus-visible:shadow-[var(--ui-shadow-focus)]"
                        />
                    </label>
                    <label className="text-sm font-semibold text-[var(--ui-text)]">
                        ราคาส่ง (บาท/ลิตร)
                        <input
                            type="number"
                            min="0"
                            step="0.01"
                            inputMode="decimal"
                            value={wholesalePrice}
                            onChange={(event) => setWholesalePrice(event.target.value)}
                            disabled={!record || loading}
                            className="mt-1 min-h-11 w-full rounded-[var(--ui-radius-md)] border border-[var(--ui-border-strong)] bg-[var(--ui-surface)] px-3 font-normal tabular-nums disabled:opacity-50 focus-visible:outline-none focus-visible:shadow-[var(--ui-shadow-focus)]"
                        />
                    </label>
                </div>

                {loading ? (
                    <div className="text-sm text-[var(--ui-text-muted)]">กำลังโหลดราคา…</div>
                ) : !record ? (
                    <Notice tone="warning" title="ไม่พบ DailyRecord ของวันที่เลือก">
                        หน้า correction นี้จะไม่สร้างวันย้อนหลังใหม่ หากเป็นวันปัจจุบันให้ตั้งราคาผ่านขั้นตอนเปิดกะตามปกติ
                    </Notice>
                ) : (
                    <div className="text-xs text-[var(--ui-text-muted)]">
                        DailyRecord {record.id} · สถานะ {record.status}
                    </div>
                )}

                {error && <Notice tone="danger" title="ทำรายการไม่สำเร็จ">{error}</Notice>}
                {message && <Notice tone="success" title="บันทึกสำเร็จ">{message}</Notice>}

                <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => void load()} disabled={loading || saving}>
                        <RefreshCw className="h-4 w-4" aria-hidden="true" /> โหลดใหม่
                    </Button>
                    <Button onClick={() => void save()} disabled={!canSave} loading={saving}>
                        <Save className="h-4 w-4" aria-hidden="true" /> บันทึกราคา
                    </Button>
                </div>
            </div>
        </Section>
    );
}
