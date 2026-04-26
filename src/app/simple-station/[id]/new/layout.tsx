'use client';

import { use } from 'react';
import { STATIONS } from '@/constants';
import SimpleBottomNav from '../components/SimpleBottomNav';

interface SimpleStationLayoutProps {
    children: React.ReactNode;
    params: Promise<{ id: string }>;
}

export default function SimpleStationLayout({ children, params }: SimpleStationLayoutProps) {
    const { id } = use(params);
    const stationIndex = parseInt(id) - 1;
    const station = STATIONS[stationIndex];

    if (!station || station.type === 'GAS') {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center">
                <div className="text-center">
                    <p className="text-gray-500">ไม่พบสถานี</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-100">
            {/* Main content with generous room for the fixed bottom nav and mobile safe area. */}
            <main style={{ paddingBottom: 'calc(144px + env(safe-area-inset-bottom))' }}>
                {children}
            </main>

            {/* Fixed bottom navigation */}
            <SimpleBottomNav stationId={id} />
        </div>
    );
}
