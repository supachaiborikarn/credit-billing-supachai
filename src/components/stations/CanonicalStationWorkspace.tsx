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

function Overview({ context }: { context: StationContextPayload }) {
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
                    {mode === 'OVERVIEW' && <Overview context={context} />}
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
