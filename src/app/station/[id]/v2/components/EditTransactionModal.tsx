'use client';

import { useState, useEffect } from 'react';
import { X, Save, Loader2 } from 'lucide-react';
import { PAYMENT_TYPES } from '@/constants';

interface Transaction {
    id: string;
    date: string;
    licensePlate: string;
    ownerName: string;
    ownerCode?: string | null;
    paymentType: string;
    nozzleNumber: number;
    liters: number;
    pricePerLiter: number;
    amount: number;
    billBookNo?: string;
    billNo?: string;
}

interface EditTransactionModalProps {
    stationId: string;
    transaction: Transaction;
    onClose: () => void;
    onSuccess: () => void;
}

export default function EditTransactionModal({
    stationId,
    transaction,
    onClose,
    onSuccess,
}: EditTransactionModalProps) {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        licensePlate: transaction.licensePlate || '',
        liters: transaction.liters.toString(),
        pricePerLiter: transaction.pricePerLiter.toString(),
        amount: transaction.amount.toString(),
        paymentType: transaction.paymentType,
        nozzleNumber: transaction.nozzleNumber.toString(),
        billBookNo: transaction.billBookNo || '',
        billNo: transaction.billNo || '',
    });

    // Auto-calculate amount when liters or price changes
    useEffect(() => {
        const liters = parseFloat(formData.liters) || 0;
        const price = parseFloat(formData.pricePerLiter) || 0;
        const calculatedAmount = liters * price;
        setFormData(prev => ({
            ...prev,
            amount: calculatedAmount.toFixed(2),
        }));
    }, [formData.liters, formData.pricePerLiter]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const res = await fetch(`/api/station/${stationId}/transactions/${transaction.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    licensePlate: formData.licensePlate,
                    liters: parseFloat(formData.liters),
                    pricePerLiter: parseFloat(formData.pricePerLiter),
                    amount: parseFloat(formData.amount),
                    paymentType: formData.paymentType,
                    nozzleNumber: parseInt(formData.nozzleNumber),
                    billBookNo: formData.billBookNo || null,
                    billNo: formData.billNo || null,
                }),
            });

            if (res.ok) {
                onSuccess();
            } else {
                const error = await res.json();
                alert(error.error || 'แก้ไขไม่สำเร็จ');
            }
        } catch {
            alert('เกิดข้อผิดพลาด');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
            <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
                    <button onClick={onClose} className="p-2 -ml-2 text-gray-500">
                        <X size={24} />
                    </button>
                    <h1 className="flex-1 text-center font-bold text-lg">แก้ไขรายการ</h1>
                    <div className="w-10" />
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-4 space-y-4">
                    {/* License Plate */}
                    <div>
                        <label className="text-sm font-medium text-gray-700 block mb-1">
                            ทะเบียนรถ
                        </label>
                        <input
                            type="text"
                            value={formData.licensePlate}
                            onChange={e => setFormData({ ...formData, licensePlate: e.target.value })}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    {/* Payment Type */}
                    <div>
                        <label className="text-sm font-medium text-gray-700 block mb-1">
                            ประเภทการชำระ
                        </label>
                        <select
                            value={formData.paymentType}
                            onChange={e => setFormData({ ...formData, paymentType: e.target.value })}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            {PAYMENT_TYPES.map(pt => (
                                <option key={pt.value} value={pt.value}>{pt.label}</option>
                            ))}
                        </select>
                    </div>

                    {/* Nozzle */}
                    <div>
                        <label className="text-sm font-medium text-gray-700 block mb-1">
                            หัวจ่าย
                        </label>
                        <select
                            value={formData.nozzleNumber}
                            onChange={e => setFormData({ ...formData, nozzleNumber: e.target.value })}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            {[1, 2, 3, 4].map(n => (
                                <option key={n} value={n}>หัว {n}</option>
                            ))}
                        </select>
                    </div>

                    {/* Liters */}
                    <div>
                        <label className="text-sm font-medium text-gray-700 block mb-1">
                            จำนวนลิตร
                        </label>
                        <input
                            type="number"
                            step="0.01"
                            value={formData.liters}
                            onChange={e => setFormData({ ...formData, liters: e.target.value })}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-right text-lg font-mono"
                            required
                        />
                    </div>

                    {/* Price */}
                    <div>
                        <label className="text-sm font-medium text-gray-700 block mb-1">
                            ราคา/ลิตร
                        </label>
                        <input
                            type="number"
                            step="0.01"
                            value={formData.pricePerLiter}
                            onChange={e => setFormData({ ...formData, pricePerLiter: e.target.value })}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-right font-mono"
                            required
                        />
                    </div>

                    {/* Amount (auto-calculated) */}
                    <div>
                        <label className="text-sm font-medium text-gray-700 block mb-1">
                            ยอดเงิน (คำนวณอัตโนมัติ)
                        </label>
                        <input
                            type="text"
                            value={new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(parseFloat(formData.amount) || 0)}
                            readOnly
                            className="w-full px-4 py-3 bg-green-50 border border-green-200 rounded-xl text-right text-lg font-bold text-green-700"
                        />
                    </div>

                    {/* Bill Info (for CREDIT) */}
                    {formData.paymentType === 'CREDIT' && (
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-sm font-medium text-gray-700 block mb-1">
                                    เล่มที่
                                </label>
                                <input
                                    type="text"
                                    value={formData.billBookNo}
                                    onChange={e => setFormData({ ...formData, billBookNo: e.target.value })}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-gray-700 block mb-1">
                                    เลขที่
                                </label>
                                <input
                                    type="text"
                                    value={formData.billNo}
                                    onChange={e => setFormData({ ...formData, billNo: e.target.value })}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>
                    )}

                    {/* Submit */}
                    <button
                        type="submit"
                        disabled={loading || !formData.liters}
                        className="w-full py-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-bold text-lg rounded-xl shadow-lg active:scale-[0.98] transition disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <Loader2 className="animate-spin" size={24} />
                        ) : (
                            <>
                                <Save size={20} />
                                บันทึกการแก้ไข
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}
