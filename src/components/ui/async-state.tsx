import * as React from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from './button';
import { Notice } from './notice';
import { cn } from '@/lib/utils';

export interface LoadingStateProps extends React.HTMLAttributes<HTMLDivElement> {
    label: string;
}

export function LoadingState({ label, className, children, ...props }: LoadingStateProps) {
    return (
        <div
            role="status"
            aria-live="polite"
            aria-busy="true"
            aria-label={label}
            className={cn('space-y-3', className)}
            {...props}
        >
            {children}
        </div>
    );
}

export interface AsyncRefreshStateProps {
    loading: boolean;
    error?: string | null;
    onRetry: () => void;
    loadingLabel?: string;
    errorTitle?: string;
    staleLabel?: string;
}

export function AsyncRefreshState({
    loading,
    error,
    onRetry,
    loadingLabel = 'กำลังอัปเดตข้อมูล…',
    errorTitle = 'อัปเดตข้อมูลไม่สำเร็จ',
    staleLabel = 'กำลังแสดงข้อมูลล่าสุดที่โหลดสำเร็จ',
}: AsyncRefreshStateProps) {
    if (loading) {
        return (
            <Notice tone="info" role="status" aria-live="polite" aria-busy="true">
                {loadingLabel}
            </Notice>
        );
    }

    if (!error) return null;

    return (
        <Notice
            tone="warning"
            title={errorTitle}
            action={(
                <Button variant="outline" size="sm" onClick={onRetry}>
                    <RefreshCw className="h-4 w-4" aria-hidden="true" />
                    ลองใหม่
                </Button>
            )}
        >
            {staleLabel} · {error}
        </Notice>
    );
}

export interface FatalErrorStateProps {
    title: string;
    message: string;
    onRetry: () => void;
    retryLabel?: string;
}

export function FatalErrorState({
    title,
    message,
    onRetry,
    retryLabel = 'ลองใหม่',
}: FatalErrorStateProps) {
    return (
        <Notice
            tone="danger"
            title={title}
            action={(
                <Button variant="outline" onClick={onRetry}>
                    <RefreshCw className="h-4 w-4" aria-hidden="true" />
                    {retryLabel}
                </Button>
            )}
        >
            {message}
        </Notice>
    );
}
