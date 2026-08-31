/**
 * Legacy compatibility barrel.
 *
 * Owner.currentCredit is intentionally not an AR source of truth and no
 * currentCredit read/write helpers remain here. Monthly Invoice generation
 * is implemented by the canonical monthly-invoice service.
 */
export {
    generateMonthlyInvoiceData,
    createMonthlyInvoice,
    generateAllMonthlyInvoices,
} from '@/services/monthly-invoice-service';
