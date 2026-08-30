'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
    ArrowRight,
    CalendarDays,
    CircleDollarSign,
    FileText,
    Phone,
    ReceiptText,
    RefreshCw,
    Truck,
    UserRound,
    WalletCards,
} from 'lucide-react';
import { RedesignAppShell } from '@/components/layout';
import { CustomerMasterDataPanel } from '@/components/customers/CustomerMasterDataPanel';
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
import type {
    Customer360BillingDocument,
    Customer360Payload,
    Customer360PaymentEvent,
    Customer360Transaction,
} from '@/types/customer';

const moneyFormatter = new Intl.NumberFormat('th-TH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
});
const numberFormatter = new Intl.NumberFormat('th-TH', { maximumFractionDigits: 3 });

const paymentLabel: Record<string, string> = {
    CASH: 'เงินสด',
    CREDIT: 'เงินเชื่อ',
    TRANSFER: 'โอนเงิน',
    BOX_TRUCK: 'รถตู้',
    OIL_TRUCK_SUPACHAI: 'รถน้ำมันศุภชัย',
    CREDIT_CARD: 'บัตรเครดิต',
};

const groupLabel: Record<string, string> = {
    SUGAR_FACTORY: 'โรงงานน้ำตาล',
    GENERAL_CREDIT: 'เครดิตทั่วไป',
    BOX_TRUCK: 'รถตู้',
    OIL_TRUCK: 'รถน้ำมัน',
    OOY_TRUCK: 'รถอ้อย',
};

function formatMoney(value: number) {
    return moneyFormatter.format(value);
}

function formatDate(value: string | null, withTime = false) {
    if (!value) return '-';
    return new Date(value).toLocaleString('th-TH', {
        day: 'numeric',
        month: 'short',
        year: '2-digit',
        ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
        timeZone: 'Asia/Bangkok',
    });
}

function BillingDocumentBadges({ document }: { document: Customer360BillingDocument }) {
    return (
        <div className="flex flex-wrap gap-1.5">
            <Badge variant={document.stage === 'CLOSED' ? 'success' : document.stage === 'PARTIAL' ? 'warning' : 'default'}>
                {document.stage === 'CLOSED' ? 'ปิดยอด' : document.stage === 'PARTIAL' ? 'จ่ายบางส่วน' : 'รอรับเงิน'}
            </Badge>
            {document.overdue && <Badge variant="error">เกินกำหนด</Badge>}
            {document.pendingPaymentReviews > 0 && <Badge variant="info">รอตรวจสลิป {document.pendingPaymentReviews}</Badge>}
            {document.dataQualityFlags.length > 0 && <Badge variant="error">ข้อมูลผิดปกติ</Badge>}
        </div>
    );
}

