'use client';

import { useEffect, useState } from 'react';
import {
    TrendingUp,
    Fuel,
    Receipt,
    Loader2,
    Building2
} from 'lucide-react';

interface OverviewData {
    kpi: {
        today: { liters: number; revenue: number; transactions: number };
        month: { liters: number; revenue: number; transactions: number };
        margin: number | null;
        profit: number | null;
    };
    dailyTrend: { date: string; revenue: number; liters: number; count: number }[];
    stations: { id: string; name: string; todayLiters: number; todayRevenue: number; todayTransactions: number }[];
}

const formatCurrency = (n: number) => n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatNumber = (n: number) => n.toLocaleString('th-TH');

export default function SimpleOverviewPage() {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<OverviewData | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await fetch('/api/v2/simple/admin/overview');
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
                <Loader2 className="animate-spin text-blue-400" size={40} />
            </div>
        );
    }

    if (!data) {
        return <div className="text-center py-12 text-gray-400">ไม่สามารถโหลดข้อมูลได้</div>;
    }

    const maxTrend = Math.max(...data.dailyTrend.map(t => t.revenue), 1);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold">📊 Executive Overview</h1>
                <p className="text-gray-400 text-sm">ภาพรวมปั๊มน้ำมัน (Simple Stations)</p>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Today */}
                <div className="bg-gradient-to-br from-green-900/50 to-emerald-900/50 rounded-xl p-4 border border-green-500/20">
                    <div className="flex items-center gap-2 mb-2">
                        <Fuel className="text-green-400" size={18} />
                        <span className="text-sm text-gray-400">วันนี้ (ลิตร)</span>
                    </div>
                    <div className="text-2xl font-bold text-green-400">{formatNumber(data.kpi.today.liters)}</div>
                </div>

                <div className="bg-gradient-to-br from-blue-900/50 to-cyan-900/50 rounded-xl p-4 border border-blue-500/20">
                    <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="text-blue-400" size={18} />
                        <span className="text-sm text-gray-400">วันนี้ (บาท)</span>
                    </div>
                    <div className="text-2xl font-bold text-blue-400">฿{formatCurrency(data.kpi.today.revenue)}</div>
                </div>

                {/* Month */}
                <div className="bg-gradient-to-br from-purple-900/50 to-pink-900/50 rounded-xl p-4 border border-purple-500/20">
                    <div className="flex items-center gap-2 mb-2">
                        <Fuel className="text-purple-400" size={18} />
                        <span className="text-sm text-gray-400">เดือนนี้ (ลิตร)</span>
                    </div>
                    <div className="text-2xl font-bold text-purple-400">{formatNumber(data.kpi.month.liters)}</div>
                </div>

                <div className="bg-gradient-to-br from-orange-900/50 to-red-900/50 rounded-xl p-4 border border-orange-500/20">
                    <div className="flex items-center gap-2 mb-2">
                        <Receipt className="text-orange-400" size={18} />
                        <span className="text-sm text-gray-400">เดือนนี้ (บาท)</span>
                    </div>
                    <div className="text-2xl font-bold text-orange-400">฿{formatCurrency(data.kpi.month.revenue)}</div>
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
                                    className="w-full bg-gradient-to-t from-blue-600 to-cyan-500 rounded-t cursor-pointer hover:from-blue-500 hover:to-cyan-400 transition-colors"
                                    style={{ height: `${(day.revenue / maxTrend) * 100}%`, minHeight: '4px' }}
                                />
                                {/* Tooltip */}
                                <div className="absolute bottom-full mb-2 hidden group-hover:block bg-black/90 text-white text-xs p-2 rounded shadow-lg whitespace-nowrap z-10">
                                    <div>{new Date(day.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}</div>
                                    <div>฿{formatCurrency(day.revenue)}</div>
                                    <div>{formatNumber(day.liters)} L</div>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 mt-2 min-w-[600px]">
                        <span>{new Date(data.dailyTrend[0]?.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}</span>
                        <span>วันนี้</span>
                    </div>
                </div>
            </div>

            {/* Station Summary */}
            <div className="bg-[#1a1a24] rounded-xl p-6 border border-white/10">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Building2 className="text-blue-400" size={20} />
                    เปรียบเทียบปั๊มวันนี้
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {data.stations.map(s => (
                        <div key={s.id} className="bg-black/20 rounded-lg p-4">
                            <div className="font-medium mb-2 truncate">{s.name}</div>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                                <div>
                                    <span className="text-gray-400">ลิตร:</span>
                                    <span className="ml-1 text-green-400">{formatNumber(s.todayLiters)}</span>
                                </div>
                                <div>
                                    <span className="text-gray-400">บาท:</span>
                                    <span className="ml-1 text-blue-400">฿{formatCurrency(s.todayRevenue)}</span>
                                </div>
                                <div className="col-span-2">
                                    <span className="text-gray-400">รายการ:</span>
                                    <span className="ml-1">{s.todayTransactions}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* TODO Notice */}
            {data.kpi.margin === null && (
                <div className="bg-yellow-900/30 border border-yellow-500/30 rounded-xl p-4 text-yellow-300 text-sm">
                    💡 <strong>TODO:</strong> ข้อมูล Margin และ Profit ยังไม่แสดง เนื่องจากยังไม่มี cost_per_liter ใน database
                </div>
            )}
        </div>
    );
}
