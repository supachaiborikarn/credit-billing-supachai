'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    ArrowRight,
    Calculator,
    Clock3,
    Fuel,
    Gauge,
    History,
    LockKeyhole,
    PackagePlus,
    Settings2,
    ShoppingBag,
} from 'lucide-react';
import { RedesignAppShell } from '@/components/layout';
import { SaleFlowForm } from '@/components/sales/SaleFlowForm';
import { ShiftClosingFlow } from '@/components/stations/ShiftClosingFlow';
import { StationHistory } from '@/components/stations/StationHistory';
import { ShiftOpeningFlow } from '@/components/stations/ShiftOpeningFlow';
import { AsyncRefreshState, Badge, EmptyState, FatalErrorState, LoadingState, Notice, Section } from '@/components/ui';
import { isActiveSaleStationId } from '@/lib/sales/sale-flow';
import type { StationContextPayload } from '@/types/station';

export type CanonicalStationWorkspaceMode = 'OVERVIEW' | 'SALES' | 'OPERATIONS' | 'HISTORY';

function legacyPaths(context: StationContextPayload) {
    const number = context.station.number;
    if (context.station.type === 'GAS') {
        return {
            base: `/gas/${number}`,
            sales: `/gas/${number}/sell`,
            operations: `/gas/${number}`,
            history: `/admin/gas-history?stationId=${context.station.id}`,
        };
    }
    if (context.station.type === 'FULL') {
        return {
            base: `/station/${number}/v2`,
            sales: `/station/${number}/v2`,
            operations: `/station/${number}/v2`,
            history: `/station/${number}/history`,
        };
    }
    return {
        base: `/simple-station/${number}`,
        sales: `/simple-station/${number}`,
        operations: `/simple-station/${number}`,
        history: `/simple-station/${number}`,
    };
}

function ShiftStatus({ context }: { context: StationContextPayload }) {
    if (context.station.operationalStatus === 'RETIRED') {
        return <Badge variant="default">ย้ายไป POS แล้ว</Badge>;
    }
    if (!context.currentShift) {
        return <Badge variant="warning">ยังไม่มีกะปัจจุบัน</Badge>;
    }
    return (
        <Badge variant={context.currentShift.status === 'OPEN' ? 'success' : 'default'}>
            กะ {context.currentShift.shiftNumber} · {context.currentShift.status === 'OPEN' ? 'เปิดอยู่' : 'ปิดแล้ว'}
        </Badge>
    );
}

