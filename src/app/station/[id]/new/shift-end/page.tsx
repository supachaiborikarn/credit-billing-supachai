'use client';

import { useState, useEffect, use, useCallback } from 'react';
import {
    ArrowLeft,
    Fuel,
    Package,
    Wallet,
    CheckCircle,
    RefreshCw,
    AlertTriangle,
    Lock,
    Printer
} from 'lucide-react';
import Link from 'next/link';
import { STATIONS } from '@/constants';
import { ShiftAnomalyWarning, AnomalyData } from '@/components/ShiftAnomalyWarning';
import { printDailyWorkReport } from '@/lib/daily-report-print';

interface MeterData {
    nozzleNumber: number;
    fuelType: string;
    price: number;
    startReading: number;
    endReading: number;
    liters: number;
    amount: number;
}

interface ProductData {
    id: string;
    name: string;
    price: number;
    openingStock: number;
    received: number;
    sold: number;
    closingStock: number;
    amount: number;
}

interface CashData {
    cashExpected: number;
    creditExpected: number;
    cardExpected: number;
    transferExpected: number;
    cashReceived: number;
    cardReceived: number;
    transferReceived: number;
    expenses: number;
    expenseNote: string;
    discounts: number;
    discountNote: string;
}

interface ShiftInfo {
    id: string;
    shiftNumber: number;
    staffName: string;
    openedAt: string;
}

// Default fuel types with prices (configurable per station)
const DEFAULT_FUEL_TYPES = [
    { nozzle: 1, name: 'ดีเซล B7', price: 30.84 },
    { nozzle: 2, name: 'ดีเซล B7', price: 30.84 },
    { nozzle: 3, name: 'แก๊สโซฮอล์ 91', price: 31.75 },
    { nozzle: 4, name: 'แก๊สโซฮอล์ 95', price: 31.38 },
];

