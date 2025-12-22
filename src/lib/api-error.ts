// API Error Handling Utilities
// Provides consistent error responses and logging for API routes

import { NextResponse } from 'next/server';

interface ApiErrorOptions {
    status?: number;
    logError?: boolean;
    context?: string;
}

/**
 * Create a standardized error response
 */
export function apiError(
    message: string,
    options: ApiErrorOptions = {}
): NextResponse {
    const { status = 500, logError = true, context } = options;

    if (logError) {
        console.error(`[API Error]${context ? ` [${context}]` : ''}: ${message}`);
    }

    return NextResponse.json(
        { error: message },
        { status }
    );
}

/**
 * Wrap async API handlers with consistent error handling
 */
export function withErrorHandler<T>(
    handler: () => Promise<T>,
    context: string
): Promise<T | NextResponse> {
    return handler().catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[API Error] [${context}]:`, error);
        return apiError(message, { context });
    });
}

/**
 * Type guard for checking if error has message
 */
export function isErrorWithMessage(error: unknown): error is { message: string } {
    return (
        typeof error === 'object' &&
        error !== null &&
        'message' in error &&
        typeof (error as Record<string, unknown>).message === 'string'
    );
}

/**
 * Safely extract error message
 */
export function getErrorMessage(error: unknown): string {
    if (isErrorWithMessage(error)) {
        return error.message;
    }
    if (typeof error === 'string') {
        return error;
    }
    return 'An unknown error occurred';
}

// Common HTTP error responses
export const HttpErrors = {
    badRequest: (msg = 'Bad Request') => apiError(msg, { status: 400, logError: false }),
    unauthorized: (msg = 'Unauthorized') => apiError(msg, { status: 401, logError: false }),
    forbidden: (msg = 'Forbidden') => apiError(msg, { status: 403, logError: false }),
    notFound: (msg = 'Not Found') => apiError(msg, { status: 404, logError: false }),
    conflict: (msg = 'Conflict') => apiError(msg, { status: 409, logError: false }),
    internal: (msg = 'Internal Server Error') => apiError(msg, { status: 500 }),
};
