const RETRYABLE_PRISMA_READ_CODES = new Set(['P1001', 'P2024']);

function getPrismaErrorCode(error: unknown): string | null {
    if (!error || typeof error !== 'object' || !('code' in error)) return null;
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' ? code : null;
}

export function isRetryablePrismaReadError(error: unknown): boolean {
    const code = getPrismaErrorCode(error);
    return code !== null && RETRYABLE_PRISMA_READ_CODES.has(code);
}

export async function withPrismaReadRetry<T>(
    operation: () => Promise<T>,
    options: { delayMs?: number } = {}
): Promise<T> {
    try {
        return await operation();
    } catch (error) {
        if (!isRetryablePrismaReadError(error)) throw error;

        const delayMs = options.delayMs ?? 150;
        if (delayMs > 0) {
            await new Promise((resolve) => setTimeout(resolve, delayMs));
        }

        return operation();
    }
}
