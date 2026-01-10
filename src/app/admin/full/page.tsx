'use client';

import { useEffect, useState } from 'react';
import {
    TrendingUp,
    Fuel,
    Receipt,
    AlertTriangle,
    Loader2,
    CheckCircle,
    Calendar,
    RefreshCw
} from 'lucide-react';

interface DashboardData {
    station: { id: string; name: string };
    kpi: {
        today: { liters: number; revenue: number; transactions: number };
        month: { liters: number; revenue: number; transactions: number };
    };
    dailyTrend: { date: string; revenue: number; liters: number; count: number }[];
    byFuelType: { fuelType: string; liters: number; revenue: number; count: number }[];
    anomalies: {
        type: string;
        severity: 'WARNING' | 'CRITICAL';
        message: string;
        date: string;
    }[];
    stats: { avgDailyVolume: number; stdDevVolume: number };
}

const formatCurrency = (n: number) => n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatNumber = (n: number) => n.toLocaleString('th-TH', { maximumFractionDigits: 0 });

export default function FullDashboardPage() {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<DashboardData | null>(null);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/v2/full/admin/dashboard?date=${selectedDate}`);
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

    useEffect(() => {
        fetchData();
    }, [selectedDate]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="animate-spin text-amber-400" size={40} />
            </div>
        );
    }

    if (!data) {
        return <div className="text-center py-12 text-gray-400">ไม่สามารถโหลดข้อมูลได้</div>;
    }

    // Calculate chart dimensions
    const trendData = data.dailyTrend;
    const maxRevenue = Math.max(...trendData.map(d => d.revenue), 1);
    const chartWidth = 600;
    const chartHeight = 180;

    // Generate line path
    const linePath = trendData.map((d, i) => {
        const x = (i / Math.max(trendData.length - 1, 1)) * chartWidth;
        const y = chartHeight - (d.revenue / maxRevenue) * (chartHeight - 20);
        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');

    // Generate area path
    const areaPath = `${linePath} L ${chartWidth} ${chartHeight} L 0 ${chartHeight} Z`;

    const criticalAnomalies = data.anomalies.filter(a => a.severity === 'CRITICAL');
    const warningAnomalies = data.anomalies.filter(a => a.severity === 'WARNING');

    // Date presets
    const setPreset = (days: number) => {
        const d = new Date();
        d.setDate(d.getDate() - days);
        setSelectedDate(d.toISOString().split('T')[0]);
    };

    return (
        <div className="space-y-6">
            {/* Header with Date Picker */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold">🛢️ {data.station.name}</h1>
                    <p className="text-gray-400 text-sm">Executive Dashboard พร้อมตรวจความผิดปกติ</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <button onClick={() => setPreset(0)} className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 rounded-lg text-sm font-medium transition-colors">วันนี้</button>
                    <button onClick={() => setPreset(1)} className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors">เมื่อวาน</button>
                    <button onClick={() => setPreset(7)} className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors">7 วัน</button>
                    <div className="flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-1.5">
                        <Calendar size={16} className="text-gray-400" />
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="bg-transparent text-white text-sm focus:outline-none"
                        />
                    </div>
                    <button onClick={fetchData} className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors">
                        <RefreshCw size={16} />
                    </button>
                </div>
            </div>

            {/* Anomaly Alerts */}
            {data.anomalies.length > 0 && (
                <div className="space-y-2">
                    {criticalAnomalies.map((a, i) => (
                        <div key={i} className="bg-red-900/40 border border-red-500/50 rounded-xl p-4 flex items-center gap-3">
                            <AlertTriangle className="text-red-400 flex-shrink-0" size={24} />
                            <div>
                                <div className="font-medium text-red-300">{a.message}</div>
                                <div className="text-xs text-red-400/70">{a.type}</div>
                            </div>
                        </div>
                    ))}
                    {warningAnomalies.map((a, i) => (
                        <div key={i} className="bg-yellow-900/30 border border-yellow-500/30 rounded-xl p-4 flex items-center gap-3">
                            <AlertTriangle className="text-yellow-400 flex-shrink-0" size={20} />
                            <div>
                                <div className="font-medium text-yellow-300">{a.message}</div>
                                <div className="text-xs text-yellow-400/70">{a.type}</div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {data.anomalies.length === 0 && (
                <div className="bg-green-900/30 border border-green-500/30 rounded-xl p-4 flex items-center gap-3">
                    <CheckCircle className="text-green-400" size={24} />
                    <span className="text-green-300">ไม่พบความผิดปกติวันนี้</span>
                </div>
            )}

            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-amber-900/50 to-orange-900/50 rounded-xl p-4 border border-amber-500/20">
                    <div className="flex items-center gap-2 mb-2">
                        <Fuel className="text-amber-400" size={18} />
                        <span className="text-sm text-gray-400">วันที่เลือก (ลิตร)</span>
                    </div>
                    <div className="text-2xl font-bold text-amber-400">{formatNumber(data.kpi.today.liters)}</div>
                    <div className="text-xs text-gray-500">
                        avg: {formatNumber(data.stats.avgDailyVolume)} L/วัน
                    </div>
                </div>

                <div className="bg-gradient-to-br from-green-900/50 to-emerald-900/50 rounded-xl p-4 border border-green-500/20">
                    <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="text-green-400" size={18} />
                        <span className="text-sm text-gray-400">วันที่เลือก (บาท)</span>
                    </div>
                    <div className="text-2xl font-bold text-green-400">฿{formatCurrency(data.kpi.today.revenue)}</div>
                </div>

                <div className="bg-gradient-to-br from-purple-900/50 to-pink-900/50 rounded-xl p-4 border border-purple-500/20">
                    <div className="flex items-center gap-2 mb-2">
                        <Fuel className="text-purple-400" size={18} />
                        <span className="text-sm text-gray-400">เดือนนี้ (ลิตร)</span>
                    </div>
                    <div className="text-2xl font-bold text-purple-400">{formatNumber(data.kpi.month.liters)}</div>
                </div>

                <div className="bg-gradient-to-br from-blue-900/50 to-cyan-900/50 rounded-xl p-4 border border-blue-500/20">
                    <div className="flex items-center gap-2 mb-2">
                        <Receipt className="text-blue-400" size={18} />
                        <span className="text-sm text-gray-400">เดือนนี้ (บาท)</span>
                    </div>
                    <div className="text-2xl font-bold text-blue-400">฿{formatCurrency(data.kpi.month.revenue)}</div>
                </div>
            </div>

            {/* 30-Day Trend Line Chart */}
            <div className="bg-[#1a1a24] rounded-xl p-6 border border-white/10">
                <h2 className="text-lg font-semibold mb-4">📈 กราฟยอดขาย 30 วันล่าสุด</h2>
                <div className="overflow-x-auto">
                    <div className="min-w-[650px]">
                        {/* Y-axis labels */}
                        <div className="flex">
                            <div className="w-20 flex flex-col justify-between text-xs text-gray-500 pr-2" style={{ height: `${chartHeight}px` }}>
                                <span>฿{(maxRevenue / 1000000).toFixed(1)}M</span>
                                <span>฿{(maxRevenue / 2000000).toFixed(1)}M</span>
                                <span>฿0</span>
                            </div>
                            <div className="flex-1">
                                <svg width="100%" height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="none">
                                    {/* Grid lines */}
                                    <line x1="0" y1={chartHeight * 0.25} x2={chartWidth} y2={chartHeight * 0.25} stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                                    <line x1="0" y1={chartHeight * 0.5} x2={chartWidth} y2={chartHeight * 0.5} stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                                    <line x1="0" y1={chartHeight * 0.75} x2={chartWidth} y2={chartHeight * 0.75} stroke="rgba(255,255,255,0.1)" strokeWidth="1" />

                                    {/* Area fill */}
                                    <path d={areaPath} fill="url(#areaGrad)" />

                                    {/* Line */}
                                    <path d={linePath} fill="none" stroke="url(#lineGrad)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

                                    {/* Data points */}
                                    {trendData.map((d, i) => {
                                        const x = (i / Math.max(trendData.length - 1, 1)) * chartWidth;
                                        const y = chartHeight - (d.revenue / maxRevenue) * (chartHeight - 20);
                                        return d.revenue > 0 ? (
                                            <circle key={i} cx={x} cy={y} r="4" fill="#f59e0b" className="hover:r-6 transition-all">
                                                <title>{new Date(d.date).toLocaleDateString('th-TH')}
                                                    ฿{formatCurrency(d.revenue)}
                                                    {formatNumber(d.liters)} L</title>
                                            </circle>
                                        ) : null;
                                    })}

                                    {/* Gradients */}
                                    <defs>
                                        <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
                                            <stop offset="0%" stopColor="#f59e0b" />
                                            <stop offset="100%" stopColor="#ea580c" />
                                        </linearGradient>
                                        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="rgba(245,158,11,0.4)" />
                                            <stop offset="100%" stopColor="rgba(245,158,11,0)" />
                                        </linearGradient>
                                    </defs>
                                </svg>
                            </div>
                        </div>
                        {/* X-axis labels */}
                        <div className="flex ml-20 mt-2 justify-between text-xs text-gray-500">
                            <span>{trendData[0] ? new Date(trendData[0].date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }) : ''}</span>
                            <span>{trendData[Math.floor(trendData.length / 2)] ? new Date(trendData[Math.floor(trendData.length / 2)].date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }) : ''}</span>
                            <span>{trendData[trendData.length - 1] ? new Date(trendData[trendData.length - 1].date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }) : ''}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Fuel Type Breakdown */}
            <div className="bg-[#1a1a24] rounded-xl p-6 border border-white/10">
                <h2 className="text-lg font-semibold mb-4">⛽ ยอดขายตามประเภทเชื้อเพลิง (วันที่เลือก)</h2>
                {data.byFuelType.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {data.byFuelType.sort((a, b) => b.revenue - a.revenue).map(f => (
                            <div key={f.fuelType} className="bg-black/20 rounded-lg p-4">
                                <div className="text-sm text-gray-400 mb-1">{f.fuelType}</div>
                                <div className="text-xl font-bold text-amber-400">{formatNumber(f.liters)} L</div>
                                <div className="text-sm text-green-400">฿{formatCurrency(f.revenue)}</div>
                                <div className="text-xs text-gray-500">{f.count} รายการ</div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-8 text-gray-400">ไม่มีข้อมูลในวันที่เลือก</div>
                )}
            </div>
        </div>
    );
}
