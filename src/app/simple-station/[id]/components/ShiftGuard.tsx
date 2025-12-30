'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';

interface ShiftInfo {
    id: string;
    shiftNumber: number;
    status: 'OPEN' | 'CLOSED' | 'LOCKED';
    createdAt: string;
    date?: string;
}

interface ShiftContextType {
    currentShift: ShiftInfo | null;
    oldUnclosedShift: ShiftInfo | null;
    loading: boolean;
    refreshShift: () => void;
}

const ShiftContext = createContext<ShiftContextType>({
    currentShift: null,
    oldUnclosedShift: null,
    loading: true,
    refreshShift: () => { },
});

export const useShift = () => useContext(ShiftContext);

// Pages that don't require shift check
const EXEMPT_PAGES = [
    '/open-shift',
    '/close-shift',
    '/shift-end',
    '/force-close',
];

export default function ShiftGuard({
    children,
    stationId,
}: {
    children: ReactNode;
    stationId: string;
}) {
    const router = useRouter();
    const pathname = usePathname();
    const [currentShift, setCurrentShift] = useState<ShiftInfo | null>(null);
    const [oldUnclosedShift, setOldUnclosedShift] = useState<ShiftInfo | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchShiftStatus = async () => {
        setLoading(true);
        try {
            const today = new Date().toISOString().split('T')[0];

            // Check for today's shift
            const res = await fetch(`/api/simple-station/${stationId}/shift-status`);
            if (res.ok) {
                const data = await res.json();
                setCurrentShift(data.currentShift || null);
                setOldUnclosedShift(data.oldUnclosedShift || null);
            }
        } catch (error) {
            console.error('Error checking shift status:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchShiftStatus();
    }, [stationId]);

    // Check if current page is exempt
    const isExemptPage = EXEMPT_PAGES.some(page => pathname.includes(page));

    useEffect(() => {
        if (loading || isExemptPage) return;

        const basePath = `/simple-station/${stationId}/new`;

        // Priority 1: Force close old shift first
        if (oldUnclosedShift) {
            router.replace(`${basePath}/close-shift`);
            return;
        }

        // Priority 2: Must have active shift for today
        if (!currentShift) {
            router.replace(`${basePath}/open-shift`);
            return;
        }
    }, [loading, currentShift, oldUnclosedShift, stationId, router, isExemptPage, pathname]);

    // Show loading while checking
    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-white text-lg">กำลังตรวจสอบกะ...</p>
                </div>
            </div>
        );
    }

    // Block access if conditions not met (unless exempt)
    if (!isExemptPage && (oldUnclosedShift || !currentShift)) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-white text-lg">กำลังเปลี่ยนหน้า...</p>
                </div>
            </div>
        );
    }

    return (
        <ShiftContext.Provider value={{ currentShift, oldUnclosedShift, loading, refreshShift: fetchShiftStatus }}>
            {children}
        </ShiftContext.Provider>
    );
}
