'use client';

import { useState, useEffect, use } from 'react';
import { STATIONS } from '@/constants';
import DayStatusCard from './components/DayStatusCard';
import MeterSection from './components/MeterSection';
import TransactionCard from './components/TransactionCard';
import DailySummary from './components/DailySummary';
import RefillModal from './components/RefillModal';
import BottomTabBar from './components/BottomTabBar';
import AdminSettingsModal from './components/AdminSettingsModal';
import StartMeterPrompt from './components/StartMeterPrompt';
import HistoryView from './components/HistoryView';
import AuditTrail from './components/AuditTrail';
import EditTransactionModal from './components/EditTransactionModal';
import TimeBasedReminder from '@/components/TimeBasedReminder';
import PreviousDayBlocker from './components/PreviousDayBlocker';
import OperationsCommandPanel from './components/OperationsCommandPanel';
import { Printer, Settings } from 'lucide-react';
import { printDailyWorkReport, printThermalDailyWorkReport } from '@/lib/daily-report-print';

interface MeterReading {
    nozzleNumber: number;
    startReading: number;
    endReading: number | null;
    startPhoto?: string | null;
    endPhoto?: string | null;
}

interface Transaction {
    id: string;
    date: string;
    licensePlate: string;
    ownerId?: string | null;
    ownerName: string;
    ownerCode?: string | null;
    paymentType: string;
    nozzleNumber: number;
    liters: number;
    pricePerLiter: number;
    amount: number;
    billBookNo?: string;
    billNo?: string;
    recordedByName?: string;
    transferProofUrl?: string | null;
}

interface DailyRecord {
    id: string;
    date: string;
    retailPrice: number;
    wholesalePrice: number;
    status: string;
    meters: MeterReading[];
}

type TabType = 'home' | 'list' | 'meter' | 'summary' | 'history';
type DayStatus = 'not_started' | 'recording' | 'closed';

