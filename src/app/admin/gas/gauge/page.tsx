'use client';

import { useEffect, useState } from 'react';
import { Loader2, Gauge, Search, Download } from 'lucide-react';
import { getTodayBangkok } from '@/lib/gas';

interface GaugeReading {
    id: string;
    date: string;
    displayDate: string;
    stationId: string;
    stationName: string;
    shiftNumber: number;
    tankNumber: number;
    percentage: number;
    notes: string | null;
    createdAt: string;
}

export default function GaugeHistoryPage() {
    const [loading, setLoading] = useState(true);
    const [readings, setReadings] = useState<GaugeReading[]>([]);
    const [stationId, setStationId] = useState<string>('all');
    const [tankFilter, setTankFilter] = useState<string>('all');
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

    const fetchReadings = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                from: fromDate,
                to: toDate,
                ...(stationId !== 'all' && { stationId }),
                ...(tankFilter !== 'all' && { tank: tankFilter })
            });

            const res = await fetch(`/api/v2/gas/admin/gauge?${params}`);
            if (res.ok) {
                const data = await res.json();
                setReadings(data.readings || []);
            }
        } catch (error) {
            console.error('Error fetching readings:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReadings();
    }, [fromDate, toDate, stationId, tankFilter]);

    const getPercentageColor = (pct: number) => {
        if (pct >= 50) return 'text-green-400';
        if (pct >= 25) return 'text-yellow-400';
        return 'text-red-400';
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Gauge className="text-cyan-400" />
                        ประวัติเกจ
                    </h1>
                </div>

                <button
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
                        <label className="block text-sm text-gray-400 mb-1">ถัง</label>
                        <select
                            value={tankFilter}
                            onChange={(e) => setTankFilter(e.target.value)}
                            className="w-full bg-gray-800 border border-white/10 rounded-lg px-3 py-2"
                        >
                            <option value="all">ทุกถัง</option>
                            <option value="1">ถัง 1</option>
                            <option value="2">ถัง 2</option>
                            <option value="3">ถัง 3</option>
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
                        onClick={fetchReadings}
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
                ) : readings.length === 0 ? (
                    <div className="p-12 text-center text-gray-500">
                        ไม่พบข้อมูล
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-800/50">
                                <tr>
                                    <th className="text-left px-4 py-3 font-medium text-gray-400">วันที่</th>
                                    <th className="text-left px-4 py-3 font-medium text-gray-400">เวลา</th>
                                    <th className="text-left px-4 py-3 font-medium text-gray-400">สถานี</th>
                                    <th className="text-center px-4 py-3 font-medium text-gray-400">กะ</th>
                                    <th className="text-center px-4 py-3 font-medium text-gray-400">ถัง</th>
                                    <th className="text-right px-4 py-3 font-medium text-gray-400">เปอร์เซ็นต์</th>
                                    <th className="text-left px-4 py-3 font-medium text-gray-400">หมายเหตุ</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {readings.map((r) => (
                                    <tr key={r.id} className="hover:bg-white/5">
                                        <td className="px-4 py-3">{r.displayDate}</td>
                                        <td className="px-4 py-3 text-gray-400">
                                            {new Date(r.createdAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                                        </td>
                                        <td className="px-4 py-3">{r.stationName}</td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`px-2 py-1 rounded text-xs ${r.shiftNumber === 1 ? 'bg-blue-900/50 text-blue-300' : 'bg-purple-900/50 text-purple-300'}`}>
                                                กะ {r.shiftNumber}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className="px-2 py-1 rounded text-xs bg-gray-700 text-gray-300">
                                                ถัง {r.tankNumber}
                                            </span>
                                        </td>
                                        <td className={`px-4 py-3 text-right font-mono font-bold ${getPercentageColor(r.percentage)}`}>
                                            {r.percentage}%
                                        </td>
                                        <td className="px-4 py-3 text-gray-400">
                                            {r.notes === 'start' ? '🟢 เปิดกะ' :
                                                r.notes === 'end' ? '🔴 ปิดกะ' :
                                                    r.notes || '-'}
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
