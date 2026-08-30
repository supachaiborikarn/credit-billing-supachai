'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
    TrendingUp,
    Clock,
    AlertTriangle,
    Gauge,
    CreditCard,
    Shield,
    Loader2,
    ChevronRight,
} from 'lucide-react';

interface ExecutiveData {
    financial: {
        todaySales: number;
        todayReceived: number;
        todayVariance: number;
        todayLiters: number;
        todayTransactions: number;
        averageTicketToday: number;
        weekSales: number;
        monthSales: number;
        margin?: {
            avgCostPerLiter: number | null;
            weekLiters: number;
            monthLiters: number;
            weekGrossMargin: number | null;
            weekMarginPercent: number | null;
            monthGrossMargin: number | null;
            monthMarginPercent: number | null;
        };
        salesTrend: { date: string; amount: number }[];
        paymentMixToday: {
            cash: number;
            credit: number;
            card: number;
            transfer: number;
        };
        stationComparison: {
            id: string;
            name: string;
            todaySales: number;
            todayReceived: number;
            todayLiters: number;
            todayTransactions: number;
            averageTicket: number;
            todayVariance: number;
        }[];
    };
    operations: {
        shifts: {
            stationName: string;
            shifts: {
                shiftNumber: number;
                status: string;
                staffName: string;
                totalSales: number;
                transactionCount: number;
                liters: number;
                variance: number;
                varianceStatus: string;
            }[];
        }[];
    };
    inventory: {
        gauges: {
            stationName: string;
            tanks: (number | null)[];
            average: number | null;
            isLow: boolean;
            litersRemaining: number;
            todayLiters: number;
            weekAverageLiters: number;
            daysToEmpty: number | null;
            runoutSeverity: 'INFO' | 'WARNING' | 'CRITICAL';
        }[];
        lowStockCount: number;
    };
    performance: {
        staff: {
            staffName: string;
            shiftCount: number;
            stationCount: number;
            totalSales: number;
            totalLiters: number;
            transactionCount: number;
            averageTicket: number;
            averageLitersPerShift: number;
            averageVariance: number;
            stations: string[];
        }[];
        nozzles: {
            stationId: string;
            stationName: string;
            nozzleNumber: number;
            shiftCount: number;
            totalLiters: number;
            averageLitersPerShift: number;
            estimatedSales: number;
        }[];
        alerts: {
            id: string;
            severity: 'INFO' | 'WARNING' | 'CRITICAL';
            title: string;
            detail: string;
        }[];
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

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <div className="bg-black/30 rounded-xl p-4">
                        <div className="text-sm text-gray-400">วันนี้</div>
                        <div className="text-2xl font-bold text-green-400">฿{formatCurrency(data.financial.todaySales)}</div>
                        <div className="text-xs text-gray-500">
                            {data.financial.todayLiters.toLocaleString()} L | {data.financial.todayTransactions} รายการ
                        </div>
                    </div>
                    <div className="bg-black/30 rounded-xl p-4">
                        <div className="text-sm text-gray-400">รับเงินจริงวันนี้</div>
                        <div className="text-2xl font-bold text-cyan-400">฿{formatCurrency(data.financial.todayReceived)}</div>
                        <div className={`text-xs ${data.financial.todayVariance >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                            ส่วนต่าง {data.financial.todayVariance >= 0 ? '+' : ''}฿{formatCurrency(data.financial.todayVariance)}
                        </div>
                    </div>
                    <div className="bg-black/30 rounded-xl p-4">
                        <div className="text-sm text-gray-400">สัปดาห์นี้</div>
                        <div className="text-2xl font-bold text-blue-400">฿{formatCurrency(data.financial.weekSales)}</div>
                        <div className="text-xs text-gray-500">
                            Avg ticket ฿{formatCurrency(data.financial.averageTicketToday)}
                        </div>
                        {data.financial.margin?.weekGrossMargin !== null && data.financial.margin?.weekGrossMargin !== undefined && (
                            <div className={`text-xs mt-0.5 ${data.financial.margin.weekGrossMargin >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                                กำไรขั้นต้น~ ฿{formatCurrency(data.financial.margin.weekGrossMargin)}
                                {data.financial.margin.weekMarginPercent !== null
                                    ? ` (${data.financial.margin.weekMarginPercent.toFixed(1)}%)`
                                    : ''}
                            </div>
                        )}
                    </div>
                    <div className="bg-black/30 rounded-xl p-4">
                        <div className="text-sm text-gray-400">เดือนนี้</div>
                        <div className="text-2xl font-bold text-orange-400">฿{formatCurrency(data.financial.monthSales)}</div>
                        {data.financial.margin?.monthGrossMargin !== null && data.financial.margin?.monthGrossMargin !== undefined ? (
                            <div className={`text-xs mt-0.5 ${data.financial.margin.monthGrossMargin >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                                กำไรขั้นต้น~ ฿{formatCurrency(data.financial.margin.monthGrossMargin)}
                                {data.financial.margin.monthMarginPercent !== null
                                    ? ` (${data.financial.margin.monthMarginPercent.toFixed(1)}%)`
                                    : ''}
                            </div>
                        ) : (
                            <div className="text-xs mt-0.5 text-gray-600">
                                ใส่ราคาทุนในใบส่งแก๊สเพื่อดูกำไรขั้นต้น
                            </div>
                        )}
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

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                    <div className="bg-black/20 rounded-lg p-3">
                        <div className="text-xs text-gray-400">เงินสด</div>
                        <div className="font-mono text-green-400">฿{formatCurrency(data.financial.paymentMixToday.cash)}</div>
                    </div>
                    <div className="bg-black/20 rounded-lg p-3">
                        <div className="text-xs text-gray-400">เงินเชื่อ</div>
                        <div className="font-mono text-purple-400">฿{formatCurrency(data.financial.paymentMixToday.credit)}</div>
                    </div>
                    <div className="bg-black/20 rounded-lg p-3">
                        <div className="text-xs text-gray-400">บัตร</div>
                        <div className="font-mono text-blue-400">฿{formatCurrency(data.financial.paymentMixToday.card)}</div>
                    </div>
                    <div className="bg-black/20 rounded-lg p-3">
                        <div className="text-xs text-gray-400">โอน</div>
                        <div className="font-mono text-cyan-400">฿{formatCurrency(data.financial.paymentMixToday.transfer)}</div>
                    </div>
                </div>

                {/* Station Comparison */}
                <div className="grid grid-cols-2 gap-4">
                    {data.financial.stationComparison.map(s => (
                        <div key={s.id} className="bg-black/20 rounded-lg p-3">
                            <div className="flex justify-between items-center gap-3">
                                <span className="text-sm truncate">{s.name}</span>
                                <span className="font-mono text-green-400">฿{formatCurrency(s.todaySales)}</span>
                            </div>
                            <div className="mt-2 text-xs text-gray-400 flex flex-wrap gap-3">
                                <span>{s.todayLiters.toLocaleString()} L</span>
                                <span>{s.todayTransactions} รายการ</span>
                                <span>Avg ฿{formatCurrency(s.averageTicket)}</span>
                            </div>
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
                                            {shift && (
                                                <div className="text-[11px] text-gray-400 mt-2 space-y-1">
                                                    <div>{shift.transactionCount} รายการ | {shift.liters.toLocaleString()} L</div>
                                                    <div>ยอดขาย ฿{formatCurrency(shift.totalSales)}</div>
                                                </div>
                                            )}
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
                            <div className="text-xs text-gray-500 mt-2 flex flex-wrap gap-3">
                                <span>คงเหลือ {g.litersRemaining.toLocaleString()} L</span>
                                <span>วันนี้ {g.todayLiters.toLocaleString()} L</span>
                                <span>เฉลี่ย 7 วัน {g.weekAverageLiters.toLocaleString()} L</span>
                                <span className={
                                    g.runoutSeverity === 'CRITICAL'
                                        ? 'text-red-400'
                                        : g.runoutSeverity === 'WARNING'
                                            ? 'text-yellow-400'
                                            : 'text-gray-500'
                                }>
                                    หมดใน {g.daysToEmpty !== null ? `${g.daysToEmpty.toFixed(1)} วัน` : '-'}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="bg-[#1a1a24] rounded-xl p-5 border border-white/10">
                    <div className="flex items-center gap-2 mb-4">
                        <CreditCard className="text-cyan-400" size={20} />
                        <h2 className="text-lg font-semibold">ทีมเด่น 7 วัน</h2>
                    </div>

                    <div className="space-y-3">
                        {data.performance.staff.length === 0 ? (
                            <div className="text-sm text-gray-500">ยังไม่มีข้อมูลกะย้อนหลัง</div>
                        ) : (
                            data.performance.staff.map((staff) => (
                                <div key={staff.staffName} className="rounded-lg bg-black/20 p-3 border border-white/5">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <div className="font-medium">{staff.staffName}</div>
                                            <div className="text-xs text-gray-400">
                                                {staff.shiftCount} กะ | {staff.stations.join(', ')}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-mono text-green-400">฿{formatCurrency(staff.totalSales)}</div>
                                            <div className="text-xs text-gray-500">{staff.totalLiters.toLocaleString()} L</div>
                                        </div>
                                    </div>
                                    <div className="mt-2 text-xs text-gray-400 flex flex-wrap gap-3">
                                        <span>{staff.transactionCount} รายการ</span>
                                        <span>Avg ฿{formatCurrency(staff.averageTicket)}</span>
                                        <span className={staff.averageVariance >= 0 ? 'text-green-300' : 'text-red-300'}>
                                            Variance {staff.averageVariance >= 0 ? '+' : ''}฿{formatCurrency(staff.averageVariance)}
                                        </span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <div className="bg-[#1a1a24] rounded-xl p-5 border border-white/10">
                    <div className="flex items-center gap-2 mb-4">
                        <TrendingUp className="text-orange-400" size={20} />
                        <h2 className="text-lg font-semibold">หัวจ่ายเด่น 7 วัน</h2>
                    </div>

                    <div className="space-y-3">
                        {data.performance.nozzles.length === 0 ? (
                            <div className="text-sm text-gray-500">ยังไม่มีข้อมูลหัวจ่ายย้อนหลัง</div>
                        ) : (
                            data.performance.nozzles.map((nozzle) => (
                                <div key={`${nozzle.stationId}-${nozzle.nozzleNumber}`} className="rounded-lg bg-black/20 p-3 border border-white/5">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <div className="font-medium">{nozzle.stationName}</div>
                                            <div className="text-xs text-gray-400">หัวจ่าย {nozzle.nozzleNumber}</div>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-mono text-orange-400">{nozzle.totalLiters.toLocaleString()} L</div>
                                            <div className="text-xs text-gray-500">฿{formatCurrency(nozzle.estimatedSales)}</div>
                                        </div>
                                    </div>
                                    <div className="mt-2 text-xs text-gray-400 flex flex-wrap gap-3">
                                        <span>{nozzle.shiftCount} กะ</span>
                                        <span>เฉลี่ย {nozzle.averageLitersPerShift.toLocaleString()} L/กะ</span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <div className="bg-[#1a1a24] rounded-xl p-5 border border-white/10">
                    <div className="flex items-center gap-2 mb-4">
                        <AlertTriangle className="text-red-400" size={20} />
                        <h2 className="text-lg font-semibold">Action Alerts</h2>
                    </div>

                    <div className="space-y-3">
                        {data.performance.alerts.length === 0 ? (
                            <div className="text-sm text-gray-500">ยังไม่มี alert ที่ต้องลงมือทันที</div>
                        ) : (
                            data.performance.alerts.map((alert) => (
                                <div
                                    key={alert.id}
                                    className={`rounded-lg p-3 border ${
                                        alert.severity === 'CRITICAL'
                                            ? 'bg-red-900/20 border-red-500/30'
                                            : alert.severity === 'WARNING'
                                                ? 'bg-yellow-900/20 border-yellow-500/30'
                                                : 'bg-blue-900/20 border-blue-500/30'
                                    }`}
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="font-medium">{alert.title}</div>
                                        <span className={`text-[10px] px-2 py-1 rounded ${
                                            alert.severity === 'CRITICAL'
                                                ? 'bg-red-500/20 text-red-300'
                                                : alert.severity === 'WARNING'
                                                    ? 'bg-yellow-500/20 text-yellow-300'
                                                    : 'bg-blue-500/20 text-blue-300'
                                        }`}>
                                            {alert.severity}
                                        </span>
                                    </div>
                                    <div className="text-xs text-gray-400 mt-2">{alert.detail}</div>
                                </div>
                            ))
                        )}
                    </div>
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
                        <Link href="/billing" className="text-sm text-purple-400 hover:underline flex items-center gap-1">
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
