'use client';

/**
 * ปุ่มเลือกช่วงวันที่สำเร็จรูปสำหรับหน้ารายงานแอดมิน
 * ใช้คู่กับ state fromDate/toDate (รูปแบบ YYYY-MM-DD)
 */

function toDateKey(date: Date): string {
    return date.toISOString().split('T')[0];
}

function todayKey(): string {
    return toDateKey(new Date());
}

function daysAgoKey(days: number): string {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return toDateKey(d);
}

function monthRange(offset: number): { from: string; to: string } {
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const last = offset === 0
        ? now // เดือนนี้: ถึงวันนี้
        : new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
    // ใช้ local date (เครื่องผู้ใช้อยู่โซนไทย) แปลงเป็น key แบบไม่เพี้ยนโซน
    const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return { from: fmt(first), to: fmt(last) };
}

export interface DateRangePreset {
    label: string;
    getRange: () => { from: string; to: string };
}

export const DEFAULT_PRESETS: DateRangePreset[] = [
    { label: 'วันนี้', getRange: () => ({ from: todayKey(), to: todayKey() }) },
    { label: '7 วัน', getRange: () => ({ from: daysAgoKey(6), to: todayKey() }) },
    { label: '30 วัน', getRange: () => ({ from: daysAgoKey(29), to: todayKey() }) },
    { label: 'เดือนนี้', getRange: () => monthRange(0) },
    { label: 'เดือนก่อน', getRange: () => monthRange(-1) },
];

export default function DateRangePresets({
    fromDate,
    toDate,
    onSelect,
    presets = DEFAULT_PRESETS,
}: {
    fromDate: string;
    toDate: string;
    onSelect: (from: string, to: string) => void;
    presets?: DateRangePreset[];
}) {
    return (
        <div className="flex flex-wrap items-center gap-1.5">
            {presets.map((preset) => {
                const range = preset.getRange();
                const active = range.from === fromDate && range.to === toDate;
                return (
                    <button
                        key={preset.label}
                        type="button"
                        onClick={() => onSelect(range.from, range.to)}
                        className={`rounded-full px-3 py-1 text-xs transition-colors ${active
                            ? 'bg-orange-600 text-white'
                            : 'border border-white/10 bg-white/5 text-gray-300 hover:bg-white/10'}`}
                    >
                        {preset.label}
                    </button>
                );
            })}
        </div>
    );
}
