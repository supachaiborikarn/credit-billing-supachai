'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Button } from './button';
import { cn } from '@/lib/utils';

export interface DialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: React.ReactNode;
    description?: React.ReactNode;
    children: React.ReactNode;
    footer?: React.ReactNode;
    size?: 'sm' | 'md' | 'lg';
    closeLabel?: string;
    closeOnBackdrop?: boolean;
    className?: string;
}

const sizeClasses = {
    sm: 'sm:max-w-md',
    md: 'sm:max-w-xl',
    lg: 'sm:max-w-2xl',
} as const;

export function Dialog({
    open,
    onOpenChange,
    title,
    description,
    children,
    footer,
    size = 'md',
    closeLabel = 'ปิด',
    closeOnBackdrop = true,
    className,
}: DialogProps) {
    const titleId = React.useId();
    const descriptionId = React.useId();
    const panelRef = React.useRef<HTMLDivElement>(null);
    const previousFocusRef = React.useRef<HTMLElement | null>(null);
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => setMounted(true), []);

    React.useEffect(() => {
        if (!open) return;

        previousFocusRef.current = document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const focusTimer = window.setTimeout(() => {
            const target = panelRef.current?.querySelector<HTMLElement>(
                '[data-autofocus], button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
            );
            (target || panelRef.current)?.focus();
        }, 0);

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                onOpenChange(false);
                return;
            }

            if (event.key !== 'Tab' || !panelRef.current) return;
            const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(
                'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
            ));
            if (focusable.length === 0) {
                event.preventDefault();
                panelRef.current.focus();
                return;
            }

            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => {
            window.clearTimeout(focusTimer);
            document.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = previousOverflow;
            previousFocusRef.current?.focus();
        };
    }, [open, onOpenChange]);

    if (!mounted || !open) return null;

    return createPortal(
        <div
            className="fixed inset-0 z-[var(--ui-z-modal)] flex items-end justify-center bg-[var(--ui-overlay)] p-0 sm:items-center sm:p-4"
            onMouseDown={(event) => {
                if (closeOnBackdrop && event.target === event.currentTarget) {
                    onOpenChange(false);
                }
            }}
        >
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={description ? descriptionId : undefined}
                tabIndex={-1}
                className={cn(
                    'flex max-h-[90vh] w-full flex-col rounded-t-[var(--ui-radius-lg)] border focus:outline-none border-[var(--ui-border)] bg-[var(--ui-surface)] text-[var(--ui-text)] shadow-[var(--ui-shadow-md)] sm:rounded-[var(--ui-radius-lg)]',
                    sizeClasses[size],
                    className
                )}
            >
                <div className="flex items-start justify-between gap-3 border-b border-[var(--ui-border)] px-4 py-4 sm:px-5">
                    <div className="min-w-0">
                        <h2 id={titleId} className="text-lg font-bold leading-[var(--ui-leading-heading)]">
                            {title}
                        </h2>
                        {description && (
                            <div id={descriptionId} className="mt-1 text-sm text-[var(--ui-text-muted)]">
                                {description}
                            </div>
                        )}
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onOpenChange(false)}
                        aria-label={closeLabel}
                        className="-mr-2 -mt-2 shrink-0"
                    >
                        <X className="h-5 w-5" aria-hidden="true" />
                    </Button>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">{children}</div>

                {footer && (
                    <div className="flex flex-col-reverse gap-2 border-t border-[var(--ui-border)] p-4 sm:flex-row sm:justify-end sm:px-5">
                        {footer}
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
}

export interface ConfirmDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: React.ReactNode;
    description?: React.ReactNode;
    children?: React.ReactNode;
    confirmLabel?: string;
    cancelLabel?: string;
    tone?: 'default' | 'danger';
    onConfirm: () => void | Promise<void>;
}

export function ConfirmDialog({
    open,
    onOpenChange,
    title,
    description,
    children,
    confirmLabel = 'ยืนยัน',
    cancelLabel = 'ยกเลิก',
    tone = 'default',
    onConfirm,
}: ConfirmDialogProps) {
    const [submitting, setSubmitting] = React.useState(false);

    React.useEffect(() => {
        if (!open) setSubmitting(false);
    }, [open]);

    const handleConfirm = async () => {
        setSubmitting(true);
        try {
            await onConfirm();
            onOpenChange(false);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog
            open={open}
            onOpenChange={(nextOpen) => {
                if (!submitting) onOpenChange(nextOpen);
            }}
            title={title}
            description={description}
            size="sm"
            closeOnBackdrop={!submitting}
            footer={
                <>
                    <Button variant="outline" disabled={submitting} onClick={() => onOpenChange(false)}>
                        {cancelLabel}
                    </Button>
                    <Button
                        variant={tone === 'danger' ? 'destructive' : 'default'}
                        loading={submitting}
                        onClick={() => void handleConfirm()}
                        data-autofocus
                    >
                        {confirmLabel}
                    </Button>
                </>
            }
        >
            {children || null}
        </Dialog>
    );
}
