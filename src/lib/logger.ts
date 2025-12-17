type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
    level: LogLevel;
    message: string;
    code?: string;
    correlationId?: string;
    data?: Record<string, unknown>;
    timestamp: string;
}

const LOG_LEVELS: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};

const MIN_LOG_LEVEL = (process.env.LOG_LEVEL as LogLevel) || 'info';

function formatLog(entry: LogEntry): string {
    const parts = [
        `[${entry.timestamp}]`,
        `[${entry.level.toUpperCase()}]`,
    ];

    if (entry.code) parts.push(`[${entry.code}]`);
    if (entry.correlationId) parts.push(`[${entry.correlationId}]`);

    parts.push(entry.message);

    return parts.join(' ');
}

function shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[MIN_LOG_LEVEL];
}

function log(level: LogLevel, message: string, options?: { code?: string; correlationId?: string; data?: Record<string, unknown> }) {
    if (!shouldLog(level)) return;

    const entry: LogEntry = {
        level,
        message,
        code: options?.code,
        correlationId: options?.correlationId,
        data: options?.data,
        timestamp: new Date().toISOString(),
    };

    const formattedMessage = formatLog(entry);

    switch (level) {
        case 'debug':
        case 'info':
            console.log(formattedMessage, options?.data ? JSON.stringify(options.data) : '');
            break;
        case 'warn':
            console.warn(formattedMessage, options?.data ? JSON.stringify(options.data) : '');
            break;
        case 'error':
            console.error(formattedMessage, options?.data ? JSON.stringify(options.data) : '');
            break;
    }

    return entry;
}

export const logger = {
    debug: (message: string, options?: { code?: string; correlationId?: string; data?: Record<string, unknown> }) =>
        log('debug', message, options),
    info: (message: string, options?: { code?: string; correlationId?: string; data?: Record<string, unknown> }) =>
        log('info', message, options),
    warn: (message: string, options?: { code?: string; correlationId?: string; data?: Record<string, unknown> }) =>
        log('warn', message, options),
    error: (message: string, options?: { code?: string; correlationId?: string; data?: Record<string, unknown> }) =>
        log('error', message, options),
};

// Error codes for consistent error handling
export const ErrorCodes = {
    // Auth errors
    AUTH_NO_SESSION: 'AUTH001',
    AUTH_INVALID_SESSION: 'AUTH002',
    AUTH_SESSION_EXPIRED: 'AUTH003',
    AUTH_INVALID_CREDENTIALS: 'AUTH004',

    // Validation errors
    VALIDATION_FAILED: 'VAL001',
    DUPLICATE_ENTRY: 'VAL002',

    // Database errors
    DB_CONNECTION_ERROR: 'DB001',
    DB_QUERY_ERROR: 'DB002',

    // Transaction errors
    TX_CREATE_FAILED: 'TX001',
    TX_UPDATE_FAILED: 'TX002',
    TX_DELETE_FAILED: 'TX003',

    // General errors
    INTERNAL_ERROR: 'ERR001',
    NOT_FOUND: 'ERR404',
};

export function generateCorrelationId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}
