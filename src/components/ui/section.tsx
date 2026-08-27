import * as React from 'react';
import { cn } from '@/lib/utils';

export interface SectionProps extends Omit<React.HTMLAttributes<HTMLElement>, 'title'> {
    title: React.ReactNode;
    description?: React.ReactNode;
    action?: React.ReactNode;
    contentClassName?: string;
}

export function Section({
    title,
    description,
    action,
    children,
    className,
    contentClassName,
    ...props
}: SectionProps) {
    return (
        <section
            className={cn(
                'rounded-[var(--ui-radius-lg)] border border-[var(--ui-border)] bg-[var(--ui-surface)]',
                className
            )}
            {...props}
        >
            <div className="flex items-start justify-between gap-3 border-b border-[var(--ui-border)] px-4 py-3 sm:px-5">
                <div className="min-w-0">
                    <h2 className="font-bold leading-[var(--ui-leading-heading)]">{title}</h2>
                    {description && (
                        <div className="mt-1 text-sm leading-[var(--ui-leading-normal)] text-[var(--ui-text-muted)]">
                            {description}
                        </div>
                    )}
                </div>
                {action && <div className="shrink-0">{action}</div>}
            </div>
            <div className={cn('p-4 sm:p-5', contentClassName)}>{children}</div>
        </section>
    );
}
