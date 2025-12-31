'use client';

import { useState, useEffect, useCallback } from 'react';

// Types
export interface MeterReading {
    nozzleNumber: number;
    startReading: number;
    endReading: number | null;
    startImageUrl?: string;
    endImageUrl?: string;
    isCarryOver?: boolean;
}

export interface UseMeterDataReturn {
    loading: boolean;
    saving: boolean;
    meters: MeterReading[];
    error: string | null;
    // Actions
    fetchMeters: (date: string) => Promise<void>;
    updateMeter: (nozzle: number, value: number, type: 'start' | 'end') => void;
    saveMeters: (date: string, type: 'start' | 'end', shiftId?: string) => Promise<boolean>;
    copyFromPreviousShift: (date: string) => Promise<void>;
}

export function useMeterData(stationId: string, nozzleCount: number = 4): UseMeterDataReturn {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [meters, setMeters] = useState<MeterReading[]>(
        Array.from({ length: nozzleCount }, (_, i) => ({
            nozzleNumber: i + 1,
            startReading: 0,
            endReading: null,
            isCarryOver: false,
        }))
    );
    const [error, setError] = useState<string | null>(null);

    const fetchMeters = useCallback(async (date: string) => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/gas-station/${stationId}/daily?date=${date}`);
            if (res.ok) {
                const data = await res.json();
                if (data.dailyRecord?.meters || data.currentShift?.meters) {
                    const metersData = data.currentShift?.meters || data.dailyRecord?.meters || [];
                    setMeters(metersData.map((m: MeterReading) => ({
                        nozzleNumber: m.nozzleNumber,
                        startReading: Number(m.startReading) || 0,
                        endReading: m.endReading ? Number(m.endReading) : null,
                        startImageUrl: m.startImageUrl,
                        endImageUrl: m.endImageUrl,
                        isCarryOver: Number(m.startReading) > 0,
                    })));
                }
            } else {
                const err = await res.json();
                setError(err.error || 'Failed to fetch meters');
            }
        } catch (e) {
            setError('Network error');
            console.error('Error fetching meters:', e);
        } finally {
            setLoading(false);
        }
    }, [stationId]);

    const updateMeter = useCallback((nozzle: number, value: number, type: 'start' | 'end') => {
        setMeters(prev =>
            prev.map(m =>
                m.nozzleNumber === nozzle
                    ? { ...m, [type === 'start' ? 'startReading' : 'endReading']: value }
                    : m
            )
        );
    }, []);

    const saveMeters = useCallback(async (date: string, type: 'start' | 'end', shiftId?: string): Promise<boolean> => {
        setSaving(true);
        setError(null);
        try {
            const metersData = meters.map(m => ({
                nozzleNumber: m.nozzleNumber,
                reading: type === 'start' ? m.startReading : m.endReading,
            }));

            const res = await fetch(`/api/gas-station/${stationId}/meters`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date,
                    type,
                    meters: metersData,
                    shiftId,
                }),
            });

            if (res.ok) {
                return true;
            } else {
                const err = await res.json();
                setError(err.error || 'Failed to save meters');
                return false;
            }
        } catch (e) {
            setError('Network error');
            console.error('Error saving meters:', e);
            return false;
        } finally {
            setSaving(false);
        }
    }, [stationId, meters]);

    const copyFromPreviousShift = useCallback(async (date: string) => {
        setError(null);
        try {
            const res = await fetch(`/api/gas-station/${stationId}/shifts/previous?date=${date}`);
            if (res.ok) {
                const data = await res.json();
                if (data.meters) {
                    setMeters(prev =>
                        prev.map(m => ({
                            ...m,
                            startReading: data.meters[m.nozzleNumber] || m.startReading,
                            isCarryOver: true,
                        }))
                    );
                }
            } else {
                setError('ไม่พบข้อมูลกะก่อน');
            }
        } catch (e) {
            setError('Network error');
            console.error('Error copying from previous:', e);
        }
    }, [stationId]);

    return {
        loading,
        saving,
        meters,
        error,
        fetchMeters,
        updateMeter,
        saveMeters,
        copyFromPreviousShift,
    };
}
