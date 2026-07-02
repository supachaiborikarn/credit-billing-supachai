'use client';

import { useEffect, useState } from 'react';
import {
    Download,
    Loader2,
    PackagePlus,
    Pencil,
    RefreshCcw,
    Save,
    Search,
    Trash2,
    Truck,
    X,
} from 'lucide-react';
import { formatCurrency, getTodayBangkok } from '@/lib/gas';
import { STATIONS } from '@/constants';

interface SupplyGaugeCheck {
    dateKey: string;
    stationId: string;
    startLiters: number | null;
    endLiters: number | null;
    soldLiters: number;
    estimatedReceivedLiters: number | null;
    invoiceLitersSameDay: number;
    supplyCountSameDay: number;
    diffLiters: number | null;
    diffPercent: number | null;
    status: 'OK' | 'WARN' | 'NO_GAUGE';
}

interface StockForecast {
    stationId: string;
    stationName: string;
    currentStockLiters: number | null;
    capacityLiters: number;
    latestGaugeDateKey: string | null;
    avgDailySoldLiters: number | null;
    daysLeft: number | null;
    projectedEmptyDateKey: string | null;
    stockAlertLiters: number | null;
    lowStock: boolean;
}

interface GasSupply {
    id: string;
    stationId: string;
    stationName: string | null;
    date: string;
    displayDate: string;
    liters: number;
    supplier: string | null;
    invoiceNo: string | null;
    pricePerLiter: number | null;
    totalCost: number | null;
    notes: string | null;
    createdAt: string;
    gaugeCheck?: SupplyGaugeCheck | null;
}

interface SupplySummary {
    totalLiters: number;
    totalCost: number;
    count: number;
    averageCostPerLiter: number | null;
}

interface StationSummary extends SupplySummary {
    stationId: string;
    stationName: string;
}

// รายชื่อปั๊มแก๊สจากค่ากลาง (เพิ่มสาขาใหม่ที่ src/constants ที่เดียว)
const GAS_STATIONS = STATIONS
    .filter((station) => station.type === 'GAS')
    .map((station) => ({ id: station.id, name: station.name }));

const EMPTY_SUMMARY: SupplySummary = {
    totalLiters: 0,
    totalCost: 0,
    count: 0,
    averageCostPerLiter: null,
};

function getDefaultFromDate() {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date.toISOString().split('T')[0];
}

function parseInputNumber(value: string) {
    const parsed = Number(value.replace(/,/g, '').trim());
    return Number.isFinite(parsed) ? parsed : null;
}

