'use client';

import { useState, useEffect, use } from 'react';
import { ArrowLeft, Plus, Pencil, Trash2, Save, X } from 'lucide-react';
import Link from 'next/link';
import { STATIONS } from '@/constants';

interface Product {
    id: string;
    name: string;
    unit: string;
    salePrice: number;
    quantity?: number;
}

interface EditingProduct {
    id?: string;
    name: string;
    unit: string;
    salePrice: string;
    quantity: string;
}

export default function ProductsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const stationIndex = parseInt(id) - 1;
    const station = STATIONS[stationIndex];
    const stationId = `station-${id}`;

    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [editing, setEditing] = useState<EditingProduct | null>(null);
    const [showAddForm, setShowAddForm] = useState(false);

    useEffect(() => {
        fetchProducts();
    }, [id]);

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

    const handleSave = async (product: EditingProduct) => {
        setSaving(true);
        try {
            const res = await fetch(`/api/simple-station/${id}/products`, {
                method: product.id ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: product.id,
                    name: product.name,
                    unit: product.unit || 'ชิ้น',
                    salePrice: parseFloat(product.salePrice) || 0,
                    quantity: parseInt(product.quantity) || 0,
                }),
            });

            if (res.ok) {
                fetchProducts();
                setEditing(null);
                setShowAddForm(false);
            } else {
                const err = await res.json();
                alert(err.error || 'บันทึกไม่สำเร็จ');
            }
        } catch (error) {
            console.error('Error saving product:', error);
            alert('เกิดข้อผิดพลาด');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (productId: string) => {
        if (!confirm('ยืนยันลบสินค้านี้?')) return;

        try {
            const res = await fetch(`/api/simple-station/${id}/products?productId=${productId}`, {
                method: 'DELETE',
            });

            if (res.ok) {
                fetchProducts();
            } else {
                const err = await res.json();
                alert(err.error || 'ลบไม่สำเร็จ');
            }
        } catch (error) {
            console.error('Error deleting product:', error);
        }
    };

    const formatCurrency = (num: number) =>
        new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2 }).format(num);

    if (!station) {
        return <div className="p-4 text-gray-500">ไม่พบสถานี</div>;
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
            {/* Header */}
            <header className="sticky top-0 z-40 backdrop-blur-xl border-b border-white/10 px-4 py-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link href={`/simple-station/${id}/new/home`} className="p-2 rounded-lg hover:bg-white/10">
                            <ArrowLeft size={20} className="text-gray-400" />
                        </Link>
                        <div>
                            <h1 className="font-bold text-white">จัดการสินค้า</h1>
                            <p className="text-xs text-gray-400">{station.name}</p>
                        </div>
                    </div>
                    <button
                        onClick={() => {
                            setShowAddForm(true);
                            setEditing({ name: '', unit: 'ชิ้น', salePrice: '', quantity: '10' });
                        }}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-500 text-white font-bold hover:bg-green-600 transition"
                    >
                        <Plus size={18} />
                        เพิ่มสินค้า
                    </button>
                </div>
            </header>

            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
                </div>
            ) : (
                <div className="p-4 space-y-3">
                    {/* Add/Edit Form */}
                    {(showAddForm || editing) && (
                        <div className="bg-white/10 rounded-2xl p-4 border border-white/20">
                            <h2 className="text-white font-bold mb-3">
                                {editing?.id ? '✏️ แก้ไขสินค้า' : '➕ เพิ่มสินค้าใหม่'}
                            </h2>
                            <div className="space-y-3">
                                <div>
                                    <label className="text-xs text-gray-400">ชื่อสินค้า</label>
                                    <input
                                        type="text"
                                        value={editing?.name || ''}
                                        onChange={(e) => setEditing(prev => prev ? { ...prev, name: e.target.value } : null)}
                                        className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                        placeholder="เช่น พาวเวอร์ 2T"
                                    />
                                </div>
                                <div className="grid grid-cols-3 gap-3">
                                    <div>
                                        <label className="text-xs text-gray-400">หน่วย</label>
                                        <input
                                            type="text"
                                            value={editing?.unit || ''}
                                            onChange={(e) => setEditing(prev => prev ? { ...prev, unit: e.target.value } : null)}
                                            className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                            placeholder="ขวด"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-400">ราคา (บาท)</label>
                                        <input
                                            type="number"
                                            value={editing?.salePrice || ''}
                                            onChange={(e) => setEditing(prev => prev ? { ...prev, salePrice: e.target.value } : null)}
                                            className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white text-right focus:outline-none focus:ring-2 focus:ring-purple-500"
                                            placeholder="0"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-400">จำนวนเริ่มต้น</label>
                                        <input
                                            type="number"
                                            value={editing?.quantity || ''}
                                            onChange={(e) => setEditing(prev => prev ? { ...prev, quantity: e.target.value } : null)}
                                            className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white text-right focus:outline-none focus:ring-2 focus:ring-purple-500"
                                            placeholder="10"
                                        />
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => {
                                            setEditing(null);
                                            setShowAddForm(false);
                                        }}
                                        className="flex-1 py-2 rounded-xl bg-gray-500/30 text-gray-300 font-bold hover:bg-gray-500/50 transition flex items-center justify-center gap-2"
                                    >
                                        <X size={18} />
                                        ยกเลิก
                                    </button>
                                    <button
                                        onClick={() => editing && handleSave(editing)}
                                        disabled={saving || !editing?.name}
                                        className="flex-1 py-2 rounded-xl bg-green-500 text-white font-bold hover:bg-green-600 transition disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        <Save size={18} />
                                        {saving ? 'กำลังบันทึก...' : 'บันทึก'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Products List */}
                    {products.length === 0 ? (
                        <div className="text-center py-12">
                            <p className="text-gray-400">ยังไม่มีสินค้า</p>
                            <p className="text-gray-500 text-sm mt-1">กดปุ่ม "เพิ่มสินค้า" เพื่อเริ่มต้น</p>
                        </div>
                    ) : (
                        products.map((product) => (
                            <div
                                key={product.id}
                                className="bg-white/5 rounded-xl p-4 border border-white/10 flex items-center justify-between"
                            >
                                <div>
                                    <p className="text-white font-bold">{product.name}</p>
                                    <p className="text-gray-400 text-sm">
                                        {formatCurrency(product.salePrice)} บาท/{product.unit} • คงเหลือ {product.quantity || 0}
                                    </p>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => {
                                            setEditing({
                                                id: product.id,
                                                name: product.name,
                                                unit: product.unit,
                                                salePrice: product.salePrice.toString(),
                                                quantity: (product.quantity || 0).toString(),
                                            });
                                            setShowAddForm(false);
                                        }}
                                        className="p-2 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition"
                                    >
                                        <Pencil size={18} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(product.id)}
                                        className="p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
