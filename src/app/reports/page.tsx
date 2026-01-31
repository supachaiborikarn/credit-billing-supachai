'use client';

import { useState, useEffect, useMemo } from 'react';
import Sidebar from '@/components/Sidebar';
import Breadcrumb from '@/components/Breadcrumb';
import Spinner, { LoadingState, TableLoadingState } from '@/components/Spinner';
import { formatCurrency, formatNumber, formatCompact } from '@/utils/format';
import {
    FileText,
    Download,
    Calendar,
    TrendingUp,
    TrendingDown,
    Users,
    Fuel,
    DollarSign,
    AlertCircle,
    BarChart3,
    Sparkles,
    Gauge,
    Info,
    Building2,
    CreditCard
} from 'lucide-react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    LineChart,
    Line,
    ReferenceLine
} from 'recharts';

type ReportType = 'daily' | 'monthly' | 'debt' | 'station' | 'gas' | 'shift_meters';

interface DailyData {
    date: string;
    totalAmount: number;
    totalLiters: number;
    transactionCount: number;
    cashAmount: number;
    creditAmount: number;
}

interface MonthlyData {
    month: string;
    totalAmount: number;
    totalLiters: number;
    transactionCount: number;
}

interface DebtData {
    ownerId: string;
    ownerName: string;
    ownerCode: string | null;
    totalAmount: number;
    totalLiters: number;
    transactionCount: number;
    daysPending: number;
}

interface StationData {
    stationId: string;
    stationName: string;
    totalAmount: number;
    totalLiters: number;
    transactionCount: number;
    cashAmount: number;
    creditAmount: number;
}

interface GasData {
    date: string;
    salesLiters: number;
    salesAmount: number;
    suppliesLiters: number;
    transactionCount: number;
    cashAmount: number;
    creditAmount: number;
    cardAmount: number;
}

interface GasStockData {
    stationId: string;
    stationName: string;
    currentStock: number;
    alertLevel: number;
}

interface ShiftMeterData {
    id: string;
    date: string;
    stationName: string;
    stationId: string;
    shiftNumber: number | null;
    status: string;
    staff: string | null;
    openedAt: string | null;
    closedAt: string | null;
    meters: {
        nozzleNumber: number;
        startReading: number | null;
        endReading: number | null;
        soldQty: number | null;
    }[];
    totalSold: number;
    hasMeterData: boolean;

    // Financial data from transactions
    gasPrice?: number;
    transactionCount?: number;
    totalTransactionLiters?: number;
    totalTransactionAmount?: number;
    cashAmount?: number;
    creditAmount?: number;
    transferAmount?: number;
    cardAmount?: number;

    // Reconciliation data
    hasReconciliation?: boolean;
    expectedFuelAmount?: number | null;
    expectedOtherAmount?: number | null;
    totalExpected?: number | null;
    totalReceived?: number | null;
    reconciliationCash?: number | null;
    reconciliationCredit?: number | null;
    reconciliationTransfer?: number | null;
    variance?: number | null;
    varianceStatus?: string | null;

    // Comparison
    meterVsTransactionDiff?: number;
}

interface StationOption {
    id: string;
    name: string;
}

