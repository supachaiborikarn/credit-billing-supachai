'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
    TrendingUp,
    FuelIcon,
    Users,
    Clock,
    AlertTriangle,
    ArrowRight,
    Loader2,
    ExternalLink,
    Play
} from 'lucide-react';
import { formatCurrency, formatThaiDate } from '@/lib/gas';

interface StationSummary {
    id: string;
    name: string;
    index: number;
    currentShift: { shiftNumber: number; status: string; staffName: string | null } | null;
    todaySales: number;
    todayLiters: number;
    todayTransactions: number;
    gaugeAverage: number | null;
    alerts: string[];
}

interface DashboardData {
    summary: {
        todayTotal: number;
        weekTotal: number;
        monthTotal: number;
        todayTransactions: number;
        todayLiters: number;
    };
    stations: StationSummary[];
    recentAlerts: string[];
}

export default function AdminGasDashboardPage() {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<DashboardData | null>(null);
    const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month'>('today');

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await fetch('/api/v2/gas/admin/dashboard');
                if (res.ok) {
                    const json = await res.json();
                    setData(json);
                }
            } catch (error) {
                console.error('Error fetching dashboard:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();

        // Refresh every minute
        const interval = setInterval(fetchData, 60000);
        return () => clearInterval(interval);
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="animate-spin text-purple-400" size={40} />
            </div>
        );
    }

    // Default data for demo
    const summary = data?.summary || {
        todayTotal: 0,
        weekTotal: 0,
        monthTotal: 0,
        todayTransactions: 0,
        todayLiters: 0
    };

    const stations = data?.stations || [];
    const alerts = data?.recentAlerts || [];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Dashboard</h1>
                    <p className="text-gray-400">{formatThaiDate(new Date())}</p>
                </div>

                {/* Time Range Toggle */}
                <div className="flex gap-2">
                    {(['today', 'week', 'month'] as const).map((range) => (
                        <button
                            key={range}
                            onClick={() => setTimeRange(range)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${timeRange === range
                                ? 'bg-purple-600 text-white'
                                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                                }`}
                        >
                            {range === 'today' ? 'วันนี้' : range === 'week' ? 'สัปดาห์' : 'เดือน'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-green-900/50 to-green-800/30 rounded-xl p-4 border border-green-500/20">
                    <div className="flex items-center gap-2 text-green-400 mb-2">
                        <TrendingUp size={20} />
                        <span className="text-sm">ยอดขาย</span>
                    </div>
                    <div className="text-2xl font-bold text-white">
                        ฿{formatCurrency(timeRange === 'today' ? summary.todayTotal :
                            timeRange === 'week' ? summary.weekTotal : summary.monthTotal)}
                    </div>
                </div>

                <div className="bg-gradient-to-br from-blue-900/50 to-blue-800/30 rounded-xl p-4 border border-blue-500/20">
                    <div className="flex items-center gap-2 text-blue-400 mb-2">
                        <FuelIcon size={20} />
                        <span className="text-sm">ลิตร</span>
                    </div>
                    <div className="text-2xl font-bold text-white">
                        {summary.todayLiters.toLocaleString()}
                    </div>
                </div>

                <div className="bg-gradient-to-br from-purple-900/50 to-purple-800/30 rounded-xl p-4 border border-purple-500/20">
                    <div className="flex items-center gap-2 text-purple-400 mb-2">
                        <Users size={20} />
                        <span className="text-sm">รายการ</span>
                    </div>
                    <div className="text-2xl font-bold text-white">
                        {summary.todayTransactions}
                    </div>
                </div>

                <div className="bg-gradient-to-br from-orange-900/50 to-orange-800/30 rounded-xl p-4 border border-orange-500/20">
                    <div className="flex items-center gap-2 text-orange-400 mb-2">
                        <Clock size={20} />
                        <span className="text-sm">ปั๊มที่เปิดอยู่</span>
                    </div>
                    <div className="text-2xl font-bold text-white">
                        {stations.filter(s => s.currentShift?.status === 'OPEN').length}/{stations.length}
                    </div>
                </div>
            </div>

            {/* Alerts */}
            {alerts.length > 0 && (
                <div className="bg-red-900/30 border border-red-500/30 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-red-400 mb-3">
                        <AlertTriangle size={20} />
                        <span className="font-medium">แจ้งเตือน</span>
                    </div>
                    <ul className="space-y-2">
                        {alerts.map((alert, i) => (
                            <li key={i} className="text-red-300 text-sm flex items-start gap-2">
                                <span>•</span>
                                <span>{alert}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Station Status */}
            <div className="bg-[#1a1a24] rounded-xl border border-white/10 overflow-hidden">
                <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
                    <h2 className="font-medium">สถานะปั๊ม</h2>
                    <Link
                        href="/admin/gas/reports/daily"
                        className="text-purple-400 text-sm hover:underline flex items-center gap-1"
                    >
                        ดูรายงาน <ArrowRight size={14} />
                    </Link>
                </div>

                <div className="divide-y divide-white/5">
                    {stations.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">
                            ไม่พบข้อมูลปั๊ม
                        </div>
                    ) : (
                        stations.map((station) => (
                            <div key={station.id} className="p-4 hover:bg-white/5 transition-colors">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-3 h-3 rounded-full ${station.currentShift?.status === 'OPEN'
                                            ? 'bg-green-400 animate-pulse'
                                            : 'bg-gray-600'
                                            }`} />
                                        <div>
                                            <div className="font-medium">{station.name}</div>
                                            <div className="text-sm text-gray-400">
                                                {station.currentShift
                                                    ? `กะ ${station.currentShift.shiftNumber} | ${station.currentShift.staffName || 'ไม่ระบุ'}`
                                                    : 'ไม่มีกะเปิด'
                                                }
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        <div className="text-right">
                                            <div className="font-mono text-green-400">
                                                ฿{formatCurrency(station.todaySales)}
                                            </div>
                                            <div className="text-sm text-gray-400">
                                                {station.todayLiters.toLocaleString()} L | {station.todayTransactions} รายการ
                                            </div>
                                        </div>

                                        {/* Links */}
                                        <div className="flex gap-2">
                                            {station.currentShift?.status === 'OPEN' ? (
                                                <Link
                                                    href={`/gas/${station.id}`}
                                                    className="px-3 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-sm font-medium flex items-center gap-1 transition-colors"
                                                >
                                                    <ExternalLink size={14} />
                                                    เข้าปั๊ม
                                                </Link>
                                            ) : (
                                                <Link
                                                    href={`/gas/${station.id}/shift/open`}
                                                    className="px-3 py-2 bg-green-600 hover:bg-green-500 rounded-lg text-sm font-medium flex items-center gap-1 transition-colors"
                                                >
                                                    <Play size={14} />
                                                    เปิดกะ
                                                </Link>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Station Alerts */}
                                {station.alerts.length > 0 && (
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        {station.alerts.map((alert, i) => (
                                            <span
                                                key={i}
                                                className="text-xs bg-red-900/50 text-red-300 px-2 py-1 rounded"
                                            >
                                                {alert}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Quick Links */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Link
                    href="/admin/gas/reports/daily"
                    className="bg-[#1a1a24] rounded-xl p-4 border border-white/10 hover:border-purple-500/50 transition-colors group"
                >
                    <div className="text-purple-400 group-hover:text-purple-300 mb-2">📊</div>
                    <div className="font-medium">รายงานรายวัน</div>
                    <div className="text-sm text-gray-400">ยอดขายแยกตามวัน</div>
                </Link>

                <Link
                    href="/admin/gas/reports/shift"
                    className="bg-[#1a1a24] rounded-xl p-4 border border-white/10 hover:border-purple-500/50 transition-colors group"
                >
                    <div className="text-blue-400 group-hover:text-blue-300 mb-2">🕐</div>
                    <div className="font-medium">รายงานตามกะ</div>
                    <div className="text-sm text-gray-400">รายละเอียดแต่ละกะ</div>
                </Link>

                <Link
                    href="/admin/gas/gauge"
                    className="bg-[#1a1a24] rounded-xl p-4 border border-white/10 hover:border-purple-500/50 transition-colors group"
                >
                    <div className="text-orange-400 group-hover:text-orange-300 mb-2">⛽</div>
                    <div className="font-medium">ประวัติเกจ</div>
                    <div className="text-sm text-gray-400">ระดับถังย้อนหลัง</div>
                </Link>

                <Link
                    href="/admin/gas/reconciliation"
                    className="bg-[#1a1a24] rounded-xl p-4 border border-white/10 hover:border-purple-500/50 transition-colors group"
                >
                    <div className="text-green-400 group-hover:text-green-300 mb-2">⚖️</div>
                    <div className="font-medium">กระทบยอด</div>
                    <div className="text-sm text-gray-400">ตรวจสอบส่วนต่าง</div>
                </Link>
            </div>
        </div>
    );
}
