'use client';

import { useState, useEffect, use, useRef } from 'react';
import { ArrowLeft, Search, User, Check, Plus, Minus, ShoppingCart, UserPlus } from 'lucide-react';
import { STATIONS, PAYMENT_TYPES, FUEL_TYPES } from '@/constants';
import Link from 'next/link';

interface TruckResult {
    id: string;
    licensePlate: string;
    ownerName: string;
    ownerId?: string;
}

interface Product {
    id: string;
    name: string;
    unit: string;
    salePrice: number;
    quantity: number; // stock
}

interface SelectedProduct {
    productId: string;
    name: string;
    unit: string;
    price: number;
    qty: number;
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

    // Product selection
    const [products, setProducts] = useState<Product[]>([]);
    const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>([]);
    const [showProductPicker, setShowProductPicker] = useState(false);

    // Fuel prices from localStorage
    const [fuelPrices, setFuelPrices] = useState<Record<string, number>>({});

    // Input mode: 'liters' or 'amount'
    const [inputMode, setInputMode] = useState<'liters' | 'amount'>('liters');
    const [amountInput, setAmountInput] = useState('');

    // Search
    const [searchResults, setSearchResults] = useState<TruckResult[]>([]);
    const [showResults, setShowResults] = useState(false);
    const [searchLoading, setSearchLoading] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);

    // New truck modal
    const [showNewTruckModal, setShowNewTruckModal] = useState(false);
    const [newTruckPlate, setNewTruckPlate] = useState('');
    const [selectedOwnerId, setSelectedOwnerId] = useState('');
    const [savingNewTruck, setSavingNewTruck] = useState(false);
    const [ownersList, setOwnersList] = useState<Array<{ id: string; name: string; code: string }>>([]);
    const [loadingOwners, setLoadingOwners] = useState(false);
    const [ownerSearch, setOwnerSearch] = useState('');
    const [showOwnerDropdown, setShowOwnerDropdown] = useState(false);

    // Load products for this station
    useEffect(() => {
        const fetchProducts = async () => {
            try {
                const res = await fetch(`/api/simple-station/${id}/products`);
                if (res.ok) {
                    const data = await res.json();
                    setProducts(data.products || []);
                }
            } catch (error) {
                console.error('Error fetching products:', error);
            }
        };
        fetchProducts();
    }, [id]);

    // Load fuel prices from localStorage
    useEffect(() => {
        const storageKey = `fuelPrices_station${id}_${selectedDate}`;
        const stored = localStorage.getItem(storageKey);
        if (stored) {
            const prices = JSON.parse(stored);
            setFuelPrices(prices);
            // Auto-fill price for currently selected fuel type
            if (prices[fuelType]) {
                const p = prices[fuelType];
                setPricePerLiter(p.toString());
                setPriceDisplay(Math.round(p * 100).toString());
            }
        }
    }, [id, selectedDate]);

    // Auto-fill price when fuel type changes
    useEffect(() => {
        if (fuelPrices[fuelType]) {
            const p = fuelPrices[fuelType];
            setPricePerLiter(p.toString());
            setPriceDisplay(Math.round(p * 100).toString());
        }
    }, [fuelType, fuelPrices]);

    // Calculate based on input mode
    useEffect(() => {
        const p = parseFloat(pricePerLiter) || 0;
        if (inputMode === 'liters') {
            const l = parseFloat(liters) || 0;
            setAmount(l * p);
        } else {
            // Amount mode: calculate liters from amount
            const a = parseFloat(amountInput) || 0;
            setAmount(a);
            if (p > 0) {
                const calculatedLiters = a / p;
                setLiters(calculatedLiters.toFixed(2));
            }
        }
    }, [liters, pricePerLiter, inputMode, amountInput]);

    // Calculate total including products
    const productsTotal = selectedProducts.reduce((sum, p) => sum + p.price * p.qty, 0);
    const grandTotal = amount + productsTotal;

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

    // Add new truck
    const handleAddNewTruck = async () => {
        if (!newTruckPlate.trim() || !selectedOwnerId) {
            alert('กรุณากรอกทะเบียนและเลือกเจ้าของ');
            return;
        }

        setSavingNewTruck(true);
        try {
            const res = await fetch('/api/trucks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    licensePlate: newTruckPlate.trim(),
                    ownerId: selectedOwnerId,
                }),
            });

            if (res.ok) {
                const data = await res.json();
                // Use the new truck
                setLicensePlate(newTruckPlate.trim());
                const selectedOwner = ownersList.find(o => o.id === selectedOwnerId);
                setOwnerName(selectedOwner?.name || '');
                setOwnerId(selectedOwnerId);
                setShowNewTruckModal(false);
                setNewTruckPlate('');
                setSelectedOwnerId('');
                alert('✅ เพิ่มทะเบียนใหม่สำเร็จ!');
            } else {
                const err = await res.json();
                alert(err.error || 'เพิ่มไม่สำเร็จ');
            }
        } catch (error) {
            console.error('Error adding truck:', error);
            alert('เกิดข้อผิดพลาด');
        } finally {
            setSavingNewTruck(false);
        }
    };

    // Fetch owners when modal opens
    const openNewTruckModal = async () => {
        setNewTruckPlate(licensePlate);
        setShowNewTruckModal(true);
        setShowResults(false);
        setOwnerSearch('');
        setSelectedOwnerId('');

        if (ownersList.length === 0) {
            setLoadingOwners(true);
            try {
                const res = await fetch('/api/owners');
                if (res.ok) {
                    const data = await res.json();
                    // Show all owners
                    setOwnersList(data);
                }
            } catch (e) {
                console.error('Error loading owners:', e);
            } finally {
                setLoadingOwners(false);
            }
        }
    };

    // Filter owners based on search
    const filteredOwners = ownersList.filter(o =>
        (o.name || '').toLowerCase().includes(ownerSearch.toLowerCase()) ||
        (o.code || '').toLowerCase().includes(ownerSearch.toLowerCase())
    ).slice(0, 20); // Limit to 20 results

    // Select an owner
    const selectOwner = (owner: { id: string; name: string; code: string }) => {
        setSelectedOwnerId(owner.id);
        setOwnerSearch(owner.code ? `${owner.code} - ${owner.name}` : owner.name);
        setShowOwnerDropdown(false);
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

    // Add product to selection
    const addProduct = (product: Product) => {
        const existing = selectedProducts.find(p => p.productId === product.id);
        if (existing) {
            // Increase qty
            setSelectedProducts(prev =>
                prev.map(p => p.productId === product.id ? { ...p, qty: p.qty + 1 } : p)
            );
        } else {
            setSelectedProducts(prev => [
                ...prev,
                {
                    productId: product.id,
                    name: product.name,
                    unit: product.unit,
                    price: product.salePrice,
                    qty: 1,
                },
            ]);
        }
        setShowProductPicker(false);
    };

    // Update product qty
    const updateProductQty = (productId: string, delta: number) => {
        setSelectedProducts(prev =>
            prev.map(p => {
                if (p.productId === productId) {
                    const newQty = Math.max(0, p.qty + delta);
                    return { ...p, qty: newQty };
                }
                return p;
            }).filter(p => p.qty > 0)
        );
    };

    const handleSubmit = async () => {
        // Allow either fuel or products
        const hasFuel = liters && parseFloat(liters) > 0;
        const hasProducts = selectedProducts.length > 0;

        if (!hasFuel && !hasProducts) {
            alert('กรุณาใส่จำนวนลิตร หรือเลือกสินค้า');
            return;
        }
        if (hasFuel && (!pricePerLiter || parseFloat(pricePerLiter) <= 0)) {
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
                    fuelType: hasFuel ? fuelType : null,
                    liters: hasFuel ? parseFloat(liters) : 0,
                    pricePerLiter: hasFuel ? parseFloat(pricePerLiter) : 0,
                    amount: grandTotal,
                    billBookNo: bookNo || null,
                    billNo: billNo || null,
                    products: selectedProducts, // Send selected products
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
                setSelectedProducts([]);
                alert('✅ บันทึกเรียบร้อย!');

                // Refresh products to update stock
                const prodRes = await fetch(`/api/simple-station/${id}/products`);
                if (prodRes.ok) {
                    const data = await prodRes.json();
                    setProducts(data.products || []);
                }
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

                    {/* Show add new option when no results */}
                    {showResults && searchResults.length === 0 && licensePlate.length >= 2 && !searchLoading && (
                        <button
                            onClick={openNewTruckModal}
                            className="mt-2 w-full px-4 py-3 flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl text-blue-700 hover:bg-blue-100 transition"
                        >
                            <UserPlus size={18} />
                            <span>เพิ่มทะเบียนใหม่ "{licensePlate}"</span>
                        </button>
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

                {/* Liters/Amount Input with Mode Toggle */}
                <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
                    {/* Mode Toggle */}
                    <div className="flex items-center justify-center gap-2 mb-2">
                        <button
                            onClick={() => setInputMode('liters')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${inputMode === 'liters' ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600'}`}
                        >
                            กรอกลิตร
                        </button>
                        <button
                            onClick={() => setInputMode('amount')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${inputMode === 'amount' ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600'}`}
                        >
                            กรอกเงิน
                        </button>
                    </div>

                    {inputMode === 'liters' ? (
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
                    ) : (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                💵 จำนวนเงิน (บาท)
                            </label>
                            <input
                                type="number"
                                value={amountInput}
                                onChange={(e) => setAmountInput(e.target.value)}
                                placeholder="0"
                                className="w-full px-4 py-4 border border-gray-200 rounded-xl text-2xl text-center font-bold focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-800"
                                inputMode="decimal"
                            />
                            {liters && parseFloat(liters) > 0 && (
                                <p className="text-center text-sm text-gray-500 mt-2">
                                    = {parseFloat(liters).toFixed(2)} ลิตร
                                </p>
                            )}
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            💰 ราคาต่อลิตร {fuelPrices[fuelType] && <span className="text-green-600 text-xs">(ตั้งไว้แล้ว)</span>}
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

                {/* Product Selection */}
                <div className="bg-white rounded-2xl shadow-sm p-4">
                    <div className="flex items-center justify-between mb-3">
                        <label className="text-sm font-medium text-gray-700">
                            🛒 สินค้าเพิ่มเติม (น้ำมันเครื่อง/อุปกรณ์)
                        </label>
                        <button
                            onClick={() => setShowProductPicker(true)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-purple-500 text-white text-sm font-medium rounded-lg hover:bg-purple-600 transition"
                        >
                            <Plus size={16} />
                            เพิ่ม
                        </button>
                    </div>

                    {selectedProducts.length > 0 ? (
                        <div className="space-y-2">
                            {selectedProducts.map((item) => (
                                <div key={item.productId} className="flex items-center justify-between bg-purple-50 p-3 rounded-xl">
                                    <div>
                                        <p className="font-medium text-gray-800">{item.name}</p>
                                        <p className="text-sm text-gray-500">{formatCurrency(item.price)} ฿/{item.unit}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => updateProductQty(item.productId, -1)}
                                            className="w-8 h-8 flex items-center justify-center bg-gray-200 rounded-full hover:bg-gray-300"
                                        >
                                            <Minus size={16} />
                                        </button>
                                        <span className="w-8 text-center font-bold">{item.qty}</span>
                                        <button
                                            onClick={() => updateProductQty(item.productId, 1)}
                                            className="w-8 h-8 flex items-center justify-center bg-purple-500 text-white rounded-full hover:bg-purple-600"
                                        >
                                            <Plus size={16} />
                                        </button>
                                        <span className="ml-2 font-bold text-purple-700">{formatCurrency(item.price * item.qty)} ฿</span>
                                    </div>
                                </div>
                            ))}
                            <div className="flex justify-between pt-2 border-t border-gray-200">
                                <span className="font-medium text-gray-600">รวมสินค้า</span>
                                <span className="font-bold text-purple-700">{formatCurrency(productsTotal)} ฿</span>
                            </div>
                        </div>
                    ) : (
                        <p className="text-sm text-gray-400 text-center py-3">ยังไม่มีสินค้า กดปุ่ม "เพิ่ม" เพื่อเลือก</p>
                    )}
                </div>

                {/* Total Amount */}
                <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-2xl p-4 text-center">
                    <p className="text-orange-100 text-sm mb-1">รวมทั้งสิ้น</p>
                    <p className="text-white text-4xl font-bold">฿{formatCurrency(grandTotal)}</p>
                    {productsTotal > 0 && (
                        <p className="text-orange-100 text-xs mt-1">
                            (น้ำมัน {formatCurrency(amount)} + สินค้า {formatCurrency(productsTotal)})
                        </p>
                    )}
                </div>

                {/* Submit Button */}
                <button
                    onClick={handleSubmit}
                    disabled={loading || ((!liters || parseFloat(liters) <= 0) && selectedProducts.length === 0)}
                    className="w-full py-4 bg-orange-500 hover:bg-orange-600 text-white text-lg font-bold rounded-2xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                >
                    {loading ? 'กำลังบันทึก...' : '✅ บันทึก'}
                </button>
            </div>

            {/* Product Picker Modal */}
            {showProductPicker && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
                    <div className="bg-white w-full max-w-lg rounded-t-3xl max-h-[80vh] overflow-hidden flex flex-col">
                        <div className="p-4 border-b flex items-center justify-between">
                            <h2 className="text-lg font-bold text-gray-800">🛒 เลือกสินค้า</h2>
                            <button onClick={() => setShowProductPicker(false)} className="text-gray-500">✕</button>
                        </div>
                        <div className="flex-1 overflow-auto p-4">
                            {products.length === 0 ? (
                                <div className="text-center py-8">
                                    <p className="text-gray-400">ยังไม่มีสินค้า</p>
                                    <Link href={`/simple-station/${id}/new/products`} className="text-purple-500 text-sm mt-2 inline-block">
                                        → ไปเพิ่มสินค้า
                                    </Link>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {products.map((product) => (
                                        <button
                                            key={product.id}
                                            onClick={() => addProduct(product)}
                                            className="w-full flex items-center justify-between p-3 rounded-xl bg-gray-50 hover:bg-purple-50 transition text-left"
                                        >
                                            <div>
                                                <p className="font-medium text-gray-800">{product.name}</p>
                                                <p className="text-sm text-gray-500">
                                                    {formatCurrency(product.salePrice)} ฿/{product.unit} • คงเหลือ {product.quantity}
                                                </p>
                                            </div>
                                            <div className="w-8 h-8 flex items-center justify-center bg-purple-500 text-white rounded-full">
                                                <Plus size={18} />
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* New Truck Modal */}
            {showNewTruckModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
                        <div className="p-4 border-b flex items-center justify-between">
                            <h2 className="text-lg font-bold text-gray-800">🚗 เพิ่มทะเบียนใหม่</h2>
                            <button
                                onClick={() => setShowNewTruckModal(false)}
                                className="text-gray-500 text-xl"
                            >
                                ✕
                            </button>
                        </div>
                        <div className="p-4 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    ทะเบียนรถ
                                </label>
                                <input
                                    type="text"
                                    value={newTruckPlate}
                                    onChange={(e) => setNewTruckPlate(e.target.value)}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="เช่น กก-1234"
                                />
                            </div>
                            <div className="relative">
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    ค้นหาเจ้าของ
                                </label>
                                {loadingOwners ? (
                                    <div className="flex items-center justify-center py-3">
                                        <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                                        <span className="ml-2 text-gray-500">กำลังโหลด...</span>
                                    </div>
                                ) : (
                                    <>
                                        <input
                                            type="text"
                                            value={ownerSearch}
                                            onChange={(e) => {
                                                setOwnerSearch(e.target.value);
                                                setSelectedOwnerId('');
                                                setShowOwnerDropdown(true);
                                            }}
                                            onFocus={() => setShowOwnerDropdown(true)}
                                            placeholder="พิมพ์ชื่อหรือรหัสเพื่อค้นหา..."
                                            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                        {showOwnerDropdown && (
                                            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-auto">
                                                {filteredOwners.length === 0 ? (
                                                    <div className="px-4 py-3 text-gray-500 text-center">
                                                        ไม่พบเจ้าของ
                                                    </div>
                                                ) : (
                                                    filteredOwners.map(owner => (
                                                        <button
                                                            key={owner.id}
                                                            type="button"
                                                            onClick={() => selectOwner(owner)}
                                                            className="w-full px-4 py-2 text-left hover:bg-blue-50 border-b border-gray-100 last:border-b-0"
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
                        </div>
                        <div className="p-4 border-t flex gap-2">
                            <button
                                onClick={() => {
                                    setShowNewTruckModal(false);
                                    setShowOwnerDropdown(false);
                                }}
                                className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50"
                            >
                                ยกเลิก
                            </button>
                            <button
                                onClick={handleAddNewTruck}
                                disabled={savingNewTruck || !newTruckPlate.trim() || !selectedOwnerId}
                                className="flex-1 py-3 rounded-xl bg-blue-500 text-white font-bold hover:bg-blue-600 disabled:opacity-50"
                            >
                                {savingNewTruck ? 'กำลังบันทึก...' : '✓ เพิ่มทะเบียน'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

