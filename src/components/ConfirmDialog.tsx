'use client';

import { X, AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    type?: 'danger' | 'warning' | 'info';
    onConfirm: () => void;
    onCancel: () => void;
    loading?: boolean;
}

export default function ConfirmDialog({
    isOpen,
    title,
    message,
    confirmText = 'ยืนยัน',
    cancelText = 'ยกเลิก',
    type = 'danger',
    onConfirm,
    onCancel,
    loading = false,
}: ConfirmDialogProps) {
    if (!isOpen) return null;

    const typeStyles = {
        danger: {
            icon: 'bg-red-500/20 text-red-400',
            button: 'bg-gradient-to-r from-red-600 to-rose-600',
            glow: 'from-red-600 via-rose-500 to-red-600',
        },
        warning: {
            icon: 'bg-yellow-500/20 text-yellow-400',
            button: 'bg-gradient-to-r from-yellow-600 to-amber-600',
            glow: 'from-yellow-600 via-amber-500 to-yellow-600',
        },
        info: {
            icon: 'bg-blue-500/20 text-blue-400',
            button: 'bg-gradient-to-r from-blue-600 to-cyan-600',
            glow: 'from-blue-600 via-cyan-500 to-blue-600',
        },
    };

    const styles = typeStyles[type];

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <div className="relative w-full max-w-sm animate-fade-in">
                <div className={`absolute -inset-1 bg-gradient-to-r ${styles.glow} rounded-3xl blur-xl opacity-30`} />
                <div className="relative backdrop-blur-2xl rounded-2xl border border-white/10 p-6"
                    style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)' }}>

                    {/* Header */}
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-xl ${styles.icon}`}>
                                <AlertTriangle size={20} />
                            </div>
                            <h3 className="text-lg font-bold text-white">{title}</h3>
                        </div>
                        <button
                            onClick={onCancel}
                            className="p-2 hover:bg-white/10 rounded-xl transition-colors"
                            disabled={loading}
                        >
                            <X size={20} className="text-gray-400" />
                        </button>
                    </div>

                    {/* Message */}
                    <p className="text-gray-300 mb-6">{message}</p>

                    {/* Buttons */}
                    <div className="flex gap-3">
                        <button
                            onClick={onConfirm}
                            disabled={loading}
                            className={`flex-1 relative px-4 py-3 rounded-xl font-semibold text-white overflow-hidden disabled:opacity-50`}
                        >
                            <div className={`absolute inset-0 ${styles.button}`} />
                            <span className="relative">{loading ? 'กำลังดำเนินการ...' : confirmText}</span>
                        </button>
                        <button
                            onClick={onCancel}
                            disabled={loading}
                            className="px-4 py-3 rounded-xl font-medium text-gray-300 bg-white/5 hover:bg-white/10 transition-colors disabled:opacity-50"
                        >
                            {cancelText}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
