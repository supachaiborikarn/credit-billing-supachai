'use client';

import { useState, useEffect, use } from 'react';
import { Calendar, DollarSign, Fuel, FileText, TrendingUp, Clock, Users } from 'lucide-react';
import { STATIONS, STATION_STAFF } from '@/constants';
import Link from 'next/link';

interface DailyStats {
    totalAmount: number;
    totalLiters: number;
    transactionCount: number;
    byPaymentType: {
        CASH: number;
        CREDIT: number;
        TRANSFER: number;
        BOX_TRUCK: number;
    };
}

interface ShiftData {
    id: string;
    shiftNumber: number;
    status: 'OPEN' | 'CLOSED';
    staffName?: string;
    createdAt: string;
    closedAt?: string;
}

export default function StationHomePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const stationIndex = parseInt(id) - 1;
    const station = STATIONS[stationIndex];
    const staffConfig = STATION_STAFF[`station-${id}` as keyof typeof STATION_STAFF];

    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<DailyStats>({
        totalAmount: 0,
        totalLiters: 0,
        transactionCount: 0,
        byPaymentType: { CASH: 0, CREDIT: 0, TRANSFER: 0, BOX_TRUCK: 0 },
    });
    const [retailPrice, setRetailPrice] = useState(0);
    const [wholesalePrice, setWholesalePrice] = useState(0);

    // Shift state
    const [currentShift, setCurrentShift] = useState<ShiftData | null>(null);
    const [showShiftModal, setShowShiftModal] = useState(false);
    const [selectedStaff, setSelectedStaff] = useState('');
    const [actionLoading, setActionLoading] = useState(false);

    useEffect(() => {
        fetchData();
        fetchShifts();
    }, [selectedDate]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/station/${id}/daily?date=${selectedDate}`);
            if (res.ok) {
                const data = await res.json();

                if (data.dailyRecord) {
                    setRetailPrice(data.dailyRecord.retailPrice || 0);
                    setWholesalePrice(data.dailyRecord.wholesalePrice || 0);
                }

                // Calculate stats from transactions
                const transactions = data.transactions || [];
                const byPaymentType = { CASH: 0, CREDIT: 0, TRANSFER: 0, BOX_TRUCK: 0 };
                let totalAmount = 0;
                let totalLiters = 0;

                transactions.forEach((t: { paymentType: string; amount: number; liters: number }) => {
                    totalAmount += t.amount;
                    totalLiters += t.liters || 0;
                    if (t.paymentType in byPaymentType) {
                        byPaymentType[t.paymentType as keyof typeof byPaymentType] += t.amount;
                    }
                });

                setStats({
                    totalAmount,
                    totalLiters,
                    transactionCount: transactions.length,
                    byPaymentType,
                });
            }
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchShifts = async () => {
        try {
            const res = await fetch(`/api/station/${id}/shifts?date=${selectedDate}`);
            if (res.ok) {
                const data = await res.json();
                setCurrentShift(data.currentShift || null);
            }
        } catch (error) {
            console.error('Error fetching shifts:', error);
        }
    };

    const openShift = async () => {
        setActionLoading(true);
        try {
            const res = await fetch(`/api/station/${id}/shifts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'open', staffName: 'ระบบ' }),
            });
            if (res.ok) {
                fetchShifts();
            } else {
                const err = await res.json();
                alert(err.error || 'เปิดกะไม่สำเร็จ');
            }
        } catch (error) {
            console.error('Error opening shift:', error);
            alert('เกิดข้อผิดพลาด');
        } finally {
            setActionLoading(false);
        }
    };

    const closeShift = async () => {
        if (!confirm('ยืนยันปิดกะ?')) return;
        setActionLoading(true);
        try {
            const res = await fetch(`/api/station/${id}/shifts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'close', shiftId: currentShift?.id }),
            });
            if (res.ok) {
                fetchShifts();
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

    const formatCurrency = (num: number) =>
        new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2 }).format(num);

    const formatNumber = (num: number) =>
        new Intl.NumberFormat('th-TH', { minimumFractionDigits: 0 }).format(num);

    const formatTime = (dateStr: string) =>
        new Date(dateStr).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

    if (!station) {
        return <div className="p-4 text-gray-500">ไม่พบสถานี</div>;
    }

    return (
        <div className="min-h-screen bg-gray-100">
            {/* Header */}
            <header className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-6 shadow-lg">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h1 className="text-xl font-bold">{station.name}</h1>
                        <p className="text-blue-100 text-sm">⛽ สถานีบริการน้ำมัน</p>
                    </div>
                    <Link
                        href={`/station/${id}`}
                        className="px-3 py-1.5 bg-white/20 rounded-lg text-sm hover:bg-white/30 transition"
                    >
                        หน้าเดิม
                    </Link>
                </div>
                <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full bg-white/20 px-4 py-2 rounded-xl text-white placeholder-white/70 focus:outline-none focus:ring-2 focus:ring-white/50"
                />
            </header>

            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
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
                                    {actionLoading ? 'กำลังดำเนินการ...' : '🔒 ปิดกะ'}
                                </button>
                            </>
                        ) : (
                            <>
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                                    <span className="font-semibold text-gray-600">ยังไม่เปิดกะ</span>
                                </div>
                                <button
                                    onClick={openShift}
                                    disabled={actionLoading}
                                    className="w-full py-2.5 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
                                >
                                    {actionLoading ? 'กำลังเปิดกะ...' : '🚀 เปิดกะ'}
                                </button>
                            </>
                        )}
                    </div>

                    {/* Total Sales Card */}
                    <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl p-6 text-center shadow-lg">
                        <div className="flex items-center justify-center gap-2 mb-2">
                            <DollarSign className="text-green-200" size={24} />
                            <span className="text-green-100">ยอดขายวันนี้</span>
                        </div>
                        <p className="text-4xl font-bold text-white">
                            ฿{formatCurrency(stats.totalAmount)}
                        </p>
                        <div className="flex justify-center gap-6 mt-3 text-green-100">
                            <span>
                                <Fuel size={14} className="inline mr-1" />
                                {formatNumber(stats.totalLiters)} ลิตร
                            </span>
                            <span>
                                <FileText size={14} className="inline mr-1" />
                                {stats.transactionCount} รายการ
                            </span>
                        </div>
                    </div>

                    {/* Current Prices */}
                    <div className="bg-white rounded-2xl shadow-sm p-4">
                        <h2 className="font-semibold text-gray-800 mb-3">💰 ราคาน้ำมันวันนี้</h2>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-blue-50 p-3 rounded-xl text-center">
                                <p className="text-blue-600 text-sm">ราคาขายปลีก</p>
                                <p className="text-2xl font-bold text-blue-700">฿{formatCurrency(retailPrice)}</p>
                            </div>
                            <div className="bg-purple-50 p-3 rounded-xl text-center">
                                <p className="text-purple-600 text-sm">ราคาขายส่ง</p>
                                <p className="text-2xl font-bold text-purple-700">฿{formatCurrency(wholesalePrice)}</p>
                            </div>
                        </div>
                    </div>

                    {/* Sales by Payment Type */}
                    <div className="bg-white rounded-2xl shadow-sm p-4">
                        <h2 className="font-semibold text-gray-800 mb-3">💳 ยอดตามประเภทชำระ</h2>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between bg-green-50 p-3 rounded-xl">
                                <span className="text-green-700">💵 เงินสด</span>
                                <span className="text-green-800 font-bold">฿{formatCurrency(stats.byPaymentType.CASH)}</span>
                            </div>
                            <div className="flex items-center justify-between bg-purple-50 p-3 rounded-xl">
                                <span className="text-purple-700">📝 เงินเชื่อ</span>
                                <span className="text-purple-800 font-bold">฿{formatCurrency(stats.byPaymentType.CREDIT)}</span>
                            </div>
                            <div className="flex items-center justify-between bg-blue-50 p-3 rounded-xl">
                                <span className="text-blue-700">📲 โอนเงิน</span>
                                <span className="text-blue-800 font-bold">฿{formatCurrency(stats.byPaymentType.TRANSFER)}</span>
                            </div>
                            <div className="flex items-center justify-between bg-orange-50 p-3 rounded-xl">
                                <span className="text-orange-700">🚚 รถบรรทุก</span>
                                <span className="text-orange-800 font-bold">฿{formatCurrency(stats.byPaymentType.BOX_TRUCK)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="bg-white rounded-2xl shadow-sm p-4">
                        <h2 className="font-semibold text-gray-800 mb-3">⚡ ทางลัด</h2>
                        <div className="grid grid-cols-2 gap-3">
                            <Link
                                href={`/station/${id}/new/record`}
                                className="flex items-center gap-3 bg-blue-500 text-white p-4 rounded-xl hover:bg-blue-600 transition"
                            >
                                <FileText size={24} />
                                <span>ลงบันทึกใหม่</span>
                            </Link>
                            <Link
                                href={`/station/${id}/new/list`}
                                className="flex items-center gap-3 bg-gray-100 text-gray-700 p-4 rounded-xl hover:bg-gray-200 transition"
                            >
                                <TrendingUp size={24} />
                                <span>ดูรายการ</span>
                            </Link>
                        </div>
                    </div>
                </div>
            )}

            {/* Open Shift Modal */}
            {showShiftModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
                    <div className="bg-white w-full max-w-lg rounded-t-3xl p-6 animate-slide-up">
                        <h2 className="text-lg font-bold text-gray-800 mb-4">🚀 เปิดกะ</h2>

                        <div className="mb-4">
                            <label className="block text-sm text-gray-600 mb-2">เลือกพนักงาน</label>
                            <div className="grid grid-cols-3 gap-2">
                                {(staffConfig?.staff || ['พนักงาน 1', 'พนักงาน 2', 'พนักงาน 3']).map((staff: string) => (
                                    <button
                                        key={staff}
                                        onClick={() => setSelectedStaff(staff)}
                                        className={`py-2.5 px-3 rounded-xl border-2 text-sm font-medium transition-colors ${selectedStaff === staff
                                            ? 'border-blue-500 bg-blue-50 text-blue-700'
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
                                className="flex-1 py-3 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-xl disabled:opacity-50"
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
