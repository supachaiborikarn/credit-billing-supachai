'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
    AlertCircle,
    CheckCircle,
    Clock,
    ExternalLink,
    Loader2,
    Play,
    Save,
    Wrench,
} from 'lucide-react';
import { formatCurrency, getGasBusinessDateKey, getShiftName } from '@/lib/gas';

interface GasShiftOperation {
    id: string;
    shiftNumber: number;
    status: string;
    staffName: string | null;
    openedAt: string;
    closedAt: string | null;
    transactionCount: number;
    meterRows: number;
    endMeterCount: number;
    hasReconciliation: boolean;
    canForceCloseEmpty: boolean;
}

interface GasStationOperation {
    id: string;
    name: string;
    stationGasPrice: number | null;
    todayGasPrice: number | null;
    effectiveGasPrice: number;
    dailyRecord: { id: string; dateKey: string } | null;
    openShiftId: string | null;
    nextShiftNumber: number | null;
    dayComplete: boolean;
    orphanTransactions: number;
    shifts: GasShiftOperation[];
}

interface OperationsPayload {
    dateKey: string;
    globalGasPrice: number;
    stations: GasStationOperation[];
}

type Notice = {
    type: 'success' | 'error';
    text: string;
};

function formatTime(value: string | null): string {
    if (!value) return '-';

    return new Date(value).toLocaleTimeString('th-TH', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Bangkok',
    });
}

function getStatusLabel(status: string): string {
    if (status === 'OPEN') return 'เปิดอยู่';
    if (status === 'CLOSED') return 'ปิดแล้ว';
    return status;
}

function getShiftActionText(station: GasStationOperation): string {
    if (station.openShiftId) return 'ต้องปิดกะที่เปิดอยู่ก่อน';
    if (station.nextShiftNumber === 1) return 'ยังไม่เปิดกะวันนี้';
    if (station.nextShiftNumber === 2) return 'พร้อมเปิดกะ 19:00-07:00';
    return 'วันนี้ครบ 2 กะแล้ว';
}

