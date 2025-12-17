import { describe, it, expect } from 'vitest'
import { logger, ErrorCodes, generateCorrelationId } from '../src/lib/logger'

describe('Logger', () => {
    it('should generate unique correlation IDs', () => {
        const id1 = generateCorrelationId()
        const id2 = generateCorrelationId()

        expect(id1).not.toBe(id2)
        expect(id1.length).toBeGreaterThan(10)
    })

    it('should have all error codes defined', () => {
        expect(ErrorCodes.AUTH_NO_SESSION).toBe('AUTH001')
        expect(ErrorCodes.AUTH_INVALID_SESSION).toBe('AUTH002')
        expect(ErrorCodes.AUTH_SESSION_EXPIRED).toBe('AUTH003')
        expect(ErrorCodes.VALIDATION_FAILED).toBe('VAL001')
        expect(ErrorCodes.DUPLICATE_ENTRY).toBe('VAL002')
    })

    it('should log info correctly', () => {
        // Logger functions should not throw
        expect(() => {
            logger.info('Test message', { code: 'TEST001' })
        }).not.toThrow()
    })

    it('should log error correctly', () => {
        expect(() => {
            logger.error('Test error', { code: ErrorCodes.INTERNAL_ERROR, data: { foo: 'bar' } })
        }).not.toThrow()
    })
})
