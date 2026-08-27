'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    AlertTriangle,
    ArrowRight,
    FileCheck2,
    FileText,
    ReceiptText,
    RefreshCw,
    Search,
    WalletCards,
} from 'lucide-react';
import { RedesignAppShell } from '@/components/layout';
import {
    AsyncRefreshState,
    Badge,
    Button,
    EmptyState,
    FatalErrorState,
    Input,
    LoadingState,
    MobileDataList,
    MobileDataRow,
    Notice,
    ResponsiveDataView,
    Section,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui';
import {
    BILLING_PIPELINE_STAGES,
    type BillingPipelineStage,
} from '@/lib/billing/lifecycle';
import type {
    BillingWorkspaceItem,
    BillingWorkspaceItemKind,
    BillingWorkspacePayload,
} from '@/types/billing';

const moneyFormatter = new Intl.NumberFormat('th-TH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
});

const stageTone: Record<BillingPipelineStage, 'default' | 'info' | 'warning' | 'success'> = {
    WAITING_TO_BILL: 'warning',
    PREPARING_DOCUMENTS: 'info',
    BILLED: 'info',
    AWAITING_PAYMENT: 'default',
    PARTIAL: 'warning',
    CLOSED: 'success',
};

const kindLabel: Record<BillingWorkspaceItemKind, string> = {
    UNBILLED: 'รายการรอวางบิล',
    INVOICE: 'Invoice',
    BILLING_COLLECTION: 'ใบวางบิลรวม',
};

function formatMoney(value: number) {
    return moneyFormatter.format(value);
}

function formatDueDate(value: string | null) {
    if (!value) return 'ไม่กำหนด';
    return new Date(value).toLocaleDateString('th-TH', {
        day: 'numeric',
        month: 'short',
        year: '2-digit',
        timeZone: 'Asia/Bangkok',
    });
}

function getStageLabel(stage: BillingPipelineStage) {
    return BILLING_PIPELINE_STAGES.find((item) => item.stage === stage)?.label || stage;
}

function getItemDescription(item: BillingWorkspaceItem) {
    const source = `${kindLabel[item.kind]} · ${item.sourceItemCount} รายการ`;
    if (item.overdue) return `${source} · เกินกำหนด ${formatDueDate(item.dueDate)}`;
    if (item.dueDate) return `${source} · ครบกำหนด ${formatDueDate(item.dueDate)}`;
    return source;
}

function BillingSummary({ data }: { data: BillingWorkspacePayload }) {
    const cards = [
        {
            label: 'รอวางบิล',
            value: data.summary.waitingToBill.amount,
            meta: `${data.summary.waitingToBill.ownerCount} ลูกค้า · ${data.summary.waitingToBill.transactionCount} รายการ`,
            icon: ReceiptText,
        },
        {
            label: 'Invoice ค้างรับ',
            value: data.summary.invoiceOutstanding.amount,
            meta: `${data.summary.invoiceOutstanding.documentCount} เอกสาร`,
            icon: FileText,
        },
        {
            label: 'ใบวางบิลรวมค้างรับ',
            value: data.summary.collectionOutstanding.amount,
            meta: `${data.summary.collectionOutstanding.documentCount} เอกสาร`,
            icon: WalletCards,
        },
        {
            label: 'สลิปรอตรวจ',
            value: null,
            meta: `${data.summary.pendingPaymentSlips} สลิป`,
            icon: FileCheck2,
        },
    ];

    return (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {cards.map((card) => {
                const Icon = card.icon;
                return (
                    <div
                        key={card.label}
                        className="rounded-[var(--ui-radius-lg)] border border-[var(--ui-border)] bg-[var(--ui-surface)] p-4"
                    >
                        <div className="flex items-center gap-2 text-sm font-semibold text-[var(--ui-text-muted)]">
                            <Icon className="h-4 w-4" aria-hidden="true" />
                            {card.label}
                        </div>
                        <div className="mt-2 text-2xl font-bold tabular-nums text-[var(--ui-text)]">
                            {card.value === null ? data.summary.pendingPaymentSlips : `฿${formatMoney(card.value)}`}
                        </div>
                        <div className="mt-1 text-xs text-[var(--ui-text-muted)]">{card.meta}</div>
                    </div>
                );
            })}
        </div>
    );
}

