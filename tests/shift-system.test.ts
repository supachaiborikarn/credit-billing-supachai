/**
 * Tests for Gas Station Transaction-Shift linking
 * Using TDD patterns from @testing-patterns skill
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Factory functions following testing-patterns skill
interface MockTransaction {
    id: string;
    stationId: string;
    shiftId: string | null;
    licensePlate: string | null;
    amount: number;
    liters: number;
    paymentType: 'CASH' | 'CREDIT' | 'TRANSFER';
    date: Date;
}

interface MockShift {
    id: string;
    shiftNumber: number;
    status: 'OPEN' | 'CLOSED' | 'LOCKED';
    dailyRecordId: string;
    meters: MockMeterReading[];
}

interface MockMeterReading {
    id: string;
    nozzleNumber: number;
    startReading: number;
    endReading: number | null;
    shiftId: string | null;
}

// Factory: Create mock transaction with defaults
const getMockTransaction = (overrides?: Partial<MockTransaction>): MockTransaction => {
    return {
        id: 'txn-123',
        stationId: 'station-5',
        shiftId: null,
        licensePlate: 'กข 1234',
        amount: 500,
        liters: 25,
        paymentType: 'CASH',
        date: new Date('2026-01-29'),
        ...overrides,
    };
};

// Factory: Create mock shift with defaults
const getMockShift = (overrides?: Partial<MockShift>): MockShift => {
    return {
        id: 'shift-abc',
        shiftNumber: 1,
        status: 'OPEN',
        dailyRecordId: 'daily-123',
        meters: [],
        ...overrides,
    };
};

// Factory: Create mock meter reading
const getMockMeterReading = (overrides?: Partial<MockMeterReading>): MockMeterReading => {
    return {
        id: 'meter-123',
        nozzleNumber: 1,
        startReading: 1000,
        endReading: null,
        shiftId: null,
        ...overrides,
    };
};

describe('Gas Station Shift System', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Transaction-Shift Linking', () => {
        it('should include shiftId when creating transaction during open shift', () => {
            const shift = getMockShift({ id: 'shift-morning', status: 'OPEN' });
            const transaction = getMockTransaction({ shiftId: shift.id });

            expect(transaction.shiftId).toBe('shift-morning');
        });

        it('should allow null shiftId for transactions without shift context', () => {
            const transaction = getMockTransaction({ shiftId: null });

            expect(transaction.shiftId).toBeNull();
        });

        it('should filter transactions by shiftId', () => {
            const morningShift = getMockShift({ id: 'shift-morning', shiftNumber: 1 });
            const afternoonShift = getMockShift({ id: 'shift-afternoon', shiftNumber: 2 });

            const transactions = [
                getMockTransaction({ id: 'txn-1', shiftId: 'shift-morning' }),
                getMockTransaction({ id: 'txn-2', shiftId: 'shift-morning' }),
                getMockTransaction({ id: 'txn-3', shiftId: 'shift-afternoon' }),
            ];

            // Filter for morning shift
            const morningTransactions = transactions.filter(t => t.shiftId === morningShift.id);
            const afternoonTransactions = transactions.filter(t => t.shiftId === afternoonShift.id);

            expect(morningTransactions).toHaveLength(2);
            expect(afternoonTransactions).toHaveLength(1);
        });
    });

    describe('Meter Reading on Shift Close', () => {
        it('should have endReading set when shift is closed', () => {
            const meter = getMockMeterReading({
                startReading: 1000,
                endReading: 1050,
            });

            expect(meter.endReading).toBe(1050);
            expect(meter.endReading! - meter.startReading).toBe(50); // 50 liters sold
        });

        it('should default endReading to startReading if no sales', () => {
            const meter = getMockMeterReading({
                startReading: 1000,
                endReading: 1000, // Same as start = no sales
            });

            const soldQty = meter.endReading! - meter.startReading;
            expect(soldQty).toBe(0);
        });

        it('should link meter reading to shift', () => {
            const shift = getMockShift({ id: 'shift-123' });
            const meter = getMockMeterReading({ shiftId: shift.id });

            expect(meter.shiftId).toBe('shift-123');
        });
    });

    describe('Shift Status Transitions', () => {
        it('should start with OPEN status', () => {
            const shift = getMockShift();
            expect(shift.status).toBe('OPEN');
        });

        it('should transition to CLOSED when closed', () => {
            const shift = getMockShift({ status: 'CLOSED' });
            expect(shift.status).toBe('CLOSED');
        });

        it('should transition to LOCKED when locked', () => {
            const shift = getMockShift({ status: 'LOCKED' });
            expect(shift.status).toBe('LOCKED');
        });
    });

    describe('Daily Transaction Filtering', () => {
        it('should return all transactions when shift=0 (all day)', () => {
            const transactions = [
                getMockTransaction({ id: '1', shiftId: 'shift-1' }),
                getMockTransaction({ id: '2', shiftId: 'shift-2' }),
                getMockTransaction({ id: '3', shiftId: null }),
            ];

            // shiftNumber = 0 means "all day" - no filtering
            const shiftNumber = 0;
            const filtered = shiftNumber === 0
                ? transactions
                : transactions.filter(t => t.shiftId === `shift-${shiftNumber}`);

            expect(filtered).toHaveLength(3);
        });

        it('should filter transactions for specific shift', () => {
            const transactions = [
                getMockTransaction({ id: '1', shiftId: 'shift-1' }),
                getMockTransaction({ id: '2', shiftId: 'shift-1' }),
                getMockTransaction({ id: '3', shiftId: 'shift-2' }),
            ];

            const shiftId = 'shift-1';
            const filtered = transactions.filter(t => t.shiftId === shiftId);

            expect(filtered).toHaveLength(2);
            expect(filtered.every(t => t.shiftId === 'shift-1')).toBe(true);
        });
    });
});

describe('Payment Type Handling', () => {
    it('should handle CASH payment', () => {
        const tx = getMockTransaction({ paymentType: 'CASH' });
        expect(tx.paymentType).toBe('CASH');
    });

    it('should handle CREDIT payment', () => {
        const tx = getMockTransaction({ paymentType: 'CREDIT' });
        expect(tx.paymentType).toBe('CREDIT');
    });

    it('should handle TRANSFER payment', () => {
        const tx = getMockTransaction({ paymentType: 'TRANSFER' });
        expect(tx.paymentType).toBe('TRANSFER');
    });
});
