'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import {
    LayoutDashboard,
    Users,
    Truck,
    Fuel,
    FileText,
    Settings,
    LogOut,
    Menu,
    X,
    ChevronDown,
    Sun,
    Moon,
    Sparkles
} from 'lucide-react';
import { STATIONS } from '@/constants';
import { useTheme } from '@/components/ThemeProvider';

interface SidebarProps {
    children: React.ReactNode;
}

export default function Sidebar({ children }: SidebarProps) {
    const pathname = usePathname();
    const router = useRouter();
    const { theme, toggleTheme } = useTheme();
    const [user, setUser] = useState<{ name: string; role: string; stationId?: string } | null>(null);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isStationsOpen, setIsStationsOpen] = useState(true);

    useEffect(() => {
        fetchUser();
    }, []);

    const fetchUser = async () => {
        try {
            const res = await fetch('/api/auth/me');
            if (res.ok) {
                const data = await res.json();
                setUser(data.user);
            }
        } catch (error) {
            console.error('Error fetching user:', error);
        }
    };

    const handleLogout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        router.push('/login');
    };

    const isActive = (path: string) => pathname === path || pathname.startsWith(path + '/');

    const isAdmin = user?.role === 'ADMIN';

    const menuItems = [
        { href: '/dashboard', icon: LayoutDashboard, label: 'ภาพรวม', gradient: 'from-purple-500 to-pink-500' },
        { href: '/owners', icon: Users, label: 'รายชื่อเจ้าของ', gradient: 'from-blue-500 to-cyan-500' },
        { href: '/trucks', icon: Truck, label: 'รายชื่อรถ', gradient: 'from-green-500 to-emerald-500' },
        { href: '/reports', icon: FileText, label: 'รายงาน', gradient: 'from-orange-500 to-yellow-500' },
    ];

    const adminMenuItems = [
        { href: '/invoices', icon: FileText, label: 'วางบิล/ชำระเงิน', gradient: 'from-pink-500 to-rose-500' },
        { href: '/users', icon: Users, label: 'จัดการผู้ใช้', gradient: 'from-violet-500 to-purple-500' },
        { href: '/settings', icon: Settings, label: 'ตั้งค่า', gradient: 'from-gray-500 to-slate-500' },
    ];

    // Filter stations for staff - only show their assigned station
    const getStationPath = (station: typeof STATIONS[number], index: number) => {
        if (station.type === 'FULL') return `/station/${index + 1}`;
        if (station.type === 'GAS') return `/gas-station/${index + 1}`;
        return `/simple-station/${index + 1}`;
    };

    const getStationColors = (type: 'FULL' | 'SIMPLE' | 'GAS') => {
        const colors = {
            FULL: { dot: 'bg-purple-500', text: 'text-purple-400', bg: 'from-purple-500/20 to-pink-500/20' },
            GAS: { dot: 'bg-cyan-500', text: 'text-cyan-400', bg: 'from-cyan-500/20 to-blue-500/20' },
            SIMPLE: { dot: 'bg-orange-500', text: 'text-orange-400', bg: 'from-orange-500/20 to-yellow-500/20' },
        };
        return colors[type];
    };

    const visibleStations = isAdmin
        ? STATIONS
        : STATIONS.filter(s => s.id === user?.stationId);

    return (
        <div className="flex min-h-screen">
            {/* Mobile Header */}
            <div className="lg:hidden fixed top-0 left-0 right-0 z-50 backdrop-blur-xl border-b border-white/10 p-4"
                style={{ background: 'rgba(10, 10, 18, 0.95)' }}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500 to-cyan-500">
                            <Fuel className="text-white" size={20} />
                        </div>
                        <span className="font-bold bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">Credit Billing</span>
                    </div>
                    <button
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                        className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
                    >
                        {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                    </button>
                </div>
            </div>

            {/* Sidebar */}
            <aside className={`
                fixed lg:static inset-y-0 left-0 z-40
                w-72 backdrop-blur-2xl border-r border-white/10
                transform transition-all duration-300 ease-out
                ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
                pt-16 lg:pt-0
            `} style={{ background: 'linear-gradient(180deg, rgba(15, 15, 35, 0.98) 0%, rgba(10, 10, 18, 0.98) 100%)' }}>
                {/* Logo */}
                <div className="hidden lg:flex items-center gap-3 px-6 py-6 border-b border-white/10">
                    <div className="relative">
                        <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-cyan-500 rounded-2xl blur-lg opacity-50" />
                        <div className="relative p-3 rounded-2xl bg-gradient-to-br from-purple-500 to-cyan-500">
                            <Fuel className="text-white" size={28} />
                        </div>
                    </div>
                    <div>
                        <h1 className="font-bold text-lg bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent">
                            Credit Billing
                        </h1>
                        <p className="text-xs text-gray-500 flex items-center gap-1">
                            <Sparkles size={10} className="text-purple-400" />
                            Supachai Group
                        </p>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="p-4 space-y-2 max-h-[calc(100vh-200px)] overflow-y-auto">
                    {/* Main Menu - Admin only */}
                    {isAdmin && menuItems.map(item => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`group flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${isActive(item.href)
                                ? 'bg-gradient-to-r from-purple-500/20 to-cyan-500/20 border border-purple-500/30'
                                : 'hover:bg-white/5'
                                }`}
                            onClick={() => setIsMobileMenuOpen(false)}
                        >
                            <div className={`p-2 rounded-lg transition-all duration-300 ${isActive(item.href)
                                ? `bg-gradient-to-br ${item.gradient}`
                                : 'bg-white/5 group-hover:bg-white/10'
                                }`}>
                                <item.icon size={18} className={isActive(item.href) ? 'text-white' : 'text-gray-400 group-hover:text-white'} />
                            </div>
                            <span className={`font-medium transition-colors ${isActive(item.href) ? 'text-white' : 'text-gray-400 group-hover:text-white'}`}>
                                {item.label}
                            </span>
                        </Link>
                    ))}

                    {/* Stations Section */}
                    <div className="pt-4">
                        {isAdmin ? (
                            <>
                                <button
                                    onClick={() => setIsStationsOpen(!isStationsOpen)}
                                    className="flex items-center justify-between w-full px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                                >
                                    <span className="flex items-center gap-2">
                                        <Fuel size={16} />
                                        สถานี
                                    </span>
                                    <ChevronDown size={16} className={`transition-transform duration-300 ${isStationsOpen ? 'rotate-180' : ''}`} />
                                </button>

                                <div className={`overflow-hidden transition-all duration-300 ${isStationsOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
                                    <div className="ml-2 space-y-1 mt-2">
                                        {visibleStations.map((station, index) => {
                                            const stationPath = getStationPath(station, index);
                                            const isStationActive = isActive(`/station/${index + 1}`) ||
                                                isActive(`/simple-station/${index + 1}`) ||
                                                isActive(`/gas-station/${index + 1}`);
                                            const color = getStationColors(station.type);

                                            return (
                                                <Link
                                                    key={station.id}
                                                    href={stationPath}
                                                    className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm transition-all duration-300 ${isStationActive
                                                        ? `bg-gradient-to-r ${color.bg} border border-white/10`
                                                        : 'hover:bg-white/5'
                                                        }`}
                                                    onClick={() => setIsMobileMenuOpen(false)}
                                                >
                                                    <span className={`w-2.5 h-2.5 rounded-full ${color.dot} ${isStationActive ? 'ring-2 ring-white/30' : ''}`} />
                                                    <span className={`flex-1 ${isStationActive ? 'text-white font-medium' : 'text-gray-400'}`}>
                                                        {station.name}
                                                    </span>
                                                    {station.type === 'GAS' && <span className={`text-xs ${color.text}`}>แก๊ส</span>}
                                                </Link>
                                            );
                                        })}
                                    </div>
                                </div>
                            </>
                        ) : (
                            // Staff: Show only their assigned station directly
                            <div className="space-y-1">
                                <p className="px-4 py-2 text-xs text-gray-500 uppercase tracking-wider">สถานีของคุณ</p>
                                {visibleStations.map((station, index) => {
                                    const originalIndex = STATIONS.findIndex(s => s.id === station.id);
                                    const stationPath = getStationPath(station, originalIndex);
                                    const isStationActive = isActive(stationPath);
                                    const color = getStationColors(station.type);

                                    return (
                                        <Link
                                            key={station.id}
                                            href={stationPath}
                                            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all duration-300 ${isStationActive
                                                ? `bg-gradient-to-r ${color.bg} border border-white/10`
                                                : 'hover:bg-white/5'
                                                }`}
                                            onClick={() => setIsMobileMenuOpen(false)}
                                        >
                                            <span className={`w-3 h-3 rounded-full ${color.dot} ${isStationActive ? 'ring-2 ring-white/30' : ''}`} />
                                            <span className={`flex-1 ${isStationActive ? 'text-white font-medium' : 'text-gray-400'}`}>
                                                {station.name}
                                            </span>
                                            {station.type === 'GAS' && <span className={`text-xs ${color.text}`}>แก๊ส</span>}
                                        </Link>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Admin Menu */}
                    {isAdmin && (
                        <div className="pt-4 border-t border-white/10 mt-4">
                            <p className="px-4 py-2 text-xs text-gray-500 uppercase tracking-wider">Admin</p>
                            {adminMenuItems.map(item => (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`group flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${isActive(item.href)
                                        ? 'bg-gradient-to-r from-purple-500/20 to-cyan-500/20 border border-purple-500/30'
                                        : 'hover:bg-white/5'
                                        }`}
                                    onClick={() => setIsMobileMenuOpen(false)}
                                >
                                    <div className={`p-2 rounded-lg transition-all duration-300 ${isActive(item.href)
                                        ? `bg-gradient-to-br ${item.gradient}`
                                        : 'bg-white/5 group-hover:bg-white/10'
                                        }`}>
                                        <item.icon size={18} className={isActive(item.href) ? 'text-white' : 'text-gray-400 group-hover:text-white'} />
                                    </div>
                                    <span className={`font-medium transition-colors ${isActive(item.href) ? 'text-white' : 'text-gray-400 group-hover:text-white'}`}>
                                        {item.label}
                                    </span>
                                </Link>
                            ))}
                        </div>
                    )}
                </nav>

                {/* User Info */}
                <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-white/10 backdrop-blur-xl"
                    style={{ background: 'rgba(10, 10, 18, 0.9)' }}>
                    <div className="flex items-center justify-between mb-3">
                        <button
                            onClick={toggleTheme}
                            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 transition-all duration-300 text-sm group"
                            title={theme === 'dark' ? 'เปลี่ยนเป็น Light Mode' : 'เปลี่ยนเป็น Dark Mode'}
                        >
                            {theme === 'dark' ? (
                                <>
                                    <Sun size={16} className="text-yellow-400 group-hover:rotate-180 transition-transform duration-500" />
                                    <span className="text-gray-300">Light</span>
                                </>
                            ) : (
                                <>
                                    <Moon size={16} className="text-purple-400 group-hover:rotate-12 transition-transform duration-300" />
                                    <span className="text-gray-300">Dark</span>
                                </>
                            )}
                        </button>
                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-all duration-300 text-sm"
                        >
                            <LogOut size={16} />
                            <span>ออก</span>
                        </button>
                    </div>
                    {user && (
                        <div className="flex items-center gap-3 px-3 py-2 bg-white/5 rounded-xl">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center text-white font-bold">
                                {user.name.charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-white truncate">{user.name}</p>
                                <p className="text-xs text-gray-500">{user.role === 'ADMIN' ? 'ผู้ดูแลระบบ' : 'พนักงาน'}</p>
                            </div>
                        </div>
                    )}
                </div>
            </aside>

            {/* Mobile Overlay */}
            {isMobileMenuOpen && (
                <div
                    className="lg:hidden fixed inset-0 bg-black/60 z-30 backdrop-blur-sm"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            {/* Main Content */}
            <main className="flex-1 lg:ml-0 pt-16 lg:pt-0 min-h-screen">
                {children}
            </main>
        </div>
    );
}
