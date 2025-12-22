'use client';

import { useState, useEffect, use } from 'react';
import { ArrowLeft, Calendar, TrendingUp, TrendingDown, AlertTriangle, Download, Printer, Package, Fuel } from 'lucide-react';
import { STATIONS } from '@/constants';
import Link from 'next/link';

interface MonthlyBalance {
    year: number;
    month: number;
    summary: {
        openingStock: number;
        totalSupplies: number;
        totalSales: number;
        expectedClosing: number;
        closingStock: number;
        variance: number;
        variancePercent: number;
        isBalanced: boolean;
    };
    supplies: { date: string; liters: number; count: number }[];
    sales: { date: string; liters: number; amount: number; count: number }[];
    transactionCount: number;
    supplyCount: number;
}

export default function MonthlyBalanceReportPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const stationIndex = parseInt(id) - 1;
    const station = STATIONS[stationIndex];

    const now = new Date();
    const [year, setYear] = useState(now.getFullYear());
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<MonthlyBalance | null>(null);

    const monthNames = ['', 'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
        'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];

    useEffect(() => {
        fetchData();
    }, [year, month]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/gas-station/${id}/monthly-balance?year=${year}&month=${month}`);
            if (res.ok) {
                const result = await res.json();
                setData(result);
            }
        } catch (error) {
            console.error('Error fetching monthly balance:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (num: number) =>
        new Intl.NumberFormat('th-TH', { minimumFractionDigits: 0 }).format(num);

    const formatDate = (dateStr: string) =>
        new Date(dateStr).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });

    const handlePrint = () => {
        window.print();
    };

    if (!station) {
        return (
            <div className="min-h-screen bg-[#f6f6f6] flex items-center justify-center">
                <p className="text-neutral-500 font-semibold">ไม่พบสถานี</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f6f6f6] text-neutral-900 print:bg-white">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-[#f6f6f6]/80 backdrop-blur border-b border-black/10 print:hidden">
                <div className="px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link href={`/gas-station/${id}/new/home`} className="p-1">
                            <ArrowLeft size={24} className="text-neutral-700" />
                        </Link>
                        <div>
                            <h1 className="font-extrabold tracking-tight text-lg">รายงานบาลานซ์รายเดือน</h1>
                            <p className="text-xs text-neutral-500 font-semibold">{station.name}</p>
                        </div>
                    </div>
                    <button
                        onClick={handlePrint}
                        className="p-2 rounded-full bg-black text-white hover:bg-neutral-800"
                    >
                        <Printer size={18} />
                    </button>
                </div>
            </header>

            {/* Print Header */}
            <div className="hidden print:block p-4 text-center border-b">
                <h1 className="text-xl font-black">{station.name}</h1>
                <p className="text-neutral-600">รายงานบาลานซ์แก๊ส เดือน{monthNames[month]} {year + 543}</p>
            </div>

            <main className="mx-auto max-w-4xl px-4 py-6 space-y-5">
                {/* Month Selector */}
                <div className="rounded-3xl border border-black/10 bg-white p-6 print:border-none print:shadow-none">
                    <div className="flex flex-wrap items-center gap-4">
                        <Calendar className="text-orange-500" size={24} />
                        <select
                            value={month}
                            onChange={(e) => setMonth(parseInt(e.target.value))}
                            className="rounded-full border border-black/15 px-4 py-2 text-sm font-bold focus:outline-none print:hidden"
                        >
                            {monthNames.slice(1).map((name, i) => (
                                <option key={i + 1} value={i + 1}>{name}</option>
                            ))}
                        </select>
                        <select
                            value={year}
                            onChange={(e) => setYear(parseInt(e.target.value))}
                            className="rounded-full border border-black/15 px-4 py-2 text-sm font-bold focus:outline-none print:hidden"
                        >
                            {[2024, 2025, 2026].map(y => (
                                <option key={y} value={y}>{y + 543}</option>
                            ))}
                        </select>
                        <span className="hidden print:inline font-bold text-lg">
                            {monthNames[month]} {year + 543}
                        </span>
                    </div>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
                    </div>
                ) : data && (
                    <>
                        {/* Balance Summary Card */}
                        <div className="rounded-3xl border border-black/10 bg-white p-6">
                            <h2 className="text-xl font-black tracking-tight mb-5">
                                📊 <span className="bg-blue-200 px-2 rounded">สรุปบาลานซ์</span>
                            </h2>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                                {/* Opening Stock */}
                                <div className="rounded-2xl border border-black/10 bg-gradient-to-br from-neutral-50 to-neutral-100 p-4">
                                    <div className="text-xs font-black text-neutral-500">🏁 ยอดยกมา</div>
                                    <div className="mt-1 text-2xl font-black">{formatCurrency(data.summary.openingStock)}</div>
                                    <div className="text-sm font-semibold text-neutral-500">ลิตร</div>
                                </div>

                                {/* Supplies */}
                                <div className="rounded-2xl border border-black/10 bg-gradient-to-br from-green-50 to-green-100 p-4">
                                    <div className="text-xs font-black text-green-600">+ รับเข้า</div>
                                    <div className="mt-1 text-2xl font-black text-green-700">+{formatCurrency(data.summary.totalSupplies)}</div>
                                    <div className="text-sm font-semibold text-green-600">{data.supplyCount} ครั้ง</div>
                                </div>

                                {/* Sales */}
                                <div className="rounded-2xl border border-black/10 bg-gradient-to-br from-red-50 to-red-100 p-4">
                                    <div className="text-xs font-black text-red-600">- ขายออก</div>
                                    <div className="mt-1 text-2xl font-black text-red-700">-{formatCurrency(data.summary.totalSales)}</div>
                                    <div className="text-sm font-semibold text-red-600">{data.transactionCount} รายการ</div>
                                </div>

                                {/* Expected Closing */}
                                <div className="rounded-2xl border border-black/10 bg-gradient-to-br from-blue-50 to-blue-100 p-4">
                                    <div className="text-xs font-black text-blue-600">= คาดว่าเหลือ</div>
                                    <div className="mt-1 text-2xl font-black text-blue-700">{formatCurrency(data.summary.expectedClosing)}</div>
                                    <div className="text-sm font-semibold text-blue-600">ลิตร</div>
                                </div>
                            </div>

                            {/* Actual vs Expected */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Actual Closing */}
                                <div className="rounded-2xl border border-black/10 bg-[#fafafa] p-5">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Fuel className="text-purple-500" size={20} />
                                        <span className="text-sm font-black text-purple-600">ยอดจริง (จากเกจ)</span>
                                    </div>
                                    <div className="text-3xl font-black">{formatCurrency(data.summary.closingStock)}</div>
                                    <div className="text-sm font-semibold text-neutral-500">ลิตร</div>
                                </div>

                                {/* Variance */}
                                <div className={`rounded-2xl border p-5 ${data.summary.isBalanced
                                        ? 'border-green-200 bg-green-50'
                                        : 'border-red-200 bg-red-50'
                                    }`}>
                                    <div className="flex items-center gap-2 mb-2">
                                        {data.summary.isBalanced ? (
                                            <TrendingUp className="text-green-500" size={20} />
                                        ) : (
                                            <AlertTriangle className="text-red-500" size={20} />
                                        )}
                                        <span className={`text-sm font-black ${data.summary.isBalanced ? 'text-green-600' : 'text-red-600'}`}>
                                            {data.summary.isBalanced ? '✅ บาลานซ์ปกติ' : '⚠️ ส่วนต่าง'}
                                        </span>
                                    </div>
                                    <div className={`text-3xl font-black ${data.summary.isBalanced ? 'text-green-700' : 'text-red-700'}`}>
                                        {data.summary.variance >= 0 ? '+' : ''}{formatCurrency(Math.round(data.summary.variance))}
                                    </div>
                                    <div className={`text-sm font-semibold ${data.summary.isBalanced ? 'text-green-600' : 'text-red-600'}`}>
                                        ลิตร ({data.summary.variancePercent >= 0 ? '+' : ''}{data.summary.variancePercent.toFixed(1)}%)
                                    </div>
                                </div>
                            </div>

                            {!data.summary.isBalanced && Math.abs(data.summary.variance) > 100 && (
                                <div className="mt-4 rounded-xl bg-red-50 border border-red-200 p-4 flex items-center gap-3">
                                    <AlertTriangle className="text-red-500 flex-shrink-0" size={24} />
                                    <div>
                                        <p className="font-extrabold text-red-700">⚠️ ส่วนต่างมากกว่า 5%</p>
                                        <p className="text-sm text-red-600">ควรตรวจสอบการรับเข้า การรั่วไหล หรือความคลาดเคลื่อนของมิเตอร์</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Supplies Detail */}
                        <div className="rounded-3xl border border-black/10 bg-white p-6">
                            <h2 className="text-xl font-black tracking-tight mb-4">
                                📦 <span className="bg-green-200 px-2 rounded">รับแก๊สเข้า</span>
                            </h2>

                            {data.supplies.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-black/10">
                                                <th className="text-left py-3 font-black">วันที่</th>
                                                <th className="text-right py-3 font-black">จำนวน (ลิตร)</th>
                                                <th className="text-right py-3 font-black">ครั้ง</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {data.supplies.map((s, i) => (
                                                <tr key={i} className="border-b border-black/5">
                                                    <td className="py-3 font-semibold">{formatDate(s.date)}</td>
                                                    <td className="py-3 text-right font-bold text-green-600">+{formatCurrency(s.liters)}</td>
                                                    <td className="py-3 text-right text-neutral-500">{s.count}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot>
                                            <tr className="bg-green-50">
                                                <td className="py-3 font-black">รวม</td>
                                                <td className="py-3 text-right font-black text-green-700">+{formatCurrency(data.summary.totalSupplies)}</td>
                                                <td className="py-3 text-right font-bold">{data.supplyCount}</td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            ) : (
                                <div className="text-center py-8 text-neutral-400">
                                    <Package size={40} className="mx-auto mb-2 opacity-50" />
                                    <p className="font-semibold">ไม่มีรายการรับเข้าในเดือนนี้</p>
                                </div>
                            )}
                        </div>

                        {/* Sales Detail */}
                        <div className="rounded-3xl border border-black/10 bg-white p-6">
                            <h2 className="text-xl font-black tracking-tight mb-4">
                                ⛽ <span className="bg-red-200 px-2 rounded">ขายออก</span>
                            </h2>

                            {data.sales.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-black/10">
                                                <th className="text-left py-3 font-black">วันที่</th>
                                                <th className="text-right py-3 font-black">จำนวน (ลิตร)</th>
                                                <th className="text-right py-3 font-black">ยอดเงิน</th>
                                                <th className="text-right py-3 font-black">รายการ</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {data.sales.map((s, i) => (
                                                <tr key={i} className="border-b border-black/5">
                                                    <td className="py-3 font-semibold">{formatDate(s.date)}</td>
                                                    <td className="py-3 text-right font-bold text-red-600">-{formatCurrency(Math.round(s.liters))}</td>
                                                    <td className="py-3 text-right font-semibold">฿{formatCurrency(Math.round(s.amount))}</td>
                                                    <td className="py-3 text-right text-neutral-500">{s.count}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot>
                                            <tr className="bg-red-50">
                                                <td className="py-3 font-black">รวม</td>
                                                <td className="py-3 text-right font-black text-red-700">-{formatCurrency(Math.round(data.summary.totalSales))}</td>
                                                <td className="py-3 text-right font-bold">-</td>
                                                <td className="py-3 text-right font-bold">{data.transactionCount}</td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            ) : (
                                <div className="text-center py-8 text-neutral-400">
                                    <Fuel size={40} className="mx-auto mb-2 opacity-50" />
                                    <p className="font-semibold">ไม่มีรายการขายในเดือนนี้</p>
                                </div>
                            )}
                        </div>

                        {/* Balance Formula Card */}
                        <div className="rounded-3xl border border-black/10 bg-black text-white p-6 print:bg-neutral-100 print:text-black">
                            <h2 className="text-xl font-black tracking-tight mb-3">📝 สูตรคำนวณ</h2>
                            <div className="font-mono text-sm space-y-1">
                                <p><span className="text-neutral-400 print:text-neutral-500">ยอดยกมา:</span> {formatCurrency(data.summary.openingStock)} ลิตร</p>
                                <p><span className="text-green-400 print:text-green-600">+ รับเข้า:</span> {formatCurrency(data.summary.totalSupplies)} ลิตร</p>
                                <p><span className="text-red-400 print:text-red-600">- ขายออก:</span> {formatCurrency(data.summary.totalSales)} ลิตร</p>
                                <hr className="border-neutral-700 print:border-neutral-300 my-2" />
                                <p><span className="text-blue-400 print:text-blue-600">= คาดว่าเหลือ:</span> {formatCurrency(data.summary.expectedClosing)} ลิตร</p>
                                <p><span className="text-purple-400 print:text-purple-600">= ยอดจริง (เกจ):</span> {formatCurrency(data.summary.closingStock)} ลิตร</p>
                                <hr className="border-neutral-700 print:border-neutral-300 my-2" />
                                <p className={data.summary.isBalanced ? 'text-green-400 print:text-green-600' : 'text-red-400 print:text-red-600'}>
                                    <span>= ส่วนต่าง:</span> {data.summary.variance >= 0 ? '+' : ''}{formatCurrency(Math.round(data.summary.variance))} ลิตร ({data.summary.variancePercent.toFixed(1)}%)
                                </p>
                            </div>
                        </div>
                    </>
                )}
            </main>
        </div>
    );
}
