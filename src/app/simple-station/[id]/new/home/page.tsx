'use client';

import { useState, useEffect, use } from 'react';
import { Calendar, Clock, LogOut, DollarSign, BarChart3, Banknote, CreditCard, Fuel, FileText, History, Settings, LockKeyhole } from 'lucide-react';
import { STATIONS, STATION_STAFF } from '@/constants';
import Link from 'next/link';
import DailyCashEntry from '../../components/DailyCashEntry';
import { useRouter } from 'next/navigation';
import ShiftGuard from '../../components/ShiftGuard';
import AutoLogout from '@/components/AutoLogout';
import TimeBasedReminder from '@/components/TimeBasedReminder';
import {
    buildFullStationDailyPriceForm,
    createEmptyFullStationDailyPriceForm,
    hasAnyFullStationDailyPrice,
    parseFullStationDailyPriceForm,
} from '@/lib/full-station-price-utils';

interface ShiftData {
    id: string;
    shiftNumber: number;
    status: string;
    staffName?: string;
    createdAt: string;
}

interface Transaction {
    id: string;
    licensePlate: string;
    ownerName: string;
    paymentType: string;
    amount: number;
    liters: number;
    fuelType: string;
    createdAt: string;
}

const SHIFT_NAMES = ['กะเช้า', 'กะบ่าย', 'กะดึก'];

