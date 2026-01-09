'use client';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import Spinner, { LoadingState } from '@/components/Spinner';
import { formatCurrency, formatNumber, formatCompact } from '@/utils/format';
import {
    FileText,
    Download,
    Calendar,
    TrendingUp,
    Users,
    Fuel,
    DollarSign,
    AlertCircle,
    BarChart3,
    Sparkles,
    Gauge
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
    Line
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



    const reportTypes = [
        { value: 'daily', label: 'รายวัน', icon: Calendar },
        { value: 'monthly', label: 'รายเดือน', icon: BarChart3 },
        { value: 'gas', label: '⛽ ปั๊มแก๊ส', icon: Fuel, color: 'text-cyan-400' },
        { value: 'shift_meters', label: '📊 มิเตอร์ตามกะ', icon: Gauge, color: 'text-yellow-400' },
        { value: 'debt', label: 'ลูกหนี้ค้าง', icon: AlertCircle },
        { value: 'station', label: 'ตามสถานี', icon: Fuel },
    ];

    return (
        <Sidebar>
            <div className="max-w-7xl mx-auto relative">
                {/* Background orbs */}
                <div className="fixed top-20 right-20 w-[400px] h-[400px] rounded-full opacity-20 blur-3xl pointer-events-none"
                    style={{ background: 'radial-gradient(circle, rgba(249, 115, 22, 0.3) 0%, transparent 70%)' }} />

                {/* Header */}
                <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
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
                                สรุปข้อมูลและ export รายงาน
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

                {/* Report Type Tabs */}
                <div className={`backdrop-blur-xl rounded-2xl border border-white/10 p-3 mb-6 transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
                    style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)', transitionDelay: '100ms' }}>
                    <div className="flex flex-wrap gap-2">
                        {reportTypes.map(type => (
                            <button
                                key={type.value}
                                onClick={() => setReportType(type.value as ReportType)}
                                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all duration-300 ${reportType === type.value
                                    ? 'bg-gradient-to-r from-orange-600 to-yellow-600 text-white shadow-lg shadow-orange-500/30'
                                    : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                                    }`}
                            >
                                <type.icon size={18} />
                                {type.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Date Range Filter */}
                <div className={`backdrop-blur-xl rounded-2xl border border-white/10 p-4 mb-6 transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
                    style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)', transitionDelay: '200ms' }}>
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
                                <div className="stat-card animate-fade-in">
                                    <div className="flex items-center gap-2 mb-2">
                                        <DollarSign className="text-green-400" size={20} />
                                        <span className="text-gray-400 text-sm">ยอดขายรวม</span>
                                    </div>
                                    <p className="text-2xl font-bold text-green-400">
                                        {formatCurrency((summary as { totalAmount?: number }).totalAmount || 0)}
                                    </p>
                                </div>
                                <div className="stat-card animate-fade-in" style={{ animationDelay: '0.1s' }}>
                                    <div className="flex items-center gap-2 mb-2">
                                        <Fuel className="text-blue-400" size={20} />
                                        <span className="text-gray-400 text-sm">รวมลิตร</span>
                                    </div>
                                    <p className="text-2xl font-bold text-blue-400">
                                        {formatNumber((summary as { totalLiters?: number }).totalLiters || 0)}
                                    </p>
                                </div>
                                <div className="stat-card animate-fade-in" style={{ animationDelay: '0.2s' }}>
                                    <div className="flex items-center gap-2 mb-2">
                                        <FileText className="text-purple-400" size={20} />
                                        <span className="text-gray-400 text-sm">รายการทั้งหมด</span>
                                    </div>
                                    <p className="text-2xl font-bold text-purple-400">
                                        {formatNumber((summary as { totalTransactions?: number }).totalTransactions || 0)}
                                    </p>
                                </div>
                                <div className="stat-card animate-fade-in" style={{ animationDelay: '0.3s' }}>
                                    <div className="flex items-center gap-2 mb-2">
                                        <Users className="text-orange-400" size={20} />
                                        <span className="text-gray-400 text-sm">เงินเชื่อ</span>
                                    </div>
                                    <p className="text-2xl font-bold text-orange-400">
                                        {formatCurrency((summary as { totalCredit?: number }).totalCredit || 0)}
                                    </p>
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
                {(reportType === 'daily' || reportType === 'monthly' || reportType === 'gas') && data.length > 0 && (
                    <div className="glass-card p-6 mb-6 animate-fade-in">
                        <h3 className="text-lg font-bold text-white mb-4">
                            📈 กราฟยอดขาย{reportType === 'daily' ? 'รายวัน' : 'รายเดือน'}
                        </h3>
                        <div className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                {reportType === 'daily' ? (
                                    <LineChart data={(data as DailyData[]).slice().reverse().slice(-14)}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                                        <XAxis
                                            dataKey="date"
                                            stroke="#9ca3af"
                                            fontSize={11}
                                            tickFormatter={(val) => new Date(val).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
                                        />
                                        <YAxis stroke="#9ca3af" fontSize={11} tickFormatter={formatCompact} />
                                        <Tooltip
                                            formatter={(value) => formatCurrency(value as number) + ' บาท'}
                                            labelFormatter={(label) => new Date(label).toLocaleDateString('th-TH')}
                                            contentStyle={{
                                                backgroundColor: 'rgba(15, 15, 35, 0.95)',
                                                border: '1px solid rgba(139, 92, 246, 0.3)',
                                                borderRadius: '12px'
                                            }}
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="totalAmount"
                                            stroke="#8b5cf6"
                                            strokeWidth={3}
                                            dot={{ fill: '#8b5cf6', r: 4 }}
                                            activeDot={{ r: 6, fill: '#a78bfa' }}
                                        />
                                    </LineChart>
                                ) : (
                                    <BarChart data={(data as MonthlyData[]).slice().reverse()}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                                        <XAxis dataKey="month" stroke="#9ca3af" fontSize={11} />
                                        <YAxis stroke="#9ca3af" fontSize={11} tickFormatter={formatCompact} />
                                        <Tooltip
                                            formatter={(value) => formatCurrency(value as number) + ' บาท'}
                                            contentStyle={{
                                                backgroundColor: 'rgba(15, 15, 35, 0.95)',
                                                border: '1px solid rgba(139, 92, 246, 0.3)',
                                                borderRadius: '12px'
                                            }}
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
                )}

                {/* Data Table */}
                <div className="glass-card overflow-hidden animate-fade-in">
                    {loading ? (
                        <LoadingState />
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
                                            {reportType === 'daily' && (data as DailyData[]).map((row, i) => (
                                                <tr key={i}>
                                                    <td className="font-mono">{new Date(row.date).toLocaleDateString('th-TH')}</td>
                                                    <td className="text-right">{row.transactionCount}</td>
                                                    <td className="text-right font-mono">{formatNumber(row.totalLiters)}</td>
                                                    <td className="text-right font-mono text-green-400">{formatCurrency(row.cashAmount)}</td>
                                                    <td className="text-right font-mono text-purple-400">{formatCurrency(row.creditAmount)}</td>
                                                    <td className="text-right font-mono font-bold">{formatCurrency(row.totalAmount)}</td>
                                                </tr>
                                            ))}
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
                                            {reportType === 'shift_meters' && shiftMetersData.map((row, i) => {
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
                                                        <td className="text-right font-mono">
                                                            {row.hasReconciliation && row.variance !== undefined && row.variance !== null ? (
                                                                <span className={`${row.varianceStatus === 'OVER' ? 'text-green-400' : row.varianceStatus === 'SHORT' ? 'text-red-400' : 'text-gray-400'}`}>
                                                                    {row.variance > 0 ? '+' : ''}{formatNumber(row.variance)}
                                                                </span>
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
