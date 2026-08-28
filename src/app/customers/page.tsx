'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    AlertTriangle,
    ArrowRight,
    CircleDollarSign,
    RefreshCw,
    Search,
    Truck,
    UserRound,
    Users,
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
import type { CustomerAttentionLevel, CustomerListItem, CustomerListPayload } from '@/types/customer';

const moneyFormatter = new Intl.NumberFormat('th-TH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
});

const CUSTOMER_PAGE_SIZE = 50;

const attentionTone: Record<CustomerAttentionLevel, 'default' | 'info' | 'warning' | 'error'> = {
    NONE: 'default',
    INFO: 'info',
    WARNING: 'warning',
    CRITICAL: 'error',
};

const attentionLabel: Record<CustomerAttentionLevel, string> = {
    NONE: 'ปกติ',
    INFO: 'มียอดติดตาม',
    WARNING: 'ต้องตรวจ',
    CRITICAL: 'ต้องจัดการ',
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

function OutstandingBuckets({ item }: { item: CustomerListItem }) {
    const buckets = [
        ['รอวางบิล', item.outstanding.unbilledAmount],
        ['Invoice', item.outstanding.invoiceAmount],
        ['Collection', item.outstanding.collectionAmount],
    ] as const;

    return (
        <div className="space-y-0.5 text-xs tabular-nums">
            {buckets.map(([label, amount]) => (
                <div key={label} className="flex items-center justify-between gap-4">
                    <span className="text-[var(--ui-text-muted)]">{label}</span>
                    <span className={amount > 0 ? 'font-semibold text-[var(--ui-text)]' : 'text-[var(--ui-text-muted)]'}>
                        ฿{formatMoney(amount)}
                    </span>
                </div>
            ))}
        </div>
    );
}

function AttentionBadges({ item }: { item: CustomerListItem }) {
    return (
        <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant={attentionTone[item.attention.level]}>{attentionLabel[item.attention.level]}</Badge>
            {item.attention.labels.slice(0, 2).map((label) => (
                <Badge key={label} variant={item.attention.level === 'CRITICAL' ? 'error' : 'warning'}>
                    {label}
                </Badge>
            ))}
        </div>
    );
}

function CustomerList({ items }: { items: CustomerListItem[] }) {
    if (items.length === 0) {
        return (
            <EmptyState
                compact
                icon={Users}
                title="ไม่พบลูกค้า"
                description="ลองเปลี่ยนคำค้นหาหรือสถานะลูกค้า"
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
                            <TableHead>ลูกค้า</TableHead>
                            <TableHead>สิ่งที่ต้องดู</TableHead>
                            <TableHead className="min-w-[210px]">ยอดค้างแยกตามระบบ</TableHead>
                            <TableHead>รถ / รายการ</TableHead>
                            <TableHead className="text-right">งานถัดไป</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {items.map((item) => (
                            <TableRow key={item.id}>
                                <TableCell>
                                    <div className="font-semibold text-[var(--ui-text)]">{item.name}</div>
                                    <div className="mt-0.5 text-xs text-[var(--ui-text-muted)]">
                                        {item.code || 'ไม่มีรหัส'} · {groupLabel[item.groupType] || item.groupType}
                                    </div>
                                    {item.phone && <div className="mt-0.5 text-xs text-[var(--ui-text-muted)]">{item.phone}</div>}
                                </TableCell>
                                <TableCell><AttentionBadges item={item} /></TableCell>
                                <TableCell><OutstandingBuckets item={item} /></TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-1.5 text-sm text-[var(--ui-text-secondary)]">
                                        <Truck className="h-4 w-4" aria-hidden="true" /> {item.truckCount} คัน
                                    </div>
                                    <div className="mt-1 text-xs text-[var(--ui-text-muted)]">{item.transactionCount} รายการขาย</div>
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
                        <MobileDataRow
                            key={item.id}
                            title={item.name}
                            description={`${item.code || 'ไม่มีรหัส'} · ${groupLabel[item.groupType] || item.groupType}`}
                            leadingIcon={UserRound}
                            href={item.nextAction.href}
                            meta={(
                                <div className="space-y-2">
                                    <AttentionBadges item={item} />
                                    <div className="max-w-[260px]"><OutstandingBuckets item={item} /></div>
                                    <div className="text-[var(--ui-text-muted)]">{item.truckCount} คัน · {item.transactionCount} รายการขาย</div>
                                </div>
                            )}
                        />
                    ))}
                </MobileDataList>
            )}
        />
    );
}

