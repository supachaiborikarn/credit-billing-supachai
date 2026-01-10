'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    Clock,
    CheckCircle,
    Loader2,
    AlertCircle,
    ArrowLeft,
    Calculator,
    Gauge,
    Banknote,
    CreditCard,
    FuelIcon,
    Smartphone,
    AlertTriangle
} from 'lucide-react';
import {
    formatCurrency,
    calculateReconciliation,
    getVarianceColorClass,
    getVarianceText,
    NOZZLE_COUNT,
    TANK_COUNT
} from '@/lib/gas';

interface ShiftData {
    id: string;
    shiftNumber: number;
    status: string;
    openedAt: string;
    meters: { nozzleNumber: number; startReading: number | null; endReading: number | null; soldQty: number | null }[];
    gauge: { start: { tankNumber: number; percentage: number }[]; end: { tankNumber: number; percentage: number }[] };
    sales: { cash: number; credit: number; card: number; transfer: number; total: number; liters: number };
    gasPrice: number;
}

export default function ShiftClosePage() {
    const params = useParams();
    const router = useRouter();
    const stationId = params.stationId as string;

    const [loading, setLoading] = useState(true);
    const [closing, setClosing] = useState(false);
    const [success, setSuccess] = useState(false);
    const [shift, setShift] = useState<ShiftData | null>(null);

    // Reconciliation form
    const [cashReceived, setCashReceived] = useState<string>('');
    const [creditReceived, setCreditReceived] = useState<string>('');
    const [cardReceived, setCardReceived] = useState<string>('');
    const [transferReceived, setTransferReceived] = useState<string>('');
    const [varianceNote, setVarianceNote] = useState<string>('');

    const [errors, setErrors] = useState<string[]>([]);
    const [warnings, setWarnings] = useState<string[]>([]);

    // Fetch shift data
    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await fetch(`/api/v2/gas/${stationId}/summary?detailed=true`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.shift && data.shift.status === 'OPEN') {
                        setShift(data.shift);

                        // Pre-fill reconciliation from sales
                        setCashReceived(String(data.sales?.cash || 0));
                        setCreditReceived(String(data.sales?.credit || 0));
                        setCardReceived(String(data.sales?.card || 0));
                        setTransferReceived(String(data.sales?.transfer || 0));
                    }
                }
            } catch (error) {
                console.error('Error fetching shift data:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [stationId]);

    // Calculate expected amount from meters
    const calculateExpected = (): number => {
        if (!shift) return 0;
        const totalLiters = shift.meters.reduce((sum, m) => {
            if (m.soldQty !== null) return sum + m.soldQty;
            if (m.startReading !== null && m.endReading !== null) {
                return sum + (m.endReading - m.startReading);
            }
            return sum;
        }, 0);
        return totalLiters * (shift.gasPrice || 16.09);
    };

    // Validate before closing
    const validate = (): boolean => {
        const newErrors: string[] = [];
        const newWarnings: string[] = [];

        // Check all nozzles have end readings
        const missingMeters = shift?.meters.filter(m => m.endReading === null).length || 0;
        if (missingMeters > 0) {
            newErrors.push(`มิเตอร์ปิดกะไม่ครบ (ขาด ${missingMeters} หัวจ่าย)`);
        }

        // Check gauge end readings
        const hasEndGauge = shift?.gauge.end && shift.gauge.end.length >= TANK_COUNT;
        if (!hasEndGauge) {
            newErrors.push('ยังไม่ได้เช็คเกจปิดกะ');
        }

        // Validate amounts
        if (!cashReceived && !creditReceived && !cardReceived && !transferReceived) {
            newErrors.push('ต้องกรอกยอดเงินอย่างน้อย 1 ช่อง');
        }

        // Calculate variance
        const expected = calculateExpected();
        const received = parseFloat(cashReceived || '0') +
            parseFloat(creditReceived || '0') +
            parseFloat(cardReceived || '0') +
            parseFloat(transferReceived || '0');
        const variance = received - expected;

        if (Math.abs(variance) > 100) {
            newWarnings.push(`ยอดต่างกัน ฿${formatCurrency(Math.abs(variance))} (${variance > 0 ? 'เกิน' : 'ขาด'})`);
            if (!varianceNote && Math.abs(variance) > 500) {
                newErrors.push('กรุณากรอกหมายเหตุเมื่อยอดต่างกันมาก');
            }
        }

        setErrors(newErrors);
        setWarnings(newWarnings);
        return newErrors.length === 0;
    };

    const handleClose = async () => {
        if (!validate() || !shift) return;

        setClosing(true);
        setErrors([]);

        try {
            const res = await fetch(`/api/v2/gas/${stationId}/shift/close`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    shiftId: shift.id,
                    reconciliation: {
                        cashReceived: parseFloat(cashReceived || '0'),
                        creditReceived: parseFloat(creditReceived || '0'),
                        cardReceived: parseFloat(cardReceived || '0'),
                        transferReceived: parseFloat(transferReceived || '0'),
                        expectedFuelAmount: calculateExpected(),
                        expectedOtherAmount: 0,
                        varianceNote
                    }
                })
            });

            if (res.ok) {
                setSuccess(true);
                setTimeout(() => {
                    router.push(`/gas/${stationId}`);
                }, 2000);
            } else {
                const data = await res.json();
                setErrors([data.error || 'ไม่สามารถปิดกะได้']);
            }
        } catch (error) {
            console.error('Error closing shift:', error);
            setErrors(['เกิดข้อผิดพลาด กรุณาลองใหม่']);
        } finally {
            setClosing(false);
        }
    };

    // Calculate reconciliation preview
    const reconciliationPreview = calculateReconciliation({
        cashReceived: parseFloat(cashReceived || '0'),
        creditReceived: parseFloat(creditReceived || '0'),
        cardReceived: parseFloat(cardReceived || '0'),
        transferReceived: parseFloat(transferReceived || '0'),
        expectedFuelAmount: calculateExpected(),
        expectedOtherAmount: 0
    });

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="animate-spin text-orange-400" size={40} />
            </div>
        );
    }

    if (!shift) {
        return (
            <div className="max-w-lg mx-auto text-center">
                <div className="bg-yellow-900/30 rounded-2xl p-8 border border-yellow-500/30">
                    <AlertCircle className="mx-auto text-yellow-400 mb-4" size={60} />
                    <h2 className="text-xl font-bold mb-2">ไม่มีกะที่เปิดอยู่</h2>
                    <button
                        onClick={() => router.push(`/gas/${stationId}`)}
                        className="bg-orange-600 hover:bg-orange-500 text-white px-6 py-3 rounded-xl mt-4"
                    >
                        กลับหน้าหลัก
                    </button>
                </div>
            </div>
        );
    }

    if (success) {
        return (
            <div className="max-w-lg mx-auto text-center">
                <div className="bg-green-900/30 rounded-2xl p-8 border border-green-500/30">
                    <CheckCircle className="mx-auto text-green-400 mb-4" size={60} />
                    <h2 className="text-2xl font-bold mb-2">ปิดกะสำเร็จ!</h2>
                    <p className="text-gray-400">กะ {shift.shiftNumber} เสร็จสิ้น</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-lg mx-auto">
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
                <button
                    onClick={() => router.push(`/gas/${stationId}`)}
                    className="p-2 hover:bg-white/10 rounded-lg"
                >
                    <ArrowLeft size={24} />
                </button>
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Clock className="text-red-400" size={28} />
                        ปิดกะ {shift.shiftNumber}
                    </h1>
                    <p className="text-gray-400 text-sm">
                        เปิดเมื่อ {new Date(shift.openedAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                </div>
            </div>

            {/* Status Summary */}
            <div className="bg-[#1a1a24] rounded-xl p-4 mb-4 border border-white/10">
                <h3 className="font-medium mb-3">สถานะข้อมูล</h3>
                <div className="grid grid-cols-2 gap-3">
                    <div className={`flex items-center gap-2 text-sm ${shift.meters.every(m => m.endReading !== null) ? 'text-green-400' : 'text-yellow-400'}`}>
                        <Calculator size={16} />
                        มิเตอร์: {shift.meters.filter(m => m.endReading !== null).length}/{NOZZLE_COUNT}
                    </div>
                    <div className={`flex items-center gap-2 text-sm ${shift.gauge.end?.length >= TANK_COUNT ? 'text-green-400' : 'text-yellow-400'}`}>
                        <Gauge size={16} />
                        เกจ: {shift.gauge.end?.length || 0}/{TANK_COUNT}
                    </div>
                </div>
            </div>

            {/* Errors & Warnings */}
            {errors.length > 0 && (
                <div className="bg-red-900/30 border border-red-500/30 rounded-xl p-4 mb-4">
                    <div className="flex items-center gap-2 text-red-400 mb-2">
                        <AlertCircle size={18} />
                        <span className="font-medium">ต้องแก้ไข</span>
                    </div>
                    <ul className="text-sm text-red-300 space-y-1">
                        {errors.map((e, i) => <li key={i}>• {e}</li>)}
                    </ul>
                </div>
            )}

            {warnings.length > 0 && (
                <div className="bg-yellow-900/30 border border-yellow-500/30 rounded-xl p-4 mb-4">
                    <div className="flex items-center gap-2 text-yellow-400 mb-2">
                        <AlertTriangle size={18} />
                        <span className="font-medium">แจ้งเตือน</span>
                    </div>
                    <ul className="text-sm text-yellow-300 space-y-1">
                        {warnings.map((w, i) => <li key={i}>• {w}</li>)}
                    </ul>
                </div>
            )}

            {/* Reconciliation Form */}
            <div className="bg-[#1a1a24] rounded-xl p-4 mb-4 border border-white/10">
                <h3 className="font-medium mb-4">กระทบยอด</h3>

                <div className="space-y-4">
                    {/* Cash */}
                    <div className="flex items-center gap-3">
                        <div className="w-24 flex items-center gap-2 text-green-400">
                            <Banknote size={18} />
                            <span>เงินสด</span>
                        </div>
                        <input
                            type="number"
                            value={cashReceived}
                            onChange={(e) => setCashReceived(e.target.value)}
                            className="flex-1 bg-gray-800 border border-white/10 rounded-lg px-4 py-2 text-right font-mono focus:border-orange-500 focus:outline-none"
                        />
                    </div>

                    {/* Credit */}
                    <div className="flex items-center gap-3">
                        <div className="w-24 flex items-center gap-2 text-purple-400">
                            <FuelIcon size={18} />
                            <span>เงินเชื่อ</span>
                        </div>
                        <input
                            type="number"
                            value={creditReceived}
                            onChange={(e) => setCreditReceived(e.target.value)}
                            className="flex-1 bg-gray-800 border border-white/10 rounded-lg px-4 py-2 text-right font-mono focus:border-orange-500 focus:outline-none"
                        />
                    </div>

                    {/* Card */}
                    <div className="flex items-center gap-3">
                        <div className="w-24 flex items-center gap-2 text-blue-400">
                            <CreditCard size={18} />
                            <span>บัตร</span>
                        </div>
                        <input
                            type="number"
                            value={cardReceived}
                            onChange={(e) => setCardReceived(e.target.value)}
                            className="flex-1 bg-gray-800 border border-white/10 rounded-lg px-4 py-2 text-right font-mono focus:border-orange-500 focus:outline-none"
                        />
                    </div>

                    {/* Transfer */}
                    <div className="flex items-center gap-3">
                        <div className="w-24 flex items-center gap-2 text-cyan-400">
                            <Smartphone size={18} />
                            <span>โอน</span>
                        </div>
                        <input
                            type="number"
                            value={transferReceived}
                            onChange={(e) => setTransferReceived(e.target.value)}
                            className="flex-1 bg-gray-800 border border-white/10 rounded-lg px-4 py-2 text-right font-mono focus:border-orange-500 focus:outline-none"
                        />
                    </div>
                </div>
            </div>

            {/* Reconciliation Preview */}
            <div className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-xl p-4 mb-4 border border-white/10">
                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                        <div className="text-gray-400">ยอดที่ควรได้ (มิเตอร์)</div>
                        <div className="text-xl font-bold">฿{formatCurrency(reconciliationPreview.totalExpected)}</div>
                    </div>
                    <div className="text-right">
                        <div className="text-gray-400">ยอดที่รับจริง</div>
                        <div className="text-xl font-bold">฿{formatCurrency(reconciliationPreview.totalReceived)}</div>
                    </div>
                </div>

                <div className="mt-3 pt-3 border-t border-white/10 flex justify-between items-center">
                    <span className="text-gray-400">ส่วนต่าง</span>
                    <span className={`text-xl font-bold ${getVarianceColorClass(reconciliationPreview.varianceStatus)}`}>
                        {reconciliationPreview.variance >= 0 ? '+' : ''}฿{formatCurrency(reconciliationPreview.variance)}
                        <span className="text-sm ml-2">({getVarianceText(reconciliationPreview.varianceStatus)})</span>
                    </span>
                </div>
            </div>

            {/* Variance Note */}
            {Math.abs(reconciliationPreview.variance) > 100 && (
                <div className="bg-[#1a1a24] rounded-xl p-4 mb-6 border border-white/10">
                    <label className="block text-sm text-gray-400 mb-2">
                        หมายเหตุ (กรณียอดไม่ตรง)
                    </label>
                    <textarea
                        value={varianceNote}
                        onChange={(e) => setVarianceNote(e.target.value)}
                        placeholder="อธิบายสาเหตุที่ยอดไม่ตรง..."
                        rows={2}
                        className="w-full bg-gray-800 border border-white/10 rounded-lg px-4 py-2 focus:border-orange-500 focus:outline-none resize-none"
                    />
                </div>
            )}

            {/* Close Button */}
            <button
                onClick={handleClose}
                disabled={closing}
                className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 disabled:opacity-50"
            >
                {closing ? <Loader2 className="animate-spin" size={24} /> : <Clock size={24} />}
                ปิดกะ
            </button>
        </div>
    );
}
