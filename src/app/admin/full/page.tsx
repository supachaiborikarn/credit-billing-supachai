'use client';

import { useEffect, useState } from 'react';
import {
    TrendingUp,
    Fuel,
    Receipt,
    AlertTriangle,
    Loader2,
    CheckCircle
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
const formatNumber = (n: number) => n.toLocaleString('th-TH');

export default function FullDashboardPage() {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<DashboardData | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await fetch('/api/v2/full/admin/dashboard');
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
    }, []);

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

    const maxTrend = Math.max(...data.dailyTrend.map(t => t.revenue), 1);
    const criticalAnomalies = data.anomalies.filter(a => a.severity === 'CRITICAL');
    const warningAnomalies = data.anomalies.filter(a => a.severity === 'WARNING');

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold">🛢️ {data.station.name}</h1>
                <p className="text-gray-400 text-sm">Executive Dashboard พร้อมตรวจความผิดปกติ</p>
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
                        <span className="text-sm text-gray-400">วันนี้ (ลิตร)</span>
                    </div>
                    <div className="text-2xl font-bold text-amber-400">{formatNumber(data.kpi.today.liters)}</div>
                    <div className="text-xs text-gray-500">
                        avg: {formatNumber(data.stats.avgDailyVolume)} L/วัน
                    </div>
                </div>

                <div className="bg-gradient-to-br from-green-900/50 to-emerald-900/50 rounded-xl p-4 border border-green-500/20">
                    <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="text-green-400" size={18} />
                        <span className="text-sm text-gray-400">วันนี้ (บาท)</span>
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

            {/* Trend Chart */}
            <div className="bg-[#1a1a24] rounded-xl p-6 border border-white/10">
                <h2 className="text-lg font-semibold mb-4">📈 ยอดขาย 30 วันล่าสุด</h2>
                <div className="overflow-x-auto">
                    <div className="flex items-end gap-1 h-40 min-w-[600px]">
                        {data.dailyTrend.map((day, i) => (
                            <div key={i} className="flex-1 flex flex-col items-center group relative">
                                <div
                                    className="w-full bg-gradient-to-t from-amber-600 to-orange-500 rounded-t cursor-pointer hover:from-amber-500 hover:to-orange-400 transition-colors"
                                    style={{ height: `${(day.revenue / maxTrend) * 100}%`, minHeight: '4px' }}
                                />
                                <div className="absolute bottom-full mb-2 hidden group-hover:block bg-black/90 text-white text-xs p-2 rounded shadow-lg whitespace-nowrap z-10">
                                    <div>{new Date(day.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}</div>
                                    <div>฿{formatCurrency(day.revenue)}</div>
                                    <div>{formatNumber(day.liters)} L</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Fuel Type Breakdown */}
            <div className="bg-[#1a1a24] rounded-xl p-6 border border-white/10">
                <h2 className="text-lg font-semibold mb-4">⛽ ยอดขายตามประเภทเชื้อเพลิงวันนี้</h2>
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
            </div>
        </div>
    );
}
