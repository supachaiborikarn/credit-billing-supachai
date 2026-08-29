'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AlertTriangle, ArrowRight, History, RefreshCw } from 'lucide-react';
import { Badge, Button, EmptyState, Notice, Section } from '@/components/ui';
import { FullHistoryMaintenance } from '@/components/stations/FullHistoryMaintenance';
import type { StationContextPayload } from '@/types/station';
import type {
    StationHistoryAttentionReason,
    StationHistoryResponse,
    StationHistoryShift,
} from '@/types/station-history';

function dateKey(reference: Date) {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Bangkok',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(reference);
}

function defaultRange() {
    const now = new Date();
    const to = dateKey(now);
    const fromDate = new Date(new Date(`${to}T00:00:00+07:00`).getTime() - 29 * 24 * 60 * 60 * 1000);
    return { from: dateKey(fromDate), to };
}

function isDateKey(value: string | null): value is string {
    return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function initialRange(searchParams: Pick<URLSearchParams, 'get'>) {
    const fallback = defaultRange();
    const legacyDate = searchParams.get('date');
    if (isDateKey(legacyDate)) return { from: legacyDate, to: legacyDate };
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    return {
        from: isDateKey(from) ? from : fallback.from,
        to: isDateKey(to) ? to : fallback.to,
    };
}

function formatMoney(value: number) {
    return new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0);
}

function formatNumber(value: number, digits = 2) {
    return new Intl.NumberFormat('th-TH', { maximumFractionDigits: digits }).format(value || 0);
}

function formatDate(value: string) {
    return new Date(`${value}T00:00:00+07:00`).toLocaleDateString('th-TH', {
        day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Bangkok',
    });
}

function formatTime(value: string | null) {
    if (!value) return '-';
    return new Date(value).toLocaleTimeString('th-TH', {
        hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok',
    });
}

function formatDuration(openedAt: string, closedAt: string | null) {
    if (!closedAt) return 'กำลังเปิดอยู่';
    const diffMs = Math.max(0, new Date(closedAt).getTime() - new Date(openedAt).getTime());
    const hours = Math.floor(diffMs / (60 * 60 * 1000));
    const minutes = Math.floor((diffMs % (60 * 60 * 1000)) / (60 * 1000));
    return `${hours} ชม. ${minutes} นาที`;
}

function legacyHistoryPath(context: StationContextPayload) {
    if (context.station.type === 'GAS') return `/admin/gas-history?stationId=${context.station.id}`;
    if (context.station.type === 'FULL') return context.paths.history;
    return `/simple-station/${context.station.number}`;
}

const attentionLabels: Record<StationHistoryAttentionReason, string> = {
    OPEN_SHIFT: 'กะยังเปิด',
    METER_ANOMALY: 'มิเตอร์ผิดปกติ',
    DAILY_ANOMALY: 'ยอดรายวันผิดปกติ',
    RECONCILIATION_VARIANCE: 'ยอดกระทบต่าง',
};

function ShiftStatusBadge({ status }: { status: StationHistoryShift['status'] }) {
    if (status === 'OPEN') return <Badge variant="warning">OPEN</Badge>;
    if (status === 'LOCKED') return <Badge variant="default">LOCKED</Badge>;
    return <Badge variant="success">CLOSED</Badge>;
}

