'use client';

import { useState } from 'react';
import { X, Save, Info } from 'lucide-react';

interface AdminSettingsModalProps {
    stationId: string;
    date: string;
    retailPrice: number;
    wholesalePrice: number;
    specialPrice?: number;
    onClose: () => void;
    onSave: () => void;
}

export default function AdminSettingsModal({
    stationId,
    date,
    retailPrice: initialRetailPrice,
    wholesalePrice: initialWholesalePrice,
    specialPrice: initialSpecialPrice,
    onClose,
    onSave,
}: AdminSettingsModalProps) {
    const [retailPrice, setRetailPrice] = useState(initialRetailPrice.toFixed(2));
    const [wholesalePrice, setWholesalePrice] = useState(initialWholesalePrice.toFixed(2));
    const [specialPrice, setSpecialPrice] = useState(initialSpecialPrice?.toFixed(2) || '');
    const [saving, setSaving] = useState(false);

    // Format to 2 decimal places on blur
    const formatPrice = (value: string, setter: (v: string) => void) => {
        const num = parseFloat(value);
        if (!isNaN(num)) {
            setter(num.toFixed(2));
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetch(`/api/station/${stationId}/daily`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date,
                    retailPrice: parseFloat(retailPrice) || 0,
                    wholesalePrice: parseFloat(wholesalePrice) || 0,
                    specialPrice: specialPrice ? parseFloat(specialPrice) : null,
                }),
            });

            if (res.ok) {
                onSave();
                onClose();
            } else {
                const err = await res.json();
                alert(err.error || 'บันทึกไม่สำเร็จ');
            }
        } catch (error) {
            console.error('Save error:', error);
            alert('เกิดข้อผิดพลาด');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
            <div className="bg-white w-full sm:w-[420px] rounded-t-2xl sm:rounded-2xl overflow-hidden animate-slide-up shadow-2xl">
                {/* Header */}
                <div className="px-4 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white flex items-center justify-between">
                    <div>
                        <h2 className="font-bold text-lg">⛽ ตั้งราคาน้ำมันประจำวัน</h2>
                        <p className="text-blue-100 text-sm">{date}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition">
                        <X size={22} />
                    </button>
                </div>

                {/* Info Banner */}
                <div className="mx-4 mt-4 p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-2">
                    <Info size={18} className="text-blue-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-blue-700">
                        <p className="font-semibold">วิธีใช้งาน:</p>
                        <ul className="list-disc list-inside text-xs mt-1 space-y-0.5">
                            <li><strong>เงินเชื่อ</strong> จะใช้ราคาปลีกเสมอ</li>
                            <li><strong>ราคาส่ง</strong> สำหรับรถตู้ทึบ/รถน้ำมัน</li>
                            <li><strong>ราคาพิเศษ</strong> กรอกเมื่อมีโปรโมชั่น</li>
                        </ul>
                    </div>
                </div>

                {/* Body */}
                <div className="p-4 space-y-4">
                    {/* Retail Price (สำหรับเงินสด & เงินเชื่อ) */}
                    <div>
                        <label className="text-sm font-semibold text-gray-700 block mb-2">
                            💵 ราคาปลีก <span className="font-normal text-gray-500">(เงินสด / เงินเชื่อ / โอน)</span>
                        </label>
                        <div className="relative">
                            <input
                                type="number"
                                value={retailPrice}
                                onChange={e => setRetailPrice(e.target.value)}
                                onBlur={() => formatPrice(retailPrice, setRetailPrice)}
                                step="0.01"
                                min="0"
                                placeholder="0.00"
                                className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl text-2xl font-mono text-right focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition"
                            />
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">บาท/ลิตร</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">* เงินเชื่อจะใช้ราคานี้โดยอัตโนมัติ</p>
                    </div>

                    {/* Wholesale Price (สำหรับรถตู้ทึบ) */}
                    <div>
                        <label className="text-sm font-semibold text-gray-700 block mb-2">
                            🚚 ราคาส่ง <span className="font-normal text-gray-500">(รถตู้ทึบ / รถน้ำมัน)</span>
                        </label>
                        <div className="relative">
                            <input
                                type="number"
                                value={wholesalePrice}
                                onChange={e => setWholesalePrice(e.target.value)}
                                onBlur={() => formatPrice(wholesalePrice, setWholesalePrice)}
                                step="0.01"
                                min="0"
                                placeholder="0.00"
                                className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl text-2xl font-mono text-right focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 transition"
                            />
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">บาท/ลิตร</span>
                        </div>
                    </div>

                    {/* Special Price (ราคาพิเศษ) */}
                    <div>
                        <label className="text-sm font-semibold text-gray-700 block mb-2">
                            ⭐ ราคาพิเศษ <span className="font-normal text-gray-500">(โปรโมชั่น - ไม่บังคับ)</span>
                        </label>
                        <div className="relative">
                            <input
                                type="number"
                                value={specialPrice}
                                onChange={e => setSpecialPrice(e.target.value)}
                                onBlur={() => specialPrice && formatPrice(specialPrice, setSpecialPrice)}
                                step="0.01"
                                min="0"
                                placeholder="ไม่ระบุ"
                                className="w-full px-4 py-3.5 border-2 border-dashed border-gray-200 rounded-xl text-2xl font-mono text-right focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100 transition"
                            />
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">บาท/ลิตร</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">* เว้นว่างถ้าไม่มีราคาพิเศษ</p>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-200 bg-gray-50">
                    <button
                        onClick={handleSave}
                        disabled={saving || !retailPrice || !wholesalePrice}
                        className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-bold text-lg hover:from-blue-700 hover:to-blue-800 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg"
                    >
                        {saving ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                กำลังบันทึก...
                            </>
                        ) : (
                            <>
                                <Save size={20} />
                                บันทึกราคาวันนี้
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}

