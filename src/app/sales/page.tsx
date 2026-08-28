'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ArrowRight, Clock3, Fuel } from 'lucide-react';
import { RedesignAppShell } from '@/components/layout';
import { FatalErrorState, LoadingState, Notice, Section } from '@/components/ui';
import { findStationIndex } from '@/constants';
import type { TodayAdminPayload, TodayStationState } from '@/types/today';

interface AuthUser {
    role: 'ADMIN' | 'STAFF';
    stationId: string | null;
}

function stateClasses(state: TodayStationState) {
    switch (state) {
        case 'STALE_SHIFT':
            return 'bg-[var(--ui-danger-soft)] text-[var(--ui-danger-text)]';
        case 'SHIFT_NEEDS_ATTENTION':
            return 'bg-[var(--ui-warning-soft)] text-[var(--ui-warning-text)]';
        case 'SHIFT_OPEN':
            return 'bg-[var(--ui-info-soft)] text-[var(--ui-info-text)]';
        case 'READY_TO_CLOSE':
        case 'CLOSED':
            return 'bg-[var(--ui-success-soft)] text-[var(--ui-success-text)]';
        default:
            return 'bg-[var(--ui-surface-subtle)] text-[var(--ui-text-secondary)]';
    }
}

function canonicalStationId(stationId: string | null) {
    if (!stationId) return null;
    const stationNumber = findStationIndex(stationId);
    return stationNumber > 0 ? `station-${stationNumber}` : null;
}

export default function SalesPage() {
    const router = useRouter();
    const [data, setData] = React.useState<TodayAdminPayload | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        let cancelled = false;

        const load = async () => {
            try {
                const authResponse = await fetch('/api/auth/me', { cache: 'no-store' });
                if (authResponse.status === 401) {
                    router.replace('/login?redirect=/sales');
                    return;
                }
                if (!authResponse.ok) throw new Error('ตรวจสอบผู้ใช้ไม่สำเร็จ');

                const authPayload = (await authResponse.json()) as { user?: AuthUser | null };
                const user = authPayload.user;
                if (!user) throw new Error('ไม่พบข้อมูลผู้ใช้');

                if (user.role === 'STAFF') {
                    const stationId = canonicalStationId(user.stationId);
                    const stationNumber = stationId ? findStationIndex(stationId) : -1;
                    router.replace(
                        stationId && [1, 5, 6].includes(stationNumber)
                            ? `/stations/${stationId}/sales`
                            : '/today'
                    );
                    return;
                }

                const response = await fetch('/api/today', { cache: 'no-store' });
                if (response.status === 401) {
                    router.replace('/login?redirect=/sales');
                    return;
                }
                if (!response.ok) throw new Error('โหลดสถานีสำหรับขายไม่สำเร็จ');

                const payload = await response.json();
                if (payload.kind !== 'admin') throw new Error('ข้อมูล Sales ไม่ตรงกับสิทธิ์ผู้ใช้');
                if (!cancelled) setData(payload as TodayAdminPayload);
            } catch (cause) {
                if (!cancelled) {
                    setError(cause instanceof Error ? cause.message : 'โหลด Sales ไม่สำเร็จ');
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        void load();
        return () => {
            cancelled = true;
        };
    }, [router]);

    return (
        <RedesignAppShell
            title="Sales"
            description="เลือกสถานีที่กำลังใช้งาน แล้วเข้าสู่ SaleFlow ของสถานีนั้น"
        >
            {loading ? (
                <LoadingState label="กำลังโหลดสถานีสำหรับขาย">
                    <div className="grid gap-3 md:grid-cols-3">
                        {[1, 2, 3].map((item) => (
                            <div key={item} className="h-40 animate-pulse rounded-[var(--ui-radius-lg)] bg-[var(--ui-surface-subtle)]" />
                        ))}
                    </div>
                </LoadingState>
            ) : error || !data ? (
                <FatalErrorState
                    title="เปิด Sales ไม่สำเร็จ"
                    message={error || 'ไม่พบข้อมูลสถานี'}
                    onRetry={() => window.location.reload()}
                />
            ) : (
                <div className="space-y-4">
                    <Notice tone="info">
                        หน้า Sales เป็นจุดเลือกสถานีเท่านั้น การบันทึกขายจริงยังใช้ SaleFlow เดียวของแต่ละสถานี เพื่อไม่ให้เกิด logic การเงินซ้ำ
                    </Notice>

                    <Section title="เลือกสถานี" description="แสดงเฉพาะสถานี operational ที่ยังขายผ่านระบบนี้">
                        <div className="grid gap-3 md:grid-cols-3">
                            {data.stations.map((station) => (
                                <Link
                                    key={station.stationId}
                                    href={`/stations/${station.stationId}/sales`}
                                    className="group rounded-[var(--ui-radius-lg)] border border-[var(--ui-border)] bg-[var(--ui-surface)] p-4 transition-colors hover:border-[var(--ui-border-strong)] hover:bg-[var(--ui-surface-subtle)] focus-visible:outline-none focus-visible:shadow-[var(--ui-shadow-focus)]"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--ui-radius-md)] bg-[var(--ui-primary-50)] text-[var(--ui-primary-text)]">
                                            <Fuel className="h-5 w-5" aria-hidden="true" />
                                        </div>
                                        <ArrowRight className="h-4 w-4 text-[var(--ui-text-muted)] transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                                    </div>

                                    <div className="mt-4 font-bold text-[var(--ui-text)]">{station.stationName}</div>
                                    <div className="mt-1 text-xs font-medium text-[var(--ui-text-muted)]">{station.stationType} · station-{station.stationNumber}</div>

                                    <div className="mt-3 flex flex-wrap items-center gap-2">
                                        <span className={`rounded-[var(--ui-radius-full)] px-2.5 py-1 text-xs font-bold ${stateClasses(station.state)}`}>
                                            {station.stateLabel}
                                        </span>
                                        {station.workItems.length > 0 && (
                                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--ui-warning-text)]">
                                                <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                                                {station.workItems.length} ต้องตรวจ
                                            </span>
                                        )}
                                    </div>

                                    <div className="mt-4 flex items-center justify-between border-t border-[var(--ui-border)] pt-3 text-xs text-[var(--ui-text-muted)]">
                                        <span>{station.summary.transactionCount} รายการวันนี้</span>
                                        <span className="inline-flex items-center gap-1">
                                            <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                                            {station.shift ? `กะ ${station.shift.shiftNumber}` : 'ยังไม่มีกะ'}
                                        </span>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </Section>
                </div>
            )}
        </RedesignAppShell>
    );
}
