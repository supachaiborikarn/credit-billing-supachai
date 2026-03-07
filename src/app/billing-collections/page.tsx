'use client';

import { useState, useEffect, useCallback } from 'react';
import Sidebar from '@/components/Sidebar';
import Breadcrumb from '@/components/Breadcrumb';
import { LoadingState } from '@/components/Spinner';
import { formatCurrency } from '@/utils/format';
import { BillingCollection } from '@/types';
import {
    FileText, Plus, Search, CheckCircle, Clock, AlertTriangle,
    Sparkles, Calendar, ChevronRight, Receipt
} from 'lucide-react';

export default function BillingCollectionsPage() {
    const [loading, setLoading] = useState(true);
    const [collections, setCollections] = useState<BillingCollection[]>([]);
    const [total, setTotal] = useState(0);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [mounted, setMounted] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);

    // Create form state
    const [owners, setOwners] = useState<{ id: string; name: string; code: string | null }[]>([]);
    const [selectedOwnerId, setSelectedOwnerId] = useState('');
    const [periodStart, setPeriodStart] = useState('');
    const [periodEnd, setPeriodEnd] = useState('');
    const [periodLabel, setPeriodLabel] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [createNotes, setCreateNotes] = useState('');
    const [items, setItems] = useState<Array<{
        sourceDescription: string;
        sourceStation: string;
        sourceInvoiceNo: string;
        amount: string;
    }>>([{ sourceDescription: '', sourceStation: '', sourceInvoiceNo: '', amount: '' }]);
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        setMounted(true);
        fetchCollections();
        fetchOwners();
    }, []);

    const fetchCollections = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (statusFilter !== 'all') params.set('status', statusFilter);
            if (search) params.set('search', search);

            const res = await fetch(`/api/billing-collections?${params}`);
            if (res.ok) {
                const data = await res.json();
                setCollections(data.collections);
                setTotal(data.total);
            }
        } catch (error) {
            console.error('Error fetching billing collections:', error);
        } finally {
            setLoading(false);
        }
    }, [statusFilter, search]);

    useEffect(() => {
        const timeout = setTimeout(() => fetchCollections(), 300);
        return () => clearTimeout(timeout);
    }, [fetchCollections]);

    const fetchOwners = async () => {
        try {
            const res = await fetch('/api/owners?status=ACTIVE&limit=500');
            if (res.ok) {
                const data = await res.json();
                setOwners(Array.isArray(data) ? data : data.owners || []);
            }
        } catch (error) {
            console.error('Error fetching owners:', error);
        }
    };

    const addItem = () => {
        setItems([...items, { sourceDescription: '', sourceStation: '', sourceInvoiceNo: '', amount: '' }]);
    };

    const removeItem = (index: number) => {
        if (items.length <= 1) return;
        setItems(items.filter((_, i) => i !== index));
    };

    const updateItem = (index: number, field: string, value: string) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], [field]: value };
        setItems(newItems);
    };

    const itemsTotal = items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

    const handleCreate = async () => {
        if (!selectedOwnerId || !periodStart || !periodEnd) {
            alert('กรุณาเลือกลูกค้าและกำหนดช่วงเวลา');
            return;
        }

        const validItems = items.filter(item => item.sourceDescription && item.amount);
        if (validItems.length === 0) {
            alert('กรุณาเพิ่มรายการบิลอย่างน้อย 1 รายการ');
            return;
        }

        setCreating(true);
        try {
            const res = await fetch('/api/billing-collections', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ownerId: selectedOwnerId,
                    periodStart,
                    periodEnd,
                    periodLabel: periodLabel || undefined,
                    dueDate: dueDate || undefined,
                    notes: createNotes || undefined,
                    items: validItems.map(item => ({
                        sourceDescription: item.sourceDescription,
                        sourceStation: item.sourceStation || undefined,
                        sourceInvoiceNo: item.sourceInvoiceNo || undefined,
                        amount: parseFloat(item.amount),
                    })),
                }),
            });

            if (res.ok) {
                const data = await res.json();
                alert(`✅ สร้างใบวางบิลรวม ${data.collectionNo} เรียบร้อย`);
                setShowCreateModal(false);
                resetCreateForm();
                fetchCollections();
            } else {
                const err = await res.json();
                alert(err.error || 'เกิดข้อผิดพลาด');
            }
        } catch (error) {
            console.error('Error creating:', error);
            alert('เกิดข้อผิดพลาด');
        } finally {
            setCreating(false);
        }
    };

    const resetCreateForm = () => {
        setSelectedOwnerId('');
        setPeriodStart('');
        setPeriodEnd('');
        setPeriodLabel('');
        setDueDate('');
        setCreateNotes('');
        setItems([{ sourceDescription: '', sourceStation: '', sourceInvoiceNo: '', amount: '' }]);
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'PAID': return 'badge-green';
            case 'PARTIAL': return 'badge-orange';
            case 'OVERDUE': return 'badge-red';
            default: return 'badge-purple';
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'PAID': return 'ชำระแล้ว';
            case 'PARTIAL': return 'ชำระบางส่วน';
            case 'OVERDUE': return 'เกินกำหนด';
            default: return 'รอชำระ';
        }
    };

    const summaryStats = {
        totalPending: collections.filter(c => c.status === 'PENDING' || c.status === 'OVERDUE').reduce((sum, c) => sum + Number(c.totalAmount) - Number(c.paidAmount), 0),
        totalPaid: collections.reduce((sum, c) => sum + Number(c.paidAmount), 0),
        totalOverdue: collections.filter(c => c.status === 'OVERDUE').length,
    };

    return (
        <Sidebar>
            <div className="max-w-6xl mx-auto relative p-4 lg:p-6">
                <Breadcrumb items={[{ label: 'ใบวางบิลรวม' }]} className="mb-4" />

                {/* Background orbs */}
                <div className="fixed top-20 right-20 w-[400px] h-[400px] rounded-full opacity-20 blur-3xl pointer-events-none"
                    style={{ background: 'radial-gradient(circle, rgba(16, 185, 129, 0.3) 0%, transparent 70%)' }} />

                {/* Header */}
                <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500">
                            <Receipt className="text-white" size={28} />
                        </div>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-white via-emerald-200 to-white bg-clip-text text-transparent">
                                ใบวางบิลรวม
                            </h1>
                            <p className="text-gray-400 flex items-center gap-2">
                                <Sparkles size={14} className="text-emerald-400" />
                                รวมยอดบิลจากหลายสถานี & เทียบสลิปชำระเงิน
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="btn btn-success flex items-center gap-2"
                    >
                        <Plus size={18} />
                        สร้างใบวางบิลรวม
                    </button>
                </div>

                {/* Summary Cards */}
                <div className={`grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`} style={{ transitionDelay: '100ms' }}>
                    <div className="backdrop-blur-xl rounded-2xl border border-white/10 p-5 group hover:border-red-500/30 transition-all duration-300"
                        style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)' }}>
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-xl bg-gradient-to-br from-red-500 to-rose-500 group-hover:scale-110 transition-transform duration-300">
                                <Clock className="text-white" size={24} />
                            </div>
                            <div>
                                <p className="text-sm text-gray-400">ยอดค้างชำระ</p>
                                <p className="text-2xl font-bold bg-gradient-to-r from-red-400 to-rose-400 bg-clip-text text-transparent">{formatCurrency(summaryStats.totalPending)}</p>
                            </div>
                        </div>
                    </div>
                    <div className="backdrop-blur-xl rounded-2xl border border-white/10 p-5 group hover:border-green-500/30 transition-all duration-300"
                        style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)' }}>
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 group-hover:scale-110 transition-transform duration-300">
                                <CheckCircle className="text-white" size={24} />
                            </div>
                            <div>
                                <p className="text-sm text-gray-400">ยอดชำระแล้ว</p>
                                <p className="text-2xl font-bold bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">{formatCurrency(summaryStats.totalPaid)}</p>
                            </div>
                        </div>
                    </div>
                    <div className="backdrop-blur-xl rounded-2xl border border-white/10 p-5 group hover:border-orange-500/30 transition-all duration-300"
                        style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)' }}>
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 group-hover:scale-110 transition-transform duration-300">
                                <AlertTriangle className="text-white" size={24} />
                            </div>
                            <div>
                                <p className="text-sm text-gray-400">เกินกำหนด</p>
                                <p className="text-2xl font-bold bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">{summaryStats.totalOverdue} ใบ</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Search & Filter */}
                <div className="glass-card p-4 mb-6">
                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10" size={20} />
                            <input
                                type="text"
                                placeholder="🔍 ค้นหาชื่อลูกค้า / เลขใบวางบิลรวม..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full bg-white/10 border border-gray-600 rounded-xl py-3 pl-10 pr-4 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                            />
                        </div>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="input-glow"
                        >
                            <option value="all">ทุกสถานะ</option>
                            <option value="PENDING">รอชำระ</option>
                            <option value="PARTIAL">ชำระบางส่วน</option>
                            <option value="PAID">ชำระแล้ว</option>
                            <option value="OVERDUE">เกินกำหนด</option>
                        </select>
                    </div>
                </div>

                {/* Table */}
                <div className="glass-card overflow-hidden">
                    {loading ? (
                        <LoadingState />
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="table-glass">
                                <thead>
                                    <tr>
                                        <th>เลขที่</th>
                                        <th>ลูกค้า</th>
                                        <th>ช่วงเวลา</th>
                                        <th>ยอดเงิน</th>
                                        <th>ชำระแล้ว</th>
                                        <th>คงเหลือ</th>
                                        <th>สลิป</th>
                                        <th>สถานะ</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {collections.length === 0 ? (
                                        <tr>
                                            <td colSpan={9} className="text-center py-8 text-gray-400">
                                                ไม่มีใบวางบิลรวม
                                            </td>
                                        </tr>
                                    ) : (
                                        collections.map(c => {
                                            const remaining = Number(c.totalAmount) - Number(c.paidAmount);
                                            return (
                                                <tr
                                                    key={c.id}
                                                    className="cursor-pointer hover:bg-purple-500/10"
                                                    onClick={() => window.location.href = `/billing-collections/${c.id}`}
                                                >
                                                    <td className="font-mono text-emerald-400">{c.collectionNo}</td>
                                                    <td>
                                                        <span className="font-medium text-white">{c.ownerName}</span>
                                                        {c.owner?.code && (
                                                            <span className="ml-2 badge badge-purple text-xs">{c.owner.code}</span>
                                                        )}
                                                    </td>
                                                    <td className="text-sm">
                                                        <div className="flex items-center gap-1 text-gray-300">
                                                            <Calendar size={14} className="text-gray-500" />
                                                            {c.periodLabel || `${new Date(c.periodStart).toLocaleDateString('th-TH')} - ${new Date(c.periodEnd).toLocaleDateString('th-TH')}`}
                                                        </div>
                                                    </td>
                                                    <td className="font-mono">{formatCurrency(c.totalAmount)}</td>
                                                    <td className="font-mono text-green-400">{formatCurrency(c.paidAmount)}</td>
                                                    <td className="font-mono text-red-400">{formatCurrency(remaining)}</td>
                                                    <td>
                                                        <span className="text-sm text-gray-400">
                                                            {c._count?.paymentSlips || 0} 📷
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <span className={`badge ${getStatusBadge(c.status)}`}>
                                                            {getStatusLabel(c.status)}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <ChevronRight size={16} className="text-gray-500" />
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                            {total > 0 && (
                                <div className="p-4 text-center text-sm text-gray-400">
                                    แสดง {collections.length} จาก {total} รายการ
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Create Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-start justify-center z-50 p-4 overflow-y-auto">
                    <div className="relative w-full max-w-2xl my-8 animate-fade-in">
                        <div className="absolute -inset-1 bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-600 rounded-3xl blur-xl opacity-30" />
                        <div className="relative backdrop-blur-2xl rounded-2xl border border-white/10 p-6"
                            style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)' }}>
                            {/* Modal Header */}
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500">
                                    <Receipt className="text-white" size={20} />
                                </div>
                                <h3 className="text-lg font-bold text-white">สร้างใบวางบิลรวม</h3>
                            </div>

                            {/* Owner Selection */}
                            <div className="mb-4">
                                <label className="block text-sm text-gray-400 mb-2">เลือกลูกค้า *</label>
                                <select
                                    value={selectedOwnerId}
                                    onChange={(e) => setSelectedOwnerId(e.target.value)}
                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-emerald-500/50 transition-all duration-300"
                                >
                                    <option value="">-- เลือกลูกค้า --</option>
                                    {owners.map(o => (
                                        <option key={o.id} value={o.id}>{o.code ? `[${o.code}] ` : ''}{o.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Period */}
                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div>
                                    <label className="block text-sm text-gray-400 mb-2">ตั้งแต่วันที่ *</label>
                                    <input
                                        type="date"
                                        value={periodStart}
                                        onChange={(e) => setPeriodStart(e.target.value)}
                                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-emerald-500/50 transition-all duration-300"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-2">ถึงวันที่ *</label>
                                    <input
                                        type="date"
                                        value={periodEnd}
                                        onChange={(e) => setPeriodEnd(e.target.value)}
                                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-emerald-500/50 transition-all duration-300"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div>
                                    <label className="block text-sm text-gray-400 mb-2">ป้ายกำกับ (เช่น &quot;1-15 มี.ค.&quot;)</label>
                                    <input
                                        type="text"
                                        value={periodLabel}
                                        onChange={(e) => setPeriodLabel(e.target.value)}
                                        placeholder="1-15 มี.ค. 2569"
                                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50 transition-all duration-300"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-2">วันครบกำหนดชำระ</label>
                                    <input
                                        type="date"
                                        value={dueDate}
                                        onChange={(e) => setDueDate(e.target.value)}
                                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-emerald-500/50 transition-all duration-300"
                                    />
                                </div>
                            </div>

                            {/* Items */}
                            <div className="mb-4">
                                <div className="flex items-center justify-between mb-3">
                                    <label className="text-sm text-gray-400">📋 รายการบิล *</label>
                                    <button onClick={addItem} className="text-sm text-emerald-400 hover:text-emerald-300 flex items-center gap-1">
                                        <Plus size={14} /> เพิ่มรายการ
                                    </button>
                                </div>
                                <div className="space-y-3">
                                    {items.map((item, idx) => (
                                        <div key={idx} className="bg-white/5 rounded-xl p-3 border border-white/5 space-y-2">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-xs text-gray-500">#{idx + 1}</span>
                                                {items.length > 1 && (
                                                    <button onClick={() => removeItem(idx)} className="text-xs text-red-400 hover:text-red-300 ml-auto">ลบ</button>
                                                )}
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <input
                                                    type="text"
                                                    placeholder="รายละเอียด *"
                                                    value={item.sourceDescription}
                                                    onChange={(e) => updateItem(idx, 'sourceDescription', e.target.value)}
                                                    className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:border-emerald-500/50"
                                                />
                                                <input
                                                    type="text"
                                                    placeholder="สถานี"
                                                    value={item.sourceStation}
                                                    onChange={(e) => updateItem(idx, 'sourceStation', e.target.value)}
                                                    className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:border-emerald-500/50"
                                                />
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <input
                                                    type="text"
                                                    placeholder="เลขที่บิล"
                                                    value={item.sourceInvoiceNo}
                                                    onChange={(e) => updateItem(idx, 'sourceInvoiceNo', e.target.value)}
                                                    className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:border-emerald-500/50"
                                                />
                                                <input
                                                    type="number"
                                                    placeholder="ยอดเงิน *"
                                                    value={item.amount}
                                                    onChange={(e) => updateItem(idx, 'amount', e.target.value)}
                                                    className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 text-sm font-mono focus:outline-none focus:border-emerald-500/50"
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Total */}
                            <div className="bg-gradient-to-r from-emerald-900/30 to-teal-900/30 rounded-xl p-4 mb-4 border border-emerald-500/20">
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-400">ยอดรวม</span>
                                    <span className="text-2xl font-bold text-emerald-400 font-mono">{formatCurrency(itemsTotal)}</span>
                                </div>
                            </div>

                            {/* Notes */}
                            <div className="mb-6">
                                <label className="block text-sm text-gray-400 mb-2">หมายเหตุ</label>
                                <textarea
                                    value={createNotes}
                                    onChange={(e) => setCreateNotes(e.target.value)}
                                    rows={2}
                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50 transition-all duration-300"
                                    placeholder="หมายเหตุเพิ่มเติม..."
                                />
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3">
                                <button
                                    onClick={handleCreate}
                                    disabled={creating}
                                    className="flex-1 relative group px-6 py-3 rounded-xl font-semibold text-white overflow-hidden disabled:opacity-50"
                                >
                                    <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-600" />
                                    <span className="relative flex items-center justify-center gap-2">
                                        <Plus size={18} />
                                        {creating ? 'กำลังสร้าง...' : 'สร้างใบวางบิลรวม'}
                                    </span>
                                </button>
                                <button
                                    onClick={() => { setShowCreateModal(false); resetCreateForm(); }}
                                    className="px-6 py-3 rounded-xl font-medium text-gray-300 bg-white/5 hover:bg-white/10 transition-colors"
                                >
                                    ยกเลิก
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </Sidebar>
    );
}
