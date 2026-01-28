'use client';

interface DayStatusCardProps {
    date: string;
    status: 'not_started' | 'recording' | 'closed';
    formatDate: (date: string) => string;
}

export default function DayStatusCard({ date, status, formatDate }: DayStatusCardProps) {
    const statusConfig = {
        not_started: {
            label: 'ยังไม่เริ่ม',
            color: 'bg-gray-100 text-gray-600',
            dotColor: 'bg-gray-400',
            icon: '⏸️',
        },
        recording: {
            label: 'กำลังบันทึก',
            color: 'bg-green-50 text-green-700',
            dotColor: 'bg-green-500 animate-pulse',
            icon: '🔄',
        },
        closed: {
            label: 'ปิดวันแล้ว',
            color: 'bg-blue-50 text-blue-700',
            dotColor: 'bg-blue-500',
            icon: '✅',
        },
    };

    const config = statusConfig[status];

    return (
        <div className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm text-gray-500">วันที่</p>
                    <p className="text-lg font-bold text-gray-800">{formatDate(date)}</p>
                </div>
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${config.color}`}>
                    <span className={`w-2.5 h-2.5 rounded-full ${config.dotColor}`} />
                    <span className="font-medium text-sm">
                        {config.icon} {config.label}
                    </span>
                </div>
            </div>
        </div>
    );
}
