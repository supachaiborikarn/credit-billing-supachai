'use client';

import { useState, useEffect, use } from 'react';
import { Clock, Fuel, DollarSign, FileText, AlertTriangle, ChevronRight, Trash2, Calendar } from 'lucide-react';
import { STATIONS, STATION_STAFF } from '@/constants';
import Link from 'next/link';

interface ShiftData {
    id: string;
    shiftNumber: number;
    status: 'OPEN' | 'CLOSED';
    staffName?: string;
    createdAt: string;
    closedAt?: string;
}

interface Transaction {
    id: string;
    date: string;
    licensePlate: string;
    ownerName: string;
    liters: number;
    amount: number;
    paymentType: string;
}

interface DailyStats {
    totalLiters: number;
    totalAmount: number;
    transactionCount: number;
    currentStock: number;
    stockAlert: number;
}

interface GaugeReading {
    id: string;
    tankNumber: number;
    percentage: number;
    type: 'START' | 'END';
    shiftNumber: number;
    createdAt: string;
}

export default function GasStationHomePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const stationIndex = parseInt(id) - 1;
    const station = STATIONS[stationIndex];
    const staffConfig = STATION_STAFF[`station-${id}` as keyof typeof STATION_STAFF];

    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [currentShift, setCurrentShift] = useState<ShiftData | null>(null);
    const [stats, setStats] = useState<DailyStats>({
        totalLiters: 0,
        totalAmount: 0,
        transactionCount: 0,
        currentStock: 0,
        stockAlert: 1000,
    });
    const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
    const [gaugeReadings, setGaugeReadings] = useState<GaugeReading[]>([]);

    const [showShiftModal, setShowShiftModal] = useState(false);
    const [selectedStaff, setSelectedStaff] = useState('');
    const [actionLoading, setActionLoading] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    useEffect(() => {
        fetchData();
    }, [selectedDate]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/gas-station/${id}/daily?date=${selectedDate}`);
            if (res.ok) {
                const data = await res.json();
                setStats({
                    totalLiters: data.transactions?.reduce((sum: number, t: Transaction) => sum + t.liters, 0) || 0,
                    totalAmount: data.transactions?.reduce((sum: number, t: Transaction) => sum + t.amount, 0) || 0,
                    transactionCount: data.transactions?.length || 0,
                    currentStock: data.currentStock || 0,
                    stockAlert: data.station?.gasStockAlert || 1000,
                });
                setRecentTransactions(data.transactions?.slice(-5).reverse() || []);
                setCurrentShift(data.currentShift || null);
                if (data.gaugeReadings) {
                    setGaugeReadings(data.gaugeReadings);
                }
            }
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    const openShift = async () => {
        if (!selectedStaff) return;
        setActionLoading(true);
        try {
            const res = await fetch(`/api/gas-station/${id}/shifts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'open', staffName: selectedStaff }),
            });
            if (res.ok) {
                setShowShiftModal(false);
                setSelectedStaff('');
                fetchData();
            }
        } catch (error) {
            console.error('Error opening shift:', error);
        } finally {
            setActionLoading(false);
        }
    };

    const closeShift = async () => {
        if (!confirm('ยืนยันปิดกะ?')) return;
        setActionLoading(true);
        try {
            const res = await fetch(`/api/gas-station/${id}/shifts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'close', shiftId: currentShift?.id }),
            });
            if (res.ok) {
                fetchData();
            }
        } catch (error) {
            console.error('Error closing shift:', error);
        } finally {
            setActionLoading(false);
        }
    };

    const handleDelete = async (transactionId: string) => {
        if (!confirm('ยืนยันลบรายการนี้?')) return;
        setDeletingId(transactionId);
        try {
            const res = await fetch(`/api/gas-station/${id}/transactions/${transactionId}`, {
                method: 'DELETE',
            });
            if (res.ok) {
                fetchData();
            } else {
                const err = await res.json();
                alert(err.error || 'ลบไม่สำเร็จ');
            }
        } catch (error) {
            console.error('Delete error:', error);
            alert('เกิดข้อผิดพลาด');
        } finally {
            setDeletingId(null);
        }
    };

    const formatCurrency = (num: number) =>
        new Intl.NumberFormat('th-TH', { minimumFractionDigits: 0 }).format(num);

    const formatTime = (dateStr: string) =>
        new Date(dateStr).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

    if (!station) {
        return (
            <div className="min-h-screen bg-[#f6f6f6] flex items-center justify-center">
                <p className="text-neutral-500 font-semibold">ไม่พบสถานี</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f6f6f6] text-neutral-900">
            {/* Header - hq0 style */}
            <header className="sticky top-0 z-50 bg-[#f6f6f6]/80 backdrop-blur border-b border-black/10">
                <div className="px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-black text-white font-black text-sm">
                            ⛽
                        </span>
                        <div>
                            <h1 className="font-extrabold tracking-tight text-lg">{station.name}</h1>
                            <p className="text-xs text-neutral-500 font-semibold">Gas Station</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 rounded-full border border-black/15 bg-white px-3 py-1.5">
                        <Calendar size={14} className="text-orange-500" />
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="bg-transparent text-sm font-bold focus:outline-none w-[110px]"
                        />
                    </div>
                </div>
            </header>

            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
                </div>
            ) : (
                <main className="mx-auto max-w-6xl px-4 py-6 space-y-5">
                    {/* Hero Stats Card */}
                    <div className="rounded-3xl border border-black/10 bg-white p-6 shadow-[0_10px_30px_rgba(0,0,0,0.08)]">
                        <div className="flex flex-wrap gap-3 mb-4">
                            <div className="inline-flex items-center gap-2 rounded-full border border-black/15 bg-[#fafafa] px-3 py-1 text-xs font-bold">
                                <span className={`h-2 w-2 rounded-full ${currentShift ? 'bg-green-500 animate-pulse' : 'bg-neutral-400'}`}></span>
                                <span>{currentShift ? `กะ${currentShift.shiftNumber === 1 ? 'เช้า' : 'บ่าย'} เปิดอยู่` : 'ยังไม่เปิดกะ'}</span>
                            </div>
                            {currentShift?.staffName && (
                                <div className="inline-flex items-center gap-2 rounded-full border border-black/15 bg-[#fafafa] px-3 py-1 text-xs font-bold">
                                    <span>👤 {currentShift.staffName}</span>
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Stock */}
                            <div className="rounded-2xl border border-black/10 bg-gradient-to-br from-orange-50 to-orange-100 p-5">
                                <div className="text-xs font-black text-orange-600">สต็อกแก๊ส</div>
                                <div className="mt-2 text-3xl font-black tracking-tight">{formatCurrency(stats.currentStock)}</div>
                                <div className="text-sm font-semibold text-neutral-600">ลิตร</div>
                            </div>

                            {/* Sales */}
                            <div className="rounded-2xl border border-black/10 bg-gradient-to-br from-green-50 to-green-100 p-5">
                                <div className="text-xs font-black text-green-600">ยอดขายวันนี้</div>
                                <div className="mt-2 text-3xl font-black tracking-tight">฿{formatCurrency(stats.totalAmount)}</div>
                                <div className="text-sm font-semibold text-neutral-600">{formatCurrency(stats.totalLiters)} ลิตร</div>
                            </div>

                            {/* Transactions */}
                            <div className="rounded-2xl border border-black/10 bg-gradient-to-br from-blue-50 to-blue-100 p-5">
                                <div className="text-xs font-black text-blue-600">จำนวนรายการ</div>
                                <div className="mt-2 text-3xl font-black tracking-tight">{stats.transactionCount}</div>
                                <div className="text-sm font-semibold text-neutral-600">รายการ</div>
                            </div>
                        </div>

                        {/* Shift Action Button */}
                        <div className="mt-5">
                            {currentShift ? (
                                <button
                                    onClick={closeShift}
                                    disabled={actionLoading}
                                    className="w-full rounded-full border border-black/15 bg-white px-6 py-3 text-sm font-extrabold hover:bg-neutral-50 transition disabled:opacity-50"
                                >
                                    {actionLoading ? 'กำลังดำเนินการ...' : '🔒 ปิดกะ'}
                                </button>
                            ) : (
                                <button
                                    onClick={() => setShowShiftModal(true)}
                                    className="w-full rounded-full bg-orange-500 px-6 py-3 text-sm font-extrabold text-black hover:bg-orange-400 transition"
                                >
                                    🚀 เปิดกะ →
                                </button>
                            )}
                        </div>

                        {/* Quick Actions */}
                        <div className="mt-4 grid grid-cols-3 gap-2">
                            <Link
                                href={`/gas-station/${id}/new/supplies`}
                                className="rounded-xl border border-black/10 bg-[#fafafa] p-3 text-center hover:bg-neutral-100 transition"
                            >
                                <span className="text-lg">📦</span>
                                <p className="text-xs font-bold text-neutral-600 mt-1">รับแก๊สเข้า</p>
                            </Link>
                            <Link
                                href={`/gas-station/${id}/new/monthly-balance`}
                                className="rounded-xl border border-black/10 bg-[#fafafa] p-3 text-center hover:bg-neutral-100 transition"
                            >
                                <span className="text-lg">📊</span>
                                <p className="text-xs font-bold text-neutral-600 mt-1">บาลานซ์เดือน</p>
                            </Link>
                            <Link
                                href={`/gas-station/${id}/new/summary`}
                                className="rounded-xl border border-black/10 bg-[#fafafa] p-3 text-center hover:bg-neutral-100 transition"
                            >
                                <span className="text-lg">📋</span>
                                <p className="text-xs font-bold text-neutral-600 mt-1">สรุปรายวัน</p>
                            </Link>
                        </div>
                    </div>

                    {/* Low Stock Warning */}
                    {stats.currentStock < stats.stockAlert && stats.currentStock > 0 && (
                        <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4 flex items-center gap-3">
                            <AlertTriangle className="text-orange-500" size={24} />
                            <div>
                                <p className="font-extrabold text-orange-700">⚠️ สต็อกต่ำ</p>
                                <p className="text-sm text-orange-600">เหลือ {formatCurrency(stats.currentStock)} ลิตร (ต่ำกว่า {formatCurrency(stats.stockAlert)})</p>
                            </div>
                        </div>
                    )}

                    {/* Tank Gauges Section */}
                    {gaugeReadings.length > 0 && (
                        <div className="rounded-3xl border border-black/10 bg-white p-6">
                            <h2 className="text-xl font-black tracking-tight mb-4">
                                ⛽ <span className="bg-orange-200 px-2 rounded">ระดับถังแก๊ส</span>
                            </h2>
                            <div className="grid grid-cols-3 gap-4">
                                {[1, 2, 3].map(tankNum => {
                                    const latestReading = gaugeReadings
                                        .filter(g => g.tankNumber === tankNum)
                                        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
                                    const percentage = latestReading?.percentage || 0;
                                    const barColor = percentage > 50 ? 'bg-green-500' : percentage > 20 ? 'bg-yellow-500' : 'bg-red-500';

                                    return (
                                        <div key={tankNum} className="rounded-2xl border border-black/10 bg-[#fafafa] p-4 text-center">
                                            <div className="text-xs font-black text-neutral-500">ถัง {tankNum}</div>
                                            <div className="h-24 w-12 mx-auto mt-2 bg-neutral-200 rounded-xl relative overflow-hidden">
                                                <div
                                                    className={`absolute bottom-0 left-0 right-0 ${barColor} transition-all duration-700`}
                                                    style={{ height: `${percentage}%` }}
                                                />
                                            </div>
                                            <div className="mt-2 text-2xl font-black">{percentage}%</div>
                                        </div>
                                    );
                                })}
                            </div>
                            <p className="text-xs font-bold text-neutral-400 text-center mt-3">
                                อัพเดทล่าสุด: {gaugeReadings[0] ? formatTime(gaugeReadings[0].createdAt) : '-'}
                            </p>
                        </div>
                    )}

                    {/* Gas Usage Comparison Section */}
                    {gaugeReadings.length > 0 && (
                        (() => {
                            const LITERS_PER_PERCENT = 98;

                            // Calculate tank usage from gauge readings
                            let tankUsage = 0;
                            [1, 2, 3].forEach(tankNum => {
                                const tankReadings = gaugeReadings
                                    .filter(g => g.tankNumber === tankNum)
                                    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

                                if (tankReadings.length >= 2) {
                                    const firstReading = tankReadings[0].percentage;
                                    const lastReading = tankReadings[tankReadings.length - 1].percentage;
                                    const usedPercent = firstReading - lastReading;
                                    if (usedPercent > 0) {
                                        tankUsage += usedPercent * LITERS_PER_PERCENT;
                                    }
                                }
                            });

                            // Nozzle sales from transactions
                            const nozzleSales = stats.totalLiters;

                            // Difference
                            const difference = tankUsage - nozzleSales;
                            const diffPercent = nozzleSales > 0 ? (difference / nozzleSales * 100) : 0;
                            const isNormal = Math.abs(diffPercent) <= 5; // Within 5% is normal

                            return (
                                <div className="rounded-3xl border border-black/10 bg-white p-6">
                                    <h2 className="text-xl font-black tracking-tight mb-4">
                                        📊 <span className="bg-blue-200 px-2 rounded">เปรียบเทียบการใช้แก๊ส</span>
                                    </h2>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        {/* Tank Gauge Usage */}
                                        <div className="rounded-2xl border border-black/10 bg-[#fafafa] p-4">
                                            <div className="text-xs font-black text-purple-600">⛽ หักจากถัง</div>
                                            <div className="mt-1 text-2xl font-black">{formatCurrency(Math.round(tankUsage))}</div>
                                            <div className="text-sm font-semibold text-neutral-500">ลิตร (จากเกจ)</div>
                                        </div>

                                        {/* Nozzle Sales */}
                                        <div className="rounded-2xl border border-black/10 bg-[#fafafa] p-4">
                                            <div className="text-xs font-black text-green-600">🔧 ขายจากหัวจ่าย</div>
                                            <div className="mt-1 text-2xl font-black">{formatCurrency(Math.round(nozzleSales))}</div>
                                            <div className="text-sm font-semibold text-neutral-500">ลิตร (จากมิเตอร์)</div>
                                        </div>

                                        {/* Difference */}
                                        <div className={`rounded-2xl border p-4 ${isNormal
                                            ? 'border-green-200 bg-green-50'
                                            : 'border-red-200 bg-red-50'
                                            }`}>
                                            <div className={`text-xs font-black ${isNormal ? 'text-green-600' : 'text-red-600'}`}>
                                                {isNormal ? '✅ ปกติ' : '⚠️ ส่วนต่าง'}
                                            </div>
                                            <div className={`mt-1 text-2xl font-black ${isNormal ? 'text-green-700' : 'text-red-700'}`}>
                                                {difference >= 0 ? '+' : ''}{formatCurrency(Math.round(difference))}
                                            </div>
                                            <div className={`text-sm font-semibold ${isNormal ? 'text-green-600' : 'text-red-600'}`}>
                                                ลิตร ({diffPercent >= 0 ? '+' : ''}{diffPercent.toFixed(1)}%)
                                            </div>
                                        </div>
                                    </div>

                                    {!isNormal && Math.abs(difference) > 50 && (
                                        <div className="mt-4 rounded-xl bg-red-50 border border-red-200 p-3 flex items-center gap-2">
                                            <AlertTriangle className="text-red-500" size={18} />
                                            <p className="text-sm font-semibold text-red-700">
                                                ส่วนต่างมากกว่า 5% - ควรตรวจสอบการรั่วไหลหรือความคลาดเคลื่อนของมิเตอร์
                                            </p>
                                        </div>
                                    )}
                                </div>
                            );
                        })()
                    )}

                    {/* Recent Transactions */}
                    <div className="rounded-3xl border border-black/10 bg-white overflow-hidden">
                        <div className="flex items-center justify-between p-5 border-b border-black/5">
                            <h2 className="text-xl font-black tracking-tight">📋 รายการล่าสุด</h2>
                            <Link
                                href={`/gas-station/${id}/new/summary`}
                                className="inline-flex items-center gap-1 text-sm font-extrabold text-orange-500 hover:text-orange-600"
                            >
                                ดูทั้งหมด <ChevronRight size={16} />
                            </Link>
                        </div>
                        <div className="divide-y divide-black/5">
                            {recentTransactions.length > 0 ? (
                                recentTransactions.map((t) => (
                                    <div key={t.id} className="px-5 py-4 flex items-center justify-between hover:bg-[#fafafa] transition">
                                        <div className="flex-1">
                                            <p className="font-extrabold text-neutral-900">{t.licensePlate || '-'}</p>
                                            <p className="text-xs font-semibold text-neutral-500">
                                                {formatTime(t.date)} • {t.liters} ลิตร
                                            </p>
                                        </div>
                                        <div className="text-right mr-4">
                                            <p className="font-black text-neutral-900">฿{formatCurrency(t.amount)}</p>
                                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold ${t.paymentType === 'CASH' ? 'bg-green-100 text-green-700' :
                                                t.paymentType === 'CREDIT' ? 'bg-purple-100 text-purple-700' :
                                                    'bg-blue-100 text-blue-700'
                                                }`}>
                                                {t.paymentType === 'CASH' ? 'เงินสด' : t.paymentType === 'CREDIT' ? 'เงินเชื่อ' : 'บัตร'}
                                            </span>
                                        </div>
                                        <button
                                            onClick={() => handleDelete(t.id)}
                                            disabled={deletingId === t.id}
                                            className="p-2 rounded-full hover:bg-red-50 text-red-400 hover:text-red-600 transition disabled:opacity-50"
                                        >
                                            {deletingId === t.id ? (
                                                <div className="w-5 h-5 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                                            ) : (
                                                <Trash2 size={18} />
                                            )}
                                        </button>
                                    </div>
                                ))
                            ) : (
                                <div className="p-10 text-center">
                                    <FileText size={40} className="mx-auto mb-3 text-neutral-300" />
                                    <p className="text-neutral-400 font-semibold">ยังไม่มีรายการวันนี้</p>
                                </div>
                            )}
                        </div>
                    </div>
                </main>
            )}

            {/* Open Shift Modal - hq0 style */}
            {showShiftModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center">
                    <div className="bg-white w-full max-w-md rounded-t-3xl md:rounded-3xl p-6 animate-slide-up">
                        <h2 className="text-xl font-black tracking-tight mb-5">🚀 เปิดกะ</h2>

                        <div className="mb-5">
                            <label className="block text-sm font-bold text-neutral-600 mb-3">เลือกพนักงาน</label>
                            <div className="flex flex-wrap gap-2">
                                {staffConfig?.staff?.map((staff: string) => (
                                    <button
                                        key={staff}
                                        onClick={() => setSelectedStaff(staff)}
                                        className={`rounded-full px-4 py-2 text-sm font-extrabold transition ${selectedStaff === staff
                                            ? 'bg-black text-white'
                                            : 'border border-black/15 bg-white hover:bg-neutral-50'
                                            }`}
                                    >
                                        {staff}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowShiftModal(false)}
                                className="flex-1 rounded-full border border-black/15 bg-white px-6 py-3 text-sm font-extrabold hover:bg-neutral-50 transition"
                            >
                                ยกเลิก
                            </button>
                            <button
                                onClick={openShift}
                                disabled={actionLoading || !selectedStaff}
                                className="flex-1 rounded-full bg-orange-500 px-6 py-3 text-sm font-extrabold text-black hover:bg-orange-400 transition disabled:opacity-50"
                            >
                                {actionLoading ? 'กำลังเปิด...' : 'เปิดกะ →'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
