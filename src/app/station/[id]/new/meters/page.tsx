'use client';

import { useState, useEffect, use } from 'react';
import { ArrowLeft, Camera, Save, Check } from 'lucide-react';
import { STATIONS } from '@/constants';
import Link from 'next/link';

interface MeterReading {
    nozzle: number;
    start: number;
    end: number;
    startPhoto?: string | null;
    endPhoto?: string | null;
}

export default function StationMetersPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const stationIndex = parseInt(id) - 1;
    const station = STATIONS[stationIndex];

    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [meters, setMeters] = useState<MeterReading[]>([
        { nozzle: 1, start: 0, end: 0 },
        { nozzle: 2, start: 0, end: 0 },
    ]);
    const [activeTab, setActiveTab] = useState<'start' | 'end'>('start');
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchMeters();
    }, [selectedDate]);

    const fetchMeters = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/station/${id}/daily?date=${selectedDate}`);
            if (res.ok) {
                const data = await res.json();
                if (data.dailyRecord?.meters) {
                    const meterData = data.dailyRecord.meters.map((m: { nozzleNumber: number; startReading: number; endReading: number | null; startPhoto?: string | null; endPhoto?: string | null }) => ({
                        nozzle: m.nozzleNumber,
                        start: m.startReading || 0,
                        end: m.endReading || 0,
                        startPhoto: m.startPhoto,
                        endPhoto: m.endPhoto,
                    }));
                    if (meterData.length > 0) {
                        setMeters(meterData);
                    }
                }
            }
        } catch (error) {
            console.error('Error fetching meters:', error);
        } finally {
            setLoading(false);
        }
    };

    const updateMeter = (nozzle: number, field: 'start' | 'end', value: number) => {
        setMeters(prev => prev.map(m =>
            m.nozzle === nozzle ? { ...m, [field]: value } : m
        ));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetch(`/api/station/${id}/meters`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date: selectedDate,
                    type: activeTab,
                    meters: meters.map(m => ({
                        nozzleNumber: m.nozzle,
                        reading: activeTab === 'start' ? m.start : m.end,
                    })),
                }),
            });

            if (res.ok) {
                setSuccess(true);
                setTimeout(() => setSuccess(false), 2000);
            } else {
                const err = await res.json();
                alert(err.error || 'บันทึกไม่สำเร็จ');
            }
        } catch (error) {
            console.error('Error saving:', error);
            alert('เกิดข้อผิดพลาด');
        } finally {
            setSaving(false);
        }
    };

    const formatNumber = (num: number) =>
        new Intl.NumberFormat('th-TH', { minimumFractionDigits: 0 }).format(num);

    if (!station) {
        return <div className="p-4 text-gray-500">ไม่พบสถานี</div>;
    }

    return (
        <div className="min-h-screen bg-gray-100">
            {/* Header */}
            <header className="bg-white shadow-sm sticky top-0 z-40">
                <div className="px-4 py-3 flex items-center gap-3">
                    <Link href={`/station/${id}/new/home`} className="p-1">
                        <ArrowLeft size={24} className="text-gray-700" />
                    </Link>
                    <h1 className="font-bold text-gray-800 text-lg">มิเตอร์</h1>
                    <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="ml-auto bg-gray-100 px-3 py-1.5 rounded-lg text-sm"
                    />
                </div>
            </header>

            {/* Success Toast */}
            {success && (
                <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-green-500 text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-2 z-50">
                    <Check size={20} />
                    บันทึกสำเร็จ!
                </div>
            )}

            {/* Tabs */}
            <div className="bg-white border-b border-gray-200">
                <div className="flex">
                    <button
                        onClick={() => setActiveTab('start')}
                        className={`flex-1 py-3 text-center font-medium transition ${activeTab === 'start'
                                ? 'text-blue-600 border-b-2 border-blue-600'
                                : 'text-gray-500'
                            }`}
                    >
                        📊 มิเตอร์เริ่มต้น
                    </button>
                    <button
                        onClick={() => setActiveTab('end')}
                        className={`flex-1 py-3 text-center font-medium transition ${activeTab === 'end'
                                ? 'text-blue-600 border-b-2 border-blue-600'
                                : 'text-gray-500'
                            }`}
                    >
                        📊 มิเตอร์สิ้นสุด
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                </div>
            ) : (
                <div className="p-4 space-y-4">
                    {meters.map((meter) => (
                        <div key={meter.nozzle} className="bg-white rounded-2xl shadow-sm p-4">
                            <div className="flex items-center justify-between mb-3">
                                <span className="font-semibold text-gray-800">
                                    หัวจ่าย {meter.nozzle}
                                </span>
                                {meter.start > 0 && meter.end > 0 && (
                                    <span className="text-sm text-gray-500">
                                        ขาย {formatNumber(meter.end - meter.start)} ลิตร
                                    </span>
                                )}
                            </div>

                            <div className="space-y-3">
                                <div>
                                    <label className="text-xs text-gray-500">
                                        {activeTab === 'start' ? 'มิเตอร์เริ่มต้น' : 'มิเตอร์สิ้นสุด'}
                                    </label>
                                    <input
                                        type="number"
                                        value={activeTab === 'start' ? meter.start : meter.end}
                                        onChange={(e) => updateMeter(
                                            meter.nozzle,
                                            activeTab,
                                            parseFloat(e.target.value) || 0
                                        )}
                                        className="w-full px-4 py-3 border border-gray-200 rounded-xl text-xl font-mono text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        inputMode="numeric"
                                    />
                                </div>

                                {/* Photo indicator */}
                                <div className="flex items-center gap-2 text-sm text-gray-400">
                                    <Camera size={16} />
                                    {(activeTab === 'start' ? meter.startPhoto : meter.endPhoto) ? (
                                        <span className="text-green-500">มีรูปถ่าย</span>
                                    ) : (
                                        <span>ยังไม่มีรูปถ่าย</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}

                    {/* Summary */}
                    <div className="bg-blue-50 rounded-2xl p-4">
                        <div className="flex items-center justify-between">
                            <span className="text-blue-700">รวมขายทั้งหมด</span>
                            <span className="text-2xl font-bold text-blue-800">
                                {formatNumber(meters.reduce((sum, m) => sum + (m.end - m.start), 0))} ลิตร
                            </span>
                        </div>
                    </div>

                    {/* Save Button */}
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="w-full py-4 bg-blue-500 text-white font-bold rounded-2xl hover:bg-blue-600 transition disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {saving ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                กำลังบันทึก...
                            </>
                        ) : (
                            <>
                                <Save size={20} />
                                บันทึกมิเตอร์{activeTab === 'start' ? 'เริ่มต้น' : 'สิ้นสุด'}
                            </>
                        )}
                    </button>
                </div>
            )}
        </div>
    );
}
