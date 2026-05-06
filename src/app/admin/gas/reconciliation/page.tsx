'use client';

import { useEffect, useState } from 'react';
import { Loader2, Scale, Search, Download, Check, AlertTriangle, Edit3, Save, X } from 'lucide-react';
import { formatCurrency, getTodayBangkok } from '@/lib/gas';

interface ReconciliationRecord {
    id: string;
    date: string;
    displayDate: string;
    stationId: string;
    stationName: string;
    shiftNumber: number;
    staffName: string | null;
    meterSales: number;
    meterLiters: number;
    transactionLiters: number;
    litersVariance: number;
    transactionCount: number;
    cashExpected: number;
    cashReceived: number;
    creditExpected: number;
    creditReceived: number;
    cardExpected: number;
    cardReceived: number;
    transferExpected: number;
    transferReceived: number;
    expectedFuelAmount: number;
    expectedOtherAmount: number;
    nonGasSalesAmount: number;
    otherExpensesAmount: number;
    totalExpected: number;
    totalReceived: number;
    variance: number;
    varianceStatus: 'OVER' | 'SHORT' | 'BALANCED';
    varianceNote?: string | null;
}

async function loadReconciliationRecords({
    fromDate,
    toDate,
    stationId,
    statusFilter,
    setLoading,
    setRecords,
}: {
    fromDate: string;
    toDate: string;
    stationId: string;
    statusFilter: string;
    setLoading: (value: boolean) => void;
    setRecords: (value: ReconciliationRecord[]) => void;
}) {
    setLoading(true);
    try {
        const params = new URLSearchParams({
            from: fromDate,
            to: toDate,
            ...(stationId !== 'all' && { stationId }),
            ...(statusFilter !== 'all' && { status: statusFilter }),
        });

        const res = await fetch(`/api/v2/gas/admin/reconciliation?${params}`);
        if (res.ok) {
            const data = await res.json();
            setRecords(data.records || []);
        }
    } catch (error) {
        console.error('Error fetching reconciliation:', error);
    } finally {
        setLoading(false);
    }
}

function toAmountInput(value: number): string {
    return Number.isFinite(value) ? String(value) : '0';
}

