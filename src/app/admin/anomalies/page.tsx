'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ArrowLeft, RefreshCw, CheckCircle } from 'lucide-react';
import Link from 'next/link';

interface Anomaly {
    id: string;
    nozzleNumber: number;
    soldQty: number;
    averageQty: number;
    percentDiff: number;
    severity: 'WARNING' | 'CRITICAL';
    note: string | null;
    reviewedAt: string | null;
    createdAt: string;
    shift: {
        shiftNumber: number;
        dailyRecord: {
            date: string;
            station: { name: string };
        };
    };
}

export default function AnomalyReviewPage() {
    const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
    const [loading, setLoading] = useState(true);
    const [reviewing, setReviewing] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [hasLoaded, setHasLoaded] = useState(false);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/anomalies');
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || 'โหลด anomaly ไม่สำเร็จ');
            setAnomalies(data.anomalies || []);
            setError(null);
            setHasLoaded(true);
        } catch (fetchError) {
            console.error('Fetch error:', fetchError);
            setError(fetchError instanceof Error ? fetchError.message : 'โหลด anomaly ไม่สำเร็จ');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void fetchData();
    }, [fetchData]);

    const handleMarkReviewed = async (anomalyId: string) => {
        setReviewing(anomalyId);
        try {
            const res = await fetch(`/api/admin/anomalies/${anomalyId}/review`, {
                method: 'POST'
            });

            if (res.ok) {
                setAnomalies(prev => prev.filter(a => a.id !== anomalyId));
            } else {
                const err = await res.json();
                alert(err.error || 'ทำเครื่องหมายไม่สำเร็จ');
            }
        } catch (error) {
            console.error('Review error:', error);
        } finally {
            setReviewing(null);
        }
    };

    if (!loading && !hasLoaded && error) {
        return (
            <div className="min-h-screen bg-gray-100 p-6">
                <div className="mx-auto max-w-xl rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-red-700" role="alert">
                    <AlertTriangle className="mx-auto mb-3" size={32} />
                    <div className="font-semibold">โหลดรายการ anomaly ไม่สำเร็จ</div>
                    <div className="mt-2 text-sm">{error}</div>
                    <button type="button" onClick={() => void fetchData()} className="mt-4 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white">ลองใหม่</button>
                </div>
            </div>
        );
    }

    const criticalCount = anomalies.filter(a => a.severity === 'CRITICAL').length;
    const warningCount = anomalies.filter(a => a.severity === 'WARNING').length;

    return (
        <div className="min-h-screen bg-gray-100">
            {/* Header */}
            <header className="bg-white shadow-sm sticky top-0 z-40">
                <div className="px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link href="/today" className="p-1">
                            <ArrowLeft size={24} className="text-gray-700" />
                        </Link>
                        <h1 className="font-bold text-gray-800 text-lg">⚠️ ตรวจสอบความผิดปกติ</h1>
                    </div>
                    <button
                        onClick={() => void fetchData()}
                        className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200"
                    >
                        <RefreshCw size={20} className={`text-gray-600 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </header>

            <div className="p-4">
                {/* Summary */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className={`rounded-2xl p-4 text-white ${criticalCount > 0
                        ? 'bg-gradient-to-r from-red-500 to-red-600'
                        : 'bg-gradient-to-r from-gray-400 to-gray-500'
                        }`}>
                        <p className="text-white/80 text-sm">🔴 รุนแรง</p>
                        <p className="text-2xl font-bold">{criticalCount} รายการ</p>
                    </div>
                    <div className={`rounded-2xl p-4 text-white ${warningCount > 0
                        ? 'bg-gradient-to-r from-yellow-500 to-orange-500'
                        : 'bg-gradient-to-r from-gray-400 to-gray-500'
                        }`}>
                        <p className="text-white/80 text-sm">🟡 ผิดปกติ</p>
                        <p className="text-2xl font-bold">{warningCount} รายการ</p>
                    </div>
                </div>

                {/* List */}
                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500"></div>
                    </div>
                ) : anomalies.length === 0 ? (
                    <div className="bg-green-50 border border-green-200 rounded-2xl p-8 text-center">
                        <CheckCircle className="mx-auto text-green-500 mb-4" size={48} />
                        <p className="font-semibold text-green-700">ไม่มีรายการรอตรวจสอบ 🎉</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {anomalies.map((a) => (
                            <div key={a.id}
                                className={`border rounded-2xl p-4 ${a.severity === 'CRITICAL'
                                    ? 'bg-red-50 border-red-200'
                                    : 'bg-yellow-50 border-yellow-200'
                                    }`}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <p className="font-semibold text-gray-800">
                                            ⛽ หัวจ่าย {a.nozzleNumber}
                                        </p>
                                        <p className="text-sm text-gray-500">
                                            {a.shift.dailyRecord.station.name} • กะ {a.shift.shiftNumber}
                                        </p>
                                    </div>
                                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${a.severity === 'CRITICAL'
                                        ? 'bg-red-500 text-white'
                                        : 'bg-yellow-500 text-white'
                                        }`}>
                                        {a.severity === 'CRITICAL' ? '🔴 รุนแรง' : '🟡 ผิดปกติ'}
                                    </span>
                                </div>

                                <div className="grid grid-cols-3 gap-2 text-sm mb-3">
                                    <div className="text-center">
                                        <p className="text-gray-400">ยอดขาย</p>
                                        <p className="font-bold">{Number(a.soldQty).toLocaleString()} ล.</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-gray-400">ค่าเฉลี่ย</p>
                                        <p className="font-bold">{Number(a.averageQty).toLocaleString()} ล.</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-gray-400">ต่าง</p>
                                        <p className={`font-bold ${Number(a.percentDiff) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {Number(a.percentDiff) > 0 ? '+' : ''}{Number(a.percentDiff).toFixed(0)}%
                                        </p>
                                    </div>
                                </div>

                                {a.note && (
                                    <div className="bg-white/50 rounded-lg p-2 mb-3 text-sm">
                                        <p className="text-gray-500">📝 หมายเหตุ: {a.note}</p>
                                    </div>
                                )}

                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleMarkReviewed(a.id)}
                                        disabled={reviewing === a.id}
                                        className="flex-1 py-2 bg-green-500 text-white rounded-xl flex items-center justify-center gap-2 hover:bg-green-600 disabled:opacity-50"
                                    >
                                        {reviewing === a.id ? (
                                            <RefreshCw size={16} className="animate-spin" />
                                        ) : (
                                            <CheckCircle size={16} />
                                        )}
                                        ตรวจสอบแล้ว
                                    </button>
                                </div>

                                <p className="text-xs text-gray-400 mt-2 text-right">
                                    {new Date(a.createdAt).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok' })}
                                </p>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
