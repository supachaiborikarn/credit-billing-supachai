'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { Play, Fuel, RefreshCw, Check } from 'lucide-react';
import { STATIONS, FUEL_TYPES } from '@/constants';

export default function OpenShiftPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const stationIndex = parseInt(id) - 1;
    const station = STATIONS[stationIndex];
    const stationId = `station-${id}`;
    const router = useRouter();

    const [loading, setLoading] = useState(false);
    const [fuelPrices, setFuelPrices] = useState<Record<string, string>>({});

    // Load last fuel prices
    useEffect(() => {
        const loadPrices = async () => {
            try {
                const res = await fetch(`/api/station/${id}/fuel-prices`);
                if (res.ok) {
                    const data = await res.json();
                    const prices: Record<string, string> = {};
                    (data.prices || []).forEach((p: { fuelType: string; price: number }) => {
                        prices[p.fuelType] = p.price.toString();
                    });
                    setFuelPrices(prices);
                }
            } catch (error) {
                console.error('Error loading prices:', error);
            }
        };
        loadPrices();
    }, [stationId]);

    const handleOpenShift = async () => {
        // Validate prices
        const hasAnyPrice = Object.values(fuelPrices).some(p => p && parseFloat(p) > 0);
        if (!hasAnyPrice) {
            alert('กรุณาใส่ราคาน้ำมันอย่างน้อย 1 ประเภท');
            return;
        }

        setLoading(true);
        try {
            // Save fuel prices
            const pricesArray = Object.entries(fuelPrices)
                .filter(([_, price]) => price && parseFloat(price) > 0)
                .map(([fuelType, price]) => ({ fuelType, price: parseFloat(price) }));

            await fetch(`/api/station/${id}/fuel-prices`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prices: pricesArray }),
            });

            // Open new shift
            const res = await fetch(`/api/station/${id}/shifts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'open',
                }),
            });

            if (res.ok) {
                router.replace(`/simple-station/${id}/new/home`);
            } else {
                const err = await res.json();
                alert(err.error || 'ไม่สามารถเปิดกะได้');
            }
        } catch (error) {
            console.error('Error opening shift:', error);
            alert('เกิดข้อผิดพลาด');
        } finally {
            setLoading(false);
        }
    };

    if (!station) {
        return <div className="p-4 text-gray-500">ไม่พบสถานี</div>;
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                        <Play size={40} className="text-white ml-1" />
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-2">เปิดกะใหม่</h1>
                    <p className="text-gray-400">{station.name}</p>
                    <p className="text-gray-500 text-sm mt-1">
                        {new Date().toLocaleDateString('th-TH', {
                            weekday: 'long',
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                        })}
                    </p>
                </div>

                {/* Fuel Prices Form */}
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 mb-6">
                    <div className="flex items-center gap-2 mb-4">
                        <Fuel size={20} className="text-orange-400" />
                        <h2 className="text-white font-semibold">ตั้งราคาน้ำมันวันนี้</h2>
                    </div>

                    <div className="space-y-3">
                        {FUEL_TYPES.slice(0, 6).map(fuel => (
                            <div key={fuel.value} className="flex items-center gap-3">
                                <span className="text-gray-300 w-28 text-sm">{fuel.label}</span>
                                <div className="flex-1 relative">
                                    <input
                                        type="number"
                                        step="0.01"
                                        placeholder="0.00"
                                        value={fuelPrices[fuel.value] || ''}
                                        onChange={(e) => setFuelPrices(prev => ({
                                            ...prev,
                                            [fuel.value]: e.target.value
                                        }))}
                                        className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-orange-400 text-right"
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">฿</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Open Shift Button */}
                <button
                    onClick={handleOpenShift}
                    disabled={loading}
                    className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-xl text-lg flex items-center justify-center gap-3 hover:from-green-600 hover:to-emerald-700 disabled:opacity-50 shadow-lg"
                >
                    {loading ? (
                        <>
                            <RefreshCw size={24} className="animate-spin" />
                            กำลังเปิดกะ...
                        </>
                    ) : (
                        <>
                            <Check size={24} />
                            ยืนยันเปิดกะ
                        </>
                    )}
                </button>

                <p className="text-center text-gray-500 text-sm mt-4">
                    กรุณาใส่ราคาน้ำมันก่อนเปิดกะ
                </p>
            </div>
        </div>
    );
}
