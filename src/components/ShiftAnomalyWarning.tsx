'use client';

import { AlertTriangle, AlertCircle, CheckCircle } from 'lucide-react';

export interface AnomalyData {
    nozzleNumber: number;
    soldQty: number;
    averageQty: number;
    percentDiff: number;
    severity: 'WARNING' | 'CRITICAL';
    message: string;
}

interface ShiftAnomalyWarningProps {
    anomalies: AnomalyData[];
    requiresNote: boolean;
    note: string;
    onNoteChange: (note: string) => void;
    onConfirm: () => void;
    onCancel: () => void;
}

export function ShiftAnomalyWarning({
    anomalies,
    requiresNote,
    note,
    onNoteChange,
    onConfirm,
    onCancel
}: ShiftAnomalyWarningProps) {
    const hasCritical = anomalies.some(a => a.severity === 'CRITICAL');
    const canConfirm = !requiresNote || note.trim().length > 0;

    if (anomalies.length === 0) {
        return (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
                <div className="flex items-center gap-3">
                    <CheckCircle className="text-green-500" size={24} />
                    <div>
                        <p className="font-semibold text-green-700">ยอดขายปกติ</p>
                        <p className="text-sm text-green-600">ไม่พบความผิดปกติจากค่าเฉลี่ย</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={`border rounded-xl p-4 mb-4 ${hasCritical
                ? 'bg-red-50 border-red-300'
                : 'bg-yellow-50 border-yellow-300'
            }`}>
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
                {hasCritical ? (
                    <AlertCircle className="text-red-500" size={28} />
                ) : (
                    <AlertTriangle className="text-yellow-500" size={28} />
                )}
                <div>
                    <p className={`font-bold text-lg ${hasCritical ? 'text-red-700' : 'text-yellow-700'}`}>
                        ⚠️ พบความผิดปกติ {anomalies.length} รายการ
                    </p>
                    <p className={`text-sm ${hasCritical ? 'text-red-600' : 'text-yellow-600'}`}>
                        กรุณาตรวจสอบยอดขายก่อนปิดกะ
                    </p>
                </div>
            </div>

            {/* Anomaly List */}
            <div className="space-y-2 mb-4">
                {anomalies.map((a, i) => (
                    <div
                        key={i}
                        className={`p-3 rounded-lg ${a.severity === 'CRITICAL'
                                ? 'bg-red-100 border border-red-200'
                                : 'bg-yellow-100 border border-yellow-200'
                            }`}
                    >
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="font-semibold">
                                    ⛽ หัวจ่าย {a.nozzleNumber}
                                </p>
                                <p className="text-sm text-gray-600">
                                    {a.message}
                                </p>
                            </div>
                            <span className={`px-2 py-1 rounded text-xs font-bold ${a.severity === 'CRITICAL'
                                    ? 'bg-red-500 text-white'
                                    : 'bg-yellow-500 text-white'
                                }`}>
                                {a.severity === 'CRITICAL' ? '🔴 รุนแรง' : '🟡 ผิดปกติ'}
                            </span>
                        </div>
                        <div className="mt-2 text-sm text-gray-500 flex gap-4">
                            <span>ยอดขาย: <b>{a.soldQty.toLocaleString()}</b> ลิตร</span>
                            <span>ค่าเฉลี่ย: <b>{a.averageQty.toLocaleString()}</b> ลิตร</span>
                            <span>ต่าง: <b className={a.percentDiff > 0 ? 'text-green-600' : 'text-red-600'}>
                                {a.percentDiff > 0 ? '+' : ''}{a.percentDiff.toFixed(0)}%
                            </b></span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Note Input */}
            {requiresNote && (
                <div className="mb-4">
                    <label className="block text-sm font-medium text-red-700 mb-2">
                        🔒 กรุณาระบุเหตุผล (บังคับ)
                    </label>
                    <textarea
                        value={note}
                        onChange={(e) => onNoteChange(e.target.value)}
                        placeholder="อธิบายสาเหตุที่ยอดขายผิดปกติ..."
                        className="w-full p-3 border border-red-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                        rows={3}
                    />
                </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
                <button
                    onClick={onCancel}
                    className="flex-1 py-3 border border-gray-300 rounded-xl font-semibold text-gray-600 hover:bg-gray-50"
                >
                    ยกเลิก
                </button>
                <button
                    onClick={onConfirm}
                    disabled={!canConfirm}
                    className={`flex-1 py-3 rounded-xl font-semibold text-white ${canConfirm
                            ? hasCritical
                                ? 'bg-red-500 hover:bg-red-600'
                                : 'bg-yellow-500 hover:bg-yellow-600'
                            : 'bg-gray-300 cursor-not-allowed'
                        }`}
                >
                    {requiresNote && !canConfirm ? 'ใส่เหตุผลก่อน' : 'ยืนยันปิดกะ'}
                </button>
            </div>
        </div>
    );
}
