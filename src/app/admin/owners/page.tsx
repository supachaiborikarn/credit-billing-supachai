'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Search, Merge, Users, Truck, FileText, Trash2, AlertTriangle } from 'lucide-react';

interface Owner {
    id: string;
    name: string;
    code: string | null;
    phone: string | null;
    groupType: string;
    _count: {
        trucks: number;
        transactions: number;
    };
}

export default function AdminOwnersPage() {
    const router = useRouter();
    const [owners, setOwners] = useState<Owner[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedOwners, setSelectedOwners] = useState<string[]>([]);
    const [merging, setMerging] = useState(false);
    const [showMergeModal, setShowMergeModal] = useState(false);
    const [mergeResult, setMergeResult] = useState<string | null>(null);

    const fetchOwners = useCallback(async () => {
        try {
            const res = await fetch('/api/owners');
            if (res.ok) {
                const data = await res.json();
                // Add transaction count if not present
                const ownersWithFullCount = await Promise.all(
                    data.map(async (owner: Owner) => {
                        if (owner._count.transactions === undefined) {
                            const txRes = await fetch(`/api/owners/${owner.id}/stats`);
                            if (txRes.ok) {
                                const stats = await txRes.json();
                                return { ...owner, _count: { ...owner._count, transactions: stats.transactionCount || 0 } };
                            }
                        }
                        return owner;
                    })
                );
                setOwners(ownersWithFullCount);
            }
        } catch (error) {
            console.error('Failed to fetch owners:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchOwners();
    }, [fetchOwners]);

    const filteredOwners = owners.filter(owner =>
        owner.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        owner.code?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const toggleSelectOwner = (id: string) => {
        if (selectedOwners.includes(id)) {
            setSelectedOwners(selectedOwners.filter(o => o !== id));
        } else if (selectedOwners.length < 2) {
            setSelectedOwners([...selectedOwners, id]);
        }
    };

    const handleMerge = async () => {
        if (selectedOwners.length !== 2) return;

        const [sourceId, targetId] = selectedOwners;
        setMerging(true);
        setMergeResult(null);

        try {
            const res = await fetch('/api/admin/owners/merge', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sourceOwnerId: sourceId, targetOwnerId: targetId })
            });

            const data = await res.json();

            if (res.ok) {
                setMergeResult(`✅ ${data.message} (${data.trucksMoved} trucks, ${data.transactionsMoved} transactions moved)`);
                setSelectedOwners([]);
                setShowMergeModal(false);
                fetchOwners(); // Refresh list
            } else {
                setMergeResult(`❌ ${data.error}`);
            }
        } catch (error) {
            setMergeResult('❌ Failed to merge owners');
            console.error('Merge error:', error);
        } finally {
            setMerging(false);
        }
    };

    const getSelectedOwnerDetails = () => {
        return selectedOwners.map(id => owners.find(o => o.id === id)).filter(Boolean) as Owner[];
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900 p-4 md:p-6">
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
                <button onClick={() => router.back()} className="btn btn-ghost">
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Users className="text-purple-400" />
                        จัดการเจ้าของ
                    </h1>
                    <p className="text-gray-400 text-sm">ค้นหา, ดู และรวมเจ้าของที่ซ้ำกัน</p>
                </div>
            </div>

            {/* Search & Actions */}
            <div className="glass-card p-4 mb-6">
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="relative flex-1">
                        <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="ค้นหาชื่อเจ้าของหรือ C-Code..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="input pl-10 w-full"
                        />
                    </div>
                    {selectedOwners.length === 2 && (
                        <button
                            onClick={() => setShowMergeModal(true)}
                            className="btn btn-warning flex items-center gap-2"
                        >
                            <Merge size={18} />
                            รวมเจ้าของที่เลือก ({selectedOwners.length})
                        </button>
                    )}
                </div>
                {selectedOwners.length > 0 && selectedOwners.length < 2 && (
                    <p className="text-yellow-400 text-sm mt-2">
                        เลือกเจ้าของอีก {2 - selectedOwners.length} คนเพื่อรวม
                    </p>
                )}
            </div>

            {/* Merge Result */}
            {mergeResult && (
                <div className={`p-4 rounded-lg mb-6 ${mergeResult.startsWith('✅') ? 'bg-green-500/20 border border-green-500/50' : 'bg-red-500/20 border border-red-500/50'}`}>
                    {mergeResult}
                </div>
            )}

            {/* Owners List */}
            {loading ? (
                <div className="flex justify-center py-12">
                    <div className="spinner w-8 h-8" />
                </div>
            ) : (
                <div className="glass-card overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-800/50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-gray-400 text-sm">เลือก</th>
                                    <th className="px-4 py-3 text-left text-gray-400 text-sm">ชื่อเจ้าของ</th>
                                    <th className="px-4 py-3 text-left text-gray-400 text-sm">C-Code</th>
                                    <th className="px-4 py-3 text-center text-gray-400 text-sm">
                                        <Truck size={14} className="inline mr-1" />ทะเบียน
                                    </th>
                                    <th className="px-4 py-3 text-center text-gray-400 text-sm">
                                        <FileText size={14} className="inline mr-1" />รายการ
                                    </th>
                                    <th className="px-4 py-3 text-left text-gray-400 text-sm">กลุ่ม</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredOwners.map((owner) => (
                                    <tr
                                        key={owner.id}
                                        className={`border-t border-white/10 hover:bg-white/5 cursor-pointer ${selectedOwners.includes(owner.id) ? 'bg-purple-500/20' : ''}`}
                                        onClick={() => toggleSelectOwner(owner.id)}
                                    >
                                        <td className="px-4 py-3">
                                            <input
                                                type="checkbox"
                                                checked={selectedOwners.includes(owner.id)}
                                                onChange={() => toggleSelectOwner(owner.id)}
                                                className="w-4 h-4 accent-purple-500"
                                            />
                                        </td>
                                        <td className="px-4 py-3 text-white font-medium">{owner.name}</td>
                                        <td className="px-4 py-3 text-cyan-400 font-mono">{owner.code || '-'}</td>
                                        <td className="px-4 py-3 text-center text-gray-300">{owner._count.trucks}</td>
                                        <td className="px-4 py-3 text-center text-gray-300">{owner._count.transactions || 0}</td>
                                        <td className="px-4 py-3 text-gray-400 text-sm">{owner.groupType}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="px-4 py-3 bg-slate-800/30 text-gray-400 text-sm">
                        แสดง {filteredOwners.length} จาก {owners.length} เจ้าของ
                    </div>
                </div>
            )}

            {/* Merge Confirmation Modal */}
            {showMergeModal && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 rounded-xl max-w-md w-full p-6 border border-white/20">
                        <div className="flex items-center gap-3 mb-4">
                            <AlertTriangle className="text-yellow-400" size={24} />
                            <h2 className="text-xl font-bold text-white">ยืนยันการรวมเจ้าของ</h2>
                        </div>

                        {getSelectedOwnerDetails().length === 2 && (
                            <div className="space-y-4 mb-6">
                                <div className="bg-red-500/20 p-3 rounded-lg border border-red-500/30">
                                    <p className="text-sm text-red-300 mb-1">จะถูกลบ:</p>
                                    <p className="text-white font-medium flex items-center gap-2">
                                        <Trash2 size={16} className="text-red-400" />
                                        {getSelectedOwnerDetails()[0].name}
                                    </p>
                                    <p className="text-gray-400 text-sm">
                                        {getSelectedOwnerDetails()[0]._count.trucks} ทะเบียน, {getSelectedOwnerDetails()[0]._count.transactions || 0} รายการ
                                    </p>
                                </div>
                                <div className="text-center text-gray-400">↓ ย้ายข้อมูลไปที่ ↓</div>
                                <div className="bg-green-500/20 p-3 rounded-lg border border-green-500/30">
                                    <p className="text-sm text-green-300 mb-1">จะเก็บไว้:</p>
                                    <p className="text-white font-medium flex items-center gap-2">
                                        <Users size={16} className="text-green-400" />
                                        {getSelectedOwnerDetails()[1].name}
                                    </p>
                                    <p className="text-gray-400 text-sm">
                                        {getSelectedOwnerDetails()[1]._count.trucks} ทะเบียน, {getSelectedOwnerDetails()[1]._count.transactions || 0} รายการ
                                    </p>
                                </div>
                            </div>
                        )}

                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowMergeModal(false)}
                                className="flex-1 btn btn-ghost"
                                disabled={merging}
                            >
                                ยกเลิก
                            </button>
                            <button
                                onClick={handleMerge}
                                className="flex-1 btn btn-warning"
                                disabled={merging}
                            >
                                {merging ? (
                                    <><div className="spinner w-4 h-4" /> กำลังรวม...</>
                                ) : (
                                    <><Merge size={18} /> ยืนยันการรวม</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
