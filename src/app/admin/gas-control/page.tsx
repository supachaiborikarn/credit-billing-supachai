'use client';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import {
    LayoutDashboard,
    Clock,
    Gauge,
    Receipt,
    FileText,
    ChevronDown,
    ChevronUp,
    TrendingUp,
    AlertTriangle,
    CheckCircle,
    Fuel,
    Users,
    Edit3,
    Save,
    X,
    Download,
    RefreshCw,
    Calendar,
    Search,
    Eye,
    Trash2,
} from 'lucide-react';
import type {
    GasControlDashboard,
    ShiftWithDetails,
    GasControlTab,
    MeterReading,
    TransactionSummary,
    ShiftSummaryReport,
    DailyReport,
    StaffPerformanceReport,
} from '@/types/gas-control';
import { GAS_STATIONS } from '@/types/gas-control';

// Tab configuration
const TABS: { id: GasControlTab; name: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', name: 'ภาพรวม', icon: <LayoutDashboard size={18} /> },
    { id: 'shifts', name: 'จัดการกะ', icon: <Clock size={18} /> },
    { id: 'meters', name: 'มิเตอร์', icon: <Gauge size={18} /> },
    { id: 'transactions', name: 'รายการขาย', icon: <Receipt size={18} /> },
    { id: 'reports', name: 'รายงาน', icon: <FileText size={18} /> },
];

