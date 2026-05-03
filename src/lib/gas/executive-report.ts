import type {
    GasDailyAnalytics,
    GasShiftAnalytics,
} from './admin-analytics';
import type { SerializedGasSupply } from './supply-utils';

export interface GasExecutiveReportStation {
    stationId: string;
    stationName: string;
}

export interface GasExecutiveReportData {
    meta: {
        from: string;
        to: string;
        generatedAt: string;
        stationLabel: string;
    };
    kpis: {
        totalRevenue: number;
        totalReceived: number;
        variance: number;
        totalLiters: number;
        meterLiters: number;
        transactionLiters: number;
        transactionCount: number;
        averageTicket: number;
        shiftCount: number;
        openShiftCount: number;
        supplyLiters: number;
        supplyCost: number;
        averageSupplyCost: number | null;
        continuityIssues: number;
        unassignedTransactions: number;
    };
    revenue: {
        paymentMix: {
            cash: number;
            credit: number;
            card: number;
            transfer: number;
        };
        dailyRows: Array<{
            dateKey: string;
            displayDate: string;
            totalSales: number;
            totalReceived: number;
            totalLiters: number;
            transactionCount: number;
            variance: number;
        }>;
        stationRows: Array<{
            stationId: string;
            stationName: string;
            totalSales: number;
            totalReceived: number;
            totalLiters: number;
            transactionCount: number;
            variance: number;
            averageTicket: number;
        }>;
    };
    meters: {
        totalsByNozzle: Array<{
            stationId: string;
            stationName: string;
            nozzleNumber: number;
            liters: number;
            estimatedSales: number;
        }>;
        shiftRows: Array<{
            id: string;
            dateKey: string;
            displayDate: string;
            stationName: string;
            shiftNumber: number;
            status: string;
            meterLiters: number;
            transactionLiters: number;
            litersVariance: number;
            sales: number;
            continuityIssueCount: number;
            isSyntheticOrphan: boolean;
        }>;
    };
    supplies: {
        rows: SerializedGasSupply[];
        stationRows: Array<{
            stationId: string;
            stationName: string;
            liters: number;
            totalCost: number;
            count: number;
            averageCostPerLiter: number | null;
        }>;
    };
    managementNotes: Array<{
        severity: 'INFO' | 'WARNING' | 'CRITICAL';
        title: string;
        detail: string;
    }>;
}

function round2(value: number): number {
    return Number(value.toFixed(2));
}

function sumBy<T>(items: T[], picker: (item: T) => number): number {
    return round2(items.reduce((sum, item) => sum + picker(item), 0));
}

function getStationRows(
    shifts: GasShiftAnalytics[],
    stations: GasExecutiveReportStation[]
): GasExecutiveReportData['revenue']['stationRows'] {
    return stations.map((station) => {
        const stationShifts = shifts.filter((shift) => shift.stationId === station.stationId);
        const totalSales = sumBy(stationShifts, (shift) => shift.sales.total);
        const totalReceived = sumBy(stationShifts, (shift) => shift.reconciliation?.received ?? shift.sales.total);
        const totalLiters = sumBy(stationShifts, (shift) => shift.sales.liters);
        const transactionCount = sumBy(stationShifts, (shift) => shift.sales.transactions);
        const variance = sumBy(stationShifts, (shift) => shift.reconciliation?.variance ?? 0);

        return {
            stationId: station.stationId,
            stationName: station.stationName,
            totalSales,
            totalReceived,
            totalLiters,
            transactionCount,
            variance,
            averageTicket: transactionCount > 0 ? round2(totalSales / transactionCount) : 0,
        };
    });
}

function getSupplyStationRows(
    supplies: SerializedGasSupply[],
    stations: GasExecutiveReportStation[]
): GasExecutiveReportData['supplies']['stationRows'] {
    return stations.map((station) => {
        const stationSupplies = supplies.filter((supply) => supply.stationId === station.stationId);
        const liters = sumBy(stationSupplies, (supply) => supply.liters);
        const totalCost = sumBy(stationSupplies, (supply) => supply.totalCost ?? 0);

        return {
            stationId: station.stationId,
            stationName: station.stationName,
            liters,
            totalCost,
            count: stationSupplies.length,
            averageCostPerLiter: liters > 0 && totalCost > 0
                ? round2(totalCost / liters)
                : null,
        };
    });
}

