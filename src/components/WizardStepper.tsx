'use client';

import React from 'react';

export interface WizardStep {
    id: string;
    label: string;
    icon?: React.ReactNode;
    completed?: boolean;
    disabled?: boolean;
}

interface WizardStepperProps {
    steps: WizardStep[];
    currentStep: number;
    onStepClick?: (index: number) => void;
    className?: string;
}

function cn(...classes: (string | undefined | false)[]) {
    return classes.filter(Boolean).join(' ');
}

export function WizardStepper({ steps, currentStep, onStepClick, className }: WizardStepperProps) {
    return (
        <div className={cn("flex items-center justify-between w-full px-2 py-3", className)}>
            {steps.map((step, index) => {
                const isActive = index === currentStep;
                const isCompleted = step.completed || index < currentStep;
                const isDisabled = step.disabled;
                const canClick = !isDisabled && (isCompleted || index <= currentStep);

                return (
                    <React.Fragment key={step.id}>
                        {/* Step circle */}
                        <button
                            type="button"
                            onClick={() => canClick && onStepClick?.(index)}
                            disabled={!canClick}
                            className={cn(
                                "flex flex-col items-center gap-1 transition-all",
                                canClick ? "cursor-pointer" : "cursor-not-allowed opacity-60"
                            )}
                        >
                            <div
                                className={cn(
                                    "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all",
                                    "border-2",
                                    isActive && "border-blue-500 bg-blue-500 text-white scale-110 shadow-lg",
                                    isCompleted && !isActive && "border-green-500 bg-green-500 text-white",
                                    !isActive && !isCompleted && !isDisabled && "border-gray-300 bg-white text-gray-400",
                                    isDisabled && "border-gray-200 bg-gray-100 text-gray-300"
                                )}
                            >
                                {isCompleted && !isActive ? (
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                ) : isDisabled ? (
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                    </svg>
                                ) : (
                                    step.icon || (index + 1)
                                )}
                            </div>
                            <span
                                className={cn(
                                    "text-xs font-medium text-center max-w-[60px] leading-tight",
                                    isActive && "text-blue-600",
                                    isCompleted && !isActive && "text-green-600",
                                    !isActive && !isCompleted && "text-gray-400"
                                )}
                            >
                                {step.label}
                            </span>
                        </button>

                        {/* Connector line */}
                        {index < steps.length - 1 && (
                            <div
                                className={cn(
                                    "flex-1 h-1 mx-1 rounded-full transition-all",
                                    index < currentStep ? "bg-green-500" : "bg-gray-200"
                                )}
                            />
                        )}
                    </React.Fragment>
                );
            })}
        </div>
    );
}

// Offline Banner Component
interface OfflineBannerProps {
    isOnline: boolean;
    pendingCount?: number;
    onRetry?: () => void;
}

export function OfflineBanner({ isOnline, pendingCount = 0, onRetry }: OfflineBannerProps) {
    if (isOnline && pendingCount === 0) return null;

    return (
        <div
            className={cn(
                "fixed bottom-0 left-0 right-0 z-50 px-4 py-3 text-center text-sm font-medium",
                !isOnline
                    ? "bg-red-500 text-white"
                    : "bg-yellow-500 text-yellow-900"
            )}
        >
            {!isOnline ? (
                <div className="flex items-center justify-center gap-2">
                    <span className="animate-pulse">📡</span>
                    <span>ออฟไลน์ - ข้อมูลจะบันทึกเมื่อกลับมาออนไลน์</span>
                </div>
            ) : (
                <div className="flex items-center justify-center gap-2">
                    <span>⏳ รอ sync {pendingCount} รายการ</span>
                    {onRetry && (
                        <button
                            onClick={onRetry}
                            className="underline font-bold"
                        >
                            Sync เลย
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

// Draft Recovered Toast
interface DraftToastProps {
    show: boolean;
    onDismiss: () => void;
}

export function DraftRecoveredToast({ show, onDismiss }: DraftToastProps) {
    if (!show) return null;

    return (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-3">
            <span>📋 กู้คืน draft สำเร็จ</span>
            <button onClick={onDismiss} className="text-blue-200 hover:text-white">✕</button>
        </div>
    );
}

// Abnormal Value Warning Dialog
interface AbnormalWarningProps {
    show: boolean;
    value: number;
    expected?: number; // Optional - if not provided, won't show comparison
    onConfirm: () => void;
    onCancel: () => void;
}

export function AbnormalValueWarning({ show, value, expected, onConfirm, onCancel }: AbnormalWarningProps) {
    if (!show) return null;

    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
                <div className="text-center mb-4">
                    <div className="text-4xl mb-2">⚠️</div>
                    <h3 className="text-lg font-bold text-red-600">ยอดเงินสูงผิดปกติ!</h3>
                </div>
                <div className="bg-red-50 p-3 rounded-lg mb-4 text-center">
                    <div className="text-2xl font-bold text-red-700">{value.toLocaleString()} บาท</div>
                    {expected !== undefined && (
                        <div className="text-sm text-red-600">ค่าเฉลี่ย: {expected.toLocaleString()} บาท</div>
                    )}
                </div>
                <p className="text-sm text-gray-600 text-center mb-4">
                    กรุณาตรวจสอบตัวเลขอีกครั้ง หรือกด &quot;ยืนยัน&quot; ถ้าถูกต้อง
                </p>
                <div className="flex gap-3">
                    <button
                        onClick={onCancel}
                        className="flex-1 px-4 py-3 bg-gray-100 rounded-lg font-medium"
                    >
                        แก้ไข
                    </button>
                    <button
                        onClick={onConfirm}
                        className="flex-1 px-4 py-3 bg-red-500 text-white rounded-lg font-medium"
                    >
                        ยืนยัน
                    </button>
                </div>
            </div>
        </div>
    );
}

// Variance Early Warning
interface VarianceWarningProps {
    show: boolean;
    variance: number;
    status: 'GREEN' | 'YELLOW' | 'RED';
}

export function VarianceEarlyWarning({ show, variance, status }: VarianceWarningProps) {
    if (!show || status === 'GREEN') return null;

    return (
        <div
            className={cn(
                "fixed top-16 left-4 right-4 z-40 p-3 rounded-lg shadow-lg",
                status === 'RED' ? "bg-red-100 border-2 border-red-500" : "bg-yellow-100 border-2 border-yellow-500"
            )}
        >
            <div className="flex items-center gap-3">
                <span className="text-2xl">{status === 'RED' ? '🔴' : '🟡'}</span>
                <div className="flex-1">
                    <div className="font-bold text-sm">
                        {status === 'RED' ? 'ส่วนต่างจะเป็นแดง!' : 'ส่วนต่างจะเป็นเหลือง'}
                    </div>
                    <div className="text-xs">
                        คาดการณ์: {variance.toLocaleString()} บาท
                    </div>
                </div>
            </div>
        </div>
    );
}