export default function ReportsPage() {
    const [loading, setLoading] = useState(true);
    const [reportType, setReportType] = useState<ReportType>('daily');
    const [data, setData] = useState<DailyData[] | MonthlyData[] | DebtData[] | StationData[] | GasData[] | ShiftMeterData[]>([]);
    const [gasStock, setGasStock] = useState<GasStockData[]>([]);
    const [shiftMetersData, setShiftMetersData] = useState<ShiftMeterData[]>([]);
    const [summary, setSummary] = useState<Record<string, unknown> | null>(null);
    const [mounted, setMounted] = useState(false);
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        return d.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [exporting, setExporting] = useState(false);
    const [stations, setStations] = useState<StationOption[]>([]);
    const [selectedStation, setSelectedStation] = useState<string>('');
    const [selectedShift, setSelectedShift] = useState<string>('');

    useEffect(() => {
        setMounted(true);
        fetchReport();
        // Fetch stations for filter
        fetch('/api/stations').then(res => res.json()).then(data => {
            if (Array.isArray(data)) setStations(data);
        }).catch(console.error);
    }, [reportType, startDate, endDate, selectedStation]);

    const fetchReport = async () => {
        setLoading(true);
        try {
            if (reportType === 'shift_meters') {
                // Fetch shift meters from separate endpoint
                const stationParam = selectedStation ? `&stationId=${selectedStation}` : '';
                const res = await fetch(`/api/reports/shift-meters?startDate=${startDate}&endDate=${endDate}${stationParam}`);
                if (res.ok) {
                    const result = await res.json();
                    setShiftMetersData(result || []);
                    setData([]);
                    setSummary({ totalShifts: result.length });
                }
            } else {
                const res = await fetch(`/api/reports?type=${reportType}&startDate=${startDate}&endDate=${endDate}`);
                if (res.ok) {
                    const result = await res.json();
                    setData(result.data || []);
                    setSummary(result.summary || null);
                    if (result.stockData) {
                        setGasStock(result.stockData);
                    }
                }
            }
        } catch (error) {
            console.error('Error fetching report:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleExport = async () => {
        setExporting(true);
        try {
            const res = await fetch(`/api/export/csv?type=${reportType}&startDate=${startDate}&endDate=${endDate}`);
            if (res.ok) {
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `report_${reportType}_${startDate}_to_${endDate}.csv`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);
            }
        } catch (error) {
            console.error('Export error:', error);
        } finally {
            setExporting(false);
        }
    };



    // Report categories - แยกตามประเภทและมุมมอง
    const salesReports = [
        { value: 'daily', label: 'ยอดขายรายวัน', icon: Calendar },
        { value: 'monthly', label: 'ยอดขายรายเดือน', icon: BarChart3 },
        { value: 'station', label: 'ยอดขายตามสถานี', icon: Building2 },
    ];
    const specialReports = [
        { value: 'debt', label: 'ลูกหนี้ค้างชำระ', icon: CreditCard },
        { value: 'gas', label: 'ปั๊มแก๊ส LPG', icon: Fuel },
        { value: 'shift_meters', label: 'มิเตอร์ตามกะ', icon: Gauge },
    ];

    // Get report label for scope display
    const getReportLabel = () => {
        const all = [...salesReports, ...specialReports];
        return all.find(r => r.value === reportType)?.label || 'รายงาน';
    };

    // Format date for Thai display
    const formatThaiDate = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
    };

    return (
        <Sidebar>
            <div className="max-w-7xl mx-auto relative">
                {/* Breadcrumb */}
                <Breadcrumb items={[{ label: 'รายงาน' }]} className="mb-4" />

                {/* Background orbs */}
                <div className="fixed top-20 right-20 w-[400px] h-[400px] rounded-full opacity-20 blur-3xl pointer-events-none"
                    style={{ background: 'radial-gradient(circle, rgba(249, 115, 22, 0.3) 0%, transparent 70%)' }} />

                {/* Header */}
                <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-2xl bg-gradient-to-br from-orange-500 to-yellow-500">
                            <FileText className="text-white" size={28} />
                        </div>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-white via-orange-200 to-white bg-clip-text text-transparent">
                                รายงาน
                            </h1>
                            <p className="text-gray-400 flex items-center gap-2">
                                <Sparkles size={14} className="text-orange-400" />
                                วิเคราะห์ข้อมูลเชิงธุรกิจ
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handleExport}
                        disabled={exporting || loading}
                        className="relative group px-6 py-3 rounded-xl font-semibold text-white overflow-hidden disabled:opacity-50"
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-green-600 via-emerald-500 to-green-600" />
                        <div className="absolute inset-0 bg-gradient-to-r from-green-600 via-emerald-500 to-green-600 blur-xl opacity-50 group-hover:opacity-70 transition-opacity" />
                        <span className="relative flex items-center gap-2">
                            {exporting ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <Download size={18} />
                            )}
                            Export CSV
                        </span>
                    </button>
                </div>

                {/* Report Type Tabs - Organized into categories */}
                <div className={`backdrop-blur-xl rounded-2xl border border-white/10 p-4 mb-4 transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
                    style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)', transitionDelay: '100ms' }}>

                    {/* Sales Reports */}
                    <div className="mb-3">
                        <span className="text-xs text-gray-500 uppercase tracking-wider mb-2 block">📊 รายงานยอดขาย</span>
                        <div className="flex flex-wrap gap-2">
                            {salesReports.map(type => (
                                <button
                                    key={type.value}
                                    onClick={() => setReportType(type.value as ReportType)}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-300 text-sm ${reportType === type.value
                                        ? 'bg-gradient-to-r from-orange-600 to-yellow-600 text-white shadow-lg shadow-orange-500/30'
                                        : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                                        }`}
                                >
                                    <type.icon size={16} />
                                    {type.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Special Reports */}
                    <div>
                        <span className="text-xs text-gray-500 uppercase tracking-wider mb-2 block">📋 รายงานพิเศษ</span>
                        <div className="flex flex-wrap gap-2">
                            {specialReports.map(type => (
                                <button
                                    key={type.value}
                                    onClick={() => setReportType(type.value as ReportType)}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-300 text-sm ${reportType === type.value
                                        ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/30'
                                        : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                                        }`}
                                >
                                    <type.icon size={16} />
                                    {type.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Data Scope Header - ชัดเจนว่ากำลังดูอะไร */}
                <div className={`flex items-center gap-3 px-4 py-3 mb-4 rounded-xl bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/20 transition-all duration-700 ${mounted ? 'opacity-100' : 'opacity-0'}`}>
                    <Info size={18} className="text-blue-400 shrink-0" />
                    <p className="text-sm text-gray-300">
                        <span className="font-semibold text-white">{getReportLabel()}</span>
                        <span className="text-gray-500 mx-2">·</span>
                        <span>{formatThaiDate(startDate)} – {formatThaiDate(endDate)}</span>
                        {selectedStation && (
                            <>
                                <span className="text-gray-500 mx-2">·</span>
                                <span className="text-cyan-400">{stations.find(s => s.id === selectedStation)?.name || 'สถานี'}</span>
                            </>
                        )}
                        {!selectedStation && reportType !== 'shift_meters' && (
                            <>
                                <span className="text-gray-500 mx-2">·</span>
                                <span className="text-green-400">ทุกสถานี</span>
                            </>
                        )}
                    </p>
                </div>

                {/* Date Range Filter */}
                <div className={`backdrop-blur-xl rounded-2xl border border-white/10 p-4 mb-6 transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
                    style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)', transitionDelay: '200ms' }}>

                    {/* Quick Date Presets */}
                    <div className="flex flex-wrap gap-2 mb-4">
                        <button
                            onClick={() => {
                                const today = new Date().toISOString().split('T')[0];
                                setStartDate(today);
                                setEndDate(today);
                            }}
                            className="px-3 py-1.5 text-xs rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all border border-transparent hover:border-white/20"
                        >
                            วันนี้
                        </button>
                        <button
                            onClick={() => {
                                const today = new Date();
                                const startOfWeek = new Date(today);
                                startOfWeek.setDate(today.getDate() - today.getDay());
                                setStartDate(startOfWeek.toISOString().split('T')[0]);
                                setEndDate(today.toISOString().split('T')[0]);
                            }}
                            className="px-3 py-1.5 text-xs rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all border border-transparent hover:border-white/20"
                        >
                            สัปดาห์นี้
                        </button>
                        <button
                            onClick={() => {
                                const today = new Date();
                                const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
                                setStartDate(startOfMonth.toISOString().split('T')[0]);
                                setEndDate(today.toISOString().split('T')[0]);
                            }}
                            className="px-3 py-1.5 text-xs rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all border border-transparent hover:border-white/20"
                        >
                            เดือนนี้
                        </button>
                        <button
                            onClick={() => {
                                const today = new Date();
                                const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                                const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
                                setStartDate(startOfLastMonth.toISOString().split('T')[0]);
                                setEndDate(endOfLastMonth.toISOString().split('T')[0]);
                            }}
                            className="px-3 py-1.5 text-xs rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all border border-transparent hover:border-white/20"
                        >
                            เดือนที่แล้ว
                        </button>
                        <button
                            onClick={() => {
                                const today = new Date();
                                const last30 = new Date(today);
                                last30.setDate(today.getDate() - 30);
                                setStartDate(last30.toISOString().split('T')[0]);
                                setEndDate(today.toISOString().split('T')[0]);
                            }}
                            className="px-3 py-1.5 text-xs rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all border border-transparent hover:border-white/20"
                        >
                            30 วันล่าสุด
                        </button>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 items-end">
                        <div className="flex-1">
                            <label className="block text-sm text-gray-400 mb-2">ตั้งแต่วันที่</label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-orange-500/50 transition-all duration-300"
                            />
                        </div>
                        <div className="flex-1">
                            <label className="block text-sm text-gray-400 mb-2">ถึงวันที่</label>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-orange-500/50 transition-all duration-300"
                            />
                        </div>
                        {reportType === 'shift_meters' && (
                            <div className="flex-1">
                                <label className="block text-sm text-gray-400 mb-2">เลือกปั๊ม</label>
                                <select
                                    value={selectedStation}
                                    onChange={(e) => setSelectedStation(e.target.value)}
                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-orange-500/50 transition-all duration-300"
                                >
                                    <option value="" className="bg-gray-800">ทุกปั๊ม</option>
                                    {stations.map(s => (
                                        <option key={s.id} value={s.id} className="bg-gray-800">{s.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                        {reportType === 'shift_meters' && (
                            <div className="w-32">
                                <label className="block text-sm text-gray-400 mb-2">กะ</label>
                                <select
                                    value={selectedShift}
                                    onChange={(e) => setSelectedShift(e.target.value)}
                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-orange-500/50 transition-all duration-300"
                                >
                                    <option value="" className="bg-gray-800">ทุกกะ</option>
                                    <option value="1" className="bg-gray-800">กะ 1 (เช้า)</option>
                                    <option value="2" className="bg-gray-800">กะ 2 (บ่าย)</option>
                                </select>
                            </div>
                        )}
                        <button onClick={fetchReport} className="relative group px-6 py-3 rounded-xl font-semibold text-white overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-r from-orange-600 to-yellow-600" />
                            <span className="relative flex items-center gap-2">
                                <TrendingUp size={18} />
                                ดูรายงาน
                            </span>
                        </button>
                    </div>
                </div>

                {/* Summary Cards */}
                {summary && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                        {reportType === 'daily' && (
                            <>
                                {/* ยอดขายรวม - with comparison */}
                                <div className="stat-card animate-fade-in">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <DollarSign className="text-green-400" size={20} />
                                            <span className="text-gray-400 text-sm">ยอดขายรวม</span>
                                        </div>
                                        {(summary as { amountChange?: number }).amountChange !== undefined && (
                                            <div className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${(summary as { amountChange?: number }).amountChange! >= 0
                                                ? 'bg-green-500/20 text-green-400'
                                                : 'bg-red-500/20 text-red-400'
                                                }`}>
                                                {(summary as { amountChange?: number }).amountChange! >= 0
                                                    ? <TrendingUp size={12} />
                                                    : <TrendingDown size={12} />}
                                                {Math.abs((summary as { amountChange?: number }).amountChange!).toFixed(1)}%
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-2xl font-bold text-green-400">
                                        {formatCurrency((summary as { totalAmount?: number }).totalAmount || 0)}
                                    </p>
                                    {(summary as { avgPerDay?: number }).avgPerDay && (
                                        <p className="text-xs text-gray-500 mt-1">
                                            เฉลี่ย {formatCurrency((summary as { avgPerDay?: number }).avgPerDay!)} / วัน
                                        </p>
                                    )}
                                </div>

                                {/* ลิตรรวม - with comparison */}
                                <div className="stat-card animate-fade-in" style={{ animationDelay: '0.1s' }}>
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <Fuel className="text-blue-400" size={20} />
                                            <span className="text-gray-400 text-sm">รวมลิตร</span>
                                        </div>
                                        {(summary as { litersChange?: number }).litersChange !== undefined && (
                                            <div className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${(summary as { litersChange?: number }).litersChange! >= 0
                                                ? 'bg-green-500/20 text-green-400'
                                                : 'bg-red-500/20 text-red-400'
                                                }`}>
                                                {(summary as { litersChange?: number }).litersChange! >= 0
                                                    ? <TrendingUp size={12} />
                                                    : <TrendingDown size={12} />}
                                                {Math.abs((summary as { litersChange?: number }).litersChange!).toFixed(1)}%
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-2xl font-bold text-blue-400">
                                        {((summary as { totalLiters?: number }).totalLiters || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </p>
                                    <p className="text-xs text-gray-500 mt-1">ลิตร</p>
                                </div>

                                {/* รายการทั้งหมด */}
                                <div className="stat-card animate-fade-in" style={{ animationDelay: '0.2s' }}>
                                    <div className="flex items-center gap-2 mb-2">
                                        <FileText className="text-purple-400" size={20} />
                                        <span className="text-gray-400 text-sm">รายการทั้งหมด</span>
                                    </div>
                                    <p className="text-2xl font-bold text-purple-400">
                                        {formatNumber((summary as { totalTransactions?: number }).totalTransactions || 0)}
                                    </p>
                                    {(summary as { daysWithData?: number }).daysWithData && (
                                        <p className="text-xs text-gray-500 mt-1">
                                            {(summary as { daysWithData?: number }).daysWithData} วัน
                                        </p>
                                    )}
                                </div>

                                {/* เงินเชื่อ */}
                                <div className="stat-card animate-fade-in" style={{ animationDelay: '0.3s' }}>
                                    <div className="flex items-center gap-2 mb-2">
                                        <CreditCard className="text-orange-400" size={20} />
                                        <span className="text-gray-400 text-sm">เงินเชื่อ</span>
                                    </div>
                                    <p className="text-2xl font-bold text-orange-400">
                                        {formatCurrency((summary as { totalCredit?: number }).totalCredit || 0)}
                                    </p>
                                    {(summary as { totalAmount?: number; totalCredit?: number }).totalAmount && (
                                        <p className="text-xs text-gray-500 mt-1">
                                            {(((summary as { totalCredit?: number }).totalCredit || 0) / ((summary as { totalAmount?: number }).totalAmount || 1) * 100).toFixed(1)}% ของยอดขาย
                                        </p>
                                    )}
                                </div>
                            </>
                        )}
                        {reportType === 'debt' && (
                            <>
                                <div className="stat-card animate-fade-in">
                                    <div className="flex items-center gap-2 mb-2">
                                        <DollarSign className="text-red-400" size={20} />
                                        <span className="text-gray-400 text-sm">ยอดหนี้รวม</span>
                                    </div>
                                    <p className="text-2xl font-bold text-red-400">
                                        {formatCurrency((summary as { totalDebt?: number }).totalDebt || 0)}
                                    </p>
                                </div>
                                <div className="stat-card animate-fade-in" style={{ animationDelay: '0.1s' }}>
                                    <div className="flex items-center gap-2 mb-2">
                                        <Users className="text-orange-400" size={20} />
                                        <span className="text-gray-400 text-sm">ลูกหนี้</span>
                                    </div>
                                    <p className="text-2xl font-bold text-orange-400">
                                        {formatNumber((summary as { totalCustomers?: number }).totalCustomers || 0)} ราย
                                    </p>
                                </div>
                            </>
                        )}
                        {reportType === 'gas' && (
                            <>
                                <div className="stat-card animate-fade-in">
                                    <div className="flex items-center gap-2 mb-2">
                                        <DollarSign className="text-cyan-400" size={20} />
                                        <span className="text-gray-400 text-sm">ยอดขายรวม</span>
                                    </div>
                                    <p className="text-2xl font-bold text-cyan-400">
                                        {formatCurrency((summary as { totalSalesAmount?: number }).totalSalesAmount || 0)}
                                    </p>
                                </div>
                                <div className="stat-card animate-fade-in" style={{ animationDelay: '0.1s' }}>
                                    <div className="flex items-center gap-2 mb-2">
                                        <Fuel className="text-blue-400" size={20} />
                                        <span className="text-gray-400 text-sm">ขาย (ลิตร)</span>
                                    </div>
                                    <p className="text-2xl font-bold text-blue-400">
                                        {formatNumber((summary as { totalSalesLiters?: number }).totalSalesLiters || 0)}
                                    </p>
                                </div>
                                <div className="stat-card animate-fade-in" style={{ animationDelay: '0.2s' }}>
                                    <div className="flex items-center gap-2 mb-2">
                                        <TrendingUp className="text-green-400" size={20} />
                                        <span className="text-gray-400 text-sm">รับเข้า (ลิตร)</span>
                                    </div>
                                    <p className="text-2xl font-bold text-green-400">
                                        {formatNumber((summary as { totalSuppliesLiters?: number }).totalSuppliesLiters || 0)}
                                    </p>
                                    <p className="text-xs text-gray-500 mt-1">
                                        {(summary as { totalSupplyCount?: number }).totalSupplyCount || 0} ครั้ง
                                    </p>
                                </div>
                                <div className="stat-card animate-fade-in" style={{ animationDelay: '0.3s' }}>
                                    <div className="flex items-center gap-2 mb-2">
                                        <FileText className="text-purple-400" size={20} />
                                        <span className="text-gray-400 text-sm">รายการขาย</span>
                                    </div>
                                    <p className="text-2xl font-bold text-purple-400">
                                        {formatNumber((summary as { totalTransactions?: number }).totalTransactions || 0)}
                                    </p>
                                    <p className="text-xs text-gray-500 mt-1">
                                        {(summary as { daysWithData?: number }).daysWithData || 0} วัน
                                    </p>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* Gas Stock Cards */}
                {reportType === 'gas' && gasStock.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                        {gasStock.map((station) => (
                            <div key={station.stationId} className={`glass-card p-4 ${station.currentStock < station.alertLevel ? 'border border-red-500/50' : ''}`}>
                                <h3 className="font-bold text-white mb-2">⛽ {station.stationName}</h3>
                                <div className="flex items-center justify-between">
                                    <span className="text-gray-400">สต็อกคงเหลือ:</span>
                                    <span className={`text-2xl font-bold font-mono ${station.currentStock < station.alertLevel ? 'text-red-400' : 'text-cyan-400'}`}>
                                        {formatNumber(station.currentStock)} ลิตร
                                    </span>
                                </div>
                                {station.currentStock < station.alertLevel && (
                                    <p className="text-xs text-red-400 mt-2 flex items-center gap-1">
                                        <AlertCircle size={12} />
                                        ต่ำกว่าเกณฑ์ ({station.alertLevel} ลิตร)
                                    </p>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* Chart */}
                {(reportType === 'daily' || reportType === 'monthly' || reportType === 'gas') && data.length > 0 && (() => {
                    // Calculate average for daily chart
                    const chartData = reportType === 'daily'
                        ? (data as DailyData[]).slice().reverse().slice(-14)
                        : reportType === 'monthly'
                            ? (data as MonthlyData[]).slice().reverse()
                            : data;

                    const avgAmount = chartData.reduce((sum, d) => sum + ((d as DailyData).totalAmount || 0), 0) / chartData.length;

                    // Mark anomaly points (> 1.5x or < 0.5x average)
                    const chartDataWithAnomaly = chartData.map(d => ({
                        ...d,
                        isAnomaly: (d as DailyData).totalAmount > avgAmount * 1.5 || (d as DailyData).totalAmount < avgAmount * 0.5
                    }));

                    return (
                        <div className="glass-card p-6 mb-6 animate-fade-in">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-bold text-white">
                                    📈 กราฟยอดขาย{reportType === 'daily' ? 'รายวัน' : reportType === 'monthly' ? 'รายเดือน' : ''}
                                </h3>
                                {reportType === 'daily' && (
                                    <div className="flex items-center gap-4 text-xs">
                                        <span className="flex items-center gap-1.5">
                                            <div className="w-3 h-0.5 bg-orange-400"></div>
                                            <span className="text-gray-400">เฉลี่ย {formatCurrency(avgAmount)}</span>
                                        </span>
                                        <span className="flex items-center gap-1.5">
                                            <div className="w-2 h-2 rounded-full bg-red-400"></div>
                                            <span className="text-gray-400">ผิดปกติ</span>
                                        </span>
                                    </div>
                                )}
                            </div>
                            <div className="h-[300px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    {reportType === 'daily' ? (
                                        <LineChart data={chartDataWithAnomaly}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                                            <XAxis
                                                dataKey="date"
                                                stroke="#9ca3af"
                                                fontSize={11}
                                                tickFormatter={(val) => new Date(val).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
                                            />
                                            <YAxis stroke="#9ca3af" fontSize={11} tickFormatter={formatCompact} />
                                            <Tooltip
                                                formatter={(value, name) => {
                                                    const label = name === 'totalAmount' ? 'ยอดขาย' : name;
                                                    return [formatCurrency(value as number), label];
                                                }}
                                                labelFormatter={(label) => new Date(label).toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long' })}
                                                contentStyle={{
                                                    backgroundColor: 'rgba(15, 15, 35, 0.95)',
                                                    border: '1px solid rgba(139, 92, 246, 0.3)',
                                                    borderRadius: '12px'
                                                }}
                                            />
                                            {/* Average reference line */}
                                            <ReferenceLine
                                                y={avgAmount}
                                                stroke="#f97316"
                                                strokeDasharray="5 5"
                                                strokeWidth={2}
                                                label={{ value: 'AVG', position: 'right', fill: '#f97316', fontSize: 10 }}
                                            />
                                            <Line
                                                type="monotone"
                                                dataKey="totalAmount"
                                                stroke="#8b5cf6"
                                                strokeWidth={3}
                                                dot={(props) => {
                                                    const { cx, cy, payload } = props;
                                                    if (payload.isAnomaly) {
                                                        return (
                                                            <circle
                                                                cx={cx}
                                                                cy={cy}
                                                                r={6}
                                                                fill="#ef4444"
                                                                stroke="#fff"
                                                                strokeWidth={2}
                                                            />
                                                        );
                                                    }
                                                    return <circle cx={cx} cy={cy} r={4} fill="#8b5cf6" />;
                                                }}
                                                activeDot={{ r: 6, fill: '#a78bfa' }}
                                            />
                                        </LineChart>
                                    ) : (
                                        <BarChart data={chartData}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                                            <XAxis dataKey="month" stroke="#9ca3af" fontSize={11} />
                                            <YAxis stroke="#9ca3af" fontSize={11} tickFormatter={formatCompact} />
                                            <Tooltip
                                                formatter={(value) => [formatCurrency(value as number), 'ยอดขาย']}
                                                contentStyle={{
                                                    backgroundColor: 'rgba(15, 15, 35, 0.95)',
                                                    border: '1px solid rgba(139, 92, 246, 0.3)',
                                                    borderRadius: '12px'
                                                }}
                                            />
                                            <ReferenceLine
                                                y={avgAmount}
                                                stroke="#f97316"
                                                strokeDasharray="5 5"
                                                strokeWidth={2}
                                            />
                                            <Bar dataKey="totalAmount" fill="url(#barGradient)" radius={[6, 6, 0, 0]} />
                                            <defs>
                                                <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%" stopColor="#8b5cf6" />
                                                    <stop offset="100%" stopColor="#3b82f6" />
                                                </linearGradient>
                                            </defs>
                                        </BarChart>
                                    )}
                                </ResponsiveContainer>
                            </div>
                        </div>
                    );
                })()}

                {/* Data Table */}
                <div className="glass-card overflow-hidden animate-fade-in">
                    {loading ? (
                        <TableLoadingState rows={8} />
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="table-glass">
                                <thead>
                                    {reportType === 'daily' && (
                                        <tr>
                                            <th>วันที่</th>
                                            <th className="text-right">รายการ</th>
                                            <th className="text-right">ลิตร</th>
                                            <th className="text-right">เงินสด</th>
                                            <th className="text-right">เงินเชื่อ</th>
                                            <th className="text-right">รวม</th>
                                        </tr>
                                    )}
                                    {reportType === 'monthly' && (
                                        <tr>
                                            <th>เดือน</th>
                                            <th className="text-right">รายการ</th>
                                            <th className="text-right">ลิตร</th>
                                            <th className="text-right">ยอดขาย</th>
                                        </tr>
                                    )}
                                    {reportType === 'debt' && (
                                        <tr>
                                            <th>รหัส</th>
                                            <th>ลูกค้า</th>
                                            <th className="text-right">รายการ</th>
                                            <th className="text-right">ลิตร</th>
                                            <th className="text-right">ยอดหนี้</th>
                                            <th className="text-right">วันที่ค้าง</th>
                                        </tr>
                                    )}
                                    {reportType === 'station' && (
                                        <tr>
                                            <th>สถานี</th>
                                            <th className="text-right">รายการ</th>
                                            <th className="text-right">ลิตร</th>
                                            <th className="text-right">เงินสด</th>
                                            <th className="text-right">เงินเชื่อ</th>
                                            <th className="text-right">รวม</th>
                                        </tr>
                                    )}
                                    {reportType === 'gas' && (
                                        <tr>
                                            <th>วันที่</th>
                                            <th className="text-right">รายการ</th>
                                            <th className="text-right">ขาย (ลิตร)</th>
                                            <th className="text-right">รับเข้า (ลิตร)</th>
                                            <th className="text-right">เงินสด</th>
                                            <th className="text-right">เงินเชื่อ</th>
                                            <th className="text-right">บัตร</th>
                                            <th className="text-right">รวม</th>
                                        </tr>
                                    )}
                                    {reportType === 'shift_meters' && (
                                        <tr>
                                            <th>วันที่</th>
                                            <th>กะ</th>
                                            <th>สถานี</th>
                                            <th>พนักงาน</th>
                                            <th className="text-right">หัวจ่าย 1<br /><span className="text-xs text-gray-500">เริ่ม→สิ้น (ขาย)</span></th>
                                            <th className="text-right">หัวจ่าย 2<br /><span className="text-xs text-gray-500">เริ่ม→สิ้น (ขาย)</span></th>
                                            <th className="text-right">หัวจ่าย 3<br /><span className="text-xs text-gray-500">เริ่ม→สิ้น (ขาย)</span></th>
                                            <th className="text-right">หัวจ่าย 4<br /><span className="text-xs text-gray-500">เริ่ม→สิ้น (ขาย)</span></th>
                                            <th className="text-right">รวมลิตร<br /><span className="text-xs text-gray-500">มิเตอร์</span></th>
                                            <th className="text-right bg-green-900/20">เงินสด</th>
                                            <th className="text-right bg-purple-900/20">เงินเชื่อ</th>
                                            <th className="text-right bg-blue-900/20">โอน</th>
                                            <th className="text-right bg-cyan-900/20">รวม</th>
                                            <th className="text-right">ส่วนต่าง<br /><span className="text-xs text-gray-500">กระทบยอด</span></th>
                                            <th>สถานะ</th>
                                        </tr>
                                    )}
                                </thead>
                                <tbody>
                                    {(reportType === 'shift_meters' ? shiftMetersData.length === 0 : data.length === 0) ? (
                                        <tr>
                                            <td colSpan={10} className="text-center py-8 text-gray-400">
                                                ไม่มีข้อมูล
                                            </td>
                                        </tr>
                                    ) : (
                                        <>
                                            {reportType === 'daily' && (
                                                <>
                                                    {(data as DailyData[]).map((row, i) => (
                                                        <tr key={i}>
                                                            <td className="font-mono">{new Date(row.date).toLocaleDateString('th-TH')}</td>
                                                            <td className="text-right">{row.transactionCount}</td>
                                                            <td className="text-right font-mono">{row.totalLiters.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                            <td className="text-right font-mono text-green-400">{row.cashAmount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                            <td className="text-right font-mono text-purple-400">{row.creditAmount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                            <td className="text-right font-mono font-bold">{row.totalAmount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                        </tr>
                                                    ))}
                                                    {/* Subtotal Row */}
                                                    {summary && (
                                                        <tr className="bg-gradient-to-r from-orange-500/10 to-yellow-500/10 border-t-2 border-orange-500/30">
                                                            <td className="font-bold text-orange-400">รวมทั้งหมด</td>
                                                            <td className="text-right font-bold text-orange-400">
                                                                {(summary as { totalTransactions?: number }).totalTransactions?.toLocaleString()}
                                                            </td>
                                                            <td className="text-right font-mono font-bold text-orange-400">
                                                                {((summary as { totalLiters?: number }).totalLiters || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            </td>
                                                            <td className="text-right font-mono font-bold text-green-400">
                                                                {((summary as { totalCash?: number }).totalCash || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            </td>
                                                            <td className="text-right font-mono font-bold text-purple-400">
                                                                {((summary as { totalCredit?: number }).totalCredit || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            </td>
                                                            <td className="text-right font-mono font-bold text-xl text-white">
                                                                ฿{((summary as { totalAmount?: number }).totalAmount || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            </td>
                                                        </tr>
                                                    )}
                                                </>
                                            )}
                                            {reportType === 'monthly' && (data as MonthlyData[]).map((row, i) => (
                                                <tr key={i}>
                                                    <td className="font-mono">{row.month}</td>
                                                    <td className="text-right">{row.transactionCount}</td>
                                                    <td className="text-right font-mono">{formatNumber(row.totalLiters)}</td>
                                                    <td className="text-right font-mono font-bold text-green-400">{formatCurrency(row.totalAmount)}</td>
                                                </tr>
                                            ))}
                                            {reportType === 'debt' && (data as DebtData[]).map((row, i) => (
                                                <tr key={i}>
                                                    <td className="font-mono text-purple-400">{row.ownerCode || '-'}</td>
                                                    <td className="font-medium text-white">{row.ownerName}</td>
                                                    <td className="text-right">{row.transactionCount}</td>
                                                    <td className="text-right font-mono">{formatNumber(row.totalLiters)}</td>
                                                    <td className="text-right font-mono font-bold text-red-400">{formatCurrency(row.totalAmount)}</td>
                                                    <td className="text-right">
                                                        <span className={`badge ${row.daysPending > 30 ? 'badge-red' : row.daysPending > 14 ? 'badge-orange' : 'badge-gray'}`}>
                                                            {row.daysPending} วัน
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                            {reportType === 'station' && (data as StationData[]).map((row, i) => (
                                                <tr key={i}>
                                                    <td className="font-medium text-white">{row.stationName}</td>
                                                    <td className="text-right">{row.transactionCount}</td>
                                                    <td className="text-right font-mono">{formatNumber(row.totalLiters)}</td>
                                                    <td className="text-right font-mono text-green-400">{formatCurrency(row.cashAmount)}</td>
                                                    <td className="text-right font-mono text-purple-400">{formatCurrency(row.creditAmount)}</td>
                                                    <td className="text-right font-mono font-bold">{formatCurrency(row.totalAmount)}</td>
                                                </tr>
                                            ))}
                                            {reportType === 'gas' && (data as GasData[]).map((row, i) => (
                                                <tr key={i}>
                                                    <td className="font-mono">{new Date(row.date).toLocaleDateString('th-TH')}</td>
                                                    <td className="text-right">{row.transactionCount}</td>
                                                    <td className="text-right font-mono text-blue-400">{formatNumber(row.salesLiters)}</td>
                                                    <td className="text-right font-mono text-green-400">{formatNumber(row.suppliesLiters)}</td>
                                                    <td className="text-right font-mono">{formatCurrency(row.cashAmount)}</td>
                                                    <td className="text-right font-mono text-purple-400">{formatCurrency(row.creditAmount)}</td>
                                                    <td className="text-right font-mono text-pink-400">{formatCurrency(row.cardAmount)}</td>
                                                    <td className="text-right font-mono font-bold text-cyan-400">{formatCurrency(row.salesAmount)}</td>
                                                </tr>
                                            ))}
                                            {reportType === 'shift_meters' && shiftMetersData
                                                .filter(row => !selectedShift || String(row.shiftNumber) === selectedShift)
                                                .map((row, i) => {
                                                    const getMeterDisplay = (nozzle: number) => {
                                                        const meter = row.meters.find(m => m.nozzleNumber === nozzle);
                                                        if (!meter || (!meter.startReading && !meter.endReading)) return '-';
                                                        const start = meter.startReading ? meter.startReading.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : '-';
                                                        const end = meter.endReading ? meter.endReading.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : '-';
                                                        const sold = meter.soldQty ? meter.soldQty.toFixed(2) : '-';
                                                        return (
                                                            <span>
                                                                <span className="text-gray-400">{start}</span>
                                                                <span className="text-gray-600"> → </span>
                                                                <span className="text-gray-300">{end}</span>
                                                                <br />
                                                                <span className="text-yellow-400 font-bold">({sold})</span>
                                                            </span>
                                                        );
                                                    };
                                                    return (
                                                        <tr key={i}>
                                                            <td className="font-mono">{new Date(row.date).toLocaleDateString('th-TH')}</td>
                                                            <td className="text-center">
                                                                {row.shiftNumber ? (
                                                                    <span className={`badge ${row.shiftNumber === 1 ? 'badge-blue' : 'badge-purple'}`}>
                                                                        กะ {row.shiftNumber}
                                                                    </span>
                                                                ) : (
                                                                    <span className="badge badge-gray">กะ -</span>
                                                                )}
                                                            </td>
                                                            <td className="text-white">{row.stationName}</td>
                                                            <td>{row.staff || '-'}</td>
                                                            <td className="text-right font-mono text-sm">{getMeterDisplay(1)}</td>
                                                            <td className="text-right font-mono text-sm">{getMeterDisplay(2)}</td>
                                                            <td className="text-right font-mono text-sm">{getMeterDisplay(3)}</td>
                                                            <td className="text-right font-mono text-sm">{getMeterDisplay(4)}</td>
                                                            <td className="text-right font-mono font-bold text-yellow-400">{row.totalSold.toFixed(2)}</td>
                                                            <td className="text-right font-mono text-green-400 bg-green-900/10">
                                                                {row.cashAmount ? formatCurrency(row.cashAmount) : '-'}
                                                            </td>
                                                            <td className="text-right font-mono text-purple-400 bg-purple-900/10">
                                                                {row.creditAmount ? formatCurrency(row.creditAmount) : '-'}
                                                            </td>
                                                            <td className="text-right font-mono text-blue-400 bg-blue-900/10">
                                                                {row.transferAmount ? formatCurrency(row.transferAmount) : '-'}
                                                            </td>
                                                            <td className="text-right font-mono font-bold text-cyan-400 bg-cyan-900/10">
                                                                {row.totalTransactionAmount ? formatCurrency(row.totalTransactionAmount) : '-'}
                                                            </td>
                                                            <td className="text-right font-mono group relative cursor-help">
                                                                {row.hasReconciliation && row.variance !== undefined && row.variance !== null ? (
                                                                    <>
                                                                        <span className={`${row.varianceStatus === 'OVER' ? 'text-green-400' : row.varianceStatus === 'SHORT' ? 'text-red-400' : 'text-gray-400'}`}>
                                                                            {row.variance > 0 ? '+' : ''}{formatNumber(row.variance)}
                                                                        </span>
                                                                        <div className="absolute z-50 bottom-full right-0 mb-2 hidden group-hover:block w-48 p-2 bg-gray-900 border border-white/20 rounded-lg shadow-xl text-xs">
                                                                            <p className="text-gray-300 mb-1">
                                                                                {row.varianceStatus === 'OVER' ? '💰 เงินเกิน: รับเงินมากกว่าที่คาด' :
                                                                                    row.varianceStatus === 'SHORT' ? '⚠️ เงินขาด: รับเงินน้อยกว่าที่คาด' :
                                                                                        '✓ ยอดตรง: รับเงินตรงกับที่คาด'}
                                                                            </p>
                                                                            {row.totalExpected !== undefined && row.totalExpected !== null && (
                                                                                <p className="text-gray-500">
                                                                                    คาดหวัง: {formatCurrency(row.totalExpected)}
                                                                                </p>
                                                                            )}
                                                                        </div>
                                                                    </>
                                                                ) : (
                                                                    <span className="text-gray-600">-</span>
                                                                )}
                                                            </td>
                                                            <td>
                                                                <span className={`badge ${row.status === 'CLOSED' ? 'badge-green' : row.status === 'NO_SHIFT' ? 'badge-gray' : 'badge-orange'}`}>
                                                                    {row.status === 'CLOSED' ? 'ปิดกะแล้ว' : row.status === 'NO_SHIFT' ? 'ไม่มีกะ' : 'เปิดอยู่'}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                        </>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </Sidebar>
    );
}