export default function CustomersPage() {
    const router = useRouter();
    const [data, setData] = React.useState<CustomerListPayload | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [search, setSearch] = React.useState('');
    const [status, setStatus] = React.useState('ACTIVE');
    const [attentionOnly, setAttentionOnly] = React.useState(false);
    const [visibleCount, setVisibleCount] = React.useState(CUSTOMER_PAGE_SIZE);

    const loadCustomers = React.useCallback(async (query: string, nextStatus: string) => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams({ status: nextStatus });
            if (query.trim()) params.set('search', query.trim());
            const response = await fetch(`/api/customers?${params.toString()}`, { cache: 'no-store' });
            if (response.status === 401) {
                router.replace('/login');
                return;
            }
            const payload = await response.json().catch(() => null);
            if (!response.ok) throw new Error(payload?.error || 'โหลดรายชื่อลูกค้าไม่สำเร็จ');
            setData(payload as CustomerListPayload);
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : 'โหลดรายชื่อลูกค้าไม่สำเร็จ');
        } finally {
            setLoading(false);
        }
    }, [router]);

    React.useEffect(() => {
        const timer = window.setTimeout(() => {
            void loadCustomers(search, status);
        }, search ? 250 : 0);
        return () => window.clearTimeout(timer);
    }, [loadCustomers, search, status]);

    const visibleItems = React.useMemo(() => {
        const items = data?.items || [];
        return attentionOnly ? items.filter((item) => item.attention.level !== 'NONE') : items;
    }, [attentionOnly, data]);

    React.useEffect(() => {
        setVisibleCount(CUSTOMER_PAGE_SIZE);
    }, [attentionOnly, search, status]);

    const renderedItems = React.useMemo(
        () => visibleItems.slice(0, visibleCount),
        [visibleCount, visibleItems]
    );

    if (loading && !data) {
        return (
            <RedesignAppShell title="Customers" description="ลูกค้า รถ ประวัติซื้อ และงานเครดิตที่ต้องจัดการ">
                <LoadingState label="กำลังโหลดลูกค้า">
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        {[0, 1, 2, 3].map((item) => (
                            <div key={item} className="h-24 animate-pulse rounded-[var(--ui-radius-lg)] bg-[var(--ui-surface-subtle)]" />
                        ))}
                    </div>
                    <div className="h-64 animate-pulse rounded-[var(--ui-radius-lg)] bg-[var(--ui-surface-subtle)]" />
                </LoadingState>
            </RedesignAppShell>
        );
    }

    if (!data) {
        return (
            <RedesignAppShell title="Customers" description="ลูกค้า รถ ประวัติซื้อ และงานเครดิตที่ต้องจัดการ">
                <FatalErrorState
                    title={error ? 'โหลดลูกค้าไม่สำเร็จ' : 'ไม่พบข้อมูลลูกค้า'}
                    message={error || 'ยังไม่มีข้อมูลลูกค้าที่แสดงได้'}
                    onRetry={() => void loadCustomers(search, status)}
                />
            </RedesignAppShell>
        );
    }

    return (
        <RedesignAppShell
            title="Customers"
            description="ลูกค้า รถ ประวัติซื้อ และงานเครดิตที่ต้องจัดการ"
        >
            <div className="space-y-4" aria-busy={loading}>
                <AsyncRefreshState
                    loading={loading}
                    error={error}
                    onRetry={() => void loadCustomers(search, status)}
                    loadingLabel="กำลังอัปเดตรายชื่อลูกค้าตามตัวกรอง…"
                />
                {data && (
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-[var(--ui-radius-lg)] border border-[var(--ui-border)] bg-[var(--ui-surface)] p-4">
                            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--ui-text-muted)]"><Users className="h-4 w-4" aria-hidden="true" />ลูกค้า</div>
                            <div className="mt-2 text-2xl font-bold tabular-nums">{data.summary.customerCount}</div>
                            <div className="mt-1 text-xs text-[var(--ui-text-muted)]">ต้องดู {data.summary.attentionCount} ราย</div>
                        </div>
                        <div className="rounded-[var(--ui-radius-lg)] border border-[var(--ui-border)] bg-[var(--ui-surface)] p-4">
                            <div className="text-sm font-semibold text-[var(--ui-text-muted)]">รอวางบิล</div>
                            <div className="mt-2 text-2xl font-bold tabular-nums">฿{formatMoney(data.summary.unbilledAmount)}</div>
                        </div>
                        <div className="rounded-[var(--ui-radius-lg)] border border-[var(--ui-border)] bg-[var(--ui-surface)] p-4">
                            <div className="text-sm font-semibold text-[var(--ui-text-muted)]">Invoice ค้างรับ</div>
                            <div className="mt-2 text-2xl font-bold tabular-nums">฿{formatMoney(data.summary.invoiceOutstandingAmount)}</div>
                        </div>
                        <div className="rounded-[var(--ui-radius-lg)] border border-[var(--ui-border)] bg-[var(--ui-surface)] p-4">
                            <div className="text-sm font-semibold text-[var(--ui-text-muted)]">Collection ค้างรับ</div>
                            <div className="mt-2 text-2xl font-bold tabular-nums">฿{formatMoney(data.summary.collectionOutstandingAmount)}</div>
                        </div>
                    </div>
                )}

                <Notice tone="info" title="ยอดค้างแสดงแยกตามแหล่งข้อมูล">
                    ไม่บวก รอวางบิล + Invoice + Collection เป็นยอดเดียว เพราะข้อมูลเก่าบางชุดอาจอ้างถึงหนี้ก้อนเดียวกัน ส่วน currentCredit เดิมไม่ถือเป็น source of truth ในหน้าใหม่
                </Notice>

                <Section
                    title="รายชื่อลูกค้า"
                    description={data ? `แสดง ${renderedItems.length} จาก ${visibleItems.length} รายตามตัวกรอง · ${data.summary.customerCount} รายทั้งหมด` : 'ค้นหาและจัดลำดับตามงานที่ต้องทำ'}
                    action={(
                        <Button variant="outline" size="sm" onClick={() => void loadCustomers(search, status)} disabled={loading}>
                            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
                            รีเฟรช
                        </Button>
                    )}
                    contentClassName="space-y-4"
                >
                    <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_180px_auto]">
                        <Input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            aria-label="ค้นหาชื่อ รหัส เบอร์โทร หรือทะเบียนรถ"
                            placeholder="ค้นหาชื่อ รหัส เบอร์โทร หรือทะเบียนรถ"
                            leftIcon={<Search className="h-4 w-4" aria-hidden="true" />}
                        />
                        <select
                            aria-label="สถานะลูกค้า"
                            value={status}
                            onChange={(event) => setStatus(event.target.value)}
                            className="min-h-[var(--ui-control-height-md)] rounded-[var(--ui-radius-md)] border border-[var(--ui-border)] bg-[var(--ui-surface)] px-3 text-sm text-[var(--ui-text)] focus-visible:outline-none focus-visible:shadow-[var(--ui-shadow-focus)]"
                        >
                            <option value="ACTIVE">ใช้งานอยู่</option>
                            <option value="SUSPENDED">ระงับใช้งาน</option>
                            <option value="INACTIVE">ไม่ได้ใช้งาน</option>
                            <option value="ALL">ทั้งหมด</option>
                        </select>
                        <button
                            type="button"
                            onClick={() => setAttentionOnly((value) => !value)}
                            aria-pressed={attentionOnly}
                            className={`inline-flex min-h-[var(--ui-touch-target)] items-center justify-center gap-2 rounded-[var(--ui-radius-md)] border px-3 text-sm font-semibold focus-visible:outline-none focus-visible:shadow-[var(--ui-shadow-focus)] ${attentionOnly
                                ? 'border-[var(--ui-warning)] bg-[var(--ui-warning-soft)] text-[var(--ui-warning-text)]'
                                : 'border-[var(--ui-border)] bg-[var(--ui-surface)] text-[var(--ui-text-secondary)]'}`}
                        >
                            <AlertTriangle className="h-4 w-4" aria-hidden="true" /> เฉพาะต้องดู
                        </button>
                    </div>

                    <CustomerList items={renderedItems} />

                    {renderedItems.length < visibleItems.length && (
                        <Button
                            variant="outline"
                            className="w-full"
                            onClick={() => setVisibleCount((count) => count + CUSTOMER_PAGE_SIZE)}
                        >
                            แสดงเพิ่มอีก {Math.min(CUSTOMER_PAGE_SIZE, visibleItems.length - renderedItems.length)} ราย
                        </Button>
                    )}
                </Section>

                <div className="flex items-center gap-2 text-xs text-[var(--ui-text-muted)]">
                    <CircleDollarSign className="h-4 w-4" aria-hidden="true" />
                    วงเงิน/currentCredit เดิมจะแสดงรายละเอียดใน Customer 360 โดยระบุว่าเป็น legacy indicator
                </div>
            </div>
        </RedesignAppShell>
    );
}
