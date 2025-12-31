'use client';

import { useState, useEffect, useCallback } from 'react';

// Types
export interface ShiftSnapshot {
    shift: {
        id: string;
        shiftNumber: number;
        shiftName: string;
        status: string;
        staffId?: string;
        staffName: string;
        openedAt: string;
        closedAt: string | null;
        date: string;
        gasPrice: number;
    };
    meters: MeterData[];
    meterTotals: {
        totalLiters: number;
        totalAmount: number;
    };
    gauges: GaugeData[];
    stock: StockData;
    transactions: TransactionData[];
    transactionTotals: TransactionTotals;
    summary: VarianceSummary;
}

export interface MeterData {
    nozzleNumber: number;
    startReading: number;
    endReading: number | null;
    liters: number | null;
    amount: number | null;
}

export interface GaugeData {
    tankNumber: number;
    startPercentage: number | null;
    endPercentage: number | null;
    startPhoto?: string | null;
    endPhoto?: string | null;
}

export interface StockData {
    opening: number;
    sales: number;
    supplies: number;
    closing: number;
    calculated: number;
    variance: number | null;
}

export interface TransactionData {
    id: string;
    date: string;
    licensePlate: string | null;
    ownerName: string | null;
    paymentType: string;
    productType?: string;
    liters: number;
    pricePerLiter?: number;
    amount: number;
}

export interface TransactionTotals {
    cash: number;
    credit: number;
    transfer: number;
    boxTruck: number;
    total: number;
}

export interface VarianceSummary {
    totalExpected: number;
    totalReceived: number;
    variance: number;
    varianceStatus: 'GREEN' | 'YELLOW' | 'RED';
    variancePercent: string;
}

export interface ShiftOption {
    id: string;
    shiftNumber: number;
    shiftName: string;
    status: string;
    date: string;
}

export interface UseShiftSnapshotReturn {
    loading: boolean;
    snapshotLoading: boolean;
    shifts: ShiftOption[];
    selectedShiftId: string | null;
    snapshot: ShiftSnapshot | null;
    error: string | null;
    // Actions
    setSelectedShiftId: (id: string | null) => void;
    fetchShifts: (date?: string) => Promise<void>;
    fetchSnapshot: (shiftId: string) => Promise<void>;
    refresh: () => Promise<void>;
}

export function useShiftSnapshot(stationId: string): UseShiftSnapshotReturn {
    const [loading, setLoading] = useState(true);
    const [snapshotLoading, setSnapshotLoading] = useState(false);
    const [shifts, setShifts] = useState<ShiftOption[]>([]);
    const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);
    const [snapshot, setSnapshot] = useState<ShiftSnapshot | null>(null);
    const [error, setError] = useState<string | null>(null);

    const fetchShifts = useCallback(async (date?: string) => {
        setLoading(true);
        setError(null);
        try {
            const dateStr = date || new Date().toISOString().split('T')[0];
            const res = await fetch(`/api/gas-station/${stationId}/shifts?date=${dateStr}`);
            if (res.ok) {
                const data = await res.json();
                const shiftList: ShiftOption[] = data.shifts?.map((s: { id: string; shiftNumber: number; status: string; createdAt: string }) => ({
                    id: s.id,
                    shiftNumber: s.shiftNumber,
                    shiftName: s.shiftNumber === 1 ? 'กะเช้า' : 'กะบ่าย',
                    status: s.status,
                    date: s.createdAt
                })) || [];
                setShifts(shiftList);

                // Auto-select first shift if none selected
                if (shiftList.length > 0 && !selectedShiftId) {
                    setSelectedShiftId(shiftList[0].id);
                }
            } else {
                const err = await res.json();
                setError(err.error || 'Failed to fetch shifts');
            }
        } catch (e) {
            setError('Network error');
            console.error('Error fetching shifts:', e);
        } finally {
            setLoading(false);
        }
    }, [stationId, selectedShiftId]);

    const fetchSnapshot = useCallback(async (shiftId: string) => {
        setSnapshotLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/gas-station/${stationId}/shifts/${shiftId}/snapshot`);
            if (res.ok) {
                const data = await res.json();
                setSnapshot(data);
            } else {
                const err = await res.json();
                setError(err.error || 'Failed to fetch snapshot');
            }
        } catch (e) {
            setError('Network error');
            console.error('Error fetching snapshot:', e);
        } finally {
            setSnapshotLoading(false);
        }
    }, [stationId]);

    const refresh = useCallback(async () => {
        await fetchShifts();
        if (selectedShiftId) {
            await fetchSnapshot(selectedShiftId);
        }
    }, [fetchShifts, fetchSnapshot, selectedShiftId]);

    // Fetch shifts on mount
    useEffect(() => {
        fetchShifts();
    }, [stationId]); // eslint-disable-line react-hooks/exhaustive-deps

    // Fetch snapshot when shift is selected
    useEffect(() => {
        if (selectedShiftId) {
            fetchSnapshot(selectedShiftId);
        }
    }, [selectedShiftId, fetchSnapshot]);

    return {
        loading,
        snapshotLoading,
        shifts,
        selectedShiftId,
        snapshot,
        error,
        setSelectedShiftId,
        fetchShifts,
        fetchSnapshot,
        refresh,
    };
}
