'use client';

import { useEffect, useState } from 'react';
import { Loader2, Clock, Download, Search, Eye, Edit2, Check, X, Scale, AlertTriangle } from 'lucide-react';
import { formatCurrency, formatThaiTime, getGasBusinessDateKey, getShiftName, getVarianceColorClass, getVarianceText } from '@/lib/gas';
import DateRangePresets from '@/app/admin/gas/components/DateRangePresets';

interface ShiftReport {
    id: string;
    stationId: string;
    stationName: string;
    dateKey: string;
    displayDate: string;
    shiftNumber: number;
    staffName: string | null;
    openedAt: string;
    closedAt: string | null;
    status: string;
    meters: {
        total: number;
        transactionLiters: number;
        litersVariance: number;
        nozzles: { nozzleNumber: number; startReading: number; endReading: number; soldQty: number }[];
    };
    sales: {
        total: number;
        liters: number;
        transactions: number;
        cash: number;
        credit: number;
        card: number;
        transfer: number;
        averageTicket: number;
    };
    reconciliation: {
        expectedFuelAmount: number;
        expectedOtherAmount: number;
        nonGasSalesAmount: number;
        productSalesAmount?: number;
        productTransferAmount?: number;
        otherIncomeAmount?: number;
        otherExpensesAmount: number;
        expected: number;
        received: number;
        variance: number;
        varianceStatus: 'OVER' | 'SHORT' | 'BALANCED';
        varianceSeverity: 'GREEN' | 'YELLOW' | 'RED';
        cashExpected: number;
        cashReceived: number;
        creditExpected: number;
        creditReceived: number;
        cardExpected: number;
        cardReceived: number;
        transferExpected: number;
        transferReceived: number;
        varianceNote: string | null;
    } | null;
}

async function loadShiftReports({
    fromDate,
    toDate,
    stationId,
    shiftFilter,
    setLoading,
    setReports,
}: {
    fromDate: string;
    toDate: string;
    stationId: string;
    shiftFilter: string;
    setLoading: (value: boolean) => void;
    setReports: (value: ShiftReport[]) => void;
}) {
    setLoading(true);
    try {
        const params = new URLSearchParams({
            from: fromDate,
            to: toDate,
            ...(stationId !== 'all' && { stationId }),
            ...(shiftFilter !== 'all' && { shift: shiftFilter }),
        });

        const res = await fetch(`/api/v2/gas/admin/reports/shift?${params}`);
        if (res.ok) {
            const data = await res.json();
            setReports(data.shifts || []);
        }
    } catch (error) {
        console.error('Error fetching reports:', error);
    } finally {
        setLoading(false);
    }
}

function getExpectedNetCashToSubmit({
    cashExpected,
    nonGasSalesAmount,
    otherExpensesAmount,
}: {
    cashExpected: number;
    nonGasSalesAmount: number;
    otherExpensesAmount: number;
}): number {
    return Number((cashExpected + nonGasSalesAmount - otherExpensesAmount).toFixed(2));
}

