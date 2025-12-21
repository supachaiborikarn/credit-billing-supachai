'use client';

import { useState, useEffect, useRef } from 'react';
import Sidebar from '@/components/Sidebar';
import {
    Calendar,
    Fuel,
    AlertTriangle,
    CheckCircle,
    Edit3,
    Trash2,
    Plus,
    Save,
    X,
    ChevronDown,
    ChevronUp,
    Sparkles,
    RefreshCw,
    FileText,
} from 'lucide-react';

interface MeterData {
    id: string;
    nozzleNumber: number;
    startReading: number;
    endReading: number | null;
}

interface TransactionData {
    id: string;
    date: string;
    licensePlate: string;
    ownerName: string;
    paymentType: string;
    liters: number;
    amount: number;
}

interface DailyRecord {
    id: string;
    date: string;
    dateRaw: string;
    status: string;
    gasPrice: number | null;
    meters: MeterData[];
    transactions: TransactionData[];
    transactionCount: number;
    totalAmount: number;
    totalLiters: number;
    isComplete: boolean;
}

interface Summary {
    totalDays: number;
    completeDays: number;
    incompleteDays: number;
    totalTransactions: number;
    totalAmount: number;
}

const STATIONS = [
    { id: 'station-3', name: 'ปั๊มแก๊สพงษ์อนันต์' },
    { id: 'station-4', name: 'ปั๊มแก๊สศุภชัย' },
];

