'use client';

import { useState, useEffect, use } from 'react';
import { ArrowLeft, RefreshCw, CheckCircle, AlertTriangle, Printer } from 'lucide-react';
import Link from 'next/link';
import { STATIONS } from '@/constants';
import { getTodayBangkok } from '@/lib/gas';

interface ShiftSnapshot {
    shift: {
        id: string;
        shiftNumber: number;
        shiftName: string;
        status: string;
        staffName: string;
        openedAt: string;
        closedAt: string | null;
        date: string;
        gasPrice: number;
    };
    meters: Array<{
        nozzleNumber: number;
        startReading: number;
        endReading: number | null;
        liters: number | null;
        amount: number | null;
    }>;
    meterTotals: {
        totalLiters: number;
        totalAmount: number;
    };
    gauges: Array<{
        tankNumber: number;
        startPercentage: number | null;
        endPercentage: number | null;
    }>;
    stock: {
        opening: number;
        sales: number;
        supplies: number;
        closing: number;
        calculated: number;
        variance: number | null;
    };
    transactions: Array<{
        id: string;
        date: string;
        licensePlate: string | null;
        ownerName: string | null;
        paymentType: string;
        liters: number;
        amount: number;
    }>;
    transactionTotals: {
        cash: number;
        credit: number;
        transfer: number;
        boxTruck: number;
        total: number;
    };
    summary: {
        totalExpected: number;
        totalReceived: number;
        variance: number;
        varianceStatus: string;
        variancePercent: string;
    };
}

interface ShiftOption {
    id: string;
    shiftNumber: number;
    shiftName: string;
    status: string;
    date: string;
}

