'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
    LayoutDashboard,
    FileText,
    Calculator,
    Gauge,
    Scale,
    Settings,
    ChevronLeft,
    Menu,
    X
} from 'lucide-react';

export default function AdminGasLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const [menuOpen, setMenuOpen] = useState(false);

    const navItems = [
        { href: '/admin/gas', icon: LayoutDashboard, label: 'Dashboard', exact: true },
        { href: '/admin/gas/reports/daily', icon: FileText, label: 'รายงานรายวัน' },
        { href: '/admin/gas/reports/shift', icon: FileText, label: 'รายงานตามกะ' },
        { href: '/admin/gas/reports/meters', icon: Calculator, label: 'รายงานมิเตอร์' },
        { href: '/admin/gas/gauge', icon: Gauge, label: 'ประวัติเกจ' },
        { href: '/admin/gas/reconciliation', icon: Scale, label: 'กระทบยอด' },
        { href: '/admin/gas/settings', icon: Settings, label: 'ตั้งค่า' },
    ];

    const isActive = (href: string, exact?: boolean) => {
        if (exact) return pathname === href;
        return pathname.startsWith(href);
    };

    return (
        <div className="min-h-screen bg-[#0a0a0f] text-white">
            {/* Header */}
            <header className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-purple-700 to-indigo-700 shadow-lg">
                <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                        <Link
                            href="/dashboard"
                            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                        >
                            <ChevronLeft size={24} />
                        </Link>
                        <div>
                            <h1 className="font-bold text-lg">⛽ Gas Control Center</h1>
                            <p className="text-sm text-white/70">ศูนย์ควบคุมปั๊มแก๊ส</p>
                        </div>
                    </div>

                    <button
                        onClick={() => setMenuOpen(!menuOpen)}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors lg:hidden"
                    >
                        {menuOpen ? <X size={24} /> : <Menu size={24} />}
                    </button>
                </div>
            </header>

            {/* Mobile Menu Overlay */}
            {menuOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/50 lg:hidden"
                    onClick={() => setMenuOpen(false)}
                />
            )}

            {/* Sidebar - Desktop */}
            <aside className="fixed top-16 left-0 bottom-0 w-64 bg-[#1a1a24] border-r border-white/10 hidden lg:block overflow-y-auto">
                <nav className="p-4">
                    {navItems.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center gap-3 px-4 py-3 rounded-lg mb-2 transition-colors ${isActive(item.href, item.exact)
                                ? 'bg-purple-600 text-white'
                                : 'text-gray-400 hover:bg-white/10 hover:text-white'
                                }`}
                        >
                            <item.icon size={20} />
                            <span>{item.label}</span>
                        </Link>
                    ))}
                </nav>
            </aside>

            {/* Mobile Menu */}
            <nav className={`fixed top-0 right-0 z-50 h-full w-64 bg-[#1a1a24] transform transition-transform duration-300 lg:hidden ${menuOpen ? 'translate-x-0' : 'translate-x-full'
                }`}>
                <div className="pt-20 px-4">
                    {navItems.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setMenuOpen(false)}
                            className={`flex items-center gap-3 px-4 py-3 rounded-lg mb-2 transition-colors ${isActive(item.href, item.exact)
                                ? 'bg-purple-600 text-white'
                                : 'text-gray-400 hover:bg-white/10'
                                }`}
                        >
                            <item.icon size={20} />
                            <span>{item.label}</span>
                        </Link>
                    ))}
                </div>
            </nav>

            {/* Main Content */}
            <main className="pt-20 lg:pl-64 min-h-screen">
                <div className="p-4 lg:p-6 max-w-7xl mx-auto">
                    {children}
                </div>
            </main>
        </div>
    );
}
