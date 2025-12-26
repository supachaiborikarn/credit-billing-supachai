'use client';

import { useState, useEffect, use, useRef } from 'react';
import { ArrowLeft, Search, User, Check } from 'lucide-react';
import { STATIONS, PAYMENT_TYPES, FUEL_TYPES } from '@/constants';
import Link from 'next/link';

interface TruckResult {
    id: string;
    licensePlate: string;
    ownerName: string;
    ownerId?: string;
}

export default function SimpleStationSellPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const stationIndex = parseInt(id) - 1;
    const station = STATIONS[stationIndex];

    const [loading, setLoading] = useState(false);
    const [selectedDate] = useState(new Date().toISOString().split('T')[0]);

    // Form state
    const [licensePlate, setLicensePlate] = useState('');
    const [ownerName, setOwnerName] = useState('');
    const [ownerId, setOwnerId] = useState<string | null>(null);
    const [paymentType, setPaymentType] = useState('CASH');
    const [fuelType, setFuelType] = useState('DIESEL');
    const [liters, setLiters] = useState('');
    const [pricePerLiter, setPricePerLiter] = useState('');
    const [priceDisplay, setPriceDisplay] = useState(''); // Display value for price input
    const [amount, setAmount] = useState(0);
    const [bookNo, setBookNo] = useState('');
    const [billNo, setBillNo] = useState('');

    // Search
    const [searchResults, setSearchResults] = useState<TruckResult[]>([]);
    const [showResults, setShowResults] = useState(false);
    const [searchLoading, setSearchLoading] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);

    // Calculate amount
    useEffect(() => {
        const l = parseFloat(liters) || 0;
        const p = parseFloat(pricePerLiter) || 0;
        setAmount(l * p);
    }, [liters, pricePerLiter]);

    // Search trucks
    useEffect(() => {
        const searchTrucks = async () => {
            if (licensePlate.length < 2) {
                setSearchResults([]);
                return;
            }

            setSearchLoading(true);
            try {
                const res = await fetch(`/api/trucks/search?q=${encodeURIComponent(licensePlate)}`);
                if (res.ok) {
                    const data = await res.json();
                    setSearchResults(data.slice(0, 5));
                    setShowResults(true);
                }
            } catch (error) {
                console.error('Error searching:', error);
            } finally {
                setSearchLoading(false);
            }
        };

        const debounce = setTimeout(searchTrucks, 300);
        return () => clearTimeout(debounce);
    }, [licensePlate]);

    // Close dropdown
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
                setShowResults(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectTruck = (truck: TruckResult) => {
        setLicensePlate(truck.licensePlate);
        setOwnerName(truck.ownerName);
        setOwnerId(truck.ownerId || null);
        setShowResults(false);
    };

    // Handle price input - auto format to XX.XX
    const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        // Only allow numbers
        const rawValue = e.target.value.replace(/[^0-9]/g, '');
        setPriceDisplay(rawValue);

        // Convert to decimal: 3299 -> 32.99, 329 -> 3.29, 32 -> 0.32
        if (rawValue.length === 0) {
            setPricePerLiter('');
        } else {
            const numericValue = parseInt(rawValue, 10);
            const decimalValue = numericValue / 100;
            setPricePerLiter(decimalValue.toString());
        }
    };

    // Format price for display
    const formatPriceDisplay = (value: string) => {
        if (!value) return '';
        const num = parseInt(value, 10) / 100;
        return num.toFixed(2);
    };

    const handleSubmit = async () => {
        if (!liters || parseFloat(liters) <= 0) {
            alert('กรุณาใส่จำนวนลิตร');
            return;
        }
        if (!pricePerLiter || parseFloat(pricePerLiter) <= 0) {
            alert('กรุณาใส่ราคาต่อลิตร');
            return;
        }

        setLoading(true);
        try {
            const res = await fetch(`/api/station/${id}/transactions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date: selectedDate,
                    licensePlate: licensePlate || null,
                    ownerName: ownerName || null,
                    ownerId: ownerId || null,
                    paymentType,
                    fuelType,
                    liters: parseFloat(liters),
                    pricePerLiter: parseFloat(pricePerLiter),
                    amount,
                    bookNo: bookNo || null,
                    billNo: billNo || null,
                }),
            });

            if (res.ok) {
                // Reset form
                setLicensePlate('');
                setOwnerName('');
                setOwnerId(null);
                setLiters('');
                setPricePerLiter('');
                setPriceDisplay('');
                setBookNo('');
                setBillNo('');
                setPaymentType('CASH');
                alert('✅ บันทึกเรียบร้อย!');
            } else {
                const err = await res.json();
                alert(err.error || 'บันทึกไม่สำเร็จ');
            }
        } catch (error) {
            console.error('Error saving:', error);
            alert('เกิดข้อผิดพลาด');
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (num: number) =>
        new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2 }).format(num);

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
                        <h1 className="font-bold text-gray-800 text-lg">ลงบิลใหม่</h1>
                    </div>
                </div>
            </header>

            <div className="p-4 pb-24 space-y-4">
                {/* Book & Bill Number */}
                <div className="bg-white rounded-2xl shadow-sm p-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        📝 เล่ม/เลขที่บิล
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                        <input
                            type="text"
                            value={bookNo}
                            onChange={(e) => setBookNo(e.target.value)}
                            placeholder="เล่มที่"
                            className="px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-800"
                        />
                        <input
                            type="text"
                            value={billNo}
                            onChange={(e) => setBillNo(e.target.value)}
                            placeholder="เลขที่"
                            className="px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-800"
                        />
                    </div>
                </div>

                {/* License Plate Search */}
                <div className="bg-white rounded-2xl shadow-sm p-4" ref={searchRef}>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        🚗 ทะเบียนรถ
                    </label>
                    <div className="relative">
                        <input
                            type="text"
                            value={licensePlate}
                            onChange={(e) => setLicensePlate(e.target.value)}
                            placeholder="กรอกทะเบียน หรือ ปล่อยว่าง"
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-800"
                        />
                        {searchLoading && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                <div className="animate-spin h-5 w-5 border-2 border-orange-500 border-t-transparent rounded-full"></div>
                            </div>
                        )}
                    </div>

                    {showResults && searchResults.length > 0 && (
                        <div className="mt-2 border border-gray-200 rounded-xl overflow-hidden">
                            {searchResults.map((truck) => (
                                <button
                                    key={truck.id}
                                    onClick={() => selectTruck(truck)}
                                    className="w-full px-4 py-3 text-left hover:bg-orange-50 border-b border-gray-100 last:border-b-0"
                                >
                                    <p className="font-medium text-gray-800">{truck.licensePlate}</p>
                                    <p className="text-sm text-gray-500">{truck.ownerName}</p>
                                </button>
                            ))}
                        </div>
                    )}

                    {ownerName && (
                        <div className="mt-3 flex items-center gap-2 text-green-600">
                            <User size={16} />
                            <span className="text-sm">{ownerName}</span>
                        </div>
                    )}
                </div>

                {/* Fuel Type */}
                <div className="bg-white rounded-2xl shadow-sm p-4">
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                        ⛽ ประเภทน้ำมัน
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                        {FUEL_TYPES.map((type) => (
                            <button
                                key={type.value}
                                onClick={() => setFuelType(type.value)}
                                className={`py-3 px-2 rounded-xl border-2 text-sm font-medium transition-all ${fuelType === type.value
                                    ? 'border-orange-500 bg-orange-50 text-orange-700'
                                    : 'border-gray-200 text-gray-700 hover:border-gray-300'
                                    }`}
                            >
                                {fuelType === type.value && <Check size={14} className="inline mr-1" />}
                                {type.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Payment Type */}
                <div className="bg-white rounded-2xl shadow-sm p-4">
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                        💳 ประเภทชำระ
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                        {PAYMENT_TYPES.slice(0, 4).map((type) => (
                            <button
                                key={type.value}
                                onClick={() => setPaymentType(type.value)}
                                className={`py-3 px-2 rounded-xl border-2 text-sm font-medium transition-all ${paymentType === type.value
                                    ? 'border-orange-500 bg-orange-50 text-orange-700'
                                    : 'border-gray-200 text-gray-700 hover:border-gray-300'
                                    }`}
                            >
                                {paymentType === type.value && <Check size={14} className="inline mr-1" />}
                                {type.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Liters & Price */}
                <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            🔢 จำนวนลิตร
                        </label>
                        <input
                            type="number"
                            value={liters}
                            onChange={(e) => setLiters(e.target.value)}
                            placeholder="0.00"
                            className="w-full px-4 py-4 border border-gray-200 rounded-xl text-2xl text-center font-bold focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-800"
                            inputMode="decimal"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            💰 ราคาต่อลิตร <span className="text-gray-400 text-xs">(พิมพ์ 3299 = 32.99)</span>
                        </label>
                        <input
                            type="text"
                            value={priceDisplay ? formatPriceDisplay(priceDisplay) : ''}
                            onChange={handlePriceChange}
                            placeholder="0.00"
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-xl text-center font-bold focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-800"
                            inputMode="numeric"
                        />
                    </div>
                </div>

                {/* Total Amount */}
                <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-2xl p-4 text-center">
                    <p className="text-orange-100 text-sm mb-1">รวมทั้งสิ้น</p>
                    <p className="text-white text-4xl font-bold">฿{formatCurrency(amount)}</p>
                </div>

                {/* Submit Button */}
                <button
                    onClick={handleSubmit}
                    disabled={loading || !liters || parseFloat(liters) <= 0}
                    className="w-full py-4 bg-orange-500 hover:bg-orange-600 text-white text-lg font-bold rounded-2xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                >
                    {loading ? 'กำลังบันทึก...' : '✅ บันทึก'}
                </button>
            </div>
        </div>
    );
}
