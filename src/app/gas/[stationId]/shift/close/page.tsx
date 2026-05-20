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
    AlertTriangle,
    ReceiptText,
    ShoppingBag
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

const EMPTY_SALES: ShiftData['sales'] = {
    cash: 0,
    credit: 0,
    card: 0,
    transfer: 0,
    total: 0,
    liters: 0,
};

function parseAmount(value: string): number {
    if (!value.trim()) {
        return 0;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : NaN;
}

function parsePreviewAmount(value: string): number {
    const parsed = parseAmount(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
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
    const [nonGasSalesAmount, setNonGasSalesAmount] = useState<string>('');
    const [otherExpensesAmount, setOtherExpensesAmount] = useState<string>('');
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
                        const sales = data.shift.sales || data.sales || EMPTY_SALES;
                        setShift({
                            ...data.shift,
                            sales,
                        });

                        // Pre-fill reconciliation from sales
                        setCashReceived(String(sales.cash || 0));
                        setCreditReceived(String(sales.credit || 0));
                        setCardReceived(String(sales.card || 0));
                        setTransferReceived(String(sales.transfer || 0));
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

    const calculateExpectedOtherAmount = (): number => Number((
        parsePreviewAmount(nonGasSalesAmount) - parsePreviewAmount(otherExpensesAmount)
    ).toFixed(2));

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

        const parsedCashReceived = parseAmount(cashReceived);
        const parsedCreditReceived = parseAmount(creditReceived);
        const parsedCardReceived = parseAmount(cardReceived);
        const parsedTransferReceived = parseAmount(transferReceived);
        const parsedNonGasSalesAmount = parseAmount(nonGasSalesAmount);
        const parsedOtherExpensesAmount = parseAmount(otherExpensesAmount);
        const parsedAmounts = [
            parsedCashReceived,
            parsedCreditReceived,
            parsedCardReceived,
            parsedTransferReceived,
            parsedNonGasSalesAmount,
            parsedOtherExpensesAmount,
        ];

        if (parsedAmounts.some((amount) => !Number.isFinite(amount) || amount < 0)) {
            newErrors.push('ยอดเงินรับจริง ยอดขายอื่น และค่าใช้จ่ายต้องเป็นตัวเลขไม่ติดลบ');
        }

        // Validate amounts
        if ([
            parsedCashReceived,
            parsedCreditReceived,
            parsedCardReceived,
            parsedTransferReceived,
        ].every((amount) => amount === 0)) {
            newErrors.push('ต้องกรอกยอดเงินอย่างน้อย 1 ช่อง');
        }

        // Calculate variance
        const expected = calculateExpected()
            + (Number.isFinite(parsedNonGasSalesAmount) ? parsedNonGasSalesAmount : 0)
            - (Number.isFinite(parsedOtherExpensesAmount) ? parsedOtherExpensesAmount : 0);
        const received = parsedAmounts.every((amount) => Number.isFinite(amount))
            ? parsedCashReceived + parsedCreditReceived + parsedCardReceived + parsedTransferReceived
            : 0;
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
                        cashReceived: parseAmount(cashReceived),
                        creditReceived: parseAmount(creditReceived),
                        cardReceived: parseAmount(cardReceived),
                        transferReceived: parseAmount(transferReceived),
                        expectedFuelAmount: calculateExpected(),
                        expectedOtherAmount: calculateExpectedOtherAmount(),
                        nonGasSalesAmount: parseAmount(nonGasSalesAmount),
                        otherExpensesAmount: parseAmount(otherExpensesAmount),
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
        cashReceived: parsePreviewAmount(cashReceived),
        creditReceived: parsePreviewAmount(creditReceived),
        cardReceived: parsePreviewAmount(cardReceived),
        transferReceived: parsePreviewAmount(transferReceived),
        expectedFuelAmount: calculateExpected(),
        expectedOtherAmount: calculateExpectedOtherAmount()
    });
    const expectedFuelAmount = calculateExpected();
    const previewNonGasSalesAmount = parsePreviewAmount(nonGasSalesAmount);
    const previewOtherExpensesAmount = parsePreviewAmount(otherExpensesAmount);
    const previewExpectedNetCashToSubmit = shift
        ? Number((
            (shift.sales?.cash || 0)
            + previewNonGasSalesAmount
            - previewOtherExpensesAmount
        ).toFixed(2))
        : 0;

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
                        <div className="w-32 flex items-center gap-2 text-green-400">
                            <Banknote size={18} />
                            <span>เงินสดส่งจริง</span>
                        </div>
                        <input
                            type="number"
                            min="0"
                            step="0.01"
                            inputMode="decimal"
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
                            min="0"
                            step="0.01"
                            inputMode="decimal"
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
                            min="0"
                            step="0.01"
                            inputMode="decimal"
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
                            min="0"
                            step="0.01"
                            inputMode="decimal"
                            value={transferReceived}
                            onChange={(e) => setTransferReceived(e.target.value)}
                            className="flex-1 bg-gray-800 border border-white/10 rounded-lg px-4 py-2 text-right font-mono focus:border-orange-500 focus:outline-none"
                        />
                    </div>

                    <div className="border-t border-white/10 pt-4 space-y-4">
                        <div className="text-xs font-medium uppercase tracking-wide text-gray-500">
                            รายการเพิ่มเติม
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="w-32 flex items-center gap-2 text-amber-400">
                                <ShoppingBag size={18} />
                                <span>ขายอื่น</span>
                            </div>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                inputMode="decimal"
                                value={nonGasSalesAmount}
                                onChange={(e) => setNonGasSalesAmount(e.target.value)}
                                placeholder="0"
                                className="flex-1 bg-gray-800 border border-white/10 rounded-lg px-4 py-2 text-right font-mono focus:border-orange-500 focus:outline-none"
                            />
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="w-32 flex items-center gap-2 text-red-300">
                                <ReceiptText size={18} />
                                <span>ค่าใช้จ่ายจากเงินสด</span>
                            </div>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                inputMode="decimal"
                                value={otherExpensesAmount}
                                onChange={(e) => setOtherExpensesAmount(e.target.value)}
                                placeholder="0"
                                className="flex-1 bg-gray-800 border border-white/10 rounded-lg px-4 py-2 text-right font-mono focus:border-orange-500 focus:outline-none"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Reconciliation Preview */}
            <div className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-xl p-4 mb-4 border border-white/10">
                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                        <div className="text-gray-400">ยอดที่ควรได้สุทธิ</div>
                        <div className="text-xl font-bold">฿{formatCurrency(reconciliationPreview.totalExpected)}</div>
                    </div>
                    <div className="text-right">
                        <div className="text-gray-400">ยอดที่รับจริง</div>
                        <div className="text-xl font-bold">฿{formatCurrency(reconciliationPreview.totalReceived)}</div>
                    </div>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-1 border-t border-white/10 pt-3 text-xs text-gray-400">
                    <div className="flex justify-between">
                        <span>ยอดแก๊สจากมิเตอร์</span>
                        <span className="font-mono text-gray-200">฿{formatCurrency(expectedFuelAmount)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>+ ยอดขายอื่นที่ไม่ใช่แก๊ส</span>
                        <span className="font-mono text-amber-300">฿{formatCurrency(previewNonGasSalesAmount)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>- ค่าใช้จ่ายอื่นๆ</span>
                        <span className="font-mono text-red-300">฿{formatCurrency(previewOtherExpensesAmount)}</span>
                    </div>
                    <div className="mt-2 border-t border-white/10 pt-2 flex justify-between">
                        <span>เงินสดควรส่งสุทธิ</span>
                        <span className="font-mono text-green-300">฿{formatCurrency(previewExpectedNetCashToSubmit)}</span>
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
