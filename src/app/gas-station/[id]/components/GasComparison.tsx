'use client';

import { AlertTriangle } from 'lucide-react';
import { GaugeReading } from '../hooks/useGasStation';

interface GasComparisonProps {
    gaugeReadings: GaugeReading[];
    totalLiters: number;
    formatCurrency: (num: number) => string;
}

export default function GasComparison({ gaugeReadings, totalLiters, formatCurrency }: GasComparisonProps) {
    if (gaugeReadings.length === 0) return null;

    const LITERS_PER_PERCENT = 98;

    // Calculate tank usage from gauge readings
    let tankUsage = 0;
    [1, 2, 3].forEach(tankNum => {
        const tankReadings = gaugeReadings
            .filter(g => g.tankNumber === tankNum)
            .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

        if (tankReadings.length >= 2) {
            const firstReading = tankReadings[0].percentage;
            const lastReading = tankReadings[tankReadings.length - 1].percentage;
            const usedPercent = firstReading - lastReading;
            if (usedPercent > 0) {
                tankUsage += usedPercent * LITERS_PER_PERCENT;
            }
        }
    });

    // Difference
    const difference = tankUsage - totalLiters;
    const diffPercent = totalLiters > 0 ? (difference / totalLiters * 100) : 0;
    const isNormal = Math.abs(diffPercent) <= 5; // Within 5% is normal

    return (
        <div className="rounded-3xl border border-black/10 bg-white p-6">
            <h2 className="text-xl font-black tracking-tight mb-4">
                📊 <span className="bg-blue-200 px-2 rounded">เปรียบเทียบการใช้แก๊ส</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Tank Gauge Usage */}
                <div className="rounded-2xl border border-black/10 bg-[#fafafa] p-4">
                    <div className="text-xs font-black text-purple-600">⛽ หักจากถัง</div>
                    <div className="mt-1 text-2xl font-black">{formatCurrency(Math.round(tankUsage))}</div>
                    <div className="text-sm font-semibold text-neutral-500">ลิตร (จากเกจ)</div>
                </div>

                {/* Nozzle Sales */}
                <div className="rounded-2xl border border-black/10 bg-[#fafafa] p-4">
                    <div className="text-xs font-black text-green-600">🔧 ขายจากหัวจ่าย</div>
                    <div className="mt-1 text-2xl font-black">{formatCurrency(Math.round(totalLiters))}</div>
                    <div className="text-sm font-semibold text-neutral-500">ลิตร (จากมิเตอร์)</div>
                </div>

                {/* Difference */}
                <div className={`rounded-2xl border p-4 ${isNormal
                    ? 'border-green-200 bg-green-50'
                    : 'border-red-200 bg-red-50'
                    }`}>
                    <div className={`text-xs font-black ${isNormal ? 'text-green-600' : 'text-red-600'}`}>
                        {isNormal ? '✅ ปกติ' : '⚠️ ส่วนต่าง'}
                    </div>
                    <div className={`mt-1 text-2xl font-black ${isNormal ? 'text-green-700' : 'text-red-700'}`}>
                        {difference >= 0 ? '+' : ''}{formatCurrency(Math.round(difference))}
                    </div>
                    <div className={`text-sm font-semibold ${isNormal ? 'text-green-600' : 'text-red-600'}`}>
                        ลิตร ({diffPercent >= 0 ? '+' : ''}{diffPercent.toFixed(1)}%)
                    </div>
                </div>
            </div>

            {!isNormal && Math.abs(difference) > 50 && (
                <div className="mt-4 rounded-xl bg-red-50 border border-red-200 p-3 flex items-center gap-2">
                    <AlertTriangle className="text-red-500" size={18} />
                    <p className="text-sm font-semibold text-red-700">
                        ส่วนต่างมากกว่า 5% - ควรตรวจสอบการรั่วไหลหรือความคลาดเคลื่อนของมิเตอร์
                    </p>
                </div>
            )}
        </div>
    );
}
