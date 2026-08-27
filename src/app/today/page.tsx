'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    AlertTriangle,
    ArrowRight,
    Banknote,
    Building2,
    CheckCircle2,
    Clock3,
    FileWarning,
    Fuel,
    ReceiptText,
    ShieldAlert,
    WalletCards,
} from 'lucide-react';
import { RedesignAppShell } from '@/components/layout';
import { AsyncRefreshState, Button, EmptyState, FatalErrorState, LoadingState, Notice, Section } from '@/components/ui';
import type {
    TodayAdminPayload,
    TodayPayload,
    TodayStaffPayload,
    TodayStationState,
    TodayTransaction,
    TodayWorkItem,
} from '@/types/today';

const moneyFormatter = new Intl.NumberFormat('th-TH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
});
const numberFormatter = new Intl.NumberFormat('th-TH', {
    maximumFractionDigits: 2,
});

const paymentLabels: Record<string, string> = {
    CASH: 'เงินสด',
    CREDIT: 'เงินเชื่อ',
    TRANSFER: 'โอน',
    BOX_TRUCK: 'รถตู้',
    OIL_TRUCK_SUPACHAI: 'รถน้ำมันศุภชัย',
    CREDIT_CARD: 'บัตรเครดิต',
    EXPENSE: 'ค่าใช้จ่าย',
};

function formatMoney(value: number) {
    return moneyFormatter.format(value);
}

function formatNumber(value: number) {
    return numberFormatter.format(value);
}

function formatTime(value: string) {
    return new Date(value).toLocaleTimeString('th-TH', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Bangkok',
    });
}

function LoadingToday() {
    return (
        <LoadingState label="กำลังโหลด Today" className="space-y-4">
            <div className="h-32 animate-pulse rounded-[var(--ui-radius-lg)] bg-[var(--ui-surface-subtle)]" />
            <div className="h-52 animate-pulse rounded-[var(--ui-radius-lg)] bg-[var(--ui-surface-subtle)]" />
            <div className="h-40 animate-pulse rounded-[var(--ui-radius-lg)] bg-[var(--ui-surface-subtle)]" />
        </LoadingState>
    );
}

function stateClasses(state: TodayStationState) {
    switch (state) {
        case 'STALE_SHIFT':
            return 'bg-[var(--ui-danger-soft)] text-[var(--ui-danger-text)]';
        case 'SHIFT_NEEDS_ATTENTION':
            return 'bg-[var(--ui-warning-soft)] text-[var(--ui-warning-text)]';
        case 'READY_TO_CLOSE':
        case 'CLOSED':
        case 'RETIRED':
            return 'bg-[var(--ui-success-soft)] text-[var(--ui-success-text)]';
        case 'SHIFT_OPEN':
            return 'bg-[var(--ui-info-soft)] text-[var(--ui-info-text)]';
        case 'NO_SHIFT':
        default:
            return 'bg-[var(--ui-surface-subtle)] text-[var(--ui-text-secondary)]';
    }
}

function WorkItemIcon({ item }: { item: TodayWorkItem }) {
    if (item.severity === 'critical') {
        return <ShieldAlert className="h-5 w-5 text-[var(--ui-danger-text)]" aria-hidden="true" />;
    }
    if (item.severity === 'warning') {
        return <AlertTriangle className="h-5 w-5 text-[var(--ui-warning-text)]" aria-hidden="true" />;
    }
    return <Clock3 className="h-5 w-5 text-[var(--ui-info-text)]" aria-hidden="true" />;
}

function workItemSurface(item: TodayWorkItem) {
    if (item.severity === 'critical') return 'border-[var(--ui-danger)]/20 bg-[var(--ui-danger-soft)]';
    if (item.severity === 'warning') return 'border-[var(--ui-warning)]/20 bg-[var(--ui-warning-soft)]';
    return 'border-[var(--ui-border)] bg-[var(--ui-surface-subtle)]';
}

