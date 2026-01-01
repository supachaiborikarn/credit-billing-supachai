'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, Package, RefreshCw, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface LowStockItem {
    productId: string;
    productName: string;
    currentStock: number;
    alertLevel: number;
    percentRemaining: number;
}

export default function LowStockPage() {
    const [items, setItems] = useState<LowStockItem[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/inventory/low-stock');
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

    const getSeverityColor = (percent: number) => {
        if (percent <= 25) return 'bg-red-500';
        if (percent <= 50) return 'bg-orange-500';
        return 'bg-yellow-500';
    };

    const getSeverityBg = (percent: number) => {
        if (percent <= 25) return 'bg-red-50 border-red-200';
        if (percent <= 50) return 'bg-orange-50 border-orange-200';
        return 'bg-yellow-50 border-yellow-200';
    };

    return (
        <div className="min-h-screen bg-gray-100">
            {/* Header */}
            <header className="bg-white shadow-sm sticky top-0 z-40">
                <div className="px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link href="/admin" className="p-1">
                            <ArrowLeft size={24} className="text-gray-700" />
                        </Link>
                        <h1 className="font-bold text-gray-800 text-lg">🚨 สินค้าสต็อกต่ำ</h1>
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
                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
                    </div>
                ) : items.length === 0 ? (
                    <div className="bg-green-50 border border-green-200 rounded-2xl p-8 text-center">
                        <Package className="mx-auto text-green-500 mb-4" size={48} />
                        <p className="font-semibold text-green-700 text-lg">✅ สต็อกปกติ</p>
                        <p className="text-green-600 text-sm">ไม่มีสินค้าที่ต่ำกว่าระดับเตือน</p>
                    </div>
                ) : (
                    <>
                        {/* Summary */}
                        <div className="bg-gradient-to-r from-red-500 to-orange-500 rounded-2xl p-4 mb-4 text-white">
                            <div className="flex items-center gap-3">
                                <AlertTriangle size={32} />
                                <div>
                                    <p className="text-2xl font-bold">{items.length} รายการ</p>
                                    <p className="text-red-100">ต้องสั่งซื้อเพิ่ม</p>
                                </div>
                            </div>
                        </div>

                        {/* Items List */}
                        <div className="space-y-3">
                            {items.map((item) => (
                                <div
                                    key={item.productId}
                                    className={`border rounded-2xl p-4 ${getSeverityBg(item.percentRemaining)}`}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <p className="font-semibold text-gray-800">{item.productName}</p>
                                            <p className="text-sm text-gray-500">
                                                เหลือ {item.currentStock} / เตือนที่ {item.alertLevel}
                                            </p>
                                        </div>
                                        <span className={`px-3 py-1 rounded-full text-white text-sm font-bold ${getSeverityColor(item.percentRemaining)
                                            }`}>
                                            {item.percentRemaining <= 25 ? '🔴 วิกฤต' :
                                                item.percentRemaining <= 50 ? '🟠 ต่ำ' : '🟡 ใกล้หมด'}
                                        </span>
                                    </div>

                                    {/* Progress Bar */}
                                    <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full ${getSeverityColor(item.percentRemaining)} transition-all`}
                                            style={{ width: `${Math.min(100, item.percentRemaining)}%` }}
                                        ></div>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1 text-right">
                                        {item.percentRemaining.toFixed(0)}% ของระดับเตือน
                                    </p>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
