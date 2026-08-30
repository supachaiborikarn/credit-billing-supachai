'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
    AlertTriangle,
    ArrowLeft,
    Banknote,
    Building2,
    CheckCircle2,
    ImageIcon,
    RefreshCw,
    UserRound,
} from 'lucide-react';
import { ReceivePaymentDialog } from '@/components/billing/ReceivePaymentDialog';
import { BillingDocumentAdminActions } from '@/components/billing/BillingDocumentAdminActions';
import { BillingPaymentEvidenceActions } from '@/components/billing/BillingPaymentEvidenceActions';
import { RedesignAppShell } from '@/components/layout';
import {
    Badge,
    Button,
    EmptyState,
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
import { BILLING_PIPELINE_STAGES, type BillingPipelineStage } from '@/lib/billing/lifecycle';
import type { BillingDetailPayload } from '@/types/billing';

const moneyFormatter = new Intl.NumberFormat('th-TH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
});

const BILLING_DETAIL_PAGE_SIZE = 50;

const stageTone: Record<BillingPipelineStage, 'default' | 'info' | 'warning' | 'success'> = {
    WAITING_TO_BILL: 'warning',
    PREPARING_DOCUMENTS: 'info',
    BILLED: 'info',
    AWAITING_PAYMENT: 'default',
    PARTIAL: 'warning',
    CLOSED: 'success',
};

function formatMoney(value: number) {
    return moneyFormatter.format(value);
}

function formatDate(value: string | null) {
    if (!value) return '—';
    return new Date(value).toLocaleDateString('th-TH', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'Asia/Bangkok',
    });
}

function getStageLabel(stage: BillingPipelineStage) {
    return BILLING_PIPELINE_STAGES.find((item) => item.stage === stage)?.label || stage;
}

function getPaymentStatusLabel(status: 'CONFIRMED' | 'PENDING_REVIEW' | 'REJECTED') {
    if (status === 'CONFIRMED') return 'ยืนยันแล้ว';
    if (status === 'REJECTED') return 'ปฏิเสธ';
    return 'รอตรวจ';
}

function getPaymentStatusVariant(status: 'CONFIRMED' | 'PENDING_REVIEW' | 'REJECTED') {
    if (status === 'CONFIRMED') return 'success' as const;
    if (status === 'REJECTED') return 'error' as const;
    return 'info' as const;
}