export default function TankStationV2Page({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const stationIndex = parseInt(id) - 1;
    const station = STATIONS[stationIndex];

    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [loading, setLoading] = useState(true);
    const [dailyRecord, setDailyRecord] = useState<DailyRecord | null>(null);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [previousDayMeters, setPreviousDayMeters] = useState<{ nozzle: number; endReading: number }[]>([]);
    const [currentUser, setCurrentUser] = useState<{ role: string } | null>(null);
    const [showRefillModal, setShowRefillModal] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
    const [activeTab, setActiveTab] = useState<TabType>('home');
    const [lastPaymentType, setLastPaymentType] = useState<string>('CREDIT');
    const [lastNozzle, setLastNozzle] = useState<number>(1);

    useEffect(() => {
        const fetchUser = async () => {
            try {
                const res = await fetch('/api/auth/me');
                if (res.ok) {
                    const data = await res.json();
                    setCurrentUser(data.user);
                } else if (res.status === 401) {
                    window.location.href = `/login?reason=relogin&redirect=${encodeURIComponent(`/station/${id}/v2`)}`;
                    return;
                }
            } catch (error) {
                console.error('Error fetching user:', error);
            }
        };
        fetchUser();
    }, []);

    useEffect(() => {
        if (station) {
            fetchDailyData();
        }
    }, [selectedDate, station]);

    const fetchDailyData = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/station/${id}/daily?date=${selectedDate}`);
            if (res.ok) {
                const data = await res.json();
                setDailyRecord(data.dailyRecord);
                setTransactions(data.transactions || []);
                if (data.previousDayMeters) {
                    setPreviousDayMeters(data.previousDayMeters);
                }

                if (data.transactions && data.transactions.length > 0) {
                    setLastPaymentType(data.transactions[0].paymentType);
                    setLastNozzle(data.transactions[0].nozzleNumber || 1);
                }
            }
        } catch (error) {
            console.error('Error fetching daily data:', error);
        } finally {
            setLoading(false);
        }
    };

    const isAdmin = currentUser?.role === 'ADMIN';

    const getDayStatus = (): DayStatus => {
        if (!dailyRecord?.meters || dailyRecord.meters.length === 0) {
            return 'not_started';
        }

        if (dailyRecord.status === 'CLOSED') {
            return 'closed';
        }

        const hasStartMeter = dailyRecord.meters.some(m => m.startReading > 0);
        if (!hasStartMeter) return 'not_started';
        return 'recording';
    };

    const dayStatus = getDayStatus();
    const isDayClosed = dayStatus === 'closed';

    const meterTotal = dailyRecord?.meters?.reduce((sum, m) => {
        const end = m.endReading || 0;
        const start = m.startReading || 0;
        return sum + (end - start);
    }, 0) || 0;

    const transactionTotal = transactions.reduce((sum, t) => sum + Number(t.liters), 0);
    const meterDiff = transactionTotal - meterTotal;

    const formatDate = (dateStr: string) =>
        new Date(dateStr).toLocaleDateString('th-TH', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });

    const handleRefillClick = () => {
        if (dayStatus === 'not_started') {
            setActiveTab('meter');
            return;
        }
        if (isDayClosed && !isAdmin) {
            alert('วันนี้ปิดแล้ว ไม่สามารถเพิ่มรายการได้');
            return;
        }
        setShowRefillModal(true);
    };

    const handleRefillSuccess = (paymentType: string, nozzle: number) => {
        setLastPaymentType(paymentType);
        setLastNozzle(nozzle);
        setShowRefillModal(false);
        fetchDailyData();
    };

    const getPrintableDailyMeters = () => (dailyRecord?.meters || []).map((meter) => ({
        nozzleNumber: meter.nozzleNumber,
        startReading: Number(meter.startReading || 0),
        endReading: meter.endReading == null ? null : Number(meter.endReading),
        liters: meter.endReading == null
            ? 0
            : Math.max(Number(meter.endReading || 0) - Number(meter.startReading || 0), 0),
    }));

    const handlePrintDailyReport = (paper: 'a4' | '58' | '80') => {
        if (!station) {
            alert('ไม่พบข้อมูลสถานีสำหรับพิมพ์รายงาน');
            return;
        }

        const reportPayload = {
            stationName: station.name,
            reportDate: selectedDate,
            transactions,
            meters: getPrintableDailyMeters(),
        };

        const opened = paper === 'a4'
            ? printDailyWorkReport(reportPayload)
            : printThermalDailyWorkReport({ ...reportPayload, paperSize: paper });

        if (!opened) {
            alert('กรุณาอนุญาตให้เปิด popup เพื่อพิมพ์รายงาน');
        }
    };

    if (!station) {
        return <div className="p-4 text-gray-500">ไม่พบสถานี</div>;
    }

    const renderContent = () => {
        if (loading) {
            return (
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
                </div>
            );
        }

        switch (activeTab) {
            case 'home':
                return (
                    <>
                        <DayStatusCard
                            date={selectedDate}
                            status={dayStatus}
                            formatDate={formatDate}
                        />

                        <OperationsCommandPanel
                            dayStatus={dayStatus}
                            meters={dailyRecord?.meters || []}
                            transactions={transactions}
                            meterTotal={meterTotal}
                            transactionTotal={transactionTotal}
                            meterDiff={meterDiff}
                            onGoToMeter={() => setActiveTab('meter')}
                            onGoToList={() => setActiveTab('list')}
                        />

                        {dayStatus === 'not_started' && (
                            <StartMeterPrompt onGoToMeter={() => setActiveTab('meter')} />
                        )}

                        <DailySummary
                            meterTotal={meterTotal}
                            transactionTotal={transactionTotal}
                            meterDiff={meterDiff}
                            transactions={transactions}
                        />

                        <section>
                            <div className="flex items-center justify-between mb-3">
                                <h2 className="font-bold text-gray-800">📋 รายการล่าสุด</h2>
                                <button
                                    onClick={() => setActiveTab('list')}
                                    className="text-sm text-blue-600"
                                >
                                    ดูทั้งหมด ({transactions.length})
                                </button>
                            </div>
                            <div className="space-y-3">
                                {transactions.slice(0, 3).map(t => (
                                    <TransactionCard
                                        key={t.id}
                                        transaction={t}
                                        onEdit={() => setEditingTransaction(t)}
                                        onDelete={() => fetchDailyData()}
                                        showActions={!isDayClosed || isAdmin}
                                        isLocked={isDayClosed && !isAdmin}
                                    />
                                ))}
                                {transactions.length === 0 && (
                                    <div className="bg-white rounded-xl p-6 text-center text-gray-400">
                                        ยังไม่มีรายการ
                                    </div>
                                )}
                            </div>
                        </section>
                    </>
                );

            case 'list':
                return (
                    <section>
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="font-bold text-gray-800">📋 รายการวันนี้ ({transactions.length})</h2>
                            {isDayClosed && (
                                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full flex items-center gap-1">
                                    🔒 ปิดวันแล้ว
                                </span>
                            )}
                        </div>
                        <div className="space-y-3">
                            {transactions.map(t => (
                                <TransactionCard
                                    key={t.id}
                                    transaction={t}
                                    onEdit={() => setEditingTransaction(t)}
                                    onDelete={() => fetchDailyData()}
                                    showActions={!isDayClosed || isAdmin}
                                    isLocked={isDayClosed && !isAdmin}
                                />
                            ))}
                            {transactions.length === 0 && (
                                <div className="bg-white rounded-xl p-8 text-center text-gray-400">
                                    ยังไม่มีรายการ
                                </div>
                            )}
                        </div>
                    </section>
                );

            case 'meter':
                return (
                    <MeterSection
                        stationId={id}
                        date={selectedDate}
                        meters={dailyRecord?.meters || []}
                        previousDayMeters={previousDayMeters}
                        onSave={fetchDailyData}
                        dayStatus={dayStatus}
                        isAdmin={isAdmin}
                    />
                );

            case 'summary':
                return (
                    <>
                        <DailySummary
                            meterTotal={meterTotal}
                            transactionTotal={transactionTotal}
                            meterDiff={meterDiff}
                            transactions={transactions}
                            detailed
                        />
                        {isAdmin && (
                            <AuditTrail stationId={id} date={selectedDate} />
                        )}
                    </>
                );

            case 'history':
                return (
                    <HistoryView
                        stationId={id}
                        onSelectDate={(date) => {
                            setSelectedDate(date);
                            setActiveTab('home');
                        }}
                    />
                );

            default:
                return null;
        }
    };

    const getButtonState = () => {
        if (dayStatus === 'not_started') {
            return {
                text: '📟 กรุณาบันทึกมิเตอร์เริ่มต้นก่อน',
                className: 'bg-gradient-to-r from-yellow-500 to-amber-500',
                disabled: false,
            };
        }
        if (isDayClosed && !isAdmin) {
            return {
                text: '🔒 วันนี้ปิดแล้ว',
                className: 'bg-gray-400',
                disabled: true,
            };
        }
        return {
            text: '➕ บันทึกการเติม',
            className: 'bg-gradient-to-r from-green-500 to-emerald-600',
            disabled: false,
        };
    };

    const buttonState = getButtonState();

    return (
        <div className="min-h-screen bg-gray-100">
            <PreviousDayBlocker
                stationId={`station-${id}`}
                currentDate={selectedDate}
                onGoToPreviousDay={(date) => setSelectedDate(date)}
                isAdmin={isAdmin}
            />

            <TimeBasedReminder
                meterLink={`/station/${id}/v2`}
                actionLabel="ตรวจสอบมิเตอร์"
                isDayClosed={isDayClosed}
                isAdmin={isAdmin}
                date={selectedDate}
            />

            <header className="sticky top-0 z-30 bg-gradient-to-br from-slate-950 via-slate-900 to-orange-700 px-4 py-5 text-white shadow-lg shadow-slate-950/20">
                <div className="flex items-center justify-between mb-3">
                    <div>
                        <h1 className="text-xl font-bold">{station.name}</h1>
                        <p className="text-orange-100 text-sm">⛽ ระบบพนักงานแท๊งลอย</p>
                    </div>
                    {isAdmin && (
                        <button
                            onClick={() => setShowSettings(true)}
                            className="flex flex-col items-center gap-1 p-2.5 bg-white/15 rounded-xl hover:bg-white/25 transition"
                        >
                            <Settings size={20} />
                            <span className="text-[10px] font-medium">ตั้งราคาน้ำมัน</span>
                        </button>
                    )}
                </div>
                <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full rounded-xl bg-white/15 px-4 py-2.5 text-white placeholder-white/70 focus:outline-none focus:ring-2 focus:ring-orange-200"
                />
                <div className="mt-3 rounded-2xl bg-white/12 p-2 ring-1 ring-white/15">
                    <div className="mb-2 flex items-center gap-2 px-1 text-sm font-bold text-white">
                        <Printer size={16} />
                        พิมพ์สรุปวัน
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        <button
                            onClick={() => handlePrintDailyReport('80')}
                            className="rounded-xl bg-white px-2 py-3 text-sm font-extrabold text-slate-900 shadow-sm transition active:scale-[0.98]"
                        >
                            80mm
                            <span className="block text-[10px] font-semibold text-orange-600">TM-m30III</span>
                        </button>
                        <button
                            onClick={() => handlePrintDailyReport('58')}
                            className="rounded-xl bg-white/90 px-2 py-3 text-sm font-extrabold text-slate-900 shadow-sm transition active:scale-[0.98]"
                        >
                            58mm
                            <span className="block text-[10px] font-semibold text-slate-500">ใบยาว</span>
                        </button>
                        <button
                            onClick={() => handlePrintDailyReport('a4')}
                            className="rounded-xl bg-slate-900/70 px-2 py-3 text-sm font-extrabold text-white ring-1 ring-white/20 transition active:scale-[0.98]"
                        >
                            A4
                            <span className="block text-[10px] font-semibold text-slate-300">เต็มหน้า</span>
                        </button>
                    </div>
                </div>
            </header>

            <main className="p-4 space-y-4 pb-52">
                {renderContent()}
            </main>

            <div className="fixed bottom-28 left-0 right-0 px-4 z-40">
                <button
                    onClick={handleRefillClick}
                    disabled={buttonState.disabled}
                    className={`w-full py-4 ${buttonState.className} text-white font-bold text-lg rounded-xl shadow-lg active:scale-[0.98] transition flex items-center justify-center gap-2 disabled:opacity-70 disabled:active:scale-100`}
                >
                    {buttonState.text}
                </button>
            </div>

            <BottomTabBar activeTab={activeTab} onTabChange={setActiveTab} showHistory={isAdmin} />

            {showRefillModal && (
                <RefillModal
                    stationId={id}
                    date={selectedDate}
                    retailPrice={dailyRecord?.retailPrice || 31.34}
                    wholesalePrice={dailyRecord?.wholesalePrice || 30.5}
                    defaultPaymentType={lastPaymentType}
                    defaultNozzle={lastNozzle}
                    onClose={() => setShowRefillModal(false)}
                    onSuccess={handleRefillSuccess}
                />
            )}

            {showSettings && isAdmin && (
                <AdminSettingsModal
                    stationId={id}
                    date={selectedDate}
                    retailPrice={dailyRecord?.retailPrice || 31.34}
                    wholesalePrice={dailyRecord?.wholesalePrice || 30.5}
                    onClose={() => setShowSettings(false)}
                    onSave={fetchDailyData}
                />
            )}

            {editingTransaction && (
                <EditTransactionModal
                    stationId={id}
                    transaction={editingTransaction}
                    onClose={() => setEditingTransaction(null)}
                    onSuccess={() => {
                        setEditingTransaction(null);
                        fetchDailyData();
                    }}
                />
            )}
        </div>
    );
}
