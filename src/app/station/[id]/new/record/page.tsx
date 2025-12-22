'use client';

import { useState, useEffect, use, useRef } from 'react';
import { ArrowLeft, Search, X, Plus, Check, User } from 'lucide-react';
import { STATIONS, PAYMENT_TYPES } from '@/constants';
import Link from 'next/link';

interface TruckSearchResult {
    id: string;
    licensePlate: string;
    ownerId: string;
    ownerName: string;
    ownerCode: string | null;
    ownerGroup: string;
}

interface Owner {
    id: string;
    name: string;
}

export default function StationRecordPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const stationIndex = parseInt(id) - 1;
    const station = STATIONS[stationIndex];

    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [licensePlate, setLicensePlate] = useState('');
    const [ownerName, setOwnerName] = useState('');
    const [ownerId, setOwnerId] = useState('');
    const [paymentType, setPaymentType] = useState('CASH');
    const [liters, setLiters] = useState('');
    const [pricePerLiter, setPricePerLiter] = useState('');
    const [amount, setAmount] = useState('');
    const [billBookNo, setBillBookNo] = useState('');
    const [billNo, setBillNo] = useState('');
    const [fuelType, setFuelType] = useState('DIESEL');

    const [searchResults, setSearchResults] = useState<TruckSearchResult[]>([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const [searching, setSearching] = useState(false);
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState(false);

    const [showAddTruck, setShowAddTruck] = useState(false);
    const [newTruckPlate, setNewTruckPlate] = useState('');
    const [newTruckOwnerId, setNewTruckOwnerId] = useState('');
    const [owners, setOwners] = useState<Owner[]>([]);

    const searchRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetchPrices();
        fetchOwners();
    }, [selectedDate]);

    useEffect(() => {
        if (licensePlate.length >= 2) {
            searchTrucks();
        } else {
            setSearchResults([]);
            setShowDropdown(false);
        }
    }, [licensePlate]);

    // Calculate amount when liters or price changes
    useEffect(() => {
        if (liters && pricePerLiter) {
            const calc = parseFloat(liters) * parseFloat(pricePerLiter);
            setAmount(calc.toFixed(2));
        }
    }, [liters, pricePerLiter]);

    // Click outside to close dropdown
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const fetchPrices = async () => {
        try {
            const res = await fetch(`/api/station/${id}/daily?date=${selectedDate}`);
            if (res.ok) {
                const data = await res.json();
                if (data.dailyRecord) {
                    setPricePerLiter(data.dailyRecord.retailPrice?.toString() || '31.34');
                } else {
                    setPricePerLiter('31.34');
                }
            }
        } catch (error) {
            console.error('Error fetching prices:', error);
        }
    };

    const fetchOwners = async () => {
        try {
            const res = await fetch('/api/owners');
            if (res.ok) {
                const data = await res.json();
                setOwners(data);
            }
        } catch (error) {
            console.error('Error fetching owners:', error);
        }
    };

    const searchTrucks = async () => {
        setSearching(true);
        try {
            const res = await fetch(`/api/trucks/search?q=${encodeURIComponent(licensePlate)}`);
            if (res.ok) {
                const data = await res.json();
                setSearchResults(data);
                setShowDropdown(data.length > 0);
            }
        } catch (error) {
            console.error('Search error:', error);
        } finally {
            setSearching(false);
        }
    };

    const selectTruck = (truck: TruckSearchResult) => {
        setLicensePlate(truck.licensePlate);
        setOwnerName(truck.ownerName);
        setOwnerId(truck.ownerId);
        setShowDropdown(false);

        // Set price based on owner group
        if (truck.ownerGroup === 'SUGAR_FACTORY') {
            // Wholesale price for sugar factory
            fetch(`/api/station/${id}/daily?date=${selectedDate}`)
                .then(res => res.json())
                .then(data => {
                    if (data.dailyRecord?.wholesalePrice) {
                        setPricePerLiter(data.dailyRecord.wholesalePrice.toString());
                    }
                });
        }
    };

    const clearOwner = () => {
        setLicensePlate('');
        setOwnerName('');
        setOwnerId('');
    };

    const handleAddTruck = async () => {
        if (!newTruckPlate || !newTruckOwnerId) {
            alert('กรุณากรอกทะเบียนและเลือกเจ้าของ');
            return;
        }

        try {
            const res = await fetch('/api/trucks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    licensePlate: newTruckPlate.toUpperCase(),
                    ownerId: newTruckOwnerId,
                }),
            });

            if (res.ok) {
                const truck = await res.json();
                setLicensePlate(truck.licensePlate);
                setOwnerName(truck.owner?.name || '');
                setOwnerId(truck.ownerId);
                setShowAddTruck(false);
                setNewTruckPlate('');
                setNewTruckOwnerId('');
            } else {
                const err = await res.json();
                alert(err.error || 'เพิ่มรถไม่สำเร็จ');
            }
        } catch (error) {
            console.error('Error adding truck:', error);
            alert('เกิดข้อผิดพลาด');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!liters || !pricePerLiter || !amount) {
            alert('กรุณากรอกข้อมูลให้ครบ');
            return;
        }

        setSaving(true);
        try {
            const res = await fetch(`/api/station/${id}/transactions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date: selectedDate,
                    licensePlate: licensePlate.toUpperCase() || null,
                    ownerName: ownerName || null,
                    ownerId: ownerId || null,
                    paymentType,
                    liters: parseFloat(liters),
                    pricePerLiter: parseFloat(pricePerLiter),
                    amount: parseFloat(amount),
                    billBookNo: billBookNo || null,
                    billNo: billNo || null,
                    fuelType,
                }),
            });

            if (res.ok) {
                setSuccess(true);
                // Reset form
                setLicensePlate('');
                setOwnerName('');
                setOwnerId('');
                setLiters('');
                setAmount('');
                setBillBookNo('');
                setBillNo('');

                setTimeout(() => setSuccess(false), 2000);
            } else {
                const err = await res.json();
                alert(err.error || 'บันทึกไม่สำเร็จ');
            }
        } catch (error) {
            console.error('Error saving:', error);
            alert('เกิดข้อผิดพลาด');
        } finally {
            setSaving(false);
        }
    };

    if (!station) {
        return <div className="p-4 text-gray-500">ไม่พบสถานี</div>;
    }

    return (
        <div className="min-h-screen bg-gray-100">
            {/* Header */}
            <header className="bg-white shadow-sm sticky top-0 z-40">
                <div className="px-4 py-3 flex items-center gap-3">
                    <Link href={`/station/${id}/new/home`} className="p-1">
                        <ArrowLeft size={24} className="text-gray-700" />
                    </Link>
                    <h1 className="font-bold text-gray-800 text-lg">ลงบันทึกใหม่</h1>
                    <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="ml-auto bg-gray-100 px-3 py-1.5 rounded-lg text-sm"
                    />
                </div>
            </header>

            {/* Success Toast */}
            {success && (
                <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-green-500 text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-2 z-50">
                    <Check size={20} />
                    บันทึกสำเร็จ!
                </div>
            )}

            <form onSubmit={handleSubmit} className="p-4 space-y-4">
                {/* Truck Search */}
                <div className="bg-white rounded-2xl shadow-sm p-4" ref={searchRef}>
                    <label className="block text-sm text-gray-600 mb-2">🚗 ทะเบียนรถ</label>

                    {ownerName ? (
                        <div className="flex items-center justify-between bg-blue-50 p-3 rounded-xl">
                            <div>
                                <p className="font-medium text-gray-800">{licensePlate}</p>
                                <p className="text-sm text-blue-600">{ownerName}</p>
                            </div>
                            <button
                                type="button"
                                onClick={clearOwner}
                                className="p-2 text-gray-400 hover:text-red-500"
                            >
                                <X size={20} />
                            </button>
                        </div>
                    ) : (
                        <div className="relative">
                            <div className="flex items-center gap-2">
                                <div className="relative flex-1">
                                    <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input
                                        type="text"
                                        value={licensePlate}
                                        onChange={(e) => setLicensePlate(e.target.value.toUpperCase())}
                                        placeholder="ค้นหาทะเบียน..."
                                        className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                    {searching && (
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                                        </div>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowAddTruck(true);
                                        setNewTruckPlate(licensePlate);
                                    }}
                                    className="p-3 bg-blue-500 text-white rounded-xl hover:bg-blue-600"
                                >
                                    <Plus size={20} />
                                </button>
                            </div>

                            {/* Search Results Dropdown */}
                            {showDropdown && searchResults.length > 0 && (
                                <div className="absolute z-10 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                                    {searchResults.map((truck) => (
                                        <button
                                            key={truck.id}
                                            type="button"
                                            onClick={() => selectTruck(truck)}
                                            className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                                        >
                                            <p className="font-medium text-gray-800">{truck.licensePlate}</p>
                                            <p className="text-sm text-gray-500">
                                                {truck.ownerName}
                                                {truck.ownerCode && ` (${truck.ownerCode})`}
                                            </p>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Payment Type */}
                <div className="bg-white rounded-2xl shadow-sm p-4">
                    <label className="block text-sm text-gray-600 mb-2">💳 ประเภทชำระ</label>
                    <div className="grid grid-cols-2 gap-2">
                        {PAYMENT_TYPES.filter(p => ['CASH', 'CREDIT', 'TRANSFER', 'BOX_TRUCK'].includes(p.value)).map((type) => (
                            <button
                                key={type.value}
                                type="button"
                                onClick={() => setPaymentType(type.value)}
                                className={`py-3 px-4 rounded-xl font-medium transition ${paymentType === type.value
                                        ? 'bg-blue-500 text-white'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                            >
                                {type.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Bill Info (for CREDIT) */}
                {(paymentType === 'CREDIT' || paymentType === 'BOX_TRUCK') && (
                    <div className="bg-white rounded-2xl shadow-sm p-4">
                        <label className="block text-sm text-gray-600 mb-2">📄 เลขที่บิล</label>
                        <div className="grid grid-cols-2 gap-3">
                            <input
                                type="text"
                                value={billBookNo}
                                onChange={(e) => setBillBookNo(e.target.value)}
                                placeholder="เล่มที่"
                                className="px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <input
                                type="text"
                                value={billNo}
                                onChange={(e) => setBillNo(e.target.value)}
                                placeholder="เลขที่"
                                className="px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    </div>
                )}

                {/* Fuel Amount */}
                <div className="bg-white rounded-2xl shadow-sm p-4">
                    <label className="block text-sm text-gray-600 mb-2">⛽ ปริมาณน้ำมัน</label>
                    <div className="space-y-3">
                        <div>
                            <label className="text-xs text-gray-500">จำนวนลิตร</label>
                            <input
                                type="number"
                                value={liters}
                                onChange={(e) => setLiters(e.target.value)}
                                placeholder="0"
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-lg font-mono text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                                inputMode="decimal"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-gray-500">ราคาต่อลิตร</label>
                            <input
                                type="number"
                                value={pricePerLiter}
                                onChange={(e) => setPricePerLiter(e.target.value)}
                                placeholder="0.00"
                                step="0.01"
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-lg font-mono text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                                inputMode="decimal"
                            />
                        </div>
                        <div className="bg-green-50 p-4 rounded-xl">
                            <label className="text-xs text-green-600">ยอดรวม</label>
                            <p className="text-3xl font-bold text-green-700 text-right">
                                ฿{amount ? parseFloat(amount).toLocaleString('th-TH', { minimumFractionDigits: 2 }) : '0.00'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Submit Button */}
                <button
                    type="submit"
                    disabled={saving}
                    className="w-full py-4 bg-blue-500 text-white font-bold rounded-2xl hover:bg-blue-600 transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                    {saving ? (
                        <>
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            กำลังบันทึก...
                        </>
                    ) : (
                        <>
                            <Check size={20} />
                            บันทึกรายการ
                        </>
                    )}
                </button>
            </form>

            {/* Add Truck Modal */}
            {showAddTruck && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md p-6">
                        <h3 className="text-lg font-bold text-gray-800 mb-4">เพิ่มรถใหม่</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="text-sm text-gray-600">ทะเบียนรถ</label>
                                <input
                                    type="text"
                                    value={newTruckPlate}
                                    onChange={(e) => setNewTruckPlate(e.target.value.toUpperCase())}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl mt-1"
                                />
                            </div>
                            <div>
                                <label className="text-sm text-gray-600">เจ้าของ</label>
                                <select
                                    value={newTruckOwnerId}
                                    onChange={(e) => setNewTruckOwnerId(e.target.value)}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl mt-1"
                                >
                                    <option value="">เลือกเจ้าของ</option>
                                    {owners.map((owner) => (
                                        <option key={owner.id} value={owner.id}>
                                            {owner.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowAddTruck(false)}
                                    className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl"
                                >
                                    ยกเลิก
                                </button>
                                <button
                                    type="button"
                                    onClick={handleAddTruck}
                                    className="flex-1 py-3 bg-blue-500 text-white rounded-xl"
                                >
                                    เพิ่มรถ
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
