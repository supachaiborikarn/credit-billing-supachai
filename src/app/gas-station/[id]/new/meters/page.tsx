'use client';

import { useState, useEffect, use } from 'react';
import { ArrowLeft, Camera, Copy, Save, Gauge, Lock } from 'lucide-react';
import { STATIONS, GAS_TANK_CAPACITY_LITERS, TANK_COUNT, NOZZLE_COUNT } from '@/constants';
import Link from 'next/link';

interface MeterReading {
    nozzleNumber: number;
    startReading: number;
    endReading: number | null;
    startImageUrl?: string;
    endImageUrl?: string;
}

interface GaugeReading {
    tankNumber: number;
    type: 'start' | 'end';
    percentage: number;
}

type TabType = 'start' | 'end' | 'gauge';

export default function GasStationMetersPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const stationIndex = parseInt(id) - 1;
    const station = STATIONS[stationIndex];

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [activeTab, setActiveTab] = useState<TabType>('start');

    // Meter readings
    const [meters, setMeters] = useState<MeterReading[]>(
        Array.from({ length: NOZZLE_COUNT }, (_, i) => ({
            nozzleNumber: i + 1,
            startReading: 0,
            endReading: null,
        }))
    );

    // Gauge readings
    const [startGauges, setStartGauges] = useState<number[]>(Array(TANK_COUNT).fill(0));
    const [endGauges, setEndGauges] = useState<number[]>(Array(TANK_COUNT).fill(0));

    useEffect(() => {
        fetchData();
    }, [selectedDate]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/gas-station/${id}/daily?date=${selectedDate}`);
            if (res.ok) {
                const data = await res.json();

                // Get meters from current shift or latest shift (shift meters are where data is saved)
                let metersData = null;

                // Priority: currentShift > first shift with data > dailyRecord.meters
                if (data.currentShift?.meters && data.currentShift.meters.length > 0) {
                    metersData = data.currentShift.meters;
                } else if (data.dailyRecord?.shifts && data.dailyRecord.shifts.length > 0) {
                    // Find shift with meters data
                    const shiftWithMeters = data.dailyRecord.shifts.find(
                        (s: { meters?: MeterReading[] }) => s.meters && s.meters.length > 0
                    );
                    if (shiftWithMeters) {
                        metersData = shiftWithMeters.meters;
                    }
                } else if (data.dailyRecord?.meters) {
                    // Fallback to dailyRecord.meters
                    metersData = data.dailyRecord.meters;
                }

                if (metersData && metersData.length > 0) {
                    setMeters(metersData.map((m: MeterReading) => ({
                        nozzleNumber: m.nozzleNumber,
                        startReading: Number(m.startReading) || 0,
                        endReading: m.endReading ? Number(m.endReading) : null,
                        startImageUrl: m.startImageUrl,
                        endImageUrl: m.endImageUrl,
                    })));
                }

                // Set gauges
                if (data.gaugeReadings) {
                    const starts = Array(TANK_COUNT).fill(0);
                    const ends = Array(TANK_COUNT).fill(0);

                    data.gaugeReadings.forEach((g: GaugeReading) => {
                        if (g.type === 'start') {
                            starts[g.tankNumber - 1] = g.percentage;
                        } else {
                            ends[g.tankNumber - 1] = g.percentage;
                        }
                    });

                    setStartGauges(starts);
                    setEndGauges(ends);
                }
            }
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    const copyFromPreviousShift = async () => {
        try {
            const res = await fetch(`/api/gas-station/${id}/shifts/previous?date=${selectedDate}`);
            if (res.ok) {
                const data = await res.json();
                if (data.meters) {
                    setMeters((prev) =>
                        prev.map((m) => ({
                            ...m,
                            startReading: data.meters[m.nozzleNumber] || m.startReading,
                        }))
                    );
                    alert('📋 คัดลอกจากกะก่อนเรียบร้อย!');
                }
            } else {
                alert('ไม่พบข้อมูลกะก่อน');
            }
        } catch (error) {
            console.error('Error copying:', error);
        }
    };

    const saveMeters = async () => {
        setSaving(true);
        try {
            const endpoint = activeTab === 'start' ? 'start' : 'end';
            const metersData = meters.map((m) => ({
                nozzleNumber: m.nozzleNumber,
                reading: activeTab === 'start' ? m.startReading : m.endReading,
            }));

            const res = await fetch(`/api/gas-station/${id}/meters`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date: selectedDate,
                    type: endpoint,
                    meters: metersData,
                }),
            });

            if (res.ok) {
                alert('✅ บันทึกมิเตอร์เรียบร้อย!');
            } else {
                const err = await res.json();
                alert(err.error || 'บันทึกไม่สำเร็จ');
            }
        } catch (error) {
            console.error('Error saving meters:', error);
            alert('เกิดข้อผิดพลาด');
        } finally {
            setSaving(false);
        }
    };

    const saveGauges = async () => {
        setSaving(true);
        try {
            const gaugeData = (activeTab === 'gauge' ? startGauges : endGauges).map((p, i) => ({
                tankNumber: i + 1,
                percentage: p,
                type: 'start', // Always save as current state
            }));

            const res = await fetch(`/api/gas-station/${id}/gauge`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date: selectedDate,
                    readings: gaugeData,
                }),
            });

            if (res.ok) {
                alert('✅ บันทึกระดับถังเรียบร้อย!');
            } else {
                const err = await res.json();
                alert(err.error || 'บันทึกไม่สำเร็จ');
            }
        } catch (error) {
            console.error('Error saving gauges:', error);
            alert('เกิดข้อผิดพลาด');
        } finally {
            setSaving(false);
        }
    };

    const updateMeter = (nozzle: number, value: number, type: 'start' | 'end') => {
        setMeters((prev) =>
            prev.map((m) =>
                m.nozzleNumber === nozzle
                    ? { ...m, [type === 'start' ? 'startReading' : 'endReading']: value }
                    : m
            )
        );
    };

    const formatNumber = (num: number) =>
        new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2 }).format(num);

    // Calculate total liters from gauges
    const calculateTotalLiters = (gauges: number[]) => {
        return gauges.reduce((sum, p) => sum + (p / 100) * GAS_TANK_CAPACITY_LITERS, 0);
    };

    if (!station) {
        return <div className="p-4 text-gray-500">ไม่พบสถานี</div>;
    }

    return (
        <div className="min-h-screen bg-gray-100">
            {/* Header */}
            <header className="bg-white shadow-sm sticky top-0 z-40">
                <div className="px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link href={`/gas-station/${id}/new/home`} className="p-1">
                            <ArrowLeft size={24} className="text-gray-700" />
                        </Link>
                        <h1 className="font-bold text-gray-800 text-lg">มิเตอร์</h1>
                    </div>
                    <div className="flex items-center gap-2 bg-gray-100 px-3 py-1.5 rounded-lg">
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="bg-transparent text-gray-700 text-sm font-medium focus:outline-none"
                        />
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-200">
                    {[
                        { key: 'start', label: 'เริ่มต้น' },
                        { key: 'end', label: 'สิ้นสุด' },
                        { key: 'gauge', label: 'ถังแก๊ส' },
                    ].map((tab) => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key as TabType)}
                            className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === tab.key
                                ? 'text-orange-500 border-b-2 border-orange-500'
                                : 'text-gray-500'
                                }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </header>

            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
                </div>
            ) : (
                <div className="p-4 space-y-4">
                    {/* Meter Readings */}
                    {(activeTab === 'start' || activeTab === 'end') && (
                        <>
                            {activeTab === 'start' && (
                                <button
                                    onClick={copyFromPreviousShift}
                                    className="w-full py-2.5 bg-blue-50 text-blue-600 font-medium rounded-xl flex items-center justify-center gap-2 hover:bg-blue-100"
                                >
                                    <Copy size={18} /> คัดลอกจากกะก่อน
                                </button>
                            )}

                            {meters.map((m) => (
                                <div key={m.nozzleNumber} className="bg-white rounded-2xl shadow-sm p-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium text-gray-700">
                                                ⛽ หัวจ่าย {m.nozzleNumber}
                                            </span>
                                            {activeTab === 'start' && m.startReading > 0 && (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-bold rounded-full">
                                                    <Lock size={10} />
                                                    ยกมา
                                                </span>
                                            )}
                                        </div>
                                        <button className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200">
                                            <Camera size={18} className="text-gray-500" />
                                        </button>
                                    </div>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            value={activeTab === 'start' ? m.startReading : (m.endReading || '')}
                                            onChange={(e) =>
                                                updateMeter(m.nozzleNumber, parseFloat(e.target.value) || 0, activeTab)
                                            }
                                            placeholder="0.00"
                                            className={`w-full px-4 py-3 border rounded-xl text-xl text-right font-mono focus:outline-none focus:ring-2 focus:ring-orange-500 ${activeTab === 'start' && m.startReading > 0
                                                ? 'border-blue-200 bg-blue-50 text-blue-700'
                                                : 'border-gray-200'
                                                }`}
                                            inputMode="decimal"
                                        />
                                        {activeTab === 'start' && m.startReading > 0 && (
                                            <Lock size={14} className="absolute right-12 top-1/2 -translate-y-1/2 text-blue-400" />
                                        )}
                                    </div>
                                    {activeTab === 'end' && m.startReading > 0 && m.endReading && (
                                        <p className="text-sm text-gray-500 mt-2 text-right">
                                            ขายได้: {formatNumber((m.endReading || 0) - m.startReading)} ลิตร
                                        </p>
                                    )}
                                    {activeTab === 'start' && m.startReading > 0 && (
                                        <p className="text-xs text-blue-500 mt-2 text-center">
                                            🔒 ค่ายกมาจากกะก่อน
                                        </p>
                                    )}
                                </div>
                            ))}

                            <button
                                onClick={saveMeters}
                                disabled={saving}
                                className="w-full py-4 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-2xl flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                <Save size={20} /> {saving ? 'กำลังบันทึก...' : 'บันทึกมิเตอร์'}
                            </button>
                        </>
                    )}

                    {/* Gauge Readings */}
                    {activeTab === 'gauge' && (
                        <>
                            {startGauges.map((_, i) => (
                                <div key={i} className="bg-white rounded-2xl shadow-sm p-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="font-medium text-gray-700">
                                            🛢️ ถังที่ {i + 1}
                                        </span>
                                        {/* Editable percentage input */}
                                        <div className="flex items-center gap-1">
                                            <input
                                                type="number"
                                                min="0"
                                                max="100"
                                                value={startGauges[i]}
                                                onChange={(e) => {
                                                    const val = Math.max(0, Math.min(100, parseInt(e.target.value) || 0));
                                                    const newGauges = [...startGauges];
                                                    newGauges[i] = val;
                                                    setStartGauges(newGauges);
                                                }}
                                                className="w-20 px-2 py-1 text-2xl font-bold text-orange-500 text-right border-2 border-orange-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                                                inputMode="numeric"
                                            />
                                            <span className="text-2xl font-bold text-orange-500">%</span>
                                        </div>
                                    </div>

                                    {/* Visual gauge bar */}
                                    <div className="h-4 bg-gray-200 rounded-full overflow-hidden mb-3">
                                        <div
                                            className="h-full bg-gradient-to-r from-orange-400 to-orange-500 transition-all"
                                            style={{ width: `${startGauges[i]}%` }}
                                        ></div>
                                    </div>

                                    {/* Slider for quick adjustment */}
                                    <input
                                        type="range"
                                        min="0"
                                        max="100"
                                        step="1"
                                        value={startGauges[i]}
                                        onChange={(e) => {
                                            const newGauges = [...startGauges];
                                            newGauges[i] = parseInt(e.target.value);
                                            setStartGauges(newGauges);
                                        }}
                                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-orange-500"
                                    />

                                    {/* Quick select buttons */}
                                    <div className="flex justify-between mt-3 gap-1">
                                        {[0, 25, 50, 75, 100].map((val) => (
                                            <button
                                                key={val}
                                                onClick={() => {
                                                    const newGauges = [...startGauges];
                                                    newGauges[i] = val;
                                                    setStartGauges(newGauges);
                                                }}
                                                className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${startGauges[i] === val
                                                    ? 'bg-orange-500 text-white'
                                                    : 'bg-gray-100 text-gray-600 hover:bg-orange-100'
                                                    }`}
                                            >
                                                {val}%
                                            </button>
                                        ))}
                                    </div>

                                    <p className="text-sm text-gray-500 mt-2 text-center">
                                        ≈ {formatNumber((startGauges[i] / 100) * GAS_TANK_CAPACITY_LITERS)} ลิตร
                                    </p>
                                </div>
                            ))}

                            {/* Total */}
                            <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-2xl p-4 text-center">
                                <p className="text-orange-100 text-sm mb-1">รวมทั้งหมด</p>
                                <p className="text-white text-3xl font-bold">
                                    {formatNumber(calculateTotalLiters(startGauges))} ลิตร
                                </p>
                                <p className="text-orange-200 text-sm mt-1">
                                    ≈ {Math.round(calculateTotalLiters(startGauges) / (TANK_COUNT * GAS_TANK_CAPACITY_LITERS) * 100)}%
                                </p>
                            </div>

                            <button
                                onClick={saveGauges}
                                disabled={saving}
                                className="w-full py-4 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-2xl flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                <Save size={20} /> {saving ? 'กำลังบันทึก...' : 'บันทึกระดับถัง'}
                            </button>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
