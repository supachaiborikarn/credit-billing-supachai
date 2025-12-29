'use client';

import { useState, useEffect, use } from 'react';
import { ArrowLeft, Calendar, Clock, User, Lock, Unlock, RefreshCw } from 'lucide-react';
import { STATIONS } from '@/constants';
import Link from 'next/link';
import SimpleBottomNav from '../../components/SimpleBottomNav';

interface Shift {
    id: string;
    shiftNumber: number;
    staffId: string | null;
    staffName: string | null;
    status: 'OPEN' | 'CLOSED';
    createdAt: string;
    closedAt: string | null;
    closedById: string | null;
    closedByName: string | null;
}

interface DailyShifts {
    date: string;
    shifts: Shift[];
}

export default function ShiftHistoryPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const stationIndex = parseInt(id) - 1;
    const station = STATIONS[stationIndex];

    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [shiftsData, setShiftsData] = useState<DailyShifts | null>(null);

    // Fetch shifts for selected date
    const fetchShifts = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/station/${id}/shifts/history?date=${selectedDate}`);
            if (res.ok) {
                const data = await res.json();
                setShiftsData(data);
            }
        } catch (error) {
            console.error('Error fetching shifts:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchShifts();
    }, [id, selectedDate]);

    const formatDateTime = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleString('th-TH', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const formatTime = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleTimeString('th-TH', {
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const getShiftDuration = (start: string, end: string | null) => {
        if (!end) return 'กำลังทำงาน...';
        const startDate = new Date(start);
        const endDate = new Date(end);
        const diffMs = endDate.getTime() - startDate.getTime();
        const hours = Math.floor(diffMs / (1000 * 60 * 60));
        const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        return `${hours} ชม. ${minutes} นาที`;
    };

    if (!station) {
        return <div className="p-4 text-gray-500">ไม่พบสถานี</div>;
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 pb-20">
            {/* Header */}
            <header className="bg-black/30 backdrop-blur-sm sticky top-0 z-40">
                <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                        <Link href={`/simple-station/${id}/new/home`} className="p-2 hover:bg-white/10 rounded-lg">
                            <ArrowLeft size={20} className="text-gray-400" />
                        </Link>
                        <div>
                            <h1 className="font-bold text-white text-lg">📋 ประวัติกะ</h1>
                            <p className="text-xs text-gray-400">{station.name}</p>
                        </div>
                    </div>
                    <button
                        onClick={fetchShifts}
                        disabled={loading}
                        className="p-2 rounded-lg bg-white/10 hover:bg-white/20"
                    >
                        <RefreshCw size={18} className={`text-gray-400 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>

                {/* Date Selector */}
                <div className="px-4 pb-3">
                    <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-2">
                        <Calendar size={18} className="text-gray-400" />
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="bg-transparent text-white border-none outline-none flex-1"
                        />
                    </div>
                </div>
            </header>

            <div className="p-4 space-y-4">
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <RefreshCw size={32} className="animate-spin text-purple-500" />
                    </div>
                ) : shiftsData?.shifts && shiftsData.shifts.length > 0 ? (
                    <div className="space-y-4">
                        {shiftsData.shifts.map((shift) => (
                            <div
                                key={shift.id}
                                className={`rounded-2xl border overflow-hidden ${shift.status === 'OPEN'
                                        ? 'bg-green-500/10 border-green-500/30'
                                        : 'bg-white/5 border-white/10'
                                    }`}
                            >
                                {/* Shift Header */}
                                <div className="p-4 flex items-center justify-between border-b border-white/10">
                                    <div className="flex items-center gap-3">
                                        {shift.status === 'OPEN' ? (
                                            <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                                                <Unlock size={20} className="text-green-400" />
                                            </div>
                                        ) : (
                                            <div className="w-10 h-10 rounded-full bg-gray-500/20 flex items-center justify-center">
                                                <Lock size={20} className="text-gray-400" />
                                            </div>
                                        )}
                                        <div>
                                            <h3 className="font-bold text-white text-lg">กะที่ {shift.shiftNumber}</h3>
                                            <span className={`text-xs px-2 py-0.5 rounded-full ${shift.status === 'OPEN'
                                                    ? 'bg-green-500/20 text-green-400'
                                                    : 'bg-gray-500/20 text-gray-400'
                                                }`}>
                                                {shift.status === 'OPEN' ? '🟢 เปิดอยู่' : '⚫ ปิดแล้ว'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="text-right text-sm text-gray-400">
                                        <div>{getShiftDuration(shift.createdAt, shift.closedAt)}</div>
                                    </div>
                                </div>

                                {/* Staff Details */}
                                <div className="p-4 space-y-3">
                                    {/* Opened By */}
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                                            <User size={16} className="text-blue-400" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-xs text-gray-500">เปิดกะโดย</p>
                                            <p className="text-white font-medium">
                                                {shift.staffName || shift.staffId || 'ไม่ระบุ'}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <div className="flex items-center gap-1 text-gray-400 text-sm">
                                                <Clock size={14} />
                                                <span>{formatTime(shift.createdAt)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Closed By */}
                                    {shift.status === 'CLOSED' && (
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                                                <Lock size={16} className="text-purple-400" />
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-xs text-gray-500">ปิดกะโดย</p>
                                                <p className="text-white font-medium">
                                                    {shift.closedByName || shift.closedById || 'ไม่ระบุ'}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <div className="flex items-center gap-1 text-gray-400 text-sm">
                                                    <Clock size={14} />
                                                    <span>{shift.closedAt ? formatTime(shift.closedAt) : '-'}</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Timeline */}
                                    <div className="flex items-center gap-2 text-xs text-gray-500 pt-2 border-t border-white/10">
                                        <span>🕐 {formatDateTime(shift.createdAt)}</span>
                                        <span>→</span>
                                        <span>{shift.closedAt ? formatDateTime(shift.closedAt) : '(ยังไม่ปิด)'}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-12 text-gray-400">
                        <Clock size={48} className="mx-auto mb-3 opacity-50" />
                        <p>ไม่มีกะในวันที่เลือก</p>
                    </div>
                )}
            </div>

            <SimpleBottomNav stationId={id} />
        </div>
    );
}
