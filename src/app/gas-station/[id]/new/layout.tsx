'use client';

import { use } from 'react';
import { STATIONS } from '@/constants';
import BottomNav from '../components/BottomNav';

interface GasStationLayoutProps {
    children: React.ReactNode;
    params: Promise<{ id: string }>;
}

export default function GasStationLayout({ children, params }: GasStationLayoutProps) {
    const { id } = use(params);
    const stationIndex = parseInt(id) - 1;
    const station = STATIONS[stationIndex];

    if (!station || station.type !== 'GAS') {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center">
                <div className="text-center">
                    <p className="text-gray-500">ไม่พบสถานีปั๊มแก๊ส</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-100">
            {/* Main content with padding for bottom nav */}
            <main className="pb-20">
                {children}
            </main>

            {/* Fixed bottom navigation */}
            <BottomNav stationId={id} />
        </div>
    );
}
