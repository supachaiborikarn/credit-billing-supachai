'use client';

import { useState, useEffect, use, useRef } from 'react';
import { ArrowLeft, Trash2, Calendar, Edit, Printer, X, Image, Download, FileText, DollarSign, Droplets, BarChart3, Banknote, CreditCard, ArrowUpDown } from 'lucide-react';
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

    // Edit Modal State
    const [editingTxn, setEditingTxn] = useState<Transaction | null>(null);
    const [editLicensePlate, setEditLicensePlate] = useState('');
    const [editOwnerName, setEditOwnerName] = useState('');
    const [editLiters, setEditLiters] = useState('');
    const [editPricePerLiter, setEditPricePerLiter] = useState('');
    const [editPaymentType, setEditPaymentType] = useState('');
    const [editBookNo, setEditBookNo] = useState('');
    const [editBillNo, setEditBillNo] = useState('');
    const [editSaving, setEditSaving] = useState(false);

    // Print Modal State
    const [printingTxn, setPrintingTxn] = useState<Transaction | null>(null);

    // Image Upload State
    const [imageUploadTxn, setImageUploadTxn] = useState<Transaction | null>(null);
    const [uploadingImage, setUploadingImage] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

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

    const formatTime = (dateStr: string) => {
        if (!dateStr) return '-';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return '-';
        return d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    };

    const getPaymentLabel = (value: string) => {
        const pt = PAYMENT_TYPES.find(p => p.value === value);
        return pt ? pt.label : value;
    };

    const getFuelLabel = (value: string) => {
        const ft = FUEL_TYPES.find(f => f.value === value);
        return ft ? ft.label : value;
    };

    // Open Edit Modal
    const openEditModal = (txn: Transaction) => {
        setEditingTxn(txn);
        setEditLicensePlate(txn.licensePlate || '');
        setEditOwnerName(txn.ownerName || '');
        setEditLiters(txn.liters?.toString() || '');
        setEditPricePerLiter(txn.pricePerLiter?.toString() || '');
        setEditPaymentType(txn.paymentType || 'CASH');
        setEditBookNo(txn.bookNo || '');
        setEditBillNo(txn.billNo || '');
    };

    // Save Edit
    const handleSaveEdit = async () => {
        if (!editingTxn) return;
        setEditSaving(true);
        try {
            const res = await fetch(`/api/station/${id}/transactions/${editingTxn.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    licensePlate: editLicensePlate,
                    ownerName: editOwnerName,
                    liters: parseFloat(editLiters) || 0,
                    pricePerLiter: parseFloat(editPricePerLiter) || 0,
                    amount: (parseFloat(editLiters) || 0) * (parseFloat(editPricePerLiter) || 0),
                    paymentType: editPaymentType,
                    bookNo: editBookNo,
                    billNo: editBillNo,
                }),
            });
            if (res.ok) {
                const updated = await res.json();
                setTransactions(prev => prev.map(t => t.id === editingTxn.id ? { ...t, ...updated } : t));
                setEditingTxn(null);
            } else {
                alert('บันทึกไม่สำเร็จ');
            }
        } catch (e) {
            alert('เกิดข้อผิดพลาด');
        } finally {
            setEditSaving(false);
        }
    };

    // Handle Image Upload
    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !imageUploadTxn) return;

        setUploadingImage(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('transactionId', imageUploadTxn.id);

            const res = await fetch('/api/upload/slip', {
                method: 'POST',
                body: formData,
            });

            if (res.ok) {
                alert('อัปโหลดสำเร็จ!');
                setImageUploadTxn(null);
            } else {
                alert('อัปโหลดไม่สำเร็จ');
            }
        } catch (e) {
            alert('เกิดข้อผิดพลาด');
        } finally {
            setUploadingImage(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    // Print Bill
    const handlePrint = () => {
        window.print();
    };

    // Export to Excel/CSV
    const handleExportExcel = () => {
        const headers = ['ลำดับ', 'เล่ม', 'เลขที่', 'ทะเบียน', 'ชื่อลูกค้า', 'ประเภทน้ำมัน', 'ลิตร', 'ราคา/ลิตร', 'ยอดเงิน', 'ชำระ'];
        const rows = filteredTransactions.map((t, i) => [
            i + 1,
            t.bookNo || '-',
            t.billNo || '-',
            t.licensePlate || '-',
            t.ownerName || '-',
            getFuelLabel(t.fuelType),
            t.liters,
            t.pricePerLiter,
            t.amount,
            getPaymentLabel(t.paymentType)
        ]);

        // Add summary row
        rows.push([]);
        rows.push(['รวม', '', '', '', '', '', totalLiters, '', totalAmount, '']);

        const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
        const BOM = '\uFEFF';
        const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `สรุปรายการ_${station?.name || ''}_${selectedDate}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    // Print Report
    const handlePrintReport = () => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>สรุปรายการ ${selectedDate}</title>
                <style>
                    body { font-family: 'Sarabun', sans-serif; padding: 20px; }
                    h1 { text-align: center; margin-bottom: 5px; }
                    h2 { text-align: center; color: #666; margin-top: 0; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th, td { border: 1px solid #000; padding: 8px; text-align: left; font-size: 12px; }
                    th { background: #f0f0f0; }
                    .text-right { text-align: right; }
                    .summary { font-weight: bold; background: #e0e0e0; }
                    .header { margin-bottom: 20px; }
                    @media print { body { padding: 0; } }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>${station?.name || 'ปั๊ม'}</h1>
                    <h2>สรุปรายการประจำวัน ${selectedDate}</h2>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>ลำดับ</th>
                            <th>เล่ม/เลขที่</th>
                            <th>ทะเบียน</th>
                            <th>ชื่อ</th>
                            <th>น้ำมัน</th>
                            <th class="text-right">ลิตร</th>
                            <th class="text-right">ยอดเงิน</th>
                            <th>ชำระ</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filteredTransactions.map((t, i) => `
                            <tr>
                                <td>${i + 1}</td>
                                <td>${t.bookNo || '-'}/${t.billNo || '-'}</td>
                                <td>${t.licensePlate || '-'}</td>
                                <td>${t.ownerName || '-'}</td>
                                <td>${getFuelLabel(t.fuelType)}</td>
                                <td class="text-right">${formatCurrency(t.liters)}</td>
                                <td class="text-right">${formatCurrency(t.amount)}</td>
                                <td>${getPaymentLabel(t.paymentType)}</td>
                            </tr>
                        `).join('')}
                        <tr class="summary">
                            <td colspan="5">รวมทั้งสิ้น (${filteredTransactions.length} รายการ)</td>
                            <td class="text-right">${formatCurrency(totalLiters)}</td>
                            <td class="text-right">${formatCurrency(totalAmount)} ฿</td>
                            <td></td>
                        </tr>
                    </tbody>
                </table>
                <script>window.onload = function() { window.print(); }</script>
            </body>
            </html>
        `;
        printWindow.document.write(html);
        printWindow.document.close();
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
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleExportExcel}
                            className="p-2 rounded-lg bg-green-500 text-white hover:bg-green-600"
                            title="Export Excel"
                        >
                            <Download size={18} />
                        </button>
                        <button
                            onClick={handlePrintReport}
                            className="p-2 rounded-lg bg-purple-500 text-white hover:bg-purple-600"
                            title="พิมพ์รายงาน"
                        >
                            <FileText size={18} />
                        </button>
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
                </div>
            </header>

            <div className="p-4 pb-24 space-y-4">
                {/* Summary Cards - Supachaigroup Style */}
                <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-2xl p-3 bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg">
                        <div className="flex items-center gap-1 mb-1">
                            <BarChart3 className="w-3 h-3 opacity-80" />
                            <span className="text-xs opacity-90">รายการ</span>
                        </div>
                        <p className="text-2xl font-bold">{filteredTransactions.length}</p>
                    </div>
                    <div className="rounded-2xl p-3 bg-gradient-to-br from-cyan-500 to-blue-500 text-white shadow-lg">
                        <div className="flex items-center gap-1 mb-1">
                            <Droplets className="w-3 h-3 opacity-80" />
                            <span className="text-xs opacity-90">รวมลิตร</span>
                        </div>
                        <p className="text-xl font-bold">{formatCurrency(totalLiters)}</p>
                    </div>
                    <div className="rounded-2xl p-3 bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-lg">
                        <div className="flex items-center gap-1 mb-1">
                            <DollarSign className="w-3 h-3 opacity-80" />
                            <span className="text-xs opacity-90">รวมเงิน</span>
                        </div>
                        <p className="text-xl font-bold">{formatCurrency(totalAmount)}</p>
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
                                            {txn.bookNo || '-'}/{txn.billNo || '-'} • {txn.fuelType ? getFuelLabel(txn.fuelType) : <span className="text-red-400">ไม่ระบุสินค้า</span>} • {formatTime(txn.createdAt)}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-lg text-green-600">{formatCurrency(txn.amount)} ฿</p>
                                        <p className="text-sm text-gray-500">{txn.liters} ลิตร</p>
                                        <div className="flex items-center justify-end gap-1 mt-2">
                                            {txn.paymentType === 'CREDIT' && (
                                                <Link
                                                    href={`/simple-station/${id}/new/receipt?txn=${txn.id}`}
                                                    className="p-2 text-purple-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                                                    title="พิมพ์ใบส่งของ"
                                                >
                                                    <Printer size={16} />
                                                </Link>
                                            )}
                                            <button
                                                onClick={() => {
                                                    setImageUploadTxn(txn);
                                                    fileInputRef.current?.click();
                                                }}
                                                className="p-2 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                title="แนบรูป"
                                            >
                                                <Image size={16} />
                                            </button>
                                            <button
                                                onClick={() => openEditModal(txn)}
                                                className="p-2 text-orange-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                                                title="แก้ไข"
                                            >
                                                <Edit size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(txn.id)}
                                                disabled={deletingId === txn.id}
                                                className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                                                title="ลบ"
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
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Hidden File Input */}
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageUpload}
                accept="image/*"
                className="hidden"
            />

            {/* Edit Modal */}
            {editingTxn && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
                        <div className="flex items-center justify-between p-4 border-b">
                            <h2 className="text-lg font-bold text-gray-800">แก้ไขรายการ</h2>
                            <button onClick={() => setEditingTxn(null)} className="p-2 rounded-lg hover:bg-gray-100">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-4 space-y-3">
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-xs text-gray-500">เล่มที่</label>
                                    <input type="text" value={editBookNo} onChange={(e) => setEditBookNo(e.target.value)} className="w-full px-3 py-2 border rounded-xl text-gray-800" />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500">เลขที่</label>
                                    <input type="text" value={editBillNo} onChange={(e) => setEditBillNo(e.target.value)} className="w-full px-3 py-2 border rounded-xl text-gray-800" />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs text-gray-500">ทะเบียน</label>
                                <input type="text" value={editLicensePlate} onChange={(e) => setEditLicensePlate(e.target.value)} className="w-full px-3 py-2 border rounded-xl text-gray-800" />
                            </div>
                            <div>
                                <label className="text-xs text-gray-500">ชื่อลูกค้า</label>
                                <input type="text" value={editOwnerName} onChange={(e) => setEditOwnerName(e.target.value)} className="w-full px-3 py-2 border rounded-xl text-gray-800" />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-xs text-gray-500">ลิตร</label>
                                    <input type="number" value={editLiters} onChange={(e) => setEditLiters(e.target.value)} className="w-full px-3 py-2 border rounded-xl text-gray-800" />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500">ราคา/ลิตร</label>
                                    <input type="number" value={editPricePerLiter} onChange={(e) => setEditPricePerLiter(e.target.value)} className="w-full px-3 py-2 border rounded-xl text-gray-800" />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs text-gray-500">ประเภทชำระ</label>
                                <select value={editPaymentType} onChange={(e) => setEditPaymentType(e.target.value)} className="w-full px-3 py-2 border rounded-xl text-gray-800">
                                    {PAYMENT_TYPES.slice(0, 4).map(pt => (
                                        <option key={pt.value} value={pt.value}>{pt.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="pt-2">
                                <p className="text-center text-lg font-bold text-orange-600">
                                    รวม: {formatCurrency((parseFloat(editLiters) || 0) * (parseFloat(editPricePerLiter) || 0))} ฿
                                </p>
                            </div>
                        </div>
                        <div className="p-4 border-t flex gap-2">
                            <button onClick={() => setEditingTxn(null)} className="flex-1 py-2 rounded-xl border text-gray-600 hover:bg-gray-50">ยกเลิก</button>
                            <button onClick={handleSaveEdit} disabled={editSaving} className="flex-1 py-2 rounded-xl bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50">
                                {editSaving ? 'กำลังบันทึก...' : 'บันทึก'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Print Modal */}
            {printingTxn && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl print:shadow-none">
                        <div className="flex items-center justify-between p-4 border-b print:hidden">
                            <h2 className="text-lg font-bold text-gray-800">บิลเงินเชื่อ</h2>
                            <button onClick={() => setPrintingTxn(null)} className="p-2 rounded-lg hover:bg-gray-100">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 space-y-3 text-center">
                            <h3 className="font-bold text-xl">{station.name}</h3>
                            <p className="text-gray-500 text-sm">วันที่: {selectedDate}</p>
                            <div className="border-t border-b py-4 my-4 text-left space-y-2">
                                <p><span className="text-gray-500">เล่ม/เลขที่:</span> {printingTxn.bookNo || '-'}/{printingTxn.billNo || '-'}</p>
                                <p><span className="text-gray-500">ทะเบียน:</span> {printingTxn.licensePlate || '-'}</p>
                                <p><span className="text-gray-500">ลูกค้า:</span> {printingTxn.ownerName || '-'}</p>
                                <p><span className="text-gray-500">จำนวน:</span> {printingTxn.liters} ลิตร x {printingTxn.pricePerLiter} บาท</p>
                            </div>
                            <p className="text-2xl font-bold text-green-600">{formatCurrency(printingTxn.amount)} บาท</p>
                        </div>
                        <div className="p-4 border-t flex gap-2 print:hidden">
                            <button onClick={() => setPrintingTxn(null)} className="flex-1 py-2 rounded-xl border text-gray-600 hover:bg-gray-50">ปิด</button>
                            <button onClick={handlePrint} className="flex-1 py-2 rounded-xl bg-purple-500 text-white hover:bg-purple-600">พิมพ์</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
