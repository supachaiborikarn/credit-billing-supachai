'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
    AlertTriangle,
    ArrowLeft,
    Calculator,
    CheckCircle2,
    History,
    Loader2,
    RotateCcw,
    Save,
} from 'lucide-react';

type MeterRow = {
    id: string | null;
    nozzleNumber: number;
    startReading: number | null;
    endReading: number | null;
    soldQty: number | null;
    previousEndReading: number | null;
};

type MeterEditData = {
    shift: {
        id: string;
        stationId: string;
        stationName: string;
        dateKey: string;
        shiftNumber: number;
        shiftName: string;
        status: string;
        hasReconciliation: boolean;
    };
    previousShift: {
        id: string;
        dateKey: string;
        shiftNumber: number;
        shiftName: string;
    } | null;
    meters: MeterRow[];
};

type SaveResponse = {
    success?: boolean;
    message?: string;
    error?: string;
    meters?: Array<{
        nozzleNumber: number;
        startReading: number;
        endReading: number | null;
        soldQty: number | null;
    }>;
};

function formatDate(dateKey: string): string {
    return new Date(`${dateKey}T12:00:00+07:00`).toLocaleDateString('th-TH', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });
}

function parseReading(value: string): number | null {
    const normalized = value.trim().replace(/,/g, '');
    if (!normalized) return null;

    const parsed = Number(normalized);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export default function GasAdminMeterEditPage() {
    const params = useParams();
    const shiftId = params.shiftId as string;
    const [data, setData] = useState<MeterEditData | null>(null);
    const [readings, setReadings] = useState<Record<number, string>>({});
    const [reason, setReason] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const loadData = useCallback(async () => {
        setLoading(true);
        setError('');
        setSuccess('');

        try {
            const response = await fetch(`/api/v2/gas/admin/meters/${shiftId}`);
            const body = await response.json();
            if (!response.ok) {
                throw new Error(body.error || 'โหลดข้อมูลมิเตอร์ไม่สำเร็จ');
            }

            setData(body);
            setReadings(Object.fromEntries(
                body.meters.map((meter: MeterRow) => [
                    meter.nozzleNumber,
                    meter.startReading === null ? '' : String(meter.startReading),
                ])
            ));
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : 'โหลดข้อมูลมิเตอร์ไม่สำเร็จ');
        } finally {
            setLoading(false);
        }
    }, [shiftId]);

    useEffect(() => {
        void loadData();
    }, [loadData]);

    const hasCompletePreviousReadings = useMemo(
        () => Boolean(data?.meters.every((meter) => meter.previousEndReading !== null)),
        [data]
    );

    const usePreviousReadings = () => {
        if (!data || !hasCompletePreviousReadings) return;

        setReadings(Object.fromEntries(
            data.meters.map((meter) => [meter.nozzleNumber, String(meter.previousEndReading)])
        ));
        setSuccess('ใส่เลขปิดจากกะก่อนหน้าให้แล้ว กรุณาตรวจสอบก่อนบันทึก');
        setError('');
    };

    const resetReadings = () => {
        if (!data) return;

        setReadings(Object.fromEntries(
            data.meters.map((meter) => [
                meter.nozzleNumber,
                meter.startReading === null ? '' : String(meter.startReading),
            ])
        ));
        setSuccess('');
        setError('');
    };

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!data || saving) return;

        setError('');
        setSuccess('');

        const parsedReadings = data.meters.map((meter) => ({
            nozzleNumber: meter.nozzleNumber,
            reading: parseReading(readings[meter.nozzleNumber] ?? ''),
        }));
        const invalidMeter = parsedReadings.find((meter) => meter.reading === null);
        if (invalidMeter) {
            setError(`หัวจ่าย ${invalidMeter.nozzleNumber}: กรุณากรอกตัวเลขไม่ติดลบ`);
            return;
        }

        const endConflict = data.meters.find((meter) => {
            const startReading = parsedReadings.find(
                (reading) => reading.nozzleNumber === meter.nozzleNumber
            )?.reading;
            return meter.endReading !== null
                && startReading !== null
                && startReading !== undefined
                && startReading > meter.endReading;
        });
        if (endConflict) {
            const endReading = endConflict.endReading as number;
            setError(
                `หัวจ่าย ${endConflict.nozzleNumber}: มิเตอร์เปิดต้องไม่มากกว่ามิเตอร์ปิด ${endReading.toLocaleString()}`
            );
            return;
        }

        if (reason.trim().length < 3) {
            setError('กรุณาระบุเหตุผลในการแก้ไขอย่างน้อย 3 ตัวอักษร');
            return;
        }

        setSaving(true);
        try {
            const response = await fetch(`/api/v2/gas/admin/meters/${shiftId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    readings: parsedReadings.map((meter) => ({
                        nozzleNumber: meter.nozzleNumber,
                        reading: meter.reading,
                    })),
                    reason: reason.trim(),
                }),
            });
            const body = await response.json() as SaveResponse;
            if (!response.ok) {
                throw new Error(body.error || 'บันทึกมิเตอร์ไม่สำเร็จ');
            }

            if (body.meters) {
                setData((current) => current ? {
                    ...current,
                    meters: current.meters.map((meter) => {
                        const updated = body.meters?.find(
                            (item) => item.nozzleNumber === meter.nozzleNumber
                        );
                        return updated ? {
                            ...meter,
                            startReading: updated.startReading,
                            endReading: updated.endReading,
                            soldQty: updated.soldQty,
                        } : meter;
                    }),
                } : current);
            }

            setSuccess(body.message || 'บันทึกเลขมิเตอร์แล้ว');
            setReason('');
        } catch (saveError) {
            setError(saveError instanceof Error ? saveError.message : 'บันทึกมิเตอร์ไม่สำเร็จ');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex min-h-[420px] items-center justify-center">
                <Loader2 className="animate-spin text-orange-400" size={36} />
            </div>
        );
    }

    if (!data) {
        return (
            <div className="space-y-4">
                <Link
                    href="/admin/gas/reports/meters"
                    className="inline-flex items-center gap-2 text-sm text-gray-300 hover:text-white"
                >
                    <ArrowLeft size={18} />
                    กลับรายงานมิเตอร์
                </Link>
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-5 text-red-200">
                    {error || 'ไม่พบข้อมูลกะ'}
                </div>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-4xl space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <Link
                        href="/admin/gas/reports/meters"
                        className="mb-3 inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white"
                    >
                        <ArrowLeft size={18} />
                        กลับรายงานมิเตอร์
                    </Link>
                    <h1 className="flex items-center gap-2 text-2xl font-bold">
                        <Calculator className="text-orange-400" />
                        แก้เลขมิเตอร์เปิดกะ
                    </h1>
                    <p className="mt-2 text-gray-400">
                        {data.shift.stationName} • {formatDate(data.shift.dateKey)} • {data.shift.shiftName}
                    </p>
                </div>
                <span className={`rounded-lg px-3 py-2 text-sm font-medium ${data.shift.status === 'OPEN'
                    ? 'bg-green-500/15 text-green-300'
                    : 'bg-gray-700 text-gray-200'}`}>
                    {data.shift.status === 'OPEN' ? 'กะเปิดอยู่' : 'กะปิดแล้ว'}
                </span>
            </div>

            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
                <div className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 shrink-0 text-amber-300" size={18} />
                    <div>
                        <div className="font-semibold">ตรวจเลขจากหน้าปั๊มหรือรูปมิเตอร์ก่อนบันทึก</div>
                        <div className="mt-1 text-amber-100/80">
                            ระบบจะคำนวณลิตรขายใหม่ และจะปรับยอดที่ควรได้กับส่วนต่างของกะที่กระทบยอดแล้ว
                        </div>
                    </div>
                </div>
            </div>

            {error && (
                <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">
                    {error}
                </div>
            )}
            {success && (
                <div role="status" className="flex items-start gap-2 rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-green-200">
                    <CheckCircle2 className="mt-0.5 shrink-0" size={18} />
                    {success}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
                <div className="overflow-hidden rounded-xl border border-white/10 bg-[#1a1a24]">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-4">
                        <div>
                            <h2 className="font-semibold">เลขมิเตอร์ 4 หัวจ่าย</h2>
                            {data.previousShift && (
                                <p className="mt-1 text-xs text-gray-500">
                                    เลขอ้างอิงจาก {data.previousShift.dateKey} {data.previousShift.shiftName}
                                </p>
                            )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={resetReadings}
                                className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-gray-800 px-3 py-2 text-sm text-gray-200 hover:bg-gray-700"
                            >
                                <RotateCcw size={16} />
                                คืนค่าปัจจุบัน
                            </button>
                            <button
                                type="button"
                                onClick={usePreviousReadings}
                                disabled={!hasCompletePreviousReadings}
                                className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-3 py-2 text-sm font-semibold text-white hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                <History size={16} />
                                ใช้เลขปิดกะก่อนหน้า
                            </button>
                        </div>
                    </div>

                    <div className="grid gap-4 p-4 sm:grid-cols-2">
                        {data.meters.map((meter) => (
                            <div key={meter.nozzleNumber} className="rounded-lg border border-white/10 bg-gray-900/50 p-4">
                                <div className="mb-3 flex items-center justify-between gap-3">
                                    <label
                                        htmlFor={`meter-${meter.nozzleNumber}`}
                                        className="font-semibold text-gray-100"
                                    >
                                        หัวจ่าย {meter.nozzleNumber}
                                    </label>
                                    <span className="text-xs text-gray-500">
                                        ปัจจุบัน {meter.startReading?.toLocaleString() ?? '-'}
                                    </span>
                                </div>
                                <input
                                    id={`meter-${meter.nozzleNumber}`}
                                    type="text"
                                    inputMode="decimal"
                                    value={readings[meter.nozzleNumber] ?? ''}
                                    onChange={(event) => setReadings((current) => ({
                                        ...current,
                                        [meter.nozzleNumber]: event.target.value,
                                    }))}
                                    className="w-full rounded-lg border border-white/10 bg-gray-800 px-4 py-3 text-right font-mono text-xl text-white outline-none focus:border-orange-500"
                                    placeholder="0.00"
                                />
                                <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                                    <div>
                                        <div className="text-gray-500">เลขปิดกะก่อนหน้า</div>
                                        <div className="mt-1 font-mono text-orange-300">
                                            {meter.previousEndReading?.toLocaleString() ?? '-'}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-gray-500">เลขปิดกะนี้</div>
                                        <div className="mt-1 font-mono text-gray-300">
                                            {meter.endReading?.toLocaleString() ?? 'ยังไม่ปิดกะ'}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-[#1a1a24] p-4">
                    <label htmlFor="reason" className="block text-sm font-semibold text-gray-200">
                        เหตุผลที่แก้ไข
                    </label>
                    <textarea
                        id="reason"
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                        rows={3}
                        maxLength={500}
                        placeholder="เช่น พนักงานกรอกเลขเปิดกะจากกะผิด"
                        className="mt-2 w-full resize-y rounded-lg border border-white/10 bg-gray-800 px-4 py-3 text-white outline-none focus:border-orange-500"
                    />
                    <p className="mt-2 text-xs text-gray-500">ระบบเก็บชื่อแอดมิน ค่าเดิม ค่าใหม่ และเหตุผลไว้ตรวจย้อนหลัง</p>
                </div>

                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                    <Link
                        href="/admin/gas/reports/meters"
                        className="rounded-lg border border-white/10 bg-gray-800 px-5 py-3 text-center font-medium text-gray-200 hover:bg-gray-700"
                    >
                        ยกเลิก
                    </Link>
                    <button
                        type="submit"
                        disabled={saving}
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-orange-600 px-5 py-3 font-semibold text-white hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                        {saving ? 'กำลังบันทึก...' : 'บันทึกเลขมิเตอร์'}
                    </button>
                </div>
            </form>
        </div>
    );
}
