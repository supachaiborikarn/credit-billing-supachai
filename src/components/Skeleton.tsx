'use client';

import React from 'react';

interface SkeletonProps {
    className?: string;
    variant?: 'text' | 'circular' | 'rectangular' | 'rounded';
    width?: string | number;
    height?: string | number;
    animation?: 'pulse' | 'wave' | 'none';
}

/**
 * Skeleton component for loading states
 * Provides visual feedback while content is loading
 */
export function Skeleton({
    className = '',
    variant = 'text',
    width,
    height,
    animation = 'pulse',
}: SkeletonProps) {
    const baseClasses = 'bg-gray-200 dark:bg-gray-700';

    const variantClasses = {
        text: 'rounded',
        circular: 'rounded-full',
        rectangular: 'rounded-none',
        rounded: 'rounded-xl',
    };

    const animationClasses = {
        pulse: 'animate-pulse',
        wave: 'animate-shimmer bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700 bg-[length:200%_100%]',
        none: '',
    };

    const style: React.CSSProperties = {
        width: width ? (typeof width === 'number' ? `${width}px` : width) : undefined,
        height: height ? (typeof height === 'number' ? `${height}px` : height) : variant === 'text' ? '1em' : undefined,
    };

    return (
        <div
            className={`${baseClasses} ${variantClasses[variant]} ${animationClasses[animation]} ${className}`}
            style={style}
            aria-hidden="true"
        />
    );
}

// Pre-built skeleton patterns for common use cases

export function SkeletonCard() {
    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
            <div className="flex items-center gap-3">
                <Skeleton variant="circular" width={40} height={40} />
                <div className="flex-1 space-y-2">
                    <Skeleton width="60%" height={16} />
                    <Skeleton width="40%" height={12} />
                </div>
            </div>
            <Skeleton variant="rounded" height={60} />
            <div className="flex gap-2">
                <Skeleton variant="rounded" width={80} height={32} />
                <Skeleton variant="rounded" width={80} height={32} />
            </div>
        </div>
    );
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-4 p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                <Skeleton width="15%" height={14} />
                <Skeleton width="25%" height={14} />
                <Skeleton width="20%" height={14} />
                <Skeleton width="15%" height={14} />
                <Skeleton width="15%" height={14} />
            </div>
            {/* Rows */}
            {Array.from({ length: rows }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-4 border-b border-gray-100 dark:border-gray-800 last:border-b-0">
                    <Skeleton width="15%" height={14} />
                    <Skeleton width="25%" height={14} />
                    <Skeleton width="20%" height={14} />
                    <Skeleton width="15%" height={14} />
                    <Skeleton width="15%" height={14} />
                </div>
            ))}
        </div>
    );
}

export function SkeletonStats({ count = 4 }: { count?: number }) {
    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4">
                    <Skeleton width="60%" height={12} className="mb-2" />
                    <Skeleton width="80%" height={28} className="mb-1" />
                    <Skeleton width="40%" height={10} />
                </div>
            ))}
        </div>
    );
}

export function SkeletonList({ items = 5 }: { items?: number }) {
    return (
        <div className="space-y-3">
            {Array.from({ length: items }).map((_, i) => (
                <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 flex items-center gap-4">
                    <Skeleton variant="circular" width={48} height={48} />
                    <div className="flex-1 space-y-2">
                        <Skeleton width="70%" height={16} />
                        <Skeleton width="50%" height={12} />
                    </div>
                    <Skeleton variant="rounded" width={60} height={24} />
                </div>
            ))}
        </div>
    );
}

export function SkeletonTransaction() {
    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                    <Skeleton variant="circular" width={36} height={36} />
                    <div className="space-y-1.5">
                        <Skeleton width={120} height={16} />
                        <Skeleton width={80} height={12} />
                    </div>
                </div>
                <div className="text-right space-y-1.5">
                    <Skeleton width={100} height={20} />
                    <Skeleton width={60} height={14} />
                </div>
            </div>
            <div className="flex gap-2 pt-3 border-t border-gray-100 dark:border-gray-700">
                <Skeleton variant="rounded" width={70} height={28} />
                <Skeleton variant="rounded" width={70} height={28} />
            </div>
        </div>
    );
}

export function SkeletonChart() {
    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-6">
                <Skeleton width={150} height={20} />
                <div className="flex gap-2">
                    <Skeleton variant="rounded" width={80} height={32} />
                    <Skeleton variant="rounded" width={80} height={32} />
                </div>
            </div>
            <div className="h-64 flex items-end gap-2">
                {Array.from({ length: 12 }).map((_, i) => (
                    <Skeleton
                        key={i}
                        variant="rounded"
                        className="flex-1"
                        height={`${Math.random() * 60 + 20}%`}
                    />
                ))}
            </div>
        </div>
    );
}
