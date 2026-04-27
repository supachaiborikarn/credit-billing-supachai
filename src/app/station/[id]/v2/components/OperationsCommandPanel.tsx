'use client';

import type { ReactNode } from 'react';
import {
    AlertTriangle,
    Banknote,
    CheckCircle2,
    FileText,
    Gauge,
    Image as ImageIcon,
    ReceiptText,
    ShieldCheck,
} from 'lucide-react';
import { CREDIT_PAYMENT_TYPES, PAYMENT_TYPES } from '@/constants';

interface MeterReading {
    nozzleNumber: number;
    startReading: number;
    endReading: number | null;
    startPhoto?: string | null;
    endPhoto?: string | null;
}

interface Transaction {
    id: string;
    paymentType: string;
    liters: number;
    amount: number;
    ownerName?: string | null;
    billBookNo?: string | null;
    billNo?: string | null;
    transferProofUrl?: string | null;
}

type DayStatus = 'not_started' | 'recording' | 'closed';

interface OperationsCommandPanelProps {
    dayStatus: DayStatus;
    meters: MeterReading[];
    transactions: Transaction[];
    meterTotal: number;
    transactionTotal: number;
    meterDiff: number;
    onGoToMeter: () => void;
    onGoToList: () => void;
}

const isCreditLike = (paymentType: string) =>
    CREDIT_PAYMENT_TYPES.includes(paymentType as (typeof CREDIT_PAYMENT_TYPES)[number]);

