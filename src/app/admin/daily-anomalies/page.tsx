'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, Calendar, ArrowLeft, RefreshCw } from 'lucide-react';
import Link from 'next/link';

interface DailyAnomaly {
    id: string;
    stationId: string;
    stationName: string;
    date: string;
    displayDate: string;
    meterTotal: number;
    transTotal: number;
    difference: number;
    severity: string;
    note: string | null;
    reviewedAt: string | null;
    reviewedBy: string | null;
}

export default function DailyAnomaliesPage() {
    const [anomalies, setAnomalies] = useState<DailyAnomaly[]>([]);
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState<'pending' | 'reviewed' | 'all'>('pending');

    const fetchAnomalies = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/admin/daily-anomalies?status=${status}`);
            if (res.ok) {
                const data = await res.json();
                setAnomalies(data.anomalies || []);
            }
        } catch (error) {
            console.error('Error fetching anomalies:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAnomalies();
    }, [status]);

    const formatNumber = (n: number) => n.toLocaleString('th-TH', { maximumFractionDigits: 2 });

    return (
        <div className="min-h-screen bg-[#0a0a0f] text-white p-6">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="flex items-center gap-4 mb-6">
                    <Link href="/admin" className="p-2 hover:bg-white/10 rounded-lg">
                        <ArrowLeft size={24} />
                    </Link>
                    <div className="flex-1">
                        <h1 className="text-2xl font-bold flex items-center gap-2">
                            <AlertTriangle className="text-yellow-400" />
                            ผลต่างยอดขาย-มิเตอร์ (รายวัน)
                        </h1>
                        <p className="text-gray-400 text-sm">เปรียบเทียบยอด transactions กับยอดมิเตอร์รายวัน</p>
                    </div>
                    <button
                        onClick={fetchAnomalies}
                        className="p-2 hover:bg-white/10 rounded-lg"
                    >
                        <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>

                {/* Filter */}
                <div className="flex gap-2 mb-6">
                    {[
                        { value: 'pending', label: 'รอตรวจสอบ' },
                        { value: 'reviewed', label: 'ตรวจสอบแล้ว' },
                        { value: 'all', label: 'ทั้งหมด' }
                    ].map(opt => (
                        <button
                            key={opt.value}
                            onClick={() => setStatus(opt.value as typeof status)}
                            className={`px-4 py-2 rounded-lg transition-all ${status === opt.value
                                    ? 'bg-yellow-600 text-white'
                                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                                }`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>

                {/* Summary */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="bg-red-900/30 border border-red-500/30 rounded-xl p-4 text-center">
                        <p className="text-2xl font-bold text-red-400">
                            {anomalies.filter(a => a.severity === 'CRITICAL').length}
                        </p>
                        <p className="text-sm text-gray-400">CRITICAL (&gt; 50L)</p>
                    </div>
                    <div className="bg-yellow-900/30 border border-yellow-500/30 rounded-xl p-4 text-center">
                        <p className="text-2xl font-bold text-yellow-400">
                            {anomalies.filter(a => a.severity === 'WARNING').length}
                        </p>
                        <p className="text-sm text-gray-400">WARNING (10-50L)</p>
                    </div>
                    <div className="bg-green-900/30 border border-green-500/30 rounded-xl p-4 text-center">
                        <p className="text-2xl font-bold text-green-400">
                            {anomalies.filter(a => a.reviewedAt).length}
                        </p>
                        <p className="text-sm text-gray-400">ตรวจสอบแล้ว</p>
                    </div>
                </div>

                {/* Table */}
                <div className="bg-[#0f0f1a] rounded-xl border border-white/10 overflow-hidden">
                    {loading ? (
                        <div className="p-8 text-center text-gray-400">กำลังโหลด...</div>
                    ) : anomalies.length === 0 ? (
                        <div className="p-8 text-center text-gray-400">
                            <CheckCircle className="mx-auto mb-2 text-green-400" size={40} />
                            ไม่พบความผิดปกติ
                        </div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead className="bg-gray-800/50">
                                <tr>
                                    <th className="px-4 py-3 text-left">วันที่</th>
                                    <th className="px-4 py-3 text-left">สถานี</th>
                                    <th className="px-4 py-3 text-right">ยอดขาย (L)</th>
                                    <th className="px-4 py-3 text-right">ยอดมิเตอร์ (L)</th>
                                    <th className="px-4 py-3 text-right">ผลต่าง (L)</th>
                                    <th className="px-4 py-3 text-center">สถานะ</th>
                                    <th className="px-4 py-3 text-left">หมายเหตุ</th>
                                </tr>
                            </thead>
                            <tbody>
                                {anomalies.map(a => (
                                    <tr key={a.id} className="border-t border-white/5 hover:bg-white/5">
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <Calendar size={14} className="text-gray-400" />
                                                {a.displayDate}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">{a.stationName}</td>
                                        <td className="px-4 py-3 text-right font-mono text-cyan-400">
                                            {formatNumber(a.transTotal)}
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono text-blue-400">
                                            {formatNumber(a.meterTotal)}
                                        </td>
                                        <td className={`px-4 py-3 text-right font-mono font-bold ${a.difference > 0 ? 'text-red-400' : 'text-green-400'
                                            }`}>
                                            {a.difference > 0 ? '+' : ''}{formatNumber(a.difference)}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`px-2 py-1 rounded-full text-xs ${a.severity === 'CRITICAL'
                                                    ? 'bg-red-500/20 text-red-400'
                                                    : 'bg-yellow-500/20 text-yellow-400'
                                                }`}>
                                                {a.severity}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-gray-400">
                                            {a.reviewedBy
                                                ? `✓ ${a.reviewedBy}`
                                                : a.note || '-'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Legend */}
                <div className="mt-4 text-sm text-gray-400">
                    <p>• <span className="text-red-400">ผลต่างบวก (+)</span>: ยอดขาย &gt; ยอดมิเตอร์ (ขายมากกว่าที่มิเตอร์บันทึก)</p>
                    <p>• <span className="text-green-400">ผลต่างลบ (-)</span>: ยอดขาย &lt; ยอดมิเตอร์ (มิเตอร์เดินมากกว่าที่ขาย)</p>
                </div>
            </div>
        </div>
    );
}
