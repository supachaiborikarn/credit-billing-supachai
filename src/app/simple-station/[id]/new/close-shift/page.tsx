'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Clock, FileText, Zap, RefreshCw } from 'lucide-react';
import { STATIONS } from '@/constants';

interface OldShift {
    id: string;
    shiftNumber: number;
    date: string;
    createdAt: string;
}

export default function CloseShiftPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const stationIndex = parseInt(id) - 1;
    const station = STATIONS[stationIndex];
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [forceClosing, setForceClosing] = useState(false);
    const [oldShift, setOldShift] = useState<OldShift | null>(null);

    // Load old unclosed shift
    useEffect(() => {
        const loadShiftStatus = async () => {
            try {
                const res = await fetch(`/api/simple-station/${id}/shift-status`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.oldUnclosedShift) {
                        setOldShift(data.oldUnclosedShift);
                    } else {
                        // No old shift, go to open shift
                        router.replace(`/simple-station/${id}/new/open-shift`);
                    }
                }
            } catch (error) {
                console.error('Error loading shift status:', error);
            } finally {
                setLoading(false);
            }
        };
        loadShiftStatus();
    }, [id, router]);

    const handleGoToMeterEntry = () => {
        // Go to shift-end page to enter meters and close properly
        router.push(`/simple-station/${id}/new/shift-end`);
    };

    const handleForceClose = async () => {
        if (!oldShift) return;

        const confirmed = confirm('⚠️ Force Close จะปิดกะโดยไม่ลงมิเตอร์\nข้อมูลยอดขายจากมิเตอร์จะไม่ถูกบันทึก\n\nยืนยันต้องการ Force Close?');
        if (!confirmed) return;

        setForceClosing(true);
        try {
            const res = await fetch(`/api/simple-station/${id}/shift-status`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'force-close',
                    shiftId: oldShift.id,
                }),
            });

            if (res.ok) {
                // Go to open new shift
                router.replace(`/simple-station/${id}/new/open-shift`);
            } else {
                const err = await res.json();
                alert(err.error || 'ไม่สามารถปิดกะได้');
            }
        } catch (error) {
            console.error('Error force closing:', error);
            alert('เกิดข้อผิดพลาด');
        } finally {
            setForceClosing(false);
        }
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('th-TH', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        });
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-red-900 to-slate-900 flex items-center justify-center">
                <div className="text-center">
                    <RefreshCw size={40} className="animate-spin text-white mx-auto mb-4" />
                    <p className="text-white">กำลังตรวจสอบ...</p>
                </div>
            </div>
        );
    }

    if (!station || !oldShift) {
        return null;
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-red-900 to-slate-900 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Warning Header */}
                <div className="text-center mb-8">
                    <div className="w-20 h-20 bg-gradient-to-br from-red-500 to-orange-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg animate-pulse">
                        <AlertTriangle size={40} className="text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-2">มีกะที่ยังไม่ได้ปิด!</h1>
                    <p className="text-gray-400">{station.name}</p>
                </div>

                {/* Old Shift Info */}
                <div className="bg-red-500/20 border border-red-500/30 rounded-2xl p-6 mb-6">
                    <div className="flex items-center gap-3 mb-4">
                        <Clock size={24} className="text-red-400" />
                        <span className="text-white font-semibold">กะค้างจากวันก่อน</span>
                    </div>

                    <div className="bg-white/10 rounded-xl p-4 space-y-2">
                        <div className="flex justify-between text-gray-300">
                            <span>วันที่:</span>
                            <span className="font-medium text-white">{formatDate(oldShift.date)}</span>
                        </div>
                        <div className="flex justify-between text-gray-300">
                            <span>กะที่:</span>
                            <span className="font-medium text-white">{oldShift.shiftNumber}</span>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="space-y-4">
                    {/* Option 1: Enter meters and close properly */}
                    <button
                        onClick={handleGoToMeterEntry}
                        className="w-full py-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold rounded-xl text-lg flex items-center justify-center gap-3 hover:from-blue-600 hover:to-indigo-700 shadow-lg"
                    >
                        <FileText size={24} />
                        ลงมิเตอร์แล้วปิดกะ
                    </button>

                    <div className="text-center text-gray-500 text-sm">หรือ</div>

                    {/* Option 2: Force close */}
                    <button
                        onClick={handleForceClose}
                        disabled={forceClosing}
                        className="w-full py-4 bg-gradient-to-r from-gray-600 to-gray-700 text-white font-bold rounded-xl text-lg flex items-center justify-center gap-3 hover:from-gray-700 hover:to-gray-800 disabled:opacity-50 shadow-lg border border-gray-500"
                    >
                        {forceClosing ? (
                            <>
                                <RefreshCw size={24} className="animate-spin" />
                                กำลังปิดกะ...
                            </>
                        ) : (
                            <>
                                <Zap size={24} />
                                Force Close (ไม่ลงมิเตอร์)
                            </>
                        )}
                    </button>
                </div>

                <p className="text-center text-gray-500 text-sm mt-6">
                    ⚠️ ต้องปิดกะเก่าก่อนจึงจะเปิดกะใหม่ได้
                </p>
            </div>
        </div>
    );
}
