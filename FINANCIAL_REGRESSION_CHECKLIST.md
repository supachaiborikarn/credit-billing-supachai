# Financial Regression Checklist

> S44 source of truth for the redesign branch. Complete before retiring any active money-changing legacy route. Rerun the gate before each S45+ redirect that can affect sales, billing, shift totals, dates, or payment scope.

Status: **PASS — 2026-08-27**

Latest active-route rerun: **S62 — 16 files / 81 tests passed after GAS `/gas/5|6/shift/open` direct-canonical Operations retirement changes.**

## Release gate

Run:

```bash
npx vitest run tests/financial-regression.test.ts tests/sale-flow-api.test.ts tests/sale-flow-validation.test.ts tests/shift-closing.test.ts tests/full-station-shift-scope.test.ts tests/full-station-shift-sync.test.ts tests/gas-v2-routes.test.ts tests/gas-shift-utils.test.ts tests/billing-lifecycle.test.ts tests/billing-adapter.test.ts tests/billing-payment.test.ts tests/billing-payment-routes.test.ts tests/billing-exceptions.test.ts tests/daily-report-print.test.ts tests/operational-sales.test.ts tests/station-context.test.ts
```

S44 baseline: **16 files / 81 tests passed**.

## Checklist

### 1. Transaction totals — PASS

- FULL canonical sale validates positive liters/price/amount and rejects `amount != liters × price` before submit.
- FULL canonical request maps to the existing `/api/station/1/transactions` contract without inventing a second financial model.
- Current FULL V2 and canonical pricing agree: `CASH`/`CREDIT` use retail; other supported payment types use wholesale unless staff explicitly edits the permitted price.
- GAS canonical submits amount to `/api/v2/gas/[stationId]/sell`; the server resolves daily gas price and calculates liters/amount using the existing GAS workflow.
- Closing previews are informational only; existing FULL/GAS close APIs remain the reconciliation source of truth.
- Daily/report regression tests verify transaction aggregation separately from reconciliation.

### 2. Bill book / bill number — PASS

- FULL credit-like payments require stable customer/truck/bill identity.
- `suggestNextStationBill()` scopes by station + book, ignores deleted/voided rows, compares numeric bill numbers numerically, and preserves zero padding.
- GAS credit requires both book and bill number and validates owner/truck ownership.
- Exact duplicate prevention remains route-specific; S44 does not merge bill numbering across stations.

### 3. Payment type — PASS

- FULL canonical capability set: `CASH`, `CREDIT`, `TRANSFER`, `BOX_TRUCK`, `OIL_TRUCK_SUPACHAI`, `CREDIT_CARD`.
- GAS canonical capability set: `CASH`, `CREDIT`, `CREDIT_CARD`, `TRANSFER`.
- FULL reconciliation preserves separate cash, transfer, card, box-truck, and oil-truck buckets while treating the three credit-like types as credit received.
- GAS keeps its existing four payment buckets and server normalization.

### 4. Invoice / BillingCollection totals — PASS

- Invoice and BillingCollection remain separate financial models; redesign never adds them into one receivable total.
- Billing adapters calculate each document remaining balance as `totalAmount - paidAmount` and surface data inconsistencies instead of guessing.
- Unbilled credit remains a separate bucket to avoid double counting old data.

### 5. Partial payment — PASS

- Invoice payment uses the atomic `/api/invoices/[id]/payments` endpoint with optimistic concurrency; two requests cannot both update the same `paidAmount` snapshot.
- Invoice and BillingCollection reject payment amounts above the remaining balance.
- BillingCollection creates evidence as a pending slip before it affects `paidAmount`.
- S44 added a verification-time overpayment guard: if VERIFIED slips would exceed the collection total, the transaction rolls back and returns conflict instead of storing an overpaid `paidAmount`.

### 6. Bangkok business date — PASS

- Normal calendar-day queries use Bangkok midnight/end-of-day (`UTC+7`) boundaries.
- FULL sale keeps the selected Bangkok business date while preserving current Bangkok time.
- GAS business day/shift logic preserves the 07:00 boundary: 00:00–06:59 belongs to the previous GAS business date and night shift where applicable.

### 7. Station / shift scope — PASS

- Canonical station permissions keep ADMIN global view and STAFF station-scoped access.
- Active write scope remains station-1, station-5, station-6; station-2/3/4 are read-only operational history.
- FULL transaction/closing reconciliation uses the open shift and shift-scoped transactions, with the bounded legacy fallback for old null-`shiftId` rows inside the shift time window.
- GAS sale is bound to the current OPEN shift inside the active GAS business-date range.

## Legacy debt / do not use as parity baseline

These are existing legacy behaviors, not redesign contracts:

1. **Classic `/station/[id]` price mapping is older than current V2.** It contains a CASH/TRANSFER wholesale rule that differs from `/station/1/v2`. Active FULL parity is measured against current V2 + backend, not the classic page.
2. **`/api/payments` is a legacy Invoice payment endpoint with no production caller found in S44.** Canonical Billing must continue using `/api/invoices/[id]/payments`; do not redirect new code to `/api/payments`. Retire separately only after route-level review.
3. **Do not delete active sale/shift APIs during UI route retirement.** S45+ redirects UI entry routes one at a time; backend compatibility remains until all callers and print/read flows are proven migrated.
4. **Do not combine Invoice, BillingCollection, unbilled credit, or legacy `currentCredit` into one grand total.** Their overlap is not relationally proven for historical data.

## S45+ rule

A legacy route may be redirected only when:

- its canonical target already has feature parity,
- this financial gate remains green,
- the route is not required for read/print compatibility,
- the redirect is limited to one bounded route/session, and
- post-redirect smoke/regression verification passes before choosing another route.
