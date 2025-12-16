'use client';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import { Users, Plus, Pencil, Trash2, Search, Shield, User as UserIcon, X, Sparkles } from 'lucide-react';

interface User {
    id: string;
    username: string;
    fullName: string;
    role: string;
    station: { id: string; name: string } | null;
    createdAt: string;
}

export default function UsersPage() {
    const [loading, setLoading] = useState(true);
    const [users, setUsers] = useState<User[]>([]);
    const [search, setSearch] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [mounted, setMounted] = useState(false);

    // Form state
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [role, setRole] = useState('STAFF');
    const [stationId, setStationId] = useState('');
    const [stations, setStations] = useState<{ id: string; name: string }[]>([]);

    useEffect(() => {
        setMounted(true);
        fetchUsers();
        fetchStations();
    }, []);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/users');
            if (res.ok) {
                const data = await res.json();
                setUsers(data);
            }
        } catch (error) {
            console.error('Error fetching users:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchStations = async () => {
        try {
            const res = await fetch('/api/stations');
            if (res.ok) {
                const data = await res.json();
                setStations(data);
            }
        } catch (error) {
            console.error('Error fetching stations:', error);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const url = editingUser ? `/api/users/${editingUser.id}` : '/api/users';
            const method = editingUser ? 'PUT' : 'POST';

            const body: any = { username, fullName, role };
            if (password) body.password = password;
            if (stationId) body.stationId = stationId;

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            if (res.ok) {
                setShowForm(false);
                resetForm();
                fetchUsers();
            } else {
                const data = await res.json();
                alert(data.error || 'ไม่สามารถบันทึกได้');
            }
        } catch (error) {
            console.error('Error saving user:', error);
        }
    };

    const handleEdit = (user: User) => {
        setEditingUser(user);
        setUsername(user.username);
        setFullName(user.fullName);
        setRole(user.role);
        setStationId(user.station?.id || '');
        setPassword('');
        setShowForm(true);
    };

    const handleDelete = async (userId: string) => {
        if (!confirm('ยืนยันการลบผู้ใช้นี้?')) return;
        try {
            const res = await fetch(`/api/users/${userId}`, { method: 'DELETE' });
            if (res.ok) {
                fetchUsers();
            }
        } catch (error) {
            console.error('Error deleting user:', error);
        }
    };

    const resetForm = () => {
        setEditingUser(null);
        setUsername('');
        setPassword('');
        setFullName('');
        setRole('STAFF');
        setStationId('');
    };

    const filteredUsers = users.filter(u =>
        u.username.toLowerCase().includes(search.toLowerCase()) ||
        u.fullName.toLowerCase().includes(search.toLowerCase())
    );

    const getRoleStyle = (role: string) => {
        switch (role) {
            case 'ADMIN': return { bg: 'from-purple-500/20 to-pink-500/20', border: 'border-purple-500/30', text: 'text-purple-400', icon: '👑' };
            case 'MANAGER': return { bg: 'from-blue-500/20 to-cyan-500/20', border: 'border-blue-500/30', text: 'text-blue-400', icon: '🔷' };
            default: return { bg: 'from-green-500/20 to-emerald-500/20', border: 'border-green-500/30', text: 'text-green-400', icon: '👤' };
        }
    };

    const getRoleLabel = (role: string) => {
        switch (role) {
            case 'ADMIN': return 'ผู้ดูแลระบบ';
            case 'MANAGER': return 'ผู้จัดการ';
            default: return 'พนักงาน';
        }
    };

    return (
        <Sidebar>
            <div className="max-w-5xl mx-auto relative">
                {/* Background orbs */}
                <div className="fixed top-20 right-20 w-[400px] h-[400px] rounded-full opacity-20 blur-3xl pointer-events-none"
                    style={{ background: 'radial-gradient(circle, rgba(139, 92, 246, 0.3) 0%, transparent 70%)' }} />

                {/* Header */}
                <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-500">
                            <Users className="text-white" size={28} />
                        </div>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-white via-purple-200 to-white bg-clip-text text-transparent">
                                จัดการผู้ใช้งาน
                            </h1>
                            <p className="text-gray-400 flex items-center gap-2">
                                <Sparkles size={14} className="text-purple-400" />
                                เพิ่ม แก้ไข ลบ ผู้ใช้งานระบบ
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => { resetForm(); setShowForm(true); }}
                        className="relative group px-6 py-3 rounded-xl font-semibold text-white overflow-hidden"
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-violet-600 via-purple-500 to-violet-600" />
                        <div className="absolute inset-0 bg-gradient-to-r from-violet-600 via-purple-500 to-violet-600 blur-xl opacity-50 group-hover:opacity-70 transition-opacity" />
                        <span className="relative flex items-center gap-2">
                            <Plus size={18} />
                            เพิ่มผู้ใช้ใหม่
                        </span>
                    </button>
                </div>

                {/* Form Modal */}
                {showForm && (
                    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <div className="relative w-full max-w-lg animate-fade-in">
                            <div className="absolute -inset-1 bg-gradient-to-r from-violet-600 via-purple-500 to-violet-600 rounded-3xl blur-xl opacity-30" />
                            <div className="relative backdrop-blur-2xl rounded-2xl border border-white/10 p-6"
                                style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)' }}>
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500">
                                            {editingUser ? <Pencil className="text-white" size={20} /> : <Plus className="text-white" size={20} />}
                                        </div>
                                        <h3 className="text-lg font-bold text-white">
                                            {editingUser ? 'แก้ไขผู้ใช้' : 'เพิ่มผู้ใช้ใหม่'}
                                        </h3>
                                    </div>
                                    <button onClick={() => { setShowForm(false); resetForm(); }} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                                        <X size={20} className="text-gray-400" />
                                    </button>
                                </div>
                                <form onSubmit={handleSubmit}>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm text-gray-400 mb-2">ชื่อผู้ใช้ (Username)</label>
                                            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)}
                                                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50 transition-all duration-300"
                                                required disabled={!!editingUser} />
                                        </div>
                                        <div>
                                            <label className="block text-sm text-gray-400 mb-2">รหัสผ่าน {editingUser && '(เว้นว่างถ้าไม่เปลี่ยน)'}</label>
                                            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                                                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50 transition-all duration-300"
                                                required={!editingUser} />
                                        </div>
                                        <div>
                                            <label className="block text-sm text-gray-400 mb-2">ชื่อ-นามสกุล</label>
                                            <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)}
                                                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50 transition-all duration-300"
                                                required />
                                        </div>
                                        <div>
                                            <label className="block text-sm text-gray-400 mb-2">ตำแหน่ง</label>
                                            <select value={role} onChange={(e) => setRole(e.target.value)}
                                                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50 transition-all duration-300">
                                                <option value="STAFF">พนักงาน</option>
                                                <option value="MANAGER">ผู้จัดการ</option>
                                                <option value="ADMIN">ผู้ดูแลระบบ</option>
                                            </select>
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="block text-sm text-gray-400 mb-2">สถานีประจำ</label>
                                            <select value={stationId} onChange={(e) => setStationId(e.target.value)}
                                                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50 transition-all duration-300">
                                                <option value="">-- ทุกสถานี --</option>
                                                {stations.map(s => (<option key={s.id} value={s.id}>{s.name}</option>))}
                                            </select>
                                        </div>
                                    </div>
                                    <div className="flex gap-3 mt-6">
                                        <button type="submit" className="flex-1 relative group px-6 py-3 rounded-xl font-semibold text-white overflow-hidden">
                                            <div className="absolute inset-0 bg-gradient-to-r from-green-600 via-emerald-500 to-green-600" />
                                            <span className="relative">{editingUser ? 'บันทึกการแก้ไข' : 'เพิ่มผู้ใช้'}</span>
                                        </button>
                                        <button type="button" onClick={() => { setShowForm(false); resetForm(); }}
                                            className="px-6 py-3 rounded-xl font-medium text-gray-300 bg-white/5 hover:bg-white/10 transition-colors">ยกเลิก</button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                )}

                {/* Search */}
                <div className={`backdrop-blur-xl rounded-2xl border border-white/10 p-4 mb-6 transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
                    style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)', transitionDelay: '100ms' }}>
                    <div className="relative group">
                        <div className="absolute -inset-0.5 bg-gradient-to-r from-violet-600 to-purple-600 rounded-xl opacity-0 group-focus-within:opacity-30 blur transition-all duration-300" />
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                        <input type="text" placeholder="ค้นหาชื่อผู้ใช้..." value={search} onChange={(e) => setSearch(e.target.value)}
                            className="relative w-full pl-12 pr-4 py-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 transition-all duration-300" />
                    </div>
                </div>

                {/* Users Table */}
                <div className={`backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
                    style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)', transitionDelay: '200ms' }}>
                    {loading ? (
                        <div className="flex items-center justify-center h-64">
                            <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-white/10">
                                        <th className="text-left p-4 text-sm font-medium text-gray-400">ชื่อผู้ใช้</th>
                                        <th className="text-left p-4 text-sm font-medium text-gray-400">ชื่อ-นามสกุล</th>
                                        <th className="text-left p-4 text-sm font-medium text-gray-400">ตำแหน่ง</th>
                                        <th className="text-left p-4 text-sm font-medium text-gray-400">สถานี</th>
                                        <th className="text-left p-4 text-sm font-medium text-gray-400">จัดการ</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredUsers.length === 0 ? (
                                        <tr><td colSpan={5} className="text-center py-12 text-gray-400">ไม่พบผู้ใช้</td></tr>
                                    ) : (
                                        filteredUsers.map(user => {
                                            const style = getRoleStyle(user.role);
                                            return (
                                                <tr key={user.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                                    <td className="p-4 font-mono text-blue-400">{user.username}</td>
                                                    <td className="p-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center text-white font-bold">
                                                                {user.fullName.charAt(0)}
                                                            </div>
                                                            <span className="font-medium text-white">{user.fullName}</span>
                                                        </div>
                                                    </td>
                                                    <td className="p-4">
                                                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-gradient-to-r ${style.bg} ${style.text} border ${style.border}`}>
                                                            <span>{style.icon}</span>
                                                            {getRoleLabel(user.role)}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 text-gray-400">{user.station?.name || 'ทุกสถานี'}</td>
                                                    <td className="p-4">
                                                        <div className="flex gap-2">
                                                            <button onClick={() => handleEdit(user)} className="p-2 rounded-lg bg-white/5 hover:bg-blue-500/20 text-gray-400 hover:text-blue-400 transition-all">
                                                                <Pencil size={16} />
                                                            </button>
                                                            <button onClick={() => handleDelete(user.id)} className="p-2 rounded-lg bg-white/5 hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-all">
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </div>
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
        </Sidebar>
    );
}
