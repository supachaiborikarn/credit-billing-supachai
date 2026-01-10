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
import { PAYMENT_TYPE_INFO, formatCurrency, parseCurrency } from '@/lib/gas';

type PaymentType = 'CASH' | 'CREDIT' | 'CARD' | 'TRANSFER';

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
    const [billNo, setBillNo] = useState<string>('');
    const [notes, setNotes] = useState<string>('');

    // Credit customer state
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<Owner[]>([]);
    const [selectedOwner, setSelectedOwner] = useState<Owner | null>(null);
    const [selectedTruck, setSelectedTruck] = useState<{ id: string; licensePlate: string } | null>(null);
    const [searching, setSearching] = useState(false);

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

    // Search customers for credit
    const handleSearch = async () => {
        if (!searchQuery.trim()) return;

        setSearching(true);
        try {
            const res = await fetch(`/api/owners/search?q=${encodeURIComponent(searchQuery)}`);
            if (res.ok) {
                const data = await res.json();
                setSearchResults(data.owners || []);
            }
        } catch (error) {
            console.error('Error searching owners:', error);
        } finally {
            setSearching(false);
        }
    };

    const handleSelectOwner = (owner: Owner) => {
        setSelectedOwner(owner);
        setSearchResults([]);
        setSearchQuery(owner.name);
        // Auto-select first truck if only one
        if (owner.trucks.length === 1) {
            setSelectedTruck(owner.trucks[0]);
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
                    billNo,
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
                    {(['CASH', 'CREDIT', 'CARD', 'TRANSFER'] as PaymentType[]).map((type) => {
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
                                {type === 'CARD' && <CreditCard size={20} />}
                                {type === 'TRANSFER' && <Smartphone size={20} />}
                                <span className="text-xs">{info.name}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Credit Customer Search */}
            {paymentType === 'CREDIT' && (
                <div className="bg-[#1a1a24] rounded-xl p-4 mb-4 border border-white/10">
                    <label className="block text-sm text-gray-400 mb-2">ค้นหาลูกค้าเงินเชื่อ</label>
                    <div className="flex gap-2 mb-2">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                            placeholder="ชื่อลูกค้าหรือทะเบียนรถ..."
                            className="flex-1 bg-gray-800 border border-white/10 rounded-lg px-4 py-2 focus:border-orange-500 focus:outline-none"
                        />
                        <button
                            onClick={handleSearch}
                            disabled={searching}
                            className="bg-orange-600 hover:bg-orange-500 px-4 py-2 rounded-lg"
                        >
                            {searching ? <Loader2 className="animate-spin" size={20} /> : <Search size={20} />}
                        </button>
                    </div>

                    {/* Search Results */}
                    {searchResults.length > 0 && (
                        <div className="bg-gray-800 rounded-lg border border-white/10 max-h-40 overflow-y-auto">
                            {searchResults.map((owner) => (
                                <button
                                    key={owner.id}
                                    onClick={() => handleSelectOwner(owner)}
                                    className="w-full text-left px-4 py-2 hover:bg-white/10 border-b border-white/5 last:border-0"
                                >
                                    <div className="font-medium">{owner.name}</div>
                                    <div className="text-xs text-gray-400">
                                        {owner.trucks.map(t => t.licensePlate).join(', ')}
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Selected Owner & Truck */}
                    {selectedOwner && (
                        <div className="mt-3 bg-purple-900/30 rounded-lg p-3 border border-purple-500/30">
                            <div className="text-purple-400 text-sm mb-2">ลูกค้า: {selectedOwner.name}</div>
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
                            ) : (
                                <div className="text-white font-mono">
                                    🚗 {selectedTruck?.licensePlate}
                                </div>
                            )}
                        </div>
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

            {/* Optional Fields */}
            <div className="bg-[#1a1a24] rounded-xl p-4 mb-6 border border-white/10">
                <div className="grid grid-cols-2 gap-4">
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
                    <div>
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
