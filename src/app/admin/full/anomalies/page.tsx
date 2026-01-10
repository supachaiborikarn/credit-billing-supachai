'use client';

import { useEffect, useState } from 'react';
import {
    AlertTriangle,
    CheckCircle,
    Loader2,
    RefreshCw
} from 'lucide-react';

interface Anomaly {
    type: string;
    severity: 'WARNING' | 'CRITICAL';
    message: string;
    date: string;
    details?: Record<string, unknown>;
}

interface AnomalyData {
    station: { id: string; name: string };
    anomalies: Anomaly[];
    stats: { avgDailyVolume: number; stdDevVolume: number };
}

export default function AnomaliesPage() {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<AnomalyData | null>(null);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/v2/full/admin/dashboard');
            if (res.ok) {
                const json = await res.json();
                setData(json);
            }
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="animate-spin text-amber-400" size={40} />
            </div>
        );
    }

    if (!data) {
        return <div className="text-center py-12 text-gray-400">ไม่สามารถโหลดข้อมูลได้</div>;
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
                    onClick={fetchData}
                    className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                >
                    <RefreshCw size={20} />
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-[#1a1a24] rounded-xl p-4 border border-white/10">
                    <div className="text-sm text-gray-400">ค่าเฉลี่ย/วัน</div>
                    <div className="text-xl font-bold text-amber-400">
                        {data.stats.avgDailyVolume.toLocaleString('th-TH', { maximumFractionDigits: 0 })} L
                    </div>
                </div>
                <div className="bg-[#1a1a24] rounded-xl p-4 border border-white/10">
                    <div className="text-sm text-gray-400">Std Dev</div>
                    <div className="text-xl font-bold">
                        ±{data.stats.stdDevVolume.toLocaleString('th-TH', { maximumFractionDigits: 0 })} L
                    </div>
                </div>
                <div className="bg-red-900/30 rounded-xl p-4 border border-red-500/30">
                    <div className="text-sm text-red-300">วิกฤต</div>
                    <div className="text-xl font-bold text-red-400">{criticalAnomalies.length}</div>
                </div>
                <div className="bg-yellow-900/30 rounded-xl p-4 border border-yellow-500/30">
                    <div className="text-sm text-yellow-300">เตือน</div>
                    <div className="text-xl font-bold text-yellow-400">{warningAnomalies.length}</div>
                </div>
            </div>

            {/* No Anomalies */}
            {data.anomalies.length === 0 && (
                <div className="bg-green-900/30 border border-green-500/30 rounded-xl p-8 text-center">
                    <CheckCircle className="text-green-400 mx-auto mb-4" size={48} />
                    <div className="text-xl font-medium text-green-300">ไม่พบความผิดปกติ</div>
                    <p className="text-gray-400 text-sm mt-2">ข้อมูลการขายอยู่ในเกณฑ์ปกติ</p>
                </div>
            )}

            {/* Critical Anomalies */}
            {criticalAnomalies.length > 0 && (
                <div className="space-y-3">
                    <h2 className="text-lg font-semibold text-red-400">🚨 ความผิดปกติระดับวิกฤต</h2>
                    {criticalAnomalies.map((a, i) => (
                        <div key={i} className="bg-red-900/40 border border-red-500/50 rounded-xl p-4">
                            <div className="flex items-start gap-3">
                                <AlertTriangle className="text-red-400 flex-shrink-0 mt-1" size={20} />
                                <div className="flex-1">
                                    <div className="font-medium text-red-300">{a.message}</div>
                                    <div className="text-xs text-red-400/70 mt-1">
                                        ประเภท: {a.type} | วันที่: {a.date}
                                    </div>
                                    {a.details && (
                                        <pre className="mt-2 text-xs bg-black/30 rounded p-2 text-gray-400 overflow-x-auto">
                                            {JSON.stringify(a.details, null, 2)}
                                        </pre>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Warning Anomalies */}
            {warningAnomalies.length > 0 && (
                <div className="space-y-3">
                    <h2 className="text-lg font-semibold text-yellow-400">⚠️ ความผิดปกติระดับเตือน</h2>
                    {warningAnomalies.map((a, i) => (
                        <div key={i} className="bg-yellow-900/30 border border-yellow-500/30 rounded-xl p-4">
                            <div className="flex items-start gap-3">
                                <AlertTriangle className="text-yellow-400 flex-shrink-0 mt-1" size={20} />
                                <div className="flex-1">
                                    <div className="font-medium text-yellow-300">{a.message}</div>
                                    <div className="text-xs text-yellow-400/70 mt-1">
                                        ประเภท: {a.type} | วันที่: {a.date}
                                    </div>
                                    {a.details && (
                                        <pre className="mt-2 text-xs bg-black/30 rounded p-2 text-gray-400 overflow-x-auto">
                                            {JSON.stringify(a.details, null, 2)}
                                        </pre>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Detection Rules */}
            <div className="bg-[#1a1a24] rounded-xl p-6 border border-white/10">
                <h2 className="text-lg font-semibold mb-4">📋 กฎการตรวจจับ</h2>
                <div className="space-y-3 text-sm">
                    <div className="flex items-start gap-3 p-3 bg-black/20 rounded-lg">
                        <span className="text-red-400">🔴</span>
                        <div>
                            <div className="font-medium">UNUSUAL_VOLUME</div>
                            <div className="text-gray-400">ยอดขายห่างจากค่าเฉลี่ยมากกว่า 2 เท่าของ Std Dev</div>
                        </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 bg-black/20 rounded-lg">
                        <span className="text-yellow-400">🟡</span>
                        <div>
                            <div className="font-medium">VOIDED_TRANSACTIONS</div>
                            <div className="text-gray-400">มีรายการยกเลิกในวันนั้น (≥3 = วิกฤต)</div>
                        </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 bg-black/20 rounded-lg">
                        <span className="text-yellow-400">🟡</span>
                        <div>
                            <div className="font-medium">LARGE_TRANSACTIONS</div>
                            <div className="text-gray-400">รายการมูลค่าสูง ({'>'}5,000 บาท)</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
