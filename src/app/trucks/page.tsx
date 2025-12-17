'use client';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import { LoadingState } from '@/components/Spinner';
import { useToast } from '@/components/Toast';
import { Truck as TruckIcon, Search, Plus, User, X, Sparkles, Edit2 } from 'lucide-react';

interface Truck {
    id: string;
    licensePlate: string;
    owner: {
        id: string;
        name: string;
        code: string | null;
    };
}

interface Owner {
    id: string;
    name: string;
    code: string | null;
}

export default function TrucksPage() {
    const { showToast } = useToast();
    const [loading, setLoading] = useState(true);
    const [trucks, setTrucks] = useState<Truck[]>([]);
    const [owners, setOwners] = useState<Owner[]>([]);
    const [search, setSearch] = useState('');
    const [mounted, setMounted] = useState(false);

    // Add Truck Modal
    const [showAddModal, setShowAddModal] = useState(false);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({
        licensePlate: '',
        ownerId: '',
    });

    // Edit Truck Modal
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingTruck, setEditingTruck] = useState<Truck | null>(null);
    const [editFormData, setEditFormData] = useState({
        licensePlate: '',
        ownerId: '',
    });

    useEffect(() => {
        setMounted(true);
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [trucksRes, ownersRes] = await Promise.all([
                fetch('/api/trucks'),
                fetch('/api/owners'),
            ]);

            if (trucksRes.ok) {
                const data = await trucksRes.json();
                setTrucks(data);
            }
            if (ownersRes.ok) {
                const data = await ownersRes.json();
                setOwners(data);
            }
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddTruck = async () => {
        if (!formData.licensePlate.trim()) {
            showToast('error', 'กรุณากรอกทะเบียนรถ');
            return;
        }
        if (!formData.ownerId) {
            showToast('error', 'กรุณาเลือกเจ้าของรถ');
            return;
        }

        setSaving(true);
        try {
            const res = await fetch('/api/trucks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });

            if (res.ok) {
                const newTruck = await res.json();
                setTrucks(prev => [...prev, newTruck]);
                setShowAddModal(false);
                setFormData({ licensePlate: '', ownerId: '' });
                showToast('success', `เพิ่มรถ "${newTruck.licensePlate}" สำเร็จ`);
            } else {
                const err = await res.json();
                showToast('error', err.error || 'เกิดข้อผิดพลาด');
            }
        } catch (error) {
            console.error('Error adding truck:', error);
            showToast('error', 'เกิดข้อผิดพลาด');
        } finally {
            setSaving(false);
        }
    };

    const openEditModal = (truck: Truck) => {
        setEditingTruck(truck);
        setEditFormData({
            licensePlate: truck.licensePlate,
            ownerId: truck.owner.id,
        });
        setShowEditModal(true);
    };

    const handleEditTruck = async () => {
        if (!editingTruck) return;
        if (!editFormData.ownerId) {
            showToast('error', 'กรุณาเลือกเจ้าของรถ');
            return;
        }

        setSaving(true);
        try {
            const res = await fetch(`/api/trucks/${editingTruck.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ownerId: editFormData.ownerId }),
            });

            if (res.ok) {
                const updatedTruck = await res.json();
                setTrucks(prev => prev.map(t => t.id === updatedTruck.id ? updatedTruck : t));
                setShowEditModal(false);
                setEditingTruck(null);
                showToast('success', `อัปเดตรถ "${updatedTruck.licensePlate}" สำเร็จ`);
            } else {
                const err = await res.json();
                showToast('error', err.error || 'เกิดข้อผิดพลาด');
            }
        } catch (error) {
            console.error('Error updating truck:', error);
            showToast('error', 'เกิดข้อผิดพลาด');
        } finally {
            setSaving(false);
        }
    };

    const filteredTrucks = trucks.filter(t =>
        t.licensePlate.toLowerCase().includes(search.toLowerCase()) ||
        t.owner.name.toLowerCase().includes(search.toLowerCase()) ||
        t.owner.code?.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <Sidebar>
            <div className="max-w-6xl mx-auto relative">
                {/* Background orbs */}
                <div className="fixed top-20 right-20 w-[400px] h-[400px] rounded-full opacity-20 blur-3xl pointer-events-none"
                    style={{ background: 'radial-gradient(circle, rgba(34, 197, 94, 0.3) 0%, transparent 70%)' }} />

                {/* Header */}
                <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-500">
                            <TruckIcon className="text-white" size={28} />
                        </div>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-white via-green-200 to-white bg-clip-text text-transparent">
                                รายชื่อรถ
                            </h1>
                            <p className="text-gray-400 flex items-center gap-2">
                                <Sparkles size={14} className="text-green-400" />
                                รถทั้งหมด {trucks.length} คัน
                            </p>
                        </div>
                    </div>
                    <button
                        className="relative group px-6 py-3 rounded-xl font-semibold text-white overflow-hidden"
                        onClick={() => setShowAddModal(true)}
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-green-600 via-emerald-500 to-green-600 transition-all duration-300" />
                        <div className="absolute inset-0 bg-gradient-to-r from-green-600 via-emerald-500 to-green-600 blur-xl opacity-50 group-hover:opacity-70 transition-opacity" />
                        <span className="relative flex items-center gap-2">
                            <Plus size={18} />
                            เพิ่มรถใหม่
                        </span>
                    </button>
                </div>

                {/* Search */}
                <div className={`backdrop-blur-xl rounded-2xl border border-white/10 p-4 mb-6 transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
                    style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)', transitionDelay: '100ms' }}>
                    <div className="relative group">
                        <div className="absolute -inset-0.5 bg-gradient-to-r from-green-600 to-emerald-600 rounded-xl opacity-0 group-focus-within:opacity-30 blur transition-all duration-300" />
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                        <input
                            type="text"
                            placeholder="ค้นหาทะเบียน, ชื่อเจ้าของ..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="relative w-full pl-12 pr-4 py-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-green-500/50 transition-all duration-300"
                        />
                    </div>
                </div>

                {/* Table */}
                <div className={`backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
                    style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)', transitionDelay: '200ms' }}>
                    {loading ? (
                        <LoadingState />
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-white/10">
                                        <th className="text-left p-4 text-sm font-medium text-gray-400">ลำดับ</th>
                                        <th className="text-left p-4 text-sm font-medium text-gray-400">ทะเบียนรถ</th>
                                        <th className="text-left p-4 text-sm font-medium text-gray-400">เจ้าของ</th>
                                        <th className="text-left p-4 text-sm font-medium text-gray-400">รหัส</th>
                                        <th className="text-left p-4 text-sm font-medium text-gray-400">จัดการ</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredTrucks.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="text-center py-12 text-gray-400">
                                                ไม่พบข้อมูล
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredTrucks.map((truck, i) => (
                                            <tr key={truck.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                                <td className="p-4 text-gray-500">{i + 1}</td>
                                                <td className="p-4">
                                                    <span className="inline-flex px-3 py-1.5 rounded-lg bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30 font-mono text-green-400 font-medium">
                                                        {truck.licensePlate}
                                                    </span>
                                                </td>
                                                <td className="p-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center text-white text-sm font-bold">
                                                            {truck.owner.name.charAt(0)}
                                                        </div>
                                                        <span className="text-white">{truck.owner.name}</span>
                                                    </div>
                                                </td>
                                                <td className="p-4 font-mono text-purple-400">{truck.owner.code || '-'}</td>
                                                <td className="p-4">
                                                    <button
                                                        onClick={() => openEditModal(truck)}
                                                        className="p-2 rounded-lg bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 transition-colors"
                                                        title="แก้ไขเจ้าของ"
                                                    >
                                                        <Edit2 size={16} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Add Truck Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="relative w-full max-w-md animate-fade-in">
                        <div className="absolute -inset-1 bg-gradient-to-r from-green-600 via-emerald-500 to-green-600 rounded-3xl blur-xl opacity-30" />
                        <div className="relative backdrop-blur-2xl rounded-2xl border border-white/10 p-6"
                            style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)' }}>
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500">
                                        <TruckIcon className="text-white" size={20} />
                                    </div>
                                    <h3 className="text-lg font-bold text-white">เพิ่มรถใหม่</h3>
                                </div>
                                <button
                                    onClick={() => setShowAddModal(false)}
                                    className="p-2 hover:bg-white/10 rounded-xl transition-colors"
                                >
                                    <X size={20} className="text-gray-400" />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm text-gray-400 mb-2">ทะเบียนรถ *</label>
                                    <input
                                        type="text"
                                        value={formData.licensePlate}
                                        onChange={(e) => setFormData(prev => ({ ...prev, licensePlate: e.target.value.toUpperCase() }))}
                                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-green-500/50 transition-all duration-300"
                                        placeholder="เช่น 1กก-1234 กทม."
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm text-gray-400 mb-2">เจ้าของรถ *</label>
                                    <select
                                        value={formData.ownerId}
                                        onChange={(e) => setFormData(prev => ({ ...prev, ownerId: e.target.value }))}
                                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-green-500/50 transition-all duration-300"
                                    >
                                        <option value="">เลือกเจ้าของ...</option>
                                        {owners.map(owner => (
                                            <option key={owner.id} value={owner.id}>
                                                {owner.code ? `[${owner.code}] ` : ''}{owner.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="flex gap-3 mt-6">
                                <button
                                    onClick={handleAddTruck}
                                    disabled={saving}
                                    className="flex-1 relative group px-6 py-3 rounded-xl font-semibold text-white overflow-hidden disabled:opacity-50"
                                >
                                    <div className="absolute inset-0 bg-gradient-to-r from-green-600 via-emerald-500 to-green-600" />
                                    <span className="relative">{saving ? 'กำลังบันทึก...' : 'บันทึก'}</span>
                                </button>
                                <button
                                    onClick={() => setShowAddModal(false)}
                                    className="px-6 py-3 rounded-xl font-medium text-gray-300 bg-white/5 hover:bg-white/10 transition-colors"
                                >
                                    ยกเลิก
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Truck Modal */}
            {showEditModal && editingTruck && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="relative w-full max-w-md animate-fade-in">
                        <div className="absolute -inset-1 bg-gradient-to-r from-yellow-600 via-amber-500 to-yellow-600 rounded-3xl blur-xl opacity-30" />
                        <div className="relative backdrop-blur-2xl rounded-2xl border border-white/10 p-6"
                            style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)' }}>
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-xl bg-gradient-to-br from-yellow-500 to-amber-500">
                                        <Edit2 className="text-white" size={20} />
                                    </div>
                                    <h3 className="text-lg font-bold text-white">แก้ไขเจ้าของรถ</h3>
                                </div>
                                <button
                                    onClick={() => { setShowEditModal(false); setEditingTruck(null); }}
                                    className="p-2 hover:bg-white/10 rounded-xl transition-colors"
                                >
                                    <X size={20} className="text-gray-400" />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm text-gray-400 mb-2">ทะเบียนรถ</label>
                                    <div className="w-full px-4 py-3 bg-white/10 border border-white/10 rounded-xl text-white font-mono">
                                        {editFormData.licensePlate}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm text-gray-400 mb-2">เจ้าของรถ *</label>
                                    <select
                                        value={editFormData.ownerId}
                                        onChange={(e) => setEditFormData(prev => ({ ...prev, ownerId: e.target.value }))}
                                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-yellow-500/50 transition-all duration-300"
                                    >
                                        <option value="">เลือกเจ้าของ...</option>
                                        {owners.map(owner => (
                                            <option key={owner.id} value={owner.id}>
                                                {owner.code ? `[${owner.code}] ` : ''}{owner.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="flex gap-3 mt-6">
                                <button
                                    onClick={handleEditTruck}
                                    disabled={saving}
                                    className="flex-1 relative group px-6 py-3 rounded-xl font-semibold text-white overflow-hidden disabled:opacity-50"
                                >
                                    <div className="absolute inset-0 bg-gradient-to-r from-yellow-600 via-amber-500 to-yellow-600" />
                                    <span className="relative">{saving ? 'กำลังบันทึก...' : 'บันทึก'}</span>
                                </button>
                                <button
                                    onClick={() => { setShowEditModal(false); setEditingTruck(null); }}
                                    className="px-6 py-3 rounded-xl font-medium text-gray-300 bg-white/5 hover:bg-white/10 transition-colors"
                                >
                                    ยกเลิก
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </Sidebar>
    );
}
