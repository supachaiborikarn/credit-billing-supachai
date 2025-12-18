'use client';

import { useState, useEffect, use } from 'react';
import Sidebar from '@/components/Sidebar';
import BillEntryForm from '@/components/BillEntryForm';
import { Calendar, Fuel, Trash2, FileText, Printer, X, Sparkles, Edit, Save } from 'lucide-react';
import { STATIONS, PAYMENT_TYPES, FUEL_TYPES } from '@/constants';

interface Transaction {
    id: string;
    date: string;
    licensePlate: string;
    ownerName: string;
    paymentType: string;
    fuelType: string;
    liters: number;
    pricePerLiter: number;
    amount: number;
    bookNo: string;
    billNo: string;
}

export default function SimpleStationPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const stationIndex = parseInt(id) - 1;
    const station = STATIONS[stationIndex];

    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [showForm, setShowForm] = useState(false);
    const [activeFilter, setActiveFilter] = useState('all');
    const [showDailySummary, setShowDailySummary] = useState(false);
    const [mounted, setMounted] = useState(false);

    // Edit modal state
    const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
    const [editLicensePlate, setEditLicensePlate] = useState('');
    const [editOwnerName, setEditOwnerName] = useState('');
    const [editLiters, setEditLiters] = useState('');
    const [editPricePerLiter, setEditPricePerLiter] = useState('');
    const [editPaymentType, setEditPaymentType] = useState('');
    const [editBookNo, setEditBookNo] = useState('');
    const [editBillNo, setEditBillNo] = useState('');
    const [editSaving, setEditSaving] = useState(false);

    // Print state
    const [printingTransaction, setPrintingTransaction] = useState<Transaction | null>(null);

    useEffect(() => {
        setMounted(true);
        if (station) {
            fetchTransactions();
        }
    }, [selectedDate, station]);

    const fetchTransactions = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/station/${id}/transactions?date=${selectedDate}`);
            if (res.ok) {
                const data = await res.json();
                setTransactions(data || []);
            }
        } catch (error) {
            console.error('Error fetching transactions:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteTransaction = async (txnId: string) => {
        if (!confirm('ยืนยันการลบรายการนี้?')) return;

        try {
            const res = await fetch(`/api/station/${id}/transactions/${txnId}`, {
                method: 'DELETE',
            });
            if (res.ok) {
                fetchTransactions();
            }
        } catch (error) {
            console.error('Error deleting transaction:', error);
        }
    };

    // Open edit modal
    const openEditModal = (txn: Transaction) => {
        setEditingTransaction(txn);
        setEditLicensePlate(txn.licensePlate || '');
        setEditOwnerName(txn.ownerName || '');
        setEditLiters(String(txn.liters));
        setEditPricePerLiter(String(txn.pricePerLiter));
        setEditPaymentType(txn.paymentType);
        setEditBookNo(txn.bookNo || '');
        setEditBillNo(txn.billNo || '');
    };

    // Save edit
    const handleSaveEdit = async () => {
        if (!editingTransaction) return;
        setEditSaving(true);

        try {
            const res = await fetch(`/api/station/${id}/transactions/${editingTransaction.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    licensePlate: editLicensePlate,
                    ownerName: editOwnerName,
                    liters: parseFloat(editLiters),
                    pricePerLiter: parseFloat(editPricePerLiter),
                    amount: parseFloat(editLiters) * parseFloat(editPricePerLiter),
                    paymentType: editPaymentType,
                    billBookNo: editBookNo,
                    billNo: editBillNo,
                }),
            });

            if (res.ok) {
                setEditingTransaction(null);
                fetchTransactions();
            } else {
                alert('บันทึกไม่สำเร็จ');
            }
        } catch (error) {
            console.error('Save error:', error);
            alert('เกิดข้อผิดพลาด');
        } finally {
            setEditSaving(false);
        }
    };

    const filteredTransactions = transactions.filter(t => {
        if (activeFilter === 'all') return true;
        return t.paymentType === activeFilter;
    });

    const totalAmount = filteredTransactions.reduce((sum, t) => sum + Number(t.amount), 0);
    const totalLiters = filteredTransactions.reduce((sum, t) => sum + Number(t.liters), 0);

    const formatCurrency = (num: number) => new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2 }).format(num);

    const getPaymentTypeLabel = (value: string) => {
        const pt = PAYMENT_TYPES.find(p => p.value === value);
        return pt ? pt.label : value;
    };

    const getFuelTypeLabel = (value: string) => {
        // Normalize fuel type names for display consistency
        const normalized = normalizeFuelType(value);
        const ft = FUEL_TYPES.find(f => f.value === normalized);
        return ft ? ft.label : value;
    };

    const getFuelTypeColor = (value: string) => {
        const normalized = normalizeFuelType(value);
        const ft = FUEL_TYPES.find(f => f.value === normalized);
        return ft ? ft.color : 'bg-amber-500'; // Default to diesel color
    };

    // Map Thai fuel names to FUEL_TYPE codes
    const normalizeFuelType = (value: string): string => {
        const mapping: Record<string, string> = {
            'ดีเซล': 'DIESEL',
            'น้ำมันดีเซล': 'DIESEL',
            'เบนซิน91': 'GASOHOL_91',
            'เบนซิน95': 'GASOHOL_95',
            'แก๊สโซฮอล์ 91': 'GASOHOL_91',
            'แก๊สโซฮอล์ 95': 'GASOHOL_95',
            'แก๊สโซฮอล์ E20': 'GASOHOL_E20',
            'พาวเวอร์ดีเซล': 'POWER_DIESEL',
            'แก๊ส LPG': 'LPG',
            'LPG': 'LPG',
        };
        return mapping[value] || value;
    };

    if (!station) {
        return (
            <Sidebar>
                <div className="text-center py-20">
                    <p className="text-gray-400">ไม่พบสถานี</p>
                </div>
            </Sidebar>
        );
    }

    return (
        <Sidebar>
            <div className="max-w-5xl mx-auto relative">
                {/* Background orbs */}
                <div className="fixed top-20 right-20 w-[400px] h-[400px] rounded-full opacity-20 blur-3xl pointer-events-none"
                    style={{ background: 'radial-gradient(circle, rgba(249, 115, 22, 0.3) 0%, transparent 70%)' }} />

                {/* Header */}
                <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <div className="absolute inset-0 bg-gradient-to-br from-orange-500 to-yellow-500 rounded-2xl blur-lg opacity-50" />
                            <div className="relative p-3 rounded-2xl bg-gradient-to-br from-orange-500 to-yellow-500">
                                <Fuel className="text-white" size={28} />
                            </div>
                        </div>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-white via-orange-200 to-white bg-clip-text text-transparent">
                                {station.name}
                            </h1>
                            <p className="text-gray-400 flex items-center gap-2">
                                <Sparkles size={14} className="text-orange-400" />
                                ระบบลงบิล (หลายประเภทน้ำมัน)
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setShowDailySummary(true)}
                            className="relative group px-5 py-2.5 rounded-xl font-semibold text-white overflow-hidden"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-orange-600 to-yellow-600" />
                            <div className="absolute inset-0 bg-gradient-to-r from-orange-600 to-yellow-600 blur-xl opacity-50 group-hover:opacity-70 transition-opacity" />
                            <span className="relative flex items-center gap-2">
                                <FileText size={18} />
                                สรุปงานประจำวัน
                            </span>
                        </button>
                        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10">
                            <Calendar size={18} className="text-orange-400" />
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="bg-transparent text-white focus:outline-none w-[150px]"
                            />
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="spinner" />
                    </div>
                ) : (
                    <>
                        {/* Add Bill Button or Form */}
                        <div className="mb-6">
                            {showForm ? (
                                <BillEntryForm
                                    stationId={id}
                                    selectedDate={selectedDate}
                                    onSave={() => {
                                        setShowForm(false);
                                        fetchTransactions();
                                    }}
                                    onCancel={() => setShowForm(false)}
                                />
                            ) : (
                                <button
                                    onClick={() => setShowForm(true)}
                                    className="w-full glass-card p-8 text-center hover:bg-purple-500/10 transition-colors border-2 border-dashed border-purple-500/30 hover:border-purple-500/50"
                                >
                                    <span className="text-4xl">📝</span>
                                    <p className="text-xl font-bold text-white mt-3">ลงบิลใหม่</p>
                                    <p className="text-gray-400 mt-1">คลิกเพื่อบันทึกรายการเติมน้ำมัน</p>
                                </button>
                            )}
                        </div>

                        {/* Summary Cards */}
                        <div className={`grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`} style={{ transitionDelay: '200ms' }}>
                            <div className="backdrop-blur-xl rounded-2xl border border-white/10 p-4 text-center group hover:border-white/20 transition-all duration-300"
                                style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)' }}>
                                <p className="text-sm text-gray-400">จำนวนบิล</p>
                                <p className="text-2xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">{transactions.length}</p>
                            </div>
                            <div className="backdrop-blur-xl rounded-2xl border border-white/10 p-4 text-center group hover:border-blue-500/30 transition-all duration-300"
                                style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)' }}>
                                <p className="text-sm text-gray-400">รวมลิตร</p>
                                <p className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">{formatCurrency(totalLiters)}</p>
                            </div>
                            <div className="backdrop-blur-xl rounded-2xl border border-white/10 p-4 text-center group hover:border-green-500/30 transition-all duration-300"
                                style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)' }}>
                                <p className="text-sm text-gray-400">รวมเงินสด</p>
                                <p className="text-2xl font-bold bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
                                    {formatCurrency(transactions.filter(t => t.paymentType === 'CASH').reduce((s, t) => s + Number(t.amount), 0))}
                                </p>
                            </div>
                            <div className="backdrop-blur-xl rounded-2xl border border-white/10 p-4 text-center group hover:border-purple-500/30 transition-all duration-300"
                                style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)' }}>
                                <p className="text-sm text-gray-400">รวมเงินเชื่อ</p>
                                <p className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                                    {formatCurrency(transactions.filter(t => t.paymentType === 'CREDIT').reduce((s, t) => s + Number(t.amount), 0))}
                                </p>
                            </div>
                        </div>

                        {/* Filter Buttons */}
                        <div className={`backdrop-blur-xl rounded-2xl border border-white/10 p-4 mb-6 transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
                            style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)', transitionDelay: '300ms' }}>
                            <div className="flex flex-wrap gap-2">
                                <button
                                    onClick={() => setActiveFilter('all')}
                                    className={`px-4 py-2 rounded-xl font-medium transition-all duration-300 ${activeFilter === 'all'
                                        ? 'bg-gradient-to-r from-orange-600 to-yellow-600 text-white shadow-lg shadow-orange-500/30'
                                        : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'}`}
                                >
                                    ทั้งหมด ({transactions.length})
                                </button>
                                {PAYMENT_TYPES.slice(0, 3).map(pt => {
                                    const count = transactions.filter(t => t.paymentType === pt.value).length;
                                    return (
                                        <button
                                            key={pt.value}
                                            onClick={() => setActiveFilter(pt.value)}
                                            className={`badge ${activeFilter === pt.value ? 'badge-purple' : 'badge-gray'}`}
                                        >
                                            {pt.label} ({count})
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Transactions Table */}
                        <div className="glass-card p-4 sm:p-6">
                            <h2 className="text-lg font-bold text-white mb-4">📋 รายการวันนี้</h2>

                            {filteredTransactions.length === 0 ? (
                                <div className="text-center py-8 text-gray-400">
                                    ยังไม่มีรายการ
                                </div>
                            ) : (
                                <>
                                    {/* Mobile Card View */}
                                    <div className="sm:hidden space-y-3 pb-4">
                                        {filteredTransactions.map((txn) => (
                                            <div key={txn.id} className="bg-white/5 rounded-xl p-4 border border-white/10">
                                                <div className="flex items-start justify-between mb-3">
                                                    <div>
                                                        <div className="text-sm text-gray-400">
                                                            เล่ม {txn.bookNo || '-'} / เลขที่ {txn.billNo || '-'}
                                                        </div>
                                                        <div className="font-mono text-blue-400 font-medium">
                                                            🚗 {txn.licensePlate || '-'}
                                                        </div>
                                                        {txn.ownerName && (
                                                            <div className="text-sm text-gray-300">{txn.ownerName}</div>
                                                        )}
                                                    </div>
                                                    <span className={`badge ${txn.paymentType === 'CASH' ? 'bg-green-600' :
                                                        txn.paymentType === 'CREDIT' ? 'bg-purple-600' : 'bg-blue-600'
                                                        } text-white text-xs px-2 py-1 rounded-full`}>
                                                        {getPaymentTypeLabel(txn.paymentType)}
                                                    </span>
                                                </div>
                                                <div className="flex items-center justify-between mb-3">
                                                    <div className="flex items-center gap-3">
                                                        <span className={`badge ${getFuelTypeColor(txn.fuelType)} text-white text-xs px-2 py-1 rounded`}>
                                                            {getFuelTypeLabel(txn.fuelType)}
                                                        </span>
                                                        <span className="font-mono text-gray-300">
                                                            {formatCurrency(txn.liters)} ล.
                                                        </span>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-xl font-bold text-green-400 font-mono">
                                                            {formatCurrency(txn.amount)} ฿
                                                        </div>
                                                    </div>
                                                </div>
                                                {/* Action Buttons - Always Visible */}
                                                <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
                                                    {txn.paymentType === 'CREDIT' && (
                                                        <button
                                                            onClick={() => setPrintingTransaction(txn)}
                                                            className="flex items-center gap-1 px-3 py-2 rounded-lg bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 transition-colors text-sm"
                                                        >
                                                            <Printer size={16} />
                                                            พิมพ์
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => openEditModal(txn)}
                                                        className="flex items-center gap-1 px-3 py-2 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors text-sm"
                                                    >
                                                        <Edit size={16} />
                                                        แก้ไข
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteTransaction(txn.id)}
                                                        className="flex items-center gap-1 px-3 py-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors text-sm"
                                                    >
                                                        <Trash2 size={16} />
                                                        ลบ
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                        {/* Mobile Total */}
                                        <div className="bg-gradient-to-r from-green-900/30 to-emerald-900/30 rounded-xl p-4 border border-green-500/20">
                                            <div className="flex justify-between items-center">
                                                <span className="text-gray-300">รวมทั้งหมด</span>
                                                <div className="text-right">
                                                    <span className="font-mono text-blue-400 mr-4">{formatCurrency(totalLiters)} ล.</span>
                                                    <span className="font-mono text-2xl font-bold text-green-400">{formatCurrency(totalAmount)} ฿</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Desktop Table View */}
                                    <div className="hidden sm:block overflow-x-auto">
                                        <table className="table-glass">
                                            <thead>
                                                <tr>
                                                    <th>เล่ม/เลขที่</th>
                                                    <th>ทะเบียน</th>
                                                    <th>ลูกค้า</th>
                                                    <th>น้ำมัน</th>
                                                    <th>ลิตร</th>
                                                    <th>ราคา</th>
                                                    <th>รวม</th>
                                                    <th>ชำระ</th>
                                                    <th>จัดการ</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredTransactions.map((txn) => (
                                                    <tr key={txn.id}>
                                                        <td>
                                                            {txn.bookNo || '-'}/{txn.billNo || '-'}
                                                        </td>
                                                        <td className="font-mono text-blue-400">
                                                            {txn.licensePlate || '-'}
                                                        </td>
                                                        <td>
                                                            {txn.ownerName || '-'}
                                                        </td>
                                                        <td>
                                                            <span className={`badge ${getFuelTypeColor(txn.fuelType)} text-white text-xs`}>
                                                                {getFuelTypeLabel(txn.fuelType)}
                                                            </span>
                                                        </td>
                                                        <td className="font-mono">
                                                            {formatCurrency(txn.liters)}
                                                        </td>
                                                        <td className="font-mono text-gray-400">
                                                            {formatCurrency(txn.pricePerLiter)}
                                                        </td>
                                                        <td className="font-mono font-bold text-green-400">
                                                            {formatCurrency(txn.amount)}
                                                        </td>
                                                        <td className="text-center">
                                                            <span className={`badge ${txn.paymentType === 'CASH' ? 'bg-green-600' :
                                                                txn.paymentType === 'CREDIT' ? 'bg-purple-600' :
                                                                    'bg-blue-600'
                                                                } text-white text-xs`}>
                                                                {getPaymentTypeLabel(txn.paymentType)}
                                                            </span>
                                                        </td>
                                                        <td className="text-center">
                                                            <div className="flex items-center justify-center gap-1">
                                                                {txn.paymentType === 'CREDIT' && (
                                                                    <button
                                                                        onClick={() => setPrintingTransaction(txn)}
                                                                        className="text-purple-400 hover:text-purple-300 p-1"
                                                                        title="พิมพ์บิล"
                                                                    >
                                                                        <Printer size={16} />
                                                                    </button>
                                                                )}
                                                                <button
                                                                    onClick={() => openEditModal(txn)}
                                                                    className="text-blue-400 hover:text-blue-300 p-1"
                                                                    title="แก้ไข"
                                                                >
                                                                    <Edit size={16} />
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDeleteTransaction(txn.id)}
                                                                    className="text-red-400 hover:text-red-300 p-1"
                                                                    title="ลบ"
                                                                >
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                            <tfoot>
                                                <tr className="border-t border-white/20 font-bold">
                                                    <td colSpan={4} className="py-3 px-3 text-right text-gray-400">รวมทั้งหมด:</td>
                                                    <td className="py-3 px-3 text-right font-mono text-blue-400">
                                                        {formatCurrency(totalLiters)} ล.
                                                    </td>
                                                    <td></td>
                                                    <td className="py-3 px-3 text-right font-mono text-xl text-green-400">
                                                        {formatCurrency(totalAmount)} ฿
                                                    </td>
                                                    <td colSpan={2}></td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                </>
                            )}
                        </div>
                    </>
                )}
            </div>

            {/* Daily Summary Modal */}
            {showDailySummary && (
                <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
                    <div className="bg-[#0f0f1a] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-white/10">
                        <div className="flex items-center justify-between p-6 border-b border-white/10 sticky top-0 bg-[#0f0f1a]">
                            <div>
                                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                    <FileText className="text-purple-400" />
                                    สรุปงานประจำวัน
                                </h2>
                                <p className="text-gray-400 text-sm mt-1">
                                    {new Date(selectedDate).toLocaleDateString('th-TH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={() => window.print()} className="btn btn-secondary btn-sm">
                                    <Printer size={16} /> พิมพ์
                                </button>
                                <button onClick={() => setShowDailySummary(false)} className="p-2 rounded-lg hover:bg-white/10 text-gray-400">
                                    <X size={24} />
                                </button>
                            </div>
                        </div>
                        <div className="p-6 space-y-6">
                            <div className="bg-white/5 rounded-xl p-4">
                                <h3 className="font-bold text-green-400 mb-3">💰 สรุปรายได้</h3>
                                <div className="space-y-2">
                                    <div className="flex justify-between"><span className="text-gray-400">💵 เงินสด:</span><span className="font-mono text-green-400">{formatCurrency(transactions.filter(t => t.paymentType === 'CASH').reduce((s, t) => s + Number(t.amount), 0))} บาท</span></div>
                                    <div className="flex justify-between"><span className="text-gray-400">💳 เงินเชื่อ:</span><span className="font-mono text-orange-400">{formatCurrency(transactions.filter(t => t.paymentType === 'CREDIT').reduce((s, t) => s + Number(t.amount), 0))} บาท</span></div>
                                    <div className="flex justify-between"><span className="text-gray-400">📲 โอนเงิน:</span><span className="font-mono text-blue-400">{formatCurrency(transactions.filter(t => t.paymentType === 'TRANSFER').reduce((s, t) => s + Number(t.amount), 0))} บาท</span></div>
                                    <div className="flex justify-between border-t border-white/10 pt-2 mt-2"><span className="font-bold text-white">รวมทั้งหมด:</span><span className="font-mono font-bold text-green-400 text-lg">{formatCurrency(totalAmount)} บาท</span></div>
                                </div>
                            </div>
                            <div className="bg-white/5 rounded-xl p-4">
                                <h3 className="font-bold text-purple-400 mb-3">📈 สถิติ</h3>
                                <div className="grid grid-cols-3 gap-4 text-center">
                                    <div><div className="text-2xl font-bold text-white">{transactions.length}</div><div className="text-sm text-gray-400">รายการ</div></div>
                                    <div><div className="text-2xl font-bold text-cyan-400">{formatCurrency(totalLiters)}</div><div className="text-sm text-gray-400">ลิตร</div></div>
                                    <div><div className="text-2xl font-bold text-green-400">{formatCurrency(totalAmount)}</div><div className="text-sm text-gray-400">บาท</div></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Transaction Modal */}
            {editingTransaction && (
                <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
                    <div className="bg-[#0f0f1a] rounded-2xl w-full max-w-lg border border-white/10">
                        <div className="flex items-center justify-between p-6 border-b border-white/10">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <Edit className="text-blue-400" />
                                แก้ไขรายการ
                            </h2>
                            <button onClick={() => setEditingTransaction(null)} className="p-2 rounded-lg hover:bg-white/10 text-gray-400">
                                <X size={24} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">เล่มที่</label>
                                    <input
                                        type="text"
                                        value={editBookNo}
                                        onChange={(e) => setEditBookNo(e.target.value)}
                                        className="input-glow"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">เลขที่</label>
                                    <input
                                        type="text"
                                        value={editBillNo}
                                        onChange={(e) => setEditBillNo(e.target.value)}
                                        className="input-glow"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">ทะเบียนรถ</label>
                                <input
                                    type="text"
                                    value={editLicensePlate}
                                    onChange={(e) => setEditLicensePlate(e.target.value)}
                                    className="input-glow"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">ชื่อลูกค้า</label>
                                <input
                                    type="text"
                                    value={editOwnerName}
                                    onChange={(e) => setEditOwnerName(e.target.value)}
                                    className="input-glow"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">จำนวนลิตร</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={editLiters}
                                        onChange={(e) => setEditLiters(e.target.value)}
                                        className="input-glow text-center font-mono"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">ราคา/ลิตร</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={editPricePerLiter}
                                        onChange={(e) => setEditPricePerLiter(e.target.value)}
                                        className="input-glow text-center font-mono"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">ประเภทชำระ</label>
                                <select
                                    value={editPaymentType}
                                    onChange={(e) => setEditPaymentType(e.target.value)}
                                    className="input-glow"
                                >
                                    {PAYMENT_TYPES.map(pt => (
                                        <option key={pt.value} value={pt.value}>{pt.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="bg-white/5 rounded-xl p-4 text-center">
                                <p className="text-gray-400 text-sm">ยอดรวม</p>
                                <p className="text-2xl font-bold text-green-400 font-mono">
                                    {formatCurrency((parseFloat(editLiters) || 0) * (parseFloat(editPricePerLiter) || 0))} บาท
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-3 p-6 border-t border-white/10">
                            <button
                                onClick={() => setEditingTransaction(null)}
                                className="flex-1 btn btn-secondary"
                            >
                                ยกเลิก
                            </button>
                            <button
                                onClick={handleSaveEdit}
                                disabled={editSaving}
                                className="flex-1 btn btn-primary bg-gradient-to-r from-blue-600 to-cyan-600"
                            >
                                {editSaving ? (
                                    <span className="flex items-center gap-2">
                                        <div className="spinner-sm" />
                                        กำลังบันทึก...
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-2">
                                        <Save size={18} />
                                        บันทึก
                                    </span>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Print Receipt Modal */}
            {printingTransaction && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b">
                            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                <Printer className="text-purple-600" size={20} />
                                พิมพ์บิลเงินเชื่อ
                            </h2>
                            <button
                                onClick={() => setPrintingTransaction(null)}
                                className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Receipt Preview */}
                        <div id="receipt-content" className="p-6 bg-gradient-to-b from-gray-50 to-white">
                            <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 bg-white">
                                {/* Station Info */}
                                <div className="text-center mb-4">
                                    <div className="text-2xl mb-1">⛽</div>
                                    <h3 className="font-bold text-lg text-gray-800">{station?.name}</h3>
                                    <p className="text-sm text-gray-500">ใบส่งน้ำมันเชื่อ</p>
                                </div>

                                <div className="border-t border-dashed border-gray-300 my-4"></div>

                                {/* Bill Info */}
                                <div className="grid grid-cols-2 gap-2 text-sm mb-4">
                                    <div className="text-gray-500">เล่ม/เลขที่:</div>
                                    <div className="font-semibold text-right text-gray-800">
                                        {printingTransaction.bookNo || '-'}/{printingTransaction.billNo || '-'}
                                    </div>
                                    <div className="text-gray-500">วันที่:</div>
                                    <div className="font-semibold text-right text-gray-800">
                                        {new Date(printingTransaction.date).toLocaleDateString('th-TH', {
                                            day: 'numeric', month: 'short', year: 'numeric'
                                        })}
                                    </div>
                                </div>

                                <div className="border-t border-dashed border-gray-300 my-4"></div>

                                {/* Customer Info */}
                                <div className="bg-purple-50 rounded-xl p-4 mb-4">
                                    <div className="text-center">
                                        <p className="text-xs text-purple-600 mb-1">ลูกค้า</p>
                                        <p className="font-bold text-lg text-purple-800">
                                            {printingTransaction.ownerName || '-'}
                                        </p>
                                        <p className="text-sm text-purple-600">
                                            🚗 {printingTransaction.licensePlate || '-'}
                                        </p>
                                    </div>
                                </div>

                                {/* Fuel Info */}
                                <div className="bg-amber-50 rounded-xl p-4 mb-4">
                                    <div className="flex items-center justify-between text-sm mb-2">
                                        <span className="text-gray-600">ประเภทน้ำมัน</span>
                                        <span className="font-semibold text-amber-700">
                                            {getFuelTypeLabel(printingTransaction.fuelType)}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm mb-2">
                                        <span className="text-gray-600">จำนวน</span>
                                        <span className="font-semibold text-gray-800">
                                            {formatCurrency(printingTransaction.liters)} ลิตร
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-gray-600">ราคา/ลิตร</span>
                                        <span className="font-semibold text-gray-800">
                                            {formatCurrency(printingTransaction.pricePerLiter)} บาท
                                        </span>
                                    </div>
                                </div>

                                <div className="border-t border-dashed border-gray-300 my-4"></div>

                                {/* Total */}
                                <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl p-4 text-center">
                                    <p className="text-xs text-purple-200 mb-1">ยอดเงินเชื่อ</p>
                                    <p className="text-3xl font-bold text-white">
                                        {formatCurrency(printingTransaction.amount)}
                                    </p>
                                    <p className="text-sm text-purple-200">บาท</p>
                                </div>

                                {/* Signature */}
                                <div className="mt-6 pt-4 border-t border-gray-200">
                                    <div className="grid grid-cols-2 gap-4 text-center text-sm text-gray-500">
                                        <div>
                                            <div className="border-b border-gray-300 mb-2 h-12"></div>
                                            <p>ผู้รับสินค้า</p>
                                        </div>
                                        <div>
                                            <div className="border-b border-gray-300 mb-2 h-12"></div>
                                            <p>ผู้ส่งสินค้า</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Footer */}
                                <div className="mt-4 text-center text-xs text-gray-400">
                                    <p>ขอบคุณที่ใช้บริการ 🙏</p>
                                </div>
                            </div>
                        </div>

                        {/* Print Button */}
                        <div className="p-4 border-t flex gap-3">
                            <button
                                onClick={() => setPrintingTransaction(null)}
                                className="flex-1 py-3 rounded-xl font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
                            >
                                ยกเลิก
                            </button>
                            <button
                                onClick={() => {
                                    const printContent = document.getElementById('receipt-content');
                                    if (printContent) {
                                        const printWindow = window.open('', '_blank');
                                        if (printWindow) {
                                            printWindow.document.write(`
                                                <html>
                                                <head>
                                                    <title>บิลเงินเชื่อ - ${printingTransaction.billNo}</title>
                                                    <style>
                                                        * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Sarabun', 'Prompt', sans-serif; }
                                                        body { padding: 20px; background: white; }
                                                        .receipt { max-width: 300px; margin: 0 auto; }
                                                        .header { text-align: center; margin-bottom: 16px; }
                                                        .station-name { font-size: 18px; font-weight: bold; }
                                                        .divider { border-top: 1px dashed #ccc; margin: 12px 0; }
                                                        .row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; }
                                                        .label { color: #666; }
                                                        .value { font-weight: 600; }
                                                        .customer-box { background: #f8f5ff; padding: 12px; border-radius: 8px; text-align: center; margin: 12px 0; }
                                                        .customer-name { font-size: 16px; font-weight: bold; color: #7c3aed; }
                                                        .fuel-box { background: #fffbeb; padding: 12px; border-radius: 8px; margin: 12px 0; }
                                                        .total-box { background: linear-gradient(90deg, #9333ea, #ec4899); padding: 16px; border-radius: 8px; text-align: center; color: white; }
                                                        .total-amount { font-size: 28px; font-weight: bold; }
                                                        .signature { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 24px; text-align: center; }
                                                        .sig-line { border-bottom: 1px solid #ccc; height: 40px; margin-bottom: 8px; }
                                                        .footer { text-align: center; margin-top: 16px; font-size: 12px; color: #999; }
                                                        @media print { body { padding: 0; } }
                                                    </style>
                                                </head>
                                                <body>
                                                    <div class="receipt">
                                                        <div class="header">
                                                            <div style="font-size:24px">⛽</div>
                                                            <div class="station-name">${station?.name}</div>
                                                            <div style="font-size:12px;color:#666">ใบส่งน้ำมันเชื่อ</div>
                                                        </div>
                                                        <div class="divider"></div>
                                                        <div class="row"><span class="label">เล่ม/เลขที่:</span><span class="value">${printingTransaction.bookNo || '-'}/${printingTransaction.billNo || '-'}</span></div>
                                                        <div class="row"><span class="label">วันที่:</span><span class="value">${new Date(printingTransaction.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}</span></div>
                                                        <div class="divider"></div>
                                                        <div class="customer-box">
                                                            <div style="font-size:11px;color:#7c3aed;margin-bottom:4px">ลูกค้า</div>
                                                            <div class="customer-name">${printingTransaction.ownerName || '-'}</div>
                                                            <div style="font-size:13px;color:#7c3aed">🚗 ${printingTransaction.licensePlate || '-'}</div>
                                                        </div>
                                                        <div class="fuel-box">
                                                            <div class="row"><span class="label">ประเภทน้ำมัน</span><span class="value" style="color:#b45309">${getFuelTypeLabel(printingTransaction.fuelType)}</span></div>
                                                            <div class="row"><span class="label">จำนวน</span><span class="value">${formatCurrency(printingTransaction.liters)} ลิตร</span></div>
                                                            <div class="row"><span class="label">ราคา/ลิตร</span><span class="value">${formatCurrency(printingTransaction.pricePerLiter)} บาท</span></div>
                                                        </div>
                                                        <div class="divider"></div>
                                                        <div class="total-box">
                                                            <div style="font-size:11px;opacity:0.8">ยอดเงินเชื่อ</div>
                                                            <div class="total-amount">${formatCurrency(printingTransaction.amount)}</div>
                                                            <div style="font-size:12px;opacity:0.8">บาท</div>
                                                        </div>
                                                        <div class="signature">
                                                            <div><div class="sig-line"></div><div style="font-size:12px;color:#666">ผู้รับสินค้า</div></div>
                                                            <div><div class="sig-line"></div><div style="font-size:12px;color:#666">ผู้ส่งสินค้า</div></div>
                                                        </div>
                                                        <div class="footer">ขอบคุณที่ใช้บริการ 🙏</div>
                                                    </div>
                                                    <script>window.onload = function() { window.print(); }</script>
                                                </body>
                                                </html>
                                            `);
                                            printWindow.document.close();
                                        }
                                    }
                                }}
                                className="flex-1 py-3 rounded-xl font-medium text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 transition-all flex items-center justify-center gap-2"
                            >
                                <Printer size={18} />
                                พิมพ์
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </Sidebar>
    );
}
