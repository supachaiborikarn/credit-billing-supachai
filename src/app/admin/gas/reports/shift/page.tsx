'use client';

import { useEffect, useState } from 'react';
import { Loader2, Clock, Download, Search, Eye, Edit2, Check, X } from 'lucide-react';
import { formatCurrency, formatThaiDate, formatThaiTime, getTodayBangkok, getShiftName, getVarianceColorClass, getVarianceText } from '@/lib/gas';

interface ShiftReport {
    id: string;
    dateKey: string;
    displayDate: string;
    shiftNumber: number;
    staffName: string | null;
    openedAt: string;
    closedAt: string | null;
    status: string;
    meters: {
        total: number;
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
    };
    reconciliation: {
        expected: number;
        received: number;
        variance: number;
        varianceStatus: 'OVER' | 'SHORT' | 'BALANCED';
    } | null;
}

export default function ShiftReportPage() {
    const [loading, setLoading] = useState(true);
    const [reports, setReports] = useState<ShiftReport[]>([]);
    const [stationId, setStationId] = useState<string>('all');
    const [shiftFilter, setShiftFilter] = useState<string>('all');
    const [fromDate, setFromDate] = useState<string>(() => {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        return d.toISOString().split('T')[0];
    });
    const [toDate, setToDate] = useState<string>(getTodayBangkok());
    const [stations, setStations] = useState<{ id: string; name: string }[]>([]);

    // Detail modal
    const [selectedShift, setSelectedShift] = useState<ShiftReport | null>(null);
    const [editing, setEditing] = useState(false);
    const [editForm, setEditForm] = useState<{
        cashReceived: string;
        creditReceived: string;
        cardReceived: string;
        transferReceived: string;
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

    // Fetch reports
    const fetchReports = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                from: fromDate,
                to: toDate,
                ...(stationId !== 'all' && { stationId }),
                ...(shiftFilter !== 'all' && { shift: shiftFilter })
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
    };

    useEffect(() => {
        fetchReports();
    }, [fromDate, toDate, stationId, shiftFilter]);

    const handleEdit = (shift: ShiftReport) => {
        setSelectedShift(shift);
        setEditing(true);
        setEditForm({
            cashReceived: String(shift.reconciliation?.received || shift.sales.cash),
            creditReceived: String(shift.sales.credit),
            cardReceived: String(shift.sales.card),
            transferReceived: String(shift.sales.transfer)
        });
    };

    const handleSaveEdit = async () => {
        if (!selectedShift || !editForm) return;

        try {
            const res = await fetch(`/api/v2/gas/admin/reconciliation/${selectedShift.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    cashReceived: parseFloat(editForm.cashReceived) || 0,
                    creditReceived: parseFloat(editForm.creditReceived) || 0,
                    cardReceived: parseFloat(editForm.cardReceived) || 0,
                    transferReceived: parseFloat(editForm.transferReceived) || 0
                })
            });

            if (res.ok) {
                setEditing(false);
                setSelectedShift(null);
                fetchReports();
            }
        } catch (error) {
            console.error('Error saving:', error);
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

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Clock className="text-blue-400" />
                        รายงานตามกะ
                    </h1>
                </div>

                <button
                    onClick={handleExportCSV}
                    className="flex items-center gap-2 bg-green-600 hover:bg-green-500 px-4 py-2 rounded-lg text-sm"
                >
                    <Download size={18} />
                    Export CSV
                </button>
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
                        onClick={fetchReports}
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
                ) : reports.length === 0 ? (
                    <div className="p-12 text-center text-gray-500">
                        ไม่พบข้อมูล
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-800/50">
                                <tr>
                                    <th className="text-left px-4 py-3 font-medium text-gray-400">วันที่</th>
                                    <th className="text-center px-4 py-3 font-medium text-gray-400">กะ</th>
                                    <th className="text-left px-4 py-3 font-medium text-gray-400">พนักงาน</th>
                                    <th className="text-center px-4 py-3 font-medium text-gray-400">เวลา</th>
                                    <th className="text-right px-4 py-3 font-medium text-gray-400">ยอดมิเตอร์</th>
                                    <th className="text-right px-4 py-3 font-medium text-gray-400">ยอดขาย</th>
                                    <th className="text-right px-4 py-3 font-medium text-gray-400">ส่วนต่าง</th>
                                    <th className="text-center px-4 py-3 font-medium text-gray-400">สถานะ</th>
                                    <th className="px-4 py-3"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {reports.map((r) => (
                                    <tr key={r.id} className="hover:bg-white/5">
                                        <td className="px-4 py-3">{r.displayDate}</td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`px-2 py-1 rounded text-xs ${r.shiftNumber === 1 ? 'bg-blue-900/50 text-blue-300' : 'bg-purple-900/50 text-purple-300'
                                                }`}>
                                                กะ {r.shiftNumber}
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
                                            <span className={`px-2 py-1 rounded text-xs ${r.status === 'OPEN' ? 'bg-green-900/50 text-green-300' :
                                                r.status === 'CLOSED' ? 'bg-gray-700 text-gray-300' :
                                                    'bg-blue-900/50 text-blue-300'
                                                }`}>
                                                {r.status === 'OPEN' ? 'เปิด' :
                                                    r.status === 'CLOSED' ? 'ปิด' : 'ล็อค'}
                                            </span>
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
                                {selectedShift.displayDate} - กะ {selectedShift.shiftNumber}
                            </h3>
                            <button
                                onClick={() => { setSelectedShift(null); setEditing(false); }}
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
                                {editing && editForm ? (
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-sm text-green-400">เงินสด</label>
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
                                <div className="bg-gray-800 rounded-lg p-4">
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-400">กระทบยอด</span>
                                        <span className={`font-bold ${getVarianceColorClass(selectedShift.reconciliation.varianceStatus)}`}>
                                            {getVarianceText(selectedShift.reconciliation.varianceStatus)}
                                            {' '}฿{formatCurrency(Math.abs(selectedShift.reconciliation.variance))}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="px-6 py-4 border-t border-white/10 flex justify-end gap-2">
                            {editing ? (
                                <>
                                    <button
                                        onClick={() => setEditing(false)}
                                        className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
                                    >
                                        ยกเลิก
                                    </button>
                                    <button
                                        onClick={handleSaveEdit}
                                        className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg flex items-center gap-2"
                                    >
                                        <Check size={18} />
                                        บันทึก
                                    </button>
                                </>
                            ) : (
                                <button
                                    onClick={() => { setSelectedShift(null); }}
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
