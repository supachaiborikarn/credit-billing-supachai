'use client';

import { useEffect, useState } from 'react';
import { Loader2, FileText, Download, Search, Eye } from 'lucide-react';
import { formatCurrency, getGasBusinessDateKey } from '@/lib/gas';
import DateRangePresets from '@/app/admin/gas/components/DateRangePresets';

interface DayReport {
    dateKey: string;
    displayDate: string;
    totalSales: number;
    totalReceived: number;
    totalLiters: number;
    meterLiters: number;
    transactionLiters: number;
    litersVariance: number;
    transactionCount: number;
    shiftCount: number;
    cashAmount: number;
    creditAmount: number;
    cardAmount: number;
    transferAmount: number;
    averageTicket: number;
    variance: number;
    stationBreakdown: Array<{
        stationId: string;
        stationName: string;
        totalSales: number;
        totalReceived: number;
        totalLiters: number;
        meterLiters: number;
        transactionLiters: number;
        litersVariance: number;
        transactionCount: number;
        shiftCount: number;
    }>;
}

async function loadDailyReports({
    fromDate,
    toDate,
    stationId,
    setLoading,
    setReports,
}: {
    fromDate: string;
    toDate: string;
    stationId: string;
    setLoading: (value: boolean) => void;
    setReports: (value: DayReport[]) => void;
}) {
    setLoading(true);
    try {
        const params = new URLSearchParams({
            from: fromDate,
            to: toDate,
            ...(stationId !== 'all' && { stationId }),
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
    const [toDate, setToDate] = useState<string>(getGasBusinessDateKey());
    const [stations, setStations] = useState<{ id: string; name: string }[]>([]);

    // Selected row for detail view
    const [selectedDate, setSelectedDate] = useState<string | null>(null);

    // Fetch stations
    useEffect(() => {
        fetch('/api/stations')
            .then(res => res.json())
            .then(data => {
                // Handle both array and { stations: [] } response
                const stationList = Array.isArray(data) ? data : (data.stations || []);
                // Filter only GAS type stations
                const gasStations = stationList.filter((s: { type?: string }) => s.type === 'GAS');
                setStations(gasStations);
            })
            .catch(console.error);
    }, []);

    // Fetch reports
    useEffect(() => {
        void loadDailyReports({
            fromDate,
            toDate,
            stationId,
            setLoading,
            setReports,
        });
    }, [fromDate, toDate, stationId]);

    // Calculate totals
    const totals = reports.reduce((sum, r) => ({
        sales: sum.sales + r.totalSales,
        received: sum.received + r.totalReceived,
        liters: sum.liters + r.totalLiters,
        transactions: sum.transactions + r.transactionCount,
        cash: sum.cash + r.cashAmount,
        credit: sum.credit + r.creditAmount,
        card: sum.card + r.cardAmount,
        transfer: sum.transfer + r.transferAmount
    }), { sales: 0, received: 0, liters: 0, transactions: 0, cash: 0, credit: 0, card: 0, transfer: 0 });

    const selectedDayReport = reports.find((report) => report.dateKey === selectedDate) || null;

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

                    <div className="pb-1">
                        <DateRangePresets
                            fromDate={fromDate}
                            toDate={toDate}
                            onSelect={(from, to) => { setFromDate(from); setToDate(to); }}
                        />
                    </div>

                    <button
                        onClick={() => {
                            void loadDailyReports({
                                fromDate,
                                toDate,
                                stationId,
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
                                        <td className="px-4 py-3 text-center">
                                            {r.shiftCount > 0 ? (
                                                r.shiftCount
                                            ) : r.transactionCount > 0 ? (
                                                <span className="rounded-full border border-amber-400/40 bg-amber-500/10 px-2 py-1 text-xs font-semibold text-amber-300">
                                                    ไม่ผูกกะ
                                                </span>
                                            ) : (
                                                0
                                            )}
                                        </td>
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

            {selectedDayReport && (
                <div className="bg-[#1a1a24] rounded-xl border border-white/10 p-5 space-y-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h2 className="text-lg font-semibold">รายละเอียด {selectedDayReport.displayDate}</h2>
                            <p className="text-sm text-gray-400">
                                เปรียบเทียบยอดขาย, ยอดรับจริง และความต่างลิตรในวันเดียวกัน
                            </p>
                        </div>
                        <button
                            onClick={() => setSelectedDate(null)}
                            className="text-sm text-gray-400 hover:text-white"
                        >
                            ปิดรายละเอียด
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="rounded-xl bg-gray-800/70 p-4 border border-white/10">
                            <div className="text-sm text-gray-400">ยอดขายจริง</div>
                            <div className="text-2xl font-bold text-green-400">฿{formatCurrency(selectedDayReport.totalSales)}</div>
                            <div className="text-xs text-gray-500 mt-1">
                                รับเงินจริง ฿{formatCurrency(selectedDayReport.totalReceived)}
                            </div>
                        </div>
                        <div className="rounded-xl bg-gray-800/70 p-4 border border-white/10">
                            <div className="text-sm text-gray-400">ลิตรจากรายการขาย</div>
                            <div className="text-2xl font-bold text-cyan-400">
                                {selectedDayReport.totalLiters.toLocaleString()} L
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                                มิเตอร์ {selectedDayReport.meterLiters.toLocaleString()} L
                            </div>
                        </div>
                        <div className="rounded-xl bg-gray-800/70 p-4 border border-white/10">
                            <div className="text-sm text-gray-400">ค่าเฉลี่ยต่อบิล</div>
                            <div className="text-2xl font-bold text-purple-400">฿{formatCurrency(selectedDayReport.averageTicket)}</div>
                            <div className="text-xs text-gray-500 mt-1">
                                {selectedDayReport.shiftCount > 0
                                    ? `${selectedDayReport.transactionCount} รายการ / ${selectedDayReport.shiftCount} กะ`
                                    : `${selectedDayReport.transactionCount} รายการ / ไม่ผูกกะ`}
                            </div>
                        </div>
                        <div className="rounded-xl bg-gray-800/70 p-4 border border-white/10">
                            <div className="text-sm text-gray-400">ลิตรต่าง (ขาย - มิเตอร์)</div>
                            <div className={`text-2xl font-bold ${selectedDayReport.litersVariance >= 0 ? 'text-yellow-400' : 'text-red-400'}`}>
                                {selectedDayReport.litersVariance >= 0 ? '+' : ''}
                                {selectedDayReport.litersVariance.toLocaleString()} L
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                                ส่วนต่างเงิน {selectedDayReport.variance >= 0 ? '+' : ''}฿{formatCurrency(selectedDayReport.variance)}
                            </div>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="text-left text-gray-400 border-b border-white/10">
                                <tr>
                                    <th className="py-2 pr-4">สถานี</th>
                                    <th className="py-2 pr-4 text-right">ยอดขาย</th>
                                    <th className="py-2 pr-4 text-right">รับจริง</th>
                                    <th className="py-2 pr-4 text-right">ลิตรขาย</th>
                                    <th className="py-2 pr-4 text-right">ลิตรมิเตอร์</th>
                                    <th className="py-2 pr-4 text-right">รายการ</th>
                                </tr>
                            </thead>
                            <tbody>
                                {selectedDayReport.stationBreakdown.map((station) => (
                                    <tr key={station.stationId} className="border-b border-white/5 last:border-b-0">
                                        <td className="py-3 pr-4 font-medium">
                                            <div>{station.stationName}</div>
                                            {station.shiftCount === 0 && station.transactionCount > 0 && (
                                                <div className="mt-1 text-xs font-semibold text-amber-300">
                                                    รายการขายยังไม่ผูกกะ
                                                </div>
                                            )}
                                        </td>
                                        <td className="py-3 pr-4 text-right font-mono text-green-400">
                                            ฿{formatCurrency(station.totalSales)}
                                        </td>
                                        <td className="py-3 pr-4 text-right font-mono text-cyan-400">
                                            ฿{formatCurrency(station.totalReceived)}
                                        </td>
                                        <td className="py-3 pr-4 text-right font-mono">
                                            {station.totalLiters.toLocaleString()} L
                                        </td>
                                        <td className="py-3 pr-4 text-right font-mono text-gray-400">
                                            {station.meterLiters.toLocaleString()} L
                                        </td>
                                        <td className="py-3 pr-4 text-right">
                                            {station.transactionCount}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
