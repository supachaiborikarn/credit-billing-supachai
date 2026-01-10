'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    FuelIcon,
    Gauge,
    Calculator,
    Clock,
    TrendingUp,
    CreditCard,
    Banknote,
    Smartphone,
    AlertTriangle,
    Play,
    ArrowRight
} from 'lucide-react';
import { formatCurrency, getGaugeColorClass } from '@/lib/gas';

interface ShiftData {
    id: string;
    shiftNumber: number;
    status: string;
    staffName: string | null;
    openedAt: string | null;
}

interface SalesData {
    cash: number;
    credit: number;
    card: number;
    transfer: number;
    total: number;
    transactionCount: number;
    liters: number;
}

interface GaugeData {
    tank1: number | null;
    tank2: number | null;
    tank3: number | null;
    average: number;
}

export default function GasStationHomePage() {
    const params = useParams();
    const router = useRouter();
    const stationId = params.stationId as string;

    const [loading, setLoading] = useState(true);
    const [currentShift, setCurrentShift] = useState<ShiftData | null>(null);
    const [sales, setSales] = useState<SalesData>({
        cash: 0, credit: 0, card: 0, transfer: 0,
        total: 0, transactionCount: 0, liters: 0
    });
    const [gauge, setGauge] = useState<GaugeData>({
        tank1: null, tank2: null, tank3: null, average: 0
    });
    const [alerts, setAlerts] = useState<string[]>([]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch current shift and summary
                const res = await fetch(`/api/v2/gas/${stationId}/summary`);
                if (res.ok) {
                    const data = await res.json();
                    setCurrentShift(data.shift);
                    setSales(data.sales || sales);
                    setGauge(data.gauge || gauge);
                    setAlerts(data.alerts || []);
                }
            } catch (error) {
                console.error('Error fetching dashboard data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
        // Refresh every 30 seconds
        const interval = setInterval(fetchData, 30000);
        return () => clearInterval(interval);
    }, [stationId]);

    // No shift open - show open shift button
    if (!loading && (!currentShift || currentShift.status !== 'OPEN')) {
        return (
            <div className="max-w-lg mx-auto">
                <div className="bg-gradient-to-br from-orange-900/50 to-red-900/50 rounded-2xl p-8 border border-orange-500/30 text-center">
                    <div className="w-20 h-20 mx-auto mb-6 bg-orange-500/20 rounded-full flex items-center justify-center">
                        <Play className="text-orange-400" size={40} />
                    </div>
                    <h2 className="text-2xl font-bold mb-2">ไม่มีกะที่เปิดอยู่</h2>
                    <p className="text-gray-400 mb-6">กรุณาเปิดกะเพื่อเริ่มบันทึกข้อมูล</p>

                    <Link
                        href={`/gas/${stationId}/shift/open`}
                        className="inline-flex items-center gap-2 bg-gradient-to-r from-orange-500 to-red-500 text-white px-8 py-4 rounded-xl font-bold text-lg hover:from-orange-600 hover:to-red-600 transition-all shadow-lg"
                    >
                        <Play size={24} />
                        เปิดกะใหม่
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Alerts */}
            {alerts.length > 0 && (
                <div className="bg-red-900/30 border border-red-500/30 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-red-400 mb-2">
                        <AlertTriangle size={20} />
                        <span className="font-medium">แจ้งเตือน</span>
                    </div>
                    <ul className="space-y-1 text-sm text-red-300">
                        {alerts.map((alert, i) => (
                            <li key={i}>• {alert}</li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Sales Summary */}
            <div className="bg-[#1a1a24] rounded-2xl p-6 border border-white/10">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium flex items-center gap-2">
                        <TrendingUp className="text-green-400" size={20} />
                        ยอดขายสะสม
                    </h3>
                    <span className="text-gray-400 text-sm">
                        {sales.transactionCount} รายการ | {sales.liters.toFixed(0)} ลิตร
                    </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {/* Cash */}
                    <div className="bg-gradient-to-br from-green-900/30 to-green-800/20 rounded-xl p-4 border border-green-500/20">
                        <div className="flex items-center gap-2 text-green-400 text-sm mb-1">
                            <Banknote size={16} />
                            เงินสด
                        </div>
                        <div className="text-xl font-bold text-green-400">
                            ฿{formatCurrency(sales.cash)}
                        </div>
                    </div>

                    {/* Credit */}
                    <div className="bg-gradient-to-br from-purple-900/30 to-purple-800/20 rounded-xl p-4 border border-purple-500/20">
                        <div className="flex items-center gap-2 text-purple-400 text-sm mb-1">
                            <FuelIcon size={16} />
                            เงินเชื่อ
                        </div>
                        <div className="text-xl font-bold text-purple-400">
                            ฿{formatCurrency(sales.credit)}
                        </div>
                    </div>

                    {/* Card */}
                    <div className="bg-gradient-to-br from-blue-900/30 to-blue-800/20 rounded-xl p-4 border border-blue-500/20">
                        <div className="flex items-center gap-2 text-blue-400 text-sm mb-1">
                            <CreditCard size={16} />
                            บัตร
                        </div>
                        <div className="text-xl font-bold text-blue-400">
                            ฿{formatCurrency(sales.card)}
                        </div>
                    </div>

                    {/* Transfer */}
                    <div className="bg-gradient-to-br from-cyan-900/30 to-cyan-800/20 rounded-xl p-4 border border-cyan-500/20">
                        <div className="flex items-center gap-2 text-cyan-400 text-sm mb-1">
                            <Smartphone size={16} />
                            โอน
                        </div>
                        <div className="text-xl font-bold text-cyan-400">
                            ฿{formatCurrency(sales.transfer)}
                        </div>
                    </div>
                </div>

                {/* Total */}
                <div className="mt-4 pt-4 border-t border-white/10 flex justify-between items-center">
                    <span className="text-gray-400">รวมทั้งหมด</span>
                    <span className="text-2xl font-bold text-white">
                        ฿{formatCurrency(sales.total)}
                    </span>
                </div>
            </div>

            {/* Gauge Status */}
            <div className="bg-[#1a1a24] rounded-2xl p-6 border border-white/10">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium flex items-center gap-2">
                        <Gauge className="text-orange-400" size={20} />
                        ระดับถังแก๊ส
                    </h3>
                    <Link
                        href={`/gas/${stationId}/gauge`}
                        className="text-orange-400 text-sm hover:underline flex items-center gap-1"
                    >
                        อัพเดท <ArrowRight size={14} />
                    </Link>
                </div>

                <div className="grid grid-cols-3 gap-4">
                    {[1, 2, 3].map((tank) => {
                        const pct = tank === 1 ? gauge.tank1 : tank === 2 ? gauge.tank2 : gauge.tank3;
                        const hasData = pct !== null;

                        return (
                            <div key={tank} className="text-center">
                                <div className="relative w-16 h-24 mx-auto mb-2 bg-gray-800 rounded-lg overflow-hidden border border-white/10">
                                    {hasData && (
                                        <div
                                            className={`absolute bottom-0 left-0 right-0 transition-all ${pct >= 70 ? 'bg-green-500' :
                                                    pct >= 40 ? 'bg-yellow-500' :
                                                        pct >= 20 ? 'bg-orange-500' : 'bg-red-500'
                                                }`}
                                            style={{ height: `${pct}%` }}
                                        />
                                    )}
                                    {!hasData && (
                                        <div className="absolute inset-0 flex items-center justify-center text-gray-600 text-xs">
                                            ?
                                        </div>
                                    )}
                                </div>
                                <div className="text-sm font-medium">ถัง {tank}</div>
                                <div className={`text-lg font-bold ${hasData ? getGaugeColorClass(pct!) : 'text-gray-600'}`}>
                                    {hasData ? `${pct}%` : '-'}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-4">
                <Link
                    href={`/gas/${stationId}/sell`}
                    className="bg-gradient-to-br from-green-600 to-green-700 rounded-2xl p-6 text-center hover:from-green-500 hover:to-green-600 transition-all shadow-lg"
                >
                    <FuelIcon size={40} className="mx-auto mb-3" />
                    <div className="font-bold text-lg">บันทึกขาย</div>
                    <div className="text-sm text-white/70">เงินสด / เชื่อ / บัตร / โอน</div>
                </Link>

                <Link
                    href={`/gas/${stationId}/meters`}
                    className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-6 text-center hover:from-blue-500 hover:to-blue-600 transition-all shadow-lg"
                >
                    <Calculator size={40} className="mx-auto mb-3" />
                    <div className="font-bold text-lg">มิเตอร์</div>
                    <div className="text-sm text-white/70">บันทึกตัวเลข 4 หัวจ่าย</div>
                </Link>

                <Link
                    href={`/gas/${stationId}/gauge`}
                    className="bg-gradient-to-br from-orange-600 to-orange-700 rounded-2xl p-6 text-center hover:from-orange-500 hover:to-orange-600 transition-all shadow-lg"
                >
                    <Gauge size={40} className="mx-auto mb-3" />
                    <div className="font-bold text-lg">เช็คเกจ</div>
                    <div className="text-sm text-white/70">บันทึกระดับ 3 ถัง</div>
                </Link>

                <Link
                    href={`/gas/${stationId}/shift/close`}
                    className="bg-gradient-to-br from-red-600 to-red-700 rounded-2xl p-6 text-center hover:from-red-500 hover:to-red-600 transition-all shadow-lg"
                >
                    <Clock size={40} className="mx-auto mb-3" />
                    <div className="font-bold text-lg">ปิดกะ</div>
                    <div className="text-sm text-white/70">สรุปและกระทบยอด</div>
                </Link>
            </div>
        </div>
    );
}
