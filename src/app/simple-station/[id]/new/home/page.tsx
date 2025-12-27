'use client';

import { useState, useEffect, use } from 'react';
import { Calendar, Clock, LogOut } from 'lucide-react';
import { STATIONS, STATION_STAFF } from '@/constants';
import Link from 'next/link';
import DailyCashEntry from '../../components/DailyCashEntry';
import { useRouter } from 'next/navigation';

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
    const [fuelPriceInputs, setFuelPriceInputs] = useState({
        DIESEL: '',
        GASOHOL_91: '',
        GASOHOL_95: '',
        GASOHOL_E20: '',
    });

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
            } catch (e) { /* ignore */ }
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
            } catch (error) {
                console.error('Error fetching data:', error);
            } finally {
                setLoading(false);
            }
        };

        if (station) fetchData();
    }, [station, id, selectedDate]);

    // Open shift - show fuel price modal first
    const openShift = (shiftNumber: number) => {
        setPendingShiftNumber(shiftNumber);
        // Load existing prices if any
        const storageKey = `fuelPrices_station${id}_${selectedDate}`;
        const stored = localStorage.getItem(storageKey);
        if (stored) {
            const prices = JSON.parse(stored);
            setFuelPriceInputs({
                DIESEL: prices.DIESEL?.toString() || '',
                GASOHOL_91: prices.GASOHOL_91?.toString() || '',
                GASOHOL_95: prices.GASOHOL_95?.toString() || '',
                GASOHOL_E20: prices.GASOHOL_E20?.toString() || '',
            });
        } else {
            setFuelPriceInputs({ DIESEL: '', GASOHOL_91: '', GASOHOL_95: '', GASOHOL_E20: '' });
        }
        setShowFuelPriceModal(true);
    };

    // Confirm open shift after setting fuel prices
    const confirmOpenShift = async () => {
        if (!pendingShiftNumber) return;

        // Save fuel prices to localStorage
        const prices: Record<string, number> = {};
        if (fuelPriceInputs.DIESEL) prices.DIESEL = parseFloat(fuelPriceInputs.DIESEL);
        if (fuelPriceInputs.GASOHOL_91) prices.GASOHOL_91 = parseFloat(fuelPriceInputs.GASOHOL_91);
        if (fuelPriceInputs.GASOHOL_95) prices.GASOHOL_95 = parseFloat(fuelPriceInputs.GASOHOL_95);
        if (fuelPriceInputs.GASOHOL_E20) prices.GASOHOL_E20 = parseFloat(fuelPriceInputs.GASOHOL_E20);

        const storageKey = `fuelPrices_station${id}_${selectedDate}`;
        localStorage.setItem(storageKey, JSON.stringify(prices));

        setShowFuelPriceModal(false);
        setActionLoading(true);

        try {
            const res = await fetch(`/api/station/${id}/shifts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'open', shiftNumber: pendingShiftNumber }),
            });
            if (res.ok) {
                const data = await res.json();
                setCurrentShift(data.shift);
                setAllShifts(prev => [...prev, data.shift]);
            } else {
                const err = await res.json();
                alert(err.error || 'เปิดกะไม่สำเร็จ');
            }
        } catch (e) {
            alert('เกิดข้อผิดพลาด');
        } finally {
            setActionLoading(false);
            setPendingShiftNumber(null);
        }
    };

    // Close shift
    const closeShift = async () => {
        if (!currentShift) return;
        setActionLoading(true);
        try {
            const res = await fetch(`/api/station/${id}/shifts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'close', shiftId: currentShift.id }),
            });
            if (res.ok) {
                setAllShifts(prev => prev.map(s => s.id === currentShift.id ? { ...s, status: 'CLOSED' } : s));
                setCurrentShift(null);
            } else {
                const err = await res.json();
                alert(err.error || 'ปิดกะไม่สำเร็จ');
            }
        } catch (e) {
            alert('เกิดข้อผิดพลาด');
        } finally {
            setActionLoading(false);
        }
    };

    const formatCurrency = (num: number) =>
        new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);

    const formatTime = (dateStr: string) =>
        new Date(dateStr).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

    const handleLogout = async () => {
        if (!confirm('ต้องการออกจากระบบหรือไม่?')) return;
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
            router.push('/login');
        } catch (e) {
            alert('เกิดข้อผิดพลาด');
        }
    };

    if (!station) {
        return (
            <div className="min-h-screen bg-[#f6f6f6] flex items-center justify-center">
                <p className="text-neutral-500 font-semibold">ไม่พบสถานี</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f6f6f6] text-neutral-900">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-[#f6f6f6]/80 backdrop-blur border-b border-black/10">
                <div className="px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-orange-500 text-white font-black text-sm">
                            ⛽
                        </span>
                        <div>
                            <h1 className="font-extrabold tracking-tight text-lg">{station.name}</h1>
                            <p className="text-xs text-neutral-500 font-semibold">ปั๊มน้ำมัน</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {isAdmin && (
                            <Link
                                href={`/simple-station/${id}`}
                                className="px-3 py-1.5 rounded-full text-xs font-bold bg-purple-100 text-purple-700 border border-purple-200 hover:bg-purple-200 transition-colors"
                            >
                                ← UI เดิม
                            </Link>
                        )}
                        <div className="flex items-center gap-2 rounded-full border border-black/15 bg-white px-3 py-1.5">
                            <Calendar size={14} className="text-orange-500" />
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="bg-transparent text-sm font-bold focus:outline-none w-[110px]"
                            />
                        </div>
                        <button
                            onClick={handleLogout}
                            className="p-2 rounded-full bg-red-50 text-red-500 border border-red-200 hover:bg-red-100 transition-colors"
                            title="ออกจากระบบ"
                        >
                            <LogOut size={16} />
                        </button>
                    </div>
                </div>
            </header>

            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
                </div>
            ) : (
                <main className="mx-auto max-w-6xl px-4 py-6 pb-24 space-y-5">
                    {/* Hero Stats Card */}
                    <div className="rounded-3xl border border-black/10 bg-white p-6 shadow-[0_10px_30px_rgba(0,0,0,0.08)]">
                        {/* Shift Status Badge */}
                        <div className="flex flex-wrap gap-3 mb-4">
                            <div className="inline-flex items-center gap-2 rounded-full border border-black/15 bg-[#fafafa] px-3 py-1 text-xs font-bold">
                                <span className={`h-2 w-2 rounded-full ${currentShift ? 'bg-green-500 animate-pulse' : 'bg-neutral-400'}`}></span>
                                <span>{currentShift ? `${SHIFT_NAMES[currentShift.shiftNumber - 1]} เปิดอยู่` : 'ยังไม่เปิดกะ'}</span>
                            </div>
                            {currentShift?.staffName && (
                                <div className="inline-flex items-center gap-2 rounded-full border border-black/15 bg-[#fafafa] px-3 py-1 text-xs font-bold">
                                    <span>👤 {currentShift.staffName}</span>
                                </div>
                            )}
                        </div>

                        {/* Stats Grid */}
                        <div className="grid grid-cols-2 gap-4 mb-5">
                            <div className="rounded-2xl border border-black/10 p-4 bg-gradient-to-br from-orange-50 to-white">
                                <p className="text-xs text-neutral-500 font-semibold">💰 ยอดขายรวม</p>
                                <p className="text-2xl font-extrabold text-orange-600">{formatCurrency(stats.totalAmount)} ฿</p>
                            </div>
                            <div className="rounded-2xl border border-black/10 p-4">
                                <p className="text-xs text-neutral-500 font-semibold">📊 รายการ</p>
                                <p className="text-2xl font-extrabold">{stats.txnCount}</p>
                            </div>
                            <div className="rounded-2xl border border-black/10 p-4">
                                <p className="text-xs text-neutral-500 font-semibold">💵 เงินสด</p>
                                <p className="text-xl font-bold text-green-600">{formatCurrency(stats.cashTotal)} ฿</p>
                            </div>
                            <div className="rounded-2xl border border-black/10 p-4">
                                <p className="text-xs text-neutral-500 font-semibold">📋 เงินเชื่อ</p>
                                <p className="text-xl font-bold text-purple-600">{formatCurrency(stats.creditTotal)} ฿</p>
                            </div>
                        </div>

                        {/* Shift Actions */}
                        <div className="flex flex-wrap gap-2">
                            {currentShift ? (
                                <button
                                    onClick={closeShift}
                                    disabled={actionLoading}
                                    className="flex-1 py-3 px-4 rounded-xl bg-red-500 text-white font-bold hover:bg-red-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                                >
                                    <Clock size={18} />
                                    ปิดกะ
                                </button>
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

                        {/* Quick Actions */}
                        <div className="mt-4 grid grid-cols-2 gap-2">
                            <Link
                                href={`/simple-station/${id}/new/sell`}
                                className="rounded-xl border border-black/10 bg-[#fafafa] p-4 text-center hover:bg-neutral-100 transition"
                            >
                                <span className="text-2xl">📝</span>
                                <p className="text-sm font-bold text-neutral-600 mt-1">ลงบิลใหม่</p>
                            </Link>
                            <Link
                                href={`/simple-station/${id}/new/summary`}
                                className="rounded-xl border border-black/10 bg-[#fafafa] p-4 text-center hover:bg-neutral-100 transition"
                            >
                                <span className="text-2xl">📋</span>
                                <p className="text-sm font-bold text-neutral-600 mt-1">สรุปรายวัน</p>
                            </Link>
                            <button
                                onClick={() => {
                                    // Load existing prices
                                    const storageKey = `fuelPrices_station${id}_${selectedDate}`;
                                    const stored = localStorage.getItem(storageKey);
                                    if (stored) {
                                        const prices = JSON.parse(stored);
                                        setFuelPriceInputs({
                                            DIESEL: prices.DIESEL?.toString() || '',
                                            GASOHOL_91: prices.GASOHOL_91?.toString() || '',
                                            GASOHOL_95: prices.GASOHOL_95?.toString() || '',
                                            GASOHOL_E20: prices.GASOHOL_E20?.toString() || '',
                                        });
                                    }
                                    setPendingShiftNumber(null); // so modal knows we're just editing
                                    setShowFuelPriceModal(true);
                                }}
                                className="rounded-xl border border-orange-200 bg-orange-50 p-4 text-center hover:bg-orange-100 transition"
                            >
                                <span className="text-2xl">⛽</span>
                                <p className="text-sm font-bold text-orange-600 mt-1">ตั้งราคาน้ำมัน</p>
                            </button>
                        </div>
                    </div>

                    {/* Daily Cash/Credit/Expenses Entry */}
                    <DailyCashEntry stationId={id} selectedDate={selectedDate} />

                    {/* Recent Transactions */}
                    <div className="rounded-3xl border border-black/10 bg-white p-5">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="font-extrabold text-lg">📋 รายการล่าสุด</h2>
                            <Link href={`/simple-station/${id}/new/summary`} className="text-orange-500 text-sm font-semibold">
                                ดูทั้งหมด →
                            </Link>
                        </div>

                        {transactions.length === 0 ? (
                            <p className="text-center text-neutral-400 py-6">ยังไม่มีรายการ</p>
                        ) : (
                            <div className="space-y-2">
                                {transactions.slice(0, 5).map((txn) => (
                                    <div key={txn.id} className="flex items-center justify-between p-3 rounded-xl bg-[#fafafa] border border-black/5">
                                        <div>
                                            <p className="font-bold text-sm">{txn.licensePlate || 'ไม่ระบุ'}</p>
                                            <p className="text-xs text-neutral-500">{txn.ownerName || '-'}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold text-green-600">{formatCurrency(txn.amount)} ฿</p>
                                            <p className="text-xs text-neutral-500">{txn.liters} ลิตร</p>
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
                                <label className="block text-sm font-medium text-gray-700 mb-1">🛢️ ดีเซล (บาท/ลิตร)</label>
                                <input
                                    type="number"
                                    value={fuelPriceInputs.DIESEL}
                                    onChange={(e) => setFuelPriceInputs(prev => ({ ...prev, DIESEL: e.target.value }))}
                                    placeholder="เช่น 32.99"
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-lg text-center font-bold focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-800"
                                    inputMode="decimal"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">⛽ แก๊สโซฮอล์ 91 (บาท/ลิตร)</label>
                                <input
                                    type="number"
                                    value={fuelPriceInputs.GASOHOL_91}
                                    onChange={(e) => setFuelPriceInputs(prev => ({ ...prev, GASOHOL_91: e.target.value }))}
                                    placeholder="เช่น 35.99"
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-lg text-center font-bold focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-800"
                                    inputMode="decimal"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">⛽ แก๊สโซฮอล์ 95 (บาท/ลิตร)</label>
                                <input
                                    type="number"
                                    value={fuelPriceInputs.GASOHOL_95}
                                    onChange={(e) => setFuelPriceInputs(prev => ({ ...prev, GASOHOL_95: e.target.value }))}
                                    placeholder="เช่น 42.99"
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-lg text-center font-bold focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-800"
                                    inputMode="decimal"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">🍃 E20 (บาท/ลิตร)</label>
                                <input
                                    type="number"
                                    value={fuelPriceInputs.GASOHOL_E20}
                                    onChange={(e) => setFuelPriceInputs(prev => ({ ...prev, GASOHOL_E20: e.target.value }))}
                                    placeholder="เช่น 33.99"
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-lg text-center font-bold focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-800"
                                    inputMode="decimal"
                                />
                            </div>
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
                                    onClick={() => {
                                        // Just save prices without opening shift
                                        const prices: Record<string, number> = {};
                                        if (fuelPriceInputs.DIESEL) prices.DIESEL = parseFloat(fuelPriceInputs.DIESEL);
                                        if (fuelPriceInputs.GASOHOL_91) prices.GASOHOL_91 = parseFloat(fuelPriceInputs.GASOHOL_91);
                                        if (fuelPriceInputs.GASOHOL_95) prices.GASOHOL_95 = parseFloat(fuelPriceInputs.GASOHOL_95);
                                        if (fuelPriceInputs.GASOHOL_E20) prices.GASOHOL_E20 = parseFloat(fuelPriceInputs.GASOHOL_E20);

                                        const storageKey = `fuelPrices_station${id}_${selectedDate}`;
                                        localStorage.setItem(storageKey, JSON.stringify(prices));
                                        setShowFuelPriceModal(false);
                                        alert('✅ บันทึกราคาน้ำมันแล้ว');
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
    );
}
