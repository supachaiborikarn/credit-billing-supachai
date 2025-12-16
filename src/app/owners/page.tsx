'use client';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import { LoadingState } from '@/components/Spinner';
import { useToast } from '@/components/Toast';
import { Users, Search, Plus, Phone, Truck, X, Sparkles } from 'lucide-react';
import { OWNER_GROUPS } from '@/constants';

interface Owner {
    id: string;
    name: string;
    phone: string | null;
    venderCode: string | null;
    groupType: string;
    code: string | null;
    _count: { trucks: number };
}

export default function OwnersPage() {
    const { showToast } = useToast();
    const [loading, setLoading] = useState(true);
    const [owners, setOwners] = useState<Owner[]>([]);
    const [search, setSearch] = useState('');
    const [filterGroup, setFilterGroup] = useState('all');
    const [mounted, setMounted] = useState(false);

    // Add Owner Modal
    const [showAddModal, setShowAddModal] = useState(false);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        venderCode: '',
        groupType: 'GENERAL_CREDIT',
    });

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
                setOwners(prev => [...prev, newOwner]);
                setShowAddModal(false);
                setFormData({ name: '', phone: '', venderCode: '', groupType: 'GENERAL_CREDIT' });
                const codeText = newOwner.code ? ` (${newOwner.code})` : '';
                showToast('success', `เพิ่มลูกค้า "${newOwner.name}"${codeText} สำเร็จ`);
            } else {
                const err = await res.json();
                showToast('error', err.error || 'เกิดข้อผิดพลาดในการเพิ่มลูกค้า');
            }
        } catch (error) {
            console.error('Error adding owner:', error);
            showToast('error', 'เกิดข้อผิดพลาด');
        } finally {
            setSaving(false);
        }
    };

    const filteredOwners = owners.filter(o => {
        const matchesSearch = o.name.toLowerCase().includes(search.toLowerCase()) ||
            o.phone?.includes(search) ||
            o.code?.toLowerCase().includes(search.toLowerCase());
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

    return (
        <Sidebar>
            <div className="max-w-6xl mx-auto relative">
                {/* Background orbs */}
                <div className="fixed top-20 right-20 w-[400px] h-[400px] rounded-full opacity-20 blur-3xl pointer-events-none"
                    style={{ background: 'radial-gradient(circle, rgba(59, 130, 246, 0.3) 0%, transparent 70%)' }} />

                {/* Header */}
                <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500">
                            <Users className="text-white" size={28} />
                        </div>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-white via-blue-200 to-white bg-clip-text text-transparent">
                                รายชื่อเจ้าของ
                            </h1>
                            <p className="text-gray-400 flex items-center gap-2">
                                <Sparkles size={14} className="text-blue-400" />
                                ลูกค้าเงินเชื่อทั้งหมด {owners.length} ราย
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
                    style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)', transitionDelay: '100ms' }}>
                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="flex-1 relative group">
                            <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-xl opacity-0 group-focus-within:opacity-30 blur transition-all duration-300" />
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                            <input
                                type="text"
                                placeholder="ค้นหาชื่อ, เบอร์โทร, รหัส..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="relative w-full pl-12 pr-4 py-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 transition-all duration-300"
                            />
                        </div>
                        <select
                            value={filterGroup}
                            onChange={(e) => setFilterGroup(e.target.value)}
                            className="w-full sm:w-56 px-4 py-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl text-white focus:outline-none focus:border-blue-500/50 transition-all duration-300"
                        >
                            <option value="all">ทุกกลุ่ม</option>
                            {OWNER_GROUPS.map(g => (
                                <option key={g.value} value={g.value}>{g.label}</option>
                            ))}
                        </select>
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
                                        <th className="text-left p-4 text-sm font-medium text-gray-400">รหัส</th>
                                        <th className="text-left p-4 text-sm font-medium text-gray-400">ชื่อ</th>
                                        <th className="text-left p-4 text-sm font-medium text-gray-400">เบอร์โทร</th>
                                        <th className="text-left p-4 text-sm font-medium text-gray-400">Vendor Code</th>
                                        <th className="text-left p-4 text-sm font-medium text-gray-400">กลุ่ม</th>
                                        <th className="text-left p-4 text-sm font-medium text-gray-400">รถ</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredOwners.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="text-center py-12 text-gray-400">
                                                ไม่พบข้อมูล
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredOwners.map((owner, index) => {
                                            const color = getGroupColor(owner.groupType);
                                            return (
                                                <tr key={owner.id}
                                                    className="border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer"
                                                    style={{ animationDelay: `${index * 50}ms` }}>
                                                    <td className="p-4 font-mono text-blue-400 font-medium">{owner.code || '-'}</td>
                                                    <td className="p-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-bold text-sm">
                                                                {owner.name.charAt(0)}
                                                            </div>
                                                            <span className="font-medium text-white">{owner.name}</span>
                                                        </div>
                                                    </td>
                                                    <td className="p-4">
                                                        {owner.phone ? (
                                                            <span className="flex items-center gap-2 text-gray-300">
                                                                <Phone size={14} className="text-gray-500" />
                                                                {owner.phone}
                                                            </span>
                                                        ) : (
                                                            <span className="text-gray-600">-</span>
                                                        )}
                                                    </td>
                                                    <td className="p-4 font-mono text-sm text-gray-400">{owner.venderCode || '-'}</td>
                                                    <td className="p-4">
                                                        <span className={`inline-flex px-3 py-1 rounded-lg text-xs font-medium bg-gradient-to-r ${color.bg} ${color.text} border ${color.border}`}>
                                                            {getGroupLabel(owner.groupType)}
                                                        </span>
                                                    </td>
                                                    <td className="p-4">
                                                        <span className="flex items-center gap-2 text-gray-300">
                                                            <Truck size={14} className="text-gray-500" />
                                                            {owner._count?.trucks || 0}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
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
                                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 transition-all duration-300"
                                        placeholder="เช่น บริษัท ABC จำกัด"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm text-gray-400 mb-2">เบอร์โทรศัพท์</label>
                                    <input
                                        type="tel"
                                        value={formData.phone}
                                        onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 transition-all duration-300"
                                        placeholder="เช่น 081-234-5678"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm text-gray-400 mb-2">กลุ่มลูกค้า</label>
                                    <select
                                        value={formData.groupType}
                                        onChange={(e) => setFormData(prev => ({ ...prev, groupType: e.target.value, venderCode: '' }))}
                                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-blue-500/50 transition-all duration-300"
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
                                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 transition-all duration-300"
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
        </Sidebar>
    );
}
