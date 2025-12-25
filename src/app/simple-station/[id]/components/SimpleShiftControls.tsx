'use client';

import { STATION_STAFF } from '@/constants';

interface ShiftData {
    id: string;
    shiftNumber: number;
    status: string;
    staffName?: string;
    createdAt: string;
    closedAt?: string | null;
}

interface SimpleShiftControlsProps {
    stationId: string;
    currentShift: ShiftData | null;
    allShifts: ShiftData[];
    actionLoading: boolean;
    onOpenShift: (shiftNumber: number) => void;
    onCloseShift: () => void;
}

const SHIFT_NAMES = ['กะเช้า', 'กะบ่าย', 'กะดึก'];

export default function SimpleShiftControls({
    stationId,
    currentShift,
    allShifts,
    actionLoading,
    onOpenShift,
    onCloseShift,
}: SimpleShiftControlsProps) {
    // Get max shifts for this station
    const stationConfig = STATION_STAFF[stationId as keyof typeof STATION_STAFF];
    const maxShifts = stationConfig?.maxShifts || 2;

    // Generate shift options based on maxShifts
    const shiftOptions = Array.from({ length: maxShifts }, (_, i) => ({
        number: i + 1,
        name: SHIFT_NAMES[i] || `กะที่ ${i + 1}`,
    }));

    if (currentShift) {
        return (
            <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-4 border border-white/10">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                        <div>
                            <span className="text-lg font-bold text-white">
                                {SHIFT_NAMES[currentShift.shiftNumber - 1] || `กะที่ ${currentShift.shiftNumber}`}
                            </span>
                            <span className="text-green-400 ml-2">เปิดอยู่</span>
                        </div>
                    </div>
                    <button
                        onClick={onCloseShift}
                        disabled={actionLoading}
                        className="px-4 py-2 rounded-xl bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition disabled:opacity-50"
                    >
                        {actionLoading ? 'กำลังดำเนินการ...' : '🔒 ปิดกะ'}
                    </button>
                </div>
            </div>
        );
    }

    // No open shift - show options to open
    return (
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-4 border border-white/10">
            <p className="text-sm text-gray-400 mb-3">เลือกกะที่ต้องการเปิด:</p>
            <div className={`grid gap-2 ${maxShifts === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
                {shiftOptions.map((shift) => {
                    const existingShift = allShifts.find(s => s.shiftNumber === shift.number);
                    const isClosed = existingShift?.status === 'CLOSED';

                    return (
                        <button
                            key={shift.number}
                            onClick={() => onOpenShift(shift.number)}
                            disabled={actionLoading || isClosed}
                            className={`rounded-xl px-4 py-3 text-sm font-bold transition ${isClosed
                                    ? 'bg-white/5 text-gray-500 cursor-not-allowed'
                                    : 'bg-gradient-to-r from-orange-500 to-yellow-500 text-black hover:shadow-lg hover:shadow-orange-500/25'
                                }`}
                        >
                            {isClosed ? `✓ ${shift.name}` : `🚀 ${shift.name}`}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
