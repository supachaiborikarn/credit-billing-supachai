import * as React from 'react';
import {
    AlertCircle,
    AlertTriangle,
    CheckCircle2,
    Info,
    type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type NoticeTone = 'info' | 'success' | 'warning' | 'danger';

export interface NoticeProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
    tone?: NoticeTone;
    title?: React.ReactNode;
    icon?: LucideIcon;
    action?: React.ReactNode;
}

const toneStyles: Record<NoticeTone, { surface: string; text: string; icon: LucideIcon }> = {
    info: {
        surface: 'border-[var(--ui-info)]/20 bg-[var(--ui-info-soft)]',
        text: 'text-[var(--ui-info-text)]',
        icon: Info,
    },
    success: {
        surface: 'border-[var(--ui-success)]/20 bg-[var(--ui-success-soft)]',
        text: 'text-[var(--ui-success-text)]',
        icon: CheckCircle2,
    },
    warning: {
        surface: 'border-[var(--ui-warning)]/20 bg-[var(--ui-warning-soft)]',
        text: 'text-[var(--ui-warning-text)]',
        icon: AlertTriangle,
    },
    danger: {
        surface: 'border-[var(--ui-danger)]/20 bg-[var(--ui-danger-soft)]',
        text: 'text-[var(--ui-danger-text)]',
        icon: AlertCircle,
    },
};

export function Notice({
    tone = 'info',
    title,
    icon,
    action,
    children,
    className,
    ...props
}: NoticeProps) {
    const styles = toneStyles[tone];
    const Icon = icon || styles.icon;

    return (
        <div
            className={cn(
                'flex items-start gap-3 rounded-[var(--ui-radius-md)] border p-3',
                styles.surface,
                className
            )}
            role={tone === 'danger' ? 'alert' : undefined}
            {...props}
        >
            <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', styles.text)} aria-hidden="true" />
            <div className="min-w-0 flex-1">
                {title && <div className={cn('font-semibold', styles.text)}>{title}</div>}
                {children && (
                    <div className={cn(title ? 'mt-1' : '', 'text-sm leading-[var(--ui-leading-normal)] text-[var(--ui-text-secondary)]')}>
                        {children}
                    </div>
                )}
            </div>
            {action && <div className="shrink-0">{action}</div>}
        </div>
    );
}
