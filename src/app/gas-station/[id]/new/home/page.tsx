'use client';

import { useState, useEffect, use } from 'react';
import { Calendar, Clock, Fuel, DollarSign, FileText, AlertTriangle, ChevronRight, Trash2 } from 'lucide-react';
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
            // Fetch daily data
            const res = await fetch(`/api/gas-station/${id}/daily?date=${selectedDate}`);
            if (res.ok) {
                const data = await res.json();

                // Set stats
                setStats({
                    totalLiters: data.transactions?.reduce((sum: number, t: Transaction) => sum + t.liters, 0) || 0,
                    totalAmount: data.transactions?.reduce((sum: number, t: Transaction) => sum + t.amount, 0) || 0,
                    transactionCount: data.transactions?.length || 0,
                    currentStock: data.currentStock || 0,
                    stockAlert: data.station?.gasStockAlert || 1000,
                });

                // Set recent transactions (last 5)
                setRecentTransactions(data.transactions?.slice(-5).reverse() || []);

                // Set current shift
                setCurrentShift(data.currentShift || null);

                // Set gauge readings (latest for each tank)
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
        if (!selectedStaff) {
            alert('กรุณาเลือกพนักงาน');
            return;
        }

        setActionLoading(true);
        try {
            const res = await fetch(`/api/gas-station/${id}/shifts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date: selectedDate,
                    staffName: selectedStaff,
                }),
            });

            if (res.ok) {
                setShowShiftModal(false);
                setSelectedStaff('');
                fetchData();
            } else {
                const err = await res.json();
                alert(err.error || 'เปิดกะไม่สำเร็จ');
            }
        } catch (error) {
            console.error('Error opening shift:', error);
        } finally {
            setActionLoading(false);
        }
    };

    const closeShift = async () => {
        if (!currentShift) return;

        if (!confirm('ยืนยันปิดกะ?')) return;

        setActionLoading(true);
        try {
            const res = await fetch(`/api/gas-station/${id}/shifts/${currentShift.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'close' }),
            });

            if (res.ok) {
                fetchData();
            } else {
                const err = await res.json();
                alert(err.error || 'ปิดกะไม่สำเร็จ');
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
                setRecentTransactions(prev => prev.filter(t => t.id !== transactionId));
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
            <div className="min-h-screen bg-gray-100 flex items-center justify-center">
                <p className="text-gray-500">ไม่พบสถานี</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-100">
            {/* Header */}
            <header className="bg-white shadow-sm sticky top-0 z-40">
                <div className="px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
                            <Fuel className="text-white" size={18} />
                        </div>
                        <h1 className="font-bold text-gray-800 text-lg">{station.name}</h1>
                    </div>
                    <div className="flex items-center gap-2 bg-gray-100 px-3 py-1.5 rounded-lg">
                        <Calendar size={16} className="text-orange-500" />
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="bg-transparent text-gray-700 text-sm font-medium focus:outline-none"
                        />
                    </div>
                </div>
            </header>

            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
                </div>
            ) : (
                <div className="p-4 space-y-4">
                    {/* Shift Status Card */}
                    <div className="bg-white rounded-2xl shadow-sm p-4">
                        {currentShift ? (
                            <>
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                                        <span className="font-semibold text-gray-800">
                                            กะ{currentShift.shiftNumber === 1 ? 'เช้า' : 'บ่าย'} OPEN
                                        </span>
                                    </div>
                                    <span className="text-sm text-gray-500">
                                        <Clock size={14} className="inline mr-1" />
                                        เปิด {formatTime(currentShift.createdAt)}
                                    </span>
                                </div>
                                {currentShift.staffName && (
                                    <p className="text-gray-600 text-sm mb-3">
                                        พนักงาน: <span className="font-medium">{currentShift.staffName}</span>
                                    </p>
                                )}
                                <button
                                    onClick={closeShift}
                                    disabled={actionLoading}
                                    className="w-full py-2.5 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
                                >
                                    {actionLoading ? 'กำลังดำเนินการ...' : 'ปิดกะ'}
                                </button>
                            </>
                        ) : (
                            <>
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                                    <span className="font-semibold text-gray-600">ยังไม่เปิดกะ</span>
                                </div>
                                <button
                                    onClick={() => setShowShiftModal(true)}
                                    className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl transition-colors"
                                >
                                    เปิดกะ
                                </button>
                            </>
                        )}
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-3 gap-3">
                        <div className="bg-white rounded-xl p-3 shadow-sm">
                            <div className="flex items-center gap-1.5 mb-1">
                                <Fuel size={14} className="text-orange-500" />
                                <span className="text-xs text-gray-500">สต็อก</span>
                            </div>
                            <p className="text-lg font-bold text-gray-800">{formatCurrency(stats.currentStock)}</p>
                            <p className="text-xs text-gray-500">ลิตร</p>
                        </div>
                        <div className="bg-white rounded-xl p-3 shadow-sm">
                            <div className="flex items-center gap-1.5 mb-1">
                                <DollarSign size={14} className="text-green-500" />
                                <span className="text-xs text-gray-500">ยอดขาย</span>
                            </div>
                            <p className="text-lg font-bold text-gray-800">{formatCurrency(stats.totalAmount)}</p>
                            <p className="text-xs text-gray-500">บาท</p>
                        </div>
                        <div className="bg-white rounded-xl p-3 shadow-sm">
                            <div className="flex items-center gap-1.5 mb-1">
                                <FileText size={14} className="text-blue-500" />
                                <span className="text-xs text-gray-500">รายการ</span>
                            </div>
                            <p className="text-lg font-bold text-gray-800">{stats.transactionCount}</p>
                            <p className="text-xs text-gray-500">รายการ</p>
                        </div>
                    </div>

                    {/* Low Stock Warning */}
                    {stats.currentStock < stats.stockAlert && stats.currentStock > 0 && (
                        <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 flex items-center gap-3">
                            <AlertTriangle className="text-orange-500" size={20} />
                            <div>
                                <p className="text-orange-700 font-medium text-sm">สต็อกต่ำ</p>
                                <p className="text-orange-600 text-xs">
                                    เหลือ {formatCurrency(stats.currentStock)} ลิตร
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Tank Gauge Readings */}
                    {gaugeReadings.length > 0 && (
                        <div className="bg-white rounded-2xl shadow-sm p-4">
                            <h2 className="font-semibold text-gray-800 mb-3">⛽ ระดับถังแก๊ส</h2>
                            <div className="grid grid-cols-3 gap-2">
                                {[1, 2, 3].map(tankNum => {
                                    const latestReading = gaugeReadings
                                        .filter(g => g.tankNumber === tankNum)
                                        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
                                    const percentage = latestReading?.percentage || 0;
                                    const barColor = percentage > 50 ? 'bg-green-500' : percentage > 20 ? 'bg-yellow-500' : 'bg-red-500';

                                    return (
                                        <div key={tankNum} className="text-center">
                                            <p className="text-xs text-gray-500 mb-1">ถัง {tankNum}</p>
                                            <div className="h-20 w-10 mx-auto bg-gray-200 rounded-lg relative overflow-hidden">
                                                <div
                                                    className={`absolute bottom-0 left-0 right-0 ${barColor} transition-all duration-500`}
                                                    style={{ height: `${percentage}%` }}
                                                />
                                            </div>
                                            <p className="text-sm font-bold text-gray-800 mt-1">{percentage}%</p>
                                        </div>
                                    );
                                })}
                            </div>
                            <p className="text-xs text-gray-400 text-center mt-2">
                                อัพเดท: {gaugeReadings[0] ? formatTime(gaugeReadings[0].createdAt) : '-'}
                            </p>
                        </div>
                    )}

                    {/* Recent Transactions */}
                    <div className="bg-white rounded-2xl shadow-sm">
                        <div className="flex items-center justify-between p-4 border-b border-gray-100">
                            <h2 className="font-semibold text-gray-800">รายการล่าสุด</h2>
                            <Link
                                href={`/gas-station/${id}/summary`}
                                className="text-orange-500 text-sm font-medium flex items-center gap-1"
                            >
                                ดูทั้งหมด <ChevronRight size={16} />
                            </Link>
                        </div>
                        <div className="divide-y divide-gray-100">
                            {recentTransactions.length > 0 ? (
                                recentTransactions.map((t) => (
                                    <div key={t.id} className="px-4 py-3 flex items-center justify-between">
                                        <div className="flex-1">
                                            <p className="font-medium text-gray-800">{t.licensePlate || '-'}</p>
                                            <p className="text-xs text-gray-500">
                                                {formatTime(t.date)} • {t.liters} ล.
                                            </p>
                                        </div>
                                        <div className="text-right mr-3">
                                            <p className="font-semibold text-gray-800">฿{formatCurrency(t.amount)}</p>
                                            <p className={`text-xs ${t.paymentType === 'CASH' ? 'text-green-600' :
                                                t.paymentType === 'CREDIT' ? 'text-purple-600' : 'text-blue-600'
                                                }`}>
                                                {t.paymentType === 'CASH' ? 'เงินสด' :
                                                    t.paymentType === 'CREDIT' ? 'เงินเชื่อ' : 'บัตร'}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => handleDelete(t.id)}
                                            disabled={deletingId === t.id}
                                            className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
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
                                <div className="p-8 text-center text-gray-400">
                                    <FileText size={32} className="mx-auto mb-2 opacity-50" />
                                    <p>ยังไม่มีรายการ</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Open Shift Modal */}
            {showShiftModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
                    <div className="bg-white w-full max-w-lg rounded-t-3xl p-6 animate-slide-up">
                        <h2 className="text-lg font-bold text-gray-800 mb-4">เปิดกะ</h2>

                        <div className="mb-4">
                            <label className="block text-sm text-gray-600 mb-2">เลือกพนักงาน</label>
                            <div className="grid grid-cols-3 gap-2">
                                {staffConfig?.staff?.map((staff: string) => (
                                    <button
                                        key={staff}
                                        onClick={() => setSelectedStaff(staff)}
                                        className={`py-2.5 px-3 rounded-xl border-2 text-sm font-medium transition-colors ${selectedStaff === staff
                                            ? 'border-orange-500 bg-orange-50 text-orange-700'
                                            : 'border-gray-200 text-gray-700 hover:border-gray-300'
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
                                className="flex-1 py-3 bg-gray-100 text-gray-700 font-semibold rounded-xl"
                            >
                                ยกเลิก
                            </button>
                            <button
                                onClick={openShift}
                                disabled={actionLoading || !selectedStaff}
                                className="flex-1 py-3 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl disabled:opacity-50"
                            >
                                {actionLoading ? 'กำลังเปิด...' : 'เปิดกะ'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
