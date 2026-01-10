'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    Play,
    Calculator,
    Gauge,
    AlertCircle,
    Loader2,
    CheckCircle
} from 'lucide-react';
import { getTodayBangkok, getCurrentShiftNumber, getShiftName, NOZZLE_COUNT, TANK_COUNT } from '@/lib/gas';

interface MeterInput {
    nozzleNumber: number;
    reading: string;
}

interface GaugeInput {
    tankNumber: number;
    percentage: string;
}

export default function ShiftOpenPage() {
    const params = useParams();
    const router = useRouter();
    const stationId = params.stationId as string;

    const [loading, setLoading] = useState(false);
    const [checkingShift, setCheckingShift] = useState(true);
    const [existingShift, setExistingShift] = useState<{ id: string } | null>(null);
    const [step, setStep] = useState<'meters' | 'gauge' | 'confirm'>('meters');

    // Meter readings
    const [meters, setMeters] = useState<MeterInput[]>(
        Array.from({ length: NOZZLE_COUNT }, (_, i) => ({ nozzleNumber: i + 1, reading: '' }))
    );

    // Gauge readings
    const [gauges, setGauges] = useState<GaugeInput[]>(
        Array.from({ length: TANK_COUNT }, (_, i) => ({ tankNumber: i + 1, percentage: '' }))
    );

    const [errors, setErrors] = useState<string[]>([]);
    const [success, setSuccess] = useState(false);

    // Check if shift already exists
    useEffect(() => {
        const checkShift = async () => {
            try {
                const res = await fetch(`/api/v2/gas/${stationId}/shift/current`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.shift && data.shift.status === 'OPEN') {
                        setExistingShift(data.shift);
                    }
                }
            } catch (error) {
                console.error('Error checking shift:', error);
            } finally {
                setCheckingShift(false);
            }
        };
        checkShift();
    }, [stationId]);

    const handleMeterChange = (index: number, value: string) => {
        const updated = [...meters];
        updated[index].reading = value;
        setMeters(updated);
    };

    const handleGaugeChange = (index: number, value: string) => {
        const updated = [...gauges];
        updated[index].percentage = value;
        setGauges(updated);
    };

    const validateMeters = (): boolean => {
        const newErrors: string[] = [];
        for (const m of meters) {
            if (!m.reading || parseFloat(m.reading) < 0) {
                newErrors.push(`หัวจ่าย ${m.nozzleNumber}: ต้องกรอกตัวเลข`);
            }
        }
        setErrors(newErrors);
        return newErrors.length === 0;
    };

    const validateGauges = (): boolean => {
        const newErrors: string[] = [];
        for (const g of gauges) {
            const pct = parseFloat(g.percentage);
            if (!g.percentage || isNaN(pct) || pct < 0 || pct > 100) {
                newErrors.push(`ถัง ${g.tankNumber}: ต้องกรอกเปอร์เซ็นต์ (0-100)`);
            }
        }
        setErrors(newErrors);
        return newErrors.length === 0;
    };

    const handleNextStep = () => {
        if (step === 'meters') {
            if (validateMeters()) {
                setStep('gauge');
                setErrors([]);
            }
        } else if (step === 'gauge') {
            if (validateGauges()) {
                setStep('confirm');
                setErrors([]);
            }
        }
    };

    const handleOpenShift = async () => {
        setLoading(true);
        setErrors([]);

        try {
            const res = await fetch(`/api/v2/gas/${stationId}/shift/open`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    dateKey: getTodayBangkok(),
                    shiftNumber: getCurrentShiftNumber(),
                    meters: meters.map(m => ({
                        nozzleNumber: m.nozzleNumber,
                        reading: parseFloat(m.reading)
                    })),
                    gauges: gauges.map(g => ({
                        tankNumber: g.tankNumber,
                        percentage: parseFloat(g.percentage)
                    }))
                })
            });

            if (res.ok) {
                setSuccess(true);
                setTimeout(() => {
                    router.push(`/gas/${stationId}`);
                }, 1500);
            } else {
                const data = await res.json();
                setErrors([data.error || 'ไม่สามารถเปิดกะได้']);
            }
        } catch (error) {
            console.error('Error opening shift:', error);
            setErrors(['เกิดข้อผิดพลาด กรุณาลองใหม่']);
        } finally {
            setLoading(false);
        }
    };

    if (checkingShift) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="animate-spin text-orange-400" size={40} />
            </div>
        );
    }

    if (existingShift) {
        return (
            <div className="max-w-lg mx-auto text-center">
                <div className="bg-green-900/30 rounded-2xl p-8 border border-green-500/30">
                    <CheckCircle className="mx-auto text-green-400 mb-4" size={60} />
                    <h2 className="text-2xl font-bold mb-2">มีกะที่เปิดอยู่แล้ว</h2>
                    <p className="text-gray-400 mb-6">กรุณาปิดกะปัจจุบันก่อนเปิดกะใหม่</p>
                    <button
                        onClick={() => router.push(`/gas/${stationId}`)}
                        className="bg-green-600 hover:bg-green-500 text-white px-6 py-3 rounded-xl font-medium"
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
                    <h2 className="text-2xl font-bold mb-2">เปิดกะสำเร็จ!</h2>
                    <p className="text-gray-400">กำลังไปหน้าหลัก...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-lg mx-auto">
            {/* Header */}
            <div className="text-center mb-6">
                <h1 className="text-2xl font-bold mb-2">
                    <Play className="inline mr-2 text-orange-400" size={28} />
                    เปิดกะใหม่
                </h1>
                <p className="text-gray-400">
                    {getTodayBangkok()} | {getShiftName(getCurrentShiftNumber())}
                </p>
            </div>

            {/* Progress Steps */}
            <div className="flex items-center justify-center gap-4 mb-8">
                {['meters', 'gauge', 'confirm'].map((s, i) => (
                    <div key={s} className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${step === s ? 'bg-orange-500 text-white' :
                                ['meters', 'gauge', 'confirm'].indexOf(step) > i ? 'bg-green-500 text-white' :
                                    'bg-gray-700 text-gray-400'
                            }`}>
                            {i + 1}
                        </div>
                        {i < 2 && <div className="w-8 h-1 bg-gray-700" />}
                    </div>
                ))}
            </div>

            {/* Errors */}
            {errors.length > 0 && (
                <div className="bg-red-900/30 border border-red-500/30 rounded-xl p-4 mb-6">
                    <div className="flex items-center gap-2 text-red-400 mb-2">
                        <AlertCircle size={20} />
                        <span className="font-medium">กรุณาแก้ไข</span>
                    </div>
                    <ul className="text-sm text-red-300 space-y-1">
                        {errors.map((e, i) => <li key={i}>• {e}</li>)}
                    </ul>
                </div>
            )}

            {/* Step 1: Meters */}
            {step === 'meters' && (
                <div className="bg-[#1a1a24] rounded-2xl p-6 border border-white/10">
                    <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
                        <Calculator className="text-blue-400" size={20} />
                        บันทึกมิเตอร์เริ่มกะ
                    </h2>

                    <div className="grid grid-cols-2 gap-4">
                        {meters.map((m, i) => (
                            <div key={m.nozzleNumber}>
                                <label className="block text-sm text-gray-400 mb-1">
                                    หัวจ่าย {m.nozzleNumber}
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={m.reading}
                                    onChange={(e) => handleMeterChange(i, e.target.value)}
                                    placeholder="0.00"
                                    className="w-full bg-gray-800 border border-white/10 rounded-lg px-4 py-3 text-white font-mono text-lg focus:border-orange-500 focus:outline-none"
                                />
                            </div>
                        ))}
                    </div>

                    <button
                        onClick={handleNextStep}
                        className="w-full mt-6 bg-gradient-to-r from-orange-500 to-red-500 text-white py-3 rounded-xl font-medium hover:from-orange-600 hover:to-red-600"
                    >
                        ถัดไป: เช็คเกจ
                    </button>
                </div>
            )}

            {/* Step 2: Gauge */}
            {step === 'gauge' && (
                <div className="bg-[#1a1a24] rounded-2xl p-6 border border-white/10">
                    <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
                        <Gauge className="text-orange-400" size={20} />
                        เช็คเกจเริ่มกะ
                    </h2>

                    <div className="grid grid-cols-3 gap-4">
                        {gauges.map((g, i) => (
                            <div key={g.tankNumber} className="text-center">
                                <label className="block text-sm text-gray-400 mb-2">
                                    ถัง {g.tankNumber}
                                </label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        value={g.percentage}
                                        onChange={(e) => handleGaugeChange(i, e.target.value)}
                                        placeholder="0"
                                        className="w-full bg-gray-800 border border-white/10 rounded-lg px-4 py-3 text-white font-mono text-lg text-center focus:border-orange-500 focus:outline-none"
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">%</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="flex gap-4 mt-6">
                        <button
                            onClick={() => setStep('meters')}
                            className="flex-1 bg-gray-700 text-white py-3 rounded-xl font-medium hover:bg-gray-600"
                        >
                            ย้อนกลับ
                        </button>
                        <button
                            onClick={handleNextStep}
                            className="flex-1 bg-gradient-to-r from-orange-500 to-red-500 text-white py-3 rounded-xl font-medium hover:from-orange-600 hover:to-red-600"
                        >
                            ถัดไป: ยืนยัน
                        </button>
                    </div>
                </div>
            )}

            {/* Step 3: Confirm */}
            {step === 'confirm' && (
                <div className="bg-[#1a1a24] rounded-2xl p-6 border border-white/10">
                    <h2 className="text-lg font-medium mb-4">ยืนยันข้อมูลเปิดกะ</h2>

                    {/* Meters Summary */}
                    <div className="mb-4">
                        <h3 className="text-sm text-gray-400 mb-2">มิเตอร์:</h3>
                        <div className="grid grid-cols-4 gap-2">
                            {meters.map(m => (
                                <div key={m.nozzleNumber} className="bg-gray-800 rounded-lg p-2 text-center">
                                    <div className="text-xs text-gray-400">หัวจ่าย {m.nozzleNumber}</div>
                                    <div className="font-mono text-green-400">{parseFloat(m.reading).toFixed(2)}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Gauge Summary */}
                    <div className="mb-6">
                        <h3 className="text-sm text-gray-400 mb-2">เกจ:</h3>
                        <div className="grid grid-cols-3 gap-2">
                            {gauges.map(g => (
                                <div key={g.tankNumber} className="bg-gray-800 rounded-lg p-2 text-center">
                                    <div className="text-xs text-gray-400">ถัง {g.tankNumber}</div>
                                    <div className="font-mono text-orange-400">{g.percentage}%</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <button
                            onClick={() => setStep('gauge')}
                            className="flex-1 bg-gray-700 text-white py-3 rounded-xl font-medium hover:bg-gray-600"
                        >
                            แก้ไข
                        </button>
                        <button
                            onClick={handleOpenShift}
                            disabled={loading}
                            className="flex-1 bg-gradient-to-r from-green-500 to-green-600 text-white py-3 rounded-xl font-medium hover:from-green-600 hover:to-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {loading ? <Loader2 className="animate-spin" size={20} /> : <Play size={20} />}
                            เปิดกะ
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
