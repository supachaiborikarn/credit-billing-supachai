'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { LoadingState } from '@/components/Spinner';
import { formatNumber, formatCurrency, formatCompact } from '@/utils/format';
import { DashboardStats } from '@/types';
import {
    Users,
    Truck,
    CreditCard,
    Calendar,
    DollarSign,
    Fuel,
    Award,
    BarChart3,
    TrendingUp,
    TrendingDown,
    Sparkles,
    ArrowUpRight,
    ArrowDownRight,
    Plus,
    FileText,
    Download,
    Clock,
    AlertTriangle,
    Info,
    AlertCircle,
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    MoreHorizontal,
    Eye,
    EyeOff,
    Check,
    X
} from 'lucide-react';
import { STATIONS } from '@/constants';
import {
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Legend,
    AreaChart,
    Area
} from 'recharts';

// Date range presets
const DATE_PRESETS = [
    { label: 'วันนี้', days: 0 },
    { label: 'เมื่อวาน', days: 1 },
    { label: '7 วัน', days: 6 },
    { label: '30 วัน', days: 29 },
];

// Payment type labels
const paymentLabels: Record<string, string> = {
    'CASH': 'เงินสด',
    'CREDIT': 'เงินเชื่อ',
    'TRANSFER': 'โอน',
    'BOX_TRUCK': 'รถตู้ทึบ',
    'OIL_TRUCK_SUPACHAI': 'รถน้ำมัน'
};