export default function OperationsCommandPanel({
    dayStatus,
    meters,
    transactions,
    meterTotal,
    transactionTotal,
    meterDiff,
    onGoToMeter,
    onGoToList,
}: OperationsCommandPanelProps) {
    const formatNumber = (num: number) =>
        new Intl.NumberFormat('th-TH', { maximumFractionDigits: 2 }).format(num);

    const formatCurrency = (num: number) =>
        new Intl.NumberFormat('th-TH', {
            style: 'currency',
            currency: 'THB',
            maximumFractionDigits: 0,
        }).format(num);

    const totalAmount = transactions.reduce((sum, t) => sum + Number(t.amount), 0);
    const startPhotoCount = meters.filter(m => !!m.startPhoto).length;
    const endPhotoCount = meters.filter(m => !!m.endPhoto).length;
    const transferTransactions = transactions.filter(t => t.paymentType === 'TRANSFER');
    const transferProofCount = transferTransactions.filter(t => !!t.transferProofUrl).length;
    const creditTransactions = transactions.filter(t => isCreditLike(t.paymentType));
    const creditCompleteCount = creditTransactions.filter(t =>
        !!t.ownerName?.trim() && !!t.billBookNo?.trim() && !!t.billNo?.trim()
    ).length;

    const missingItems = [
        startPhotoCount < 4 ? `รูปมิเตอร์เปิดยังไม่ครบ ${startPhotoCount}/4` : null,
        dayStatus === 'closed' && endPhotoCount < 4 ? `รูปมิเตอร์ปิดยังไม่ครบ ${endPhotoCount}/4` : null,
        transferProofCount < transferTransactions.length
            ? `สลิปโอนยังไม่ครบ ${transferProofCount}/${transferTransactions.length}`
            : null,
        creditCompleteCount < creditTransactions.length
            ? `ข้อมูลเงินเชื่อยังไม่ครบ ${creditCompleteCount}/${creditTransactions.length}`
            : null,
        Math.abs(meterDiff) > 1 ? `ลิตรขายกับมิเตอร์ต่างกัน ${formatNumber(meterDiff)} ลิตร` : null,
    ].filter(Boolean) as string[];

    const healthOk = missingItems.length === 0;
    const statusCopy = {
        not_started: {
            title: 'เริ่มวันให้แน่นก่อนลงบิล',
            body: 'บันทึกเลขมิเตอร์เปิดพร้อมรูปครบ 4 หัวจ่าย แล้วระบบจะปลดปุ่มบันทึกการเติมให้พนักงานทำงานต่อได้',
        },
        recording: {
            title: healthOk ? 'ข้อมูลพร้อมไหลเข้าบัญชี' : 'กำลังบันทึกงานวันนี้',
            body: healthOk
                ? 'หลักฐานสำคัญครบตามเงื่อนไข เหลือเพียงตรวจมิเตอร์ปิดวันเมื่อเลิกงาน'
                : 'ระบบกำลังชี้จุดที่ควรเติมให้ครบก่อนปิดวัน เพื่อไม่ต้องตามแก้ย้อนหลัง',
        },
        closed: {
            title: healthOk ? 'ปิดวันสมบูรณ์ พร้อมตรวจบัญชี' : 'ปิดวันแล้ว แต่ยังมีจุดต้องตรวจ',
            body: healthOk
                ? 'ยอดมิเตอร์ รายการขาย และหลักฐานสำคัญครบชุดในวันเดียว'
                : 'แอดมินยังเห็นรายการที่ต้องตรวจในหน้า admin health panel ได้ทันที',
        },
    }[dayStatus];

    const paymentRows = PAYMENT_TYPES.map(pt => {
        const amount = transactions
            .filter(t => t.paymentType === pt.value)
            .reduce((sum, t) => sum + Number(t.amount), 0);
        return { ...pt, amount };
    }).filter(pt => pt.amount > 0);

    return (
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-orange-950 px-4 py-5 text-white">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-200">
                            Operations Command
                        </p>
                        <h2 className="mt-1 text-xl font-extrabold leading-tight">{statusCopy.title}</h2>
                        <p className="mt-2 text-sm leading-relaxed text-slate-300">{statusCopy.body}</p>
                    </div>
                    <div className={`rounded-2xl p-3 ${healthOk ? 'bg-emerald-400/15 text-emerald-200' : 'bg-amber-400/15 text-amber-200'}`}>
                        {healthOk ? <ShieldCheck size={28} /> : <AlertTriangle size={28} />}
                    </div>
                </div>

                <div className="mt-5 grid grid-cols-3 gap-2">
                    <div className="rounded-2xl bg-white/10 p-3 backdrop-blur">
                        <Banknote size={16} className="mb-2 text-emerald-200" />
                        <p className="text-[11px] text-slate-300">ยอดขาย</p>
                        <p className="text-lg font-extrabold">{formatCurrency(totalAmount)}</p>
                    </div>
                    <div className="rounded-2xl bg-white/10 p-3 backdrop-blur">
                        <ReceiptText size={16} className="mb-2 text-blue-200" />
                        <p className="text-[11px] text-slate-300">รายการ</p>
                        <p className="text-lg font-extrabold">{transactions.length}</p>
                    </div>
                    <div className="rounded-2xl bg-white/10 p-3 backdrop-blur">
                        <Gauge size={16} className="mb-2 text-orange-200" />
                        <p className="text-[11px] text-slate-300">ผลต่าง</p>
                        <p className={`text-lg font-extrabold ${Math.abs(meterDiff) <= 1 ? 'text-emerald-200' : 'text-red-200'}`}>
                            {meterDiff > 0 ? '+' : ''}{formatNumber(meterDiff)}
                        </p>
                    </div>
                </div>
            </div>

            <div className="grid gap-3 p-4 sm:grid-cols-2">
                <EvidenceTile
                    icon={<ImageIcon size={18} />}
                    label="รูปมิเตอร์เปิด"
                    value={`${startPhotoCount}/4`}
                    ok={startPhotoCount === 4}
                />
                <EvidenceTile
                    icon={<ImageIcon size={18} />}
                    label="รูปมิเตอร์ปิด"
                    value={`${endPhotoCount}/4`}
                    ok={dayStatus !== 'closed' || endPhotoCount === 4}
                    muted={dayStatus !== 'closed'}
                />
                <EvidenceTile
                    icon={<FileText size={18} />}
                    label="สลิปเงินโอน"
                    value={`${transferProofCount}/${transferTransactions.length}`}
                    ok={transferProofCount === transferTransactions.length}
                    muted={transferTransactions.length === 0}
                />
                <EvidenceTile
                    icon={<ReceiptText size={18} />}
                    label="ลูกค้า/เลขบิลเงินเชื่อ"
                    value={`${creditCompleteCount}/${creditTransactions.length}`}
                    ok={creditCompleteCount === creditTransactions.length}
                    muted={creditTransactions.length === 0}
                />
            </div>

            <div className="border-t border-slate-100 px-4 py-3">
                <div className="mb-3 flex items-center justify-between text-xs font-semibold text-slate-500">
                    <span>มิเตอร์ {formatNumber(meterTotal)} ลิตร</span>
                    <span>ขาย {formatNumber(transactionTotal)} ลิตร</span>
                </div>

                {paymentRows.length > 0 && (
                    <div className="mb-3 space-y-2">
                        {paymentRows.map(row => {
                            const percent = totalAmount > 0 ? Math.max(4, (row.amount / totalAmount) * 100) : 0;
                            return (
                                <div key={row.value}>
                                    <div className="mb-1 flex justify-between text-xs text-slate-500">
                                        <span>{row.label}</span>
                                        <span>{formatCurrency(row.amount)}</span>
                                    </div>
                                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                                        <div className="h-full rounded-full bg-orange-500" style={{ width: `${percent}%` }} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {missingItems.length > 0 ? (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
                        <p className="mb-2 text-sm font-bold text-amber-800">สิ่งที่ควรเคลียร์ก่อนปิดวัน</p>
                        <div className="space-y-1">
                            {missingItems.map(item => (
                                <p key={item} className="text-xs text-amber-700">- {item}</p>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-700">
                        <CheckCircle2 size={18} />
                        ข้อมูลหลักครบถ้วนตามเงื่อนไขวันนี้
                    </div>
                )}

                <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                        onClick={onGoToMeter}
                        className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700"
                    >
                        ตรวจมิเตอร์
                    </button>
                    <button
                        onClick={onGoToList}
                        className="rounded-xl bg-orange-500 px-3 py-2 text-sm font-bold text-white"
                    >
                        ดูรายการทั้งหมด
                    </button>
                </div>
            </div>
        </section>
    );
}

function EvidenceTile({
    icon,
    label,
    value,
    ok,
    muted = false,
}: {
    icon: ReactNode;
    label: string;
    value: string;
    ok: boolean;
    muted?: boolean;
}) {
    const tone = muted
        ? 'border-slate-200 bg-slate-50 text-slate-500'
        : ok
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
            : 'border-amber-200 bg-amber-50 text-amber-700';

    return (
        <div className={`flex items-center justify-between rounded-2xl border p-3 ${tone}`}>
            <div className="flex items-center gap-2">
                {icon}
                <span className="text-sm font-semibold">{label}</span>
            </div>
            <span className="font-mono text-sm font-extrabold">{value}</span>
        </div>
    );
}
