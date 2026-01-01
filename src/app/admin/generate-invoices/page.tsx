'use client';

import { useState } from 'react';
import { FileText, ArrowLeft, Calendar, RefreshCw, Check, AlertCircle } from 'lucide-react';
import Link from 'next/link';

export default function GenerateInvoicesPage() {
    const [month, setMonth] = useState(new Date().getMonth() + 1);
    const [year, setYear] = useState(new Date().getFullYear());
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<{
        total: number;
        created: number;
        skipped: number;
        errors: number;
    } | null>(null);

    const handleGenerate = async () => {
        if (!confirm(`ยืนยันสร้าง Invoice สำหรับเดือน ${month}/${year}?`)) return;

        setLoading(true);
        setResult(null);
        try {
            const res = await fetch('/api/admin/invoices/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ month, year })
            });

            if (res.ok) {
                const data = await res.json();
                setResult(data);
            } else {
                const err = await res.json();
                alert(err.error || 'เกิดข้อผิดพลาด');
            }
        } catch (error) {
            console.error('Generate error:', error);
            alert('เกิดข้อผิดพลาด');
        } finally {
            setLoading(false);
        }
    };

    const months = [
        'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
        'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
    ];

    return (
        <div className="min-h-screen bg-gray-100">
            {/* Header */}
            <header className="bg-white shadow-sm sticky top-0 z-40">
                <div className="px-4 py-3 flex items-center gap-3">
                    <Link href="/admin" className="p-1">
                        <ArrowLeft size={24} className="text-gray-700" />
                    </Link>
                    <h1 className="font-bold text-gray-800 text-lg">📄 สร้างใบแจ้งหนี้</h1>
                </div>
            </header>

            <div className="p-4">
                {/* Month/Year Selector */}
                <div className="bg-white rounded-2xl p-4 mb-4">
                    <div className="flex items-center gap-2 mb-4">
                        <Calendar className="text-blue-500" size={24} />
                        <p className="font-semibold text-gray-800">เลือกเดือนที่ต้องการสร้าง</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-4">
                        <div>
                            <label className="text-sm text-gray-500 block mb-1">เดือน</label>
                            <select
                                value={month}
                                onChange={(e) => setMonth(Number(e.target.value))}
                                className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                {months.map((m, i) => (
                                    <option key={i} value={i + 1}>{m}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="text-sm text-gray-500 block mb-1">ปี</label>
                            <select
                                value={year}
                                onChange={(e) => setYear(Number(e.target.value))}
                                className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                {[2024, 2025, 2026, 2027].map(y => (
                                    <option key={y} value={y}>{y + 543}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <button
                        onClick={handleGenerate}
                        disabled={loading}
                        className="w-full py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:from-blue-600 hover:to-purple-600 disabled:opacity-50"
                    >
                        {loading ? (
                            <>
                                <RefreshCw size={20} className="animate-spin" />
                                กำลังสร้าง...
                            </>
                        ) : (
                            <>
                                <FileText size={20} />
                                สร้าง Invoice ทั้งหมด
                            </>
                        )}
                    </button>
                </div>

                {/* Result */}
                {result && (
                    <div className="bg-white rounded-2xl p-4">
                        <div className="flex items-center gap-2 mb-4">
                            <Check className="text-green-500" size={24} />
                            <p className="font-semibold text-gray-800">ผลลัพธ์</p>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-blue-50 rounded-xl p-3 text-center">
                                <p className="text-2xl font-bold text-blue-600">{result.total}</p>
                                <p className="text-sm text-blue-500">เจ้าของทั้งหมด</p>
                            </div>
                            <div className="bg-green-50 rounded-xl p-3 text-center">
                                <p className="text-2xl font-bold text-green-600">{result.created}</p>
                                <p className="text-sm text-green-500">สร้างสำเร็จ</p>
                            </div>
                            <div className="bg-gray-50 rounded-xl p-3 text-center">
                                <p className="text-2xl font-bold text-gray-600">{result.skipped}</p>
                                <p className="text-sm text-gray-500">ข้าม (มีแล้ว)</p>
                            </div>
                            <div className="bg-red-50 rounded-xl p-3 text-center">
                                <p className="text-2xl font-bold text-red-600">{result.errors}</p>
                                <p className="text-sm text-red-500">ผิดพลาด</p>
                            </div>
                        </div>

                        {result.created > 0 && (
                            <Link
                                href="/admin/invoices"
                                className="mt-4 block w-full py-2 border border-blue-300 text-blue-600 rounded-xl text-center hover:bg-blue-50"
                            >
                                ดูรายการ Invoice →
                            </Link>
                        )}
                    </div>
                )}

                {/* Info */}
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mt-4">
                    <div className="flex items-start gap-2">
                        <AlertCircle className="text-blue-500 mt-0.5" size={18} />
                        <div className="text-sm text-blue-700">
                            <p className="font-semibold mb-1">หมายเหตุ:</p>
                            <ul className="list-disc list-inside space-y-1 text-blue-600">
                                <li>ระบบจะสร้าง Invoice ให้เจ้าของที่มียอดค้างชำระ</li>
                                <li>Invoice ที่เคยสร้างแล้วจะถูกข้าม (ไม่สร้างซ้ำ)</li>
                                <li>Invoice จะถูกกำหนดให้ชำระภายในวันที่ 15 ของเดือนถัดไป</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
