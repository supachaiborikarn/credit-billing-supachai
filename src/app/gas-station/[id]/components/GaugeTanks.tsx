'use client';

import { GaugeReading } from '../hooks/useGasStation';

interface GaugeTanksProps {
    gaugeReadings: GaugeReading[];
    formatTime: (dateStr: string) => string;
}

export default function GaugeTanks({ gaugeReadings, formatTime }: GaugeTanksProps) {
    if (gaugeReadings.length === 0) return null;

    return (
        <div className="rounded-3xl border border-black/10 bg-white p-6">
            <h2 className="text-xl font-black tracking-tight mb-4">
                ⛽ <span className="bg-orange-200 px-2 rounded">ระดับถังแก๊ส</span>
            </h2>
            <div className="grid grid-cols-3 gap-4">
                {[1, 2, 3].map(tankNum => {
                    const latestReading = gaugeReadings
                        .filter(g => g.tankNumber === tankNum)
                        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
                    const percentage = latestReading?.percentage || 0;
                    const barColor = percentage > 50 ? 'bg-green-500' : percentage > 20 ? 'bg-yellow-500' : 'bg-red-500';

                    return (
                        <div key={tankNum} className="rounded-2xl border border-black/10 bg-[#fafafa] p-4 text-center">
                            <div className="text-xs font-black text-neutral-500">ถัง {tankNum}</div>
                            <div className="h-24 w-12 mx-auto mt-2 bg-neutral-200 rounded-xl relative overflow-hidden">
                                <div
                                    className={`absolute bottom-0 left-0 right-0 ${barColor} transition-all duration-700`}
                                    style={{ height: `${percentage}%` }}
                                />
                            </div>
                            <div className="mt-2 text-2xl font-black">{percentage}%</div>
                        </div>
                    );
                })}
            </div>
            <p className="text-xs font-bold text-neutral-400 text-center mt-3">
                อัพเดทล่าสุด: {gaugeReadings[0] ? formatTime(gaugeReadings[0].createdAt) : '-'}
            </p>
        </div>
    );
}
