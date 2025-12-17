import { describe, it, expect, vi, beforeEach } from 'vitest'
import { validateEnv, ensureEnv } from '../src/lib/env'

describe('Environment Validation', () => {
    beforeEach(() => {
        // Clear all env vars before each test
        vi.unstubAllEnvs()
    })

    it('should pass when DATABASE_URL is set', () => {
        vi.stubEnv('DATABASE_URL', 'postgresql://test:test@localhost:5432/test')

        const result = validateEnv()

        expect(result.valid).toBe(true)
        expect(result.missing).toHaveLength(0)
    })

    it('should fail when DATABASE_URL is missing', () => {
        vi.stubEnv('DATABASE_URL', '')

        const result = validateEnv()

        expect(result.valid).toBe(false)
        expect(result.missing).toContain('DATABASE_URL')
    })

    it('should throw when ensureEnv fails', () => {
        vi.stubEnv('DATABASE_URL', '')

        expect(() => ensureEnv()).toThrow('Missing required environment variables')
    })
})
