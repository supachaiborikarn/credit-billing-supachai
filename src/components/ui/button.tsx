import * as React from 'react';
import { cn } from '@/lib/utils';

const buttonVariants = {
    variant: {
        default: 'bg-[var(--ui-primary-700)] text-white hover:bg-[var(--ui-primary-800)] active:bg-[var(--ui-primary-900)]',
        destructive: 'bg-[var(--ui-danger-action)] text-white hover:brightness-95 active:brightness-90',
        outline: 'border border-[var(--ui-border-strong)] bg-[var(--ui-surface)] text-[var(--ui-text)] hover:bg-[var(--ui-surface-subtle)]',
        secondary: 'bg-[var(--ui-surface-subtle)] text-[var(--ui-text)] hover:brightness-95',
        ghost: 'bg-transparent text-[var(--ui-text-secondary)] hover:bg-[var(--ui-surface-subtle)] hover:text-[var(--ui-text)]',
        link: 'h-auto bg-transparent p-0 text-[var(--ui-primary-text)] underline-offset-4 hover:underline',
        success: 'bg-[var(--ui-success-action)] text-white hover:brightness-95 active:brightness-90',
        warning: 'bg-[var(--ui-warning-action)] text-white hover:brightness-95 active:brightness-90',
    },
    size: {
        default: 'h-[var(--ui-control-md)] px-4 text-sm',
        sm: 'h-[var(--ui-control-sm)] px-3 text-sm',
        lg: 'h-[var(--ui-control-lg)] px-5 text-base',
        icon: 'h-[var(--ui-control-md)] w-[var(--ui-control-md)] p-0',
    },
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: keyof typeof buttonVariants.variant;
    size?: keyof typeof buttonVariants.size;
    loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    (
        {
            className,
            variant = 'default',
            size = 'default',
            loading = false,
            disabled,
            children,
            type = 'button',
            ...props
        },
        ref
    ) => {
        return (
            <button
                ref={ref}
                type={type}
                disabled={disabled || loading}
                aria-busy={loading || undefined}
                className={cn(
                    'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap',
                    'rounded-[var(--ui-radius-md)] font-semibold leading-none',
                    'transition-[background-color,border-color,color,box-shadow,opacity] duration-150',
                    'focus-visible:outline-none focus-visible:shadow-[var(--ui-shadow-focus)]',
                    'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
                    buttonVariants.variant[variant],
                    buttonVariants.size[size],
                    className
                )}
                {...props}
            >
                {loading && (
                    <svg
                        className="h-4 w-4 animate-spin"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                    >
                        <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                            fill="none"
                        />
                        <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                    </svg>
                )}
                {children}
            </button>
        );
    }
);

Button.displayName = 'Button';

export { Button, buttonVariants };
