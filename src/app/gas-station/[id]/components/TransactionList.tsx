'use client';

import Link from 'next/link';
import { ChevronRight, Trash2, FileText } from 'lucide-react';
import { Transaction } from '../hooks/useGasStation';

interface TransactionListProps {
    transactions: Transaction[];
    stationId: string;
    deletingId: string | null;
    onDelete: (id: string) => void;
    formatTime: (dateStr: string) => string;
    formatCurrency: (num: number) => string;
}

export default function TransactionList({
    transactions,
    stationId,
    deletingId,
    onDelete,
    formatTime,
    formatCurrency,
}: TransactionListProps) {
    return (
        <div className="rounded-3xl border border-black/10 bg-white overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-black/5">
                <h2 className="text-xl font-black tracking-tight">📋 รายการล่าสุด</h2>
                <Link
                    href={`/gas-station/${stationId}/new/summary`}
                    className="inline-flex items-center gap-1 text-sm font-extrabold text-orange-500 hover:text-orange-600"
                >
                    ดูทั้งหมด <ChevronRight size={16} />
                </Link>
            </div>
            <div className="divide-y divide-black/5">
                {transactions.length > 0 ? (
                    transactions.map((t) => (
                        <div key={t.id} className="px-5 py-4 flex items-center justify-between hover:bg-[#fafafa] transition">
                            <div className="flex-1">
                                <p className="font-extrabold text-neutral-900">{t.licensePlate || '-'}</p>
                                <p className="text-xs font-semibold text-neutral-500">
                                    {formatTime(t.date)} • {t.liters} ลิตร
                                </p>
                            </div>
                            <div className="text-right mr-4">
                                <p className="font-black text-neutral-900">฿{formatCurrency(t.amount)}</p>
                                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold ${t.paymentType === 'CASH' ? 'bg-green-100 text-green-700' :
                                    t.paymentType === 'CREDIT' ? 'bg-purple-100 text-purple-700' :
                                        'bg-blue-100 text-blue-700'
                                    }`}>
                                    {t.paymentType === 'CASH' ? 'เงินสด' : t.paymentType === 'CREDIT' ? 'เงินเชื่อ' : 'บัตร'}
                                </span>
                            </div>
                            <button
                                onClick={() => onDelete(t.id)}
                                disabled={deletingId === t.id}
                                className="p-2 rounded-full hover:bg-red-50 text-red-400 hover:text-red-600 transition disabled:opacity-50"
                            >
                                {deletingId === t.id ? (
                                    <div className="w-5 h-5 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <Trash2 size={18} />
                                )}
                            </button>
                        </div>
                    ))
                ) : (
                    <div className="p-10 text-center">
                        <FileText size={40} className="mx-auto mb-3 text-neutral-300" />
                        <p className="text-neutral-400 font-semibold">ยังไม่มีรายการวันนี้</p>
                    </div>
                )}
            </div>
        </div>
    );
}
