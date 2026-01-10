'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    Calculator,
    Camera,
    CheckCircle,
    Loader2,
    AlertCircle,
    ArrowLeft,
    Upload
} from 'lucide-react';
import { NOZZLE_COUNT, formatMeterReading } from '@/lib/gas';

interface MeterReading {
    nozzleNumber: number;
    startReading: number | null;
    endReading: number | null;
    soldQty: number | null;
}

export default function MetersPage() {
    const params = useParams();
    const router = useRouter();
    const stationId = params.stationId as string;

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState(false);
    const [recordType, setRecordType] = useState<'start' | 'end'>('end');

    // Current shift data
    const [shiftId, setShiftId] = useState<string | null>(null);
    const [existingReadings, setExistingReadings] = useState<MeterReading[]>([]);

    // Form inputs
    const [readings, setReadings] = useState<{ nozzle: number; value: string; photo: File | null }[]>(
        Array.from({ length: NOZZLE_COUNT }, (_, i) => ({ nozzle: i + 1, value: '', photo: null }))
    );

    const [errors, setErrors] = useState<string[]>([]);
    const fileInputRefs = useRef<(HTMLInputElement | null)[]>([]);

    // Fetch current shift and existing readings
    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await fetch(`/api/v2/gas/${stationId}/shift/current`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.shift) {
                        setShiftId(data.shift.id);
                        setExistingReadings(data.shift.meters || []);

                        // Check if start readings exist
                        const hasStart = data.shift.meters?.some((m: MeterReading) => m.startReading !== null);
                        if (hasStart) {
                            setRecordType('end');
                            // Pre-fill start readings for reference
                        } else {
                            setRecordType('start');
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

    const handleReadingChange = (index: number, value: string) => {
        const updated = [...readings];
        updated[index].value = value;
        setReadings(updated);
    };

    const handlePhotoChange = (index: number, file: File | null) => {
        const updated = [...readings];
        updated[index].photo = file;
        setReadings(updated);
    };

    const validateForm = (): boolean => {
        const newErrors: string[] = [];

        for (const r of readings) {
            if (!r.value || parseFloat(r.value) < 0) {
                newErrors.push(`หัวจ่าย ${r.nozzle}: ต้องกรอกตัวเลข`);
            }

            if (recordType === 'end') {
                const existing = existingReadings.find(e => e.nozzleNumber === r.nozzle);
                if (existing && existing.startReading !== null && parseFloat(r.value) < existing.startReading) {
                    newErrors.push(`หัวจ่าย ${r.nozzle}: ตัวเลขปิดต้องมากกว่าเปิด (${existing.startReading})`);
                }
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
            // Upload photos if any
            const photoUrls: (string | null)[] = await Promise.all(
                readings.map(async (r) => {
                    if (r.photo) {
                        const formData = new FormData();
                        formData.append('file', r.photo);
                        formData.append('type', 'meter');
                        formData.append('nozzle', String(r.nozzle));

                        const uploadRes = await fetch('/api/upload/meter-photo', {
                            method: 'POST',
                            body: formData
                        });

                        if (uploadRes.ok) {
                            const data = await uploadRes.json();
                            return data.url;
                        }
                    }
                    return null;
                })
            );

            const res = await fetch(`/api/v2/gas/${stationId}/meters`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    shiftId,
                    type: recordType,
                    readings: readings.map((r, i) => ({
                        nozzleNumber: r.nozzle,
                        reading: parseFloat(r.value),
                        photoUrl: photoUrls[i]
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
            console.error('Error saving meters:', error);
            setErrors(['เกิดข้อผิดพลาด กรุณาลองใหม่']);
        } finally {
            setSaving(false);
        }
    };

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
                    <p className="text-gray-400 mb-4">กรุณาเปิดกะก่อนบันทึกมิเตอร์</p>
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
                        <Calculator className="text-blue-400" size={28} />
                        บันทึกมิเตอร์
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

            {/* Meter Inputs */}
            <div className="space-y-4">
                {readings.map((r, i) => {
                    const existing = existingReadings.find(e => e.nozzleNumber === r.nozzle);
                    const startValue = existing?.startReading;

                    return (
                        <div key={r.nozzle} className="bg-[#1a1a24] rounded-xl p-4 border border-white/10">
                            <div className="flex items-center justify-between mb-2">
                                <label className="font-medium">หัวจ่าย {r.nozzle}</label>
                                {recordType === 'end' && startValue !== null && startValue !== undefined && (
                                    <span className="text-sm text-gray-400">
                                        เริ่ม: {formatMeterReading(startValue)}
                                    </span>
                                )}
                            </div>

                            <div className="flex gap-2">
                                <input
                                    type="number"
                                    step="0.01"
                                    value={r.value}
                                    onChange={(e) => handleReadingChange(i, e.target.value)}
                                    placeholder="0.00"
                                    className="flex-1 bg-gray-800 border border-white/10 rounded-lg px-4 py-3 font-mono text-lg focus:border-orange-500 focus:outline-none"
                                />

                                <input
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    ref={(el) => { fileInputRefs.current[i] = el; }}
                                    onChange={(e) => handlePhotoChange(i, e.target.files?.[0] || null)}
                                    className="hidden"
                                />

                                <button
                                    onClick={() => fileInputRefs.current[i]?.click()}
                                    className={`p-3 rounded-lg transition-colors ${r.photo
                                        ? 'bg-green-600 text-white'
                                        : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                                        }`}
                                >
                                    {r.photo ? <CheckCircle size={20} /> : <Camera size={20} />}
                                </button>
                            </div>

                            {r.photo && (
                                <div className="mt-2 text-xs text-green-400 flex items-center gap-1">
                                    <Upload size={12} />
                                    {r.photo.name}
                                </div>
                            )}

                            {recordType === 'end' && startValue !== null && startValue !== undefined && r.value && (
                                <div className="mt-2 text-right text-sm">
                                    <span className="text-gray-400">ขายได้: </span>
                                    <span className="text-green-400 font-mono font-bold">
                                        {(parseFloat(r.value) - startValue).toFixed(2)} ลิตร
                                    </span>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Submit */}
            <button
                onClick={handleSubmit}
                disabled={saving}
                className="w-full mt-6 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 disabled:opacity-50"
            >
                {saving ? <Loader2 className="animate-spin" size={24} /> : <CheckCircle size={24} />}
                บันทึก
            </button>
        </div>
    );
}
