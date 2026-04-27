'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, FileText, BarChart3, Droplets, Gauge } from 'lucide-react';

interface SimpleBottomNavProps {
    stationId: string;
}

const BASE_NAV_ITEMS = [
    { href: 'home', label: 'หน้าหลัก', icon: Home },
    { href: 'sell', label: 'ลงบิล', icon: FileText },
    { href: 'oil-sell', label: 'น้ำมันเครื่อง', icon: Droplets },
    { href: 'shift-end', label: 'มิเตอร์', icon: Gauge },
    { href: 'summary', label: 'สรุป', icon: BarChart3 },
];

export default function SimpleBottomNav({ stationId }: SimpleBottomNavProps) {
    const pathname = usePathname();
    const basePath = pathname.startsWith('/station/')
        ? `/station/${stationId}/new`
        : `/simple-station/${stationId}/new`;
    const normalizedStationId = stationId.startsWith('station-') ? stationId : `station-${stationId}`;
    const navItems = normalizedStationId === 'station-1'
        ? BASE_NAV_ITEMS.filter((item) => item.href !== 'oil-sell')
        : BASE_NAV_ITEMS;

    return (
        <nav
            className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200 bg-white shadow-lg"
            style={{
                minHeight: 'calc(64px + env(safe-area-inset-bottom))',
                paddingBottom: 'env(safe-area-inset-bottom)',
            }}
        >
            <div className="mx-auto flex h-16 max-w-lg items-center justify-around">
                {navItems.map((item) => {
                    const href = `${basePath}/${item.href}`;
                    const isActive = pathname === href || pathname.startsWith(href + '/');
                    const Icon = item.icon;

                    return (
                        <Link
                            key={item.href}
                            href={href}
                            className={`relative flex h-full flex-1 flex-col items-center justify-center transition-colors ${isActive
                                ? 'text-orange-500'
                                : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                            <span className={`text-xs mt-1 ${isActive ? 'font-semibold' : ''}`}>
                                {item.label}
                            </span>
                            {isActive && (
                                <div className="absolute bottom-0 h-0.5 w-12 rounded-t-full bg-orange-500" />
                            )}
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
