'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, Calendar, ArrowRight } from 'lucide-react';

interface PreviousDayBlockerProps {
    stationId: string;
    currentDate: string;
    onGoToPreviousDay: (date: string) => void;
    isAdmin?: boolean;
}

interface DailyRecord {
    id: string;
    date: string;
    meters?: { endReading?: number }[];
}

/**
 * Blocks the V2 page if the previous day's meters weren't closed
 * Only applies to FULL stations (แท๊งลอย)
 */
export default function PreviousDayBlocker({
    stationId,
    currentDate,
    onGoToPreviousDay,
    isAdmin = false,
}: PreviousDayBlockerProps) {
    const [isBlocked, setIsBlocked] = useState(false);
    const [previousDate, setPreviousDate] = useState<string>('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const checkPreviousDay = async () => {
            setLoading(true);
            try {
                // Calculate previous date
                const current = new Date(currentDate);
                current.setDate(current.getDate() - 1);
                const prevDateStr = current.toISOString().split('T')[0];
                setPreviousDate(prevDateStr);

                // Check if today is the current date (don't block if viewing historical dates)
                const today = new Date().toISOString().split('T')[0];
                if (currentDate !== today) {
                    setIsBlocked(false);
                    setLoading(false);
                    return;
                }

                // Fetch previous day's data
                const res = await fetch(`/api/station/${stationId.replace('station-', '')}/daily?date=${prevDateStr}`);
                if (!res.ok) {
                    // No record for previous day - might need to block
                    setIsBlocked(true);
                    setLoading(false);
                    return;
                }

                const data: { dailyRecord: DailyRecord } = await res.json();

                // Check if meters have end readings
                if (!data.dailyRecord) {
                    setIsBlocked(true);
                } else {
                    const meters = data.dailyRecord.meters || [];
                    const hasEndMeter = meters.length > 0 && meters.some(m => m.endReading && Number(m.endReading) > 0);
                    setIsBlocked(!hasEndMeter);
                }
            } catch (error) {
                console.error('Error checking previous day:', error);
                // Don't block on error to prevent lockout
                setIsBlocked(false);
            } finally {
                setLoading(false);
            }
        };

        checkPreviousDay();
    }, [stationId, currentDate]);

    // Format date for display
    const formatDate = (dateStr: string) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toLocaleDateString('th-TH', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    // Admin can bypass
    if (isAdmin) return null;

    // Still loading
    if (loading) return null;

    // Not blocked
    if (!isBlocked) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden animate-fade-in">
                {/* Header */}
                <div className="bg-gradient-to-r from-red-500 to-orange-500 p-6 text-white">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-white/20 rounded-full">
                            <AlertTriangle size={24} />
                        </div>
                        <h2 className="text-xl font-bold">ยังไม่ได้ปิดมิเตอร์เมื่อวาน</h2>
                    </div>
                    <p className="text-white/90 text-sm">
                        กรุณาลงมิเตอร์ปิดวันก่อนหน้าก่อนเริ่มงานวันใหม่
                    </p>
                </div>

                {/* Content */}
                <div className="p-6">
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
                        <div className="flex items-center gap-2 text-red-700 mb-2">
                            <Calendar size={18} />
                            <span className="font-semibold">วันที่ยังไม่ได้ปิด:</span>
                        </div>
                        <p className="text-red-800 font-bold text-lg">
                            {formatDate(previousDate)}
                        </p>
                    </div>

                    <p className="text-gray-600 text-sm mb-6">
                        เพื่อความถูกต้องของข้อมูล ระบบต้องการให้ลงมิเตอร์ปิดวันก่อนหน้าก่อนที่จะเริ่มบันทึกรายการใหม่
                    </p>

                    {/* Action Button */}
                    <button
                        onClick={() => onGoToPreviousDay(previousDate)}
                        className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
                    >
                        ไปลงมิเตอร์วัน {new Date(previousDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
                        <ArrowRight size={20} />
                    </button>
                </div>
            </div>
        </div>
    );
}
