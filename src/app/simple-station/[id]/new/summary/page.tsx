'use client';

import { useState, useEffect, use } from 'react';
import { ArrowLeft, Trash2, Calendar } from 'lucide-react';
import { STATIONS, PAYMENT_TYPES, FUEL_TYPES } from '@/constants';
import Link from 'next/link';

interface Transaction {
    id: string;
    licensePlate: string;
    ownerName: string;
    paymentType: string;
    fuelType: string;
    liters: number;
    pricePerLiter: number;
    amount: number;
    bookNo: string;
    billNo: string;
    createdAt: string;
}

export default function SimpleStationSummaryPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const stationIndex = parseInt(id) - 1;
    const station = STATIONS[stationIndex];

    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [loading, setLoading] = useState(true);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [activeFilter, setActiveFilter] = useState('all');
    const [deletingId, setDeletingId] = useState<string | null>(null);

    // Fetch transactions
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const res = await fetch(`/api/station/${id}/transactions?date=${selectedDate}`);
                if (res.ok) {
                    const data = await res.json();
                    setTransactions(data || []);
                }
            } catch (error) {
                console.error('Error fetching:', error);
            } finally {
                setLoading(false);
            }
        };

        if (station) fetchData();
    }, [station, id, selectedDate]);

    // Delete transaction
    const handleDelete = async (txnId: string) => {
        if (!confirm('ยืนยันการลบรายการนี้?')) return;
        setDeletingId(txnId);
        try {
            const res = await fetch(`/api/station/${id}/transactions/${txnId}`, {
                method: 'DELETE',
            });
            if (res.ok) {
                setTransactions(prev => prev.filter(t => t.id !== txnId));
            }
        } catch (error) {
            console.error('Error deleting:', error);
        } finally {
            setDeletingId(null);
        }
    };

    const filteredTransactions = transactions.filter(t => {
        if (activeFilter === 'all') return true;
        return t.paymentType === activeFilter;
    });

    const totalAmount = filteredTransactions.reduce((s, t) => s + Number(t.amount), 0);
    const totalLiters = filteredTransactions.reduce((s, t) => s + Number(t.liters), 0);

    const formatCurrency = (num: number) =>
        new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2 }).format(num);

    const formatTime = (dateStr: string) =>
        new Date(dateStr).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

    const getPaymentLabel = (value: string) => {
        const pt = PAYMENT_TYPES.find(p => p.value === value);
        return pt ? pt.label : value;
    };

    const getFuelLabel = (value: string) => {
        const ft = FUEL_TYPES.find(f => f.value === value);
        return ft ? ft.label : value;
    };

    if (!station) {
        return <div className="p-4 text-gray-500">ไม่พบสถานี</div>;
    }

    return (
        <div className="min-h-screen bg-gray-100">
            {/* Header */}
            <header className="bg-white shadow-sm sticky top-0 z-40">
                <div className="px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link href={`/simple-station/${id}/new/home`} className="p-1">
                            <ArrowLeft size={24} className="text-gray-700" />
                        </Link>
                        <h1 className="font-bold text-gray-800 text-lg">สรุปรายวัน</h1>
                    </div>
                    <div className="flex items-center gap-2 rounded-full border border-black/15 bg-white px-3 py-1.5">
                        <Calendar size={14} className="text-orange-500" />
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="bg-transparent text-sm font-bold focus:outline-none w-[110px]"
                        />
                    </div>
                </div>
            </header>

            <div className="p-4 pb-24 space-y-4">
                {/* Summary Card */}
                <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-2xl p-4 text-white">
                    <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                            <p className="text-orange-100 text-xs">รายการ</p>
                            <p className="text-2xl font-bold">{filteredTransactions.length}</p>
                        </div>
                        <div>
                            <p className="text-orange-100 text-xs">รวมลิตร</p>
                            <p className="text-2xl font-bold">{formatCurrency(totalLiters)}</p>
                        </div>
                        <div>
                            <p className="text-orange-100 text-xs">รวมเงิน</p>
                            <p className="text-2xl font-bold">{formatCurrency(totalAmount)} ฿</p>
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => setActiveFilter('all')}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${activeFilter === 'all'
                            ? 'bg-orange-500 text-white'
                            : 'bg-white text-gray-700 border border-gray-200'
                            }`}
                    >
                        ทั้งหมด ({transactions.length})
                    </button>
                    {PAYMENT_TYPES.slice(0, 4).map(pt => {
                        const count = transactions.filter(t => t.paymentType === pt.value).length;
                        return (
                            <button
                                key={pt.value}
                                onClick={() => setActiveFilter(pt.value)}
                                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${activeFilter === pt.value
                                    ? 'bg-orange-500 text-white'
                                    : 'bg-white text-gray-700 border border-gray-200'
                                    }`}
                            >
                                {pt.label} ({count})
                            </button>
                        );
                    })}
                </div>

                {/* Transactions List */}
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
                    </div>
                ) : filteredTransactions.length === 0 ? (
                    <div className="bg-white rounded-2xl p-8 text-center text-gray-400">
                        ยังไม่มีรายการ
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filteredTransactions.map((txn) => (
                            <div key={txn.id} className="bg-white rounded-2xl p-4 shadow-sm">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-bold text-gray-800">{txn.licensePlate || 'ไม่ระบุ'}</span>
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${txn.paymentType === 'CASH' ? 'bg-green-100 text-green-700' :
                                                txn.paymentType === 'CREDIT' ? 'bg-purple-100 text-purple-700' :
                                                    'bg-blue-100 text-blue-700'
                                                }`}>
                                                {getPaymentLabel(txn.paymentType)}
                                            </span>
                                        </div>
                                        <p className="text-sm text-gray-500">{txn.ownerName || '-'}</p>
                                        <p className="text-xs text-gray-400 mt-1">
                                            {txn.bookNo || '-'}/{txn.billNo || '-'} • {getFuelLabel(txn.fuelType)} • {formatTime(txn.createdAt)}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-lg text-green-600">{formatCurrency(txn.amount)} ฿</p>
                                        <p className="text-sm text-gray-500">{txn.liters} ลิตร</p>
                                        <button
                                            onClick={() => handleDelete(txn.id)}
                                            disabled={deletingId === txn.id}
                                            className="mt-2 p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                                        >
                                            {deletingId === txn.id ? (
                                                <div className="animate-spin h-4 w-4 border-2 border-red-400 border-t-transparent rounded-full"></div>
                                            ) : (
                                                <Trash2 size={16} />
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
