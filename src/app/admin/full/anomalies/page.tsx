'use client';

import { useCallback, useEffect, useState } from 'react';
import {
    AlertTriangle,
    CheckCircle,
    Loader2,
    RefreshCw,
    TrendingDown,
    XCircle,
    Activity
} from 'lucide-react';
import { getTodayBangkok } from '@/lib/date-utils';

interface Anomaly {
    type: string;
    severity: 'WARNING' | 'CRITICAL';
    message: string;
    date: string;
}

interface AnomalyData {
    station: { id: string; name: string };
    anomalies: Anomaly[];
    stats: { avgDailyVolume: number; stdDevVolume: number };
}

const formatNumber = (n: number) => n.toLocaleString('th-TH', { maximumFractionDigits: 0 });

const getAnomalyIcon = (type: string) => {
    switch (type) {
        case 'UNUSUAL_VOLUME': return <Activity className="text-orange-400" size={20} />;
        case 'VOIDED_TRANSACTIONS': return <XCircle className="text-red-400" size={20} />;
        case 'SUDDEN_DROP': return <TrendingDown className="text-red-400" size={20} />;
        default: return <AlertTriangle className="text-yellow-400" size={20} />;
    }
};

const getAnomalyTypeLabel = (type: string) => {
    switch (type) {
        case 'UNUSUAL_VOLUME': return 'ยอดผิดปกติ';
        case 'VOIDED_TRANSACTIONS': return 'รายการยกเลิก';
        case 'SUDDEN_DROP': return 'ยอดลดลงฉับพลัน';
        default: return type;
    }
};

