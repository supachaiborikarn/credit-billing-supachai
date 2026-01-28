'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Sidebar from '@/components/Sidebar';
import { LoadingState } from '@/components/Spinner';
import { useToast } from '@/components/Toast';
import {
    Users, Search, Plus, Phone, Truck, X, Sparkles, ChevronDown,
    Edit2, Trash2, DollarSign, CheckCircle, XCircle, AlertTriangle,
    Ban, Power
} from 'lucide-react';
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
    status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
    code: string | null;
    creditLimit: number | null;
    trucks: TruckItem[];
    balance: number;
    _count: { trucks: number; transactions: number };
}

type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

export default function OwnersPage() {
    const { showToast } = useToast();
    const [loading, setLoading] = useState(true);
    const [owners, setOwners] = useState<Owner[]>([]);
    const [search, setSearch] = useState('');
    const [filterGroup, setFilterGroup] = useState('all');
    const [filterStatus, setFilterStatus] = useState<StatusFilter>('ACTIVE');
    const [mounted, setMounted] = useState(false);
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 20;

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

    // Deactivate Confirmation
    const [confirmDeactivate, setConfirmDeactivate] = useState<Owner | null>(null);

    // Duplicate Warning
    interface DuplicateOwner {
        id: string;
        name: string;
        phone: string | null;
        code: string | null;
        status: string;
    }
    const [duplicates, setDuplicates] = useState<DuplicateOwner[]>([]);
    const [checkingDuplicate, setCheckingDuplicate] = useState(false);

    // Add Truck Modal (inline)
    const [addingTruckForOwner, setAddingTruckForOwner] = useState<string | null>(null);
    const [newTruckPlate, setNewTruckPlate] = useState('');

    // Check for duplicates when form changes
    const checkDuplicates = useCallback(async (name: string, phone: string) => {
        if (name.length < 3 && phone.length < 6) {
            setDuplicates([]);
            return;
        }
        setCheckingDuplicate(true);
        try {
            const params = new URLSearchParams();
            if (name.length >= 3) params.set('name', name);
            if (phone.length >= 6) params.set('phone', phone);
            const res = await fetch(`/api/owners/check-duplicate?${params}`);
            if (res.ok) {
                const data = await res.json();
                setDuplicates(data.duplicates || []);
            }
        } catch (error) {
            console.error('Duplicate check error:', error);
        } finally {
            setCheckingDuplicate(false);
        }
    }, []);

    // Debounced duplicate check
    useEffect(() => {
        if (!showAddModal) {
            setDuplicates([]);
            return;
        }
        const timer = setTimeout(() => {
            checkDuplicates(formData.name, formData.phone);
        }, 500);
        return () => clearTimeout(timer);
    }, [formData.name, formData.phone, showAddModal, checkDuplicates]);

    useEffect(() => {
        setMounted(true);
        fetchOwners();
    }, [filterStatus]);

    const fetchOwners = async () => {
        setLoading(true);
        try {
            const statusParam = filterStatus === 'ALL' ? '' : `?status=${filterStatus}`;
            const res = await fetch(`/api/owners${statusParam}`);
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
                showToast('success', 'เพิ่มลูกค้าสำเร็จ');
            } else {
                const err = await res.json();
                showToast('error', err.error || 'ไม่สามารถเพิ่มได้');
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
                showToast('success', 'แก้ไขข้อมูลสำเร็จ');
            } else {
                const err = await res.json();
                showToast('error', err.error || 'ไม่สามารถแก้ไขได้');
            }
        } catch (error) {
            console.error('Error updating owner:', error);
            showToast('error', 'เกิดข้อผิดพลาด');
        } finally {
            setSaving(false);
        }
    };

    const handleDeactivateOwner = async () => {
        if (!confirmDeactivate) return;

        try {
            const res = await fetch(`/api/owners/${confirmDeactivate.id}`, { method: 'DELETE' });
            if (res.ok) {
                // Remove from current list (since we're filtering by ACTIVE)
                setOwners(prev => prev.filter(o => o.id !== confirmDeactivate.id));
                showToast('success', 'ปิดการใช้งานลูกค้าสำเร็จ');
            } else {
                const err = await res.json();
                showToast('error', err.error || 'ไม่สามารถปิดการใช้งานได้');
            }
        } catch (error) {
            console.error('Error deactivating owner:', error);
            showToast('error', 'เกิดข้อผิดพลาด');
        } finally {
            setConfirmDeactivate(null);
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
                body: JSON.stringify({ ownerId, licensePlate: newTruckPlate.trim() }),
            });

            if (res.ok) {
                const newTruck = await res.json();
                setOwners(prev => prev.map(o => {
                    if (o.id === ownerId) {
                        return {
                            ...o,
                            trucks: [...o.trucks, newTruck],
                            _count: { ...o._count, trucks: o._count.trucks + 1 }
                        };
                    }
                    return o;
                }));
                setAddingTruckForOwner(null);
                setNewTruckPlate('');
                showToast('success', 'เพิ่มรถสำเร็จ');
            } else {
                const err = await res.json();
                showToast('error', err.error || 'ไม่สามารถเพิ่มรถได้');
            }
        } catch (error) {
            console.error('Error adding truck:', error);
            showToast('error', 'เกิดข้อผิดพลาด');
        } finally {
            setSaving(false);
        }
    };

    // Filter owners
    const filteredOwners = useMemo(() => {
        return owners.filter(o => {
            const searchLower = search.toLowerCase();
            const matchesSearch = o.name.toLowerCase().includes(searchLower) ||
                o.phone?.includes(search) ||
                o.code?.toLowerCase().includes(searchLower) ||
                o.trucks.some(t => t.licensePlate.toLowerCase().includes(searchLower));
            const matchesGroup = filterGroup === 'all' || o.groupType === filterGroup;
            return matchesSearch && matchesGroup;
        });
    }, [owners, search, filterGroup]);

    // Reset page when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [search, filterGroup, filterStatus]);

    // Pagination
    const totalPages = Math.ceil(filteredOwners.length / ITEMS_PER_PAGE);
    const paginatedOwners = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredOwners.slice(start, start + ITEMS_PER_PAGE);
    }, [filteredOwners, currentPage]);

    // Stats
    const stats = useMemo(() => ({
        total: filteredOwners.length,
        trucks: filteredOwners.reduce((sum, o) => sum + o._count.trucks, 0),
        withBalance: filteredOwners.filter(o => o.balance > 0).length,
        totalBalance: filteredOwners.reduce((sum, o) => sum + o.balance, 0)
    }), [filteredOwners]);

    const getGroupLabel = (groupType: string) => {
        return OWNER_GROUPS.find(g => g.value === groupType)?.label || groupType;
    };

    const getGroupColor = (groupType: string) => {
        const colors: Record<string, { bg: string; border: string; text: string }> = {
            'SUGAR_FACTORY': { bg: 'from-green-500/20 to-emerald-500/20', border: 'border-green-500/30', text: 'text-green-400' },
            'GENERAL_CREDIT': { bg: 'from-blue-500/20 to-cyan-500/20', border: 'border-blue-500/30', text: 'text-blue-400' },
            'BOX_TRUCK': { bg: 'from-purple-500/20 to-pink-500/20', border: 'border-purple-500/30', text: 'text-purple-400' },
            'OIL_TRUCK': { bg: 'from-orange-500/20 to-yellow-500/20', border: 'border-orange-500/30', text: 'text-orange-400' },
        };
        return colors[groupType] || colors['GENERAL_CREDIT'];
    };

    const getStatusBadge = (status: string) => {
        const badges: Record<string, { icon: React.ReactNode; text: string; className: string }> = {
            'ACTIVE': { icon: <CheckCircle size={12} />, text: 'ใช้งาน', className: 'bg-green-500/20 text-green-400' },
            'INACTIVE': { icon: <XCircle size={12} />, text: 'ปิดใช้งาน', className: 'bg-gray-500/20 text-gray-400' },
            'SUSPENDED': { icon: <Ban size={12} />, text: 'ระงับ', className: 'bg-red-500/20 text-red-400' },
        };
        return badges[status] || badges['ACTIVE'];
    };

    const formatMoney = (n: number) => n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    return (
        <Sidebar>
            <div className="max-w-6xl mx-auto relative">
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
                                {stats.total} ราย • {stats.trucks} คัน
                                {stats.totalBalance > 0 && (
                                    <span className="text-yellow-400">• ค้าง ฿{formatMoney(stats.totalBalance)}</span>
                                )}
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

                {/* Status Filter Chips */}
                <div className={`flex flex-wrap gap-2 mb-4 transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                    {(['ACTIVE', 'INACTIVE', 'ALL'] as StatusFilter[]).map((status) => {
                        const labels: Record<StatusFilter, string> = {
                            'ALL': 'ทั้งหมด',
                            'ACTIVE': 'ใช้งาน',
                            'INACTIVE': 'ปิดใช้งาน',
                            'SUSPENDED': 'ระงับ'
                        };
                        const icons: Record<StatusFilter, React.ReactNode> = {
                            'ALL': <Users size={14} />,
                            'ACTIVE': <CheckCircle size={14} />,
                            'INACTIVE': <XCircle size={14} />,
                            'SUSPENDED': <Ban size={14} />
                        };
                        return (
                            <button
                                key={status}
                                onClick={() => setFilterStatus(status)}
                                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${filterStatus === status
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-white/5 text-gray-400 hover:bg-white/10'
                                    }`}
                            >
                                {icons[status]}
                                {labels[status]}
                            </button>
                        );
                    })}
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
                        <div className="relative">
                            <select
                                value={filterGroup}
                                onChange={(e) => setFilterGroup(e.target.value)}
                                className="appearance-none px-4 py-3 pr-10 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-blue-500/50 transition-all cursor-pointer"
                            >
                                <option value="all" className="bg-gray-900">ทุกกลุ่ม</option>
                                {OWNER_GROUPS.map(g => (
                                    <option key={g.value} value={g.value} className="bg-gray-900">{g.label}</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
                        </div>
                    </div>
                </div>

                {/* Owner List */}
                {loading ? (
                    <LoadingState />
                ) : filteredOwners.length === 0 ? (
                    <div className="text-center py-12 text-gray-400">
                        {search || filterGroup !== 'all' ? 'ไม่พบข้อมูลที่ค้นหา' : 'ยังไม่มีลูกค้าในระบบ'}
                    </div>
                ) : (
                    <div className="space-y-3">
                        {paginatedOwners.map((owner, index) => {
                            const isExpanded = expandedIds.has(owner.id);
                            const color = getGroupColor(owner.groupType);
                            const statusBadge = getStatusBadge(owner.status || 'ACTIVE');

                            return (
                                <div
                                    key={owner.id}
                                    className={`backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
                                    style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)', transitionDelay: `${index * 30}ms` }}
                                >
                                    {/* Main Row */}
                                    <div
                                        className="p-4 flex items-center gap-4 cursor-pointer hover:bg-white/5 transition-colors"
                                        onClick={() => toggleExpand(owner.id)}
                                    >
                                        {/* Expand Arrow */}
                                        <ChevronDown
                                            size={20}
                                            className={`text-gray-400 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
                                        />

                                        {/* Avatar */}
                                        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${color.bg} border ${color.border} flex items-center justify-center font-bold text-white text-lg`}>
                                            {owner.name.charAt(0)}
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                {owner.code && (
                                                    <span className="text-blue-400 font-mono text-sm">[{owner.code}]</span>
                                                )}
                                                <span className="font-medium text-white truncate">{owner.name}</span>
                                                {/* Status Badge */}
                                                <span className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs ${statusBadge.className}`}>
                                                    {statusBadge.icon}
                                                    {statusBadge.text}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-3 text-sm text-gray-400 mt-1">
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
                                        <div className="flex items-center gap-6 text-sm">
                                            <div className="text-center">
                                                <div className="flex items-center gap-1 text-cyan-400 font-mono">
                                                    <Truck size={16} />
                                                    <span className="font-bold">{owner._count.trucks}</span>
                                                </div>
                                                <span className="text-xs text-gray-500">รถ</span>
                                            </div>
                                            {(owner.balance > 0 || owner.creditLimit) && (
                                                <div className="text-center">
                                                    <div className={`font-mono font-bold ${owner.balance > 0 ? 'text-yellow-400' : 'text-gray-500'}`}>
                                                        ฿{formatMoney(owner.balance)}
                                                    </div>
                                                    <span className="text-xs text-gray-500">ยอดค้าง</span>
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
                                            {owner.status === 'ACTIVE' && (
                                                <button
                                                    onClick={() => setConfirmDeactivate(owner)}
                                                    className="p-2 rounded-lg bg-gray-500/20 hover:bg-gray-500/30 text-gray-400 transition-colors"
                                                    title="ปิดการใช้งาน"
                                                >
                                                    <Power size={16} />
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Expanded Content */}
                                    {isExpanded && (
                                        <div className="border-t border-white/10 p-4 bg-white/5">
                                            <div className="flex flex-wrap gap-2 items-center">
                                                <span className="text-sm text-gray-400 mr-2">รถ ({owner.trucks.length}):</span>
                                                {owner.trucks.map(truck => (
                                                    <span key={truck.id} className="px-3 py-1.5 bg-white/10 rounded-lg text-sm text-white font-mono">
                                                        🚛 {truck.licensePlate}
                                                    </span>
                                                ))}
                                                {addingTruckForOwner === owner.id ? (
                                                    <div className="flex items-center gap-2">
                                                        <input
                                                            type="text"
                                                            placeholder="ทะเบียนรถ..."
                                                            value={newTruckPlate}
                                                            onChange={e => setNewTruckPlate(e.target.value)}
                                                            className="px-3 py-1.5 bg-white/10 border border-white/20 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500"
                                                            autoFocus
                                                        />
                                                        <button
                                                            onClick={() => handleAddTruck(owner.id)}
                                                            disabled={saving}
                                                            className="px-3 py-1.5 bg-green-500 text-white rounded-lg text-sm hover:bg-green-600 disabled:opacity-50"
                                                        >
                                                            เพิ่ม
                                                        </button>
                                                        <button
                                                            onClick={() => { setAddingTruckForOwner(null); setNewTruckPlate(''); }}
                                                            className="p-1.5 text-gray-400 hover:text-white"
                                                        >
                                                            <X size={16} />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => setAddingTruckForOwner(owner.id)}
                                                        className="flex items-center gap-1 px-3 py-1.5 border border-dashed border-white/30 rounded-lg text-sm text-gray-400 hover:text-white hover:border-white/50 transition-colors"
                                                    >
                                                        <Plus size={14} />
                                                        เพิ่มรถ
                                                    </button>
                                                )}
                                            </div>
                                            {owner._count.transactions > 0 && (
                                                <p className="text-xs text-gray-500 mt-2">
                                                    ประวัติธุรกรรม: {owner._count.transactions.toLocaleString()} รายการ
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-6 p-4 backdrop-blur-xl rounded-2xl border border-white/10"
                        style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)' }}>
                        <span className="text-gray-400 text-sm">
                            แสดง {((currentPage - 1) * ITEMS_PER_PAGE) + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, filteredOwners.length)} จาก {filteredOwners.length} ราย
                        </span>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/10"
                            >
                                ก่อนหน้า
                            </button>
                            <span className="text-white font-medium px-4">
                                {currentPage} / {totalPages}
                            </span>
                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/10"
                            >
                                ถัดไป
                            </button>
                        </div>
                    </div>
                )}

                {/* =============== ADD OWNER MODAL =============== */}
                {showAddModal && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <div className="bg-gray-900 rounded-2xl border border-white/10 w-full max-w-md p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-xl font-bold text-white">เพิ่มลูกค้าใหม่</h3>
                                <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-white">
                                    <X size={24} />
                                </button>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm text-gray-400 mb-2">ชื่อลูกค้า *</label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-blue-500"
                                        placeholder="ชื่อบริษัท หรือ ชื่อบุคคล"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-2">เบอร์โทร</label>
                                    <input
                                        type="text"
                                        value={formData.phone}
                                        onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))}
                                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-blue-500"
                                        placeholder="081-xxx-xxxx"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-2">รหัส Vendor</label>
                                    <input
                                        type="text"
                                        value={formData.venderCode}
                                        onChange={e => setFormData(p => ({ ...p, venderCode: e.target.value }))}
                                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-blue-500"
                                        placeholder="รหัสจากระบบบัญชี"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-2">กลุ่มลูกค้า</label>
                                    <select
                                        value={formData.groupType}
                                        onChange={e => setFormData(p => ({ ...p, groupType: e.target.value }))}
                                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-blue-500"
                                    >
                                        {OWNER_GROUPS.map(g => (
                                            <option key={g.value} value={g.value} className="bg-gray-900">{g.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Duplicate Warning */}
                            {duplicates.length > 0 && (
                                <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                                    <div className="flex items-center gap-2 text-yellow-400 text-sm font-medium mb-2">
                                        <AlertTriangle size={16} />
                                        พบลูกค้าที่คล้ายกัน
                                    </div>
                                    <div className="space-y-2">
                                        {duplicates.map(dup => (
                                            <div key={dup.id} className="flex items-center justify-between text-sm bg-white/5 rounded-lg px-3 py-2">
                                                <div>
                                                    <span className="text-white">{dup.name}</span>
                                                    {dup.phone && <span className="text-gray-400 ml-2">({dup.phone})</span>}
                                                    {dup.code && <span className="text-blue-400 ml-2">[{dup.code}]</span>}
                                                </div>
                                                <span className={`text-xs px-2 py-0.5 rounded ${dup.status === 'ACTIVE' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
                                                    {dup.status === 'ACTIVE' ? 'ใช้งาน' : 'ปิดใช้งาน'}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                    <p className="text-xs text-yellow-400/70 mt-2">
                                        คุณยังสามารถเพิ่มลูกค้าใหม่ได้ หากต้องการ
                                    </p>
                                </div>
                            )}

                            <div className="flex gap-3 mt-6">
                                <button
                                    onClick={() => setShowAddModal(false)}
                                    className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white hover:bg-white/10 transition-colors"
                                >
                                    ยกเลิก
                                </button>
                                <button
                                    onClick={handleAddOwner}
                                    disabled={saving}
                                    className={`flex-1 px-4 py-3 rounded-xl text-white font-medium hover:opacity-90 disabled:opacity-50 ${duplicates.length > 0
                                            ? 'bg-gradient-to-r from-yellow-600 to-orange-500'
                                            : 'bg-gradient-to-r from-blue-500 to-cyan-500'
                                        }`}
                                >
                                    {saving ? 'กำลังบันทึก...' : duplicates.length > 0 ? 'เพิ่มต่อไป' : 'เพิ่มลูกค้า'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* =============== EDIT OWNER MODAL =============== */}
                {showEditModal && editingOwner && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <div className="bg-gray-900 rounded-2xl border border-white/10 w-full max-w-md p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-xl font-bold text-white">แก้ไขข้อมูลลูกค้า</h3>
                                <button onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-white">
                                    <X size={24} />
                                </button>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm text-gray-400 mb-2">ชื่อลูกค้า *</label>
                                    <input
                                        type="text"
                                        value={editFormData.name}
                                        onChange={e => setEditFormData(p => ({ ...p, name: e.target.value }))}
                                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-2">เบอร์โทร</label>
                                    <input
                                        type="text"
                                        value={editFormData.phone}
                                        onChange={e => setEditFormData(p => ({ ...p, phone: e.target.value }))}
                                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-2">รหัส Vendor</label>
                                    <input
                                        type="text"
                                        value={editFormData.venderCode}
                                        onChange={e => setEditFormData(p => ({ ...p, venderCode: e.target.value }))}
                                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-2">กลุ่มลูกค้า</label>
                                    <select
                                        value={editFormData.groupType}
                                        onChange={e => setEditFormData(p => ({ ...p, groupType: e.target.value }))}
                                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-blue-500"
                                    >
                                        {OWNER_GROUPS.map(g => (
                                            <option key={g.value} value={g.value} className="bg-gray-900">{g.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="flex gap-3 mt-6">
                                <button
                                    onClick={() => setShowEditModal(false)}
                                    className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white hover:bg-white/10 transition-colors"
                                >
                                    ยกเลิก
                                </button>
                                <button
                                    onClick={handleEditOwner}
                                    disabled={saving}
                                    className="flex-1 px-4 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-xl text-white font-medium hover:opacity-90 disabled:opacity-50"
                                >
                                    {saving ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* =============== DEACTIVATE CONFIRMATION MODAL =============== */}
                {confirmDeactivate && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <div className="bg-gray-900 rounded-2xl border border-white/10 w-full max-w-md p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-3 rounded-full bg-orange-500/20">
                                    <AlertTriangle className="text-orange-400" size={24} />
                                </div>
                                <h3 className="text-xl font-bold text-white">ปิดการใช้งานลูกค้า</h3>
                            </div>
                            <div className="mb-6">
                                <p className="text-gray-300 mb-2">
                                    คุณต้องการปิดการใช้งานลูกค้า <strong className="text-white">&quot;{confirmDeactivate.name}&quot;</strong> ใช่หรือไม่?
                                </p>
                                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 mt-3">
                                    <p className="text-blue-400 text-sm flex items-center gap-2">
                                        <CheckCircle size={16} />
                                        ข้อมูลจะยังคงอยู่ในระบบ ไม่ถูกลบ
                                    </p>
                                </div>
                                {confirmDeactivate._count.transactions > 0 && (
                                    <p className="text-gray-500 text-sm mt-2">
                                        ลูกค้านี้มีประวัติธุรกรรม {confirmDeactivate._count.transactions.toLocaleString()} รายการ
                                    </p>
                                )}
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setConfirmDeactivate(null)}
                                    className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white hover:bg-white/10 transition-colors"
                                >
                                    ยกเลิก
                                </button>
                                <button
                                    onClick={handleDeactivateOwner}
                                    className="flex-1 px-4 py-3 bg-gradient-to-r from-orange-500 to-red-500 rounded-xl text-white font-medium hover:opacity-90"
                                >
                                    <span className="flex items-center justify-center gap-2">
                                        <Power size={18} />
                                        ปิดการใช้งาน
                                    </span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </Sidebar>
    );
}
