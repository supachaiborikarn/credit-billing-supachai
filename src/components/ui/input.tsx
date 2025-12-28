import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps
    extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    helperText?: string;
}

/**
 * Input Component - ช่องกรอกข้อมูล
 * 
 * @example
 * <Input label="ชื่อ" placeholder="กรอกชื่อ" />
 * <Input type="number" error="กรุณากรอกตัวเลข" />
 */
const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className, type, label, error, helperText, ...props }, ref) => {
        return (
            <div className="w-full">
                {label && (
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                        {label}
                    </label>
                )}
                <input
                    type={type}
                    className={cn(
                        'flex h-10 w-full rounded-md border bg-white px-3 py-2 text-sm',
                        'placeholder:text-gray-400',
                        'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
                        'disabled:cursor-not-allowed disabled:opacity-50',
                        error
                            ? 'border-red-500 focus:ring-red-500'
                            : 'border-gray-300',
                        className
                    )}
                    ref={ref}
                    {...props}
                />
                {error && (
                    <p className="mt-1 text-sm text-red-600">{error}</p>
                )}
                {helperText && !error && (
                    <p className="mt-1 text-sm text-gray-500">{helperText}</p>
                )}
            </div>
        );
    }
);
Input.displayName = 'Input';

export { Input };
