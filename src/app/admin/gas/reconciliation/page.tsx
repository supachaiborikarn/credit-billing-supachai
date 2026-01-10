'use client';

import { useEffect, useState } from 'react';
import { Loader2, Scale, Search, Download, Check, AlertTriangle, Minus } from 'lucide-react';
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
    cashExpected: number;
    cashReceived: number;
    creditExpected: number;
    creditReceived: number;
    totalExpected: number;
    totalReceived: number;
    variance: number;
    varianceStatus: 'OVER' | 'SHORT' | 'BALANCED';
}

export default function ReconciliationPage() {
    const [loading, setLoading] = useState(true);
    const [records, setRecords] = useState<ReconciliationRecord[]>([]);
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
            .then(data => setStations(data.stations?.filter((s: { type: string }) => s.type === 'GAS') || []))
            .catch(console.error);
    }, []);

    const fetchRecords = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                from: fromDate,
                to: toDate,
                ...(stationId !== 'all' && { stationId }),
                ...(statusFilter !== 'all' && { status: statusFilter })
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
    };

    useEffect(() => {
        fetchRecords();
    }, [fromDate, toDate, stationId, statusFilter]);

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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                        onClick={fetchRecords}
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
                                    <th className="text-right px-4 py-3 font-medium text-gray-400">คาดหวัง</th>
                                    <th className="text-right px-4 py-3 font-medium text-gray-400">รับจริง</th>
                                    <th className="text-right px-4 py-3 font-medium text-gray-400">ส่วนต่าง</th>
                                    <th className="text-center px-4 py-3 font-medium text-gray-400">สถานะ</th>
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
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
