'use client';

import * as React from 'react';
import { Download, Plus, Printer, RefreshCw, Wrench } from 'lucide-react';
import { PAYMENT_TYPES } from '@/constants';
import { useToast } from '@/components/Toast';
import { Badge, Button, EmptyState, Notice, Section } from '@/components/ui';
import AuditTrail from '@/app/station/[id]/v2/components/AuditTrail';
import DailySummary from '@/app/station/[id]/v2/components/DailySummary';
import EditTransactionModal from '@/app/station/[id]/v2/components/EditTransactionModal';
import RefillModal from '@/app/station/[id]/v2/components/RefillModal';
import TransactionCard from '@/app/station/[id]/v2/components/TransactionCard';
import { printDailyWorkReport, printThermalDailyWorkReport } from '@/lib/daily-report-print';
import { canCreateFullHistoryTransaction } from '@/lib/stations/full-history-maintenance';
import {
    buildFullStationSummaryCsv,
    buildFullStationSummaryCsvFilename,
    filterFullSummaryTransactions,
    type FullSummaryTransaction,
} from '@/lib/stations/full-summary-compat';
import type { StationContextPayload } from '@/types/station';

interface MaintenanceMeter {
    nozzleNumber: number;
    startReading: number;
    endReading: number | null;
    startPhoto?: string | null;
    endPhoto?: string | null;
}

interface MaintenanceTransaction extends Omit<FullSummaryTransaction, 'billBookNo' | 'billNo'> {
    billBookNo?: string;
    billNo?: string;
    ownerCode?: string | null;
    recordedByName?: string;
}

interface MaintenanceDailyRecord {
    id: string;
    date: string;
    status: string;
    retailPrice: number;
    wholesalePrice: number;
    meterShiftId?: string | null;
    meterShiftStatus?: string | null;
    meters: MaintenanceMeter[];
}

interface DailyMaintenancePayload {
    dailyRecord: MaintenanceDailyRecord | null;
    transactions?: Array<MaintenanceTransaction & {
        billBookNo?: string | null;
        billNo?: string | null;
    }>;
}

function normalizeTransactions(payload: DailyMaintenancePayload): MaintenanceTransaction[] {
    return (payload.transactions || []).map((transaction) => ({
        ...transaction,
        billBookNo: transaction.billBookNo || undefined,
        billNo: transaction.billNo || undefined,
        transferProofUrl: transaction.transferProofUrl || null,
    }));
}

function getPrintableMeters(dailyRecord: MaintenanceDailyRecord | null) {
    return (dailyRecord?.meters || []).map((meter) => ({
        nozzleNumber: meter.nozzleNumber,
        startReading: Number(meter.startReading || 0),
        endReading: meter.endReading == null ? null : Number(meter.endReading),
        liters: meter.endReading == null
            ? 0
            : Math.max(Number(meter.endReading || 0) - Number(meter.startReading || 0), 0),
    }));
}

