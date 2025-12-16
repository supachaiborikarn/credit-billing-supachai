'use client';

import { useState, useEffect } from 'react';
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
    Sparkles
} from 'lucide-react';
import { STATIONS } from '@/constants';
import {
    BarChart,
    Bar,
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

export default function DashboardPage() {
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [mounted, setMounted] = useState(false);

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

    // Stat card gradient configs
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
                <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
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
                    <div className="flex items-center gap-3">
                        <Calendar size={20} className="text-gray-400" />
                        <div className="relative group">
                            <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-600 to-cyan-600 rounded-xl opacity-0 group-hover:opacity-30 blur transition-all duration-300" />
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="relative px-4 py-2.5 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50 transition-all duration-300"
                            />
                        </div>
                    </div>
                </div>

                {loading ? (
                    <LoadingState />
                ) : (
                    <>
                        {/* Premium Stat Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
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
                                        {/* Background gradient */}
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
                                            <p className="text-sm text-gray-500 mt-1">{card.unit}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Charts Section */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
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
                                                formatter={(value: number) => formatCurrency(value) + ' บาท'}
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

                        {/* Top Customers & Station Stats */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                            {/* Top Customers */}
                            <div className={`relative backdrop-blur-xl rounded-2xl border border-white/10 p-6 transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
                                style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)', transitionDelay: '600ms' }}>
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
                                style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)', transitionDelay: '700ms' }}>
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
                            style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)', transitionDelay: '800ms' }}>
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
