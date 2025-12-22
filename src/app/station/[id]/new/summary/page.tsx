'use client';

import { useState, useEffect, use } from 'react';
import { ArrowLeft, Printer, DollarSign, Fuel, FileText, Banknote, CreditCard, Wallet } from 'lucide-react';
import { STATIONS } from '@/constants';
import Link from 'next/link';

interface Transaction {
    id: string;
    date: string;
    licensePlate: string;
    ownerName: string;
    paymentType: string;
    liters: number;
    amount: number;
}

interface SummaryStats {
    totalAmount: number;
    totalLiters: number;
    transactionCount: number;
    byPaymentType: {
        CASH: { amount: number; count: number };
        CREDIT: { amount: number; count: number };
        TRANSFER: { amount: number; count: number };
        BOX_TRUCK: { amount: number; count: number };
    };
}

export default function StationSummaryPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const stationIndex = parseInt(id) - 1;
    const station = STATIONS[stationIndex];

    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [loading, setLoading] = useState(true);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [stats, setStats] = useState<SummaryStats>({
        totalAmount: 0,
        totalLiters: 0,
        transactionCount: 0,
        byPaymentType: {
            CASH: { amount: 0, count: 0 },
            CREDIT: { amount: 0, count: 0 },
            TRANSFER: { amount: 0, count: 0 },
            BOX_TRUCK: { amount: 0, count: 0 },
        },
    });

    // Cash and expenses
    const [cashReceived, setCashReceived] = useState('');
    const [expenses, setExpenses] = useState('');
    const [expenseNote, setExpenseNote] = useState('');

    useEffect(() => {
        fetchData();
    }, [selectedDate]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/station/${id}/transactions?date=${selectedDate}`);
            if (res.ok) {
                const txns = await res.json();
                setTransactions(txns);

                // Calculate stats
                const byPaymentType = {
                    CASH: { amount: 0, count: 0 },
                    CREDIT: { amount: 0, count: 0 },
                    TRANSFER: { amount: 0, count: 0 },
                    BOX_TRUCK: { amount: 0, count: 0 },
                };

                txns.forEach((t: Transaction) => {
                    if (t.paymentType in byPaymentType) {
                        byPaymentType[t.paymentType as keyof typeof byPaymentType].amount += t.amount;
                        byPaymentType[t.paymentType as keyof typeof byPaymentType].count += 1;
                    }
                });

                setStats({
                    totalAmount: txns.reduce((sum: number, t: Transaction) => sum + t.amount, 0),
                    totalLiters: txns.reduce((sum: number, t: Transaction) => sum + (t.liters || 0), 0),
                    transactionCount: txns.length,
                    byPaymentType,
                });
            }
        } catch (error) {
            console.error('Error fetching:', error);
        } finally {
            setLoading(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    const formatCurrency = (num: number) =>
        new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2 }).format(num);

    const formatNumber = (num: number) =>
        new Intl.NumberFormat('th-TH', { minimumFractionDigits: 0 }).format(num);

    const getPaymentLabel = (type: string) => {
        switch (type) {
            case 'CASH': return 'เงินสด';
            case 'CREDIT': return 'เงินเชื่อ';
            case 'TRANSFER': return 'โอนเงิน';
            case 'BOX_TRUCK': return 'รถบรรทุก';
            default: return type;
        }
    };

    const getPaymentIcon = (type: string) => {
        switch (type) {
            case 'CASH': return <Banknote className="text-green-500" size={20} />;
            case 'CREDIT': return <FileText className="text-purple-500" size={20} />;
            case 'TRANSFER': return <CreditCard className="text-blue-500" size={20} />;
            case 'BOX_TRUCK': return <Wallet className="text-orange-500" size={20} />;
            default: return <Wallet className="text-gray-500" size={20} />;
        }
    };

    const getPaymentColor = (type: string) => {
        switch (type) {
            case 'CASH': return 'bg-green-50 text-green-700';
            case 'CREDIT': return 'bg-purple-50 text-purple-700';
            case 'TRANSFER': return 'bg-blue-50 text-blue-700';
            case 'BOX_TRUCK': return 'bg-orange-50 text-orange-700';
            default: return 'bg-gray-50 text-gray-700';
        }
    };

    if (!station) {
        return <div className="p-4 text-gray-500">ไม่พบสถานี</div>;
    }

    return (
        <div className="min-h-screen bg-gray-100 print:bg-white">
            {/* Header */}
            <header className="bg-white shadow-sm sticky top-0 z-40 print:hidden">
                <div className="px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link href={`/station/${id}/new/home`} className="p-1">
                            <ArrowLeft size={24} className="text-gray-700" />
                        </Link>
                        <h1 className="font-bold text-gray-800 text-lg">สรุปวันนี้</h1>
                    </div>
                    <div className="flex items-center gap-2">
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="bg-gray-100 px-3 py-1.5 rounded-lg text-sm"
                        />
                        <button
                            onClick={handlePrint}
                            className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                        >
                            <Printer size={20} />
                        </button>
                    </div>
                </div>
            </header>

            {/* Print Header */}
            <div className="hidden print:block p-4 text-center border-b">
                <h1 className="text-xl font-bold">{station.name}</h1>
                <p className="text-gray-600">
                    สรุปยอดขาย วันที่ {new Date(selectedDate).toLocaleDateString('th-TH', { dateStyle: 'long' })}
                </p>
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                </div>
            ) : (
                <div className="p-4 space-y-4">
                    {/* Total Sales Card */}
                    <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-2xl p-6 text-center print:bg-blue-100 print:text-blue-800">
                        <div className="flex items-center justify-center gap-2 mb-2">
                            <DollarSign className="text-blue-200 print:text-blue-600" size={24} />
                            <span className="text-blue-100 print:text-blue-600">ยอดขายรวม</span>
                        </div>
                        <p className="text-4xl font-bold text-white print:text-blue-800">
                            ฿{formatCurrency(stats.totalAmount)}
                        </p>
                        <div className="flex justify-center gap-6 mt-3 text-blue-100 print:text-blue-600">
                            <span>
                                <Fuel size={14} className="inline mr-1" />
                                {formatNumber(stats.totalLiters)} ลิตร
                            </span>
                            <span>
                                <FileText size={14} className="inline mr-1" />
                                {stats.transactionCount} รายการ
                            </span>
                        </div>
                    </div>

                    {/* Payment Type Breakdown */}
                    <div className="bg-white rounded-2xl shadow-sm p-4">
                        <h2 className="font-semibold text-gray-800 mb-3">💳 ยอดตามประเภทชำระ</h2>
                        <div className="space-y-2">
                            {(['CASH', 'CREDIT', 'TRANSFER', 'BOX_TRUCK'] as const).map((type) => (
                                <div
                                    key={type}
                                    className={`flex items-center justify-between p-3 rounded-xl ${getPaymentColor(type)}`}
                                >
                                    <div className="flex items-center gap-3">
                                        {getPaymentIcon(type)}
                                        <span className="font-medium">{getPaymentLabel(type)}</span>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold">฿{formatCurrency(stats.byPaymentType[type].amount)}</p>
                                        <p className="text-xs opacity-75">{stats.byPaymentType[type].count} รายการ</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Cash Received & Expenses */}
                    <div className="bg-white rounded-2xl shadow-sm p-4">
                        <h2 className="font-semibold text-gray-800 mb-3">💰 เงินสดรับและค่าใช้จ่าย</h2>

                        <div className="space-y-4">
                            {/* Expected Cash */}
                            <div className="flex items-center justify-between bg-green-50 p-3 rounded-xl">
                                <span className="text-green-700">เงินสดตามระบบ</span>
                                <span className="text-green-800 font-bold">
                                    ฿{formatCurrency(stats.byPaymentType.CASH.amount)}
                                </span>
                            </div>

                            {/* Actual Cash */}
                            <div>
                                <label className="block text-sm text-gray-600 mb-1">เงินสดรับจริง</label>
                                <input
                                    type="number"
                                    value={cashReceived}
                                    onChange={(e) => setCashReceived(e.target.value)}
                                    placeholder="0.00"
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-lg text-right font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    inputMode="decimal"
                                />
                            </div>

                            {/* Difference */}
                            {cashReceived && (
                                <div className={`flex items-center justify-between p-3 rounded-xl ${parseFloat(cashReceived) >= stats.byPaymentType.CASH.amount
                                        ? 'bg-green-100 text-green-700'
                                        : 'bg-red-100 text-red-700'
                                    }`}>
                                    <span>ส่วนต่าง</span>
                                    <span className="font-bold">
                                        ฿{formatCurrency(parseFloat(cashReceived) - stats.byPaymentType.CASH.amount)}
                                    </span>
                                </div>
                            )}

                            <hr className="border-gray-200" />

                            {/* Expenses */}
                            <div>
                                <label className="block text-sm text-gray-600 mb-1">ค่าใช้จ่ายอื่นๆ</label>
                                <input
                                    type="number"
                                    value={expenses}
                                    onChange={(e) => setExpenses(e.target.value)}
                                    placeholder="0.00"
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-lg text-right font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    inputMode="decimal"
                                />
                            </div>

                            <div>
                                <label className="block text-sm text-gray-600 mb-1">หมายเหตุ</label>
                                <input
                                    type="text"
                                    value={expenseNote}
                                    onChange={(e) => setExpenseNote(e.target.value)}
                                    placeholder="เช่น ค่าน้ำมันรถ, ค่าอาหาร"
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            {/* Net Cash */}
                            {(cashReceived || expenses) && (
                                <div className="bg-blue-50 p-3 rounded-xl">
                                    <div className="flex items-center justify-between">
                                        <span className="text-blue-700">เงินสดสุทธิ</span>
                                        <span className="text-blue-800 font-bold text-xl">
                                            ฿{formatCurrency(
                                                (parseFloat(cashReceived) || 0) - (parseFloat(expenses) || 0)
                                            )}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Transaction List */}
                    <div className="bg-white rounded-2xl shadow-sm">
                        <div className="p-4 border-b border-gray-100">
                            <h2 className="font-semibold text-gray-800">📋 รายการทั้งหมด</h2>
                        </div>
                        <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto print:max-h-none">
                            {transactions.length > 0 ? (
                                transactions.map((t) => (
                                    <div key={t.id} className="px-4 py-3 flex items-center justify-between">
                                        <div>
                                            <p className="font-medium text-gray-800">{t.licensePlate || '-'}</p>
                                            <p className="text-xs text-gray-500">
                                                {new Date(t.date).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                                                {t.liters && ` • ${t.liters} ล.`}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-semibold text-gray-800">฿{formatCurrency(t.amount)}</p>
                                            <p className={`text-xs ${t.paymentType === 'CASH' ? 'text-green-600' :
                                                    t.paymentType === 'CREDIT' ? 'text-purple-600' :
                                                        t.paymentType === 'TRANSFER' ? 'text-blue-600' : 'text-orange-600'
                                                }`}>
                                                {getPaymentLabel(t.paymentType)}
                                            </p>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="p-8 text-center text-gray-400">
                                    <FileText size={32} className="mx-auto mb-2 opacity-50" />
                                    <p>ยังไม่มีรายการ</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
