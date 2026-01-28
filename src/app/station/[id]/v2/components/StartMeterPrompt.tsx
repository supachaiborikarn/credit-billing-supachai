'use client';

import { AlertTriangle, ArrowRight } from 'lucide-react';

interface StartMeterPromptProps {
    onGoToMeter: () => void;
}

export default function StartMeterPrompt({ onGoToMeter }: StartMeterPromptProps) {
    return (
        <div className="bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-200 rounded-2xl p-4">
            <div className="flex items-start gap-3">
                <div className="p-2 bg-yellow-100 rounded-xl">
                    <AlertTriangle className="text-yellow-600" size={24} />
                </div>
                <div className="flex-1">
                    <h3 className="font-bold text-yellow-800">ยังไม่ได้บันทึกมิเตอร์เริ่มต้น</h3>
                    <p className="text-sm text-yellow-700 mt-1">
                        กรุณาบันทึกมิเตอร์เริ่มต้นก่อนเริ่มบันทึกการเติมน้ำมัน
                    </p>
                    <button
                        onClick={onGoToMeter}
                        className="mt-3 flex items-center gap-2 text-sm font-medium text-yellow-700 bg-yellow-100 hover:bg-yellow-200 px-4 py-2 rounded-xl transition"
                    >
                        ไปบันทึกมิเตอร์ <ArrowRight size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
}
