'use client';

import { useState, useEffect, use } from 'react';
import { RefreshCw, Package, Check, User } from 'lucide-react';
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
    const [saving, setSaving] = useState<string | null>(null);
    const [products, setProducts] = useState<Product[]>([]);
    const [paymentType, setPaymentType] = useState('CASH');
    const [recentSales, setRecentSales] = useState<{ productId: string; time: string }[]>([]);

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

    // Quick sell - tap to sell immediately
    const quickSell = async (product: Product) => {
        if (paymentType === 'CREDIT' && !selectedOwner) {
            alert('กรุณาเลือกเจ้าของก่อน');
            return;
        }

        if (product.quantity <= 0) {
            alert('สินค้าหมด!');
            return;
        }

        setSaving(product.id);
        try {
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
                    amount: product.salePrice,
                    products: [{
                        productId: product.id,
                        name: product.name,
                        unit: product.unit,
                        price: product.salePrice,
                        qty: 1
                    }],
                }),
            });

            if (res.ok) {
                // Update local stock
                setProducts(prev => prev.map(p =>
                    p.id === product.id ? { ...p, quantity: p.quantity - 1 } : p
                ));

                // Add to recent sales (for visual feedback)
                setRecentSales(prev => [...prev.slice(-4), {
                    productId: product.id,
                    time: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
                }]);

                // Show success briefly
                setTimeout(() => {
                    setSaving(null);
                }, 500);
            } else {
                const err = await res.json();
                alert(err.error || 'บันทึกไม่สำเร็จ');
                setSaving(null);
            }
        } catch (error) {
            console.error('Error saving:', error);
            alert('เกิดข้อผิดพลาด');
            setSaving(null);
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
                            const isSaving = saving === product.id;
                            const justSold = recentSales.some(s => s.productId === product.id);
                            const isOutOfStock = product.quantity <= 0;

                            return (
                                <button
                                    key={product.id}
                                    onClick={() => quickSell(product)}
                                    disabled={isSaving || isOutOfStock}
                                    className={`relative p-4 rounded-2xl text-left transition-all transform active:scale-95 ${isOutOfStock
                                            ? 'bg-gray-800 opacity-50 cursor-not-allowed'
                                            : isSaving
                                                ? 'bg-green-600 scale-95'
                                                : justSold
                                                    ? 'bg-gradient-to-br from-orange-500 to-amber-500 ring-2 ring-orange-300'
                                                    : 'bg-gray-800 hover:bg-gray-700 active:bg-orange-600'
                                        }`}
                                >
                                    {/* Success Checkmark */}
                                    {isSaving && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-green-600 rounded-2xl">
                                            <Check size={48} className="text-white" />
                                        </div>
                                    )}

                                    {/* Product Info */}
                                    <div className={isSaving ? 'opacity-0' : ''}>
                                        <h3 className="text-white font-bold text-lg mb-1">{product.name}</h3>

                                        {/* Price */}
                                        <p className="text-2xl font-extrabold text-orange-400">
                                            ฿{formatCurrency(product.salePrice)}
                                        </p>

                                        {/* Stock Display */}
                                        <div className={`mt-3 py-2 px-3 rounded-lg ${isOutOfStock
                                                ? 'bg-red-900/50 text-red-400'
                                                : product.quantity <= 5
                                                    ? 'bg-yellow-900/50 text-yellow-400'
                                                    : 'bg-green-900/50 text-green-400'
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
                                    </div>
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
                        {recentSales.slice(-3).map((sale, i) => {
                            const product = products.find(p => p.id === sale.productId);
                            return (
                                <span key={i} className="bg-gray-700 px-2 py-1 rounded text-xs whitespace-nowrap">
                                    {product?.name} ({sale.time})
                                </span>
                            );
                        })}
                    </div>
                </div>
            )}

            <SimpleBottomNav stationId={id} />
        </div>
    );
}
