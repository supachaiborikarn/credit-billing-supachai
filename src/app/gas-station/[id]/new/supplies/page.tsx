'use client';

import { useState, useEffect, use } from 'react';
import { ArrowLeft, Plus, Trash2, Package, Calendar } from 'lucide-react';
import { STATIONS } from '@/constants';
import Link from 'next/link';
import { getTodayBangkok } from '@/lib/gas';

interface GasSupply {
    id: string;
    date: string;
    liters: number;
    supplier: string | null;
    invoiceNo: string | null;
    pricePerLiter: number | null;
    totalCost: number | null;
    notes: string | null;
}

export default function GasSupplyPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const stationIndex = parseInt(id) - 1;
    const station = STATIONS[stationIndex];

    const [supplies, setSupplies] = useState<GasSupply[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(false);

    // Form state
    const [formDate, setFormDate] = useState(getTodayBangkok());
    const [formLiters, setFormLiters] = useState('');
    const [formSupplier, setFormSupplier] = useState('');
    const [formInvoiceNo, setFormInvoiceNo] = useState('');
    const [formPricePerLiter, setFormPricePerLiter] = useState('');
    const [formNotes, setFormNotes] = useState('');

    useEffect(() => {
        fetchSupplies();
    }, []);

    const fetchSupplies = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/gas-station/${id}/supplies`);
            if (res.ok) {
                const data = await res.json();
                setSupplies(data);
            }
        } catch (error) {
            console.error('Error fetching supplies:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formLiters) {
            alert('กรุณาระบุจำนวนลิตร');
            return;
        }

        setSaving(true);
        try {
            const res = await fetch(`/api/gas-station/${id}/supplies`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date: formDate,
                    liters: formLiters,
                    supplier: formSupplier || null,
                    invoiceNo: formInvoiceNo || null,
                    pricePerLiter: formPricePerLiter || null,
                    notes: formNotes || null
                })
            });

            if (res.ok) {
                // Reset form
                setFormLiters('');
                setFormSupplier('');
                setFormInvoiceNo('');
                setFormPricePerLiter('');
                setFormNotes('');
                setShowForm(false);
                fetchSupplies();
            } else {
                const err = await res.json();
                alert(err.error || 'บันทึกไม่สำเร็จ');
            }
        } catch (error) {
            console.error('Error saving supply:', error);
            alert('เกิดข้อผิดพลาด');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (supplyId: string) => {
        if (!confirm('ยืนยันลบรายการนี้?')) return;

        setDeletingId(supplyId);
        try {
            const res = await fetch(`/api/gas-station/${id}/supplies?supplyId=${supplyId}`, {
                method: 'DELETE'
            });

            if (res.ok) {
                fetchSupplies();
            } else {
                alert('ลบไม่สำเร็จ');
            }
        } catch (error) {
            console.error('Delete error:', error);
            alert('เกิดข้อผิดพลาด');
        } finally {
            setDeletingId(null);
        }
    };

    const formatCurrency = (num: number) =>
        new Intl.NumberFormat('th-TH', { minimumFractionDigits: 0 }).format(num);

    const formatDate = (dateStr: string) =>
        new Date(dateStr).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });

    const totalLiters = supplies.reduce((sum, s) => sum + s.liters, 0);
    const totalCost = supplies.reduce((sum, s) => sum + (s.totalCost || 0), 0);

    if (!station) {
        return (
            <div className="min-h-screen bg-[#f6f6f6] flex items-center justify-center">
                <p className="text-neutral-500 font-semibold">ไม่พบสถานี</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f6f6f6] text-neutral-900">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-[#f6f6f6]/80 backdrop-blur border-b border-black/10">
                <div className="px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link href={`/gas-station/${id}/new/home`} className="p-1">
                            <ArrowLeft size={24} className="text-neutral-700" />
                        </Link>
                        <div>
                            <h1 className="font-extrabold tracking-tight text-lg">รับแก๊สเข้า</h1>
                            <p className="text-xs text-neutral-500 font-semibold">{station.name}</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowForm(true)}
                        className="inline-flex items-center gap-2 rounded-full bg-orange-500 px-4 py-2 text-sm font-extrabold text-black hover:bg-orange-400 transition"
                    >
                        <Plus size={18} />
                        เพิ่มรายการ
                    </button>
                </div>
            </header>

            <main className="mx-auto max-w-4xl px-4 py-6 space-y-5">
                {/* Summary Card */}
                <div className="rounded-3xl border border-black/10 bg-white p-6">
                    <h2 className="text-xl font-black tracking-tight mb-4">
                        📦 <span className="bg-green-200 px-2 rounded">สรุปการรับเข้า</span>
                    </h2>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="rounded-2xl border border-black/10 bg-gradient-to-br from-green-50 to-green-100 p-4">
                            <div className="text-xs font-black text-green-600">รวมลิตร</div>
                            <div className="mt-1 text-2xl font-black text-green-700">{formatCurrency(totalLiters)}</div>
                            <div className="text-sm font-semibold text-green-600">{supplies.length} ครั้ง</div>
                        </div>
                        <div className="rounded-2xl border border-black/10 bg-gradient-to-br from-blue-50 to-blue-100 p-4">
                            <div className="text-xs font-black text-blue-600">รวมค่าใช้จ่าย</div>
                            <div className="mt-1 text-2xl font-black text-blue-700">฿{formatCurrency(totalCost)}</div>
                            <div className="text-sm font-semibold text-blue-600">บาท</div>
                        </div>
                    </div>
                </div>

                {/* Supplies List */}
                <div className="rounded-3xl border border-black/10 bg-white overflow-hidden">
                    <div className="p-5 border-b border-black/5">
                        <h2 className="text-xl font-black tracking-tight">📋 รายการรับแก๊ส</h2>
                    </div>

                    {loading ? (
                        <div className="flex items-center justify-center h-32">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
                        </div>
                    ) : supplies.length > 0 ? (
                        <div className="divide-y divide-black/5">
                            {supplies.map((s) => (
                                <div key={s.id} className="px-5 py-4 flex items-center justify-between hover:bg-[#fafafa] transition">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Calendar size={14} className="text-neutral-400" />
                                            <span className="text-sm font-semibold text-neutral-600">{formatDate(s.date)}</span>
                                        </div>
                                        <p className="font-extrabold text-xl text-green-700">+{formatCurrency(s.liters)} ลิตร</p>
                                        {s.supplier && (
                                            <p className="text-sm text-neutral-500">ผู้จำหน่าย: {s.supplier}</p>
                                        )}
                                        {s.invoiceNo && (
                                            <p className="text-xs text-neutral-400">เลขที่: {s.invoiceNo}</p>
                                        )}
                                    </div>
                                    <div className="text-right mr-4">
                                        {s.totalCost && (
                                            <p className="font-bold text-neutral-800">฿{formatCurrency(s.totalCost)}</p>
                                        )}
                                        {s.pricePerLiter && (
                                            <p className="text-xs text-neutral-500">@ {s.pricePerLiter} ฿/ลิตร</p>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => handleDelete(s.id)}
                                        disabled={deletingId === s.id}
                                        className="p-2 rounded-full hover:bg-red-50 text-red-400 hover:text-red-600 transition disabled:opacity-50"
                                    >
                                        {deletingId === s.id ? (
                                            <div className="w-5 h-5 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                                        ) : (
                                            <Trash2 size={18} />
                                        )}
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="p-10 text-center">
                            <Package size={40} className="mx-auto mb-3 text-neutral-300" />
                            <p className="text-neutral-400 font-semibold">ยังไม่มีรายการรับแก๊ส</p>
                            <button
                                onClick={() => setShowForm(true)}
                                className="mt-3 inline-flex items-center gap-2 rounded-full bg-orange-500 px-4 py-2 text-sm font-extrabold text-black hover:bg-orange-400 transition"
                            >
                                <Plus size={16} />
                                เพิ่มรายการแรก
                            </button>
                        </div>
                    )}
                </div>
            </main>

            {/* Add Supply Modal */}
            {showForm && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center">
                    <div className="bg-white w-full max-w-md rounded-t-3xl md:rounded-3xl p-6 animate-slide-up max-h-[90vh] overflow-y-auto">
                        <h2 className="text-xl font-black tracking-tight mb-5">📦 บันทึกรับแก๊สเข้า</h2>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* Date */}
                            <div>
                                <label className="block text-sm font-bold text-neutral-600 mb-2">วันที่รับ *</label>
                                <input
                                    type="date"
                                    value={formDate}
                                    onChange={(e) => setFormDate(e.target.value)}
                                    className="w-full rounded-xl border border-black/15 px-4 py-3 text-sm font-semibold focus:outline-none focus:border-orange-500"
                                    required
                                />
                            </div>

                            {/* Liters */}
                            <div>
                                <label className="block text-sm font-bold text-neutral-600 mb-2">จำนวน (ลิตร) *</label>
                                <input
                                    type="number"
                                    value={formLiters}
                                    onChange={(e) => setFormLiters(e.target.value)}
                                    placeholder="เช่น 3000"
                                    className="w-full rounded-xl border border-black/15 px-4 py-3 text-sm font-semibold focus:outline-none focus:border-orange-500"
                                    required
                                    step="0.01"
                                />
                            </div>

                            {/* Supplier */}
                            <div>
                                <label className="block text-sm font-bold text-neutral-600 mb-2">ผู้จำหน่าย</label>
                                <input
                                    type="text"
                                    value={formSupplier}
                                    onChange={(e) => setFormSupplier(e.target.value)}
                                    placeholder="เช่น บริษัท ABC แก๊ส"
                                    className="w-full rounded-xl border border-black/15 px-4 py-3 text-sm font-semibold focus:outline-none focus:border-orange-500"
                                />
                            </div>

                            {/* Invoice No */}
                            <div>
                                <label className="block text-sm font-bold text-neutral-600 mb-2">เลขที่ใบส่งสินค้า</label>
                                <input
                                    type="text"
                                    value={formInvoiceNo}
                                    onChange={(e) => setFormInvoiceNo(e.target.value)}
                                    placeholder="เช่น INV-2025-001"
                                    className="w-full rounded-xl border border-black/15 px-4 py-3 text-sm font-semibold focus:outline-none focus:border-orange-500"
                                />
                            </div>

                            {/* Price per Liter */}
                            <div>
                                <label className="block text-sm font-bold text-neutral-600 mb-2">ราคาต่อลิตร (บาท)</label>
                                <input
                                    type="number"
                                    value={formPricePerLiter}
                                    onChange={(e) => setFormPricePerLiter(e.target.value)}
                                    placeholder="เช่น 12.50"
                                    className="w-full rounded-xl border border-black/15 px-4 py-3 text-sm font-semibold focus:outline-none focus:border-orange-500"
                                    step="0.01"
                                />
                            </div>

                            {/* Calculated Total */}
                            {formLiters && formPricePerLiter && (
                                <div className="rounded-xl bg-green-50 border border-green-200 p-3">
                                    <p className="text-sm font-black text-green-600">
                                        รวม: ฿{formatCurrency(parseFloat(formLiters) * parseFloat(formPricePerLiter))}
                                    </p>
                                </div>
                            )}

                            {/* Notes */}
                            <div>
                                <label className="block text-sm font-bold text-neutral-600 mb-2">หมายเหตุ</label>
                                <textarea
                                    value={formNotes}
                                    onChange={(e) => setFormNotes(e.target.value)}
                                    placeholder="บันทึกเพิ่มเติม..."
                                    rows={2}
                                    className="w-full rounded-xl border border-black/15 px-4 py-3 text-sm font-semibold focus:outline-none focus:border-orange-500 resize-none"
                                />
                            </div>

                            {/* Buttons */}
                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowForm(false)}
                                    className="flex-1 rounded-full border border-black/15 bg-white px-6 py-3 text-sm font-extrabold hover:bg-neutral-50 transition"
                                >
                                    ยกเลิก
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="flex-1 rounded-full bg-orange-500 px-6 py-3 text-sm font-extrabold text-black hover:bg-orange-400 transition disabled:opacity-50"
                                >
                                    {saving ? 'กำลังบันทึก...' : 'บันทึก →'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