export default function GasOperationsPage() {
    const [loading, setLoading] = useState(true);
    const [savingKey, setSavingKey] = useState<string | null>(null);
    const [dateKey, setDateKey] = useState(getGasBusinessDateKey());
    const [data, setData] = useState<OperationsPayload | null>(null);
    const [priceInputs, setPriceInputs] = useState<Record<string, string>>({});
    const [notice, setNotice] = useState<Notice | null>(null);

    const loadOperations = async (nextDateKey = dateKey) => {
        setLoading(true);
        setNotice(null);
        try {
            const res = await fetch(`/api/v2/gas/admin/operations?dateKey=${encodeURIComponent(nextDateKey)}`);
            const json = await res.json();
            if (!res.ok) {
                throw new Error(json.error || 'โหลดข้อมูลไม่สำเร็จ');
            }

            setData(json);
            const nextInputs: Record<string, string> = {};
            for (const station of json.stations as GasStationOperation[]) {
                nextInputs[station.id] = station.effectiveGasPrice.toFixed(2);
            }
            setPriceInputs(nextInputs);
        } catch (error) {
            setNotice({
                type: 'error',
                text: error instanceof Error ? error.message : 'โหลดข้อมูลไม่สำเร็จ',
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadOperations(dateKey);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleDateChange = (value: string) => {
        setDateKey(value);
        void loadOperations(value);
    };

    const handleSavePrice = async (station: GasStationOperation) => {
        const gasPrice = Number(priceInputs[station.id]);
        if (!Number.isFinite(gasPrice) || gasPrice <= 0) {
            setNotice({ type: 'error', text: 'กรุณากรอกราคามากกว่า 0' });
            return;
        }

        setSavingKey(`price:${station.id}`);
        setNotice(null);
        try {
            const res = await fetch('/api/v2/gas/admin/operations', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'setGasPrice',
                    stationId: station.id,
                    gasPrice,
                    dateKey,
                }),
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(json.error || 'บันทึกราคาไม่สำเร็จ');
            }

            setNotice({ type: 'success', text: json.message || 'บันทึกราคาแล้ว' });
            await loadOperations(dateKey);
        } catch (error) {
            setNotice({
                type: 'error',
                text: error instanceof Error ? error.message : 'บันทึกราคาไม่สำเร็จ',
            });
        } finally {
            setSavingKey(null);
        }
    };

    const handleCloseEmptyShift = async (shiftId: string) => {
        if (!confirm('ปิดกะว่าง/กะค้างนี้ใช่ไหม? ใช้เฉพาะกะที่ไม่มีรายการขายและยังไม่ปิดมิเตอร์เท่านั้น')) {
            return;
        }

        setSavingKey(`shift:${shiftId}`);
        setNotice(null);
        try {
            const res = await fetch('/api/v2/gas/admin/operations', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'closeEmptyShift',
                    shiftId,
                }),
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(json.error || 'ปิดกะค้างไม่สำเร็จ');
            }

            setNotice({ type: 'success', text: json.message || 'ปิดกะค้างแล้ว' });
            await loadOperations(dateKey);
        } catch (error) {
            setNotice({
                type: 'error',
                text: error instanceof Error ? error.message : 'ปิดกะค้างไม่สำเร็จ',
            });
        } finally {
            setSavingKey(null);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="flex items-center gap-2 text-2xl font-bold">
                        <Wrench className="text-orange-400" />
                        จัดการกะและราคา
                    </h1>
                    <p className="text-sm text-gray-400">
                        ใช้แก้ราคาหลักและช่วยแอดมินจัดการกะค้างของปั๊มแก๊ส
                    </p>
                </div>

                <div className="flex items-end gap-2">
                    <div>
                        <label className="mb-1 block text-xs text-gray-400">วันที่</label>
                        <input
                            type="date"
                            value={dateKey}
                            onChange={(e) => handleDateChange(e.target.value)}
                            className="rounded-lg border border-white/10 bg-gray-800 px-3 py-2 text-sm"
                        />
                    </div>
                    <button
                        onClick={() => void loadOperations(dateKey)}
                        className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-500"
                    >
                        รีเฟรช
                    </button>
                </div>
            </div>

            {notice && (
                <div className={`flex items-center gap-2 rounded-xl border p-4 ${notice.type === 'success'
                    ? 'border-green-500/30 bg-green-900/30 text-green-300'
                    : 'border-red-500/30 bg-red-900/30 text-red-300'
                    }`}>
                    {notice.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
                    <span>{notice.text}</span>
                </div>
            )}

            {loading ? (
                <div className="flex min-h-[360px] items-center justify-center">
                    <Loader2 className="animate-spin text-orange-400" size={40} />
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                    {(data?.stations ?? []).map((station) => {
                        const openShift = station.shifts.find((shift) => shift.status === 'OPEN') ?? null;
                        const needsCloseBeforeNightShift = openShift?.shiftNumber === 1;

                        return (
                            <section
                                key={station.id}
                                className="rounded-2xl border border-white/10 bg-[#1a1a24] p-5 shadow-lg"
                            >
                                <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
                                    <div>
                                        <h2 className="text-xl font-bold">{station.name}</h2>
                                        <p className="text-sm text-gray-400">{getShiftActionText(station)}</p>
                                    </div>
                                    <Link
                                        href={`/gas/${station.id}`}
                                        className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-gray-200 hover:bg-white/10"
                                    >
                                        <ExternalLink size={16} />
                                        เข้าหน้าพนักงาน
                                    </Link>
                                </div>

                                <div className="mb-5 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
                                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                                        <div>
                                            <div className="text-sm text-amber-200">ราคาหลักของปั๊ม</div>
                                            <div className="text-xs text-gray-400">
                                                วันนี้: ฿{formatCurrency(station.todayGasPrice ?? station.effectiveGasPrice)} / ลิตร
                                            </div>
                                        </div>
                                        <div className="text-right text-sm text-gray-300">
                                            ค่าเดิมหลัก: ฿{formatCurrency(station.stationGasPrice ?? data?.globalGasPrice ?? 16.09)}
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            inputMode="decimal"
                                            value={priceInputs[station.id] ?? ''}
                                            onChange={(e) => setPriceInputs({
                                                ...priceInputs,
                                                [station.id]: e.target.value,
                                            })}
                                            className="min-w-0 flex-1 rounded-lg border border-amber-500/30 bg-gray-900 px-4 py-2 text-right font-mono text-lg outline-none focus:border-amber-300"
                                        />
                                        <button
                                            onClick={() => void handleSavePrice(station)}
                                            disabled={savingKey === `price:${station.id}`}
                                            className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-gray-950 hover:bg-amber-400 disabled:opacity-60"
                                        >
                                            {savingKey === `price:${station.id}`
                                                ? <Loader2 className="animate-spin" size={16} />
                                                : <Save size={16} />}
                                            บันทึก
                                        </button>
                                    </div>
                                    <p className="mt-2 text-xs text-amber-100/80">
                                        ราคานี้จะเป็นราคาหลักของปั๊มจนกว่าจะเปลี่ยนครั้งถัดไป และอัปเดตราคาของวันที่เลือกด้วย
                                    </p>
                                </div>

                                {needsCloseBeforeNightShift && (
                                    <div className="mb-4 rounded-xl border border-red-500/25 bg-red-900/25 p-4 text-sm text-red-200">
                                        กะ 07:00-19:00 ยังเปิดอยู่ในระบบ จึงยังเปิดกะ 19:00-07:00 ไม่ได้ ให้ปิดกะเดิมก่อน หรือถ้าเป็นกะว่างให้ใช้ปุ่มปิดกะค้างด้านล่าง
                                    </div>
                                )}

                                <div className="space-y-3">
                                    {station.shifts.length === 0 ? (
                                        <div className="rounded-xl border border-dashed border-white/10 p-4 text-center text-gray-500">
                                            ยังไม่มีกะในวันที่เลือก
                                        </div>
                                    ) : (
                                        station.shifts.map((shift) => (
                                            <div
                                                key={shift.id}
                                                className="rounded-xl border border-white/10 bg-gray-900/60 p-4"
                                            >
                                                <div className="flex flex-wrap items-center justify-between gap-3">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`h-3 w-3 rounded-full ${shift.status === 'OPEN' ? 'bg-green-400' : 'bg-gray-500'}`} />
                                                        <div>
                                                            <div className="font-medium">
                                                                {getShiftName(shift.shiftNumber)} · {getStatusLabel(shift.status)}
                                                            </div>
                                                            <div className="text-xs text-gray-400">
                                                                {shift.staffName || 'ไม่ระบุ'} · เปิด {formatTime(shift.openedAt)}
                                                                {shift.closedAt ? ` · ปิด ${formatTime(shift.closedAt)}` : ''}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="text-right text-xs text-gray-400">
                                                        <div>{shift.transactionCount} รายการขาย</div>
                                                        <div>มิเตอร์ปิด {shift.endMeterCount}/{shift.meterRows}</div>
                                                    </div>
                                                </div>

                                                {shift.status === 'OPEN' && (
                                                    <div className="mt-3 flex flex-wrap gap-2">
                                                        <Link
                                                            href={`/admin/gas/data-entry?stationId=${station.id}&date=${dateKey}&shiftNumber=${shift.shiftNumber}&status=OPEN`}
                                                            className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-3 py-2 text-sm font-medium text-white hover:bg-orange-500"
                                                        >
                                                            <Save size={16} />
                                                            กรอก/แก้ข้อมูลกะ
                                                        </Link>
                                                        <Link
                                                            href={`/gas/${station.id}/shift/close`}
                                                            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-500"
                                                        >
                                                            <Clock size={16} />
                                                            ไปปิดกะ
                                                        </Link>
                                                        {shift.canForceCloseEmpty && (
                                                            <button
                                                                onClick={() => void handleCloseEmptyShift(shift.id)}
                                                                disabled={savingKey === `shift:${shift.id}`}
                                                                className="inline-flex items-center gap-2 rounded-lg border border-red-500/40 px-3 py-2 text-sm text-red-200 hover:bg-red-500/10 disabled:opacity-60"
                                                            >
                                                                {savingKey === `shift:${shift.id}`
                                                                    ? <Loader2 className="animate-spin" size={16} />
                                                                    : <AlertCircle size={16} />}
                                                                ปิดกะว่าง/กะค้าง
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                                {shift.status !== 'OPEN' && (
                                                    <div className="mt-3 flex flex-wrap gap-2">
                                                        <Link
                                                            href={`/admin/gas/data-entry?stationId=${station.id}&date=${dateKey}&shiftNumber=${shift.shiftNumber}&status=CLOSED`}
                                                            className="inline-flex items-center gap-2 rounded-lg border border-orange-500/40 px-3 py-2 text-sm text-orange-200 hover:bg-orange-500/10"
                                                        >
                                                            <Save size={16} />
                                                            แก้ข้อมูลกะ
                                                        </Link>
                                                    </div>
                                                )}
                                            </div>
                                        ))
                                    )}
                                </div>

                                {!station.openShiftId && station.nextShiftNumber && (
                                    <div className="mt-4 flex flex-wrap gap-2">
                                        <Link
                                            href={`/admin/gas/data-entry?stationId=${station.id}&date=${dateKey}&shiftNumber=${station.nextShiftNumber}&status=OPEN`}
                                            className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-bold text-white hover:bg-orange-500"
                                        >
                                            <Save size={16} />
                                            สร้าง/กรอก {getShiftName(station.nextShiftNumber)} จากแอดมิน
                                        </Link>
                                        <Link
                                            href={`/gas/${station.id}/shift/open`}
                                            className="inline-flex items-center gap-2 rounded-lg border border-green-500/40 px-4 py-2 text-sm font-medium text-green-200 hover:bg-green-500/10"
                                        >
                                            <Play size={16} />
                                            เปิด {getShiftName(station.nextShiftNumber)} หน้าพนักงาน
                                        </Link>
                                    </div>
                                )}

                                {station.orphanTransactions > 0 && (
                                    <div className="mt-4 rounded-xl border border-yellow-500/30 bg-yellow-900/20 p-3 text-sm text-yellow-200">
                                        มีรายการขายไม่ผูกกะ {station.orphanTransactions} รายการ ควรตรวจในรายงานรายวัน
                                    </div>
                                )}
                            </section>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