export default function ReconciliationPage() {
    const [loading, setLoading] = useState(true);
    const [records, setRecords] = useState<ReconciliationRecord[]>([]);
    const [editingRecord, setEditingRecord] = useState<ReconciliationRecord | null>(null);
    const [savingEdit, setSavingEdit] = useState(false);
    const [editError, setEditError] = useState<string | null>(null);
    const [editForm, setEditForm] = useState({
        cashReceived: '0',
        creditReceived: '0',
        cardReceived: '0',
        transferReceived: '0',
        nonGasSalesAmount: '0',
        otherExpensesAmount: '0',
        varianceNote: '',
    });
    const [stationId, setStationId] = useState<string>('all');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [fromDate, setFromDate] = useState<string>(() => {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        return d.toISOString().split('T')[0];
    });
    const [toDate, setToDate] = useState<string>(getTodayBangkok());
    const [stations, setStations] = useState<{ id: string; name: string }[]>([]);

    useEffect(() => {
        fetch('/api/stations')
            .then(res => res.json())
            .then(data => {
                const stationList = Array.isArray(data) ? data : (data.stations || []);
                const gasStations = stationList.filter((s: { type?: string }) => s.type === 'GAS');
                setStations(gasStations);
            })
            .catch(console.error);
    }, []);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const queryStationId = params.get('stationId');
        const queryFrom = params.get('from');
        const queryTo = params.get('to');

        if (queryStationId) setStationId(queryStationId);
        if (queryFrom) setFromDate(queryFrom);
        if (queryTo) setToDate(queryTo);
    }, []);

    useEffect(() => {
        void loadReconciliationRecords({
            fromDate,
            toDate,
            stationId,
            statusFilter,
            setLoading,
            setRecords,
        });
    }, [fromDate, toDate, stationId, statusFilter]);

    useEffect(() => {
        if (records.length === 0 || editingRecord) return;

        const params = new URLSearchParams(window.location.search);
        const editShiftId = params.get('editShiftId');
        if (!editShiftId) return;

        const matchedRecord = records.find((record) => record.id === editShiftId);
        if (matchedRecord) {
            openEditModal(matchedRecord);
        }
    }, [records, editingRecord]);

    const openEditModal = (record: ReconciliationRecord) => {
        setEditingRecord(record);
        setEditError(null);
        setEditForm({
            cashReceived: toAmountInput(record.cashReceived),
            creditReceived: toAmountInput(record.creditReceived),
            cardReceived: toAmountInput(record.cardReceived),
            transferReceived: toAmountInput(record.transferReceived),
            nonGasSalesAmount: toAmountInput(record.nonGasSalesAmount),
            otherExpensesAmount: toAmountInput(record.otherExpensesAmount),
            varianceNote: record.varianceNote || '',
        });
    };

    const closeEditModal = () => {
        setEditingRecord(null);
        setEditError(null);
        const url = new URL(window.location.href);
        url.searchParams.delete('editShiftId');
        window.history.replaceState(null, '', `${url.pathname}${url.search}`);
    };

    const setEditField = (field: keyof typeof editForm, value: string) => {
        setEditForm((current) => ({ ...current, [field]: value }));
    };

    const parseEditAmount = (value: string): number | null => {
        if (!value.trim()) return 0;
        const parsed = Number(value);
        if (!Number.isFinite(parsed) || parsed < 0) return null;
        return Number(parsed.toFixed(2));
    };

    const saveEdit = async () => {
        if (!editingRecord) return;

        const payload = {
            cashReceived: parseEditAmount(editForm.cashReceived),
            creditReceived: parseEditAmount(editForm.creditReceived),
            cardReceived: parseEditAmount(editForm.cardReceived),
            transferReceived: parseEditAmount(editForm.transferReceived),
            nonGasSalesAmount: parseEditAmount(editForm.nonGasSalesAmount),
            otherExpensesAmount: parseEditAmount(editForm.otherExpensesAmount),
            varianceNote: editForm.varianceNote,
        };

        if (Object.values(payload).some((value) => value === null)) {
            setEditError('กรอกตัวเลขให้ถูกต้อง และยอดต้องไม่ติดลบ');
            return;
        }

        setSavingEdit(true);
        setEditError(null);

        try {
            const res = await fetch(`/api/v2/gas/admin/reconciliation/${editingRecord.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await res.json();

            if (!res.ok) {
                setEditError(data.error || 'บันทึกไม่สำเร็จ');
                return;
            }

            await loadReconciliationRecords({
                fromDate,
                toDate,
                stationId,
                statusFilter,
                setLoading,
                setRecords,
            });
            closeEditModal();
        } catch (error) {
            console.error('Error updating reconciliation:', error);
            setEditError('บันทึกไม่สำเร็จ กรุณาลองใหม่');
        } finally {
            setSavingEdit(false);
        }
    };

    const getVarianceIcon = (status: string) => {
        if (status === 'OVER') return <AlertTriangle size={16} className="text-yellow-400" />;
        if (status === 'SHORT') return <AlertTriangle size={16} className="text-red-400" />;
        return <Check size={16} className="text-green-400" />;
    };

    const getVarianceColor = (status: string) => {
        if (status === 'OVER') return 'text-yellow-400';
        if (status === 'SHORT') return 'text-red-400';
        return 'text-green-400';
    };

    const totalExpected = records.reduce((sum, r) => sum + r.totalExpected, 0);
    const totalReceived = records.reduce((sum, r) => sum + r.totalReceived, 0);
    const totalVariance = records.reduce((sum, r) => sum + r.variance, 0);
    const offBalanceCount = records.filter((record) => record.varianceStatus !== 'BALANCED').length;
    const editPreview = editingRecord ? (() => {
        const cash = parseEditAmount(editForm.cashReceived) ?? 0;
        const credit = parseEditAmount(editForm.creditReceived) ?? 0;
        const card = parseEditAmount(editForm.cardReceived) ?? 0;
        const transfer = parseEditAmount(editForm.transferReceived) ?? 0;
        const nonGasSales = parseEditAmount(editForm.nonGasSalesAmount) ?? 0;
        const otherExpenses = parseEditAmount(editForm.otherExpensesAmount) ?? 0;
        const expectedOther = Number((nonGasSales - otherExpenses).toFixed(2));
        const expected = Number((editingRecord.expectedFuelAmount + expectedOther).toFixed(2));
        const received = Number((cash + credit + card + transfer).toFixed(2));
        const variance = Number((received - expected).toFixed(2));

        return {
            expectedOther,
            expected,
            received,
            variance,
        };
    })() : null;

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Scale className="text-purple-400" />
                        กระทบยอด
                    </h1>
                </div>

                <button
                    className="flex items-center gap-2 bg-green-600 hover:bg-green-500 px-4 py-2 rounded-lg text-sm"
                >
                    <Download size={18} />
                    Export CSV
                </button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-[#1a1a24] rounded-xl p-4 border border-white/10">
                    <div className="text-sm text-gray-400">ยอดคาดหวังรวม</div>
                    <div className="text-2xl font-bold text-cyan-400">฿{formatCurrency(totalExpected)}</div>
                </div>
                <div className="bg-[#1a1a24] rounded-xl p-4 border border-white/10">
                    <div className="text-sm text-gray-400">ยอดรับจริงรวม</div>
                    <div className="text-2xl font-bold text-green-400">฿{formatCurrency(totalReceived)}</div>
                </div>
                <div className="bg-[#1a1a24] rounded-xl p-4 border border-white/10">
                    <div className="text-sm text-gray-400">ส่วนต่างรวม</div>
                    <div className={`text-2xl font-bold ${totalVariance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {totalVariance >= 0 ? '+' : ''}฿{formatCurrency(totalVariance)}
                    </div>
                </div>
                <div className="bg-[#1a1a24] rounded-xl p-4 border border-white/10">
                    <div className="text-sm text-gray-400">กะที่ต้องตรวจ</div>
                    <div className={`text-2xl font-bold ${offBalanceCount > 0 ? 'text-yellow-400' : 'text-green-400'}`}>
                        {offBalanceCount}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">กะที่ยอดไม่ตรง</div>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-[#1a1a24] rounded-xl p-4 border border-white/10">
                <div className="flex flex-wrap items-end gap-4">
                    <div className="flex-1 min-w-[150px]">
                        <label className="block text-sm text-gray-400 mb-1">ปั๊ม</label>
                        <select
                            value={stationId}
                            onChange={(e) => setStationId(e.target.value)}
                            className="w-full bg-gray-800 border border-white/10 rounded-lg px-3 py-2"
                        >
                            <option value="all">ทุกปั๊ม</option>
                            {stations.map((s) => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="min-w-[120px]">
                        <label className="block text-sm text-gray-400 mb-1">สถานะ</label>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="w-full bg-gray-800 border border-white/10 rounded-lg px-3 py-2"
                        >
                            <option value="all">ทั้งหมด</option>
                            <option value="BALANCED">✅ ตรง</option>
                            <option value="OVER">⚠️ เกิน</option>
                            <option value="SHORT">❌ ขาด</option>
                        </select>
                    </div>

                    <div className="min-w-[130px]">
                        <label className="block text-sm text-gray-400 mb-1">จากวันที่</label>
                        <input
                            type="date"
                            value={fromDate}
                            onChange={(e) => setFromDate(e.target.value)}
                            className="w-full bg-gray-800 border border-white/10 rounded-lg px-3 py-2"
                        />
                    </div>

                    <div className="min-w-[130px]">
                        <label className="block text-sm text-gray-400 mb-1">ถึงวันที่</label>
                        <input
                            type="date"
                            value={toDate}
                            onChange={(e) => setToDate(e.target.value)}
                            className="w-full bg-gray-800 border border-white/10 rounded-lg px-3 py-2"
                        />
                    </div>

                    <button
                        onClick={() => {
                            void loadReconciliationRecords({
                                fromDate,
                                toDate,
                                stationId,
                                statusFilter,
                                setLoading,
                                setRecords,
                            });
                        }}
                        className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 px-4 py-2 rounded-lg"
                    >
                        <Search size={18} />
                        ค้นหา
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="bg-[#1a1a24] rounded-xl border border-white/10 overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center p-12">
                        <Loader2 className="animate-spin text-purple-400" size={32} />
                    </div>
                ) : records.length === 0 ? (
                    <div className="p-12 text-center text-gray-500">
                        ไม่พบข้อมูล
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-800/50">
                                <tr>
                                    <th className="text-left px-4 py-3 font-medium text-gray-400">วันที่</th>
                                    <th className="text-left px-4 py-3 font-medium text-gray-400">สถานี</th>
                                    <th className="text-center px-4 py-3 font-medium text-gray-400">กะ</th>
                                    <th className="text-left px-4 py-3 font-medium text-gray-400">พนักงาน</th>
                                    <th className="text-right px-4 py-3 font-medium text-gray-400">ลิตรต่าง</th>
                                    <th className="text-right px-4 py-3 font-medium text-gray-400">รายการอื่นสุทธิ</th>
                                    <th className="text-right px-4 py-3 font-medium text-gray-400">คาดหวัง</th>
                                    <th className="text-right px-4 py-3 font-medium text-gray-400">รับจริง</th>
                                    <th className="text-right px-4 py-3 font-medium text-gray-400">ส่วนต่าง</th>
                                    <th className="text-center px-4 py-3 font-medium text-gray-400">สถานะ</th>
                                    <th className="text-right px-4 py-3 font-medium text-gray-400">แก้ไข</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {records.map((r) => (
                                    <tr key={r.id} className="hover:bg-white/5">
                                        <td className="px-4 py-3">{r.displayDate}</td>
                                        <td className="px-4 py-3">{r.stationName}</td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`px-2 py-1 rounded text-xs ${r.shiftNumber === 1 ? 'bg-blue-900/50 text-blue-300' : 'bg-purple-900/50 text-purple-300'}`}>
                                                กะ {r.shiftNumber}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">{r.staffName || '-'}</td>
                                        <td className={`px-4 py-3 text-right font-mono ${r.litersVariance >= 0 ? 'text-yellow-400' : 'text-red-400'}`}>
                                            {r.litersVariance >= 0 ? '+' : ''}{r.litersVariance.toLocaleString()} L
                                        </td>
                                        <td className={`px-4 py-3 text-right font-mono ${r.expectedOtherAmount >= 0 ? 'text-amber-300' : 'text-red-300'}`}>
                                            {r.expectedOtherAmount >= 0 ? '+' : '-'}฿{formatCurrency(Math.abs(r.expectedOtherAmount))}
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono text-gray-400">
                                            ฿{formatCurrency(r.totalExpected)}
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono text-green-400">
                                            ฿{formatCurrency(r.totalReceived)}
                                        </td>
                                        <td className={`px-4 py-3 text-right font-mono font-bold ${getVarianceColor(r.varianceStatus)}`}>
                                            {r.variance >= 0 ? '+' : ''}฿{formatCurrency(r.variance)}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <div className="flex items-center justify-center gap-1">
                                                {getVarianceIcon(r.varianceStatus)}
                                                <span className={`text-xs ${getVarianceColor(r.varianceStatus)}`}>
                                                    {r.varianceStatus === 'BALANCED' ? 'ตรง' :
                                                        r.varianceStatus === 'OVER' ? 'เกิน' : 'ขาด'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <button
                                                type="button"
                                                onClick={() => openEditModal(r)}
                                                className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-3 py-2 text-xs font-semibold text-white hover:bg-orange-500"
                                            >
                                                <Edit3 size={14} />
                                                แก้ยอด
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {editingRecord && editPreview && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
                    <div className="w-full max-w-2xl rounded-xl border border-white/10 bg-[#111827] shadow-xl">
                        <div className="flex items-start justify-between gap-4 border-b border-white/10 p-4">
                            <div>
                                <h2 className="text-xl font-bold">แก้ยอดสรุปกะ</h2>
                                <div className="mt-1 text-sm text-gray-400">
                                    {editingRecord.displayDate} / {editingRecord.stationName} / กะ {editingRecord.shiftNumber}
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={closeEditModal}
                                className="rounded-lg p-2 text-gray-400 hover:bg-white/10 hover:text-white"
                                aria-label="ปิด"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="max-h-[75vh] overflow-y-auto p-4">
                            {editError && (
                                <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
                                    {editError}
                                </div>
                            )}

                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                {[
                                    ['cashReceived', 'เงินสดรับจริง', editingRecord.cashExpected],
                                    ['creditReceived', 'เครดิตรับจริง', editingRecord.creditExpected],
                                    ['cardReceived', 'บัตรรับจริง', editingRecord.cardExpected],
                                    ['transferReceived', 'โอนรับจริง', editingRecord.transferExpected],
                                ].map(([field, label, expected]) => (
                                    <label key={field} className="block">
                                        <span className="mb-1 block text-sm text-gray-400">
                                            {label}
                                            <span className="ml-2 text-xs text-gray-500">
                                                ตามบิล ฿{formatCurrency(Number(expected))}
                                            </span>
                                        </span>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            inputMode="decimal"
                                            value={editForm[field as keyof typeof editForm]}
                                            onChange={(e) => setEditField(field as keyof typeof editForm, e.target.value)}
                                            className="w-full rounded-lg border border-white/10 bg-gray-800 px-4 py-2 text-right font-mono focus:border-orange-500 focus:outline-none"
                                        />
                                    </label>
                                ))}
                            </div>

                            <div className="mt-4 grid grid-cols-1 gap-4 border-t border-white/10 pt-4 md:grid-cols-2">
                                <label className="block">
                                    <span className="mb-1 block text-sm text-gray-400">ขายอื่น</span>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        inputMode="decimal"
                                        value={editForm.nonGasSalesAmount}
                                        onChange={(e) => setEditField('nonGasSalesAmount', e.target.value)}
                                        className="w-full rounded-lg border border-white/10 bg-gray-800 px-4 py-2 text-right font-mono focus:border-orange-500 focus:outline-none"
                                    />
                                </label>
                                <label className="block">
                                    <span className="mb-1 block text-sm text-gray-400">ค่าใช้จ่าย</span>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        inputMode="decimal"
                                        value={editForm.otherExpensesAmount}
                                        onChange={(e) => setEditField('otherExpensesAmount', e.target.value)}
                                        className="w-full rounded-lg border border-white/10 bg-gray-800 px-4 py-2 text-right font-mono focus:border-orange-500 focus:outline-none"
                                    />
                                </label>
                            </div>

                            <label className="mt-4 block">
                                <span className="mb-1 block text-sm text-gray-400">หมายเหตุ</span>
                                <textarea
                                    value={editForm.varianceNote}
                                    onChange={(e) => setEditField('varianceNote', e.target.value)}
                                    rows={3}
                                    className="w-full resize-none rounded-lg border border-white/10 bg-gray-800 px-4 py-2 focus:border-orange-500 focus:outline-none"
                                />
                            </label>

                            <div className="mt-4 rounded-lg border border-white/10 bg-gray-900 p-4">
                                <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
                                    <div>
                                        <div className="text-gray-400">ยอดที่ควรได้</div>
                                        <div className="mt-1 font-mono text-lg font-bold">฿{formatCurrency(editPreview.expected)}</div>
                                    </div>
                                    <div>
                                        <div className="text-gray-400">ยอดรับจริงใหม่</div>
                                        <div className="mt-1 font-mono text-lg font-bold text-green-400">฿{formatCurrency(editPreview.received)}</div>
                                    </div>
                                    <div>
                                        <div className="text-gray-400">ส่วนต่างใหม่</div>
                                        <div className={`mt-1 font-mono text-lg font-bold ${editPreview.variance >= 0 ? 'text-yellow-400' : 'text-red-400'}`}>
                                            {editPreview.variance >= 0 ? '+' : ''}฿{formatCurrency(editPreview.variance)}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 border-t border-white/10 p-4">
                            <button
                                type="button"
                                onClick={closeEditModal}
                                className="rounded-lg bg-gray-700 px-4 py-2 text-sm font-semibold hover:bg-gray-600"
                            >
                                ยกเลิก
                            </button>
                            <button
                                type="button"
                                onClick={saveEdit}
                                disabled={savingEdit}
                                className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-500 disabled:opacity-60"
                            >
                                {savingEdit ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                                บันทึก
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
