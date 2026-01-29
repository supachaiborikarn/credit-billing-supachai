'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { PAYMENT_TYPES } from '@/constants';

interface Transaction {
    id?: string;
    date?: string;
    licensePlate?: string;
    ownerName?: string;
    paymentType: string;
    liters: number;
    amount: number;
    nozzleNumber?: number;
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
    const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set());

    const formatNumber = (num: number) =>
        new Intl.NumberFormat('th-TH', { maximumFractionDigits: 2 }).format(num);

    const formatCurrency = (num: number) =>
        new Intl.NumberFormat('th-TH', {
            style: 'currency',
            currency: 'THB',
            maximumFractionDigits: 0,
        }).format(num);

    const formatTime = (dateStr?: string) => {
        if (!dateStr) return '';
        return new Date(dateStr).toLocaleTimeString('th-TH', {
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    // Group transactions by payment type
    const getTransactionsByType = (paymentType: string) =>
        transactions.filter(t => t.paymentType === paymentType);

    // Group by payment type with totals
    const paymentTotals = PAYMENT_TYPES.map(pt => ({
        ...pt,
        amount: transactions
            .filter(t => t.paymentType === pt.value)
            .reduce((sum, t) => sum + Number(t.amount), 0),
        liters: transactions
            .filter(t => t.paymentType === pt.value)
            .reduce((sum, t) => sum + Number(t.liters), 0),
        count: transactions.filter(t => t.paymentType === pt.value).length,
    })).filter(pt => pt.amount > 0);

    const grandTotal = transactions.reduce((sum, t) => sum + Number(t.amount), 0);
    const diffOk = Math.abs(meterDiff) <= 1;

    const paymentIcons: Record<string, string> = {
        CASH: '💵',
        CREDIT: '📝',
        TRANSFER: '📲',
        BOX_TRUCK: '📦',
        OIL_TRUCK_SUPACHAI: '🛢️',
        CREDIT_CARD: '💳',
    };

    const toggleExpand = (paymentType: string) => {
        setExpandedTypes(prev => {
            const next = new Set(prev);
            if (next.has(paymentType)) {
                next.delete(paymentType);
            } else {
                next.add(paymentType);
            }
            return next;
        });
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

            {/* Revenue Summary - Expandable */}
            {(detailed || paymentTotals.length > 0) && (
                <div className="space-y-2">
                    {paymentTotals.map(pt => {
                        const isExpanded = expandedTypes.has(pt.value);
                        const typeTransactions = getTransactionsByType(pt.value);

                        return (
                            <div key={pt.value} className="border border-gray-100 rounded-xl overflow-hidden">
                                {/* Header - Clickable */}
                                <button
                                    onClick={() => toggleExpand(pt.value)}
                                    className="w-full flex justify-between items-center py-3 px-3 hover:bg-gray-50 transition"
                                >
                                    <span className="text-gray-600 flex items-center gap-2">
                                        {paymentIcons[pt.value] || '💰'} {pt.label}
                                        <span className="text-xs text-gray-400">
                                            ({formatNumber(pt.liters)} ลิตร • {pt.count} รายการ)
                                        </span>
                                    </span>
                                    <span className="flex items-center gap-2">
                                        <span className="font-mono font-bold text-gray-800">
                                            {formatCurrency(pt.amount)}
                                        </span>
                                        {isExpanded ? (
                                            <ChevronUp size={18} className="text-gray-400" />
                                        ) : (
                                            <ChevronDown size={18} className="text-gray-400" />
                                        )}
                                    </span>
                                </button>

                                {/* Expanded Content - Transaction List */}
                                {isExpanded && typeTransactions.length > 0 && (
                                    <div className="border-t border-gray-100 bg-gray-50 px-3 py-2 max-h-60 overflow-y-auto">
                                        <div className="space-y-2">
                                            {typeTransactions.map((txn, idx) => (
                                                <div
                                                    key={txn.id || idx}
                                                    className="flex justify-between items-center py-2 px-2 bg-white rounded-lg text-sm"
                                                >
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-medium text-gray-800 truncate">
                                                                {txn.licensePlate || '-'}
                                                            </span>
                                                            {txn.nozzleNumber && (
                                                                <span className="text-xs text-gray-400">
                                                                    หัว {txn.nozzleNumber}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-2 text-xs text-gray-500">
                                                            <span>{txn.ownerName || '-'}</span>
                                                            {txn.date && (
                                                                <span>• {formatTime(txn.date)}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="text-right ml-2">
                                                        <p className="font-bold text-green-600">
                                                            {formatCurrency(txn.amount)}
                                                        </p>
                                                        <p className="text-xs text-gray-400">
                                                            {formatNumber(txn.liters)} ลิตร
                                                        </p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}

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

