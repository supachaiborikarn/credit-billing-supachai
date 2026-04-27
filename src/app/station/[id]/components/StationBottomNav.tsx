'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, PenLine, Gauge, BarChart3 } from 'lucide-react';

interface BottomNavProps {
    stationId: string;
}

const navItems = [
    { href: 'home', label: 'หน้าหลัก', icon: Home },
    { href: 'sell', label: 'ลงบิล', icon: PenLine },
    { href: 'shift-end', label: 'มิเตอร์', icon: Gauge },
    { href: 'summary', label: 'สรุป', icon: BarChart3 },
];

export default function StationBottomNav({ stationId }: BottomNavProps) {
    const pathname = usePathname();
    const basePath = `/station/${stationId}/new`;

    return (
        <>
            <div aria-hidden="true" style={{ height: 'calc(104px + env(safe-area-inset-bottom))' }} />
            <nav
                className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200 bg-white shadow-lg"
                style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
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
                                <span className={`mt-1 text-xs ${isActive ? 'font-semibold' : ''}`}>
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
        </>
    );
}