function WorkQueue({ items, emptyLabel = 'ไม่มีรายการที่ต้องจัดการตอนนี้' }: { items: TodayWorkItem[]; emptyLabel?: string }) {
    if (items.length === 0) {
        return <Notice tone="success">{emptyLabel}</Notice>;
    }

    return (
        <div className="space-y-2">
            {items.map((item) => (
                <div
                    key={item.id}
                    className={`flex items-start gap-3 rounded-[var(--ui-radius-md)] border p-3 ${workItemSurface(item)}`}
                >
                    <div className="mt-0.5 shrink-0"><WorkItemIcon item={item} /></div>
                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="font-semibold">{item.title}</span>
                            {item.stationName && (
                                <span className="text-xs font-medium text-[var(--ui-text-muted)]">{item.stationName}</span>
                            )}
                        </div>
                        {item.detail && <p className="mt-1 text-sm text-[var(--ui-text-secondary)]">{item.detail}</p>}
                    </div>
                    {item.href && (
                        <Link
                            href={item.href}
                            className="shrink-0 rounded-[var(--ui-radius-sm)] px-2 py-1 text-xs font-bold text-[var(--ui-primary-text)] hover:bg-[var(--ui-primary-50)] focus-visible:outline-none focus-visible:shadow-[var(--ui-shadow-focus)]"
                        >
                            จัดการ
                        </Link>
                    )}
                </div>
            ))}
        </div>
    );
}

function TransactionRows({ transactions }: { transactions: TodayTransaction[] }) {
    if (transactions.length === 0) {
        return <EmptyState compact icon={ReceiptText} title="ยังไม่มีรายการ" />;
    }

    return (
        <div className="divide-y divide-[var(--ui-border)]">
            {transactions.map((transaction) => (
                <div key={transaction.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--ui-radius-md)] bg-[var(--ui-surface-subtle)]">
                        <ReceiptText className="h-4 w-4 text-[var(--ui-text-muted)]" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold">
                            {transaction.licensePlate || transaction.ownerName || paymentLabels[transaction.paymentType] || transaction.paymentType}
                        </div>
                        <div className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-[var(--ui-text-muted)]">
                            <span>{formatTime(transaction.date)}</span>
                            <span>{paymentLabels[transaction.paymentType] || transaction.paymentType}</span>
                            <span>{formatNumber(transaction.liters)} ลิตร</span>
                            <span className="md:hidden">{transaction.stationName}</span>
                        </div>
                    </div>
                    <div className="shrink-0 text-right">
                        <div className="font-bold tabular-nums">฿{formatMoney(transaction.amount)}</div>
                        <div className="hidden text-xs text-[var(--ui-text-muted)] md:block">{transaction.stationName}</div>
                    </div>
                </div>
            ))}
        </div>
    );
}

function RetiredStaffToday({ data }: { data: TodayStaffPayload }) {
    return (
        <Section title="สถานะสาขา">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-[var(--ui-success-text)]" aria-hidden="true" />
                    <div>
                        <h2 className="font-bold">{data.station.stationName} ย้ายการใช้งานหน้าปั๊มไป POS แล้ว</h2>
                        <p className="mt-1 max-w-2xl text-sm text-[var(--ui-text-secondary)]">
                            ระบบนี้จะไม่สร้างยอดขาย เปิดกะ หรือปิดกะใหม่สำหรับสาขานี้ แต่ข้อมูลเดิมยังใช้สำหรับประวัติ รายงาน ลูกค้า และวางบิล
                        </p>
                    </div>
                </div>
                <Link
                    href={data.primaryAction.href}
                    className="inline-flex min-h-[var(--ui-control-md)] shrink-0 items-center justify-center gap-2 rounded-[var(--ui-radius-md)] border border-[var(--ui-border-strong)] bg-[var(--ui-surface)] px-4 text-sm font-semibold hover:bg-[var(--ui-surface-subtle)] focus-visible:outline-none focus-visible:shadow-[var(--ui-shadow-focus)]"
                >
                    {data.primaryAction.label}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
            </div>
        </Section>
    );
}