function getNozzleRows(
    shifts: GasShiftAnalytics[]
): GasExecutiveReportData['meters']['totalsByNozzle'] {
    const map = new Map<string, GasExecutiveReportData['meters']['totalsByNozzle'][number]>();

    for (const shift of shifts) {
        if (shift.isSyntheticOrphan) continue;

        for (const nozzle of shift.meters.nozzles) {
            const key = `${shift.stationId}:${nozzle.nozzleNumber}`;
            const existing = map.get(key) ?? {
                stationId: shift.stationId,
                stationName: shift.stationName,
                nozzleNumber: nozzle.nozzleNumber,
                liters: 0,
                estimatedSales: 0,
            };
            existing.liters = round2(existing.liters + nozzle.soldQty);
            existing.estimatedSales = round2(existing.estimatedSales + (nozzle.soldQty * shift.gasPrice));
            map.set(key, existing);
        }
    }

    return Array.from(map.values()).sort((left, right) => (
        left.stationName.localeCompare(right.stationName)
        || left.nozzleNumber - right.nozzleNumber
    ));
}

function buildManagementNotes(
    shifts: GasShiftAnalytics[],
    supplyLiters: number,
    transactionLiters: number,
    variance: number,
    continuityIssues: number,
    unassignedTransactions: number
): GasExecutiveReportData['managementNotes'] {
    const notes: GasExecutiveReportData['managementNotes'] = [];

    if (Math.abs(variance) > 500) {
        notes.push({
            severity: 'WARNING',
            title: 'ยอดรับจริงต่างจากยอดขาย',
            detail: `ช่วงรายงานมียอดต่างรวม ${variance >= 0 ? '+' : ''}${variance.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท ควรตรวจรายการกระทบยอดรายกะ`,
        });
    }

    if (continuityIssues > 0) {
        notes.push({
            severity: continuityIssues >= 3 ? 'CRITICAL' : 'WARNING',
            title: 'เลขมิเตอร์ไม่ต่อจากกะก่อน',
            detail: `พบ ${continuityIssues.toLocaleString('th-TH')} จุดที่เลขเปิดกะไม่ต่อจากเลขปิดกะก่อนหน้า`,
        });
    }

    if (unassignedTransactions > 0) {
        notes.push({
            severity: 'WARNING',
            title: 'มีรายการขายยังไม่ผูกกะ',
            detail: `พบ ${unassignedTransactions.toLocaleString('th-TH')} รายการที่แสดงในรายได้แล้ว แต่ยังไม่มีมิเตอร์ประกบ`,
        });
    }

    if (supplyLiters > 0 && transactionLiters > supplyLiters * 1.25) {
        notes.push({
            severity: 'INFO',
            title: 'ยอดขายมากกว่าปริมาณลงแก๊สในช่วงเดียวกัน',
            detail: 'อาจเป็นการใช้สต็อกคงเหลือเดิมร่วมด้วย ควรดูระดับเกจประกอบก่อนสรุปต้นทุน',
        });
    }

    const openShifts = shifts.filter((shift) => shift.status === 'OPEN' && !shift.isSyntheticOrphan);
    if (openShifts.length > 0) {
        notes.push({
            severity: 'INFO',
            title: 'ยังมีกะเปิดอยู่',
            detail: `${openShifts.length.toLocaleString('th-TH')} กะยังไม่ปิดในช่วงรายงาน ตัวเลขรับจริงอาจยังไม่สมบูรณ์จนกว่าจะปิดกะ`,
        });
    }

    if (notes.length === 0) {
        notes.push({
            severity: 'INFO',
            title: 'ไม่พบประเด็นผิดปกติสำคัญ',
            detail: 'รายได้ มิเตอร์ และรายการลงแก๊สอยู่ในกรอบที่อ่านได้จากข้อมูลช่วงนี้',
        });
    }

    return notes;
}

