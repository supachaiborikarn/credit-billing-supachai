'use client';

import { PAYMENT_TYPES } from '@/constants';

interface Transaction {
    paymentType: string;
    liters: number;
    amount: number;
}

interface DailySummaryProps {
    meterTotal: number;
    transactionTotal: number;
    meterDiff: number;
    transactions: Transaction[];
    detailed?: boolean;
}

export default function DailySummary({
    meterTotal,
    transactionTotal,
    meterDiff,
    transactions,
    detailed = false,
}: DailySummaryProps) {
    const formatNumber = (num: number) =>
        new Intl.NumberFormat('th-TH', { maximumFractionDigits: 2 }).format(num);

    const formatCurrency = (num: number) =>
        new Intl.NumberFormat('th-TH', {
            style: 'currency',
            currency: 'THB',
            maximumFractionDigits: 0,
        }).format(num);

    // Group by payment type
    const paymentTotals = PAYMENT_TYPES.map(pt => ({
        ...pt,
        amount: transactions
            .filter(t => t.paymentType === pt.value)
            .reduce((sum, t) => sum + Number(t.amount), 0),
        liters: transactions
            .filter(t => t.paymentType === pt.value)
            .reduce((sum, t) => sum + Number(t.liters), 0),
    })).filter(pt => pt.amount > 0);

    const grandTotal = transactions.reduce((sum, t) => sum + Number(t.amount), 0);
    const diffOk = Math.abs(meterDiff) <= 1; // Allow 1 liter tolerance

    const paymentIcons: Record<string, string> = {
        CASH: '💵',
        CREDIT: '📝',
        TRANSFER: '📲',
        BOX_TRUCK: '📦',
        OIL_TRUCK_SUPACHAI: '🛢️',
        CREDIT_CARD: '💳',
    };

    return (
        <div className="bg-white rounded-2xl shadow-sm p-4">
            <h2 className="font-bold text-gray-800 mb-4">📊 สรุปประจำวัน</h2>

            {/* Main Stats */}
            <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-blue-50 p-3 rounded-xl text-center">
                    <p className="text-lg font-bold text-blue-700">{formatNumber(meterTotal)}</p>
                    <p className="text-xs text-blue-600">ลิตร (มิเตอร์)</p>
                </div>
                <div className="bg-green-50 p-3 rounded-xl text-center">
                    <p className="text-lg font-bold text-green-700">{formatNumber(transactionTotal)}</p>
                    <p className="text-xs text-green-600">ลิตร (ขาย)</p>
                </div>
                <div className={`p-3 rounded-xl text-center ${diffOk ? 'bg-green-50' : 'bg-red-50'}`}>
                    <p className={`text-lg font-bold ${diffOk ? 'text-green-700' : 'text-red-600'}`}>
                        {meterDiff > 0 ? '+' : ''}{formatNumber(meterDiff)}
                    </p>
                    <p className={`text-xs ${diffOk ? 'text-green-600' : 'text-red-500'}`}>
                        ผลต่าง {diffOk ? '✅' : '⚠️'}
                    </p>
                </div>
            </div>

            {/* Revenue Summary */}
            {(detailed || paymentTotals.length > 0) && (
                <div className="space-y-2">
                    {paymentTotals.map(pt => (
                        <div key={pt.value} className="flex justify-between items-center py-2 border-b border-gray-100">
                            <span className="text-gray-600">
                                {paymentIcons[pt.value] || '💰'} {pt.label}
                                {detailed && (
                                    <span className="text-xs text-gray-400 ml-1">
                                        ({formatNumber(pt.liters)} ลิตร)
                                    </span>
                                )}
                            </span>
                            <span className="font-mono font-bold" style={{ color: pt.color.replace('bg-', '') === 'green-600' ? '#16a34a' : pt.color.replace('bg-', '') === 'purple-600' ? '#9333ea' : pt.color.replace('bg-', '') === 'blue-600' ? '#2563eb' : '#374151' }}>
                                {formatCurrency(pt.amount)}
                            </span>
                        </div>
                    ))}

                    {/* Grand Total */}
                    <div className="flex justify-between items-center py-3 mt-2 bg-gray-50 px-3 rounded-xl">
                        <span className="font-bold text-gray-800">รวมทั้งหมด</span>
                        <span className="text-xl font-bold text-gray-800">{formatCurrency(grandTotal)}</span>
                    </div>
                </div>
            )}

            {transactions.length === 0 && (
                <p className="text-center text-gray-400 py-4">ยังไม่มีรายการ</p>
            )}
        </div>
    );
}
