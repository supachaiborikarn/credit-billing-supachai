'use client';

import * as React from 'react';
import Link from 'next/link';
import { AlertTriangle, Camera, Fuel, Gauge, RefreshCw, Scale } from 'lucide-react';
import { useToast } from '@/components/Toast';
import { Badge, Button, ConfirmDialog, Input, Notice, Section } from '@/components/ui';
import {
    calculateFullClosingPreview,
    calculateGasClosingPreview,
    closeFullStationShift,
    closeGasStationShift,
    parseClosingNumber,
    previewClosingAnomalies,
    saveFullClosingMeters,
    saveGasClosingReadings,
    validateClosingProducts,
    validateFullClosingMeters,
    validateGasClosingReadings,
    type ClosingAnomalyPreview,
    type ClosingGaugeInput,
    type ClosingMeterInput,
    type ClosingProductInput,
    type FullClosingCashInput,
    type GasClosingMoneyInput,
} from '@/lib/stations/shift-closing';
import type { StationContextPayload } from '@/types/station';

type FullShiftEndPayload = {
    meters?: Array<{
        shiftId: string;
        nozzleNumber: number;
        startReading: number | string;
        endReading: number | string | null;
        endPhoto?: string | null;
    }>;
    transactions?: Array<{ paymentType: string; amount: number | string }>;
    fuelConfig?: Array<{ nozzle: number; name: string; price: number }>;
};

type GasSummaryPayload = {
    shift?: {
        id: string;
        status: string;
        gasPrice: number;
        meters: Array<{ nozzleNumber: number; startReading: number | null; endReading: number | null }>;
        gauge: {
            end: Array<{ tankNumber: number; percentage: number }>;
        };
        sales?: { cash?: number; credit?: number; card?: number; transfer?: number };
    };
};

type GasProductPayload = Array<{
    productId: string;
    product: { name: string; salePrice: number };
    quantity: number;
}>;

type ExpectedPayments = { cash: number; credit: number; card: number; transfer: number };

const EMPTY_FULL_CASH: FullClosingCashInput = {
    cashReceived: '',
    creditExpected: 0,
    cardReceived: '',
    transferReceived: '',
    expenses: '',
    expenseNote: '',
    discounts: '',
    discountNote: '',
};

const EMPTY_GAS_MONEY: GasClosingMoneyInput = {
    cashReceived: '',
    creditReceived: '',
    cardReceived: '',
    transferReceived: '',
    productTransferAmount: '',
    otherIncomeAmount: '',
    otherIncomeNote: '',
    otherExpensesAmount: '',
    otherExpenseNote: '',
    varianceNote: '',
};

function formatAmount(value: number) {
    return new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0);
}

function sumPayments(transactions: FullShiftEndPayload['transactions'] = []): ExpectedPayments {
    const result: ExpectedPayments = { cash: 0, credit: 0, card: 0, transfer: 0 };
    for (const transaction of transactions || []) {
        const value = Number(transaction.amount) || 0;
        if (transaction.paymentType === 'CASH') result.cash += value;
        else if (['CREDIT', 'BOX_TRUCK', 'OIL_TRUCK_SUPACHAI'].includes(transaction.paymentType)) result.credit += value;
        else if (transaction.paymentType === 'CREDIT_CARD') result.card += value;
        else if (transaction.paymentType === 'TRANSFER') result.transfer += value;
    }
    return result;
}

function hasInvalidMoney(values: string[]) {
    return values.some((value) => {
        if (!value.trim()) return false;
        const parsed = parseClosingNumber(value);
        return parsed === null || parsed < 0;
    });
}

const textareaClass = 'min-h-24 w-full rounded-[var(--ui-radius-md)] border border-[var(--ui-border-strong)] bg-[var(--ui-surface)] px-3 py-2 text-base text-[var(--ui-text)] outline-none focus:border-[var(--ui-primary-500)] focus:shadow-[var(--ui-shadow-focus)]';

