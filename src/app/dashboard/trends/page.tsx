'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, TrendingUp, TrendingDown, Calendar } from 'lucide-react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    BarChart,
    Bar,
    Legend
} from 'recharts';

interface TrendData {
    date: string;
    expectedAmount: number;
    receivedAmount: number;
    variance: number;
    greenCount: number;
    yellowCount: number;
    redCount: number;
}

export default function TrendsPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<TrendData[]>([]);
    const [range, setRange] = useState<'7d' | '14d' | '30d'>('7d');

    useEffect(() => {
        fetchTrends();
    }, [range]);

    const fetchTrends = async () => {
        setLoading(true);
        try {
            const endDate = new Date().toISOString().split('T')[0];
            const days = range === '7d' ? 7 : range === '14d' ? 14 : 30;
            const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

            const res = await fetch(`/api/dashboard/trends?start=${startDate}&end=${endDate}`);
            if (res.ok) {
                const result = await res.json();
                setData(result.dailySeries || []);
            }
        } catch (error) {
            console.error('Error fetching trends:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (num: number) =>
        new Intl.NumberFormat('th-TH', { minimumFractionDigits: 0 }).format(num);

    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
    };

    // Calculate totals
    const totalExpected = data.reduce((sum, d) => sum + d.expectedAmount, 0);
    const totalReceived = data.reduce((sum, d) => sum + d.receivedAmount, 0);
    const avgVariance = data.length > 0
        ? data.reduce((sum, d) => sum + d.variance, 0) / data.length
        : 0;

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg">
                <div className="px-4 py-4">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <Link href="/dashboard/executive" className="p-1">
                                <ArrowLeft size={24} />
                            </Link>
                            <div>
                                <h1 className="text-xl font-bold">Trend Analysis</h1>
                                <p className="text-blue-100 text-sm">แนวโน้มยอดขาย</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Range Selector */}
            <div className="px-4 py-3">
                <div className="flex gap-2">
                    {(['7d', '14d', '30d'] as const).map((r) => (
                        <button
                            key={r}
                            onClick={() => setRange(r)}
                            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${range === r
                                ? 'bg-blue-500 text-white shadow-md'
                                : 'bg-white text-gray-600 border border-gray-200'
                                }`}
                        >
                            {r === '7d' ? '7 วัน' : r === '14d' ? '14 วัน' : '30 วัน'}
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                </div>
            ) : (
                <div className="px-4 space-y-4">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-3 gap-2">
                        <div className="rounded-2xl p-3 bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg">
                            <div className="flex items-center gap-1 mb-1">
                                <TrendingUp className="w-3 h-3 opacity-80" />
                                <span className="text-xs opacity-90">ยอดควรได้</span>
                            </div>
                            <p className="text-lg font-bold">{formatCurrency(totalExpected)}</p>
                        </div>
                        <div className="rounded-2xl p-3 bg-gradient-to-br from-green-500 to-green-600 text-white shadow-lg">
                            <div className="flex items-center gap-1 mb-1">
                                <TrendingUp className="w-3 h-3 opacity-80" />
                                <span className="text-xs opacity-90">ยอดรับจริง</span>
                            </div>
                            <p className="text-lg font-bold">{formatCurrency(totalReceived)}</p>
                        </div>
                        <div className={`rounded-2xl p-3 text-white shadow-lg ${Math.abs(avgVariance) <= 200
                            ? 'bg-gradient-to-br from-green-500 to-green-600'
                            : Math.abs(avgVariance) <= 500
                                ? 'bg-gradient-to-br from-yellow-500 to-orange-500'
                                : 'bg-gradient-to-br from-red-500 to-red-600'
                            }`}>
                            <div className="flex items-center gap-1 mb-1">
                                {avgVariance >= 0 ? (
                                    <TrendingUp className="w-3 h-3 opacity-80" />
                                ) : (
                                    <TrendingDown className="w-3 h-3 opacity-80" />
                                )}
                                <span className="text-xs opacity-90">เฉลี่ยต่าง</span>
                            </div>
                            <p className="text-lg font-bold">{formatCurrency(avgVariance)}</p>
                        </div>
                    </div>

                    {/* Area Chart - Revenue Trend */}
                    <div className="bg-white rounded-2xl p-4 shadow-sm">
                        <h3 className="font-bold text-gray-800 mb-4">📈 แนวโน้มยอดขาย</h3>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={data}>
                                    <defs>
                                        <linearGradient id="colorExpected" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="colorReceived" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                                    <XAxis
                                        dataKey="date"
                                        tickFormatter={formatDate}
                                        tick={{ fontSize: 10, fill: '#6B7280' }}
                                    />
                                    <YAxis
                                        tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                                        tick={{ fontSize: 10, fill: '#6B7280' }}
                                    />
                                    <Tooltip
                                        formatter={(value) => formatCurrency(value as number)}
                                        labelFormatter={(label) => formatDate(label as string)}
                                    />
                                    <Legend />
                                    <Area
                                        type="monotone"
                                        dataKey="expectedAmount"
                                        name="ยอดควรได้"
                                        stroke="#3B82F6"
                                        fillOpacity={1}
                                        fill="url(#colorExpected)"
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="receivedAmount"
                                        name="ยอดรับจริง"
                                        stroke="#10B981"
                                        fillOpacity={1}
                                        fill="url(#colorReceived)"
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Bar Chart - Shift Status */}
                    <div className="bg-white rounded-2xl p-4 shadow-sm">
                        <h3 className="font-bold text-gray-800 mb-4">📊 สถานะกะ (สีเขียว/เหลือง/แดง)</h3>
                        <div className="h-48">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={data}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                                    <XAxis
                                        dataKey="date"
                                        tickFormatter={formatDate}
                                        tick={{ fontSize: 10, fill: '#6B7280' }}
                                    />
                                    <YAxis tick={{ fontSize: 10, fill: '#6B7280' }} />
                                    <Tooltip labelFormatter={(label) => formatDate(label as string)} />
                                    <Legend />
                                    <Bar dataKey="greenCount" name="🟢 เขียว" fill="#22C55E" stackId="a" />
                                    <Bar dataKey="yellowCount" name="🟡 เหลือง" fill="#EAB308" stackId="a" />
                                    <Bar dataKey="redCount" name="🔴 แดง" fill="#EF4444" stackId="a" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
