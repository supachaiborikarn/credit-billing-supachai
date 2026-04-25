'use client';

import { useState, useEffect, useRef } from 'react';
import { Save, X, Plus, Trash2, User, Phone, FileText, Camera, Image } from 'lucide-react';
import { FUEL_TYPES, PAYMENT_TYPES } from '@/constants';

const creditPaymentTypeSet = new Set(['CREDIT', 'BOX_TRUCK', 'OIL_TRUCK_SUPACHAI']);

interface TruckSearchResult {
    id: string;
    licensePlate: string;
    ownerId: string;
    ownerName: string;
    ownerCode: string | null;
    ownerPhone: string | null;
}

interface FuelLine {
    id: string;
    fuelType: string;
    quantity: string;
    pricePerLiter: string;
}

interface BillEntryFormProps {
    stationId: string;
    selectedDate: string;
    onSave: () => void;
    onCancel: () => void;
}

export default function BillEntryForm({ stationId, selectedDate, onSave, onCancel }: BillEntryFormProps) {
    // Bill Header
    const [bookNo, setBookNo] = useState('');
    const [billNo, setBillNo] = useState('');
    const [customerName, setCustomerName] = useState('');
    const [licensePlate, setLicensePlate] = useState('');
    const [paymentType, setPaymentType] = useState('CREDIT');

    // Owner Info
    const [ownerId, setOwnerId] = useState<string | null>(null);
    const [ownerCode, setOwnerCode] = useState<string | null>(null);
    const [ownerPhone, setOwnerPhone] = useState<string | null>(null);

    // Search
    const [searchResults, setSearchResults] = useState<TruckSearchResult[]>([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const [searchLoading, setSearchLoading] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Owner search for autocomplete
    const [ownerSearchResults, setOwnerSearchResults] = useState<{ id: string, name: string }[]>([]);
    const [showOwnerDropdown, setShowOwnerDropdown] = useState(false);
    const [ownerSearchLoading, setOwnerSearchLoading] = useState(false);
    const ownerDropdownRef = useRef<HTMLDivElement>(null);

    const [fuelLines, setFuelLines] = useState<FuelLine[]>([
        { id: '1', fuelType: 'DIESEL', quantity: '', pricePerLiter: '30.50' }
    ]);

    const [saving, setSaving] = useState(false);

    // Input mode: 'liters' or 'amount'
    const [inputMode, setInputMode] = useState<'liters' | 'amount'>('liters');
    const [amountInputs, setAmountInputs] = useState<Record<string, string>>({});

    // Fuel prices from localStorage
    const [storedFuelPrices, setStoredFuelPrices] = useState<Record<string, number>>({});

    // Load fuel prices from localStorage on mount
    useEffect(() => {
        const storageKey = `fuelPrices_station${stationId}_${selectedDate}`;
        const stored = localStorage.getItem(storageKey);
        if (stored) {
            const prices = JSON.parse(stored);
            setStoredFuelPrices(prices);
            // Update first fuel line with stored price if available
            setFuelLines(prev => prev.map(line => ({
                ...line,
                pricePerLiter: prices[line.fuelType]?.toString() || line.pricePerLiter
            })));
        }
    }, [stationId, selectedDate]);

    // Transfer proof upload
    const [transferProofUrl, setTransferProofUrl] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Add Truck Modal
    const [showAddTruckModal, setShowAddTruckModal] = useState(false);
    const [allOwners, setAllOwners] = useState<{ id: string; name: string; code: string | null }[]>([]);
    const [selectedNewTruckOwner, setSelectedNewTruckOwner] = useState('');
    const [addingTruck, setAddingTruck] = useState(false);
    const [ownerFilter, setOwnerFilter] = useState('');

    // Success state for visual feedback
    const [showSuccess, setShowSuccess] = useState(false);

    // Reset form function - เคลียร์ข้อมูลทั้งหมดเพื่อลงบิลใหม่
    const resetForm = () => {
        // Bill Header
        setBookNo('');
        setBillNo('');
        setCustomerName('');
        setLicensePlate('');
        // Payment type stays the same as it's often same for multiple bills

        // Owner Info
        setOwnerId(null);
        setOwnerCode(null);
        setOwnerPhone(null);

        // Search
        setSearchResults([]);
        setShowDropdown(false);
        setOwnerSearchResults([]);
        setShowOwnerDropdown(false);

        // Fuel Lines - reset with stored prices if available
        setFuelLines([{
            id: String(Date.now()),
            fuelType: 'DIESEL',
            quantity: '',
            pricePerLiter: storedFuelPrices['DIESEL']?.toString() || '30.50'
        }]);

        // Other
        setAmountInputs({});
        setTransferProofUrl(null);
    };

    // Search for trucks
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (licensePlate.length >= 2) {
                setSearchLoading(true);
                try {
                    const res = await fetch(`/api/trucks/search?q=${encodeURIComponent(licensePlate)}`);
                    if (res.ok) {
                        const data = await res.json();
                        setSearchResults(data);
                        setShowDropdown(true);
                    }
                } catch (error) {
                    console.error('Search error:', error);
                } finally {
                    setSearchLoading(false);
                }
            } else {
                setSearchResults([]);
                setShowDropdown(false);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [licensePlate]);

    // Click outside to close dropdown
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setShowDropdown(false);
            }
            if (ownerDropdownRef.current && !ownerDropdownRef.current.contains(e.target as Node)) {
                setShowOwnerDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Search for owners by name
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (customerName.length >= 2 && !ownerId) {
                setOwnerSearchLoading(true);
                try {
                    const res = await fetch(`/api/owners/search?q=${encodeURIComponent(customerName)}`);
                    if (res.ok) {
                        const data = await res.json();
                        const owners = Array.isArray(data) ? data : data.owners || [];
                        setOwnerSearchResults(owners);
                        setShowOwnerDropdown(owners.length > 0);
                    }
                } catch (error) {
                    console.error('Owner search error:', error);
                } finally {
                    setOwnerSearchLoading(false);
                }
            } else {
                setOwnerSearchResults([]);
                setShowOwnerDropdown(false);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [customerName, ownerId]);

    const selectTruck = (truck: TruckSearchResult) => {
        setLicensePlate(truck.licensePlate);
        setCustomerName(truck.ownerName);
        setOwnerId(truck.ownerId);
        setOwnerCode(truck.ownerCode);
        setOwnerPhone(truck.ownerPhone);
        setShowDropdown(false);
    };

    // Fetch owners for add truck modal
    const fetchOwners = async () => {
        try {
            const res = await fetch('/api/owners');
            if (res.ok) {
                const data = await res.json();
                setAllOwners(data);
            }
        } catch (error) {
            console.error('Error fetching owners:', error);
        }
    };

    // Handle opening add truck modal
    const openAddTruckModal = () => {
        setShowDropdown(false);
        setShowAddTruckModal(true);
        setSelectedNewTruckOwner('');
        setOwnerFilter('');
        if (allOwners.length === 0) {
            fetchOwners();
        }
    };

    // Handle adding new truck
    const handleAddTruck = async () => {
        if (!licensePlate || !selectedNewTruckOwner) {
            alert('กรุณากรอกทะเบียนและเลือกเจ้าของ');
            return;
        }

        setAddingTruck(true);
        try {
            const res = await fetch('/api/trucks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    licensePlate: licensePlate.toUpperCase(),
                    ownerId: selectedNewTruckOwner,
                }),
            });

            if (res.ok) {
                const newTruck = await res.json();
                // Auto-select the newly added truck
                setCustomerName(newTruck.owner.name);
                setOwnerId(newTruck.owner.id);
                setOwnerCode(newTruck.owner.code);
                setShowAddTruckModal(false);
                alert('✅ เพิ่มทะเบียนสำเร็จ!');
            } else {
                const err = await res.json();
                alert(err.error || 'เกิดข้อผิดพลาด');
            }
        } catch (error) {
            console.error('Error adding truck:', error);
            alert('เกิดข้อผิดพลาดในการเพิ่มทะเบียน');
        } finally {
            setAddingTruck(false);
        }
    };

    // Filter owners for display
    const filteredOwners = allOwners.filter(owner =>
        owner.name.toLowerCase().includes(ownerFilter.toLowerCase()) ||
        (owner.code && owner.code.toLowerCase().includes(ownerFilter.toLowerCase()))
    );

    const addFuelLine = () => {
        const newId = String(Date.now());
        setFuelLines([...fuelLines, {
            id: newId,
            fuelType: 'DIESEL',
            quantity: '',
            pricePerLiter: '30.50'
        }]);
    };

    const removeFuelLine = (id: string) => {
        if (fuelLines.length > 1) {
            setFuelLines(fuelLines.filter(line => line.id !== id));
        }
    };

    const updateFuelLine = (id: string, field: keyof FuelLine, value: string) => {
        setFuelLines(fuelLines.map(line => {
            if (line.id === id) {
                const updated = { ...line, [field]: value };
                // Auto-update price when fuel type changes - prefer stored prices
                if (field === 'fuelType') {
                    if (storedFuelPrices[value]) {
                        updated.pricePerLiter = storedFuelPrices[value].toString();
                    } else {
                        const fuel = FUEL_TYPES.find(f => f.value === value);
                        if (fuel) {
                            updated.pricePerLiter = fuel.defaultPrice.toFixed(2);
                        }
                    }
                }
                return updated;
            }
            return line;
        }));
    };

    const calculateLineTotal = (line: FuelLine) => {
        const qty = parseFloat(line.quantity) || 0;
        const price = parseFloat(line.pricePerLiter) || 0;
        return qty * price;
    };

    const calculateTotalQuantity = () => {
        return fuelLines.reduce((sum, line) => sum + (parseFloat(line.quantity) || 0), 0);
    };

    const calculateGrandTotal = () => {
        return fuelLines.reduce((sum, line) => sum + calculateLineTotal(line), 0);
    };

    const formatCurrency = (num: number) => new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validate: at least one line with quantity
        const validLines = fuelLines.filter(line => parseFloat(line.quantity) > 0);
        if (validLines.length === 0) {
            alert('กรุณากรอกจำนวนลิตรอย่างน้อย 1 รายการ');
            return;
        }

        if (creditPaymentTypeSet.has(paymentType)) {
            if (!bookNo.trim() || !billNo.trim()) {
                alert('รายการเงินเชื่อต้องระบุเล่มที่และเลขที่บิล');
                return;
            }
            if (!licensePlate.trim()) {
                alert('รายการเงินเชื่อต้องระบุทะเบียนรถ');
                return;
            }
            if (!ownerId) {
                alert('รายการเงินเชื่อต้องเลือกลูกค้าจากระบบก่อนบันทึก');
                return;
            }
        }

        setSaving(true);
        try {
            // Use bulk API for atomic transaction (All or Nothing)
            const res = await fetch(`/api/station/${stationId}/transactions/bulk`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date: selectedDate,
                    licensePlate,
                    ownerName: customerName,
                    ownerId,
                    paymentType,
                    billBookNo: bookNo,
                    billNo,
                    transferProofUrl,
                    lines: validLines.map(line => ({
                        fuelType: line.fuelType,
                        liters: parseFloat(line.quantity),
                        pricePerLiter: parseFloat(line.pricePerLiter),
                        amount: calculateLineTotal(line),
                    })),
                }),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to save transaction');
            }

            // ✅ บันทึกสำเร็จ - แสดง success message ชัดเจน
            setShowSuccess(true);

            // เคลียร์ฟอร์มเพื่อลงบิลถัดไป
            resetForm();

            // ซ่อน success message หลัง 2 วินาที
            setTimeout(() => setShowSuccess(false), 2000);

            // Notify parent to refresh transaction list
            onSave();
        } catch (error) {
            console.error('Error saving bill:', error);
            const errorMessage = error instanceof Error ? error.message : 'ไม่ทราบสาเหตุ';
            alert(`❌ บันทึกไม่สำเร็จ\n\n📋 สาเหตุ: ${errorMessage}`);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="glass-card p-6">
            {/* Success Banner - แสดงเมื่อบันทึกสำเร็จ */}
            {showSuccess && (
                <div className="mb-4 p-4 bg-green-500/20 border border-green-500/50 rounded-xl animate-pulse">
                    <div className="flex items-center justify-center gap-2 text-green-400 font-bold text-lg">
                        ✅ บันทึกสำเร็จ! ฟอร์มพร้อมลงบิลถัดไป
                    </div>
                </div>
            )}

            <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <FileText className="text-blue-400" />
                    ลงบิลใหม่
                    <span className="text-sm font-normal text-purple-400 bg-purple-500/20 px-2 py-1 rounded-lg ml-2">
                        📅 {new Date(selectedDate).toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                </h2>
                <button onClick={onCancel} className="text-gray-400 hover:text-white">
                    <X size={24} />
                </button>
            </div>

            <form onSubmit={handleSubmit}>
                {/* Header Row: Book/Bill No */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div>
                        <label className="block text-sm text-gray-400 mb-1">เล่มที่</label>
                        <input
                            type="text"
                            value={bookNo}
                            onChange={(e) => setBookNo(e.target.value)}
                            className="input-glow text-center"
                            placeholder="369"
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-gray-400 mb-1">เลขที่</label>
                        <input
                            type="text"
                            value={billNo}
                            onChange={(e) => setBillNo(e.target.value)}
                            className="input-glow text-center"
                            placeholder="18446"
                        />
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-sm text-gray-400 mb-1">ประเภทการชำระ</label>
                        <div className="flex flex-wrap gap-2">
                            {PAYMENT_TYPES.map((pt) => (
                                <button
                                    key={pt.value}
                                    type="button"
                                    onClick={() => setPaymentType(pt.value)}
                                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${paymentType === pt.value
                                        ? `${pt.color} text-white`
                                        : 'bg-white/10 text-gray-300 hover:bg-white/20'
                                        }`}
                                >
                                    {pt.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Transfer Proof Upload - Show only for TRANSFER */}
                {paymentType === 'TRANSFER' && (
                    <div className="mb-4 p-4 bg-blue-500/10 rounded-xl border border-blue-500/30">
                        <label className="block text-sm text-blue-400 mb-2 font-medium">📎 หลักฐานการโอนเงิน</label>
                        <div className="flex items-center gap-3">
                            <input
                                type="file"
                                ref={fileInputRef}
                                accept="image/*"
                                className="hidden"
                                onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;

                                    setUploading(true);
                                    try {
                                        const formData = new FormData();
                                        formData.append('file', file);

                                        const res = await fetch('/api/upload/transfer-proof', {
                                            method: 'POST',
                                            body: formData,
                                        });

                                        if (res.ok) {
                                            const { url } = await res.json();
                                            setTransferProofUrl(url);
                                        } else {
                                            alert('อัปโหลดไม่สำเร็จ');
                                        }
                                    } catch (err) {
                                        console.error('Upload error:', err);
                                        alert('เกิดข้อผิดพลาด');
                                    } finally {
                                        setUploading(false);
                                    }
                                }}
                            />
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploading}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white text-sm disabled:opacity-50"
                            >
                                {uploading ? (
                                    <>
                                        <div className="spinner w-4 h-4" />
                                        กำลังอัปโหลด...
                                    </>
                                ) : (
                                    <>
                                        <Camera size={16} />
                                        เลือกรูป
                                    </>
                                )}
                            </button>
                            {transferProofUrl && (
                                <div className="flex items-center gap-2">
                                    <Image size={16} className="text-green-400" />
                                    <span className="text-green-400 text-sm">อัปโหลดแล้ว</span>
                                    <button
                                        type="button"
                                        onClick={() => setTransferProofUrl(null)}
                                        className="text-red-400 hover:text-red-300 text-xs"
                                    >
                                        ลบ
                                    </button>
                                </div>
                            )}
                        </div>
                        {transferProofUrl && (
                            <div className="mt-2">
                                <img
                                    src={transferProofUrl}
                                    alt="หลักฐานการโอน"
                                    className="max-h-32 rounded-lg border border-green-500/30"
                                />
                            </div>
                        )}
                    </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div ref={dropdownRef} className="relative">
                        <label className="block text-sm text-gray-400 mb-1">ทะเบียนรถ</label>
                        <input
                            type="text"
                            value={licensePlate}
                            onChange={(e) => {
                                setLicensePlate(e.target.value);
                                setOwnerId(null);
                                setOwnerCode(null);
                                setOwnerPhone(null);
                            }}
                            onFocus={() => {
                                if (licensePlate.length >= 2) {
                                    setShowDropdown(true);
                                }
                            }}
                            className="input-glow"
                            placeholder="กพ-0000"
                        />
                        {searchLoading && (
                            <div className="absolute right-3 top-9">
                                <div className="spinner w-4 h-4" />
                            </div>
                        )}
                        {showDropdown && (
                            <div className="absolute z-50 w-full mt-1 glass-card max-h-48 overflow-y-auto">
                                {searchResults.length > 0 ? (
                                    searchResults.map((truck) => (
                                        <button
                                            key={truck.id}
                                            type="button"
                                            onClick={() => selectTruck(truck)}
                                            className="w-full px-4 py-3 text-left hover:bg-cyan-500/30 border-b border-white/20 last:border-b-0 transition-colors bg-slate-900/50"
                                        >
                                            <span className="font-mono text-cyan-300 font-bold">{truck.licensePlate}</span>
                                            <span className="text-yellow-300 font-medium ml-2">{truck.ownerName}</span>
                                        </button>
                                    ))
                                ) : !searchLoading && licensePlate.length >= 2 ? (
                                    <div className="p-3">
                                        <p className="text-yellow-400 text-sm mb-2">⚠️ ไม่พบทะเบียน &quot;{licensePlate}&quot;</p>
                                        <button
                                            type="button"
                                            onClick={openAddTruckModal}
                                            className="w-full mt-2 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm flex items-center justify-center gap-2"
                                        >
                                            <Plus size={16} />
                                            เพิ่มทะเบียนใหม่
                                        </button>
                                    </div>
                                ) : null}
                            </div>
                        )}
                    </div>
                    <div ref={ownerDropdownRef} className="relative">
                        <label className="block text-sm text-gray-400 mb-1">ชื่อลูกค้า</label>
                        <input
                            type="text"
                            value={customerName}
                            onChange={(e) => {
                                if (!ownerId) {
                                    setCustomerName(e.target.value);
                                }
                            }}
                            readOnly={!!ownerId}
                            className={`input-glow ${ownerId ? 'bg-green-900/30 border-green-500/50 cursor-not-allowed' : ''}`}
                            placeholder="ในนาม"
                        />
                        {ownerSearchLoading && (
                            <div className="absolute right-3 top-9">
                                <div className="spinner w-4 h-4" />
                            </div>
                        )}
                        {showOwnerDropdown && ownerSearchResults.length > 0 && (
                            <div className="absolute z-50 w-full mt-1 glass-card max-h-48 overflow-y-auto">
                                {ownerSearchResults.map((owner) => (
                                    <button
                                        key={owner.id}
                                        type="button"
                                        onClick={() => {
                                            setCustomerName(owner.name);
                                            setOwnerId(owner.id);
                                            setShowOwnerDropdown(false);
                                        }}
                                        className="w-full px-3 py-2 text-left hover:bg-purple-500/20 text-sm text-white"
                                    >
                                        {owner.name}
                                    </button>
                                ))}
                            </div>
                        )}
                        {ownerCode && (
                            <p className="text-xs text-green-400 mt-1 flex items-center gap-1">
                                <User size={10} /> รหัส: {ownerCode}
                                {ownerPhone && (
                                    <span className="ml-2 flex items-center gap-1">
                                        <Phone size={10} /> {ownerPhone}
                                    </span>
                                )}
                            </p>
                        )}
                    </div>
                </div>

                {/* Fuel Lines - Mobile Card View */}
                <div className="sm:hidden space-y-3 mb-4">
                    {fuelLines.map((line, index) => (
                        <div key={line.id} className="bg-white/5 rounded-xl p-4 border border-white/10">
                            <div className="flex items-center justify-between mb-3">
                                <select
                                    value={line.fuelType}
                                    onChange={(e) => updateFuelLine(line.id, 'fuelType', e.target.value)}
                                    className="flex-1 bg-white/10 text-white text-base py-3 px-4 rounded-xl border border-white/20 focus:border-purple-500"
                                >
                                    {FUEL_TYPES.map((fuel) => (
                                        <option key={fuel.value} value={fuel.value} className="bg-gray-800">
                                            {fuel.label}
                                        </option>
                                    ))}
                                </select>
                                {fuelLines.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={() => removeFuelLine(line.id)}
                                        className="ml-3 p-3 text-red-400 hover:bg-red-500/20 rounded-xl transition-colors"
                                    >
                                        <Trash2 size={20} />
                                    </button>
                                )}
                            </div>
                            <div className="grid grid-cols-2 gap-3 mb-3">
                                <div>
                                    <label className="block text-xs text-gray-400 mb-1">จำนวนลิตร</label>
                                    <input
                                        type="number"
                                        inputMode="decimal"
                                        step="0.01"
                                        value={line.quantity}
                                        onChange={(e) => updateFuelLine(line.id, 'quantity', e.target.value)}
                                        className="w-full bg-white/10 text-white text-center font-mono text-lg py-3 px-4 rounded-xl border border-white/20 focus:border-purple-500"
                                        placeholder="0.00"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-400 mb-1">ราคา/ลิตร</label>
                                    <input
                                        type="number"
                                        inputMode="decimal"
                                        step="0.01"
                                        value={line.pricePerLiter}
                                        onChange={(e) => updateFuelLine(line.id, 'pricePerLiter', e.target.value)}
                                        className="w-full bg-white/10 text-white text-center font-mono text-lg py-3 px-4 rounded-xl border border-white/20 focus:border-purple-500"
                                    />
                                </div>
                            </div>
                            <div className="text-right">
                                <span className="text-gray-400 text-sm">รวม: </span>
                                <span className="font-mono text-xl font-bold text-green-400">
                                    {formatCurrency(calculateLineTotal(line))} ฿
                                </span>
                            </div>
                        </div>
                    ))}
                    <button
                        type="button"
                        onClick={addFuelLine}
                        className="w-full py-3 rounded-xl border-2 border-dashed border-blue-500/30 text-blue-400 hover:bg-blue-500/10 flex items-center justify-center gap-2"
                    >
                        <Plus size={18} />
                        เพิ่มรายการ
                    </button>
                    {/* Mobile Total Summary */}
                    <div className="bg-gradient-to-r from-green-900/30 to-emerald-900/30 rounded-xl p-4 border border-green-500/20">
                        <div className="flex justify-between items-center">
                            <div>
                                <span className="text-gray-400 text-sm">รวมลิตร</span>
                                <span className="font-mono text-blue-400 ml-2">
                                    {formatCurrency(calculateTotalQuantity())} ล.
                                </span>
                            </div>
                            <div className="text-right">
                                <span className="text-gray-300 text-sm">รวมเงิน </span>
                                <span className="font-mono text-2xl font-bold text-green-400">
                                    {formatCurrency(calculateGrandTotal())} ฿
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Fuel Lines Table - Desktop View */}
                <div className="hidden sm:block border border-white/20 rounded-lg overflow-hidden mb-4">
                    <table className="w-full">
                        <thead className="bg-white/10">
                            <tr className="text-sm text-gray-400">
                                <th className="py-2 px-3 text-left w-12">ลบ</th>
                                <th className="py-2 px-3 text-left">รายการสินค้า</th>
                                <th className="py-2 px-3 text-right w-28">จำนวน</th>
                                <th className="py-2 px-3 text-right w-28">ราคา/หน่วย</th>
                                <th className="py-2 px-3 text-right w-32">จำนวนเงิน</th>
                            </tr>
                        </thead>
                        <tbody>
                            {fuelLines.map((line, index) => (
                                <tr key={line.id} className="border-t border-white/10">
                                    <td className="py-2 px-3">
                                        {fuelLines.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => removeFuelLine(line.id)}
                                                className="text-red-400 hover:text-red-300"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </td>
                                    <td className="py-2 px-3">
                                        <select
                                            value={line.fuelType}
                                            onChange={(e) => updateFuelLine(line.id, 'fuelType', e.target.value)}
                                            className="w-full bg-transparent text-white text-sm py-1 px-2 rounded border border-white/20 focus:border-purple-500"
                                        >
                                            {FUEL_TYPES.map((fuel) => (
                                                <option key={fuel.value} value={fuel.value} className="bg-gray-800">
                                                    {fuel.label}
                                                </option>
                                            ))}
                                        </select>
                                    </td>
                                    <td className="py-2 px-3">
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={line.quantity}
                                            onChange={(e) => updateFuelLine(line.id, 'quantity', e.target.value)}
                                            className="w-full bg-transparent text-white text-right font-mono text-sm py-1 px-2 rounded border border-white/20 focus:border-purple-500"
                                            placeholder="0.00"
                                        />
                                    </td>
                                    <td className="py-2 px-3">
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={line.pricePerLiter}
                                            onChange={(e) => updateFuelLine(line.id, 'pricePerLiter', e.target.value)}
                                            className="w-full bg-transparent text-white text-right font-mono text-sm py-1 px-2 rounded border border-white/20 focus:border-purple-500"
                                        />
                                    </td>
                                    <td className="py-2 px-3 text-right font-mono text-white">
                                        {formatCurrency(calculateLineTotal(line))}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr className="border-t border-white/20">
                                <td colSpan={2} className="py-2 px-3">
                                    <button
                                        type="button"
                                        onClick={addFuelLine}
                                        className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1"
                                    >
                                        <Plus size={14} />
                                        เพิ่มรายการ
                                    </button>
                                </td>
                                <td className="py-2 px-3 text-right font-medium text-gray-400">
                                    {formatCurrency(calculateTotalQuantity())} ล.
                                </td>
                                <td className="py-2 px-3 text-right font-bold text-white">รวมเงิน:</td>
                                <td className="py-2 px-3 text-right font-bold text-xl text-green-400">
                                    {formatCurrency(calculateGrandTotal())}
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                {/* Submit Button */}
                <div className="flex gap-3">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="flex-1 btn btn-secondary"
                    >
                        ยกเลิก
                    </button>
                    <button
                        type="submit"
                        disabled={saving}
                        className="flex-1 btn btn-success flex items-center justify-center gap-2"
                    >
                        <Save size={18} />
                        {saving ? 'กำลังบันทึก...' : 'บันทึกบิล'}
                    </button>
                </div>
            </form>

            {/* Add Truck Modal */}
            {showAddTruckModal && (
                <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
                    <div className="bg-[#0f0f1a] rounded-2xl w-full max-w-md border border-white/10">
                        <div className="flex items-center justify-between p-4 border-b border-white/10">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <Plus className="text-green-400" />
                                เพิ่มทะเบียนใหม่
                            </h3>
                            <button
                                onClick={() => setShowAddTruckModal(false)}
                                className="text-gray-400 hover:text-white"
                            >
                                <X size={24} />
                            </button>
                        </div>
                        <div className="p-4 space-y-4">
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">ทะเบียนรถ</label>
                                <div className="input-glow bg-blue-900/30 border-blue-500/50 text-blue-400 font-mono text-lg">
                                    {licensePlate}
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">ค้นหาเจ้าของ</label>
                                <input
                                    type="text"
                                    value={ownerFilter}
                                    onChange={(e) => setOwnerFilter(e.target.value)}
                                    placeholder="พิมพ์ชื่อหรือรหัส..."
                                    className="input-glow"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">เลือกเจ้าของ</label>
                                <div className="max-h-48 overflow-y-auto bg-white/5 rounded-lg border border-white/10">
                                    {filteredOwners.length === 0 ? (
                                        <p className="text-gray-400 text-center py-4">ไม่พบเจ้าของ...</p>
                                    ) : (
                                        filteredOwners.slice(0, 50).map((owner) => (
                                            <button
                                                key={owner.id}
                                                type="button"
                                                onClick={() => setSelectedNewTruckOwner(owner.id)}
                                                className={`w-full px-3 py-2 text-left text-sm border-b border-white/5 last:border-b-0 transition-colors ${selectedNewTruckOwner === owner.id
                                                    ? 'bg-green-600/30 text-green-400'
                                                    : 'hover:bg-purple-500/20 text-white'
                                                    }`}
                                            >
                                                <span className="font-medium">{owner.name}</span>
                                                {owner.code && (
                                                    <span className="text-gray-500 ml-2">({owner.code})</span>
                                                )}
                                            </button>
                                        ))
                                    )}
                                </div>
                                {filteredOwners.length > 50 && (
                                    <p className="text-gray-500 text-xs mt-1">แสดง 50 รายการแรก กรุณาค้นหาเพื่อกรอง</p>
                                )}
                            </div>
                        </div>
                        <div className="flex gap-3 p-4 border-t border-white/10">
                            <button
                                onClick={() => setShowAddTruckModal(false)}
                                className="flex-1 btn btn-secondary"
                            >
                                ยกเลิก
                            </button>
                            <button
                                onClick={handleAddTruck}
                                disabled={!selectedNewTruckOwner || addingTruck}
                                className="flex-1 btn btn-success flex items-center justify-center gap-2"
                            >
                                <Save size={18} />
                                {addingTruck ? 'กำลังเพิ่ม...' : 'เพิ่มทะเบียน'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