function BillingPipelineTabs({
    items,
    value,
    onChange,
}: {
    items: BillingWorkspaceItem[];
    value: 'ALL' | BillingPipelineStage;
    onChange: (value: 'ALL' | BillingPipelineStage) => void;
}) {
    const countFor = (stage: BillingPipelineStage) => items.filter((item) => item.stage === stage).length;

    return (
        <div className="overflow-x-auto pb-1">
            <div className="flex min-w-max gap-2">
                <button
                    type="button"
                    onClick={() => onChange('ALL')}
                    aria-pressed={value === 'ALL'}
                    className={`min-h-[var(--ui-touch-target)] rounded-[var(--ui-radius-md)] border px-3 text-sm font-semibold focus-visible:outline-none focus-visible:shadow-[var(--ui-shadow-focus)] ${value === 'ALL'
                        ? 'border-[var(--ui-primary-500)] bg-[var(--ui-primary-50)] text-[var(--ui-primary-700)]'
                        : 'border-[var(--ui-border)] bg-[var(--ui-surface)] text-[var(--ui-text-secondary)]'}`}
                >
                    ทั้งหมด <span className="ml-1 tabular-nums">{items.length}</span>
                </button>
                {BILLING_PIPELINE_STAGES.map((stage) => (
                    <button
                        key={stage.stage}
                        type="button"
                        onClick={() => onChange(stage.stage)}
                        aria-pressed={value === stage.stage}
                        className={`min-h-[var(--ui-touch-target)] rounded-[var(--ui-radius-md)] border px-3 text-sm font-semibold focus-visible:outline-none focus-visible:shadow-[var(--ui-shadow-focus)] ${value === stage.stage
                            ? 'border-[var(--ui-primary-500)] bg-[var(--ui-primary-50)] text-[var(--ui-primary-700)]'
                            : 'border-[var(--ui-border)] bg-[var(--ui-surface)] text-[var(--ui-text-secondary)]'}`}
                    >
                        {stage.label} <span className="ml-1 tabular-nums">{countFor(stage.stage)}</span>
                    </button>
                ))}
            </div>
        </div>
    );
}

function BillingRowBadges({ item }: { item: BillingWorkspaceItem }) {
    return (
        <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant={stageTone[item.stage]}>{getStageLabel(item.stage)}</Badge>
            {item.overdue && <Badge variant="error">เกินกำหนด</Badge>}
            {item.pendingPaymentReviews > 0 && (
                <Badge variant="info">รอตรวจสลิป {item.pendingPaymentReviews}</Badge>
            )}
            {item.dataQualityFlags.length > 0 && (
                <Badge variant="error">ข้อมูลผิดปกติ {item.dataQualityFlags.length}</Badge>
            )}
        </div>
    );
}