function TransactionsSection({ transactions }: { transactions: Customer360Transaction[] }) {
    if (transactions.length === 0) {
        return <EmptyState compact icon={ReceiptText} title="ยังไม่มีประวัติซื้อ" description="รายการขายของลูกค้าจะปรากฏที่นี่" />;
    }

    return (
        <ResponsiveDataView
            breakpoint="md"
            desktop={(
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>วันที่ / สถานี</TableHead>
                            <TableHead>ทะเบียน</TableHead>
                            <TableHead>ชำระ</TableHead>
                            <TableHead className="text-right">ลิตร</TableHead>
                            <TableHead className="text-right">ยอด</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {transactions.map((transaction) => (
                            <TableRow key={transaction.id}>
                                <TableCell>
                                    <div className="font-semibold text-[var(--ui-text)]">{formatDate(transaction.date, true)}</div>
                                    <div className="mt-0.5 text-xs text-[var(--ui-text-muted)]">{transaction.stationName}</div>
                                </TableCell>
                                <TableCell>{transaction.licensePlate || '-'}</TableCell>
                                <TableCell>
                                    <div>{paymentLabel[transaction.paymentType] || transaction.paymentType}</div>
                                    {(transaction.billBookNo || transaction.billNo) && (
                                        <div className="mt-0.5 text-xs text-[var(--ui-text-muted)]">
                                            {transaction.billBookNo || '-'} / {transaction.billNo || '-'}
                                        </div>
                                    )}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">{numberFormatter.format(transaction.liters)}</TableCell>
                                <TableCell className="text-right font-bold tabular-nums text-[var(--ui-text)]">฿{formatMoney(transaction.amount)}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            )}
            mobile={(
                <MobileDataList>
                    {transactions.map((transaction) => (
                        <MobileDataRow
                            key={transaction.id}
                            title={transaction.licensePlate || transaction.stationName}
                            description={`${transaction.stationName} · ${paymentLabel[transaction.paymentType] || transaction.paymentType}`}
                            leadingIcon={ReceiptText}
                            meta={`${formatDate(transaction.date, true)} · ${numberFormatter.format(transaction.liters)} ลิตร`}
                            value={`฿${formatMoney(transaction.amount)}`}
                        />
                    ))}
                </MobileDataList>
            )}
        />
    );
}

function BillingSection({ documents }: { documents: Customer360BillingDocument[] }) {
    if (documents.length === 0) {
        return <EmptyState compact icon={FileText} title="ยังไม่มีเอกสารเรียกเก็บเงิน" description="Invoice และ Billing Collection ของลูกค้าจะอยู่ที่นี่" />;
    }

    return (
        <div className="space-y-2">
            {documents.map((document) => (
                <Link
                    key={`${document.kind}:${document.id}`}
                    href={`/billing/${document.id}?kind=${document.kind}`}
                    className="block rounded-[var(--ui-radius-md)] border border-[var(--ui-border)] bg-[var(--ui-surface)] p-3 transition-colors hover:bg-[var(--ui-surface-subtle)]"
                >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                            <div className="font-semibold text-[var(--ui-text)]">{document.number}</div>
                            <div className="mt-1 text-xs text-[var(--ui-text-muted)]">
                                {document.kind === 'INVOICE' ? 'Invoice' : 'Billing Collection'} · {document.sourceItemCount} รายการ · {document.dueDate ? `ครบกำหนด ${formatDate(document.dueDate)}` : 'ไม่กำหนดวันครบกำหนด'}
                            </div>
                            <div className="mt-2"><BillingDocumentBadges document={document} /></div>
                        </div>
                        <div className="flex shrink-0 items-center gap-3">
                            <div className="text-right">
                                <div className="text-xs text-[var(--ui-text-muted)]">คงเหลือ</div>
                                <div className="font-bold tabular-nums text-[var(--ui-text)]">฿{formatMoney(document.remainingAmount)}</div>
                            </div>
                            <ArrowRight className="h-4 w-4 text-[var(--ui-text-muted)]" aria-hidden="true" />
                        </div>
                    </div>
                </Link>
            ))}
        </div>
    );
}

function PaymentSection({ payments }: { payments: Customer360PaymentEvent[] }) {
    if (payments.length === 0) {
        return <EmptyState compact icon={WalletCards} title="ยังไม่มีประวัติการชำระ" description="Payment และสลิปของลูกค้าจะรวมเป็น timeline เดียว" />;
    }

    return (
        <div className="divide-y divide-[var(--ui-border)]">
            {payments.map((payment) => (
                <div key={`${payment.source}:${payment.id}`} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-[var(--ui-text)]">{payment.documentNumber}</span>
                            <Badge variant={payment.status === 'CONFIRMED' ? 'success' : payment.status === 'REJECTED' ? 'error' : 'warning'}>
                                {payment.status === 'CONFIRMED' ? 'ยืนยันแล้ว' : payment.status === 'REJECTED' ? 'ปฏิเสธ' : 'รอตรวจ'}
                            </Badge>
                        </div>
                        <div className="mt-1 text-xs text-[var(--ui-text-muted)]">
                            {formatDate(payment.occurredAt, true)} · {payment.method || 'ไม่ระบุวิธี'} · {payment.documentKind === 'INVOICE' ? 'Invoice' : 'Collection'}
                        </div>
                    </div>
                    <div className="shrink-0 font-bold tabular-nums text-[var(--ui-text)]">฿{formatMoney(payment.amount)}</div>
                </div>
            ))}
        </div>
    );
}

export default function CustomerDetailPage() {
    const params = useParams<{ id: string }>();
    const router = useRouter();
    const id = params.id;
    const [data, setData] = React.useState<Customer360Payload | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    const loadCustomer = React.useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`/api/customers/${id}`, { cache: 'no-store' });
            if (response.status === 401) {
                router.replace('/login');
                return;
            }
            const payload = await response.json().catch(() => null);
            if (!response.ok) throw new Error(payload?.error || 'โหลดข้อมูลลูกค้าไม่สำเร็จ');
            setData(payload as Customer360Payload);
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : 'โหลดข้อมูลลูกค้าไม่สำเร็จ');
        } finally {
            setLoading(false);
        }
    }, [id, router]);

    React.useEffect(() => {
        void loadCustomer();
    }, [loadCustomer]);

    return (
        <RedesignAppShell
            title={data?.customer.name || 'Customer 360'}
            description="ข้อมูลลูกค้า รถ การซื้อ วางบิล และการชำระเงินในที่เดียว"
            contextValue={data?.customer.code || undefined}
        >
            {loading && !data ? (
                <div className="space-y-4">
                    <div className="h-32 animate-pulse rounded-[var(--ui-radius-lg)] bg-[var(--ui-surface-subtle)]" />
                    <div className="h-64 animate-pulse rounded-[var(--ui-radius-lg)] bg-[var(--ui-surface-subtle)]" />
                </div>
            ) : error ? (
                <Notice tone="danger" title="โหลด Customer 360 ไม่สำเร็จ" action={<Button variant="outline" size="sm" onClick={() => void loadCustomer()}>ลองใหม่</Button>}>
                    {error}
                </Notice>
            ) : data ? (
                <div className="space-y-4">
                    <Section
                        title="ภาพรวมลูกค้า"
                        description={`${groupLabel[data.customer.groupType] || data.customer.groupType} · สถานะ ${data.customer.status}`}
                        action={<Button variant="outline" size="sm" onClick={() => void loadCustomer()}><RefreshCw className="h-4 w-4" />รีเฟรช</Button>}
                    >
                        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                <div className="flex items-start gap-2">
                                    <UserRound className="mt-0.5 h-4 w-4 text-[var(--ui-text-muted)]" />
                                    <div><div className="text-xs text-[var(--ui-text-muted)]">รหัสลูกค้า</div><div className="font-semibold">{data.customer.code || '-'}</div></div>
                                </div>
                                <div className="flex items-start gap-2">
                                    <Phone className="mt-0.5 h-4 w-4 text-[var(--ui-text-muted)]" />
                                    <div><div className="text-xs text-[var(--ui-text-muted)]">โทรศัพท์</div><div className="font-semibold">{data.customer.phone || '-'}</div></div>
                                </div>
                                <div className="flex items-start gap-2">
                                    <CalendarDays className="mt-0.5 h-4 w-4 text-[var(--ui-text-muted)]" />
                                    <div><div className="text-xs text-[var(--ui-text-muted)]">เริ่มใช้งาน</div><div className="font-semibold">{formatDate(data.customer.createdAt)}</div></div>
                                </div>
                            </div>
                            <div className="text-sm text-[var(--ui-text-muted)]">{data.counts.activeTransactions} รายการขายทั้งหมด</div>
                        </div>
                    </Section>

                    <CustomerMasterDataPanel data={data} onChanged={loadCustomer} />

                    {(data.credit.overdueDocuments > 0 || data.credit.pendingPaymentReviews > 0) && (
                        <Notice tone={data.credit.overdueDocuments > 0 ? 'danger' : 'warning'} title="มีงานเครดิตที่ต้องจัดการ">
                            {data.credit.overdueDocuments > 0 && <span>เกินกำหนด {data.credit.overdueDocuments} เอกสาร</span>}
                            {data.credit.overdueDocuments > 0 && data.credit.pendingPaymentReviews > 0 && <span> · </span>}
                            {data.credit.pendingPaymentReviews > 0 && <span>สลิปรอตรวจ {data.credit.pendingPaymentReviews} รายการ</span>}
                        </Notice>
                    )}

                    <Section title="เครดิตและยอดค้าง" description="แยก bucket เพื่อป้องกันการนับหนี้ซ้ำ">
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                            <div className="rounded-[var(--ui-radius-md)] border border-[var(--ui-border)] p-3">
                                <div className="text-xs text-[var(--ui-text-muted)]">รอวางบิล</div>
                                <div className="mt-1 text-xl font-bold tabular-nums">฿{formatMoney(data.credit.unbilledCredit.amount)}</div>
                                <div className="mt-1 text-xs text-[var(--ui-text-muted)]">{data.credit.unbilledCredit.transactionCount} รายการ</div>
                            </div>
                            <div className="rounded-[var(--ui-radius-md)] border border-[var(--ui-border)] p-3">
                                <div className="text-xs text-[var(--ui-text-muted)]">Invoice ค้างรับ</div>
                                <div className="mt-1 text-xl font-bold tabular-nums">฿{formatMoney(data.credit.invoiceOutstanding.amount)}</div>
                                <div className="mt-1 text-xs text-[var(--ui-text-muted)]">{data.credit.invoiceOutstanding.documentCount} เอกสาร</div>
                            </div>
                            <div className="rounded-[var(--ui-radius-md)] border border-[var(--ui-border)] p-3">
                                <div className="text-xs text-[var(--ui-text-muted)]">Collection ค้างรับ</div>
                                <div className="mt-1 text-xl font-bold tabular-nums">฿{formatMoney(data.credit.collectionOutstanding.amount)}</div>
                                <div className="mt-1 text-xs text-[var(--ui-text-muted)]">{data.credit.collectionOutstanding.documentCount} เอกสาร</div>
                            </div>
                            <div className="rounded-[var(--ui-radius-md)] border border-[var(--ui-border)] bg-[var(--ui-surface-subtle)] p-3">
                                <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--ui-text-muted)]"><CircleDollarSign className="h-4 w-4" />Legacy credit</div>
                                <div className="mt-1 text-xl font-bold tabular-nums">฿{formatMoney(data.credit.legacyCurrentCredit)}</div>
                                <div className="mt-1 text-xs text-[var(--ui-text-muted)]">วงเงิน ฿{formatMoney(data.credit.creditLimit)} · ไม่ใช้เป็น source of truth</div>
                            </div>
                        </div>
                    </Section>

                    <Section title={`รถ (${data.trucks.length})`} description="รถที่ยังใช้งานและรายการล่าสุดของแต่ละคัน">
                        {data.trucks.length === 0 ? (
                            <EmptyState compact icon={Truck} title="ยังไม่มีรถ" description="รถที่ผูกกับลูกค้าจะอยู่ที่นี่" />
                        ) : (
                            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                {data.trucks.map((truck) => (
                                    <div key={truck.id} className="rounded-[var(--ui-radius-md)] border border-[var(--ui-border)] p-3">
                                        <div className="flex items-center gap-2 font-semibold"><Truck className="h-4 w-4 text-[var(--ui-text-muted)]" />{truck.licensePlate}</div>
                                        <div className="mt-1 text-xs text-[var(--ui-text-muted)]">{truck.transactionCount} รายการ · ล่าสุด {formatDate(truck.lastTransactionAt, true)}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Section>

                    <Section title="ประวัติซื้อ" description={`ล่าสุดไม่เกิน ${data.workflow.transactionHistoryLimit} รายการ`}>
                        <TransactionsSection transactions={data.recentTransactions} />
                    </Section>

                    <Section title={`วางบิล (${data.billingDocuments.length})`} description="Invoice และ Billing Collection แสดงใน timeline เดียวแต่ยังไม่ merge model">
                        <BillingSection documents={data.billingDocuments} />
                    </Section>

                    <Section title={`ประวัติการชำระ (${data.paymentHistory.length})`} description="Payment และ Payment Slip เรียงตามเวลาจริง">
                        <PaymentSection payments={data.paymentHistory} />
                    </Section>

                    <Notice tone="info" title="การคำนวณเครดิตในหน้าใหม่">
                        {data.workflow.creditSourceNote}
                    </Notice>
                </div>
            ) : null}
        </RedesignAppShell>
    );
}
