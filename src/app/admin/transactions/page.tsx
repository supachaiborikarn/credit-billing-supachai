'use client';

import { useState, useEffect } from 'react';
import { FileText, Search, Trash2, Edit, X, Check, AlertTriangle } from 'lucide-react';

interface Transaction {
    id: string;
    date: string;
    licensePlate: string | null;
    ownerName: string | null;
    paymentType: string;
    liters: number;
    pricePerLiter: number;
    amount: number;
    productType: string | null;
    stationId: string;
    isVoided: boolean;
    recordedByName?: string;
}

export default function AdminTransactionsPage() {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedStation, setSelectedStation] = useState('all');

    // Edit modal
    const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
    const [editForm, setEditForm] = useState<Partial<Transaction>>({});

    // Void modal
    const [voidingTransaction, setVoidingTransaction] = useState<Transaction | null>(null);
    const [voidReason, setVoidReason] = useState('');

    const [actionLoading, setActionLoading] = useState(false);

    const stations = [
        { id: 'all', name: 'ทุกสถานี' },
        { id: 'station-1', name: 'แท๊งลอยวัชรเกียรติ' },
        { id: 'station-2', name: 'วัชรเกียรติออยล์' },
        { id: 'station-3', name: 'พงษ์อนันต์ปิโตรเลียม' },
        { id: 'station-4', name: 'ศุภชัยบริการ' },
        { id: 'station-5', name: 'ปั๊มแก๊สพงษ์อนันต์' },
        { id: 'station-6', name: 'ปั๊มแก๊สศุภชัย' },
    ];

    useEffect(() => {
        fetchTransactions();
    }, [selectedDate, selectedStation]);

    const fetchTransactions = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                date: selectedDate,
                ...(selectedStation !== 'all' && { stationId: selectedStation }),
                includeVoided: 'true',
            });

            const res = await fetch(`/api/admin/transactions?${params}`);
            if (res.ok) {
                const data = await res.json();
                setTransactions(data);
            }
        } catch (error) {
            console.error('Fetch error:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleVoid = async () => {
        if (!voidingTransaction) return;

        setActionLoading(true);
        try {
            const stationNum = voidingTransaction.stationId.replace('station-', '');
            const res = await fetch(`/api/station/${stationNum}/transactions/${voidingTransaction.id}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reason: voidReason }),
            });

            if (res.ok) {
                setVoidingTransaction(null);
                setVoidReason('');
                fetchTransactions();
            } else {
                const err = await res.json();
                alert(err.error || 'Failed to void');
            }
        } catch (error) {
            console.error('Void error:', error);
        } finally {
            setActionLoading(false);
        }
    };

    const handleEdit = async () => {
        if (!editingTransaction) return;

        setActionLoading(true);
        try {
            const stationNum = editingTransaction.stationId.replace('station-', '');
            const res = await fetch(`/api/station/${stationNum}/transactions/${editingTransaction.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editForm),
            });

            if (res.ok) {
                setEditingTransaction(null);
                fetchTransactions();
            } else {
                const err = await res.json();
                alert(err.error || 'Failed to update');
            }
        } catch (error) {
            console.error('Edit error:', error);
        } finally {
            setActionLoading(false);
        }
    };

    const filteredTransactions = transactions.filter(t => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
            t.licensePlate?.toLowerCase().includes(q) ||
            t.ownerName?.toLowerCase().includes(q) ||
            t.amount.toString().includes(q)
        );
    });

    const formatCurrency = (num: number) => new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2 }).format(num);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4 md:p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="glass-card p-6 mb-6">
                    <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                        <FileText className="text-purple-400" />
                        Admin: จัดการรายการ Transaction
                    </h1>
                    <p className="text-gray-400 mt-1">แก้ไข/ยกเลิกรายการ พร้อมบันทึก Audit Log</p>
                </div>

                {/* Filters */}
                <div className="glass-card p-4 mb-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                            <label className="block text-sm text-gray-400 mb-1">วันที่</label>
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="input-glow"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-gray-400 mb-1">สถานี</label>
                            <select
                                value={selectedStation}
                                onChange={(e) => setSelectedStation(e.target.value)}
                                className="input-glow"
                            >
                                {stations.map(s => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm text-gray-400 mb-1">ค้นหา</label>
                            <div className="relative">
                                <Search className="absolute left-3 top-3 text-gray-400" size={18} />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="ทะเบียน, ชื่อลูกค้า, ยอดเงิน..."
                                    className="input-glow pl-10"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Table */}
                <div className="glass-card overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-white/10">
                                    <th className="text-left p-4 text-gray-400 text-sm">เวลา</th>
                                    <th className="text-left p-4 text-gray-400 text-sm">ทะเบียน</th>
                                    <th className="text-left p-4 text-gray-400 text-sm">ลูกค้า</th>
                                    <th className="text-left p-4 text-gray-400 text-sm">ประเภท</th>
                                    <th className="text-right p-4 text-gray-400 text-sm">ลิตร</th>
                                    <th className="text-right p-4 text-gray-400 text-sm">ยอดเงิน</th>
                                    <th className="text-center p-4 text-gray-400 text-sm">สถานะ</th>
                                    <th className="text-center p-4 text-gray-400 text-sm">จัดการ</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={8} className="text-center p-8 text-gray-400">
                                            <div className="spinner mx-auto mb-2" />
                                            กำลังโหลด...
                                        </td>
                                    </tr>
                                ) : filteredTransactions.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="text-center p-8 text-gray-400">
                                            ไม่พบรายการ
                                        </td>
                                    </tr>
                                ) : (
                                    filteredTransactions.map((t) => (
                                        <tr
                                            key={t.id}
                                            className={`border-b border-white/5 hover:bg-white/5 ${t.isVoided ? 'opacity-50' : ''}`}
                                        >
                                            <td className="p-4 text-white text-sm">
                                                {new Date(t.date).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                                            </td>
                                            <td className="p-4 text-blue-400 font-mono">{t.licensePlate || '-'}</td>
                                            <td className="p-4 text-white">{t.ownerName || '-'}</td>
                                            <td className="p-4">
                                                <span className={`px-2 py-1 rounded text-xs ${t.paymentType === 'CREDIT' ? 'bg-purple-600' :
                                                        t.paymentType === 'CASH' ? 'bg-green-600' :
                                                            'bg-blue-600'
                                                    } text-white`}>
                                                    {t.paymentType}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right text-white">{t.liters.toFixed(2)}</td>
                                            <td className="p-4 text-right text-yellow-400 font-bold">
                                                ฿{formatCurrency(t.amount)}
                                            </td>
                                            <td className="p-4 text-center">
                                                {t.isVoided ? (
                                                    <span className="text-red-400 flex items-center justify-center gap-1">
                                                        <AlertTriangle size={14} />
                                                        ยกเลิก
                                                    </span>
                                                ) : (
                                                    <span className="text-green-400">ปกติ</span>
                                                )}
                                            </td>
                                            <td className="p-4 text-center">
                                                {!t.isVoided && (
                                                    <div className="flex items-center justify-center gap-2">
                                                        <button
                                                            onClick={() => {
                                                                setEditingTransaction(t);
                                                                setEditForm({
                                                                    licensePlate: t.licensePlate,
                                                                    ownerName: t.ownerName,
                                                                    paymentType: t.paymentType,
                                                                    liters: t.liters,
                                                                    pricePerLiter: t.pricePerLiter,
                                                                    amount: t.amount,
                                                                });
                                                            }}
                                                            className="p-2 text-blue-400 hover:bg-blue-500/20 rounded-lg"
                                                            title="แก้ไข"
                                                        >
                                                            <Edit size={16} />
                                                        </button>
                                                        <button
                                                            onClick={() => setVoidingTransaction(t)}
                                                            className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg"
                                                            title="ยกเลิก"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Void Modal */}
                {voidingTransaction && (
                    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                        <div className="glass-card p-6 max-w-md w-full">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2 mb-4">
                                <AlertTriangle className="text-red-400" />
                                ยกเลิกรายการ
                            </h3>
                            <p className="text-gray-400 mb-4">
                                รายการ: {voidingTransaction.licensePlate || voidingTransaction.ownerName} - ฿{formatCurrency(voidingTransaction.amount)}
                            </p>
                            <div className="mb-4">
                                <label className="block text-sm text-gray-400 mb-1">เหตุผลในการยกเลิก *</label>
                                <textarea
                                    value={voidReason}
                                    onChange={(e) => setVoidReason(e.target.value)}
                                    placeholder="ระบุเหตุผล..."
                                    className="input-glow resize-none"
                                    rows={3}
                                />
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setVoidingTransaction(null)}
                                    className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg text-white"
                                >
                                    ยกเลิก
                                </button>
                                <button
                                    onClick={handleVoid}
                                    disabled={!voidReason.trim() || actionLoading}
                                    className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-white flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {actionLoading ? <div className="spinner w-4 h-4" /> : <Trash2 size={16} />}
                                    ยืนยันยกเลิก
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Edit Modal */}
                {editingTransaction && (
                    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                        <div className="glass-card p-6 max-w-lg w-full">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                    <Edit className="text-blue-400" />
                                    แก้ไขรายการ
                                </h3>
                                <button onClick={() => setEditingTransaction(null)} className="text-gray-400 hover:text-white">
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm text-gray-400 mb-1">ทะเบียนรถ</label>
                                        <input
                                            type="text"
                                            value={editForm.licensePlate || ''}
                                            onChange={(e) => setEditForm({ ...editForm, licensePlate: e.target.value })}
                                            className="input-glow"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm text-gray-400 mb-1">ชื่อลูกค้า</label>
                                        <input
                                            type="text"
                                            value={editForm.ownerName || ''}
                                            onChange={(e) => setEditForm({ ...editForm, ownerName: e.target.value })}
                                            className="input-glow"
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-sm text-gray-400 mb-1">ลิตร</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={editForm.liters || 0}
                                            onChange={(e) => setEditForm({ ...editForm, liters: parseFloat(e.target.value) })}
                                            className="input-glow"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm text-gray-400 mb-1">ราคา/ลิตร</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={editForm.pricePerLiter || 0}
                                            onChange={(e) => setEditForm({ ...editForm, pricePerLiter: parseFloat(e.target.value) })}
                                            className="input-glow"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm text-gray-400 mb-1">ยอดเงิน</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={editForm.amount || 0}
                                            onChange={(e) => setEditForm({ ...editForm, amount: parseFloat(e.target.value) })}
                                            className="input-glow"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-3 mt-6">
                                <button
                                    onClick={() => setEditingTransaction(null)}
                                    className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg text-white"
                                >
                                    ยกเลิก
                                </button>
                                <button
                                    onClick={handleEdit}
                                    disabled={actionLoading}
                                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-white flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {actionLoading ? <div className="spinner w-4 h-4" /> : <Check size={16} />}
                                    บันทึกการแก้ไข
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
