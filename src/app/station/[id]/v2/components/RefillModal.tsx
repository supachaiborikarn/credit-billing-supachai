'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Check, Upload, Search, ChevronDown } from 'lucide-react';
import { PAYMENT_TYPES } from '@/constants';

interface Owner {
    id: string;
    name: string;
    code: string | null;
    licensePlates?: string[];
}

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

    // Transfer proof state
    const [transferProofFile, setTransferProofFile] = useState<File | null>(null);
    const [transferProofPreview, setTransferProofPreview] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Owner dropdown state
    const [owners, setOwners] = useState<Owner[]>([]);
    const [ownerSearchQuery, setOwnerSearchQuery] = useState('');
    const [showOwnerDropdown, setShowOwnerDropdown] = useState(false);
    const [selectedOwner, setSelectedOwner] = useState<Owner | null>(null);
    const ownerDropdownRef = useRef<HTMLDivElement>(null);

    // UI state
    const [searchResults, setSearchResults] = useState<TruckSearchResult[]>([]);
    const [searching, setSearching] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);

    // Calculate amount
    const amount = (parseFloat(liters) || 0) * (parseFloat(pricePerLiter) || 0);

    // Check if transfer proof is required
    const isTransferPayment = paymentType === 'TRANSFER';

    // Update price based on payment type
    useEffect(() => {
        if (paymentType === 'CASH') {
            setPricePerLiter(retailPrice.toString());
        } else {
            setPricePerLiter(wholesalePrice.toString());
        }
    }, [paymentType, retailPrice, wholesalePrice]);

    // Fetch owners on mount
    useEffect(() => {
        const fetchOwners = async () => {
            try {
                const res = await fetch('/api/owners');
                if (res.ok) {
                    const data = await res.json();
                    setOwners(data);
                }
            } catch (error) {
                console.error('Failed to fetch owners:', error);
            }
        };
        fetchOwners();
    }, []);

    // Close owner dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (ownerDropdownRef.current && !ownerDropdownRef.current.contains(e.target as Node)) {
                setShowOwnerDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Filter owners
    const filteredOwners = owners.filter(o =>
        o.name.toLowerCase().includes(ownerSearchQuery.toLowerCase()) ||
        (o.code && o.code.toLowerCase().includes(ownerSearchQuery.toLowerCase())) ||
        (o.licensePlates && o.licensePlates.some(lp => lp.toLowerCase().includes(ownerSearchQuery.toLowerCase())))
    );

    // Handle file selection
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            // Validate file type
            if (!file.type.startsWith('image/')) {
                alert('กรุณาเลือกไฟล์รูปภาพเท่านั้น');
                return;
            }
            // Validate file size (max 5MB)
            if (file.size > 5 * 1024 * 1024) {
                alert('ไฟล์ขนาดใหญ่เกินไป (สูงสุด 5MB)');
                return;
            }
            setTransferProofFile(file);
            // Create preview
            const reader = new FileReader();
            reader.onloadend = () => {
                setTransferProofPreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    // Upload image to server
    const uploadTransferProof = async (): Promise<string | null> => {
        if (!transferProofFile) return null;

        setUploadingImage(true);
        try {
            const formData = new FormData();
            formData.append('file', transferProofFile);
            formData.append('type', 'transfer_proof');

            const res = await fetch('/api/upload/transfer-proof', {
                method: 'POST',
                body: formData,
            });

            if (res.ok) {
                const data = await res.json();
                return data.url;
            } else {
                console.error('Upload failed');
                return null;
            }
        } catch (error) {
            console.error('Upload error:', error);
            return null;
        } finally {
            setUploadingImage(false);
        }
    };

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

    const handleOwnerSelect = (owner: Owner) => {
        setSelectedOwner(owner);
        setOwnerName(owner.name);
        setOwnerCode(owner.code || '');
        setOwnerId(owner.id);
        // Set first license plate if available
        if (owner.licensePlates && owner.licensePlates.length > 0) {
            setLicensePlate(owner.licensePlates[0]);
        }
        setShowOwnerDropdown(false);
        setOwnerSearchQuery('');
    };

    const inputBaseClass = "w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white";
    const inputNumberClass = `${inputBaseClass} text-right text-xl font-mono font-semibold`;

    const handleSubmit = async () => {
        // Only CREDIT requires license plate. CASH and TRANSFER don't.
        const isCreditPayment = paymentType === 'CREDIT';
        if ((isCreditPayment && !licensePlate) || !liters || parseFloat(liters) <= 0) {
            alert(isCreditPayment ? 'กรุณากรอกทะเบียนและจำนวนลิตร' : 'กรุณากรอกจำนวนลิตร');
            return;
        }

        // CREDIT requires bill book number and bill number
        if (isCreditPayment && (!billBookNo || !billNo)) {
            alert('กรุณากรอก เล่มที่ และ เลขที่บิล สำหรับเงินเชื่อ');
            return;
        }

        // Validate transfer proof for TRANSFER payment
        if (isTransferPayment && !transferProofFile) {
            alert('กรุณาแนบหลักฐานการโอนเงิน');
            return;
        }

        setSubmitting(true);
        try {
            // Upload transfer proof first if exists
            let transferProofUrl = null;
            if (transferProofFile) {
                transferProofUrl = await uploadTransferProof();
                if (!transferProofUrl && isTransferPayment) {
                    alert('อัพโหลดรูปภาพไม่สำเร็จ กรุณาลองใหม่');
                    setSubmitting(false);
                    return;
                }
            }

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
                    transferProofUrl,
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

                {/* Transfer Proof Upload - Show only for TRANSFER */}
                {isTransferPayment && (
                    <div className="bg-blue-50 rounded-xl p-4 border-2 border-blue-200">
                        <label className="text-sm text-blue-700 font-medium block mb-2">
                            📎 หลักฐานการโอนเงิน <span className="text-red-500">*</span>
                        </label>

                        <input
                            type="file"
                            ref={fileInputRef}
                            accept="image/*"
                            onChange={handleFileSelect}
                            className="hidden"
                        />

                        {transferProofPreview ? (
                            <div className="relative">
                                <img
                                    src={transferProofPreview}
                                    alt="หลักฐานการโอน"
                                    className="w-full max-h-48 object-contain rounded-lg border border-blue-300"
                                />
                                <button
                                    type="button"
                                    onClick={() => {
                                        setTransferProofFile(null);
                                        setTransferProofPreview(null);
                                    }}
                                    className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition"
                                >
                                    <X size={16} />
                                </button>
                                <p className="text-xs text-green-600 mt-2 text-center">
                                    ✓ แนบรูปแล้ว: {transferProofFile?.name}
                                </p>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="w-full py-6 border-2 border-dashed border-blue-300 rounded-xl bg-white hover:bg-blue-50 transition flex flex-col items-center gap-2"
                            >
                                <Upload size={32} className="text-blue-500" />
                                <span className="text-blue-600 font-medium">แตะเพื่อเลือกรูปภาพ</span>
                                <span className="text-xs text-gray-400">หรือถ่ายรูปสลิปโอนเงิน</span>
                            </button>
                        )}
                    </div>
                )}

                {/* Owner Dropdown */}
                <div ref={ownerDropdownRef} className="bg-gray-50 rounded-xl p-4 relative">
                    <label className="text-sm text-gray-600 block mb-2">ลูกค้า / เจ้าของรถ</label>
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
                        <div className="absolute z-20 mt-1 left-4 right-4 bg-white border border-gray-200 rounded-xl shadow-lg max-h-72 overflow-hidden">
                            {/* Search */}
                            <div className="p-2 border-b border-gray-100">
                                <div className="relative">
                                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input
                                        type="text"
                                        value={ownerSearchQuery}
                                        onChange={e => setOwnerSearchQuery(e.target.value)}
                                        placeholder="ค้นหาชื่อ, รหัส, หรือทะเบียน..."
                                        className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        autoFocus
                                    />
                                </div>
                            </div>

                            {/* Options */}
                            <div className="max-h-56 overflow-y-auto">
                                {filteredOwners.length > 0 ? (
                                    filteredOwners.slice(0, 20).map(owner => (
                                        <button
                                            key={owner.id}
                                            type="button"
                                            onClick={() => handleOwnerSelect(owner)}
                                            className="w-full px-4 py-3 text-left hover:bg-blue-50 flex items-center justify-between border-b border-gray-50 last:border-0"
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

                {/* License Plate Search */}
                <div className="bg-gray-50 rounded-xl p-4">
                    <label className="text-sm text-gray-600 block mb-2">ทะเบียนรถ</label>
                    <div className="relative">
                        <input
                            type="text"
                            value={licensePlate}
                            onChange={e => setLicensePlate(e.target.value)}
                            placeholder="พิมพ์ทะเบียน..."
                            className={inputBaseClass}
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
                                    <span className="font-mono font-bold text-gray-900">{truck.licensePlate}</span>
                                    <span className="text-gray-600 ml-2">{truck.ownerName}</span>
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
                                className={inputBaseClass}
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
                                <label className="text-xs text-gray-500">เล่มที่</label>
                                <input
                                    type="text"
                                    value={billBookNo}
                                    onChange={e => setBillBookNo(e.target.value)}
                                    placeholder="เล่ม..."
                                    className={inputBaseClass}
                                />
                            </div>
                            <div>
                                <label className="text-xs text-gray-500">เลขที่</label>
                                <input
                                    type="text"
                                    value={billNo}
                                    onChange={e => setBillNo(e.target.value)}
                                    placeholder="เลขที่..."
                                    className={inputBaseClass}
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
                        className="w-full px-4 py-4 border border-gray-300 rounded-xl text-2xl font-mono font-bold text-right text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
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
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl text-xl font-mono font-semibold text-right text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
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
                    disabled={submitting || uploadingImage || (paymentType === 'CREDIT' && (!licensePlate || !billBookNo || !billNo)) || !liters || (isTransferPayment && !transferProofFile)}
                    className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold text-lg rounded-xl disabled:opacity-50 flex items-center justify-center gap-2"
                >
                    {submitting || uploadingImage ? (
                        <>
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            {uploadingImage ? 'กำลังอัพโหลดรูป...' : 'กำลังบันทึก...'}
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
