'use client';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import { Save, Settings, DollarSign, Fuel, FileText, RefreshCw, Sparkles } from 'lucide-react';

interface SettingsData {
    // Diesel prices
    defaultRetailPrice: string;
    defaultWholesalePrice: string;
    pricePowerDiesel: string;
    // Benzin & Gasohol prices
    priceBenzin95: string;
    priceGasohol95: string;
    priceGasohol91: string;
    priceGasoholE20: string;
    // Gas price
    defaultGasPrice: string;
    // Station settings
    kgToLitersRate: string;
    tankCapacityPerPercent: string;
    gasStockAlertLevel: string;
    billingDueDays: string;
}

export default function SettingsPage() {
    const [settings, setSettings] = useState<SettingsData>({
        defaultRetailPrice: '31.34',
        defaultWholesalePrice: '30.50',
        pricePowerDiesel: '37.50',
        priceBenzin95: '42.16',
        priceGasohol95: '34.88',
        priceGasohol91: '34.38',
        priceGasoholE20: '32.84',
        defaultGasPrice: '15.50',
        kgToLitersRate: '1.85',
        tankCapacityPerPercent: '98',
        gasStockAlertLevel: '1000',
        billingDueDays: '15,30',
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => {
        setMounted(true);
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/settings');
            if (res.ok) {
                const data = await res.json();
                setSettings(data);
            }
        } catch (error) {
            console.error('Error fetching settings:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        setMessage(null);
        try {
            const res = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings),
            });
            if (res.ok) {
                setMessage({ type: 'success', text: 'บันทึกการตั้งค่าเรียบร้อยแล้ว!' });
            } else {
                setMessage({ type: 'error', text: 'ไม่สามารถบันทึกได้' });
            }
        } catch (error) {
            console.error('Error saving settings:', error);
            setMessage({ type: 'error', text: 'เกิดข้อผิดพลาด' });
        } finally {
            setSaving(false);
        }
    };

    const updateSetting = (key: keyof SettingsData, value: string) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    if (loading) {
        return (
            <Sidebar>
                <div className="flex items-center justify-center min-h-[60vh]">
                    <div className="text-center">
                        <div className="w-12 h-12 mx-auto rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mb-4">
                            <RefreshCw className="animate-spin h-6 w-6 text-white" />
                        </div>
                        <p className="text-gray-400">กำลังโหลด...</p>
                    </div>
                </div>
            </Sidebar>
        );
    }

    return (
        <Sidebar>
            <div className="max-w-4xl mx-auto relative">
                {/* Background orbs */}
                <div className="fixed top-20 right-20 w-[400px] h-[400px] rounded-full opacity-20 blur-3xl pointer-events-none"
                    style={{ background: 'radial-gradient(circle, rgba(168, 85, 247, 0.3) 0%, transparent 70%)' }} />

                {/* Header */}
                <div className={`flex items-center justify-between mb-8 transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
                    <div className="flex items-center gap-4">
                        <div className="relative">
                            <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl blur-lg opacity-50" />
                            <div className="relative p-3 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500">
                                <Settings className="h-8 w-8 text-white" />
                            </div>
                        </div>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-white via-purple-200 to-white bg-clip-text text-transparent">
                                ตั้งค่าระบบ
                            </h1>
                            <p className="text-gray-400 flex items-center gap-2">
                                <Sparkles size={14} className="text-purple-400" />
                                System Settings
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="relative group px-6 py-3 rounded-xl font-semibold text-white overflow-hidden disabled:opacity-50"
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-green-600 via-emerald-500 to-green-600" />
                        <div className="absolute inset-0 bg-gradient-to-r from-green-600 via-emerald-500 to-green-600 blur-xl opacity-50 group-hover:opacity-70 transition-opacity" />
                        <span className="relative flex items-center gap-2">
                            {saving ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} />}
                            {saving ? 'กำลังบันทึก...' : 'บันทึกทั้งหมด'}
                        </span>
                    </button>
                </div>

                {/* Message */}
                {message && (
                    <div className={`mb-6 p-4 rounded-2xl backdrop-blur-xl border ${message.type === 'success'
                        ? 'bg-green-500/10 border-green-500/30 text-green-400'
                        : 'bg-red-500/10 border-red-500/30 text-red-400'
                        }`}>
                        {message.text}
                    </div>
                )}

                <div className="space-y-6">
                    {/* Price Settings */}
                    <div className={`backdrop-blur-xl rounded-2xl border border-white/10 p-6 transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
                        style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)', transitionDelay: '100ms' }}>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2.5 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500">
                                <DollarSign className="text-white" size={22} />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-white">ราคาน้ำมันเริ่มต้น</h2>
                                <p className="text-sm text-gray-400">ราคาที่จะใช้เป็นค่าเริ่มต้นเมื่อสร้างรายการใหม่</p>
                            </div>
                        </div>

                        {/* Diesel Group */}
                        <h3 className="text-sm font-semibold text-amber-400 mb-3 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                            ดีเซล
                        </h3>
                        <div className="grid md:grid-cols-3 gap-4 mb-6">
                            <div>
                                <label className="block text-sm text-gray-400 mb-2">ดีเซล (ปลีก/เชื่อ)</label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={settings.defaultRetailPrice}
                                        onChange={(e) => updateSetting('defaultRetailPrice', e.target.value)}
                                        className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-center font-mono focus:outline-none focus:border-amber-500/50 transition-all duration-300"
                                    />
                                    <span className="text-gray-400 text-sm">บาท</span>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-2">ดีเซล (ส่ง/สด)</label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={settings.defaultWholesalePrice}
                                        onChange={(e) => updateSetting('defaultWholesalePrice', e.target.value)}
                                        className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-center font-mono focus:outline-none focus:border-amber-500/50 transition-all duration-300"
                                    />
                                    <span className="text-gray-400 text-sm">บาท</span>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-2">พาวเวอร์ดีเซล</label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={settings.pricePowerDiesel}
                                        onChange={(e) => updateSetting('pricePowerDiesel', e.target.value)}
                                        className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-center font-mono focus:outline-none focus:border-purple-500/50 transition-all duration-300"
                                    />
                                    <span className="text-gray-400 text-sm">บาท</span>
                                </div>
                            </div>
                        </div>

                        {/* Benzin & Gasohol Group */}
                        <h3 className="text-sm font-semibold text-green-400 mb-3 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-green-500"></span>
                            เบนซิน & แก๊สโซฮอล์
                        </h3>
                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <div>
                                <label className="block text-sm text-gray-400 mb-2">เบนซิน 95 (บาท)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={settings.priceBenzin95}
                                    onChange={(e) => updateSetting('priceBenzin95', e.target.value)}
                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-center font-mono focus:outline-none focus:border-red-500/50 transition-all duration-300"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-2">แก๊สโซฮอล์ 95 (บาท)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={settings.priceGasohol95}
                                    onChange={(e) => updateSetting('priceGasohol95', e.target.value)}
                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-center font-mono focus:outline-none focus:border-green-500/50 transition-all duration-300"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-2">แก๊สโซฮอล์ 91 (บาท)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={settings.priceGasohol91}
                                    onChange={(e) => updateSetting('priceGasohol91', e.target.value)}
                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-center font-mono focus:outline-none focus:border-blue-500/50 transition-all duration-300"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-2">แก๊สโซฮอล์ E20 (บาท)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={settings.priceGasoholE20}
                                    onChange={(e) => updateSetting('priceGasoholE20', e.target.value)}
                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-center font-mono focus:outline-none focus:border-teal-500/50 transition-all duration-300"
                                />
                            </div>
                        </div>

                        {/* LPG Group */}
                        <h3 className="text-sm font-semibold text-cyan-400 mb-3 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-cyan-500"></span>
                            แก๊ส LPG
                        </h3>
                        <div className="grid md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm text-gray-400 mb-2">ราคาแก๊ส LPG</label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={settings.defaultGasPrice}
                                        onChange={(e) => updateSetting('defaultGasPrice', e.target.value)}
                                        className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-center font-mono focus:outline-none focus:border-cyan-500/50 transition-all duration-300"
                                    />
                                    <span className="text-gray-400 text-sm">บาท/ลิตร</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Gas Station Settings */}
                    <div className={`backdrop-blur-xl rounded-2xl border border-white/10 p-6 transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
                        style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)', transitionDelay: '200ms' }}>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2.5 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500">
                                <Fuel className="text-white" size={22} />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-white">ตั้งค่าปั๊มแก๊ส</h2>
                                <p className="text-sm text-gray-400">ค่าคำนวณสำหรับสถานี LPG</p>
                            </div>
                        </div>
                        <div className="grid md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm text-gray-400 mb-2">อัตราแปลง กก. → ลิตร</label>
                                <div className="flex items-center gap-2">
                                    <span className="text-cyan-400 font-bold">×</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={settings.kgToLitersRate}
                                        onChange={(e) => updateSetting('kgToLitersRate', e.target.value)}
                                        className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-center font-mono focus:outline-none focus:border-cyan-500/50 transition-all duration-300"
                                    />
                                </div>
                                <p className="text-xs text-gray-500 mt-1">ตัวอย่าง: 1000 กก. × 1.85 = 1850 ลิตร</p>
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-2">ความจุต่อ 1% ของถัง</label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        step="1"
                                        value={settings.tankCapacityPerPercent}
                                        onChange={(e) => updateSetting('tankCapacityPerPercent', e.target.value)}
                                        className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-center font-mono focus:outline-none focus:border-cyan-500/50 transition-all duration-300"
                                    />
                                    <span className="text-gray-400 text-sm">ลิตร</span>
                                </div>
                                <p className="text-xs text-gray-500 mt-1">ตัวอย่าง: (50%+30%+20%) × 98 = 9800 ลิตร</p>
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-2">เตือนเมื่อสต็อกต่ำกว่า</label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        step="100"
                                        value={settings.gasStockAlertLevel}
                                        onChange={(e) => updateSetting('gasStockAlertLevel', e.target.value)}
                                        className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-center font-mono focus:outline-none focus:border-orange-500/50 transition-all duration-300"
                                    />
                                    <span className="text-gray-400 text-sm">ลิตร</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Billing Settings */}
                    <div className={`backdrop-blur-xl rounded-2xl border border-white/10 p-6 transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
                        style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)', transitionDelay: '300ms' }}>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2.5 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500">
                                <FileText className="text-white" size={22} />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-white">ตั้งค่าการวางบิล</h2>
                                <p className="text-sm text-gray-400">กำหนดวันครบกำหนดชำระ</p>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm text-gray-400 mb-2">วันครบกำหนดชำระ (คั่นด้วยเครื่องหมาย ,)</label>
                            <input
                                type="text"
                                value={settings.billingDueDays}
                                onChange={(e) => updateSetting('billingDueDays', e.target.value)}
                                className="w-full md:w-1/2 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white font-mono focus:outline-none focus:border-purple-500/50 transition-all duration-300"
                                placeholder="เช่น 15,30"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                ตัวอย่าง: &quot;15,30&quot; หมายถึงครบกำหนดทุกวันที่ 15 และ 30 ของเดือน
                            </p>
                        </div>
                    </div>

                    {/* Info Card */}
                    <div className={`backdrop-blur-xl rounded-2xl border border-blue-500/30 p-6 transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
                        style={{ background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(59, 130, 246, 0.05) 100%)', transitionDelay: '400ms' }}>
                        <h3 className="font-bold text-blue-400 mb-3 flex items-center gap-2">
                            💡 ข้อมูลเพิ่มเติม
                        </h3>
                        <ul className="text-sm text-gray-400 space-y-2">
                            <li className="flex items-start gap-2">
                                <span className="text-blue-400">•</span>
                                การเปลี่ยนราคาเริ่มต้นจะมีผลกับรายการใหม่เท่านั้น ไม่กระทบรายการเก่า
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-blue-400">•</span>
                                อัตราแปลง กก.→ลิตร ใช้สำหรับการรับแก๊สเข้าสต็อก
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-blue-400">•</span>
                                ความจุถังใช้สำหรับเทียบยอดสต็อกกับเกจที่อ่านได้
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </Sidebar>
    );
}
