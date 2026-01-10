'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
    TrendingUp,
    Banknote,
    CreditCard,
    Smartphone,
    FuelIcon,
    Gauge,
    Calculator,
    Clock,
    RefreshCw
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

interface MeterData {
    nozzle: number;
    startReading: number | null;
    endReading: number | null;
    liters: number;
    amount: number;
}

interface GaugeData {
    tank1: number | null;
    tank2: number | null;
    tank3: number | null;
    average: number;
}

interface TransactionData {
    id: string;
    type: string;
    paymentType: string;
    amount: number;
    liters: number;
    ownerName?: string;
    truckPlate?: string;
    createdAt: string;
}

export default function GasSummaryPage() {
    const params = useParams();
    const stationId = params.stationId as string;

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [currentShift, setCurrentShift] = useState<ShiftData | null>(null);
    const [sales, setSales] = useState<SalesData>({
        cash: 0, credit: 0, card: 0, transfer: 0,
        total: 0, transactionCount: 0, liters: 0
    });
    const [meters, setMeters] = useState<MeterData[]>([]);
    const [gauge, setGauge] = useState<GaugeData>({
        tank1: null, tank2: null, tank3: null, average: 0
    });
    const [transactions, setTransactions] = useState<TransactionData[]>([]);

    const fetchData = async () => {
        try {
            const res = await fetch(`/api/v2/gas/${stationId}/summary`);
            if (res.ok) {
                const data = await res.json();
                setCurrentShift(data.shift);
                setSales(data.sales || sales);
                setMeters(data.meters || []);
                setGauge(data.gauge || gauge);
                setTransactions(data.transactions || []);
            }
        } catch (error) {
            console.error('Error fetching summary data:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [stationId]);

    const handleRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    const getPaymentBadge = (type: string) => {
        const badges: Record<string, { bg: string; text: string; label: string }> = {
            cash: { bg: 'bg-green-500/20', text: 'text-green-400', label: 'เงินสด' },
            credit: { bg: 'bg-purple-500/20', text: 'text-purple-400', label: 'เชื่อ' },
            card: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'บัตร' },
            transfer: { bg: 'bg-cyan-500/20', text: 'text-cyan-400', label: 'โอน' },
        };
        return badges[type] || badges.cash;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-500 border-t-transparent"></div>
            </div>
        );
    }

    if (!currentShift || currentShift.status !== 'OPEN') {
        return (
            <div className="max-w-lg mx-auto">
                <div className="bg-gray-800/50 rounded-2xl p-8 text-center border border-white/10">
                    <Clock className="mx-auto text-gray-500 mb-4" size={48} />
                    <h2 className="text-xl font-bold mb-2">ไม่มีกะที่เปิดอยู่</h2>
                    <p className="text-gray-400">กรุณาเปิดกะเพื่อดูสรุปข้อมูล</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6 pb-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">สรุปกะที่ {currentShift.shiftNumber}</h1>
                    <p className="text-gray-400 text-sm">
                        เปิดเมื่อ {currentShift.openedAt ? new Date(currentShift.openedAt).toLocaleString('th-TH') : '-'}
                    </p>
                </div>
                <button
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-colors disabled:opacity-50"
                >
                    <RefreshCw size={20} className={refreshing ? 'animate-spin' : ''} />
                </button>
            </div>

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

            {/* Meters Summary */}
            {meters.length > 0 && (
                <div className="bg-[#1a1a24] rounded-2xl p-6 border border-white/10">
                    <h3 className="text-lg font-medium flex items-center gap-2 mb-4">
                        <Calculator className="text-blue-400" size={20} />
                        มิเตอร์หัวจ่าย
                    </h3>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="text-gray-400 text-sm border-b border-white/10">
                                    <th className="text-left py-2">หัวจ่าย</th>
                                    <th className="text-right py-2">เริ่มต้น</th>
                                    <th className="text-right py-2">สิ้นสุด</th>
                                    <th className="text-right py-2">ลิตร</th>
                                    <th className="text-right py-2">มูลค่า</th>
                                </tr>
                            </thead>
                            <tbody>
                                {meters.map((meter) => (
                                    <tr key={meter.nozzle} className="border-b border-white/5">
                                        <td className="py-3 font-medium">หัว {meter.nozzle}</td>
                                        <td className="py-3 text-right text-gray-400">
                                            {meter.startReading?.toLocaleString() || '-'}
                                        </td>
                                        <td className="py-3 text-right text-gray-400">
                                            {meter.endReading?.toLocaleString() || '-'}
                                        </td>
                                        <td className="py-3 text-right text-orange-400 font-medium">
                                            {meter.liters.toFixed(2)}
                                        </td>
                                        <td className="py-3 text-right text-green-400 font-medium">
                                            ฿{formatCurrency(meter.amount)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Gauge Status */}
            <div className="bg-[#1a1a24] rounded-2xl p-6 border border-white/10">
                <h3 className="text-lg font-medium flex items-center gap-2 mb-4">
                    <Gauge className="text-orange-400" size={20} />
                    ระดับถังแก๊ส
                </h3>

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

            {/* Recent Transactions */}
            {transactions.length > 0 && (
                <div className="bg-[#1a1a24] rounded-2xl p-6 border border-white/10">
                    <h3 className="text-lg font-medium flex items-center gap-2 mb-4">
                        <FuelIcon className="text-purple-400" size={20} />
                        รายการขายล่าสุด
                    </h3>
                    <div className="space-y-3">
                        {transactions.slice(0, 10).map((tx) => {
                            const badge = getPaymentBadge(tx.paymentType);
                            return (
                                <div key={tx.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                                    <div className="flex items-center gap-3">
                                        <span className={`px-2 py-0.5 rounded text-xs ${badge.bg} ${badge.text}`}>
                                            {badge.label}
                                        </span>
                                        <div>
                                            {tx.paymentType === 'credit' && tx.ownerName && (
                                                <div className="text-sm font-medium">{tx.ownerName}</div>
                                            )}
                                            {tx.truckPlate && (
                                                <div className="text-xs text-gray-500">{tx.truckPlate}</div>
                                            )}
                                            <div className="text-xs text-gray-500">
                                                {new Date(tx.createdAt).toLocaleTimeString('th-TH', {
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-bold text-green-400">฿{formatCurrency(tx.amount)}</div>
                                        <div className="text-xs text-gray-500">{tx.liters.toFixed(2)} ลิตร</div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
