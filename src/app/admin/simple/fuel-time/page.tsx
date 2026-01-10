'use client';

import { useEffect, useState } from 'react';
import {
    Clock,
    Fuel,
    Loader2,
    BarChart3
} from 'lucide-react';
import { FUEL_TYPES } from '@/constants';

interface FuelTimeData {
    period: { days: number };
    byFuelType: { fuelType: string; liters: number; revenue: number; count: number }[];
    hourlyData: { hour: number; liters: number; revenue: number; count: number }[];
    peakHour: { hour: number; count: number };
    dailyByFuel: { date: string; fuels: { [key: string]: number } }[];
}

const formatCurrency = (n: number) => n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatNumber = (n: number) => n.toLocaleString('th-TH');

const getFuelColor = (fuelType: string) => {
    const fuel = FUEL_TYPES.find(f => f.value === fuelType || f.label === fuelType);
    const colors: { [key: string]: string } = {
        'DIESEL': 'bg-amber-500',
        'GASOHOL_95': 'bg-green-500',
        'GASOHOL_91': 'bg-blue-500',
        'GASOHOL_E20': 'bg-teal-500',
        'BENZIN_95': 'bg-red-500',
        'ดีเซล': 'bg-amber-500',
        'default': 'bg-gray-500'
    };
    return colors[fuelType] || fuel?.color || colors.default;
};

export default function FuelTimePage() {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<FuelTimeData | null>(null);
    const [days, setDays] = useState(7);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const res = await fetch(`/api/v2/simple/admin/fuel-time?days=${days}`);
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
    }, [days]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="animate-spin text-blue-400" size={40} />
            </div>
        );
    }

    if (!data) {
        return <div className="text-center py-12 text-gray-400">ไม่สามารถโหลดข้อมูลได้</div>;
    }

    const maxFuel = Math.max(...data.byFuelType.map(f => f.liters), 1);
    const maxHourly = Math.max(...data.hourlyData.map(h => h.count), 1);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <BarChart3 className="text-blue-400" />
                        Fuel & Time Analytics
                    </h1>
                    <p className="text-gray-400 text-sm">วิเคราะห์ประเภทเชื้อเพลิงและช่วงเวลา</p>
                </div>

                <div className="flex gap-2">
                    {[7, 30, 90].map(d => (
                        <button
                            key={d}
                            onClick={() => setDays(d)}
                            className={`px-4 py-2 rounded-lg text-sm transition-colors ${days === d
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                                }`}
                        >
                            {d} วัน
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* By Fuel Type */}
                <div className="bg-[#1a1a24] rounded-xl p-6 border border-white/10">
                    <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <Fuel className="text-amber-400" size={20} />
                        ยอดขายตามประเภทเชื้อเพลิง
                    </h2>
                    <div className="space-y-3">
                        {data.byFuelType.sort((a, b) => b.liters - a.liters).map(f => (
                            <div key={f.fuelType}>
                                <div className="flex justify-between text-sm mb-1">
                                    <span>{f.fuelType}</span>
                                    <span className="text-green-400">{formatNumber(f.liters)} L</span>
                                </div>
                                <div className="h-6 bg-gray-800 rounded overflow-hidden">
                                    <div
                                        className={`h-full ${getFuelColor(f.fuelType)} rounded`}
                                        style={{ width: `${(f.liters / maxFuel) * 100}%` }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Peak Hour */}
                <div className="bg-[#1a1a24] rounded-xl p-6 border border-white/10">
                    <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <Clock className="text-purple-400" size={20} />
                        ช่วงเวลาขายดี (Peak Hour)
                    </h2>

                    <div className="bg-gradient-to-br from-purple-900/50 to-pink-900/50 rounded-xl p-4 mb-4 border border-purple-500/20">
                        <div className="text-sm text-gray-400">Peak Hour</div>
                        <div className="text-3xl font-bold text-purple-400">
                            {data.peakHour.hour}:00 - {data.peakHour.hour + 1}:00
                        </div>
                        <div className="text-sm text-gray-400">{data.peakHour.count} รายการ</div>
                    </div>

                    <div className="text-sm text-gray-400 mb-2">จำนวนรายการตามชั่วโมง</div>
                    <div className="flex items-end gap-1 h-24">
                        {data.hourlyData.map(h => (
                            <div
                                key={h.hour}
                                className="flex-1 flex flex-col items-center group relative"
                            >
                                <div
                                    className={`w-full rounded-t transition-colors ${h.hour === data.peakHour.hour
                                            ? 'bg-gradient-to-t from-purple-500 to-pink-400'
                                            : 'bg-gray-600 hover:bg-gray-500'
                                        }`}
                                    style={{ height: `${(h.count / maxHourly) * 100}%`, minHeight: '2px' }}
                                />
                                {/* Hour label every 4 hours */}
                                {h.hour % 4 === 0 && (
                                    <span className="text-xs text-gray-500 mt-1">{h.hour}</span>
                                )}
                                {/* Tooltip */}
                                <div className="absolute bottom-full mb-2 hidden group-hover:block bg-black/90 text-white text-xs p-2 rounded shadow-lg whitespace-nowrap z-10">
                                    <div>{h.hour}:00 - {h.hour + 1}:00</div>
                                    <div>{h.count} รายการ</div>
                                    <div>{formatNumber(h.liters)} L</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Fuel Type Legend */}
            <div className="bg-[#1a1a24] rounded-xl p-6 border border-white/10">
                <h2 className="text-lg font-semibold mb-4">📊 สัดส่วนเชื้อเพลิง</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {data.byFuelType.sort((a, b) => b.revenue - a.revenue).map(f => (
                        <div key={f.fuelType} className="bg-black/20 rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-2">
                                <div className={`w-3 h-3 rounded-full ${getFuelColor(f.fuelType)}`} />
                                <span className="text-sm">{f.fuelType}</span>
                            </div>
                            <div className="text-blue-400 font-mono">฿{formatCurrency(f.revenue)}</div>
                            <div className="text-xs text-gray-400">{f.count} รายการ</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
