import * as React from 'react';
import { cn } from '@/lib/utils';

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
    requiredMark?: boolean;
}

const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
    ({ className, requiredMark = false, children, ...props }, ref) => (
        <label
            ref={ref}
            className={cn(
                'mb-1.5 block text-sm font-semibold leading-[var(--ui-leading-heading)] text-[var(--ui-text)]',
                className
            )}
            {...props}
        >
            {children}
            {requiredMark && (
                <span className="ml-1 text-[var(--ui-danger)]" aria-hidden="true">
                    *
                </span>
            )}
        </label>
    )
);
Label.displayName = 'Label';

export interface FieldMessageProps extends React.HTMLAttributes<HTMLParagraphElement> {
    variant?: 'helper' | 'error';
}

const FieldMessage = React.forwardRef<HTMLParagraphElement, FieldMessageProps>(
    ({ className, variant = 'helper', ...props }, ref) => (
        <p
            ref={ref}
            className={cn(
                'mt-1.5 text-sm leading-[var(--ui-leading-normal)]',
                variant === 'error'
                    ? 'font-medium text-[var(--ui-danger)]'
                    : 'text-[var(--ui-text-muted)]',
                className
            )}
            {...props}
        />
    )
);
FieldMessage.displayName = 'FieldMessage';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    helperText?: string;
    requiredMark?: boolean;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
    (
        {
            className,
            type,
            id,
            label,
            error,
            helperText,
            requiredMark = false,
            required,
            leftIcon,
            rightIcon,
            'aria-describedby': ariaDescribedBy,
            ...props
        },
        ref
    ) => {
        const generatedId = React.useId();
        const inputId = id || generatedId;
        const helperId = helperText && !error ? `${inputId}-helper` : undefined;
        const errorId = error ? `${inputId}-error` : undefined;
        const describedBy = [ariaDescribedBy, errorId || helperId].filter(Boolean).join(' ') || undefined;

        return (
            <div className="w-full">
                {label && (
                    <Label htmlFor={inputId} requiredMark={requiredMark || required}>
                        {label}
                    </Label>
                )}

                <div className="relative">
                    {leftIcon && (
                        <span className="pointer-events-none absolute inset-y-0 left-0 flex w-10 items-center justify-center text-[var(--ui-text-muted)]">
                            {leftIcon}
                        </span>
                    )}
                    <input
                        ref={ref}
                        id={inputId}
                        type={type}
                        required={required}
                        aria-required={required || requiredMark || undefined}
                        aria-invalid={error ? true : undefined}
                        aria-describedby={describedBy}
                        className={cn(
                            'flex h-[var(--ui-control-md)] w-full rounded-[var(--ui-radius-md)] border px-3 text-base',
                            'bg-[var(--ui-surface)] text-[var(--ui-text)] placeholder:text-[var(--ui-text-muted)]',
                            'transition-[background-color,border-color,box-shadow] duration-150',
                            'focus:outline-none focus:shadow-[var(--ui-shadow-focus)]',
                            'disabled:cursor-not-allowed disabled:bg-[var(--ui-surface-subtle)] disabled:text-[var(--ui-text-muted)] disabled:opacity-70',
                            leftIcon && 'pl-10',
                            rightIcon && 'pr-10',
                            error
                                ? 'border-[var(--ui-danger)] focus:border-[var(--ui-danger)]'
                                : 'border-[var(--ui-border-strong)] focus:border-[var(--ui-primary-500)]',
                            className
                        )}
                        {...props}
                    />
                    {rightIcon && (
                        <span className="pointer-events-none absolute inset-y-0 right-0 flex w-10 items-center justify-center text-[var(--ui-text-muted)]">
                            {rightIcon}
                        </span>
                    )}
                </div>

                {error && (
                    <FieldMessage id={errorId} variant="error" role="alert" aria-live="polite">
                        {error}
                    </FieldMessage>
                )}

                {helperText && !error && (
                    <FieldMessage id={helperId}>
                        {helperText}
                    </FieldMessage>
                )}
            </div>
        );
    }
);
Input.displayName = 'Input';

export { Input, Label, FieldMessage };
