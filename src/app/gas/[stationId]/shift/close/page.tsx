'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    Clock,
    CheckCircle,
    Loader2,
    AlertCircle,
    ArrowLeft,
    Calculator,
    Gauge,
    Banknote,
    CreditCard,
    FuelIcon,
    Smartphone,
    AlertTriangle,
    ReceiptText,
    ShoppingBag,
    PlusCircle,
    QrCode
} from 'lucide-react';
import {
    formatCurrency,
    calculateReconciliation,
    getVarianceColorClass,
    getVarianceText,
    NOZZLE_COUNT,
    TANK_COUNT
} from '@/lib/gas';

interface ShiftData {
    id: string;
    shiftNumber: number;
    status: string;
    openedAt: string;
    meters: { nozzleNumber: number; startReading: number | null; endReading: number | null; soldQty: number | null }[];
    gauge: { start: { tankNumber: number; percentage: number }[]; end: { tankNumber: number; percentage: number }[] };
    sales: { cash: number; credit: number; card: number; transfer: number; total: number; liters: number };
    gasPrice: number;
}

interface ProductCountRow {
    productId: string;
    name: string;
    unit: string;
    salePrice: number;
    openingQty: number; // ยกมา (สต็อกปัจจุบันในระบบ)
    received: string;   // รับเข้าระหว่างกะ
    closingQty: string; // นับคงเหลือตอนปิดกะ
}

const EMPTY_SALES: ShiftData['sales'] = {
    cash: 0,
    credit: 0,
    card: 0,
    transfer: 0,
    total: 0,
    liters: 0,
};

