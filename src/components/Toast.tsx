'use client';

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
    type ReactNode,
} from 'react';
import { X, CheckCircle2, AlertCircle, AlertTriangle, Info } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastItemData {
    id: string;
    type: ToastType;
    message: string;
}

interface ToastContextValue {
    toasts: ToastItemData[];
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

const toastVisuals: Record<ToastType, { icon: typeof Info; surface: string; iconColor: string }> = {
    success: {
        icon: CheckCircle2,
        surface: 'border-[var(--ui-success)]/20 bg-[var(--ui-success-soft)]',
        iconColor: 'text-[var(--ui-success-text)]',
    },
    error: {
        icon: AlertCircle,
        surface: 'border-[var(--ui-danger)]/20 bg-[var(--ui-danger-soft)]',
        iconColor: 'text-[var(--ui-danger-text)]',
    },
    warning: {
        icon: AlertTriangle,
        surface: 'border-[var(--ui-warning)]/20 bg-[var(--ui-warning-soft)]',
        iconColor: 'text-[var(--ui-warning-text)]',
    },
    info: {
        icon: Info,
        surface: 'border-[var(--ui-info)]/20 bg-[var(--ui-info-soft)]',
        iconColor: 'text-[var(--ui-info-text)]',
    },
};

function ToastItem({ toast, onRemove }: { toast: ToastItemData; onRemove: () => void }) {
    const visual = toastVisuals[toast.type];
    const Icon = visual.icon;

    return (
        <div
            className={`flex items-start gap-3 rounded-[var(--ui-radius-md)] border p-3 text-[var(--ui-text)] shadow-[var(--ui-shadow-md)] ${visual.surface}`}
            role={toast.type === 'error' ? 'alert' : 'status'}
        >
            <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${visual.iconColor}`} aria-hidden="true" />
            <span className="min-w-0 flex-1 text-sm font-medium leading-[var(--ui-leading-normal)]">{toast.message}</span>
            <button
                type="button"
                onClick={onRemove}
                className="-mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--ui-radius-sm)] text-[var(--ui-text-muted)] transition-colors hover:bg-[var(--ui-surface)]/60 hover:text-[var(--ui-text)] focus-visible:outline-none focus-visible:shadow-[var(--ui-shadow-focus)]"
                aria-label="ปิดการแจ้งเตือน"
            >
                <X className="h-4 w-4" aria-hidden="true" />
            </button>
        </div>
    );
}

let globalShowToast: ((type: ToastType, message: string) => void) | null = null;

export function setGlobalToast(fn: ((type: ToastType, message: string) => void) | null) {
    globalShowToast = fn;
}

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<ToastItemData[]>([]);
    const idCounter = useRef(0);

    const removeToast = useCallback((id: string) => {
        setToasts((current) => current.filter((toast) => toast.id !== id));
    }, []);

    const showToast = useCallback((type: ToastType, message: string) => {
        idCounter.current += 1;
        const id = `${Date.now()}-${idCounter.current}`;
        setToasts((current) => [...current, { id, type, message }].slice(-4));

        window.setTimeout(() => {
            setToasts((current) => current.filter((toast) => toast.id !== id));
        }, 3500);
    }, []);

    useEffect(() => {
        setGlobalToast(showToast);
        return () => setGlobalToast(null);
    }, [showToast]);

    return (
        <ToastContext.Provider value={{ toasts, showToast, removeToast }}>
            {children}
            <div
                className="pointer-events-none fixed inset-x-3 top-3 z-[var(--ui-z-toast)] flex flex-col items-end gap-2 sm:left-auto sm:right-4 sm:top-4 sm:w-full sm:max-w-sm"
                aria-live="polite"
                aria-relevant="additions"
            >
                {toasts.map((toast) => (
                    <div key={toast.id} className="pointer-events-auto w-full">
                        <ToastItem toast={toast} onRemove={() => removeToast(toast.id)} />
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}

export function toast(type: ToastType, message: string) {
    if (globalShowToast) {
        globalShowToast(type, message);
        return;
    }
    console.info(`[Toast ${type}]: ${message}`);
}

export const toast_success = (message: string) => toast('success', message);
export const toast_error = (message: string) => toast('error', message);
export const toast_warning = (message: string) => toast('warning', message);
export const toast_info = (message: string) => toast('info', message);
