'use client';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import { LoadingState } from '@/components/Spinner';
import { useToast } from '@/components/Toast';
import { Users, Search, Plus, Phone, Truck, X, Sparkles, ChevronDown, Edit2, Trash2, DollarSign } from 'lucide-react';
import { OWNER_GROUPS } from '@/constants';

interface TruckItem {
    id: string;
    licensePlate: string;
}

interface Owner {
    id: string;
    name: string;
    phone: string | null;
    venderCode: string | null;
    groupType: string;
    code: string | null;
    creditLimit: number | null;
    trucks: TruckItem[];
    balance: number;
    _count: { trucks: number };
}

export default function OwnersPage() {
    const { showToast } = useToast();
    const [loading, setLoading] = useState(true);
    const [owners, setOwners] = useState<Owner[]>([]);
    const [search, setSearch] = useState('');
    const [filterGroup, setFilterGroup] = useState('all');
    const [mounted, setMounted] = useState(false);
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

    // Add Owner Modal
    const [showAddModal, setShowAddModal] = useState(false);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        venderCode: '',
        groupType: 'GENERAL_CREDIT',
    });

    // Edit Owner Modal
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingOwner, setEditingOwner] = useState<Owner | null>(null);
    const [editFormData, setEditFormData] = useState({
        name: '',
        phone: '',
        venderCode: '',
        groupType: 'GENERAL_CREDIT',
    });

    // Add Truck Modal (inline)
    const [addingTruckForOwner, setAddingTruckForOwner] = useState<string | null>(null);
    const [newTruckPlate, setNewTruckPlate] = useState('');

    useEffect(() => {
        setMounted(true);
        fetchOwners();
    }, []);

    const fetchOwners = async () => {
        try {
            const res = await fetch('/api/owners');
            if (res.ok) {
                const data = await res.json();
                setOwners(data);
            }
        } catch (error) {
            console.error('Error fetching owners:', error);
        } finally {
            setLoading(false);
        }
    };

    const toggleExpand = (id: string) => {
        setExpandedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const handleAddOwner = async () => {
        if (!formData.name.trim()) {
            showToast('error', 'กรุณากรอกชื่อลูกค้า');
            return;
        }

        setSaving(true);
        try {
            const res = await fetch('/api/owners', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });

            if (res.ok) {
                const newOwner = await res.json();
                setOwners(prev => [...prev, { ...newOwner, trucks: [], balance: 0 }]);
                setShowAddModal(false);
                setFormData({ name: '', phone: '', venderCode: '', groupType: 'GENERAL_CREDIT' });
                showToast('success', `เพิ่มลูกค้า "${newOwner.name}" สำเร็จ`);
            } else {
                const err = await res.json();
                showToast('error', err.error || 'เกิดข้อผิดพลาด');
            }
        } catch (error) {
            console.error('Error adding owner:', error);
            showToast('error', 'เกิดข้อผิดพลาด');
        } finally {
            setSaving(false);
        }
    };

    const openEditModal = (owner: Owner) => {
        setEditingOwner(owner);
        setEditFormData({
            name: owner.name,
            phone: owner.phone || '',
            venderCode: owner.venderCode || '',
            groupType: owner.groupType,
        });
        setShowEditModal(true);
    };

    const handleEditOwner = async () => {
        if (!editingOwner || !editFormData.name.trim()) {
            showToast('error', 'กรุณากรอกชื่อลูกค้า');
            return;
        }

        setSaving(true);
        try {
            const res = await fetch(`/api/owners/${editingOwner.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editFormData),
            });

            if (res.ok) {
                const updated = await res.json();
                setOwners(prev => prev.map(o => o.id === updated.id ? { ...o, ...updated } : o));
                setShowEditModal(false);
                setEditingOwner(null);
                showToast('success', 'อัปเดตข้อมูลสำเร็จ');
            } else {
                const err = await res.json();
                showToast('error', err.error || 'เกิดข้อผิดพลาด');
            }
        } catch (error) {
            console.error('Error updating owner:', error);
            showToast('error', 'เกิดข้อผิดพลาด');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteOwner = async (owner: Owner) => {
        if (!confirm(`ต้องการลบ "${owner.name}" ใช่หรือไม่?`)) return;

        try {
            const res = await fetch(`/api/owners/${owner.id}`, { method: 'DELETE' });
            if (res.ok) {
                setOwners(prev => prev.filter(o => o.id !== owner.id));
                showToast('success', 'ลบลูกค้าสำเร็จ');
            } else {
                const err = await res.json();
                showToast('error', err.error || 'ไม่สามารถลบได้');
            }
        } catch (error) {
            console.error('Error deleting owner:', error);
            showToast('error', 'เกิดข้อผิดพลาด');
        }
    };

    const handleAddTruck = async (ownerId: string) => {
        if (!newTruckPlate.trim()) {
            showToast('error', 'กรุณากรอกทะเบียนรถ');
            return;
        }

        setSaving(true);
        try {
            const res = await fetch('/api/trucks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ licensePlate: newTruckPlate.toUpperCase(), ownerId }),
            });

            if (res.ok) {
                const newTruck = await res.json();
                setOwners(prev => prev.map(o => {
                    if (o.id === ownerId) {
                        return {
                            ...o,
                            trucks: [...o.trucks, { id: newTruck.id, licensePlate: newTruck.licensePlate }],
                            _count: { ...o._count, trucks: o._count.trucks + 1 }
                        };
                    }
                    return o;
                }));
                setAddingTruckForOwner(null);
                setNewTruckPlate('');
                showToast('success', `เพิ่มรถ ${newTruck.licensePlate} สำเร็จ`);
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

    const filteredOwners = owners.filter(o => {
        const searchLower = search.toLowerCase();
        const matchesSearch = o.name.toLowerCase().includes(searchLower) ||
            o.phone?.includes(search) ||
            o.code?.toLowerCase().includes(searchLower) ||
            o.trucks.some(t => t.licensePlate.toLowerCase().includes(searchLower));
        const matchesGroup = filterGroup === 'all' || o.groupType === filterGroup;
        return matchesSearch && matchesGroup;
    });

    const getGroupLabel = (groupType: string) => {
        return OWNER_GROUPS.find(g => g.value === groupType)?.label || groupType;
    };

    const getGroupColor = (groupType: string) => {
        switch (groupType) {
            case 'SUGAR_FACTORY': return { bg: 'from-purple-500/20 to-pink-500/20', border: 'border-purple-500/30', text: 'text-purple-400' };
            case 'GENERAL_CREDIT': return { bg: 'from-blue-500/20 to-cyan-500/20', border: 'border-blue-500/30', text: 'text-blue-400' };
            case 'BOX_TRUCK': return { bg: 'from-orange-500/20 to-yellow-500/20', border: 'border-orange-500/30', text: 'text-orange-400' };
            case 'OIL_TRUCK': return { bg: 'from-red-500/20 to-rose-500/20', border: 'border-red-500/30', text: 'text-red-400' };
            default: return { bg: 'from-gray-500/20 to-slate-500/20', border: 'border-gray-500/30', text: 'text-gray-400' };
        }
    };

    const formatMoney = (n: number) => n.toLocaleString('th-TH');

    return (
        <Sidebar>
            <div className="max-w-5xl mx-auto relative">
                {/* Background orbs */}
                <div className="fixed top-20 right-20 w-[400px] h-[400px] rounded-full opacity-20 blur-3xl pointer-events-none"
                    style={{ background: 'radial-gradient(circle, rgba(59, 130, 246, 0.3) 0%, transparent 70%)' }} />

                {/* Header */}
                <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500">
                            <Users className="text-white" size={28} />
                        </div>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-white via-blue-200 to-white bg-clip-text text-transparent">
                                ลูกค้า & รถ
                            </h1>
                            <p className="text-gray-400 flex items-center gap-2">
                                <Sparkles size={14} className="text-blue-400" />
                                {owners.length} ราย • {owners.reduce((sum, o) => sum + o._count.trucks, 0)} คัน
                            </p>
                        </div>
                    </div>
                    <button
                        className="relative group px-6 py-3 rounded-xl font-semibold text-white overflow-hidden"
                        onClick={() => setShowAddModal(true)}
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-cyan-500 to-blue-600 transition-all duration-300" />
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-cyan-500 to-blue-600 blur-xl opacity-50 group-hover:opacity-70 transition-opacity" />
                        <span className="relative flex items-center gap-2">
                            <Plus size={18} />
                            เพิ่มลูกค้าใหม่
                        </span>
                    </button>
                </div>

                {/* Filters */}
                <div className={`backdrop-blur-xl rounded-2xl border border-white/10 p-4 mb-6 transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
                    style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)' }}>
                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="flex-1 relative group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                            <input
                                type="text"
                                placeholder="ค้นหาชื่อ, เบอร์โทร, รหัส, ทะเบียนรถ..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="relative w-full pl-12 pr-4 py-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 transition-all duration-300"
                            />
                        </div>
                        <select
                            value={filterGroup}
                            onChange={(e) => setFilterGroup(e.target.value)}
                            className="w-full sm:w-48 px-4 py-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl text-white focus:outline-none focus:border-blue-500/50"
                        >
                            <option value="all">ทุกกลุ่ม</option>
                            {OWNER_GROUPS.map(g => (
                                <option key={g.value} value={g.value}>{g.label}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Owner List (Accordion) */}
                <div className={`space-y-3 transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                    {loading ? (
                        <LoadingState />
                    ) : filteredOwners.length === 0 ? (
                        <div className="text-center py-12 text-gray-400">ไม่พบข้อมูล</div>
                    ) : (
                        filteredOwners.map((owner) => {
                            const isExpanded = expandedIds.has(owner.id);
                            const color = getGroupColor(owner.groupType);

                            return (
                                <div
                                    key={owner.id}
                                    className="backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden"
                                    style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)' }}
                                >
                                    {/* Owner Header Row */}
                                    <div
                                        className="flex items-center gap-4 p-4 cursor-pointer hover:bg-white/5 transition-colors"
                                        onClick={() => toggleExpand(owner.id)}
                                    >
                                        <ChevronDown
                                            size={20}
                                            className={`text-gray-400 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
                                        />

                                        {/* Avatar */}
                                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${color.bg} border ${color.border} flex items-center justify-center font-bold text-white`}>
                                            {owner.name.charAt(0)}
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                {owner.code && (
                                                    <span className="text-blue-400 font-mono text-sm">[{owner.code}]</span>
                                                )}
                                                <span className="font-medium text-white truncate">{owner.name}</span>
                                            </div>
                                            <div className="flex items-center gap-3 text-sm text-gray-400">
                                                <span className={`px-2 py-0.5 rounded text-xs ${color.text} bg-gradient-to-r ${color.bg}`}>
                                                    {getGroupLabel(owner.groupType)}
                                                </span>
                                                {owner.phone && (
                                                    <span className="flex items-center gap-1">
                                                        <Phone size={12} />
                                                        {owner.phone}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Stats */}
                                        <div className="flex items-center gap-4 text-sm">
                                            <div className="flex items-center gap-1 text-green-400">
                                                <Truck size={16} />
                                                <span>{owner._count.trucks}</span>
                                            </div>
                                            {owner.balance > 0 && (
                                                <div className="flex items-center gap-1 text-yellow-400">
                                                    <DollarSign size={16} />
                                                    <span>฿{formatMoney(owner.balance)}</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                            <button
                                                onClick={() => openEditModal(owner)}
                                                className="p-2 rounded-lg bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 transition-colors"
                                                title="แก้ไข"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            {owner._count.trucks === 0 && (
                                                <button
                                                    onClick={() => handleDeleteOwner(owner)}
                                                    className="p-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-colors"
                                                    title="ลบ"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Expanded Content */}
                                    {isExpanded && (
                                        <div className="border-t border-white/10 p-4 bg-white/5">
                                            <div className="flex flex-wrap gap-2 mb-3">
                                                {owner.trucks.map(truck => (
                                                    <span
                                                        key={truck.id}
                                                        className="inline-flex px-3 py-1.5 rounded-lg bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30 font-mono text-green-400 text-sm"
                                                    >
                                                        {truck.licensePlate}
                                                    </span>
                                                ))}
                                                {owner.trucks.length === 0 && (
                                                    <span className="text-gray-500 text-sm">ยังไม่มีรถ</span>
                                                )}
                                            </div>

                                            {/* Add Truck Inline */}
                                            {addingTruckForOwner === owner.id ? (
                                                <div className="flex gap-2 items-center">
                                                    <input
                                                        type="text"
                                                        value={newTruckPlate}
                                                        onChange={(e) => setNewTruckPlate(e.target.value.toUpperCase())}
                                                        placeholder="ทะเบียนรถ..."
                                                        className="flex-1 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white font-mono focus:outline-none focus:border-green-500/50"
                                                        autoFocus
                                                    />
                                                    <button
                                                        onClick={() => handleAddTruck(owner.id)}
                                                        disabled={saving}
                                                        className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors disabled:opacity-50"
                                                    >
                                                        เพิ่ม
                                                    </button>
                                                    <button
                                                        onClick={() => { setAddingTruckForOwner(null); setNewTruckPlate(''); }}
                                                        className="px-4 py-2 bg-white/10 hover:bg-white/20 text-gray-300 rounded-lg transition-colors"
                                                    >
                                                        ยกเลิก
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => setAddingTruckForOwner(owner.id)}
                                                    className="flex items-center gap-2 px-3 py-2 text-sm text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded-lg transition-colors"
                                                >
                                                    <Plus size={16} />
                                                    เพิ่มรถ
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Add Owner Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="relative w-full max-w-md animate-fade-in">
                        <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 via-cyan-500 to-blue-600 rounded-3xl blur-xl opacity-30" />
                        <div className="relative backdrop-blur-2xl rounded-2xl border border-white/10 p-6"
                            style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)' }}>
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500">
                                        <Users className="text-white" size={20} />
                                    </div>
                                    <h3 className="text-lg font-bold text-white">เพิ่มลูกค้าใหม่</h3>
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
                                    <label className="block text-sm text-gray-400 mb-2">ชื่อลูกค้า *</label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50"
                                        placeholder="เช่น บริษัท ABC จำกัด"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm text-gray-400 mb-2">เบอร์โทรศัพท์</label>
                                    <input
                                        type="tel"
                                        value={formData.phone}
                                        onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50"
                                        placeholder="เช่น 081-234-5678"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm text-gray-400 mb-2">กลุ่มลูกค้า</label>
                                    <select
                                        value={formData.groupType}
                                        onChange={(e) => setFormData(prev => ({ ...prev, groupType: e.target.value, venderCode: '' }))}
                                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-blue-500/50"
                                    >
                                        {OWNER_GROUPS.map(g => (
                                            <option key={g.value} value={g.value}>{g.label}</option>
                                        ))}
                                    </select>
                                </div>

                                {formData.groupType === 'SUGAR_FACTORY' && (
                                    <div>
                                        <label className="block text-sm text-gray-400 mb-2">Vendor Code (โรงงาน)</label>
                                        <input
                                            type="text"
                                            value={formData.venderCode}
                                            onChange={(e) => setFormData(prev => ({ ...prev, venderCode: e.target.value }))}
                                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50"
                                            placeholder="เช่น 40002550"
                                        />
                                        <p className="text-xs text-purple-400 mt-2">* รหัสลูกค้า C-code จะถูกสร้างอัตโนมัติ</p>
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-3 mt-6">
                                <button
                                    onClick={handleAddOwner}
                                    disabled={saving}
                                    className="flex-1 relative group px-6 py-3 rounded-xl font-semibold text-white overflow-hidden disabled:opacity-50"
                                >
                                    <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-cyan-500 to-blue-600" />
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

            {/* Edit Owner Modal */}
            {showEditModal && editingOwner && (
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
                                    <h3 className="text-lg font-bold text-white">แก้ไขข้อมูลลูกค้า</h3>
                                </div>
                                <button
                                    onClick={() => { setShowEditModal(false); setEditingOwner(null); }}
                                    className="p-2 hover:bg-white/10 rounded-xl transition-colors"
                                >
                                    <X size={20} className="text-gray-400" />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm text-gray-400 mb-2">ชื่อลูกค้า *</label>
                                    <input
                                        type="text"
                                        value={editFormData.name}
                                        onChange={(e) => setEditFormData(prev => ({ ...prev, name: e.target.value }))}
                                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-yellow-500/50"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm text-gray-400 mb-2">เบอร์โทรศัพท์</label>
                                    <input
                                        type="tel"
                                        value={editFormData.phone}
                                        onChange={(e) => setEditFormData(prev => ({ ...prev, phone: e.target.value }))}
                                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-yellow-500/50"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm text-gray-400 mb-2">กลุ่มลูกค้า</label>
                                    <select
                                        value={editFormData.groupType}
                                        onChange={(e) => setEditFormData(prev => ({ ...prev, groupType: e.target.value }))}
                                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-yellow-500/50"
                                    >
                                        {OWNER_GROUPS.map(g => (
                                            <option key={g.value} value={g.value}>{g.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="flex gap-3 mt-6">
                                <button
                                    onClick={handleEditOwner}
                                    disabled={saving}
                                    className="flex-1 relative group px-6 py-3 rounded-xl font-semibold text-white overflow-hidden disabled:opacity-50"
                                >
                                    <div className="absolute inset-0 bg-gradient-to-r from-yellow-600 via-amber-500 to-yellow-600" />
                                    <span className="relative">{saving ? 'กำลังบันทึก...' : 'บันทึก'}</span>
                                </button>
                                <button
                                    onClick={() => { setShowEditModal(false); setEditingOwner(null); }}
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
