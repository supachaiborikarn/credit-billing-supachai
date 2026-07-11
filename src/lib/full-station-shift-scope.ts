type NumericValue = number | string | { toString(): string } | null | undefined;

type MeterEvidence = {
    startReading?: NumericValue;
    endReading?: NumericValue;
    startPhoto?: string | null;
    endPhoto?: string | null;
};

export type FullStationShiftCandidate<TMeter extends MeterEvidence = MeterEvidence> = {
    id: string;
    shiftNumber: number;
    status: string;
    createdAt?: Date | string;
    meters: TMeter[];
    transactions?: unknown[];
    _count?: { transactions?: number };
};

export type FullStationDailyMeter = {
    nozzleNumber: number;
    startReading: NumericValue;
    endReading: NumericValue;
    startPhoto: string | null;
    endPhoto: string | null;
};

function toFiniteNumber(value: NumericValue): number {
    const numberValue = Number(value ?? 0);
    return Number.isFinite(numberValue) ? numberValue : 0;
}

function getTransactionCount(shift: FullStationShiftCandidate): number {
    if (typeof shift._count?.transactions === 'number') {
        return shift._count.transactions;
    }

    return shift.transactions?.length || 0;
}

function getMeterEvidenceCount(shift: FullStationShiftCandidate): number {
    return shift.meters.filter(meter =>
        toFiniteNumber(meter.startReading) > 0 ||
        toFiniteNumber(meter.endReading) > 0 ||
        Boolean(meter.startPhoto) ||
        Boolean(meter.endPhoto)
    ).length;
}

function compareOpenShiftCandidates(
    left: FullStationShiftCandidate,
    right: FullStationShiftCandidate
): number {
    return (
        getTransactionCount(right) - getTransactionCount(left) ||
        getMeterEvidenceCount(right) - getMeterEvidenceCount(left) ||
        right.meters.length - left.meters.length ||
        right.shiftNumber - left.shiftNumber ||
        new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime()
    );
}

/**
 * Pick the one shift whose meters the edit UI should display and update.
 *
 * A FULL station should have one open shift at a time. Historical race conditions
 * created duplicate OPEN rows, so a shift with transactions and complete meter
 * evidence wins over an empty duplicate for the live operational scope.
 */
export function selectCanonicalFullStationShift<TShift extends FullStationShiftCandidate>(
    shifts: TShift[]
): TShift | null {
    if (shifts.length === 0) return null;

    const openShifts = shifts.filter(shift => shift.status === 'OPEN');
    if (openShifts.length > 0) {
        return [...openShifts].sort(compareOpenShiftCandidates)[0] as TShift;
    }

    return [...shifts].sort((left, right) =>
        right.shiftNumber - left.shiftNumber ||
        new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime()
    )[0];
}

/**
 * Admin daily editing treats the first and last substantive shifts as the day
 * boundaries. A one-row/no-sale race artifact is ignored, while a real split
 * shift with sales or evidence on multiple nozzles remains editable.
 */
export function selectFullStationDailyEditShifts<TShift extends FullStationShiftCandidate>(
    shifts: TShift[]
): { startShift: TShift | null; endShift: TShift | null } {
    if (shifts.length === 0) {
        return { startShift: null, endShift: null };
    }

    const substantiveShifts = shifts.filter(shift =>
        getTransactionCount(shift) > 0 || getMeterEvidenceCount(shift) >= 2
    );
    const orderedShifts = [...(substantiveShifts.length > 0 ? substantiveShifts : shifts)]
        .sort((left, right) =>
            left.shiftNumber - right.shiftNumber ||
            new Date(left.createdAt || 0).getTime() - new Date(right.createdAt || 0).getTime()
        );

    return {
        startShift: orderedShifts[0] || null,
        endShift: orderedShifts[orderedShifts.length - 1] || null,
    };
}

/**
 * Build station-wide meter evidence for daily totals and printing.
 * Legitimate split shifts can store the opening reading in the first shift and
 * the closing reading in the last shift, while duplicate race rows may contain
 * only a zero reading. Use the first meaningful opening and last meaningful
 * closing for each nozzle without narrowing daily transactions to one shift.
 */
export function buildFullStationDailyMeters<TMeter extends MeterEvidence & { nozzleNumber: number }>(
    shifts: Array<FullStationShiftCandidate<TMeter>>,
    unscopedMeters: TMeter[] = []
): FullStationDailyMeter[] {
    const scopedMeters = [...shifts]
        .sort((left, right) =>
            left.shiftNumber - right.shiftNumber ||
            new Date(left.createdAt || 0).getTime() - new Date(right.createdAt || 0).getTime()
        )
        .flatMap(shift => shift.meters);
    const allMeters = [...scopedMeters, ...unscopedMeters];

    const nozzleNumbers = [...new Set(allMeters.map(meter => meter.nozzleNumber))]
        .sort((left, right) => left - right);

    return nozzleNumbers.map(nozzleNumber => {
        const scopedNozzleMeters = scopedMeters.filter(meter => meter.nozzleNumber === nozzleNumber);
        const unscopedNozzleMeters = unscopedMeters.filter(meter => meter.nozzleNumber === nozzleNumber);
        const startMeter = scopedNozzleMeters.find(meter => toFiniteNumber(meter.startReading) > 0) ||
            unscopedNozzleMeters.find(meter => toFiniteNumber(meter.startReading) > 0) ||
            scopedNozzleMeters[0] ||
            unscopedNozzleMeters[0];
        const endMeter = [...scopedNozzleMeters]
            .reverse()
            .find(meter => toFiniteNumber(meter.endReading) > 0) ||
            [...unscopedNozzleMeters].reverse().find(meter => toFiniteNumber(meter.endReading) > 0) ||
            [...scopedNozzleMeters].reverse().find(meter => meter.endReading !== null && meter.endReading !== undefined) ||
            [...unscopedNozzleMeters].reverse().find(meter => meter.endReading !== null && meter.endReading !== undefined);
        const startPhotoMeter = scopedNozzleMeters.find(meter => Boolean(meter.startPhoto)) ||
            unscopedNozzleMeters.find(meter => Boolean(meter.startPhoto));
        const endPhotoMeter = [...scopedNozzleMeters].reverse().find(meter => Boolean(meter.endPhoto)) ||
            [...unscopedNozzleMeters].reverse().find(meter => Boolean(meter.endPhoto));

        return {
            nozzleNumber,
            startReading: startMeter?.startReading ?? 0,
            endReading: endMeter?.endReading ?? null,
            startPhoto: startPhotoMeter?.startPhoto || null,
            endPhoto: endPhotoMeter?.endPhoto || null,
        };
    });
}
