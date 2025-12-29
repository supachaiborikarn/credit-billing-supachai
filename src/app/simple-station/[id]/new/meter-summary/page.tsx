'use client';

import { useState, useEffect, use } from 'react';
import { ArrowLeft, Calendar, Fuel, TrendingUp, AlertTriangle } from 'lucide-react';
import { STATIONS } from '@/constants';
import Link from 'next/link';

interface MeterReading {
    nozzle: number;
    fuelType: string;
    price: number;
    startReading: number;
    endReading: number;
    liters: number;
    amount: number;
}

interface ShiftMeterData {
    shiftId: string;
    shiftNumber: number;
    staffName: string;
    date: string;
    openedAt: string;
    closedAt: string | null;
    status: string;
    meters: MeterReading[];
    totalLiters: number;
    totalAmount: number;
}

export default function MeterSummaryPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const stationIndex = parseInt(id) - 1;
    const station = STATIONS[stationIndex];

    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [loading, setLoading] = useState(true);
    const [shifts, setShifts] = useState<ShiftMeterData[]>([]);
    const [salesData, setSalesData] = useState<{ fuelType: string; liters: number; amount: number }[]>([]);

    // Fetch meter data
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                // Fetch shift-end data with meter readings
                const res = await fetch(`/api/simple-station/${id}/shift-end?date=${selectedDate}`);
                if (res.ok) {
                    const data = await res.json();

                    // Process shifts with meter data
                    const processedShifts: ShiftMeterData[] = [];

                    if (data.shifts && data.shifts.length > 0) {
                        for (const shift of data.shifts) {
                            // Get meter readings for this shift (from meterReadings in shift data)
                            const meters: MeterReading[] = data.fuelConfig?.map((fuel: { nozzle: number; name: string; price: number }) => {
                                const carryOver = data.carryOverReadings?.[fuel.nozzle] || 0;
                                const existing = data.meters?.find((m: { nozzleNumber: number }) => m.nozzleNumber === fuel.nozzle);
                                const startReading = existing?.startReading || carryOver || 0;
                                const endReading = existing?.endReading || 0;
                                const liters = endReading > startReading ? endReading - startReading : 0;
                                return {
                                    nozzle: fuel.nozzle,
                                    fuelType: fuel.name,
                                    price: fuel.price,
                                    startReading,
                                    endReading,
                                    liters,
                                    amount: liters * fuel.price
                                };
                            }) || [];

                            processedShifts.push({
                                shiftId: shift.id,
                                shiftNumber: shift.shiftNumber,
                                staffName: shift.staffId || 'ไม่ระบุ',
                                date: data.date,
                                openedAt: shift.createdAt,
                                closedAt: shift.closedAt,
                                status: shift.status,
                                meters,
                                totalLiters: meters.reduce((sum, m) => sum + m.liters, 0),
                                totalAmount: meters.reduce((sum, m) => sum + m.amount, 0)
                            });
                        }
                    }

                    setShifts(processedShifts);
                }

                // Fetch sales data for comparison
                const salesRes = await fetch(`/api/station/${id}/transactions?date=${selectedDate}`);
                if (salesRes.ok) {
                    const txns = await salesRes.json();
                    // Group by fuel type
                    const grouped: Record<string, { liters: number; amount: number }> = {};
                    for (const txn of txns) {
                        const ft = txn.fuelType || 'อื่นๆ';
                        if (!grouped[ft]) grouped[ft] = { liters: 0, amount: 0 };
                        grouped[ft].liters += Number(txn.liters) || 0;
                        grouped[ft].amount += Number(txn.amount) || 0;
                    }
                    setSalesData(Object.entries(grouped).map(([fuelType, data]) => ({
                        fuelType,
                        liters: data.liters,
                        amount: data.amount
                    })));
                }
            } catch (error) {
                console.error('Error fetching meter data:', error);
            } finally {
                setLoading(false);
            }
        };

        if (station) fetchData();
    }, [station, id, selectedDate]);

    const formatNumber = (num: number) =>
        new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2 }).format(num);

    // Group meters by fuel type for summary
    const getMeterSummaryByFuel = () => {
        const summary: Record<string, { liters: number; amount: number; count: number }> = {};

        for (const shift of shifts) {
            for (const meter of shift.meters) {
                if (!summary[meter.fuelType]) {
                    summary[meter.fuelType] = { liters: 0, amount: 0, count: 0 };
                }
                summary[meter.fuelType].liters += meter.liters;
                summary[meter.fuelType].amount += meter.amount;
                summary[meter.fuelType].count++;
            }
        }

        return Object.entries(summary).map(([fuelType, data]) => ({
            fuelType,
            ...data
        }));
    };

    const meterSummary = getMeterSummaryByFuel();
    const totalMeterLiters = meterSummary.reduce((sum, m) => sum + m.liters, 0);
    const totalMeterAmount = meterSummary.reduce((sum, m) => sum + m.amount, 0);
    const totalSalesLiters = salesData.reduce((sum, s) => sum + s.liters, 0);
    const totalSalesAmount = salesData.reduce((sum, s) => sum + s.amount, 0);

    if (!station) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
                <div className="text-white text-xl">ไม่พบสถานี</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white">
            {/* Header */}
            <div className="bg-black/30 backdrop-blur-sm sticky top-0 z-10">
                <div className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                        <Link href={`/simple-station/${id}/new/home`} className="p-2 hover:bg-white/10 rounded-lg">
                            <ArrowLeft size={24} />
                        </Link>
                        <div>
                            <div className="text-sm text-gray-400">สรุปมิเตอร์</div>
                            <h1 className="font-bold text-lg">{station.name}</h1>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Calendar size={18} className="text-gray-400" />
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm"
                        />
                    </div>
                </div>
            </div>

            <div className="p-4 space-y-4">
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="animate-spin h-8 w-8 border-4 border-purple-500 border-t-transparent rounded-full"></div>
                    </div>
                ) : (
                    <>
                        {/* Overview Cards */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/20 rounded-xl p-4 border border-blue-500/30">
                                <div className="flex items-center gap-2 text-blue-300 text-sm mb-1">
                                    <Fuel size={16} />
                                    <span>ยอดมิเตอร์</span>
                                </div>
                                <div className="text-2xl font-bold">{formatNumber(totalMeterLiters)} ลิตร</div>
                                <div className="text-sm text-gray-400">{formatNumber(totalMeterAmount)} ฿</div>
                            </div>
                            <div className="bg-gradient-to-br from-green-500/20 to-green-600/20 rounded-xl p-4 border border-green-500/30">
                                <div className="flex items-center gap-2 text-green-300 text-sm mb-1">
                                    <TrendingUp size={16} />
                                    <span>ยอดขายในระบบ</span>
                                </div>
                                <div className="text-2xl font-bold">{formatNumber(totalSalesLiters)} ลิตร</div>
                                <div className="text-sm text-gray-400">{formatNumber(totalSalesAmount)} ฿</div>
                            </div>
                        </div>

                        {/* Difference Alert */}
                        {Math.abs(totalMeterLiters - totalSalesLiters) > 1 && (
                            <div className="bg-yellow-500/20 border border-yellow-500/30 rounded-xl p-4 flex items-center gap-3">
                                <AlertTriangle className="text-yellow-400" size={24} />
                                <div>
                                    <div className="font-bold text-yellow-300">ยอดไม่ตรงกัน!</div>
                                    <div className="text-sm text-gray-300">
                                        ต่างกัน {formatNumber(Math.abs(totalMeterLiters - totalSalesLiters))} ลิตร
                                        ({totalMeterLiters > totalSalesLiters ? 'มิเตอร์มากกว่า' : 'ขายมากกว่า'})
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Summary by Fuel Type */}
                        <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
                            <div className="p-3 border-b border-white/10 bg-white/5">
                                <h2 className="font-bold">สรุปตามประเภทน้ำมัน</h2>
                            </div>
                            <div className="divide-y divide-white/10">
                                {meterSummary.length === 0 ? (
                                    <div className="p-6 text-center text-gray-400">ไม่มีข้อมูลมิเตอร์</div>
                                ) : (
                                    meterSummary.map((item) => {
                                        const salesItem = salesData.find(s => s.fuelType === item.fuelType);
                                        const diff = item.liters - (salesItem?.liters || 0);
                                        return (
                                            <div key={item.fuelType} className="p-3 flex items-center justify-between">
                                                <div>
                                                    <div className="font-medium">{item.fuelType}</div>
                                                    <div className="text-sm text-gray-400">{item.count} หัวจ่าย</div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="font-bold">{formatNumber(item.liters)} ลิตร</div>
                                                    <div className={`text-sm ${Math.abs(diff) > 0.5 ? 'text-yellow-400' : 'text-green-400'}`}>
                                                        {diff > 0 ? '+' : ''}{formatNumber(diff)} ต่างจากขาย
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>

                        {/* Shift Details */}
                        {shifts.map((shift) => (
                            <div key={shift.shiftId} className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
                                <div className="p-3 border-b border-white/10 bg-white/5 flex items-center justify-between">
                                    <div>
                                        <h3 className="font-bold">กะที่ {shift.shiftNumber}</h3>
                                        <div className="text-sm text-gray-400">{shift.staffName}</div>
                                    </div>
                                    <div className={`px-2 py-1 rounded text-xs ${shift.status === 'OPEN' ? 'bg-green-500/20 text-green-300' : 'bg-gray-500/20 text-gray-300'
                                        }`}>
                                        {shift.status === 'OPEN' ? 'เปิดอยู่' : 'ปิดแล้ว'}
                                    </div>
                                </div>

                                {/* Meter readings table */}
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-white/5">
                                            <tr>
                                                <th className="px-3 py-2 text-left">หัว</th>
                                                <th className="px-3 py-2 text-left">ประเภท</th>
                                                <th className="px-3 py-2 text-right">เปิด</th>
                                                <th className="px-3 py-2 text-right">ปิด</th>
                                                <th className="px-3 py-2 text-right">ลิตร</th>
                                                <th className="px-3 py-2 text-right">เงิน</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {shift.meters.filter(m => m.liters > 0).map((meter) => (
                                                <tr key={meter.nozzle} className="hover:bg-white/5">
                                                    <td className="px-3 py-2">{meter.nozzle}</td>
                                                    <td className="px-3 py-2">{meter.fuelType}</td>
                                                    <td className="px-3 py-2 text-right font-mono">{formatNumber(meter.startReading)}</td>
                                                    <td className="px-3 py-2 text-right font-mono">{formatNumber(meter.endReading)}</td>
                                                    <td className="px-3 py-2 text-right font-bold text-blue-300">{formatNumber(meter.liters)}</td>
                                                    <td className="px-3 py-2 text-right text-green-300">{formatNumber(meter.amount)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot className="bg-white/10 font-bold">
                                            <tr>
                                                <td colSpan={4} className="px-3 py-2 text-right">รวม</td>
                                                <td className="px-3 py-2 text-right text-blue-300">{formatNumber(shift.totalLiters)}</td>
                                                <td className="px-3 py-2 text-right text-green-300">{formatNumber(shift.totalAmount)}</td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </div>
                        ))}

                        {shifts.length === 0 && (
                            <div className="bg-white/5 rounded-xl p-8 text-center text-gray-400">
                                <Fuel size={48} className="mx-auto mb-3 opacity-50" />
                                <div>ไม่มีข้อมูลกะสำหรับวันที่เลือก</div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