export function FullHistoryMaintenance({
    context,
    defaultDate,
}: {
    context: StationContextPayload;
    defaultDate: string;
}) {
    const { showToast } = useToast();
    const [selectedDate, setSelectedDate] = React.useState(defaultDate);
    const [dailyRecord, setDailyRecord] = React.useState<MaintenanceDailyRecord | null>(null);
    const [transactions, setTransactions] = React.useState<MaintenanceTransaction[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [csvPaymentFilter, setCsvPaymentFilter] = React.useState('all');
    const [editingTransaction, setEditingTransaction] = React.useState<MaintenanceTransaction | null>(null);
    const [showRefillModal, setShowRefillModal] = React.useState(false);

    React.useEffect(() => {
        setSelectedDate(defaultDate);
        setDailyRecord(null);
        setTransactions([]);
        setEditingTransaction(null);
        setShowRefillModal(false);
    }, [defaultDate]);

    const load = React.useCallback(async () => {
        setLoading(true);
        setError(null);
        setDailyRecord(null);
        setTransactions([]);
        setEditingTransaction(null);
        setShowRefillModal(false);
        try {
            const response = await fetch(
                `/api/station/${context.station.number}/daily?date=${encodeURIComponent(selectedDate)}`,
                { cache: 'no-store' }
            );
            const payload = await response.json().catch(() => null) as (DailyMaintenancePayload & { error?: string }) | null;
            if (!response.ok || !payload) {
                throw new Error(payload?.error || 'โหลดข้อมูลรายวันไม่สำเร็จ');
            }
            setDailyRecord(payload.dailyRecord);
            setTransactions(normalizeTransactions(payload));
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : 'โหลดข้อมูลรายวันไม่สำเร็จ');
        } finally {
            setLoading(false);
        }
    }, [context.station.number, selectedDate]);

    React.useEffect(() => {
        void load();
    }, [load]);

    const printableMeters = React.useMemo(() => getPrintableMeters(dailyRecord), [dailyRecord]);
    const meterTotal = printableMeters.reduce((sum, meter) => sum + Number(meter.liters || 0), 0);
    const transactionTotal = transactions.reduce((sum, transaction) => sum + Number(transaction.liters || 0), 0);
    const meterDiff = transactionTotal - meterTotal;
    const canCreateAgainstOpenShift = canCreateFullHistoryTransaction(dailyRecord);

    const exportDailyCsv = () => {
        const exportTransactions = filterFullSummaryTransactions(transactions, csvPaymentFilter);
        if (exportTransactions.length === 0) {
            showToast('warning', 'ไม่มีรายการตามประเภทชำระที่เลือก');
            return;
        }

        const csv = buildFullStationSummaryCsv(exportTransactions);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = buildFullStationSummaryCsvFilename(context.station.name, selectedDate);
        link.click();
        URL.revokeObjectURL(url);
    };

    const printDailyReport = (paper: 'a4' | '58' | '80') => {
        if (!dailyRecord) {
            showToast('warning', 'ไม่พบข้อมูลวันที่เลือกสำหรับพิมพ์รายงาน');
            return;
        }

        const payload = {
            stationName: context.station.name,
            reportDate: selectedDate,
            transactions,
            meters: printableMeters,
        };
        const opened = paper === 'a4'
            ? printDailyWorkReport(payload)
            : printThermalDailyWorkReport({ ...payload, paperSize: paper });

        if (!opened) {
            showToast('error', 'เปิดหน้าพิมพ์ไม่สำเร็จ กรุณาอนุญาต popup หรือเช็กแอป Epson');
        }
    };

    return (
        <Section
            title="ดูแลข้อมูลรายวันของ FULL (แอดมิน)"
            description="แก้/ยกเลิกรายการเดิม แนบสลิป พิมพ์ซ้ำ ส่งออก CSV พิมพ์สรุปวัน และตรวจ Audit Log จากข้อมูลจริง"
        >
            <div className="space-y-4">
                <Notice tone="warning" title="การแก้ย้อนหลังมีผลกับข้อมูลจริง">
                    ระบบใช้ API เดิมที่ผูก station และบันทึก Audit Log การแก้/ยกเลิก รายการเดิมจะไม่ถูกคำนวณราคาใหม่โดยอัตโนมัติ
                </Notice>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <label className="block flex-1 text-sm font-semibold">
                        วันที่ที่ต้องการดูแล
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(event) => {
                                setSelectedDate(event.target.value);
                                setDailyRecord(null);
                                setTransactions([]);
                                setEditingTransaction(null);
                                setShowRefillModal(false);
                            }}
                            className="mt-1 min-h-11 w-full rounded-[var(--ui-radius-md)] border border-[var(--ui-border-strong)] bg-[var(--ui-surface)] px-3 font-normal focus-visible:outline-none focus-visible:shadow-[var(--ui-shadow-focus)]"
                        />
                    </label>
                    <Button variant="outline" onClick={() => void load()} disabled={loading}>
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
                        โหลดใหม่
                    </Button>
                    {canCreateAgainstOpenShift && (
                        <Button onClick={() => setShowRefillModal(true)}>
                            <Plus className="h-4 w-4" aria-hidden="true" />
                            เพิ่มรายการในกะ OPEN
                        </Button>
                    )}
                </div>

                {error && (
                    <Notice tone="danger" title="โหลดข้อมูลรายวันไม่สำเร็จ">
                        {error}
                    </Notice>
                )}

                {loading && !dailyRecord && transactions.length === 0 ? (
                    <div role="status" aria-label="กำลังโหลดข้อมูลดูแลรายวัน" className="h-40 animate-pulse rounded-[var(--ui-radius-md)] bg-[var(--ui-surface-subtle)]" />
                ) : !dailyRecord ? (
                    <EmptyState
                        compact
                        icon={Wrench}
                        title="วันที่นี้ไม่มี DailyRecord"
                        description="canonical History จะไม่สร้างวันย้อนหลังจากหน้าดูแลนี้ เลือกวันที่ที่มีข้อมูลเดิมอยู่แล้ว"
                    />
                ) : (
                    <>
                        <div className="flex flex-wrap items-center gap-2">
                            <Badge variant={dailyRecord.status === 'OPEN' ? 'warning' : 'success'}>{dailyRecord.status}</Badge>
                            <span className="text-sm text-[var(--ui-text-muted)]">
                                ราคาปลีก ฿{Number(dailyRecord.retailPrice).toFixed(2)} · ราคาส่ง ฿{Number(dailyRecord.wholesalePrice).toFixed(2)}
                            </span>
                            {!canCreateAgainstOpenShift && (
                                <span className="text-xs font-semibold text-[var(--ui-text-muted)]">
                                    เพิ่มรายการใหม่ไม่ได้: ต้องมี Shift OPEN เดิมของวันที่เลือก
                                </span>
                            )}
                        </div>

                        <div className="rounded-[var(--ui-radius-md)] border border-[var(--ui-border)] p-3">
                            <div className="flex items-center gap-2">
                                <Printer className="h-4 w-4 text-[var(--ui-text-muted)]" aria-hidden="true" />
                                <h3 className="text-sm font-bold">พิมพ์และส่งออก</h3>
                            </div>
                            <div className="mt-3 grid gap-2 sm:grid-cols-3">
                                <Button variant="outline" onClick={() => printDailyReport('80')}>80 mm Epson</Button>
                                <Button variant="outline" onClick={() => printDailyReport('58')}>58 mm</Button>
                                <Button variant="outline" onClick={() => printDailyReport('a4')}>A4</Button>
                            </div>
                            <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                                <select
                                    value={csvPaymentFilter}
                                    onChange={(event) => setCsvPaymentFilter(event.target.value)}
                                    className="min-h-11 rounded-[var(--ui-radius-md)] border border-[var(--ui-border-strong)] bg-[var(--ui-surface)] px-3 text-sm font-semibold focus-visible:outline-none focus-visible:shadow-[var(--ui-shadow-focus)]"
                                    aria-label="กรองประเภทชำระสำหรับ CSV"
                                >
                                    <option value="all">CSV: ทุกประเภทชำระ</option>
                                    {PAYMENT_TYPES.map((paymentType) => (
                                        <option key={paymentType.value} value={paymentType.value}>
                                            CSV: {paymentType.label}
                                        </option>
                                    ))}
                                </select>
                                <Button variant="outline" onClick={exportDailyCsv} disabled={transactions.length === 0}>
                                    <Download className="h-4 w-4" aria-hidden="true" /> CSV
                                </Button>
                            </div>
                        </div>

                        <DailySummary
                            meterTotal={meterTotal}
                            transactionTotal={transactionTotal}
                            meterDiff={meterDiff}
                            transactions={transactions}
                            detailed
                        />

                        <div>
                            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                <div>
                                    <h3 className="font-bold">รายการของวันที่เลือก</h3>
                                    <p className="text-sm text-[var(--ui-text-muted)]">{transactions.length.toLocaleString('th-TH')} รายการ</p>
                                </div>
                            </div>
                            {transactions.length === 0 ? (
                                <EmptyState compact icon={Wrench} title="ไม่มีรายการขายในวันที่เลือก" description="ยังตรวจมิเตอร์ รายงาน และ Audit Log ได้" />
                            ) : (
                                <div className="space-y-3">
                                    {transactions.map((transaction) => (
                                        <TransactionCard
                                            key={transaction.id}
                                            stationId={String(context.station.number)}
                                            transaction={transaction}
                                            onEdit={() => setEditingTransaction(transaction)}
                                            onDelete={() => void load()}
                                            onUpdated={() => void load()}
                                            showActions
                                            isLocked={false}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>

                        <AuditTrail stationId={String(context.station.number)} date={selectedDate} />
                    </>
                )}
            </div>

            {editingTransaction && (
                <EditTransactionModal
                    stationId={String(context.station.number)}
                    transaction={editingTransaction}
                    onClose={() => setEditingTransaction(null)}
                    onSuccess={() => {
                        setEditingTransaction(null);
                        showToast('success', 'บันทึกการแก้ไขรายการแล้ว');
                        void load();
                    }}
                />
            )}

            {showRefillModal && dailyRecord && canCreateAgainstOpenShift && (
                <RefillModal
                    stationId={String(context.station.number)}
                    date={selectedDate}
                    retailPrice={dailyRecord.retailPrice}
                    wholesalePrice={dailyRecord.wholesalePrice}
                    defaultPaymentType="CREDIT"
                    defaultNozzle={1}
                    onClose={() => setShowRefillModal(false)}
                    onSuccess={() => {
                        setShowRefillModal(false);
                        showToast('success', 'เพิ่มรายการในกะ OPEN แล้ว');
                        void load();
                    }}
                />
            )}
        </Section>
    );
}