export function buildGasExecutivePrintReport(input: {
    from: string;
    to: string;
    generatedAt: Date;
    stationLabel: string;
    stations: GasExecutiveReportStation[];
    shifts: GasShiftAnalytics[];
    daily: GasDailyAnalytics[];
    supplies: SerializedGasSupply[];
}): GasExecutiveReportData {
    const totalRevenue = sumBy(input.daily, (day) => day.totalSales);
    const totalReceived = sumBy(input.daily, (day) => day.totalReceived);
    const transactionCount = sumBy(input.daily, (day) => day.transactionCount);
    const transactionLiters = sumBy(input.daily, (day) => day.transactionLiters);
    const meterLiters = sumBy(input.daily, (day) => day.meterLiters);
    const supplyLiters = sumBy(input.supplies, (supply) => supply.liters);
    const supplyCost = sumBy(input.supplies, (supply) => supply.totalCost ?? 0);
    const continuityIssues = sumBy(input.shifts, (shift) => shift.meters.continuity.issueCount);
    const unassignedTransactions = sumBy(input.shifts, (shift) => (
        shift.isSyntheticOrphan ? shift.sales.transactions : 0
    ));

    return {
        meta: {
            from: input.from,
            to: input.to,
            generatedAt: input.generatedAt.toISOString(),
            stationLabel: input.stationLabel,
        },
        kpis: {
            totalRevenue,
            totalReceived,
            variance: round2(totalReceived - totalRevenue),
            totalLiters: sumBy(input.daily, (day) => day.totalLiters),
            meterLiters,
            transactionLiters,
            transactionCount,
            averageTicket: transactionCount > 0 ? round2(totalRevenue / transactionCount) : 0,
            shiftCount: input.shifts.filter((shift) => !shift.isSyntheticOrphan).length,
            openShiftCount: input.shifts.filter((shift) => shift.status === 'OPEN' && !shift.isSyntheticOrphan).length,
            supplyLiters,
            supplyCost,
            averageSupplyCost: supplyLiters > 0 && supplyCost > 0 ? round2(supplyCost / supplyLiters) : null,
            continuityIssues,
            unassignedTransactions,
        },
        revenue: {
            paymentMix: {
                cash: sumBy(input.daily, (day) => day.cashAmount),
                credit: sumBy(input.daily, (day) => day.creditAmount),
                card: sumBy(input.daily, (day) => day.cardAmount),
                transfer: sumBy(input.daily, (day) => day.transferAmount),
            },
            dailyRows: input.daily
                .slice()
                .sort((left, right) => left.dateKey.localeCompare(right.dateKey))
                .map((day) => ({
                    dateKey: day.dateKey,
                    displayDate: day.displayDate,
                    totalSales: day.totalSales,
                    totalReceived: day.totalReceived,
                    totalLiters: day.totalLiters,
                    transactionCount: day.transactionCount,
                    variance: day.variance,
                })),
            stationRows: getStationRows(input.shifts, input.stations),
        },
        meters: {
            totalsByNozzle: getNozzleRows(input.shifts),
            shiftRows: input.shifts.map((shift) => ({
                id: shift.id,
                dateKey: shift.dateKey,
                displayDate: shift.displayDate,
                stationName: shift.stationName,
                shiftNumber: shift.shiftNumber,
                status: shift.status,
                meterLiters: shift.meters.total,
                transactionLiters: shift.meters.transactionLiters,
                litersVariance: shift.meters.litersVariance,
                sales: shift.sales.total,
                continuityIssueCount: shift.meters.continuity.issueCount,
                isSyntheticOrphan: shift.isSyntheticOrphan === true,
            })),
        },
        supplies: {
            rows: input.supplies,
            stationRows: getSupplyStationRows(input.supplies, input.stations),
        },
        managementNotes: buildManagementNotes(
            input.shifts,
            supplyLiters,
            transactionLiters,
            round2(totalReceived - totalRevenue),
            continuityIssues,
            unassignedTransactions
        ),
    };
}
