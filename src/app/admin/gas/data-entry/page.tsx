'use client';

import { useEffect, useState, useRef, KeyboardEvent } from 'react';
import {
    Calendar,
    FuelIcon,
    Gauge,
    Calculator,
    Save,
    AlertCircle,
    CheckCircle,
    Loader2
} from 'lucide-react';
import { STATIONS } from '@/constants';

interface ShiftData {
    id?: string;
    exists: boolean;
    meters: { nozzle: number; start: number | null; end: number | null }[];
    gauges: { tank: number; percentage: number | null }[];
    sales: {
        cash: number;
        credit: number;
        card: number;
        transfer: number;
    };
}

export default function AdminDataEntryPage() {
    const gasStations = STATIONS.filter(s => s.type === 'GAS');

    const [stationId, setStationId] = useState<string>(gasStations[0]?.id || '');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [shiftNumber, setShiftNumber] = useState(1);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const [shiftData, setShiftData] = useState<ShiftData>({
        exists: false,
        meters: [
            { nozzle: 1, start: null, end: null },
            { nozzle: 2, start: null, end: null },
            { nozzle: 3, start: null, end: null },
            { nozzle: 4, start: null, end: null },
        ],
        gauges: [
            { tank: 1, percentage: null },
            { tank: 2, percentage: null },
            { tank: 3, percentage: null },
        ],
        sales: { cash: 0, credit: 0, card: 0, transfer: 0 }
    });

    const selectedStation = gasStations.find(s => s.id === stationId);

    // Refs for meter inputs - order: start1, start2, start3, start4, end1, end2, end3, end4
    const meterRefs = useRef<(HTMLInputElement | null)[]>([]);

    // Handle Enter key to move to next input
    const handleMeterKeyDown = (e: KeyboardEvent<HTMLInputElement>, currentIndex: number) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            // Find next non-empty input or just go to next
            const nextIndex = currentIndex + 1;
            if (nextIndex < meterRefs.current.length) {
                meterRefs.current[nextIndex]?.focus();
            }
        }
    };

    // Get ref index for meter input
    // Order: start1(0), start2(1), start3(2), start4(3), end1(4), end2(5), end3(6), end4(7)
    const getMeterRefIndex = (nozzle: number, field: 'start' | 'end') => {
        return field === 'start' ? nozzle - 1 : nozzle + 3;
    };

    // Fetch existing data when selection changes
    useEffect(() => {
        const fetchData = async () => {
            if (!stationId || !date) return;

            setLoading(true);
            setMessage(null);

            try {
                const res = await fetch(`/api/v2/gas/admin/data-entry?stationId=${stationId}&date=${date}&shiftNumber=${shiftNumber}`);
                if (res.ok) {
                    const data = await res.json();
                    setShiftData({
                        id: data.shiftId,
                        exists: data.exists,
                        meters: data.meters || shiftData.meters,
                        gauges: data.gauges || shiftData.gauges,
                        sales: data.sales || shiftData.sales
                    });
                }
            } catch (error) {
                console.error('Error fetching data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [stationId, date, shiftNumber]);

    const handleMeterChange = (nozzle: number, field: 'start' | 'end', value: string) => {
        setShiftData(prev => ({
            ...prev,
            meters: prev.meters.map(m =>
                m.nozzle === nozzle
                    ? { ...m, [field]: value === '' ? null : parseFloat(value) }
                    : m
            )
        }));
    };

    const handleGaugeChange = (tank: number, value: string) => {
        setShiftData(prev => ({
            ...prev,
            gauges: prev.gauges.map(g =>
                g.tank === tank
                    ? { ...g, percentage: value === '' ? null : parseFloat(value) }
                    : g
            )
        }));
    };

    const handleSalesChange = (field: keyof typeof shiftData.sales, value: string) => {
        setShiftData(prev => ({
            ...prev,
            sales: { ...prev.sales, [field]: value === '' ? 0 : parseFloat(value) }
        }));
    };

    const handleSave = async () => {
        setSaving(true);
        setMessage(null);

        try {
            const res = await fetch('/api/v2/gas/admin/data-entry', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    stationId,
                    date,
                    shiftNumber,
                    ...shiftData
                })
            });

            if (res.ok) {
                const data = await res.json();
                setShiftData(prev => ({ ...prev, id: data.shiftId, exists: true }));
                setMessage({ type: 'success', text: 'บันทึกข้อมูลสำเร็จ!' });
            } else {
                const error = await res.json();
                setMessage({ type: 'error', text: error.message || 'เกิดข้อผิดพลาด' });
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'ไม่สามารถบันทึกข้อมูลได้' });
        } finally {
            setSaving(false);
        }
    };

    const totalSales = shiftData.sales.cash + shiftData.sales.credit + shiftData.sales.card + shiftData.sales.transfer;
    const totalLiters = shiftData.meters.reduce((sum, m) => {
        if (m.start !== null && m.end !== null) {
            return sum + Math.max(0, m.end - m.start);
        }
        return sum;
    }, 0);

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-gradient-to-br from-orange-500 to-red-500">
                    <FuelIcon className="text-white" size={24} />
                </div>
                <div>
                    <h1 className="text-2xl font-bold">ใส่ข้อมูลย้อนหลัง</h1>
                    <p className="text-gray-400 text-sm">สำหรับปั๊มแก๊ส - เลือกปั๊ม วันที่ และกะ</p>
                </div>
            </div>

            {/* Selection */}
            <div className="bg-[#1a1a24] rounded-xl p-6 border border-white/10 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Station */}
                    <div>
                        <label className="block text-sm text-gray-400 mb-2">ปั๊ม</label>
                        <select
                            value={stationId}
                            onChange={(e) => setStationId(e.target.value)}
                            className="w-full px-4 py-3 bg-gray-800 border border-white/10 rounded-xl text-white focus:border-orange-500 focus:outline-none"
                        >
                            {gasStations.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Date */}
                    <div>
                        <label className="block text-sm text-gray-400 mb-2">วันที่</label>
                        <div className="relative">
                            <input
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="w-full px-4 py-3 bg-gray-800 border border-white/10 rounded-xl text-white focus:border-orange-500 focus:outline-none"
                            />
                            <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" size={18} />
                        </div>
                    </div>

                    {/* Shift */}
                    <div>
                        <label className="block text-sm text-gray-400 mb-2">กะ</label>
                        <div className="flex gap-2">
                            {[1, 2].map(num => (
                                <button
                                    key={num}
                                    onClick={() => setShiftNumber(num)}
                                    className={`flex-1 py-3 rounded-xl font-medium transition-colors ${shiftNumber === num
                                        ? 'bg-orange-500 text-white'
                                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                                        }`}
                                >
                                    กะ {num} {num === 1 ? '(เช้า)' : '(บ่าย)'}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Current Selection Summary */}
                <div className={`p-4 rounded-xl ${shiftData.exists ? 'bg-blue-900/30 border border-blue-500/30' : 'bg-orange-900/30 border border-orange-500/30'}`}>
                    <div className="flex items-center gap-2">
                        {loading ? (
                            <Loader2 className="animate-spin text-orange-400" size={18} />
                        ) : shiftData.exists ? (
                            <CheckCircle className="text-blue-400" size={18} />
                        ) : (
                            <AlertCircle className="text-orange-400" size={18} />
                        )}
                        <span className={shiftData.exists ? 'text-blue-300' : 'text-orange-300'}>
                            {loading ? 'กำลังโหลด...' : (
                                <>
                                    <strong>{selectedStation?.name}</strong> |
                                    วันที่ {new Date(date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })} |
                                    กะ {shiftNumber}
                                    {shiftData.exists ? ' (มีข้อมูลแล้ว)' : ' (ยังไม่มีข้อมูล)'}
                                </>
                            )}
                        </span>
                    </div>
                </div>
            </div>

            {/* Meters */}
            <div className="bg-[#1a1a24] rounded-xl p-6 border border-white/10">
                <div className="flex items-center gap-2 mb-4">
                    <Calculator className="text-blue-400" size={20} />
                    <h2 className="text-lg font-medium">มิเตอร์หัวจ่าย</h2>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="text-gray-400 text-sm">
                                <th className="text-left py-2 px-2">หัว</th>
                                <th className="text-right py-2 px-2">เริ่มต้น</th>
                                <th className="text-right py-2 px-2">สิ้นสุด</th>
                                <th className="text-right py-2 px-2">ลิตร</th>
                            </tr>
                        </thead>
                        <tbody>
                            {shiftData.meters.map((meter) => {
                                const liters = meter.start !== null && meter.end !== null
                                    ? Math.max(0, meter.end - meter.start)
                                    : 0;
                                const startIdx = getMeterRefIndex(meter.nozzle, 'start');
                                const endIdx = getMeterRefIndex(meter.nozzle, 'end');
                                return (
                                    <tr key={meter.nozzle} className="border-t border-white/5">
                                        <td className="py-3 px-2 font-medium">หัว {meter.nozzle}</td>
                                        <td className="py-3 px-2">
                                            <input
                                                ref={el => { meterRefs.current[startIdx] = el; }}
                                                type="number"
                                                value={meter.start ?? ''}
                                                onChange={(e) => handleMeterChange(meter.nozzle, 'start', e.target.value)}
                                                onKeyDown={(e) => handleMeterKeyDown(e, startIdx)}
                                                placeholder="0"
                                                className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-right focus:border-blue-500 focus:outline-none"
                                            />
                                        </td>
                                        <td className="py-3 px-2">
                                            <input
                                                ref={el => { meterRefs.current[endIdx] = el; }}
                                                type="number"
                                                value={meter.end ?? ''}
                                                onChange={(e) => handleMeterChange(meter.nozzle, 'end', e.target.value)}
                                                onKeyDown={(e) => handleMeterKeyDown(e, endIdx)}
                                                placeholder="0"
                                                className="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-right focus:border-blue-500 focus:outline-none"
                                            />
                                        </td>
                                        <td className="py-3 px-2 text-right text-orange-400 font-mono">
                                            {liters.toFixed(2)}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                        <tfoot>
                            <tr className="border-t border-white/10">
                                <td colSpan={3} className="py-3 px-2 text-right text-gray-400">รวม</td>
                                <td className="py-3 px-2 text-right text-orange-400 font-bold font-mono">
                                    {totalLiters.toFixed(2)} L
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>

            {/* Gauge */}
            <div className="bg-[#1a1a24] rounded-xl p-6 border border-white/10">
                <div className="flex items-center gap-2 mb-4">
                    <Gauge className="text-orange-400" size={20} />
                    <h2 className="text-lg font-medium">ระดับเกจ</h2>
                </div>

                <div className="grid grid-cols-3 gap-4">
                    {shiftData.gauges.map((g) => (
                        <div key={g.tank} className="text-center">
                            <div className="text-sm text-gray-400 mb-2">ถัง {g.tank}</div>
                            <div className="relative">
                                <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={g.percentage ?? ''}
                                    onChange={(e) => handleGaugeChange(g.tank, e.target.value)}
                                    placeholder="0"
                                    className="w-full px-4 py-3 bg-gray-800 border border-white/10 rounded-xl text-center text-2xl font-bold focus:border-orange-500 focus:outline-none"
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500">%</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Sales */}
            <div className="bg-[#1a1a24] rounded-xl p-6 border border-white/10">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <FuelIcon className="text-green-400" size={20} />
                        <h2 className="text-lg font-medium">ยอดขาย</h2>
                    </div>
                    <div className="text-2xl font-bold text-green-400">
                        ฿{totalSales.toLocaleString()}
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                        <label className="block text-sm text-green-400 mb-2">เงินสด</label>
                        <input
                            type="number"
                            value={shiftData.sales.cash || ''}
                            onChange={(e) => handleSalesChange('cash', e.target.value)}
                            placeholder="0"
                            className="w-full px-4 py-3 bg-green-900/20 border border-green-500/20 rounded-xl text-right focus:border-green-500 focus:outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-purple-400 mb-2">เงินเชื่อ</label>
                        <input
                            type="number"
                            value={shiftData.sales.credit || ''}
                            onChange={(e) => handleSalesChange('credit', e.target.value)}
                            placeholder="0"
                            className="w-full px-4 py-3 bg-purple-900/20 border border-purple-500/20 rounded-xl text-right focus:border-purple-500 focus:outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-blue-400 mb-2">บัตร</label>
                        <input
                            type="number"
                            value={shiftData.sales.card || ''}
                            onChange={(e) => handleSalesChange('card', e.target.value)}
                            placeholder="0"
                            className="w-full px-4 py-3 bg-blue-900/20 border border-blue-500/20 rounded-xl text-right focus:border-blue-500 focus:outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-cyan-400 mb-2">โอน</label>
                        <input
                            type="number"
                            value={shiftData.sales.transfer || ''}
                            onChange={(e) => handleSalesChange('transfer', e.target.value)}
                            placeholder="0"
                            className="w-full px-4 py-3 bg-cyan-900/20 border border-cyan-500/20 rounded-xl text-right focus:border-cyan-500 focus:outline-none"
                        />
                    </div>
                </div>
            </div>

            {/* Message */}
            {message && (
                <div className={`p-4 rounded-xl flex items-center gap-2 ${message.type === 'success'
                    ? 'bg-green-900/30 border border-green-500/30 text-green-300'
                    : 'bg-red-900/30 border border-red-500/30 text-red-300'
                    }`}>
                    {message.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                    {message.text}
                </div>
            )}

            {/* Save Button */}
            <button
                onClick={handleSave}
                disabled={saving}
                className="w-full py-4 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 disabled:opacity-50 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all"
            >
                {saving ? (
                    <Loader2 className="animate-spin" size={20} />
                ) : (
                    <Save size={20} />
                )}
                {saving ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
            </button>
        </div>
    );
}
