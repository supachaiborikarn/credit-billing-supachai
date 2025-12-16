'use client';

import { useState, useEffect, use } from 'react';
import Sidebar from '@/components/Sidebar';
import BillEntryForm from '@/components/BillEntryForm';
import { Calendar, Fuel, Trash2, FileText, Printer, X, Sparkles } from 'lucide-react';
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
        const ft = FUEL_TYPES.find(f => f.value === value);
        return ft ? ft.label : value;
    };

    const getFuelTypeColor = (value: string) => {
        const ft = FUEL_TYPES.find(f => f.value === value);
        return ft ? ft.color : 'bg-gray-500';
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
                        <div className="glass-card p-6">
                            <h2 className="text-lg font-bold text-white mb-4">📋 รายการวันนี้</h2>

                            {filteredTransactions.length === 0 ? (
                                <div className="text-center py-8 text-gray-400">
                                    ยังไม่มีรายการ
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="text-sm text-gray-400 border-b border-white/10">
                                                <th className="py-2 px-3 text-left">เล่ม/เลขที่</th>
                                                <th className="py-2 px-3 text-left">ทะเบียน</th>
                                                <th className="py-2 px-3 text-left">ลูกค้า</th>
                                                <th className="py-2 px-3 text-left">น้ำมัน</th>
                                                <th className="py-2 px-3 text-right">ลิตร</th>
                                                <th className="py-2 px-3 text-right">ราคา</th>
                                                <th className="py-2 px-3 text-right">รวม</th>
                                                <th className="py-2 px-3 text-center">ชำระ</th>
                                                <th className="py-2 px-3 text-center">ลบ</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredTransactions.map((txn) => (
                                                <tr key={txn.id} className="border-b border-white/5 hover:bg-white/5">
                                                    <td className="py-2 px-3 text-sm text-gray-300">
                                                        {txn.bookNo || '-'}/{txn.billNo || '-'}
                                                    </td>
                                                    <td className="py-2 px-3 text-sm font-mono text-blue-400">
                                                        {txn.licensePlate || '-'}
                                                    </td>
                                                    <td className="py-2 px-3 text-sm text-white">
                                                        {txn.ownerName || '-'}
                                                    </td>
                                                    <td className="py-2 px-3">
                                                        <span className={`badge ${getFuelTypeColor(txn.fuelType)} text-white text-xs`}>
                                                            {getFuelTypeLabel(txn.fuelType)}
                                                        </span>
                                                    </td>
                                                    <td className="py-2 px-3 text-right font-mono text-white">
                                                        {formatCurrency(txn.liters)}
                                                    </td>
                                                    <td className="py-2 px-3 text-right font-mono text-gray-400">
                                                        {formatCurrency(txn.pricePerLiter)}
                                                    </td>
                                                    <td className="py-2 px-3 text-right font-mono font-bold text-green-400">
                                                        {formatCurrency(txn.amount)}
                                                    </td>
                                                    <td className="py-2 px-3 text-center">
                                                        <span className={`badge ${txn.paymentType === 'CASH' ? 'bg-green-600' :
                                                            txn.paymentType === 'CREDIT' ? 'bg-purple-600' :
                                                                'bg-blue-600'
                                                            } text-white text-xs`}>
                                                            {getPaymentTypeLabel(txn.paymentType)}
                                                        </span>
                                                    </td>
                                                    <td className="py-2 px-3 text-center">
                                                        <button
                                                            onClick={() => handleDeleteTransaction(txn.id)}
                                                            className="text-red-400 hover:text-red-300 p-1"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
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
        </Sidebar>
    );
}
