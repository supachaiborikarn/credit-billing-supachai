'use client';

import { DailyStats } from '../hooks/useGasStation';

interface StatsCardProps {
    stats: DailyStats;
    formatCurrency: (num: number) => string;
}

export default function StatsCard({ stats, formatCurrency }: StatsCardProps) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Stock */}
            <div className="rounded-2xl border border-black/10 bg-gradient-to-br from-orange-50 to-orange-100 p-5">
                <div className="text-xs font-black text-orange-600">สต็อกแก๊ส</div>
                <div className="mt-2 text-3xl font-black tracking-tight">{formatCurrency(stats.currentStock)}</div>
                <div className="text-sm font-semibold text-neutral-600">ลิตร</div>
            </div>

            {/* Sales */}
            <div className="rounded-2xl border border-black/10 bg-gradient-to-br from-green-50 to-green-100 p-5">
                <div className="text-xs font-black text-green-600">ยอดขายวันนี้</div>
                <div className="mt-2 text-3xl font-black tracking-tight">฿{formatCurrency(stats.totalAmount)}</div>
                <div className="text-sm font-semibold text-neutral-600">{formatCurrency(stats.totalLiters)} ลิตร</div>
            </div>

            {/* Transactions */}
            <div className="rounded-2xl border border-black/10 bg-gradient-to-br from-blue-50 to-blue-100 p-5">
                <div className="text-xs font-black text-blue-600">จำนวนรายการ</div>
                <div className="mt-2 text-3xl font-black tracking-tight">{stats.transactionCount}</div>
                <div className="text-sm font-semibold text-neutral-600">รายการ</div>
            </div>
        </div>
    );
}
