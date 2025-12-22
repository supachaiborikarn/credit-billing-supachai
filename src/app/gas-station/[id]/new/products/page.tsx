'use client';

import { useState, useEffect, use } from 'react';
import { ArrowLeft, Plus, Minus, Package, History, Search, ShoppingCart, TrendingUp, TrendingDown } from 'lucide-react';
import { STATIONS } from '@/constants';
import Link from 'next/link';

interface Product {
    id: string;
    name: string;
    unit: string;
    salePrice: number;
}

interface InventoryItem {
    id: string;
    productId: string;
    product: Product;
    quantity: number;
    alertLevel: number | null;
}

interface ProductHistory {
    id: string;
    type: 'IN' | 'OUT';
    quantity: number;
    note?: string;
    createdAt: string;
    product: {
        name: string;
    };
}

export default function GasStationProductsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const stationIndex = parseInt(id) - 1;
    const station = STATIONS[stationIndex];

    const [loading, setLoading] = useState(true);
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [searchQuery, setSearchQuery] = useState('');

    // Modals
    const [showSellModal, setShowSellModal] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
    const [quantity, setQuantity] = useState(1);
    const [note, setNote] = useState('');
    const [actionLoading, setActionLoading] = useState(false);
    const [history, setHistory] = useState<ProductHistory[]>([]);

    useEffect(() => {
        fetchInventory();
    }, [id]);

    const fetchInventory = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/gas-station/${id}/products`);
            if (res.ok) {
                const data = await res.json();
                setInventory(data.inventory || []);
            }
        } catch (error) {
            console.error('Error fetching inventory:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchHistory = async () => {
        try {
            const res = await fetch(`/api/gas-station/${id}/products/history`);
            if (res.ok) {
                const data = await res.json();
                setHistory(data.slice(0, 20));
            }
        } catch (error) {
            console.error('Error fetching history:', error);
        }
    };

    const openSellModal = (item: InventoryItem) => {
        setSelectedItem(item);
        setQuantity(1);
        setNote('');
        setShowSellModal(true);
    };

    const openAddModal = (item: InventoryItem) => {
        setSelectedItem(item);
        setQuantity(1);
        setNote('');
        setShowAddModal(true);
    };

    const openHistoryModal = async () => {
        setShowHistoryModal(true);
        await fetchHistory();
    };

    const handleSell = async () => {
        if (!selectedItem || quantity <= 0) return;

        setActionLoading(true);
        try {
            const res = await fetch(`/api/gas-station/${id}/products/sell`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    inventoryId: selectedItem.id,
                    quantity,
                    note,
                }),
            });

            if (res.ok) {
                setShowSellModal(false);
                fetchInventory();
                alert('✅ บันทึกขายเรียบร้อย!');
            } else {
                const err = await res.json();
                alert(err.error || 'บันทึกไม่สำเร็จ');
            }
        } catch (error) {
            console.error('Error selling:', error);
            alert('เกิดข้อผิดพลาด');
        } finally {
            setActionLoading(false);
        }
    };

    const handleAddStock = async () => {
        if (!selectedItem || quantity <= 0) return;

        setActionLoading(true);
        try {
            const res = await fetch(`/api/gas-station/${id}/products/add`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    inventoryId: selectedItem.id,
                    quantity,
                    note,
                }),
            });

            if (res.ok) {
                setShowAddModal(false);
                fetchInventory();
                alert('✅ รับสินค้าเรียบร้อย!');
            } else {
                const err = await res.json();
                alert(err.error || 'บันทึกไม่สำเร็จ');
            }
        } catch (error) {
            console.error('Error adding stock:', error);
            alert('เกิดข้อผิดพลาด');
        } finally {
            setActionLoading(false);
        }
    };

    const filteredInventory = inventory.filter((item) =>
        item.product.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const formatCurrency = (num: number) =>
        new Intl.NumberFormat('th-TH', { minimumFractionDigits: 0 }).format(num);

    const formatDate = (dateStr: string) =>
        new Date(dateStr).toLocaleString('th-TH', {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
        });

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
                        <h1 className="font-bold text-gray-800 text-lg">สินค้า/สต็อก</h1>
                    </div>
                    <button
                        onClick={openHistoryModal}
                        className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200"
                    >
                        <History size={20} className="text-gray-600" />
                    </button>
                </div>
            </header>

            <div className="p-4 space-y-4">
                {/* Search */}
                <div className="relative">
                    <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="ค้นหาสินค้า..."
                        className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                </div>

                {/* Inventory List */}
                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
                    </div>
                ) : filteredInventory.length > 0 ? (
                    <div className="space-y-3">
                        {filteredInventory.map((item) => (
                            <div key={item.id} className="bg-white rounded-2xl shadow-sm p-4">
                                <div className="flex items-start justify-between mb-3">
                                    <div>
                                        <h3 className="font-semibold text-gray-800">{item.product.name}</h3>
                                        <p className="text-sm text-gray-500">
                                            ราคา: ฿{formatCurrency(item.product.salePrice)} / {item.product.unit}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className={`text-2xl font-bold ${item.alertLevel && item.quantity <= item.alertLevel
                                                ? 'text-red-500'
                                                : 'text-gray-800'
                                            }`}>
                                            {item.quantity}
                                        </p>
                                        <p className="text-xs text-gray-500">{item.product.unit}</p>
                                    </div>
                                </div>

                                {/* Low stock warning */}
                                {item.alertLevel && item.quantity <= item.alertLevel && (
                                    <div className="bg-red-50 text-red-600 text-xs px-2 py-1 rounded-lg mb-3 inline-block">
                                        ⚠️ สต็อกต่ำ
                                    </div>
                                )}

                                {/* Action Buttons */}
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => openAddModal(item)}
                                        className="flex-1 py-2.5 bg-green-100 text-green-700 font-medium rounded-xl flex items-center justify-center gap-1 hover:bg-green-200"
                                    >
                                        <Plus size={18} /> รับเข้า
                                    </button>
                                    <button
                                        onClick={() => openSellModal(item)}
                                        disabled={item.quantity <= 0}
                                        className="flex-1 py-2.5 bg-orange-500 text-white font-medium rounded-xl flex items-center justify-center gap-1 hover:bg-orange-600 disabled:opacity-50"
                                    >
                                        <ShoppingCart size={18} /> ขาย
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="bg-white rounded-2xl p-8 text-center">
                        <Package size={48} className="mx-auto text-gray-300 mb-3" />
                        <p className="text-gray-500">ยังไม่มีสินค้าในสต็อก</p>
                        <p className="text-gray-400 text-sm mt-1">ติดต่อ Admin เพื่อเพิ่มสินค้า</p>
                    </div>
                )}
            </div>

            {/* Sell Modal */}
            {showSellModal && selectedItem && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
                    <div className="bg-white w-full max-w-lg rounded-t-3xl p-6">
                        <h2 className="text-lg font-bold text-gray-800 mb-4">
                            🛒 ขาย: {selectedItem.product.name}
                        </h2>

                        <div className="mb-4">
                            <label className="block text-sm text-gray-600 mb-2">จำนวน</label>
                            <div className="flex items-center justify-center gap-4">
                                <button
                                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                    className="w-12 h-12 bg-gray-100 rounded-xl text-2xl font-bold text-gray-600 hover:bg-gray-200"
                                >
                                    -
                                </button>
                                <input
                                    type="number"
                                    value={quantity}
                                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                                    className="w-20 h-12 text-center text-2xl font-bold border border-gray-200 rounded-xl"
                                />
                                <button
                                    onClick={() => setQuantity(Math.min(selectedItem.quantity, quantity + 1))}
                                    className="w-12 h-12 bg-gray-100 rounded-xl text-2xl font-bold text-gray-600 hover:bg-gray-200"
                                >
                                    +
                                </button>
                            </div>
                            <p className="text-center text-sm text-gray-500 mt-2">
                                คงเหลือ: {selectedItem.quantity} {selectedItem.product.unit}
                            </p>
                        </div>

                        <div className="bg-orange-50 rounded-xl p-4 mb-4 text-center">
                            <p className="text-sm text-orange-600">รวม</p>
                            <p className="text-2xl font-bold text-orange-700">
                                ฿{formatCurrency(quantity * selectedItem.product.salePrice)}
                            </p>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowSellModal(false)}
                                className="flex-1 py-3 bg-gray-100 text-gray-700 font-semibold rounded-xl"
                            >
                                ยกเลิก
                            </button>
                            <button
                                onClick={handleSell}
                                disabled={actionLoading}
                                className="flex-1 py-3 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl disabled:opacity-50"
                            >
                                {actionLoading ? 'กำลังบันทึก...' : '✅ บันทึกขาย'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Stock Modal */}
            {showAddModal && selectedItem && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
                    <div className="bg-white w-full max-w-lg rounded-t-3xl p-6">
                        <h2 className="text-lg font-bold text-gray-800 mb-4">
                            ➕ รับเข้า: {selectedItem.product.name}
                        </h2>

                        <div className="mb-4">
                            <label className="block text-sm text-gray-600 mb-2">จำนวน</label>
                            <div className="flex items-center justify-center gap-4">
                                <button
                                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                    className="w-12 h-12 bg-gray-100 rounded-xl text-2xl font-bold text-gray-600 hover:bg-gray-200"
                                >
                                    -
                                </button>
                                <input
                                    type="number"
                                    value={quantity}
                                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                                    className="w-20 h-12 text-center text-2xl font-bold border border-gray-200 rounded-xl"
                                />
                                <button
                                    onClick={() => setQuantity(quantity + 1)}
                                    className="w-12 h-12 bg-gray-100 rounded-xl text-2xl font-bold text-gray-600 hover:bg-gray-200"
                                >
                                    +
                                </button>
                            </div>
                        </div>

                        <div className="mb-4">
                            <label className="block text-sm text-gray-600 mb-2">หมายเหตุ (optional)</label>
                            <input
                                type="text"
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                placeholder="เช่น เลข Invoice"
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500"
                            />
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowAddModal(false)}
                                className="flex-1 py-3 bg-gray-100 text-gray-700 font-semibold rounded-xl"
                            >
                                ยกเลิก
                            </button>
                            <button
                                onClick={handleAddStock}
                                disabled={actionLoading}
                                className="flex-1 py-3 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-xl disabled:opacity-50"
                            >
                                {actionLoading ? 'กำลังบันทึก...' : '✅ รับเข้า'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* History Modal */}
            {showHistoryModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
                    <div className="bg-white w-full max-w-lg rounded-t-3xl p-6 max-h-[80vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold text-gray-800">📋 ประวัติรับ/ขาย</h2>
                            <button
                                onClick={() => setShowHistoryModal(false)}
                                className="text-gray-500"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="space-y-2">
                            {history.length > 0 ? (
                                history.map((h) => (
                                    <div
                                        key={h.id}
                                        className={`flex items-center justify-between p-3 rounded-xl ${h.type === 'IN' ? 'bg-green-50' : 'bg-orange-50'
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            {h.type === 'IN' ? (
                                                <TrendingUp className="text-green-500" size={20} />
                                            ) : (
                                                <TrendingDown className="text-orange-500" size={20} />
                                            )}
                                            <div>
                                                <p className="font-medium text-gray-800">{h.product.name}</p>
                                                <p className="text-xs text-gray-500">{formatDate(h.createdAt)}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className={`font-bold ${h.type === 'IN' ? 'text-green-600' : 'text-orange-600'
                                                }`}>
                                                {h.type === 'IN' ? '+' : '-'}{h.quantity}
                                            </p>
                                            {h.note && (
                                                <p className="text-xs text-gray-500">{h.note}</p>
                                            )}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p className="text-center text-gray-500 py-8">ยังไม่มีประวัติ</p>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
