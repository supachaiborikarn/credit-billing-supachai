'use client';

import { useState, useEffect } from 'react';
import { Users, ArrowLeft, RefreshCw, Search, Phone, TrendingUp } from 'lucide-react';
import Link from 'next/link';

interface Owner {
    id: string;
    name: string;
    phone: string | null;
    creditLimit: number;
    currentCredit: number;
    groupType: string;
    transactionCount: number;
    truckCount: number;
}

export default function OutstandingCustomersPage() {
    const [owners, setOwners] = useState<Owner[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('');

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/owners?outstanding=true');
            if (res.ok) {
                const data = await res.json();
                setOwners(data.owners || []);
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

    const filteredOwners = owners.filter(o =>
        filter === '' || o.name.toLowerCase().includes(filter.toLowerCase())
    );

    const totalOutstanding = owners.reduce((sum, o) => sum + o.currentCredit, 0);

    const formatCurrency = (num: number) =>
        new Intl.NumberFormat('th-TH').format(num);

    return (
        <div className="min-h-screen bg-gray-100">
            {/* Header */}
            <header className="bg-white shadow-sm sticky top-0 z-40">
                <div className="px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link href="/admin" className="p-1">
                            <ArrowLeft size={24} className="text-gray-700" />
                        </Link>
                        <h1 className="font-bold text-gray-800 text-lg">📋 ลูกค้าค้างชำระ</h1>
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
                {/* Summary */}
                <div className="bg-gradient-to-r from-red-500 to-orange-500 rounded-2xl p-4 mb-4 text-white">
                    <p className="text-red-100 text-sm">ยอดค้างรวม</p>
                    <p className="text-3xl font-bold">฿{formatCurrency(totalOutstanding)}</p>
                    <p className="text-red-100 text-sm mt-1">{owners.length} ราย</p>
                </div>

                {/* Search */}
                <div className="bg-white rounded-2xl p-3 mb-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="ค้นหาชื่อ..."
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                            className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500"
                        />
                    </div>
                </div>

                {/* List */}
                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500"></div>
                    </div>
                ) : filteredOwners.length === 0 ? (
                    <div className="bg-green-50 border border-green-200 rounded-2xl p-8 text-center">
                        <Users className="mx-auto text-green-500 mb-4" size={48} />
                        <p className="font-semibold text-green-700">ไม่มียอดค้างชำระ 🎉</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filteredOwners.map((owner, index) => {
                            const usedPercent = owner.creditLimit > 0
                                ? (owner.currentCredit / owner.creditLimit) * 100
                                : 100;

                            return (
                                <div key={owner.id} className="bg-white border border-gray-200 rounded-2xl p-4">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex items-center gap-3">
                                            <span className="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center font-bold text-sm">
                                                {index + 1}
                                            </span>
                                            <div>
                                                <p className="font-semibold text-gray-800">{owner.name}</p>
                                                {owner.phone && (
                                                    <p className="text-sm text-gray-500 flex items-center gap-1">
                                                        <Phone size={12} />
                                                        {owner.phone}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold text-red-600 text-lg">
                                                ฿{formatCurrency(owner.currentCredit)}
                                            </p>
                                            <p className="text-xs text-gray-400">
                                                วงเงิน ฿{formatCurrency(owner.creditLimit)}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Progress */}
                                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden mb-2">
                                        <div
                                            className={`h-full transition-all ${usedPercent >= 90 ? 'bg-red-500' :
                                                usedPercent >= 70 ? 'bg-yellow-500' : 'bg-green-500'
                                                }`}
                                            style={{ width: `${Math.min(100, usedPercent)}%` }}
                                        ></div>
                                    </div>

                                    <div className="flex justify-between text-xs text-gray-400">
                                        <span>{owner.truckCount} คัน • {owner.transactionCount} รายการ</span>
                                        <span>
                                            {usedPercent >= 100 ? '🔴 เกินวงเงิน' :
                                                usedPercent >= 90 ? '⚠️ ใกล้เต็ม' :
                                                    `ใช้ไป ${usedPercent.toFixed(0)}%`}
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
