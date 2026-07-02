'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import {
    AlertTriangle,
    BarChart3,
    CalendarDays,
    FileText,
    Gauge,
    Loader2,
    PackagePlus,
    Printer,
    RefreshCcw,
    TrendingUp,
} from 'lucide-react';
import { getGasBusinessDateKey, getShiftName } from '@/lib/gas';
import { STATIONS } from '@/constants';

type Severity = 'INFO' | 'WARNING' | 'CRITICAL';

interface ExecutiveReport {
    meta: {
        from: string;
        to: string;
        generatedAt: string;
        stationLabel: string;
    };
    kpis: {
        totalRevenue: number;
        totalReceived: number;
        variance: number;
        totalLiters: number;
        meterLiters: number;
        transactionLiters: number;
        transactionCount: number;
        averageTicket: number;
        shiftCount: number;
        openShiftCount: number;
        supplyLiters: number;
        supplyCost: number;
        averageSupplyCost: number | null;
        continuityIssues: number;
        unassignedTransactions: number;
    };
    revenue: {
        paymentMix: {
            cash: number;
            credit: number;
            card: number;
            transfer: number;
        };
        dailyRows: {
            dateKey: string;
            displayDate: string;
            totalSales: number;
            totalReceived: number;
            totalLiters: number;
            transactionCount: number;
            variance: number;
        }[];
        stationRows: {
            stationId: string;
            stationName: string;
            totalSales: number;
            totalReceived: number;
            totalLiters: number;
            transactionCount: number;
            variance: number;
            averageTicket: number;
        }[];
    };
    meters: {
        totalsByNozzle: {
            stationId: string;
            stationName: string;
            nozzleNumber: number;
            liters: number;
            estimatedSales: number;
        }[];
        shiftRows: {
            id: string;
            dateKey: string;
            displayDate: string;
            stationName: string;
            shiftNumber: number;
            status: string;
            meterLiters: number;
            transactionLiters: number;
            litersVariance: number;
            sales: number;
            continuityIssueCount: number;
            isSyntheticOrphan: boolean;
        }[];
    };
    supplies: {
        rows: {
            id: string;
            stationId: string;
            stationName?: string | null;
            date: string;
            displayDate: string;
            liters: number;
            supplier: string | null;
            invoiceNo: string | null;
            pricePerLiter: number | null;
            totalCost: number | null;
            notes: string | null;
        }[];
        stationRows: {
            stationId: string;
            stationName: string;
            liters: number;
            totalCost: number;
            count: number;
            averageCostPerLiter: number | null;
        }[];
    };
    managementNotes: {
        severity: Severity;
        title: string;
        detail: string;
    }[];
}

// รายชื่อปั๊มแก๊สจากค่ากลาง (เพิ่มสาขาใหม่ที่ src/constants ที่เดียว)
const GAS_STATIONS = [
    { id: 'all', name: 'ทุกปั๊มแก๊ส' },
    ...STATIONS
        .filter((station) => station.type === 'GAS')
        .map((station) => ({ id: station.id, name: station.name })),
];

function getDefaultFromDate() {
    const [year, month, day] = getGasBusinessDateKey().split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    date.setUTCDate(date.getUTCDate() - 6);
    return date.toISOString().slice(0, 10);
}

function formatCurrency(value: number): string {
    return value.toLocaleString('th-TH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

function formatNumber(value: number, digits = 2): string {
    return value.toLocaleString('th-TH', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    });
}

function formatGeneratedAt(value: string): string {
    return new Date(value).toLocaleString('th-TH', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Asia/Bangkok',
    });
}

function getShiftLabel(shiftNumber: number): string {
    if (shiftNumber === 0) return 'ไม่ผูกกะ';
    return getShiftName(shiftNumber);
}

function getSeverityClass(severity: Severity): string {
    if (severity === 'CRITICAL') return 'border-red-200 bg-red-50 text-red-800';
    if (severity === 'WARNING') return 'border-amber-200 bg-amber-50 text-amber-800';
    return 'border-blue-200 bg-blue-50 text-blue-800';
}

