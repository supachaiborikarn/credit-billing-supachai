'use client';

import { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';
import { PAYMENT_TYPES } from '@/constants';

interface TruckSearchResult {
    id: string;
    licensePlate: string;
    ownerName: string;
    ownerCode?: string;
}

interface RefillModalProps {
    stationId: string;
    date: string;
    retailPrice: number;
    wholesalePrice: number;
    defaultPaymentType?: string;
    defaultNozzle?: number;
    onClose: () => void;
    onSuccess: (paymentType: string, nozzle: number) => void;
}

export default function RefillModal({
    stationId,
    date,
    retailPrice,
    wholesalePrice,
    defaultPaymentType = 'CREDIT',
    defaultNozzle = 1,
    onClose,
    onSuccess,
}: RefillModalProps) {
    // Form state with smart defaults
    const [nozzle, setNozzle] = useState(defaultNozzle);
    const [paymentType, setPaymentType] = useState(defaultPaymentType);
    const [licensePlate, setLicensePlate] = useState('');
    const [ownerName, setOwnerName] = useState('');
    const [ownerCode, setOwnerCode] = useState('');
    const [ownerId, setOwnerId] = useState<string | null>(null);
    const [liters, setLiters] = useState('');
    const [pricePerLiter, setPricePerLiter] = useState(
        defaultPaymentType === 'CASH' ? retailPrice.toString() : wholesalePrice.toString()
    );
    const [billBookNo, setBillBookNo] = useState('');
    const [billNo, setBillNo] = useState('');

    // UI state
    const [searchResults, setSearchResults] = useState<TruckSearchResult[]>([]);
    const [searching, setSearching] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Calculate amount
    const amount = (parseFloat(liters) || 0) * (parseFloat(pricePerLiter) || 0);

    // Update price based on payment type
    useEffect(() => {
        if (paymentType === 'CASH') {
            setPricePerLiter(retailPrice.toString());
        } else {
            setPricePerLiter(wholesalePrice.toString());
        }
    }, [paymentType, retailPrice, wholesalePrice]);

    // Search trucks
    const searchTrucks = async () => {
        if (!licensePlate || licensePlate.length < 2) {
            setSearchResults([]);
            return;
        }

        setSearching(true);
        try {
            const res = await fetch(`/api/trucks/search?q=${encodeURIComponent(licensePlate)}`);
            if (res.ok) {
                const data = await res.json();
                setSearchResults(data.results || []);
            }
        } catch (error) {
            console.error('Search error:', error);
        } finally {
            setSearching(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(searchTrucks, 300);
        return () => clearTimeout(timer);
    }, [licensePlate]);

    const selectTruck = (truck: TruckSearchResult) => {
        setLicensePlate(truck.licensePlate);
        setOwnerName(truck.ownerName);
        setOwnerCode(truck.ownerCode || '');
        setOwnerId(truck.id);
        setSearchResults([]);
    };

    const handleSubmit = async () => {
        if (!licensePlate || !liters || parseFloat(liters) <= 0) {
            alert('กรุณากรอกข้อมูลให้ครบ');
            return;
        }

        setSubmitting(true);
        try {
            const res = await fetch(`/api/station/${stationId}/transactions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date,
                    nozzleNumber: nozzle,
                    paymentType,
                    licensePlate,
                    ownerName,
                    ownerCode,
                    ownerId,
                    liters: parseFloat(liters),
                    pricePerLiter: parseFloat(pricePerLiter),
                    amount,
                    billBookNo,
                    billNo,
                }),
            });

            if (res.ok) {
                onSuccess(paymentType, nozzle);
            } else {
                const err = await res.json();
                alert(err.error || 'บันทึกไม่สำเร็จ');
            }
        } catch (error) {
            console.error('Submit error:', error);
            alert('เกิดข้อผิดพลาด');
        } finally {
            setSubmitting(false);
        }
    };

    const formatCurrency = (num: number) =>
        new Intl.NumberFormat('th-TH', {
            style: 'currency',
            currency: 'THB',
            maximumFractionDigits: 0,
        }).format(num);

    return (
        <div className="fixed inset-0 bg-white z-50 flex flex-col">
            {/* Header */}
            <header className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center z-10">
                <button onClick={onClose} className="p-1">
                    <X size={24} className="text-gray-600" />
                </button>
                <h1 className="flex-1 text-center font-bold text-lg">บันทึกการเติม</h1>
                <div className="w-8" />
            </header>

            {/* Form Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-32">
                {/* Nozzle Selection */}
                <div className="bg-gray-50 rounded-xl p-4">
                    <label className="text-sm text-gray-600 block mb-2">หัวจ่าย</label>
                    <div className="grid grid-cols-4 gap-2">
                        {[1, 2, 3, 4].map(n => (
                            <button
                                key={n}
                                type="button"
                                onClick={() => setNozzle(n)}
                                className={`py-3 rounded-xl font-bold transition ${nozzle === n
                                        ? 'bg-blue-500 text-white'
                                        : 'bg-white border border-gray-200 text-gray-700'
                                    }`}
                            >
                                {n}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Payment Type */}
                <div className="bg-gray-50 rounded-xl p-4">
                    <label className="text-sm text-gray-600 block mb-2">ประเภทการชำระ</label>
                    <div className="flex flex-wrap gap-2">
                        {PAYMENT_TYPES.map(pt => (
                            <button
                                key={pt.value}
                                type="button"
                                onClick={() => setPaymentType(pt.value)}
                                className={`px-4 py-2 rounded-xl font-medium transition ${paymentType === pt.value
                                        ? `${pt.color} text-white`
                                        : 'bg-white border border-gray-200 text-gray-700'
                                    }`}
                            >
                                {pt.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* License Plate Search */}
                <div className="bg-gray-50 rounded-xl p-4">
                    <label className="text-sm text-gray-600 block mb-2">ทะเบียนรถ</label>
                    <div className="relative">
                        <input
                            type="text"
                            value={licensePlate}
                            onChange={e => setLicensePlate(e.target.value)}
                            placeholder="พิมพ์ทะเบียน..."
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        {searching && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                            </div>
                        )}
                    </div>

                    {/* Search Results */}
                    {searchResults.length > 0 && (
                        <div className="mt-2 bg-white border border-gray-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                            {searchResults.map(truck => (
                                <button
                                    key={truck.id}
                                    type="button"
                                    onClick={() => selectTruck(truck)}
                                    className="w-full px-4 py-3 text-left border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition"
                                >
                                    <span className="font-mono font-bold">{truck.licensePlate}</span>
                                    <span className="text-gray-500 ml-2">{truck.ownerName}</span>
                                    {truck.ownerCode && (
                                        <span className="ml-2 text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                                            {truck.ownerCode}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Owner Name */}
                    {(ownerName || licensePlate) && (
                        <div className="mt-3">
                            <label className="text-sm text-gray-600 block mb-1">ชื่อเจ้าของ</label>
                            <input
                                type="text"
                                value={ownerName}
                                onChange={e => setOwnerName(e.target.value)}
                                placeholder="ชื่อเจ้าของรถ..."
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    )}
                </div>

                {/* Bill Numbers (for CREDIT) */}
                {paymentType === 'CREDIT' && (
                    <div className="bg-gray-50 rounded-xl p-4">
                        <label className="text-sm text-gray-600 block mb-2">เลขบิล</label>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs text-gray-400">เล่มที่</label>
                                <input
                                    type="text"
                                    value={billBookNo}
                                    onChange={e => setBillBookNo(e.target.value)}
                                    placeholder="เล่ม..."
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-gray-400">เลขที่</label>
                                <input
                                    type="text"
                                    value={billNo}
                                    onChange={e => setBillNo(e.target.value)}
                                    placeholder="เลขที่..."
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* Liters */}
                <div className="bg-gray-50 rounded-xl p-4">
                    <label className="text-sm text-gray-600 block mb-2">จำนวนลิตร</label>
                    <input
                        type="number"
                        value={liters}
                        onChange={e => setLiters(e.target.value)}
                        placeholder="0"
                        inputMode="decimal"
                        className="w-full px-4 py-4 border border-gray-200 rounded-xl text-2xl font-mono text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                {/* Price Per Liter */}
                <div className="bg-gray-50 rounded-xl p-4">
                    <label className="text-sm text-gray-600 block mb-2">ราคาต่อลิตร (฿)</label>
                    <input
                        type="number"
                        value={pricePerLiter}
                        onChange={e => setPricePerLiter(e.target.value)}
                        step="0.01"
                        inputMode="decimal"
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl text-xl font-mono text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                {/* Total Amount */}
                <div className="bg-green-50 rounded-xl p-4">
                    <div className="flex justify-between items-center">
                        <span className="text-green-700 font-medium">ยอดรวม</span>
                        <span className="text-3xl font-bold text-green-700">{formatCurrency(amount)}</span>
                    </div>
                </div>
            </div>

            {/* Submit Button */}
            <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4">
                <button
                    onClick={handleSubmit}
                    disabled={submitting || !licensePlate || !liters}
                    className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold text-lg rounded-xl disabled:opacity-50 flex items-center justify-center gap-2"
                >
                    {submitting ? (
                        <>
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            กำลังบันทึก...
                        </>
                    ) : (
                        <>
                            <Check size={22} />
                            บันทึกรายการ
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}
