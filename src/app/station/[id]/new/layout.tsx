'use client';

import { use } from 'react';
import StationBottomNav from '../components/StationBottomNav';

export default function StationNewLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ id: string }>;
}) {
    const { id } = use(params);

    return (
        <div className="min-h-screen bg-gray-100">
            <main className="pb-20">
                {children}
            </main>
            <StationBottomNav stationId={id} />
        </div>
    );
}
