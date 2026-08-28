import { describe, expect, it } from 'vitest';
import { UAT_WRITE_CONFIRMATION, validateUatDatabaseConfig } from '../scripts/uat-db-guard.mjs';

const prod = 'postgresql://user:secret@ep-production.example.neon.tech/neondb?sslmode=require';
const uat = 'postgresql://user:secret@ep-uat.example.neon.tech/neondb?sslmode=require';

describe('UAT database guard', () => {
    it('rejects a missing UAT database', () => {
        const result = validateUatDatabaseConfig({ productionUrl: prod, uatUrl: '', confirmation: UAT_WRITE_CONFIRMATION });
        expect(result.ok).toBe(false);
        expect(result.errors.some((message) => message.includes('UAT_DATABASE_URL is missing'))).toBe(true);
    });

    it('rejects the same production host even with another database name', () => {
        const result = validateUatDatabaseConfig({
            productionUrl: prod,
            uatUrl: 'postgresql://user:secret@ep-production.example.neon.tech/uat?sslmode=require',
            confirmation: UAT_WRITE_CONFIRMATION,
        });
        expect(result.ok).toBe(false);
        expect(result.errors.some((message) => message.includes('different database host/branch'))).toBe(true);
    });

    it('rejects write mode without the explicit confirmation phrase', () => {
        const result = validateUatDatabaseConfig({ productionUrl: prod, uatUrl: uat, confirmation: 'yes' });
        expect(result.ok).toBe(false);
        expect(result.errors.some((message) => message.includes('UAT_WRITE_ENABLED'))).toBe(true);
    });

    it('accepts a distinct PostgreSQL host with explicit UAT confirmation', () => {
        const result = validateUatDatabaseConfig({ productionUrl: prod, uatUrl: uat, confirmation: UAT_WRITE_CONFIRMATION });
        expect(result.ok).toBe(true);
        expect(result.summary.uat).toEqual({ host: 'ep-uat.example.neon.tech', database: 'neondb' });
    });
});

describe('UAT dev port guard', () => {
    it('uses 3005 by default and never allows reserved port 3000', async () => {
        const { resolveUatPort } = await import('../scripts/start-uat-dev.mjs');
        expect(resolveUatPort(undefined)).toBe(3005);
        expect(() => resolveUatPort('3000')).toThrow(/reserved/);
        expect(() => resolveUatPort('not-a-port')).toThrow(/integer/);
    });
});
