'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import {
    ShoppingBag,
    Plus,
    Loader2,
    AlertTriangle,
    PackagePlus,
    Pencil,
    X,
    Check,
    History,
    ChevronDown,
    ChevronUp
} from 'lucide-react';
import { formatCurrency } from '@/lib/gas';

interface InventoryItem {
    id: string;
    productId: string;
    product: {
        id: string;
        name: string;
        unit: string;
        salePrice: number;
        costPrice: number | null;
    };
    quantity: number;
    alertLevel: number | null;
}

interface HistoryItem {
    id: string;
    type: 'IN' | 'OUT';
    product: { name: string };
    quantity: number;
    amount?: number;
    createdAt: string;
}

export default function GasProductsPage() {
    const params = useParams();
    const stationId = params.stationId as string;

    const [loading, setLoading] = useState(true);
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Add product form
    const [showAddForm, setShowAddForm] = useState(false);
    const [saving, setSaving] = useState(false);
    const [newName, setNewName] = useState('');
    const [newUnit, setNewUnit] = useState('ขวด');
    const [newPrice, setNewPrice] = useState('');
    const [newQty, setNewQty] = useState('');
    const [newAlertLevel, setNewAlertLevel] = useState('');

    // Receive stock
    const [receivingId, setReceivingId] = useState<string | null>(null);
    const [receiveQty, setReceiveQty] = useState('');

    // Edit product
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editPrice, setEditPrice] = useState('');
    const [editAlertLevel, setEditAlertLevel] = useState('');

    // History
    const [showHistory, setShowHistory] = useState(false);
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);

    const showMessage = (type: 'success' | 'error', text: string) => {
        setMessage({ type, text });
        setTimeout(() => setMessage(null), 4000);
    };

    const fetchInventory = useCallback(async () => {
        try {
            const res = await fetch(`/api/gas-station/${stationId}/products`);
            if (res.ok) {
                const data = await res.json();
                setInventory(Array.isArray(data) ? data : []);
            }
        } catch (error) {
            console.error('Error fetching inventory:', error);
        } finally {
            setLoading(false);
        }
    }, [stationId]);

    useEffect(() => {
        fetchInventory();
    }, [fetchInventory]);

    const fetchHistory = async () => {
        setHistoryLoading(true);
        try {
            const res = await fetch(`/api/gas-station/${stationId}/products/history`);
            if (res.ok) {
                const data = await res.json();
                setHistory(Array.isArray(data) ? data : data.history || []);
            }
        } catch (error) {
            console.error('Error fetching history:', error);
        } finally {
            setHistoryLoading(false);
        }
    };

    const toggleHistory = () => {
        const next = !showHistory;
        setShowHistory(next);
        if (next && history.length === 0) {
            fetchHistory();
        }
    };

    const handleAddProduct = async () => {
        if (!newName.trim() || !newUnit.trim() || !newPrice) {
            showMessage('error', 'กรุณากรอกชื่อสินค้า หน่วย และราคาขาย');
            return;
        }

        setSaving(true);
        try {
            const res = await fetch(`/api/gas-station/${stationId}/products`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'create',
                    name: newName.trim(),
                    unit: newUnit.trim(),
                    salePrice: Number(newPrice),
                    quantity: newQty ? Number(newQty) : 0,
                    alertLevel: newAlertLevel ? Number(newAlertLevel) : null,
                })
            });

            const data = await res.json();
            if (res.ok) {
                showMessage('success', `เพิ่ม "${newName.trim()}" แล้ว`);
                setNewName('');
                setNewPrice('');
                setNewQty('');
                setNewAlertLevel('');
                setShowAddForm(false);
                fetchInventory();
            } else {
                showMessage('error', data.error || 'เพิ่มสินค้าไม่สำเร็จ');
            }
        } catch {
            showMessage('error', 'เกิดข้อผิดพลาด กรุณาลองใหม่');
        } finally {
            setSaving(false);
        }
    };

    const handleReceive = async (item: InventoryItem) => {
        const qty = Number(receiveQty);
        if (!Number.isInteger(qty) || qty <= 0) {
            showMessage('error', 'จำนวนรับเข้าต้องเป็นจำนวนเต็มมากกว่า 0');
            return;
        }

        setSaving(true);
        try {
            const res = await fetch(`/api/gas-station/${stationId}/products`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'receive',
                    productId: item.productId,
                    quantity: qty,
                })
            });

            const data = await res.json();
            if (res.ok) {
                showMessage('success', `รับ "${item.product.name}" เข้า ${qty} ${item.product.unit}`);
                setReceivingId(null);
                setReceiveQty('');
                fetchInventory();
            } else {
                showMessage('error', data.error || 'รับของเข้าไม่สำเร็จ');
            }
        } catch {
            showMessage('error', 'เกิดข้อผิดพลาด กรุณาลองใหม่');
        } finally {
            setSaving(false);
        }
    };

    const handleUpdate = async (item: InventoryItem) => {
        const price = Number(editPrice);
        if (!Number.isFinite(price) || price <= 0) {
            showMessage('error', 'ราคาขายต้องมากกว่า 0');
            return;
        }

        setSaving(true);
        try {
            const res = await fetch(`/api/gas-station/${stationId}/products`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'update',
                    productId: item.productId,
                    salePrice: price,
                    alertLevel: editAlertLevel === '' ? null : Number(editAlertLevel),
                })
            });

            const data = await res.json();
            if (res.ok) {
                showMessage('success', `อัปเดต "${item.product.name}" แล้ว`);
                setEditingId(null);
                fetchInventory();
            } else {
                showMessage('error', data.error || 'อัปเดตไม่สำเร็จ');
            }
        } catch {
            showMessage('error', 'เกิดข้อผิดพลาด กรุณาลองใหม่');
        } finally {
            setSaving(false);
        }
    };

    const isLowStock = (item: InventoryItem) =>
        item.alertLevel !== null && item.quantity <= item.alertLevel;

    const lowStockCount = inventory.filter(isLowStock).length;

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="animate-spin text-orange-400" size={40} />
            </div>
        );
    }

    return (
        <div className="max-w-lg mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <ShoppingBag className="text-amber-400" size={28} />
                    สินค้า (เครื่องดื่ม/อื่นๆ)
                </h1>
                <button
                    onClick={() => setShowAddForm(!showAddForm)}
                    className="flex items-center gap-1 bg-orange-600 hover:bg-orange-500 text-white px-3 py-2 rounded-lg text-sm"
                >
                    {showAddForm ? <X size={16} /> : <Plus size={16} />}
                    {showAddForm ? 'ยกเลิก' : 'เพิ่มสินค้า'}
                </button>
            </div>

            {/* Message */}
            {message && (
                <div className={`rounded-xl p-3 mb-4 text-sm border ${message.type === 'success'
                    ? 'bg-green-900/30 border-green-500/30 text-green-300'
                    : 'bg-red-900/30 border-red-500/30 text-red-300'
                    }`}>
                    {message.text}
                </div>
            )}

            {/* Low stock alert */}
            {lowStockCount > 0 && (
                <div className="bg-yellow-900/30 border border-yellow-500/30 rounded-xl p-3 mb-4 flex items-center gap-2 text-yellow-300 text-sm">
                    <AlertTriangle size={18} />
                    มีสินค้าใกล้หมด {lowStockCount} รายการ
                </div>
            )}

            {/* Add product form */}
            {showAddForm && (
                <div className="bg-[#1a1a24] rounded-xl p-4 mb-4 border border-orange-500/30">
                    <h3 className="font-medium mb-3 text-orange-400">เพิ่มสินค้าใหม่</h3>
                    <div className="space-y-3">
                        <input
                            type="text"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            placeholder="ชื่อสินค้า เช่น น้ำดื่ม, กาแฟกระป๋อง"
                            className="w-full bg-gray-800 border border-white/10 rounded-lg px-4 py-2 focus:border-orange-500 focus:outline-none"
                        />
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs text-gray-500">หน่วย</label>
                                <input
                                    type="text"
                                    value={newUnit}
                                    onChange={(e) => setNewUnit(e.target.value)}
                                    placeholder="ขวด/กระป๋อง"
                                    className="w-full bg-gray-800 border border-white/10 rounded-lg px-4 py-2 focus:border-orange-500 focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-gray-500">ราคาขาย (บาท)</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.25"
                                    inputMode="decimal"
                                    value={newPrice}
                                    onChange={(e) => setNewPrice(e.target.value)}
                                    placeholder="0.00"
                                    className="w-full bg-gray-800 border border-white/10 rounded-lg px-4 py-2 text-right font-mono focus:border-orange-500 focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-gray-500">จำนวนเริ่มต้น</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="1"
                                    inputMode="numeric"
                                    value={newQty}
                                    onChange={(e) => setNewQty(e.target.value)}
                                    placeholder="0"
                                    className="w-full bg-gray-800 border border-white/10 rounded-lg px-4 py-2 text-right font-mono focus:border-orange-500 focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-gray-500">แจ้งเตือนเมื่อเหลือ ≤</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="1"
                                    inputMode="numeric"
                                    value={newAlertLevel}
                                    onChange={(e) => setNewAlertLevel(e.target.value)}
                                    placeholder="ไม่แจ้งเตือน"
                                    className="w-full bg-gray-800 border border-white/10 rounded-lg px-4 py-2 text-right font-mono focus:border-orange-500 focus:outline-none"
                                />
                            </div>
                        </div>
                        <button
                            onClick={handleAddProduct}
                            disabled={saving}
                            className="w-full bg-orange-600 hover:bg-orange-500 text-white py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {saving ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />}
                            บันทึกสินค้า
                        </button>
                    </div>
                </div>
            )}

            {/* Inventory list */}
            {inventory.length === 0 ? (
                <div className="bg-[#1a1a24] rounded-xl p-8 border border-white/10 text-center text-gray-400">
                    <ShoppingBag className="mx-auto mb-3 text-gray-600" size={40} />
                    ยังไม่มีสินค้า กด &quot;เพิ่มสินค้า&quot; เพื่อเริ่มต้น
                </div>
            ) : (
                <div className="space-y-3">
                    {inventory.map((item) => (
                        <div
                            key={item.id}
                            className={`bg-[#1a1a24] rounded-xl p-4 border ${isLowStock(item) ? 'border-yellow-500/50' : 'border-white/10'}`}
                        >
                            <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="font-medium flex items-center gap-2">
                                        <span className="truncate">{item.product.name}</span>
                                        {isLowStock(item) && (
                                            <span className="shrink-0 text-[11px] bg-yellow-500/20 text-yellow-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                                                <AlertTriangle size={11} /> ใกล้หมด
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-sm text-gray-400 mt-0.5">
                                        ฿{formatCurrency(item.product.salePrice)}/{item.product.unit}
                                        {item.alertLevel !== null && (
                                            <span className="text-gray-600"> • เตือนเมื่อ ≤ {item.alertLevel}</span>
                                        )}
                                    </div>
                                </div>
                                <div className="text-right shrink-0">
                                    <div className={`text-2xl font-bold font-mono ${isLowStock(item) ? 'text-yellow-300' : 'text-white'}`}>
                                        {item.quantity}
                                    </div>
                                    <div className="text-xs text-gray-500">{item.product.unit}คงเหลือ</div>
                                </div>
                            </div>

                            {/* Row actions */}
                            <div className="flex gap-2 mt-3">
                                {receivingId === item.id ? (
                                    <div className="flex gap-2 flex-1">
                                        <input
                                            type="number"
                                            min="1"
                                            step="1"
                                            inputMode="numeric"
                                            autoFocus
                                            value={receiveQty}
                                            onChange={(e) => setReceiveQty(e.target.value)}
                                            placeholder={`จำนวน (${item.product.unit})`}
                                            className="flex-1 bg-gray-800 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-right font-mono focus:border-orange-500 focus:outline-none"
                                        />
                                        <button
                                            onClick={() => handleReceive(item)}
                                            disabled={saving}
                                            className="bg-green-600 hover:bg-green-500 text-white px-3 py-1.5 rounded-lg text-sm flex items-center gap-1 disabled:opacity-50"
                                        >
                                            <Check size={14} /> รับเข้า
                                        </button>
                                        <button
                                            onClick={() => { setReceivingId(null); setReceiveQty(''); }}
                                            className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded-lg text-sm"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                ) : editingId === item.id ? (
                                    <div className="flex gap-2 flex-1 items-center">
                                        <div className="flex-1">
                                            <label className="text-[10px] text-gray-500">ราคาขาย</label>
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.25"
                                                inputMode="decimal"
                                                value={editPrice}
                                                onChange={(e) => setEditPrice(e.target.value)}
                                                className="w-full bg-gray-800 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-right font-mono focus:border-orange-500 focus:outline-none"
                                            />
                                        </div>
                                        <div className="flex-1">
                                            <label className="text-[10px] text-gray-500">เตือนเมื่อ ≤</label>
                                            <input
                                                type="number"
                                                min="0"
                                                step="1"
                                                inputMode="numeric"
                                                value={editAlertLevel}
                                                onChange={(e) => setEditAlertLevel(e.target.value)}
                                                placeholder="ไม่เตือน"
                                                className="w-full bg-gray-800 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-right font-mono focus:border-orange-500 focus:outline-none"
                                            />
                                        </div>
                                        <button
                                            onClick={() => handleUpdate(item)}
                                            disabled={saving}
                                            className="bg-green-600 hover:bg-green-500 text-white px-3 py-1.5 rounded-lg text-sm mt-4 disabled:opacity-50"
                                        >
                                            <Check size={14} />
                                        </button>
                                        <button
                                            onClick={() => setEditingId(null)}
                                            className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded-lg text-sm mt-4"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <button
                                            onClick={() => { setReceivingId(item.id); setEditingId(null); setReceiveQty(''); }}
                                            className="flex-1 bg-gray-800 hover:bg-gray-700 text-green-400 px-3 py-1.5 rounded-lg text-sm flex items-center justify-center gap-1"
                                        >
                                            <PackagePlus size={14} /> รับของเข้า
                                        </button>
                                        <button
                                            onClick={() => {
                                                setEditingId(item.id);
                                                setReceivingId(null);
                                                setEditPrice(String(item.product.salePrice));
                                                setEditAlertLevel(item.alertLevel !== null ? String(item.alertLevel) : '');
                                            }}
                                            className="flex-1 bg-gray-800 hover:bg-gray-700 text-blue-400 px-3 py-1.5 rounded-lg text-sm flex items-center justify-center gap-1"
                                        >
                                            <Pencil size={14} /> แก้ราคา/เตือน
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* History */}
            <div className="mt-6">
                <button
                    onClick={toggleHistory}
                    className="w-full flex items-center justify-between bg-[#1a1a24] rounded-xl p-4 border border-white/10 text-gray-300 hover:bg-white/5"
                >
                    <span className="flex items-center gap-2">
                        <History size={18} />
                        ประวัติรับเข้า/ขายล่าสุด
                    </span>
                    {showHistory ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>

                {showHistory && (
                    <div className="bg-[#1a1a24] rounded-xl mt-2 border border-white/10 divide-y divide-white/5 max-h-96 overflow-y-auto">
                        {historyLoading ? (
                            <div className="p-6 text-center">
                                <Loader2 className="animate-spin text-orange-400 mx-auto" size={24} />
                            </div>
                        ) : history.length === 0 ? (
                            <div className="p-6 text-center text-gray-500 text-sm">ยังไม่มีประวัติ</div>
                        ) : (
                            history.map((h) => (
                                <div key={`${h.type}-${h.id}`} className="flex items-center justify-between px-4 py-2.5 text-sm">
                                    <div className="min-w-0">
                                        <div className="truncate">{h.product.name}</div>
                                        <div className="text-xs text-gray-500">
                                            {new Date(h.createdAt).toLocaleString('th-TH', {
                                                day: 'numeric', month: 'short',
                                                hour: '2-digit', minute: '2-digit'
                                            })}
                                        </div>
                                    </div>
                                    <div className={`text-right font-mono ${h.type === 'IN' ? 'text-green-400' : 'text-amber-300'}`}>
                                        {h.type === 'IN' ? '+' : '-'}{h.quantity}
                                        {h.type === 'OUT' && h.amount !== undefined && (
                                            <div className="text-xs text-gray-500">฿{formatCurrency(h.amount)}</div>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
