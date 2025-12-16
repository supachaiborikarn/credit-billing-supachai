'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
    id: string;
    type: ToastType;
    message: string;
}

interface ToastContextValue {
    toasts: Toast[];
    showToast: (type: ToastType, message: string) => void;
    removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
}

const icons = {
    success: CheckCircle,
    error: AlertCircle,
    warning: AlertTriangle,
    info: Info,
};

const colors = {
    success: 'bg-green-500/20 border-green-500/50 text-green-400',
    error: 'bg-red-500/20 border-red-500/50 text-red-400',
    warning: 'bg-orange-500/20 border-orange-500/50 text-orange-400',
    info: 'bg-blue-500/20 border-blue-500/50 text-blue-400',
};

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: () => void }) {
    const Icon = icons[toast.type];

    return (
        <div
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-md shadow-lg animate-slide-in ${colors[toast.type]}`}
        >
            <Icon size={20} />
            <span className="flex-1 text-sm font-medium">{toast.message}</span>
            <button
                onClick={onRemove}
                className="p-1 hover:bg-white/10 rounded-lg transition-colors"
            >
                <X size={16} />
            </button>
        </div>
    );
}

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const showToast = useCallback((type: ToastType, message: string) => {
        const id = Math.random().toString(36).substring(2, 9);
        setToasts(prev => [...prev, { id, type, message }]);

        // Auto remove after 3 seconds
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 3000);
    }, []);

    const removeToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    return (
        <ToastContext.Provider value={{ toasts, showToast, removeToast }}>
            {children}

            {/* Toast Container */}
            <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
                {toasts.map(toast => (
                    <ToastItem
                        key={toast.id}
                        toast={toast}
                        onRemove={() => removeToast(toast.id)}
                    />
                ))}
            </div>
        </ToastContext.Provider>
    );
}

// Standalone toast functions for use outside React components
let globalShowToast: ((type: ToastType, message: string) => void) | null = null;

export function setGlobalToast(fn: (type: ToastType, message: string) => void) {
    globalShowToast = fn;
}

export function toast(type: ToastType, message: string) {
    if (globalShowToast) {
        globalShowToast(type, message);
    } else {
        console.log(`[Toast ${type}]: ${message}`);
    }
}

// Helper functions
export const toast_success = (message: string) => toast('success', message);
export const toast_error = (message: string) => toast('error', message);
export const toast_warning = (message: string) => toast('warning', message);
export const toast_info = (message: string) => toast('info', message);
