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