async function loadExecutiveReport(params: {
    fromDate: string;
    toDate: string;
    stationId: string;
}): Promise<ExecutiveReport> {
    const search = new URLSearchParams({
        from: params.fromDate,
        to: params.toDate,
        ...(params.stationId !== 'all' ? { stationId: params.stationId } : {}),
    });
    const res = await fetch(`/api/v2/gas/admin/reports/executive?${search}`);
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
        throw new Error(data.error || 'โหลดรายงานไม่สำเร็จ');
    }

    return data.report;
}

function MetricCard({
    label,
    value,
    sublabel,
    accent = 'text-slate-950',
}: {
    label: string;
    value: string;
    sublabel?: string;
    accent?: string;
}) {
    return (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
            <div className={`mt-2 text-2xl font-black ${accent}`}>{value}</div>
            {sublabel && <div className="mt-1 text-xs text-slate-500">{sublabel}</div>}
        </div>
    );
}

function SectionTitle({
    icon,
    title,
    subtitle,
}: {
    icon: ReactNode;
    title: string;
    subtitle?: string;
}) {
    return (
        <div className="mb-4 flex items-start justify-between gap-4 border-b border-slate-200 pb-3">
            <div className="flex items-start gap-3">
                <div className="rounded-lg bg-orange-50 p-2 text-orange-600">{icon}</div>
                <div>
                    <h2 className="text-lg font-black text-slate-950">{title}</h2>
                    {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
                </div>
            </div>
        </div>
    );
}

function ReportTable({
    children,
}: {
    children: ReactNode;
}) {
    return (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
                {children}
            </table>
        </div>
    );
}

export default function GasExecutivePrintReportPage() {
    const [fromDate, setFromDate] = useState(getDefaultFromDate);
    const [toDate, setToDate] = useState(getGasBusinessDateKey);
    const [stationId, setStationId] = useState('all');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [report, setReport] = useState<ExecutiveReport | null>(null);

    useEffect(() => {
        let cancelled = false;

        const run = async () => {
            setLoading(true);
            setError(null);
            try {
                const nextReport = await loadExecutiveReport({ fromDate, toDate, stationId });
                if (!cancelled) setReport(nextReport);
            } catch (err) {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : 'โหลดรายงานไม่สำเร็จ');
                    setReport(null);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        void run();
        return () => {
            cancelled = true;
        };
    }, [fromDate, toDate, stationId]);

    const refresh = async () => {
        setLoading(true);
        setError(null);
        try {
            setReport(await loadExecutiveReport({ fromDate, toDate, stationId }));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'โหลดรายงานไม่สำเร็จ');
            setReport(null);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <style>{`
                @page {
                    size: A4;
                    margin: 10mm;
                }

                @media print {
                    html, body {
                        background: #ffffff !important;
                    }

                    header, aside, nav, .no-print {
                        display: none !important;
                    }

                    main {
                        padding: 0 !important;
                        margin: 0 !important;
                    }

                    .executive-print-shell {
                        background: #ffffff !important;
                        padding: 0 !important;
                    }

                    .executive-report-paper {
                        width: 100% !important;
                        max-width: none !important;
                        margin: 0 !important;
                        box-shadow: none !important;
                        border: 0 !important;
                        color: #0f172a !important;
                    }

                    .print-break-inside-avoid {
                        break-inside: avoid;
                    }

                    thead {
                        display: table-header-group;
                    }
                }
            `}</style>

            <div className="no-print flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="flex items-center gap-2 text-2xl font-bold">
                        <FileText className="text-orange-400" />
                        รายงานผู้บริหารแบบพิมพ์
                    </h1>
                    <p className="mt-1 text-sm text-gray-400">
                        รวมรายได้ รายงานมิเตอร์ และรายการลงแก๊สตามช่วงเวลาที่เลือก สำหรับพิมพ์หรือบันทึกเป็น PDF
                    </p>
                </div>

                <div className="flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={() => void refresh()}
                        className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
                    >
                        <RefreshCcw size={16} />
                        รีเฟรช
                    </button>
                    <button
                        type="button"
                        onClick={() => window.print()}
                        disabled={!report || loading}
                        className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-bold text-white hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <Printer size={16} />
                        พิมพ์ / PDF
                    </button>
                </div>
            </div>

            <div className="no-print rounded-xl border border-white/10 bg-[#1a1a24] p-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                    <div>
                        <label className="mb-1 block text-sm text-gray-400">ปั๊ม</label>
                        <select
                            value={stationId}
                            onChange={(e) => setStationId(e.target.value)}
                            className="w-full rounded-lg border border-white/10 bg-gray-800 px-3 py-2"
                        >
                            {GAS_STATIONS.map((station) => (
                                <option key={station.id} value={station.id}>{station.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="mb-1 block text-sm text-gray-400">จากวันที่</label>
                        <input
                            type="date"
                            value={fromDate}
                            onChange={(e) => setFromDate(e.target.value)}
                            className="w-full rounded-lg border border-white/10 bg-gray-800 px-3 py-2"
                        />
                    </div>
                    <div>
                        <label className="mb-1 block text-sm text-gray-400">ถึงวันที่</label>
                        <input
                            type="date"
                            value={toDate}
                            onChange={(e) => setToDate(e.target.value)}
                            className="w-full rounded-lg border border-white/10 bg-gray-800 px-3 py-2"
                        />
                    </div>
                    <div className="flex items-end">
                        <div className="rounded-lg border border-orange-500/25 bg-orange-500/10 px-4 py-3 text-sm text-orange-100">
                            ใช้วันที่ตาม business day ของ GAS รวมกะค่ำที่ข้ามวัน
                        </div>
                    </div>
                </div>
            </div>

            {loading && (
                <div className="flex min-h-[360px] items-center justify-center">
                    <Loader2 className="animate-spin text-orange-400" size={42} />
                </div>
            )}

            {error && !loading && (
                <div className="no-print rounded-xl border border-red-500/30 bg-red-500/10 p-5 text-red-100">
                    {error}
                </div>
            )}

            {report && !loading && (
                <div className="executive-print-shell rounded-2xl bg-slate-200/10 p-4">
                    <article className="executive-report-paper mx-auto max-w-[1120px] overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-950 shadow-2xl">
                        <section className="bg-slate-950 px-8 py-8 text-white">
                            <div className="flex flex-wrap items-start justify-between gap-6">
                                <div>
                                    <div className="text-sm font-semibold uppercase tracking-[0.28em] text-orange-300">
                                        Gas Executive Report
                                    </div>
                                    <h1 className="mt-3 text-3xl font-black">รายงานเสนอผู้บริหาร</h1>
                                    <p className="mt-2 text-sm text-slate-300">
                                        รายงานรายได้ เลขมิเตอร์ และรายการลงแก๊ส สำหรับ {report.meta.stationLabel}
                                    </p>
                                </div>
                                <div className="rounded-xl border border-white/15 bg-white/10 p-4 text-right text-sm">
                                    <div className="flex items-center justify-end gap-2 text-orange-200">
                                        <CalendarDays size={16} />
                                        ช่วงรายงาน
                                    </div>
                                    <div className="mt-2 text-xl font-black">{report.meta.from} - {report.meta.to}</div>
                                    <div className="mt-1 text-slate-300">พิมพ์เมื่อ {formatGeneratedAt(report.meta.generatedAt)}</div>
                                </div>
                            </div>
                        </section>

                        <section className="grid grid-cols-2 gap-4 px-8 py-6 lg:grid-cols-4">
                            <MetricCard
                                label="รายได้รวม"
                                value={`฿${formatCurrency(report.kpis.totalRevenue)}`}
                                sublabel={`${report.kpis.transactionCount.toLocaleString('th-TH')} รายการ | Avg ฿${formatCurrency(report.kpis.averageTicket)}`}
                                accent="text-green-700"
                            />
                            <MetricCard
                                label="ยอดรับจริง"
                                value={`฿${formatCurrency(report.kpis.totalReceived)}`}
                                sublabel={`ส่วนต่าง ${report.kpis.variance >= 0 ? '+' : ''}฿${formatCurrency(report.kpis.variance)}`}
                                accent={report.kpis.variance >= 0 ? 'text-cyan-700' : 'text-red-700'}
                            />
                            <MetricCard
                                label="ลิตรขาย"
                                value={`${formatNumber(report.kpis.transactionLiters)} L`}
                                sublabel={`มิเตอร์ ${formatNumber(report.kpis.meterLiters)} L`}
                                accent="text-blue-700"
                            />
                            <MetricCard
                                label="ลงแก๊สเข้า"
                                value={`${formatNumber(report.kpis.supplyLiters)} L`}
                                sublabel={`ต้นทุน ฿${formatCurrency(report.kpis.supplyCost)}`}
                                accent="text-orange-700"
                            />
                        </section>

                        <section className="grid gap-6 px-8 pb-8 lg:grid-cols-[1.15fr_0.85fr]">
                            <div className="print-break-inside-avoid rounded-2xl border border-slate-200 p-5">
                                <SectionTitle
                                    icon={<TrendingUp size={20} />}
                                    title="สรุปรายได้"
                                    subtitle="แยกตามปั๊มและรูปแบบการชำระเงิน"
                                />
                                <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                                    <div className="rounded-lg bg-green-50 p-3">
                                        <div className="text-xs text-slate-500">เงินสด</div>
                                        <div className="font-black text-green-700">฿{formatCurrency(report.revenue.paymentMix.cash)}</div>
                                    </div>
                                    <div className="rounded-lg bg-violet-50 p-3">
                                        <div className="text-xs text-slate-500">เงินเชื่อ</div>
                                        <div className="font-black text-violet-700">฿{formatCurrency(report.revenue.paymentMix.credit)}</div>
                                    </div>
                                    <div className="rounded-lg bg-blue-50 p-3">
                                        <div className="text-xs text-slate-500">บัตร</div>
                                        <div className="font-black text-blue-700">฿{formatCurrency(report.revenue.paymentMix.card)}</div>
                                    </div>
                                    <div className="rounded-lg bg-cyan-50 p-3">
                                        <div className="text-xs text-slate-500">โอน</div>
                                        <div className="font-black text-cyan-700">฿{formatCurrency(report.revenue.paymentMix.transfer)}</div>
                                    </div>
                                </div>

                                <ReportTable>
                                    <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                                        <tr>
                                            <th className="px-3 py-2">ปั๊ม</th>
                                            <th className="px-3 py-2 text-right">รายได้</th>
                                            <th className="px-3 py-2 text-right">รับจริง</th>
                                            <th className="px-3 py-2 text-right">ลิตร</th>
                                            <th className="px-3 py-2 text-right">ส่วนต่าง</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {report.revenue.stationRows.map((row) => (
                                            <tr key={row.stationId}>
                                                <td className="px-3 py-2 font-semibold">{row.stationName}</td>
                                                <td className="px-3 py-2 text-right font-mono">฿{formatCurrency(row.totalSales)}</td>
                                                <td className="px-3 py-2 text-right font-mono">฿{formatCurrency(row.totalReceived)}</td>
                                                <td className="px-3 py-2 text-right font-mono">{formatNumber(row.totalLiters)} L</td>
                                                <td className={`px-3 py-2 text-right font-mono ${row.variance >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                                                    {row.variance >= 0 ? '+' : ''}฿{formatCurrency(row.variance)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </ReportTable>
                            </div>

                            <div className="print-break-inside-avoid rounded-2xl border border-slate-200 p-5">
                                <SectionTitle
                                    icon={<AlertTriangle size={20} />}
                                    title="ข้อสังเกตผู้บริหาร"
                                    subtitle="ประเด็นที่ควรตรวจหรือใช้ประกอบการตัดสินใจ"
                                />
                                <div className="space-y-3">
                                    {report.managementNotes.map((note) => (
                                        <div
                                            key={`${note.severity}:${note.title}`}
                                            className={`rounded-xl border p-3 ${getSeverityClass(note.severity)}`}
                                        >
                                            <div className="text-sm font-black">{note.title}</div>
                                            <div className="mt-1 text-sm leading-6">{note.detail}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </section>

                        <section className="px-8 pb-8">
                            <div className="print-break-inside-avoid rounded-2xl border border-slate-200 p-5">
                                <SectionTitle
                                    icon={<Gauge size={20} />}
                                    title="รายงานเลขมิเตอร์"
                                    subtitle="เทียบลิตรจากมิเตอร์กับรายการขาย พร้อมสถานะเลขต่อกะ"
                                />
                                <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                                    <MetricCard
                                        label="กะในรายงาน"
                                        value={report.kpis.shiftCount.toLocaleString('th-TH')}
                                        sublabel={report.kpis.openShiftCount > 0 ? `${report.kpis.openShiftCount} กะยังเปิดอยู่` : 'ปิดครบในช่วงรายงาน'}
                                    />
                                    <MetricCard
                                        label="ลิตรมิเตอร์"
                                        value={`${formatNumber(report.kpis.meterLiters)} L`}
                                    />
                                    <MetricCard
                                        label="ลิตรจากรายการ"
                                        value={`${formatNumber(report.kpis.transactionLiters)} L`}
                                    />
                                    <MetricCard
                                        label="มิเตอร์ไม่ต่อ"
                                        value={report.kpis.continuityIssues.toLocaleString('th-TH')}
                                        accent={report.kpis.continuityIssues > 0 ? 'text-red-700' : 'text-green-700'}
                                    />
                                </div>

                                <ReportTable>
                                    <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                                        <tr>
                                            <th className="px-3 py-2">วันที่</th>
                                            <th className="px-3 py-2">ปั๊ม</th>
                                            <th className="px-3 py-2">กะ</th>
                                            <th className="px-3 py-2 text-right">มิเตอร์</th>
                                            <th className="px-3 py-2 text-right">รายการขาย</th>
                                            <th className="px-3 py-2 text-right">ต่าง</th>
                                            <th className="px-3 py-2 text-right">รายได้</th>
                                            <th className="px-3 py-2 text-center">สถานะ</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {report.meters.shiftRows.map((row) => (
                                            <tr key={row.id}>
                                                <td className="px-3 py-2">{row.dateKey}</td>
                                                <td className="px-3 py-2">{row.stationName}</td>
                                                <td className="px-3 py-2">{getShiftLabel(row.shiftNumber)}</td>
                                                <td className="px-3 py-2 text-right font-mono">{formatNumber(row.meterLiters)} L</td>
                                                <td className="px-3 py-2 text-right font-mono">{formatNumber(row.transactionLiters)} L</td>
                                                <td className={`px-3 py-2 text-right font-mono ${row.litersVariance >= 0 ? 'text-amber-700' : 'text-red-700'}`}>
                                                    {row.litersVariance >= 0 ? '+' : ''}{formatNumber(row.litersVariance)} L
                                                </td>
                                                <td className="px-3 py-2 text-right font-mono">฿{formatCurrency(row.sales)}</td>
                                                <td className="px-3 py-2 text-center">
                                                    {row.isSyntheticOrphan
                                                        ? <span className="rounded bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">ไม่ผูกกะ</span>
                                                        : row.continuityIssueCount > 0
                                                            ? <span className="rounded bg-red-100 px-2 py-1 text-xs font-semibold text-red-800">ไม่ต่อ</span>
                                                            : <span className="rounded bg-green-100 px-2 py-1 text-xs font-semibold text-green-800">ปกติ</span>}
                                                </td>
                                            </tr>
                                        ))}
                                        {report.meters.shiftRows.length === 0 && (
                                            <tr>
                                                <td className="px-3 py-6 text-center text-slate-500" colSpan={8}>ไม่มีข้อมูลมิเตอร์ในช่วงนี้</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </ReportTable>
                            </div>
                        </section>

                        <section className="grid gap-6 px-8 pb-8 lg:grid-cols-[0.9fr_1.1fr]">
                            <div className="print-break-inside-avoid rounded-2xl border border-slate-200 p-5">
                                <SectionTitle
                                    icon={<BarChart3 size={20} />}
                                    title="สรุปหัวจ่าย"
                                    subtitle="ลิตรและยอดขายประเมินจากมิเตอร์ต่อหัวจ่าย"
                                />
                                <ReportTable>
                                    <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                                        <tr>
                                            <th className="px-3 py-2">ปั๊ม</th>
                                            <th className="px-3 py-2 text-center">หัว</th>
                                            <th className="px-3 py-2 text-right">ลิตร</th>
                                            <th className="px-3 py-2 text-right">ยอดประเมิน</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {report.meters.totalsByNozzle.map((row) => (
                                            <tr key={`${row.stationId}:${row.nozzleNumber}`}>
                                                <td className="px-3 py-2">{row.stationName}</td>
                                                <td className="px-3 py-2 text-center font-mono">{row.nozzleNumber}</td>
                                                <td className="px-3 py-2 text-right font-mono">{formatNumber(row.liters)} L</td>
                                                <td className="px-3 py-2 text-right font-mono">฿{formatCurrency(row.estimatedSales)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </ReportTable>
                            </div>

                            <div className="print-break-inside-avoid rounded-2xl border border-slate-200 p-5">
                                <SectionTitle
                                    icon={<PackagePlus size={20} />}
                                    title="รายการลงแก๊ส"
                                    subtitle="ปริมาณรับเข้า ต้นทุน และเอกสารใบส่งในช่วงรายงาน"
                                />
                                <div className="mb-4 grid grid-cols-3 gap-3">
                                    <div className="rounded-lg bg-orange-50 p-3">
                                        <div className="text-xs text-slate-500">รับเข้ารวม</div>
                                        <div className="font-black text-orange-700">{formatNumber(report.kpis.supplyLiters)} L</div>
                                    </div>
                                    <div className="rounded-lg bg-blue-50 p-3">
                                        <div className="text-xs text-slate-500">ต้นทุนรวม</div>
                                        <div className="font-black text-blue-700">฿{formatCurrency(report.kpis.supplyCost)}</div>
                                    </div>
                                    <div className="rounded-lg bg-slate-50 p-3">
                                        <div className="text-xs text-slate-500">ทุนเฉลี่ย</div>
                                        <div className="font-black text-slate-900">
                                            {report.kpis.averageSupplyCost !== null ? `฿${formatCurrency(report.kpis.averageSupplyCost)}` : '-'}
                                        </div>
                                    </div>
                                </div>

                                <ReportTable>
                                    <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                                        <tr>
                                            <th className="px-3 py-2">วันที่</th>
                                            <th className="px-3 py-2">ปั๊ม</th>
                                            <th className="px-3 py-2 text-right">ลิตร</th>
                                            <th className="px-3 py-2 text-right">ต้นทุน</th>
                                            <th className="px-3 py-2">ใบส่ง</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {report.supplies.rows.map((row) => (
                                            <tr key={row.id}>
                                                <td className="px-3 py-2">{row.date}</td>
                                                <td className="px-3 py-2">{row.stationName || row.stationId}</td>
                                                <td className="px-3 py-2 text-right font-mono">{formatNumber(row.liters)} L</td>
                                                <td className="px-3 py-2 text-right font-mono">
                                                    {row.totalCost !== null ? `฿${formatCurrency(row.totalCost)}` : '-'}
                                                </td>
                                                <td className="px-3 py-2">
                                                    <div className="font-medium">{row.invoiceNo || '-'}</div>
                                                    <div className="text-xs text-slate-500">{row.supplier || ''}</div>
                                                </td>
                                            </tr>
                                        ))}
                                        {report.supplies.rows.length === 0 && (
                                            <tr>
                                                <td className="px-3 py-6 text-center text-slate-500" colSpan={5}>ไม่มีรายการลงแก๊สในช่วงนี้</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </ReportTable>
                            </div>
                        </section>

                        <section className="border-t border-slate-200 bg-slate-50 px-8 py-5 text-xs text-slate-500">
                            รายงานนี้สร้างจากข้อมูล GAS v2: shift analytics, transactions, meter readings, reconciliation และ gas supplies ตามช่วง business day ที่เลือก
                        </section>
                    </article>
                </div>
            )}
        </div>
    );
}
