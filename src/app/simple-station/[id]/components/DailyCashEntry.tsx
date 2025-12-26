'use client';

import { useState, useEffect } from 'react';
import { Save, Loader2 } from 'lucide-react';

interface DailyCashEntryProps {
    stationId: string;
    selectedDate: string;
}

interface CashEntry {
    id?: string;
    cashSubmitted: number;
    creditCardTotal: number;
    otherExpenses: number;
    expenseNotes: string;
}

export default function DailyCashEntry({ stationId, selectedDate }: DailyCashEntryProps) {
    const [cashSubmitted, setCashSubmitted] = useState('');
    const [creditCardTotal, setCreditCardTotal] = useState('');
    const [otherExpenses, setOtherExpenses] = useState('');
    const [expenseNotes, setExpenseNotes] = useState('');
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    // Load existing data
    useEffect(() => {
        const loadData = async () => {
            try {
                const res = await fetch(`/api/station/${stationId}/daily?date=${selectedDate}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.dailyRecord) {
                        setCashSubmitted(data.dailyRecord.cashSubmitted?.toString() || '');
                        setCreditCardTotal(data.dailyRecord.creditCardTotal?.toString() || '');
                        setOtherExpenses(data.dailyRecord.otherExpenses?.toString() || '');
                        setExpenseNotes(data.dailyRecord.expenseNotes || '');
                    }
                }
            } catch (e) {
                console.error('Error loading daily data:', e);
            }
        };
        loadData();
    }, [stationId, selectedDate]);

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetch(`/api/station/${stationId}/daily`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date: selectedDate,
                    cashSubmitted: parseFloat(cashSubmitted) || 0,
                    creditCardTotal: parseFloat(creditCardTotal) || 0,
                    otherExpenses: parseFloat(otherExpenses) || 0,
                    expenseNotes: expenseNotes || '',
                }),
            });

            if (res.ok) {
                setSaved(true);
                setTimeout(() => setSaved(false), 2000);
            } else {
                const err = await res.json();
                alert(err.error || 'บันทึกไม่สำเร็จ');
            }
        } catch (e) {
            alert('เกิดข้อผิดพลาด');
        } finally {
            setSaving(false);
        }
    };

    const formatCurrency = (num: number) =>
        new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);

    return (
        <div className="rounded-3xl border border-black/10 bg-white p-5 shadow-[0_10px_30px_rgba(0,0,0,0.08)]">
            <h2 className="font-extrabold text-lg mb-4">💰 ส่งเงิน/ค่าใช้จ่าย</h2>

            <div className="space-y-4">
                {/* Cash Submitted */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        💵 ยอดเงินสดที่ส่ง
                    </label>
                    <input
                        type="number"
                        value={cashSubmitted}
                        onChange={(e) => setCashSubmitted(e.target.value)}
                        placeholder="0"
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl text-xl text-center font-bold focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-800"
                        inputMode="decimal"
                    />
                </div>

                {/* Credit Card Total */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        💳 ยอดบัตรเครดิต
                    </label>
                    <input
                        type="number"
                        value={creditCardTotal}
                        onChange={(e) => setCreditCardTotal(e.target.value)}
                        placeholder="0"
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl text-xl text-center font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800"
                        inputMode="decimal"
                    />
                </div>

                {/* Other Expenses */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        📝 ค่าใช้จ่ายอื่นๆ
                    </label>
                    <input
                        type="number"
                        value={otherExpenses}
                        onChange={(e) => setOtherExpenses(e.target.value)}
                        placeholder="0"
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl text-xl text-center font-bold focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-800"
                        inputMode="decimal"
                    />
                    <input
                        type="text"
                        value={expenseNotes}
                        onChange={(e) => setExpenseNotes(e.target.value)}
                        placeholder="รายละเอียดค่าใช้จ่าย..."
                        className="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm mt-2 focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-800"
                    />
                </div>

                {/* Summary */}
                <div className="bg-gradient-to-r from-orange-50 to-yellow-50 rounded-xl p-4 border border-orange-200">
                    <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-600">เงินสด:</span>
                        <span className="font-bold text-green-600">{formatCurrency(parseFloat(cashSubmitted) || 0)} ฿</span>
                    </div>
                    <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-600">บัตรเครดิต:</span>
                        <span className="font-bold text-blue-600">{formatCurrency(parseFloat(creditCardTotal) || 0)} ฿</span>
                    </div>
                    <div className="flex justify-between text-sm mb-2">
                        <span className="text-gray-600">ค่าใช้จ่าย:</span>
                        <span className="font-bold text-red-600">-{formatCurrency(parseFloat(otherExpenses) || 0)} ฿</span>
                    </div>
                    <div className="flex justify-between text-lg border-t border-orange-300 pt-2">
                        <span className="font-bold text-gray-700">รวมส่ง:</span>
                        <span className="font-extrabold text-orange-600">
                            {formatCurrency((parseFloat(cashSubmitted) || 0) + (parseFloat(creditCardTotal) || 0) - (parseFloat(otherExpenses) || 0))} ฿
                        </span>
                    </div>
                </div>

                {/* Save Button */}
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className={`w-full py-3 rounded-xl font-bold transition-colors flex items-center justify-center gap-2 ${saved
                        ? 'bg-green-500 text-white'
                        : 'bg-orange-500 hover:bg-orange-600 text-white'
                        } disabled:opacity-50`}
                >
                    {saving ? (
                        <>
                            <Loader2 size={18} className="animate-spin" />
                            กำลังบันทึก...
                        </>
                    ) : saved ? (
                        <>
                            ✅ บันทึกแล้ว
                        </>
                    ) : (
                        <>
                            <Save size={18} />
                            บันทึก
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}
