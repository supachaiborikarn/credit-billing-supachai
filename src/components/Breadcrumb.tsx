'use client';

import Link from 'next/link';
import { ChevronRight, Home } from 'lucide-react';

export interface BreadcrumbItem {
    label: string;
    href?: string;
    icon?: React.ReactNode;
}

interface BreadcrumbProps {
    items: BreadcrumbItem[];
    className?: string;
}

export default function Breadcrumb({ items, className = '' }: BreadcrumbProps) {
    return (
        <nav
            aria-label="Breadcrumb"
            className={`flex items-center text-sm ${className}`}
        >
            {/* Home link */}
            <Link
                href="/dashboard"
                className="text-gray-400 hover:text-white transition flex items-center gap-1"
            >
                <Home size={14} />
                <span className="hidden sm:inline">หน้าหลัก</span>
            </Link>

            {/* Breadcrumb items */}
            {items.map((item, index) => (
                <div key={index} className="flex items-center">
                    <ChevronRight size={14} className="mx-2 text-gray-600" />
                    {item.href ? (
                        <Link
                            href={item.href}
                            className="text-gray-400 hover:text-white transition flex items-center gap-1.5"
                        >
                            {item.icon}
                            <span>{item.label}</span>
                        </Link>
                    ) : (
                        <span className="text-white font-medium flex items-center gap-1.5">
                            {item.icon}
                            <span>{item.label}</span>
                        </span>
                    )}
                </div>
            ))}
        </nav>
    );
}

// Light theme version for pages without dark sidebar
export function BreadcrumbLight({ items, className = '' }: BreadcrumbProps) {
    return (
        <nav
            aria-label="Breadcrumb"
            className={`flex items-center text-sm ${className}`}
        >
            {/* Home link */}
            <Link
                href="/dashboard"
                className="text-gray-500 hover:text-gray-800 transition flex items-center gap-1"
            >
                <Home size={14} />
                <span className="hidden sm:inline">หน้าหลัก</span>
            </Link>

            {/* Breadcrumb items */}
            {items.map((item, index) => (
                <div key={index} className="flex items-center">
                    <ChevronRight size={14} className="mx-2 text-gray-400" />
                    {item.href ? (
                        <Link
                            href={item.href}
                            className="text-gray-500 hover:text-gray-800 transition flex items-center gap-1.5"
                        >
                            {item.icon}
                            <span>{item.label}</span>
                        </Link>
                    ) : (
                        <span className="text-gray-800 font-medium flex items-center gap-1.5">
                            {item.icon}
                            <span>{item.label}</span>
                        </span>
                    )}
                </div>
            ))}
        </nav>
    );
}
