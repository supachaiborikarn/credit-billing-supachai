'use client';

import { useState, useEffect, use } from 'react';
import { RefreshCw, Package, Check, User, X, Plus, Minus, ShoppingCart } from 'lucide-react';
import { STATIONS, PAYMENT_TYPES } from '@/constants';
import SimpleBottomNav from '../../components/SimpleBottomNav';

interface Product {
    id: string;
    name: string;
    unit: string;
    salePrice: number;
    quantity: number;
}

interface Owner {
    id: string;
    name: string;
    code: string;
}

export default function OilSellPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const stationIndex = parseInt(id) - 1;
    const station = STATIONS[stationIndex];

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [products, setProducts] = useState<Product[]>([]);
    const [paymentType, setPaymentType] = useState('CASH');
    const [recentSales, setRecentSales] = useState<{ name: string; qty: number; time: string }[]>([]);

    // Confirm Modal
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [sellQty, setSellQty] = useState(1);

    // Owner selection for credit
    const [ownersList, setOwnersList] = useState<Owner[]>([]);
    const [selectedOwner, setSelectedOwner] = useState<Owner | null>(null);
    const [ownerSearch, setOwnerSearch] = useState('');
    const [showOwnerDropdown, setShowOwnerDropdown] = useState(false);

    // Fetch products
    const fetchProducts = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/simple-station/${id}/products`);
            if (res.ok) {
                const data = await res.json();
                setProducts(data.products || []);
            }
        } catch (error) {
            console.error('Error fetching products:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProducts();
    }, [id]);

    // Fetch owners for credit
    useEffect(() => {
        if (paymentType === 'CREDIT' && ownersList.length === 0) {
            fetch('/api/owners')
                .then(res => res.json())
                .then(data => setOwnersList(data || []))
                .catch(err => console.error('Error loading owners:', err));
        }
    }, [paymentType, ownersList.length]);

    // Filter owners
    const filteredOwners = ownersList.filter(o =>
        (o.name || '').toLowerCase().includes(ownerSearch.toLowerCase()) ||
        (o.code || '').toLowerCase().includes(ownerSearch.toLowerCase())
    ).slice(0, 15);

    // Open confirm modal
    const openSellModal = (product: Product) => {
        if (product.quantity <= 0) {
            alert('สินค้าหมด!');
            return;
        }
        setSelectedProduct(product);
        setSellQty(1);
        setShowConfirmModal(true);
    };

    // Confirm sell
    const confirmSell = async () => {
        if (!selectedProduct) return;

        if (paymentType === 'CREDIT' && !selectedOwner) {
            alert('กรุณาเลือกเจ้าของก่อน (เงินเชื่อ)');
            return;
        }

        if (sellQty > selectedProduct.quantity) {
            alert(`สต็อกไม่พอ! มีแค่ ${selectedProduct.quantity} ${selectedProduct.unit}`);
            return;
        }

        setSaving(true);
        try {
            const totalAmount = selectedProduct.salePrice * sellQty;
            const res = await fetch(`/api/station/${id}/transactions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date: new Date().toISOString().split('T')[0],
                    licensePlate: null,
                    ownerName: selectedOwner?.name || null,
                    ownerId: selectedOwner?.id || null,
                    paymentType,
                    fuelType: 'ENGINE_OIL',
                    liters: 0,
                    pricePerLiter: 0,
                    amount: totalAmount,
                    products: [{
                        productId: selectedProduct.id,
                        name: selectedProduct.name,
                        unit: selectedProduct.unit,
                        price: selectedProduct.salePrice,
                        qty: sellQty
                    }],
                }),
            });

            if (res.ok) {
                // Update local stock
                setProducts(prev => prev.map(p =>
                    p.id === selectedProduct.id ? { ...p, quantity: p.quantity - sellQty } : p
                ));

                // Add to recent sales
                setRecentSales(prev => [...prev.slice(-4), {
                    name: selectedProduct.name,
                    qty: sellQty,
                    time: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
                }]);

                setShowConfirmModal(false);
                setSelectedProduct(null);
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

    const formatCurrency = (num: number) =>
        new Intl.NumberFormat('th-TH', { minimumFractionDigits: 0 }).format(num);

    if (!station) {
        return <div className="p-4 text-gray-500">ไม่พบสถานี</div>;
    }

    return (
        <div className="min-h-screen bg-gray-900 pb-20">
            {/* Header */}
            <header className="bg-gradient-to-r from-orange-600 to-amber-600 text-white sticky top-0 z-40">
                <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                        <Package size={28} />
                        <div>
                            <h1 className="font-bold text-lg">🛢️ ขายน้ำมันเครื่อง POS</h1>
                            <p className="text-xs text-orange-100">{station.name}</p>
                        </div>
                    </div>
                    <button
                        onClick={fetchProducts}
                        disabled={loading}
                        className="p-2 rounded-lg bg-white/20 hover:bg-white/30"
                    >
                        <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>

                {/* Payment Type Selector */}
                <div className="px-4 pb-3">
                    <div className="flex gap-2">
                        {PAYMENT_TYPES.filter(t => ['CASH', 'CREDIT', 'TRANSFER'].includes(t.value)).map(type => (
                            <button
                                key={type.value}
                                onClick={() => {
                                    setPaymentType(type.value);
                                    if (type.value !== 'CREDIT') {
                                        setSelectedOwner(null);
                                        setOwnerSearch('');
                                    }
                                }}
                                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${paymentType === type.value
                                        ? 'bg-white text-orange-600'
                                        : 'bg-white/20 text-white hover:bg-white/30'
                                    }`}
                            >
                                {type.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Owner Selection for Credit */}
                {paymentType === 'CREDIT' && (
                    <div className="px-4 pb-3">
                        <div className="relative">
                            <input
                                type="text"
                                value={ownerSearch}
                                onChange={(e) => {
                                    setOwnerSearch(e.target.value);
                                    setSelectedOwner(null);
                                    setShowOwnerDropdown(true);
                                }}
                                onFocus={() => setShowOwnerDropdown(true)}
                                placeholder="👤 พิมพ์ค้นหาเจ้าของ..."
                                className="w-full px-4 py-2 rounded-lg bg-white/20 text-white placeholder-white/60 focus:bg-white focus:text-gray-800 focus:outline-none"
                            />
                            {selectedOwner && (
                                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                    <Check size={20} className="text-green-400" />
                                </div>
                            )}
                            {showOwnerDropdown && ownerSearch.length > 0 && (
                                <div className="absolute z-20 w-full mt-1 bg-white rounded-lg shadow-xl max-h-48 overflow-auto">
                                    {filteredOwners.length === 0 ? (
                                        <div className="px-4 py-3 text-gray-500 text-center">ไม่พบ</div>
                                    ) : (
                                        filteredOwners.map(owner => (
                                            <button
                                                key={owner.id}
                                                onClick={() => {
                                                    setSelectedOwner(owner);
                                                    setOwnerSearch(owner.code ? `${owner.code} - ${owner.name}` : owner.name);
                                                    setShowOwnerDropdown(false);
                                                }}
                                                className="w-full px-4 py-2 text-left hover:bg-orange-50 border-b border-gray-100 last:border-b-0 text-gray-800"
                                            >
                                                {owner.code && <span className="font-medium text-orange-600">{owner.code}</span>}
                                                {owner.code && ' - '}
                                                <span>{owner.name}</span>
                                            </button>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </header>

            {/* Products Grid - POS Style */}
            <div className="p-4">
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <RefreshCw size={32} className="animate-spin text-orange-500" />
                    </div>
                ) : products.length === 0 ? (
                    <div className="text-center py-12 text-gray-400">
                        <Package size={48} className="mx-auto mb-3 opacity-50" />
                        <p>ไม่มีสินค้าในระบบ</p>
                        <p className="text-sm">กรุณาเพิ่มสินค้าที่หน้าจัดการสินค้า</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-3">
                        {products.map(product => {
                            const isOutOfStock = product.quantity <= 0;
                            const isLowStock = product.quantity <= 5 && product.quantity > 0;

                            return (
                                <button
                                    key={product.id}
                                    onClick={() => openSellModal(product)}
                                    disabled={isOutOfStock}
                                    className={`relative p-4 rounded-2xl text-left transition-all transform active:scale-95 ${isOutOfStock
                                            ? 'bg-gray-800 opacity-50 cursor-not-allowed'
                                            : isLowStock
                                                ? 'bg-gradient-to-br from-yellow-700 to-orange-800 hover:from-yellow-600 hover:to-orange-700'
                                                : 'bg-gradient-to-br from-green-700 to-emerald-800 hover:from-green-600 hover:to-emerald-700'
                                        }`}
                                >
                                    <h3 className="text-white font-bold text-lg mb-1">{product.name}</h3>

                                    {/* Price */}
                                    <p className="text-2xl font-extrabold text-white">
                                        ฿{formatCurrency(product.salePrice)}
                                    </p>

                                    {/* Stock Display */}
                                    <div className={`mt-3 py-2 px-3 rounded-lg ${isOutOfStock
                                            ? 'bg-red-900/50 text-red-300'
                                            : isLowStock
                                                ? 'bg-yellow-900/50 text-yellow-300'
                                                : 'bg-green-900/50 text-green-300'
                                        }`}>
                                        <div className="flex items-center justify-between text-sm">
                                            <span>📦 สต็อก</span>
                                            <span className="font-bold text-lg">{product.quantity}</span>
                                        </div>
                                        <span className="text-xs opacity-75">{product.unit}</span>
                                    </div>

                                    {/* Out of Stock Badge */}
                                    {isOutOfStock && (
                                        <div className="absolute top-2 right-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                                            หมด
                                        </div>
                                    )}

                                    {/* Tap to sell hint */}
                                    {!isOutOfStock && (
                                        <div className="mt-2 text-center text-white/70 text-xs">
                                            👆 กดเพื่อขาย
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Recent Sales Footer */}
            {recentSales.length > 0 && (
                <div className="fixed bottom-16 left-0 right-0 bg-gray-800/90 backdrop-blur-sm py-2 px-4 border-t border-gray-700">
                    <div className="flex items-center gap-2 text-sm text-gray-300 overflow-x-auto">
                        <span className="text-green-400">✓</span>
                        <span className="whitespace-nowrap">ขายล่าสุด:</span>
                        {recentSales.slice(-3).map((sale, i) => (
                            <span key={i} className="bg-gray-700 px-2 py-1 rounded text-xs whitespace-nowrap">
                                {sale.name} x{sale.qty} ({sale.time})
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Confirm Sell Modal */}
            {showConfirmModal && selectedProduct && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden">
                        {/* Modal Header */}
                        <div className="bg-gradient-to-r from-orange-500 to-amber-500 p-4 flex items-center justify-between">
                            <div className="flex items-center gap-2 text-white">
                                <ShoppingCart size={24} />
                                <h3 className="font-bold text-lg">ยืนยันขาย</h3>
                            </div>
                            <button
                                onClick={() => setShowConfirmModal(false)}
                                className="p-1 hover:bg-white/20 rounded-lg"
                            >
                                <X size={24} className="text-white" />
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="p-5 space-y-4">
                            {/* Product Info */}
                            <div className="text-center">
                                <h4 className="text-xl font-bold text-gray-800">{selectedProduct.name}</h4>
                                <p className="text-2xl font-extrabold text-orange-500 mt-1">
                                    ฿{formatCurrency(selectedProduct.salePrice)} / {selectedProduct.unit}
                                </p>
                                <p className="text-sm text-gray-500">
                                    สต็อกคงเหลือ: <span className="font-bold text-gray-700">{selectedProduct.quantity}</span> {selectedProduct.unit}
                                </p>
                            </div>

                            {/* Quantity Selector */}
                            <div className="bg-gray-100 rounded-xl p-4">
                                <label className="block text-sm font-medium text-gray-600 text-center mb-3">
                                    จำนวนที่ต้องการขาย
                                </label>
                                <div className="flex items-center justify-center gap-4">
                                    <button
                                        onClick={() => setSellQty(Math.max(1, sellQty - 1))}
                                        className="w-12 h-12 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center"
                                    >
                                        <Minus size={24} className="text-gray-600" />
                                    </button>
                                    <input
                                        type="number"
                                        value={sellQty}
                                        onChange={(e) => setSellQty(Math.max(1, Math.min(selectedProduct.quantity, parseInt(e.target.value) || 1)))}
                                        className="w-20 text-center text-3xl font-bold border-2 border-gray-200 rounded-xl py-2"
                                        min="1"
                                        max={selectedProduct.quantity}
                                    />
                                    <button
                                        onClick={() => setSellQty(Math.min(selectedProduct.quantity, sellQty + 1))}
                                        className="w-12 h-12 rounded-full bg-orange-100 hover:bg-orange-200 flex items-center justify-center"
                                    >
                                        <Plus size={24} className="text-orange-600" />
                                    </button>
                                </div>
                            </div>

                            {/* Total */}
                            <div className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-xl p-4 text-center">
                                <p className="text-orange-100 text-sm">ยอดรวม</p>
                                <p className="text-white text-3xl font-extrabold">
                                    ฿{formatCurrency(selectedProduct.salePrice * sellQty)}
                                </p>
                            </div>

                            {/* Payment Info */}
                            <div className="text-center text-sm">
                                <span className="text-gray-500">ประเภท: </span>
                                <span className="font-bold text-gray-700">
                                    {paymentType === 'CASH' ? '💵 เงินสด' : paymentType === 'CREDIT' ? '📝 เงินเชื่อ' : '💸 โอนเงิน'}
                                </span>
                                {selectedOwner && (
                                    <span className="block text-gray-600 mt-1">
                                        <User size={14} className="inline mr-1" />
                                        {selectedOwner.name}
                                    </span>
                                )}
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowConfirmModal(false)}
                                    className="flex-1 py-3 border-2 border-gray-200 rounded-xl font-medium text-gray-600 hover:bg-gray-50"
                                >
                                    ยกเลิก
                                </button>
                                <button
                                    onClick={confirmSell}
                                    disabled={saving}
                                    className="flex-1 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl font-bold hover:from-green-600 hover:to-emerald-600 disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {saving ? (
                                        <>
                                            <RefreshCw size={18} className="animate-spin" />
                                            กำลังบันทึก...
                                        </>
                                    ) : (
                                        <>
                                            <Check size={18} />
                                            ยืนยันขาย
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <SimpleBottomNav stationId={id} />
        </div>
    );
}
