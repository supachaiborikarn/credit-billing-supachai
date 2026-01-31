'use client';

import { useState, useEffect, use } from 'react';
import { ArrowLeft, Search, Trash2, Edit, FileText, Filter } from 'lucide-react';
import { STATIONS } from '@/constants';
import Link from 'next/link';

interface Transaction {
    id: string;
    date: string;
    licensePlate: string;
    ownerName: string;
    ownerCode?: string | null;
    paymentType: string;
    liters: number;
    amount: number;
    recordedByName?: string;
    billBookNo?: string | null;
    billNo?: string | null;
}

export default function StationListPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const stationIndex = parseInt(id) - 1;
    const station = STATIONS[stationIndex];

    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterPaymentType, setFilterPaymentType] = useState<string>('ALL');
    const [deletingId, setDeletingId] = useState<string | null>(null);

    useEffect(() => {
        fetchTransactions();
    }, [selectedDate]);

    const fetchTransactions = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/station/${id}/transactions?date=${selectedDate}`);
            if (res.ok) {
                const data = await res.json();
                setTransactions(data);
            }
        } catch (error) {
            console.error('Error fetching:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (transactionId: string) => {
        if (!confirm('ยืนยันลบรายการนี้?')) return;

        setDeletingId(transactionId);
        try {
            const res = await fetch(`/api/station/${id}/transactions/${transactionId}`, {
                method: 'DELETE',
            });

            if (res.ok) {
                setTransactions(prev => prev.filter(t => t.id !== transactionId));
            } else {
                const err = await res.json();
                alert(err.error || 'ลบไม่สำเร็จ');
            }
        } catch (error) {
            console.error('Delete error:', error);
            alert('เกิดข้อผิดพลาด');
        } finally {
            setDeletingId(null);
        }
    };

    const formatCurrency = (num: number) =>
        new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2 }).format(num);

    const getPaymentLabel = (type: string) => {
        switch (type) {
            case 'CASH': return 'เงินสด';
            case 'CREDIT': return 'เงินเชื่อ';
            case 'TRANSFER': return 'โอนเงิน';
            case 'BOX_TRUCK': return 'รถบรรทุก';
            default: return type;
        }
    };

    const getPaymentColor = (type: string) => {
        switch (type) {
            case 'CASH': return 'text-green-600 bg-green-50';
            case 'CREDIT': return 'text-purple-600 bg-purple-50';
            case 'TRANSFER': return 'text-blue-600 bg-blue-50';
            case 'BOX_TRUCK': return 'text-orange-600 bg-orange-50';
            default: return 'text-gray-600 bg-gray-50';
        }
    };

    // Filter transactions
    const filteredTransactions = transactions.filter(t => {
        const matchesSearch = searchQuery === '' ||
            t.licensePlate?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            t.ownerName?.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesPayment = filterPaymentType === 'ALL' || t.paymentType === filterPaymentType;
        return matchesSearch && matchesPayment;
    });

    // Calculate totals
    const totalAmount = filteredTransactions.reduce((sum, t) => sum + t.amount, 0);
    const totalLiters = filteredTransactions.reduce((sum, t) => sum + (t.liters || 0), 0);

    if (!station) {
        return <div className="p-4 text-gray-500">ไม่พบสถานี</div>;
    }

    return (
        <div className="min-h-screen bg-gray-100">
            {/* Header */}
            <header className="bg-white shadow-sm sticky top-0 z-40">
                <div className="px-4 py-3 flex items-center gap-3">
                    <Link href={`/station/${id}/new/home`} className="p-1">
                        <ArrowLeft size={24} className="text-gray-700" />
                    </Link>
                    <h1 className="font-bold text-gray-800 text-lg">รายการวันนี้</h1>
                    <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="ml-auto bg-gray-100 px-3 py-1.5 rounded-lg text-sm"
                    />
                </div>

                {/* Search & Filter */}
                <div className="px-4 pb-3 flex gap-2">
                    <div className="relative flex-1">
                        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="ค้นหาทะเบียน/ชื่อ..."
                            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <select
                        value={filterPaymentType}
                        onChange={(e) => setFilterPaymentType(e.target.value)}
                        className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none"
                    >
                        <option value="ALL">ทั้งหมด</option>
                        <option value="CASH">เงินสด</option>
                        <option value="CREDIT">เงินเชื่อ</option>
                        <option value="TRANSFER">โอนเงิน</option>
                        <option value="BOX_TRUCK">รถบรรทุก</option>
                    </select>
                </div>
            </header>

            {/* Summary Bar */}
            <div className="bg-blue-600 text-white px-4 py-3 flex justify-between">
                <span>{filteredTransactions.length} รายการ</span>
                <span className="font-bold">รวม ฿{formatCurrency(totalAmount)}</span>
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                </div>
            ) : filteredTransactions.length === 0 ? (
                <div className="p-8 text-center text-gray-400">
                    <FileText size={48} className="mx-auto mb-3 opacity-50" />
                    <p>ยังไม่มีรายการ</p>
                </div>
            ) : (
                <div className="divide-y divide-gray-100">
                    {filteredTransactions.map((t) => (
                        <div key={t.id} className="bg-white px-4 py-3 flex items-center gap-3">
                            <div className="flex-1">
                                <div className="flex items-center gap-2">
                                    <p className="font-medium text-gray-800">{t.licensePlate || '-'}</p>
                                    {t.ownerCode && (
                                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                                            {t.ownerCode}
                                        </span>
                                    )}
                                </div>
                                <p className="text-sm text-gray-500">
                                    {t.ownerName || '-'}
                                    {t.liters && ` • ${t.liters} ล.`}
                                </p>
                                {(t.billBookNo || t.billNo) && (
                                    <p className="text-xs text-orange-600 font-medium">
                                        📄 {t.billBookNo && `เล่ม ${t.billBookNo}`}{t.billBookNo && t.billNo && ' '}{t.billNo && `เลขที่ ${t.billNo}`}
                                    </p>
                                )}
                                <p className="text-xs text-gray-400">
                                    {new Date(t.date).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                                    {t.recordedByName && ` • ${t.recordedByName}`}
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="font-bold text-gray-800">฿{formatCurrency(t.amount)}</p>
                                <span className={`text-xs px-2 py-0.5 rounded-full ${getPaymentColor(t.paymentType)}`}>
                                    {getPaymentLabel(t.paymentType)}
                                </span>
                            </div>
                            <button
                                onClick={() => handleDelete(t.id)}
                                disabled={deletingId === t.id}
                                className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                            >
                                {deletingId === t.id ? (
                                    <div className="w-5 h-5 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <Trash2 size={18} />
                                )}
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