function GasPriceUpdate({
    context,
    onRefresh,
    disabled,
}: {
    context: StationContextPayload;
    onRefresh: () => Promise<void>;
    disabled: boolean;
}) {
    const currentPrice = context.saleContext?.gasPrice ?? null;
    const [price, setPrice] = React.useState(currentPrice !== null ? currentPrice.toFixed(2) : '');
    const [saving, setSaving] = React.useState(false);
    const [message, setMessage] = React.useState<{ tone: 'success' | 'danger'; text: string } | null>(null);

    React.useEffect(() => {
        if (!saving) setPrice(currentPrice !== null ? currentPrice.toFixed(2) : '');
    }, [currentPrice, saving]);

    const save = async () => {
        const parsed = Number(price.trim().replace(/,/g, ''));
        if (!Number.isFinite(parsed) || parsed <= 0) {
            setMessage({ tone: 'danger', text: 'ราคาขายต้องเป็นตัวเลขมากกว่า 0' });
            return;
        }

        setSaving(true);
        setMessage(null);
        try {
            const response = await fetch(`/api/v2/gas/${context.station.number}/price`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ gasPrice: parsed }),
            });
            const payload = await response.json().catch(() => null) as { gasPrice?: number; error?: string } | null;
            if (!response.ok) throw new Error(payload?.error || 'อัปเดตราคาขายไม่สำเร็จ');

            const savedPrice = Number(payload?.gasPrice ?? parsed);
            if (Number.isFinite(savedPrice)) setPrice(savedPrice.toFixed(2));
            setMessage({ tone: 'success', text: 'อัปเดตราคาขายแก๊สแล้ว รายการที่บันทึกไปก่อนหน้านี้ยังคงราคาเดิม' });
            await onRefresh();
        } catch (error) {
            setMessage({ tone: 'danger', text: error instanceof Error ? error.message : 'อัปเดตราคาขายไม่สำเร็จ' });
        } finally {
            setSaving(false);
        }
    };

    return (
        <Section
            title="ราคาขายแก๊ส"
            description={`วันที่งาน ${context.saleContext?.businessDate || '-'} · ราคานี้ใช้กับรายการขายใหม่และบันทึกเป็นราคาหลักของสถานี`}
        >
            <div className="space-y-3">
                {message && (
                    <Notice tone={message.tone} title={message.tone === 'success' ? 'บันทึกแล้ว' : 'บันทึกไม่สำเร็จ'}>
                        {message.text}
                    </Notice>
                )}
                {disabled && (
                    <Notice tone="warning" title="กำลังตรวจสถานะสถานี">
                        ปิดการแก้ราคาไว้ชั่วคราวจนกว่าจะรีเฟรช StationContext สำเร็จ
                    </Notice>
                )}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <label className="block flex-1">
                        <span className="mb-1 block text-sm font-semibold text-[var(--ui-text-secondary)]">ราคาขาย / ลิตร</span>
                        <div className="relative">
                            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--ui-text-muted)]">฿</span>
                            <input
                                type="text"
                                inputMode="decimal"
                                value={price}
                                onChange={(event) => setPrice(event.target.value)}
                                disabled={disabled || saving}
                                className="h-[var(--ui-control-md)] w-full rounded-[var(--ui-radius-md)] border border-[var(--ui-border-strong)] bg-[var(--ui-surface)] pl-8 pr-3 text-right font-mono text-base text-[var(--ui-text)] outline-none focus-visible:shadow-[var(--ui-shadow-focus)] disabled:cursor-not-allowed disabled:opacity-60"
                                aria-label="ราคาขายแก๊สต่อลิตร"
                            />
                        </div>
                    </label>
                    <button
                        type="button"
                        onClick={() => void save()}
                        disabled={disabled || saving}
                        className="inline-flex h-[var(--ui-control-md)] items-center justify-center rounded-[var(--ui-radius-md)] bg-[var(--ui-primary-700)] px-4 text-sm font-semibold text-white hover:bg-[var(--ui-primary-800)] focus-visible:outline-none focus-visible:shadow-[var(--ui-shadow-focus)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {saving ? 'กำลังบันทึก…' : 'บันทึกราคา'}
                    </button>
                </div>
                <p className="text-xs text-[var(--ui-text-muted)]">API เดิมจะอัปเดต DailyRecord ของ business date ปัจจุบันและ Station default พร้อม AuditLog</p>
            </div>
        </Section>
    );
}

interface GasLiveSummaryPayload {
    sales: {
        cash: number;
        credit: number;
        card: number;
        transfer: number;
        total: number;
        transactionCount: number;
        liters: number;
    };
    gauge: {
        tank1: number | null;
        tank2: number | null;
        tank3: number | null;
        average: number;
    };
    meters?: Array<{
        nozzle: number;
        nozzleNumber?: number;
        startReading: number | null;
        endReading: number | null;
        liters: number;
        amount: number;
    }>;
    transactions?: Array<{
        id: string;
        paymentType: string;
        amount: number;
        liters: number;
        ownerName?: string | null;
        truckPlate?: string | null;
        licensePlate?: string | null;
        createdAt: string;
    }>;
    alerts: string[];
}

const gasNumberFormatter = new Intl.NumberFormat('th-TH', { maximumFractionDigits: 2 });

function getGasPaymentLabel(paymentType: string) {
    if (paymentType === 'CASH') return 'เงินสด';
    if (paymentType === 'CREDIT') return 'เงินเชื่อ';
    if (paymentType === 'CREDIT_CARD' || paymentType === 'CARD') return 'บัตร';
    if (paymentType === 'TRANSFER') return 'โอน';
    return paymentType;
}

