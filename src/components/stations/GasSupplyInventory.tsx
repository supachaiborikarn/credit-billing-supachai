'use client';

import * as React from 'react';
import { Loader2, PackagePlus, Receipt, RefreshCcw, Save, Truck } from 'lucide-react';
import { EmptyState, Notice, Section } from '@/components/ui';
import { formatCurrency, getTodayBangkok } from '@/lib/gas';
import type { StationContextPayload } from '@/types/station';

interface GasSupply {
    id: string;
    displayDate: string;
    liters: number;
    supplier: string | null;
    invoiceNo: string | null;
    pricePerLiter: number | null;
    totalCost: number | null;
    notes: string | null;
    createdAt: string;
}

interface SupplySummary {
    totalLiters: number;
    totalCost: number;
    count: number;
    averageCostPerLiter: number | null;
}

const EMPTY_SUMMARY: SupplySummary = { totalLiters: 0, totalCost: 0, count: 0, averageCostPerLiter: null };
const CONTROL = 'min-h-11 w-full rounded-[var(--ui-radius-md)] border border-[var(--ui-border-strong)] bg-[var(--ui-surface)] px-3 py-2 text-[var(--ui-text)] outline-none focus-visible:shadow-[var(--ui-shadow-focus)] disabled:cursor-not-allowed disabled:opacity-60';

function getDefaultFromDate() {
    const date = new Date();
    date.setDate(date.getDate() - 14);
    return date.toISOString().split('T')[0];
}

function getFormNumber(value: string) {
    const parsed = Number(value.replace(/,/g, '').trim());
    return Number.isFinite(parsed) ? parsed : null;
}