function parseAmount(value: string): number {
    if (!value.trim()) {
        return 0;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : NaN;
}

function parsePreviewAmount(value: string): number {
    const parsed = parseAmount(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function parseQty(value: string): number {
    if (!value.trim()) {
        return 0;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : NaN;
}

function isValidQty(value: string): boolean {
    const parsed = parseQty(value);
    return Number.isFinite(parsed) && parsed >= 0 && Number.isInteger(parsed);
}

function calcSoldQty(row: ProductCountRow): number {
    const received = parseQty(row.received);
    const closing = parseQty(row.closingQty);
    if (!Number.isFinite(received) || !Number.isFinite(closing)) return 0;
    return row.openingQty + received - closing;
}

export default function ShiftClosePage() {
    const params = useParams();
    const router = useRouter();
    const stationId = params.stationId as string;

    const [loading, setLoading] = useState(true);
    const [closing, setClosing] = useState(false);
    const [success, setSuccess] = useState(false);
    const [shift, setShift] = useState<ShiftData | null>(null);

    // Product stock count (เครื่องดื่ม/สินค้าอื่น)
    const [productsEnabled, setProductsEnabled] = useState(false);
    const [productRows, setProductRows] = useState<ProductCountRow[]>([]);

    // Reconciliation form
    const [cashReceived, setCashReceived] = useState<string>('');
    const [creditReceived, setCreditReceived] = useState<string>('');
    const [cardReceived, setCardReceived] = useState<string>('');
    const [transferReceived, setTransferReceived] = useState<string>('');
    const [productTransferAmount, setProductTransferAmount] = useState<string>('');
    const [otherIncomeAmount, setOtherIncomeAmount] = useState<string>('');
    const [otherIncomeNote, setOtherIncomeNote] = useState<string>('');
    const [otherExpensesAmount, setOtherExpensesAmount] = useState<string>('');
    const [otherExpenseNote, setOtherExpenseNote] = useState<string>('');
    const [varianceNote, setVarianceNote] = useState<string>('');

    const [errors, setErrors] = useState<string[]>([]);
    const [warnings, setWarnings] = useState<string[]>([]);

    // Fetch shift data + product inventory
    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await fetch(`/api/v2/gas/${stationId}/summary?detailed=true`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.shift && data.shift.status === 'OPEN') {
                        const sales = data.shift.sales || data.sales || EMPTY_SALES;
                        setShift({
                            ...data.shift,
                            sales,
                        });

                        // Pre-fill reconciliation from sales
                        setCashReceived(String(sales.cash || 0));
                        setCreditReceived(String(sales.credit || 0));
                        setCardReceived(String(sales.card || 0));
                        setTransferReceived(String(sales.transfer || 0));
                    }
                }

                // โหลดรายการสินค้า (ถ้าสาขาเปิดใช้งานสินค้าเสริม)
                const productRes = await fetch(`/api/gas-station/${stationId}/products`);
                if (productRes.ok) {
                    const inventory = await productRes.json();
                    if (Array.isArray(inventory) && inventory.length > 0) {
                        setProductsEnabled(true);
                        setProductRows(inventory.map((inv: {
                            productId: string;
                            product: { name: string; unit: string; salePrice: number };
                            quantity: number;
                        }) => ({
                            productId: inv.productId,
                            name: inv.product.name,
                            unit: inv.product.unit,
                            salePrice: Number(inv.product.salePrice),
                            openingQty: inv.quantity,
                            received: '',
                            // เริ่มต้น = ยกมา (ขาย 0) พนักงานแก้ตามที่นับได้จริง
                            closingQty: String(inv.quantity),
                        })));
                    }
                }
            } catch (error) {
                console.error('Error fetching shift data:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [stationId]);

    const updateProductRow = (productId: string, field: 'received' | 'closingQty', value: string) => {
        setProductRows(rows => rows.map(row =>
            row.productId === productId ? { ...row, [field]: value } : row
        ));
    };

    // Calculate expected amount from meters
    const calculateExpected = (): number => {
        if (!shift) return 0;
        const totalLiters = shift.meters.reduce((sum, m) => {
            if (m.soldQty !== null) return sum + m.soldQty;
            if (m.startReading !== null && m.endReading !== null) {
                return sum + (m.endReading - m.startReading);
            }
            return sum;
        }, 0);
        return totalLiters * (shift.gasPrice || 16.09);
    };

    // ยอดขายสินค้ารวมจากการนับสต็อก
    const productSalesTotal = Number(productRows.reduce((sum, row) => {
        const sold = calcSoldQty(row);
        return sold > 0 ? sum + sold * row.salePrice : sum;
    }, 0).toFixed(2));

    const calculateExpectedOtherAmount = (): number => Number((
        productSalesTotal
        + parsePreviewAmount(otherIncomeAmount)
        - parsePreviewAmount(otherExpensesAmount)
    ).toFixed(2));

    // Validate before closing
    const validate = (): boolean => {
        const newErrors: string[] = [];
        const newWarnings: string[] = [];

        // Check all nozzles have end readings
        const missingMeters = shift?.meters.filter(m => m.endReading === null).length || 0;
        if (missingMeters > 0) {
            newErrors.push(`มิเตอร์ปิดกะไม่ครบ (ขาด ${missingMeters} หัวจ่าย)`);
        }

        // Check gauge end readings
        const hasEndGauge = shift?.gauge.end && shift.gauge.end.length >= TANK_COUNT;
        if (!hasEndGauge) {
            newErrors.push('ยังไม่ได้เช็คเกจปิดกะ');
        }

        // Validate product stock counts
        for (const row of productRows) {
            if (!isValidQty(row.received) || !isValidQty(row.closingQty)) {
                newErrors.push(`"${row.name}" จำนวนรับเข้า/คงเหลือต้องเป็นจำนวนเต็มไม่ติดลบ`);
                continue;
            }
            if (calcSoldQty(row) < 0) {
                newErrors.push(`"${row.name}" นับคงเหลือมากกว่า ยกมา + รับเข้า กรุณาตรวจสอบ`);
            }
        }

        const parsedCashReceived = parseAmount(cashReceived);
        const parsedCreditReceived = parseAmount(creditReceived);
        const parsedCardReceived = parseAmount(cardReceived);
        const parsedTransferReceived = parseAmount(transferReceived);
        const parsedProductTransferAmount = parseAmount(productTransferAmount);
        const parsedOtherIncomeAmount = parseAmount(otherIncomeAmount);
        const parsedOtherExpensesAmount = parseAmount(otherExpensesAmount);
        const parsedAmounts = [
            parsedCashReceived,
            parsedCreditReceived,
            parsedCardReceived,
            parsedTransferReceived,
            parsedProductTransferAmount,
            parsedOtherIncomeAmount,
            parsedOtherExpensesAmount,
        ];

        if (parsedAmounts.some((amount) => !Number.isFinite(amount) || amount < 0)) {
            newErrors.push('ยอดเงินรับจริง รายรับอื่น และค่าใช้จ่ายต้องเป็นตัวเลขไม่ติดลบ');
        }

        if (Number.isFinite(parsedProductTransferAmount) && parsedProductTransferAmount > productSalesTotal) {
            newErrors.push('ยอดสินค้าที่รับโอน/สแกนต้องไม่เกินยอดขายสินค้ารวม');
        }

        // Validate amounts
        if ([
            parsedCashReceived,
            parsedCreditReceived,
            parsedCardReceived,
            parsedTransferReceived,
        ].every((amount) => amount === 0)) {
            newErrors.push('ต้องกรอกยอดเงินอย่างน้อย 1 ช่อง');
        }

        // Calculate variance
        const expected = calculateExpected()
            + productSalesTotal
            + (Number.isFinite(parsedOtherIncomeAmount) ? parsedOtherIncomeAmount : 0)
            - (Number.isFinite(parsedOtherExpensesAmount) ? parsedOtherExpensesAmount : 0);
        const received = parsedAmounts.every((amount) => Number.isFinite(amount))
            ? parsedCashReceived + parsedCreditReceived + parsedCardReceived + parsedTransferReceived
            : 0;
        const variance = received - expected;

        if (Math.abs(variance) > 100) {
            newWarnings.push(`ยอดต่างกัน ฿${formatCurrency(Math.abs(variance))} (${variance > 0 ? 'เกิน' : 'ขาด'})`);
            if (!varianceNote && Math.abs(variance) > 500) {
                newErrors.push('กรุณากรอกหมายเหตุเมื่อยอดต่างกันมาก');
            }
        }

        setErrors(newErrors);
        setWarnings(newWarnings);
        return newErrors.length === 0;
    };

    const handleClose = async () => {
        if (!validate() || !shift) return;

        setClosing(true);
        setErrors([]);

        try {
            const res = await fetch(`/api/v2/gas/${stationId}/shift/close`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    shiftId: shift.id,
                    reconciliation: {
                        cashReceived: parseAmount(cashReceived),
                        creditReceived: parseAmount(creditReceived),
                        cardReceived: parseAmount(cardReceived),
                        transferReceived: parseAmount(transferReceived),
                        expectedFuelAmount: calculateExpected(),
                        expectedOtherAmount: calculateExpectedOtherAmount(),
                        products: productRows.map(row => ({
                            productId: row.productId,
                            received: parseQty(row.received),
                            closingQty: parseQty(row.closingQty),
                        })),
                        productTransferAmount: parseAmount(productTransferAmount),
                        otherIncomeAmount: parseAmount(otherIncomeAmount),
                        otherIncomeNote,
                        otherExpensesAmount: parseAmount(otherExpensesAmount),
                        otherExpenseNote,
                        varianceNote
                    }
                })
            });

            if (res.ok) {
                setSuccess(true);
                setTimeout(() => {
                    router.push(`/gas/${stationId}`);
                }, 2000);
            } else {
                const data = await res.json();
                setErrors([data.error || 'ไม่สามารถปิดกะได้']);
            }
        } catch (error) {
            console.error('Error closing shift:', error);
            setErrors(['เกิดข้อผิดพลาด กรุณาลองใหม่']);
        } finally {
            setClosing(false);
        }
    };

    // Calculate reconciliation preview
    const reconciliationPreview = calculateReconciliation({
        cashReceived: parsePreviewAmount(cashReceived),
        creditReceived: parsePreviewAmount(creditReceived),
        cardReceived: parsePreviewAmount(cardReceived),
        transferReceived: parsePreviewAmount(transferReceived),
        expectedFuelAmount: calculateExpected(),
        expectedOtherAmount: calculateExpectedOtherAmount()
    });
    const expectedFuelAmount = calculateExpected();
    const previewProductTransferAmount = Math.min(parsePreviewAmount(productTransferAmount), productSalesTotal);
    const previewOtherIncomeAmount = parsePreviewAmount(otherIncomeAmount);
    const previewOtherExpensesAmount = parsePreviewAmount(otherExpensesAmount);
    // เงินสดควรส่ง = เงินสดค่าแก๊ส + (ยอดสินค้า - ส่วนที่รับโอน) + รายรับอื่น - ค่าใช้จ่าย
    const previewExpectedNetCashToSubmit = shift
        ? Number((
            (shift.sales?.cash || 0)
            + (productSalesTotal - previewProductTransferAmount)
            + previewOtherIncomeAmount
            - previewOtherExpensesAmount
        ).toFixed(2))
        : 0;

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="animate-spin text-orange-400" size={40} />
            </div>
        );
    }

    if (!shift) {
        return (
            <div className="max-w-lg mx-auto text-center">
                <div className="bg-yellow-900/30 rounded-2xl p-8 border border-yellow-500/30">
                    <AlertCircle className="mx-auto text-yellow-400 mb-4" size={60} />
                    <h2 className="text-xl font-bold mb-2">ไม่มีกะที่เปิดอยู่</h2>
                    <button
                        onClick={() => router.push(`/gas/${stationId}`)}
                        className="bg-orange-600 hover:bg-orange-500 text-white px-6 py-3 rounded-xl mt-4"
                    >
                        กลับหน้าหลัก
                    </button>
                </div>
            </div>
        );
    }

    if (success) {
        return (
            <div className="max-w-lg mx-auto text-center">
                <div className="bg-green-900/30 rounded-2xl p-8 border border-green-500/30">
                    <CheckCircle className="mx-auto text-green-400 mb-4" size={60} />
                    <h2 className="text-2xl font-bold mb-2">ปิดกะสำเร็จ!</h2>
                    <p className="text-gray-400">กะ {shift.shiftNumber} เสร็จสิ้น</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-lg mx-auto">
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
                <button
                    onClick={() => router.push(`/gas/${stationId}`)}
                    className="p-2 hover:bg-white/10 rounded-lg"
                >
                    <ArrowLeft size={24} />
                </button>
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Clock className="text-red-400" size={28} />
                        ปิดกะ {shift.shiftNumber}
                    </h1>
                    <p className="text-gray-400 text-sm">
                        เปิดเมื่อ {new Date(shift.openedAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                </div>
            </div>

            {/* Status Summary */}
            <div className="bg-[#1a1a24] rounded-xl p-4 mb-4 border border-white/10">
                <h3 className="font-medium mb-3">สถานะข้อมูล</h3>
                <div className="grid grid-cols-2 gap-3">
                    <div className={`flex items-center gap-2 text-sm ${shift.meters.every(m => m.endReading !== null) ? 'text-green-400' : 'text-yellow-400'}`}>
                        <Calculator size={16} />
                        มิเตอร์: {shift.meters.filter(m => m.endReading !== null).length}/{NOZZLE_COUNT}
                    </div>
                    <div className={`flex items-center gap-2 text-sm ${shift.gauge.end?.length >= TANK_COUNT ? 'text-green-400' : 'text-yellow-400'}`}>
                        <Gauge size={16} />
                        เกจ: {shift.gauge.end?.length || 0}/{TANK_COUNT}
                    </div>
                </div>
            </div>

            {/* Errors & Warnings */}
            {errors.length > 0 && (
                <div className="bg-red-900/30 border border-red-500/30 rounded-xl p-4 mb-4">
                    <div className="flex items-center gap-2 text-red-400 mb-2">
                        <AlertCircle size={18} />
                        <span className="font-medium">ต้องแก้ไข</span>
                    </div>
                    <ul className="text-sm text-red-300 space-y-1">
                        {errors.map((e, i) => <li key={i}>• {e}</li>)}
                    </ul>
                </div>
            )}

            {warnings.length > 0 && (
                <div className="bg-yellow-900/30 border border-yellow-500/30 rounded-xl p-4 mb-4">
                    <div className="flex items-center gap-2 text-yellow-400 mb-2">
                        <AlertTriangle size={18} />
                        <span className="font-medium">แจ้งเตือน</span>
                    </div>
                    <ul className="text-sm text-yellow-300 space-y-1">
                        {warnings.map((w, i) => <li key={i}>• {w}</li>)}
                    </ul>
                </div>
            )}

            {/* Product Stock Count (เครื่องดื่ม/สินค้าอื่น) */}
            {productsEnabled && productRows.length > 0 && (
                <div className="bg-[#1a1a24] rounded-xl p-4 mb-4 border border-white/10">
                    <h3 className="font-medium mb-1 flex items-center gap-2 text-amber-400">
                        <ShoppingBag size={18} />
                        นับสต็อกสินค้า (เครื่องดื่ม/อื่นๆ)
                    </h3>
                    <p className="text-xs text-gray-500 mb-3">
                        กรอก &quot;รับเข้า&quot; ถ้ามีของเข้าระหว่างกะ แล้วนับของจริงใส่ &quot;คงเหลือ&quot; ระบบจะคำนวณยอดขายให้
                    </p>

                    <div className="grid grid-cols-12 gap-2 text-[11px] text-gray-500 mb-1 px-1">
                        <div className="col-span-4">สินค้า</div>
                        <div className="col-span-2 text-center">ยกมา</div>
                        <div className="col-span-2 text-center">รับเข้า</div>
                        <div className="col-span-2 text-center">คงเหลือ</div>
                        <div className="col-span-2 text-right">ขายได้</div>
                    </div>

                    <div className="space-y-2">
                        {productRows.map((row) => {
                            const sold = calcSoldQty(row);
                            const invalid = !isValidQty(row.received) || !isValidQty(row.closingQty) || sold < 0;
                            return (
                                <div key={row.productId} className="grid grid-cols-12 gap-2 items-center">
                                    <div className="col-span-4 min-w-0">
                                        <div className="text-sm truncate">{row.name}</div>
                                        <div className="text-[11px] text-gray-500">฿{formatCurrency(row.salePrice)}/{row.unit}</div>
                                    </div>
                                    <div className="col-span-2 text-center text-sm text-gray-300 font-mono">
                                        {row.openingQty}
                                    </div>
                                    <div className="col-span-2">
                                        <input
                                            type="number"
                                            min="0"
                                            step="1"
                                            inputMode="numeric"
                                            value={row.received}
                                            onChange={(e) => updateProductRow(row.productId, 'received', e.target.value)}
                                            placeholder="0"
                                            className="w-full bg-gray-800 border border-white/10 rounded-lg px-2 py-1.5 text-center text-sm font-mono focus:border-orange-500 focus:outline-none"
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <input
                                            type="number"
                                            min="0"
                                            step="1"
                                            inputMode="numeric"
                                            value={row.closingQty}
                                            onChange={(e) => updateProductRow(row.productId, 'closingQty', e.target.value)}
                                            className={`w-full bg-gray-800 border rounded-lg px-2 py-1.5 text-center text-sm font-mono focus:outline-none ${invalid ? 'border-red-500/70 focus:border-red-500' : 'border-white/10 focus:border-orange-500'}`}
                                        />
                                    </div>
                                    <div className={`col-span-2 text-right text-sm font-mono ${sold > 0 ? 'text-amber-300' : 'text-gray-500'} ${sold < 0 ? 'text-red-400' : ''}`}>
                                        {sold}
                                        {sold > 0 && (
                                            <div className="text-[11px] text-gray-500">฿{formatCurrency(sold * row.salePrice)}</div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="mt-3 pt-3 border-t border-white/10 flex justify-between items-center text-sm">
                        <span className="text-gray-400">รวมยอดขายสินค้า</span>
                        <span className="font-mono font-bold text-amber-300">฿{formatCurrency(productSalesTotal)}</span>
                    </div>

                    {productSalesTotal > 0 && (
                        <div className="mt-3 flex items-center gap-3">
                            <div className="w-40 flex items-center gap-2 text-cyan-400 text-sm">
                                <QrCode size={16} />
                                <span>ส่วนที่รับโอน/สแกน</span>
                            </div>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                inputMode="decimal"
                                value={productTransferAmount}
                                onChange={(e) => setProductTransferAmount(e.target.value)}
                                placeholder="0"
                                className="flex-1 bg-gray-800 border border-white/10 rounded-lg px-4 py-2 text-right font-mono focus:border-orange-500 focus:outline-none"
                            />
                        </div>
                    )}
                </div>
            )}

            {/* Reconciliation Form */}
            <div className="bg-[#1a1a24] rounded-xl p-4 mb-4 border border-white/10">
                <h3 className="font-medium mb-4">กระทบยอด</h3>

                <div className="space-y-4">
                    {/* Cash */}
                    <div className="flex items-center gap-3">
                        <div className="w-32 flex items-center gap-2 text-green-400">
                            <Banknote size={18} />
                            <span>เงินสดส่งจริง</span>
                        </div>
                        <input
                            type="number"
                            min="0"
                            step="0.01"
                            inputMode="decimal"
                            value={cashReceived}
                            onChange={(e) => setCashReceived(e.target.value)}
                            className="flex-1 bg-gray-800 border border-white/10 rounded-lg px-4 py-2 text-right font-mono focus:border-orange-500 focus:outline-none"
                        />
                    </div>

                    {/* Credit */}
                    <div className="flex items-center gap-3">
                        <div className="w-24 flex items-center gap-2 text-purple-400">
                            <FuelIcon size={18} />
                            <span>เงินเชื่อ</span>
                        </div>
                        <input
                            type="number"
                            min="0"
                            step="0.01"
                            inputMode="decimal"
                            value={creditReceived}
                            onChange={(e) => setCreditReceived(e.target.value)}
                            className="flex-1 bg-gray-800 border border-white/10 rounded-lg px-4 py-2 text-right font-mono focus:border-orange-500 focus:outline-none"
                        />
                    </div>

                    {/* Card */}
                    <div className="flex items-center gap-3">
                        <div className="w-24 flex items-center gap-2 text-blue-400">
                            <CreditCard size={18} />
                            <span>บัตร</span>
                        </div>
                        <input
                            type="number"
                            min="0"
                            step="0.01"
                            inputMode="decimal"
                            value={cardReceived}
                            onChange={(e) => setCardReceived(e.target.value)}
                            className="flex-1 bg-gray-800 border border-white/10 rounded-lg px-4 py-2 text-right font-mono focus:border-orange-500 focus:outline-none"
                        />
                    </div>

                    {/* Transfer */}
                    <div className="flex items-center gap-3">
                        <div className="w-24 flex items-center gap-2 text-cyan-400">
                            <Smartphone size={18} />
                            <span>โอน</span>
                        </div>
                        <input
                            type="number"
                            min="0"
                            step="0.01"
                            inputMode="decimal"
                            value={transferReceived}
                            onChange={(e) => setTransferReceived(e.target.value)}
                            className="flex-1 bg-gray-800 border border-white/10 rounded-lg px-4 py-2 text-right font-mono focus:border-orange-500 focus:outline-none"
                        />
                    </div>

                    <div className="border-t border-white/10 pt-4 space-y-4">
                        <div className="text-xs font-medium uppercase tracking-wide text-gray-500">
                            รายรับอื่น / ค่าใช้จ่าย
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="w-32 flex items-center gap-2 text-amber-400">
                                <PlusCircle size={18} />
                                <span>รายรับอื่น</span>
                            </div>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                inputMode="decimal"
                                value={otherIncomeAmount}
                                onChange={(e) => setOtherIncomeAmount(e.target.value)}
                                placeholder="0"
                                className="flex-1 bg-gray-800 border border-white/10 rounded-lg px-4 py-2 text-right font-mono focus:border-orange-500 focus:outline-none"
                            />
                        </div>

                        {parsePreviewAmount(otherIncomeAmount) > 0 && (
                            <input
                                type="text"
                                value={otherIncomeNote}
                                onChange={(e) => setOtherIncomeNote(e.target.value)}
                                placeholder="รายรับอื่นจากอะไร เช่น ค่าเช่าพื้นที่..."
                                className="w-full bg-gray-800 border border-white/10 rounded-lg px-4 py-2 text-sm focus:border-orange-500 focus:outline-none"
                            />
                        )}

                        <div className="flex items-center gap-3">
                            <div className="w-32 flex items-center gap-2 text-red-300">
                                <ReceiptText size={18} />
                                <span>ค่าใช้จ่ายจากเงินสด</span>
                            </div>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                inputMode="decimal"
                                value={otherExpensesAmount}
                                onChange={(e) => setOtherExpensesAmount(e.target.value)}
                                placeholder="0"
                                className="flex-1 bg-gray-800 border border-white/10 rounded-lg px-4 py-2 text-right font-mono focus:border-orange-500 focus:outline-none"
                            />
                        </div>

                        {parsePreviewAmount(otherExpensesAmount) > 0 && (
                            <input
                                type="text"
                                value={otherExpenseNote}
                                onChange={(e) => setOtherExpenseNote(e.target.value)}
                                placeholder="จ่ายค่าอะไร เช่น ค่าน้ำแข็ง ค่าไฟ..."
                                className="w-full bg-gray-800 border border-white/10 rounded-lg px-4 py-2 text-sm focus:border-orange-500 focus:outline-none"
                            />
                        )}
                    </div>
                </div>
            </div>

            {/* Reconciliation Preview */}
            <div className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-xl p-4 mb-4 border border-white/10">
                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                        <div className="text-gray-400">ยอดที่ควรได้สุทธิ</div>
                        <div className="text-xl font-bold">฿{formatCurrency(reconciliationPreview.totalExpected)}</div>
                    </div>
                    <div className="text-right">
                        <div className="text-gray-400">ยอดที่รับจริง</div>
                        <div className="text-xl font-bold">฿{formatCurrency(reconciliationPreview.totalReceived)}</div>
                    </div>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-1 border-t border-white/10 pt-3 text-xs text-gray-400">
                    <div className="flex justify-between">
                        <span>ยอดแก๊สจากมิเตอร์</span>
                        <span className="font-mono text-gray-200">฿{formatCurrency(expectedFuelAmount)}</span>
                    </div>
                    {productsEnabled && (
                        <div className="flex justify-between">
                            <span>+ ขายสินค้า (นับสต็อก)</span>
                            <span className="font-mono text-amber-300">฿{formatCurrency(productSalesTotal)}</span>
                        </div>
                    )}
                    <div className="flex justify-between">
                        <span>+ รายรับอื่น</span>
                        <span className="font-mono text-amber-300">฿{formatCurrency(previewOtherIncomeAmount)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>- ค่าใช้จ่ายอื่นๆ</span>
                        <span className="font-mono text-red-300">฿{formatCurrency(previewOtherExpensesAmount)}</span>
                    </div>
                    <div className="mt-2 border-t border-white/10 pt-2 flex justify-between">
                        <span>เงินสดควรส่งสุทธิ</span>
                        <span className="font-mono text-green-300">฿{formatCurrency(previewExpectedNetCashToSubmit)}</span>
                    </div>
                </div>

                <div className="mt-3 pt-3 border-t border-white/10 flex justify-between items-center">
                    <span className="text-gray-400">ส่วนต่าง</span>
                    <span className={`text-xl font-bold ${getVarianceColorClass(reconciliationPreview.varianceStatus)}`}>
                        {reconciliationPreview.variance >= 0 ? '+' : ''}฿{formatCurrency(reconciliationPreview.variance)}
                        <span className="text-sm ml-2">({getVarianceText(reconciliationPreview.varianceStatus)})</span>
                    </span>
                </div>
            </div>

            {/* Variance Note */}
            {Math.abs(reconciliationPreview.variance) > 100 && (
                <div className="bg-[#1a1a24] rounded-xl p-4 mb-6 border border-white/10">
                    <label className="block text-sm text-gray-400 mb-2">
                        หมายเหตุ (กรณียอดไม่ตรง)
                    </label>
                    <textarea
                        value={varianceNote}
                        onChange={(e) => setVarianceNote(e.target.value)}
                        placeholder="อธิบายสาเหตุที่ยอดไม่ตรง..."
                        rows={2}
                        className="w-full bg-gray-800 border border-white/10 rounded-lg px-4 py-2 focus:border-orange-500 focus:outline-none resize-none"
                    />
                </div>
            )}

            {/* Close Button */}
            <button
                onClick={handleClose}
                disabled={closing}
                className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 disabled:opacity-50"
            >
                {closing ? <Loader2 className="animate-spin" size={24} /> : <Clock size={24} />}
                ปิดกะ
            </button>
        </div>
    );
}
