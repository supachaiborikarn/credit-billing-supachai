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
    ChevronRight
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

// Payment type labels for transaction feed
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
    const [heatMapMonth, setHeatMapMonth] = useState(new Date());

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

    // Generate calendar days for heat map
    const calendarDays = useMemo(() => {
        const year = heatMapMonth.getFullYear();
        const month = heatMapMonth.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startPadding = firstDay.getDay(); // 0 = Sunday

        const days: { date: string | null; amount: number }[] = [];

        // Padding for start of month
        for (let i = 0; i < startPadding; i++) {
            days.push({ date: null, amount: 0 });
        }

        // Actual days
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const dayData = stats?.monthlyHeatMap?.find(h => h.date === dateStr);
            days.push({ date: dateStr, amount: dayData?.amount || 0 });
        }

        return days;
    }, [heatMapMonth, stats?.monthlyHeatMap]);

    // Get heat map color based on amount
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

    // Handle date preset selection
    const handlePresetClick = (days: number) => {
        const date = new Date();
        date.setDate(date.getDate() - days);
        setSelectedDate(date.toISOString().split('T')[0]);
    };

    // Handle export
    const handleExport = async () => {
        const startDate = new Date(selectedDate);
        startDate.setDate(startDate.getDate() - 30);
        window.open(`/api/export/csv?startDate=${startDate.toISOString().split('T')[0]}&endDate=${selectedDate}`, '_blank');
    };

    // Custom tooltip for charts
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

    // Stat cards with percentage change
    const statCards = [
        {
            icon: Users,
            label: 'ลูกค้าทั้งหมด',
            value: stats?.totalOwners || 0,
            unit: 'ราย',
            gradient: 'from-purple-500 to-pink-500',
            bgGlow: 'rgba(168, 85, 247, 0.15)',
            iconColor: 'text-purple-400',
        },
        {
            icon: Truck,
            label: 'รถทั้งหมด',
            value: stats?.totalTrucks || 0,
            unit: 'คัน',
            gradient: 'from-blue-500 to-cyan-500',
            bgGlow: 'rgba(59, 130, 246, 0.15)',
            iconColor: 'text-blue-400',
        },
        {
            icon: Fuel,
            label: 'รายการวันนี้',
            value: stats?.todayTransactions || 0,
            unit: 'รายการ',
            gradient: 'from-green-500 to-emerald-500',
            bgGlow: 'rgba(34, 197, 94, 0.15)',
            iconColor: 'text-green-400',
            percentChange: stats?.countPercentChange,
        },
        {
            icon: DollarSign,
            label: 'ยอดขายวันนี้',
            value: stats?.todayAmount || 0,
            unit: 'บาท',
            gradient: 'from-orange-500 to-yellow-500',
            bgGlow: 'rgba(249, 115, 22, 0.15)',
            iconColor: 'text-orange-400',
            isCurrency: true,
            percentChange: stats?.amountPercentChange,
        },
    ];

    return (
        <Sidebar>
            <div className="max-w-7xl mx-auto relative">
                {/* Background gradient orbs */}
                <div className="fixed top-0 right-0 w-[500px] h-[500px] rounded-full opacity-20 blur-3xl pointer-events-none"
                    style={{ background: 'radial-gradient(circle, rgba(168, 85, 247, 0.3) 0%, transparent 70%)' }} />
                <div className="fixed bottom-0 left-0 w-[400px] h-[400px] rounded-full opacity-20 blur-3xl pointer-events-none"
                    style={{ background: 'radial-gradient(circle, rgba(34, 211, 238, 0.3) 0%, transparent 70%)' }} />

                {/* Header */}
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
                                <p className="text-gray-400 flex items-center gap-2">
                                    <Sparkles size={14} className="text-purple-400" />
                                    ภาพรวมทุกสถานี
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Date Range Selector & Export */}
                    <div className="flex flex-wrap items-center gap-2">
                        {/* Presets */}
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

                        {/* Date picker */}
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

                        {/* Export Button */}
                        <button
                            onClick={handleExport}
                            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
                        >
                            <Download size={16} />
                            Export
                        </button>
                    </div>
                </div>

                {/* Alerts Banner */}
                {stats?.alerts && stats.alerts.length > 0 && (
                    <div className={`mb-6 space-y-2 transition-all duration-500 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
                        {stats.alerts.map((alert, index) => (
                            <div
                                key={index}
                                className={`flex items-center gap-3 p-4 rounded-xl border ${alert.severity === 'critical' ? 'bg-red-500/10 border-red-500/30' :
                                    alert.severity === 'warning' ? 'bg-orange-500/10 border-orange-500/30' :
                                        'bg-blue-500/10 border-blue-500/30'
                                    }`}
                            >
                                {alert.severity === 'critical' ? <AlertCircle className="text-red-400" size={20} /> :
                                    alert.severity === 'warning' ? <AlertTriangle className="text-orange-400" size={20} /> :
                                        <Info className="text-blue-400" size={20} />}
                                <span className="text-white text-sm">{alert.message}</span>
                            </div>
                        ))}
                    </div>
                )}

                {/* Quick Actions */}
                <div className={`flex flex-wrap gap-3 mb-6 transition-all duration-500 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`} style={{ transitionDelay: '100ms' }}>
                    <button
                        onClick={() => router.push('/station/cm9qx0d2v0001qnfnm3w0qx5e')}
                        className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity shadow-lg shadow-purple-500/25"
                    >
                        <Plus size={18} />
                        เพิ่มรายการ
                    </button>
                    <button
                        onClick={() => router.push('/admin/full')}
                        className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
                    >
                        <Fuel size={18} />
                        🛢️ แท๊งลอย
                    </button>
                    <button
                        onClick={() => router.push('/admin/simple')}
                        className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
                    >
                        <Fuel size={18} />
                        ⛽ ปั๊มน้ำมัน
                    </button>
                    <button
                        onClick={() => router.push('/admin/gas')}
                        className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-teal-500 text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
                    >
                        <Fuel size={18} />
                        🔥 ปั๊มแก๊ส
                    </button>
                    <button
                        onClick={() => router.push('/reports')}
                        className="flex items-center gap-2 px-4 py-2.5 bg-white/5 border border-white/10 text-white rounded-xl text-sm font-medium hover:bg-white/10 transition-all"
                    >
                        <FileText size={18} />
                        รายงาน
                    </button>
                    <button
                        onClick={() => router.push('/invoices')}
                        className="flex items-center gap-2 px-4 py-2.5 bg-white/5 border border-white/10 text-white rounded-xl text-sm font-medium hover:bg-white/10 transition-all"
                    >
                        <CreditCard size={18} />
                        ใบวางบิล
                    </button>
                </div>

                {loading ? (
                    <LoadingState />
                ) : (
                    <>
                        {/* Premium Stat Cards with Percentage Change */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                            {statCards.map((card, index) => (
                                <div
                                    key={card.label}
                                    className={`relative group transition-all duration-500 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
                                    style={{ transitionDelay: `${index * 100}ms` }}
                                >
                                    {/* Card glow */}
                                    <div className="absolute -inset-0.5 bg-gradient-to-r opacity-0 group-hover:opacity-50 rounded-2xl blur-lg transition-all duration-500"
                                        style={{ background: `linear-gradient(135deg, ${card.bgGlow}, transparent)` }} />

                                    {/* Card */}
                                    <div className="relative backdrop-blur-xl rounded-2xl border border-white/10 p-5 overflow-hidden"
                                        style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)' }}>
                                        <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-20 blur-2xl"
                                            style={{ background: card.bgGlow }} />

                                        <div className="relative">
                                            <div className="flex items-center justify-between mb-3">
                                                <span className="text-sm text-gray-400">{card.label}</span>
                                                <div className={`p-2 rounded-xl bg-gradient-to-br ${card.gradient} opacity-80`}>
                                                    <card.icon className="text-white" size={18} />
                                                </div>
                                            </div>
                                            <p className={`text-3xl font-bold font-mono bg-gradient-to-r ${card.gradient} bg-clip-text text-transparent`}>
                                                {card.isCurrency ? formatCurrency(card.value) : formatNumber(card.value)}
                                            </p>
                                            <div className="flex items-center justify-between mt-1">
                                                <p className="text-sm text-gray-500">{card.unit}</p>
                                                {/* Percentage change indicator */}
                                                {card.percentChange !== undefined && (
                                                    <div className={`flex items-center gap-1 text-xs font-medium ${card.percentChange >= 0 ? 'text-green-400' : 'text-red-400'
                                                        }`}>
                                                        {card.percentChange >= 0 ? (
                                                            <ArrowUpRight size={14} />
                                                        ) : (
                                                            <ArrowDownRight size={14} />
                                                        )}
                                                        <span>{Math.abs(card.percentChange).toFixed(1)}%</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Charts Section */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                            {/* Weekly Sales Chart */}
                            <div className={`relative backdrop-blur-xl rounded-2xl border border-white/10 p-6 transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
                                style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)', transitionDelay: '400ms' }}>
                                <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-3">
                                    <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500">
                                        <TrendingUp className="text-white" size={18} />
                                    </div>
                                    ยอดขาย 7 วันล่าสุด
                                </h2>
                                <div className="h-[280px]">
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
                                            <Area
                                                type="monotone"
                                                dataKey="amount"
                                                stroke="url(#strokeGradient)"
                                                strokeWidth={3}
                                                fill="url(#colorGradient)"
                                                animationDuration={1500}
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* Payment Type Pie Chart */}
                            <div className={`relative backdrop-blur-xl rounded-2xl border border-white/10 p-6 transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
                                style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)', transitionDelay: '500ms' }}>
                                <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-3">
                                    <div className="p-2 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500">
                                        <CreditCard className="text-white" size={18} />
                                    </div>
                                    สัดส่วนการชำระเงิน
                                </h2>
                                <div className="h-[280px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={stats?.paymentTypeStats || []}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={65}
                                                outerRadius={100}
                                                paddingAngle={3}
                                                dataKey="amount"
                                                nameKey="label"
                                                animationDuration={1200}
                                            >
                                                {stats?.paymentTypeStats?.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />
                                                ))}
                                            </Pie>
                                            <Tooltip
                                                formatter={(value) => formatCurrency(value as number) + ' บาท'}
                                                contentStyle={{
                                                    backgroundColor: 'rgba(15, 15, 35, 0.95)',
                                                    border: '1px solid rgba(139, 92, 246, 0.3)',
                                                    borderRadius: '12px',
                                                    color: 'white',
                                                    backdropFilter: 'blur(12px)'
                                                }}
                                            />
                                            <Legend
                                                layout="horizontal"
                                                align="center"
                                                verticalAlign="bottom"
                                                formatter={(value: string) => <span style={{ color: '#e5e7eb' }}>{value}</span>}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>

                        {/* Recent Transactions & Calendar Heat Map */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                            {/* Recent Transactions Feed */}
                            <div className={`relative backdrop-blur-xl rounded-2xl border border-white/10 p-6 transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
                                style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)', transitionDelay: '600ms' }}>
                                <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-3">
                                    <div className="p-2 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500">
                                        <Clock className="text-white" size={18} />
                                    </div>
                                    รายการล่าสุด
                                    <span className="ml-auto px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full">LIVE</span>
                                </h2>
                                <div className="space-y-2 max-h-[320px] overflow-y-auto custom-scrollbar">
                                    {stats?.recentTransactions?.map((tx, index) => (
                                        <div
                                            key={tx.id}
                                            className="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-all duration-300"
                                            style={{ animationDelay: `${index * 50}ms` }}
                                        >
                                            <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                                                <Fuel className="text-purple-400" size={18} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-white font-medium truncate">{tx.licensePlate}</span>
                                                    <span className={`px-1.5 py-0.5 text-xs rounded ${tx.paymentType === 'CASH' ? 'bg-green-500/20 text-green-400' :
                                                        tx.paymentType === 'CREDIT' ? 'bg-purple-500/20 text-purple-400' :
                                                            'bg-blue-500/20 text-blue-400'
                                                        }`}>
                                                        {paymentLabels[tx.paymentType] || tx.paymentType}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-gray-400 truncate">{tx.ownerName} • {tx.stationName}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-green-400 font-mono font-medium">{formatCurrency(tx.amount)}</p>
                                                <p className="text-xs text-gray-500">{formatNumber(tx.liters)} ลิตร</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Mini Calendar Heat Map */}
                            <div className={`relative backdrop-blur-xl rounded-2xl border border-white/10 p-6 transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
                                style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)', transitionDelay: '700ms' }}>
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-lg font-bold text-white flex items-center gap-3">
                                        <div className="p-2 rounded-xl bg-gradient-to-br from-orange-500 to-pink-500">
                                            <Calendar className="text-white" size={18} />
                                        </div>
                                        ยอดขายรายวัน
                                    </h2>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setHeatMapMonth(new Date(heatMapMonth.setMonth(heatMapMonth.getMonth() - 1)))}
                                            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                                        >
                                            <ChevronLeft size={16} className="text-gray-400" />
                                        </button>
                                        <span className="text-white text-sm font-medium min-w-[100px] text-center">
                                            {heatMapMonth.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })}
                                        </span>
                                        <button
                                            onClick={() => setHeatMapMonth(new Date(heatMapMonth.setMonth(heatMapMonth.getMonth() + 1)))}
                                            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                                        >
                                            <ChevronRight size={16} className="text-gray-400" />
                                        </button>
                                    </div>
                                </div>

                                {/* Calendar Grid */}
                                <div className="grid grid-cols-7 gap-1">
                                    {/* Day headers */}
                                    {['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'].map(day => (
                                        <div key={day} className="text-center text-xs text-gray-500 py-1">{day}</div>
                                    ))}
                                    {/* Calendar days */}
                                    {calendarDays.map((day, index) => (
                                        <div
                                            key={index}
                                            className={`aspect-square rounded-lg flex items-center justify-center text-xs transition-all hover:scale-110 cursor-pointer ${day.date ? getHeatColor(day.amount) : ''
                                                } ${day.date === selectedDate ? 'ring-2 ring-purple-400' : ''}`}
                                            onClick={() => day.date && setSelectedDate(day.date)}
                                            title={day.date ? `${day.date}: ${formatCurrency(day.amount)}` : ''}
                                        >
                                            {day.date ? new Date(day.date).getDate() : ''}
                                        </div>
                                    ))}
                                </div>

                                {/* Legend */}
                                <div className="flex items-center justify-center gap-2 mt-4">
                                    <span className="text-xs text-gray-500">น้อย</span>
                                    <div className="flex gap-1">
                                        <div className="w-4 h-4 rounded bg-purple-900/30" />
                                        <div className="w-4 h-4 rounded bg-purple-800/40" />
                                        <div className="w-4 h-4 rounded bg-purple-700/60" />
                                        <div className="w-4 h-4 rounded bg-purple-600/80" />
                                        <div className="w-4 h-4 rounded bg-purple-500" />
                                    </div>
                                    <span className="text-xs text-gray-500">มาก</span>
                                </div>
                            </div>
                        </div>

                        {/* Top Customers & Station Stats */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                            {/* Top Customers */}
                            <div className={`relative backdrop-blur-xl rounded-2xl border border-white/10 p-6 transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
                                style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)', transitionDelay: '800ms' }}>
                                <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-3">
                                    <div className="p-2 rounded-xl bg-gradient-to-br from-yellow-500 to-orange-500">
                                        <Award className="text-white" size={18} />
                                    </div>
                                    🏆 Top 5 ลูกค้ายอดเยี่ยม
                                </h2>
                                {stats?.topCustomers && stats.topCustomers.length > 0 ? (
                                    <div className="space-y-3">
                                        {stats.topCustomers.map((customer, index) => (
                                            <div
                                                key={customer.id}
                                                className="flex items-center gap-4 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-all duration-300 group"
                                            >
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold transition-transform group-hover:scale-110 ${index === 0 ? 'bg-gradient-to-br from-yellow-400 to-orange-500 text-white' :
                                                    index === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-400 text-gray-800' :
                                                        index === 2 ? 'bg-gradient-to-br from-orange-400 to-orange-600 text-white' :
                                                            'bg-white/10 text-gray-400'
                                                    }`}>
                                                    {index + 1}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium text-white truncate">{customer.name}</p>
                                                    <p className="text-sm text-gray-400">
                                                        {customer.code && <span className="text-purple-400 mr-2">{customer.code}</span>}
                                                        {customer.count} รายการ
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="font-mono font-bold text-green-400">{formatCurrency(customer.amount)}</p>
                                                    <p className="text-xs text-gray-500">{formatNumber(customer.liters)} ลิตร</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-8 text-gray-400">ไม่มีข้อมูลลูกค้า</div>
                                )}
                            </div>

                            {/* Station Stats */}
                            <div className={`relative backdrop-blur-xl rounded-2xl border border-white/10 p-6 transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
                                style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)', transitionDelay: '900ms' }}>
                                <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-3">
                                    <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500">
                                        <Fuel className="text-white" size={18} />
                                    </div>
                                    ยอดแต่ละสถานี
                                </h2>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                                            <div
                                                key={station.id}
                                                className={`relative rounded-xl p-4 border ${color.border} bg-gradient-to-br ${color.bg} hover:scale-[1.02] transition-all duration-300`}
                                            >
                                                <div className="flex items-center gap-2 mb-3">
                                                    <span className={`w-2.5 h-2.5 rounded-full ${color.dot}`} />
                                                    <span className="text-sm font-medium text-white truncate">{station.name}</span>
                                                </div>
                                                <div className="space-y-1">
                                                    <div className="flex justify-between text-sm">
                                                        <span className="text-gray-400">ลิตร</span>
                                                        <span className="text-white font-mono">{formatNumber(stationStat?.todayLiters || 0)}</span>
                                                    </div>
                                                    <div className="flex justify-between text-sm">
                                                        <span className="text-gray-400">บาท</span>
                                                        <span className="text-green-400 font-mono font-bold">{formatCurrency(stationStat?.todayAmount || 0)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Pending Invoices */}
                        <div className={`relative backdrop-blur-xl rounded-2xl border border-white/10 p-6 transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
                            style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)', transitionDelay: '1000ms' }}>
                            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-gradient-to-br from-orange-500 to-red-500">
                                    <CreditCard className="text-white" size={18} />
                                </div>
                                บิลค้างชำระ
                            </h2>
                            <div className="flex items-center gap-8">
                                <div className="p-4 rounded-xl bg-orange-500/10 border border-orange-500/20">
                                    <p className="text-4xl font-bold bg-gradient-to-r from-orange-400 to-yellow-400 bg-clip-text text-transparent font-mono">
                                        {formatNumber(stats?.pendingInvoices || 0)}
                                    </p>
                                    <p className="text-sm text-gray-400 mt-1">ใบวางบิล</p>
                                </div>
                                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                                    <p className="text-4xl font-bold bg-gradient-to-r from-red-400 to-pink-400 bg-clip-text text-transparent font-mono">
                                        {formatCurrency(stats?.pendingAmount || 0)}
                                    </p>
                                    <p className="text-sm text-gray-400 mt-1">บาท</p>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </Sidebar>
    );
}