export default function ShiftReportPage() {
    const [loading, setLoading] = useState(true);
    const [reports, setReports] = useState<ShiftReport[]>([]);
    const [stationId, setStationId] = useState<string>('all');
    const [shiftFilter, setShiftFilter] = useState<string>('all');
    const [reconciliationMode, setReconciliationMode] = useState(false);
    const [varianceFilter, setVarianceFilter] = useState<string>('all');
    const [editShiftId, setEditShiftId] = useState<string | null>(null);
    const [fromDate, setFromDate] = useState<string>(() => {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        return d.toISOString().split('T')[0];
    });
    const [toDate, setToDate] = useState<string>(getGasBusinessDateKey());
    const [stations, setStations] = useState<{ id: string; name: string }[]>([]);

    // Detail modal
    const [selectedShift, setSelectedShift] = useState<ShiftReport | null>(null);
    const [editing, setEditing] = useState(false);
    const [savingEdit, setSavingEdit] = useState(false);
    const [editError, setEditError] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<{
        cashReceived: string;
        creditReceived: string;
        cardReceived: string;
        transferReceived: string;
        nonGasSalesAmount: string;
        otherExpensesAmount: string;
        varianceNote: string;
    } | null>(null);

    // Fetch stations
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
        const queryShift = params.get('shift');
        const queryStatus = params.get('status');
        const queryEditShiftId = params.get('editShiftId');

        setReconciliationMode(params.get('view') === 'reconciliation');
        if (queryStationId) setStationId(queryStationId);
        if (queryFrom) setFromDate(queryFrom);
        if (queryTo) setToDate(queryTo);
        if (queryShift === '1' || queryShift === '2') setShiftFilter(queryShift);
        if (['BALANCED', 'OVER', 'SHORT'].includes(queryStatus || '')) setVarianceFilter(queryStatus!);
        if (queryEditShiftId) setEditShiftId(queryEditShiftId);
    }, []);

    // Fetch reports
    useEffect(() => {
        void loadShiftReports({
            fromDate,
            toDate,
            stationId,
            shiftFilter,
            setLoading,
            setReports,
        });
    }, [fromDate, toDate, stationId, shiftFilter]);

    const parseEditAmount = (value: string): number | null => {
        if (!value.trim()) return 0;
        const parsed = Number(value);
        if (!Number.isFinite(parsed) || parsed < 0) return null;
        return Number(parsed.toFixed(2));
    };

    const closeShiftModal = () => {
        setSelectedShift(null);
        setEditing(false);
        setEditForm(null);
        setEditError(null);

        const url = new URL(window.location.href);
        url.searchParams.delete('editShiftId');
        window.history.replaceState(null, '', `${url.pathname}${url.search}`);
    };

    const handleEdit = (shift: ShiftReport) => {
        setSelectedShift(shift);
        setEditing(true);
        setEditError(null);
        setEditForm({
            cashReceived: String(shift.reconciliation?.cashReceived ?? shift.sales.cash),
            creditReceived: String(shift.reconciliation?.creditReceived ?? shift.sales.credit),
            cardReceived: String(shift.reconciliation?.cardReceived ?? shift.sales.card),
            transferReceived: String(shift.reconciliation?.transferReceived ?? shift.sales.transfer),
            nonGasSalesAmount: String(shift.reconciliation?.nonGasSalesAmount ?? 0),
            otherExpensesAmount: String(shift.reconciliation?.otherExpensesAmount ?? 0),
            varianceNote: shift.reconciliation?.varianceNote ?? '',
        });
    };

    useEffect(() => {
        if (!editShiftId || selectedShift) return;
        const matchedShift = reports.find((report) => report.id === editShiftId);
        if (!matchedShift) return;

        setSelectedShift(matchedShift);
        setEditing(true);
        setEditError(null);
        setEditForm({
            cashReceived: String(matchedShift.reconciliation?.cashReceived ?? matchedShift.sales.cash),
            creditReceived: String(matchedShift.reconciliation?.creditReceived ?? matchedShift.sales.credit),
            cardReceived: String(matchedShift.reconciliation?.cardReceived ?? matchedShift.sales.card),
            transferReceived: String(matchedShift.reconciliation?.transferReceived ?? matchedShift.sales.transfer),
            nonGasSalesAmount: String(matchedShift.reconciliation?.nonGasSalesAmount ?? 0),
            otherExpensesAmount: String(matchedShift.reconciliation?.otherExpensesAmount ?? 0),
            varianceNote: matchedShift.reconciliation?.varianceNote ?? '',
        });
        setEditShiftId(null);
    }, [reports, editShiftId, selectedShift]);

    const handleSaveEdit = async () => {
        if (!selectedShift || !editForm) return;

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
            const res = await fetch(`/api/v2/gas/admin/reconciliation/${selectedShift.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                setEditError(data.error || 'บันทึกไม่สำเร็จ');
                return;
            }

            closeShiftModal();
            await loadShiftReports({
                fromDate,
                toDate,
                stationId,
                shiftFilter,
                setLoading,
                setReports,
            });
        } catch (error) {
            console.error('Error saving reconciliation:', error);
            setEditError('บันทึกไม่สำเร็จ กรุณาลองใหม่');
        } finally {
            setSavingEdit(false);
        }
    };

    const handleExportCSV = async () => {
        const params = new URLSearchParams({
            from: fromDate,
            to: toDate,
            type: 'shift_meters',
            ...(stationId !== 'all' && { stationId })
        });
        window.open(`/api/export/csv?${params}`, '_blank');
    };

    const displayedReports = reports.filter((report) => {
        if (reconciliationMode && !report.reconciliation) return false;
        if (reconciliationMode && varianceFilter !== 'all' && report.reconciliation?.varianceStatus !== varianceFilter) return false;
        return true;
    });

    const reconciliationSummary = displayedReports.reduce((sum, report) => {
        if (!report.reconciliation) return sum;
        sum.expected += report.reconciliation.expected;
        sum.received += report.reconciliation.received;
        sum.variance += report.reconciliation.variance;
        if (report.reconciliation.varianceStatus !== 'BALANCED') sum.offBalance += 1;
        return sum;
    }, { expected: 0, received: 0, variance: 0, offBalance: 0 });

    const editPreview = selectedShift && editForm ? (() => {
        const cash = parseEditAmount(editForm.cashReceived) ?? 0;
        const credit = parseEditAmount(editForm.creditReceived) ?? 0;
        const card = parseEditAmount(editForm.cardReceived) ?? 0;
        const transfer = parseEditAmount(editForm.transferReceived) ?? 0;
        const nonGasSales = parseEditAmount(editForm.nonGasSalesAmount) ?? 0;
        const otherExpenses = parseEditAmount(editForm.otherExpensesAmount) ?? 0;
        const expectedFuel = selectedShift.reconciliation?.expectedFuelAmount ?? selectedShift.sales.total;
        const expected = Number((expectedFuel + nonGasSales - otherExpenses).toFixed(2));
        const received = Number((cash + credit + card + transfer).toFixed(2));
        const variance = Number((received - expected).toFixed(2));
        const expectedNetCash = selectedShift.reconciliation
            ? getExpectedNetCashToSubmit({
                cashExpected: selectedShift.reconciliation.cashExpected,
                nonGasSalesAmount: nonGasSales,
                otherExpensesAmount: otherExpenses,
            })
            : null;
        return { expected, received, variance, expectedNetCash };
    })() : null;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        {reconciliationMode ? <Scale className="text-green-400" /> : <Clock className="text-blue-400" />}
                        {reconciliationMode ? 'กระทบยอดตามกะ' : 'รายงานตามกะ'}
                    </h1>
                    {reconciliationMode && (
                        <p className="mt-1 text-sm text-gray-400">ตรวจส่วนต่างและแก้ยอดรับจริงจากรายงานกะเดียวกัน</p>
                    )}
                </div>

                <button
                    onClick={handleExportCSV}
                    className="flex items-center gap-2 bg-green-600 hover:bg-green-500 px-4 py-2 rounded-lg text-sm"
                >
                    <Download size={18} />
                    Export CSV
                </button>
            </div>

            {reconciliationMode && (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                    <div className="rounded-xl border border-white/10 bg-[#1a1a24] p-4">
                        <div className="text-sm text-gray-400">ยอดคาดหวังรวม</div>
                        <div className="text-2xl font-bold text-cyan-400">฿{formatCurrency(reconciliationSummary.expected)}</div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-[#1a1a24] p-4">
                        <div className="text-sm text-gray-400">ยอดรับจริงรวม</div>
                        <div className="text-2xl font-bold text-green-400">฿{formatCurrency(reconciliationSummary.received)}</div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-[#1a1a24] p-4">
                        <div className="text-sm text-gray-400">ส่วนต่างรวม</div>
                        <div className={`text-2xl font-bold ${reconciliationSummary.variance >= 0 ? 'text-yellow-400' : 'text-red-400'}`}>
                            {reconciliationSummary.variance >= 0 ? '+' : ''}฿{formatCurrency(reconciliationSummary.variance)}
                        </div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-[#1a1a24] p-4">
                        <div className="text-sm text-gray-400">กะที่ต้องตรวจ</div>
                        <div className={`text-2xl font-bold ${reconciliationSummary.offBalance > 0 ? 'text-yellow-400' : 'text-green-400'}`}>
                            {reconciliationSummary.offBalance}
                        </div>
                        <div className="mt-1 text-xs text-gray-500">กะที่ยอดไม่ตรง</div>
                    </div>
                </div>
            )}

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

                    <div className="min-w-[100px]">
                        <label className="block text-sm text-gray-400 mb-1">กะ</label>
                        <select
                            value={shiftFilter}
                            onChange={(e) => setShiftFilter(e.target.value)}
                            className="w-full bg-gray-800 border border-white/10 rounded-lg px-3 py-2"
                        >
                            <option value="all">ทั้งหมด</option>
                            <option value="1">กะ 1</option>
                            <option value="2">กะ 2</option>
                        </select>
                    </div>

                    {reconciliationMode && (
                        <div className="min-w-[120px]">
                            <label className="block text-sm text-gray-400 mb-1">ส่วนต่าง</label>
                            <select
                                value={varianceFilter}
                                onChange={(e) => setVarianceFilter(e.target.value)}
                                className="w-full bg-gray-800 border border-white/10 rounded-lg px-3 py-2"
                            >
                                <option value="all">ทั้งหมด</option>
                                <option value="BALANCED">ตรง</option>
                                <option value="OVER">เกิน</option>
                                <option value="SHORT">ขาด</option>
                            </select>
                        </div>
                    )}

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

                    <div className="pb-1">
                        <DateRangePresets
                            fromDate={fromDate}
                            toDate={toDate}
                            onSelect={(from, to) => { setFromDate(from); setToDate(to); }}
                        />
                    </div>

                    <button
                        onClick={() => {
                            void loadShiftReports({
                                fromDate,
                                toDate,
                                stationId,
                                shiftFilter,
                                setLoading,
                                setReports,
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
                ) : displayedReports.length === 0 ? (
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
                                    <th className="text-center px-4 py-3 font-medium text-gray-400">เวลา</th>
                                    <th className="text-right px-4 py-3 font-medium text-gray-400">ยอดมิเตอร์</th>
                                    <th className="text-right px-4 py-3 font-medium text-gray-400">ยอดขาย</th>
                                    <th className="text-right px-4 py-3 font-medium text-gray-400">ส่วนต่าง</th>
                                    <th className="text-center px-4 py-3 font-medium text-gray-400">{reconciliationMode ? 'กระทบยอด' : 'สถานะ'}</th>
                                    <th className="px-4 py-3"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {displayedReports.map((r) => (
                                    <tr key={r.id} className="hover:bg-white/5">
                                        <td className="px-4 py-3">{r.displayDate}</td>
                                        <td className="px-4 py-3">{r.stationName}</td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`px-2 py-1 rounded text-xs ${r.shiftNumber === 1 ? 'bg-blue-900/50 text-blue-300' : 'bg-purple-900/50 text-purple-300'
                                                }`}>
                                                {getShiftName(r.shiftNumber)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">{r.staffName || '-'}</td>
                                        <td className="px-4 py-3 text-center text-gray-400 text-xs">
                                            {formatThaiTime(new Date(r.openedAt))}
                                            {r.closedAt && ` - ${formatThaiTime(new Date(r.closedAt))}`}
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono">
                                            {r.meters.total.toLocaleString()} L
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono text-green-400">
                                            ฿{formatCurrency(r.sales.total)}
                                        </td>
                                        <td className={`px-4 py-3 text-right font-mono ${r.reconciliation ? getVarianceColorClass(r.reconciliation.varianceStatus) : 'text-gray-500'
                                            }`}>
                                            {r.reconciliation
                                                ? `${r.reconciliation.variance >= 0 ? '+' : ''}${formatCurrency(r.reconciliation.variance)}`
                                                : '-'
                                            }
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            {reconciliationMode && r.reconciliation ? (
                                                <span className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs ${getVarianceColorClass(r.reconciliation.varianceStatus)}`}>
                                                    {r.reconciliation.varianceStatus === 'BALANCED'
                                                        ? <Check size={14} aria-hidden="true" />
                                                        : <AlertTriangle size={14} aria-hidden="true" />}
                                                    {getVarianceText(r.reconciliation.varianceStatus)}
                                                </span>
                                            ) : (
                                                <span className={`px-2 py-1 rounded text-xs ${r.status === 'OPEN' ? 'bg-green-900/50 text-green-300' :
                                                    r.status === 'CLOSED' ? 'bg-gray-700 text-gray-300' :
                                                        'bg-blue-900/50 text-blue-300'
                                                    }`}>
                                                    {r.status === 'OPEN' ? 'เปิด' :
                                                        r.status === 'CLOSED' ? 'ปิด' : 'ล็อค'}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex gap-1">
                                                <button
                                                    onClick={() => setSelectedShift(r)}
                                                    className="p-1 hover:bg-white/10 rounded"
                                                    title="ดูรายละเอียด"
                                                >
                                                    <Eye size={16} className="text-gray-400" />
                                                </button>
                                                <button
                                                    onClick={() => handleEdit(r)}
                                                    className="p-1 hover:bg-white/10 rounded"
                                                    title="แก้ไข"
                                                >
                                                    <Edit2 size={16} className="text-gray-400" />
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

            {/* Detail/Edit Modal */}
            {selectedShift && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
                    <div className="bg-[#1a1a24] rounded-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto border border-white/10">
                        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
                            <h3 className="text-lg font-bold">
                                {selectedShift.displayDate} - {getShiftName(selectedShift.shiftNumber)}
                            </h3>
                            <button
                                onClick={closeShiftModal}
                                className="p-1 hover:bg-white/10 rounded"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Meters */}
                            <div>
                                <h4 className="font-medium text-gray-400 mb-2">มิเตอร์</h4>
                                <div className="grid grid-cols-4 gap-2">
                                    {selectedShift.meters.nozzles.map((n) => (
                                        <div key={n.nozzleNumber} className="bg-gray-800 rounded-lg p-3 text-center">
                                            <div className="text-xs text-gray-400">หัวจ่าย {n.nozzleNumber}</div>
                                            <div className="text-sm font-mono">{n.startReading} → {n.endReading}</div>
                                            <div className="text-green-400 font-bold">{n.soldQty} L</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Sales Breakdown */}
                            <div>
                                <h4 className="font-medium text-gray-400 mb-2">ยอดขาย</h4>
                                <div className="grid grid-cols-3 gap-3 mb-4">
                                    <div className="bg-gray-800 rounded-lg p-3 border border-white/10">
                                        <div className="text-xs text-gray-400">รายการขาย</div>
                                        <div className="text-lg font-bold">{selectedShift.sales.transactions}</div>
                                    </div>
                                    <div className="bg-gray-800 rounded-lg p-3 border border-white/10">
                                        <div className="text-xs text-gray-400">ลิตรจากรายการขาย</div>
                                        <div className="text-lg font-bold text-cyan-400">{selectedShift.sales.liters.toLocaleString()} L</div>
                                        <div className="text-xs text-gray-500 mt-1">
                                            มิเตอร์ {selectedShift.meters.total.toLocaleString()} L
                                        </div>
                                    </div>
                                    <div className="bg-gray-800 rounded-lg p-3 border border-white/10">
                                        <div className="text-xs text-gray-400">ค่าเฉลี่ยต่อบิล</div>
                                        <div className="text-lg font-bold text-purple-400">฿{formatCurrency(selectedShift.sales.averageTicket)}</div>
                                    </div>
                                </div>

                                {editing && editForm ? (
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-sm text-green-400">เงินสดส่งจริง</label>
                                            <input
                                                type="number"
                                                value={editForm.cashReceived}
                                                onChange={(e) => setEditForm({ ...editForm, cashReceived: e.target.value })}
                                                className="w-full bg-gray-800 border border-white/10 rounded-lg px-3 py-2 mt-1"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-sm text-purple-400">เงินเชื่อ</label>
                                            <input
                                                type="number"
                                                value={editForm.creditReceived}
                                                onChange={(e) => setEditForm({ ...editForm, creditReceived: e.target.value })}
                                                className="w-full bg-gray-800 border border-white/10 rounded-lg px-3 py-2 mt-1"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-sm text-blue-400">บัตรเครดิต</label>
                                            <input
                                                type="number"
                                                value={editForm.cardReceived}
                                                onChange={(e) => setEditForm({ ...editForm, cardReceived: e.target.value })}
                                                className="w-full bg-gray-800 border border-white/10 rounded-lg px-3 py-2 mt-1"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-sm text-cyan-400">โอนเงิน</label>
                                            <input
                                                type="number"
                                                value={editForm.transferReceived}
                                                onChange={(e) => setEditForm({ ...editForm, transferReceived: e.target.value })}
                                                className="w-full bg-gray-800 border border-white/10 rounded-lg px-3 py-2 mt-1"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-sm text-amber-400">ยอดขายอื่น (ไม่ใช่แก๊ส)</label>
                                            <input
                                                type="number"
                                                value={editForm.nonGasSalesAmount}
                                                onChange={(e) => setEditForm({ ...editForm, nonGasSalesAmount: e.target.value })}
                                                className="w-full bg-gray-800 border border-white/10 rounded-lg px-3 py-2 mt-1"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-sm text-red-300">ค่าใช้จ่ายจากเงินสด</label>
                                            <input
                                                type="number"
                                                value={editForm.otherExpensesAmount}
                                                onChange={(e) => setEditForm({ ...editForm, otherExpensesAmount: e.target.value })}
                                                className="w-full bg-gray-800 border border-white/10 rounded-lg px-3 py-2 mt-1"
                                            />
                                        </div>

                                        {editError && (
                                            <div className="col-span-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
                                                {editError}
                                            </div>
                                        )}

                                        <label className="col-span-2 block">
                                            <span className="text-sm text-gray-400">หมายเหตุ</span>
                                            <textarea
                                                value={editForm.varianceNote}
                                                onChange={(e) => setEditForm({ ...editForm, varianceNote: e.target.value })}
                                                rows={3}
                                                className="mt-1 w-full resize-none rounded-lg border border-white/10 bg-gray-800 px-3 py-2 focus:border-orange-500 focus:outline-none"
                                            />
                                        </label>

                                        {editPreview && (
                                            <div className="col-span-2 grid grid-cols-2 gap-3 rounded-lg border border-white/10 bg-gray-900 p-3 text-sm md:grid-cols-4">
                                                <div>
                                                    <div className="text-gray-400">ยอดที่ควรได้</div>
                                                    <div className="font-mono font-bold">฿{formatCurrency(editPreview.expected)}</div>
                                                </div>
                                                <div>
                                                    <div className="text-gray-400">เงินสดควรส่งสุทธิ</div>
                                                    <div className="font-mono font-bold text-green-300">
                                                        {editPreview.expectedNetCash === null ? '-' : `฿${formatCurrency(editPreview.expectedNetCash)}`}
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="text-gray-400">ยอดรับจริงใหม่</div>
                                                    <div className="font-mono font-bold text-green-400">฿{formatCurrency(editPreview.received)}</div>
                                                </div>
                                                <div>
                                                    <div className="text-gray-400">ส่วนต่างใหม่</div>
                                                    <div className={`font-mono font-bold ${editPreview.variance >= 0 ? 'text-yellow-400' : 'text-red-400'}`}>
                                                        {editPreview.variance >= 0 ? '+' : ''}฿{formatCurrency(editPreview.variance)}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-4 gap-2">
                                        <div className="bg-green-900/30 rounded-lg p-3 text-center border border-green-500/20">
                                            <div className="text-xs text-green-400">เงินสด</div>
                                            <div className="font-bold">฿{formatCurrency(selectedShift.sales.cash)}</div>
                                        </div>
                                        <div className="bg-purple-900/30 rounded-lg p-3 text-center border border-purple-500/20">
                                            <div className="text-xs text-purple-400">เงินเชื่อ</div>
                                            <div className="font-bold">฿{formatCurrency(selectedShift.sales.credit)}</div>
                                        </div>
                                        <div className="bg-blue-900/30 rounded-lg p-3 text-center border border-blue-500/20">
                                            <div className="text-xs text-blue-400">บัตร</div>
                                            <div className="font-bold">฿{formatCurrency(selectedShift.sales.card)}</div>
                                        </div>
                                        <div className="bg-cyan-900/30 rounded-lg p-3 text-center border border-cyan-500/20">
                                            <div className="text-xs text-cyan-400">โอน</div>
                                            <div className="font-bold">฿{formatCurrency(selectedShift.sales.transfer)}</div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Reconciliation */}
                            {selectedShift.reconciliation && !editing && (
                                <div className="bg-gray-800 rounded-lg p-4 space-y-4">
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-400">กระทบยอด</span>
                                        <span className={`font-bold ${getVarianceColorClass(selectedShift.reconciliation.varianceStatus)}`}>
                                            {getVarianceText(selectedShift.reconciliation.varianceStatus)}
                                            {' '}฿{formatCurrency(Math.abs(selectedShift.reconciliation.variance))}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 text-sm">
                                        <div className="rounded-lg border border-white/10 p-3">
                                            <div className="text-gray-400 mb-2">ยอดคาดหวัง</div>
                                            <div className="space-y-1">
                                                <div className="flex justify-between"><span>แก๊สจากมิเตอร์</span><span className="font-mono">฿{formatCurrency(selectedShift.reconciliation.expectedFuelAmount)}</span></div>
                                                <div className="flex justify-between"><span>ขายอื่น</span><span className="font-mono text-amber-300">฿{formatCurrency(selectedShift.reconciliation.nonGasSalesAmount)}</span></div>
                                                {(selectedShift.reconciliation.productSalesAmount ?? 0) > 0 && (
                                                    <>
                                                        <div className="flex justify-between pl-3 text-xs text-gray-400">
                                                            <span>• สินค้า (นับสต็อก)</span>
                                                            <span className="font-mono">฿{formatCurrency(selectedShift.reconciliation.productSalesAmount ?? 0)}</span>
                                                        </div>
                                                        {(selectedShift.reconciliation.productTransferAmount ?? 0) > 0 && (
                                                            <div className="flex justify-between pl-6 text-xs text-cyan-300">
                                                                <span>รับโอน/สแกน</span>
                                                                <span className="font-mono">฿{formatCurrency(selectedShift.reconciliation.productTransferAmount ?? 0)}</span>
                                                            </div>
                                                        )}
                                                        <div className="flex justify-between pl-3 text-xs text-gray-400">
                                                            <span>• รายรับอื่น</span>
                                                            <span className="font-mono">฿{formatCurrency(selectedShift.reconciliation.otherIncomeAmount ?? 0)}</span>
                                                        </div>
                                                    </>
                                                )}
                                                <div className="flex justify-between"><span>หักค่าใช้จ่าย</span><span className="font-mono text-red-300">฿{formatCurrency(selectedShift.reconciliation.otherExpensesAmount)}</span></div>
                                                <div className="my-2 border-t border-white/10" />
                                                <div className="flex justify-between"><span>เงินสด</span><span className="font-mono">฿{formatCurrency(selectedShift.reconciliation.cashExpected)}</span></div>
                                                <div className="flex justify-between"><span>เงินเชื่อ</span><span className="font-mono">฿{formatCurrency(selectedShift.reconciliation.creditExpected)}</span></div>
                                                <div className="flex justify-between"><span>บัตร</span><span className="font-mono">฿{formatCurrency(selectedShift.reconciliation.cardExpected)}</span></div>
                                                <div className="flex justify-between"><span>โอน</span><span className="font-mono">฿{formatCurrency(selectedShift.reconciliation.transferExpected)}</span></div>
                                                <div className="my-2 border-t border-white/10" />
                                                <div className="flex justify-between text-green-300">
                                                    <span>เงินสดควรส่งสุทธิ</span>
                                                    <span className="font-mono">฿{formatCurrency(getExpectedNetCashToSubmit(selectedShift.reconciliation))}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="rounded-lg border border-white/10 p-3">
                                            <div className="text-gray-400 mb-2">ยอดรับจริง</div>
                                            <div className="space-y-1">
                                                <div className="flex justify-between"><span>เงินสด</span><span className="font-mono">฿{formatCurrency(selectedShift.reconciliation.cashReceived)}</span></div>
                                                <div className="flex justify-between"><span>เงินเชื่อ</span><span className="font-mono">฿{formatCurrency(selectedShift.reconciliation.creditReceived)}</span></div>
                                                <div className="flex justify-between"><span>บัตร</span><span className="font-mono">฿{formatCurrency(selectedShift.reconciliation.cardReceived)}</span></div>
                                                <div className="flex justify-between"><span>โอน</span><span className="font-mono">฿{formatCurrency(selectedShift.reconciliation.transferReceived)}</span></div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 text-sm">
                                        <div className="rounded-lg border border-white/10 p-3">
                                            <div className="text-gray-400">ลิตรต่าง (ขาย - มิเตอร์)</div>
                                            <div className={`text-lg font-bold ${selectedShift.meters.litersVariance >= 0 ? 'text-yellow-400' : 'text-red-400'}`}>
                                                {selectedShift.meters.litersVariance >= 0 ? '+' : ''}
                                                {selectedShift.meters.litersVariance.toLocaleString()} L
                                            </div>
                                        </div>
                                        <div className="rounded-lg border border-white/10 p-3">
                                            <div className="text-gray-400">หมายเหตุ</div>
                                            <div className="text-sm mt-1 text-gray-200">
                                                {selectedShift.reconciliation.varianceNote || '-'}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="px-6 py-4 border-t border-white/10 flex justify-end gap-2">
                            {editing ? (
                                <>
                                    <button
                                        onClick={closeShiftModal}
                                        className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
                                    >
                                        ยกเลิก
                                    </button>
                                    <button
                                        onClick={handleSaveEdit}
                                        disabled={savingEdit}
                                        className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg flex items-center gap-2 disabled:opacity-60"
                                    >
                                        {savingEdit ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />}
                                        บันทึก
                                    </button>
                                </>
                            ) : (
                                <button
                                    onClick={closeShiftModal}
                                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
                                >
                                    ปิด
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
