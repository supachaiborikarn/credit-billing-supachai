'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
    Building2,
    TrendingUp,
    Fuel,
    Loader2,
    ChevronRight
} from 'lucide-react';

interface StationData {
    id: string;
    name: string;
    totalLiters: number;
    totalRevenue: number;
    totalTransactions: number;
    margin: number | null;
    profit: number | null;
    byNozzle: { nozzle: number | null; liters: number; revenue: number; count: number }[];
}

interface StationsResponse {
    period: { days: number };
    stations: StationData[];
}

const formatCurrency = (n: number) => n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatNumber = (n: number) => n.toLocaleString('th-TH');

export default function StationsPage() {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<StationsResponse | null>(null);
    const [days, setDays] = useState(7);
    const [expanded, setExpanded] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const res = await fetch(`/api/v2/simple/admin/stations?days=${days}`);
                if (res.ok) {
                    const json = await res.json();
                    setData(json);
                }
            } catch (error) {
                console.error('Error:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [days]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="animate-spin text-blue-400" size={40} />
            </div>
        );
    }

    if (!data) {
        return <div className="text-center py-12 text-gray-400">ไม่สามารถโหลดข้อมูลได้</div>;
    }

    const maxRevenue = Math.max(...data.stations.map(s => s.totalRevenue), 1);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Building2 className="text-blue-400" />
                        Station Performance
                    </h1>
                    <p className="text-gray-400 text-sm">เปรียบเทียบผลงานแต่ละปั๊ม</p>
                </div>

                {/* Period Selector */}
                <div className="flex gap-2">
                    {[7, 30, 90].map(d => (
                        <button
                            key={d}
                            onClick={() => setDays(d)}
                            className={`px-4 py-2 rounded-lg text-sm transition-colors ${days === d
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                                }`}
                        >
                            {d} วัน
                        </button>
                    ))}
                </div>
            </div>

            {/* Bar Chart Comparison */}
            <div className="bg-[#1a1a24] rounded-xl p-6 border border-white/10">
                <h2 className="text-lg font-semibold mb-4">📊 เปรียบเทียบยอดขาย</h2>
                <div className="space-y-4">
                    {data.stations.map(s => (
                        <div key={s.id} className="space-y-1">
                            <div className="flex justify-between text-sm">
                                <span>{s.name}</span>
                                <span className="text-blue-400">฿{formatCurrency(s.totalRevenue)}</span>
                            </div>
                            <div className="h-8 bg-gray-800 rounded-lg overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-blue-600 to-cyan-500 rounded-lg"
                                    style={{ width: `${(s.totalRevenue / maxRevenue) * 100}%` }}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Detailed Table */}
            <div className="bg-[#1a1a24] rounded-xl border border-white/10 overflow-hidden">
                <div className="p-4 border-b border-white/10">
                    <h2 className="text-lg font-semibold">📋 รายละเอียดแต่ละปั๊ม</h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-900/50">
                            <tr className="text-sm text-gray-400">
                                <th className="text-left py-3 px-4">สถานี</th>
                                <th className="text-right py-3 px-4">ลิตร</th>
                                <th className="text-right py-3 px-4">Revenue</th>
                                <th className="text-right py-3 px-4">รายการ</th>
                                <th className="text-center py-3 px-4"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.stations.map(s => (
                                <>
                                    <tr
                                        key={s.id}
                                        className="border-t border-white/5 hover:bg-white/5 cursor-pointer"
                                        onClick={() => setExpanded(expanded === s.id ? null : s.id)}
                                    >
                                        <td className="py-3 px-4 font-medium">{s.name}</td>
                                        <td className="py-3 px-4 text-right text-green-400">{formatNumber(s.totalLiters)}</td>
                                        <td className="py-3 px-4 text-right text-blue-400">฿{formatCurrency(s.totalRevenue)}</td>
                                        <td className="py-3 px-4 text-right">{s.totalTransactions}</td>
                                        <td className="py-3 px-4 text-center">
                                            <ChevronRight
                                                size={18}
                                                className={`transition-transform ${expanded === s.id ? 'rotate-90' : ''}`}
                                            />
                                        </td>
                                    </tr>
                                    {expanded === s.id && s.byNozzle.length > 0 && (
                                        <tr className="bg-gray-900/30">
                                            <td colSpan={5} className="p-4">
                                                <div className="text-sm text-gray-400 mb-2">ยอดขายต่อหัวจ่าย:</div>
                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                                    {s.byNozzle.map(n => (
                                                        <div key={n.nozzle} className="bg-black/30 rounded-lg p-3">
                                                            <div className="text-gray-400 text-xs">หัว {n.nozzle || '?'}</div>
                                                            <div className="text-green-400">{formatNumber(n.liters)} L</div>
                                                            <div className="text-blue-400 text-sm">฿{formatCurrency(n.revenue)}</div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
