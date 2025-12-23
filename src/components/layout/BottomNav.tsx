'use client';

import { Home, Users, FileText, Plus, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
    { icon: Home, label: "หน้าหลัก", path: "/m" },
    { icon: Users, label: "ลูกค้า", path: "/owners" },
    { icon: Plus, label: "เพิ่ม", path: "/station/cm9qx0d2v0001qnfnm3w0qx5e", isFab: true },
    { icon: FileText, label: "บิล", path: "/invoices" },
    { icon: Settings, label: "ตั้งค่า", path: "/dashboard" },
];

export function BottomNav() {
    const pathname = usePathname();

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-neutral-200">
            <div className="mx-auto max-w-lg flex items-center justify-around py-2">
                {navItems.map((item) => {
                    const isActive = pathname === item.path;
                    const Icon = item.icon;

                    if (item.isFab) {
                        return (
                            <Link
                                key={item.path}
                                href={item.path}
                                className="flex flex-col items-center -mt-6"
                            >
                                <div className="h-14 w-14 rounded-xl bg-orange-500 text-white flex items-center justify-center shadow-[3px_3px_0_0_rgba(0,0,0,0.9)] hover:bg-orange-600 transition-colors">
                                    <Icon className="h-6 w-6" strokeWidth={2.5} />
                                </div>
                            </Link>
                        );
                    }

                    return (
                        <Link
                            key={item.path}
                            href={item.path}
                            className={`flex flex-col items-center gap-1 px-3 py-2 transition-colors ${isActive
                                    ? "text-orange-500"
                                    : "text-neutral-400 hover:text-neutral-700"
                                }`}
                        >
                            <Icon className="h-5 w-5" strokeWidth={isActive ? 2.5 : 2} />
                            <span className="text-xs font-semibold">{item.label}</span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