function GasLiveSummary({ context }: { context: StationContextPayload }) {
    const [data, setData] = React.useState<GasLiveSummaryPayload | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    const load = React.useCallback(async () => {
        try {
            const response = await fetch(`/api/v2/gas/${context.station.number}/summary`, { cache: 'no-store' });
            const payload = await response.json().catch(() => null) as (GasLiveSummaryPayload & { error?: string }) | null;
            if (!response.ok || !payload) throw new Error(payload?.error || 'โหลดสรุป GAS ไม่สำเร็จ');
            setData(payload);
            setError(null);
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : 'โหลดสรุป GAS ไม่สำเร็จ');
        } finally {
            setLoading(false);
        }
    }, [context.station.number]);

    React.useEffect(() => {
        void load();
        const interval = window.setInterval(() => void load(), 30_000);
        return () => window.clearInterval(interval);
    }, [load]);

    if (loading && !data) {
        return (
            <Section title="สถานะ GAS ตอนนี้" description="ยอดขาย ระดับถัง มิเตอร์ และรายการล่าสุดของกะปัจจุบัน">
                <div className="h-28 animate-pulse rounded-[var(--ui-radius-md)] bg-[var(--ui-surface-subtle)]" />
            </Section>
        );
    }

    if (!data) {
        return (
            <Section title="สถานะ GAS ตอนนี้" description="ยอดขาย ระดับถัง มิเตอร์ และรายการล่าสุดของกะปัจจุบัน">
                <Notice tone="danger" title="โหลดข้อมูลสรุปไม่สำเร็จ">{error || 'ไม่พบข้อมูลสรุป'}</Notice>
            </Section>
        );
    }

    const paymentBuckets = [
        ['เงินสด', data.sales.cash],
        ['เงินเชื่อ', data.sales.credit],
        ['บัตร', data.sales.card],
        ['โอน', data.sales.transfer],
    ] as const;
    const tanks = [data.gauge.tank1, data.gauge.tank2, data.gauge.tank3];
    const meters = data.meters ?? [];
    const recentTransactions = (data.transactions ?? []).slice(0, 10);

    return (
        <Section title="สถานะ GAS ตอนนี้" description="อ่านจาก summary source เดิมและอัปเดตอัตโนมัติทุก 30 วินาที">
            <div className="space-y-4" aria-live="polite">
                {error && <Notice tone="warning" title="รีเฟรชล่าสุดไม่สำเร็จ">กำลังแสดงข้อมูลล่าสุดที่โหลดสำเร็จ · {error}</Notice>}
                {data.alerts.length > 0 && (
                    <Notice tone="danger" title="ระดับถังต้องตรวจสอบ">
                        <ul className="list-disc space-y-1 pl-5">
                            {data.alerts.map((alert) => <li key={alert}>{alert}</li>)}
                        </ul>
                    </Notice>
                )}

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {paymentBuckets.map(([label, amount]) => (
                        <div key={label} className="rounded-[var(--ui-radius-md)] border border-[var(--ui-border)] p-3">
                            <div className="text-xs font-semibold text-[var(--ui-text-muted)]">{label}</div>
                            <div className="mt-1 font-bold tabular-nums">฿{gasNumberFormatter.format(amount)}</div>
                        </div>
                    ))}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[var(--ui-radius-md)] border border-[var(--ui-border)] p-4">
                        <div className="text-sm font-semibold">ยอดกะปัจจุบัน</div>
                        <div className="mt-3 grid grid-cols-3 divide-x divide-[var(--ui-border)] text-center">
                            <div className="px-2">
                                <div className="font-bold tabular-nums">{data.sales.transactionCount}</div>
                                <div className="text-xs text-[var(--ui-text-muted)]">รายการ</div>
                            </div>
                            <div className="px-2">
                                <div className="font-bold tabular-nums">{gasNumberFormatter.format(data.sales.liters)}</div>
                                <div className="text-xs text-[var(--ui-text-muted)]">ลิตร</div>
                            </div>
                            <div className="px-2">
                                <div className="font-bold tabular-nums">฿{gasNumberFormatter.format(data.sales.total)}</div>
                                <div className="text-xs text-[var(--ui-text-muted)]">รวม</div>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-[var(--ui-radius-md)] border border-[var(--ui-border)] p-4">
                        <div className="flex items-center justify-between gap-3">
                            <div className="text-sm font-semibold">ระดับถังล่าสุด</div>
                            <div className="text-xs text-[var(--ui-text-muted)]">เฉลี่ย {gasNumberFormatter.format(data.gauge.average)}%</div>
                        </div>
                        <div className="mt-3 grid grid-cols-3 gap-2">
                            {tanks.map((value, index) => (
                                <div key={index} className="rounded-[var(--ui-radius-sm)] bg-[var(--ui-surface-subtle)] p-2 text-center">
                                    <div className="text-xs text-[var(--ui-text-muted)]">ถัง {index + 1}</div>
                                    <div className={`mt-1 font-bold tabular-nums ${value !== null && value < 20 ? 'text-[var(--ui-danger-text)]' : 'text-[var(--ui-text)]'}`}>
                                        {value === null ? '-' : `${gasNumberFormatter.format(value)}%`}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {(meters.length > 0 || recentTransactions.length > 0) && (
                    <div className="grid gap-4 lg:grid-cols-2">
                        {meters.length > 0 && (
                            <div className="min-w-0 rounded-[var(--ui-radius-md)] border border-[var(--ui-border)] p-4">
                                <div className="flex items-center gap-2 text-sm font-semibold">
                                    <Calculator className="h-4 w-4 text-[var(--ui-text-muted)]" aria-hidden="true" />
                                    มิเตอร์หัวจ่าย
                                </div>
                                <div className="mt-3 overflow-x-auto">
                                    <table className="w-full min-w-[520px] text-sm">
                                        <thead className="text-xs text-[var(--ui-text-muted)]">
                                            <tr className="border-b border-[var(--ui-border)]">
                                                <th className="pb-2 text-left font-semibold">หัว</th>
                                                <th className="pb-2 text-right font-semibold">เปิด</th>
                                                <th className="pb-2 text-right font-semibold">ปิด</th>
                                                <th className="pb-2 text-right font-semibold">ลิตร</th>
                                                <th className="pb-2 text-right font-semibold">มูลค่า</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {meters.map((meter) => (
                                                <tr key={meter.nozzle} className="border-b border-[var(--ui-border)] last:border-b-0">
                                                    <td className="py-2 font-semibold">{meter.nozzle}</td>
                                                    <td className="py-2 text-right tabular-nums text-[var(--ui-text-secondary)]">{meter.startReading === null ? '-' : gasNumberFormatter.format(meter.startReading)}</td>
                                                    <td className="py-2 text-right tabular-nums text-[var(--ui-text-secondary)]">{meter.endReading === null ? '-' : gasNumberFormatter.format(meter.endReading)}</td>
                                                    <td className="py-2 text-right font-semibold tabular-nums">{gasNumberFormatter.format(meter.liters)}</td>
                                                    <td className="py-2 text-right font-semibold tabular-nums">฿{gasNumberFormatter.format(meter.amount)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {recentTransactions.length > 0 && (
                            <div className="min-w-0 rounded-[var(--ui-radius-md)] border border-[var(--ui-border)] p-4">
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2 text-sm font-semibold">
                                        <Fuel className="h-4 w-4 text-[var(--ui-text-muted)]" aria-hidden="true" />
                                        รายการขายล่าสุด
                                    </div>
                                    <span className="text-xs text-[var(--ui-text-muted)]">สูงสุด 10 รายการ</span>
                                </div>
                                <div className="mt-2 divide-y divide-[var(--ui-border)]">
                                    {recentTransactions.map((transaction) => {
                                        const plate = transaction.truckPlate || transaction.licensePlate;
                                        return (
                                            <div key={transaction.id} className="flex items-start justify-between gap-3 py-3">
                                                <div className="min-w-0">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <Badge variant="default">{getGasPaymentLabel(transaction.paymentType)}</Badge>
                                                        {transaction.ownerName && <span className="truncate text-sm font-semibold">{transaction.ownerName}</span>}
                                                    </div>
                                                    <div className="mt-1 text-xs text-[var(--ui-text-muted)]">
                                                        {plate ? `${plate} · ` : ''}{new Date(transaction.createdAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                                                    </div>
                                                </div>
                                                <div className="shrink-0 text-right">
                                                    <div className="font-bold tabular-nums">฿{gasNumberFormatter.format(transaction.amount)}</div>
                                                    <div className="text-xs tabular-nums text-[var(--ui-text-muted)]">{gasNumberFormatter.format(transaction.liters)} ลิตร</div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </Section>
    );
}

function StaleGasShiftNotice({ context }: { context: StationContextPayload }) {
    if (context.station.type !== 'GAS' || !context.staleShift) return null;

    return (
        <Notice tone="danger" title="มีกะ GAS ค้างจากวันก่อน">
            <div className="flex flex-wrap items-center gap-3">
                <span>
                    กะ {context.staleShift.shiftNumber} วันที่ {context.staleShift.businessDate} ยังมีสถานะ OPEN ในระบบ
                </span>
                {context.user.role === 'ADMIN' ? (
                    <Link
                        href="/admin/gas/operations"
                        className="font-semibold underline underline-offset-4 focus-visible:outline-none focus-visible:shadow-[var(--ui-shadow-focus)]"
                    >
                        ไปจัดการกะค้าง
                    </Link>
                ) : (
                    <span className="font-semibold">กรุณาแจ้งแอดมินให้ตรวจสอบก่อนแก้ข้อมูลกะเก่า</span>
                )}
            </div>
        </Notice>
    );
}

function Overview({ context, onRefresh, writeBlocked }: { context: StationContextPayload; onRefresh: () => Promise<void>; writeBlocked: boolean }) {
    const actions = [
        context.permissions.canSell
            ? { label: 'ขาย', href: context.paths.sales, icon: Fuel, description: 'บันทึกรายการขายของสถานีนี้' }
            : null,
        context.permissions.canOperate
            ? { label: 'งานกะ', href: context.paths.operations, icon: Settings2, description: 'เปิดกะ ปิดกะ และตรวจข้อมูลปฏิบัติการ' }
            : null,
        context.permissions.canViewHistory
            ? { label: 'ประวัติ', href: context.paths.history, icon: History, description: 'ดูข้อมูลย้อนหลังแบบ read-only' }
            : null,
    ].filter(Boolean) as Array<{ label: string; href: string; icon: typeof Fuel; description: string }>;

    return (
        <div className="space-y-4">
            {context.station.operationalStatus === 'RETIRED' && (
                <Notice tone="info" title="สถานีนี้ย้ายงานหน้าปั๊มไป POS แล้ว">
                    ระบบนี้เก็บข้อมูลเดิมสำหรับประวัติ รายงาน ลูกค้า และ Billing เท่านั้น ไม่มีการเปิดกะหรือสร้างรายการขายใหม่
                </Notice>
            )}

            <Section title="สถานะสถานี" description={`${context.station.type} · ${context.station.id}`}>
                <div className="flex flex-wrap items-center gap-3">
                    <ShiftStatus context={context} />
                    {context.currentShift && (
                        <span className="text-sm text-[var(--ui-text-muted)]">
                            วันที่งาน {context.currentShift.businessDate} · {context.currentShift.staffName || 'ไม่ระบุพนักงาน'}
                        </span>
                    )}
                </div>
            </Section>

            <Section title="งานของสถานี" description="แสดงเฉพาะงานที่สถานีและสิทธิ์ผู้ใช้อนุญาต">
                {actions.length === 0 ? (
                    <EmptyState compact icon={LockKeyhole} title="ไม่มีงานที่อนุญาต" description="บัญชีนี้ไม่มีสิทธิ์ทำงานกับสถานีนี้" />
                ) : (
                    <div className="grid gap-3 md:grid-cols-3">
                        {actions.map((action) => {
                            const Icon = action.icon;
                            return (
                                <Link
                                    key={action.label}
                                    href={action.href}
                                    className="rounded-[var(--ui-radius-md)] border border-[var(--ui-border)] p-4 transition-colors hover:bg-[var(--ui-surface-subtle)] focus-visible:outline-none focus-visible:shadow-[var(--ui-shadow-focus)]"
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="flex h-9 w-9 items-center justify-center rounded-[var(--ui-radius-md)] bg-[var(--ui-surface-subtle)]">
                                            <Icon className="h-4 w-4" aria-hidden="true" />
                                        </div>
                                        <ArrowRight className="h-4 w-4 text-[var(--ui-text-muted)]" aria-hidden="true" />
                                    </div>
                                    <div className="mt-3 font-bold text-[var(--ui-text)]">{action.label}</div>
                                    <div className="mt-1 text-sm text-[var(--ui-text-muted)]">{action.description}</div>
                                </Link>
                            );
                        })}
                    </div>
                )}
            </Section>

            {context.station.type === 'GAS' && context.station.operationalStatus === 'ACTIVE' && context.permissions.canView && (
                <GasLiveSummary context={context} />
            )}

            {context.station.type === 'GAS' && context.station.operationalStatus === 'ACTIVE' && context.permissions.canOperate && (
                <GasPriceUpdate context={context} onRefresh={onRefresh} disabled={writeBlocked} />
            )}

            {context.station.type === 'GAS' && context.station.operationalStatus === 'ACTIVE' && context.permissions.canOperate && (() => {
                const gasTools = [
                    {
                        label: 'มิเตอร์ (แก้ไข/กู้ข้อมูล)',
                        href: `/gas/${context.station.number}/meters`,
                        icon: Calculator,
                        description: 'ใช้เมื่อต้องแก้ค่าเริ่มกะแบบมี server lock หรือบันทึก end meter แยก',
                    },
                    {
                        label: 'เกจ (แก้ไข/กู้ข้อมูล)',
                        href: `/gas/${context.station.number}/gauge`,
                        icon: Gauge,
                        description: 'แก้ start gauge ที่ยังไม่ถูก lock หรือบันทึก end gauge แยก',
                    },
                    {
                        label: 'ลงแก๊สเข้าถัง',
                        href: `/gas/${context.station.number}/supplies`,
                        icon: PackagePlus,
                        description: 'บันทึกรับ LPG ต้นทุน ซัพพลายเออร์ และประวัติใบส่ง',
                    },
                    context.station.hasProducts
                        ? {
                            label: 'สินค้าและสต็อก',
                            href: `/gas/${context.station.number}/products`,
                            icon: ShoppingBag,
                            description: 'เพิ่มสินค้า รับสต็อก แก้ราคา/ระดับเตือน และดูประวัติ',
                        }
                        : null,
                ].filter(Boolean) as Array<{ label: string; href: string; icon: typeof Calculator; description: string }>;

                return (
                    <Section title="เครื่องมือ GAS เพิ่มเติม" description="งาน correction และ inventory ที่ยังคงเป็น compatibility surface ระหว่าง migration">
                        <div className="mb-3">
                            <Notice tone="info" title="งานเปิด/ปิดกะปกติให้ใช้ Operations">
                                เครื่องมือด้านล่างมีไว้สำหรับแก้ข้อมูลที่ backend ยังอนุญาต หรือจัดการ inventory ที่ยังไม่ได้ย้ายเข้า canonical workflow
                            </Notice>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                            {gasTools.map((tool) => {
                                const Icon = tool.icon;
                                return (
                                    <Link
                                        key={tool.href}
                                        href={tool.href}
                                        className="flex items-start gap-3 rounded-[var(--ui-radius-md)] border border-[var(--ui-border)] p-4 transition-colors hover:bg-[var(--ui-surface-subtle)] focus-visible:outline-none focus-visible:shadow-[var(--ui-shadow-focus)]"
                                    >
                                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--ui-radius-md)] bg-[var(--ui-surface-subtle)]">
                                            <Icon className="h-4 w-4" aria-hidden="true" />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="font-semibold text-[var(--ui-text)]">{tool.label}</div>
                                            <div className="mt-1 text-sm text-[var(--ui-text-muted)]">{tool.description}</div>
                                        </div>
                                        <ArrowRight className="ml-auto mt-1 h-4 w-4 shrink-0 text-[var(--ui-text-muted)]" aria-hidden="true" />
                                    </Link>
                                );
                            })}
                        </div>
                    </Section>
                );
            })()}
        </div>
    );
}

function SalesSkeleton({ context }: { context: StationContextPayload }) {
    const legacy = legacyPaths(context);
    if (!context.permissions.canSell || !isActiveSaleStationId(context.station.id) || context.station.type === 'SIMPLE') {
        return (
            <Notice tone="info" title="สถานีนี้ไม่มีการขายใหม่ในระบบนี้">
                <div className="flex flex-wrap items-center gap-3">
                    <span>งานหน้าปั๊มย้ายไป POS แล้ว ข้อมูลเดิมยังดูได้จากประวัติ</span>
                    <Link href={context.paths.history} className="inline-flex h-[var(--ui-control-sm)] items-center justify-center rounded-[var(--ui-radius-md)] border border-[var(--ui-border-strong)] bg-[var(--ui-surface)] px-3 text-sm font-semibold text-[var(--ui-text)] hover:bg-[var(--ui-surface-subtle)] focus-visible:outline-none focus-visible:shadow-[var(--ui-shadow-focus)]">ดูประวัติ</Link>
                </div>
            </Notice>
        );
    }

    if (!context.currentShift || context.currentShift.status !== 'OPEN') {
        return (
            <Notice tone="warning" title="ต้องเปิดกะก่อนบันทึกรายการขาย">
                <div className="flex flex-wrap items-center gap-3">
                    <span>SaleFlow ใหม่ไม่อนุญาต save โดยไม่มีกะ OPEN</span>
                    <Link href={context.paths.operations} className="inline-flex h-[var(--ui-control-sm)] items-center justify-center rounded-[var(--ui-radius-md)] border border-[var(--ui-border-strong)] bg-[var(--ui-surface)] px-3 text-sm font-semibold text-[var(--ui-text)] hover:bg-[var(--ui-surface-subtle)] focus-visible:outline-none focus-visible:shadow-[var(--ui-shadow-focus)]">ไปงานกะ</Link>
                </div>
            </Notice>
        );
    }

    if (context.openingState.status !== 'READY') {
        return (
            <Notice tone="warning" title="ข้อมูลต้นกะยังไม่ครบ">
                <div className="flex flex-wrap items-center gap-3">
                    <span>ต้องบันทึกข้อมูลเปิดกะตามประเภทสถานีให้ครบก่อน SaleFlow จึงจะเริ่มได้</span>
                    <Link href={context.paths.operations} className="inline-flex h-[var(--ui-control-sm)] items-center justify-center rounded-[var(--ui-radius-md)] border border-[var(--ui-border-strong)] bg-[var(--ui-surface)] px-3 text-sm font-semibold text-[var(--ui-text)] hover:bg-[var(--ui-surface-subtle)] focus-visible:outline-none focus-visible:shadow-[var(--ui-shadow-focus)]">ทำข้อมูลต้นกะต่อ</Link>
                </div>
            </Notice>
        );
    }

    if (!context.saleContext) {
        return <Notice tone="danger" title="โหลดราคาปัจจุบันไม่ได้">กลับไปหน้าเดิมชั่วคราวเพื่อไม่บันทึกด้วยราคาที่ไม่ครบ</Notice>;
    }

    return (
        <div className="space-y-4">
            <SaleFlowForm
                station={{
                    stationId: context.station.id,
                    stationName: context.station.name,
                    stationType: context.station.type,
                    stationNumber: context.station.number,
                    businessDate: context.saleContext.businessDate,
                    shiftId: context.currentShift.id,
                    shiftNumber: context.currentShift.shiftNumber,
                }}
                prices={{
                    retailPrice: context.saleContext.retailPrice,
                    wholesalePrice: context.saleContext.wholesalePrice,
                    gasPrice: context.saleContext.gasPrice,
                }}
                userRole={context.user.role}
            />
            {context.station.type === 'FULL' && (
                <div className="text-right">
                    <Link href={legacy.sales} className="text-xs font-semibold text-[var(--ui-text-muted)] underline-offset-4 hover:text-[var(--ui-text)] hover:underline focus-visible:outline-none focus-visible:shadow-[var(--ui-shadow-focus)]">เปิดหน้าขายเดิม (fallback)</Link>
                </div>
            )}
        </div>
    );
}

function OperationsSkeleton({ context, onRefresh }: { context: StationContextPayload; onRefresh: () => Promise<void> }) {
    if (!context.permissions.canOperate) {
        return (
            <Notice tone="info" title="ไม่มี Operations สำหรับสถานีนี้">
                สถานี retired เป็น read-only ในระบบนี้ ไม่มีเปิดกะ ปิดกะ หรือแก้ข้อมูลปฏิบัติการ
            </Notice>
        );
    }

    if (context.currentShift?.status === 'OPEN' && context.openingState.status === 'READY') {
        return <ShiftClosingFlow context={context} onRefresh={onRefresh} />;
    }

    return <ShiftOpeningFlow context={context} onRefresh={onRefresh} />;
}

function HistorySkeleton({ context }: { context: StationContextPayload }) {
    return <StationHistory context={context} />;
}

export function CanonicalStationWorkspace({ stationId, mode }: { stationId: string; mode: CanonicalStationWorkspaceMode }) {
    const router = useRouter();
    const [context, setContext] = React.useState<StationContextPayload | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    const load = React.useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`/api/stations/${stationId}/context`, { cache: 'no-store' });
            if (response.status === 401) {
                router.replace('/login');
                return;
            }
            const payload = await response.json().catch(() => null);
            if (!response.ok) throw new Error(payload?.error || 'โหลดข้อมูลสถานีไม่สำเร็จ');
            setContext(payload as StationContextPayload);
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : 'โหลดข้อมูลสถานีไม่สำเร็จ');
        } finally {
            setLoading(false);
        }
    }, [router, stationId]);

    React.useEffect(() => {
        void load();
    }, [load]);

    const titles: Record<CanonicalStationWorkspaceMode, string> = {
        OVERVIEW: 'Station',
        SALES: 'Sales',
        OPERATIONS: 'Operations',
        HISTORY: 'History',
    };
    const writeModeBlocked = (mode === 'SALES' || mode === 'OPERATIONS') && (loading || Boolean(error));

    return (
        <RedesignAppShell
            title={context ? `${titles[mode]} · ${context.station.name}` : titles[mode]}
            description={context ? `${context.station.id} · ${context.station.type}` : 'Canonical station workspace'}
            contextValue={context?.station.name}
        >
            {loading && !context ? (
                <LoadingState label="กำลังโหลดสถานี">
                    <div className="h-40 animate-pulse rounded-[var(--ui-radius-lg)] bg-[var(--ui-surface-subtle)]" />
                </LoadingState>
            ) : !context ? (
                <FatalErrorState
                    title={error ? 'โหลดสถานีไม่สำเร็จ' : 'ไม่พบข้อมูลสถานี'}
                    message={error || 'ยังไม่มีข้อมูลสถานีที่แสดงได้'}
                    onRetry={() => void load()}
                />
            ) : (
                <div className="space-y-4" aria-busy={loading}>
                    <AsyncRefreshState
                        loading={loading}
                        error={error}
                        onRetry={() => void load()}
                        loadingLabel={mode === 'SALES' || mode === 'OPERATIONS' ? 'กำลังตรวจสถานะสถานีล่าสุดก่อนทำรายการ…' : 'กำลังอัปเดตข้อมูลสถานี…'}
                        errorTitle={mode === 'SALES' || mode === 'OPERATIONS' ? 'ตรวจสถานะสถานีล่าสุดไม่สำเร็จ' : 'อัปเดตข้อมูลสถานีไม่สำเร็จ'}
                        staleLabel={mode === 'SALES' || mode === 'OPERATIONS' ? 'ยังแสดงข้อมูลเดิมไว้ แต่บล็อกการบันทึกจนกว่าจะรีเฟรชสำเร็จ' : 'กำลังแสดงข้อมูลสถานีล่าสุดที่โหลดสำเร็จ'}
                    />
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--ui-text-muted)]">
                        <Link href={context.paths.base} className="rounded-sm hover:text-[var(--ui-text)] focus-visible:outline-none focus-visible:shadow-[var(--ui-shadow-focus)]">สถานี</Link>
                        <span>/</span>
                        {mode !== 'OVERVIEW' && <span>{titles[mode]}</span>}
                    </div>
                    <StaleGasShiftNotice context={context} />
                    {mode === 'OVERVIEW' && <Overview context={context} onRefresh={load} writeBlocked={loading || Boolean(error)} />}
                    {mode === 'SALES' && !writeModeBlocked && <SalesSkeleton context={context} />}
                    {mode === 'OPERATIONS' && !writeModeBlocked && <OperationsSkeleton context={context} onRefresh={load} />}
                    {mode === 'HISTORY' && <HistorySkeleton context={context} />}
                    {context.currentShift?.status === 'OPEN' && mode !== 'HISTORY' && (
                        <div className="flex items-center gap-2 text-xs text-[var(--ui-text-muted)]">
                            <Clock3 className="h-4 w-4" aria-hidden="true" /> กะปัจจุบัน #{context.currentShift.shiftNumber} เปิดอยู่
                        </div>
                    )}
                </div>
            )}
        </RedesignAppShell>
    );
}
