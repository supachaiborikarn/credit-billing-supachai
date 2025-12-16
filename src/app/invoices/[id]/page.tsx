'use client';

import { useState, useEffect, use } from 'react';
import Sidebar from '@/components/Sidebar';
import {
    FileText, ArrowLeft, DollarSign, CheckCircle,
    Plus, Printer
} from 'lucide-react';
import Link from 'next/link';

interface Invoice {
    id: string;
    invoiceNumber: string;
    owner: {
        id: string;
        name: string;
        code: string | null;
        phone: string | null;
    };
    totalAmount: number;
    paidAmount: number;
    status: string;
    dueDate: string | null;
    createdAt: string;
    transactions: Transaction[];
    payments: Payment[];
}

interface Transaction {
    id: string;
    date: string;
    licensePlate: string;
    liters: number;
    pricePerLiter: number;
    amount: number;
    paymentType: string;
}

interface Payment {
    id: string;
    amount: number;
    paymentDate: string;
    paymentMethod: string;
    notes: string | null;
    createdAt: string;
}

export default function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const [loading, setLoading] = useState(true);
    const [invoice, setInvoice] = useState<Invoice | null>(null);
    const [showPaymentForm, setShowPaymentForm] = useState(false);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('TRANSFER');
    const [paymentNotes, setPaymentNotes] = useState('');

    useEffect(() => {
        fetchInvoice();
    }, [id]);

    const fetchInvoice = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/invoices/${id}`);
            if (res.ok) {
                const data = await res.json();
                setInvoice(data);
            }
        } catch (error) {
            console.error('Error fetching invoice:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddPayment = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await fetch(`/api/invoices/${id}/payments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amount: parseFloat(paymentAmount),
                    paymentMethod,
                    notes: paymentNotes || null,
                }),
            });
            if (res.ok) {
                setShowPaymentForm(false);
                setPaymentAmount('');
                setPaymentNotes('');
                fetchInvoice();
            }
        } catch (error) {
            console.error('Error adding payment:', error);
        }
    };

    const formatCurrency = (num: number) =>
        new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2 }).format(num);

    const formatDate = (date: string) =>
        new Date(date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });

    const formatDateFull = (date: string) =>
        new Date(date).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });

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

    const remainingAmount = invoice ? Number(invoice.totalAmount) - Number(invoice.paidAmount) : 0;

    if (loading) {
        return (
            <Sidebar>
                <div className="flex items-center justify-center h-64">
                    <div className="spinner" />
                </div>
            </Sidebar>
        );
    }

    if (!invoice) {
        return (
            <Sidebar>
                <div className="text-center py-20">
                    <p className="text-gray-400">ไม่พบใบวางบิล</p>
                    <Link href="/invoices" className="btn btn-primary mt-4">
                        กลับหน้ารายการ
                    </Link>
                </div>
            </Sidebar>
        );
    }

    return (
        <Sidebar>
            <div className="max-w-4xl mx-auto">
                {/* Screen Header - Hidden when printing */}
                <div className="flex items-center justify-between mb-6 print:hidden">
                    <div className="flex items-center gap-4">
                        <Link href="/invoices" className="btn btn-secondary p-2">
                            <ArrowLeft size={20} />
                        </Link>
                        <div>
                            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                                <FileText className="text-green-400" />
                                {invoice.invoiceNumber}
                            </h1>
                            <p className="text-gray-400 mt-1">{invoice.owner.name}</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => window.print()} className="btn btn-success">
                            <Printer size={18} />
                            พิมพ์ใบวางบิล
                        </button>
                    </div>
                </div>

                {/* ==================== PRINT LAYOUT (A4 Professional) ==================== */}
                <div className="print-invoice bg-white text-black p-10 rounded-lg shadow-lg" id="invoice-print" style={{ maxWidth: '210mm', margin: '0 auto' }}>
                    {/* Header */}
                    <div className="border-b-2 border-gray-900 pb-6 mb-8">
                        <div className="flex justify-between items-start">
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900">หจก.วัชรเกียรติออยล์</h1>
                                <p className="text-sm text-gray-700 mt-1">WATCHARAKIAT OIL LIMITED PARTNERSHIP</p>
                                <p className="text-sm text-gray-600 mt-2">657 ถ.เจริญสุข ต.ในเมือง อ.เมือง จ.กำแพงเพชร</p>
                                <p className="text-sm text-gray-600">โทร. 055-773003</p>
                                <p className="text-sm text-gray-600">เลขประจำตัวผู้เสียภาษี: 0623539000911</p>
                            </div>
                            <div className="text-right">
                                <div className="border-2 border-gray-900 px-6 py-3 inline-block">
                                    <h2 className="text-xl font-bold text-gray-900">ใบวางบิล</h2>
                                    <p className="text-sm text-gray-600">INVOICE</p>
                                </div>
                                <p className="text-2xl font-mono font-bold text-gray-900 mt-3">{invoice.invoiceNumber}</p>
                            </div>
                        </div>
                    </div>

                    {/* Invoice Info & Customer Info */}
                    <div className="grid grid-cols-2 gap-12 mb-8">
                        {/* Customer Info */}
                        <div>
                            <h3 className="font-bold text-gray-900 mb-3 text-sm uppercase border-b border-gray-300 pb-1">ข้อมูลลูกค้า / Customer</h3>
                            <div className="space-y-2">
                                <p className="text-xl font-bold text-gray-900">{invoice.owner.name}</p>
                                {invoice.owner.code && (
                                    <p className="text-gray-700">รหัสลูกค้า: <span className="font-mono font-bold">{invoice.owner.code}</span></p>
                                )}
                                {invoice.owner.phone && (
                                    <p className="text-gray-700">โทร: {invoice.owner.phone}</p>
                                )}
                            </div>
                        </div>

                        {/* Invoice Details */}
                        <div>
                            <h3 className="font-bold text-gray-900 mb-3 text-sm uppercase border-b border-gray-300 pb-1">รายละเอียด / Details</h3>
                            <div className="space-y-2">
                                <div className="flex justify-between">
                                    <span className="text-gray-600">วันที่ออกบิล:</span>
                                    <span className="font-medium text-gray-900">{formatDateFull(invoice.createdAt)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">จำนวนรายการ:</span>
                                    <span className="font-medium text-gray-900">{invoice.transactions.length} รายการ</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Transactions Table */}
                    <div className="mb-8">
                        <h3 className="font-bold text-gray-900 mb-4 text-sm uppercase">รายการเติมน้ำมัน / Fuel Transactions</h3>
                        <table className="w-full border-collapse border border-gray-400">
                            <thead>
                                <tr className="border-b-2 border-gray-900">
                                    <th className="px-3 py-3 text-left text-sm font-bold text-gray-900 border-r border-gray-300">ลำดับ</th>
                                    <th className="px-3 py-3 text-left text-sm font-bold text-gray-900 border-r border-gray-300">วันที่</th>
                                    <th className="px-3 py-3 text-left text-sm font-bold text-gray-900 border-r border-gray-300">ทะเบียนรถ</th>
                                    <th className="px-3 py-3 text-right text-sm font-bold text-gray-900 border-r border-gray-300">จำนวน (ลิตร)</th>
                                    <th className="px-3 py-3 text-right text-sm font-bold text-gray-900 border-r border-gray-300">ราคา/ลิตร</th>
                                    <th className="px-3 py-3 text-right text-sm font-bold text-gray-900">รวมเงิน (บาท)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {invoice.transactions.map((t, index) => (
                                    <tr key={t.id} className="border-b border-gray-300">
                                        <td className="px-3 py-2 text-sm border-r border-gray-300">{index + 1}</td>
                                        <td className="px-3 py-2 text-sm border-r border-gray-300">{formatDate(t.date)}</td>
                                        <td className="px-3 py-2 font-mono text-sm font-medium border-r border-gray-300">{t.licensePlate}</td>
                                        <td className="px-3 py-2 text-right font-mono text-sm border-r border-gray-300">{Number(t.liters).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
                                        <td className="px-3 py-2 text-right font-mono text-sm border-r border-gray-300">{Number(t.pricePerLiter).toFixed(2)}</td>
                                        <td className="px-3 py-2 text-right font-mono text-sm font-medium">{formatCurrency(Number(t.amount))}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="border-t-2 border-gray-900">
                                    <td colSpan={3} className="px-3 py-3 text-right font-bold text-gray-900 border-r border-gray-300">รวมทั้งสิ้น</td>
                                    <td className="px-3 py-3 text-right font-mono font-bold text-gray-900 border-r border-gray-300">
                                        {formatCurrency(invoice.transactions.reduce((sum, t) => sum + Number(t.liters), 0))}
                                    </td>
                                    <td className="border-r border-gray-300"></td>
                                    <td className="px-3 py-3 text-right font-mono font-bold text-xl text-gray-900">
                                        {formatCurrency(Number(invoice.totalAmount))}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>


                    {/* Payment History (if any) */}
                    {invoice.payments.length > 0 && (
                        <div className="mb-8">
                            <h3 className="font-bold text-gray-900 mb-4 text-sm uppercase">ประวัติการชำระเงิน / Payment History</h3>
                            <table className="w-full border-collapse border border-gray-400">
                                <thead>
                                    <tr className="border-b-2 border-gray-900">
                                        <th className="px-3 py-2 text-left text-sm font-bold text-gray-900 border-r border-gray-300">วันที่ชำระ</th>
                                        <th className="px-3 py-2 text-left text-sm font-bold text-gray-900 border-r border-gray-300">วิธีชำระ</th>
                                        <th className="px-3 py-2 text-right text-sm font-bold text-gray-900 border-r border-gray-300">จำนวนเงิน</th>
                                        <th className="px-3 py-2 text-left text-sm font-bold text-gray-900">หมายเหตุ</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {invoice.payments.map((p) => (
                                        <tr key={p.id} className="border-b border-gray-300">
                                            <td className="px-3 py-2 text-sm border-r border-gray-300">{formatDate(p.paymentDate)}</td>
                                            <td className="px-3 py-2 text-sm border-r border-gray-300">
                                                {p.paymentMethod === 'TRANSFER' ? 'โอนเงิน' : p.paymentMethod === 'CASH' ? 'เงินสด' : 'เช็ค'}
                                            </td>
                                            <td className="px-3 py-2 text-right font-mono text-sm font-medium border-r border-gray-300">{formatCurrency(Number(p.amount))}</td>
                                            <td className="px-3 py-2 text-sm text-gray-600">{p.notes || '-'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Signature Section */}
                    <div className="border-t-2 border-gray-900 pt-8 mt-8">
                        <div className="grid grid-cols-3 gap-8">
                            <div className="text-center">
                                <p className="text-sm text-gray-700 mb-12">ผู้รับวางบิล / Received by</p>
                                <div className="border-b border-gray-900 w-32 mx-auto mb-2"></div>
                                <p className="text-xs text-gray-500">(ลายเซ็น / วันที่)</p>
                            </div>
                            <div className="text-center">
                                <p className="text-sm text-gray-700 mb-12">ผู้วางบิล / Billed by</p>
                                <div className="border-b border-gray-900 w-32 mx-auto mb-2"></div>
                                <p className="text-xs text-gray-500">(ลายเซ็น / วันที่)</p>
                            </div>
                            <div className="text-center">
                                <p className="text-sm text-gray-700 mb-12">ผู้อนุมัติ / Approved by</p>
                                <div className="border-b border-gray-900 w-32 mx-auto mb-2"></div>
                                <p className="text-xs text-gray-500">(ลายเซ็น / วันที่)</p>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="mt-8 pt-4 border-t border-gray-300 text-center">
                        <p className="text-xs text-gray-500">
                            หจก.วัชรเกียรติออยล์ | 657 ถ.เจริญสุข อ.เมือง จ.กำแพงเพชร | พิมพ์เมื่อ {new Date().toLocaleString('th-TH')}
                        </p>
                    </div>
                </div>
                {/* ==================== END PRINT LAYOUT ==================== */}

                {/* Payment Section - Screen only */}
                <div className="glass-card p-4 mt-6 print:hidden">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-white">บันทึกการชำระเงิน</h3>
                        {invoice.status !== 'PAID' && (
                            <button
                                onClick={() => setShowPaymentForm(true)}
                                className="btn btn-success"
                            >
                                <Plus size={18} />
                                บันทึกการชำระ
                            </button>
                        )}
                    </div>

                    {/* Payment Form */}
                    {showPaymentForm && (
                        <form onSubmit={handleAddPayment} className="bg-green-900/20 rounded-xl p-4 mb-4 border border-green-500/30">
                            <h4 className="font-medium text-green-400 mb-3">บันทึกการชำระเงิน</h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">จำนวนเงิน</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={paymentAmount}
                                        onChange={(e) => setPaymentAmount(e.target.value)}
                                        placeholder={remainingAmount.toString()}
                                        className="input-glow"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">วิธีชำระ</label>
                                    <select
                                        value={paymentMethod}
                                        onChange={(e) => setPaymentMethod(e.target.value)}
                                        className="input-glow"
                                    >
                                        <option value="TRANSFER">โอนเงิน</option>
                                        <option value="CASH">เงินสด</option>
                                        <option value="CHECK">เช็ค</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">หมายเหตุ</label>
                                    <input
                                        type="text"
                                        value={paymentNotes}
                                        onChange={(e) => setPaymentNotes(e.target.value)}
                                        placeholder="หมายเหตุ (ถ้ามี)"
                                        className="input-glow"
                                    />
                                </div>
                            </div>
                            <div className="flex gap-2 mt-4">
                                <button type="submit" className="btn btn-success">
                                    <CheckCircle size={18} />
                                    บันทึก
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowPaymentForm(false)}
                                    className="btn btn-secondary"
                                >
                                    ยกเลิก
                                </button>
                            </div>
                        </form>
                    )}

                    {/* Payment History */}
                    {invoice.payments.length === 0 ? (
                        <p className="text-gray-400 text-center py-4">ยังไม่มีการชำระ</p>
                    ) : (
                        <div className="space-y-2">
                            {invoice.payments.map(p => (
                                <div key={p.id} className="flex items-center justify-between bg-white/5 rounded-lg p-3">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-lg bg-green-500/20">
                                            <DollarSign className="text-green-400" size={20} />
                                        </div>
                                        <div>
                                            <p className="font-mono text-green-400 font-medium">
                                                +{formatCurrency(Number(p.amount))}
                                            </p>
                                            <p className="text-xs text-gray-400">
                                                {p.paymentMethod === 'TRANSFER' ? 'โอนเงิน' :
                                                    p.paymentMethod === 'CASH' ? 'เงินสด' : 'เช็ค'}
                                                {p.notes && ` • ${p.notes}`}
                                            </p>
                                        </div>
                                    </div>
                                    <span className="text-sm text-gray-400">
                                        {formatDate(p.paymentDate)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Print Styles */}
            <style jsx global>{`
                @media print {
                    @page {
                        size: A4;
                        margin: 10mm;
                    }
                    html, body {
                        width: 210mm;
                        height: 297mm;
                        background: white !important;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                        margin: 0 !important;
                        padding: 0 !important;
                    }
                    /* Hide everything except invoice */
                    body > * {
                        visibility: hidden;
                    }
                    #invoice-print,
                    #invoice-print * {
                        visibility: visible;
                    }
                    #invoice-print {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                        box-shadow: none !important;
                        margin: 0 !important;
                        padding: 10mm !important;
                        border-radius: 0 !important;
                        max-width: none !important;
                    }
                    .print\\:hidden,
                    aside,
                    nav,
                    header,
                    footer,
                    .sidebar,
                    .glass-card.print\\:hidden {
                        display: none !important;
                        visibility: hidden !important;
                    }
                    main {
                        margin: 0 !important;
                        padding: 0 !important;
                        width: 100% !important;
                        max-width: none !important;
                    }
                }
            `}</style>
        </Sidebar>
    );
}
