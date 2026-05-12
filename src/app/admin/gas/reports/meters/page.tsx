'use client';

import { useEffect, useState } from 'react';
import { Loader2, Calculator, Download, Search, Edit3 } from 'lucide-react';
import { formatCurrency, getGasBusinessDateKey, getShiftTimeRangeLabel } from '@/lib/gas';

interface MeterReport {
    id: string;
    date: string;
    displayDate: string;
    stationId: string;
    stationName: string;
    shiftNumber: number;
    status: string;
    isSyntheticOrphan?: boolean;
    nozzles: {
        nozzleNumber: number;
        startReading: number;
        endReading: number;
        soldQty: number;
    }[];
    continuity: {
        checked: boolean;
        isContinuous: boolean;
        issueCount: number;
        maxGap: number;
        issues: {
            nozzleNumber: number;
            previousDateKey: string;
            previousShiftNumber: number;
            previousEndReading: number;
            currentStartReading: number;
            gap: number;
        }[];
    };
    totalLiters: number;
    transactionLiters: number;
    litersVariance: number;
    gasPrice: number;
    expectedSales: number;
    actualSales: number;
    transactionCount: number;
    averagePerNozzle: number;
}

function getShiftSortRank(report: MeterReport): number {
    if (report.isSyntheticOrphan) return 99;
    if (report.shiftNumber === 2) return 0;
    if (report.shiftNumber === 1) return 1;
    return 10 + report.shiftNumber;
}

function sortMeterReports(reports: MeterReport[]): MeterReport[] {
    return [...reports].sort((left, right) => (
        right.date.localeCompare(left.date)
        || left.stationName.localeCompare(right.stationName, 'th')
        || getShiftSortRank(left) - getShiftSortRank(right)
        || left.id.localeCompare(right.id)
    ));
}

async function loadMeterReports({
    fromDate,
    toDate,
    stationId,
    setLoading,
    setReports,
}: {
    fromDate: string;
    toDate: string;
    stationId: string;
    setLoading: (value: boolean) => void;
    setReports: (value: MeterReport[]) => void;
}) {
    setLoading(true);
    try {
        const params = new URLSearchParams({
            from: fromDate,
            to: toDate,
            ...(stationId !== 'all' && { stationId }),
        });

        const res = await fetch(`/api/v2/gas/admin/reports/meters?${params}`);
        if (res.ok) {
            const data = await res.json();
            setReports(sortMeterReports(data.meters || []));
        }
    } catch (error) {
        console.error('Error fetching reports:', error);
    } finally {
        setLoading(false);
    }
}