export default function AdminGasSuppliesPage() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [supplies, setSupplies] = useState<GasSupply[]>([]);
    const [summary, setSummary] = useState<SupplySummary>(EMPTY_SUMMARY);
    const [stationSummary, setStationSummary] = useState<StationSummary[]>([]);
    const [stockForecasts, setStockForecasts] = useState<StockForecast[]>([]);
    const [stationId, setStationId] = useState('all');
    const [fromDate, setFromDate] = useState(getDefaultFromDate);
    const [toDate, setToDate] = useState(getTodayBangkok);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [form, setForm] = useState({
        stationId: 'station-5',
        dateKey: getTodayBangkok(),
        liters: '',
        supplier: '',
        invoiceNo: '',
        pricePerLiter: '',
        totalCost: '',
        notes: '',
    });

    // รายชื่อซัพพลายเออร์ที่เคยกรอก (autocomplete)
    const supplierOptions = Array.from(
        new Set(supplies.map((s) => s.supplier).filter((s): s is string => Boolean(s)))
    );

    const estimatedTotalCost = (() => {
        const liters = parseInputNumber(form.liters);
        const price = parseInputNumber(form.pricePerLiter);
        if (liters === null || price === null || liters <= 0 || price < 0) return null;
        return liters * price;
    })();

    const loadSupplies = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                from: fromDate,
                to: toDate,
                ...(stationId !== 'all' ? { stationId } : {}),
            });
            const res = await fetch(`/api/v2/gas/admin/supplies?${params}`);
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data.error || 'โหลดข้อมูลรับแก๊สไม่สำเร็จ');
            }
            setSupplies(data.supplies || []);
            setSummary(data.summary || EMPTY_SUMMARY);
            setStationSummary(data.stationSummary || []);
            setStockForecasts(data.stockForecasts || []);
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

    const resetForm = () => {
        setEditingId(null);
        setForm((current) => ({
            ...current,
            dateKey: getTodayBangkok(),
            liters: '',
            supplier: '',
            invoiceNo: '',
            pricePerLiter: '',
            totalCost: '',
            notes: '',
        }));
    };

    const startEdit = (supply: GasSupply) => {
        setEditingId(supply.id);
        setForm({
            stationId: supply.stationId,
            dateKey: supply.date.split('T')[0] || supply.date,
            liters: String(supply.liters),
            supplier: supply.supplier || '',
            invoiceNo: supply.invoiceNo || '',
            pricePerLiter: supply.pricePerLiter !== null ? String(supply.pricePerLiter) : '',
            totalCost: supply.totalCost !== null ? String(supply.totalCost) : '',
            notes: supply.notes || '',
        });
        setMessage(null);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleSubmit = async () => {
        setMessage(null);
        const liters = parseInputNumber(form.liters);
        if (liters === null || liters <= 0) {
            setMessage({ type: 'error', text: 'กรุณากรอกจำนวนลิตรรับเข้าให้มากกว่า 0' });
            return;
        }

        setSaving(true);
        try {
            const url = editingId
                ? `/api/v2/gas/admin/supplies/${editingId}`
                : '/api/v2/gas/admin/supplies';
            const res = await fetch(url, {
                method: editingId ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...form,
                    liters,
                    pricePerLiter: parseInputNumber(form.pricePerLiter),
                    totalCost: parseInputNumber(form.totalCost) ?? estimatedTotalCost,
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data.error || 'บันทึกรับแก๊สไม่สำเร็จ');
            }

            setMessage({
                type: 'success',
                text: editingId ? 'แก้ไขข้อมูลรับแก๊สเรียบร้อย' : 'บันทึกข้อมูลรับแก๊สเรียบร้อย',
            });
            resetForm();
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

    const handleDelete = async (supply: GasSupply) => {
        const confirmed = window.confirm(
            `ลบรายการรับแก๊ส ${supply.displayDate} จำนวน ${supply.liters.toLocaleString()} ลิตร`
            + `${supply.invoiceNo ? ` (ใบส่ง ${supply.invoiceNo})` : ''} ใช่หรือไม่?`
        );
        if (!confirmed) return;

        setDeletingId(supply.id);
        setMessage(null);
        try {
            const res = await fetch(`/api/v2/gas/admin/supplies/${supply.id}`, { method: 'DELETE' });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data.error || 'ลบรายการไม่สำเร็จ');
            }
            if (editingId === supply.id) resetForm();
            setMessage({ type: 'success', text: 'ลบรายการรับแก๊สแล้ว' });
            await loadSupplies();
        } catch (error) {
            setMessage({
                type: 'error',
                text: error instanceof Error ? error.message : 'ลบรายการไม่สำเร็จ',
            });
        } finally {
            setDeletingId(null);
        }
    };

    const handleExportCSV = () => {
        const rows = [
            ['วันที่', 'สถานี', 'ลิตร', 'ซัพพลายเออร์', 'เลขใบส่ง', 'ทุน/ลิตร', 'ต้นทุนรวม', 'หมายเหตุ'],
            ...supplies.map((supply) => [
                supply.date,
                supply.stationName || supply.stationId,
                String(supply.liters),
                supply.supplier || '',
                supply.invoiceNo || '',
                supply.pricePerLiter !== null ? String(supply.pricePerLiter) : '',
                supply.totalCost !== null ? String(supply.totalCost) : '',
                supply.notes || '',
            ]),
        ];
        const csv = rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `gas-supplies-${fromDate}-to-${toDate}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="flex items-center gap-2 text-2xl font-bold">
                        <PackagePlus className="text-orange-400" />
                        สั่ง/ลงแก๊สเข้าถัง
                    </h1>
                    <p className="mt-1 text-sm text-gray-400">
                        ใช้บันทึกใบส่งแก๊สและต้นทุนรับเข้า แยกตามปั๊ม เพื่อประกอบการดูสต็อกและต้นทุน
                    </p>
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={() => void loadSupplies()}
                        className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
                    >
                        <RefreshCcw size={16} />
                        รีเฟรช
                    </button>
                    <button
                        onClick={handleExportCSV}
                        className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm hover:bg-green-500"
                    >
                        <Download size={16} />
                        Export CSV
                    </button>
                </div>
            </div>

            {message && (
                <div className={`rounded-xl border p-4 text-sm ${
                    message.type === 'success'
                        ? 'border-green-500/30 bg-green-500/10 text-green-200'
                        : 'border-red-500/30 bg-red-500/10 text-red-200'
                }`}>
                    {message.text}
                </div>
            )}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <div className="rounded-xl border border-white/10 bg-[#1a1a24] p-4">
                    <div className="text-sm text-gray-400">รับเข้ารวม</div>
                    <div className="mt-1 text-2xl font-bold text-orange-300">{summary.totalLiters.toLocaleString()} L</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-[#1a1a24] p-4">
                    <div className="text-sm text-gray-400">ต้นทุนรวม</div>
                    <div className="mt-1 text-2xl font-bold text-blue-300">฿{formatCurrency(summary.totalCost)}</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-[#1a1a24] p-4">
                    <div className="text-sm text-gray-400">จำนวนใบส่ง</div>
                    <div className="mt-1 text-2xl font-bold text-green-300">{summary.count}</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-[#1a1a24] p-4">
                    <div className="text-sm text-gray-400">ทุนเฉลี่ย</div>
                    <div className="mt-1 text-2xl font-bold text-cyan-300">
                        {summary.averageCostPerLiter !== null ? `฿${formatCurrency(summary.averageCostPerLiter)}` : '-'}
                    </div>
                </div>
            </div>

            {/* คาดการณ์สต็อกคงเหลือจากเกจล่าสุด */}
            {stockForecasts.length > 0 && (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {stockForecasts.map((forecast) => (
                        <div
                            key={forecast.stationId}
                            className={`rounded-xl border p-4 ${forecast.lowStock
                                ? 'border-red-500/40 bg-red-500/10'
                                : 'border-white/10 bg-[#1a1a24]'}`}
                        >
                            <div className="flex items-center justify-between">
                                <div className="font-medium">{forecast.stationName}</div>
                                {forecast.lowStock && (
                                    <span className="rounded-full bg-red-500/20 px-3 py-1 text-xs font-medium text-red-300">
                                        ⚠ ใกล้หมด ควรสั่งแก๊ส
                                    </span>
                                )}
                            </div>
                            {forecast.currentStockLiters !== null ? (
                                <>
                                    <div className="mt-2 flex items-end justify-between">
                                        <div>
                                            <div className="text-xs text-gray-400">
                                                สต็อกโดยประมาณ (เกจ {forecast.latestGaugeDateKey || '-'})
                                            </div>
                                            <div className={`text-2xl font-bold ${forecast.lowStock ? 'text-red-300' : 'text-orange-300'}`}>
                                                {forecast.currentStockLiters.toLocaleString()} L
                                                <span className="ml-1 text-sm font-normal text-gray-500">
                                                    / {forecast.capacityLiters.toLocaleString()} L
                                                </span>
                                            </div>
                                        </div>
                                        <div className="text-right text-sm">
                                            <div className="text-gray-400">
                                                ใช้เฉลี่ย {forecast.avgDailySoldLiters !== null ? `${forecast.avgDailySoldLiters.toLocaleString()} L/วัน` : '-'}
                                            </div>
                                            {forecast.daysLeft !== null && (
                                                <div className={forecast.lowStock ? 'font-semibold text-red-300' : 'text-gray-300'}>
                                                    เหลือ ~{forecast.daysLeft.toLocaleString()} วัน
                                                    {forecast.projectedEmptyDateKey ? ` (หมด ${forecast.projectedEmptyDateKey})` : ''}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-800">
                                        <div
                                            className={`h-full rounded-full ${forecast.lowStock ? 'bg-red-500' : 'bg-orange-500'}`}
                                            style={{
                                                width: `${Math.min(100, Math.max(2, (forecast.currentStockLiters / forecast.capacityLiters) * 100))}%`,
                                            }}
                                        />
                                    </div>
                                </>
                            ) : (
                                <div className="mt-2 text-sm text-gray-500">ยังไม่มีข้อมูลเกจ</div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[400px_1fr]">
                <section className="rounded-xl border border-white/10 bg-[#1a1a24] p-5">
                    <div className="mb-4 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <Truck className="text-orange-300" size={20} />
                            <h2 className="text-lg font-semibold">
                                {editingId ? 'แก้ไขรายการรับเข้า' : 'เพิ่มรายการรับเข้า'}
                            </h2>
                        </div>
                        {editingId && (
                            <button
                                onClick={resetForm}
                                className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10"
                            >
                                <X size={14} />
                                ยกเลิกแก้ไข
                            </button>
                        )}
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="mb-1 block text-sm text-gray-400">ปั๊ม</label>
                            <select
                                value={form.stationId}
                                onChange={(e) => updateForm('stationId', e.target.value)}
                                disabled={Boolean(editingId)}
                                className="w-full rounded-lg border border-white/10 bg-gray-800 px-3 py-2 disabled:opacity-60"
                            >
                                {GAS_STATIONS.map((station) => (
                                    <option key={station.id} value={station.id}>{station.name}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="mb-1 block text-sm text-gray-400">วันที่ลงแก๊ส</label>
                            <input
                                type="date"
                                value={form.dateKey}
                                onChange={(e) => updateForm('dateKey', e.target.value)}
                                className="w-full rounded-lg border border-white/10 bg-gray-800 px-3 py-2"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="mb-1 block text-sm text-gray-400">ลิตร</label>
                                <input
                                    value={form.liters}
                                    onChange={(e) => updateForm('liters', e.target.value)}
                                    inputMode="decimal"
                                    className="w-full rounded-lg border border-white/10 bg-gray-800 px-3 py-2 text-right font-mono"
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-sm text-gray-400">ทุน/ลิตร</label>
                                <input
                                    value={form.pricePerLiter}
                                    onChange={(e) => updateForm('pricePerLiter', e.target.value)}
                                    inputMode="decimal"
                                    className="w-full rounded-lg border border-white/10 bg-gray-800 px-3 py-2 text-right font-mono"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="mb-1 block text-sm text-gray-400">ต้นทุนรวม</label>
                            <input
                                value={form.totalCost}
                                onChange={(e) => updateForm('totalCost', e.target.value)}
                                inputMode="decimal"
                                placeholder={estimatedTotalCost !== null ? `คำนวณได้ ฿${formatCurrency(estimatedTotalCost)}` : 'ไม่บังคับ'}
                                className="w-full rounded-lg border border-white/10 bg-gray-800 px-3 py-2 text-right font-mono"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="mb-1 block text-sm text-gray-400">ซัพพลายเออร์</label>
                                <input
                                    value={form.supplier}
                                    onChange={(e) => updateForm('supplier', e.target.value)}
                                    list="supplier-options"
                                    className="w-full rounded-lg border border-white/10 bg-gray-800 px-3 py-2"
                                />
                                <datalist id="supplier-options">
                                    {supplierOptions.map((name) => (
                                        <option key={name} value={name} />
                                    ))}
                                </datalist>
                            </div>
                            <div>
                                <label className="mb-1 block text-sm text-gray-400">เลขใบส่ง</label>
                                <input
                                    value={form.invoiceNo}
                                    onChange={(e) => updateForm('invoiceNo', e.target.value)}
                                    className="w-full rounded-lg border border-white/10 bg-gray-800 px-3 py-2"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="mb-1 block text-sm text-gray-400">หมายเหตุ</label>
                            <textarea
                                value={form.notes}
                                onChange={(e) => updateForm('notes', e.target.value)}
                                rows={3}
                                className="w-full rounded-lg border border-white/10 bg-gray-800 px-3 py-2"
                            />
                        </div>

                        <button
                            onClick={() => void handleSubmit()}
                            disabled={saving}
                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 py-3 font-semibold hover:bg-orange-500 disabled:opacity-60"
                        >
                            {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                            {editingId ? 'บันทึกการแก้ไข' : 'บันทึก'}
                        </button>
                    </div>
                </section>

                <section className="space-y-4">
                    <div className="rounded-xl border border-white/10 bg-[#1a1a24] p-4">
                        <div className="flex flex-wrap items-end gap-4">
                            <div className="min-w-48 flex-1">
                                <label className="mb-1 block text-sm text-gray-400">ปั๊ม</label>
                                <select
                                    value={stationId}
                                    onChange={(e) => setStationId(e.target.value)}
                                    className="w-full rounded-lg border border-white/10 bg-gray-800 px-3 py-2"
                                >
                                    <option value="all">ทุกปั๊ม</option>
                                    {GAS_STATIONS.map((station) => (
                                        <option key={station.id} value={station.id}>{station.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="mb-1 block text-sm text-gray-400">จากวันที่</label>
                                <input
                                    type="date"
                                    value={fromDate}
                                    onChange={(e) => setFromDate(e.target.value)}
                                    className="rounded-lg border border-white/10 bg-gray-800 px-3 py-2"
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-sm text-gray-400">ถึงวันที่</label>
                                <input
                                    type="date"
                                    value={toDate}
                                    onChange={(e) => setToDate(e.target.value)}
                                    className="rounded-lg border border-white/10 bg-gray-800 px-3 py-2"
                                />
                            </div>
                            <button
                                onClick={() => void loadSupplies()}
                                className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 hover:bg-purple-500"
                            >
                                <Search size={18} />
                                ค้นหา
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        {stationSummary.map((station) => (
                            <div key={station.stationId} className="rounded-xl border border-white/10 bg-[#1a1a24] p-4">
                                <div className="font-medium">{station.stationName}</div>
                                <div className="mt-2 flex flex-wrap gap-4 text-sm text-gray-400">
                                    <span>{station.totalLiters.toLocaleString()} L</span>
                                    <span>฿{formatCurrency(station.totalCost)}</span>
                                    <span>{station.count} ใบส่ง</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="overflow-hidden rounded-xl border border-white/10 bg-[#1a1a24]">
                        {loading ? (
                            <div className="flex min-h-64 items-center justify-center">
                                <Loader2 className="animate-spin text-purple-400" size={32} />
                            </div>
                        ) : supplies.length === 0 ? (
                            <div className="p-12 text-center text-gray-500">ไม่พบข้อมูลรับแก๊ส</div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-800/50">
                                        <tr>
                                            <th className="px-4 py-3 text-left font-medium text-gray-400">วันที่</th>
                                            <th className="px-4 py-3 text-left font-medium text-gray-400">ปั๊ม</th>
                                            <th className="px-4 py-3 text-right font-medium text-gray-400">ลิตร</th>
                                            <th className="px-4 py-3 text-left font-medium text-gray-400">ใบส่ง</th>
                                            <th className="px-4 py-3 text-right font-medium text-gray-400">ทุน/ลิตร</th>
                                            <th className="px-4 py-3 text-right font-medium text-gray-400">ต้นทุนรวม</th>
                                            <th className="px-4 py-3 text-center font-medium text-gray-400">จัดการ</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {supplies.map((supply) => (
                                            <tr key={supply.id} className={`hover:bg-white/5 ${editingId === supply.id ? 'bg-orange-500/10' : ''}`}>
                                                <td className="px-4 py-3">{supply.displayDate}</td>
                                                <td className="px-4 py-3">
                                                    <div>{supply.stationName || supply.stationId}</div>
                                                    <div className="text-xs text-gray-500">{supply.supplier || '-'}</div>
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <div className="font-mono text-orange-300">{supply.liters.toLocaleString()}</div>
                                                    {supply.gaugeCheck && supply.gaugeCheck.status !== 'NO_GAUGE' && (
                                                        <div
                                                            title={`เกจยืนยันรับจริง ~${supply.gaugeCheck.estimatedReceivedLiters?.toLocaleString()} L (Δเกจ ${((supply.gaugeCheck.endLiters ?? 0) - (supply.gaugeCheck.startLiters ?? 0)).toLocaleString()} + ขาย ${supply.gaugeCheck.soldLiters.toLocaleString()})${supply.gaugeCheck.supplyCountSameDay > 1 ? ` เทียบใบส่งรวม ${supply.gaugeCheck.supplyCountSameDay} ใบของวัน` : ''}`}
                                                            className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[11px] ${supply.gaugeCheck.status === 'OK'
                                                                ? 'bg-green-500/15 text-green-300'
                                                                : 'bg-yellow-500/15 text-yellow-300'}`}
                                                        >
                                                            เกจ {supply.gaugeCheck.status === 'OK' ? '✓' : '⚠'}
                                                            {supply.gaugeCheck.diffPercent !== null
                                                                ? ` ${supply.gaugeCheck.diffPercent > 0 ? '+' : ''}${supply.gaugeCheck.diffPercent}%`
                                                                : ''}
                                                        </div>
                                                    )}
                                                    {supply.gaugeCheck && supply.gaugeCheck.status === 'NO_GAUGE' && (
                                                        <div className="mt-0.5 inline-block rounded-full bg-gray-500/15 px-2 py-0.5 text-[11px] text-gray-400" title="วันนั้นบันทึกเกจไม่ครบ จึงเทียบปริมาณรับจริงไม่ได้">
                                                            ไม่มีเกจเทียบ
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3">{supply.invoiceNo || '-'}</td>
                                                <td className="px-4 py-3 text-right font-mono">
                                                    {supply.pricePerLiter !== null ? `฿${formatCurrency(supply.pricePerLiter)}` : '-'}
                                                </td>
                                                <td className="px-4 py-3 text-right font-mono text-blue-300">
                                                    ฿{formatCurrency(supply.totalCost || 0)}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <button
                                                            onClick={() => startEdit(supply)}
                                                            title="แก้ไข"
                                                            className="rounded-lg p-2 text-blue-300 hover:bg-blue-500/10"
                                                        >
                                                            <Pencil size={15} />
                                                        </button>
                                                        <button
                                                            onClick={() => void handleDelete(supply)}
                                                            disabled={deletingId === supply.id}
                                                            title="ลบ"
                                                            className="rounded-lg p-2 text-red-300 hover:bg-red-500/10 disabled:opacity-50"
                                                        >
                                                            {deletingId === supply.id
                                                                ? <Loader2 className="animate-spin" size={15} />
                                                                : <Trash2 size={15} />}
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </section>
            </div>
        </div>
    );
}