export default function GasHistoryAdminPage() {
    const [loading, setLoading] = useState(true);
    const [records, setRecords] = useState<DailyRecord[]>([]);
    const [summary, setSummary] = useState<Summary | null>(null);
    const [selectedStation, setSelectedStation] = useState('station-5');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [expandedRecord, setExpandedRecord] = useState<string | null>(null);
    const [editingMeters, setEditingMeters] = useState<string | null>(null);
    const [meterInputs, setMeterInputs] = useState<Record<number, { start: number; end: number }>>({});
    const [saving, setSaving] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newDate, setNewDate] = useState('');
    const [newShiftCount, setNewShiftCount] = useState<1 | 2>(2); // Default 2 shifts per day

    // Refs for meter inputs (to enable Enter-to-next-field)
    // Order: nozzle1-start, nozzle1-end, nozzle2-start, nozzle2-end, ...
    const meterInputRefs = useRef<(HTMLInputElement | null)[]>([]);

    // Initialize date range (last 30 days)
    useEffect(() => {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 30);
        setStartDate(start.toISOString().split('T')[0]);
        setEndDate(end.toISOString().split('T')[0]);
    }, []);

    // Fetch data when filters change
    useEffect(() => {
        if (startDate && endDate) {
            fetchData();
        }
    }, [selectedStation, startDate, endDate]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                stationId: selectedStation,
                startDate,
                endDate,
            });
            const res = await fetch(`/api/admin/gas-history?${params}`);
            if (res.ok) {
                const data = await res.json();
                setRecords(data.records || []);
                setSummary(data.summary || null);
            }
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleEditMeters = (record: DailyRecord) => {
        setEditingMeters(record.id);
        const inputs: Record<number, { start: number; end: number }> = {};
        record.meters.forEach(m => {
            inputs[m.nozzleNumber] = {
                start: m.startReading,
                end: m.endReading || 0,
            };
        });
        setMeterInputs(inputs);
    };

    const handleSaveMeters = async (record: DailyRecord) => {
        setSaving(true);
        try {
            const meters = Object.entries(meterInputs).map(([nozzle, values]) => ({
                nozzleNumber: parseInt(nozzle),
                startReading: values.start,
                endReading: values.end > 0 ? values.end : null,
            }));

            // Get gas price from input
            const gasPriceInput = document.getElementById(`gasPrice-${record.id}`) as HTMLInputElement;
            const gasPrice = gasPriceInput ? parseFloat(gasPriceInput.value) : null;

            const res = await fetch('/api/admin/gas-history', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    stationId: selectedStation,
                    dateStr: record.date,
                    action: 'updateMeters',
                    meters,
                    gasPrice,
                }),
            });

            if (res.ok) {
                setEditingMeters(null);
                fetchData();
            } else {
                const error = await res.json();
                alert(error.error || 'Failed to save');
            }
        } catch (error) {
            console.error('Error saving meters:', error);
        } finally {
            setSaving(false);
        }
    };

    // Copy end meters from previous record as start meters
    const handleCopyFromPreviousRecord = (currentRecord: DailyRecord) => {
        // Find index of current record
        const currentIndex = records.findIndex(r => r.id === currentRecord.id);
        if (currentIndex === -1 || currentIndex === records.length - 1) {
            alert('ไม่พบข้อมูลวันก่อนหน้า');
            return;
        }

        // Previous record (records are sorted newest first, so next index = previous day)
        const previousRecord = records[currentIndex + 1];
        if (!previousRecord || !previousRecord.meters || previousRecord.meters.length === 0) {
            alert('ไม่พบมิเตอร์จากวันก่อนหน้า');
            return;
        }

        // Copy end readings as start readings
        const newInputs: Record<number, { start: number; end: number }> = {};
        previousRecord.meters.forEach(m => {
            newInputs[m.nozzleNumber] = {
                start: m.endReading || m.startReading || 0,
                end: meterInputs[m.nozzleNumber]?.end || 0,
            };
        });

        // Fill any missing nozzles
        for (let i = 1; i <= 4; i++) {
            if (!newInputs[i]) {
                newInputs[i] = { start: 0, end: meterInputs[i]?.end || 0 };
            }
        }

        setMeterInputs(newInputs);
        alert(`✅ คัดลอกมิเตอร์จบจากวันที่ ${previousRecord.date} เรียบร้อย`);
    };

    const handleDeleteRecord = async (record: DailyRecord) => {
        if (record.transactionCount > 0) {
            alert('ไม่สามารถลบได้ เพราะมีรายการขายอยู่');
            return;
        }

        if (!confirm(`ต้องการลบข้อมูลวันที่ ${record.date} หรือไม่?`)) {
            return;
        }

        try {
            const res = await fetch(`/api/admin/gas-history?recordId=${record.id}`, {
                method: 'DELETE',
            });

            if (res.ok) {
                fetchData();
            } else {
                const error = await res.json();
                alert(error.error || 'Failed to delete');
            }
        } catch (error) {
            console.error('Error deleting record:', error);
        }
    };

    const handleCreateRecord = async () => {
        if (!newDate) {
            alert('กรุณาเลือกวันที่');
            return;
        }

        setSaving(true);
        try {
            const res = await fetch('/api/admin/gas-history', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    stationId: selectedStation,
                    dateStr: newDate,
                    action: 'createRecord',
                    shiftCount: newShiftCount,
                }),
            });

            if (res.ok) {
                setShowCreateModal(false);
                setNewDate('');
                setNewShiftCount(2); // Reset to default
                fetchData();
                alert(`สร้างข้อมูลสำเร็จ! (${newShiftCount} กะ)`);
            } else {
                const error = await res.json();
                alert(error.error || 'Failed to create');
            }
        } catch (error) {
            console.error('Error creating record:', error);
        } finally {
            setSaving(false);
        }
    };

    const formatNumber = (num: number) => {
        return new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
    };

    const formatCurrency = (num: number) => {
        return new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
    };

    // Focus next meter input on Enter key
    // NEW order: Start1→Start2→Start3→Start4 (indices 0,2,4,6), then End1→End2→End3→End4 (indices 1,3,5,7)
    // This matches user expectation: fill all starts in a row, then all ends in a row
    const getNextMeterIndex = (currentIndex: number): number | null => {
        // Start inputs are at even indices: 0, 2, 4, 6
        // End inputs are at odd indices: 1, 3, 5, 7
        const isStartField = currentIndex % 2 === 0;

        if (isStartField) {
            // Current is Start field, go to next Start (skip by 2)
            const nextStartIndex = currentIndex + 2;
            if (nextStartIndex <= 6) {
                return nextStartIndex; // Next start field
            } else {
                return 1; // After Start4, go to End1
            }
        } else {
            // Current is End field, go to next End (skip by 2)
            const nextEndIndex = currentIndex + 2;
            if (nextEndIndex <= 7) {
                return nextEndIndex; // Next end field
            }
            return null; // After End4, no more fields
        }
    };

    const focusNextMeterInput = (currentIndex: number) => {
        const nextIndex = getNextMeterIndex(currentIndex);
        if (nextIndex !== null && meterInputRefs.current[nextIndex]) {
            meterInputRefs.current[nextIndex]?.focus();
            meterInputRefs.current[nextIndex]?.select();
        }
    };

    const handleMeterKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            focusNextMeterInput(index);
        }
    };

    return (
        <Sidebar>
            <div className="p-4 md:p-6">
                {/* Header */}
                <div className="mb-6">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                            <FileText size={20} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                                จัดการข้อมูลย้อนหลัง
                                <Sparkles className="text-yellow-400" size={20} />
                            </h1>
                            <p className="text-gray-400 text-sm">ดูและแก้ไขข้อมูลปั๊มแก๊สย้อนหลัง</p>
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div className="bg-[#12121a] rounded-2xl border border-white/10 p-4 mb-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        {/* Station Selector */}
                        <div>
                            <label className="block text-sm text-gray-400 mb-1">ปั๊มแก๊ส</label>
                            <select
                                value={selectedStation}
                                onChange={(e) => setSelectedStation(e.target.value)}
                                className="w-full px-4 py-2.5 bg-[#1a1a24] border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                            >
                                {STATIONS.map(s => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Start Date */}
                        <div>
                            <label className="block text-sm text-gray-400 mb-1">วันที่เริ่มต้น</label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-full px-4 py-2.5 bg-[#1a1a24] border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                            />
                        </div>

                        {/* End Date */}
                        <div>
                            <label className="block text-sm text-gray-400 mb-1">วันที่สิ้นสุด</label>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="w-full px-4 py-2.5 bg-[#1a1a24] border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                            />
                        </div>

                        {/* Refresh Button */}
                        <div className="flex items-end gap-2">
                            <button
                                onClick={fetchData}
                                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition"
                            >
                                <RefreshCw size={18} />
                                โหลด
                            </button>
                            <button
                                onClick={() => {
                                    setNewDate(new Date().toISOString().split('T')[0]);
                                    setShowCreateModal(true);
                                }}
                                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition"
                            >
                                <Plus size={18} />
                                สร้างใหม่
                            </button>
                        </div>
                    </div>
                </div>

                {/* Summary Cards */}
                {summary && (
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                        <div className="bg-[#12121a] rounded-xl border border-white/10 p-4">
                            <p className="text-gray-400 text-sm">จำนวนวัน</p>
                            <p className="text-2xl font-bold text-white">{summary.totalDays}</p>
                        </div>
                        <div className="bg-[#12121a] rounded-xl border border-green-500/30 p-4">
                            <p className="text-gray-400 text-sm flex items-center gap-1">
                                <CheckCircle size={14} className="text-green-400" />
                                ข้อมูลครบ
                            </p>
                            <p className="text-2xl font-bold text-green-400">{summary.completeDays}</p>
                        </div>
                        <div className="bg-[#12121a] rounded-xl border border-yellow-500/30 p-4">
                            <p className="text-gray-400 text-sm flex items-center gap-1">
                                <AlertTriangle size={14} className="text-yellow-400" />
                                ยังไม่ครบ
                            </p>
                            <p className="text-2xl font-bold text-yellow-400">{summary.incompleteDays}</p>
                        </div>
                        <div className="bg-[#12121a] rounded-xl border border-white/10 p-4">
                            <p className="text-gray-400 text-sm">รายการขาย</p>
                            <p className="text-2xl font-bold text-white">{summary.totalTransactions}</p>
                        </div>
                        <div className="bg-[#12121a] rounded-xl border border-purple-500/30 p-4">
                            <p className="text-gray-400 text-sm">ยอดขายรวม</p>
                            <p className="text-xl font-bold text-purple-400">฿{formatCurrency(summary.totalAmount)}</p>
                        </div>
                    </div>
                )}

                {/* Records Table */}
                <div className="bg-[#12121a] rounded-2xl border border-white/10 overflow-hidden">
                    {loading ? (
                        <div className="p-8 text-center">
                            <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                            <p className="text-gray-400">กำลังโหลด...</p>
                        </div>
                    ) : records.length === 0 ? (
                        <div className="p-8 text-center">
                            <Calendar size={48} className="mx-auto mb-4 text-gray-600" />
                            <p className="text-gray-400">ไม่พบข้อมูลในช่วงเวลาที่เลือก</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-white/5">
                            {records.map(record => (
                                <div key={record.id} className="hover:bg-white/5 transition">
                                    {/* Row Header */}
                                    <div className="flex items-center justify-between p-4 cursor-pointer"
                                        onClick={() => setExpandedRecord(expandedRecord === record.id ? null : record.id)}>
                                        <div className="flex items-center gap-4">
                                            <div className="flex items-center gap-2">
                                                {expandedRecord === record.id ?
                                                    <ChevronUp size={20} className="text-gray-400" /> :
                                                    <ChevronDown size={20} className="text-gray-400" />
                                                }
                                                <Calendar size={18} className="text-purple-400" />
                                                <span className="font-medium text-white">{record.date}</span>
                                            </div>
                                            {record.isComplete ? (
                                                <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full flex items-center gap-1">
                                                    <CheckCircle size={12} />
                                                    ครบถ้วน
                                                </span>
                                            ) : (
                                                <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded-full flex items-center gap-1">
                                                    <AlertTriangle size={12} />
                                                    ไม่ครบ
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-6 text-sm">
                                            <div className="text-gray-400">
                                                <span className="text-white font-medium">{record.transactionCount}</span> รายการ
                                            </div>
                                            <div className="text-gray-400">
                                                <span className="text-white font-medium">{formatNumber(record.totalLiters)}</span> ลิตร
                                            </div>
                                            <div className="text-purple-400 font-medium">
                                                ฿{formatCurrency(record.totalAmount)}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Expanded Content */}
                                    {expandedRecord === record.id && (
                                        <div className="px-4 pb-4 space-y-4">
                                            {/* Meters Section */}
                                            <div className="bg-[#1a1a24] rounded-xl p-4">
                                                <div className="flex items-center justify-between mb-3">
                                                    <h4 className="text-white font-medium flex items-center gap-2">
                                                        <Fuel size={16} className="text-orange-400" />
                                                        เลขมิเตอร์
                                                    </h4>
                                                    {editingMeters === record.id ? (
                                                        <div className="flex gap-2 flex-wrap">
                                                            <button
                                                                onClick={() => handleCopyFromPreviousRecord(record)}
                                                                className="px-3 py-1 bg-blue-600 text-white text-sm rounded-lg flex items-center gap-1"
                                                                title="ดึงมิเตอร์จบจากวันก่อนหน้ามาเป็นมิเตอร์เริ่มต้น"
                                                            >
                                                                📋 ดึงจากวันก่อน
                                                            </button>
                                                            <button
                                                                onClick={() => setEditingMeters(null)}
                                                                className="px-3 py-1 bg-gray-600 text-white text-sm rounded-lg flex items-center gap-1"
                                                            >
                                                                <X size={14} />
                                                                ยกเลิก
                                                            </button>
                                                            <button
                                                                onClick={() => handleSaveMeters(record)}
                                                                disabled={saving}
                                                                className="px-3 py-1 bg-green-600 text-white text-sm rounded-lg flex items-center gap-1"
                                                            >
                                                                <Save size={14} />
                                                                {saving ? 'กำลังบันทึก...' : 'บันทึก'}
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={() => handleEditMeters(record)}
                                                            className="px-3 py-1 bg-purple-600 text-white text-sm rounded-lg flex items-center gap-1"
                                                        >
                                                            <Edit3 size={14} />
                                                            แก้ไข
                                                        </button>
                                                    )}
                                                </div>

                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                                    {[1, 2, 3, 4].map(nozzle => {
                                                        const meter = record.meters.find(m => m.nozzleNumber === nozzle);
                                                        const input = meterInputs[nozzle];

                                                        return (
                                                            <div key={nozzle} className="bg-[#12121a] rounded-lg p-3">
                                                                <p className="text-gray-400 text-xs mb-2">หัวจ่าย {nozzle}</p>
                                                                {editingMeters === record.id ? (
                                                                    <div className="space-y-2">
                                                                        <div>
                                                                            <label className="text-xs text-gray-500">เริ่ม</label>
                                                                            <input
                                                                                ref={(el) => { meterInputRefs.current[(nozzle - 1) * 2] = el; }}
                                                                                type="number"
                                                                                step="0.01"
                                                                                value={input?.start || 0}
                                                                                onChange={(e) => setMeterInputs({
                                                                                    ...meterInputs,
                                                                                    [nozzle]: { ...input, start: parseFloat(e.target.value) || 0 }
                                                                                })}
                                                                                onKeyDown={(e) => handleMeterKeyDown(e, (nozzle - 1) * 2)}
                                                                                className="w-full px-2 py-1 bg-[#0a0a0f] border border-white/20 rounded text-white text-sm"
                                                                            />
                                                                        </div>
                                                                        <div>
                                                                            <label className="text-xs text-gray-500">สิ้นสุด</label>
                                                                            <input
                                                                                ref={(el) => { meterInputRefs.current[(nozzle - 1) * 2 + 1] = el; }}
                                                                                type="number"
                                                                                step="0.01"
                                                                                value={input?.end || 0}
                                                                                onChange={(e) => setMeterInputs({
                                                                                    ...meterInputs,
                                                                                    [nozzle]: { ...input, end: parseFloat(e.target.value) || 0 }
                                                                                })}
                                                                                onKeyDown={(e) => handleMeterKeyDown(e, (nozzle - 1) * 2 + 1)}
                                                                                className="w-full px-2 py-1 bg-[#0a0a0f] border border-white/20 rounded text-white text-sm"
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <div className="space-y-1">
                                                                        <div className="flex justify-between text-sm">
                                                                            <span className="text-gray-500">เริ่ม</span>
                                                                            <span className="text-white">{formatNumber(meter?.startReading || 0)}</span>
                                                                        </div>
                                                                        <div className="flex justify-between text-sm">
                                                                            <span className="text-gray-500">สิ้นสุด</span>
                                                                            <span className={meter?.endReading ? 'text-green-400' : 'text-yellow-400'}>
                                                                                {meter?.endReading ? formatNumber(meter.endReading) : '-'}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>

                                                {/* Sales Summary - Calculate from meters */}
                                                {(() => {
                                                    const totalMeterLiters = record.meters.reduce((sum, m) =>
                                                        sum + ((m.endReading || 0) - (m.startReading || 0)), 0);
                                                    const gasPrice = record.gasPrice || 15.50;
                                                    const meterRevenue = totalMeterLiters * gasPrice;
                                                    const transactionRevenue = record.totalAmount;

                                                    return (
                                                        <div className="mt-4 p-3 bg-gradient-to-r from-purple-900/30 to-indigo-900/30 rounded-xl border border-purple-500/20">
                                                            <h5 className="text-sm font-medium text-purple-300 mb-2">📊 สรุปจากมิเตอร์</h5>
                                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                                                <div>
                                                                    <span className="text-gray-400">ลิตรจากมิเตอร์:</span>
                                                                    <span className="text-white font-bold ml-2">{formatNumber(totalMeterLiters)}</span>
                                                                </div>
                                                                <div>
                                                                    <span className="text-gray-400">ราคา/ลิตร:</span>
                                                                    <span className="text-cyan-400 font-bold ml-2">฿{formatNumber(gasPrice)}</span>
                                                                </div>
                                                                <div>
                                                                    <span className="text-gray-400">รายได้มิเตอร์:</span>
                                                                    <span className="text-green-400 font-bold ml-2">฿{formatCurrency(meterRevenue)}</span>
                                                                </div>
                                                                <div>
                                                                    <span className="text-gray-400">รายได้รายการขาย:</span>
                                                                    <span className="text-purple-400 font-bold ml-2">฿{formatCurrency(transactionRevenue)}</span>
                                                                </div>
                                                            </div>
                                                            {Math.abs(meterRevenue - transactionRevenue) > 1 && (
                                                                <div className="mt-2 text-xs text-yellow-400">
                                                                    ⚠️ ส่วนต่าง: ฿{formatCurrency(Math.abs(meterRevenue - transactionRevenue))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })()}
                                            </div>

                                            {/* Gas Price Edit Section */}
                                            {editingMeters === record.id && (
                                                <div className="bg-[#1a1a24] rounded-xl p-4">
                                                    <h4 className="text-white font-medium flex items-center gap-2 mb-3">
                                                        💰 ราคาแก๊ส LPG
                                                    </h4>
                                                    <div className="flex items-center gap-3">
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            placeholder="ราคา/ลิตร"
                                                            defaultValue={record.gasPrice || 15.50}
                                                            className="flex-1 px-3 py-2 bg-[#0a0a0f] border border-white/20 rounded-lg text-white"
                                                            id={`gasPrice-${record.id}`}
                                                        />
                                                        <span className="text-gray-400">บาท/ลิตร</span>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Transactions Section */}
                                            {record.transactions.length > 0 && (
                                                <div className="bg-[#1a1a24] rounded-xl p-4">
                                                    <h4 className="text-white font-medium mb-3">
                                                        รายการขาย ({record.transactionCount} รายการ)
                                                    </h4>
                                                    <div className="overflow-x-auto">
                                                        <table className="w-full text-sm">
                                                            <thead>
                                                                <tr className="text-gray-400 border-b border-white/10">
                                                                    <th className="text-left py-2">ทะเบียน</th>
                                                                    <th className="text-left py-2">ลูกค้า</th>
                                                                    <th className="text-left py-2">ประเภท</th>
                                                                    <th className="text-right py-2">ลิตร</th>
                                                                    <th className="text-right py-2">ยอดเงิน</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {record.transactions.map(t => (
                                                                    <tr key={t.id} className="border-b border-white/5">
                                                                        <td className="py-2 text-white">{t.licensePlate || '-'}</td>
                                                                        <td className="py-2 text-gray-300">{t.ownerName || '-'}</td>
                                                                        <td className="py-2">
                                                                            <span className={`px-2 py-0.5 rounded text-xs ${t.paymentType === 'CASH' ? 'bg-green-500/20 text-green-400' :
                                                                                t.paymentType === 'CREDIT' ? 'bg-purple-500/20 text-purple-400' :
                                                                                    'bg-blue-500/20 text-blue-400'
                                                                                }`}>
                                                                                {t.paymentType}
                                                                            </span>
                                                                        </td>
                                                                        <td className="py-2 text-right text-white">{formatNumber(t.liters)}</td>
                                                                        <td className="py-2 text-right text-purple-400">฿{formatCurrency(t.amount)}</td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Actions */}
                                            <div className="flex justify-end gap-2">
                                                <a
                                                    href={`/gas-station/${selectedStation.split('-')[1]}?date=${record.date}`}
                                                    className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg flex items-center gap-2"
                                                >
                                                    <Plus size={16} />
                                                    เพิ่มรายการขาย
                                                </a>
                                                {record.transactionCount === 0 && (
                                                    <button
                                                        onClick={() => handleDeleteRecord(record)}
                                                        className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg flex items-center gap-2"
                                                    >
                                                        <Trash2 size={16} />
                                                        ลบวันนี้
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Create New Record Modal */}
                {showCreateModal && (
                    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                        <div className="bg-[#12121a] rounded-2xl border border-white/10 p-6 w-full max-w-md">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-xl font-bold text-white">สร้างข้อมูลใหม่</h3>
                                <button
                                    onClick={() => setShowCreateModal(false)}
                                    className="text-gray-400 hover:text-white"
                                >
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm text-gray-400 mb-2">ปั๊มแก๊ส</label>
                                    <select
                                        value={selectedStation}
                                        onChange={(e) => setSelectedStation(e.target.value)}
                                        className="w-full px-4 py-3 bg-[#1a1a24] border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                                    >
                                        {STATIONS.map(s => (
                                            <option key={s.id} value={s.id}>{s.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm text-gray-400 mb-2">วันที่</label>
                                    <input
                                        type="date"
                                        value={newDate}
                                        onChange={(e) => setNewDate(e.target.value)}
                                        className="w-full px-4 py-3 bg-[#1a1a24] border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm text-gray-400 mb-2">จำนวนกะ</label>
                                    <div className="flex gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setNewShiftCount(1)}
                                            className={`flex-1 px-4 py-3 rounded-xl font-medium transition-all ${newShiftCount === 1
                                                ? 'bg-orange-500 text-white'
                                                : 'bg-[#1a1a24] text-gray-400 border border-white/10 hover:border-orange-500/50'
                                                }`}
                                        >
                                            🌅 1 กะ (ทั้งวัน)
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setNewShiftCount(2)}
                                            className={`flex-1 px-4 py-3 rounded-xl font-medium transition-all ${newShiftCount === 2
                                                ? 'bg-indigo-500 text-white'
                                                : 'bg-[#1a1a24] text-gray-400 border border-white/10 hover:border-indigo-500/50'
                                                }`}
                                        >
                                            🌙 2 กะ (เช้า/บ่าย)
                                        </button>
                                    </div>
                                </div>

                                <p className="text-sm text-gray-500">
                                    จะสร้าง Daily Record ใหม่พร้อมมิเตอร์ 4 หัวจ่าย × {newShiftCount} กะ
                                </p>

                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setShowCreateModal(false)}
                                        className="flex-1 px-4 py-3 bg-gray-600 text-white rounded-xl"
                                    >
                                        ยกเลิก
                                    </button>
                                    <button
                                        onClick={handleCreateRecord}
                                        disabled={saving}
                                        className="flex-1 px-4 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl flex items-center justify-center gap-2"
                                    >
                                        <Plus size={18} />
                                        {saving ? 'กำลังสร้าง...' : 'สร้างข้อมูล'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </Sidebar>
    );
}
