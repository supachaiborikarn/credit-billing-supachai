'use client';

import { useEffect, useState } from 'react';
import {
    TrendingUp,
    TrendingDown,
    Users,
    Calendar,
    Loader2,
    ArrowUpRight,
    ArrowDownRight
} from 'lucide-react';
import { STATIONS } from '@/constants';

interface AnalyticsData {
    weekComparison: {
        thisWeek: { liters: number; revenue: number; transactions: number };
        lastWeek: { liters: number; revenue: number; transactions: number };
        change: { liters: number; revenue: number };
    };
    monthComparison: {
        thisMonth: { liters: number; revenue: number; transactions: number };
        lastMonth: { liters: number; revenue: number; transactions: number };
        change: { liters: number; revenue: number };
    };
    topCustomers: { ownerId: string; ownerName: string; liters: number; revenue: number; count: number }[];
    heatmap: { date: string; stations: { stationId: string; stationName: string; revenue: number; liters: number }[] }[];
    dailyTrend: { date: string; revenue: number; liters: number }[];
    stations: { id: string; name: string }[];
}

const formatCurrency = (n: number) => n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatNumber = (n: number) => n.toLocaleString('th-TH', { maximumFractionDigits: 0 });

export default function AnalyticsPage() {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [selectedStation, setSelectedStation] = useState<string>('');

    const simpleStations = STATIONS.filter(s => s.type === 'SIMPLE');

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const url = selectedStation
                    ? `/api/v2/simple/admin/analytics?stationId=${selectedStation}&type=SIMPLE`
                    : '/api/v2/simple/admin/analytics?type=SIMPLE';
                const res = await fetch(url);
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
    }, [selectedStation]);

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

    const maxTrend = Math.max(...data.dailyTrend.map(d => d.revenue), 1);
    const maxHeatmap = Math.max(...data.heatmap.flatMap(h => h.stations.map(s => s.revenue)), 1);

    const getHeatColor = (value: number) => {
        if (value === 0) return 'bg-gray-800';
        const intensity = value / maxHeatmap;
        if (intensity > 0.8) return 'bg-blue-400';
        if (intensity > 0.6) return 'bg-blue-500';
        if (intensity > 0.4) return 'bg-blue-600';
        if (intensity > 0.2) return 'bg-blue-700';
        return 'bg-blue-800';
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold">📊 Advanced Analytics</h1>
                    <p className="text-gray-400 text-sm">วิเคราะห์เชิงลึก ปั๊มน้ำมัน Simple</p>
                </div>
                <select
                    value={selectedStation}
                    onChange={(e) => setSelectedStation(e.target.value)}
                    className="px-4 py-2 bg-gray-800 border border-white/10 rounded-lg text-white"
                >
                    <option value="">ทุกสถานี</option>
                    {simpleStations.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                </select>
            </div>

            {/* Week vs Week Comparison */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-[#1a1a24] rounded-xl p-6 border border-white/10">
                    <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <Calendar className="text-blue-400" size={20} />
                        สัปดาห์นี้ vs สัปดาห์ก่อน
                    </h2>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <div className="text-sm text-gray-400">สัปดาห์นี้</div>
                            <div className="text-2xl font-bold text-blue-400">
                                ฿{formatCurrency(data.weekComparison.thisWeek.revenue)}
                            </div>
                            <div className="text-sm text-gray-500">{formatNumber(data.weekComparison.thisWeek.liters)} L</div>
                        </div>
                        <div>
                            <div className="text-sm text-gray-400">สัปดาห์ก่อน</div>
                            <div className="text-2xl font-bold text-gray-400">
                                ฿{formatCurrency(data.weekComparison.lastWeek.revenue)}
                            </div>
                            <div className="text-sm text-gray-500">{formatNumber(data.weekComparison.lastWeek.liters)} L</div>
                        </div>
                    </div>
                    <div className={`mt-4 flex items-center gap-2 text-lg font-bold ${data.weekComparison.change.revenue >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {data.weekComparison.change.revenue >= 0 ? <ArrowUpRight size={24} /> : <ArrowDownRight size={24} />}
                        {data.weekComparison.change.revenue >= 0 ? '+' : ''}{data.weekComparison.change.revenue.toFixed(1)}%
                    </div>
                </div>

                <div className="bg-[#1a1a24] rounded-xl p-6 border border-white/10">
                    <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <Calendar className="text-purple-400" size={20} />
                        เดือนนี้ vs เดือนก่อน
                    </h2>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <div className="text-sm text-gray-400">เดือนนี้</div>
                            <div className="text-2xl font-bold text-purple-400">
                                ฿{formatCurrency(data.monthComparison.thisMonth.revenue)}
                            </div>
                            <div className="text-sm text-gray-500">{formatNumber(data.monthComparison.thisMonth.liters)} L</div>
                        </div>
                        <div>
                            <div className="text-sm text-gray-400">เดือนก่อน</div>
                            <div className="text-2xl font-bold text-gray-400">
                                ฿{formatCurrency(data.monthComparison.lastMonth.revenue)}
                            </div>
                            <div className="text-sm text-gray-500">{formatNumber(data.monthComparison.lastMonth.liters)} L</div>
                        </div>
                    </div>
                    <div className={`mt-4 flex items-center gap-2 text-lg font-bold ${data.monthComparison.change.revenue >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {data.monthComparison.change.revenue >= 0 ? <ArrowUpRight size={24} /> : <ArrowDownRight size={24} />}
                        {data.monthComparison.change.revenue >= 0 ? '+' : ''}{data.monthComparison.change.revenue.toFixed(1)}%
                    </div>
                </div>
            </div>

            {/* Daily Trend Line Chart */}
            <div className="bg-[#1a1a24] rounded-xl p-6 border border-white/10">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <TrendingUp className="text-green-400" size={20} />
                    กราฟเส้น Trend 30 วัน
                </h2>
                <div className="overflow-x-auto">
                    <div className="relative h-48 min-w-[600px]">
                        {/* Y-axis labels */}
                        <div className="absolute left-0 top-0 bottom-6 w-16 flex flex-col justify-between text-xs text-gray-500">
                            <span>฿{formatNumber(maxTrend)}</span>
                            <span>฿{formatNumber(maxTrend / 2)}</span>
                            <span>฿0</span>
                        </div>
                        {/* Chart area */}
                        <div className="ml-16 h-full">
                            <svg className="w-full h-full" viewBox="0 0 600 180" preserveAspectRatio="none">
                                {/* Grid lines */}
                                <line x1="0" y1="45" x2="600" y2="45" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                                <line x1="0" y1="90" x2="600" y2="90" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                                <line x1="0" y1="135" x2="600" y2="135" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />

                                {/* Line path */}
                                <polyline
                                    fill="none"
                                    stroke="url(#lineGradient)"
                                    strokeWidth="3"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    points={data.dailyTrend.map((d, i) => {
                                        const x = (i / (data.dailyTrend.length - 1)) * 600;
                                        const y = 180 - (d.revenue / maxTrend) * 170;
                                        return `${x},${y}`;
                                    }).join(' ')}
                                />

                                {/* Area fill */}
                                <polygon
                                    fill="url(#areaGradient)"
                                    points={`0,180 ${data.dailyTrend.map((d, i) => {
                                        const x = (i / (data.dailyTrend.length - 1)) * 600;
                                        const y = 180 - (d.revenue / maxTrend) * 170;
                                        return `${x},${y}`;
                                    }).join(' ')} 600,180`}
                                />

                                {/* Gradients */}
                                <defs>
                                    <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                                        <stop offset="0%" stopColor="#3b82f6" />
                                        <stop offset="100%" stopColor="#22d3ee" />
                                    </linearGradient>
                                    <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="rgba(59,130,246,0.3)" />
                                        <stop offset="100%" stopColor="rgba(59,130,246,0)" />
                                    </linearGradient>
                                </defs>
                            </svg>
                        </div>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 ml-16 mt-2 min-w-[600px]">
                        <span>{new Date(data.dailyTrend[0]?.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}</span>
                        <span>วันนี้</span>
                    </div>
                </div>
            </div>

            {/* Heatmap by Station */}
            <div className="bg-[#1a1a24] rounded-xl p-6 border border-white/10">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Calendar className="text-orange-400" size={20} />
                    Heatmap แยกสถานี (30 วัน)
                </h2>
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[700px]">
                        <thead>
                            <tr>
                                <th className="text-left py-2 px-2 text-sm text-gray-400 sticky left-0 bg-[#1a1a24]">สถานี</th>
                                {data.heatmap.slice(-14).map(h => (
                                    <th key={h.date} className="text-center py-2 px-1 text-xs text-gray-500">
                                        {new Date(h.date).getDate()}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {data.stations.map(station => (
                                <tr key={station.id}>
                                    <td className="py-2 px-2 text-sm truncate max-w-[120px] sticky left-0 bg-[#1a1a24]">{station.name}</td>
                                    {data.heatmap.slice(-14).map(h => {
                                        const stationData = h.stations.find(s => s.stationId === station.id);
                                        const revenue = stationData?.revenue || 0;
                                        return (
                                            <td key={h.date} className="p-1">
                                                <div
                                                    className={`w-8 h-8 rounded ${getHeatColor(revenue)} flex items-center justify-center text-xs cursor-pointer hover:ring-2 hover:ring-white/30`}
                                                    title={`${station.name}\n${h.date}\n฿${formatCurrency(revenue)}`}
                                                >
                                                    {revenue > 0 && revenue > maxHeatmap * 0.3 && (
                                                        <span className="text-white/80 text-[10px]">
                                                            {(revenue / 1000).toFixed(0)}k
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="flex items-center gap-2 mt-4 justify-end">
                    <span className="text-xs text-gray-500">น้อย</span>
                    <div className="flex gap-1">
                        <div className="w-4 h-4 rounded bg-gray-800" />
                        <div className="w-4 h-4 rounded bg-blue-800" />
                        <div className="w-4 h-4 rounded bg-blue-700" />
                        <div className="w-4 h-4 rounded bg-blue-600" />
                        <div className="w-4 h-4 rounded bg-blue-500" />
                        <div className="w-4 h-4 rounded bg-blue-400" />
                    </div>
                    <span className="text-xs text-gray-500">มาก</span>
                </div>
            </div>

            {/* Top Customers */}
            <div className="bg-[#1a1a24] rounded-xl p-6 border border-white/10">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Users className="text-yellow-400" size={20} />
                    🏆 Top 10 ลูกค้าเดือนนี้
                </h2>
                {data.topCustomers.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {data.topCustomers.map((customer, index) => (
                            <div key={customer.ownerId} className="flex items-center gap-3 p-3 bg-black/20 rounded-lg">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${index === 0 ? 'bg-yellow-500 text-black' :
                                        index === 1 ? 'bg-gray-400 text-black' :
                                            index === 2 ? 'bg-orange-500 text-white' :
                                                'bg-gray-700 text-gray-300'
                                    }`}>
                                    {index + 1}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="font-medium truncate">{customer.ownerName}</div>
                                    <div className="text-xs text-gray-400">{customer.count} รายการ</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-green-400 font-mono">฿{formatCurrency(customer.revenue)}</div>
                                    <div className="text-xs text-gray-500">{formatNumber(customer.liters)} L</div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-8 text-gray-400">ไม่มีข้อมูลลูกค้า</div>
                )}
            </div>
        </div>
    );
}
