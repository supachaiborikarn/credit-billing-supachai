'use client';

import { useState, useEffect } from 'react';
import { CreditCard, ArrowLeft, RefreshCw, Search, Save, Check } from 'lucide-react';
import Link from 'next/link';

interface Owner {
    id: string;
    name: string;
    phone: string | null;
    creditLimit: number;
    currentCredit: number;
    groupType: string;
}

export default function CreditLimitPage() {
    const [owners, setOwners] = useState<Owner[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValue, setEditValue] = useState<number>(0);
    const [saving, setSaving] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/owners?hasCredit=true');
            if (res.ok) {
                const data = await res.json();
                setOwners(data.owners || data || []);
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

    const handleEdit = (owner: Owner) => {
        setEditingId(owner.id);
        setEditValue(owner.creditLimit);
    };

    const handleSave = async (ownerId: string) => {
        setSaving(true);
        try {
            const res = await fetch(`/api/admin/owners/${ownerId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ creditLimit: editValue })
            });

            if (res.ok) {
                setOwners(prev => prev.map(o =>
                    o.id === ownerId ? { ...o, creditLimit: editValue } : o
                ));
                setEditingId(null);
            } else {
                const err = await res.json();
                alert(err.error || 'บันทึกไม่สำเร็จ');
            }
        } catch (error) {
            console.error('Save error:', error);
        } finally {
            setSaving(false);
        }
    };

    const filteredOwners = owners.filter(o =>
        filter === '' || o.name.toLowerCase().includes(filter.toLowerCase())
    );

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
                        <h1 className="font-bold text-gray-800 text-lg">💳 จัดการวงเงินเครดิต</h1>
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
                {/* Search */}
                <div className="bg-white rounded-2xl p-3 mb-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="ค้นหาชื่อ..."
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                            className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                </div>

                {/* List */}
                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filteredOwners.map((owner) => {
                            const usedPercent = owner.creditLimit > 0
                                ? (owner.currentCredit / owner.creditLimit) * 100
                                : 0;
                            const isEditing = editingId === owner.id;

                            return (
                                <div key={owner.id} className="bg-white border border-gray-200 rounded-2xl p-4">
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <p className="font-semibold text-gray-800">{owner.name}</p>
                                            <p className="text-sm text-gray-500">{owner.phone || '-'}</p>
                                        </div>
                                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${usedPercent >= 90 ? 'bg-red-100 text-red-700' :
                                            usedPercent >= 70 ? 'bg-yellow-100 text-yellow-700' :
                                                'bg-green-100 text-green-700'
                                            }`}>
                                            ใช้ไป {usedPercent.toFixed(0)}%
                                        </span>
                                    </div>

                                    {/* Progress */}
                                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden mb-3">
                                        <div
                                            className={`h-full transition-all ${usedPercent >= 90 ? 'bg-red-500' :
                                                usedPercent >= 70 ? 'bg-yellow-500' : 'bg-green-500'
                                                }`}
                                            style={{ width: `${Math.min(100, usedPercent)}%` }}
                                        ></div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                                        <div>
                                            <p className="text-gray-400">ยอดค้าง</p>
                                            <p className="font-semibold text-red-600">฿{formatCurrency(owner.currentCredit)}</p>
                                        </div>
                                        <div>
                                            <p className="text-gray-400">วงเงิน</p>
                                            {isEditing ? (
                                                <input
                                                    type="number"
                                                    value={editValue}
                                                    onChange={(e) => setEditValue(Number(e.target.value))}
                                                    className="w-full px-2 py-1 border border-blue-300 rounded-lg text-right font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                />
                                            ) : (
                                                <p className="font-semibold text-blue-600">฿{formatCurrency(owner.creditLimit)}</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex gap-2">
                                        {isEditing ? (
                                            <>
                                                <button
                                                    onClick={() => setEditingId(null)}
                                                    className="flex-1 py-2 border border-gray-300 rounded-xl text-gray-600 hover:bg-gray-50"
                                                >
                                                    ยกเลิก
                                                </button>
                                                <button
                                                    onClick={() => handleSave(owner.id)}
                                                    disabled={saving}
                                                    className="flex-1 py-2 bg-blue-500 text-white rounded-xl flex items-center justify-center gap-2 hover:bg-blue-600"
                                                >
                                                    {saving ? (
                                                        <RefreshCw size={16} className="animate-spin" />
                                                    ) : (
                                                        <Check size={16} />
                                                    )}
                                                    บันทึก
                                                </button>
                                            </>
                                        ) : (
                                            <button
                                                onClick={() => handleEdit(owner)}
                                                className="w-full py-2 border border-blue-300 text-blue-600 rounded-xl flex items-center justify-center gap-2 hover:bg-blue-50"
                                            >
                                                <CreditCard size={16} />
                                                แก้ไขวงเงิน
                                            </button>
                                        )}
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
