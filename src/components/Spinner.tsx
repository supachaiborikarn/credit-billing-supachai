'use client';

interface SpinnerProps {
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
};

/**
 * Reusable loading spinner component
 */
export default function Spinner({ size = 'md', className = '' }: SpinnerProps) {
    return (
        <div className={`spinner ${sizeClasses[size]} ${className}`} />
    );
}

/**
 * Full-page loading state
 */
export function LoadingState() {
    return (
        <div className="flex items-center justify-center h-64">
            <Spinner size="lg" />
        </div>
    );
}
