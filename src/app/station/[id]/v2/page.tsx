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
import { Settings } from 'lucide-react';

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

    // Modal states
    const [showRefillModal, setShowRefillModal] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

    // Bottom tab
    const [activeTab, setActiveTab] = useState<TabType>('home');

    // Smart defaults - remember last used values
    const [lastPaymentType, setLastPaymentType] = useState<string>('CREDIT');
    const [lastNozzle, setLastNozzle] = useState<number>(1);

    // Fetch current user
    useEffect(() => {
        const fetchUser = async () => {
            try {
                const res = await fetch('/api/auth/me');
                if (res.ok) {
                    const data = await res.json();
                    setCurrentUser(data.user);
                }
            } catch (error) {
                console.error('Error fetching user:', error);
            }
        };
        fetchUser();
    }, []);

    // Fetch daily data
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

                // Update last payment type from most recent transaction
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

    // Determine day status
    const getDayStatus = (): DayStatus => {
        if (!dailyRecord?.meters || dailyRecord.meters.length === 0) {
            return 'not_started';
        }
        const hasStartMeter = dailyRecord.meters.some(m => m.startReading > 0);
        const hasEndMeter = dailyRecord.meters.some(m => m.endReading && m.endReading > 0);

        if (!hasStartMeter) return 'not_started';
        if (hasEndMeter) return 'closed';
        return 'recording';
    };

    const dayStatus = getDayStatus();

    // Check if day is closed
    const isDayClosed = dayStatus === 'closed';

    // Calculate totals
    const meterTotal = dailyRecord?.meters?.reduce((sum, m) => {
        const end = m.endReading || 0;
        const start = m.startReading || 0;
        return sum + (end - start);
    }, 0) || 0;

    const transactionTotal = transactions.reduce((sum, t) => sum + Number(t.liters), 0);
    const meterDiff = transactionTotal - meterTotal;

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('th-TH', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    // Handle refill button click
    const handleRefillClick = () => {
        if (dayStatus === 'not_started') {
            // Prompt to enter start meter first
            setActiveTab('meter');
            return;
        }
        if (isDayClosed && !isAdmin) {
            alert('วันนี้ปิดแล้ว ไม่สามารถเพิ่มรายการได้');
            return;
        }
        setShowRefillModal(true);
    };

    // Handle successful refill - update smart defaults
    const handleRefillSuccess = (paymentType: string, nozzle: number) => {
        setLastPaymentType(paymentType);
        setLastNozzle(nozzle);
        setShowRefillModal(false);
        fetchDailyData();
    };

    if (!station) {
        return <div className="p-4 text-gray-500">ไม่พบสถานี</div>;
    }

    // Content based on active tab
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

                        {/* Prompt to enter start meter if not started */}
                        {dayStatus === 'not_started' && (
                            <StartMeterPrompt onGoToMeter={() => setActiveTab('meter')} />
                        )}

                        <DailySummary
                            meterTotal={meterTotal}
                            transactionTotal={transactionTotal}
                            meterDiff={meterDiff}
                            transactions={transactions}
                        />

                        {/* Recent transactions preview */}
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
                        {/* Audit Trail - Admin only */}
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

    // Determine button state and appearance
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
            {/* Block if previous day not closed */}
            <PreviousDayBlocker
                stationId={`station-${id}`}
                currentDate={selectedDate}
                onGoToPreviousDay={(date) => setSelectedDate(date)}
                isAdmin={isAdmin}
            />

            {/* Time-based Reminder for Staff */}
            <TimeBasedReminder
                meterLink={`/station/${id}/v2`}
                actionLabel="ตรวจสอบมิเตอร์"
                isDayClosed={isDayClosed}
                isAdmin={isAdmin}
                date={selectedDate}
            />

            {/* Header */}
            <header className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-5 sticky top-0 z-30">
                <div className="flex items-center justify-between mb-3">
                    <div>
                        <h1 className="text-xl font-bold">{station.name}</h1>
                        <p className="text-blue-100 text-sm">⛽ สถานีบริการน้ำมัน (V2)</p>
                    </div>
                    {isAdmin && (
                        <button
                            onClick={() => setShowSettings(true)}
                            className="flex flex-col items-center gap-1 p-2.5 bg-white/20 rounded-xl hover:bg-white/30 transition"
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
                    className="w-full bg-white/20 px-4 py-2.5 rounded-xl text-white placeholder-white/70 focus:outline-none focus:ring-2 focus:ring-white/50"
                />
            </header>

            {/* Main Content - with padding for bottom elements */}
            <main className="p-4 space-y-4 pb-52">
                {renderContent()}
            </main>

            {/* Sticky Refill Button - above tab bar */}
            <div className="fixed bottom-28 left-0 right-0 px-4 z-40">
                <button
                    onClick={handleRefillClick}
                    disabled={buttonState.disabled}
                    className={`w-full py-4 ${buttonState.className} text-white font-bold text-lg rounded-xl shadow-lg active:scale-[0.98] transition flex items-center justify-center gap-2 disabled:opacity-70 disabled:active:scale-100`}
                >
                    {buttonState.text}
                </button>
            </div>

            {/* Bottom Tab Bar */}
            <BottomTabBar activeTab={activeTab} onTabChange={setActiveTab} showHistory={isAdmin} />

            {/* Refill Modal */}
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

            {/* Admin Settings Modal */}
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

            {/* Edit Transaction Modal */}
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