export default function ShiftSummaryPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const stationIndex = parseInt(id) - 1;
    const station = STATIONS[stationIndex];

    const [loading, setLoading] = useState(true);
    const [shifts, setShifts] = useState<ShiftOption[]>([]);
    const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);
    const [snapshot, setSnapshot] = useState<ShiftSnapshot | null>(null);
    const [snapshotLoading, setSnapshotLoading] = useState(false);

    const formatCurrency = (num: number) =>
        new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2 }).format(num);

    const formatNumber = (num: number) =>
        new Intl.NumberFormat('th-TH').format(num);

    // Fetch available shifts
    useEffect(() => {
        fetchShifts();
    }, [id]);

    // Fetch snapshot when shift is selected
    useEffect(() => {
        if (selectedShiftId) {
            fetchSnapshot(selectedShiftId);
        }
    }, [selectedShiftId]);

    const fetchShifts = async () => {
        setLoading(true);
        try {
            const today = getTodayBangkok();
            const res = await fetch(`/api/gas-station/${id}/shifts?date=${today}`);
            if (res.ok) {
                const data = await res.json();
                const shiftList = data.shifts?.map((s: { id: string; shiftNumber: number; status: string; createdAt: string }) => ({
                    id: s.id,
                    shiftNumber: s.shiftNumber,
                    shiftName: s.shiftNumber === 1 ? 'กะเช้า' : 'กะบ่าย',
                    status: s.status,
                    date: s.createdAt
                })) || [];
                setShifts(shiftList);

                // Auto-select first shift
                if (shiftList.length > 0 && !selectedShiftId) {
                    setSelectedShiftId(shiftList[0].id);
                }
            }
        } catch (error) {
            console.error('Error fetching shifts:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchSnapshot = async (shiftId: string) => {
        setSnapshotLoading(true);
        try {
            const res = await fetch(`/api/gas-station/${id}/shifts/${shiftId}/snapshot`);
            if (res.ok) {
                const data = await res.json();
                setSnapshot(data);
            }
        } catch (error) {
            console.error('Error fetching snapshot:', error);
        } finally {
            setSnapshotLoading(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    if (!station) {
        return <div className="p-4 text-neutral-500">ไม่พบสถานี</div>;
    }

    const getVarianceColor = (status: string) => {
        switch (status) {
            case 'GREEN': return 'bg-green-500';
            case 'YELLOW': return 'bg-yellow-500';
            case 'RED': return 'bg-red-500';
            default: return 'bg-gray-500';
        }
    };

    return (
        <div className="min-h-screen bg-[#f6f6f6] text-neutral-900 print:bg-white">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-[#f6f6f6]/80 backdrop-blur border-b border-black/10 print:hidden">
                <div className="px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link href={`/gas-station/${id}/new/home`} className="p-2 rounded-lg hover:bg-black/5">
                            <ArrowLeft size={20} />
                        </Link>
                        <div>
                            <h1 className="font-extrabold text-lg">สรุปกะ</h1>
                            <p className="text-xs text-neutral-500">{station.name}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handlePrint}
                            className="p-2 rounded-lg bg-white border border-black/10 hover:bg-neutral-100"
                            title="พิมพ์"
                        >
                            <Printer size={18} />
                        </button>
                        <button
                            onClick={() => selectedShiftId && fetchSnapshot(selectedShiftId)}
                            disabled={snapshotLoading}
                            className="p-2 rounded-lg bg-white border border-black/10 hover:bg-neutral-100"
                        >
                            <RefreshCw size={18} className={snapshotLoading ? 'animate-spin' : ''} />
                        </button>
                    </div>
                </div>
            </header>

            {/* Shift Selector */}
            <div className="px-4 py-3 bg-white border-b border-black/10 print:hidden">
                <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-neutral-500">เลือกกะ:</span>
                    <div className="flex gap-2">
                        {shifts.map(shift => (
                            <button
                                key={shift.id}
                                onClick={() => setSelectedShiftId(shift.id)}
                                className={`px-4 py-2 rounded-xl text-sm font-bold transition ${selectedShiftId === shift.id
                                        ? 'bg-orange-500 text-white'
                                        : 'bg-neutral-100 hover:bg-neutral-200'
                                    }`}
                            >
                                {shift.shiftName}
                                <span className={`ml-2 inline-block w-2 h-2 rounded-full ${shift.status === 'OPEN' ? 'bg-green-400' :
                                        shift.status === 'CLOSED' ? 'bg-yellow-400' : 'bg-gray-400'
                                    }`} />
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Content */}
            <main className="max-w-4xl mx-auto p-4 space-y-4">
                {loading ? (
                    <div className="flex items-center justify-center h-40">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
                    </div>
                ) : shifts.length === 0 ? (
                    <div className="text-center py-10 text-neutral-500">
                        ยังไม่มีกะวันนี้
                    </div>
                ) : snapshotLoading ? (
                    <div className="flex items-center justify-center h-40">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
                    </div>
                ) : snapshot ? (
                    <>
                        {/* Shift Info */}
                        <div className="bg-white rounded-2xl border border-black/10 p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="font-extrabold text-lg">{snapshot.shift.shiftName}</h2>
                                    <p className="text-sm text-neutral-500">
                                        พนักงาน: {snapshot.shift.staffName} • {snapshot.shift.date}
                                    </p>
                                </div>
                                <div className={`px-3 py-1 rounded-full text-white text-xs font-bold ${snapshot.shift.status === 'OPEN' ? 'bg-green-500' :
                                        snapshot.shift.status === 'CLOSED' ? 'bg-yellow-500' : 'bg-gray-500'
                                    }`}>
                                    {snapshot.shift.status === 'OPEN' ? 'เปิดอยู่' :
                                        snapshot.shift.status === 'CLOSED' ? 'ปิดแล้ว' : snapshot.shift.status}
                                </div>
                            </div>
                        </div>

                        {/* Variance Summary */}
                        <div className={`rounded-2xl p-4 ${snapshot.summary.varianceStatus === 'GREEN' ? 'bg-green-50 border border-green-200' :
                                snapshot.summary.varianceStatus === 'YELLOW' ? 'bg-yellow-50 border border-yellow-200' :
                                    'bg-red-50 border border-red-200'
                            }`}>
                            <div className="flex items-center gap-3 mb-3">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${getVarianceColor(snapshot.summary.varianceStatus)}`}>
                                    {snapshot.summary.varianceStatus === 'GREEN' ? (
                                        <CheckCircle className="text-white" size={24} />
                                    ) : (
                                        <AlertTriangle className="text-white" size={24} />
                                    )}
                                </div>
                                <div>
                                    <p className="font-extrabold text-lg">
                                        ยอดต่าง: {formatCurrency(snapshot.summary.variance)} บาท
                                    </p>
                                    <p className="text-sm text-neutral-600">
                                        ({snapshot.summary.variancePercent}%)
                                    </p>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-white/80 rounded-xl p-3">
                                    <p className="text-xs text-neutral-500">ยอดควรได้</p>
                                    <p className="font-bold text-lg">{formatCurrency(snapshot.summary.totalExpected)}</p>
                                </div>
                                <div className="bg-white/80 rounded-xl p-3">
                                    <p className="text-xs text-neutral-500">ยอดรับจริง</p>
                                    <p className="font-bold text-lg">{formatCurrency(snapshot.summary.totalReceived)}</p>
                                </div>
                            </div>
                        </div>

                        {/* Meter Summary */}
                        <div className="bg-white rounded-2xl border border-black/10 p-4">
                            <h3 className="font-bold mb-3">📊 สรุปมิเตอร์</h3>
                            <div className="grid grid-cols-2 gap-3 mb-4">
                                <div className="bg-orange-50 rounded-xl p-3">
                                    <p className="text-xs text-orange-600">รวมลิตร</p>
                                    <p className="font-extrabold text-xl text-orange-700">
                                        {formatNumber(snapshot.meterTotals.totalLiters)}
                                    </p>
                                </div>
                                <div className="bg-green-50 rounded-xl p-3">
                                    <p className="text-xs text-green-600">ยอดเงิน</p>
                                    <p className="font-extrabold text-xl text-green-700">
                                        {formatCurrency(snapshot.meterTotals.totalAmount)}
                                    </p>
                                </div>
                            </div>
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-neutral-500 text-left">
                                        <th className="pb-2">หัว</th>
                                        <th className="pb-2 text-right">เริ่ม</th>
                                        <th className="pb-2 text-right">สิ้นสุด</th>
                                        <th className="pb-2 text-right">ลิตร</th>
                                        <th className="pb-2 text-right">บาท</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {snapshot.meters.map(m => (
                                        <tr key={m.nozzleNumber} className="border-t border-black/5">
                                            <td className="py-2 font-bold">{m.nozzleNumber}</td>
                                            <td className="py-2 text-right">{formatNumber(m.startReading)}</td>
                                            <td className="py-2 text-right">{m.endReading !== null ? formatNumber(m.endReading) : '-'}</td>
                                            <td className="py-2 text-right font-semibold">{m.liters !== null ? formatNumber(m.liters) : '-'}</td>
                                            <td className="py-2 text-right">{m.amount !== null ? formatCurrency(m.amount) : '-'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Transaction Summary by Type */}
                        <div className="bg-white rounded-2xl border border-black/10 p-4">
                            <h3 className="font-bold mb-3">💰 ยอดรับตามประเภท</h3>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-green-50 rounded-xl p-3">
                                    <p className="text-xs text-green-600">💵 เงินสด</p>
                                    <p className="font-bold text-lg">{formatCurrency(snapshot.transactionTotals.cash)}</p>
                                </div>
                                <div className="bg-blue-50 rounded-xl p-3">
                                    <p className="text-xs text-blue-600">🔄 โอน</p>
                                    <p className="font-bold text-lg">{formatCurrency(snapshot.transactionTotals.transfer)}</p>
                                </div>
                                <div className="bg-orange-50 rounded-xl p-3">
                                    <p className="text-xs text-orange-600">📝 เงินเชื่อ</p>
                                    <p className="font-bold text-lg">{formatCurrency(snapshot.transactionTotals.credit)}</p>
                                </div>
                                <div className="bg-purple-50 rounded-xl p-3">
                                    <p className="text-xs text-purple-600">🚚 รถบรรทุก</p>
                                    <p className="font-bold text-lg">{formatCurrency(snapshot.transactionTotals.boxTruck)}</p>
                                </div>
                            </div>
                        </div>

                        {/* Stock Summary */}
                        <div className="bg-white rounded-2xl border border-black/10 p-4">
                            <h3 className="font-bold mb-3">⛽ สต็อกแก๊ส</h3>
                            <div className="grid grid-cols-4 gap-2 text-center">
                                <div className="bg-neutral-100 rounded-xl p-3">
                                    <p className="text-xs text-neutral-500">ต้นกะ</p>
                                    <p className="font-bold">{formatNumber(snapshot.stock.opening)} L</p>
                                </div>
                                <div className="bg-red-50 rounded-xl p-3">
                                    <p className="text-xs text-red-600">ขาย</p>
                                    <p className="font-bold text-red-700">-{formatNumber(snapshot.stock.sales)}</p>
                                </div>
                                <div className="bg-green-50 rounded-xl p-3">
                                    <p className="text-xs text-green-600">รับเข้า</p>
                                    <p className="font-bold text-green-700">+{formatNumber(snapshot.stock.supplies)}</p>
                                </div>
                                <div className="bg-blue-50 rounded-xl p-3">
                                    <p className="text-xs text-blue-600">ปลายกะ</p>
                                    <p className="font-bold">{formatNumber(snapshot.stock.closing)} L</p>
                                </div>
                            </div>
                        </div>

                        {/* Transactions List */}
                        <div className="bg-white rounded-2xl border border-black/10 p-4">
                            <h3 className="font-bold mb-3">📋 รายการขาย ({snapshot.transactions.length})</h3>
                            {snapshot.transactions.length === 0 ? (
                                <p className="text-neutral-500 text-center py-4">ยังไม่มีรายการ</p>
                            ) : (
                                <div className="space-y-2 max-h-60 overflow-y-auto">
                                    {snapshot.transactions.map(t => (
                                        <div key={t.id} className="flex items-center justify-between p-2 bg-neutral-50 rounded-xl">
                                            <div>
                                                <p className="font-semibold text-sm">{t.ownerName || t.licensePlate || 'ลูกค้าทั่วไป'}</p>
                                                <p className="text-xs text-neutral-500">{t.paymentType} • {formatNumber(t.liters)} L</p>
                                            </div>
                                            <p className="font-bold">{formatCurrency(t.amount)}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </>
                ) : null}
            </main>
        </div>
    );
}