export default function SimpleStationHomePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const stationIndex = parseInt(id) - 1;
    const station = STATIONS[stationIndex];
    const stationId = `station-${id}`;
    const stationConfig = STATION_STAFF[stationId as keyof typeof STATION_STAFF];
    const maxShifts = stationConfig?.maxShifts || 2;
    const router = useRouter();

    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [loading, setLoading] = useState(true);
    const [currentShift, setCurrentShift] = useState<ShiftData | null>(null);
    const [allShifts, setAllShifts] = useState<ShiftData[]>([]);
    const [actionLoading, setActionLoading] = useState(false);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [isAdmin, setIsAdmin] = useState(false);

    // Fuel price setup modal
    const [showFuelPriceModal, setShowFuelPriceModal] = useState(false);
    const [pendingShiftNumber, setPendingShiftNumber] = useState<number | null>(null);
    const [priceForm, setPriceForm] = useState(createEmptyFullStationDailyPriceForm());

    // Stats
    const [stats, setStats] = useState({
        totalAmount: 0,
        totalLiters: 0,
        cashTotal: 0,
        creditTotal: 0,
        txnCount: 0,
    });

    // Check user role
    useEffect(() => {
        const checkUser = async () => {
            try {
                const res = await fetch('/api/auth/me');
                if (res.ok) {
                    const data = await res.json();
                    setIsAdmin(data.user?.role === 'ADMIN');
                }
            } catch { /* ignore */ }
        };
        checkUser();
    }, []);

    // Fetch data
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                // Fetch shifts
                const shiftRes = await fetch(`/api/station/${id}/shifts?date=${selectedDate}`);
                if (shiftRes.ok) {
                    const data = await shiftRes.json();
                    setAllShifts(data.shifts || []);
                    setCurrentShift(data.currentShift || null);
                }

                // Fetch transactions
                const txnRes = await fetch(`/api/station/${id}/transactions?date=${selectedDate}`);
                if (txnRes.ok) {
                    const txns = await txnRes.json();
                    setTransactions(txns || []);

                    // Calculate stats
                    const totalAmount = txns.reduce((s: number, t: Transaction) => s + Number(t.amount), 0);
                    const totalLiters = txns.reduce((s: number, t: Transaction) => s + Number(t.liters), 0);
                    const cashTotal = txns.filter((t: Transaction) => t.paymentType === 'CASH').reduce((s: number, t: Transaction) => s + Number(t.amount), 0);
                    const creditTotal = txns.filter((t: Transaction) => t.paymentType === 'CREDIT').reduce((s: number, t: Transaction) => s + Number(t.amount), 0);

                    setStats({
                        totalAmount,
                        totalLiters,
                        cashTotal,
                        creditTotal,
                        txnCount: txns.length,
                    });
                }

                const dailyRes = await fetch(`/api/station/${id}/daily?date=${selectedDate}`);
                if (dailyRes.ok) {
                    const dailyData = await dailyRes.json();
                    setPriceForm(buildFullStationDailyPriceForm(dailyData.dailyRecord));
                } else {
                    setPriceForm(createEmptyFullStationDailyPriceForm());
                }
            } catch (error) {
                console.error('Error fetching data:', error);
            } finally {
                setLoading(false);
            }
        };

        if (station) fetchData();
    }, [station, id, selectedDate]);

    const loadDailyPriceForm = async () => {
        try {
            const res = await fetch(`/api/station/${id}/daily?date=${selectedDate}`);
            if (res.ok) {
                const data = await res.json();
                setPriceForm(buildFullStationDailyPriceForm(data.dailyRecord));
                return;
            }
        } catch (error) {
            console.error('Error loading daily prices:', error);
        }

        setPriceForm(createEmptyFullStationDailyPriceForm());
    };

    // Open shift - show fuel price modal first
    const openShift = async (shiftNumber: number) => {
        setPendingShiftNumber(shiftNumber);
        await loadDailyPriceForm();
        setShowFuelPriceModal(true);
    };

    // Confirm open shift after setting fuel prices
    const confirmOpenShift = async () => {
        if (!pendingShiftNumber) return;
        if (!hasAnyFullStationDailyPrice(priceForm)) {
            alert('กรุณาใส่ราคาน้ำมันประจำวันก่อนเปิดกะ');
            return;
        }

        setActionLoading(true);

        try {
            const { retailPrice, wholesalePrice } = parseFullStationDailyPriceForm(priceForm);
            const priceRes = await fetch(`/api/station/${id}/daily`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date: selectedDate,
                    retailPrice,
                    wholesalePrice,
                }),
            });

            if (!priceRes.ok) {
                const err = await priceRes.json();
                throw new Error(err.error || 'บันทึกราคาน้ำมันไม่สำเร็จ');
            }

            const res = await fetch(`/api/station/${id}/shifts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'open', shiftNumber: pendingShiftNumber }),
            });
            if (res.ok) {
                const data = await res.json();
                setCurrentShift(data.shift);
                setAllShifts(prev => [...prev, data.shift]);
                setShowFuelPriceModal(false);
            } else {
                const err = await res.json();
                // Check if there's an old unclosed shift that needs to be closed first
                if (err.requiresCloseOldShift && err.oldShift) {
                    const confirmClose = confirm(`${err.error}\n\nต้องการไปหน้าปิดกะเก่าหรือไม่?`);
                    if (confirmClose) {
                        // Redirect to shift-end page
                        window.location.href = `/simple-station/${id}/new/shift-end`;
                    }
                } else {
                    alert(err.error || 'เปิดกะไม่สำเร็จ');
                }
            }
        } catch (e) {
            alert(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด');
        } finally {
            setActionLoading(false);
            setPendingShiftNumber(null);
        }
    };

    const formatCurrency = (num: number) =>
        new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);

    const handleLogout = async () => {
        if (!confirm('ต้องการออกจากระบบหรือไม่?')) return;
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
            router.push('/login');
        } catch {
            alert('เกิดข้อผิดพลาด');
        }
    };

    if (!station) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <p className="text-slate-500 font-semibold">ไม่พบสถานี</p>
            </div>
        );
    }

    return (
        <AutoLogout>
            <ShiftGuard stationId={stationId} urlId={id}>
                <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-rose-500/30">
                    {/* Time-based Reminder for Staff */}
                    <TimeBasedReminder
                        meterLink={`/simple-station/${id}/new/shift-end`}
                        actionLabel="ลงมิเตอร์ปิดกะ"
                        isDayClosed={!currentShift}
                        isAdmin={isAdmin}
                        date={selectedDate}
                    />

                    {/* Header */}
                    <header className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur-md border-b border-white/10 shadow-sm">
                        <div className="px-4 py-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-rose-600 text-white font-black text-sm shadow-[0_0_15px_rgba(225,29,72,0.4)] ring-2 ring-white/10">
                                    ⛽
                                </span>
                                <div>
                                    <h1 className="font-extrabold tracking-tight text-lg text-white drop-shadow-sm">{station.name}</h1>
                                    <p className="text-xs text-slate-400 font-medium tracking-wide border-l-2 border-rose-500 pl-1 ml-1 mt-0.5">Caltex Station</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {isAdmin && (
                                    <Link
                                        href={`/simple-station/${id}`}
                                        className="px-3 py-1.5 rounded-full text-xs font-bold bg-white/10 text-white border border-white/20 hover:bg-white/20 transition-colors"
                                    >
                                        ← UI เดิม
                                    </Link>
                                )}
                                <div className="flex items-center gap-2 rounded-full border border-white/15 bg-slate-800/80 px-3 py-1.5 shadow-inner">
                                    <Calendar size={14} className="text-rose-400" />
                                    <input
                                        type="date"
                                        value={selectedDate}
                                        onChange={(e) => setSelectedDate(e.target.value)}
                                        className="bg-transparent text-sm font-bold focus:outline-none w-[110px] text-white [color-scheme:dark]"
                                    />
                                </div>
                                <button
                                    onClick={handleLogout}
                                    className="p-2 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 hover:text-red-300 transition-colors"
                                    title="ออกจากระบบ"
                                >
                                    <LogOut size={16} />
                                </button>
                            </div>
                        </div>
                    </header>

                    {loading ? (
                        <div className="flex items-center justify-center h-64">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-rose-500 drop-shadow-[0_0_10px_rgba(225,29,72,0.5)]"></div>
                        </div>
                    ) : (
                        <main className="mx-auto max-w-6xl px-4 py-6 pb-24 space-y-6">
                            {/* Hero Stats Card */}
                            <div className="rounded-3xl border border-white/10 bg-slate-900/60 backdrop-blur-xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.3)] ring-1 ring-white/5">
                                {/* Shift Status Badge */}
                                <div className="flex flex-wrap gap-3 mb-5">
                                    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-slate-800/80 px-4 py-1.5 text-xs font-bold text-slate-200 shadow-inner">
                                        <span className={`h-2.5 w-2.5 rounded-full shadow-[0_0_8px_currentColor] ${currentShift ? 'bg-emerald-400 text-emerald-400 animate-pulse' : 'bg-slate-500 text-slate-500'}`}></span>
                                        <span>{currentShift ? `${SHIFT_NAMES[currentShift.shiftNumber - 1]} เปิดอยู่` : 'ยังไม่เปิดกะ'}</span>
                                    </div>
                                    {currentShift?.staffName && (
                                        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-slate-800/80 px-4 py-1.5 text-xs font-bold text-rose-300 shadow-inner">
                                            <span>👤 {currentShift.staffName}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Stats Grid - Caltex Premium Style */}
                                <div className="grid grid-cols-2 gap-3 mb-6">
                                    <div className="relative overflow-hidden rounded-2xl p-5 bg-gradient-to-br from-red-600 to-rose-700 text-white shadow-[0_8px_16px_rgba(225,29,72,0.25)] border border-red-400/30 group">
                                        <div className="absolute -right-4 -top-4 bg-white/10 w-24 h-24 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700"></div>
                                        <div className="relative z-10">
                                            <div className="flex items-center gap-2 mb-2">
                                                <DollarSign className="w-5 h-5 text-white/90 drop-shadow" />
                                                <span className="text-sm font-semibold tracking-wide text-white/90">ยอดขายรวม</span>
                                            </div>
                                            <p className="text-3xl font-extrabold tracking-tight drop-shadow-sm">{formatCurrency(stats.totalAmount)} <span className="text-lg font-bold opacity-80">฿</span></p>
                                        </div>
                                    </div>
                                    <div className="relative overflow-hidden rounded-2xl p-5 bg-gradient-to-br from-[#003B5C] to-blue-600 text-white shadow-[0_8px_16px_rgba(37,99,235,0.25)] border border-blue-400/30 group">
                                        <div className="absolute -right-4 -top-4 bg-white/10 w-24 h-24 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700"></div>
                                        <div className="relative z-10">
                                            <div className="flex items-center gap-2 mb-2">
                                                <BarChart3 className="w-5 h-5 text-white/90 drop-shadow" />
                                                <span className="text-sm font-semibold tracking-wide text-white/90">รายการบิล</span>
                                            </div>
                                            <p className="text-3xl font-extrabold tracking-tight drop-shadow-sm">{stats.txnCount} <span className="text-lg font-bold opacity-80">รายการ</span></p>
                                        </div>
                                    </div>
                                    <div className="relative overflow-hidden rounded-2xl p-4 bg-gradient-to-br from-emerald-500 to-teal-700 text-white shadow-[0_4px_12px_rgba(16,185,129,0.2)] border border-emerald-400/30">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Banknote className="w-4 h-4 text-emerald-100" />
                                            <span className="text-xs font-semibold text-emerald-50 tracking-wide">เงินสด</span>
                                        </div>
                                        <p className="text-xl font-bold tracking-tight drop-shadow-sm">{formatCurrency(stats.cashTotal)} ฿</p>
                                    </div>
                                    <div className="relative overflow-hidden rounded-2xl p-4 bg-gradient-to-br from-violet-600 to-fuchsia-700 text-white shadow-[0_4px_12px_rgba(139,92,246,0.2)] border border-violet-400/30">
                                        <div className="flex items-center gap-2 mb-1">
                                            <CreditCard className="w-4 h-4 text-violet-100" />
                                            <span className="text-xs font-semibold text-violet-50 tracking-wide">เงินเชื่อ</span>
                                        </div>
                                        <p className="text-xl font-bold tracking-tight drop-shadow-sm">{formatCurrency(stats.creditTotal)} ฿</p>
                                    </div>
                                </div>

                                {/* Shift Actions */}
                                <div className="flex flex-wrap gap-2">
                                    {currentShift ? (
                                        <Link
                                            href={`/simple-station/${id}/new/shift-end`}
                                            className="flex-1 py-3 px-4 rounded-xl bg-red-500 text-white font-bold hover:bg-red-600 transition-colors flex items-center justify-center gap-2"
                                        >
                                            <Clock size={18} />
                                            ลงมิเตอร์/ปิดกะ
                                        </Link>
                                    ) : (
                                        Array.from({ length: maxShifts }, (_, i) => i + 1).map(num => {
                                            const isOpened = allShifts.some(s => s.shiftNumber === num);
                                            return (
                                                <button
                                                    key={num}
                                                    onClick={() => openShift(num)}
                                                    disabled={actionLoading || isOpened}
                                                    className={`flex-1 py-3 px-4 rounded-xl font-bold transition-colors flex items-center justify-center gap-2 ${isOpened
                                                        ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                                        : 'bg-green-500 text-white hover:bg-green-600'
                                                        }`}
                                                >
                                                    <Clock size={18} />
                                                    {isOpened ? `${SHIFT_NAMES[num - 1]} (ปิดแล้ว)` : `เปิด${SHIFT_NAMES[num - 1]}`}
                                                </button>
                                            );
                                        })
                                    )}
                                </div>

                                {/* Quick Actions - Caltex Premium Style */}
                                <div className="mt-5 grid grid-cols-3 gap-3">
                                    <Link
                                        href={`/simple-station/${id}/new/sell`}
                                        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-rose-500 to-red-600 p-5 text-center text-white shadow-[0_0_20px_rgba(225,29,72,0.4)] hover:shadow-[0_0_25px_rgba(225,29,72,0.6)] transition-all hover:-translate-y-1 border border-white/20 group hover:ring-2 hover:ring-white/50"
                                    >
                                        <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                        <FileText className="w-7 h-7 mx-auto mb-2 drop-shadow-lg" />
                                        <p className="text-sm font-extrabold tracking-wide drop-shadow-sm">ลงบิลใหม่</p>
                                    </Link>
                                    <Link
                                        href={`/simple-station/${id}/new/summary`}
                                        className="relative overflow-hidden rounded-2xl bg-slate-800/80 p-5 text-center text-slate-200 border border-white/10 hover:bg-slate-700/80 hover:border-white/30 hover:text-white transition-all hover:-translate-y-1 shadow-lg group"
                                    >
                                        <div className="absolute inset-0 bg-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                        <BarChart3 className="w-7 h-7 mx-auto mb-2 text-blue-400 group-hover:scale-110 transition-transform" />
                                        <p className="text-sm font-bold tracking-wide">สรุปรายวัน</p>
                                    </Link>
                                    <button
                                        onClick={() => {
                                            setPendingShiftNumber(null);
                                            loadDailyPriceForm();
                                            setShowFuelPriceModal(true);
                                        }}
                                        className="relative overflow-hidden rounded-2xl bg-slate-800/80 p-5 text-center text-slate-200 border border-white/10 hover:bg-slate-700/80 hover:border-white/30 hover:text-white transition-all hover:-translate-y-1 shadow-lg group"
                                    >
                                        <div className="absolute inset-0 bg-amber-500/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                        <Fuel className="w-7 h-7 mx-auto mb-2 text-amber-500 group-hover:scale-110 transition-transform" />
                                        <p className="text-sm font-bold tracking-wide">ตั้งราคา</p>
                                    </button>
                                    <Link
                                        href={`/simple-station/${id}/new/meter-summary`}
                                        className="relative overflow-hidden rounded-2xl bg-slate-800/80 p-5 text-center text-slate-200 border border-white/10 hover:bg-slate-700/80 hover:border-white/30 hover:text-white transition-all hover:-translate-y-1 shadow-lg group"
                                    >
                                        <div className="absolute inset-0 bg-cyan-500/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                        <Settings className="w-7 h-7 mx-auto mb-2 text-cyan-400 group-hover:scale-110 transition-transform" />
                                        <p className="text-sm font-bold tracking-wide">มิเตอร์</p>
                                    </Link>
                                    <Link
                                        href={`/simple-station/${id}/new/shift-end`}
                                        className="relative overflow-hidden rounded-2xl bg-slate-800/80 p-5 text-center text-slate-200 border border-white/10 hover:bg-slate-700/80 hover:border-rose-500/50 hover:text-white transition-all hover:-translate-y-1 shadow-lg group"
                                    >
                                        <div className="absolute inset-0 bg-rose-500/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                        <LockKeyhole className="w-7 h-7 mx-auto mb-2 text-rose-400 group-hover:scale-110 transition-transform" />
                                        <p className="text-sm font-bold tracking-wide">ปิดกะ</p>
                                    </Link>
                                    <Link
                                        href={`/simple-station/${id}/new/shift-history`}
                                        className="relative overflow-hidden rounded-2xl bg-slate-800/80 p-5 text-center text-slate-200 border border-white/10 hover:bg-slate-700/80 hover:border-white/30 hover:text-white transition-all hover:-translate-y-1 shadow-lg group"
                                    >
                                        <div className="absolute inset-0 bg-indigo-500/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                        <History className="w-7 h-7 mx-auto mb-2 text-indigo-400 group-hover:scale-110 transition-transform" />
                                        <p className="text-sm font-bold tracking-wide">ประวัติกะ</p>
                                    </Link>
                                </div>
                            </div>

                            {/* Daily Cash/Credit/Expenses Entry */}
                            <DailyCashEntry stationId={id} selectedDate={selectedDate} />

                            {/* Recent Transactions */}
                            <div className="rounded-3xl border border-white/10 bg-slate-900/60 backdrop-blur-xl p-5 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="font-extrabold text-lg text-white">📋 รายการล่าสุด</h2>
                                    <Link href={`/simple-station/${id}/new/summary`} className="text-blue-400 hover:text-blue-300 text-sm font-semibold transition-colors">
                                        ดูทั้งหมด →
                                    </Link>
                                </div>

                                {transactions.length === 0 ? (
                                    <p className="text-center text-slate-500 py-6">ยังไม่มีรายการ</p>
                                ) : (
                                    <div className="space-y-3">
                                        {transactions.slice(0, 5).map((txn) => (
                                            <div key={txn.id} className="flex items-center justify-between p-4 rounded-xl bg-slate-800/80 border border-white/5 hover:border-white/10 transition-colors">
                                                <div>
                                                    <p className="font-bold text-sm text-slate-200">{txn.licensePlate || 'ไม่ระบุ'}</p>
                                                    <p className="text-xs text-slate-400 mt-0.5">{txn.ownerName || '-'}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="font-bold text-emerald-400 tracking-wide">{formatCurrency(txn.amount)} ฿</p>
                                                    <p className="text-xs text-slate-400 mt-0.5">{txn.liters} ลิตร</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </main>
                    )}

                    {/* Fuel Price Setup Modal */}
                    {showFuelPriceModal && (
                        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                            <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
                                <div className="p-4 border-b">
                                    <h2 className="text-lg font-bold text-gray-800 text-center">⛽ ตั้งราคาน้ำมันวันนี้</h2>
                                    <p className="text-sm text-gray-500 text-center mt-1">กรอกราคาที่จะใช้ในการลงบิล</p>
                                </div>
                                <div className="p-4 space-y-3">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">ขายปลีก / เชื่อ (บาท/ลิตร)</label>
                                        <input
                                            type="number"
                                            value={priceForm.retailPrice}
                                            onChange={(e) => setPriceForm(prev => ({ ...prev, retailPrice: e.target.value }))}
                                            placeholder="เช่น 31.34"
                                            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-lg text-center font-bold focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-800"
                                            inputMode="decimal"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">ขายส่ง / สด (บาท/ลิตร)</label>
                                        <input
                                            type="number"
                                            value={priceForm.wholesalePrice}
                                            onChange={(e) => setPriceForm(prev => ({ ...prev, wholesalePrice: e.target.value }))}
                                            placeholder="เช่น 30.50"
                                            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-lg text-center font-bold focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-800"
                                            inputMode="decimal"
                                        />
                                    </div>
                                    <p className="text-xs text-gray-500">
                                        ราคาชุดนี้จะถูกบันทึกลงฐานข้อมูลเดียวกับหน้าเดิม และหน้าลงบิลใหม่จะดึงค่าจากที่นี่
                                    </p>
                                </div>
                                <div className="p-4 border-t flex gap-2">
                                    <button
                                        onClick={() => { setShowFuelPriceModal(false); setPendingShiftNumber(null); }}
                                        className="flex-1 py-3 rounded-xl border text-gray-600 hover:bg-gray-50"
                                    >
                                        ยกเลิก
                                    </button>
                                    {pendingShiftNumber ? (
                                        <button
                                            onClick={confirmOpenShift}
                                            disabled={actionLoading}
                                            className="flex-1 py-3 rounded-xl bg-green-500 text-white hover:bg-green-600 disabled:opacity-50 font-bold"
                                        >
                                            {actionLoading ? 'กำลังเปิดกะ...' : `เปิด${SHIFT_NAMES[pendingShiftNumber - 1]}`}
                                        </button>
                                    ) : (
                                        <button
                                            onClick={async () => {
                                                if (!hasAnyFullStationDailyPrice(priceForm)) {
                                                    alert('กรุณาใส่ราคาน้ำมันอย่างน้อย 1 ค่า');
                                                    return;
                                                }

                                                try {
                                                    const { retailPrice, wholesalePrice } = parseFullStationDailyPriceForm(priceForm);
                                                    const res = await fetch(`/api/station/${id}/daily`, {
                                                        method: 'POST',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify({
                                                            date: selectedDate,
                                                            retailPrice,
                                                            wholesalePrice,
                                                        }),
                                                    });

                                                    if (!res.ok) {
                                                        const err = await res.json();
                                                        throw new Error(err.error || 'บันทึกราคาน้ำมันไม่สำเร็จ');
                                                    }

                                                    setShowFuelPriceModal(false);
                                                    alert('✅ บันทึกราคาน้ำมันแล้ว');
                                                } catch (error) {
                                                    alert(error instanceof Error ? error.message : 'เกิดข้อผิดพลาด');
                                                }
                                            }}
                                            className="flex-1 py-3 rounded-xl bg-orange-500 text-white hover:bg-orange-600 font-bold"
                                        >
                                            บันทึกราคา
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </ShiftGuard>
        </AutoLogout>
    );
}
