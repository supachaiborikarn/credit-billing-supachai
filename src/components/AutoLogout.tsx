'use client';

import { useEffect, useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes in milliseconds
const WARNING_BEFORE_LOGOUT = 60 * 1000; // Show warning 1 minute before logout

export default function AutoLogout({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const warningTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const [showWarning, setShowWarning] = useState(false);
    const [secondsLeft, setSecondsLeft] = useState(60);

    const logout = useCallback(async () => {
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
        } catch (e) {
            // ignore
        }
        router.replace('/login?reason=timeout');
    }, [router]);

    const resetTimer = useCallback(() => {
        // Clear existing timers
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);

        setShowWarning(false);

        // Set warning timer
        warningTimeoutRef.current = setTimeout(() => {
            setShowWarning(true);
            setSecondsLeft(60);

            // Countdown
            const countdownInterval = setInterval(() => {
                setSecondsLeft(prev => {
                    if (prev <= 1) {
                        clearInterval(countdownInterval);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }, INACTIVITY_TIMEOUT - WARNING_BEFORE_LOGOUT);

        // Set logout timer
        timeoutRef.current = setTimeout(() => {
            logout();
        }, INACTIVITY_TIMEOUT);
    }, [logout]);

    const handleStayLoggedIn = useCallback(() => {
        setShowWarning(false);
        resetTimer();
    }, [resetTimer]);

    useEffect(() => {
        // Activity events
        const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];

        const handleActivity = () => {
            if (!showWarning) {
                resetTimer();
            }
        };

        // Add event listeners
        events.forEach(event => {
            document.addEventListener(event, handleActivity, { passive: true });
        });

        // Start initial timer
        resetTimer();

        // Cleanup
        return () => {
            events.forEach(event => {
                document.removeEventListener(event, handleActivity);
            });
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
        };
    }, [resetTimer, showWarning]);

    return (
        <>
            {children}

            {/* Inactivity Warning Modal */}
            {showWarning && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[9999] p-4">
                    <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center shadow-2xl">
                        <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span className="text-3xl">⏰</span>
                        </div>
                        <h2 className="text-xl font-bold text-gray-800 mb-2">กำลังจะออกจากระบบ</h2>
                        <p className="text-gray-600 mb-4">
                            ไม่มีการใช้งานมาสักพัก<br />
                            ระบบจะออกจากระบบอัตโนมัติใน
                        </p>
                        <div className="text-4xl font-bold text-red-500 mb-4">
                            {secondsLeft} วินาที
                        </div>
                        <button
                            onClick={handleStayLoggedIn}
                            className="w-full py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-xl hover:from-green-600 hover:to-emerald-700"
                        >
                            ยังใช้งานอยู่
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
