'use client';

import { SkeletonTable, SkeletonStats, SkeletonCard } from './Skeleton';

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
 * Full-page loading state with spinner
 */
export function LoadingState() {
    return (
        <div className="flex items-center justify-center h-64">
            <Spinner size="lg" />
        </div>
    );
}

/**
 * Skeleton loading state for tables - better visual feedback
 */
export function TableLoadingState({ rows = 5 }: { rows?: number }) {
    return <SkeletonTable rows={rows} />;
}

/**
 * Skeleton loading state for stats cards
 */
export function StatsLoadingState({ count = 4 }: { count?: number }) {
    return <SkeletonStats count={count} />;
}

/**
 * Skeleton loading state for cards
 */
export function CardLoadingState() {
    return (
        <div className="space-y-4">
            <SkeletonCard />
            <SkeletonCard />
        </div>
    );
}
