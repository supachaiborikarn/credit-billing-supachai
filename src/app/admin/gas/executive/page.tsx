'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
    TrendingUp,
    TrendingDown,
    FuelIcon,
    Users,
    Clock,
    AlertTriangle,
    Gauge,
    CreditCard,
    Shield,
    Loader2,
    ChevronRight
} from 'lucide-react';

interface ExecutiveData {
    financial: {
        todaySales: number;
        todayLiters: number;
        todayTransactions: number;
        weekSales: number;
        monthSales: number;
        salesTrend: { date: string; amount: number }[];
        stationComparison: { id: string; name: string; todaySales: number }[];
    };
    operations: {
        shifts: {
            stationName: string;
            shifts: { shiftNumber: number; status: string; staffName: string; totalSales: number }[];
        }[];
    };
    inventory: {
        gauges: {
            stationName: string;
            tanks: (number | null)[];
            average: number | null;
            isLow: boolean;
        }[];
        lowStockCount: number;
    };
    ar: {
        totalOutstanding: number;
        topDebtors: { id: string; name: string; amount: number; limit: number }[];
    };
    audit: {
        unreviewedAnomalies: number;
        recentAnomalies: {
            id: string;
            nozzle: number;
            severity: string;
            percentDiff: number;
        }[];
    };
}

const formatCurrency = (n: number) => n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatShortCurrency = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
    return n.toFixed(0);
};