function StaffToday({ data }: { data: TodayStaffPayload }) {
    const router = useRouter();

    if (data.state === 'RETIRED') return <RetiredStaffToday data={data} />;

    return (
        <div className="space-y-4">
            <Section title="สถานะงานตอนนี้" description={`วันทำการ ${data.dateKey}`}>
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                        <div className="text-sm font-semibold text-[var(--ui-text-muted)]">{data.station.stationName}</div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                            <span className={`rounded-[var(--ui-radius-full)] px-2.5 py-1 text-sm font-bold ${stateClasses(data.state)}`}>
                                {data.stateLabel}
                            </span>
                            {data.shift && (
                                <span className="text-sm text-[var(--ui-text-secondary)]">
                                    กะ {data.shift.shiftNumber}
                                    {data.shift.staffName ? ` · ${data.shift.staffName}` : ''}
                                    {` · เปิด ${formatTime(data.shift.openedAt)}`}
                                </span>
                            )}
                        </div>
                    </div>
                    <Button size="lg" onClick={() => router.push(data.primaryAction.href)}>
                        {data.primaryAction.label}
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Button>
                </div>
            </Section>

            <Section title="สิ่งที่ต้องทำก่อนจบงาน" description="รายการผิดปกติและข้อมูลที่ยังไม่ครบจะขึ้นก่อนยอดสรุป">
                <WorkQueue items={data.workItems} emptyLabel="ข้อมูลสำคัญของกะไม่มีรายการค้างที่ตรวจพบ" />
            </Section>

            <Section title="รายการล่าสุด" description="รายการขายล่าสุดของงานวันนี้">
                <TransactionRows transactions={data.recentTransactions} />
            </Section>

            <Section title="สรุปวันนี้" description="ตัวเลขนี้เป็นข้อมูลรองจากงานที่ต้องจัดการ">
                <div className="grid grid-cols-3 divide-x divide-[var(--ui-border)] text-center">
                    <div className="px-2">
                        <div className="text-xl font-extrabold tabular-nums">{data.summary.transactionCount}</div>
                        <div className="mt-1 text-xs text-[var(--ui-text-muted)]">รายการ</div>
                    </div>
                    <div className="px-2">
                        <div className="text-xl font-extrabold tabular-nums">{formatNumber(data.summary.liters)}</div>
                        <div className="mt-1 text-xs text-[var(--ui-text-muted)]">ลิตร</div>
                    </div>
                    <div className="px-2">
                        <div className="text-xl font-extrabold tabular-nums">{formatMoney(data.summary.amount)}</div>
                        <div className="mt-1 text-xs text-[var(--ui-text-muted)]">บาท</div>
                    </div>
                </div>
            </Section>
        </div>
    );
}

