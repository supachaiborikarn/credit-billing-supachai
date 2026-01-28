'use client';

import { useState, useEffect } from 'react';
import { Calendar, AlertTriangle, CheckCircle, ChevronRight, TrendingUp, TrendingDown } from 'lucide-react';

interface DailyHistoryItem {
    date: string;
    status: 'not_started' | 'recording' | 'closed';
    meterTotal: number;
    transactionTotal: number;
    difference: number;
    transactionCount: number;
    totalAmount: number;
    hasAnomaly: boolean;
    hasPostCloseEdit: boolean;
}

interface HistoryViewProps {
    stationId: string;
    onSelectDate: (date: string) => void;
}

export default function HistoryView({ stationId, onSelectDate }: HistoryViewProps) {
    const [loading, setLoading] = useState(true);
    const [history, setHistory] = useState<DailyHistoryItem[]>([]);
    const [selectedMonth, setSelectedMonth] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });

    useEffect(() => {
        fetchHistory();
    }, [selectedMonth, stationId]);

    const fetchHistory = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/station/${stationId}/history?month=${selectedMonth}`);
            if (res.ok) {
                const data = await res.json();
                setHistory(data.history || []);
            }
        } catch (error) {
            console.error('Error fetching history:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('th-TH', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
        });
    };

    const formatCurrency = (num: number) =>
        new Intl.NumberFormat('th-TH', {
            style: 'currency',
            currency: 'THB',
            maximumFractionDigits: 0,
        }).format(num);

    const formatNumber = (num: number) =>
        new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 }).format(num);

    const getStatusConfig = (item: DailyHistoryItem) => {
        if (item.status === 'closed') {
            return { color: 'bg-blue-100 text-blue-700', icon: CheckCircle, label: 'ปิดแล้ว' };
        }
        if (item.status === 'recording') {
            return { color: 'bg-green-100 text-green-700', icon: TrendingUp, label: 'กำลังบันทึก' };
        }
        return { color: 'bg-gray-100 text-gray-500', icon: Calendar, label: 'ยังไม่เริ่ม' };
    };

    // Generate month options (last 6 months)
    const getMonthOptions = () => {
        const options = [];
        const now = new Date();
        for (let i = 0; i < 6; i++) {
            const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            const label = date.toLocaleDateString('th-TH', { year: 'numeric', month: 'long' });
            options.push({ value, label });
        }
        return options;
    };

    // Calculate monthly summary
    const monthlySummary = history.reduce(
        (acc, item) => ({
            totalLiters: acc.totalLiters + item.transactionTotal,
            totalAmount: acc.totalAmount + item.totalAmount,
            anomalyCount: acc.anomalyCount + (item.hasAnomaly ? 1 : 0),
            closedDays: acc.closedDays + (item.status === 'closed' ? 1 : 0),
        }),
        { totalLiters: 0, totalAmount: 0, anomalyCount: 0, closedDays: 0 }
    );

    return (
        <div className="space-y-4">
            {/* Month Selector */}
            <div className="bg-white rounded-2xl p-4 shadow-sm">
                <div className="flex items-center justify-between">
                    <h2 className="font-bold text-gray-800">📅 ประวัติรายวัน</h2>
                    <select
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        {getMonthOptions().map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Monthly Summary */}
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-4 text-white">
                <h3 className="text-blue-100 text-sm mb-3">สรุปเดือนนี้</h3>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <p className="text-2xl font-bold">{formatNumber(monthlySummary.totalLiters)}</p>
                        <p className="text-blue-100 text-sm">ลิตร</p>
                    </div>
                    <div>
                        <p className="text-2xl font-bold">{formatCurrency(monthlySummary.totalAmount)}</p>
                        <p className="text-blue-100 text-sm">ยอดขาย</p>
                    </div>
                </div>
                <div className="flex gap-4 mt-4 pt-4 border-t border-blue-400/30">
                    <div className="flex items-center gap-2">
                        <CheckCircle size={16} />
                        <span className="text-sm">{monthlySummary.closedDays} วันปิดแล้ว</span>
                    </div>
                    {monthlySummary.anomalyCount > 0 && (
                        <div className="flex items-center gap-2 text-yellow-300">
                            <AlertTriangle size={16} />
                            <span className="text-sm">{monthlySummary.anomalyCount} วันมีปัญหา</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Loading State */}
            {loading && (
                <div className="flex items-center justify-center h-32">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
                </div>
            )}

            {/* History List */}
            {!loading && (
                <div className="space-y-2">
                    {history.length === 0 ? (
                        <div className="bg-white rounded-xl p-8 text-center text-gray-400">
                            ไม่มีข้อมูลในเดือนนี้
                        </div>
                    ) : (
                        history.map(item => {
                            const statusConfig = getStatusConfig(item);
                            const StatusIcon = statusConfig.icon;
                            const hasDifference = Math.abs(item.difference) > 1;

                            return (
                                <button
                                    key={item.date}
                                    onClick={() => onSelectDate(item.date)}
                                    className="w-full bg-white rounded-xl p-4 shadow-sm text-left hover:bg-gray-50 transition"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-xl ${statusConfig.color}`}>
                                                <StatusIcon size={18} />
                                            </div>
                                            <div>
                                                <p className="font-medium text-gray-800">
                                                    {formatDate(item.date)}
                                                </p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-sm text-gray-500">
                                                        {formatNumber(item.transactionTotal)} ลิตร
                                                    </span>
                                                    <span className="text-xs text-gray-300">•</span>
                                                    <span className="text-sm text-gray-500">
                                                        {item.transactionCount} รายการ
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3">
                                            <div className="text-right">
                                                <p className="font-bold text-green-600">
                                                    {formatCurrency(item.totalAmount)}
                                                </p>
                                                {hasDifference && (
                                                    <span className={`text-xs ${item.difference > 0 ? 'text-green-600' : 'text-red-500'}`}>
                                                        {item.difference > 0 ? '+' : ''}{formatNumber(item.difference)} ผลต่าง
                                                    </span>
                                                )}
                                            </div>

                                            {/* Anomaly Indicators */}
                                            <div className="flex flex-col items-center gap-1">
                                                {item.hasAnomaly && (
                                                    <span className="text-yellow-500" title="มีความผิดปกติ">
                                                        <AlertTriangle size={16} />
                                                    </span>
                                                )}
                                                {item.hasPostCloseEdit && (
                                                    <span className="text-xs bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded">
                                                        แก้ไขหลังปิด
                                                    </span>
                                                )}
                                            </div>

                                            <ChevronRight size={18} className="text-gray-300" />
                                        </div>
                                    </div>
                                </button>
                            );
                        })
                    )}
                </div>
            )}
        </div>
    );
}
