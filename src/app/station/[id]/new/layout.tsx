'use client';

import { use } from 'react';
import { STATIONS } from '@/constants';
import SimpleBottomNav from '@/app/simple-station/[id]/components/SimpleBottomNav';

interface StationNewLayoutProps {
    children: React.ReactNode;
    params: Promise<{ id: string }>;
}

export default function StationNewLayout({ children, params }: StationNewLayoutProps) {
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
            <main style={{ paddingBottom: 'calc(144px + env(safe-area-inset-bottom))' }}>
                {children}
            </main>
            <SimpleBottomNav stationId={id} />
        </div>
    );
}