function AdminToday({ data }: { data: TodayAdminPayload }) {
    return (
        <div className="space-y-4">
            <Section
                title="ต้องจัดการตอนนี้"
                description="Exception จากสถานีที่ยังใช้งานจริงจะขึ้นก่อนข้อมูลอื่น"
                action={data.workItems.length > 0 ? (
                    <span className="rounded-[var(--ui-radius-full)] bg-[var(--ui-danger-soft)] px-2.5 py-1 text-xs font-bold text-[var(--ui-danger-text)]">
                        {data.workItems.length} รายการ
                    </span>
                ) : undefined}
            >
                <WorkQueue items={data.workItems.slice(0, 10)} />
                {data.workItems.length > 10 && (
                    <Link href="/admin/alerts" className="mt-3 inline-flex items-center gap-1 rounded-sm text-sm font-bold text-[var(--ui-primary-text)] focus-visible:outline-none focus-visible:shadow-[var(--ui-shadow-focus)]">
                        ดูรายการตรวจสอบทั้งหมด <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                )}
            </Section>

            <Section title="สถานีที่ยังใช้งานในระบบ" description="station-1 และปั๊มแก๊ส station-5/6 เท่านั้น">
                <div className="grid gap-3 lg:grid-cols-3">
                    {data.stations.map((station) => (
                        <Link
                            key={station.stationId}
                            href={station.href}
                            className="group rounded-[var(--ui-radius-md)] border border-[var(--ui-border)] p-4 transition-colors hover:border-[var(--ui-border-strong)] hover:bg-[var(--ui-surface-subtle)] focus-visible:outline-none focus-visible:shadow-[var(--ui-shadow-focus)]"
                        >
                            <div className="flex items-start gap-3">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--ui-radius-md)] bg-[var(--ui-surface-subtle)] group-hover:bg-[var(--ui-surface)]">
                                    {station.stationType === 'GAS' ? (
                                        <Fuel className="h-5 w-5 text-[var(--ui-text-muted)]" aria-hidden="true" />
                                    ) : (
                                        <Building2 className="h-5 w-5 text-[var(--ui-text-muted)]" aria-hidden="true" />
                                    )}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="truncate font-bold">{station.stationName}</div>
                                    <div className="mt-2">
                                        <span className={`rounded-[var(--ui-radius-full)] px-2 py-1 text-xs font-bold ${stateClasses(station.state)}`}>
                                            {station.stateLabel}
                                        </span>
                                    </div>
                                </div>
                                <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-[var(--ui-text-muted)]" aria-hidden="true" />
                            </div>

                            <div className="mt-4 grid grid-cols-3 divide-x divide-[var(--ui-border)] text-center">
                                <div className="px-1">
                                    <div className="text-sm font-bold tabular-nums">{station.summary.transactionCount}</div>
                                    <div className="text-[11px] text-[var(--ui-text-muted)]">รายการ</div>
                                </div>
                                <div className="px-1">
                                    <div className="text-sm font-bold tabular-nums">{formatNumber(station.summary.liters)}</div>
                                    <div className="text-[11px] text-[var(--ui-text-muted)]">ลิตร</div>
                                </div>
                                <div className="px-1">
                                    <div className="text-sm font-bold tabular-nums">{formatMoney(station.summary.amount)}</div>
                                    <div className="text-[11px] text-[var(--ui-text-muted)]">บาท</div>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            </Section>

            <div className="grid gap-4 xl:grid-cols-2">
                <Section title="Billing attention" description="แยก Invoice กับใบวางบิลรวมเพื่อไม่บวกยอดซ้ำข้าม workflow">
                    <div className="divide-y divide-[var(--ui-border)]">
                        <Link href="/invoices" className="flex items-center gap-3 rounded-sm py-3 first:pt-0 hover:text-[var(--ui-primary-text)] focus-visible:outline-none focus-visible:shadow-[var(--ui-shadow-focus)]">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--ui-radius-md)] bg-[var(--ui-credit-soft)]">
                                <ReceiptText className="h-4 w-4 text-[var(--ui-credit-text)]" aria-hidden="true" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="text-sm font-semibold">รายการรอสร้าง Invoice</div>
                                <div className="text-xs text-[var(--ui-text-muted)]">{data.billing.readyToInvoice.transactionCount} รายการ</div>
                            </div>
                            <div className="font-bold tabular-nums">฿{formatMoney(data.billing.readyToInvoice.amount)}</div>
                        </Link>

                        <Link href="/invoices" className="flex items-center gap-3 rounded-sm py-3 hover:text-[var(--ui-primary-text)] focus-visible:outline-none focus-visible:shadow-[var(--ui-shadow-focus)]">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--ui-radius-md)] bg-[var(--ui-info-soft)]">
                                <Banknote className="h-4 w-4 text-[var(--ui-info-text)]" aria-hidden="true" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="text-sm font-semibold">Invoice รอรับเงิน</div>
                                <div className="text-xs text-[var(--ui-text-muted)]">{data.billing.invoiceAwaitingPayment.documentCount} ใบ</div>
                            </div>
                            <div className="font-bold tabular-nums">฿{formatMoney(data.billing.invoiceAwaitingPayment.amount)}</div>
                        </Link>

                        <Link href="/billing-collections" className="flex items-center gap-3 rounded-sm py-3 hover:text-[var(--ui-primary-text)] focus-visible:outline-none focus-visible:shadow-[var(--ui-shadow-focus)]">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--ui-radius-md)] bg-[var(--ui-surface-subtle)]">
                                <WalletCards className="h-4 w-4 text-[var(--ui-text-muted)]" aria-hidden="true" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="text-sm font-semibold">ใบวางบิลรวมรอรับเงิน</div>
                                <div className="text-xs text-[var(--ui-text-muted)]">{data.billing.collectionAwaitingPayment.documentCount} ใบ</div>
                            </div>
                            <div className="font-bold tabular-nums">฿{formatMoney(data.billing.collectionAwaitingPayment.amount)}</div>
                        </Link>

                        <Link href="/billing-collections" className="flex items-center gap-3 rounded-sm py-3 last:pb-0 hover:text-[var(--ui-primary-text)] focus-visible:outline-none focus-visible:shadow-[var(--ui-shadow-focus)]">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--ui-radius-md)] bg-[var(--ui-warning-soft)]">
                                <FileWarning className="h-4 w-4 text-[var(--ui-warning-text)]" aria-hidden="true" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="text-sm font-semibold">ต้องติดตาม</div>
                                <div className="text-xs text-[var(--ui-text-muted)]">
                                    เกินกำหนด {data.billing.overdueDocuments} ใบ · สลิปรอตรวจ {data.billing.pendingPaymentSlips}
                                </div>
                            </div>
                            <ArrowRight className="h-4 w-4 text-[var(--ui-text-muted)]" aria-hidden="true" />
                        </Link>
                    </div>
                </Section>

                <Section title="Recent activity" description="รายการขายล่าสุดจากสถานีที่ยังใช้งานในระบบ">
                    <TransactionRows transactions={data.recentActivity} />
                </Section>
            </div>
        </div>
    );
}

