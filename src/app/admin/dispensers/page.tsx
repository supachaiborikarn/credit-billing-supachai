'use client';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import { STATIONS } from '@/constants';
import {
    Plus,
    Edit,
    Trash2,
    Fuel,
    ChevronDown,
    ChevronRight,
    X,
    Save,
    RefreshCw
} from 'lucide-react';

interface Product {
    id: string;
    name: string;
    code: string;
}

interface Nozzle {
    id: string;
    code: string;
    productId: string;
    product: Product;
    isActive: boolean;
}

interface Dispenser {
    id: string;
    code: string;
    isActive: boolean;
    nozzles: Nozzle[];
}

export default function DispensersPage() {
    const [selectedStation, setSelectedStation] = useState<string | null>(null);
    const [dispensers, setDispensers] = useState<Dispenser[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(false);
    const [expandedDispenser, setExpandedDispenser] = useState<string | null>(null);

    // Modal states
    const [showDispenserModal, setShowDispenserModal] = useState(false);
    const [showNozzleModal, setShowNozzleModal] = useState(false);
    const [editingDispenser, setEditingDispenser] = useState<Dispenser | null>(null);
    const [editingNozzle, setEditingNozzle] = useState<{ nozzle: Nozzle | null, dispenserId: string } | null>(null);

    // Form states
    const [dispenserCode, setDispenserCode] = useState('');
    const [nozzleCode, setNozzleCode] = useState('');
    const [nozzleProductId, setNozzleProductId] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchProducts();
    }, []);

    useEffect(() => {
        if (selectedStation) {
            fetchDispensers();
        }
    }, [selectedStation]);

    const fetchProducts = async () => {
        try {
            const res = await fetch('/api/fuel-products');
            if (res.ok) {
                const data = await res.json();
                setProducts(data.products || []);
            }
        } catch (error) {
            console.error('Error fetching products:', error);
        }
    };

    const fetchDispensers = async () => {
        if (!selectedStation) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/stations/${selectedStation}/dispensers`);
            if (res.ok) {
                const data = await res.json();
                setDispensers(data.dispensers || []);
            }
        } catch (error) {
            console.error('Error fetching dispensers:', error);
        } finally {
            setLoading(false);
        }
    };

    // Dispenser CRUD
    const handleSaveDispenser = async () => {
        if (!selectedStation || !dispenserCode.trim()) return;
        setSaving(true);
        try {
            const url = editingDispenser
                ? `/api/stations/${selectedStation}/dispensers/${editingDispenser.id}`
                : `/api/stations/${selectedStation}/dispensers`;

            const res = await fetch(url, {
                method: editingDispenser ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: dispenserCode })
            });

            if (res.ok) {
                fetchDispensers();
                setShowDispenserModal(false);
                setEditingDispenser(null);
                setDispenserCode('');
            } else {
                alert('เกิดข้อผิดพลาด');
            }
        } catch (error) {
            console.error('Error saving dispenser:', error);
            alert('เกิดข้อผิดพลาด');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteDispenser = async (dispenserId: string) => {
        if (!selectedStation || !confirm('ยืนยันการลบตู้จ่ายนี้?')) return;
        try {
            const res = await fetch(`/api/stations/${selectedStation}/dispensers/${dispenserId}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                fetchDispensers();
            }
        } catch (error) {
            console.error('Error deleting dispenser:', error);
        }
    };

    // Nozzle CRUD
    const handleSaveNozzle = async () => {
        if (!editingNozzle?.dispenserId || !nozzleCode.trim() || !nozzleProductId) return;
        setSaving(true);
        try {
            const url = editingNozzle.nozzle
                ? `/api/stations/${selectedStation}/dispensers/${editingNozzle.dispenserId}/nozzles/${editingNozzle.nozzle.id}`
                : `/api/stations/${selectedStation}/dispensers/${editingNozzle.dispenserId}/nozzles`;

            const res = await fetch(url, {
                method: editingNozzle.nozzle ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: nozzleCode, productId: nozzleProductId })
            });

            if (res.ok) {
                fetchDispensers();
                setShowNozzleModal(false);
                setEditingNozzle(null);
                setNozzleCode('');
                setNozzleProductId('');
            } else {
                alert('เกิดข้อผิดพลาด');
            }
        } catch (error) {
            console.error('Error saving nozzle:', error);
            alert('เกิดข้อผิดพลาด');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteNozzle = async (dispenserId: string, nozzleId: string) => {
        if (!selectedStation || !confirm('ยืนยันการลบหัวจ่ายนี้?')) return;
        try {
            const res = await fetch(`/api/stations/${selectedStation}/dispensers/${dispenserId}/nozzles/${nozzleId}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                fetchDispensers();
            }
        } catch (error) {
            console.error('Error deleting nozzle:', error);
        }
    };

    const openEditDispenser = (dispenser: Dispenser) => {
        setEditingDispenser(dispenser);
        setDispenserCode(dispenser.code);
        setShowDispenserModal(true);
    };

    const openAddNozzle = (dispenserId: string) => {
        setEditingNozzle({ nozzle: null, dispenserId });
        setNozzleCode('');
        setNozzleProductId('');
        setShowNozzleModal(true);
    };

    const openEditNozzle = (nozzle: Nozzle, dispenserId: string) => {
        setEditingNozzle({ nozzle, dispenserId });
        setNozzleCode(nozzle.code);
        setNozzleProductId(nozzle.productId);
        setShowNozzleModal(true);
    };

    return (
        <Sidebar>
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500">
                            <Fuel className="text-white" size={28} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-white">จัดการหัวจ่าย</h1>
                            <p className="text-gray-400">Dispenser & Nozzle Management</p>
                        </div>
                    </div>
                    <button
                        onClick={fetchDispensers}
                        disabled={!selectedStation || loading}
                        className="p-2 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-50"
                    >
                        <RefreshCw size={20} className={`text-white ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>

                {/* Station Selector */}
                <div className="glass-card p-4 mb-6">
                    <label className="block text-sm text-gray-400 mb-2">เลือกสถานี</label>
                    <select
                        value={selectedStation || ''}
                        onChange={(e) => setSelectedStation(e.target.value || null)}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500"
                    >
                        <option value="">-- เลือกสถานี --</option>
                        {STATIONS.map(station => (
                            <option key={station.id} value={station.id}>{station.name}</option>
                        ))}
                    </select>
                </div>

                {/* Dispensers List */}
                {selectedStation && (
                    <div className="glass-card p-4">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold text-white">ตู้จ่าย ({dispensers.length})</h2>
                            <button
                                onClick={() => {
                                    setEditingDispenser(null);
                                    setDispenserCode('');
                                    setShowDispenserModal(true);
                                }}
                                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl text-sm font-medium hover:opacity-90"
                            >
                                <Plus size={18} />
                                เพิ่มตู้จ่าย
                            </button>
                        </div>

                        {loading ? (
                            <div className="flex items-center justify-center py-8">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
                            </div>
                        ) : dispensers.length === 0 ? (
                            <div className="text-center py-8 text-gray-400">
                                ยังไม่มีตู้จ่าย กดปุ่มด้านบนเพื่อเพิ่ม
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {dispensers.map(dispenser => (
                                    <div key={dispenser.id} className="bg-white/5 rounded-xl overflow-hidden">
                                        {/* Dispenser Header */}
                                        <div
                                            className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/5"
                                            onClick={() => setExpandedDispenser(expandedDispenser === dispenser.id ? null : dispenser.id)}
                                        >
                                            <div className="flex items-center gap-3">
                                                {expandedDispenser === dispenser.id ? (
                                                    <ChevronDown size={20} className="text-gray-400" />
                                                ) : (
                                                    <ChevronRight size={20} className="text-gray-400" />
                                                )}
                                                <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                                                    <Fuel size={20} className="text-purple-400" />
                                                </div>
                                                <div>
                                                    <p className="text-white font-medium">{dispenser.code}</p>
                                                    <p className="text-sm text-gray-400">{dispenser.nozzles.length} หัวจ่าย</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                                <button
                                                    onClick={() => openEditDispenser(dispenser)}
                                                    className="p-2 text-orange-400 hover:bg-orange-500/20 rounded-lg"
                                                >
                                                    <Edit size={18} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteDispenser(dispenser.id)}
                                                    className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Nozzles List */}
                                        {expandedDispenser === dispenser.id && (
                                            <div className="border-t border-white/10 p-4 bg-white/[0.02]">
                                                <div className="flex items-center justify-between mb-3">
                                                    <span className="text-sm text-gray-400">หัวจ่าย</span>
                                                    <button
                                                        onClick={() => openAddNozzle(dispenser.id)}
                                                        className="flex items-center gap-1 px-3 py-1.5 bg-green-500/20 text-green-400 rounded-lg text-sm hover:bg-green-500/30"
                                                    >
                                                        <Plus size={14} />
                                                        เพิ่มหัวจ่าย
                                                    </button>
                                                </div>
                                                {dispenser.nozzles.length === 0 ? (
                                                    <p className="text-sm text-gray-500">ยังไม่มีหัวจ่าย</p>
                                                ) : (
                                                    <div className="space-y-2">
                                                        {dispenser.nozzles.map(nozzle => (
                                                            <div key={nozzle.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                                                                <div className="flex items-center gap-3">
                                                                    <span className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 text-sm font-bold">
                                                                        {nozzle.code}
                                                                    </span>
                                                                    <span className="text-white">{nozzle.product.name}</span>
                                                                    <span className="text-xs text-gray-500">({nozzle.product.code})</span>
                                                                </div>
                                                                <div className="flex items-center gap-1">
                                                                    <button
                                                                        onClick={() => openEditNozzle(nozzle, dispenser.id)}
                                                                        className="p-1.5 text-orange-400 hover:bg-orange-500/20 rounded-lg"
                                                                    >
                                                                        <Edit size={14} />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleDeleteNozzle(dispenser.id, nozzle.id)}
                                                                        className="p-1.5 text-red-400 hover:bg-red-500/20 rounded-lg"
                                                                    >
                                                                        <Trash2 size={14} />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Dispenser Modal */}
                {showDispenserModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-md">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-bold text-white">
                                    {editingDispenser ? 'แก้ไขตู้จ่าย' : 'เพิ่มตู้จ่าย'}
                                </h3>
                                <button onClick={() => setShowDispenserModal(false)} className="text-gray-400 hover:text-white">
                                    <X size={24} />
                                </button>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm text-gray-400 mb-2">รหัสตู้จ่าย</label>
                                    <input
                                        type="text"
                                        value={dispenserCode}
                                        onChange={(e) => setDispenserCode(e.target.value)}
                                        placeholder="เช่น D1, D2, ..."
                                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500"
                                    />
                                </div>
                                <button
                                    onClick={handleSaveDispenser}
                                    disabled={saving || !dispenserCode.trim()}
                                    className="w-full py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {saving ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />}
                                    บันทึก
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Nozzle Modal */}
                {showNozzleModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-md">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-bold text-white">
                                    {editingNozzle?.nozzle ? 'แก้ไขหัวจ่าย' : 'เพิ่มหัวจ่าย'}
                                </h3>
                                <button onClick={() => setShowNozzleModal(false)} className="text-gray-400 hover:text-white">
                                    <X size={24} />
                                </button>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm text-gray-400 mb-2">รหัสหัวจ่าย</label>
                                    <input
                                        type="text"
                                        value={nozzleCode}
                                        onChange={(e) => setNozzleCode(e.target.value)}
                                        placeholder="เช่น N1, N2, ..."
                                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-2">ประเภทน้ำมัน</label>
                                    <select
                                        value={nozzleProductId}
                                        onChange={(e) => setNozzleProductId(e.target.value)}
                                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500"
                                    >
                                        <option value="">-- เลือกประเภทน้ำมัน --</option>
                                        {products.map(product => (
                                            <option key={product.id} value={product.id}>{product.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <button
                                    onClick={handleSaveNozzle}
                                    disabled={saving || !nozzleCode.trim() || !nozzleProductId}
                                    className="w-full py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {saving ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />}
                                    บันทึก
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </Sidebar>
    );
}
