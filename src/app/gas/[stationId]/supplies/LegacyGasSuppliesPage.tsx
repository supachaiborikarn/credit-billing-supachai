'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    AlertCircle,
    ArrowLeft,
    CheckCircle,
    Loader2,
    PackagePlus,
    Receipt,
    RefreshCcw,
    Save,
    Truck,
} from 'lucide-react';
import { formatCurrency, getTodayBangkok } from '@/lib/gas';

interface GasSupply {
    id: string;
    date: string;
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

const EMPTY_SUMMARY: SupplySummary = {
    totalLiters: 0,
    totalCost: 0,
    count: 0,
    averageCostPerLiter: null,
};

function getDefaultFromDate() {
    const date = new Date();
    date.setDate(date.getDate() - 14);
    return date.toISOString().split('T')[0];
}

function normalizeNumericInput(value: string) {
    return value.replace(/,/g, '').trim();
}

function getFormNumber(value: string) {
    const parsed = Number(normalizeNumericInput(value));
    return Number.isFinite(parsed) ? parsed : null;
}

export default function GasSuppliesPage() {
    const params = useParams();
    const router = useRouter();
    const stationId = params.stationId as string;

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [supplies, setSupplies] = useState<GasSupply[]>([]);
    const [summary, setSummary] = useState<SupplySummary>(EMPTY_SUMMARY);
    const [fromDate, setFromDate] = useState(getDefaultFromDate);
    const [toDate, setToDate] = useState(getTodayBangkok);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const [form, setForm] = useState({
        dateKey: getTodayBangkok(),
        liters: '',
        supplier: '',
        invoiceNo: '',
        pricePerLiter: '',
        totalCost: '',
        notes: '',
    });

    const estimatedTotalCost = (() => {
        const liters = getFormNumber(form.liters);
        const price = getFormNumber(form.pricePerLiter);
        if (liters === null || price === null || liters <= 0 || price < 0) return null;
        return liters * price;
    })();

    const loadSupplies = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                from: fromDate,
                to: toDate,
            });
            const res = await fetch(`/api/v2/gas/${stationId}/supplies?${params}`);
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data.error || 'โหลดข้อมูลรับแก๊สไม่สำเร็จ');
            }
            setSupplies(data.supplies || []);
            setSummary(data.summary || EMPTY_SUMMARY);
        } catch (error) {
            setMessage({
                type: 'error',
                text: error instanceof Error ? error.message : 'โหลดข้อมูลรับแก๊สไม่สำเร็จ',
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadSupplies();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [stationId, fromDate, toDate]);

    const updateForm = (field: keyof typeof form, value: string) => {
        setForm((current) => ({ ...current, [field]: value }));
    };

    const handleSubmit = async () => {
        setMessage(null);

        const liters = getFormNumber(form.liters);
        if (liters === null || liters <= 0) {
            setMessage({ type: 'error', text: 'กรุณากรอกจำนวนลิตรรับเข้าให้มากกว่า 0' });
            return;
        }

        setSaving(true);
        try {
            const res = await fetch(`/api/v2/gas/${stationId}/supplies`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...form,
                    liters,
                    pricePerLiter: getFormNumber(form.pricePerLiter),
                    totalCost: getFormNumber(form.totalCost) ?? estimatedTotalCost,
                }),
            });
            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                throw new Error(data.error || 'บันทึกรับแก๊สไม่สำเร็จ');
            }

            setMessage({ type: 'success', text: 'บันทึกรับแก๊สเข้าถังเรียบร้อย' });
            setForm({
                dateKey: getTodayBangkok(),
                liters: '',
                supplier: '',
                invoiceNo: '',
                pricePerLiter: '',
                totalCost: '',
                notes: '',
            });
            await loadSupplies();
        } catch (error) {
            setMessage({
                type: 'error',
                text: error instanceof Error ? error.message : 'บันทึกรับแก๊สไม่สำเร็จ',
            });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <button
                    onClick={() => router.push(`/gas/${stationId}`)}
                    className="inline-flex items-center gap-2 text-gray-400 hover:text-white"
                >
                    <ArrowLeft size={18} />
                    กลับหน้าหลัก
                </button>

                <button
                    onClick={() => void loadSupplies()}
                    className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-200 hover:bg-white/10"
                >
                    <RefreshCcw size={16} />
                    รีเฟรช
                </button>
            </div>

            <div className="rounded-3xl border border-orange-500/20 bg-gradient-to-br from-orange-950/60 via-[#171720] to-[#101015] p-6 shadow-2xl">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-4">
                        <div className="rounded-2xl bg-orange-500/15 p-4 text-orange-300">
                            <PackagePlus size={30} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold">สั่ง/ลงแก๊สเข้าถัง</h1>
                            <p className="mt-1 text-sm text-orange-100/70">
                                บันทึกใบส่งแก๊ส จำนวนลิตร ต้นทุน และซัพพลายเออร์ เพื่อให้ผู้จัดการเห็นประวัติเติมสต็อก
                            </p>
                        </div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-right">
                        <div className="text-xs text-gray-400">ช่วงที่แสดง</div>
                        <div className="font-mono text-sm text-orange-100">{fromDate} ถึง {toDate}</div>
                    </div>
                </div>
            </div>

            {message && (
                <div className={`rounded-2xl border p-4 text-sm ${
                    message.type === 'success'
                        ? 'border-green-500/30 bg-green-500/10 text-green-200'
                        : 'border-red-500/30 bg-red-500/10 text-red-200'
                }`}>
                    <div className="flex items-center gap-2">
                        {message.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                        <span>{message.text}</span>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <div className="rounded-2xl border border-white/10 bg-[#1a1a24] p-4">
                    <div className="text-sm text-gray-400">รับเข้า</div>
                    <div className="mt-1 text-2xl font-bold text-orange-300">{summary.totalLiters.toLocaleString()} L</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-[#1a1a24] p-4">
                    <div className="text-sm text-gray-400">มูลค่าต้นทุน</div>
                    <div className="mt-1 text-2xl font-bold text-blue-300">฿{formatCurrency(summary.totalCost)}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-[#1a1a24] p-4">
                    <div className="text-sm text-gray-400">จำนวนใบส่ง</div>
                    <div className="mt-1 text-2xl font-bold text-green-300">{summary.count}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-[#1a1a24] p-4">
                    <div className="text-sm text-gray-400">ทุนเฉลี่ย</div>
                    <div className="mt-1 text-2xl font-bold text-cyan-300">
                        {summary.averageCostPerLiter !== null ? `฿${formatCurrency(summary.averageCostPerLiter)}` : '-'}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.1fr]">
                <section className="rounded-3xl border border-white/10 bg-[#1a1a24] p-5">
                    <div className="mb-4 flex items-center gap-2">
                        <Truck className="text-orange-300" size={20} />
                        <h2 className="text-lg font-semibold">บันทึกรับแก๊ส</h2>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="mb-1 block text-sm text-gray-400">วันที่ลงแก๊ส</label>
                            <input
                                type="date"
                                value={form.dateKey}
                                onChange={(e) => updateForm('dateKey', e.target.value)}
                                className="w-full rounded-xl border border-white/10 bg-gray-800 px-4 py-3 outline-none focus:border-orange-400"
                            />
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div>
                                <label className="mb-1 block text-sm text-gray-400">จำนวนลิตรรับเข้า</label>
                                <input
                                    value={form.liters}
                                    onChange={(e) => updateForm('liters', e.target.value)}
                                    inputMode="decimal"
                                    placeholder="เช่น 1,000"
                                    className="w-full rounded-xl border border-white/10 bg-gray-800 px-4 py-3 text-right font-mono outline-none focus:border-orange-400"
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-sm text-gray-400">ราคาทุน/ลิตร</label>
                                <input
                                    value={form.pricePerLiter}
                                    onChange={(e) => updateForm('pricePerLiter', e.target.value)}
                                    inputMode="decimal"
                                    placeholder="ไม่บังคับ"
                                    className="w-full rounded-xl border border-white/10 bg-gray-800 px-4 py-3 text-right font-mono outline-none focus:border-orange-400"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="mb-1 block text-sm text-gray-400">ยอดรวมต้นทุน</label>
                            <input
                                value={form.totalCost}
                                onChange={(e) => updateForm('totalCost', e.target.value)}
                                inputMode="decimal"
                                placeholder={estimatedTotalCost !== null ? `คำนวณได้ ฿${formatCurrency(estimatedTotalCost)}` : 'ไม่บังคับ'}
                                className="w-full rounded-xl border border-white/10 bg-gray-800 px-4 py-3 text-right font-mono outline-none focus:border-orange-400"
                            />
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div>
                                <label className="mb-1 block text-sm text-gray-400">ซัพพลายเออร์</label>
                                <input
                                    value={form.supplier}
                                    onChange={(e) => updateForm('supplier', e.target.value)}
                                    placeholder="ชื่อผู้ส่งแก๊ส"
                                    className="w-full rounded-xl border border-white/10 bg-gray-800 px-4 py-3 outline-none focus:border-orange-400"
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-sm text-gray-400">เลขใบส่ง/ใบกำกับ</label>
                                <input
                                    value={form.invoiceNo}
                                    onChange={(e) => updateForm('invoiceNo', e.target.value)}
                                    placeholder="ถ้ามี"
                                    className="w-full rounded-xl border border-white/10 bg-gray-800 px-4 py-3 outline-none focus:border-orange-400"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="mb-1 block text-sm text-gray-400">หมายเหตุ</label>
                            <textarea
                                value={form.notes}
                                onChange={(e) => updateForm('notes', e.target.value)}
                                placeholder="เช่น ลงถังหลัก / รอบเช้า / รถส่ง..."
                                rows={3}
                                className="w-full rounded-xl border border-white/10 bg-gray-800 px-4 py-3 outline-none focus:border-orange-400"
                            />
                        </div>

                        <button
                            onClick={() => void handleSubmit()}
                            disabled={saving}
                            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-red-500 px-5 py-4 font-bold text-white shadow-lg shadow-orange-950/30 transition hover:from-orange-600 hover:to-red-600 disabled:opacity-60"
                        >
                            {saving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                            บันทึกรับแก๊สเข้าถัง
                        </button>
                    </div>
                </section>

                <section className="rounded-3xl border border-white/10 bg-[#1a1a24] p-5">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <Receipt className="text-blue-300" size={20} />
                            <h2 className="text-lg font-semibold">ประวัติรับเข้า</h2>
                        </div>
                        <div className="flex gap-2 text-sm">
                            <input
                                type="date"
                                value={fromDate}
                                onChange={(e) => setFromDate(e.target.value)}
                                className="rounded-lg border border-white/10 bg-gray-800 px-3 py-2"
                            />
                            <input
                                type="date"
                                value={toDate}
                                onChange={(e) => setToDate(e.target.value)}
                                className="rounded-lg border border-white/10 bg-gray-800 px-3 py-2"
                            />
                        </div>
                    </div>

                    {loading ? (
                        <div className="flex min-h-64 items-center justify-center">
                            <Loader2 className="animate-spin text-orange-400" size={34} />
                        </div>
                    ) : supplies.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-gray-500">
                            ยังไม่มีประวัติรับแก๊สในช่วงนี้
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {supplies.map((supply) => (
                                <div key={supply.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <div className="font-semibold text-white">{supply.displayDate}</div>
                                            <div className="mt-1 text-sm text-gray-400">
                                                {supply.supplier || 'ไม่ระบุผู้ส่ง'} {supply.invoiceNo ? `• ใบส่ง ${supply.invoiceNo}` : ''}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-mono text-xl font-bold text-orange-300">{supply.liters.toLocaleString()} L</div>
                                            <div className="text-xs text-gray-500">
                                                {supply.pricePerLiter !== null ? `฿${formatCurrency(supply.pricePerLiter)}/L` : 'ไม่ระบุทุน'}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-400">
                                        <span>รวม ฿{formatCurrency(supply.totalCost || 0)}</span>
                                        <span>บันทึก {new Date(supply.createdAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                    {supply.notes && (
                                        <div className="mt-3 rounded-xl bg-white/5 px-3 py-2 text-sm text-gray-300">
                                            {supply.notes}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}
