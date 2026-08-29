'use client';

import * as React from 'react';
import Link from 'next/link';
import { Camera, CheckCircle2, Fuel, Gauge, Play, TriangleAlert } from 'lucide-react';
import { useToast } from '@/components/Toast';
import { Button, Input, Notice, Section } from '@/components/ui';
import {
    completeFullOpeningMeters,
    openFullStationShift,
    openGasStationShift,
    type FullOpeningMeterInput,
    type GasOpeningInput,
} from '@/lib/stations/shift-opening';
import type { StationContextPayload, StationOpeningMeterEvidence } from '@/types/station';

function createFullMeters(evidence: StationOpeningMeterEvidence[] = []): FullOpeningMeterInput[] {
    return [1, 2, 3, 4].map((number) => {
        const existing = evidence.find((meter) => meter.nozzleNumber === number);
        return {
            number,
            value: existing ? String(existing.startReading) : '',
            file: null,
            existingPhoto: existing?.startPhoto || null,
        };
    });
}

function createGasReadings(count: number) {
    return Array.from({ length: count }, (_, index) => ({ number: index + 1, value: '' }));
}


export function ShiftOpeningFlow({
    context,
    onRefresh,
}: {
    context: StationContextPayload;
    onRefresh: () => Promise<void>;
}) {
    const { showToast } = useToast();
    const [busy, setBusy] = React.useState(false);
    const [errors, setErrors] = React.useState<string[]>([]);
    const errorRegionRef = React.useRef<HTMLDivElement>(null);
    const [prices, setPrices] = React.useState(() => ({
        retailPrice: context.saleContext?.retailPrice ? String(context.saleContext.retailPrice) : '',
        wholesalePrice: context.saleContext?.wholesalePrice ? String(context.saleContext.wholesalePrice) : '',
    }));
    const [fullMeters, setFullMeters] = React.useState<FullOpeningMeterInput[]>(createFullMeters);
    const [gasValue, setGasValue] = React.useState<GasOpeningInput>(() => ({
        shiftNumber: context.openingState.nextShiftNumber || 1,
        gasPrice: context.saleContext?.gasPrice ? String(context.saleContext.gasPrice) : '',
        meters: createGasReadings(4),
        gauges: createGasReadings(3),
    }));

    React.useEffect(() => {
        if (errors.length === 0) return;
        const timer = window.setTimeout(() => errorRegionRef.current?.focus(), 0);
        return () => window.clearTimeout(timer);
    }, [errors.length]);

    React.useEffect(() => {
        setGasValue((current) => ({
            ...current,
            shiftNumber: context.openingState.nextShiftNumber || current.shiftNumber,
            gasPrice: current.gasPrice || (context.saleContext?.gasPrice ? String(context.saleContext.gasPrice) : ''),
        }));
    }, [context.openingState.nextShiftNumber, context.saleContext?.gasPrice]);

    React.useEffect(() => {
        if (context.station.type !== 'FULL' || context.currentShift?.status !== 'OPEN') return;
        setFullMeters(createFullMeters(context.openingState.fullMeters));
    }, [
        context.currentShift?.id,
        context.currentShift?.status,
        context.openingState.fullMeters,
        context.station.type,
    ]);

    const run = async (action: () => Promise<unknown>, successMessage: string) => {
        setBusy(true);
        setErrors([]);
        try {
            await action();
            showToast('success', successMessage);
            await onRefresh();
        } catch (error) {
            const message = error instanceof Error ? error.message : 'ทำรายการไม่สำเร็จ';
            setErrors([message]);
            showToast('error', message);
        } finally {
            setBusy(false);
        }
    };

    if (!context.permissions.canOpenShift || context.station.operationalStatus !== 'ACTIVE') {
        return (
            <Notice tone="info" title="ไม่มีสิทธิ์เปิดกะ">
                สถานีนี้เป็น read-only หรือบัญชีนี้ไม่มีสิทธิ์ทำ Operations
            </Notice>
        );
    }

    const errorNotice = errors.length > 0 ? (
        <div ref={errorRegionRef} tabIndex={-1} className="focus:outline-none">
            <Notice tone="danger" title="ตรวจข้อมูลอีกครั้ง">
                <ul className="list-disc space-y-1 pl-5">
                    {errors.map((error) => <li key={error}>{error}</li>)}
                </ul>
            </Notice>
        </div>
    ) : null;

    if (context.openingState.status === 'DAY_COMPLETE') {
        return (
            <Notice tone="info" title="วันนี้เปิดครบ 2 กะแล้ว">
                ไม่สามารถเปิดกะเพิ่มใน business date นี้ได้ หากต้องแก้ข้อมูลให้ใช้ประวัติหรือเครื่องมือ Admin
            </Notice>
        );
    }

    if (context.currentShift?.status === 'OPEN' && context.openingState.status === 'READY') {
        return (
            <Section title="กะพร้อมทำงาน" description={`กะ ${context.currentShift.shiftNumber} · ${context.currentShift.businessDate}`}>
                <div className="space-y-3">
                    <Notice tone="success" title="ข้อมูลต้นกะครบแล้ว">
                        มิเตอร์และข้อมูลเปิดกะครบตามประเภทสถานี สามารถเริ่มบันทึกรายการขายได้
                    </Notice>
                    <div className="flex flex-wrap gap-2">
                        <Link href={context.paths.sales} className="inline-flex h-[var(--ui-control-md)] items-center justify-center gap-2 rounded-[var(--ui-radius-md)] bg-[var(--ui-primary-700)] px-4 text-sm font-semibold text-white hover:bg-[var(--ui-primary-800)] focus-visible:outline-none focus-visible:shadow-[var(--ui-shadow-focus)]">
                            <Fuel className="h-4 w-4" aria-hidden="true" /> ไปหน้าขาย
                        </Link>
                    </div>
                </div>
            </Section>
        );
    }

    if (context.station.type === 'FULL' && context.currentShift?.status === 'OPEN') {
        const recoveredMeterRows = context.openingState.fullMeters?.length || 0;
        const isRecovery = recoveredMeterRows > 0;

        return (
            <Section
                title={isRecovery ? 'ทำข้อมูลมิเตอร์ต้นกะที่ค้างต่อ' : '2. บันทึกมิเตอร์เริ่มต้น'}
                description={isRecovery
                    ? `พบข้อมูลเดิม ${recoveredMeterRows}/4 หัวจ่าย และมีรูปครบ ${context.openingState.completedMeters}/4 หัว ระบบจะบันทึกกลับเข้ากะเดิม`
                    : 'ต้องครบ 4 หัวจ่ายและมีรูปทุกหัว ก่อนเข้าสู่ SaleFlow'}
            >
                <div className="space-y-4">
                    {errorNotice}
                    <Notice tone="warning" title={isRecovery ? 'กะเปิดแล้วและข้อมูลต้นกะยังไม่ครบ' : 'กะเปิดแล้ว แต่ยังขายไม่ได้'}>
                        {isRecovery
                            ? 'ตรวจค่าที่ดึงจากกะเดิม เติมหัวที่ขาด และแนบรูปเฉพาะหัวที่ยังไม่มีหลักฐาน รูปเดิมจะถูกใช้ต่อหากไม่เลือกรูปใหม่'
                            : 'กรอกเลขมิเตอร์และถ่ายรูปให้ครบก่อน ระบบจะปลดล็อกหน้าขายเมื่อบันทึกสำเร็จ'}
                    </Notice>
                    <div className="grid gap-4 sm:grid-cols-2">
                        {fullMeters.map((meter, index) => {
                            const existingPhoto = meter.existingPhoto?.trim();
                            return (
                                <div key={meter.number} className="rounded-[var(--ui-radius-md)] border border-[var(--ui-border)] p-3">
                                    <Input
                                        label={`หัวจ่าย ${meter.number}`}
                                        inputMode="decimal"
                                        value={meter.value}
                                        onChange={(event) => setFullMeters((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, value: event.target.value } : item))}
                                        placeholder="เลขมิเตอร์เริ่มต้น"
                                        disabled={busy}
                                        required
                                    />
                                    <label className="mt-3 flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-[var(--ui-radius-md)] border border-dashed border-[var(--ui-border-strong)] px-3 py-2 text-sm font-semibold text-[var(--ui-text-secondary)] hover:bg-[var(--ui-surface-subtle)] focus-within:shadow-[var(--ui-shadow-focus)]">
                                        <Camera className="h-4 w-4" aria-hidden="true" />
                                        {meter.file
                                            ? meter.file.name
                                            : existingPhoto
                                                ? 'เลือกรูปใหม่ (ใช้รูปเดิมได้)'
                                                : 'แนบรูปมิเตอร์'}
                                        <input
                                            type="file"
                                            accept="image/*"
                                            className="sr-only"
                                            disabled={busy}
                                            onChange={(event) => {
                                                const file = event.target.files?.[0] || null;
                                                setFullMeters((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, file } : item));
                                            }}
                                        />
                                    </label>
                                    {existingPhoto && !meter.file && (
                                        <a
                                            href={existingPhoto}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="mt-2 inline-flex min-h-9 items-center text-xs font-semibold text-[var(--ui-info-text)] underline underline-offset-4 focus-visible:outline-none focus-visible:shadow-[var(--ui-shadow-focus)]"
                                        >
                                            ดูรูปต้นกะที่บันทึกไว้
                                        </a>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                    <Button
                        size="lg"
                        loading={busy}
                        className="w-full sm:w-auto"
                        onClick={() => void run(
                            () => completeFullOpeningMeters({
                                stationId: context.station.id,
                                stationNumber: context.station.number,
                                shiftId: context.currentShift!.id,
                                businessDate: context.currentShift!.businessDate,
                                meters: fullMeters,
                            }),
                            isRecovery ? 'เติมข้อมูลมิเตอร์ต้นกะครบแล้ว' : 'บันทึกมิเตอร์ต้นกะครบแล้ว'
                        )}
                    >
                        <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                        {isRecovery ? 'บันทึกข้อมูลที่เหลือและพร้อมขาย' : 'บันทึกมิเตอร์และพร้อมขาย'}
                    </Button>
                </div>
            </Section>
        );
    }

    if (context.station.type === 'GAS' && context.currentShift?.status === 'OPEN') {
        return (
            <Notice tone="danger" title="ข้อมูลเปิดกะ GAS ไม่ครบ">
                <div className="space-y-3">
                    <p>
                        API เปิดกะ GAS ปกติจะบันทึกมิเตอร์และเกจพร้อมกันแบบ atomic แต่กะนี้มีข้อมูลไม่ครบ ({context.openingState.completedMeters}/4 มิเตอร์, {context.openingState.completedGauges}/3 เกจ) จึงบล็อกการขายไว้ก่อน
                    </p>
                    <div className="flex flex-wrap gap-3">
                        <Link href={`/gas/${context.station.number}/meters`} className="font-semibold underline underline-offset-4 focus-visible:outline-none focus-visible:shadow-[var(--ui-shadow-focus)]">
                            ตรวจ/กู้ข้อมูลมิเตอร์
                        </Link>
                        <Link href={`/gas/${context.station.number}/gauge`} className="font-semibold underline underline-offset-4 focus-visible:outline-none focus-visible:shadow-[var(--ui-shadow-focus)]">
                            ตรวจ/กู้ข้อมูลเกจ
                        </Link>
                    </div>
                </div>
            </Notice>
        );
    }

    if (context.station.type === 'FULL') {
        const businessDate = context.saleContext?.businessDate;
        return (
            <Section title="1. เปิดกะ" description="ตั้งราคาประจำวันก่อน แล้วระบบเดิมจะตรวจกะค้างและกำหนดเลขกะให้">
                <div className="space-y-4">
                    {errorNotice}
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Input
                            label="ราคาขายปลีก / เชื่อ"
                            inputMode="decimal"
                            value={prices.retailPrice}
                            onChange={(event) => setPrices((current) => ({ ...current, retailPrice: event.target.value }))}
                            placeholder="0.00"
                            disabled={busy}
                        />
                        <Input
                            label="ราคาขายส่ง"
                            inputMode="decimal"
                            value={prices.wholesalePrice}
                            onChange={(event) => setPrices((current) => ({ ...current, wholesalePrice: event.target.value }))}
                            placeholder="0.00"
                            disabled={busy}
                        />
                    </div>
                    <Notice tone="info" title="ใช้กติกาเดิม">
                        ต้องมีราคาประจำวันอย่างน้อยหนึ่งราคา หลังเปิดกะแล้วจะยังบันทึกขายไม่ได้จนกว่าจะกรอกมิเตอร์เริ่มต้นครบ 4 หัวพร้อมรูป
                    </Notice>
                    <Button
                        size="lg"
                        loading={busy}
                        disabled={!businessDate}
                        className="w-full sm:w-auto"
                        onClick={() => businessDate && void run(
                            () => openFullStationShift({
                                stationNumber: context.station.number,
                                businessDate,
                                prices,
                            }),
                            'เปิดกะแล้ว กรุณาบันทึกมิเตอร์เริ่มต้นต่อ'
                        )}
                    >
                        <Play className="h-5 w-5" aria-hidden="true" /> เปิดกะ
                    </Button>
                </div>
            </Section>
        );
    }

    const businessDate = context.saleContext?.businessDate;
    const nextShiftNumber = context.openingState.nextShiftNumber;
    return (
        <Section title="เปิดกะ GAS" description={`มิเตอร์ 4 หัว + เกจ 3 ถัง จะถูกบันทึกพร้อมการเปิดกะครั้งเดียว${nextShiftNumber ? ` · กะ ${nextShiftNumber}` : ''}`}>
            <div className="space-y-4">
                {errorNotice}
                <Input
                    label="ราคาก๊าซ (บาท/ลิตร)"
                    inputMode="decimal"
                    value={gasValue.gasPrice}
                    onChange={(event) => setGasValue((current) => ({ ...current, gasPrice: event.target.value }))}
                    disabled={busy}
                    required
                />
                <div>
                    <div className="mb-2 flex items-center gap-2 font-semibold text-[var(--ui-text)]"><Gauge className="h-4 w-4" aria-hidden="true" /> มิเตอร์เริ่มต้น</div>
                    <div className="grid gap-3 sm:grid-cols-2">
                        {gasValue.meters.map((meter, index) => (
                            <Input
                                key={meter.number}
                                label={`หัวจ่าย ${meter.number}`}
                                inputMode="decimal"
                                value={meter.value}
                                onChange={(event) => setGasValue((current) => ({
                                    ...current,
                                    meters: current.meters.map((item, itemIndex) => itemIndex === index ? { ...item, value: event.target.value } : item),
                                }))}
                                disabled={busy}
                                required
                            />
                        ))}
                    </div>
                </div>
                <div>
                    <div className="mb-2 flex items-center gap-2 font-semibold text-[var(--ui-text)]"><Fuel className="h-4 w-4" aria-hidden="true" /> เกจถังเริ่มต้น (%)</div>
                    <div className="grid gap-3 sm:grid-cols-3">
                        {gasValue.gauges.map((gauge, index) => (
                            <Input
                                key={gauge.number}
                                label={`ถัง ${gauge.number}`}
                                inputMode="decimal"
                                value={gauge.value}
                                onChange={(event) => setGasValue((current) => ({
                                    ...current,
                                    gauges: current.gauges.map((item, itemIndex) => itemIndex === index ? { ...item, value: event.target.value } : item),
                                }))}
                                disabled={busy}
                                required
                            />
                        ))}
                    </div>
                </div>
                <Notice tone="info" title="เปิดแบบ atomic">
                    ถ้า meter/gauge/ราคาไม่ผ่าน validation กะจะไม่ถูกสร้างครึ่ง ๆ กลาง ๆ
                </Notice>
                <Button
                    size="lg"
                    loading={busy}
                    disabled={!businessDate || !nextShiftNumber}
                    className="w-full sm:w-auto"
                    onClick={() => {
                        if (!businessDate || !nextShiftNumber) return;
                        void run(
                            () => openGasStationShift({
                                stationNumber: context.station.number,
                                businessDate,
                                value: { ...gasValue, shiftNumber: nextShiftNumber },
                            }),
                            `เปิดกะ ${nextShiftNumber} สำเร็จ`
                        );
                    }}
                >
                    <Play className="h-5 w-5" aria-hidden="true" /> เปิดกะ {nextShiftNumber || ''}
                </Button>
                {!nextShiftNumber && (
                    <div className="flex items-center gap-2 text-sm text-[var(--ui-warning-text)]">
                        <TriangleAlert className="h-4 w-4" aria-hidden="true" /> ไม่พบเลขกะที่เปิดได้ กรุณา Refresh หรือตรวจประวัติ
                    </div>
                )}
            </div>
        </Section>
    );
}
