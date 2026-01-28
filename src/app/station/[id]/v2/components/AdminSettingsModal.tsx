'use client';

import { useState } from 'react';
import { X, Save } from 'lucide-react';

interface AdminSettingsModalProps {
    stationId: string;
    date: string;
    retailPrice: number;
    wholesalePrice: number;
    onClose: () => void;
    onSave: () => void;
}

export default function AdminSettingsModal({
    stationId,
    date,
    retailPrice: initialRetailPrice,
    wholesalePrice: initialWholesalePrice,
    onClose,
    onSave,
}: AdminSettingsModalProps) {
    const [retailPrice, setRetailPrice] = useState(initialRetailPrice.toString());
    const [wholesalePrice, setWholesalePrice] = useState(initialWholesalePrice.toString());
    const [saving, setSaving] = useState(false);

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
            <div className="bg-white w-full sm:w-96 rounded-t-2xl sm:rounded-2xl overflow-hidden animate-slide-up">
                {/* Header */}
                <div className="px-4 py-4 border-b border-gray-200 flex items-center justify-between">
                    <h2 className="font-bold text-lg text-gray-800">⚙️ ตั้งค่าราคาน้ำมัน</h2>
                    <button onClick={onClose} className="p-1">
                        <X size={24} className="text-gray-500" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-4 space-y-4">
                    {/* Retail Price */}
                    <div>
                        <label className="text-sm text-gray-600 block mb-1">
                            💵 ราคาขายปลีก (เงินสด)
                        </label>
                        <input
                            type="number"
                            value={retailPrice}
                            onChange={e => setRetailPrice(e.target.value)}
                            step="0.01"
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-xl font-mono text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    {/* Wholesale Price */}
                    <div>
                        <label className="text-sm text-gray-600 block mb-1">
                            📝 ราคาขายส่ง (เงินเชื่อ)
                        </label>
                        <input
                            type="number"
                            value={wholesalePrice}
                            onChange={e => setWholesalePrice(e.target.value)}
                            step="0.01"
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-xl font-mono text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-200">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="w-full py-3.5 bg-blue-500 text-white rounded-xl font-bold hover:bg-blue-600 transition disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {saving ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                กำลังบันทึก...
                            </>
                        ) : (
                            <>
                                <Save size={20} />
                                บันทึกราคา
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
