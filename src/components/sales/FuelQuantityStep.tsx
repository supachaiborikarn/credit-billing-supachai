'use client';

import * as React from 'react';
import { Droplets, Fuel, Gauge } from 'lucide-react';
import { Input, Notice, Section } from '@/components/ui';
import type {
    SaleFlowCapabilities,
    SaleFlowFuelSelection,
    SaleFlowPaymentType,
} from '@/lib/sales/sale-flow';
import type { SaleFlowFieldErrors } from '@/lib/sales/sale-validation';
import { cn } from '@/lib/utils';
import { formatCurrency, formatNumber } from '@/utils/formatters';

export interface SaleFlowPriceContext {
    retailPrice?: number | null;
    wholesalePrice?: number | null;
    gasPrice?: number | null;
}

export interface FuelQuantityStepProps {
    value: SaleFlowFuelSelection;
    onChange: (value: SaleFlowFuelSelection) => void;
    capabilities: SaleFlowCapabilities;
    paymentType: SaleFlowPaymentType;
    prices: SaleFlowPriceContext;
    errors?: SaleFlowFieldErrors;
    disabled?: boolean;
}

const FULL_NOZZLES = [1, 2, 3, 4] as const;

function toPositiveNumber(raw: string): number | null {
    if (!raw.trim()) return null;
    const parsed = Number.parseFloat(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function roundGasQuantity(value: number): number {
    return Number(value.toFixed(5));
}

function getSuggestedPrice(
    capabilities: SaleFlowCapabilities,
    paymentType: SaleFlowPaymentType,
    prices: SaleFlowPriceContext
): number | null {
    if (capabilities.priceSource === 'GAS_DAILY_PRICE') {
        return prices.gasPrice && prices.gasPrice > 0 ? prices.gasPrice : null;
    }

    const useRetailPrice = paymentType === 'CASH' || paymentType === 'CREDIT';
    const candidate = useRetailPrice ? prices.retailPrice : prices.wholesalePrice;
    return candidate && candidate > 0 ? candidate : null;
}

function getPriceSourceLabel(
    capabilities: SaleFlowCapabilities,
    paymentType: SaleFlowPaymentType
): string {
    if (capabilities.priceSource === 'GAS_DAILY_PRICE') return 'ราคาก๊าซประจำวัน';
    return paymentType === 'CASH' || paymentType === 'CREDIT'
        ? 'ราคาขายปลีกประจำวัน'
        : 'ราคาขายส่งประจำวัน';
}

export function FuelQuantityStep({
    value,
    onChange,
    capabilities,
    paymentType,
    prices,
    errors,
    disabled = false,
}: FuelQuantityStepProps) {
    const suggestedPrice = getSuggestedPrice(capabilities, paymentType, prices);
    const priceSourceLabel = getPriceSourceLabel(capabilities, paymentType);
    const priceKey = `${paymentType}:${suggestedPrice ?? 'none'}`;
    const previousPriceKeyRef = React.useRef(priceKey);
    const nozzleErrorId = React.useId();

    React.useEffect(() => {
        if (previousPriceKeyRef.current === priceKey) return;
        previousPriceKeyRef.current = priceKey;
        if (!suggestedPrice) return;

        if (capabilities.entryMode === 'AMOUNT') {
            const nextLiters = value.amount && value.amount > 0
                ? roundGasQuantity(value.amount / suggestedPrice)
                : null;
            onChange({
                ...value,
                productType: 'LPG',
                nozzleNumber: null,
                pricePerLiter: suggestedPrice,
                liters: nextLiters,
            });
            return;
        }

        const nextAmount = value.liters && value.liters > 0
            ? value.liters * suggestedPrice
            : null;
        onChange({
            ...value,
            productType: 'DIESEL',
            pricePerLiter: suggestedPrice,
            amount: nextAmount,
        });
    }, [capabilities.entryMode, onChange, priceKey, suggestedPrice, value]);

    const effectivePrice = value.pricePerLiter && value.pricePerLiter > 0
        ? value.pricePerLiter
        : suggestedPrice;

    const updateNozzle = (nozzleNumber: number) => {
        onChange({
            ...value,
            productType: 'DIESEL',
            nozzleNumber,
        });
    };

    const updateLiters = (raw: string) => {
        const liters = toPositiveNumber(raw);
        const pricePerLiter = effectivePrice;
        onChange({
            ...value,
            productType: 'DIESEL',
            liters,
            pricePerLiter,
            amount: liters && pricePerLiter ? liters * pricePerLiter : null,
        });
    };

    const updateFullPrice = (raw: string) => {
        const pricePerLiter = toPositiveNumber(raw);
        onChange({
            ...value,
            productType: 'DIESEL',
            pricePerLiter,
            amount: value.liters && pricePerLiter ? value.liters * pricePerLiter : null,
        });
    };

    const updateGasAmount = (raw: string) => {
        const amount = toPositiveNumber(raw);
        const gasPrice = suggestedPrice;
        onChange({
            ...value,
            productType: 'LPG',
            nozzleNumber: null,
            amount,
            pricePerLiter: gasPrice,
            liters: amount && gasPrice ? roundGasQuantity(amount / gasPrice) : null,
        });
    };

    const isGas = capabilities.entryMode === 'AMOUNT';
    const productLabel = isGas ? 'LPG' : 'ดีเซล';
    const productDescription = isGas
        ? 'ยอดขายหลักของปั๊มแก๊ส — สินค้าเสริมแยกไปทำใน stock flow'
        : 'น้ำมันหลักของแท๊งลอย — ไม่รวมสินค้าเสริม';

    return (
        <Section
            title="สินค้าและจำนวน"
            description={isGas
                ? 'กรอกยอดเงิน ระบบแสดงลิตรจากราคาก๊าซประจำวัน'
                : 'เลือกหัวจ่าย แล้วกรอกจำนวนลิตรและราคาต่อลิตร'}
        >
            <div className="space-y-4">
                <div className="flex items-center gap-3 rounded-[var(--ui-radius-md)] border border-[var(--ui-border)] bg-[var(--ui-surface-subtle)] p-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--ui-radius-md)] bg-[var(--ui-surface)]">
                        <Fuel className="h-5 w-5 text-[var(--ui-primary-text)]" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="font-bold">{productLabel}</div>
                        <div className="mt-0.5 text-xs text-[var(--ui-text-muted)]">{productDescription}</div>
                    </div>
                    <span className="rounded-full bg-[var(--ui-surface)] px-2.5 py-1 text-xs font-semibold text-[var(--ui-text-muted)]">
                        สินค้าหลัก
                    </span>
                </div>

                {capabilities.requiresNozzle && (
                    <fieldset aria-describedby={errors?.nozzle ? nozzleErrorId : undefined}>
                        <legend className="mb-2 text-sm font-semibold">หัวจ่าย</legend>
                        <div className="grid grid-cols-4 gap-2">
                            {FULL_NOZZLES.map((nozzle) => {
                                const selected = value.nozzleNumber === nozzle;
                                return (
                                    <button
                                        key={nozzle}
                                        type="button"
                                        aria-pressed={selected}
                                        data-sale-invalid={errors?.nozzle ? 'true' : undefined}
                                        onClick={() => updateNozzle(nozzle)}
                                        disabled={disabled}
                                        className={cn(
                                            'min-h-[var(--ui-touch-target)] rounded-[var(--ui-radius-md)] border px-3 py-2 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:shadow-[var(--ui-shadow-focus)] disabled:opacity-50',
                                            selected
                                                ? 'border-[var(--ui-primary-500)] bg-[var(--ui-primary-50)] text-[var(--ui-primary-700)]'
                                                : 'border-[var(--ui-border)] bg-[var(--ui-surface)] hover:bg-[var(--ui-surface-subtle)]'
                                        )}
                                    >
                                        หัว {nozzle}
                                    </button>
                                );
                            })}
                        </div>
                        {errors?.nozzle && (
                            <div id={nozzleErrorId} className="mt-2 text-sm font-medium text-[var(--ui-danger-text)]" role="alert">
                                {errors.nozzle}
                            </div>
                        )}
                    </fieldset>
                )}

                {!suggestedPrice && (
                    <Notice
                        tone={isGas ? 'danger' : 'warning'}
                        title={isGas ? 'ยังไม่พบราคาก๊าซประจำวัน' : 'ยังไม่มีราคาแนะนำจากข้อมูลประจำวัน'}
                    >
                        {isGas
                            ? 'ต้องโหลดราคาก๊าซประจำวันให้สำเร็จก่อนจึงจะคำนวณลิตรได้'
                            : 'ยังกรอกราคาต่อลิตรเองได้ แต่ควรตรวจราคาให้ตรงกับข้อมูลประจำวันก่อนบันทึก'}
                    </Notice>
                )}

                {isGas ? (
                    <>
                        <Input
                            label="ยอดเงินที่ขาย (บาท)"
                            type="number"
                            inputMode="decimal"
                            min="0"
                            step="0.01"
                            value={value.amount ?? ''}
                            onChange={(event) => updateGasAmount(event.target.value)}
                            disabled={disabled || !suggestedPrice}
                            placeholder="0.00"
                            requiredMark
                            leftIcon={<Gauge className="h-4 w-4" aria-hidden="true" />}
                            error={errors?.amount}
                            helperText={suggestedPrice
                                ? `${priceSourceLabel} ฿${formatCurrency(suggestedPrice)}/ลิตร`
                                : 'รอราคาก๊าซประจำวัน'}
                        />

                        <div className="rounded-[var(--ui-radius-md)] border border-[var(--ui-primary-200)] bg-[var(--ui-primary-50)] p-4 text-center">
                            <div className="text-xs font-semibold text-[var(--ui-primary-700)]">ลิตรที่คำนวณได้</div>
                            <div className="mt-1 text-3xl font-bold tabular-nums text-[var(--ui-primary-700)]">
                                {value.liters ? `${formatNumber(value.liters, { decimals: 5 })} ลิตร` : '—'}
                            </div>
                            {value.amount && suggestedPrice && (
                                <div className="mt-1 text-xs text-[var(--ui-text-muted)]">
                                    ฿{formatCurrency(value.amount)} ÷ ฿{formatCurrency(suggestedPrice)}/ลิตร
                                </div>
                            )}
                        </div>

                        {errors?.liters && (
                            <Notice tone="danger">{errors.liters}</Notice>
                        )}

                        <Notice tone="info" title="Backend จะตรวจราคาและคำนวณลิตรซ้ำตอนบันทึก">
                            ค่าลิตรบนหน้าจอใช้เพื่อให้ตรวจรายการก่อนบันทึก ส่วนข้อมูลจริงยึดราคาประจำวันของกะที่เปิดอยู่
                        </Notice>
                    </>
                ) : (
                    <>
                        <Input
                            label="จำนวนลิตร"
                            type="number"
                            inputMode="decimal"
                            min="0"
                            step="0.001"
                            value={value.liters ?? ''}
                            onChange={(event) => updateLiters(event.target.value)}
                            disabled={disabled}
                            placeholder="0"
                            requiredMark
                            leftIcon={<Droplets className="h-4 w-4" aria-hidden="true" />}
                            error={errors?.liters}
                        />

                        <Input
                            label="ราคาต่อลิตร (บาท)"
                            type="number"
                            inputMode="decimal"
                            min="0"
                            step="0.01"
                            value={effectivePrice ?? ''}
                            onChange={(event) => updateFullPrice(event.target.value)}
                            disabled={disabled}
                            placeholder="0.00"
                            requiredMark
                            error={errors?.pricePerLiter}
                            helperText={`${priceSourceLabel}${suggestedPrice ? ` ฿${formatCurrency(suggestedPrice)}/ลิตร` : ''} — แก้ราคาได้เหมือนระบบเดิม`}
                        />

                        <div className="rounded-[var(--ui-radius-md)] border border-[var(--ui-success)]/20 bg-[var(--ui-success-soft)] p-4">
                            <div className="flex items-end justify-between gap-4">
                                <div>
                                    <div className="text-sm font-semibold text-[var(--ui-text-muted)]">ยอดรวม</div>
                                    {value.liters && effectivePrice && (
                                        <div className="mt-1 text-xs text-[var(--ui-text-muted)]">
                                            {formatNumber(value.liters, { decimals: 3 })} ลิตร × ฿{formatCurrency(effectivePrice)}
                                        </div>
                                    )}
                                </div>
                                <div className="text-right text-3xl font-bold tabular-nums text-[var(--ui-success-text)]">
                                    {value.amount ? `฿${formatCurrency(value.amount)}` : '—'}
                                </div>
                            </div>
                        </div>
                        {errors?.amount && (
                            <Notice tone="danger">{errors.amount}</Notice>
                        )}
                    </>
                )}
            </div>
        </Section>
    );
}
