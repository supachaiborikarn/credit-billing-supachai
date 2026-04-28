'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    FuelIcon,
    Banknote,
    CreditCard,
    Smartphone,
    CheckCircle,
    Loader2,
    AlertCircle,
    ArrowLeft
} from 'lucide-react';
import { PAYMENT_TYPES, PAYMENT_TYPE_INFO, formatCurrency, type PaymentType } from '@/lib/gas';


interface Owner {
    id: string;
    name: string;
    trucks: { id: string; licensePlate: string }[];
}

type PriceNotice = {
    type: 'success' | 'error';
    text: string;
};

export default function SellPage() {
    const params = useParams();
    const router = useRouter();
    const stationId = params.stationId as string;

    const [loading, setLoading] = useState(false);
    const [gasPrice, setGasPrice] = useState<number>(16.09);
    const [priceInput, setPriceInput] = useState('16.09');
    const [editingPrice, setEditingPrice] = useState(false);
    const [savingPrice, setSavingPrice] = useState(false);
    const [priceNotice, setPriceNotice] = useState<PriceNotice | null>(null);
    const [success, setSuccess] = useState(false);
    const [successAmount, setSuccessAmount] = useState<number>(0);

    // Form state
    const [paymentType, setPaymentType] = useState<PaymentType>('CASH');
    const [amount, setAmount] = useState<string>('');
    const [bookNo, setBookNo] = useState<string>('');
    const [billNo, setBillNo] = useState<string>('');
    const [notes, setNotes] = useState<string>('');

    // Credit customer state
    const [allOwners, setAllOwners] = useState<Owner[]>([]);
    const [filteredOwners, setFilteredOwners] = useState<Owner[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedOwner, setSelectedOwner] = useState<Owner | null>(null);
    const [selectedTruck, setSelectedTruck] = useState<{ id: string; licensePlate: string } | null>(null);
    const [showDropdown, setShowDropdown] = useState(false);
    const [loadingOwners, setLoadingOwners] = useState(false);

    const [errors, setErrors] = useState<string[]>([]);

    // Fetch gas price on mount
    useEffect(() => {
        const fetchGasPrice = async () => {
            try {
                const res = await fetch(`/api/v2/gas/${stationId}/summary`);
                if (res.ok) {
                    const data = await res.json();
                    const nextGasPrice = Number(data.gasPrice);
                    if (Number.isFinite(nextGasPrice) && nextGasPrice > 0) {
                        setGasPrice(nextGasPrice);
                        if (!editingPrice) {
                            setPriceInput(nextGasPrice.toFixed(2));
                        }
                    }
                }
            } catch (error) {
                console.error('Error fetching gas price:', error);
            }
        };
        fetchGasPrice();
    }, [editingPrice, stationId]);

    // Load all owners on mount
    useEffect(() => {
        const fetchOwners = async () => {
            setLoadingOwners(true);
            try {
                const res = await fetch('/api/owners?limit=500');
                if (res.ok) {
                    const data = await res.json();
                    const owners = data.owners || data || [];
                    setAllOwners(owners);
                    setFilteredOwners(owners);
                }
            } catch (error) {
                console.error('Error fetching owners:', error);
            } finally {
                setLoadingOwners(false);
            }
        };
        fetchOwners();
    }, []);

    // Filter owners based on search
    useEffect(() => {
        if (!searchQuery.trim()) {
            setFilteredOwners(allOwners);
        } else {
            const q = searchQuery.toLowerCase();
            const filtered = allOwners.filter(o =>
                o.name.toLowerCase().includes(q) ||
                o.trucks.some(t => t.licensePlate.toLowerCase().includes(q))
            );
            setFilteredOwners(filtered);
        }
    }, [searchQuery, allOwners]);

    const handleSelectOwner = (owner: Owner) => {
        setSelectedOwner(owner);
        setShowDropdown(false);
        setSearchQuery('');
        // Auto-select first truck if only one
        if (owner.trucks.length === 1) {
            setSelectedTruck(owner.trucks[0]);
        } else {
            setSelectedTruck(null);
        }
    };

    const handleSaveGasPrice = async () => {
        const nextPrice = Number(priceInput);
        if (!Number.isFinite(nextPrice) || nextPrice <= 0) {
            setPriceNotice({ type: 'error', text: 'กรุณากรอกราคาขายมากกว่า 0' });
            return;
        }

        setSavingPrice(true);
        setPriceNotice(null);

        try {
            const res = await fetch(`/api/v2/gas/${stationId}/price`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ gasPrice: nextPrice }),
            });
            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                throw new Error(data.error || 'อัปเดตราคาไม่สำเร็จ');
            }

            const savedPrice = Number(data.gasPrice ?? nextPrice);
            setGasPrice(savedPrice);
            setPriceInput(savedPrice.toFixed(2));
            setEditingPrice(false);
            setPriceNotice({ type: 'success', text: 'อัปเดตราคาขายและตั้งเป็นราคาหลักแล้ว' });
        } catch (error) {
            setPriceNotice({
                type: 'error',
                text: error instanceof Error ? error.message : 'อัปเดตราคาไม่สำเร็จ',
            });
        } finally {
            setSavingPrice(false);
        }
    };

    const handleCancelPriceEdit = () => {
        setEditingPrice(false);
        setPriceInput(gasPrice.toFixed(2));
        setPriceNotice(null);
    };

    const parsedAmount = Number.parseFloat(amount);
    const saleAmount = Number.isFinite(parsedAmount) ? parsedAmount : 0;
    const calculatedLiters = saleAmount > 0 && gasPrice > 0
        ? saleAmount / gasPrice
        : 0;

    const validateForm = (): boolean => {
        const newErrors: string[] = [];

        if (!amount || saleAmount <= 0) {
            newErrors.push('ต้องกรอกยอดเงินขาย');
        }

        if (paymentType === 'CREDIT') {
            if (!selectedOwner) {
                newErrors.push('ต้องเลือกลูกค้าเงินเชื่อ');
            }
            if (!selectedTruck) {
                newErrors.push('ต้องเลือกรถ');
            }
            if (!bookNo.trim()) {
                newErrors.push('ต้องกรอกเล่มที่บิล');
            }
            if (!billNo.trim()) {
                newErrors.push('ต้องกรอกเลขที่บิล');
            }
        }

        setErrors(newErrors);
        return newErrors.length === 0;
    };

    const handleSubmit = async () => {
        if (!validateForm()) return;

        setLoading(true);
        setErrors([]);

        try {
            const res = await fetch(`/api/v2/gas/${stationId}/sell`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    paymentType,
                    amount: saleAmount,
                    ownerId: selectedOwner?.id,
                    truckId: selectedTruck?.id,
                    licensePlate: selectedTruck?.licensePlate,
                    bookNo: bookNo || null,
                    billNo: billNo || null,
                    notes
                })
            });

            if (res.ok) {
                const data = await res.json();
                setSuccessAmount(typeof data.amount === 'number' ? data.amount : parseFloat(amount));
                setSuccess(true);
                setTimeout(() => {
                    // Reset form
                    setPaymentType('CASH');
                    setAmount('');
                    setBookNo('');
                    setBillNo('');
                    setNotes('');
                    setSelectedOwner(null);
                    setSelectedTruck(null);
                    setSearchQuery('');
                    setSuccessAmount(0);
                    setSuccess(false);
                }, 2000);
            } else {
                const data = await res.json();
                setErrors([data.error || 'ไม่สามารถบันทึกได้']);
            }
        } catch (error) {
            console.error('Error recording sale:', error);
            setErrors(['เกิดข้อผิดพลาด กรุณาลองใหม่']);
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="max-w-lg mx-auto text-center">
                <div className="bg-green-900/30 rounded-2xl p-8 border border-green-500/30">
                    <CheckCircle className="mx-auto text-green-400 mb-4" size={60} />
                    <h2 className="text-2xl font-bold mb-2">บันทึกสำเร็จ!</h2>
                    <p className="text-gray-400 mb-2">
                        {PAYMENT_TYPE_INFO[paymentType].icon} {PAYMENT_TYPE_INFO[paymentType].name}
                    </p>
                    <p className="text-3xl font-bold text-green-400">฿{formatCurrency(successAmount)}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-lg mx-auto">
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
                <button
                    onClick={() => router.push(`/gas/${stationId}`)}
                    className="p-2 hover:bg-white/10 rounded-lg"
                >
                    <ArrowLeft size={24} />
                </button>
                <div>
                    <h1 className="text-2xl font-bold">บันทึกขาย</h1>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                        <p className="text-gray-400 text-sm">
                            ราคา ฿{formatCurrency(gasPrice)}/ลิตร
                        </p>
                        <button
                            onClick={() => {
                                setEditingPrice(true);
                                setPriceNotice(null);
                            }}
                            className="rounded-full border border-amber-500/40 px-3 py-1 text-xs font-medium text-amber-200 hover:bg-amber-500/10"
                        >
                            แก้ราคา
                        </button>
                    </div>
                </div>
            </div>

            {/* Daily Gas Price Editor */}
            {editingPrice && (
                <div className="bg-[#1a1a24] rounded-xl p-4 mb-4 border border-amber-500/30">
                    <label className="block text-sm text-amber-200 mb-2">ราคาขายแก๊สหลัก</label>
                    <div className="flex gap-2">
                        <input
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            min="0"
                            value={priceInput}
                            onChange={(e) => setPriceInput(e.target.value)}
                            placeholder="0.00"
                            className="min-w-0 flex-1 bg-gray-800 border border-amber-500/50 rounded-lg px-4 py-3 text-right text-xl font-mono focus:border-amber-300 focus:outline-none"
                        />
                        <button
                            onClick={handleSaveGasPrice}
                            disabled={savingPrice}
                            className="rounded-lg bg-amber-500 px-4 py-3 text-sm font-bold text-gray-950 hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {savingPrice ? 'กำลังบันทึก' : 'บันทึก'}
                        </button>
                        <button
                            onClick={handleCancelPriceEdit}
                            disabled={savingPrice}
                            className="rounded-lg border border-white/15 px-4 py-3 text-sm text-gray-300 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            ยกเลิก
                        </button>
                    </div>
                    <p className="mt-2 text-xs text-amber-200/80">
                        ราคานี้จะใช้กับรายการขายใหม่และเป็นราคาหลักจนกว่าจะเปลี่ยนครั้งถัดไป รายการเดิมจะคงราคาเดิม
                    </p>
                </div>
            )}

            {priceNotice && (
                <div className={`rounded-xl border p-4 mb-4 text-sm ${priceNotice.type === 'success'
                    ? 'bg-green-900/30 border-green-500/30 text-green-300'
                    : 'bg-red-900/30 border-red-500/30 text-red-300'
                    }`}
                >
                    {priceNotice.text}
                </div>
            )}

            {/* Errors */}
            {errors.length > 0 && (
                <div className="bg-red-900/30 border border-red-500/30 rounded-xl p-4 mb-6">
                    <div className="flex items-center gap-2 text-red-400 mb-2">
                        <AlertCircle size={20} />
                        <span className="font-medium">กรุณาแก้ไข</span>
                    </div>
                    <ul className="text-sm text-red-300 space-y-1">
                        {errors.map((e, i) => <li key={i}>• {e}</li>)}
                    </ul>
                </div>
            )}

            {/* Payment Type Selection */}
            <div className="bg-[#1a1a24] rounded-xl p-4 mb-4 border border-white/10">
                <label className="block text-sm text-gray-400 mb-3">ประเภทการชำระ</label>
                <div className="grid grid-cols-4 gap-2">
                    {PAYMENT_TYPES.map((type) => {
                        const info = PAYMENT_TYPE_INFO[type];
                        const isSelected = paymentType === type;
                        return (
                            <button
                                key={type}
                                onClick={() => setPaymentType(type)}
                                className={`flex flex-col items-center gap-1 p-3 rounded-xl border transition-all ${isSelected
                                    ? 'bg-orange-600/30 border-orange-500 ' + info.color
                                    : 'bg-gray-800 border-white/10 text-gray-400 hover:border-white/30'
                                    }`}
                            >
                                {type === 'CASH' && <Banknote size={20} />}
                                {type === 'CREDIT' && <FuelIcon size={20} />}
                                {type === 'CREDIT_CARD' && <CreditCard size={20} />}
                                {type === 'TRANSFER' && <Smartphone size={20} />}
                                <span className="text-xs">{info.name}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Credit Customer Dropdown */}
            {paymentType === 'CREDIT' && (
                <div className="bg-[#1a1a24] rounded-xl p-4 mb-4 border border-white/10">
                    <label className="block text-sm text-gray-400 mb-2">เลือกลูกค้าเงินเชื่อ</label>

                    {/* Selected Owner Display or Dropdown Trigger */}
                    {selectedOwner ? (
                        <div className="bg-purple-900/30 rounded-lg p-3 border border-purple-500/30">
                            <div className="flex items-center justify-between mb-2">
                                <div className="text-purple-400 font-medium">{selectedOwner.name}</div>
                                <button
                                    onClick={() => { setSelectedOwner(null); setSelectedTruck(null); }}
                                    className="text-xs text-gray-400 hover:text-white px-2 py-1 bg-gray-800 rounded"
                                >
                                    เปลี่ยน
                                </button>
                            </div>
                            {selectedOwner.trucks.length > 1 ? (
                                <select
                                    value={selectedTruck?.id || ''}
                                    onChange={(e) => {
                                        const truck = selectedOwner.trucks.find(t => t.id === e.target.value);
                                        setSelectedTruck(truck || null);
                                    }}
                                    className="w-full bg-gray-800 border border-white/10 rounded-lg px-3 py-2"
                                >
                                    <option value="">เลือกรถ</option>
                                    {selectedOwner.trucks.map((truck) => (
                                        <option key={truck.id} value={truck.id}>
                                            {truck.licensePlate}
                                        </option>
                                    ))}
                                </select>
                            ) : selectedTruck && (
                                <div className="text-white font-mono">
                                    🚗 {selectedTruck.licensePlate}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="relative">
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => { setSearchQuery(e.target.value); setShowDropdown(true); }}
                                onFocus={() => setShowDropdown(true)}
                                placeholder={loadingOwners ? 'กำลังโหลด...' : 'พิมพ์ชื่อหรือทะเบียน หรือเลือกจากรายการ...'}
                                className="w-full bg-gray-800 border border-orange-500/50 rounded-lg px-4 py-3 focus:border-orange-500 focus:outline-none"
                            />

                            {/* Dropdown List */}
                            {showDropdown && (
                                <div className="absolute z-20 w-full mt-1 bg-gray-800 rounded-lg border border-white/20 max-h-60 overflow-y-auto shadow-lg">
                                    {filteredOwners.length > 0 ? (
                                        filteredOwners.slice(0, 50).map((owner) => (
                                            <button
                                                key={owner.id}
                                                onClick={() => handleSelectOwner(owner)}
                                                className="w-full text-left px-4 py-3 hover:bg-orange-600/30 border-b border-white/5 last:border-0"
                                            >
                                                <div className="font-medium text-white">{owner.name}</div>
                                                <div className="text-xs text-gray-400">
                                                    {owner.trucks.length > 0
                                                        ? owner.trucks.map(t => t.licensePlate).join(', ')
                                                        : 'ไม่มีรถในระบบ'
                                                    }
                                                </div>
                                            </button>
                                        ))
                                    ) : (
                                        <div className="px-4 py-3 text-gray-400 text-center">
                                            {loadingOwners ? 'กำลังโหลด...' : 'ไม่พบลูกค้า'}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Close dropdown when clicking outside */}
                    {showDropdown && (
                        <div
                            className="fixed inset-0 z-10"
                            onClick={() => setShowDropdown(false)}
                        />
                    )}
                </div>
            )}

            {/* Amount Input */}
            <div className="bg-[#1a1a24] rounded-xl p-4 mb-4 border border-white/10">
                <label className="block text-sm text-gray-400 mb-2">ยอดเงินที่ขาย (บาท)</label>
                <input
                    type="number"
                    step="0.01"
                    min="0"
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-gray-800 border border-white/10 rounded-lg px-4 py-4 text-2xl font-mono text-center focus:border-orange-500 focus:outline-none"
                />
            </div>

            {/* Calculated Liters Display */}
            <div className="bg-gradient-to-r from-orange-900/30 to-red-900/30 rounded-xl p-6 mb-4 border border-orange-500/30 text-center">
                <div className="text-gray-400 text-sm mb-1">ระบบคำนวณลิตรจากราคาวันนี้</div>
                <div className="text-4xl font-bold text-white">
                    {calculatedLiters.toLocaleString('th-TH', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 5,
                    })} L
                </div>
                <div className="mt-2 text-xs text-gray-400">
                    ฿{formatCurrency(saleAmount)} ÷ ฿{formatCurrency(gasPrice)}/ลิตร
                </div>
            </div>

            {/* Book/Bill Number Fields - Required for Credit */}
            {paymentType === 'CREDIT' && (
                <div className="bg-purple-900/20 rounded-xl p-4 mb-4 border border-purple-500/30">
                    <div className="text-sm text-purple-300 mb-3 font-medium">📝 ข้อมูลบิล (เงินเชื่อ)</div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm text-gray-400 mb-1">เล่มที่ *</label>
                            <input
                                type="text"
                                value={bookNo}
                                onChange={(e) => setBookNo(e.target.value)}
                                placeholder="1"
                                className="w-full bg-gray-800 border border-purple-500/50 rounded-lg px-3 py-2 focus:border-purple-400 focus:outline-none text-center font-mono"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-gray-400 mb-1">เลขที่บิล *</label>
                            <input
                                type="text"
                                value={billNo}
                                onChange={(e) => setBillNo(e.target.value)}
                                placeholder="000001"
                                className="w-full bg-gray-800 border border-purple-500/50 rounded-lg px-3 py-2 focus:border-purple-400 focus:outline-none text-center font-mono"
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Optional Fields */}
            <div className="bg-[#1a1a24] rounded-xl p-4 mb-6 border border-white/10">
                <div className="grid grid-cols-2 gap-4">
                    {paymentType !== 'CREDIT' && (
                        <div>
                            <label className="block text-sm text-gray-400 mb-1">เลขที่บิล (ถ้ามี)</label>
                            <input
                                type="text"
                                value={billNo}
                                onChange={(e) => setBillNo(e.target.value)}
                                placeholder="000000"
                                className="w-full bg-gray-800 border border-white/10 rounded-lg px-3 py-2 focus:border-orange-500 focus:outline-none"
                            />
                        </div>
                    )}
                    <div className={paymentType !== 'CREDIT' ? '' : 'col-span-2'}>
                        <label className="block text-sm text-gray-400 mb-1">หมายเหตุ</label>
                        <input
                            type="text"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="-"
                            className="w-full bg-gray-800 border border-white/10 rounded-lg px-3 py-2 focus:border-orange-500 focus:outline-none"
                        />
                    </div>
                </div>
            </div>

            {/* Submit Button */}
            <button
                onClick={handleSubmit}
                disabled={loading || saleAmount <= 0}
                className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all ${loading || saleAmount <= 0
                    ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white shadow-lg'
                    }`}
            >
                {loading ? (
                    <Loader2 className="animate-spin" size={24} />
                ) : (
                    <CheckCircle size={24} />
                )}
                บันทึก
            </button>
        </div>
    );
}
