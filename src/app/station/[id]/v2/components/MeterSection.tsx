'use client';

import { useState } from 'react';
import { Save, AlertTriangle, Lock, CheckCircle } from 'lucide-react';

interface MeterReading {
    nozzleNumber: number;
    startReading: number;
    endReading: number | null;
    startPhoto?: string | null;
    endPhoto?: string | null;
}

type DayStatus = 'not_started' | 'recording' | 'closed';

interface MeterSectionProps {
    stationId: string;
    date: string;
    meters: MeterReading[];
    previousDayMeters: { nozzle: number; endReading: number }[];
    onSave: () => void;
    dayStatus?: DayStatus;
    isAdmin?: boolean;
}

export default function MeterSection({
    stationId,
    date,
    meters: initialMeters,
    previousDayMeters,
    onSave,
    dayStatus = 'recording',
    isAdmin = false,
}: MeterSectionProps) {
    const [activeTab, setActiveTab] = useState<'start' | 'end'>(() => {
        // Auto-select tab based on day status
        if (dayStatus === 'not_started') return 'start';
        if (dayStatus === 'closed') return 'end';
        return 'start';
    });
    const [saving, setSaving] = useState(false);
    const [meters, setMeters] = useState(() => {
        // Initialize with 4 nozzles if empty
        if (initialMeters.length === 0) {
            return [1, 2, 3, 4].map(n => ({
                nozzleNumber: n,
                startReading: 0,
                endReading: 0,
            }));
        }
        return initialMeters.map(m => ({
            ...m,
            endReading: m.endReading || 0,
        }));
    });

    // Validation errors
    const [validationErrors, setValidationErrors] = useState<string[]>([]);

    // Check for meter continuity warnings
    const warnings: string[] = [];
    if (previousDayMeters.length > 0) {
        meters.forEach(m => {
            const prev = previousDayMeters.find(p => p.nozzle === m.nozzleNumber);
            if (prev && prev.endReading > 0 && m.startReading > 0 && m.startReading !== prev.endReading) {
                warnings.push(
                    `หัวจ่าย ${m.nozzleNumber}: เมื่อวาน ${prev.endReading.toLocaleString('th-TH')} → วันนี้ ${m.startReading.toLocaleString('th-TH')}`
                );
            }
        });
    }

    // Check if meters are locked (day closed and not admin)
    const isStartLocked = dayStatus !== 'not_started' && !isAdmin;
    const isEndLocked = dayStatus === 'closed' && !isAdmin;

    const updateMeter = (nozzle: number, value: number) => {
        if ((activeTab === 'start' && isStartLocked) || (activeTab === 'end' && isEndLocked)) {
            return; // Don't update if locked
        }

        setMeters(prev =>
            prev.map(m =>
                m.nozzleNumber === nozzle
                    ? {
                        ...m,
                        [activeTab === 'start' ? 'startReading' : 'endReading']: value,
                    }
                    : m
            )
        );
        // Clear validation errors on change
        setValidationErrors([]);
    };

    // Validate end meter readings
    const validateEndMeters = (): boolean => {
        const errors: string[] = [];

        meters.forEach(m => {
            if (m.startReading > 0 && (m.endReading || 0) > 0) {
                if ((m.endReading || 0) < m.startReading) {
                    errors.push(`หัวจ่าย ${m.nozzleNumber}: มิเตอร์สิ้นสุด (${m.endReading}) น้อยกว่ามิเตอร์เริ่มต้น (${m.startReading})`);
                }
            }
        });

        setValidationErrors(errors);
        return errors.length === 0;
    };

    const handleSave = async () => {
        // Validate end meters before saving
        if (activeTab === 'end' && !validateEndMeters()) {
            return;
        }

        setSaving(true);
        try {
            const res = await fetch(`/api/station/${stationId}/meters`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date,
                    type: activeTab,
                    meters: meters.map(m => ({
                        nozzleNumber: m.nozzleNumber,
                        reading: activeTab === 'start' ? m.startReading : m.endReading,
                    })),
                }),
            });

            if (res.ok) {
                onSave();
            } else {
                const err = await res.json();
                alert(err.error || 'บันทึกไม่สำเร็จ');
            }
        } catch (error) {
            console.error('Save error:', error);
            alert('เกิดข้อผิดพลาด');
        } finally {
            setSaving(false);
        }
    };

    const formatNumber = (num: number) =>
        new Intl.NumberFormat('th-TH', { maximumFractionDigits: 2 }).format(num);

    const isCurrentTabLocked = (activeTab === 'start' && isStartLocked) || (activeTab === 'end' && isEndLocked);

    return (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            {/* Header with Yesterday Reference */}
            <div className="p-4 border-b border-gray-100">
                <div className="flex items-center justify-between">
                    <h2 className="font-bold text-gray-800 text-lg">📟 มิเตอร์ประจำวัน</h2>
                    {dayStatus === 'closed' && (
                        <span className="flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                            <Lock size={12} /> ปิดวันแล้ว
                        </span>
                    )}
                </div>
                {previousDayMeters.length > 0 && (
                    <p className="text-xs text-gray-400 mt-1">
                        เมื่อวาน:{' '}
                        {previousDayMeters.map((p, i) => (
                            <span key={p.nozzle}>
                                หัว{p.nozzle}: {formatNumber(p.endReading)}
                                {i < previousDayMeters.length - 1 ? ' | ' : ''}
                            </span>
                        ))}
                    </p>
                )}
            </div>

            {/* Continuity Warning */}
            {warnings.length > 0 && (
                <div className="mx-4 mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-xl">
                    <div className="flex items-start gap-2">
                        <AlertTriangle size={18} className="text-yellow-600 mt-0.5" />
                        <div>
                            <p className="text-yellow-700 text-sm font-medium">มิเตอร์ไม่ต่อเนื่อง</p>
                            <ul className="text-xs text-yellow-600 mt-1 space-y-0.5">
                                {warnings.map((w, i) => (
                                    <li key={i}>• {w}</li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            )}

            {/* Validation Errors */}
            {validationErrors.length > 0 && (
                <div className="mx-4 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl">
                    <div className="flex items-start gap-2">
                        <AlertTriangle size={18} className="text-red-600 mt-0.5" />
                        <div>
                            <p className="text-red-700 text-sm font-medium">มิเตอร์ไม่ถูกต้อง</p>
                            <ul className="text-xs text-red-600 mt-1 space-y-0.5">
                                {validationErrors.map((e, i) => (
                                    <li key={i}>• {e}</li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            )}

            {/* Tab Switch */}
            <div className="flex border-b border-gray-100">
                <button
                    onClick={() => setActiveTab('start')}
                    className={`flex-1 py-3 text-center font-medium transition flex items-center justify-center gap-2 ${activeTab === 'start'
                            ? 'text-blue-600 border-b-2 border-blue-600'
                            : 'text-gray-500'
                        }`}
                >
                    {isStartLocked && <Lock size={14} />}
                    📊 มิเตอร์เริ่มต้น
                    {dayStatus !== 'not_started' && <CheckCircle size={14} className="text-green-500" />}
                </button>
                <button
                    onClick={() => setActiveTab('end')}
                    className={`flex-1 py-3 text-center font-medium transition flex items-center justify-center gap-2 ${activeTab === 'end'
                            ? 'text-blue-600 border-b-2 border-blue-600'
                            : 'text-gray-500'
                        }`}
                >
                    {isEndLocked && <Lock size={14} />}
                    📊 มิเตอร์สิ้นสุด
                    {dayStatus === 'closed' && <CheckCircle size={14} className="text-green-500" />}
                </button>
            </div>

            {/* Locked Notice */}
            {isCurrentTabLocked && (
                <div className="mx-4 mt-4 p-3 bg-gray-50 border border-gray-200 rounded-xl flex items-center gap-2">
                    <Lock size={16} className="text-gray-500" />
                    <span className="text-sm text-gray-600">
                        {isAdmin ? 'คุณเป็น Admin สามารถแก้ไขได้' : 'ล็อคแล้ว ไม่สามารถแก้ไขได้'}
                    </span>
                </div>
            )}

            {/* Meter Inputs */}
            <div className="p-4 space-y-4">
                {meters.map(m => (
                    <div key={m.nozzleNumber} className={`bg-gray-50 rounded-xl p-4 ${isCurrentTabLocked && !isAdmin ? 'opacity-70' : ''}`}>
                        <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-gray-700">
                                หัวจ่าย {m.nozzleNumber}
                            </span>
                            {m.startReading > 0 && (m.endReading || 0) > 0 && (
                                <span className={`text-sm ${(m.endReading || 0) < m.startReading ? 'text-red-600' : 'text-green-600'}`}>
                                    ขาย {formatNumber((m.endReading || 0) - m.startReading)} ลิตร
                                </span>
                            )}
                        </div>
                        <input
                            type="number"
                            value={activeTab === 'start' ? m.startReading : m.endReading || ''}
                            onChange={e => updateMeter(m.nozzleNumber, parseFloat(e.target.value) || 0)}
                            disabled={isCurrentTabLocked && !isAdmin}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-xl font-mono text-right focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                            inputMode="numeric"
                            placeholder="0"
                        />
                    </div>
                ))}
            </div>

            {/* Summary */}
            <div className="mx-4 mb-4 p-3 bg-blue-50 rounded-xl">
                <div className="flex justify-between items-center">
                    <span className="text-blue-700">รวมขาย (ตามมิเตอร์)</span>
                    <span className="text-xl font-bold text-blue-800">
                        {formatNumber(
                            meters.reduce((sum, m) => sum + ((m.endReading || 0) - m.startReading), 0)
                        )}{' '}
                        ลิตร
                    </span>
                </div>
            </div>

            {/* Save Button */}
            {(!isCurrentTabLocked || isAdmin) && (
                <div className="p-4 pt-0">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="w-full py-3.5 bg-blue-500 text-white rounded-xl font-bold hover:bg-blue-600 transition disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {saving ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                กำลังบันทึก...
                            </>
                        ) : (
                            <>
                                <Save size={20} />
                                บันทึกมิเตอร์{activeTab === 'start' ? 'เริ่มต้น' : 'สิ้นสุด'}
                                {activeTab === 'end' && ' (ปิดวัน)'}
                            </>
                        )}
                    </button>
                </div>
            )}
        </div>
    );
}
