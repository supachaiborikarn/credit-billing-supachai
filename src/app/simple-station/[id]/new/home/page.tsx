'use client';

import { useState, useEffect, use } from 'react';
import { Calendar, Clock } from 'lucide-react';
import { STATIONS, STATION_STAFF } from '@/constants';
import Link from 'next/link';
import DailyCashEntry from '../../components/DailyCashEntry';

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

    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [loading, setLoading] = useState(true);
    const [currentShift, setCurrentShift] = useState<ShiftData | null>(null);
    const [allShifts, setAllShifts] = useState<ShiftData[]>([]);
    const [actionLoading, setActionLoading] = useState(false);
    const [transactions, setTransactions] = useState<Transaction[]>([]);

    // Stats
    const [stats, setStats] = useState({
        totalAmount: 0,
        totalLiters: 0,
        cashTotal: 0,
        creditTotal: 0,
        txnCount: 0,
    });

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

    // Open shift
    const openShift = async (shiftNumber: number) => {
        setActionLoading(true);
        try {
            const res = await fetch(`/api/station/${id}/shifts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'open', shiftNumber }),
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
        </div>
    );
}
