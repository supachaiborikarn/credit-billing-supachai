import { describe, expect, it, vi } from 'vitest';
import { isRetryablePrismaReadError, withPrismaReadRetry } from '../src/lib/prisma-read-retry';

describe('Prisma read retry', () => {
    it.each(['P1001', 'P2024'])('recognizes retryable Prisma code %s', (code) => {
        expect(isRetryablePrismaReadError({ code })).toBe(true);
    });

    it.each(['P2002', 'P2025', undefined, null])('does not retry unrelated error code %s', (code) => {
        expect(isRetryablePrismaReadError(code ? { code } : code)).toBe(false);
    });

    it('returns first successful result without retrying', async () => {
        const operation = vi.fn().mockResolvedValue('ok');

        await expect(withPrismaReadRetry(operation, { delayMs: 0 })).resolves.toBe('ok');
        expect(operation).toHaveBeenCalledTimes(1);
    });

    it.each(['P1001', 'P2024'])('retries once after %s and returns the second result', async (code) => {
        const operation = vi.fn()
            .mockRejectedValueOnce(Object.assign(new Error('transient'), { code }))
            .mockResolvedValueOnce('recovered');

        await expect(withPrismaReadRetry(operation, { delayMs: 0 })).resolves.toBe('recovered');
        expect(operation).toHaveBeenCalledTimes(2);
    });

    it('does not retry non-connection Prisma errors', async () => {
        const error = Object.assign(new Error('validation'), { code: 'P2002' });
        const operation = vi.fn().mockRejectedValue(error);

        await expect(withPrismaReadRetry(operation, { delayMs: 0 })).rejects.toBe(error);
        expect(operation).toHaveBeenCalledTimes(1);
    });

    it('propagates the second failure without a third attempt', async () => {
        const first = Object.assign(new Error('cold connection'), { code: 'P1001' });
        const second = Object.assign(new Error('still unavailable'), { code: 'P1001' });
        const operation = vi.fn().mockRejectedValueOnce(first).mockRejectedValueOnce(second);

        await expect(withPrismaReadRetry(operation, { delayMs: 0 })).rejects.toBe(second);
        expect(operation).toHaveBeenCalledTimes(2);
    });
});
