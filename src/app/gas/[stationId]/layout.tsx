'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
    Home,
    FuelIcon,
    Gauge,
    Calculator,
    ClipboardList,
    Clock,
    LogOut,
    ChevronLeft,
    Menu,
    X
} from 'lucide-react';

interface StationInfo {
    id: string;
    name: string;
    type: string;
}

interface ShiftInfo {
    id: string;
    shiftNumber: number;
    status: string;
    staffName: string | null;
    openedAt: string | null;
}

export default function GasStationLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const params = useParams();
    const router = useRouter();
    const pathname = usePathname();
    const stationId = params.stationId as string;

    const [station, setStation] = useState<StationInfo | null>(null);
    const [currentShift, setCurrentShift] = useState<ShiftInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [menuOpen, setMenuOpen] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch station info
                const stationRes = await fetch(`/api/v2/gas/${stationId}/info`);
                if (stationRes.ok) {
                    const data = await stationRes.json();
                    setStation(data.station);
                }

                // Fetch current shift
                const shiftRes = await fetch(`/api/v2/gas/${stationId}/shift/current`);
                if (shiftRes.ok) {
                    const data = await shiftRes.json();
                    setCurrentShift(data.shift);
                }
            } catch (error) {
                console.error('Error fetching station data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [stationId]);

    const navItems = [
        { href: `/gas/${stationId}`, icon: Home, label: 'หน้าหลัก', exact: true },
        { href: `/gas/${stationId}/sell`, icon: FuelIcon, label: 'บันทึกขาย' },
        { href: `/gas/${stationId}/meters`, icon: Calculator, label: 'มิเตอร์' },
        { href: `/gas/${stationId}/gauge`, icon: Gauge, label: 'เช็คเกจ' },
        { href: `/gas/${stationId}/summary`, icon: ClipboardList, label: 'สรุปกะ' },
        { href: `/gas/${stationId}/shift/close`, icon: Clock, label: 'ปิดกะ' },
    ];

    const isActive = (href: string, exact?: boolean) => {
        if (exact) return pathname === href;
        return pathname.startsWith(href);
    };

    return (
        <div className="min-h-screen bg-[#0a0a0f] text-white">
            {/* Header */}
            <header className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-orange-600 to-red-600 shadow-lg">
                <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => router.push('/simple-station')}
                            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                        >
                            <ChevronLeft size={24} />
                        </button>
                        <div>
                            <h1 className="font-bold text-lg">
                                {loading ? '...' : station?.name || 'ปั๊มแก๊ส'}
                            </h1>
                            {currentShift && (
                                <p className="text-sm text-white/80">
                                    กะ {currentShift.shiftNumber} | {currentShift.staffName || 'ไม่ระบุ'}
                                </p>
                            )}
                        </div>
                    </div>

                    <button
                        onClick={() => setMenuOpen(!menuOpen)}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors md:hidden"
                    >
                        {menuOpen ? <X size={24} /> : <Menu size={24} />}
                    </button>
                </div>

                {/* Shift Status Bar */}
                {currentShift && (
                    <div className="bg-black/20 px-4 py-2 flex items-center gap-4 text-sm">
                        <span className={`flex items-center gap-1 ${currentShift.status === 'OPEN' ? 'text-green-300' : 'text-gray-300'
                            }`}>
                            <span className={`w-2 h-2 rounded-full ${currentShift.status === 'OPEN' ? 'bg-green-400 animate-pulse' : 'bg-gray-400'
                                }`}></span>
                            {currentShift.status === 'OPEN' ? 'กะเปิดอยู่' : 'กะปิดแล้ว'}
                        </span>
                        {currentShift.openedAt && (
                            <span className="text-white/60">
                                เปิดเมื่อ {new Date(currentShift.openedAt).toLocaleTimeString('th-TH', {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                })}
                            </span>
                        )}
                    </div>
                )}
            </header>

            {/* Mobile Menu Overlay */}
            {menuOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/50 md:hidden"
                    onClick={() => setMenuOpen(false)}
                />
            )}

            {/* Mobile Menu */}
            <nav className={`fixed top-0 right-0 z-50 h-full w-64 bg-[#1a1a24] transform transition-transform duration-300 md:hidden ${menuOpen ? 'translate-x-0' : 'translate-x-full'
                }`}>
                <div className="pt-20 px-4">
                    {navItems.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setMenuOpen(false)}
                            className={`flex items-center gap-3 px-4 py-3 rounded-lg mb-2 transition-colors ${isActive(item.href, item.exact)
                                    ? 'bg-orange-600 text-white'
                                    : 'text-gray-300 hover:bg-white/10'
                                }`}
                        >
                            <item.icon size={20} />
                            <span>{item.label}</span>
                        </Link>
                    ))}

                    <hr className="border-white/10 my-4" />

                    <Link
                        href="/simple-station"
                        className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-400 hover:bg-white/10"
                    >
                        <LogOut size={20} />
                        <span>ออกจากปั๊ม</span>
                    </Link>
                </div>
            </nav>

            {/* Desktop Bottom Navigation */}
            <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#1a1a24] border-t border-white/10 hidden md:block">
                <div className="flex justify-around py-2">
                    {navItems.slice(0, 6).map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors ${isActive(item.href, item.exact)
                                    ? 'text-orange-400'
                                    : 'text-gray-400 hover:text-white'
                                }`}
                        >
                            <item.icon size={20} />
                            <span className="text-xs">{item.label}</span>
                        </Link>
                    ))}
                </div>
            </nav>

            {/* Mobile Bottom Navigation */}
            <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#1a1a24] border-t border-white/10 md:hidden">
                <div className="flex justify-around py-2">
                    {navItems.slice(0, 4).map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors ${isActive(item.href, item.exact)
                                    ? 'text-orange-400'
                                    : 'text-gray-400 hover:text-white'
                                }`}
                        >
                            <item.icon size={20} />
                            <span className="text-xs">{item.label}</span>
                        </Link>
                    ))}
                </div>
            </nav>

            {/* Main Content */}
            <main className="pt-24 pb-20 px-4">
                {children}
            </main>
        </div>
    );
}
