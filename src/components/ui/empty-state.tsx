import * as React from 'react';
import type { LucideIcon } from 'lucide-react';
import { Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
    title: string;
    description?: string;
    icon?: LucideIcon;
    action?: React.ReactNode;
    compact?: boolean;
}

export function EmptyState({
    title,
    description,
    icon: Icon = Inbox,
    action,
    compact = false,
    className,
    ...props
}: EmptyStateProps) {
    return (
        <div
            className={cn(
                'flex flex-col items-center justify-center text-center',
                compact ? 'py-5' : 'min-h-40 py-8',
                className
            )}
            {...props}
        >
            <div className="flex h-10 w-10 items-center justify-center rounded-[var(--ui-radius-md)] bg-[var(--ui-surface-subtle)]">
                <Icon className="h-5 w-5 text-[var(--ui-text-muted)]" aria-hidden="true" />
            </div>
            <div className="mt-3 font-semibold">{title}</div>
            {description && (
                <p className="mt-1 max-w-md text-sm leading-[var(--ui-leading-normal)] text-[var(--ui-text-muted)]">
                    {description}
                </p>
            )}
            {action && <div className="mt-4">{action}</div>}
        </div>
    );
}
