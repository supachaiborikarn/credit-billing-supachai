// Gas Station Hooks
export { useGasStation } from './useGasStation';
export type {
    ShiftData,
    Transaction,
    DailyStats,
    GaugeReading as GasStationGaugeReading,
    UseGasStationReturn
} from './useGasStation';

export { useShiftSnapshot } from './useShiftSnapshot';
export type {
    ShiftSnapshot,
    MeterData as SnapshotMeterData,
    GaugeData,
    StockData,
    TransactionData,
    TransactionTotals,
    VarianceSummary,
    ShiftOption,
    UseShiftSnapshotReturn
} from './useShiftSnapshot';

export { useMeterData } from './useMeterData';
export type {
    MeterReading,
    UseMeterDataReturn
} from './useMeterData';
