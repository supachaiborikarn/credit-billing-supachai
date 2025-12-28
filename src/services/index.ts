/**
 * Services - รวม business logic ที่ใช้ซ้ำได้
 * 
 * วิธีใช้:
 * import { calculatePercentChange, detectSalesAnomaly } from '@/services';
 * import { getBillingPeriods, calculateAgingDays } from '@/services';
 */

// Dashboard Service
export {
    calculatePercentChange,
    detectSalesAnomaly,
    checkVariance,
    generateWeeklyChartData,
    generateTopCustomers,
    generateHeatMapData,
    type DashboardOverview,
    type Alert,
} from './dashboard-service';

// Billing Service
export {
    getBillingPeriods,
    calculateAgingDays,
    getAgingGroup,
    generateInvoiceNumber,
    calculateTotalDue,
    getInvoiceStatusLabel,
    type InvoiceSummary,
    type BillingPeriod,
} from './billing-service';

// Meter Service
export {
    calculateSoldQty,
    validateMeterReading,
    detectMeterAnomaly,
    checkMeterContinuity,
    prepareMeterSaveData,
    type MeterReading,
    type MeterSaveResult,
} from './meter-service';

// Shift Service (Anti-Fraud)
export {
    isShiftLocked,
    canModifyShift,
    validateCloseShift,
    calculateVarianceStatus,
    calculateReconciliation,
    closeShift,
    lockShift,
    checkShiftModifiable,
    type ShiftStatus,
    type VarianceStatus,
    type CloseShiftValidation,
    type ReconciliationData,
} from './shift-service';

// Device Service (Device Binding)
export {
    registerDevice,
    validateDeviceStation,
    countDevicesForStation,
    isDeviceLimitExceeded,
    deactivateDevice,
    getStationDevices,
    generateDeviceId,
    type DeviceInfo,
} from './device-service';

// Price Service (Price Book)
export {
    getCurrentPrice,
    calculateAmount,
    setPrice,
    getPriceHistory,
    PRODUCT_TYPES,
    type PriceInfo,
} from './price-service';
