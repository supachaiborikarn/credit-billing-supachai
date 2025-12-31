'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface ExecutiveOverview {
    date: string;
    kpis: {
        fuel_liters_total: number;
        expected_amount_total: number;
        shop_total: number;
        variance_abs_total: number;
    };
    shift_status: {
        total: number;
        green: number;
        yellow: number;
        red: number;
    };
    payments_today: {
        cash: number;
        transfer: number;
        credit: number;
        total: number;
    };
    ar: {
        outstanding_total: number;
        aging: {
            '0_7': number;
            '8_15': number;
            '16_30': number;
            '31_plus': number;
        };
    };
    stations: Array<{
        station_id: string;
        station_name: string;
        fuel_liters_total: number;
        expected_amount_total: number;
        shift_status: { green: number; yellow: number; red: number };
        last_closed_at: string | null;
        last_variance_status: string | null;
    }>;
}

function formatCurrency(amount: number) {
    return new Intl.NumberFormat('th-TH', {
        style: 'currency',
        currency: 'THB',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
}

function formatThaiDate(dateStr: string) {
    const d = new Date(dateStr);
    return d.toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function formatThaiTime(isoString: string | null) {
    if (!isoString) return '–';
    const d = new Date(isoString);
    return d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
}

export default function ExecutiveDashboardPage() {
    const router = useRouter();
    const [overview, setOverview] = useState<ExecutiveOverview | null>(null);
    const [loading, setLoading] = useState(true);
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

    useEffect(() => {
        loadData();
    }, [date]);

    const loadData = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/dashboard/executive?date=${date}`);
            if (res.ok) {
                const data = await res.json();
                setOverview(data);
            }
        } catch (error) {
            console.error('Failed to load dashboard:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-xl">กำลังโหลด...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg">
                <div className="px-4 py-4">
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-xl font-bold">Executive Dashboard</h1>
                            <div className="text-blue-100 text-sm">{formatThaiDate(date)}</div>
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="px-2 py-1 rounded text-sm text-gray-800"
                            />
                            <button
                                onClick={() => router.push('/dashboard/executive/trends')}
                                className="p-2 hover:bg-blue-500 rounded"
                            >
                                📊
                            </button>
                            <button
                                onClick={() => router.push('/dashboard')}
                                className="text-sm hover:bg-blue-500 rounded px-2 py-1"
                            >
                                กลับ
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {overview && (
                <div className="p-4 space-y-4">
                    {/* KPI Cards - 2x2 Grid */}
                    <div className="grid grid-cols-2 gap-3">
                        {/* Expected Amount */}
                        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white rounded-xl p-4 shadow-lg">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-lg opacity-80">📈</span>
                                <span className="text-sm opacity-90">ยอดควรได้</span>
                            </div>
                            <div className="text-2xl font-bold">
                                {formatCurrency(overview.kpis.expected_amount_total)}
                            </div>
                        </div>

                        {/* Fuel Liters */}
                        <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-xl p-4 shadow-lg">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-lg opacity-80">⛽</span>
                                <span className="text-sm opacity-90">ลิตรขายรวม</span>
                            </div>
                            <div className="text-2xl font-bold">
                                {overview.kpis.fuel_liters_total.toLocaleString(undefined, { maximumFractionDigits: 0 })} L
                            </div>
                        </div>

                        {/* Payments Today */}
                        <div className="bg-gradient-to-br from-violet-500 to-violet-600 text-white rounded-xl p-4 shadow-lg">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-lg opacity-80">💰</span>
                                <span className="text-sm opacity-90">เงินเข้าวันนี้</span>
                            </div>
                            <div className="text-2xl font-bold">
                                {formatCurrency(overview.payments_today.total)}
                            </div>
                            <div className="text-xs opacity-75 mt-1">
                                สด {formatCurrency(overview.payments_today.cash)} | โอน {formatCurrency(overview.payments_today.transfer)}
                            </div>
                        </div>

                        {/* AR Outstanding */}
                        <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-xl p-4 shadow-lg">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-lg opacity-80">⚠️</span>
                                <span className="text-sm opacity-90">ลูกหนี้ค้าง</span>
                            </div>
                            <div className="text-2xl font-bold">
                                {formatCurrency(overview.ar.outstanding_total)}
                            </div>
                            {overview.ar.aging['31_plus'] > 0 && (
                                <div className="text-xs opacity-75 mt-1">
                                    🚨 เกิน 30 วัน: {formatCurrency(overview.ar.aging['31_plus'])}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Shift Status Row */}
                    <div className="bg-white rounded-xl shadow p-4">
                        <div className="flex justify-between items-center mb-3">
                            <span className="font-medium">สถานะกะวันนี้</span>
                            <span className="text-sm text-gray-500">
                                รวม {overview.shift_status.total} กะ
                            </span>
                        </div>
                        <div className="flex gap-2">
                            <div className="flex-1 bg-green-100 rounded-lg p-3 text-center">
                                <div className="text-2xl font-bold text-green-700">{overview.shift_status.green}</div>
                                <div className="text-xs text-green-600">🟢 เขียว</div>
                            </div>
                            <div className="flex-1 bg-yellow-100 rounded-lg p-3 text-center">
                                <div className="text-2xl font-bold text-yellow-700">{overview.shift_status.yellow}</div>
                                <div className="text-xs text-yellow-600">🟡 เหลือง</div>
                            </div>
                            <div className="flex-1 bg-red-100 rounded-lg p-3 text-center">
                                <div className="text-2xl font-bold text-red-700">{overview.shift_status.red}</div>
                                <div className="text-xs text-red-600">🔴 แดง</div>
                            </div>
                        </div>
                    </div>

                    {/* Stations List */}
                    <div>
                        <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
                            ⛽ สถานี ({overview.stations.length})
                        </h2>
                        <div className="space-y-2">
                            {overview.stations.map((station) => {
                                const hasIssue = station.shift_status.red > 0 || station.shift_status.yellow > 0;
                                const badgeColor = station.shift_status.red > 0 ? 'bg-red-500' :
                                    station.shift_status.yellow > 0 ? 'bg-yellow-500' : 'bg-green-500';

                                return (
                                    <div
                                        key={station.station_id}
                                        className={`bg-white rounded-xl shadow p-4 cursor-pointer hover:shadow-md transition-shadow ${hasIssue ? 'border-l-4 border-l-red-500' : ''}`}
                                        onClick={() => router.push(`/station/${station.station_id}?date=${date}`)}
                                    >
                                        <div className="flex justify-between items-start">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="font-bold">{station.station_name}</span>
                                                    {hasIssue && (
                                                        <span className={`w-2 h-2 rounded-full ${badgeColor} animate-pulse`}></span>
                                                    )}
                                                </div>
                                                <div className="text-sm text-gray-500 space-y-1">
                                                    <div>
                                                        💰 {formatCurrency(station.expected_amount_total)} •
                                                        ⛽ {station.fuel_liters_total.toLocaleString(undefined, { maximumFractionDigits: 0 })} L
                                                    </div>
                                                    <div className="flex items-center gap-1 text-xs">
                                                        🕐 ปิดล่าสุด: {formatThaiTime(station.last_closed_at)}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="flex gap-1 text-xs">
                                                    {station.shift_status.green > 0 && (
                                                        <span className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                                                            {station.shift_status.green}🟢
                                                        </span>
                                                    )}
                                                    {station.shift_status.yellow > 0 && (
                                                        <span className="bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">
                                                            {station.shift_status.yellow}🟡
                                                        </span>
                                                    )}
                                                    {station.shift_status.red > 0 && (
                                                        <span className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded">
                                                            {station.shift_status.red}🔴
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="text-gray-400">›</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}

                            {overview.stations.length === 0 && (
                                <div className="text-center py-8 text-gray-500">
                                    ยังไม่มีข้อมูลสถานี
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
