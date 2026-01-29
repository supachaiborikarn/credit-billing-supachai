'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Save, Loader2, Search, ChevronDown } from 'lucide-react';
import { PAYMENT_TYPES } from '@/constants';

interface Transaction {
    id: string;
    date: string;
    licensePlate: string;
    ownerName: string;
    ownerCode?: string | null;
    ownerId?: string | null;
    paymentType: string;
    nozzleNumber: number;
    liters: number;
    pricePerLiter: number;
    amount: number;
    billBookNo?: string;
    billNo?: string;
}

interface Owner {
    id: string;
    name: string;
    code: string | null;
    licensePlates?: string[];
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
    const [owners, setOwners] = useState<Owner[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [showOwnerDropdown, setShowOwnerDropdown] = useState(false);
    const [selectedOwner, setSelectedOwner] = useState<Owner | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const [formData, setFormData] = useState({
        licensePlate: transaction.licensePlate || '',
        ownerName: transaction.ownerName || '',
        ownerId: transaction.ownerId || null as string | null,
        liters: transaction.liters.toString(),
        pricePerLiter: transaction.pricePerLiter.toString(),
        amount: transaction.amount.toString(),
        paymentType: transaction.paymentType,
        nozzleNumber: transaction.nozzleNumber.toString(),
        billBookNo: transaction.billBookNo || '',
        billNo: transaction.billNo || '',
    });

    // Fetch owners on mount
    useEffect(() => {
        const fetchOwners = async () => {
            try {
                const res = await fetch('/api/owners');
                if (res.ok) {
                    const data = await res.json();
                    setOwners(data);
                    // Find matching owner
                    const match = data.find((o: Owner) => o.name === transaction.ownerName);
                    if (match) setSelectedOwner(match);
                }
            } catch (error) {
                console.error('Failed to fetch owners:', error);
            }
        };
        fetchOwners();
    }, [transaction.ownerName]);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setShowOwnerDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Filter owners
    const filteredOwners = owners.filter(o =>
        o.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (o.code && o.code.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (o.licensePlates && o.licensePlates.some(lp => lp.toLowerCase().includes(searchQuery.toLowerCase())))
    );

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

    const handleOwnerSelect = (owner: Owner) => {
        setSelectedOwner(owner);
        setFormData(prev => ({
            ...prev,
            ownerName: owner.name,
            ownerId: owner.id,
            licensePlate: owner.licensePlates?.[0] || prev.licensePlate,
        }));
        setShowOwnerDropdown(false);
        setSearchQuery('');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const res = await fetch(`/api/station/${stationId}/transactions/${transaction.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    licensePlate: formData.licensePlate,
                    ownerName: formData.ownerName,
                    ownerId: formData.ownerId,
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

    const inputBaseClass = "w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white";
    const inputNumberClass = `${inputBaseClass} text-right text-lg font-mono font-semibold`;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
            <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between z-10">
                    <button onClick={onClose} className="p-2 -ml-2 text-gray-500">
                        <X size={24} />
                    </button>
                    <h1 className="flex-1 text-center font-bold text-lg text-gray-900">แก้ไขรายการ</h1>
                    <div className="w-10" />
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-4 space-y-4">
                    {/* Owner Dropdown */}
                    <div ref={dropdownRef} className="relative">
                        <label className="text-sm font-medium text-gray-700 block mb-1">
                            ลูกค้า / เจ้าของรถ
                        </label>
                        <button
                            type="button"
                            onClick={() => setShowOwnerDropdown(!showOwnerDropdown)}
                            className={`${inputBaseClass} flex items-center justify-between`}
                        >
                            <span className={selectedOwner ? 'text-gray-900' : 'text-gray-400'}>
                                {selectedOwner ? `${selectedOwner.name}${selectedOwner.code ? ` (${selectedOwner.code})` : ''}` : 'เลือกลูกค้า...'}
                            </span>
                            <ChevronDown size={18} className="text-gray-400" />
                        </button>

                        {showOwnerDropdown && (
                            <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-hidden">
                                {/* Search */}
                                <div className="p-2 border-b border-gray-100">
                                    <div className="relative">
                                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                        <input
                                            type="text"
                                            value={searchQuery}
                                            onChange={e => setSearchQuery(e.target.value)}
                                            placeholder="ค้นหาชื่อ, รหัส, หรือทะเบียน..."
                                            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            autoFocus
                                        />
                                    </div>
                                </div>

                                {/* Options */}
                                <div className="max-h-48 overflow-y-auto">
                                    {filteredOwners.length > 0 ? (
                                        filteredOwners.slice(0, 20).map(owner => (
                                            <button
                                                key={owner.id}
                                                type="button"
                                                onClick={() => handleOwnerSelect(owner)}
                                                className="w-full px-4 py-3 text-left hover:bg-blue-50 flex items-center justify-between"
                                            >
                                                <div>
                                                    <p className="font-medium text-gray-900">{owner.name}</p>
                                                    <p className="text-xs text-gray-500">
                                                        {owner.code && <span className="mr-2">รหัส: {owner.code}</span>}
                                                        {owner.licensePlates && owner.licensePlates.length > 0 && (
                                                            <span>ทะเบียน: {owner.licensePlates.slice(0, 2).join(', ')}</span>
                                                        )}
                                                    </p>
                                                </div>
                                            </button>
                                        ))
                                    ) : (
                                        <p className="px-4 py-3 text-gray-400 text-center">ไม่พบข้อมูล</p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* License Plate */}
                    <div>
                        <label className="text-sm font-medium text-gray-700 block mb-1">
                            ทะเบียนรถ
                        </label>
                        <input
                            type="text"
                            value={formData.licensePlate}
                            onChange={e => setFormData({ ...formData, licensePlate: e.target.value })}
                            className={inputBaseClass}
                            placeholder="กรอกทะเบียนรถ"
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
                            className={inputBaseClass}
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
                            className={inputBaseClass}
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
                            className={inputNumberClass}
                            placeholder="0.00"
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
                            className={inputNumberClass}
                            placeholder="0.00"
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
                            className="w-full px-4 py-3 bg-green-50 border border-green-300 rounded-xl text-right text-xl font-bold text-green-700"
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
                                    className={inputBaseClass}
                                    placeholder="เล่ม"
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
                                    className={inputBaseClass}
                                    placeholder="เลขที่"
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