export default function ExecutiveDashboardPage() {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<ExecutiveData | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await fetch('/api/v2/gas/admin/executive');
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
                <Loader2 className="animate-spin text-purple-400" size={40} />
            </div>
        );
    }

    if (!data) {
        return (
            <div className="text-center py-12 text-gray-400">
                ไม่สามารถโหลดข้อมูลได้
            </div>
        );
    }

    const maxTrend = Math.max(...data.financial.salesTrend.map(t => t.amount), 1);

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">📊 Executive Dashboard</h1>
                    <p className="text-gray-400 text-sm">ภาพรวมธุรกิจปั๊มแก๊ส</p>
                </div>
                <div className="text-sm text-gray-400">
                    อัพเดท: {new Date().toLocaleTimeString('th-TH')}
                </div>
            </div>

            {/* ======== 1. FINANCIAL OVERVIEW ======== */}
            <div className="bg-gradient-to-br from-purple-900/50 to-indigo-900/50 rounded-2xl p-6 border border-purple-500/20">
                <div className="flex items-center gap-2 mb-4">
                    <TrendingUp className="text-purple-400" size={20} />
                    <h2 className="text-lg font-semibold">ภาพรวมการเงิน</h2>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="bg-black/30 rounded-xl p-4">
                        <div className="text-sm text-gray-400">วันนี้</div>
                        <div className="text-2xl font-bold text-green-400">฿{formatCurrency(data.financial.todaySales)}</div>
                        <div className="text-xs text-gray-500">{data.financial.todayLiters.toLocaleString()} L | {data.financial.todayTransactions} รายการ</div>
                    </div>
                    <div className="bg-black/30 rounded-xl p-4">
                        <div className="text-sm text-gray-400">สัปดาห์นี้</div>
                        <div className="text-2xl font-bold text-blue-400">฿{formatCurrency(data.financial.weekSales)}</div>
                    </div>
                    <div className="bg-black/30 rounded-xl p-4">
                        <div className="text-sm text-gray-400">เดือนนี้</div>
                        <div className="text-2xl font-bold text-orange-400">฿{formatCurrency(data.financial.monthSales)}</div>
                    </div>
                </div>

                {/* Trend Chart */}
                <div className="bg-black/20 rounded-xl p-4 mb-4">
                    <div className="text-sm text-gray-400 mb-3">ยอดขาย 7 วันล่าสุด</div>
                    <div className="flex items-end gap-2 h-24">
                        {data.financial.salesTrend.map((day, i) => (
                            <div key={i} className="flex-1 flex flex-col items-center">
                                <div
                                    className="w-full bg-gradient-to-t from-purple-500 to-purple-400 rounded-t"
                                    style={{ height: `${(day.amount / maxTrend) * 100}%`, minHeight: '4px' }}
                                />
                                <div className="text-xs text-gray-500 mt-1">
                                    {new Date(day.date).toLocaleDateString('th-TH', { weekday: 'narrow' })}
                                </div>
                                <div className="text-xs text-gray-400">{formatShortCurrency(day.amount)}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Station Comparison */}
                <div className="grid grid-cols-2 gap-4">
                    {data.financial.stationComparison.map(s => (
                        <div key={s.id} className="bg-black/20 rounded-lg p-3 flex justify-between items-center">
                            <span className="text-sm truncate">{s.name}</span>
                            <span className="font-mono text-green-400">฿{formatCurrency(s.todaySales)}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* ======== 2. OPERATIONS ======== */}
                <div className="bg-[#1a1a24] rounded-xl p-5 border border-white/10">
                    <div className="flex items-center gap-2 mb-4">
                        <Clock className="text-blue-400" size={20} />
                        <h2 className="text-lg font-semibold">สถานะกะ</h2>
                    </div>

                    {data.operations.shifts.map((station, i) => (
                        <div key={i} className="mb-4 last:mb-0">
                            <div className="text-sm text-gray-400 mb-2">{station.stationName}</div>
                            <div className="flex gap-2">
                                {[1, 2].map(num => {
                                    const shift = station.shifts.find(s => s.shiftNumber === num);
                                    return (
                                        <div
                                            key={num}
                                            className={`flex-1 rounded-lg p-3 ${shift?.status === 'OPEN' ? 'bg-green-900/30 border border-green-500/30' :
                                                    shift?.status === 'CLOSED' ? 'bg-blue-900/30 border border-blue-500/30' :
                                                        'bg-gray-900/30 border border-gray-500/30'
                                                }`}
                                        >
                                            <div className="text-xs text-gray-400">กะ {num}</div>
                                            <div className="font-medium">
                                                {shift ? shift.staffName : '-'}
                                            </div>
                                            <div className="text-xs mt-1">
                                                {shift?.status === 'OPEN' && <span className="text-green-400">● เปิด</span>}
                                                {shift?.status === 'CLOSED' && <span className="text-blue-400">● ปิดแล้ว</span>}
                                                {!shift && <span className="text-gray-500">ยังไม่เปิด</span>}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>

                {/* ======== 3. INVENTORY ======== */}
                <div className="bg-[#1a1a24] rounded-xl p-5 border border-white/10">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <Gauge className="text-orange-400" size={20} />
                            <h2 className="text-lg font-semibold">ระดับแก๊ส</h2>
                        </div>
                        {data.inventory.lowStockCount > 0 && (
                            <span className="bg-red-900/50 text-red-300 text-xs px-2 py-1 rounded">
                                ⚠️ {data.inventory.lowStockCount} ปั๊มสต็อกต่ำ
                            </span>
                        )}
                    </div>

                    {data.inventory.gauges.map((g, i) => (
                        <div key={i} className="mb-4 last:mb-0">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm">{g.stationName}</span>
                                <span className={`font-mono ${g.isLow ? 'text-red-400' : 'text-green-400'}`}>
                                    {g.average !== null ? `${g.average.toFixed(0)}%` : '-'}
                                </span>
                            </div>
                            <div className="flex gap-2">
                                {g.tanks.map((t, j) => (
                                    <div
                                        key={j}
                                        className="flex-1 bg-gray-800 rounded-lg p-2 text-center"
                                    >
                                        <div className="text-xs text-gray-400">ถัง {j + 1}</div>
                                        <div className={`font-mono ${t === null ? 'text-gray-500' :
                                                t < 20 ? 'text-red-400' :
                                                    t < 40 ? 'text-yellow-400' :
                                                        'text-green-400'
                                            }`}>
                                            {t !== null ? `${t}%` : '-'}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* ======== 4. AR ======== */}
                <div className="bg-[#1a1a24] rounded-xl p-5 border border-white/10">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <CreditCard className="text-pink-400" size={20} />
                            <h2 className="text-lg font-semibold">เงินเชื่อค้างชำระ</h2>
                        </div>
                        <Link href="/invoices" className="text-sm text-purple-400 hover:underline flex items-center gap-1">
                            ดูทั้งหมด <ChevronRight size={14} />
                        </Link>
                    </div>

                    <div className="bg-gradient-to-r from-pink-900/30 to-purple-900/30 rounded-xl p-4 mb-4">
                        <div className="text-sm text-gray-400">ยอดค้างรวม</div>
                        <div className="text-3xl font-bold text-pink-400">฿{formatCurrency(data.ar.totalOutstanding)}</div>
                    </div>

                    <div className="text-sm text-gray-400 mb-2">Top 5 ลูกหนี้</div>
                    {data.ar.topDebtors.length === 0 ? (
                        <div className="text-center py-4 text-gray-500">ไม่มีลูกหนี้ค้าง</div>
                    ) : (
                        <div className="space-y-2">
                            {data.ar.topDebtors.map((d, i) => (
                                <div key={d.id} className="flex items-center justify-between bg-black/20 rounded-lg p-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text-gray-500">#{i + 1}</span>
                                        <span className="text-sm truncate">{d.name}</span>
                                    </div>
                                    <span className="font-mono text-pink-400">฿{formatCurrency(d.amount)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* ======== 5. AUDIT ======== */}
                <div className="bg-[#1a1a24] rounded-xl p-5 border border-white/10">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <Shield className="text-yellow-400" size={20} />
                            <h2 className="text-lg font-semibold">ตรวจสอบ & Anomaly</h2>
                        </div>
                        {data.audit.unreviewedAnomalies > 0 && (
                            <span className="bg-yellow-900/50 text-yellow-300 text-xs px-2 py-1 rounded">
                                {data.audit.unreviewedAnomalies} รอตรวจสอบ
                            </span>
                        )}
                    </div>

                    {data.audit.recentAnomalies.length === 0 ? (
                        <div className="text-center py-8">
                            <div className="text-4xl mb-2">✅</div>
                            <div className="text-green-400">ไม่พบความผิดปกติ</div>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {data.audit.recentAnomalies.map(a => (
                                <div key={a.id} className={`flex items-center justify-between rounded-lg p-3 ${a.severity === 'CRITICAL' ? 'bg-red-900/30 border border-red-500/30' :
                                        'bg-yellow-900/30 border border-yellow-500/30'
                                    }`}>
                                    <div className="flex items-center gap-2">
                                        <AlertTriangle size={16} className={a.severity === 'CRITICAL' ? 'text-red-400' : 'text-yellow-400'} />
                                        <span className="text-sm">หัว {a.nozzle}</span>
                                    </div>
                                    <span className={`font-mono text-sm ${a.severity === 'CRITICAL' ? 'text-red-400' : 'text-yellow-400'}`}>
                                        {a.percentDiff > 0 ? '+' : ''}{a.percentDiff.toFixed(1)}%
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}

                    <Link
                        href="/admin/anomalies"
                        className="mt-4 block text-center py-2 bg-yellow-900/30 hover:bg-yellow-900/50 rounded-lg text-yellow-400 text-sm transition-colors"
                    >
                        ดูรายงานความผิดปกติทั้งหมด
                    </Link>
                </div>
            </div>
        </div>
    );
}