export function GasSupplyInventory({
    context,
    writeBlocked,
}: {
    context: StationContextPayload;
    writeBlocked: boolean;
}) {
    const stationNumber = context.station.number;
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const [supplies, setSupplies] = React.useState<GasSupply[]>([]);
    const [summary, setSummary] = React.useState<SupplySummary>(EMPTY_SUMMARY);
    const [fromDate, setFromDate] = React.useState(getDefaultFromDate);
    const [toDate, setToDate] = React.useState(getTodayBangkok);
    const [message, setMessage] = React.useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
    const [form, setForm] = React.useState({
        dateKey: getTodayBangkok(), liters: '', supplier: '', invoiceNo: '', pricePerLiter: '', totalCost: '', notes: '',
    });

    const estimatedTotalCost = React.useMemo(() => {
        const liters = getFormNumber(form.liters);
        const price = getFormNumber(form.pricePerLiter);
        return liters !== null && price !== null && liters > 0 && price >= 0 ? liters * price : null;
    }, [form.liters, form.pricePerLiter]);

    const load = React.useCallback(async () => {
        setLoading(true);
        try {
            const query = new URLSearchParams({ from: fromDate, to: toDate });
            const response = await fetch(`/api/v2/gas/${stationNumber}/supplies?${query}`, { cache: 'no-store' });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.error || 'โหลดข้อมูลรับแก๊สไม่สำเร็จ');
            setSupplies(payload.supplies || []);
            setSummary(payload.summary || EMPTY_SUMMARY);
        } catch (error) {
            setMessage({ tone: 'danger', text: error instanceof Error ? error.message : 'โหลดข้อมูลรับแก๊สไม่สำเร็จ' });
        } finally {
            setLoading(false);
        }
    }, [fromDate, stationNumber, toDate]);

    React.useEffect(() => { void load(); }, [load]);

    const updateForm = (field: keyof typeof form, value: string) => setForm((current) => ({ ...current, [field]: value }));

    const save = async () => {
        const liters = getFormNumber(form.liters);
        if (liters === null || liters <= 0) {
            setMessage({ tone: 'danger', text: 'กรุณากรอกจำนวนลิตรรับเข้าให้มากกว่า 0' });
            return;
        }
        setSaving(true);
        setMessage(null);
        try {
            const response = await fetch(`/api/v2/gas/${stationNumber}/supplies`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...form,
                    liters,
                    pricePerLiter: getFormNumber(form.pricePerLiter),
                    totalCost: getFormNumber(form.totalCost) ?? estimatedTotalCost,
                }),
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.error || 'บันทึกรับแก๊สไม่สำเร็จ');
            setMessage({ tone: 'success', text: 'บันทึกรับแก๊สเข้าถังเรียบร้อย' });
            setForm({ dateKey: getTodayBangkok(), liters: '', supplier: '', invoiceNo: '', pricePerLiter: '', totalCost: '', notes: '' });
            await load();
        } catch (error) {
            setMessage({ tone: 'danger', text: error instanceof Error ? error.message : 'บันทึกรับแก๊สไม่สำเร็จ' });
        } finally {
            setSaving(false);
        }
    };

    if (context.station.type !== 'GAS' || context.station.operationalStatus !== 'ACTIVE') {
        return <Notice tone="info" title="ไม่มี inventory สำหรับสถานีนี้">หน้ารับ LPG ใช้เฉพาะสถานี GAS ที่เปิดใช้งาน</Notice>;
    }

    return (
        <div className="space-y-4">
            <Section title="รับ LPG เข้าถัง" description="บันทึกจำนวนลิตร ต้นทุน ซัพพลายเออร์ เลขใบส่ง และประวัติรับเข้า โดยใช้ API/AuditLog เดิม">
                <div className="space-y-4">
                    {writeBlocked && <Notice tone="warning" title="กำลังตรวจสิทธิ์และสถานะสถานี">บล็อกการบันทึกไว้จน StationContext รีเฟรชสำเร็จ</Notice>}
                    {message && <Notice tone={message.tone} title={message.tone === 'success' ? 'บันทึกแล้ว' : 'ทำรายการไม่สำเร็จ'}>{message.text}</Notice>}
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="rounded-[var(--ui-radius-md)] border border-[var(--ui-border)] p-3"><div className="text-xs text-[var(--ui-text-muted)]">รับเข้า</div><div className="mt-1 text-xl font-bold">{summary.totalLiters.toLocaleString()} L</div></div>
                        <div className="rounded-[var(--ui-radius-md)] border border-[var(--ui-border)] p-3"><div className="text-xs text-[var(--ui-text-muted)]">ต้นทุนรวม</div><div className="mt-1 text-xl font-bold">฿{formatCurrency(summary.totalCost)}</div></div>
                        <div className="rounded-[var(--ui-radius-md)] border border-[var(--ui-border)] p-3"><div className="text-xs text-[var(--ui-text-muted)]">จำนวนใบส่ง</div><div className="mt-1 text-xl font-bold">{summary.count}</div></div>
                        <div className="rounded-[var(--ui-radius-md)] border border-[var(--ui-border)] p-3"><div className="text-xs text-[var(--ui-text-muted)]">ทุนเฉลี่ย/ลิตร</div><div className="mt-1 text-xl font-bold">{summary.averageCostPerLiter === null ? '-' : `฿${formatCurrency(summary.averageCostPerLiter)}`}</div></div>
                    </div>
                    <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
                        <div className="space-y-3 rounded-[var(--ui-radius-lg)] border border-[var(--ui-border)] p-4">
                            <div className="flex items-center gap-2 font-bold"><Truck className="h-4 w-4" aria-hidden="true" /> บันทึกรับแก๊ส</div>
                            <label className="block text-sm font-semibold">วันที่ลงแก๊ส<input type="date" className={`${CONTROL} mt-1`} value={form.dateKey} disabled={writeBlocked || saving} onChange={(e) => updateForm('dateKey', e.target.value)} /></label>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <label className="block text-sm font-semibold">จำนวนลิตร<input inputMode="decimal" className={`${CONTROL} mt-1 text-right font-mono`} value={form.liters} disabled={writeBlocked || saving} placeholder="เช่น 1,000" onChange={(e) => updateForm('liters', e.target.value)} /></label>
                                <label className="block text-sm font-semibold">ราคาทุน/ลิตร<input inputMode="decimal" className={`${CONTROL} mt-1 text-right font-mono`} value={form.pricePerLiter} disabled={writeBlocked || saving} placeholder="ไม่บังคับ" onChange={(e) => updateForm('pricePerLiter', e.target.value)} /></label>
                            </div>
                            <label className="block text-sm font-semibold">ยอดรวมต้นทุน<input inputMode="decimal" className={`${CONTROL} mt-1 text-right font-mono`} value={form.totalCost} disabled={writeBlocked || saving} placeholder={estimatedTotalCost === null ? 'ไม่บังคับ' : `คำนวณได้ ฿${formatCurrency(estimatedTotalCost)}`} onChange={(e) => updateForm('totalCost', e.target.value)} /></label>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <label className="block text-sm font-semibold">ซัพพลายเออร์<input className={`${CONTROL} mt-1`} value={form.supplier} disabled={writeBlocked || saving} onChange={(e) => updateForm('supplier', e.target.value)} /></label>
                                <label className="block text-sm font-semibold">เลขใบส่ง/ใบกำกับ<input className={`${CONTROL} mt-1`} value={form.invoiceNo} disabled={writeBlocked || saving} onChange={(e) => updateForm('invoiceNo', e.target.value)} /></label>
                            </div>
                            <label className="block text-sm font-semibold">หมายเหตุ<textarea rows={3} className={`${CONTROL} mt-1`} value={form.notes} disabled={writeBlocked || saving} onChange={(e) => updateForm('notes', e.target.value)} /></label>
                            <button type="button" disabled={writeBlocked || saving} onClick={() => void save()} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[var(--ui-radius-md)] bg-[var(--ui-primary-700)] px-4 font-semibold text-white hover:bg-[var(--ui-primary-800)] focus-visible:outline-none focus-visible:shadow-[var(--ui-shadow-focus)] disabled:cursor-not-allowed disabled:opacity-60">
                                {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />} บันทึกรับแก๊สเข้าถัง
                            </button>
                        </div>
                        <div className="space-y-3 rounded-[var(--ui-radius-lg)] border border-[var(--ui-border)] p-4">
                            <div className="flex flex-wrap items-end justify-between gap-3">
                                <div className="flex items-center gap-2 font-bold"><Receipt className="h-4 w-4" aria-hidden="true" /> ประวัติรับเข้า</div>
                                <button type="button" onClick={() => void load()} className="inline-flex min-h-11 items-center gap-2 rounded-[var(--ui-radius-md)] border border-[var(--ui-border)] px-3 text-sm font-semibold hover:bg-[var(--ui-surface-subtle)]"><RefreshCcw className="h-4 w-4" aria-hidden="true" /> รีเฟรช</button>
                            </div>
                            <div className="grid gap-2 sm:grid-cols-2">
                                <label className="text-xs font-semibold text-[var(--ui-text-muted)]">จาก<input type="date" className={`${CONTROL} mt-1`} value={fromDate} onChange={(e) => setFromDate(e.target.value)} /></label>
                                <label className="text-xs font-semibold text-[var(--ui-text-muted)]">ถึง<input type="date" className={`${CONTROL} mt-1`} value={toDate} onChange={(e) => setToDate(e.target.value)} /></label>
                            </div>
                            {loading ? <div className="flex min-h-40 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin" aria-hidden="true" /></div> : supplies.length === 0 ? <EmptyState title="ยังไม่มีประวัติรับแก๊ส" description="ไม่พบรายการในช่วงวันที่เลือก" icon={PackagePlus} /> : (
                                <div className="space-y-2">
                                    {supplies.map((supply) => <div key={supply.id} className="rounded-[var(--ui-radius-md)] border border-[var(--ui-border)] p-3">
                                        <div className="flex items-start justify-between gap-3"><div><div className="font-semibold">{supply.displayDate}</div><div className="mt-1 text-sm text-[var(--ui-text-muted)]">{supply.supplier || 'ไม่ระบุผู้ส่ง'}{supply.invoiceNo ? ` · ใบส่ง ${supply.invoiceNo}` : ''}</div></div><div className="text-right"><div className="font-mono text-lg font-bold">{supply.liters.toLocaleString()} L</div><div className="text-xs text-[var(--ui-text-muted)]">{supply.pricePerLiter === null ? 'ไม่ระบุทุน' : `฿${formatCurrency(supply.pricePerLiter)}/L`}</div></div></div>
                                        <div className="mt-2 flex flex-wrap gap-3 text-xs text-[var(--ui-text-muted)]"><span>รวม ฿{formatCurrency(supply.totalCost || 0)}</span><span>บันทึก {new Date(supply.createdAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</span></div>
                                        {supply.notes && <div className="mt-2 rounded-[var(--ui-radius-sm)] bg-[var(--ui-surface-subtle)] px-3 py-2 text-sm">{supply.notes}</div>}
                                    </div>)}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </Section>
        </div>
    );
}