function ShiftDetail({ shift }: { shift: StationHistoryShift }) {
    return (
        <div className="space-y-4 border-t border-[var(--ui-border)] px-4 py-4">
            <div className="grid gap-3 text-sm sm:grid-cols-3">
                <div>
                    <div className="text-xs text-[var(--ui-text-muted)]">เปิดกะโดย</div>
                    <div className="mt-1 font-semibold">{shift.staffName || 'ไม่ระบุ'}</div>
                </div>
                <div>
                    <div className="text-xs text-[var(--ui-text-muted)]">ปิดกะโดย</div>
                    <div className="mt-1 font-semibold">{shift.closedByName || (shift.status === 'OPEN' ? '-' : 'ไม่ระบุ')}</div>
                </div>
                <div>
                    <div className="text-xs text-[var(--ui-text-muted)]">ระยะเวลากะ</div>
                    <div className="mt-1 font-semibold">{formatDuration(shift.openedAt, shift.closedAt)}</div>
                </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-[var(--ui-radius-md)] bg-[var(--ui-surface-subtle)] p-3">
                    <div className="text-xs text-[var(--ui-text-muted)]">มิเตอร์</div>
                    <div className="mt-1 font-bold">{formatNumber(shift.totalMeterLiters, 3)} L</div>
                </div>
                <div className="rounded-[var(--ui-radius-md)] bg-[var(--ui-surface-subtle)] p-3">
                    <div className="text-xs text-[var(--ui-text-muted)]">รายการขายที่ผูกกะ</div>
                    <div className="mt-1 font-bold">{shift.transactionCount.toLocaleString('th-TH')} รายการ · {formatNumber(shift.transactionLiters, 3)} L</div>
                </div>
                <div className="rounded-[var(--ui-radius-md)] bg-[var(--ui-surface-subtle)] p-3">
                    <div className="text-xs text-[var(--ui-text-muted)]">ต่างกัน (มิเตอร์ − รายการขาย)</div>
                    <div className={`mt-1 font-bold ${Math.abs(shift.meterTransactionDifferenceLiters) > 1 ? 'text-[var(--ui-warning-text)]' : ''}`}>
                        {shift.meterTransactionDifferenceLiters > 0 ? '+' : ''}{formatNumber(shift.meterTransactionDifferenceLiters, 3)} L
                    </div>
                </div>
                <div className="rounded-[var(--ui-radius-md)] bg-[var(--ui-surface-subtle)] p-3">
                    <div className="text-xs text-[var(--ui-text-muted)]">ยอดรายการขายจริง</div>
                    <div className="mt-1 font-bold">฿{formatMoney(shift.transactionAmount)}</div>
                </div>
            </div>

            {shift.meters.length > 0 && (
                <div>
                    <h4 className="mb-2 text-sm font-bold">มิเตอร์</h4>
                    <div className="grid gap-2 sm:grid-cols-2">
                        {shift.meters.map((meter) => (
                            <div key={meter.nozzleNumber} className="rounded-[var(--ui-radius-md)] border border-[var(--ui-border)] p-3 text-sm">
                                <div className="flex items-center justify-between gap-3">
                                    <strong>หัว {meter.nozzleNumber}</strong>
                                    <span>{formatNumber(meter.soldQty || 0, 3)} L</span>
                                </div>
                                <div className="mt-1 text-[var(--ui-text-muted)]">
                                    {formatNumber(meter.startReading, 3)} → {meter.endReading == null ? '-' : formatNumber(meter.endReading, 3)}
                                </div>
                                {(meter.startPhoto || meter.endPhoto) && (
                                    <div className="mt-2 flex gap-3 text-xs font-semibold">
                                        {meter.startPhoto && <a href={meter.startPhoto} target="_blank" rel="noreferrer" className="rounded-sm underline underline-offset-4 focus-visible:outline-none focus-visible:shadow-[var(--ui-shadow-focus)]">รูปเปิด</a>}
                                        {meter.endPhoto && <a href={meter.endPhoto} target="_blank" rel="noreferrer" className="rounded-sm underline underline-offset-4 focus-visible:outline-none focus-visible:shadow-[var(--ui-shadow-focus)]">รูปปิด</a>}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {shift.gauges.length > 0 && (
                <div>
                    <h4 className="mb-2 text-sm font-bold">เกจถัง</h4>
                    <div className="grid gap-2 sm:grid-cols-3">
                        {shift.gauges.map((gauge) => (
                            <div key={gauge.tankNumber} className="rounded-[var(--ui-radius-md)] border border-[var(--ui-border)] p-3 text-sm">
                                <strong>ถัง {gauge.tankNumber}</strong>
                                <div className="mt-1 text-[var(--ui-text-muted)]">
                                    {gauge.startPercentage == null ? '-' : `${formatNumber(gauge.startPercentage)}%`} → {gauge.endPercentage == null ? '-' : `${formatNumber(gauge.endPercentage)}%`}
                                </div>
                                {(gauge.startPhoto || gauge.endPhoto) && (
                                    <div className="mt-2 flex gap-3 text-xs font-semibold">
                                        {gauge.startPhoto && <a href={gauge.startPhoto} target="_blank" rel="noreferrer" className="rounded-sm underline underline-offset-4 focus-visible:outline-none focus-visible:shadow-[var(--ui-shadow-focus)]">รูปเปิด</a>}
                                        {gauge.endPhoto && <a href={gauge.endPhoto} target="_blank" rel="noreferrer" className="rounded-sm underline underline-offset-4 focus-visible:outline-none focus-visible:shadow-[var(--ui-shadow-focus)]">รูปปิด</a>}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {shift.reconciliation && (
                <div className="rounded-[var(--ui-radius-md)] border border-[var(--ui-border)] p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <h4 className="text-sm font-bold">กระทบยอด</h4>
                        <Badge variant={shift.reconciliation.varianceStatus === 'GREEN' ? 'success' : shift.reconciliation.varianceStatus === 'YELLOW' ? 'warning' : 'error'}>
                            {shift.reconciliation.varianceStatus}
                        </Badge>
                    </div>
                    <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
                        <div><span className="text-[var(--ui-text-muted)]">ควรได้ </span><strong>฿{formatMoney(shift.reconciliation.totalExpected)}</strong></div>
                        <div><span className="text-[var(--ui-text-muted)]">รับจริง </span><strong>฿{formatMoney(shift.reconciliation.totalReceived)}</strong></div>
                        <div><span className="text-[var(--ui-text-muted)]">รับจริง − ควรได้ </span><strong>{shift.reconciliation.variance >= 0 ? '+' : ''}฿{formatMoney(shift.reconciliation.variance)}</strong></div>
                    </div>
                    {(shift.varianceNote || shift.reconciliation.otherIncomeNote || shift.reconciliation.otherExpenseNote) && (
                        <div className="mt-3 space-y-1 text-xs text-[var(--ui-text-muted)]">
                            {shift.varianceNote && <div>หมายเหตุ: {shift.varianceNote}</div>}
                            {shift.reconciliation.otherIncomeNote && <div>รายรับอื่น: {shift.reconciliation.otherIncomeNote}</div>}
                            {shift.reconciliation.otherExpenseNote && <div>ค่าใช้จ่าย: {shift.reconciliation.otherExpenseNote}</div>}
                        </div>
                    )}
                </div>
            )}

            {shift.anomalies.length > 0 && (
                <div>
                    <h4 className="mb-2 text-sm font-bold">Meter anomaly</h4>
                    <div className="space-y-2">
                        {shift.anomalies.map((anomaly) => (
                            <div key={anomaly.id} className="flex items-start gap-2 rounded-[var(--ui-radius-md)] border border-[var(--ui-border)] p-3 text-sm">
                                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--ui-warning-text)]" aria-hidden="true" />
                                <div>
                                    <div className="font-semibold">หัว {anomaly.nozzleNumber} · {anomaly.severity} · ต่าง {formatNumber(anomaly.percentDiff)}%</div>
                                    <div className="mt-1 text-[var(--ui-text-muted)]">ขาย {formatNumber(anomaly.soldQty, 3)} L · ค่าเฉลี่ย {formatNumber(anomaly.averageQty, 3)} L{anomaly.note ? ` · ${anomaly.note}` : ''}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {shift.dailyAnomaly && (
                <Notice tone="warning" title={`Daily anomaly · ${shift.dailyAnomaly.severity}`}>
                    มิเตอร์ {formatNumber(shift.dailyAnomaly.meterTotal, 3)} L · รายการขาย {formatNumber(shift.dailyAnomaly.transactionTotal, 3)} L · ต่าง {shift.dailyAnomaly.difference >= 0 ? '+' : ''}{formatNumber(shift.dailyAnomaly.difference, 3)} L
                    {shift.dailyAnomaly.note ? ` · ${shift.dailyAnomaly.note}` : ''}
                </Notice>
            )}
        </div>
    );
}

export function StationHistory({ context }: { context: StationContextPayload }) {
    const searchParams = useSearchParams();
    const showFullAdminMaintenance = context.station.operationalStatus === 'ACTIVE'
        && context.station.type === 'FULL'
        && context.user.role === 'ADMIN';
    const showRetiredSimpleMaintenance = context.station.operationalStatus === 'RETIRED'
        && context.station.type === 'SIMPLE';
    const showDailyMaintenance = showFullAdminMaintenance || showRetiredSimpleMaintenance;
    const [{ from, to }] = React.useState(() => initialRange(searchParams));
    const [fromDate, setFromDate] = React.useState(from);
    const [toDate, setToDate] = React.useState(to);
    const [status, setStatus] = React.useState('ALL');
    const [attentionOnly, setAttentionOnly] = React.useState(false);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [data, setData] = React.useState<StationHistoryResponse | null>(null);

    const load = React.useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams({ from: fromDate, to: toDate, status });
            if (attentionOnly) params.set('attention', '1');
            const response = await fetch(`/api/stations/${context.station.id}/history?${params}`, { cache: 'no-store' });
            const payload = await response.json().catch(() => null);
            if (!response.ok) throw new Error(payload?.error || 'โหลดประวัติไม่สำเร็จ');
            setData(payload as StationHistoryResponse);
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : 'โหลดประวัติไม่สำเร็จ');
        } finally {
            setLoading(false);
        }
    }, [attentionOnly, context.station.id, fromDate, status, toDate]);

    React.useEffect(() => { void load(); }, [load]);

    return (
        <div className="space-y-4">
            <Notice tone="info" title={showDailyMaintenance ? 'ประวัติและเอกสารย้อนหลัง' : 'ประวัติเป็น read-only'}>
                {context.station.operationalStatus === 'RETIRED'
                    ? context.user.role === 'ADMIN'
                        ? 'สถานีนี้ย้ายงานหน้าปั๊มไป POS แล้ว แอดมินยังดูแลรายการเดิมแบบมีสิทธิ์แก้/ยกเลิก ส่วนพนักงานเป็น read/print/export only; ไม่มีการสร้างงานหน้าปั๊มใหม่'
                        : 'สถานีนี้ย้ายงานหน้าปั๊มไป POS แล้ว ข้อมูลเดิมยังค้นหา ดูสลิป ส่งออก CSV และพิมพ์เอกสารได้ แต่ STAFF ไม่มีสิทธิ์แก้/ยกเลิกรายการหรือสร้างงานใหม่'
                    : showFullAdminMaintenance
                        ? 'Shift history ด้านล่างเป็นข้อมูลตรวจสอบแบบ read-only ส่วนแอดมิน FULL ใช้แผงดูแลรายวันสำหรับแก้/ยกเลิกรายการ แนบสลิป พิมพ์ และตรวจ Audit Log ได้จากหน้าเดียวกัน'
                        : 'หน้า canonical history ใช้ตรวจย้อนหลังเท่านั้น'}
            </Notice>

            <Section title="ตัวกรอง" description="ช่วงวันที่สูงสุดครั้งละ 93 วัน">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <label className="text-sm font-semibold">จากวันที่
                        <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} className="mt-1 min-h-11 w-full rounded-[var(--ui-radius-md)] border border-[var(--ui-border-strong)] bg-[var(--ui-surface)] px-3 font-normal focus-visible:outline-none focus-visible:shadow-[var(--ui-shadow-focus)]" />
                    </label>
                    <label className="text-sm font-semibold">ถึงวันที่
                        <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} className="mt-1 min-h-11 w-full rounded-[var(--ui-radius-md)] border border-[var(--ui-border-strong)] bg-[var(--ui-surface)] px-3 font-normal focus-visible:outline-none focus-visible:shadow-[var(--ui-shadow-focus)]" />
                    </label>
                    <label className="text-sm font-semibold">สถานะกะ
                        <select value={status} onChange={(event) => setStatus(event.target.value)} className="mt-1 min-h-11 w-full rounded-[var(--ui-radius-md)] border border-[var(--ui-border-strong)] bg-[var(--ui-surface)] px-3 font-normal focus-visible:outline-none focus-visible:shadow-[var(--ui-shadow-focus)]">
                            <option value="ALL">ทุกสถานะ</option>
                            <option value="CLOSED">CLOSED</option>
                            <option value="LOCKED">LOCKED</option>
                            <option value="OPEN">OPEN</option>
                        </select>
                    </label>
                    <div className="flex items-end">
                        <Button variant={attentionOnly ? 'default' : 'outline'} className="w-full" onClick={() => setAttentionOnly((value) => !value)} aria-pressed={attentionOnly}>
                            <AlertTriangle className="h-4 w-4" aria-hidden="true" /> {attentionOnly ? 'กำลังดูเฉพาะต้องตรวจ' : 'เฉพาะต้องตรวจ'}
                        </Button>
                    </div>
                </div>
            </Section>

            {error && (
                <Notice tone="danger" title="โหลดประวัติไม่สำเร็จ" action={<Button size="sm" variant="outline" onClick={() => void load()}><RefreshCw className="h-4 w-4" aria-hidden="true" />ลองใหม่</Button>}>
                    {error}
                </Notice>
            )}

            {loading && !data ? (
                <div role="status" aria-label="กำลังโหลดประวัติสถานี" className="h-48 animate-pulse rounded-[var(--ui-radius-lg)] bg-[var(--ui-surface-subtle)]" />
            ) : data ? (
                <>
                    <Section title="สรุป" description={`${formatDate(data.filters.from)} – ${formatDate(data.filters.to)}`}>
                        <div className="grid gap-3 sm:grid-cols-5">
                            {[
                                ['กะ', data.summary.shifts],
                                ['ยัง OPEN', data.summary.openShifts],
                                ['ต้องตรวจ', data.summary.attentionShifts],
                                ['Meter anomaly', data.summary.meterAnomalies],
                                ['Daily anomaly', data.summary.dailyAnomalies],
                            ].map(([label, value]) => (
                                <div key={String(label)} className="rounded-[var(--ui-radius-md)] bg-[var(--ui-surface-subtle)] p-3">
                                    <div className="text-xs text-[var(--ui-text-muted)]">{label}</div>
                                    <div className="mt-1 text-xl font-bold">{Number(value).toLocaleString('th-TH')}</div>
                                </div>
                            ))}
                        </div>
                    </Section>

                    <Section title="Shift history" description="เรียงจากวันที่ล่าสุด · แตะ/คลิกแต่ละกะเพื่อดู meter, gauge, reconciliation และ anomaly">
                        {data.shifts.length === 0 ? (
                            <EmptyState compact icon={History} title="ไม่พบประวัติในช่วงที่เลือก" description="ลองขยายช่วงวันที่หรือเปลี่ยนตัวกรอง" />
                        ) : (
                            <div className="space-y-3">
                                {data.shifts.map((shift) => (
                                    <details key={shift.id} className="group overflow-hidden rounded-[var(--ui-radius-md)] border border-[var(--ui-border)] bg-[var(--ui-surface)]">
                                        <summary className="cursor-pointer list-none px-4 py-4 focus-visible:outline-none focus-visible:shadow-[var(--ui-shadow-focus)]">
                                            <div className="flex flex-wrap items-start justify-between gap-3">
                                                <div>
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <strong>{formatDate(shift.businessDate)} · กะ {shift.shiftNumber}</strong>
                                                        <ShiftStatusBadge status={shift.status} />
                                                        {shift.attentionReasons.map((reason) => <Badge key={reason} variant="warning">{attentionLabels[reason]}</Badge>)}
                                                    </div>
                                                    <div className="mt-1 text-xs text-[var(--ui-text-muted)]">
                                                        {shift.staffName || 'ไม่ระบุพนักงาน'} · {formatTime(shift.openedAt)}–{formatTime(shift.closedAt)}
                                                    </div>
                                                </div>
                                                <div className="text-right text-sm">
                                                    <div className="font-semibold">{formatNumber(shift.totalMeterLiters, 3)} L</div>
                                                    {shift.reconciliation && <div className="text-xs text-[var(--ui-text-muted)]">รับจริง ฿{formatMoney(shift.reconciliation.totalReceived)}</div>}
                                                </div>
                                            </div>
                                        </summary>
                                        <ShiftDetail shift={shift} />
                                    </details>
                                ))}
                            </div>
                        )}
                    </Section>
                </>
            ) : null}

            {showDailyMaintenance && (
                <FullHistoryMaintenance context={context} defaultDate={toDate} />
            )}

            {context.station.operationalStatus !== 'RETIRED' && context.station.type !== 'FULL' && (
                <div className="text-right">
                    <Link href={legacyHistoryPath(context)} className="inline-flex min-h-11 items-center gap-2 rounded-sm text-xs font-semibold text-[var(--ui-text-muted)] underline-offset-4 hover:text-[var(--ui-text)] hover:underline focus-visible:outline-none focus-visible:shadow-[var(--ui-shadow-focus)]">
                        เปิดประวัติเดิม (fallback) <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                </div>
            )}
        </div>
    );
}
