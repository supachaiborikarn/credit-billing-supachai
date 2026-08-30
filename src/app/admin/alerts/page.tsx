'use client';

import { useCallback, useEffect, useState } from 'react';
import {
    AlertTriangle,
    Lock,
    Clock,
    History,
    RefreshCw,
    ChevronRight,
    Shield,
    AlertCircle
} from 'lucide-react';

interface VarianceAlert {
    id: string;
    shiftId: string;
    shiftNumber: number;
    stationName: string;
    date: string;
    variance: number;
    varianceStatus: 'YELLOW' | 'RED';
    totalExpected: number;
    totalReceived: number;
    createdAt: string;
}

interface UnlockedShift {
    id: string;
    shiftNumber: number;
    stationName: string;
    date: string;
    staffName: string;
    closedAt: string;
    hoursSinceClosed: number;
}

interface AuditLog {
    id: string;
    action: string;
    model: string;
    recordId: string;
    userName: string;
    oldData: Record<string, unknown> | null;
    newData: Record<string, unknown> | null;
    createdAt: string;
}

interface AlertCounts {
    varianceAlerts: number;
    unlockedShifts: number;
    recentChanges: number;
    redVariances: number;
    yellowVariances: number;
}

export default function AdminAlertsPage() {
    const [loading, setLoading] = useState(true);
    const [alertCounts, setAlertCounts] = useState<AlertCounts>({
        varianceAlerts: 0,
        unlockedShifts: 0,
        recentChanges: 0,
        redVariances: 0,
        yellowVariances: 0
    });
    const [varianceAlerts, setVarianceAlerts] = useState<VarianceAlert[]>([]);
    const [unlockedShifts, setUnlockedShifts] = useState<UnlockedShift[]>([]);
    const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
    const [lockingId, setLockingId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [hasLoaded, setHasLoaded] = useState(false);

    const fetchAlerts = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/alerts?days=7');
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || 'โหลดข้อมูลตรวจสอบไม่สำเร็จ');
            setAlertCounts(data.alertCounts);
            setVarianceAlerts(data.varianceAlerts);
            setUnlockedShifts(data.unlockedShifts);
            setAuditLogs(data.recentAuditLogs);
            setError(null);
            setHasLoaded(true);
        } catch (fetchError) {
            console.error('Error fetching alerts:', fetchError);
            setError(fetchError instanceof Error ? fetchError.message : 'โหลดข้อมูลตรวจสอบไม่สำเร็จ');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void fetchAlerts();
    }, [fetchAlerts]);

    const handleLockShift = async (shiftId: string) => {
        if (!confirm('ยืนยันล็อกกะนี้? หลังล็อกแล้วจะไม่สามารถแก้ไขได้อีก')) return;

        setLockingId(shiftId);
        try {
            const res = await fetch('/api/admin/alerts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'lock', shiftId })
            });

            if (res.ok) {
                // Remove from list
                setUnlockedShifts(prev => prev.filter(s => s.id !== shiftId));
                setAlertCounts(prev => ({ ...prev, unlockedShifts: prev.unlockedShifts - 1 }));
            } else {
                const err = await res.json();
                alert(err.error || 'ล็อกไม่สำเร็จ');
            }
        } catch (error) {
            console.error('Lock error:', error);
            alert('เกิดข้อผิดพลาด');
        } finally {
            setLockingId(null);
        }
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('th-TH', {
            day: 'numeric',
            month: 'short',
            year: '2-digit',
            timeZone: 'Asia/Bangkok'
        });
    };

    const formatDateTime = (dateStr: string) => {
        return new Date(dateStr).toLocaleString('th-TH', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Asia/Bangkok'
        });
    };

    const formatCurrency = (num: number) =>
        new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2 }).format(Math.abs(num));

    const getActionLabel = (action: string) => {
        switch (action) {
            case 'DELETE': return 'ลบ';
            case 'VOID': return 'ยกเลิก';
            case 'UPDATE': return 'แก้ไข';
            case 'LOCK': return 'ล็อก';
            case 'REVIEW': return 'ตรวจสอบ';
            case 'CLOSE': return 'ปิดกะ';
            default: return action;
        }
    };

    const getActionColor = (action: string) => {
        switch (action) {
            case 'DELETE':
            case 'VOID':
                return 'text-red-400 bg-red-500/20';
            case 'UPDATE':
                return 'text-yellow-400 bg-yellow-500/20';
            case 'LOCK':
                return 'text-blue-400 bg-blue-500/20';
            case 'REVIEW':
                return 'text-green-400 bg-green-500/20';
            default:
                return 'text-gray-400 bg-gray-500/20';
        }
    };

    if (!loading && !hasLoaded && error) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6 text-white">
                <div className="mx-auto max-w-xl rounded-xl border border-red-500/30 bg-red-950/30 p-6 text-center" role="alert">
                    <AlertCircle className="mx-auto mb-3 text-red-400" size={32} />
                    <div className="font-semibold">โหลด Anti-Fraud Dashboard ไม่สำเร็จ</div>
                    <div className="mt-2 text-sm text-red-300">{error}</div>
                    <button type="button" onClick={() => void fetchAlerts()} className="mt-4 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold">ลองใหม่</button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <Shield className="text-purple-400" size={32} />
                    <div>
                        <h1 className="text-2xl font-bold text-white">Anti-Fraud Dashboard</h1>
                        <p className="text-gray-400 text-sm">ตรวจสอบความผิดปกติ</p>
                    </div>
                </div>
                <button
                    onClick={() => void fetchAlerts()}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                    <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                    รีเฟรช
                </button>
            </div>

            {error && hasLoaded && (
                <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-950/30 px-4 py-3 text-sm text-amber-200" role="status">
                    รีเฟรชล่าสุดไม่สำเร็จ กำลังแสดงข้อมูลครั้งล่าสุด: {error}
                </div>
            )}

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-red-500/20 border border-red-500/30 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-red-400 mb-1">
                        <AlertCircle size={18} />
                        <span className="text-sm">🔴 RED</span>
                    </div>
                    <p className="text-3xl font-bold text-red-300">{alertCounts.redVariances}</p>
                    <p className="text-xs text-red-400/70">ยอดต่าง &gt;500฿</p>
                </div>

                <div className="bg-yellow-500/20 border border-yellow-500/30 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-yellow-400 mb-1">
                        <AlertTriangle size={18} />
                        <span className="text-sm">🟡 YELLOW</span>
                    </div>
                    <p className="text-3xl font-bold text-yellow-300">{alertCounts.yellowVariances}</p>
                    <p className="text-xs text-yellow-400/70">ยอดต่าง &gt;200฿</p>
                </div>

                <div className="bg-blue-500/20 border border-blue-500/30 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-blue-400 mb-1">
                        <Clock size={18} />
                        <span className="text-sm">⏳ รอล็อก</span>
                    </div>
                    <p className="text-3xl font-bold text-blue-300">{alertCounts.unlockedShifts}</p>
                    <p className="text-xs text-blue-400/70">กะปิดนาน &gt;24 ชม.</p>
                </div>

                <div className="bg-gray-500/20 border border-gray-500/30 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-gray-400 mb-1">
                        <History size={18} />
                        <span className="text-sm">📝 การเปลี่ยนแปลง</span>
                    </div>
                    <p className="text-3xl font-bold text-gray-300">{alertCounts.recentChanges}</p>
                    <p className="text-xs text-gray-400/70">7 วันล่าสุด</p>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
                </div>
            ) : (
                <div className="grid md:grid-cols-2 gap-6">
                    {/* Variance Alerts */}
                    <div className="card-glass p-4">
                        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                            <AlertTriangle className="text-yellow-400" size={20} />
                            ยอดต่างผิดปกติ
                        </h2>
                        <div className="space-y-3 max-h-80 overflow-y-auto">
                            {varianceAlerts.length > 0 ? varianceAlerts.map(alert => (
                                <div
                                    key={alert.id}
                                    className={`p-3 rounded-lg border ${alert.varianceStatus === 'RED'
                                            ? 'bg-red-500/10 border-red-500/30'
                                            : 'bg-yellow-500/10 border-yellow-500/30'
                                        }`}
                                >
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-white font-medium">{alert.stationName}</span>
                                        <span className={`text-sm px-2 py-0.5 rounded ${alert.varianceStatus === 'RED'
                                                ? 'bg-red-500/30 text-red-300'
                                                : 'bg-yellow-500/30 text-yellow-300'
                                            }`}>
                                            {alert.varianceStatus === 'RED' ? '🔴' : '🟡'}
                                            {alert.variance > 0 ? '+' : ''}{formatCurrency(alert.variance)}฿
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-400">
                                        กะ{alert.shiftNumber} • {formatDate(alert.date)}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                        คาด {formatCurrency(alert.totalExpected)}฿ | รับ {formatCurrency(alert.totalReceived)}฿
                                    </p>
                                </div>
                            )) : (
                                <div className="text-center text-gray-500 py-8">
                                    ✅ ไม่มียอดผิดปกติ
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Unlocked Shifts */}
                    <div className="card-glass p-4">
                        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                            <Clock className="text-blue-400" size={20} />
                            กะที่ยังไม่ล็อก
                        </h2>
                        <div className="space-y-3 max-h-80 overflow-y-auto">
                            {unlockedShifts.length > 0 ? unlockedShifts.map(shift => (
                                <div
                                    key={shift.id}
                                    className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-between"
                                >
                                    <div>
                                        <p className="text-white font-medium">{shift.stationName}</p>
                                        <p className="text-xs text-gray-400">
                                            กะ{shift.shiftNumber} • {formatDate(shift.date)} • {shift.staffName}
                                        </p>
                                        <p className="text-xs text-orange-400">
                                            ⏱️ ปิดมาแล้ว {shift.hoursSinceClosed} ชม.
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => handleLockShift(shift.id)}
                                        disabled={lockingId === shift.id}
                                        className="flex items-center gap-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
                                    >
                                        {lockingId === shift.id ? (
                                            <RefreshCw size={14} className="animate-spin" />
                                        ) : (
                                            <Lock size={14} />
                                        )}
                                        ล็อก
                                    </button>
                                </div>
                            )) : (
                                <div className="text-center text-gray-500 py-8">
                                    ✅ ทุกกะถูกล็อกแล้ว
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Recent Audit Logs */}
                    <div className="card-glass p-4 md:col-span-2">
                        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                            <History className="text-gray-400" size={20} />
                            ประวัติการเปลี่ยนแปลง (7 วัน)
                        </h2>
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                            {auditLogs.length > 0 ? auditLogs.map(log => (
                                <div
                                    key={log.id}
                                    className="p-2 rounded-lg bg-white/5 flex items-center gap-3"
                                >
                                    <span className={`px-2 py-1 rounded text-xs font-medium ${getActionColor(log.action)}`}>
                                        {getActionLabel(log.action)}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm text-white truncate">
                                            {log.model} #{log.recordId.slice(0, 8)}...
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            โดย {log.userName} • {formatDateTime(log.createdAt)}
                                        </p>
                                    </div>
                                    <ChevronRight size={16} className="text-gray-500" />
                                </div>
                            )) : (
                                <div className="text-center text-gray-500 py-8">
                                    ไม่มีประวัติล่าสุด
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
