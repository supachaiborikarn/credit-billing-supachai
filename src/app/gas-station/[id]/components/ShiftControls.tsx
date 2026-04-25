'use client';

import Link from 'next/link';
import { ShiftData } from '../hooks/useGasStation';

interface ShiftControlsProps {
    stationId: string;
    currentShift: ShiftData | null;
    allShifts: { shiftNumber: number; status: string }[];
    actionLoading: boolean;
}

export default function ShiftControls({
    stationId,
    currentShift,
    allShifts,
    actionLoading,
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
                <Link
                    href={`/gas/${stationId}/shift/close`}
                    aria-disabled={actionLoading}
                    className={`block w-full rounded-full border border-black/15 bg-white px-6 py-3 text-center text-sm font-extrabold transition ${actionLoading
                        ? 'pointer-events-none opacity-50'
                        : 'hover:bg-neutral-50'
                        }`}
                >
                    🔒 ไปหน้าปิดกะ
                </Link>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <p className="text-sm font-semibold text-neutral-600">
                เปิดกะใหม่ต้องกรอกราคาขาย มิเตอร์ 4 หัวจ่าย และเกจ 3 ถังก่อนบันทึก
            </p>
            <Link
                href={`/gas/${stationId}/shift/open`}
                className="block w-full rounded-full bg-orange-500 px-6 py-3 text-center text-sm font-extrabold text-black transition hover:bg-orange-400"
            >
                🚀 เปิดกะใหม่
            </Link>
            {allShifts.length > 0 && (
                <div className="flex flex-wrap gap-2 text-xs font-semibold text-neutral-500">
                    {allShifts.map((shift) => (
                        <span key={shift.shiftNumber} className="rounded-full bg-neutral-100 px-3 py-1">
                            กะ{shift.shiftNumber === 1 ? 'เช้า' : 'บ่าย'}: {shift.status}
                        </span>
                    ))}
                </div>
            )}
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
                ปุ่มเปิดกะแบบเร็วถูกปิดไว้ เพื่อป้องกันกะว่างที่ไม่มีข้อมูลมิเตอร์/เกจ
            </div>
        </div>
    );
}
