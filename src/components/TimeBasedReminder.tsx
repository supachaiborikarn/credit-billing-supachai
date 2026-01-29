'use client';

import { useState, useEffect } from 'react';
import { Bell, Clock, AlertTriangle, X, ChevronRight } from 'lucide-react';
import Link from 'next/link';

interface TimeBasedReminderProps {
    /** Link to meter/shift-end page */
    meterLink: string;
    /** Label for the action button */
    actionLabel?: string;
    /** Whether the day is already closed */
    isDayClosed?: boolean;
    /** Whether user is admin (don't show for admin) */
    isAdmin?: boolean;
    /** Current date in YYYY-MM-DD format */
    date: string;
}

/**
 * Shows a reminder banner after 20:00 to remind staff to check data and close shift
 */
export default function TimeBasedReminder({
    meterLink,
    actionLabel = 'ตรวจสอบมิเตอร์',
    isDayClosed = false,
    isAdmin = false,
    date,
}: TimeBasedReminderProps) {
    const [isVisible, setIsVisible] = useState(false);
    const [currentHour, setCurrentHour] = useState(new Date().getHours());

    const REMINDER_HOUR = 20; // 20:00 น.

    // Check time and visibility on mount and every minute
    useEffect(() => {
        const checkTime = () => {
            const now = new Date();
            setCurrentHour(now.getHours());
        };

        checkTime();
        const interval = setInterval(checkTime, 60000); // Check every minute

        return () => clearInterval(interval);
    }, []);

    // Determine visibility
    useEffect(() => {
        // Don't show if:
        // 1. Before 20:00
        // 2. Day is already closed
        // 3. User is admin
        // 4. Already dismissed for this date
        const dismissKey = `shiftReminder_dismissed_${date}`;
        const isDismissed = sessionStorage.getItem(dismissKey) === 'true';

        if (currentHour >= REMINDER_HOUR && !isDayClosed && !isAdmin && !isDismissed) {
            setIsVisible(true);
        } else {
            setIsVisible(false);
        }
    }, [currentHour, isDayClosed, isAdmin, date]);

    const handleDismiss = () => {
        const dismissKey = `shiftReminder_dismissed_${date}`;
        sessionStorage.setItem(dismissKey, 'true');
        setIsVisible(false);
    };

    if (!isVisible) return null;

    return (
        <div className="fixed top-0 left-0 right-0 z-50 animate-slide-down">
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg">
                <div className="max-w-4xl mx-auto px-4 py-3">
                    <div className="flex items-start gap-3">
                        {/* Icon */}
                        <div className="flex-shrink-0 p-2 bg-white/20 rounded-full animate-pulse">
                            <Bell size={20} />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                                <AlertTriangle size={16} />
                                <span className="font-bold text-sm">เตือน: ใกล้หมดเวลาปฏิบัติงาน</span>
                            </div>
                            <p className="text-sm text-white/90">
                                กรุณาตรวจสอบความถูกต้องของข้อมูลและลงเลขมิเตอร์ปิดกะให้ครบถ้วน
                            </p>

                            {/* Action Buttons */}
                            <div className="flex flex-wrap items-center gap-2 mt-3">
                                <Link
                                    href={meterLink}
                                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-white text-orange-600 rounded-full text-sm font-bold hover:bg-orange-50 transition-colors shadow-sm"
                                >
                                    <Clock size={16} />
                                    {actionLabel}
                                    <ChevronRight size={14} />
                                </Link>
                                <button
                                    onClick={handleDismiss}
                                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-white/20 text-white rounded-full text-sm font-medium hover:bg-white/30 transition-colors"
                                >
                                    ปิดในภายหลัง
                                </button>
                            </div>
                        </div>

                        {/* Close Button */}
                        <button
                            onClick={handleDismiss}
                            className="flex-shrink-0 p-1.5 hover:bg-white/20 rounded-full transition-colors"
                            aria-label="ปิด"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
