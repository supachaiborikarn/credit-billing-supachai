'use client';

import { useState, useEffect } from 'react';
import { AppLayout } from "@/components/layout";
import {
    TrendingUp,
    TrendingDown,
    Users,
    FileText,
    CircleDollarSign,
    Clock,
    ArrowRight,
    AlertCircle
} from "lucide-react";
import Link from 'next/link';
import { formatCurrency, formatNumber } from '@/utils/format';

interface DashboardData {
    pendingAmount: number;
    totalOwners: number;
    pendingInvoices: number;
    overdueCount: number;
    recentTransactions: Array<{
        id: string;
        licensePlate: string;
        ownerName: string;
        amount: number;
        paymentType: string;
        date: string;
    }>;
    topCustomers: Array<{
        id: string;
        name: string;
        amount: number;
        code?: string;
    }>;
}

export default function MobileDashboard() {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<DashboardData | null>(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const res = await fetch('/api/dashboard');
            if (res.ok) {
                const json = await res.json();
                setData({
                    pendingAmount: json.pendingAmount || 0,
                    totalOwners: json.totalOwners || 0,
                    pendingInvoices: json.pendingInvoices || 0,
                    overdueCount: json.overdueInvoices || 0,
                    recentTransactions: json.recentTransactions || [],
                    topCustomers: json.topCustomers || [],
                });
            }
        } catch (error) {
            console.error('Error fetching dashboard:', error);
        } finally {
            setLoading(false);
        }
    };

    const stats = [
        {
            label: "ยอดค้างชำระ",
            value: formatCurrency(data?.pendingAmount || 0),
            change: "+12%",
            trend: "up",
            icon: CircleDollarSign,
            color: "text-orange-500",
            bgColor: "bg-orange-50",
        },
        {
            label: "ลูกค้าทั้งหมด",
            value: formatNumber(data?.totalOwners || 0),
            change: "+3",
            trend: "up",
            icon: Users,
            color: "text-neutral-700",
            bgColor: "bg-neutral-100",
        },
        {
            label: "บิลค้างชำระ",
            value: formatNumber(data?.pendingInvoices || 0),
            change: "-5",
            trend: "down",
            icon: FileText,
            color: "text-red-500",
            bgColor: "bg-red-50",
        },
        {
            label: "เกินกำหนด",
            value: formatNumber(data?.overdueCount || 0),
            change: "+2",
            trend: "up",
            icon: Clock,
            color: "text-amber-500",
            bgColor: "bg-amber-50",
        },
    ];

    const paymentLabels: Record<string, string> = {
        'CASH': 'เงินสด',
        'CREDIT': 'เงินเชื่อ',
        'TRANSFER': 'โอน',
        'BOX_TRUCK': 'รถตู้ทึบ',
    };

    return (
        <AppLayout>
            {/* Welcome Section */}
            <div className="mb-6">
                <h1 className="text-2xl font-black tracking-tight text-neutral-900">สวัสดี, Admin 👋</h1>
                <p className="text-neutral-500 mt-1">ภาพรวมธุรกิจวันนี้</p>
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
                </div>
            ) : (
                <>
                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-3 mb-6">
                        {stats.map((stat) => {
                            const Icon = stat.icon;
                            return (
                                <div
                                    key={stat.label}
                                    className="p-4 border-2 border-neutral-200 bg-white rounded-xl shadow-[3px_3px_0_0_rgba(0,0,0,0.08)]"
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <Icon className={`h-5 w-5 ${stat.color}`} />
                                        <span
                                            className={`text-xs font-bold px-2 py-0.5 rounded-full ${stat.trend === "up"
                                                    ? "bg-green-100 text-green-700"
                                                    : "bg-red-100 text-red-700"
                                                }`}
                                        >
                                            {stat.trend === "up" ? (
                                                <TrendingUp className="h-3 w-3 inline mr-0.5" />
                                            ) : (
                                                <TrendingDown className="h-3 w-3 inline mr-0.5" />
                                            )}
                                            {stat.change}
                                        </span>
                                    </div>
                                    <p className="text-2xl font-black text-neutral-900">{stat.value}</p>
                                    <p className="text-xs text-neutral-500 font-medium mt-1">{stat.label}</p>
                                </div>
                            );
                        })}
                    </div>

                    {/* Recent Bills */}
                    <div className="mb-6">
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="font-bold text-neutral-900">รายการล่าสุด</h2>
                            <Link href="/reports" className="text-orange-500 text-sm font-semibold flex items-center gap-1">
                                ดูทั้งหมด <ArrowRight className="h-4 w-4" />
                            </Link>
                        </div>
                        <div className="space-y-2">
                            {data?.recentTransactions?.slice(0, 5).map((tx) => (
                                <div
                                    key={tx.id}
                                    className="flex items-center gap-3 p-3 bg-white border-2 border-neutral-200 rounded-xl shadow-[2px_2px_0_0_rgba(0,0,0,0.05)]"
                                >
                                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center font-bold text-sm ${tx.paymentType === 'CREDIT' ? 'bg-purple-100 text-purple-600' :
                                            tx.paymentType === 'CASH' ? 'bg-green-100 text-green-600' :
                                                'bg-blue-100 text-blue-600'
                                        }`}>
                                        {tx.licensePlate?.substring(0, 2) || 'XX'}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-neutral-900 truncate">{tx.ownerName || tx.licensePlate}</p>
                                        <p className="text-xs text-neutral-500">{paymentLabels[tx.paymentType] || tx.paymentType}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-neutral-900">{formatCurrency(tx.amount)}</p>
                                        <p className="text-xs text-neutral-400">บาท</p>
                                    </div>
                                </div>
                            ))}
                            {(!data?.recentTransactions || data.recentTransactions.length === 0) && (
                                <div className="text-center py-8 text-neutral-400">
                                    <FileText className="h-12 w-12 mx-auto mb-2 opacity-30" />
                                    <p>ยังไม่มีรายการ</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Top Customers */}
                    <div className="mb-6">
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="font-bold text-neutral-900">🏆 Top ลูกค้า</h2>
                            <Link href="/owners" className="text-orange-500 text-sm font-semibold flex items-center gap-1">
                                ดูทั้งหมด <ArrowRight className="h-4 w-4" />
                            </Link>
                        </div>
                        <div className="space-y-2">
                            {data?.topCustomers?.slice(0, 3).map((customer, index) => (
                                <div
                                    key={customer.id}
                                    className="flex items-center gap-3 p-3 bg-white border-2 border-neutral-200 rounded-xl shadow-[2px_2px_0_0_rgba(0,0,0,0.05)]"
                                >
                                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center text-lg font-black ${index === 0 ? 'bg-yellow-100 text-yellow-600' :
                                            index === 1 ? 'bg-neutral-200 text-neutral-600' :
                                                'bg-orange-100 text-orange-600'
                                        }`}>
                                        {index + 1}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-neutral-900 truncate">{customer.name}</p>
                                        {customer.code && (
                                            <p className="text-xs text-orange-500 font-medium">{customer.code}</p>
                                        )}
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-green-600">{formatCurrency(customer.amount)}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Alert Section */}
                    {(data?.overdueCount || 0) > 0 && (
                        <div className="p-4 bg-red-50 border-2 border-red-200 rounded-xl flex items-start gap-3">
                            <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="font-bold text-red-700">มีบิลเกินกำหนด</p>
                                <p className="text-sm text-red-600">
                                    มี {data?.overdueCount} รายการที่ต้องติดตาม
                                </p>
                            </div>
                        </div>
                    )}
                </>
            )}
        </AppLayout>
    );
}
