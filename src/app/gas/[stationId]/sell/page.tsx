'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    FuelIcon,
    Banknote,
    CreditCard,
    Smartphone,
    Search,
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

export default function SellPage() {
    const params = useParams();
    const router = useRouter();
    const stationId = params.stationId as string;

    const [loading, setLoading] = useState(false);
    const [gasPrice, setGasPrice] = useState<number>(16.09);
    const [success, setSuccess] = useState(false);

    // Form state
    const [paymentType, setPaymentType] = useState<PaymentType>('CASH');
    const [liters, setLiters] = useState<string>('');
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
                const res = await fetch('/api/v2/gas/settings?key=gasPrice');
                if (res.ok) {
                    const data = await res.json();
                    setGasPrice(parseFloat(data.value));
                }
            } catch (error) {
                console.error('Error fetching gas price:', error);
            }
        };
        fetchGasPrice();
    }, []);

    // Auto-calculate amount when liters change
    useEffect(() => {
        if (liters) {
            const calculatedAmount = parseFloat(liters) * gasPrice;
            setAmount(calculatedAmount.toFixed(2));
        } else {
            setAmount('');
        }
    }, [liters, gasPrice]);

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

    const validateForm = (): boolean => {
        const newErrors: string[] = [];

        if (!liters || parseFloat(liters) <= 0) {
            newErrors.push('ต้องกรอกจำนวนลิตร');
        }

        if (paymentType === 'CREDIT') {
            if (!selectedOwner) {
                newErrors.push('ต้องเลือกลูกค้าเงินเชื่อ');
            }
            if (!selectedTruck) {
                newErrors.push('ต้องเลือกรถ');
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
                    liters: parseFloat(liters),
                    pricePerLiter: gasPrice,
                    amount: parseFloat(amount),
                    ownerId: selectedOwner?.id,
                    truckId: selectedTruck?.id,
                    licensePlate: selectedTruck?.licensePlate,
                    bookNo: bookNo || null,
                    billNo: billNo || null,
                    notes
                })
            });

            if (res.ok) {
                setSuccess(true);
                setTimeout(() => {
                    // Reset form
                    setPaymentType('CASH');
                    setLiters('');
                    setAmount('');
                    setBookNo('');
                    setBillNo('');
                    setNotes('');
                    setSelectedOwner(null);
                    setSelectedTruck(null);
                    setSearchQuery('');
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
                    <p className="text-3xl font-bold text-green-400">฿{formatCurrency(parseFloat(amount))}</p>
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
                    <p className="text-gray-400 text-sm">ราคา ฿{gasPrice}/ลิตร</p>
                </div>
            </div>

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

            {/* Liters Input */}
            <div className="bg-[#1a1a24] rounded-xl p-4 mb-4 border border-white/10">
                <label className="block text-sm text-gray-400 mb-2">จำนวนลิตร</label>
                <input
                    type="number"
                    step="0.01"
                    value={liters}
                    onChange={(e) => setLiters(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-gray-800 border border-white/10 rounded-lg px-4 py-4 text-2xl font-mono text-center focus:border-orange-500 focus:outline-none"
                />
            </div>

            {/* Amount Display */}
            <div className="bg-gradient-to-r from-orange-900/30 to-red-900/30 rounded-xl p-6 mb-4 border border-orange-500/30 text-center">
                <div className="text-gray-400 text-sm mb-1">ยอดเงิน</div>
                <div className="text-4xl font-bold text-white">
                    ฿{amount ? formatCurrency(parseFloat(amount)) : '0.00'}
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
                disabled={loading || !liters}
                className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all ${loading || !liters
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
