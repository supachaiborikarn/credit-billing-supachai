import * as React from 'react';
import { ChevronRight, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export interface ResponsiveDataViewProps extends React.HTMLAttributes<HTMLDivElement> {
    desktop: React.ReactNode;
    mobile: React.ReactNode;
    breakpoint?: 'sm' | 'md' | 'lg';
}

const breakpointClasses = {
    sm: { desktop: 'hidden sm:block', mobile: 'sm:hidden' },
    md: { desktop: 'hidden md:block', mobile: 'md:hidden' },
    lg: { desktop: 'hidden lg:block', mobile: 'lg:hidden' },
} as const;

export function ResponsiveDataView({
    desktop,
    mobile,
    breakpoint = 'md',
    className,
    ...props
}: ResponsiveDataViewProps) {
    const classes = breakpointClasses[breakpoint];

    return (
        <div className={className} {...props}>
            <div className={classes.desktop}>{desktop}</div>
            <div className={classes.mobile}>{mobile}</div>
        </div>
    );
}

export interface MobileDataRowProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
    title: React.ReactNode;
    description?: React.ReactNode;
    leadingIcon?: LucideIcon;
    leading?: React.ReactNode;
    meta?: React.ReactNode;
    value?: React.ReactNode;
    href?: string;
    action?: React.ReactNode;
}

export function MobileDataRow({
    title,
    description,
    leadingIcon: LeadingIcon,
    leading,
    meta,
    value,
    href,
    action,
    className,
    ...props
}: MobileDataRowProps) {
    const content = (
        <div
            className={cn(
                'flex min-h-[var(--ui-touch-target)] items-center gap-3 px-3 py-3',
                className
            )}
            {...props}
        >
            {(LeadingIcon || leading) && (
                <div className="shrink-0">
                    {leading || (
                        <div className="flex h-9 w-9 items-center justify-center rounded-[var(--ui-radius-md)] bg-[var(--ui-surface-subtle)]">
                            {LeadingIcon && <LeadingIcon className="h-4 w-4 text-[var(--ui-text-muted)]" aria-hidden="true" />}
                        </div>
                    )}
                </div>
            )}

            <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-[var(--ui-text)]">{title}</div>
                {description && (
                    <div className="mt-0.5 line-clamp-2 text-xs text-[var(--ui-text-muted)]">{description}</div>
                )}
                {meta && <div className="mt-1 text-xs text-[var(--ui-text-muted)]">{meta}</div>}
            </div>

            {value && (
                <div className="shrink-0 text-right text-sm font-bold tabular-nums text-[var(--ui-text)]">
                    {value}
                </div>
            )}

            {action || (href && <ChevronRight className="h-4 w-4 shrink-0 text-[var(--ui-text-muted)]" aria-hidden="true" />)}
        </div>
    );

    if (!href) return content;

    return (
        <Link href={href} className="block rounded-[var(--ui-radius-md)] hover:bg-[var(--ui-surface-subtle)] focus-visible:outline-none focus-visible:shadow-[var(--ui-shadow-focus)]">
            {content}
        </Link>
    );
}

export function MobileDataList({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cn(
                'divide-y divide-[var(--ui-border)] overflow-hidden rounded-[var(--ui-radius-md)] border border-[var(--ui-border)] bg-[var(--ui-surface)]',
                className
            )}
            {...props}
        />
    );
}

export interface RowActionProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    icon?: LucideIcon;
}

export function RowAction({ icon: Icon, children, className, ...props }: RowActionProps) {
    return (
        <button
            type="button"
            className={cn(
                'inline-flex min-h-9 items-center justify-center gap-1.5 rounded-[var(--ui-radius-sm)] px-2.5 text-xs font-semibold text-[var(--ui-text-secondary)] transition-colors hover:bg-[var(--ui-surface-subtle)] hover:text-[var(--ui-text)] focus-visible:outline-none focus-visible:shadow-[var(--ui-shadow-focus)]',
                className
            )}
            {...props}
        >
            {Icon && <Icon className="h-4 w-4" aria-hidden="true" />}
            {children}
        </button>
    );
}
