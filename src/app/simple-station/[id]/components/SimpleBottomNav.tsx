'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, FileText, BarChart3 } from 'lucide-react';

interface SimpleBottomNavProps {
    stationId: string;
}

const navItems = [
    { href: 'home', label: 'หน้าหลัก', icon: Home },
    { href: 'sell', label: 'ลงบิล', icon: FileText },
    { href: 'summary', label: 'สรุป', icon: BarChart3 },
];

export default function SimpleBottomNav({ stationId }: SimpleBottomNavProps) {
    const pathname = usePathname();
    const basePath = `/simple-station/${stationId}/new`;

    return (
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50 pb-safe">
            <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
                {navItems.map((item) => {
                    const href = `${basePath}/${item.href}`;
                    const isActive = pathname === href || pathname.startsWith(href + '/');
                    const Icon = item.icon;

                    return (
                        <Link
                            key={item.href}
                            href={href}
                            className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${isActive
                                ? 'text-orange-500'
                                : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                            <span className={`text-xs mt-1 ${isActive ? 'font-semibold' : ''}`}>
                                {item.label}
                            </span>
                            {isActive && (
                                <div className="absolute bottom-0 w-12 h-0.5 bg-orange-500 rounded-t-full" />
                            )}
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
