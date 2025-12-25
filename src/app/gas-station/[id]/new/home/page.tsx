'use client';

import { useState, use } from 'react';
import { Calendar, AlertTriangle } from 'lucide-react';
import { STATIONS } from '@/constants';
import Link from 'next/link';
import { useGasStation } from '../../hooks/useGasStation';
import StatsCard from '../../components/StatsCard';
import ShiftControls from '../../components/ShiftControls';
import GaugeTanks from '../../components/GaugeTanks';
import GasComparison from '../../components/GasComparison';
import TransactionList from '../../components/TransactionList';

export default function GasStationHomePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const stationIndex = parseInt(id) - 1;
    const station = STATIONS[stationIndex];

    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

    const {
        loading,
        stats,
        currentShift,
        allShifts,
        recentTransactions,
        gaugeReadings,
        actionLoading,
        deletingId,
        openShift,
        closeShift,
        handleDelete,
    } = useGasStation(id, selectedDate);

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
            {/* Header */}
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
                        {/* Shift Status Badge */}
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

                        {/* Stats Grid */}
                        <StatsCard stats={stats} formatCurrency={formatCurrency} />

                        {/* Shift Actions */}
                        <div className="mt-5">
                            <ShiftControls
                                currentShift={currentShift}
                                allShifts={allShifts}
                                actionLoading={actionLoading}
                                onOpenShift={openShift}
                                onCloseShift={closeShift}
                            />
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

                    {/* Tank Gauges */}
                    <GaugeTanks
                        gaugeReadings={gaugeReadings}
                        formatTime={formatTime}
                    />

                    {/* Gas Comparison */}
                    <GasComparison
                        gaugeReadings={gaugeReadings}
                        totalLiters={stats.totalLiters}
                        formatCurrency={formatCurrency}
                    />

                    {/* Recent Transactions */}
                    <TransactionList
                        transactions={recentTransactions}
                        stationId={id}
                        deletingId={deletingId}
                        onDelete={handleDelete}
                        formatTime={formatTime}
                        formatCurrency={formatCurrency}
                    />
                </main>
            )}
        </div>
    );
}
