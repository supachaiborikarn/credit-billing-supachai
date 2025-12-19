'use client';

import { useState, useEffect, useRef } from 'react';
import { Save, X, Plus, Trash2, User, Phone, FileText } from 'lucide-react';
import { FUEL_TYPES, PAYMENT_TYPES } from '@/constants';

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

    const [fuelLines, setFuelLines] = useState<FuelLine[]>([
        { id: '1', fuelType: 'DIESEL', quantity: '', pricePerLiter: '30.50' }
    ]);

    const [saving, setSaving] = useState(false);

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
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectTruck = (truck: TruckSearchResult) => {
        setLicensePlate(truck.licensePlate);
        setCustomerName(truck.ownerName);
        setOwnerId(truck.ownerId);
        setOwnerCode(truck.ownerCode);
        setOwnerPhone(truck.ownerPhone);
        setShowDropdown(false);
    };

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
                // Auto-update price when fuel type changes
                if (field === 'fuelType') {
                    const fuel = FUEL_TYPES.find(f => f.value === value);
                    if (fuel) {
                        updated.pricePerLiter = fuel.defaultPrice.toFixed(2);
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

        setSaving(true);
        try {
            // Save each fuel line as a separate transaction
            for (const line of validLines) {
                const res = await fetch(`/api/station/${stationId}/transactions`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        date: selectedDate,
                        licensePlate,
                        ownerName: customerName,
                        ownerId,
                        paymentType,
                        fuelType: line.fuelType,
                        liters: parseFloat(line.quantity),
                        pricePerLiter: parseFloat(line.pricePerLiter),
                        amount: calculateLineTotal(line),
                        billBookNo: bookNo,
                        billNo,
                    }),
                });

                if (!res.ok) {
                    throw new Error('Failed to save transaction');
                }
            }

            onSave();
        } catch (error) {
            console.error('Error saving bill:', error);
            alert('เกิดข้อผิดพลาดในการบันทึก');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <FileText className="text-blue-400" />
                    ลงบิลใหม่
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
                            {PAYMENT_TYPES.slice(0, 3).map((pt) => (
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

                {/* Customer Info */}
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
                            className="input-glow"
                            placeholder="กพ-0000"
                        />
                        {searchLoading && (
                            <div className="absolute right-3 top-9">
                                <div className="spinner w-4 h-4" />
                            </div>
                        )}
                        {showDropdown && searchResults.length > 0 && (
                            <div className="absolute z-50 w-full mt-1 glass-card max-h-48 overflow-y-auto">
                                {searchResults.map((truck) => (
                                    <button
                                        key={truck.id}
                                        type="button"
                                        onClick={() => selectTruck(truck)}
                                        className="w-full px-3 py-2 text-left hover:bg-purple-500/20 text-sm"
                                    >
                                        <span className="font-mono text-blue-400">{truck.licensePlate}</span>
                                        <span className="text-gray-400 ml-2">{truck.ownerName}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    <div>
                        <label className="block text-sm text-gray-400 mb-1">ชื่อลูกค้า</label>
                        <input
                            type="text"
                            value={customerName}
                            onChange={(e) => setCustomerName(e.target.value)}
                            className="input-glow"
                            placeholder="ในนาม"
                        />
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
        </div>
    );
}