export default function AnomaliesPage() {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<AnomalyData | null>(null);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/v2/full/admin/dashboard?date=${getTodayBangkok()}`);
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(payload.error || 'โหลดข้อมูลไม่สำเร็จ');
            setData(payload);
            setError(null);
        } catch (fetchError) {
            console.error('Error:', fetchError);
            setError(fetchError instanceof Error ? fetchError.message : 'โหลดข้อมูลไม่สำเร็จ');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void fetchData();
    }, [fetchData]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="animate-spin text-amber-400" size={40} />
            </div>
        );
    }

    if (!data) {
        return <div className="text-center py-12 text-red-300">{error || 'ไม่สามารถโหลดข้อมูลได้'}</div>;
    }

    const criticalAnomalies = data.anomalies.filter(a => a.severity === 'CRITICAL');
    const warningAnomalies = data.anomalies.filter(a => a.severity === 'WARNING');

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <AlertTriangle className="text-yellow-400" />
                        ตรวจสอบความผิดปกติ
                    </h1>
                    <p className="text-gray-400 text-sm">{data.station.name}</p>
                </div>
                <button
                    onClick={() => void fetchData()}
                    className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                >
                    <RefreshCw size={20} />
                </button>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-amber-900/40 to-orange-900/40 rounded-xl p-5 border border-amber-500/30">
                    <div className="text-sm text-amber-300/80">ค่าเฉลี่ย/วัน</div>
                    <div className="text-2xl font-bold text-amber-400 mt-1">
                        {formatNumber(data.stats.avgDailyVolume)} L
                    </div>
                </div>
                <div className="bg-gradient-to-br from-blue-900/40 to-cyan-900/40 rounded-xl p-5 border border-blue-500/30">
                    <div className="text-sm text-blue-300/80">ค่าเบี่ยงเบน</div>
                    <div className="text-2xl font-bold text-blue-400 mt-1">
                        ±{formatNumber(data.stats.stdDevVolume)} L
                    </div>
                </div>
                <div className="bg-gradient-to-br from-red-900/40 to-pink-900/40 rounded-xl p-5 border border-red-500/30">
                    <div className="text-sm text-red-300/80">วิกฤต</div>
                    <div className="text-3xl font-bold text-red-400 mt-1">{criticalAnomalies.length}</div>
                </div>
                <div className="bg-gradient-to-br from-yellow-900/40 to-amber-900/40 rounded-xl p-5 border border-yellow-500/30">
                    <div className="text-sm text-yellow-300/80">เตือน</div>
                    <div className="text-3xl font-bold text-yellow-400 mt-1">{warningAnomalies.length}</div>
                </div>
            </div>

            {/* No Anomalies - Good State */}
            {data.anomalies.length === 0 && (
                <div className="bg-gradient-to-br from-green-900/30 to-emerald-900/30 border border-green-500/40 rounded-2xl p-8 text-center">
                    <CheckCircle className="text-green-400 mx-auto mb-4" size={64} />
                    <div className="text-2xl font-bold text-green-300">✓ ทุกอย่างปกติ</div>
                    <p className="text-gray-400 mt-2">ไม่พบความผิดปกติในข้อมูลการขายวันนี้</p>
                </div>
            )}

            {/* Critical Anomalies */}
            {criticalAnomalies.length > 0 && (
                <div className="space-y-4">
                    <h2 className="text-xl font-bold text-red-400 flex items-center gap-2">
                        🚨 ต้องดำเนินการทันที
                    </h2>
                    <div className="grid gap-3">
                        {criticalAnomalies.map((a, i) => (
                            <div key={i} className="bg-gradient-to-r from-red-900/50 to-red-800/30 border border-red-500/50 rounded-xl p-5">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-red-500/20 rounded-full">
                                        {getAnomalyIcon(a.type)}
                                    </div>
                                    <div className="flex-1">
                                        <div className="text-lg font-semibold text-white">{a.message}</div>
                                        <div className="flex items-center gap-3 mt-1 text-sm text-gray-400">
                                            <span className="px-2 py-0.5 bg-red-500/30 text-red-300 rounded">
                                                {getAnomalyTypeLabel(a.type)}
                                            </span>
                                            <span>{a.date}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Warning Anomalies */}
            {warningAnomalies.length > 0 && (
                <div className="space-y-4">
                    <h2 className="text-xl font-bold text-yellow-400 flex items-center gap-2">
                        ⚠️ ควรตรวจสอบ
                    </h2>
                    <div className="grid gap-3">
                        {warningAnomalies.map((a, i) => (
                            <div key={i} className="bg-gradient-to-r from-yellow-900/40 to-amber-900/20 border border-yellow-500/40 rounded-xl p-5">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-yellow-500/20 rounded-full">
                                        {getAnomalyIcon(a.type)}
                                    </div>
                                    <div className="flex-1">
                                        <div className="text-lg font-semibold text-white">{a.message}</div>
                                        <div className="flex items-center gap-3 mt-1 text-sm text-gray-400">
                                            <span className="px-2 py-0.5 bg-yellow-500/30 text-yellow-300 rounded">
                                                {getAnomalyTypeLabel(a.type)}
                                            </span>
                                            <span>{a.date}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Detection Rules - Simplified */}
            <div className="bg-[#1a1a24] rounded-xl p-6 border border-white/10">
                <h2 className="text-lg font-semibold mb-4">📋 ระบบตรวจจับอัตโนมัติ</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div className="p-4 bg-black/30 rounded-lg border border-orange-500/20">
                        <div className="flex items-center gap-2 mb-2">
                            <Activity className="text-orange-400" size={18} />
                            <span className="font-medium text-orange-300">ยอดผิดปกติ</span>
                        </div>
                        <p className="text-gray-400">ยอดวันนี้ห่างจากค่าเฉลี่ย &gt;2 เท่าของค่าเบี่ยงเบน</p>
                    </div>
                    <div className="p-4 bg-black/30 rounded-lg border border-red-500/20">
                        <div className="flex items-center gap-2 mb-2">
                            <XCircle className="text-red-400" size={18} />
                            <span className="font-medium text-red-300">รายการยกเลิก</span>
                        </div>
                        <p className="text-gray-400">มีการยกเลิกรายการในวัน (≥3 = วิกฤต)</p>
                    </div>
                    <div className="p-4 bg-black/30 rounded-lg border border-red-500/20">
                        <div className="flex items-center gap-2 mb-2">
                            <TrendingDown className="text-red-400" size={18} />
                            <span className="font-medium text-red-300">ยอดลดฉับพลัน</span>
                        </div>
                        <p className="text-gray-400">ยอดลดลง &gt;50% เทียบเมื่อวาน</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