export default function GasControlPage() {
    const [activeTab, setActiveTab] = useState<GasControlTab>('dashboard');
    const [selectedStation, setSelectedStation] = useState<string>(GAS_STATIONS[0].id);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [loading, setLoading] = useState(true);

    // Dashboard state
    const [dashboard, setDashboard] = useState<GasControlDashboard | null>(null);

    // Shifts state
    const [shifts, setShifts] = useState<ShiftListItem[]>([]);
    const [expandedShift, setExpandedShift] = useState<string | null>(null);
    const [shiftDetail, setShiftDetail] = useState<ShiftWithDetails | null>(null);

    // Meters state
    const [selectedShiftForMeters, setSelectedShiftForMeters] = useState<string | null>(null);
    const [meters, setMeters] = useState<MeterReading[]>([]);
    const [editingMeter, setEditingMeter] = useState<string | null>(null);
    const [editValue, setEditValue] = useState<number>(0);
    const [editReason, setEditReason] = useState('');
    const [editField, setEditField] = useState<'startReading' | 'endReading'>('endReading');
    const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);

    // Transactions state
    const [transactions, setTransactions] = useState<TransactionSummary[]>([]);
    const [searchQuery, setSearchQuery] = useState('');

    // Reports state
    const [reportType, setReportType] = useState<'shift-summary' | 'daily' | 'staff-performance'>('shift-summary');
    const [reportStartDate, setReportStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [reportEndDate, setReportEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [reportData, setReportData] = useState<ShiftSummaryReport | DailyReport | StaffPerformanceReport | null>(null);
    const [generatingReport, setGeneratingReport] = useState(false);

    interface ShiftListItem {
        id: string;
        date: string;
        shiftNumber: number;
        shiftName: string;
        staffName: string;
        status: string;
        totalSales: number;
        totalMeterLiters: number;
        variance: number | null;
        varianceStatus: string | null;
    }

    interface AuditLogItem {
        id: string;
        meterId: string;
        action: string;
        oldData: Record<string, unknown>;
        newData: Record<string, unknown>;
        editedBy: string;
        editedAt: string;
    }

    // Fetch data based on active tab
    useEffect(() => {
        fetchData();
    }, [activeTab, selectedStation, selectedDate]);

    const fetchData = async () => {
        setLoading(true);
        try {
            switch (activeTab) {
                case 'dashboard':
                    await fetchDashboard();
                    break;
                case 'shifts':
                    await fetchShifts();
                    break;
                case 'transactions':
                    await fetchTransactions();
                    break;
            }
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchDashboard = async () => {
        const res = await fetch(`/api/admin/gas-control/dashboard?stationId=${selectedStation}&date=${selectedDate}`);
        if (res.ok) {
            const data = await res.json();
            setDashboard(data);
        }
    };

    const fetchShifts = async () => {
        const res = await fetch(`/api/admin/gas-control/shifts?stationId=${selectedStation}&startDate=${selectedDate}&endDate=${selectedDate}`);
        if (res.ok) {
            const data = await res.json();
            setShifts(data.shifts || []);
        }
    };

    const fetchShiftDetail = async (shiftId: string) => {
        const res = await fetch(`/api/admin/gas-control/shifts?shiftId=${shiftId}`);
        if (res.ok) {
            const data = await res.json();
            setShiftDetail(data.shift);
        }
    };

    const fetchMeters = async (shiftId: string) => {
        const res = await fetch(`/api/admin/gas-control/meters?shiftId=${shiftId}`);
        if (res.ok) {
            const data = await res.json();
            setMeters(data.meters || []);
            setAuditLogs(data.auditLogs || []);
        }
    };

    const fetchTransactions = async () => {
        // Use existing admin transactions API
        const params = new URLSearchParams({
            date: selectedDate,
            stationId: selectedStation,
            includeVoided: 'true',
        });
        const res = await fetch(`/api/admin/transactions?${params}`);
        if (res.ok) {
            const data = await res.json();
            setTransactions(data || []);
        }
    };

    const handleShiftExpand = async (shiftId: string) => {
        if (expandedShift === shiftId) {
            setExpandedShift(null);
            setShiftDetail(null);
        } else {
            setExpandedShift(shiftId);
            await fetchShiftDetail(shiftId);
        }
    };

    const handleSelectShiftForMeters = async (shiftId: string) => {
        setSelectedShiftForMeters(shiftId);
        await fetchMeters(shiftId);
    };

    const handleSaveMeter = async () => {
        if (!editingMeter || !editReason.trim()) {
            alert('กรุณาระบุเหตุผลในการแก้ไข');
            return;
        }

        try {
            const res = await fetch('/api/admin/gas-control/meters', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    meterId: editingMeter,
                    field: editField,
                    newValue: editValue,
                    reason: editReason,
                }),
            });

            if (res.ok) {
                setEditingMeter(null);
                setEditReason('');
                if (selectedShiftForMeters) {
                    await fetchMeters(selectedShiftForMeters);
                }
            } else {
                const error = await res.json();
                alert(error.error || 'Failed to update meter');
            }
        } catch (error) {
            console.error('Error saving meter:', error);
        }
    };

    const handleGenerateReport = async () => {
        setGeneratingReport(true);
        try {
            const res = await fetch('/api/admin/gas-control/reports', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: reportType,
                    stationId: selectedStation,
                    startDate: reportStartDate,
                    endDate: reportEndDate,
                }),
            });

            if (res.ok) {
                const data = await res.json();
                setReportData(data.report);
            } else {
                const error = await res.json();
                alert(error.error || 'Failed to generate report');
            }
        } catch (error) {
            console.error('Error generating report:', error);
        } finally {
            setGeneratingReport(false);
        }
    };

    const formatCurrency = (num: number) =>
        new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2 }).format(num);

    const formatNumber = (num: number) =>
        new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);

    const filteredTransactions = transactions.filter(t => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
            t.licensePlate?.toLowerCase().includes(q) ||
            t.ownerName?.toLowerCase().includes(q) ||
            t.amount.toString().includes(q)
        );
    });

    return (
        <Sidebar>
            <div className="p-4 md:p-6 min-h-screen">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
                            <Fuel size={24} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-white">Gas Control Center</h1>
                            <p className="text-gray-400 text-sm">จัดการปั๊มแก๊สสำหรับ Admin</p>
                        </div>
                    </div>

                    {/* Station & Date Selector */}
                    <div className="flex items-center gap-3">
                        <select
                            value={selectedStation}
                            onChange={(e) => setSelectedStation(e.target.value)}
                            className="px-4 py-2.5 bg-[#1a1a24] border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                        >
                            {GAS_STATIONS.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="px-4 py-2.5 bg-[#1a1a24] border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                        />
                        <button
                            onClick={fetchData}
                            className="p-2.5 bg-orange-600 hover:bg-orange-500 rounded-xl text-white"
                        >
                            <RefreshCw size={20} />
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="bg-[#12121a] rounded-2xl border border-white/10 mb-6 overflow-hidden">
                    <div className="flex overflow-x-auto">
                        {TABS.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 px-6 py-4 text-sm font-medium whitespace-nowrap transition-colors ${activeTab === tab.id
                                    ? 'text-orange-400 border-b-2 border-orange-500 bg-orange-500/10'
                                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                                    }`}
                            >
                                {tab.icon}
                                {tab.name}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Tab Content */}
                <div className="bg-[#12121a] rounded-2xl border border-white/10 p-6">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="animate-spin w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full"></div>
                        </div>
                    ) : (
                        <>
                            {/* Dashboard Tab */}
                            {activeTab === 'dashboard' && dashboard && (
                                <DashboardTab dashboard={dashboard} formatCurrency={formatCurrency} />
                            )}

                            {/* Shifts Tab */}
                            {activeTab === 'shifts' && (
                                <ShiftsTab
                                    shifts={shifts}
                                    expandedShift={expandedShift}
                                    shiftDetail={shiftDetail}
                                    onExpand={handleShiftExpand}
                                    formatCurrency={formatCurrency}
                                    formatNumber={formatNumber}
                                />
                            )}

                            {/* Meters Tab */}
                            {activeTab === 'meters' && (
                                <MetersTab
                                    shifts={shifts}
                                    selectedShift={selectedShiftForMeters}
                                    onSelectShift={handleSelectShiftForMeters}
                                    meters={meters}
                                    auditLogs={auditLogs}
                                    editingMeter={editingMeter}
                                    editValue={editValue}
                                    editField={editField}
                                    editReason={editReason}
                                    onEdit={(id, value, field) => {
                                        setEditingMeter(id);
                                        setEditValue(value);
                                        setEditField(field);
                                        setEditReason('');
                                    }}
                                    onCancelEdit={() => setEditingMeter(null)}
                                    onSave={handleSaveMeter}
                                    setEditValue={setEditValue}
                                    setEditReason={setEditReason}
                                    formatNumber={formatNumber}
                                />
                            )}

                            {/* Transactions Tab */}
                            {activeTab === 'transactions' && (
                                <TransactionsTab
                                    transactions={filteredTransactions}
                                    searchQuery={searchQuery}
                                    onSearchChange={setSearchQuery}
                                    formatCurrency={formatCurrency}
                                />
                            )}

                            {/* Reports Tab */}
                            {activeTab === 'reports' && (
                                <ReportsTab
                                    reportType={reportType}
                                    setReportType={setReportType}
                                    reportStartDate={reportStartDate}
                                    setReportStartDate={setReportStartDate}
                                    reportEndDate={reportEndDate}
                                    setReportEndDate={setReportEndDate}
                                    onGenerate={handleGenerateReport}
                                    generating={generatingReport}
                                    reportData={reportData}
                                    formatCurrency={formatCurrency}
                                />
                            )}
                        </>
                    )}
                </div>
            </div>
        </Sidebar>
    );
}

// ========== Tab Components ==========

interface DashboardTabProps {
    dashboard: GasControlDashboard;
    formatCurrency: (n: number) => string;
}

function DashboardTab({ dashboard, formatCurrency }: DashboardTabProps) {
    return (
        <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-green-900/50 to-green-800/30 rounded-xl border border-green-500/20 p-4">
                    <p className="text-gray-400 text-sm flex items-center gap-1">
                        <TrendingUp size={14} />
                        ยอดขายวันนี้
                    </p>
                    <p className="text-2xl font-bold text-green-400">฿{formatCurrency(dashboard.todaySales)}</p>
                    <p className="text-xs text-gray-500">{dashboard.todayTransactions} รายการ | {formatCurrency(dashboard.todayLiters)} L</p>
                </div>
                <div className="bg-[#1a1a24] rounded-xl border border-white/10 p-4">
                    <p className="text-gray-400 text-sm flex items-center gap-1">
                        <Clock size={14} />
                        กะวันนี้
                    </p>
                    <p className="text-2xl font-bold text-white">{dashboard.shiftsToday.length}/2</p>
                    <p className="text-xs text-gray-500">
                        {dashboard.shiftsToday.map(s => (
                            <span key={s.id} className={`mr-2 ${s.status === 'OPEN' ? 'text-yellow-400' : 'text-green-400'}`}>
                                {s.shiftName}: {s.status === 'OPEN' ? '🔓' : '✓'}
                            </span>
                        ))}
                    </p>
                </div>
                <div className="bg-[#1a1a24] rounded-xl border border-white/10 p-4">
                    <p className="text-gray-400 text-sm flex items-center gap-1">
                        <Gauge size={14} />
                        ระดับแก๊ส
                    </p>
                    <p className={`text-2xl font-bold ${(dashboard.gaugeLevel || 0) < 20 ? 'text-red-400' : 'text-white'}`}>
                        {dashboard.gaugeLevel !== null ? `${dashboard.gaugeLevel.toFixed(0)}%` : 'N/A'}
                    </p>
                    {(dashboard.gaugeLevel || 0) < 20 && (
                        <p className="text-xs text-red-400">⚠️ ระดับต่ำ</p>
                    )}
                </div>
                <div className="bg-[#1a1a24] rounded-xl border border-white/10 p-4">
                    <p className="text-gray-400 text-sm flex items-center gap-1">
                        <AlertTriangle size={14} />
                        Alerts
                    </p>
                    <p className={`text-2xl font-bold ${dashboard.alerts.length > 0 ? 'text-yellow-400' : 'text-green-400'}`}>
                        {dashboard.alerts.length}
                    </p>
                </div>
            </div>

            {/* Alerts */}
            {dashboard.alerts.length > 0 && (
                <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-xl p-4">
                    <h3 className="text-yellow-400 font-medium mb-3 flex items-center gap-2">
                        <AlertTriangle size={18} />
                        แจ้งเตือน
                    </h3>
                    <div className="space-y-2">
                        {dashboard.alerts.map(alert => (
                            <div key={alert.id} className="flex items-center gap-2 text-sm">
                                <span className={`w-2 h-2 rounded-full ${alert.severity === 'CRITICAL' ? 'bg-red-500' : 'bg-yellow-500'}`}></span>
                                <span className="text-gray-300">{alert.message}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* 7-Day Trend */}
            <div>
                <h3 className="text-white font-medium mb-3 flex items-center gap-2">
                    <TrendingUp size={18} />
                    ยอดขาย 7 วันล่าสุด
                </h3>
                <div className="grid grid-cols-7 gap-2">
                    {dashboard.salesTrend7Days.map((day, i) => (
                        <div key={i} className="bg-[#1a1a24] rounded-lg p-3 text-center">
                            <p className="text-xs text-gray-500">{new Date(day.date).toLocaleDateString('th-TH', { weekday: 'short' })}</p>
                            <p className="text-sm font-bold text-white">฿{formatCurrency(day.totalSales)}</p>
                            <p className="text-xs text-gray-400">{day.transactionCount} รายการ</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

interface ShiftsTabProps {
    shifts: Array<{
        id: string;
        date: string;
        shiftNumber: number;
        shiftName: string;
        staffName: string;
        status: string;
        totalSales: number;
        totalMeterLiters: number;
        variance: number | null;
        varianceStatus: string | null;
    }>;
    expandedShift: string | null;
    shiftDetail: ShiftWithDetails | null;
    onExpand: (id: string) => void;
    formatCurrency: (n: number) => string;
    formatNumber: (n: number) => string;
}

function ShiftsTab({ shifts, expandedShift, shiftDetail, onExpand, formatCurrency, formatNumber }: ShiftsTabProps) {
    if (shifts.length === 0) {
        return (
            <div className="text-center py-12">
                <Clock size={48} className="mx-auto text-gray-600 mb-4" />
                <p className="text-gray-400">ไม่พบข้อมูลกะในวันที่เลือก</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {shifts.map(shift => (
                <div key={shift.id} className="bg-[#1a1a24] rounded-xl border border-white/10 overflow-hidden">
                    <div
                        className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/5"
                        onClick={() => onExpand(shift.id)}
                    >
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                {expandedShift === shift.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                <span className={`px-2 py-0.5 rounded text-xs ${shift.shiftNumber === 1 ? 'bg-orange-500/20 text-orange-400' : 'bg-indigo-500/20 text-indigo-400'
                                    }`}>
                                    {shift.shiftName}
                                </span>
                            </div>
                            <div>
                                <p className="text-white font-medium">{shift.date}</p>
                                <p className="text-sm text-gray-400 flex items-center gap-1">
                                    <Users size={12} />
                                    {shift.staffName}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-6 text-sm">
                            <div className="text-right">
                                <p className="text-green-400 font-bold">฿{formatCurrency(shift.totalSales)}</p>
                                <p className="text-gray-500">{formatNumber(shift.totalMeterLiters)} L</p>
                            </div>
                            <span className={`px-2 py-1 rounded text-xs ${shift.status === 'LOCKED' ? 'bg-gray-500/20 text-gray-400' :
                                shift.status === 'CLOSED' ? 'bg-green-500/20 text-green-400' :
                                    'bg-yellow-500/20 text-yellow-400'
                                }`}>
                                {shift.status === 'LOCKED' ? '🔒 Locked' :
                                    shift.status === 'CLOSED' ? '✓ Closed' : '🔓 Open'}
                            </span>
                        </div>
                    </div>

                    {expandedShift === shift.id && shiftDetail && (
                        <div className="border-t border-white/10 p-4 space-y-4">
                            {/* Meters */}
                            <div>
                                <h4 className="text-white font-medium mb-2 flex items-center gap-2">
                                    <Gauge size={16} />
                                    มิเตอร์
                                </h4>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    {shiftDetail.meters.map(m => (
                                        <div key={m.id} className="bg-[#12121a] rounded-lg p-3">
                                            <p className="text-gray-400 text-xs mb-1">หัวจ่าย {m.nozzleNumber}</p>
                                            <div className="text-sm space-y-1">
                                                <div className="flex justify-between">
                                                    <span className="text-gray-500">เริ่ม:</span>
                                                    <span className="text-white">{formatNumber(m.startReading)}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-500">จบ:</span>
                                                    <span className={m.endReading ? 'text-white' : 'text-yellow-400'}>
                                                        {m.endReading ? formatNumber(m.endReading) : '-'}
                                                    </span>
                                                </div>
                                                {m.soldQty !== null && (
                                                    <div className="flex justify-between font-medium">
                                                        <span className="text-gray-500">ขาย:</span>
                                                        <span className="text-green-400">{formatNumber(m.soldQty)} L</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Reconciliation */}
                            {shiftDetail.reconciliation && (
                                <div className="bg-gradient-to-r from-purple-900/30 to-indigo-900/30 rounded-xl p-4 border border-purple-500/20">
                                    <h4 className="text-white font-medium mb-2">📊 สรุปยอด</h4>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                        <div>
                                            <span className="text-gray-400">ยอดที่ควรได้:</span>
                                            <span className="text-white ml-2">฿{formatCurrency(shiftDetail.reconciliation.totalExpected)}</span>
                                        </div>
                                        <div>
                                            <span className="text-gray-400">ยอดที่รับจริง:</span>
                                            <span className="text-green-400 ml-2">฿{formatCurrency(shiftDetail.reconciliation.totalReceived)}</span>
                                        </div>
                                        <div>
                                            <span className="text-gray-400">ส่วนต่าง:</span>
                                            <span className={`ml-2 ${shiftDetail.reconciliation.varianceStatus === 'GREEN' ? 'text-green-400' :
                                                shiftDetail.reconciliation.varianceStatus === 'YELLOW' ? 'text-yellow-400' : 'text-red-400'
                                                }`}>
                                                ฿{formatCurrency(shiftDetail.reconciliation.variance)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Transactions Summary */}
                            <div>
                                <h4 className="text-white font-medium mb-2 flex items-center gap-2">
                                    <Receipt size={16} />
                                    รายการขาย ({shiftDetail.transactions.length} รายการ)
                                </h4>
                                {shiftDetail.transactions.length > 0 ? (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="text-gray-400 border-b border-white/10">
                                                    <th className="text-left py-2">เวลา</th>
                                                    <th className="text-left py-2">ทะเบียน</th>
                                                    <th className="text-left py-2">ประเภท</th>
                                                    <th className="text-right py-2">ลิตร</th>
                                                    <th className="text-right py-2">ยอดเงิน</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {shiftDetail.transactions.slice(0, 5).map(t => (
                                                    <tr key={t.id} className="border-b border-white/5">
                                                        <td className="py-2 text-white">
                                                            {new Date(t.date).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                                                        </td>
                                                        <td className="py-2 text-blue-400">{t.licensePlate || '-'}</td>
                                                        <td className="py-2">
                                                            <span className={`px-2 py-0.5 rounded text-xs ${t.paymentType === 'CASH' ? 'bg-green-500/20 text-green-400' :
                                                                t.paymentType === 'CREDIT' ? 'bg-purple-500/20 text-purple-400' :
                                                                    'bg-blue-500/20 text-blue-400'
                                                                }`}>
                                                                {t.paymentType}
                                                            </span>
                                                        </td>
                                                        <td className="py-2 text-right text-white">{formatNumber(t.liters)}</td>
                                                        <td className="py-2 text-right text-green-400">฿{formatCurrency(t.amount)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        {shiftDetail.transactions.length > 5 && (
                                            <p className="text-center text-gray-400 text-sm mt-2">
                                                และอีก {shiftDetail.transactions.length - 5} รายการ...
                                            </p>
                                        )}
                                    </div>
                                ) : (
                                    <p className="text-gray-500 text-sm">ไม่มีรายการขาย</p>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}

interface MetersTabProps {
    shifts: Array<{ id: string; date: string; shiftName: string }>;
    selectedShift: string | null;
    onSelectShift: (id: string) => void;
    meters: MeterReading[];
    auditLogs: Array<{ id: string; meterId: string; action: string; oldData: Record<string, unknown>; newData: Record<string, unknown>; editedBy: string; editedAt: string }>;
    editingMeter: string | null;
    editValue: number;
    editField: 'startReading' | 'endReading';
    editReason: string;
    onEdit: (id: string, value: number, field: 'startReading' | 'endReading') => void;
    onCancelEdit: () => void;
    onSave: () => void;
    setEditValue: (v: number) => void;
    setEditReason: (v: string) => void;
    formatNumber: (n: number) => string;
}

function MetersTab({
    shifts, selectedShift, onSelectShift, meters, auditLogs,
    editingMeter, editValue, editField, editReason,
    onEdit, onCancelEdit, onSave, setEditValue, setEditReason, formatNumber
}: MetersTabProps) {
    return (
        <div className="space-y-4">
            {/* Shift Selector */}
            <div className="flex items-center gap-4">
                <label className="text-gray-400">เลือกกะ:</label>
                <select
                    value={selectedShift || ''}
                    onChange={(e) => onSelectShift(e.target.value)}
                    className="px-4 py-2 bg-[#1a1a24] border border-white/10 rounded-lg text-white"
                >
                    <option value="">-- เลือกกะ --</option>
                    {shifts.map(s => (
                        <option key={s.id} value={s.id}>{s.date} - {s.shiftName}</option>
                    ))}
                </select>
            </div>

            {selectedShift && meters.length > 0 && (
                <>
                    {/* Meters Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {meters.map(m => (
                            <div key={m.id} className="bg-[#1a1a24] rounded-xl p-4 border border-white/10">
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-white font-medium">หัวจ่าย {m.nozzleNumber}</span>
                                    {editingMeter !== m.id && (
                                        <button
                                            onClick={() => onEdit(m.id, m.endReading || m.startReading, 'endReading')}
                                            className="p-1 text-purple-400 hover:bg-purple-500/20 rounded"
                                        >
                                            <Edit3 size={14} />
                                        </button>
                                    )}
                                </div>

                                {editingMeter === m.id ? (
                                    <div className="space-y-3">
                                        <div>
                                            <label className="text-xs text-gray-400">แก้ไขค่า {editField === 'startReading' ? 'เริ่ม' : 'สิ้นสุด'}</label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={editValue}
                                                onChange={(e) => setEditValue(parseFloat(e.target.value))}
                                                className="w-full px-3 py-2 bg-[#12121a] border border-white/20 rounded text-white mt-1"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-400">เหตุผล *</label>
                                            <input
                                                type="text"
                                                value={editReason}
                                                onChange={(e) => setEditReason(e.target.value)}
                                                placeholder="ระบุเหตุผลในการแก้ไข..."
                                                className="w-full px-3 py-2 bg-[#12121a] border border-white/20 rounded text-white mt-1"
                                            />
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={onCancelEdit} className="flex-1 px-3 py-1.5 bg-gray-600 text-white rounded text-sm">
                                                <X size={14} className="inline mr-1" />
                                                ยกเลิก
                                            </button>
                                            <button onClick={onSave} className="flex-1 px-3 py-1.5 bg-green-600 text-white rounded text-sm">
                                                <Save size={14} className="inline mr-1" />
                                                บันทึก
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">เริ่ม:</span>
                                            <span className="text-white">{formatNumber(m.startReading)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">สิ้นสุด:</span>
                                            <span className={m.endReading ? 'text-white' : 'text-yellow-400'}>
                                                {m.endReading ? formatNumber(m.endReading) : '-'}
                                            </span>
                                        </div>
                                        {m.soldQty !== null && (
                                            <div className="flex justify-between font-medium pt-2 border-t border-white/10">
                                                <span className="text-gray-500">ขาย:</span>
                                                <span className="text-green-400">{formatNumber(m.soldQty)} L</span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Audit Logs */}
                    {auditLogs.length > 0 && (
                        <div className="bg-[#1a1a24] rounded-xl p-4 border border-white/10">
                            <h4 className="text-white font-medium mb-3 flex items-center gap-2">
                                <FileText size={16} />
                                ประวัติการแก้ไข
                            </h4>
                            <div className="space-y-2 max-h-40 overflow-y-auto">
                                {auditLogs.map(log => (
                                    <div key={log.id} className="text-sm text-gray-400 flex items-center gap-2">
                                        <span className="text-gray-500">
                                            {new Date(log.editedAt).toLocaleString('th-TH')}
                                        </span>
                                        <span>-</span>
                                        <span className="text-purple-400">{log.editedBy}</span>
                                        <span>แก้ไข</span>
                                        <span className="text-white">
                                            {JSON.stringify(log.oldData)} → {JSON.stringify(log.newData)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}

            {selectedShift && meters.length === 0 && (
                <div className="text-center py-8">
                    <Gauge size={48} className="mx-auto text-gray-600 mb-4" />
                    <p className="text-gray-400">ไม่พบข้อมูลมิเตอร์</p>
                </div>
            )}
        </div>
    );
}

interface TransactionsTabProps {
    transactions: TransactionSummary[];
    searchQuery: string;
    onSearchChange: (q: string) => void;
    formatCurrency: (n: number) => string;
}

function TransactionsTab({ transactions, searchQuery, onSearchChange, formatCurrency }: TransactionsTabProps) {
    return (
        <div className="space-y-4">
            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-3 text-gray-400" size={18} />
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => onSearchChange(e.target.value)}
                    placeholder="ค้นหา ทะเบียน, ชื่อลูกค้า, ยอดเงิน..."
                    className="w-full pl-10 pr-4 py-2.5 bg-[#1a1a24] border border-white/10 rounded-xl text-white"
                />
            </div>

            {/* Transactions Table */}
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-gray-400 border-b border-white/10">
                            <th className="text-left p-3">เวลา</th>
                            <th className="text-left p-3">ทะเบียน</th>
                            <th className="text-left p-3">ลูกค้า</th>
                            <th className="text-left p-3">ประเภท</th>
                            <th className="text-right p-3">ลิตร</th>
                            <th className="text-right p-3">ยอดเงิน</th>
                            <th className="text-center p-3">สถานะ</th>
                            <th className="text-center p-3">จัดการ</th>
                        </tr>
                    </thead>
                    <tbody>
                        {transactions.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="text-center p-8 text-gray-400">ไม่พบรายการ</td>
                            </tr>
                        ) : (
                            transactions.map(t => (
                                <tr key={t.id} className={`border-b border-white/5 hover:bg-white/5 ${t.isVoided ? 'opacity-50' : ''}`}>
                                    <td className="p-3 text-white">
                                        {new Date(t.date).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                                    </td>
                                    <td className="p-3 text-blue-400 font-mono">{t.licensePlate || '-'}</td>
                                    <td className="p-3 text-white">{t.ownerName || '-'}</td>
                                    <td className="p-3">
                                        <span className={`px-2 py-0.5 rounded text-xs ${t.paymentType === 'CASH' ? 'bg-green-500/20 text-green-400' :
                                            t.paymentType === 'CREDIT' ? 'bg-purple-500/20 text-purple-400' :
                                                'bg-blue-500/20 text-blue-400'
                                            }`}>
                                            {t.paymentType}
                                        </span>
                                    </td>
                                    <td className="p-3 text-right text-white">{t.liters.toFixed(2)}</td>
                                    <td className="p-3 text-right text-green-400 font-medium">฿{formatCurrency(t.amount)}</td>
                                    <td className="p-3 text-center">
                                        {t.isVoided ? (
                                            <span className="text-red-400 flex items-center justify-center gap-1">
                                                <AlertTriangle size={14} />
                                                ยกเลิก
                                            </span>
                                        ) : (
                                            <span className="text-green-400 flex items-center justify-center gap-1">
                                                <CheckCircle size={14} />
                                                ปกติ
                                            </span>
                                        )}
                                    </td>
                                    <td className="p-3 text-center">
                                        {!t.isVoided && (
                                            <div className="flex items-center justify-center gap-2">
                                                <button className="p-1.5 text-blue-400 hover:bg-blue-500/20 rounded">
                                                    <Eye size={14} />
                                                </button>
                                                <button className="p-1.5 text-red-400 hover:bg-red-500/20 rounded">
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Summary */}
            {transactions.length > 0 && (
                <div className="bg-gradient-to-r from-purple-900/30 to-indigo-900/30 rounded-xl p-4 border border-purple-500/20">
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-400">รวม {transactions.filter(t => !t.isVoided).length} รายการ</span>
                        <span className="text-white">
                            {transactions.filter(t => !t.isVoided).reduce((sum, t) => sum + t.liters, 0).toFixed(2)} ลิตร
                        </span>
                        <span className="text-green-400 font-bold">
                            ฿{formatCurrency(transactions.filter(t => !t.isVoided).reduce((sum, t) => sum + t.amount, 0))}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}

interface ReportsTabProps {
    reportType: 'shift-summary' | 'daily' | 'staff-performance';
    setReportType: (t: 'shift-summary' | 'daily' | 'staff-performance') => void;
    reportStartDate: string;
    setReportStartDate: (d: string) => void;
    reportEndDate: string;
    setReportEndDate: (d: string) => void;
    onGenerate: () => void;
    generating: boolean;
    reportData: ShiftSummaryReport | DailyReport | StaffPerformanceReport | null;
    formatCurrency: (n: number) => string;
}

function ReportsTab({
    reportType, setReportType,
    reportStartDate, setReportStartDate,
    reportEndDate, setReportEndDate,
    onGenerate, generating, reportData, formatCurrency
}: ReportsTabProps) {
    return (
        <div className="space-y-6">
            {/* Report Options */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                    <label className="block text-gray-400 text-sm mb-2">ประเภทรายงาน</label>
                    <div className="flex gap-2 flex-wrap">
                        {[
                            { id: 'shift-summary', name: 'สรุปกะ' },
                            { id: 'daily', name: 'รายวัน' },
                            { id: 'staff-performance', name: 'พนักงาน' },
                        ].map(t => (
                            <button
                                key={t.id}
                                onClick={() => setReportType(t.id as typeof reportType)}
                                className={`px-4 py-2 rounded-lg text-sm ${reportType === t.id
                                    ? 'bg-orange-500 text-white'
                                    : 'bg-[#1a1a24] text-gray-400 border border-white/10'
                                    }`}
                            >
                                {t.name}
                            </button>
                        ))}
                    </div>
                </div>
                <div>
                    <label className="block text-gray-400 text-sm mb-2">วันที่เริ่มต้น</label>
                    <input
                        type="date"
                        value={reportStartDate}
                        onChange={(e) => setReportStartDate(e.target.value)}
                        className="w-full px-4 py-2 bg-[#1a1a24] border border-white/10 rounded-lg text-white"
                    />
                </div>
                <div>
                    <label className="block text-gray-400 text-sm mb-2">วันที่สิ้นสุด</label>
                    <input
                        type="date"
                        value={reportEndDate}
                        onChange={(e) => setReportEndDate(e.target.value)}
                        className="w-full px-4 py-2 bg-[#1a1a24] border border-white/10 rounded-lg text-white"
                    />
                </div>
            </div>

            {/* Generate Button */}
            <div className="flex gap-3">
                <button
                    onClick={onGenerate}
                    disabled={generating}
                    className="px-6 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl flex items-center gap-2 disabled:opacity-50"
                >
                    {generating ? (
                        <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                    ) : (
                        <Eye size={18} />
                    )}
                    {generating ? 'กำลังสร้าง...' : 'Preview รายงาน'}
                </button>
                {reportData && (
                    <button className="px-6 py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-xl flex items-center gap-2">
                        <Download size={18} />
                        Export PDF
                    </button>
                )}
            </div>

            {/* Report Preview */}
            {reportData && (
                <div className="bg-white text-black rounded-xl p-6">
                    {'shifts' in reportData && (
                        <div>
                            <h3 className="text-xl font-bold mb-2">รายงานสรุปกะ</h3>
                            <p className="text-gray-600 mb-4">{reportData.stationName} - {reportData.date}</p>
                            <table className="w-full text-sm border-collapse">
                                <thead>
                                    <tr className="border-b">
                                        <th className="text-left p-2">กะ</th>
                                        <th className="text-left p-2">พนักงาน</th>
                                        <th className="text-right p-2">ยอดขาย</th>
                                        <th className="text-right p-2">ลิตร</th>
                                        <th className="text-right p-2">รายการ</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {reportData.shifts.map((s, i) => (
                                        <tr key={i} className="border-b">
                                            <td className="p-2">{s.shiftName}</td>
                                            <td className="p-2">{s.staffName}</td>
                                            <td className="p-2 text-right">฿{formatCurrency(s.totalSales)}</td>
                                            <td className="p-2 text-right">{s.meterLiters.toFixed(2)}</td>
                                            <td className="p-2 text-right">{s.transactionCount}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="font-bold bg-gray-100">
                                        <td colSpan={2} className="p-2">รวม</td>
                                        <td className="p-2 text-right">฿{formatCurrency(reportData.totals.totalSales)}</td>
                                        <td className="p-2 text-right">{reportData.totals.totalLiters.toFixed(2)}</td>
                                        <td className="p-2 text-right">{reportData.totals.totalTransactions}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}

                    {'days' in reportData && (
                        <div>
                            <h3 className="text-xl font-bold mb-2">รายงานรายวัน</h3>
                            <p className="text-gray-600 mb-4">{reportData.stationName} | {reportData.startDate} - {reportData.endDate}</p>
                            <table className="w-full text-sm border-collapse">
                                <thead>
                                    <tr className="border-b">
                                        <th className="text-left p-2">วันที่</th>
                                        <th className="text-right p-2">ยอดขาย</th>
                                        <th className="text-right p-2">ลิตร</th>
                                        <th className="text-right p-2">รายการ</th>
                                        <th className="text-right p-2">กะ</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {reportData.days.map((d, i) => (
                                        <tr key={i} className="border-b">
                                            <td className="p-2">{d.date}</td>
                                            <td className="p-2 text-right">฿{formatCurrency(d.totalSales)}</td>
                                            <td className="p-2 text-right">{d.totalLiters.toFixed(2)}</td>
                                            <td className="p-2 text-right">{d.transactionCount}</td>
                                            <td className="p-2 text-right">{d.shiftCount}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="font-bold bg-gray-100">
                                        <td className="p-2">รวม / เฉลี่ย</td>
                                        <td className="p-2 text-right">฿{formatCurrency(reportData.totals.totalSales)}</td>
                                        <td className="p-2 text-right">{reportData.totals.totalLiters.toFixed(2)}</td>
                                        <td className="p-2 text-right">{reportData.totals.totalTransactions}</td>
                                        <td className="p-2 text-right">-</td>
                                    </tr>
                                </tfoot>
                            </table>
                            <p className="text-sm text-gray-500 mt-2">
                                เฉลี่ยต่อวัน: ฿{formatCurrency(reportData.totals.averageDailySales)}
                            </p>
                        </div>
                    )}

                    {'staff' in reportData && (
                        <div>
                            <h3 className="text-xl font-bold mb-2">รายงานประสิทธิภาพพนักงาน</h3>
                            <p className="text-gray-600 mb-4">{reportData.stationName} | {reportData.startDate} - {reportData.endDate}</p>
                            <table className="w-full text-sm border-collapse">
                                <thead>
                                    <tr className="border-b">
                                        <th className="text-left p-2">พนักงาน</th>
                                        <th className="text-right p-2">จำนวนกะ</th>
                                        <th className="text-right p-2">ยอดขายรวม</th>
                                        <th className="text-right p-2">เฉลี่ย/กะ</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {reportData.staff.map((s, i) => (
                                        <tr key={i} className="border-b">
                                            <td className="p-2">{s.staffName}</td>
                                            <td className="p-2 text-right">{s.shiftsWorked}</td>
                                            <td className="p-2 text-right">฿{formatCurrency(s.totalSales)}</td>
                                            <td className="p-2 text-right">฿{formatCurrency(s.averageSalesPerShift)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
