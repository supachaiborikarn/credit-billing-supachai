'use client';

import { Home, List, Gauge, BarChart2, History } from 'lucide-react';

type TabType = 'home' | 'list' | 'meter' | 'summary' | 'history';

interface BottomTabBarProps {
    activeTab: TabType;
    onTabChange: (tab: TabType) => void;
    showHistory?: boolean;
}

export default function BottomTabBar({ activeTab, onTabChange, showHistory = false }: BottomTabBarProps) {
    const tabs = [
        { id: 'home' as const, label: 'หน้าหลัก', icon: Home },
        { id: 'list' as const, label: 'รายการ', icon: List },
        { id: 'meter' as const, label: 'มิเตอร์', icon: Gauge },
        { id: 'summary' as const, label: 'สรุป', icon: BarChart2 },
        ...(showHistory ? [{ id: 'history' as const, label: 'ประวัติ', icon: History }] : []),
    ];

    return (
        <>
            <div aria-hidden="true" style={{ height: 'calc(104px + env(safe-area-inset-bottom))' }} />
            <nav
                className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200 bg-white"
                style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
            >
                <div className="mx-auto flex h-16 max-w-lg items-center justify-around">
                    {tabs.map(tab => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;

                        return (
                            <button
                                key={tab.id}
                                onClick={() => onTabChange(tab.id)}
                                className={`flex h-full flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-3 py-1 transition ${isActive
                                    ? 'text-orange-500'
                                    : 'text-gray-400 hover:text-gray-600'
                                    }`}
                            >
                                <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                                <span className={`text-[10px] ${isActive ? 'font-bold' : ''}`}>
                                    {tab.label}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </nav>
        </>
    );
}