export default function ShiftEndPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const stationIndex = parseInt(id) - 1;
    const station = STATIONS[stationIndex];

    const [activeTab, setActiveTab] = useState<'meters' | 'products' | 'cash' | 'summary'>('meters');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [shift, setShift] = useState<ShiftInfo | null>(null);
    const [reportDate, setReportDate] = useState('');
    const [showCloseSuccess, setShowCloseSuccess] = useState(false);
    const [printingDailyReport, setPrintingDailyReport] = useState(false);

    // Anomaly state
    const [showAnomalyModal, setShowAnomalyModal] = useState(false);
    const [anomalies, setAnomalies] = useState<AnomalyData[]>([]);
    const [anomalyNote, setAnomalyNote] = useState('');
    const [requiresNote, setRequiresNote] = useState(false);

    // Meter data - flexible nozzle count
    const [meters, setMeters] = useState<MeterData[]>([]);

    // Product data
    const [products, setProducts] = useState<ProductData[]>([]);

    // Cash data
    const [cash, setCash] = useState<CashData>({
        cashExpected: 0,
        creditExpected: 0,
        cardExpected: 0,
        transferExpected: 0,
        cashReceived: 0,
        cardReceived: 0,
        transferReceived: 0,
        expenses: 0,
        expenseNote: '',
        discounts: 0,
        discountNote: ''
    });
    const isTankLoyStation = station?.id === 'station-1';

    const fetchShiftData = useCallback(async () => {
        setLoading(true);
        try {
            // Fetch shift-end data (includes carry-over readings)
            const today = new Date().toISOString().split('T')[0];
            const res = await fetch(`/api/station/${id}/shift-end?date=${today}`);

            if (res.ok) {
                const data = await res.json();
                setReportDate(data.date || today);
                const currentShift = data.shifts?.find((s: { status: string }) => s.status === 'OPEN') || data.shifts?.[data.shifts.length - 1];
                const targetShiftId = currentShift?.id || null;

                // Set shift info
                if (currentShift) {
                    setShift({
                        id: currentShift.id,
                        shiftNumber: currentShift.shiftNumber,
                        staffName: currentShift.staffName || 'ไม่ระบุ',
                        openedAt: currentShift.createdAt
                    });
                }

                // Initialize meters from config with carry-over readings
                const fuelConfig = data.fuelConfig || DEFAULT_FUEL_TYPES;
                const existingMeters = data.meters || [];
                const carryOver = data.carryOverReadings || {};

                setMeters(fuelConfig.map((fuel: { nozzle: number; name: string; price: number }) => {
                    const existing = existingMeters.find((m: { shiftId: string; nozzleNumber: number }) =>
                        m.shiftId === targetShiftId && m.nozzleNumber === fuel.nozzle
                    );
                    // Use carry-over reading as startReading if no existing reading
                    const startReading = existing?.startReading || carryOver[fuel.nozzle] || 0;
                    const endReading = Number(existing?.endReading || 0);
                    const liters = endReading > Number(startReading) ? endReading - Number(startReading) : 0;
                    return {
                        nozzleNumber: fuel.nozzle,
                        fuelType: fuel.name,
                        price: fuel.price,
                        startReading: Number(startReading),
                        endReading,
                        liters,
                        amount: liters * fuel.price
                    };
                }));

                // Initialize products
                if (data.products) {
                    setProducts(data.products.map((p: { id: string; name: string; price: number; quantity: number }) => ({
                        id: p.id,
                        name: p.name,
                        price: p.price,
                        openingStock: p.quantity || 0,
                        received: 0,
                        sold: 0,
                        closingStock: p.quantity || 0,
                        amount: 0
                    })));
                }

                // Calculate expected cash from transactions
                const txns = data.transactions || [];
                const cashTxns = txns.filter((t: { paymentType: string }) => t.paymentType === 'CASH');
                const cashExpected = cashTxns.reduce((sum: number, t: { amount: number }) => sum + Number(t.amount), 0);
                const creditExpected = txns
                    .filter((t: { paymentType: string }) => ['CREDIT', 'BOX_TRUCK', 'OIL_TRUCK_SUPACHAI'].includes(t.paymentType))
                    .reduce((sum: number, t: { amount: number }) => sum + Number(t.amount), 0);
                const cardExpected = txns
                    .filter((t: { paymentType: string }) => t.paymentType === 'CREDIT_CARD')
                    .reduce((sum: number, t: { amount: number }) => sum + Number(t.amount), 0);
                const transferExpected = txns
                    .filter((t: { paymentType: string }) => t.paymentType === 'TRANSFER')
                    .reduce((sum: number, t: { amount: number }) => sum + Number(t.amount), 0);

                setCash(prev => ({
                    ...prev,
                    cashExpected,
                    creditExpected,
                    cardExpected,
                    transferExpected,
                    cardReceived: cardExpected,
                    transferReceived: transferExpected,
                }));
            }
        } catch (error) {
            console.error('Error fetching shift data:', error);
        } finally {
            setLoading(false);
        }
    }, [id]);

    // Fetch station config and current shift data
    useEffect(() => {
        fetchShiftData();
    }, [fetchShiftData]);

    // Update meter reading
    const updateMeter = (index: number, field: 'startReading' | 'endReading', value: number) => {
        setMeters(prev => {
            const updated = [...prev];
            updated[index] = {
                ...updated[index],
                [field]: value
            };
            // Calculate liters and amount
            const liters = updated[index].endReading - updated[index].startReading;
            updated[index].liters = liters > 0 ? liters : 0;
            updated[index].amount = updated[index].liters * updated[index].price;
            return updated;
        });
    };

    // Update product
    const updateProduct = (index: number, field: 'received' | 'sold', value: number) => {
        setProducts(prev => {
            const updated = [...prev];
            updated[index] = {
                ...updated[index],
                [field]: value
            };
            // Calculate closing stock and amount
            updated[index].closingStock = updated[index].openingStock + updated[index].received - updated[index].sold;
            updated[index].amount = updated[index].sold * updated[index].price;
            return updated;
        });
    };

    // Calculate totals
    const totalMeterLiters = meters.reduce((sum, m) => sum + m.liters, 0);
    const totalMeterAmount = meters.reduce((sum, m) => sum + m.amount, 0);
    const totalProductAmount = products.reduce((sum, p) => sum + p.amount, 0);
    const totalExpected = totalMeterAmount + totalProductAmount;
    const totalReceived =
        cash.cashReceived +
        cash.creditExpected +
        cash.cardReceived +
        cash.transferReceived -
        cash.expenses -
        cash.discounts;
    const variance = totalExpected - totalReceived;
    const varianceStatus = Math.abs(variance) <= 200 ? 'GREEN' : Math.abs(variance) <= 500 ? 'YELLOW' : 'RED';

    // Format currency
    const formatCurrency = (num: number) =>
        new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2 }).format(num);

    const formatNumber = (num: number) =>
        new Intl.NumberFormat('th-TH').format(num);

    const formatReportDate = (dateStr: string) =>
        new Date(`${dateStr}T00:00:00+07:00`).toLocaleDateString('th-TH', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        });

    const handleGoHome = () => {
        window.location.href = `/station/${id}`;
    };

    const handlePrintDailyReport = async () => {
        if (!reportDate || !station) {
            alert('ไม่พบวันที่หรือข้อมูลสถานีสำหรับพิมพ์รายงาน');
            return;
        }

        setPrintingDailyReport(true);
        try {
            const res = await fetch(`/api/station/${id}/daily?date=${reportDate}`);
            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'ไม่สามารถดึงข้อมูลรายงานทั้งวันได้');
            }

            const opened = printDailyWorkReport({
                stationName: station.name,
                reportDate,
                transactions: data.transactions || [],
                meters,
            });

            if (!opened) {
                alert('กรุณาอนุญาตให้เปิด popup เพื่อพิมพ์รายงาน');
            }
        } catch (error) {
            console.error('Daily report print error:', error);
            alert(error instanceof Error ? error.message : 'ไม่สามารถพิมพ์รายงานทั้งวันได้');
        } finally {
            setPrintingDailyReport(false);
        }
    };

    // Save shift end
    const handleSubmit = async () => {
        // Validate shift exists
        if (!shift?.id) {
            alert('❌ ไม่พบกะที่เปิดอยู่ กรุณาเปิดกะก่อน');
            return;
        }

        if (varianceStatus === 'RED' && !confirm('ยอดต่างเกิน 500 บาท ยืนยันปิดกะหรือไม่?')) {
            return;
        }

        // Check anomalies first (if not already checked)
        if (!showAnomalyModal && anomalies.length === 0) {
            try {
                const anomalyRes = await fetch(`/api/gas-station/${id}/shifts/${shift.id}/anomalies`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        meters: meters.map((meter) => ({
                            nozzleNumber: meter.nozzleNumber,
                            soldQty: meter.liters,
                        })),
                    }),
                });
                if (anomalyRes.ok) {
                    const anomalyData = await anomalyRes.json();
                    if (anomalyData.hasAnomalies && anomalyData.anomalies?.length > 0) {
                        setAnomalies(anomalyData.anomalies);
                        setRequiresNote(anomalyData.requiresNote || false);
                        setShowAnomalyModal(true);
                        return; // Show modal, don't proceed yet
                    }
                }
            } catch (error) {
                console.error('Anomaly check error:', error);
                // Continue anyway if anomaly check fails
            }
        }

        // Proceed with closing shift
        await closeShift();
    };

    // Actual close shift logic
    const closeShift = async (note?: string) => {
        setSaving(true);
        try {
            const res = await fetch(`/api/station/${id}/shift-end`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    shiftId: shift?.id,
                    meters,
                    products,
                    cash,
                    totalExpected,
                    totalReceived,
                    variance,
                    varianceStatus,
                    anomalyNote: note || anomalyNote
                })
            });

            if (res.ok) {
                if (isTankLoyStation) {
                    setShowCloseSuccess(true);
                    return;
                }

                alert('✅ ปิดกะเรียบร้อย');
                handleGoHome();
            } else {
                const err = await res.json();
                alert(err.error || 'เกิดข้อผิดพลาด');
            }
        } catch (error) {
            console.error('Submit error:', error);
            alert('เกิดข้อผิดพลาด');
        } finally {
            setSaving(false);
        }
    };

    // Handle anomaly confirmation
    const handleAnomalyConfirm = () => {
        setShowAnomalyModal(false);
        closeShift(anomalyNote);
    };

    const handleAnomalyCancel = () => {
        setShowAnomalyModal(false);
        setAnomalies([]);
        setAnomalyNote('');
    };

    if (!station) {
        return <div className="p-4 text-gray-500">ไม่พบสถานี</div>;
    }

    const tabs = [
        { id: 'meters', label: 'มิเตอร์', icon: Fuel },
        { id: 'products', label: 'สินค้า', icon: Package },
        { id: 'cash', label: 'เงิน', icon: Wallet },
        { id: 'summary', label: 'สรุป', icon: CheckCircle },
    ] as const;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
            {showCloseSuccess && isTankLoyStation && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
                    <div className="w-full max-w-md rounded-2xl border border-emerald-500/30 bg-slate-900 p-6 shadow-2xl">
                        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15">
                            <CheckCircle className="text-emerald-400" size={28} />
                        </div>
                        <h2 className="text-center text-xl font-bold text-white">ปิดกะเรียบร้อย</h2>
                        <p className="mt-2 text-center text-sm text-gray-300">
                            กะ {shift?.shiftNumber || '-'} ของวันที่ {reportDate ? formatReportDate(reportDate) : '-'}
                        </p>
                        <p className="mt-2 text-center text-sm text-gray-400">
                            สามารถพิมพ์รายงานสรุปการทำงานทั้งวันก่อนกลับหน้าหลักได้ทันที
                        </p>

                        <div className="mt-5 space-y-3">
                            <button
                                onClick={handlePrintDailyReport}
                                disabled={printingDailyReport || !reportDate}
                                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {printingDailyReport ? (
                                    <>
                                        <RefreshCw size={18} className="animate-spin" />
                                        กำลังเตรียมรายงาน...
                                    </>
                                ) : (
                                    <>
                                        <Printer size={18} />
                                        พิมพ์รายงานทั้งวัน
                                    </>
                                )}
                            </button>

                            <button
                                onClick={handleGoHome}
                                className="w-full rounded-xl border border-white/15 px-4 py-3 font-medium text-white transition hover:bg-white/10"
                            >
                                กลับหน้าหลัก
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Anomaly Warning Modal */}
            {showAnomalyModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="max-w-md w-full">
                        <ShiftAnomalyWarning
                            anomalies={anomalies}
                            requiresNote={requiresNote}
                            note={anomalyNote}
                            onNoteChange={setAnomalyNote}
                            onConfirm={handleAnomalyConfirm}
                            onCancel={handleAnomalyCancel}
                        />
                    </div>
                </div>
            )}

            {/* Header */}
            <header className="sticky top-0 z-40 backdrop-blur-xl border-b border-white/10 px-4 py-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link href={`/station/${id}`} className="p-2 rounded-lg hover:bg-white/10">
                            <ArrowLeft size={20} className="text-gray-400" />
                        </Link>
                        <div>
                            <h1 className="font-bold text-white">ปิดกะ - {station.name}</h1>
                            {shift && (
                                <p className="text-xs text-gray-400">
                                    กะ {shift.shiftNumber} • {shift.staffName}
                                </p>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={fetchShiftData}
                        disabled={loading}
                        className="p-2 rounded-lg bg-white/10 hover:bg-white/20"
                    >
                        <RefreshCw size={18} className={`text-gray-400 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </header>

            {/* Tabs */}
            <div className="flex border-b border-white/10">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${activeTab === tab.id
                            ? 'text-purple-400 border-b-2 border-purple-400 bg-purple-500/10'
                            : 'text-gray-500 hover:text-gray-300'
                            }`}
                    >
                        <tab.icon size={18} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
                </div>
            ) : (
                <div className="p-4">
                    {/* Tab 1: Meters */}
                    {activeTab === 'meters' && (
                        <div className="space-y-4">
                            <p className="text-sm text-gray-400">กรอกเลขมิเตอร์เปิด-ปิดทุกหัวจ่าย</p>

                            {meters.map((meter, index) => (
                                <div key={meter.nozzleNumber} className="card-glass p-4 rounded-xl">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <span className="w-8 h-8 rounded-full bg-purple-500/30 flex items-center justify-center text-purple-300 font-bold">
                                                {meter.nozzleNumber}
                                            </span>
                                            <span className="text-white font-medium">{meter.fuelType}</span>
                                        </div>
                                        <span className="text-gray-400 text-sm">{meter.price.toFixed(2)} ฿/ล.</span>
                                    </div>

                                    <div className="grid grid-cols-3 gap-3">
                                        <div>
                                            <label className="text-xs text-gray-500 block mb-1">เลขเปิด</label>
                                            <input
                                                type="number"
                                                value={meter.startReading || ''}
                                                onChange={e => updateMeter(index, 'startReading', parseFloat(e.target.value) || 0)}
                                                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-right font-mono focus:outline-none focus:ring-2 focus:ring-purple-500"
                                                placeholder="0"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-500 block mb-1">เลขปิด</label>
                                            <input
                                                type="number"
                                                value={meter.endReading || ''}
                                                onChange={e => updateMeter(index, 'endReading', parseFloat(e.target.value) || 0)}
                                                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-right font-mono focus:outline-none focus:ring-2 focus:ring-purple-500"
                                                placeholder="0"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-500 block mb-1">ลิตร</label>
                                            <div className="px-3 py-2 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 text-right font-mono">
                                                {formatNumber(meter.liters)}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-2 text-right">
                                        <span className="text-gray-400 text-sm">= </span>
                                        <span className="text-white font-bold">{formatCurrency(meter.amount)} ฿</span>
                                    </div>
                                </div>
                            ))}

                            {/* Totals */}
                            <div className="card-glass p-4 rounded-xl bg-purple-500/10 border border-purple-500/30">
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-300">รวมลิตร</span>
                                    <span className="text-white font-bold text-lg">{formatNumber(totalMeterLiters)} ล.</span>
                                </div>
                                <div className="flex justify-between items-center mt-2">
                                    <span className="text-gray-300">รวมเงิน</span>
                                    <span className="text-purple-300 font-bold text-xl">{formatCurrency(totalMeterAmount)} ฿</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Tab 2: Products */}
                    {activeTab === 'products' && (
                        <div className="space-y-4">
                            <p className="text-sm text-gray-400">กรอกยอดสินค้าขาย (น้ำมันเครื่อง, SF, etc.)</p>

                            {products.length > 0 ? products.map((product, index) => (
                                <div key={product.id} className="card-glass p-4 rounded-xl">
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-white font-medium">{product.name}</span>
                                        <span className="text-gray-400 text-sm">{product.price.toFixed(2)} ฿</span>
                                    </div>

                                    <div className="grid grid-cols-4 gap-2 text-sm">
                                        <div>
                                            <label className="text-xs text-gray-500 block mb-1">ยกมา</label>
                                            <div className="px-2 py-2 bg-white/5 rounded-lg text-gray-400 text-center">
                                                {product.openingStock}
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-500 block mb-1">รับเพิ่ม</label>
                                            <input
                                                type="number"
                                                value={product.received || ''}
                                                onChange={e => updateProduct(index, 'received', parseInt(e.target.value) || 0)}
                                                className="w-full px-2 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-center focus:outline-none focus:ring-2 focus:ring-purple-500"
                                                placeholder="0"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-500 block mb-1">ขาย</label>
                                            <input
                                                type="number"
                                                value={product.sold || ''}
                                                onChange={e => updateProduct(index, 'sold', parseInt(e.target.value) || 0)}
                                                className="w-full px-2 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-center focus:outline-none focus:ring-2 focus:ring-purple-500"
                                                placeholder="0"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-500 block mb-1">เหลือ</label>
                                            <div className={`px-2 py-2 rounded-lg text-center ${product.closingStock < 0 ? 'bg-red-500/20 text-red-400' : 'bg-green-500/10 text-green-400'
                                                }`}>
                                                {product.closingStock}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-2 text-right">
                                        <span className="text-gray-400 text-sm">= </span>
                                        <span className="text-white font-bold">{formatCurrency(product.amount)} ฿</span>
                                    </div>
                                </div>
                            )) : (
                                <div className="text-center text-gray-500 py-8">
                                    <Package size={32} className="mx-auto mb-2 opacity-50" />
                                    <p>ยังไม่มีสินค้าในระบบ</p>
                                </div>
                            )}

                            {/* Totals */}
                            {products.length > 0 && (
                                <div className="card-glass p-4 rounded-xl bg-orange-500/10 border border-orange-500/30">
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-300">รวมยอดสินค้า</span>
                                        <span className="text-orange-300 font-bold text-xl">{formatCurrency(totalProductAmount)} ฿</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Tab 3: Cash */}
                    {activeTab === 'cash' && (
                        <div className="space-y-4">
                            <p className="text-sm text-gray-400">กรอกยอดเงินที่รับจริง</p>

                            {/* Expected Cash */}
                            <div className="card-glass p-4 rounded-xl bg-blue-500/10">
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-300">เงินสดตามระบบ</span>
                                    <span className="text-blue-300 font-bold">{formatCurrency(cash.cashExpected)} ฿</span>
                                </div>
                            </div>

                            <div className="card-glass p-4 rounded-xl bg-violet-500/10">
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-300">เงินเชื่อตามระบบ</span>
                                    <span className="text-violet-300 font-bold">{formatCurrency(cash.creditExpected)} ฿</span>
                                </div>
                                <p className="text-xs text-gray-400 mt-2">ระบบจะรวมเงินเชื่อเข้ายอดรับจริงให้อัตโนมัติ</p>
                            </div>

                            {/* Cash Received */}
                            <div className="card-glass p-4 rounded-xl">
                                <label className="text-sm text-gray-400 block mb-2">💵 เงินสดรับจริง</label>
                                <input
                                    type="number"
                                    value={cash.cashReceived || ''}
                                    onChange={e => setCash(prev => ({ ...prev, cashReceived: parseFloat(e.target.value) || 0 }))}
                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white text-right text-lg font-mono focus:outline-none focus:ring-2 focus:ring-green-500"
                                    placeholder="0.00"
                                />
                            </div>

                            {/* Card Received */}
                            <div className="card-glass p-4 rounded-xl">
                                <label className="text-sm text-gray-400 block mb-2">💳 บัตรเครดิต</label>
                                <input
                                    type="number"
                                    value={cash.cardReceived || ''}
                                    onChange={e => setCash(prev => ({ ...prev, cardReceived: parseFloat(e.target.value) || 0 }))}
                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white text-right text-lg font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="0.00"
                                />
                                <p className="text-xs text-gray-500 mt-2">ตามระบบ {formatCurrency(cash.cardExpected)} ฿</p>
                            </div>

                            {/* Transfer */}
                            <div className="card-glass p-4 rounded-xl">
                                <label className="text-sm text-gray-400 block mb-2">📲 โอนเงิน</label>
                                <input
                                    type="number"
                                    value={cash.transferReceived || ''}
                                    onChange={e => setCash(prev => ({ ...prev, transferReceived: parseFloat(e.target.value) || 0 }))}
                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white text-right text-lg font-mono focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                    placeholder="0.00"
                                />
                                <p className="text-xs text-gray-500 mt-2">ตามระบบ {formatCurrency(cash.transferExpected)} ฿</p>
                            </div>

                            {/* Expenses */}
                            <div className="card-glass p-4 rounded-xl">
                                <label className="text-sm text-gray-400 block mb-2">📤 ค่าใช้จ่าย</label>
                                <input
                                    type="number"
                                    value={cash.expenses || ''}
                                    onChange={e => setCash(prev => ({ ...prev, expenses: parseFloat(e.target.value) || 0 }))}
                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white text-right text-lg font-mono focus:outline-none focus:ring-2 focus:ring-red-500 mb-2"
                                    placeholder="0.00"
                                />
                                <input
                                    type="text"
                                    value={cash.expenseNote}
                                    onChange={e => setCash(prev => ({ ...prev, expenseNote: e.target.value }))}
                                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                                    placeholder="หมายเหตุ (เช่น ค่าน้ำมันรถ)"
                                />
                            </div>

                            {/* Discounts */}
                            <div className="card-glass p-4 rounded-xl">
                                <label className="text-sm text-gray-400 block mb-2">🏷️ ส่วนลด</label>
                                <input
                                    type="number"
                                    value={cash.discounts || ''}
                                    onChange={e => setCash(prev => ({ ...prev, discounts: parseFloat(e.target.value) || 0 }))}
                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white text-right text-lg font-mono focus:outline-none focus:ring-2 focus:ring-yellow-500 mb-2"
                                    placeholder="0.00"
                                />
                                <input
                                    type="text"
                                    value={cash.discountNote}
                                    onChange={e => setCash(prev => ({ ...prev, discountNote: e.target.value }))}
                                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
                                    placeholder="หมายเหตุ"
                                />
                            </div>

                            {/* Net Total */}
                            <div className="card-glass p-4 rounded-xl bg-green-500/10 border border-green-500/30">
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-300">รวมเงินรับสุทธิ</span>
                                    <span className="text-green-300 font-bold text-xl">{formatCurrency(totalReceived)} ฿</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Tab 4: Summary */}
                    {activeTab === 'summary' && (
                        <div className="space-y-4">
                            <p className="text-sm text-gray-400">ตรวจสอบยอดสรุปก่อนปิดกะ</p>

                            {/* Expected */}
                            <div className="card-glass p-4 rounded-xl">
                                <h3 className="text-white font-medium mb-3">📊 ยอดที่ควรได้</h3>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-gray-400">น้ำมัน ({formatNumber(totalMeterLiters)} ล.)</span>
                                        <span className="text-white">{formatCurrency(totalMeterAmount)} ฿</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-400">สินค้า</span>
                                        <span className="text-white">{formatCurrency(totalProductAmount)} ฿</span>
                                    </div>
                                    <div className="flex justify-between pt-2 border-t border-white/10">
                                        <span className="text-gray-300 font-medium">รวม</span>
                                        <span className="text-purple-300 font-bold">{formatCurrency(totalExpected)} ฿</span>
                                    </div>
                                </div>
                            </div>

                            {/* Received */}
                            <div className="card-glass p-4 rounded-xl">
                                <h3 className="text-white font-medium mb-3">💰 ยอดที่รับจริง</h3>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-gray-400">เงินสด</span>
                                        <span className="text-white">{formatCurrency(cash.cashReceived)} ฿</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-400">เงินเชื่อ</span>
                                        <span className="text-white">{formatCurrency(cash.creditExpected)} ฿</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-400">บัตรเครดิต</span>
                                        <span className="text-white">{formatCurrency(cash.cardReceived)} ฿</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-400">โอนเงิน</span>
                                        <span className="text-white">{formatCurrency(cash.transferReceived)} ฿</span>
                                    </div>
                                    {cash.expenses > 0 && (
                                        <div className="flex justify-between text-red-400">
                                            <span>- ค่าใช้จ่าย</span>
                                            <span>{formatCurrency(cash.expenses)} ฿</span>
                                        </div>
                                    )}
                                    {cash.discounts > 0 && (
                                        <div className="flex justify-between text-yellow-400">
                                            <span>- ส่วนลด</span>
                                            <span>{formatCurrency(cash.discounts)} ฿</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between pt-2 border-t border-white/10">
                                        <span className="text-gray-300 font-medium">รวม</span>
                                        <span className="text-green-300 font-bold">{formatCurrency(totalReceived)} ฿</span>
                                    </div>
                                </div>
                            </div>

                            {/* Variance */}
                            <div className={`card-glass p-4 rounded-xl ${varianceStatus === 'GREEN' ? 'bg-green-500/10 border border-green-500/30' :
                                varianceStatus === 'YELLOW' ? 'bg-yellow-500/10 border border-yellow-500/30' :
                                    'bg-red-500/10 border border-red-500/30'
                                }`}>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        {varianceStatus === 'GREEN' ? (
                                            <CheckCircle className="text-green-400" size={24} />
                                        ) : (
                                            <AlertTriangle className={varianceStatus === 'YELLOW' ? 'text-yellow-400' : 'text-red-400'} size={24} />
                                        )}
                                        <span className="text-gray-300">ยอดต่าง</span>
                                    </div>
                                    <span className={`text-2xl font-bold ${varianceStatus === 'GREEN' ? 'text-green-300' :
                                        varianceStatus === 'YELLOW' ? 'text-yellow-300' :
                                            'text-red-300'
                                        }`}>
                                        {variance >= 0 ? '+' : ''}{formatCurrency(variance)} ฿
                                    </span>
                                </div>
                                {varianceStatus !== 'GREEN' && (
                                    <p className="text-sm text-gray-400 mt-2">
                                        {varianceStatus === 'YELLOW' ? 'ยอดต่างเล็กน้อย กรุณาตรวจสอบ' : '⚠️ ยอดต่างมาก กรุณาตรวจสอบก่อนปิดกะ'}
                                    </p>
                                )}
                            </div>

                            {/* Submit Button */}
                            <button
                                onClick={handleSubmit}
                                disabled={saving}
                                className="w-full py-4 px-6 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                            >
                                {saving ? (
                                    <>
                                        <RefreshCw size={20} className="animate-spin" />
                                        กำลังบันทึก...
                                    </>
                                ) : (
                                    <>
                                        <Lock size={20} />
                                        ยืนยันปิดกะ
                                    </>
                                )}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
