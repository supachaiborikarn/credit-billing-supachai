'use client';

import { useEffect, useState } from 'react';
import {
    Package,
    AlertTriangle,
    CheckCircle,
    Clock,
    Loader2
} from 'lucide-react';

interface TankData {
    id: string;
    stationId: string;
    stationName: string;
    fuelType: string;
    fuelLabel: string;
    capacity: number;
    currentVolume: number;
    lastRefillDate: string;
    avgDailyUsage: number;
    estimatedDaysToEmpty: number;
    status: 'OK' | 'ORDER_SOON' | 'ORDER_NOW';
}

interface StockResponse {
    _notice: string;
    summary: {
        totalTanks: number;
        orderNow: number;
        orderSoon: number;
        ok: number;
    };
    tanks: TankData[];
}

const formatNumber = (n: number) => n.toLocaleString('th-TH');

export default function StockPage() {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<StockResponse | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await fetch('/api/v2/simple/admin/stock');
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
    }, []);

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

    const getStatusColor = (status: TankData['status']) => {
        switch (status) {
            case 'ORDER_NOW': return 'bg-red-900/50 border-red-500/30 text-red-300';
            case 'ORDER_SOON': return 'bg-yellow-900/50 border-yellow-500/30 text-yellow-300';
            default: return 'bg-green-900/50 border-green-500/30 text-green-300';
        }
    };

    const getStatusLabel = (status: TankData['status']) => {
        switch (status) {
            case 'ORDER_NOW': return '⚠️ ต้องสั่งวันนี้';
            case 'ORDER_SOON': return '🔔 สั่งภายใน 3 วัน';
            default: return '✅ OK';
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Package className="text-blue-400" />
                    Stock & Ordering
                </h1>
                <p className="text-gray-400 text-sm">สถานะสต็อกน้ำมันและการสั่งเติม</p>
            </div>

            {/* Notice */}
            <div className="bg-yellow-900/30 border border-yellow-500/30 rounded-xl p-4 text-yellow-300 text-sm">
                ⚠️ <strong>Mock Data:</strong> ข้อมูลนี้เป็นข้อมูลจำลอง - รอ implement Tank model และ API จริง
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-[#1a1a24] rounded-xl p-4 border border-white/10">
                    <div className="text-gray-400 text-sm mb-1">Total Tanks</div>
                    <div className="text-2xl font-bold">{data.summary.totalTanks}</div>
                </div>
                <div className="bg-red-900/30 rounded-xl p-4 border border-red-500/30">
                    <div className="text-red-300 text-sm mb-1 flex items-center gap-1">
                        <AlertTriangle size={14} /> ต้องสั่งวันนี้
                    </div>
                    <div className="text-2xl font-bold text-red-400">{data.summary.orderNow}</div>
                </div>
                <div className="bg-yellow-900/30 rounded-xl p-4 border border-yellow-500/30">
                    <div className="text-yellow-300 text-sm mb-1 flex items-center gap-1">
                        <Clock size={14} /> สั่งเร็วๆ นี้
                    </div>
                    <div className="text-2xl font-bold text-yellow-400">{data.summary.orderSoon}</div>
                </div>
                <div className="bg-green-900/30 rounded-xl p-4 border border-green-500/30">
                    <div className="text-green-300 text-sm mb-1 flex items-center gap-1">
                        <CheckCircle size={14} /> OK
                    </div>
                    <div className="text-2xl font-bold text-green-400">{data.summary.ok}</div>
                </div>
            </div>

            {/* Tank Table */}
            <div className="bg-[#1a1a24] rounded-xl border border-white/10 overflow-hidden">
                <div className="p-4 border-b border-white/10">
                    <h2 className="text-lg font-semibold">📊 รายละเอียดถังน้ำมัน</h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-900/50">
                            <tr className="text-sm text-gray-400">
                                <th className="text-left py-3 px-4">สถานี</th>
                                <th className="text-left py-3 px-4">เชื้อเพลิง</th>
                                <th className="text-right py-3 px-4">คงเหลือ</th>
                                <th className="text-right py-3 px-4">ความจุ</th>
                                <th className="text-right py-3 px-4">ใช้/วัน</th>
                                <th className="text-right py-3 px-4">วันที่เหลือ</th>
                                <th className="text-center py-3 px-4">สถานะ</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.tanks.map(tank => (
                                <tr key={tank.id} className="border-t border-white/5 hover:bg-white/5">
                                    <td className="py-3 px-4">{tank.stationName}</td>
                                    <td className="py-3 px-4">{tank.fuelLabel}</td>
                                    <td className="py-3 px-4 text-right">
                                        <span className={tank.currentVolume < tank.capacity * 0.2 ? 'text-red-400' : 'text-green-400'}>
                                            {formatNumber(tank.currentVolume)} L
                                        </span>
                                    </td>
                                    <td className="py-3 px-4 text-right text-gray-400">
                                        {formatNumber(tank.capacity)} L
                                    </td>
                                    <td className="py-3 px-4 text-right text-blue-400">
                                        {formatNumber(tank.avgDailyUsage)} L
                                    </td>
                                    <td className="py-3 px-4 text-right font-mono">
                                        <span className={
                                            tank.estimatedDaysToEmpty <= 2 ? 'text-red-400' :
                                                tank.estimatedDaysToEmpty <= 5 ? 'text-yellow-400' :
                                                    'text-green-400'
                                        }>
                                            {tank.estimatedDaysToEmpty} วัน
                                        </span>
                                    </td>
                                    <td className="py-3 px-4">
                                        <span className={`inline-block px-2 py-1 rounded text-xs ${getStatusColor(tank.status)}`}>
                                            {getStatusLabel(tank.status)}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Visual Representation */}
            <div className="bg-[#1a1a24] rounded-xl p-6 border border-white/10">
                <h2 className="text-lg font-semibold mb-4">🔋 ระดับน้ำมันคงเหลือ</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {data.tanks.map(tank => {
                        const fillPercent = (tank.currentVolume / tank.capacity) * 100;
                        return (
                            <div key={tank.id} className="bg-black/30 rounded-lg p-4">
                                <div className="flex justify-between text-sm mb-2">
                                    <span className="truncate">{tank.stationName}</span>
                                    <span className="text-gray-400">{tank.fuelLabel}</span>
                                </div>
                                <div className="h-4 bg-gray-800 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all ${fillPercent < 20 ? 'bg-red-500' :
                                                fillPercent < 40 ? 'bg-yellow-500' :
                                                    'bg-green-500'
                                            }`}
                                        style={{ width: `${fillPercent}%` }}
                                    />
                                </div>
                                <div className="flex justify-between text-xs text-gray-400 mt-1">
                                    <span>{fillPercent.toFixed(0)}%</span>
                                    <span>~{tank.estimatedDaysToEmpty} วัน</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
