'use client';

import { useState, useEffect, use, useRef } from 'react';
import { ArrowLeft, Fuel, Search, User, Check, ChevronDown } from 'lucide-react';
import { STATIONS, GAS_PAYMENT_TYPES, DEFAULT_GAS_PRICE } from '@/constants';
import Link from 'next/link';

interface TruckResult {
    id: string;
    licensePlate: string;
    ownerName: string;
    ownerCode?: string;
    ownerId?: string;
}

interface Owner {
    id: string;
    name: string;
    code: string;
}

export default function GasStationSellPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const stationIndex = parseInt(id) - 1;
    const station = STATIONS[stationIndex];

    const [loading, setLoading] = useState(false);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [gasPrice, setGasPrice] = useState(DEFAULT_GAS_PRICE);

    // Form state
    const [licensePlate, setLicensePlate] = useState('');
    const [ownerName, setOwnerName] = useState('');
    const [ownerId, setOwnerId] = useState<string | null>(null);
    const [paymentType, setPaymentType] = useState('CASH');
    const [nozzleNumber, setNozzleNumber] = useState(1);
    const [liters, setLiters] = useState('');
    const [amount, setAmount] = useState(0);

    // Search
    const [searchResults, setSearchResults] = useState<TruckResult[]>([]);
    const [showResults, setShowResults] = useState(false);
    const [searchLoading, setSearchLoading] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);

    // Owner selection for credit
    const [ownersList, setOwnersList] = useState<Owner[]>([]);
    const [ownerSearch, setOwnerSearch] = useState('');
    const [showOwnerDropdown, setShowOwnerDropdown] = useState(false);
    const [loadingOwners, setLoadingOwners] = useState(false);
    const ownerDropdownRef = useRef<HTMLDivElement>(null);

    // Calculate amount when liters or price changes
    useEffect(() => {
        const l = parseFloat(liters) || 0;
        setAmount(l * gasPrice);
    }, [liters, gasPrice]);

    // Fetch gas price
    useEffect(() => {
        const fetchPrice = async () => {
            try {
                const res = await fetch(`/api/gas-station/${id}/daily?date=${selectedDate}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.dailyRecord?.gasPrice) {
                        setGasPrice(data.dailyRecord.gasPrice);
                    }
                }
            } catch (error) {
                console.error('Error fetching price:', error);
            }
        };
        fetchPrice();
    }, [id, selectedDate]);

    // Fetch owners list when payment type is CREDIT
    useEffect(() => {
        if (paymentType === 'CREDIT' && ownersList.length === 0) {
            setLoadingOwners(true);
            fetch('/api/owners')
                .then(res => res.json())
                .then(data => {
                    setOwnersList(data || []);
                })
                .catch(err => console.error('Error loading owners:', err))
                .finally(() => setLoadingOwners(false));
        }
    }, [paymentType, ownersList.length]);

    // Search trucks/owners
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

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
                setShowResults(false);
            }
            if (ownerDropdownRef.current && !ownerDropdownRef.current.contains(e.target as Node)) {
                setShowOwnerDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectTruck = (truck: TruckResult) => {
        setLicensePlate(truck.licensePlate);
        setOwnerName(truck.ownerName);
        setOwnerId(truck.ownerId || null);
        setOwnerSearch(truck.ownerName);
        setShowResults(false);
    };

    // Filter owners for dropdown
    const filteredOwners = ownersList.filter(o =>
        (o.name || '').toLowerCase().includes(ownerSearch.toLowerCase()) ||
        (o.code || '').toLowerCase().includes(ownerSearch.toLowerCase())
    ).slice(0, 20);

    // Select owner from dropdown
    const selectOwner = (owner: Owner) => {
        setOwnerId(owner.id);
        setOwnerName(owner.name);
        setOwnerSearch(owner.code ? `${owner.code} - ${owner.name}` : owner.name);
        setShowOwnerDropdown(false);
    };

    const handleSubmit = async () => {
        if (!liters || parseFloat(liters) <= 0) {
            alert('กรุณาใส่จำนวนลิตร');
            return;
        }

        // Validate owner for credit transactions
        if (paymentType === 'CREDIT' && !ownerName) {
            alert('รายการเงินเชื่อต้องเลือกเจ้าของ');
            return;
        }

        setLoading(true);
        try {
            const res = await fetch(`/api/gas-station/${id}/transactions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date: selectedDate,
                    licensePlate: licensePlate || null,
                    ownerName: ownerName || null,
                    ownerId: ownerId || null,
                    paymentType,
                    nozzleNumber,
                    liters: parseFloat(liters),
                    pricePerLiter: gasPrice,
                    amount,
                }),
            });

            if (res.ok) {
                // Reset form
                setLicensePlate('');
                setOwnerName('');
                setOwnerId(null);
                setOwnerSearch('');
                setLiters('');
                setNozzleNumber(1);
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
                        <Link href={`/gas-station/${id}/new/home`} className="p-1">
                            <ArrowLeft size={24} className="text-gray-700" />
                        </Link>
                        <h1 className="font-bold text-gray-800 text-lg">ขายแก๊ส</h1>
                    </div>
                    <div className="flex items-center gap-1 bg-orange-50 px-3 py-1.5 rounded-lg">
                        <Fuel size={16} className="text-orange-500" />
                        <span className="text-orange-700 font-semibold">{gasPrice.toFixed(2)}</span>
                        <span className="text-orange-600 text-sm">/ลิตร</span>
                    </div>
                </div>
            </header>

            <div className="p-4 space-y-4">
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
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                        />
                        {searchLoading && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                <div className="animate-spin h-5 w-5 border-2 border-orange-500 border-t-transparent rounded-full"></div>
                            </div>
                        )}
                    </div>

                    {/* Search Results Dropdown */}
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

                {/* Owner Selection for Credit */}
                {paymentType === 'CREDIT' && (
                    <div className="bg-white rounded-2xl shadow-sm p-4" ref={ownerDropdownRef}>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            👤 เลือกเจ้าของ (เงินเชื่อ) *
                        </label>
                        {loadingOwners ? (
                            <div className="flex items-center justify-center py-3">
                                <div className="animate-spin h-5 w-5 border-2 border-orange-500 border-t-transparent rounded-full"></div>
                                <span className="ml-2 text-gray-500">กำลังโหลด...</span>
                            </div>
                        ) : (
                            <>
                                <input
                                    type="text"
                                    value={ownerSearch}
                                    onChange={(e) => {
                                        setOwnerSearch(e.target.value);
                                        setOwnerId(null);
                                        setOwnerName('');
                                        setShowOwnerDropdown(true);
                                    }}
                                    onFocus={() => setShowOwnerDropdown(true)}
                                    placeholder="พิมพ์ชื่อหรือรหัสเพื่อค้นหา..."
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                                />
                                {showOwnerDropdown && (
                                    <div className="mt-2 border border-gray-200 rounded-xl overflow-hidden max-h-48 overflow-auto">
                                        {filteredOwners.length === 0 ? (
                                            <div className="px-4 py-3 text-gray-500 text-center">
                                                ไม่พบเจ้าของ
                                            </div>
                                        ) : (
                                            filteredOwners.map(owner => (
                                                <button
                                                    key={owner.id}
                                                    onClick={() => selectOwner(owner)}
                                                    className="w-full px-4 py-3 text-left hover:bg-orange-50 border-b border-gray-100 last:border-b-0"
                                                >
                                                    {owner.code && <span className="font-medium text-gray-800">{owner.code} - </span>}
                                                    <span className="text-gray-700">{owner.name}</span>
                                                </button>
                                            ))
                                        )}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}

                {/* Payment Type */}
                <div className="bg-white rounded-2xl shadow-sm p-4">
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                        💳 ประเภทชำระเงิน
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                        {GAS_PAYMENT_TYPES.map((type) => (
                            <button
                                key={type.value}
                                onClick={() => setPaymentType(type.value)}
                                className={`py-3 px-2 rounded-xl border-2 text-sm font-medium transition-all ${paymentType === type.value
                                    ? 'border-orange-500 bg-orange-50 text-orange-700'
                                    : 'border-gray-200 text-gray-700 hover:border-gray-300'
                                    }`}
                            >
                                {paymentType === type.value && (
                                    <Check size={14} className="inline mr-1" />
                                )}
                                {type.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Nozzle Selection */}
                <div className="bg-white rounded-2xl shadow-sm p-4">
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                        ⛽ หัวจ่าย
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                        {[1, 2, 3, 4].map((num) => (
                            <button
                                key={num}
                                onClick={() => setNozzleNumber(num)}
                                className={`py-3 rounded-xl border-2 text-xl font-bold transition-all ${nozzleNumber === num
                                    ? 'border-orange-500 bg-orange-500 text-white'
                                    : 'border-gray-200 text-gray-700 hover:border-gray-300'
                                    }`}
                            >
                                {num}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Liters Input */}
                <div className="bg-white rounded-2xl shadow-sm p-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        🔢 จำนวนลิตร
                    </label>
                    <input
                        type="number"
                        value={liters}
                        onChange={(e) => setLiters(e.target.value)}
                        placeholder="0.00"
                        className="w-full px-4 py-4 border border-gray-200 rounded-xl text-3xl text-center font-bold focus:outline-none focus:ring-2 focus:ring-orange-500"
                        inputMode="decimal"
                    />
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
                    {loading ? 'กำลังบันทึก...' : '✅ บันทึกขาย'}
                </button>
            </div>
        </div>
    );
}
