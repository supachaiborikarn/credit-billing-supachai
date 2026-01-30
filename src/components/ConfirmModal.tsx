'use client';

import { AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
    isOpen: boolean;
    title?: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'warning' | 'info';
    onConfirm: () => void;
    onCancel: () => void;
    loading?: boolean;
}

const variantConfig = {
    danger: {
        icon: 'bg-red-100 text-red-600',
        button: 'bg-red-600 hover:bg-red-700 focus:ring-red-500',
        title: 'text-red-800'
    },
    warning: {
        icon: 'bg-orange-100 text-orange-600',
        button: 'bg-orange-600 hover:bg-orange-700 focus:ring-orange-500',
        title: 'text-orange-800'
    },
    info: {
        icon: 'bg-blue-100 text-blue-600',
        button: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500',
        title: 'text-blue-800'
    }
};

export default function ConfirmModal({
    isOpen,
    title = 'ยืนยันการดำเนินการ',
    message,
    confirmText = 'ยืนยัน',
    cancelText = 'ยกเลิก',
    variant = 'danger',
    onConfirm,
    onCancel,
    loading = false
}: ConfirmModalProps) {
    if (!isOpen) return null;

    const config = variantConfig[variant];

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden animate-slide-up">
                {/* Header */}
                <div className="p-6 pb-4">
                    <div className="flex items-start gap-4">
                        {/* Icon */}
                        <div className={`p-3 rounded-full ${config.icon}`}>
                            <AlertTriangle size={24} />
                        </div>

                        {/* Content */}
                        <div className="flex-1 pt-1">
                            <h3 className={`text-lg font-bold ${config.title}`}>
                                {title}
                            </h3>
                            <p className="text-gray-600 mt-2 text-sm leading-relaxed">
                                {message}
                            </p>
                        </div>

                        {/* Close button */}
                        <button
                            onClick={onCancel}
                            className="p-1 hover:bg-gray-100 rounded-lg transition"
                            disabled={loading}
                        >
                            <X size={20} className="text-gray-400" />
                        </button>
                    </div>
                </div>

                {/* Actions */}
                <div className="px-6 pb-6 flex gap-3">
                    <button
                        onClick={onCancel}
                        disabled={loading}
                        className="flex-1 py-3 px-4 border border-gray-200 rounded-xl font-semibold text-gray-700 hover:bg-gray-50 transition disabled:opacity-50"
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={loading}
                        className={`flex-1 py-3 px-4 rounded-xl font-semibold text-white transition disabled:opacity-50 flex items-center justify-center gap-2 ${config.button}`}
                    >
                        {loading ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                กำลังดำเนินการ...
                            </>
                        ) : (
                            confirmText
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
