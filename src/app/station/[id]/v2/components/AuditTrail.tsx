'use client';

import { useState, useEffect } from 'react';
import { Clock, User, Edit, Plus, Trash2, AlertCircle } from 'lucide-react';

interface AuditLogEntry {
    id: string;
    timestamp: string;
    action: 'CREATE' | 'UPDATE' | 'DELETE';
    entityType: 'TRANSACTION' | 'METER' | 'DAILY_RECORD';
    entityId: string;
    userId: string;
    userName: string;
    changes: {
        field: string;
        oldValue: string;
        newValue: string;
    }[];
    isPostClose: boolean;
    reason?: string;
}

interface AuditTrailProps {
    stationId: string;
    date: string;
}

export default function AuditTrail({ stationId, date }: AuditTrailProps) {
    const [loading, setLoading] = useState(true);
    const [logs, setLogs] = useState<AuditLogEntry[]>([]);

    useEffect(() => {
        fetchAuditLogs();
    }, [stationId, date]);

    const fetchAuditLogs = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/station/${stationId}/audit?date=${date}`);
            if (res.ok) {
                const data = await res.json();
                setLogs(data.logs || []);
            }
        } catch (error) {
            console.error('Error fetching audit logs:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatTime = (timestamp: string) => {
        return new Date(timestamp).toLocaleTimeString('th-TH', {
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const getActionConfig = (action: string) => {
        switch (action) {
            case 'CREATE':
                return { icon: Plus, color: 'bg-green-100 text-green-600', label: 'เพิ่ม' };
            case 'UPDATE':
                return { icon: Edit, color: 'bg-blue-100 text-blue-600', label: 'แก้ไข' };
            case 'DELETE':
                return { icon: Trash2, color: 'bg-red-100 text-red-600', label: 'ลบ' };
            default:
                return { icon: Clock, color: 'bg-gray-100 text-gray-600', label: action };
        }
    };

    const getEntityLabel = (type: string) => {
        switch (type) {
            case 'TRANSACTION': return 'รายการเติม';
            case 'METER': return 'มิเตอร์';
            case 'DAILY_RECORD': return 'ข้อมูลวัน';
            default: return type;
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
            </div>
        );
    }

    return (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100">
                <h2 className="font-bold text-gray-800">📝 ประวัติการแก้ไข</h2>
                <p className="text-xs text-gray-400 mt-1">
                    แสดงการเปลี่ยนแปลงทั้งหมดของวันที่เลือก
                </p>
            </div>

            {logs.length === 0 ? (
                <div className="p-8 text-center text-gray-400">
                    ไม่มีประวัติการแก้ไข
                </div>
            ) : (
                <div className="divide-y divide-gray-100">
                    {logs.map((log) => {
                        const actionConfig = getActionConfig(log.action);
                        const ActionIcon = actionConfig.icon;

                        return (
                            <div key={log.id} className="p-4">
                                <div className="flex items-start gap-3">
                                    <div className={`p-2 rounded-xl ${actionConfig.color}`}>
                                        <ActionIcon size={16} />
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-medium text-gray-800">
                                                {actionConfig.label}{getEntityLabel(log.entityType)}
                                            </span>
                                            {log.isPostClose && (
                                                <span className="flex items-center gap-1 text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">
                                                    <AlertCircle size={10} />
                                                    หลังปิดวัน
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
                                            <Clock size={12} />
                                            <span>{formatTime(log.timestamp)}</span>
                                            <span>•</span>
                                            <User size={12} />
                                            <span>{log.userName}</span>
                                        </div>

                                        {/* Show changes for updates */}
                                        {log.changes && log.changes.length > 0 && (
                                            <div className="mt-2 space-y-1">
                                                {log.changes.map((change, idx) => (
                                                    <div key={idx} className="text-xs bg-gray-50 rounded-lg px-3 py-2">
                                                        <span className="text-gray-500">{change.field}:</span>{' '}
                                                        <span className="text-red-500 line-through">{change.oldValue}</span>
                                                        {' → '}
                                                        <span className="text-green-600 font-medium">{change.newValue}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* Show reason for post-close edits */}
                                        {log.isPostClose && log.reason && (
                                            <div className="mt-2 text-xs bg-orange-50 text-orange-700 rounded-lg px-3 py-2">
                                                <strong>เหตุผล:</strong> {log.reason}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
