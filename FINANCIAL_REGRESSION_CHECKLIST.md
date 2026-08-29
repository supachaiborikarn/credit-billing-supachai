# Financial Regression Checklist

> S44 source of truth for the redesign branch. Complete before retiring any active money-changing legacy route. Rerun the gate before each S45+ redirect that can affect sales, billing, shift totals, dates, or payment scope.

Status: **PASS — 2026-08-29**

Latest active-route rerun: **S81 pass 7 — 16 files / 81 tests passed on a clean HEAD + S81-only GAS patch snapshot after real isolated write UAT found and fixed the bounded Prisma transaction-timeout issue in GAS open/close; financial formulas and write semantics remain unchanged.**

Latest compatibility-safety rerun: **S85 — the same 16-file financial release gate passed 83 tests after retired-station mutation policy + strict transaction/station route binding; thermal receipt regression also passed 3/3 for 58/80 mm, receipt/credit, original/copy and station-3 fail-closed header safety.**

Latest FULL maintenance-parity rerun: **S89 — 16 files / 83 financial tests passed on a clean HEAD + S89-only snapshot after moving CSV export, payment-filtered export, historical transfer-proof replacement and the corrected station-scoped void path into FULL V2. S89 compatibility regression passed 60/60 on the same clean snapshot; isolated-Neon write UAT confirmed proof replacement preserves liters/price/amount and the corrected DELETE path voids only the intended fixture.**

Latest FULL meter-maintenance rerun: **S94 — 16 files / 87 financial tests passed on a clean HEAD + S94-only snapshot after moving historical meter/photo correction into canonical Operations. S94-specific meter/photo/policy tests passed 27/27; isolated-Neon UAT confirmed STAFF historical meter/photo writes are blocked, ADMIN correction is shift-bound and audited, missing historical days are not created, and the fixture transaction remained 10 L at 31.34 = 313.40.**

Latest FULL daily-price maintenance rerun: **S93 — 16 files / 85 financial tests passed on a clean HEAD + S93-only snapshot after moving daily retail/wholesale correction into canonical Operations and hardening daily-price writes. STAFF keeps current-day price entry for active shift opening, but historical price mutation is ADMIN-only and retired-station STAFF is read-only. Isolated-Neon UAT returned STAFF 403 / ADMIN 200 for 2026-08-27; the DailyRecord changed to 30.55/29.55 while the existing transaction remained 10 L × 31.34 = 313.40.**

Latest FULL transaction-create safety rerun: **S95 pass 1 — 16 files / 89 financial tests passed on a clean HEAD + S95-pass1-only snapshot after making historical transaction create ADMIN-only and fail-closed. Direct route/policy regression passed 29/29; isolated-Neon UAT confirmed missing historical days are not created, CLOSED dates do not create shifts, and ADMIN creation on an existing historical OPEN shift reuses that exact shift.**

Latest FULL history-maintenance rerun: **S95 pass 2 — 16 files / 89 financial tests passed after moving transaction/slip/receipt, filtered CSV, daily print and real station/date-bound audit review into canonical History. S95 targeted regression passed 15/15; TypeScript, targeted ESLint, diff check and the 127-route production build passed. Historical create remains limited to an existing OPEN Shift and the maintenance UI clears stale date data before any action.**

Latest FULL V2-retirement rerun: **S96 — 16 files / 90 financial tests passed after retiring `/station/1` and `/station/1/v2` to canonical Overview/History and adding canonical partial-opening recovery. S96 redirect/opening regression passed 183/183; isolated HEAD + S96-only full suite passed 396/396, real mixed-tree full suite passed 400/400, TypeScript/scoped ESLint passed, the production build completed 127/127 routes with `NODE_ENV=production`, and local redirect/auth normalization smoke passed 4/4 on port 3005.**

Latest GAS recovery-retirement rerun: **S98 — 16 files / 90 financial tests passed after moving guarded meter/gauge START correction and standalone END save/retry into canonical Operations. S98 route/recovery regression passed 217/217; full suite passed 407/407; TypeScript/scoped ESLint and the 127-route production build passed. Isolated write UAT confirmed START edits succeed before lock, END meter/gauge saves succeed independently, subsequent START edits fail closed with 409, readback matches, and fixture cleanup completes.**

Latest GAS supplies-inventory rerun: **S99 — canonical `/stations/station-5|6/inventory` moved LPG receive/history off `/gas/[id]/supplies` without changing the write API or financial model. Targeted route/context/supply gate passed 90 tests, financial release gate 90/90, full regression 407/407, TypeScript/scoped ESLint/diff check passed, production build 127/127 routes passed, and isolated UAT confirmed STAFF station-5 create/readback + AuditLog while cross-station station-6 access returned 403.**

Latest GAS product-inventory rerun: **S100 — station-5 product create/receive/price-alert/history moved into canonical Inventory while preserving existing product APIs and stock records. The legacy GET-side `Station.upsert` was removed so reads are side-effect free. Targeted route/redirect gate passed 89/89, financial release gate 90/90, full regression 409/409, TypeScript/scoped ESLint/diff check passed, production build 127/127 routes passed, and isolated UAT confirmed create → update → receive → history with final quantity 7 / sale price 43 / alert 2 plus station-6 access 403.**

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

1. **Classic `/station/[id]` price mapping is older than the retired V2 reference behavior.** It contains a CASH/TRANSFER wholesale rule that differed from `/station/1/v2`. S44-S95 parity was measured against V2 + backend, not the classic page; after S96 the canonical surfaces own the supported UI behavior while V2 is redirect/archive-only.
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
