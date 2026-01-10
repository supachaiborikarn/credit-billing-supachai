'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    Gauge,
    CheckCircle,
    Loader2,
    AlertCircle,
    ArrowLeft
} from 'lucide-react';
import { TANK_COUNT, getGaugeBgClass, getGaugeColorClass, percentageToLiters, formatLiters } from '@/lib/gas';

interface GaugeReading {
    tankNumber: number;
    percentage: number | null;
}

export default function GaugePage() {
    const params = useParams();
    const router = useRouter();
    const stationId = params.stationId as string;

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState(false);
    const [recordType, setRecordType] = useState<'start' | 'end'>('end');

    // Current shift data
    const [shiftId, setShiftId] = useState<string | null>(null);
    const [existingGauge, setExistingGauge] = useState<GaugeReading[]>([]);

    // Form inputs
    const [gauges, setGauges] = useState<{ tank: number; value: string }[]>(
        Array.from({ length: TANK_COUNT }, (_, i) => ({ tank: i + 1, value: '' }))
    );

    const [errors, setErrors] = useState<string[]>([]);

    // Fetch current shift and existing gauge
    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await fetch(`/api/v2/gas/${stationId}/shift/current`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.shift) {
                        setShiftId(data.shift.id);

                        // Fetch gauge readings
                        const gaugeRes = await fetch(`/api/v2/gas/${stationId}/gauge?shiftId=${data.shift.id}`);
                        if (gaugeRes.ok) {
                            const gaugeData = await gaugeRes.json();
                            setExistingGauge(gaugeData.readings?.start || []);

                            // Check if start readings exist
                            const hasStart = gaugeData.readings?.start?.length > 0;
                            setRecordType(hasStart ? 'end' : 'start');
                        }
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

    const handleGaugeChange = (index: number, value: string) => {
        const updated = [...gauges];
        updated[index].value = value;
        setGauges(updated);
    };

    const validateForm = (): boolean => {
        const newErrors: string[] = [];

        for (const g of gauges) {
            const pct = parseFloat(g.value);
            if (!g.value || isNaN(pct) || pct < 0 || pct > 100) {
                newErrors.push(`ถัง ${g.tank}: ต้องกรอกเปอร์เซ็นต์ (0-100)`);
            }
        }

        setErrors(newErrors);
        return newErrors.length === 0;
    };

    const handleSubmit = async () => {
        if (!validateForm() || !shiftId) return;

        setSaving(true);
        setErrors([]);

        try {
            const res = await fetch(`/api/v2/gas/${stationId}/gauge`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    shiftId,
                    type: recordType,
                    readings: gauges.map(g => ({
                        tankNumber: g.tank,
                        percentage: parseFloat(g.value)
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
                setErrors([data.error || 'ไม่สามารถบันทึกได้']);
            }
        } catch (error) {
            console.error('Error saving gauge:', error);
            setErrors(['เกิดข้อผิดพลาด กรุณาลองใหม่']);
        } finally {
            setSaving(false);
        }
    };

    // Calculate total liters
    const totalLiters = gauges.reduce((sum, g) => {
        const pct = parseFloat(g.value);
        if (!isNaN(pct)) {
            return sum + percentageToLiters(pct);
        }
        return sum;
    }, 0);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="animate-spin text-orange-400" size={40} />
            </div>
        );
    }

    if (!shiftId) {
        return (
            <div className="max-w-lg mx-auto text-center">
                <div className="bg-yellow-900/30 rounded-2xl p-8 border border-yellow-500/30">
                    <AlertCircle className="mx-auto text-yellow-400 mb-4" size={60} />
                    <h2 className="text-xl font-bold mb-2">ไม่มีกะที่เปิดอยู่</h2>
                    <p className="text-gray-400 mb-4">กรุณาเปิดกะก่อนเช็คเกจ</p>
                    <button
                        onClick={() => router.push(`/gas/${stationId}/shift/open`)}
                        className="bg-orange-600 hover:bg-orange-500 text-white px-6 py-3 rounded-xl"
                    >
                        เปิดกะ
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
                    <h2 className="text-2xl font-bold mb-2">บันทึกสำเร็จ!</h2>
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
                        <Gauge className="text-orange-400" size={28} />
                        เช็คเกจ
                    </h1>
                </div>
            </div>

            {/* Record Type Toggle */}
            <div className="flex gap-2 mb-6">
                <button
                    onClick={() => setRecordType('start')}
                    className={`flex-1 py-3 rounded-xl font-medium transition-all ${recordType === 'start'
                        ? 'bg-orange-600 text-white'
                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                        }`}
                >
                    เริ่มกะ
                </button>
                <button
                    onClick={() => setRecordType('end')}
                    className={`flex-1 py-3 rounded-xl font-medium transition-all ${recordType === 'end'
                        ? 'bg-orange-600 text-white'
                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                        }`}
                >
                    ปิดกะ
                </button>
            </div>

            {/* Errors */}
            {errors.length > 0 && (
                <div className="bg-red-900/30 border border-red-500/30 rounded-xl p-4 mb-6">
                    <ul className="text-sm text-red-300 space-y-1">
                        {errors.map((e, i) => <li key={i}>• {e}</li>)}
                    </ul>
                </div>
            )}

            {/* Tank Visual Inputs */}
            <div className="bg-[#1a1a24] rounded-2xl p-6 border border-white/10 mb-6">
                <div className="grid grid-cols-3 gap-6">
                    {gauges.map((g, i) => {
                        const pct = parseFloat(g.value) || 0;
                        const existingStart = existingGauge.find(e => e.tankNumber === g.tank);

                        return (
                            <div key={g.tank} className="text-center">
                                {/* Tank Visual */}
                                <div className="relative w-full h-32 mx-auto mb-4 bg-gray-800 rounded-lg overflow-hidden border-2 border-white/10">
                                    {g.value && (
                                        <div
                                            className={`absolute bottom-0 left-0 right-0 transition-all duration-300 ${getGaugeBgClass(pct)}`}
                                            style={{ height: `${Math.min(100, Math.max(0, pct))}%` }}
                                        />
                                    )}
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <span className={`text-2xl font-bold ${g.value ? 'text-white drop-shadow-lg' : 'text-gray-600'}`}>
                                            {g.value ? `${Math.round(pct)}%` : '?'}
                                        </span>
                                    </div>
                                </div>

                                {/* Tank Label */}
                                <div className="text-sm text-gray-400 mb-2">ถัง {g.tank}</div>

                                {/* Input */}
                                <div className="relative">
                                    <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        value={g.value}
                                        onChange={(e) => handleGaugeChange(i, e.target.value)}
                                        placeholder="0"
                                        className="w-full bg-gray-800 border border-white/10 rounded-lg px-3 py-2 font-mono text-lg text-center focus:border-orange-500 focus:outline-none"
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">%</span>
                                </div>

                                {/* Liters */}
                                {g.value && (
                                    <div className={`mt-2 text-sm ${getGaugeColorClass(pct)}`}>
                                        ≈ {formatLiters(percentageToLiters(pct))}
                                    </div>
                                )}

                                {/* Show start value for end type */}
                                {recordType === 'end' && existingStart && existingStart.percentage !== null && (
                                    <div className="mt-1 text-xs text-gray-500">
                                        เริ่ม: {existingStart.percentage}%
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Total Summary */}
            {gauges.some(g => g.value) && (
                <div className="bg-gradient-to-r from-orange-900/30 to-red-900/30 rounded-xl p-4 mb-6 border border-orange-500/30">
                    <div className="flex justify-between items-center">
                        <span className="text-gray-400">รวมประมาณ</span>
                        <span className="text-2xl font-bold text-orange-400">
                            {formatLiters(totalLiters)}
                        </span>
                    </div>
                </div>
            )}

            {/* Submit */}
            <button
                onClick={handleSubmit}
                disabled={saving}
                className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 disabled:opacity-50"
            >
                {saving ? <Loader2 className="animate-spin" size={24} /> : <CheckCircle size={24} />}
                บันทึก
            </button>
        </div>
    );
}
