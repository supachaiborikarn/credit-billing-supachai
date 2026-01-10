'use client';

import { useEffect, useState } from 'react';
import { Loader2, Settings, Save, AlertCircle, CheckCircle } from 'lucide-react';
import { formatCurrency } from '@/lib/gas';

interface SettingItem {
    key: string;
    value: string;
    isDefault: boolean;
    label: string;
    description: string;
    updatedAt?: string;
}

const SETTING_CONFIG: Record<string, { label: string; description: string; unit: string }> = {
    gasPrice: { label: 'ราคาแก๊ส', description: 'ราคาต่อลิตร (ใช้กับทุกปั๊ม)', unit: 'บาท/ลิตร' },
    tankCapacity: { label: 'ความจุต่อถัง', description: 'ความจุถังแก๊สแต่ละถัง', unit: 'ลิตร' },
    tankCount: { label: 'จำนวนถัง', description: 'จำนวนถังแก๊สต่อปั๊ม', unit: 'ถัง' },
    alertLowGauge: { label: 'แจ้งเตือนเกจต่ำ', description: 'เปอร์เซ็นต์ที่แจ้งเตือนเกจต่ำ', unit: '%' },
    alertCriticalGauge: { label: 'แจ้งเตือนวิกฤต', description: 'เปอร์เซ็นต์ที่แจ้งเตือนวิกฤต', unit: '%' }
};

export default function AdminSettingsPage() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null);
    const [settings, setSettings] = useState<SettingItem[]>([]);
    const [editValues, setEditValues] = useState<Record<string, string>>({});
    const [success, setSuccess] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const res = await fetch('/api/v2/gas/settings');
            if (res.ok) {
                const data = await res.json();
                const items: SettingItem[] = [];
                for (const [key, info] of Object.entries(data.settings || {})) {
                    const config = SETTING_CONFIG[key];
                    if (config) {
                        items.push({
                            key,
                            value: (info as { value: string }).value,
                            isDefault: (info as { isDefault: boolean }).isDefault,
                            label: config.label,
                            description: config.description,
                            updatedAt: (info as { updatedAt?: string }).updatedAt
                        });
                    }
                }
                setSettings(items);

                // Initialize edit values
                const values: Record<string, string> = {};
                items.forEach(s => { values[s.key] = s.value; });
                setEditValues(values);
            }
        } catch (err) {
            console.error('Error fetching settings:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (key: string) => {
        setSaving(key);
        setError(null);
        setSuccess(null);

        try {
            const res = await fetch('/api/v2/gas/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key, value: editValues[key] })
            });

            if (res.ok) {
                setSuccess(key);
                fetchSettings();
                setTimeout(() => setSuccess(null), 3000);
            } else {
                const data = await res.json();
                setError(data.error || 'ไม่สามารถบันทึกได้');
            }
        } catch (err) {
            setError('เกิดข้อผิดพลาด');
        } finally {
            setSaving(null);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="animate-spin text-purple-400" size={40} />
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Settings className="text-purple-400" />
                    ตั้งค่าปั๊มแก๊ส
                </h1>
                <p className="text-gray-400">ค่าเหล่านี้ใช้ร่วมกันทุกปั๊ม</p>
            </div>

            {/* Error */}
            {error && (
                <div className="bg-red-900/30 border border-red-500/30 rounded-xl p-4 flex items-center gap-2 text-red-400">
                    <AlertCircle size={20} />
                    {error}
                </div>
            )}

            {/* Settings */}
            <div className="space-y-4">
                {settings.map((setting) => {
                    const config = SETTING_CONFIG[setting.key];
                    const hasChanged = editValues[setting.key] !== setting.value;
                    const isSaved = success === setting.key;

                    return (
                        <div
                            key={setting.key}
                            className={`bg-[#1a1a24] rounded-xl p-4 border transition-colors ${isSaved ? 'border-green-500/50' : 'border-white/10'
                                }`}
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                    <label className="font-medium">{setting.label}</label>
                                    <p className="text-sm text-gray-400">{setting.description}</p>
                                    {setting.isDefault && (
                                        <span className="text-xs text-yellow-500">(ค่าเริ่มต้น)</span>
                                    )}
                                    {setting.updatedAt && !setting.isDefault && (
                                        <span className="text-xs text-gray-500">
                                            อัพเดทล่าสุด: {new Date(setting.updatedAt).toLocaleDateString('th-TH')}
                                        </span>
                                    )}
                                </div>

                                <div className="flex items-center gap-2">
                                    <div className="relative">
                                        <input
                                            type="number"
                                            value={editValues[setting.key] || ''}
                                            onChange={(e) => setEditValues({
                                                ...editValues,
                                                [setting.key]: e.target.value
                                            })}
                                            className="w-32 bg-gray-800 border border-white/10 rounded-lg px-3 py-2 text-right font-mono focus:border-purple-500 focus:outline-none"
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs pointer-events-none">
                                            {config?.unit}
                                        </span>
                                    </div>

                                    <button
                                        onClick={() => handleSave(setting.key)}
                                        disabled={!hasChanged || saving === setting.key}
                                        className={`p-2 rounded-lg transition-colors ${hasChanged
                                                ? 'bg-purple-600 hover:bg-purple-500 text-white'
                                                : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                            }`}
                                    >
                                        {saving === setting.key ? (
                                            <Loader2 className="animate-spin" size={18} />
                                        ) : isSaved ? (
                                            <CheckCircle size={18} className="text-green-400" />
                                        ) : (
                                            <Save size={18} />
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Gas Price Highlight */}
            <div className="bg-gradient-to-r from-orange-900/30 to-red-900/30 rounded-xl p-6 border border-orange-500/30">
                <div className="flex items-center justify-between">
                    <div>
                        <div className="text-orange-400 text-sm">ราคาแก๊สปัจจุบัน</div>
                        <div className="text-3xl font-bold text-white">
                            ฿{formatCurrency(parseFloat(editValues['gasPrice'] || '16.09'))} / ลิตร
                        </div>
                    </div>
                    <div className="text-6xl">⛽</div>
                </div>
            </div>
        </div>
    );
}
