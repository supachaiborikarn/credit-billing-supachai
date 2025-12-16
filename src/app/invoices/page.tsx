'use client';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import { LoadingState } from '@/components/Spinner';
import { formatCurrency, formatDate } from '@/utils/format';
import { Invoice, OwnerWithBalance } from '@/types';
import { FileText, Plus, Search, CheckCircle, Clock, Users, Sparkles } from 'lucide-react';
import { OWNER_GROUPS } from '@/constants';



export default function InvoicesPage() {
    const [loading, setLoading] = useState(true);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [pendingOwners, setPendingOwners] = useState<OwnerWithBalance[]>([]);
    const [activeTab, setActiveTab] = useState<'pending' | 'invoices'>('pending');
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [mounted, setMounted] = useState(false);

    // Group filter
    const [groupFilter, setGroupFilter] = useState('all');

    // Multi-select mode
    const [selectedOwnerIds, setSelectedOwnerIds] = useState<string[]>([]);
    const [selectMode, setSelectMode] = useState(false);

    // Date range modal state
    const [showDateModal, setShowDateModal] = useState(false);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [combineOwners, setCombineOwners] = useState(false);

    useEffect(() => {
        setMounted(true);
        fetchData();
    }, [groupFilter]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch invoices
            const invoicesRes = await fetch('/api/invoices');
            if (invoicesRes.ok) {
                const data = await invoicesRes.json();
                setInvoices(data);
            }

            // Fetch pending credit (owners with unpaid transactions)
            const pendingRes = await fetch(`/api/invoices/pending?group=${groupFilter}`);
            if (pendingRes.ok) {
                const data = await pendingRes.json();
                setPendingOwners(data);
            }
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    const toggleOwnerSelection = (ownerId: string) => {
        setSelectedOwnerIds(prev =>
            prev.includes(ownerId)
                ? prev.filter(id => id !== ownerId)
                : [...prev, ownerId]
        );
    };

    const selectAll = () => {
        const filtered = filteredPendingOwners.map(o => o.id);
        setSelectedOwnerIds(filtered);
    };

    const clearSelection = () => {
        setSelectedOwnerIds([]);
    };

    const openDateModal = (singleOwnerId?: string) => {
        if (singleOwnerId) {
            setSelectedOwnerIds([singleOwnerId]);
        }
        // Default to last 30 days
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 30);
        setStartDate(start.toISOString().split('T')[0]);
        setEndDate(end.toISOString().split('T')[0]);
        setCombineOwners(false);
        setShowDateModal(true);
    };

    const createInvoice = async () => {
        if (selectedOwnerIds.length === 0) return;
        try {
            const res = await fetch('/api/invoices', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ownerIds: selectedOwnerIds,
                    startDate: startDate || undefined,
                    endDate: endDate || undefined,
                    combineOwners: combineOwners && selectedOwnerIds.length > 1,
                }),
            });
            if (res.ok) {
                const result = await res.json();
                if (result.count) {
                    alert(`สร้างใบวางบิลเรียบร้อย ${result.count} ใบ`);
                } else {
                    alert(`สร้างใบวางบิลเรียบร้อย: ${result.invoiceNumber}`);
                }
                setShowDateModal(false);
                setSelectedOwnerIds([]);
                setSelectMode(false);
                fetchData();
                setActiveTab('invoices');
            } else {
                const err = await res.json();
                alert(err.error || 'เกิดข้อผิดพลาด');
            }
        } catch (error) {
            console.error('Error creating invoice:', error);
        }
    };



    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'PAID': return 'badge-green';
            case 'PARTIAL': return 'badge-orange';
            default: return 'badge-red';
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'PAID': return 'ชำระแล้ว';
            case 'PARTIAL': return 'ชำระบางส่วน';
            default: return 'รอชำระ';
        }
    };

    const filteredInvoices = invoices.filter(inv => {
        const matchesSearch = inv.owner.name.toLowerCase().includes(search.toLowerCase()) ||
            inv.invoiceNumber.includes(search) ||
            inv.owner.code?.includes(search);
        const matchesStatus = statusFilter === 'all' || inv.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const filteredPendingOwners = pendingOwners.filter(o =>
        o.name.toLowerCase().includes(search.toLowerCase()) ||
        o.code?.toLowerCase().includes(search.toLowerCase())
    );

    const totalPending = pendingOwners.reduce((sum, o) => sum + o.totalCredit, 0);
    const totalInvoiced = invoices.reduce((sum, i) => sum + i.totalAmount, 0);
    const totalPaid = invoices.reduce((sum, i) => sum + i.paidAmount, 0);

    const selectedTotal = filteredPendingOwners
        .filter(o => selectedOwnerIds.includes(o.id))
        .reduce((sum, o) => sum + o.totalCredit, 0);

    return (
        <Sidebar>
            <div className="max-w-6xl mx-auto relative">
                {/* Background orbs */}
                <div className="fixed top-20 right-20 w-[400px] h-[400px] rounded-full opacity-20 blur-3xl pointer-events-none"
                    style={{ background: 'radial-gradient(circle, rgba(236, 72, 153, 0.3) 0%, transparent 70%)' }} />

                {/* Header */}
                <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-500">
                            <FileText className="text-white" size={28} />
                        </div>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-white via-pink-200 to-white bg-clip-text text-transparent">
                                ใบวางบิล
                            </h1>
                            <p className="text-gray-400 flex items-center gap-2">
                                <Sparkles size={14} className="text-pink-400" />
                                จัดการใบวางบิลและติดตามการชำระเงิน
                            </p>
                        </div>
                    </div>
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
                                <p className="text-sm text-gray-400">ยอดเงินเชื่อค้าง</p>
                                <p className="text-2xl font-bold bg-gradient-to-r from-red-400 to-rose-400 bg-clip-text text-transparent">{formatCurrency(totalPending)}</p>
                            </div>
                        </div>
                    </div>
                    <div className="backdrop-blur-xl rounded-2xl border border-white/10 p-5 group hover:border-blue-500/30 transition-all duration-300"
                        style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)' }}>
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 group-hover:scale-110 transition-transform duration-300">
                                <FileText className="text-white" size={24} />
                            </div>
                            <div>
                                <p className="text-sm text-gray-400">ยอดวางบิลทั้งหมด</p>
                                <p className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">{formatCurrency(totalInvoiced)}</p>
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
                                <p className="text-2xl font-bold bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">{formatCurrency(totalPaid)}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className={`flex gap-2 mb-6 transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`} style={{ transitionDelay: '200ms' }}>
                    <button
                        onClick={() => setActiveTab('pending')}
                        className={`px-5 py-2.5 rounded-xl font-medium transition-all duration-300 ${activeTab === 'pending'
                            ? 'bg-gradient-to-r from-pink-600 to-rose-600 text-white shadow-lg shadow-pink-500/30'
                            : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                            }`}
                    >
                        รอวางบิล ({pendingOwners.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('invoices')}
                        className={`px-5 py-2.5 rounded-xl font-medium transition-all duration-300 ${activeTab === 'invoices'
                            ? 'bg-gradient-to-r from-pink-600 to-rose-600 text-white shadow-lg shadow-pink-500/30'
                            : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                            }`}
                    >
                        ใบวางบิล ({invoices.length})
                    </button>
                </div>

                {/* Search & Filter */}
                <div className="glass-card p-4 mb-6">
                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                            <input
                                type="text"
                                placeholder="ค้นหาชื่อ, เลขบิล, รหัส..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="input-glow pl-10"
                            />
                        </div>
                        {activeTab === 'pending' && (
                            <select
                                value={groupFilter}
                                onChange={(e) => setGroupFilter(e.target.value)}
                                className="input-glow w-full sm:w-48"
                            >
                                <option value="all">ทุกกลุ่ม</option>
                                {OWNER_GROUPS.map(g => (
                                    <option key={g.value} value={g.value}>{g.label}</option>
                                ))}
                            </select>
                        )}
                        {activeTab === 'invoices' && (
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="input-glow w-full sm:w-48"
                            >
                                <option value="all">ทุกสถานะ</option>
                                <option value="PENDING">รอชำระ</option>
                                <option value="PARTIAL">ชำระบางส่วน</option>
                                <option value="PAID">ชำระแล้ว</option>
                            </select>
                        )}
                    </div>
                </div>

                {/* Multi-Select Controls (for pending tab) */}
                {activeTab === 'pending' && (
                    <div className="glass-card p-4 mb-4">
                        <div className="flex flex-wrap items-center gap-4">
                            <button
                                onClick={() => setSelectMode(!selectMode)}
                                className={`btn ${selectMode ? 'btn-primary' : 'btn-secondary'}`}
                            >
                                <Users size={18} />
                                {selectMode ? 'ยกเลิกเลือกหลายราย' : 'เลือกหลายราย'}
                            </button>

                            {selectMode && (
                                <>
                                    <button onClick={selectAll} className="btn btn-secondary text-sm">
                                        เลือกทั้งหมด
                                    </button>
                                    <button onClick={clearSelection} className="btn btn-secondary text-sm">
                                        ล้างการเลือก
                                    </button>
                                    {selectedOwnerIds.length > 0 && (
                                        <div className="flex items-center gap-3 ml-auto">
                                            <span className="text-green-400">
                                                เลือก {selectedOwnerIds.length} ราย | ยอดรวม: {formatCurrency(selectedTotal)} บาท
                                            </span>
                                            <button
                                                onClick={() => openDateModal()}
                                                className="btn btn-success"
                                            >
                                                <Plus size={18} />
                                                สร้างใบวางบิล
                                            </button>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                )}

                {/* Content */}
                <div className="glass-card overflow-hidden">
                    {loading ? (
                        <LoadingState />
                    ) : activeTab === 'pending' ? (
                        /* Pending Credit Table */
                        <div className="overflow-x-auto">
                            <table className="table-glass">
                                <thead>
                                    <tr>
                                        {selectMode && <th className="w-12">เลือก</th>}
                                        <th>รหัส</th>
                                        <th>ชื่อลูกค้า</th>
                                        <th>จำนวนรายการ</th>
                                        <th>ยอดเงินค้าง</th>
                                        {!selectMode && <th>ดำเนินการ</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredPendingOwners.length === 0 ? (
                                        <tr>
                                            <td colSpan={selectMode ? 5 : 6} className="text-center py-8 text-gray-400">
                                                ไม่มียอดค้างชำระ
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredPendingOwners.map(owner => (
                                            <tr
                                                key={owner.id}
                                                className={selectMode && selectedOwnerIds.includes(owner.id) ? 'bg-purple-500/20' : ''}
                                                onClick={() => selectMode && toggleOwnerSelection(owner.id)}
                                                style={{ cursor: selectMode ? 'pointer' : 'default' }}
                                            >
                                                {selectMode && (
                                                    <td onClick={(e) => e.stopPropagation()}>
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedOwnerIds.includes(owner.id)}
                                                            onChange={() => toggleOwnerSelection(owner.id)}
                                                            className="w-5 h-5 rounded cursor-pointer accent-pink-500"
                                                        />
                                                    </td>
                                                )}
                                                <td className="font-mono text-purple-400">{owner.code || '-'}</td>
                                                <td className="font-medium text-white">{owner.name}</td>
                                                <td>{owner.transactionCount} รายการ</td>
                                                <td className="font-mono text-red-400">{formatCurrency(owner.totalCredit)}</td>
                                                {!selectMode && (
                                                    <td>
                                                        <button
                                                            onClick={() => openDateModal(owner.id)}
                                                            className="btn btn-primary text-sm py-1"
                                                        >
                                                            <Plus size={14} />
                                                            สร้างใบวางบิล
                                                        </button>
                                                    </td>
                                                )}
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        /* Invoices Table */
                        <div className="overflow-x-auto">
                            <table className="table-glass">
                                <thead>
                                    <tr>
                                        <th>เลขที่บิล</th>
                                        <th>ลูกค้า</th>
                                        <th>จำนวนรายการ</th>
                                        <th>ยอดเงิน</th>
                                        <th>ชำระแล้ว</th>
                                        <th>สถานะ</th>
                                        <th>วันที่</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredInvoices.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="text-center py-8 text-gray-400">
                                                ไม่มีใบวางบิล
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredInvoices.map(inv => (
                                            <tr
                                                key={inv.id}
                                                className="cursor-pointer hover:bg-purple-500/10"
                                                onClick={() => window.location.href = `/invoices/${inv.id}`}
                                            >
                                                <td className="font-mono text-blue-400">{inv.invoiceNumber}</td>
                                                <td>
                                                    <span className="font-medium text-white">{inv.owner.name}</span>
                                                    {inv.owner.code && (
                                                        <span className="ml-2 badge badge-purple text-xs">{inv.owner.code}</span>
                                                    )}
                                                </td>
                                                <td>{inv._count?.transactions || 0} รายการ</td>
                                                <td className="font-mono">{formatCurrency(inv.totalAmount)}</td>
                                                <td className="font-mono text-green-400">{formatCurrency(inv.paidAmount)}</td>
                                                <td>
                                                    <span className={`badge ${getStatusBadge(inv.status)}`}>
                                                        {getStatusLabel(inv.status)}
                                                    </span>
                                                </td>
                                                <td className="text-sm text-gray-400">
                                                    {new Date(inv.createdAt).toLocaleDateString('th-TH')}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Date Range Modal */}
            {showDateModal && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="relative w-full max-w-md animate-fade-in">
                        <div className="absolute -inset-1 bg-gradient-to-r from-pink-600 via-rose-500 to-pink-600 rounded-3xl blur-xl opacity-30" />
                        <div className="relative backdrop-blur-2xl rounded-2xl border border-white/10 p-6"
                            style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)' }}>
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-2 rounded-xl bg-gradient-to-br from-pink-500 to-rose-500">
                                    <FileText className="text-white" size={20} />
                                </div>
                                <h3 className="text-lg font-bold text-white">สร้างใบวางบิล</h3>
                            </div>

                            {/* Selected owners summary */}
                            <div className="bg-gradient-to-r from-purple-900/30 to-pink-900/30 rounded-xl p-4 mb-4 border border-purple-500/20">
                                <p className="text-sm text-gray-400">เจ้าของที่เลือก: <span className="text-white font-bold">{selectedOwnerIds.length} ราย</span></p>
                                <p className="text-sm text-gray-400">ยอดรวม: <span className="text-green-400 font-bold">{formatCurrency(selectedTotal)} บาท</span></p>
                            </div>

                            {/* Date range */}
                            <p className="text-sm text-gray-400 mb-4">
                                📅 เลือกช่วงวันที่สำหรับรายการเติมน้ำมันที่จะรวมในใบวางบิล
                            </p>

                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div>
                                    <label className="block text-sm text-gray-400 mb-2">ตั้งแต่วันที่</label>
                                    <input
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-pink-500/50 transition-all duration-300"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-2">ถึงวันที่</label>
                                    <input
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-pink-500/50 transition-all duration-300"
                                    />
                                </div>
                            </div>

                            {/* Combine owners option */}
                            {selectedOwnerIds.length > 1 && (
                                <div className="mb-4 p-4 bg-gradient-to-r from-blue-900/30 to-cyan-900/30 rounded-xl border border-blue-500/20">
                                    <label className="flex items-center gap-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={combineOwners}
                                            onChange={(e) => setCombineOwners(e.target.checked)}
                                            className="w-5 h-5 rounded"
                                        />
                                        <div>
                                            <p className="text-white font-medium">รวมเจ้าของเป็นใบเดียว</p>
                                            <p className="text-xs text-gray-400">สร้างใบวางบิล 1 ใบ รวมทุกเจ้าของที่เลือก</p>
                                        </div>
                                    </label>
                                </div>
                            )}

                            <div className="flex gap-3">
                                <button
                                    onClick={createInvoice}
                                    className="flex-1 relative group px-6 py-3 rounded-xl font-semibold text-white overflow-hidden"
                                >
                                    <div className="absolute inset-0 bg-gradient-to-r from-green-600 via-emerald-500 to-green-600" />
                                    <span className="relative flex items-center justify-center gap-2">
                                        <Plus size={18} />
                                        {combineOwners && selectedOwnerIds.length > 1
                                            ? 'สร้าง 1 ใบ (รวม)'
                                            : `สร้าง ${selectedOwnerIds.length} ใบ`}
                                    </span>
                                </button>
                                <button
                                    onClick={() => {
                                        setShowDateModal(false);
                                    }}
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
