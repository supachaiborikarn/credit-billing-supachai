'use client';

import { useState, useEffect, useCallback } from 'react';

// Types
export interface ShiftData {
    id: string;
    shiftNumber: number;
    status: 'OPEN' | 'CLOSED';
    staffName?: string;
    createdAt: string;
    closedAt?: string;
    openingStock?: number | null;
    closingStock?: number | null;
    carryOverFromShiftId?: string | null;
}

export interface Transaction {
    id: string;
    date: string;
    licensePlate: string;
    ownerName: string;
    liters: number;
    amount: number;
    paymentType: string;
}

export interface DailyStats {
    totalLiters: number;
    totalAmount: number;
    transactionCount: number;
    currentStock: number;
    stockAlert: number;
}

export interface GaugeReading {
    id: string;
    tankNumber: number;
    percentage: number;
    type: 'START' | 'END';
    shiftNumber: number;
    createdAt: string;
}

export interface UseGasStationReturn {
    loading: boolean;
    stats: DailyStats;
    currentShift: ShiftData | null;
    allShifts: { shiftNumber: number; status: string }[];
    recentTransactions: Transaction[];
    gaugeReadings: GaugeReading[];
    actionLoading: boolean;
    deletingId: string | null;
    // Actions
    fetchData: () => Promise<void>;
    fetchShifts: () => Promise<void>;
    openShift: (shiftNumber: number) => Promise<void>;
    closeShift: () => Promise<void>;
    handleDelete: (transactionId: string) => Promise<void>;
}

export function useGasStation(stationId: string, selectedDate: string): UseGasStationReturn {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<DailyStats>({
        totalLiters: 0,
        totalAmount: 0,
        transactionCount: 0,
        currentStock: 0,
        stockAlert: 1000,
    });
    const [currentShift, setCurrentShift] = useState<ShiftData | null>(null);
    const [allShifts, setAllShifts] = useState<{ shiftNumber: number; status: string }[]>([]);
    const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
    const [gaugeReadings, setGaugeReadings] = useState<GaugeReading[]>([]);
    const [actionLoading, setActionLoading] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/gas-station/${stationId}/daily?date=${selectedDate}`);
            if (res.ok) {
                const data = await res.json();
                setStats({
                    totalLiters: data.transactions?.reduce((sum: number, t: Transaction) => sum + t.liters, 0) || 0,
                    totalAmount: data.transactions?.reduce((sum: number, t: Transaction) => sum + t.amount, 0) || 0,
                    transactionCount: data.transactions?.length || 0,
                    currentStock: data.currentStock || 0,
                    stockAlert: data.station?.gasStockAlert || 1000,
                });
                setRecentTransactions(data.transactions?.slice(-5).reverse() || []);
                setCurrentShift(data.currentShift || null);
                if (data.gaugeReadings) {
                    setGaugeReadings(data.gaugeReadings);
                }
            }
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    }, [stationId, selectedDate]);

    const fetchShifts = useCallback(async () => {
        try {
            const res = await fetch(`/api/gas-station/${stationId}/shifts?date=${selectedDate}`);
            if (res.ok) {
                const data = await res.json();
                setAllShifts(data.shifts || []);
                const openShift = data.shifts?.find((s: { status: string }) => s.status === 'OPEN');
                setCurrentShift(openShift || null);
            }
        } catch (error) {
            console.error('Error fetching shifts:', error);
        }
    }, [stationId, selectedDate]);

    const openShift = useCallback(async (shiftNumber: number) => {
        setActionLoading(true);
        try {
            const res = await fetch(`/api/gas-station/${stationId}/shifts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ shiftNumber, action: 'open' }),
            });
            if (res.ok) {
                await fetchData();
                await fetchShifts();
            } else {
                const err = await res.json();
                alert(err.error || 'เปิดกะไม่สำเร็จ');
            }
        } catch (error) {
            console.error('Error opening shift:', error);
            alert('เกิดข้อผิดพลาด');
        } finally {
            setActionLoading(false);
        }
    }, [stationId, fetchData, fetchShifts]);

    const closeShift = useCallback(async () => {
        if (!confirm('ยืนยันปิดกะ?')) return;
        setActionLoading(true);
        try {
            const res = await fetch(`/api/gas-station/${stationId}/shifts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'close', shiftId: currentShift?.id }),
            });
            if (res.ok) {
                await fetchData();
                await fetchShifts();
            }
        } catch (error) {
            console.error('Error closing shift:', error);
        } finally {
            setActionLoading(false);
        }
    }, [stationId, currentShift, fetchData, fetchShifts]);

    const handleDelete = useCallback(async (transactionId: string) => {
        if (!confirm('ยืนยันลบรายการนี้?')) return;
        setDeletingId(transactionId);
        try {
            const res = await fetch(`/api/gas-station/${stationId}/transactions/${transactionId}`, {
                method: 'DELETE',
            });
            if (res.ok) {
                await fetchData();
            } else {
                const err = await res.json();
                alert(err.error || 'ลบไม่สำเร็จ');
            }
        } catch (error) {
            console.error('Delete error:', error);
            alert('เกิดข้อผิดพลาด');
        } finally {
            setDeletingId(null);
        }
    }, [stationId, fetchData]);

    // Auto-fetch on mount and date change
    useEffect(() => {
        fetchData();
        fetchShifts();
    }, [fetchData, fetchShifts]);

    return {
        loading,
        stats,
        currentShift,
        allShifts,
        recentTransactions,
        gaugeReadings,
        actionLoading,
        deletingId,
        fetchData,
        fetchShifts,
        openShift,
        closeShift,
        handleDelete,
    };
}