export default function BillingDetailPage() {
    const params = useParams<{ id: string }>();
    const searchParams = useSearchParams();
    const router = useRouter();
    const [data, setData] = React.useState<BillingDetailPayload | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [sourceVisibleCount, setSourceVisibleCount] = React.useState(BILLING_DETAIL_PAGE_SIZE);
    const kind = searchParams.get('kind');

    const loadDetail = React.useCallback(async () => {
        if (!params.id || !kind) {
            setError('ไม่พบชนิดเอกสาร Billing');
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`/api/billing/${params.id}?kind=${encodeURIComponent(kind)}`, {
                cache: 'no-store',
            });
            if (response.status === 401) {
                router.replace(`/login?redirect=${encodeURIComponent(`/billing/${params.id}?kind=${kind}`)}`);
                return;
            }
            const payload = await response.json().catch(() => null);
            if (!response.ok) throw new Error(payload?.error || 'โหลดรายละเอียดไม่สำเร็จ');
            setData(payload as BillingDetailPayload);
        } catch (loadError) {
            console.error('Failed to load billing detail:', loadError);
            setError(loadError instanceof Error ? loadError.message : 'โหลดรายละเอียดไม่สำเร็จ');
        } finally {
            setLoading(false);
        }
    }, [kind, params.id, router]);

    React.useEffect(() => {
        void loadDetail();
    }, [loadDetail]);

    React.useEffect(() => {
        setSourceVisibleCount(BILLING_DETAIL_PAGE_SIZE);
    }, [kind, params.id]);

    const renderedSourceItems = React.useMemo(
        () => data?.sourceItems.slice(0, sourceVisibleCount) || [],
        [data, sourceVisibleCount]
    );

    return (
        <RedesignAppShell
            title={data?.document.number || 'Billing detail'}
            description={data ? `${data.customer.name} · ${data.document.kind === 'INVOICE' ? 'Invoice' : 'ใบวางบิลรวม'}` : 'รายละเอียดเอกสารและการรับชำระ'}
        >
            <div className="mb-4">
                <Link href="/billing" className="inline-flex min-h-9 items-center gap-1.5 text-sm font-semibold text-[var(--ui-text-secondary)] hover:text-[var(--ui-text)]">
                    <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                    กลับ Billing
                </Link>
            </div>

            {loading ? (
                <div className="space-y-4">
                    <div className="h-36 animate-pulse rounded-[var(--ui-radius-lg)] bg-[var(--ui-surface-subtle)]" />
                    <div className="h-52 animate-pulse rounded-[var(--ui-radius-lg)] bg-[var(--ui-surface-subtle)]" />
                    <div className="h-44 animate-pulse rounded-[var(--ui-radius-lg)] bg-[var(--ui-surface-subtle)]" />
                </div>
            ) : error ? (
                <Notice
                    tone="danger"
                    title="โหลดรายละเอียด Billing ไม่สำเร็จ"
                    action={(
                        <Button variant="outline" onClick={() => void loadDetail()}>
                            <RefreshCw className="h-4 w-4" />
                            ลองใหม่
                        </Button>
                    )}
                >
                    {error}
                </Notice>
            ) : data ? (
                <div className="space-y-4">
                    <Section
                        title="เอกสารและยอดคงเหลือ"
                        description={data.document.number || 'Billing document'}
                        action={(
                            <div className="flex items-center gap-2">
                                <Badge variant={stageTone[data.document.stage]}>{getStageLabel(data.document.stage)}</Badge>
                                {data.document.overdue && <Badge variant="error">เกินกำหนด</Badge>}
                            </div>
                        )}
                    >
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            <div>
                                <div className="text-xs font-semibold text-[var(--ui-text-muted)]">ยอดเอกสาร</div>
                                <div className="mt-1 text-xl font-bold tabular-nums">฿{formatMoney(data.document.totalAmount)}</div>
                            </div>
                            <div>
                                <div className="text-xs font-semibold text-[var(--ui-text-muted)]">รับแล้ว</div>
                                <div className="mt-1 text-xl font-bold tabular-nums text-[var(--ui-success-text)]">฿{formatMoney(data.document.paidAmount)}</div>
                            </div>
                            <div>
                                <div className="text-xs font-semibold text-[var(--ui-text-muted)]">คงเหลือ</div>
                                <div className="mt-1 text-xl font-bold tabular-nums text-[var(--ui-text)]">฿{formatMoney(data.document.remainingAmount)}</div>
                            </div>
                            <div>
                                <div className="text-xs font-semibold text-[var(--ui-text-muted)]">ครบกำหนด</div>
                                <div className={data.document.overdue ? 'mt-1 font-bold text-[var(--ui-danger-text)]' : 'mt-1 font-bold'}>
                                    {formatDate(data.document.dueDate)}
                                </div>
                            </div>
                        </div>

                        {data.document.dataQualityFlags.length > 0 && (
                            <Notice tone="danger" title="พบข้อมูลที่ควรตรวจสอบ" className="mt-4">
                                {data.document.dataQualityFlags.join(', ')} — ยังไม่ควรใช้หน้ารับชำระใหม่จนตรวจความสัมพันธ์ของข้อมูลเรียบร้อย
                            </Notice>
                        )}

                        <div className="mt-4 space-y-2">
                            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                                <ReceivePaymentDialog
                                    document={data.document}
                                    canReceivePayment={data.permissions.canReceivePayment}
                                    onSuccess={loadDetail}
                                />
                                <BillingDocumentAdminActions
                                    document={data.document}
                                    canManage={data.permissions.canReceivePayment}
                                />
                            </div>
                        </div>
                    </Section>

                    <Section title="ลูกค้า" description="ข้อมูลเจ้าของบัญชีของเอกสารนี้">
                        <div className="flex items-start gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-[var(--ui-radius-md)] bg-[var(--ui-surface-subtle)]">
                                <UserRound className="h-5 w-5 text-[var(--ui-text-muted)]" aria-hidden="true" />
                            </div>
                            <div>
                                <div className="font-bold">{data.customer.name}</div>
                                <div className="mt-1 text-sm text-[var(--ui-text-muted)]">
                                    รหัส {data.customer.code || '—'} · โทร {data.customer.phone || '—'}
                                </div>
                            </div>
                        </div>
                    </Section>

                    <Section
                        title="รายการต้นทาง"
                        description={`แสดง ${renderedSourceItems.length} จาก ${data.sourceItems.length} รายการที่ประกอบเป็นยอดเอกสาร`}
                    >
                        {data.sourceItems.length === 0 ? (
                            <EmptyState
                                compact
                                icon={AlertTriangle}
                                title="ไม่พบรายการต้นทาง"
                                description="เอกสารนี้อาจมาจาก generator เก่าที่ไม่ได้ link รายการต้นทาง กรุณาตรวจข้อมูลก่อนรับชำระ"
                            />
                        ) : (
                            <div className="space-y-4">
                            <ResponsiveDataView
                                breakpoint="md"
                                desktop={(
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>วันที่ / รายการ</TableHead>
                                                <TableHead>สถานี / อ้างอิง</TableHead>
                                                <TableHead>จำนวน</TableHead>
                                                <TableHead className="text-right">ยอด</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {renderedSourceItems.map((item) => (
                                                <TableRow key={item.id}>
                                                    <TableCell>
                                                        <div className="font-semibold text-[var(--ui-text)]">{item.description}</div>
                                                        <div className="mt-0.5 text-xs text-[var(--ui-text-muted)]">{formatDate(item.date)}</div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div>{item.station || '—'}</div>
                                                        <div className="mt-0.5 text-xs text-[var(--ui-text-muted)]">{item.reference || '—'}</div>
                                                    </TableCell>
                                                    <TableCell>{item.quantityText || '—'}</TableCell>
                                                    <TableCell className="text-right font-bold tabular-nums">฿{formatMoney(item.amount)}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                )}
                                mobile={(
                                    <MobileDataList>
                                        {renderedSourceItems.map((item) => (
                                            <MobileDataRow
                                                key={item.id}
                                                title={item.description}
                                                description={`${item.station || 'ไม่ระบุสถานี'} · ${item.reference || 'ไม่มีเลขอ้างอิง'}`}
                                                meta={item.quantityText || formatDate(item.date)}
                                                leadingIcon={Building2}
                                                value={`฿${formatMoney(item.amount)}`}
                                            />
                                        ))}
                                    </MobileDataList>
                                )}
                            />
                            {renderedSourceItems.length < data.sourceItems.length && (
                                <Button
                                    variant="outline"
                                    className="w-full"
                                    onClick={() => setSourceVisibleCount((count) => count + BILLING_DETAIL_PAGE_SIZE)}
                                >
                                    แสดงเพิ่มอีก {Math.min(BILLING_DETAIL_PAGE_SIZE, data.sourceItems.length - renderedSourceItems.length)} รายการ
                                </Button>
                            )}
                            </div>
                        )}
                    </Section>

                    <Section
                        title="การรับชำระ"
                        description={`${data.paymentEvents.length} รายการชำระ/หลักฐาน`}
                    >
                        {data.paymentEvents.length === 0 ? (
                            <EmptyState compact icon={Banknote} title="ยังไม่มีการรับชำระ" />
                        ) : (
                            <div className="space-y-2">
                                {data.paymentEvents.map((payment) => (
                                    <div
                                        key={`${payment.source}:${payment.id}`}
                                        className="flex items-center gap-3 rounded-[var(--ui-radius-md)] border border-[var(--ui-border)] p-3"
                                    >
                                        <div className="flex h-9 w-9 items-center justify-center rounded-[var(--ui-radius-md)] bg-[var(--ui-surface-subtle)]">
                                            {payment.evidenceUrl ? (
                                                <ImageIcon className="h-4 w-4 text-[var(--ui-text-muted)]" aria-hidden="true" />
                                            ) : (
                                                <CheckCircle2 className="h-4 w-4 text-[var(--ui-text-muted)]" aria-hidden="true" />
                                            )}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="font-semibold">฿{formatMoney(payment.amount)}</span>
                                                <Badge variant={getPaymentStatusVariant(payment.status)}>
                                                    {getPaymentStatusLabel(payment.status)}
                                                </Badge>
                                            </div>
                                            <div className="mt-1 text-xs text-[var(--ui-text-muted)]">
                                                {formatDate(payment.occurredAt)} · {payment.method || 'ไม่ระบุวิธี'}
                                                {payment.senderName ? ` · ${payment.senderName}` : ''}
                                            </div>
                                            {data.document.kind === 'BILLING_COLLECTION' && data.document.documentId && (
                                                <BillingPaymentEvidenceActions
                                                    collectionId={data.document.documentId}
                                                    payment={payment}
                                                    canReview={data.permissions.canReceivePayment}
                                                    onSuccess={loadDetail}
                                                />
                                            )}
                                        </div>
                                        {payment.evidenceUrl && (
                                            <a
                                                href={payment.evidenceUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="text-xs font-bold text-[var(--ui-primary-text)] hover:underline"
                                            >
                                                ดูหลักฐาน
                                            </a>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </Section>
                </div>
            ) : (
                <Notice tone="danger" title="ไม่พบข้อมูล Billing">กรุณากลับไปหน้า Billing แล้วเลือกเอกสารใหม่</Notice>
            )}
        </RedesignAppShell>
    );
}