export default function MeterReportPage() {
    const [loading, setLoading] = useState(true);
    const [reports, setReports] = useState<MeterReport[]>([]);
    const [stationId, setStationId] = useState<string>('all');
    const [fromDate, setFromDate] = useState<string>(() => {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        return d.toISOString().split('T')[0];
    });
    const [toDate, setToDate] = useState<string>(getGasBusinessDateKey());
    const [stations, setStations] = useState<{ id: string; name: string }[]>([]);

    useEffect(() => {
        fetch('/api/stations')
            .then(res => res.json())
            .then(data => {
                const stationList = Array.isArray(data) ? data : (data.stations || []);
                const gasStations = stationList.filter((s: { type?: string }) => s.type === 'GAS');
                setStations(gasStations);
            })
            .catch(console.error);
    }, []);

    useEffect(() => {
        void loadMeterReports({
            fromDate,
            toDate,
            stationId,
            setLoading,
            setReports,
        });
    }, [fromDate, toDate, stationId]);

    const handleExportCSV = async () => {
        const params = new URLSearchParams({
            from: fromDate,
            to: toDate,
            type: 'meters',
            ...(stationId !== 'all' && { stationId })
        });
        window.open(`/api/export/csv?${params}`, '_blank');
    };

    const getEditReconciliationUrl = (report: MeterReport): string => {
        const params = new URLSearchParams({
            from: fromDate,
            to: toDate,
            stationId: report.stationId,
            editShiftId: report.id,
        });

        return `/admin/gas/reconciliation?${params}`;
    };

    const totals = reports.reduce((sum, report) => ({
        meterLiters: sum.meterLiters + report.totalLiters,
        transactionLiters: sum.transactionLiters + report.transactionLiters,
        actualSales: sum.actualSales + report.actualSales,
        expectedSales: sum.expectedSales + report.expectedSales,
        transactions: sum.transactions + report.transactionCount,
        comparableVariance: sum.comparableVariance + (report.isSyntheticOrphan ? 0 : report.litersVariance),
        unassignedLiters: sum.unassignedLiters + (report.isSyntheticOrphan ? report.transactionLiters : 0),
        unassignedSales: sum.unassignedSales + (report.isSyntheticOrphan ? report.actualSales : 0),
        unassignedTransactions: sum.unassignedTransactions + (report.isSyntheticOrphan ? report.transactionCount : 0),
        continuityIssues: sum.continuityIssues + (report.continuity?.issueCount || 0),
        discontinuousShifts: sum.discontinuousShifts + ((report.continuity?.issueCount || 0) > 0 ? 1 : 0),
    }), {
        meterLiters: 0,
        transactionLiters: 0,
        actualSales: 0,
        expectedSales: 0,
        transactions: 0,
        comparableVariance: 0,
        unassignedLiters: 0,
        unassignedSales: 0,
        unassignedTransactions: 0,
        continuityIssues: 0,
        discontinuousShifts: 0,
    });

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Calculator className="text-orange-400" />
                        รายงานมิเตอร์
                    </h1>
                </div>

                <button
                    onClick={handleExportCSV}
                    className="flex items-center gap-2 bg-green-600 hover:bg-green-500 px-4 py-2 rounded-lg text-sm"
                >
                    <Download size={18} />
                    Export CSV
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="bg-[#1a1a24] rounded-xl p-4 border border-white/10">
                    <div className="text-sm text-gray-400">ลิตรมิเตอร์รวม</div>
                    <div className="text-2xl font-bold text-green-400">{totals.meterLiters.toLocaleString()} L</div>
                </div>
                <div className="bg-[#1a1a24] rounded-xl p-4 border border-white/10">
                    <div className="text-sm text-gray-400">ลิตรจากรายการขาย</div>
                    <div className="text-2xl font-bold text-cyan-400">{totals.transactionLiters.toLocaleString()} L</div>
                </div>
                <div className="bg-[#1a1a24] rounded-xl p-4 border border-white/10">
                    <div className="text-sm text-gray-400">ยอดรับจริง</div>
                    <div className="text-2xl font-bold text-blue-400">฿{formatCurrency(totals.actualSales)}</div>
                </div>
                <div className="bg-[#1a1a24] rounded-xl p-4 border border-white/10">
                    <div className="text-sm text-gray-400">ส่วนต่างที่เทียบมิเตอร์ได้</div>
                    <div className={`text-2xl font-bold ${totals.comparableVariance >= 0 ? 'text-yellow-400' : 'text-red-400'}`}>
                        {totals.comparableVariance >= 0 ? '+' : ''}
                        {totals.comparableVariance.toLocaleString()} L
                    </div>
                </div>
                <div className="bg-[#1a1a24] rounded-xl p-4 border border-white/10">
                    <div className="text-sm text-gray-400">มิเตอร์ไม่ต่อกะ</div>
                    <div className={`text-2xl font-bold ${totals.continuityIssues > 0 ? 'text-red-400' : 'text-green-400'}`}>
                        {totals.continuityIssues}
                    </div>
                    <div className="text-xs text-gray-500">{totals.discontinuousShifts} กะที่ต้องตรวจ</div>
                </div>
            </div>

            {totals.unassignedTransactions > 0 && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
                    <div className="font-semibold text-amber-200">
                        มีรายการขายที่ยังไม่ผูกกะ {totals.unassignedTransactions.toLocaleString()} รายการ
                    </div>
                    <div className="mt-1 text-amber-100/80">
                        รวม ฿{formatCurrency(totals.unassignedSales)} / {totals.unassignedLiters.toLocaleString()} L
                        ระบบแสดงยอดขายไว้ให้ผู้จัดการเห็นก่อน แต่ยังไม่นับเป็นส่วนต่างมิเตอร์จนกว่าจะผูกกะหรือมีมิเตอร์ประกบ
                    </div>
                </div>
            )}

            {totals.continuityIssues > 0 && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">
                    <div className="font-semibold text-red-200">
                        พบเลขมิเตอร์เริ่มกะไม่ต่อจากเลขปิดกะก่อน {totals.continuityIssues.toLocaleString()} จุด
                    </div>
                    <div className="mt-1 text-red-100/80">
                        ให้ตรวจแถวที่ขึ้น “ไม่ต่อ” ในตารางด้านล่าง เพื่อดูหัวจ่ายและส่วนต่างจากกะก่อนหน้า
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="bg-[#1a1a24] rounded-xl p-4 border border-white/10">
                <div className="flex flex-wrap items-end gap-4">
                    <div className="flex-1 min-w-[150px]">
                        <label className="block text-sm text-gray-400 mb-1">ปั๊ม</label>
                        <select
                            value={stationId}
                            onChange={(e) => setStationId(e.target.value)}
                            className="w-full bg-gray-800 border border-white/10 rounded-lg px-3 py-2"
                        >
                            <option value="all">ทุกปั๊ม</option>
                            {stations.map((s) => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="min-w-[130px]">
                        <label className="block text-sm text-gray-400 mb-1">จากวันที่</label>
                        <input
                            type="date"
                            value={fromDate}
                            onChange={(e) => setFromDate(e.target.value)}
                            className="w-full bg-gray-800 border border-white/10 rounded-lg px-3 py-2"
                        />
                    </div>

                    <div className="min-w-[130px]">
                        <label className="block text-sm text-gray-400 mb-1">ถึงวันที่</label>
                        <input
                            type="date"
                            value={toDate}
                            onChange={(e) => setToDate(e.target.value)}
                            className="w-full bg-gray-800 border border-white/10 rounded-lg px-3 py-2"
                        />
                    </div>

                    <button
                        onClick={() => {
                            void loadMeterReports({
                                fromDate,
                                toDate,
                                stationId,
                                setLoading,
                                setReports,
                            });
                        }}
                        className="flex items-center gap-2 bg-orange-600 hover:bg-orange-500 px-4 py-2 rounded-lg"
                    >
                        <Search size={18} />
                        ค้นหา
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="bg-[#1a1a24] rounded-xl border border-white/10 overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center p-12">
                        <Loader2 className="animate-spin text-purple-400" size={32} />
                    </div>
                ) : reports.length === 0 ? (
                    <div className="p-12 text-center text-gray-500">
                        ไม่พบข้อมูล
                    </div>
                ) : (
                    <div className="w-full overflow-hidden">
                        <table className="w-full table-fixed text-xs xl:text-sm">
                            <thead className="bg-gray-800/50">
                                <tr>
                                    <th className="w-[13%] text-left px-3 py-3 font-medium text-gray-400">วันที่ / สถานี</th>
                                    <th className="w-[6%] text-center px-2 py-3 font-medium text-gray-400">กะ</th>
                                    <th className="w-[10%] text-right px-2 py-3 font-medium text-gray-400">หัว 1</th>
                                    <th className="w-[10%] text-right px-2 py-3 font-medium text-gray-400">หัว 2</th>
                                    <th className="w-[10%] text-right px-2 py-3 font-medium text-gray-400">หัว 3</th>
                                    <th className="w-[10%] text-right px-2 py-3 font-medium text-gray-400">หัว 4</th>
                                    <th className="w-[12%] text-left px-3 py-3 font-medium text-gray-400">ต่อกะก่อน</th>
                                    <th className="w-[12%] text-right px-3 py-3 font-medium text-gray-400">สรุปลิตร</th>
                                    <th className="w-[5%] text-right px-2 py-3 font-medium text-gray-400">รายการ</th>
                                    <th className="w-[12%] text-right px-3 py-3 font-medium text-gray-400">ยอดเงิน</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {reports.map((r) => {
                                    const shiftTimeRange = getShiftTimeRangeLabel(r.shiftNumber);

                                    return (
                                        <tr
                                            key={r.id}
                                            className={r.isSyntheticOrphan
                                                ? 'bg-amber-500/5 hover:bg-amber-500/10'
                                                : 'hover:bg-white/5'}
                                        >
                                        <td className="px-3 py-3 align-top">
                                            <div className="font-medium text-gray-100">{r.displayDate}</div>
                                            <div className="mt-1 leading-tight text-gray-400">{r.stationName}</div>
                                        </td>
                                        <td className="px-2 py-3 text-center align-top">
                                            <span className={`inline-block rounded px-1.5 py-1 text-xs leading-none ${r.isSyntheticOrphan
                                                ? 'bg-amber-900/60 text-amber-200'
                                                : r.shiftNumber === 1
                                                    ? 'bg-blue-900/50 text-blue-300'
                                                    : 'bg-purple-900/50 text-purple-300'
                                                }`}>
                                                {r.isSyntheticOrphan ? 'ไม่ผูกกะ' : `กะ ${r.shiftNumber}`}
                                            </span>
                                            {shiftTimeRange && (
                                                <div className="mt-1 text-[10px] leading-tight text-gray-500">
                                                    {shiftTimeRange}
                                                </div>
                                            )}
                                        </td>
                                        {[1, 2, 3, 4].map(n => {
                                            const nozzle = r.nozzles.find(z => z.nozzleNumber === n);
                                            return (
                                                <td key={n} className="px-2 py-2 text-right align-top">
                                                    {nozzle ? (
                                                        <div className="space-y-0.5">
                                                            <div className="font-mono font-bold leading-tight text-green-400">
                                                                {nozzle.soldQty.toLocaleString()}
                                                            </div>
                                                            <div className="break-words font-mono text-[11px] leading-tight text-gray-500">
                                                                {nozzle.startReading.toLocaleString()} - {nozzle.endReading.toLocaleString()}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <span className="text-gray-600">-</span>
                                                    )}
                                                </td>
                                            );
                                        })}
                                        <td className="px-3 py-3 align-top">
                                            {r.isSyntheticOrphan ? (
                                                <span className="text-xs text-amber-300">รอผูกกะ</span>
                                            ) : !r.continuity?.checked ? (
                                                <span className="text-xs text-gray-500">ยังไม่มีกะก่อนหน้า</span>
                                            ) : r.continuity.isContinuous ? (
                                                <span className="rounded bg-green-900/40 px-2 py-1 text-xs text-green-300">
                                                    ต่อกัน
                                                </span>
                                            ) : (
                                                <div className="space-y-1">
                                                    <span className="rounded bg-red-900/50 px-2 py-1 text-xs text-red-200">
                                                        ไม่ต่อ {r.continuity.issueCount} จุด
                                                    </span>
                                                    <div className="text-[11px] leading-tight text-red-200/80">
                                                        {r.continuity.issues.slice(0, 2).map((issue) => (
                                                            <div key={`${r.id}-${issue.nozzleNumber}`}>
                                                                หัว {issue.nozzleNumber}: {issue.gap >= 0 ? '+' : ''}{issue.gap.toLocaleString()} L
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-3 py-3 text-right align-top font-mono leading-tight">
                                            <div className="font-bold text-green-400">{r.totalLiters.toLocaleString()} L</div>
                                            <div className="mt-1 text-cyan-400">ขาย {r.transactionLiters.toLocaleString()} L</div>
                                            <div className={r.isSyntheticOrphan
                                                ? 'mt-1 text-amber-300'
                                                : r.litersVariance >= 0
                                                    ? 'mt-1 text-yellow-400'
                                                    : 'mt-1 text-red-400'
                                            }>
                                                {r.isSyntheticOrphan
                                                    ? 'รอผูกกะ'
                                                    : `ต่าง ${r.litersVariance >= 0 ? '+' : ''}${r.litersVariance.toLocaleString()}`}
                                            </div>
                                        </td>
                                        <td className="px-2 py-3 text-right align-top">
                                            {r.transactionCount}
                                        </td>
                                        <td className="px-3 py-3 text-right align-top font-mono leading-tight">
                                            <div className="font-semibold text-blue-400">รับ ฿{formatCurrency(r.actualSales)}</div>
                                            <div className="mt-1 text-cyan-400">
                                                {r.isSyntheticOrphan ? 'รอมิเตอร์' : `คาด ฿${formatCurrency(r.expectedSales)}`}
                                            </div>
                                            {!r.isSyntheticOrphan && (
                                                <a
                                                    href={getEditReconciliationUrl(r)}
                                                    className="mt-2 inline-flex items-center gap-1 rounded bg-orange-600 px-2 py-1 font-sans text-[11px] font-semibold text-white hover:bg-orange-500"
                                                >
                                                    <Edit3 size={12} />
                                                    แก้ยอด
                                                </a>
                                            )}
                                        </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