export default function TodayPage() {
    const router = useRouter();
    const [data, setData] = React.useState<TodayPayload | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    const loadToday = React.useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/today', { cache: 'no-store' });
            if (response.status === 401) {
                router.replace('/login');
                return;
            }

            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(payload.error || 'โหลดข้อมูลไม่สำเร็จ');
            }

            setData(payload as TodayPayload);
        } catch (loadError) {
            console.error('Failed to load Today workspace:', loadError);
            setError(loadError instanceof Error ? loadError.message : 'โหลดข้อมูลไม่สำเร็จ');
        } finally {
            setLoading(false);
        }
    }, [router]);

    React.useEffect(() => {
        void loadToday();
    }, [loadToday]);

    const contextValue = data?.kind === 'staff' ? data.station.stationName : undefined;

    return (
        <RedesignAppShell
            title="Today"
            description="สิ่งที่ต้องทำตอนนี้ มาก่อนกราฟและยอดสรุป"
            contextValue={contextValue}
        >
            {loading && !data ? (
                <LoadingToday />
            ) : !data ? (
                <FatalErrorState
                    title={error ? 'โหลดข้อมูล Today ไม่สำเร็จ' : 'ไม่พบข้อมูล Today'}
                    message={error || 'ยังไม่มีข้อมูลสำหรับ workspace นี้'}
                    onRetry={() => void loadToday()}
                />
            ) : (
                <div className="space-y-4" aria-busy={loading}>
                    <AsyncRefreshState
                        loading={loading}
                        error={error}
                        onRetry={() => void loadToday()}
                        loadingLabel="กำลังอัปเดต Today…"
                    />
                    {data.kind === 'admin' ? (
                        <AdminToday data={data} />
                    ) : data.kind === 'staff' ? (
                        <StaffToday data={data} />
                    ) : (
                        <FatalErrorState
                            title="ข้อมูล Today ไม่ถูกต้อง"
                            message="รูปแบบข้อมูลที่ได้รับไม่ตรงกับ workspace ที่รองรับ"
                            onRetry={() => void loadToday()}
                        />
                    )}
                </div>
            )}
        </RedesignAppShell>
    );
}
