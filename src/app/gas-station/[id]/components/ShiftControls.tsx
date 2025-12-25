'use client';

import { ShiftData } from '../hooks/useGasStation';

interface ShiftControlsProps {
    currentShift: ShiftData | null;
    allShifts: { shiftNumber: number; status: string }[];
    actionLoading: boolean;
    onOpenShift: (shiftNumber: number) => void;
    onCloseShift: () => void;
}

export default function ShiftControls({
    currentShift,
    allShifts,
    actionLoading,
    onOpenShift,
    onCloseShift,
}: ShiftControlsProps) {
    if (currentShift) {
        return (
            <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-green-600">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    กะ{currentShift.shiftNumber === 1 ? 'เช้า' : 'บ่าย'} เปิดอยู่
                    {currentShift.openingStock !== null && currentShift.openingStock !== undefined && (
                        <span className="ml-2 text-xs text-neutral-500">
                            (สต็อกเริ่มต้น: {currentShift.openingStock.toLocaleString()} ลิตร)
                        </span>
                    )}
                </div>
                {currentShift.carryOverFromShiftId && (
                    <div className="text-xs text-blue-600 bg-blue-50 rounded-lg px-3 py-1 inline-block">
                        📋 คัดลอกจากกะก่อน
                    </div>
                )}
                <button
                    onClick={onCloseShift}
                    disabled={actionLoading}
                    className="w-full rounded-full border border-black/15 bg-white px-6 py-3 text-sm font-extrabold hover:bg-neutral-50 transition disabled:opacity-50"
                >
                    {actionLoading ? 'กำลังดำเนินการ...' : '🔒 ปิดกะ'}
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            <p className="text-sm font-semibold text-neutral-600">เลือกกะที่ต้องการเปิด:</p>
            <div className="grid grid-cols-2 gap-2">
                {[1, 2].map((shiftNum) => {
                    const shift = allShifts.find(s => s.shiftNumber === shiftNum);
                    const isClosed = shift?.status === 'CLOSED';
                    return (
                        <button
                            key={shiftNum}
                            onClick={() => onOpenShift(shiftNum)}
                            disabled={actionLoading || isClosed}
                            className={`rounded-full px-6 py-3 text-sm font-extrabold transition disabled:opacity-50 ${isClosed
                                ? 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
                                : 'bg-orange-500 text-black hover:bg-orange-400'
                                }`}
                        >
                            {isClosed ? `✓ กะ${shiftNum === 1 ? 'เช้า' : 'บ่าย'} (ปิดแล้ว)` : `🚀 กะ${shiftNum === 1 ? 'เช้า' : 'บ่าย'}`}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
