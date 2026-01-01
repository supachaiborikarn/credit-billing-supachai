'use client';

import { useState, useEffect } from 'react';
import { FileText, CheckCircle, Clock, AlertCircle, ArrowLeft, RefreshCw, Search } from 'lucide-react';
import Link from 'next/link';

interface Invoice {
    id: string;
    invoiceNumber: string;
    totalAmount: number;
    paidAmount: number;
    status: 'PENDING' | 'PARTIAL' | 'PAID' | 'OVERDUE';
    dueDate: string | null;
    createdAt: string;
    owner: {
        id: string;
        name: string;
        code: string | null;
    };
    _count: {
        transactions: number;
    };
}

export default function InvoiceListPage() {
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<string>('');
    const [statusFilter, setStatusFilter] = useState<string>('ALL');

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/invoices');
            if (res.ok) {
                const data = await res.json();
                setInvoices(data || []);
            }
        } catch (error) {
            console.error('Fetch error:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const getStatusBadge = (status: string, dueDate: string | null) => {
        // Check if overdue
        if (status === 'PENDING' && dueDate && new Date(dueDate) < new Date()) {
            return {
                icon: <AlertCircle size={14} />,
                text: 'เกินกำหนด',
                bg: 'bg-red-100 text-red-700 border-red-200'
            };
        }

        switch (status) {
            case 'PAID':
                return {
                    icon: <CheckCircle size={14} />,
                    text: 'ชำระแล้ว',
                    bg: 'bg-green-100 text-green-700 border-green-200'
                };
            case 'PARTIAL':
                return {
                    icon: <Clock size={14} />,
                    text: 'ชำระบางส่วน',
                    bg: 'bg-yellow-100 text-yellow-700 border-yellow-200'
                };
            default:
                return {
                    icon: <Clock size={14} />,
                    text: 'รอชำระ',
                    bg: 'bg-gray-100 text-gray-700 border-gray-200'
                };
        }
    };

    const filteredInvoices = invoices.filter(inv => {
        const matchesSearch = filter === '' ||
            inv.invoiceNumber.toLowerCase().includes(filter.toLowerCase()) ||
            inv.owner.name.toLowerCase().includes(filter.toLowerCase());

        const matchesStatus = statusFilter === 'ALL' || inv.status === statusFilter;

        return matchesSearch && matchesStatus;
    });

    const stats = {
        total: invoices.length,
        pending: invoices.filter(i => i.status === 'PENDING').length,
        paid: invoices.filter(i => i.status === 'PAID').length,
        totalAmount: invoices.reduce((sum, i) => sum + Number(i.totalAmount), 0),
        paidAmount: invoices.reduce((sum, i) => sum + Number(i.paidAmount), 0)
    };

    return (
        <div className="min-h-screen bg-gray-100">
            {/* Header */}
            <header className="bg-white shadow-sm sticky top-0 z-40">
                <div className="px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link href="/admin" className="p-1">
                            <ArrowLeft size={24} className="text-gray-700" />
                        </Link>
                        <h1 className="font-bold text-gray-800 text-lg">📄 รายการใบแจ้งหนี้</h1>
                    </div>
                    <button
                        onClick={fetchData}
                        className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200"
                    >
                        <RefreshCw size={20} className={`text-gray-600 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </header>

            <div className="p-4">
                {/* Stats */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-2xl p-4 text-white">
                        <p className="text-blue-100 text-sm">ยอดรวมทั้งหมด</p>
                        <p className="text-2xl font-bold">฿{stats.totalAmount.toLocaleString()}</p>
                    </div>
                    <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-2xl p-4 text-white">
                        <p className="text-green-100 text-sm">ชำระแล้ว</p>
                        <p className="text-2xl font-bold">฿{stats.paidAmount.toLocaleString()}</p>
                    </div>
                </div>

                {/* Search + Filter */}
                <div className="bg-white rounded-2xl p-3 mb-4 flex gap-2">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="ค้นหาเลขที่หรือชื่อ..."
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                            className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="px-3 py-2 border border-gray-200 rounded-xl focus:outline-none"
                    >
                        <option value="ALL">ทั้งหมด</option>
                        <option value="PENDING">รอชำระ</option>
                        <option value="PARTIAL">บางส่วน</option>
                        <option value="PAID">ชำระแล้ว</option>
                    </select>
                </div>

                {/* List */}
                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                    </div>
                ) : filteredInvoices.length === 0 ? (
                    <div className="bg-gray-50 border border-gray-200 rounded-2xl p-8 text-center">
                        <FileText className="mx-auto text-gray-400 mb-4" size={48} />
                        <p className="font-semibold text-gray-600">ไม่มีรายการ</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filteredInvoices.map((inv) => {
                            const badge = getStatusBadge(inv.status, inv.dueDate);
                            const balance = Number(inv.totalAmount) - Number(inv.paidAmount);

                            return (
                                <div
                                    key={inv.id}
                                    className="bg-white border border-gray-200 rounded-2xl p-4 hover:shadow-md transition-shadow"
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <p className="font-bold text-gray-800">{inv.invoiceNumber}</p>
                                            <p className="text-sm text-gray-500">{inv.owner.name}</p>
                                        </div>
                                        <span className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold border ${badge.bg}`}>
                                            {badge.icon}
                                            {badge.text}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-3 gap-2 text-sm mt-3">
                                        <div>
                                            <p className="text-gray-400">ยอดรวม</p>
                                            <p className="font-semibold">฿{Number(inv.totalAmount).toLocaleString()}</p>
                                        </div>
                                        <div>
                                            <p className="text-gray-400">ชำระแล้ว</p>
                                            <p className="font-semibold text-green-600">฿{Number(inv.paidAmount).toLocaleString()}</p>
                                        </div>
                                        <div>
                                            <p className="text-gray-400">คงเหลือ</p>
                                            <p className={`font-semibold ${balance > 0 ? 'text-red-600' : 'text-gray-600'}`}>
                                                ฿{balance.toLocaleString()}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-100 text-xs text-gray-400">
                                        <span>{inv._count.transactions} รายการ</span>
                                        <span>
                                            {inv.dueDate && `กำหนด: ${new Date(inv.dueDate).toLocaleDateString('th-TH')}`}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
