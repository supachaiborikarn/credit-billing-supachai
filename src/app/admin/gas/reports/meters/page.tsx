'use client';

import { useEffect, useState } from 'react';
import { Loader2, Calculator, Download, Search } from 'lucide-react';
import { formatCurrency, getTodayBangkok } from '@/lib/gas';

interface MeterReport {
    id: string;
    date: string;
    displayDate: string;
    stationId: string;
    stationName: string;
    shiftNumber: number;
    nozzles: {
        nozzleNumber: number;
        startReading: number;
        endReading: number;
        soldQty: number;
    }[];
    totalLiters: number;
    transactionLiters: number;
    litersVariance: number;
    gasPrice: number;
    expectedSales: number;
    actualSales: number;
    transactionCount: number;
    averagePerNozzle: number;
}

async function loadMeterReports({
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
    setReports: (value: MeterReport[]) => void;
}) {
    setLoading(true);
    try {
        const params = new URLSearchParams({
            from: fromDate,
            to: toDate,
            ...(stationId !== 'all' && { stationId }),
        });

        const res = await fetch(`/api/v2/gas/admin/reports/meters?${params}`);
        if (res.ok) {
            const data = await res.json();
            setReports(data.meters || []);
        }
    } catch (error) {
        console.error('Error fetching reports:', error);
    } finally {
        setLoading(false);
    }
}

export default function MeterReportPage() {
    const [loading, setLoading] = useState(true);
    const [reports, setReports] = useState<MeterReport[]>([]);
    const [stationId, setStationId] = useState<string>('all');
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
        void loadMeterReports({
            fromDate,
            toDate,
            stationId,
            setLoading,
            setReports,
        });
    }, [fromDate, toDate, stationId]);

    const handleExportCSV = async () => {
        const params = new URLSearchParams({
            from: fromDate,
            to: toDate,
            type: 'meters',
            ...(stationId !== 'all' && { stationId })
        });
        window.open(`/api/export/csv?${params}`, '_blank');
    };

    const totals = reports.reduce((sum, report) => ({
        meterLiters: sum.meterLiters + report.totalLiters,
        transactionLiters: sum.transactionLiters + report.transactionLiters,
        actualSales: sum.actualSales + report.actualSales,
        expectedSales: sum.expectedSales + report.expectedSales,
        transactions: sum.transactions + report.transactionCount,
    }), {
        meterLiters: 0,
        transactionLiters: 0,
        actualSales: 0,
        expectedSales: 0,
        transactions: 0,
    });

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Calculator className="text-orange-400" />
                        รายงานมิเตอร์
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

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-[#1a1a24] rounded-xl p-4 border border-white/10">
                    <div className="text-sm text-gray-400">ลิตรมิเตอร์รวม</div>
                    <div className="text-2xl font-bold text-green-400">{totals.meterLiters.toLocaleString()} L</div>
                </div>
                <div className="bg-[#1a1a24] rounded-xl p-4 border border-white/10">
                    <div className="text-sm text-gray-400">ลิตรจากรายการขาย</div>
                    <div className="text-2xl font-bold text-cyan-400">{totals.transactionLiters.toLocaleString()} L</div>
                </div>
                <div className="bg-[#1a1a24] rounded-xl p-4 border border-white/10">
                    <div className="text-sm text-gray-400">ยอดขายจริง</div>
                    <div className="text-2xl font-bold text-blue-400">฿{formatCurrency(totals.actualSales)}</div>
                </div>
                <div className="bg-[#1a1a24] rounded-xl p-4 border border-white/10">
                    <div className="text-sm text-gray-400">ส่วนต่างลิตรรวม</div>
                    <div className={`text-2xl font-bold ${totals.transactionLiters - totals.meterLiters >= 0 ? 'text-yellow-400' : 'text-red-400'}`}>
                        {totals.transactionLiters - totals.meterLiters >= 0 ? '+' : ''}
                        {(totals.transactionLiters - totals.meterLiters).toLocaleString()} L
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
                            void loadMeterReports({
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
                                    <th className="text-left px-4 py-3 font-medium text-gray-400">สถานี</th>
                                    <th className="text-center px-4 py-3 font-medium text-gray-400">กะ</th>
                                    <th className="text-right px-4 py-3 font-medium text-gray-400">หัว 1</th>
                                    <th className="text-right px-4 py-3 font-medium text-gray-400">หัว 2</th>
                                    <th className="text-right px-4 py-3 font-medium text-gray-400">หัว 3</th>
                                    <th className="text-right px-4 py-3 font-medium text-gray-400">หัว 4</th>
                                    <th className="text-right px-4 py-3 font-medium text-gray-400">รวม (L)</th>
                                    <th className="text-right px-4 py-3 font-medium text-gray-400">ขายจริง (L)</th>
                                    <th className="text-right px-4 py-3 font-medium text-gray-400">ส่วนต่าง</th>
                                    <th className="text-right px-4 py-3 font-medium text-gray-400">รายการ</th>
                                    <th className="text-right px-4 py-3 font-medium text-gray-400">ยอดขายจริง</th>
                                    <th className="text-right px-4 py-3 font-medium text-gray-400">ยอดคาดหวัง</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {reports.map((r) => (
                                    <tr key={r.id} className="hover:bg-white/5">
                                        <td className="px-4 py-3">{r.displayDate}</td>
                                        <td className="px-4 py-3">{r.stationName}</td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`px-2 py-1 rounded text-xs ${r.shiftNumber === 1 ? 'bg-blue-900/50 text-blue-300' : 'bg-purple-900/50 text-purple-300'}`}>
                                                กะ {r.shiftNumber}
                                            </span>
                                        </td>
                                        {[1, 2, 3, 4].map(n => {
                                            const nozzle = r.nozzles.find(z => z.nozzleNumber === n);
                                            return (
                                                <td key={n} className="px-4 py-2 text-right">
                                                    {nozzle ? (
                                                        <div className="space-y-0.5">
                                                            <div className="font-mono font-bold text-green-400">
                                                                {nozzle.soldQty.toLocaleString()}
                                                            </div>
                                                            <div className="text-xs text-gray-500 font-mono">
                                                                {nozzle.startReading.toLocaleString()} → {nozzle.endReading.toLocaleString()}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <span className="text-gray-600">-</span>
                                                    )}
                                                </td>
                                            );
                                        })}
                                        <td className="px-4 py-3 text-right font-mono text-green-400 font-bold">
                                            {r.totalLiters.toLocaleString()}
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono text-cyan-400">
                                            {r.transactionLiters.toLocaleString()}
                                        </td>
                                        <td className={`px-4 py-3 text-right font-mono ${r.litersVariance >= 0 ? 'text-yellow-400' : 'text-red-400'}`}>
                                            {r.litersVariance >= 0 ? '+' : ''}{r.litersVariance.toLocaleString()}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            {r.transactionCount}
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono text-blue-400">
                                            ฿{formatCurrency(r.actualSales)}
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono text-cyan-400">
                                            ฿{formatCurrency(r.expectedSales)}
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