export function ShiftClosingFlow({ context, onRefresh }: { context: StationContextPayload; onRefresh: () => Promise<void> }) {
    const { showToast } = useToast();
    const [loading, setLoading] = React.useState(true);
    const [busy, setBusy] = React.useState(false);
    const [errors, setErrors] = React.useState<string[]>([]);
    const errorRegionRef = React.useRef<HTMLDivElement>(null);
    const [confirmOpen, setConfirmOpen] = React.useState(false);
    const [anomalies, setAnomalies] = React.useState<ClosingAnomalyPreview | null>(null);
    const [anomalyNote, setAnomalyNote] = React.useState('');
    const [meters, setMeters] = React.useState<ClosingMeterInput[]>([]);
    const [gauges, setGauges] = React.useState<ClosingGaugeInput[]>([]);
    const [products, setProducts] = React.useState<ClosingProductInput[]>([]);
    const [fullCash, setFullCash] = React.useState<FullClosingCashInput>(EMPTY_FULL_CASH);
    const [fullExpected, setFullExpected] = React.useState<ExpectedPayments>({ cash: 0, credit: 0, card: 0, transfer: 0 });
    const [gasMoney, setGasMoney] = React.useState<GasClosingMoneyInput>(EMPTY_GAS_MONEY);
    const [gasPrice, setGasPrice] = React.useState(context.saleContext?.gasPrice || 0);

    const shift = context.currentShift;

    const load = React.useCallback(async () => {
        if (!shift || shift.status !== 'OPEN') return;
        setLoading(true);
        setErrors([]);
        try {
            if (context.station.type === 'FULL') {
                const response = await fetch(`/api/station/${context.station.number}/shift-end?date=${shift.businessDate}`, { cache: 'no-store' });
                const payload = await response.json().catch(() => null) as FullShiftEndPayload & { error?: string } | null;
                if (!response.ok) throw new Error(payload?.error || 'โหลดข้อมูลปิดกะไม่สำเร็จ');
                const fuelByNozzle = new Map((payload?.fuelConfig || []).map((fuel) => [fuel.nozzle, fuel]));
                const shiftMeters = (payload?.meters || []).filter((meter) => meter.shiftId === shift.id);
                setMeters([1, 2, 3, 4].map((number) => {
                    const meter = shiftMeters.find((item) => item.nozzleNumber === number);
                    return {
                        number,
                        startReading: Number(meter?.startReading || 0),
                        value: meter?.endReading == null ? '' : String(meter.endReading),
                        price: Number(fuelByNozzle.get(number)?.price || 0),
                        file: null,
                        existingPhoto: meter?.endPhoto || null,
                    };
                }));
                const expected = sumPayments(payload?.transactions || []);
                setFullExpected(expected);
                setFullCash({
                    ...EMPTY_FULL_CASH,
                    creditExpected: expected.credit,
                    cardReceived: expected.card ? String(expected.card) : '',
                    transferReceived: expected.transfer ? String(expected.transfer) : '',
                });
            } else {
                const response = await fetch(`/api/v2/gas/${context.station.number}/summary?detailed=true`, { cache: 'no-store' });
                const payload = await response.json().catch(() => null) as GasSummaryPayload & { error?: string } | null;
                if (!response.ok) throw new Error(payload?.error || 'โหลดข้อมูลปิดกะ GAS ไม่สำเร็จ');
                if (!payload?.shift || payload.shift.id !== shift.id || payload.shift.status !== 'OPEN') {
                    throw new Error('กะปัจจุบันเปลี่ยนไปแล้ว กรุณา Refresh');
                }
                setGasPrice(Number(payload.shift.gasPrice || context.saleContext?.gasPrice || 0));
                setMeters([1, 2, 3, 4].map((number) => {
                    const meter = payload.shift!.meters.find((item) => item.nozzleNumber === number);
                    return {
                        number,
                        startReading: Number(meter?.startReading || 0),
                        value: meter?.endReading == null ? '' : String(meter.endReading),
                    };
                }));
                setGauges([1, 2, 3].map((number) => {
                    const gauge = payload.shift!.gauge?.end?.find((item) => item.tankNumber === number);
                    return { number, value: gauge ? String(gauge.percentage) : '' };
                }));
                const sales = payload.shift.sales || {};
                setGasMoney({
                    ...EMPTY_GAS_MONEY,
                    cashReceived: sales.cash ? String(sales.cash) : '',
                    creditReceived: sales.credit ? String(sales.credit) : '',
                    cardReceived: sales.card ? String(sales.card) : '',
                    transferReceived: sales.transfer ? String(sales.transfer) : '',
                });

                if (context.station.hasProducts) {
                    const productResponse = await fetch(`/api/gas-station/${context.station.number}/products`, { cache: 'no-store' });
                    if (productResponse.ok) {
                        const rows = await productResponse.json() as GasProductPayload;
                        setProducts(rows.map((row) => ({
                            productId: row.productId,
                            name: row.product.name,
                            salePrice: Number(row.product.salePrice),
                            openingQty: row.quantity,
                            received: '',
                            closingQty: String(row.quantity),
                        })));
                    }
                } else {
                    setProducts([]);
                }
            }
        } catch (error) {
            setErrors([error instanceof Error ? error.message : 'โหลดข้อมูลปิดกะไม่สำเร็จ']);
        } finally {
            setLoading(false);
        }
    }, [context.saleContext?.gasPrice, context.station.hasProducts, context.station.number, context.station.type, shift]);

    React.useEffect(() => { void load(); }, [load]);

    React.useEffect(() => {
        if (errors.length === 0) return;
        const timer = window.setTimeout(() => errorRegionRef.current?.focus(), 0);
        return () => window.clearTimeout(timer);
    }, [errors.length]);

    if (!shift || shift.status !== 'OPEN' || context.openingState.status !== 'READY') {
        return <Notice tone="info" title="ยังไม่พร้อมปิดกะ">ต้องมีกะ OPEN และข้อมูลต้นกะครบก่อน</Notice>;
    }

    const fullPreview = context.station.type === 'FULL'
        ? calculateFullClosingPreview(meters, fullCash)
        : null;
    const gasPreview = context.station.type === 'GAS'
        ? calculateGasClosingPreview({ meters, gasPrice, products, money: gasMoney })
        : null;
    const preview = fullPreview || gasPreview;
    const uiVariance = preview ? preview.totalReceived - preview.totalExpected : 0;

    const prepareClose = async () => {
        setErrors([]);
        setAnomalies(null);
        const readingValidation = context.station.type === 'FULL'
            ? validateFullClosingMeters(meters)
            : validateGasClosingReadings(meters, gauges);
        const nextErrors = [...readingValidation.errors];

        if (context.station.type === 'FULL') {
            if (hasInvalidMoney([fullCash.cashReceived, fullCash.cardReceived, fullCash.transferReceived, fullCash.expenses, fullCash.discounts])) {
                nextErrors.push('ยอดรับจริง ค่าใช้จ่าย และส่วนลดต้องเป็นตัวเลขไม่ติดลบ');
            }
        } else {
            const productValidation = validateClosingProducts(products);
            nextErrors.push(...productValidation.errors);
            if (hasInvalidMoney([
                gasMoney.cashReceived, gasMoney.creditReceived, gasMoney.cardReceived, gasMoney.transferReceived,
                gasMoney.productTransferAmount, gasMoney.otherIncomeAmount, gasMoney.otherExpensesAmount,
            ])) {
                nextErrors.push('ยอดเงินกระทบยอดต้องเป็นตัวเลขไม่ติดลบ');
            }
            if (gasPreview && (parseClosingNumber(gasMoney.productTransferAmount) || 0) > gasPreview.productSalesAmount) {
                nextErrors.push('ยอดสินค้าที่รับโอน/สแกนต้องไม่เกินยอดขายสินค้ารวม');
            }
            if (gasPreview?.varianceStatus === 'RED' && !gasMoney.varianceNote.trim()) {
                nextErrors.push('ยอดต่างเกิน 500 บาท กรุณาระบุเหตุผลก่อนปิดกะ');
            }
        }

        if (nextErrors.length > 0) {
            setErrors(Array.from(new Set(nextErrors)));
            return;
        }

        setBusy(true);
        try {
            const anomalyPreview = await previewClosingAnomalies({ stationNumber: context.station.number, shiftId: shift.id, meters });
            setAnomalies(anomalyPreview);
            const closingNote = context.station.type === 'GAS' ? gasMoney.varianceNote : anomalyNote;
            if (anomalyPreview.requiresNote && !closingNote.trim()) {
                setErrors(['พบความผิดปกติรุนแรงของมิเตอร์ กรุณาระบุเหตุผลก่อนปิดกะ']);
                return;
            }
            setConfirmOpen(true);
        } catch (error) {
            setErrors([error instanceof Error ? error.message : 'ตรวจความผิดปกติไม่สำเร็จ']);
        } finally {
            setBusy(false);
        }
    };

    const confirmClose = async () => {
        setBusy(true);
        setErrors([]);
        try {
            if (context.station.type === 'FULL') {
                await saveFullClosingMeters({
                    stationId: context.station.id,
                    stationNumber: context.station.number,
                    shiftId: shift.id,
                    businessDate: shift.businessDate,
                    meters,
                });
                await closeFullStationShift({ stationNumber: context.station.number, shiftId: shift.id, meters, cash: fullCash, anomalyNote });
            } else {
                await saveGasClosingReadings({ stationNumber: context.station.number, shiftId: shift.id, meters, gauges });
                await closeGasStationShift({ stationNumber: context.station.number, shiftId: shift.id, products, money: gasMoney });
            }
            showToast('success', `ปิดกะ ${shift.shiftNumber} เรียบร้อย`);
            await onRefresh();
        } catch (error) {
            const message = error instanceof Error ? error.message : 'ปิดกะไม่สำเร็จ';
            setErrors([message]);
            showToast('error', message);
        } finally {
            setBusy(false);
        }
    };

    if (loading) {
        return <div role="status" aria-label="กำลังโหลดข้อมูลปิดกะ" className="h-64 animate-pulse rounded-[var(--ui-radius-lg)] bg-[var(--ui-surface-subtle)]" />;
    }

    return (
        <div className="space-y-4">
            <Section title={`กะ ${shift.shiftNumber} กำลังทำงาน`} description={`${shift.businessDate} · ${shift.staffName || 'ไม่ระบุพนักงาน'}`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <Badge variant="success">OPEN · พร้อมขาย</Badge>
                    <Link href={context.paths.sales} className="inline-flex h-[var(--ui-control-md)] items-center justify-center gap-2 rounded-[var(--ui-radius-md)] bg-[var(--ui-primary-700)] px-4 text-sm font-semibold text-white hover:bg-[var(--ui-primary-800)] focus-visible:outline-none focus-visible:shadow-[var(--ui-shadow-focus)]">
                        <Fuel className="h-4 w-4" aria-hidden="true" /> กลับไปขาย
                    </Link>
                </div>
            </Section>

            {errors.length > 0 && (
                <div ref={errorRegionRef} tabIndex={-1} className="focus:outline-none">
                    <Notice tone="danger" title="ยังปิดกะไม่ได้" action={<Button variant="outline" size="sm" onClick={() => void load()}><RefreshCw className="h-4 w-4" aria-hidden="true" />โหลดใหม่</Button>}>
                        <ul className="list-disc space-y-1 pl-5">{errors.map((error) => <li key={error}>{error}</li>)}</ul>
                    </Notice>
                </div>
            )}

            <Section title="1. ข้อมูลสิ้นกะ" description={context.station.type === 'FULL' ? 'มิเตอร์ปิด 4 หัว + รูปหลักฐานครบทุกหัว' : 'มิเตอร์ปิด 4 หัว + เกจปิด 3 ถัง'}>
                <div className="grid gap-3 sm:grid-cols-2">
                    {meters.map((meter, index) => (
                        <div key={meter.number} className="rounded-[var(--ui-radius-md)] border border-[var(--ui-border)] p-3">
                            <div className="mb-2 text-xs text-[var(--ui-text-muted)]">หัว {meter.number} · เปิด {meter.startReading.toLocaleString('th-TH')}</div>
                            <Input
                                label="มิเตอร์ปิด"
                                inputMode="decimal"
                                value={meter.value}
                                onChange={(event) => setMeters((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, value: event.target.value } : item))}
                                disabled={busy}
                                required
                            />
                            {context.station.type === 'FULL' && (
                                <label className="mt-3 flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-[var(--ui-radius-md)] border border-dashed border-[var(--ui-border-strong)] px-3 py-2 text-sm font-semibold text-[var(--ui-text-secondary)] hover:bg-[var(--ui-surface-subtle)] focus-within:shadow-[var(--ui-shadow-focus)]">
                                    <Camera className="h-4 w-4" aria-hidden="true" />
                                    {meter.file ? meter.file.name : meter.existingPhoto ? 'มีรูปเดิมแล้ว · เปลี่ยนรูป' : 'แนบรูปมิเตอร์ปิด'}
                                    <input type="file" accept="image/*" className="sr-only" disabled={busy} onChange={(event) => {
                                        const file = event.target.files?.[0] || null;
                                        setMeters((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, file } : item));
                                    }} />
                                </label>
                            )}
                        </div>
                    ))}
                </div>
                {context.station.type === 'GAS' && (
                    <div className="mt-4">
                        <div className="mb-2 flex items-center gap-2 font-semibold"><Gauge className="h-4 w-4" aria-hidden="true" />เกจปิดกะ (%)</div>
                        <div className="grid gap-3 sm:grid-cols-3">
                            {gauges.map((gauge, index) => (
                                <Input key={gauge.number} label={`ถัง ${gauge.number}`} inputMode="decimal" value={gauge.value} disabled={busy} required onChange={(event) => setGauges((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, value: event.target.value } : item))} />
                            ))}
                        </div>
                    </div>
                )}
            </Section>

            {context.station.type === 'GAS' && products.length > 0 && (
                <Section title="นับสินค้าเสริม" description="ยกมา + รับเข้า - คงเหลือ = จำนวนขาย ระบบคำนวณยอดขายจากราคาสินค้า">
                    <div className="space-y-3">
                        {products.map((product, index) => (
                            <div key={product.productId} className="grid gap-3 rounded-[var(--ui-radius-md)] border border-[var(--ui-border)] p-3 sm:grid-cols-[1fr_140px_140px] sm:items-end">
                                <div><div className="font-semibold">{product.name}</div><div className="text-xs text-[var(--ui-text-muted)]">ยกมา {product.openingQty} · ฿{formatAmount(product.salePrice)}</div></div>
                                <Input label="รับเข้า" inputMode="numeric" value={product.received} disabled={busy} onChange={(event) => setProducts((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, received: event.target.value } : item))} />
                                <Input label="คงเหลือจริง" inputMode="numeric" value={product.closingQty} disabled={busy} onChange={(event) => setProducts((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, closingQty: event.target.value } : item))} />
                            </div>
                        ))}
                    </div>
                </Section>
            )}

            <Section title="2. กระทบยอด" description="กรอกยอดรับจริง แล้วเทียบกับยอดที่ควรได้จากมิเตอร์และข้อมูลขาย">
                {context.station.type === 'FULL' ? (
                    <div className="space-y-4">
                        <div className="grid gap-3 sm:grid-cols-4">
                            <div className="rounded-[var(--ui-radius-md)] bg-[var(--ui-surface-subtle)] p-3"><div className="text-xs text-[var(--ui-text-muted)]">เงินสดตามรายการ</div><div className="font-bold">฿{formatAmount(fullExpected.cash)}</div></div>
                            <div className="rounded-[var(--ui-radius-md)] bg-[var(--ui-surface-subtle)] p-3"><div className="text-xs text-[var(--ui-text-muted)]">เชื่อ</div><div className="font-bold">฿{formatAmount(fullExpected.credit)}</div></div>
                            <div className="rounded-[var(--ui-radius-md)] bg-[var(--ui-surface-subtle)] p-3"><div className="text-xs text-[var(--ui-text-muted)]">บัตรตามรายการ</div><div className="font-bold">฿{formatAmount(fullExpected.card)}</div></div>
                            <div className="rounded-[var(--ui-radius-md)] bg-[var(--ui-surface-subtle)] p-3"><div className="text-xs text-[var(--ui-text-muted)]">โอนตามรายการ</div><div className="font-bold">฿{formatAmount(fullExpected.transfer)}</div></div>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-3">
                            <Input label="เงินสดรับจริง" inputMode="decimal" value={fullCash.cashReceived} onChange={(event) => setFullCash((current) => ({ ...current, cashReceived: event.target.value }))} />
                            <Input label="บัตรรับจริง" inputMode="decimal" value={fullCash.cardReceived} onChange={(event) => setFullCash((current) => ({ ...current, cardReceived: event.target.value }))} />
                            <Input label="โอนรับจริง" inputMode="decimal" value={fullCash.transferReceived} onChange={(event) => setFullCash((current) => ({ ...current, transferReceived: event.target.value }))} />
                            <Input label="ค่าใช้จ่าย" inputMode="decimal" value={fullCash.expenses} onChange={(event) => setFullCash((current) => ({ ...current, expenses: event.target.value }))} />
                            <Input label="ส่วนลด" inputMode="decimal" value={fullCash.discounts} onChange={(event) => setFullCash((current) => ({ ...current, discounts: event.target.value }))} />
                            <Input label="หมายเหตุค่าใช้จ่าย (ถ้ามี)" value={fullCash.expenseNote} onChange={(event) => setFullCash((current) => ({ ...current, expenseNote: event.target.value }))} />
                            <Input label="หมายเหตุส่วนลด (ถ้ามี)" value={fullCash.discountNote} onChange={(event) => setFullCash((current) => ({ ...current, discountNote: event.target.value }))} />
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="grid gap-3 sm:grid-cols-4">
                            <Input label="เงินสดรับจริง" inputMode="decimal" value={gasMoney.cashReceived} onChange={(event) => setGasMoney((current) => ({ ...current, cashReceived: event.target.value }))} />
                            <Input label="เชื่อ" inputMode="decimal" value={gasMoney.creditReceived} onChange={(event) => setGasMoney((current) => ({ ...current, creditReceived: event.target.value }))} />
                            <Input label="บัตร" inputMode="decimal" value={gasMoney.cardReceived} onChange={(event) => setGasMoney((current) => ({ ...current, cardReceived: event.target.value }))} />
                            <Input label="โอน" inputMode="decimal" value={gasMoney.transferReceived} onChange={(event) => setGasMoney((current) => ({ ...current, transferReceived: event.target.value }))} />
                            {products.length > 0 && <Input label="ยอดสินค้ารับโอน/สแกน" inputMode="decimal" value={gasMoney.productTransferAmount} onChange={(event) => setGasMoney((current) => ({ ...current, productTransferAmount: event.target.value }))} />}
                            <Input label="รายรับอื่น" inputMode="decimal" value={gasMoney.otherIncomeAmount} onChange={(event) => setGasMoney((current) => ({ ...current, otherIncomeAmount: event.target.value }))} />
                            <Input label="ค่าใช้จ่ายจากเงินสด" inputMode="decimal" value={gasMoney.otherExpensesAmount} onChange={(event) => setGasMoney((current) => ({ ...current, otherExpensesAmount: event.target.value }))} />
                            <Input label="หมายเหตุรายรับอื่น (ถ้ามี)" value={gasMoney.otherIncomeNote} onChange={(event) => setGasMoney((current) => ({ ...current, otherIncomeNote: event.target.value }))} />
                            <Input label="หมายเหตุค่าใช้จ่าย (ถ้ามี)" value={gasMoney.otherExpenseNote} onChange={(event) => setGasMoney((current) => ({ ...current, otherExpenseNote: event.target.value }))} />
                        </div>
                    </div>
                )}
            </Section>

            {anomalies?.hasAnomalies && (
                <Notice tone={anomalies.requiresNote ? 'danger' : 'warning'} title={`พบมิเตอร์ผิดปกติ ${anomalies.anomalies.length} รายการ`}>
                    <ul className="list-disc space-y-1 pl-5">{anomalies.anomalies.map((anomaly) => <li key={anomaly.nozzleNumber}>หัว {anomaly.nozzleNumber}: {anomaly.message}</li>)}</ul>
                </Notice>
            )}

            <Section title="3. ตรวจและปิดกะ" description="ตัวเลขนี้เป็น preview; backend จะคำนวณและบันทึก reconciliation อีกครั้งตอนปิดจริง">
                {preview && (
                    <div className="space-y-4">
                        <div className="grid gap-3 sm:grid-cols-4">
                            <div className="rounded-[var(--ui-radius-md)] bg-[var(--ui-surface-subtle)] p-3"><div className="text-xs text-[var(--ui-text-muted)]">ขายจากมิเตอร์</div><div className="font-bold">{preview.totalLiters.toLocaleString('th-TH', { maximumFractionDigits: 3 })} L</div></div>
                            <div className="rounded-[var(--ui-radius-md)] bg-[var(--ui-surface-subtle)] p-3"><div className="text-xs text-[var(--ui-text-muted)]">ควรได้</div><div className="font-bold">฿{formatAmount(preview.totalExpected)}</div></div>
                            <div className="rounded-[var(--ui-radius-md)] bg-[var(--ui-surface-subtle)] p-3"><div className="text-xs text-[var(--ui-text-muted)]">รับจริง</div><div className="font-bold">฿{formatAmount(preview.totalReceived)}</div></div>
                            <div className="rounded-[var(--ui-radius-md)] bg-[var(--ui-surface-subtle)] p-3"><div className="text-xs text-[var(--ui-text-muted)]">ผลต่าง (รับจริง - ควรได้)</div><div className="flex items-center gap-2 font-bold"><Badge variant={preview.varianceStatus === 'GREEN' ? 'success' : preview.varianceStatus === 'YELLOW' ? 'warning' : 'error'}>{preview.varianceStatus}</Badge>{uiVariance >= 0 ? '+' : ''}฿{formatAmount(uiVariance)}</div></div>
                        </div>
                        <div>
                            <label htmlFor="closing-variance-note" className="mb-1.5 block text-sm font-semibold">หมายเหตุความผิดปกติ / ยอดต่าง</label>
                            <textarea id="closing-variance-note" className={textareaClass} value={context.station.type === 'GAS' ? gasMoney.varianceNote : anomalyNote} onChange={(event) => context.station.type === 'GAS' ? setGasMoney((current) => ({ ...current, varianceNote: event.target.value })) : setAnomalyNote(event.target.value)} placeholder="ระบุเหตุผลเมื่อมีข้อมูลผิดปกติหรือยอดต่างมาก" />
                        </div>
                        <Notice tone="info" title="ก่อนปิดกะ">
                            ระบบจะตรวจ anomaly จากมิเตอร์ก่อน จากนั้นบันทึก meter/gauge สิ้นกะ แล้วจึงเรียก close API เพื่อสร้าง reconciliation และปิดกะ
                        </Notice>
                        <Button size="lg" variant={preview.varianceStatus === 'RED' ? 'warning' : 'default'} loading={busy} className="w-full sm:w-auto" onClick={() => void prepareClose()}>
                            <Scale className="h-5 w-5" aria-hidden="true" /> ตรวจและยืนยันปิดกะ
                        </Button>
                    </div>
                )}
            </Section>

            <ConfirmDialog
                open={confirmOpen}
                onOpenChange={setConfirmOpen}
                title={`ยืนยันปิดกะ ${shift.shiftNumber}`}
                description="หลังยืนยัน กะจะถูกปิดและ reconciliation จะถูกบันทึกเป็นหลักฐานของกะ"
                confirmLabel="ปิดกะ"
                tone={preview?.varianceStatus === 'RED' ? 'danger' : 'default'}
                onConfirm={confirmClose}
            >
                <div className="space-y-3 text-sm">
                    <div className="flex justify-between gap-3"><span>ควรได้</span><strong>฿{formatAmount(preview?.totalExpected || 0)}</strong></div>
                    <div className="flex justify-between gap-3"><span>รับจริง</span><strong>฿{formatAmount(preview?.totalReceived || 0)}</strong></div>
                    <div className="flex justify-between gap-3"><span>ผลต่าง</span><strong>{uiVariance >= 0 ? '+' : ''}฿{formatAmount(uiVariance)}</strong></div>
                    {anomalies?.hasAnomalies && <div className="flex items-start gap-2 text-[var(--ui-warning-text)]"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />พบ anomaly {anomalies.anomalies.length} รายการ และจะเก็บหมายเหตุร่วมกับการปิดกะ</div>}
                </div>
            </ConfirmDialog>
        </div>
    );
}