export default function DashboardPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [mounted, setMounted] = useState(false);
    const [showQuickMenu, setShowQuickMenu] = useState(false);
    const [showCalendar, setShowCalendar] = useState(false);
    const [heatMapMonth, setHeatMapMonth] = useState(new Date());
    const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());

    // TODO: Get actual user role from auth context
    const userRole = 'ADMIN'; // 'ADMIN' | 'STAFF' | 'OWNER'

    useEffect(() => {
        setMounted(true);
        fetchStats();
    }, [selectedDate]);

    const fetchStats = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/dashboard?date=${selectedDate}`);
            if (res.ok) {
                const data = await res.json();
                setStats(data);
            }
        } catch (error) {
            console.error('Error fetching stats:', error);
        } finally {
            setLoading(false);
        }
    };

    // Filter alerts (limit 5, exclude dismissed)
    const visibleAlerts = useMemo(() => {
        if (!stats?.alerts) return [];
        return stats.alerts
            .filter(alert => !dismissedAlerts.has(alert.message))
            .slice(0, 5);
    }, [stats?.alerts, dismissedAlerts]);

    const handleDismissAlert = (message: string) => {
        setDismissedAlerts(prev => new Set([...prev, message]));
    };

    // Generate calendar days for heat map
    const calendarDays = useMemo(() => {
        const year = heatMapMonth.getFullYear();
        const month = heatMapMonth.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startPadding = firstDay.getDay();

        const days: { date: string | null; amount: number }[] = [];
        for (let i = 0; i < startPadding; i++) {
            days.push({ date: null, amount: 0 });
        }
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const dayData = stats?.monthlyHeatMap?.find(h => h.date === dateStr);
            days.push({ date: dateStr, amount: dayData?.amount || 0 });
        }
        return days;
    }, [heatMapMonth, stats?.monthlyHeatMap]);

    const getHeatColor = (amount: number) => {
        if (amount === 0) return 'bg-white/5';
        const maxAmount = Math.max(...(stats?.monthlyHeatMap?.map(h => h.amount) || [1]));
        const intensity = amount / maxAmount;
        if (intensity > 0.8) return 'bg-purple-500';
        if (intensity > 0.6) return 'bg-purple-600/80';
        if (intensity > 0.4) return 'bg-purple-700/60';
        if (intensity > 0.2) return 'bg-purple-800/40';
        return 'bg-purple-900/30';
    };

    const handlePresetClick = (days: number) => {
        const date = new Date();
        date.setDate(date.getDate() - days);
        setSelectedDate(date.toISOString().split('T')[0]);
    };

    const handleExport = async () => {
        const startDate = new Date(selectedDate);
        startDate.setDate(startDate.getDate() - 30);
        window.open(`/api/export/csv?startDate=${startDate.toISOString().split('T')[0]}&endDate=${selectedDate}`, '_blank');
    };

    // Custom tooltip
    const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; dataKey: string }>; label?: string }) => {
        if (active && payload && payload.length) {
            return (
                <div className="backdrop-blur-xl rounded-xl p-3 border border-purple-500/30" style={{ background: 'rgba(15, 15, 35, 0.9)' }}>
                    <p className="text-white font-medium">{label}</p>
                    {payload.map((entry, index) => (
                        <p key={index} className="text-sm text-gray-300">
                            {entry.dataKey === 'amount' ? 'ยอดขาย: ' : 'ลิตร: '}
                            <span className="text-purple-400 font-mono">
                                {formatCurrency(entry.value)}
                            </span>
                        </p>
                    ))}
                </div>
            );
        }
        return null;
    };

    // Card component for consistent styling
    const Card = ({ children, className = '', delay = '0ms' }: { children: React.ReactNode; className?: string; delay?: string }) => (
        <div
            className={`relative backdrop-blur-xl rounded-2xl border border-white/10 p-6 transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'} ${className}`}
            style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)', transitionDelay: delay }}
        >
            {children}
        </div>
    );

    const SectionTitle = ({ icon: Icon, title, action, iconGradient = 'from-purple-500 to-pink-500' }: { icon: React.ElementType; title: string; action?: React.ReactNode; iconGradient?: string }) => (
        <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-3">
                <div className={`p-2 rounded-xl bg-gradient-to-br ${iconGradient}`}>
                    <Icon className="text-white" size={18} />
                </div>
                {title}
            </h2>
            {action}
        </div>
    );

    return (
        <Sidebar>
            <div className="max-w-7xl mx-auto relative">
                {/* Background gradient orbs */}
                <div className="fixed top-0 right-0 w-[500px] h-[500px] rounded-full opacity-20 blur-3xl pointer-events-none"
                    style={{ background: 'radial-gradient(circle, rgba(168, 85, 247, 0.3) 0%, transparent 70%)' }} />
                <div className="fixed bottom-0 left-0 w-[400px] h-[400px] rounded-full opacity-20 blur-3xl pointer-events-none"
                    style={{ background: 'radial-gradient(circle, rgba(34, 211, 238, 0.3) 0%, transparent 70%)' }} />

                {/* =============== HEADER =============== */}
                <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
                    <div>
                        <div className="flex items-center gap-3">
                            <div className="p-3 rounded-2xl bg-gradient-to-br from-purple-500 to-cyan-500">
                                <BarChart3 className="text-white" size={28} />
                            </div>
                            <div>
                                <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-white via-purple-200 to-white bg-clip-text text-transparent">
                                    Dashboard
                                </h1>
                                <div className="flex items-center gap-3 text-gray-400">
                                    <span className="flex items-center gap-1.5">
                                        <Sparkles size={14} className="text-purple-400" />
                                        ภาพรวมทุกสถานี
                                    </span>
                                    {stats?.lastUpdated && (
                                        <span className="flex items-center gap-1 text-xs text-gray-500">
                                            <Clock size={12} />
                                            อัปเดต {new Date(stats.lastUpdated).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Date Selector & Export */}
                    <div className="flex flex-wrap items-center gap-2">
                        {DATE_PRESETS.map((preset) => (
                            <button
                                key={preset.label}
                                onClick={() => handlePresetClick(preset.days)}
                                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${new Date(selectedDate).toDateString() === new Date(new Date().setDate(new Date().getDate() - preset.days)).toDateString()
                                    ? 'bg-purple-500 text-white'
                                    : 'bg-white/5 text-gray-400 hover:bg-white/10'
                                    }`}
                            >
                                {preset.label}
                            </button>
                        ))}
                        <div className="relative group">
                            <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-600 to-cyan-600 rounded-xl opacity-0 group-hover:opacity-30 blur transition-all duration-300" />
                            <div className="relative flex items-center">
                                <Calendar size={16} className="absolute left-3 text-gray-400" />
                                <input
                                    type="date"
                                    value={selectedDate}
                                    onChange={(e) => setSelectedDate(e.target.value)}
                                    className="pl-9 pr-3 py-2 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-purple-500/50 transition-all duration-300"
                                />
                            </div>
                        </div>
                        <button
                            onClick={handleExport}
                            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
                        >
                            <Download size={16} />
                            Export
                        </button>
                    </div>
                </div>

                {/* =============== ZONE 1: CRITICAL ALERTS =============== */}
                {visibleAlerts.length > 0 && (
                    <div className={`mb-6 space-y-2 transition-all duration-500 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
                        {visibleAlerts.map((alert, index) => (
                            <div
                                key={index}
                                className={`flex items-center gap-3 p-4 rounded-xl border ${alert.severity === 'critical' ? 'bg-red-500/10 border-red-500/30' :
                                    alert.severity === 'warning' ? 'bg-orange-500/10 border-orange-500/30' :
                                        'bg-blue-500/10 border-blue-500/30'
                                    }`}
                            >
                                {alert.severity === 'critical' ? <AlertCircle className="text-red-400 flex-shrink-0" size={20} /> :
                                    alert.severity === 'warning' ? <AlertTriangle className="text-orange-400 flex-shrink-0" size={20} /> :
                                        <Info className="text-blue-400 flex-shrink-0" size={20} />}
                                <span className="text-white text-sm flex-1">{alert.message}</span>
                                <button
                                    onClick={() => handleDismissAlert(alert.message)}
                                    className="p-1 rounded hover:bg-white/10 transition-colors text-gray-400 hover:text-white"
                                    title="ซ่อน"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {/* =============== QUICK ACTIONS =============== */}
                <div className={`flex flex-wrap gap-3 mb-6 transition-all duration-500 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`} style={{ transitionDelay: '100ms' }}>
                    <button
                        onClick={() => router.push('/station/cm9qx0d2v0001qnfnm3w0qx5e')}
                        className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity shadow-lg shadow-purple-500/25"
                    >
                        <Plus size={18} />
                        เพิ่มรายการขาย
                    </button>

                    <div className="relative">
                        <button
                            onClick={() => setShowQuickMenu(!showQuickMenu)}
                            className="flex items-center gap-2 px-4 py-2.5 bg-white/5 border border-white/10 text-white rounded-xl text-sm font-medium hover:bg-white/10 transition-all"
                        >
                            <Fuel size={18} />
                            ไปยังสถานี
                            <ChevronDown size={16} className={`transition-transform ${showQuickMenu ? 'rotate-180' : ''}`} />
                        </button>
                        {showQuickMenu && (
                            <div className="absolute top-full left-0 mt-2 w-56 backdrop-blur-xl rounded-xl border border-white/10 overflow-hidden z-50"
                                style={{ background: 'rgba(15, 15, 35, 0.95)' }}>
                                <button onClick={() => { router.push('/admin/full'); setShowQuickMenu(false); }}
                                    className="w-full flex items-center gap-3 px-4 py-3 text-left text-white hover:bg-white/10 transition-colors">
                                    <span className="text-lg">🛢️</span>แท๊งลอย
                                </button>
                                <button onClick={() => { router.push('/admin/simple'); setShowQuickMenu(false); }}
                                    className="w-full flex items-center gap-3 px-4 py-3 text-left text-white hover:bg-white/10 transition-colors">
                                    <span className="text-lg">⛽</span>ปั๊มน้ำมัน
                                </button>
                                <button onClick={() => { router.push('/admin/gas'); setShowQuickMenu(false); }}
                                    className="w-full flex items-center gap-3 px-4 py-3 text-left text-white hover:bg-white/10 transition-colors">
                                    <span className="text-lg">🔥</span>ปั๊มแก๊ส
                                </button>
                            </div>
                        )}
                    </div>

                    <button onClick={() => router.push('/reports')} className="flex items-center gap-2 px-3 py-2.5 text-gray-400 hover:text-white rounded-xl text-sm transition-colors">
                        <FileText size={16} />รายงาน
                    </button>
                    <button onClick={() => router.push('/invoices')} className="flex items-center gap-2 px-3 py-2.5 text-gray-400 hover:text-white rounded-xl text-sm transition-colors">
                        <CreditCard size={16} />ใบวางบิล
                    </button>
                </div>

                {loading ? (
                    <LoadingState />
                ) : (
                    <>
                        {/* =============== ZONE 2: TODAY SNAPSHOT =============== */}
                        <Card className="mb-6" delay="200ms">
                            <SectionTitle icon={TrendingUp} title="สรุปวันนี้" iconGradient="from-green-500 to-emerald-500" />
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                {/* Sales Amount - Primary */}
                                <div className="col-span-2 lg:col-span-1 p-4 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/20">
                                    <p className="text-sm text-gray-400 mb-1">ยอดขาย</p>
                                    <p className="text-3xl font-bold text-green-400 font-mono">{formatCurrency(stats?.todayAmount || 0)}</p>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-xs text-gray-500">บาท</span>
                                        {stats?.amountPercentChange !== null && stats?.amountPercentChange !== undefined && (
                                            <span className={`flex items-center gap-0.5 text-xs font-medium ${stats.amountPercentChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                {stats.amountPercentChange >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                                                {Math.abs(stats.amountPercentChange).toFixed(0)}%
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Transactions */}
                                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                                    <p className="text-sm text-gray-400 mb-1">รายการ</p>
                                    <p className="text-2xl font-bold text-white font-mono">{formatNumber(stats?.todayTransactions || 0)}</p>
                                    <span className="text-xs text-gray-500">รายการ</span>
                                </div>

                                {/* Liters */}
                                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                                    <p className="text-sm text-gray-400 mb-1">ปริมาณ</p>
                                    <p className="text-2xl font-bold text-blue-400 font-mono">{formatNumber(stats?.todayLiters || 0)}</p>
                                    <span className="text-xs text-gray-500">ลิตร</span>
                                </div>

                                {/* Pending */}
                                <div className="p-4 rounded-xl bg-orange-500/10 border border-orange-500/20">
                                    <p className="text-sm text-gray-400 mb-1">ค้างชำระ</p>
                                    <p className="text-2xl font-bold text-orange-400 font-mono">{formatCurrency(stats?.pendingAmount || 0)}</p>
                                    <span className="text-xs text-gray-500">{stats?.pendingInvoices || 0} ใบ</span>
                                </div>
                            </div>
                        </Card>

                        {/* =============== ZONE 3: SALES TREND =============== */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                            {/* Weekly Sales Chart */}
                            <Card delay="300ms">
                                <SectionTitle icon={TrendingUp} title="ยอดขาย 7 วันล่าสุด" />
                                <div className="h-[250px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={stats?.weeklySales || []} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%" stopColor="#a855f7" stopOpacity={0.8} />
                                                    <stop offset="95%" stopColor="#a855f7" stopOpacity={0.05} />
                                                </linearGradient>
                                                <linearGradient id="strokeGradient" x1="0" y1="0" x2="1" y2="0">
                                                    <stop offset="0%" stopColor="#a855f7" />
                                                    <stop offset="100%" stopColor="#22d3ee" />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                            <XAxis dataKey="dayName" stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                                            <YAxis stroke="#6b7280" fontSize={12} tickFormatter={formatCompact} tickLine={false} axisLine={false} />
                                            <Tooltip content={<CustomTooltip />} />
                                            <Area type="monotone" dataKey="amount" stroke="url(#strokeGradient)" strokeWidth={3} fill="url(#colorGradient)" animationDuration={1500} />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </Card>

                            {/* Payment Type Pie */}
                            <Card delay="400ms">
                                <SectionTitle icon={CreditCard} title="สัดส่วนการชำระเงิน" iconGradient="from-blue-500 to-cyan-500" />
                                <div className="h-[250px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie data={stats?.paymentTypeStats || []} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="amount" nameKey="label" animationDuration={1200}>
                                                {stats?.paymentTypeStats?.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />
                                                ))}
                                            </Pie>
                                            <Tooltip formatter={(value) => formatCurrency(value as number) + ' บาท'} contentStyle={{ backgroundColor: 'rgba(15, 15, 35, 0.95)', border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '12px', color: 'white' }} />
                                            <Legend layout="horizontal" align="center" verticalAlign="bottom" formatter={(value: string) => <span style={{ color: '#e5e7eb' }}>{value}</span>} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </Card>
                        </div>

                        {/* =============== ZONE 4: TOP PERFORMANCE =============== */}
                        {(userRole === 'ADMIN' || userRole === 'OWNER') && (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                                {/* Top Customers */}
                                <Card delay="500ms">
                                    <SectionTitle icon={Award} title="🏆 Top 5 ลูกค้า (30 วัน)" iconGradient="from-yellow-500 to-orange-500" />
                                    {stats?.topCustomers && stats.topCustomers.length > 0 ? (
                                        <div className="space-y-2">
                                            {stats.topCustomers.map((customer, index) => (
                                                <div key={customer.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-all duration-300">
                                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${index === 0 ? 'bg-gradient-to-br from-yellow-400 to-orange-500 text-white' :
                                                        index === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-400 text-gray-800' :
                                                            index === 2 ? 'bg-gradient-to-br from-orange-400 to-orange-600 text-white' : 'bg-white/10 text-gray-400'}`}>
                                                        {index + 1}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-medium text-white truncate text-sm">{customer.name}</p>
                                                        <p className="text-xs text-gray-400">{customer.count} รายการ</p>
                                                    </div>
                                                    <p className="font-mono font-bold text-green-400 text-sm">{formatCurrency(customer.amount)}</p>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-8 text-gray-400">ไม่มีข้อมูล</div>
                                    )}
                                </Card>

                                {/* Station Stats */}
                                <Card delay="600ms">
                                    <SectionTitle icon={Fuel} title="ยอดแต่ละสถานี" iconGradient="from-cyan-500 to-blue-500" />
                                    <div className="grid grid-cols-2 gap-2">
                                        {STATIONS.map((station, index) => {
                                            const stationStat = stats?.stationStats?.find(s => s.stationName === station.name);
                                            const colors = [
                                                { bg: 'from-purple-500/20 to-pink-500/20', border: 'border-purple-500/30', dot: 'bg-purple-500' },
                                                { bg: 'from-blue-500/20 to-cyan-500/20', border: 'border-blue-500/30', dot: 'bg-blue-500' },
                                                { bg: 'from-green-500/20 to-emerald-500/20', border: 'border-green-500/30', dot: 'bg-green-500' },
                                                { bg: 'from-orange-500/20 to-yellow-500/20', border: 'border-orange-500/30', dot: 'bg-orange-500' },
                                                { bg: 'from-cyan-500/20 to-blue-500/20', border: 'border-cyan-500/30', dot: 'bg-cyan-500' },
                                                { bg: 'from-pink-500/20 to-rose-500/20', border: 'border-pink-500/30', dot: 'bg-pink-500' },
                                            ];
                                            const color = colors[index % colors.length];
                                            return (
                                                <div key={station.id} className={`rounded-xl p-3 border ${color.border} bg-gradient-to-br ${color.bg}`}>
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <span className={`w-2 h-2 rounded-full ${color.dot}`} />
                                                        <span className="text-xs font-medium text-white truncate">{station.name}</span>
                                                    </div>
                                                    <p className="text-green-400 font-mono font-bold text-sm">{formatCurrency(stationStat?.todayAmount || 0)}</p>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </Card>
                            </div>
                        )}

                        {/* =============== ZONE 5: RECENT ACTIVITY + CALENDAR =============== */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                            {/* Recent Transactions */}
                            <Card delay="700ms">
                                <SectionTitle
                                    icon={Clock}
                                    title="รายการล่าสุด"
                                    iconGradient="from-cyan-500 to-blue-500"
                                    action={<span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full">LIVE</span>}
                                />
                                <div className="space-y-2 max-h-[240px] overflow-y-auto custom-scrollbar">
                                    {stats?.recentTransactions?.slice(0, 6).map((tx) => (
                                        <div key={tx.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-white/5 hover:bg-white/10 transition-all duration-300">
                                            <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                                                <Fuel className="text-purple-400" size={14} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-white font-medium text-sm truncate">{tx.licensePlate}</span>
                                                    <span className={`px-1 py-0.5 text-xs rounded ${tx.paymentType === 'CASH' ? 'bg-green-500/20 text-green-400' :
                                                        tx.paymentType === 'CREDIT' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'}`}>
                                                        {paymentLabels[tx.paymentType] || tx.paymentType}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-gray-400 truncate">{tx.ownerName} • {tx.stationName}</p>
                                            </div>
                                            <p className="text-green-400 font-mono font-medium text-sm">{formatCurrency(tx.amount)}</p>
                                        </div>
                                    ))}
                                </div>
                            </Card>

                            {/* Calendar Heat Map - Collapsible */}
                            <Card delay="800ms">
                                <div className="flex items-center justify-between mb-4">
                                    <SectionTitle icon={Calendar} title="ยอดขายรายวัน" iconGradient="from-orange-500 to-pink-500" />
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => setHeatMapMonth(new Date(heatMapMonth.setMonth(heatMapMonth.getMonth() - 1)))} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                                            <ChevronLeft size={16} className="text-gray-400" />
                                        </button>
                                        <span className="text-white text-sm font-medium min-w-[100px] text-center">
                                            {heatMapMonth.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })}
                                        </span>
                                        <button onClick={() => setHeatMapMonth(new Date(heatMapMonth.setMonth(heatMapMonth.getMonth() + 1)))} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                                            <ChevronRight size={16} className="text-gray-400" />
                                        </button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-7 gap-1">
                                    {['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'].map(day => (
                                        <div key={day} className="text-center text-xs text-gray-500 py-1">{day}</div>
                                    ))}
                                    {calendarDays.map((day, index) => (
                                        <div
                                            key={index}
                                            className={`aspect-square rounded-md flex items-center justify-center text-xs transition-all hover:scale-110 cursor-pointer ${day.date ? getHeatColor(day.amount) : ''} ${day.date === selectedDate ? 'ring-2 ring-purple-400' : ''}`}
                                            onClick={() => day.date && setSelectedDate(day.date)}
                                            title={day.date ? `${day.date}: ${formatCurrency(day.amount)}` : ''}
                                        >
                                            {day.date ? new Date(day.date).getDate() : ''}
                                        </div>
                                    ))}
                                </div>
                                <div className="flex items-center justify-center gap-2 mt-3">
                                    <span className="text-xs text-gray-500">น้อย</span>
                                    <div className="flex gap-0.5">
                                        <div className="w-3 h-3 rounded bg-purple-900/30" />
                                        <div className="w-3 h-3 rounded bg-purple-800/40" />
                                        <div className="w-3 h-3 rounded bg-purple-700/60" />
                                        <div className="w-3 h-3 rounded bg-purple-600/80" />
                                        <div className="w-3 h-3 rounded bg-purple-500" />
                                    </div>
                                    <span className="text-xs text-gray-500">มาก</span>
                                </div>
                            </Card>
                        </div>

                        {/* =============== ADMIN ONLY: Stats Overview =============== */}
                        {userRole === 'ADMIN' && (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                                <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-center">
                                    <Users className="mx-auto text-purple-400 mb-2" size={24} />
                                    <p className="text-2xl font-bold text-white font-mono">{formatNumber(stats?.totalOwners || 0)}</p>
                                    <p className="text-xs text-gray-400">ลูกค้าทั้งหมด</p>
                                </div>
                                <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-center">
                                    <Truck className="mx-auto text-blue-400 mb-2" size={24} />
                                    <p className="text-2xl font-bold text-white font-mono">{formatNumber(stats?.totalTrucks || 0)}</p>
                                    <p className="text-xs text-gray-400">รถทั้งหมด</p>
                                </div>
                                <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-center">
                                    <FileText className="mx-auto text-orange-400 mb-2" size={24} />
                                    <p className="text-2xl font-bold text-white font-mono">{formatNumber(stats?.pendingInvoices || 0)}</p>
                                    <p className="text-xs text-gray-400">ใบวางบิลค้าง</p>
                                </div>
                                <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-center">
                                    <DollarSign className="mx-auto text-green-400 mb-2" size={24} />
                                    <p className="text-2xl font-bold text-white font-mono">{formatCurrency(stats?.yesterdayAmount || 0)}</p>
                                    <p className="text-xs text-gray-400">ยอดเมื่อวาน</p>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </Sidebar>
    );
}
