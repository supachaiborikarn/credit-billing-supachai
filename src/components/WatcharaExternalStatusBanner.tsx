'use client';

import { AlertTriangle, Database, RefreshCw } from 'lucide-react';

interface WatcharaExternalStatusBannerProps {
    status?: {
        schemaReady: boolean;
        available: boolean;
        enabled: boolean;
        targetStationIncluded: boolean;
        includedInMerge: boolean;
        rowsInRange: number;
        litersInRange: number;
        revenueInRange: number;
        lastSyncedAt: string | null;
        lastSeenSourceAt: string | null;
        lastError: string | null;
        stale: {
            isStale: boolean;
            staleHours: number | null;
            thresholdHours: number;
        };
    } | null;
}

function formatDateTime(value: string | null): string {
    if (!value) return '-';

    return new Date(value).toLocaleString('th-TH', {
        dateStyle: 'medium',
        timeStyle: 'short',
    });
}

function formatCurrency(value: number): string {
    return value.toLocaleString('th-TH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

function formatNumber(value: number): string {
    return value.toLocaleString('th-TH', {
        maximumFractionDigits: 2,
    });
}

export default function WatcharaExternalStatusBanner({ status }: WatcharaExternalStatusBannerProps) {
    if (!status?.targetStationIncluded) {
        return null;
    }

    const hasWarning = !status.includedInMerge || status.stale.isStale || Boolean(status.lastError);
    const Icon = hasWarning ? AlertTriangle : Database;
    const tone = hasWarning
        ? 'border-amber-500/30 bg-amber-900/20 text-amber-100'
        : 'border-sky-500/30 bg-sky-900/20 text-sky-100';
    const subTone = hasWarning ? 'text-amber-200/80' : 'text-sky-200/80';

    let headline = 'รวมยอด Watchara shared dispenser เข้ารายงานหน้านี้แล้ว';
    let detail = `ช่วงข้อมูลนี้มี ${status.rowsInRange.toLocaleString('th-TH')} รายการ | ${formatNumber(status.litersInRange)} ลิตร | ฿${formatCurrency(status.revenueInRange)}`;

    if (!status.schemaReady) {
        headline = 'ยังไม่สามารถรวมยอด Watchara shared dispenser ได้';
        detail = 'ตาราง landing ของ external source ยังไม่พร้อมใน environment นี้';
    } else if (!status.available) {
        headline = 'ยังไม่สามารถรวมยอด Watchara shared dispenser ได้';
        detail = 'ยังไม่พบ source registry ในฐานข้อมูลของระบบนี้';
    } else if (!status.enabled) {
        headline = 'Watchara shared dispenser ถูกปิดการใช้งานอยู่';
        detail = 'รายงานหน้านี้จึงยังไม่รวมยอดจาก source ภายนอก';
    } else if (status.stale.isStale) {
        headline = 'รายงานหน้านี้รวมยอด Watchara แล้ว แต่ source ภายนอกค้างอยู่';
        detail = `ข้อมูลขายล่าสุดจาก source อยู่ที่ ${formatDateTime(status.lastSeenSourceAt)} และเกิน threshold ${status.stale.thresholdHours} ชั่วโมง`;
    }

    return (
        <div className={`rounded-xl border p-4 ${tone}`}>
            <div className="flex items-start gap-3">
                <Icon className="mt-0.5 shrink-0" size={18} />
                <div className="min-w-0 space-y-1">
                    <div className="font-medium">{headline}</div>
                    <div className={`text-sm ${subTone}`}>{detail}</div>
                    <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 text-xs ${subTone}`}>
                        <span className="inline-flex items-center gap-1">
                            <RefreshCw size={12} />
                            sync ล่าสุด: {formatDateTime(status.lastSyncedAt)}
                        </span>
                        <span>source ล่าสุด: {formatDateTime(status.lastSeenSourceAt)}</span>
                    </div>
                    {status.lastError && (
                        <div className="text-xs text-amber-100/90">
                            sync error ล่าสุด: {status.lastError}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
