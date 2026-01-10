'use client';

import { useEffect, useState } from 'react';
import { Loader2, FileText, Download, Search, Edit2, Eye } from 'lucide-react';
import { formatCurrency, formatThaiDate, getTodayBangkok } from '@/lib/gas';

interface DayReport {
    dateKey: string;
    displayDate: string;
    totalSales: number;
    totalLiters: number;
    transactionCount: number;
    shiftCount: number;
    cashAmount: number;
    creditAmount: number;
    cardAmount: number;
    transferAmount: number;
}

export default function DailyReportPage() {
    const [loading, setLoading] = useState(true);
    const [reports, setReports] = useState<DayReport[]>([]);
    const [stationId, setStationId] = useState<string>('all');
    const [fromDate, setFromDate] = useState<string>(() => {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        return d.toISOString().split('T')[0];
    });
    const [toDate, setToDate] = useState<string>(getTodayBangkok());
    const [stations, setStations] = useState<{ id: string; name: string }[]>([]);

    // Selected row for detail view
    const [selectedDate, setSelectedDate] = useState<string | null>(null);

    // Fetch stations
    useEffect(() => {
        fetch('/api/stations')
            .then(res => res.json())
            .then(data => setStations(data.stations || []))
            .catch(console.error);
    }, []);

    // Fetch reports
    const fetchReports = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                from: fromDate,
                to: toDate,
                ...(stationId !== 'all' && { stationId })
            });

            const res = await fetch(`/api/v2/gas/admin/reports/daily?${params}`);
            if (res.ok) {
                const data = await res.json();
                setReports(data.days || []);
            }
        } catch (error) {
            console.error('Error fetching reports:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReports();
    }, [fromDate, toDate, stationId]);

    // Calculate totals
    const totals = reports.reduce((sum, r) => ({
        sales: sum.sales + r.totalSales,
        liters: sum.liters + r.totalLiters,
        transactions: sum.transactions + r.transactionCount,
        cash: sum.cash + r.cashAmount,
        credit: sum.credit + r.creditAmount,
        card: sum.card + r.cardAmount,
        transfer: sum.transfer + r.transferAmount
    }), { sales: 0, liters: 0, transactions: 0, cash: 0, credit: 0, card: 0, transfer: 0 });

    const handleExportCSV = async () => {
        const params = new URLSearchParams({
            from: fromDate,
            to: toDate,
            type: 'daily',
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
                        <FileText className="text-purple-400" />
                        รายงานรายวัน
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
                    <div className="flex-1 min-w-[200px]">
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

                    <div className="flex-1 min-w-[150px]">
                        <label className="block text-sm text-gray-400 mb-1">จากวันที่</label>
                        <input
                            type="date"
                            value={fromDate}
                            onChange={(e) => setFromDate(e.target.value)}
                            className="w-full bg-gray-800 border border-white/10 rounded-lg px-3 py-2"
                        />
                    </div>

                    <div className="flex-1 min-w-[150px]">
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
                                    <th className="text-right px-4 py-3 font-medium text-gray-400">ยอดขาย</th>
                                    <th className="text-right px-4 py-3 font-medium text-gray-400">ลิตร</th>
                                    <th className="text-right px-4 py-3 font-medium text-gray-400">รายการ</th>
                                    <th className="text-right px-4 py-3 font-medium text-green-400">เงินสด</th>
                                    <th className="text-right px-4 py-3 font-medium text-purple-400">เงินเชื่อ</th>
                                    <th className="text-right px-4 py-3 font-medium text-blue-400">บัตร</th>
                                    <th className="text-right px-4 py-3 font-medium text-cyan-400">โอน</th>
                                    <th className="text-center px-4 py-3 font-medium text-gray-400">กะ</th>
                                    <th className="text-center px-4 py-3 font-medium text-gray-400"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {reports.map((r) => (
                                    <tr
                                        key={r.dateKey}
                                        className={`hover:bg-white/5 transition-colors ${selectedDate === r.dateKey ? 'bg-purple-900/20' : ''
                                            }`}
                                    >
                                        <td className="px-4 py-3 font-medium">{r.displayDate}</td>
                                        <td className="px-4 py-3 text-right font-mono text-green-400">
                                            ฿{formatCurrency(r.totalSales)}
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono">
                                            {r.totalLiters.toLocaleString()}
                                        </td>
                                        <td className="px-4 py-3 text-right">{r.transactionCount}</td>
                                        <td className="px-4 py-3 text-right font-mono text-green-400">
                                            {formatCurrency(r.cashAmount)}
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono text-purple-400">
                                            {formatCurrency(r.creditAmount)}
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono text-blue-400">
                                            {formatCurrency(r.cardAmount)}
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono text-cyan-400">
                                            {formatCurrency(r.transferAmount)}
                                        </td>
                                        <td className="px-4 py-3 text-center">{r.shiftCount}</td>
                                        <td className="px-4 py-3 text-center">
                                            <button
                                                onClick={() => setSelectedDate(r.dateKey)}
                                                className="p-1 hover:bg-white/10 rounded"
                                                title="ดูรายละเอียด"
                                            >
                                                <Eye size={16} className="text-gray-400" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-gray-800/50 font-medium">
                                <tr>
                                    <td className="px-4 py-3">รวม</td>
                                    <td className="px-4 py-3 text-right font-mono text-green-400">
                                        ฿{formatCurrency(totals.sales)}
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono">
                                        {totals.liters.toLocaleString()}
                                    </td>
                                    <td className="px-4 py-3 text-right">{totals.transactions}</td>
                                    <td className="px-4 py-3 text-right font-mono text-green-400">
                                        {formatCurrency(totals.cash)}
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono text-purple-400">
                                        {formatCurrency(totals.credit)}
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono text-blue-400">
                                        {formatCurrency(totals.card)}
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono text-cyan-400">
                                        {formatCurrency(totals.transfer)}
                                    </td>
                                    <td colSpan={2}></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
