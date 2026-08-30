'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle, Loader2, Save, Settings } from 'lucide-react';
import { formatCurrency } from '@/lib/gas';

interface GasFallbackSetting {
    key: 'gasPrice';
    value: string;
    isDefault: boolean;
    updatedAt?: string;
}

export default function AdminSettingsPage() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [setting, setSetting] = useState<GasFallbackSetting | null>(null);
    const [value, setValue] = useState('');
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch('/api/v2/gas/settings?key=gasPrice', { cache: 'no-store' });
            const payload = await response.json().catch(() => null);
            if (!response.ok || !payload) throw new Error(payload?.error || 'โหลดราคา fallback ไม่สำเร็จ');
            setSetting(payload);
            setValue(payload.value);
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : 'โหลดราคา fallback ไม่สำเร็จ');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void load(); }, [load]);

    const save = async () => {
        const parsed = Number(value);
        if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 1000) {
            setError('ราคา fallback ต้องมากกว่า 0 และไม่เกิน 1,000 บาท/ลิตร');
            return;
        }
        setSaving(true);
        setError(null);
        setSuccess(false);
        try {
            const response = await fetch('/api/v2/gas/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: 'gasPrice', value: parsed }),
            });
            const payload = await response.json().catch(() => null);
            if (!response.ok || !payload) throw new Error(payload?.error || 'บันทึกราคา fallback ไม่สำเร็จ');
            setSetting(payload);
            setValue(payload.value);
            setSuccess(true);
        } catch (saveError) {
            setError(saveError instanceof Error ? saveError.message : 'บันทึกราคา fallback ไม่สำเร็จ');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div className="flex min-h-[320px] items-center justify-center"><Loader2 className="animate-spin" size={36} /></div>;
    }

    const hasChanged = Boolean(setting && value !== setting.value);
    return (
        <div className="mx-auto max-w-2xl space-y-6">
            <div>
                <h1 className="flex items-center gap-2 text-2xl font-bold"><Settings aria-hidden="true" /> ตั้งค่า GAS fallback</h1>
                <p className="mt-1 text-sm text-gray-400">ใช้เฉพาะเมื่อวันนั้นและสถานีนั้นยังไม่มีราคาที่กำหนดไว้</p>
            </div>

            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
                ลำดับราคาของระบบคือ <strong>ราคาประจำวัน → ราคาหลักของสถานี → fallback นี้ → ค่าโปรแกรม 16.09</strong> การแก้ค่านี้ไม่เปลี่ยนราคาของรายการขายหรือ DailyRecord ที่มีอยู่แล้ว
            </div>

            {error && <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300"><AlertCircle size={20} aria-hidden="true" />{error}</div>}
            {success && <div className="flex items-center gap-2 rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-green-300"><CheckCircle size={20} aria-hidden="true" />บันทึกราคา fallback แล้ว พร้อม Audit Log</div>}

            <div className="rounded-xl border border-white/10 bg-[#1a1a24] p-5">
                <label className="block text-sm font-semibold">ราคา fallback (บาท/ลิตร)</label>
                <p className="mt-1 text-sm text-gray-400">ไม่ใช่ราคาที่บังคับใช้ทุกปั๊ม ให้กำหนดราคาจริงของแต่ละสถานีจากหน้า Operations</p>
                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                    <input
                        type="number" min="0.01" max="1000" step="0.01" inputMode="decimal"
                        value={value}
                        onChange={(event) => setValue(event.target.value)}
                        className="min-h-11 flex-1 rounded-lg border border-white/10 bg-gray-800 px-3 text-right font-mono outline-none focus:border-orange-500"
                    />
                    <button
                        type="button" onClick={() => void save()} disabled={!hasChanged || saving}
                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-orange-700 px-4 font-semibold text-white hover:bg-orange-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {saving ? <Loader2 className="animate-spin" size={18} aria-hidden="true" /> : <Save size={18} aria-hidden="true" />}
                        บันทึก fallback
                    </button>
                </div>
                <div className="mt-3 text-xs text-gray-500">
                    {setting?.isDefault ? 'ยังใช้ค่าเริ่มต้นของโปรแกรม' : `ค่าที่บันทึก: ฿${formatCurrency(Number(setting?.value || 0))}/ลิตร${setting?.updatedAt ? ` · แก้ล่าสุด ${new Date(setting.updatedAt).toLocaleString('th-TH')}` : ''}`}
                </div>
            </div>
        </div>
    );
}