function BillingList({ items }: { items: BillingWorkspaceItem[] }) {
    if (items.length === 0) {
        return (
            <EmptyState
                compact
                icon={FileText}
                title="ไม่มีงานในขั้นนี้"
                description="ลองเปลี่ยนขั้นตอนหรือคำค้นหา"
            />
        );
    }

    return (
        <ResponsiveDataView
            breakpoint="md"
            desktop={(
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>ลูกค้า / เอกสาร</TableHead>
                            <TableHead>สถานะ</TableHead>
                            <TableHead className="text-right">ยอดคงเหลือ</TableHead>
                            <TableHead>ครบกำหนด</TableHead>
                            <TableHead className="text-right">งานถัดไป</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {items.map((item) => (
                            <TableRow key={item.id}>
                                <TableCell>
                                    <div className="font-semibold text-[var(--ui-text)]">{item.owner.name}</div>
                                    <div className="mt-0.5 text-xs text-[var(--ui-text-muted)]">
                                        {item.number || kindLabel[item.kind]} · {item.sourceItemCount} รายการ
                                    </div>
                                </TableCell>
                                <TableCell><BillingRowBadges item={item} /></TableCell>
                                <TableCell className="text-right font-bold tabular-nums text-[var(--ui-text)]">
                                    ฿{formatMoney(item.remainingAmount)}
                                </TableCell>
                                <TableCell className={item.overdue ? 'font-semibold text-[var(--ui-danger-text)]' : undefined}>
                                    {formatDueDate(item.dueDate)}
                                </TableCell>
                                <TableCell className="text-right">
                                    <Link
                                        href={item.nextAction.href}
                                        className="inline-flex min-h-9 items-center gap-1 rounded-[var(--ui-radius-sm)] px-2.5 text-xs font-bold text-[var(--ui-primary-text)] hover:bg-[var(--ui-primary-50)] focus-visible:outline-none focus-visible:shadow-[var(--ui-shadow-focus)]"
                                    >
                                        {item.nextAction.label}
                                        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                                    </Link>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            )}
            mobile={(
                <MobileDataList>
                    {items.map((item) => (
                        <div key={item.id}>
                            <MobileDataRow
                                title={item.owner.name}
                                description={getItemDescription(item)}
                                leadingIcon={item.overdue ? AlertTriangle : item.kind === 'UNBILLED' ? ReceiptText : FileText}
                                meta={<BillingRowBadges item={item} />}
                                value={`฿${formatMoney(item.remainingAmount)}`}
                                action={(
                                    <Link
                                        href={item.nextAction.href}
                                        className="inline-flex min-h-9 items-center rounded-[var(--ui-radius-sm)] px-2 text-xs font-bold text-[var(--ui-primary-text)] focus-visible:outline-none focus-visible:shadow-[var(--ui-shadow-focus)]"
                                    >
                                        {item.nextAction.label}
                                    </Link>
                                )}
                            />
                        </div>
                    ))}
                </MobileDataList>
            )}
        />
    );
}

export default function BillingPage() {
    const router = useRouter();
    const [data, setData] = React.useState<BillingWorkspacePayload | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [stageFilter, setStageFilter] = React.useState<'ALL' | BillingPipelineStage>('ALL');
    const [kindFilter, setKindFilter] = React.useState<'ALL' | BillingWorkspaceItemKind>('ALL');
    const [query, setQuery] = React.useState('');
    const [exceptionOnly, setExceptionOnly] = React.useState(false);

    const loadBilling = React.useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch('/api/billing', { cache: 'no-store' });
            if (response.status === 401) {
                router.replace('/login?redirect=/billing');
                return;
            }
            const payload = await response.json().catch(() => null);
            if (!response.ok) {
                throw new Error(payload?.error || 'โหลด Billing ไม่สำเร็จ');
            }
            setData(payload as BillingWorkspacePayload);
        } catch (loadError) {
            console.error('Failed to load billing workspace:', loadError);
            setError(loadError instanceof Error ? loadError.message : 'โหลด Billing ไม่สำเร็จ');
        } finally {
            setLoading(false);
        }
    }, [router]);

    React.useEffect(() => {
        void loadBilling();
    }, [loadBilling]);

    const filteredItems = React.useMemo(() => {
        if (!data) return [];
        const normalizedQuery = query.trim().toLocaleLowerCase('th-TH');
        return data.items.filter((item) => {
            if (stageFilter !== 'ALL' && item.stage !== stageFilter) return false;
            if (kindFilter !== 'ALL' && item.kind !== kindFilter) return false;
            if (exceptionOnly && item.exceptions.length === 0) return false;
            if (!normalizedQuery) return true;
            const haystack = `${item.owner.name} ${item.owner.code || ''} ${item.number || ''}`.toLocaleLowerCase('th-TH');
            return haystack.includes(normalizedQuery);
        });
    }, [data, exceptionOnly, kindFilter, query, stageFilter]);

    const selectedUnsupportedStage = stageFilter === 'PREPARING_DOCUMENTS' || stageFilter === 'BILLED';

    return (
        <RedesignAppShell
            title="Billing"
            description="จัดงานวางบิลและรับเงินตามขั้นตอน ไม่รวมยอดข้ามโมเดลแบบเสี่ยงนับซ้ำ"
        >
            {loading && !data ? (
                <LoadingState label="กำลังโหลด Billing" className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        {[0, 1, 2, 3].map((item) => (
                            <div key={item} className="h-28 animate-pulse rounded-[var(--ui-radius-lg)] bg-[var(--ui-surface-subtle)]" />
                        ))}
                    </div>
                    <div className="h-72 animate-pulse rounded-[var(--ui-radius-lg)] bg-[var(--ui-surface-subtle)]" />
                </LoadingState>
            ) : !data ? (
                <FatalErrorState
                    title={error ? 'โหลด Billing ไม่สำเร็จ' : 'ไม่พบข้อมูล Billing'}
                    message={error || 'ยังไม่มีข้อมูล Billing ที่แสดงได้'}
                    onRetry={() => void loadBilling()}
                />
            ) : (
                <div className="space-y-4" aria-busy={loading}>
                    <AsyncRefreshState
                        loading={loading}
                        error={error}
                        onRetry={() => void loadBilling()}
                        loadingLabel="กำลังอัปเดต Billing…"
                    />
                    <BillingSummary data={data} />

                    <Notice tone="info" title="ยอด Invoice และใบวางบิลรวมแยกกัน">
                        ระบบเดิมยังไม่มี relation ยืนยันว่าเอกสารสองแบบอ้างหนี้ก้อนเดียวกันหรือไม่ จึงไม่รวมเป็นยอดลูกหนี้เดียวเพื่อป้องกันการนับซ้ำ
                    </Notice>

                    <Section
                        title="งาน Billing"
                        description="เลือกขั้นตอน แล้วทำงานถัดไปจากรายการที่ต้องจัดการ"
                        action={(
                            <Button variant="outline" size="sm" onClick={() => void loadBilling()} disabled={loading}>
                                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
                                {loading ? 'กำลังรีเฟรช' : 'รีเฟรช'}
                            </Button>
                        )}
                        contentClassName="space-y-4"
                    >
                        <BillingPipelineTabs
                            items={data.items}
                            value={stageFilter}
                            onChange={setStageFilter}
                        />

                        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_auto]">
                            <Input
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                aria-label="ค้นหาลูกค้า รหัส หรือเลขเอกสาร"
                                placeholder="ค้นหาลูกค้า รหัส หรือเลขเอกสาร"
                                leftIcon={<Search className="h-4 w-4" aria-hidden="true" />}
                            />
                            <select
                                aria-label="ประเภทเอกสาร Billing"
                                value={kindFilter}
                                onChange={(event) => setKindFilter(event.target.value as 'ALL' | BillingWorkspaceItemKind)}
                                className="h-[var(--ui-control-md)] rounded-[var(--ui-radius-md)] border border-[var(--ui-border-strong)] bg-[var(--ui-surface)] px-3 text-sm text-[var(--ui-text)] focus:outline-none focus:shadow-[var(--ui-shadow-focus)]"
                            >
                                <option value="ALL">เอกสารทุกประเภท</option>
                                <option value="UNBILLED">รอสร้างเอกสาร</option>
                                <option value="INVOICE">Invoice</option>
                                <option value="BILLING_COLLECTION">ใบวางบิลรวม</option>
                            </select>
                            <Button
                                variant={exceptionOnly ? 'warning' : 'outline'}
                                onClick={() => setExceptionOnly((current) => !current)}
                                aria-pressed={exceptionOnly}
                            >
                                <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                                เฉพาะต้องตรวจ
                            </Button>
                        </div>

                        {selectedUnsupportedStage && (
                            <Notice tone="warning" title="ขั้นตอนนี้ยังไม่มีสถานะถาวรในระบบเดิม">
                                ตอนนี้ยังไม่มี field สำหรับบอกว่า “{getStageLabel(stageFilter)}” อย่างเชื่อถือได้ จึงไม่ย้ายเอกสารเข้าขั้นนี้จากการเดาวันที่หรือ status อื่น
                            </Notice>
                        )}

                        <BillingList items={filteredItems} />
                    </Section>
                </div>
            )}
        </RedesignAppShell>
    );
}
