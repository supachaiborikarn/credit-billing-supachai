'use client';

import { useState, useEffect } from 'react';
import { Package, ArrowLeft, RefreshCw, Plus, Minus, Save, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

interface InventoryItem {
    productId: string;
    productName: string;
    unit: string;
    price: number;
    currentStock: number;
    alertLevel: number;
    isLowStock: boolean;
    totalValue: number;
}

export default function InventoryPage() {
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [adjustVal, setAdjustVal] = useState<number>(0);
    const [saving, setSaving] = useState(false);
    const [stationId] = useState('station-5'); // TODO: get from context

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/admin/inventory?stationId=${stationId}`);
            if (res.ok) {
                const data = await res.json();
                setItems(data.items || []);
            }
        } catch (error) {
            console.error('Fetch error:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleAdjust = async (productId: string, change: number) => {
        setSaving(true);
        try {
            const res = await fetch('/api/admin/inventory/adjust', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ stationId, productId, quantityChange: change })
            });

            if (res.ok) {
                const data = await res.json();
                setItems(prev => prev.map(item =>
                    item.productId === productId
                        ? { ...item, currentStock: data.newQuantity }
                        : item
                ));
                setEditingId(null);
                setAdjustVal(0);
            } else {
                const err = await res.json();
                alert(err.error || 'บันทึกไม่สำเร็จ');
            }
        } catch (error) {
            console.error('Adjust error:', error);
        } finally {
            setSaving(false);
        }
    };

    const totalValue = items.reduce((sum, i) => sum + i.totalValue, 0);
    const lowStockCount = items.filter(i => i.isLowStock).length;

    const formatCurrency = (num: number) =>
        new Intl.NumberFormat('th-TH').format(num);

    return (
        <div className="min-h-screen bg-gray-100">
            {/* Header */}
            <header className="bg-white shadow-sm sticky top-0 z-40">
                <div className="px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link href="/admin" className="p-1">
                            <ArrowLeft size={24} className="text-gray-700" />
                        </Link>
                        <h1 className="font-bold text-gray-800 text-lg">📦 จัดการสินค้าคงคลัง</h1>
                    </div>
                    <button
                        onClick={fetchData}
                        className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200"
                    >
                        <RefreshCw size={20} className={`text-gray-600 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </header>

            <div className="p-4">
                {/* Summary */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-2xl p-4 text-white">
                        <p className="text-blue-100 text-sm">มูลค่ารวม</p>
                        <p className="text-2xl font-bold">฿{formatCurrency(totalValue)}</p>
                    </div>
                    <div className={`rounded-2xl p-4 text-white ${lowStockCount > 0
                        ? 'bg-gradient-to-r from-red-500 to-orange-500'
                        : 'bg-gradient-to-r from-green-500 to-green-600'
                        }`}>
                        <p className="text-white/80 text-sm">สต็อกต่ำ</p>
                        <p className="text-2xl font-bold">
                            {lowStockCount > 0 ? `${lowStockCount} รายการ` : '✓ ปกติ'}
                        </p>
                    </div>
                </div>

                {/* List */}
                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                    </div>
                ) : items.length === 0 ? (
                    <div className="bg-gray-50 border border-gray-200 rounded-2xl p-8 text-center">
                        <Package className="mx-auto text-gray-400 mb-4" size={48} />
                        <p className="font-semibold text-gray-600">ไม่มีสินค้าในระบบ</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {items.map((item) => {
                            const isEditing = editingId === item.productId;

                            return (
                                <div key={item.productId}
                                    className={`bg-white border rounded-2xl p-4 ${item.isLowStock ? 'border-red-200 bg-red-50' : 'border-gray-200'
                                        }`}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <p className="font-semibold text-gray-800">{item.productName}</p>
                                            <p className="text-sm text-gray-500">฿{formatCurrency(item.price)} / {item.unit}</p>
                                        </div>
                                        {item.isLowStock && (
                                            <span className="flex items-center gap-1 px-2 py-1 bg-red-100 text-red-600 rounded-full text-xs font-semibold">
                                                <AlertTriangle size={12} />
                                                สต็อกต่ำ
                                            </span>
                                        )}
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-3xl font-bold text-gray-800">{item.currentStock}</p>
                                            <p className="text-xs text-gray-400">เตือนที่ {item.alertLevel}</p>
                                        </div>

                                        {isEditing ? (
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => setAdjustVal(adjustVal - 1)}
                                                    className="w-10 h-10 bg-red-100 text-red-600 rounded-xl flex items-center justify-center"
                                                >
                                                    <Minus size={20} />
                                                </button>
                                                <input
                                                    type="number"
                                                    value={adjustVal}
                                                    onChange={(e) => setAdjustVal(Number(e.target.value))}
                                                    className="w-16 px-2 py-2 border border-gray-200 rounded-xl text-center text-lg font-bold"
                                                />
                                                <button
                                                    onClick={() => setAdjustVal(adjustVal + 1)}
                                                    className="w-10 h-10 bg-green-100 text-green-600 rounded-xl flex items-center justify-center"
                                                >
                                                    <Plus size={20} />
                                                </button>
                                                <button
                                                    onClick={() => handleAdjust(item.productId, adjustVal)}
                                                    disabled={saving || adjustVal === 0}
                                                    className="px-3 py-2 bg-blue-500 text-white rounded-xl flex items-center gap-1 disabled:opacity-50"
                                                >
                                                    {saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                                                </button>
                                                <button
                                                    onClick={() => { setEditingId(null); setAdjustVal(0); }}
                                                    className="px-3 py-2 bg-gray-200 text-gray-600 rounded-xl"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => { setEditingId(item.productId); setAdjustVal(0); }}
                                                className="px-4 py-2 border border-blue-300 text-blue-600 rounded-xl hover:bg-blue-50"
                                            >
                                                ปรับสต็อก
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
