# Financial Regression Checklist

> S44 source of truth for the redesign branch. Complete before retiring any active money-changing legacy route. Rerun the gate before each S45+ redirect that can affect sales, billing, shift totals, dates, or payment scope.

Status: **PASS — 2026-08-30**

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

Latest retired-SIMPLE history-maintenance rerun: **S101 — retired station-2/3/4 summary maintenance moved into canonical History without reopening frontline operations. STAFF remains read/view-slip/print/CSV only while ADMIN retains audited edit/void/proof maintenance; historical create stays FULL-only. Targeted route/history/role gate passed 196/196, financial release gate 90/90, full regression 421/421, TypeScript/scoped ESLint/diff check passed, production build 127/127 routes passed, and isolated UAT confirmed STAFF edit/void/audit 403 vs ADMIN edit/audit/void 200 while receipt compatibility remained 200.**

Latest customer master-data rerun: **S102 — ordinary `/owners` create/edit/deactivate/add-truck work moved into canonical Customers/Customer 360 with ADMIN-only UI permission while preserving the existing Owner/Truck APIs as source of truth. Targeted customer/retry/redirect gate passed 81/81, financial release gate 90/90, full regression 424/424, TypeScript/scoped ESLint/diff check passed, production build 127/127 routes passed, and isolated UAT confirmed STAFF master-data permission=false vs ADMIN=true plus create → edit → add truck → edit plate → soft-deactivate, with final status INACTIVE and cleanup 0/0. UAT also exposed a transient Neon P1001 on Customer reads; list/detail now reuse the existing P1001/P2024 read-retry helper.**

Latest customer merge/reassignment rerun: **S103 — `/trucks` and `/admin/owners` moved into canonical Customers ADMIN tools. Truck/Owner edits are ADMIN-only; duplicate merge now moves Truck + Transaction + Invoice + BillingCollection in one audited transaction, preserves BillingCollection owner-name snapshots, transfers a single LINE mapping and refuses dual LINE mappings. Targeted master-data/customer/retry/redirect gate passed 87/87, final route/redirect gate after the timeout fix passed 68/68, financial release gate 90/90, full regression 430/430, TypeScript/scoped ESLint/diff check passed, and production build 127/127 routes passed. Isolated UAT first exposed Prisma P2028 at the default 5s interactive-transaction timeout; keeping the merge atomic with bounded maxWait 5s / timeout 20s then passed real relation migration and AuditLog verification.**

Latest canonical Billing rerun: **S104 — ordinary Invoice/BillingCollection user workflows moved into `/billing`: ADMIN creates owner-scoped Invoice(s), deletes only unpaid Invoice atomically, creates manual BillingCollection and reviews/rejects/deletes pending slips; STAFF stays read-only. Unsafe combined-owner Invoice creation is rejected because the schema has one `Invoice.ownerId`; Invoice and BillingCollection creates use bounded serializable transactions + AuditLog, document-number prefixes use Bangkok date, and Invoice export now requires session auth. `/invoices`, `/admin/invoices`, `/billing-collections` and BillingCollection detail retire to canonical Billing while `/invoices/[id]` remains KEEP_PRINT_COMPAT. Targeted S104 gate passed 96/96 before Bangkok-prefix navigation polish; final financial release gate passed 91/91, full regression 441/441 and production build 127/127 routes. Isolated Neon UAT confirmed ADMIN/STAFF reads 200/200, STAFF Invoice/Collection/slip writes 403, unsafe combine 400, unpaid create/delete 200/200, paid-delete guard 400, print compatibility 200, export anonymous/authenticated 401/200, Collection create 201, verify/reject/delete slip 200 with paidAmount 250, sender normalization and AuditLog; cleanup Owner/Transaction/Invoice/Collection/Audit = 0.**

Latest legacy credit-admin retirement rerun: **S105 — `/admin/outstanding` now redirects to canonical Billing because the legacy report used drift-prone `Owner.currentCredit`, while `/admin/credit-limit` redirects to Customers/Customer 360 where ADMIN credit-limit editing already has parity. No financial write or calculation changed. Targeted Billing/Customer/redirect gate passed 93/93, financial release gate 91/91, full regression 445/445, TypeScript/scoped ESLint/diff check passed, and production build 127/127 routes passed.**

Latest monthly Invoice batch rerun: **S106 — `/admin/generate-invoices` retires to `/billing?batch=monthly` after hardening the batch source/write path. The batch no longer selects owners from drift-prone `Owner.currentCredit`; it derives owner IDs from credit-like transactions with `invoiceId=null`, valid Bangkok month bounds, `deletedAt=null` and `isVoided=false`. Each owner is created in a bounded serializable transaction, source transactions are connected to the Invoice, the total is recomputed inside the transaction, and an Invoice CREATE AuditLog records `source=MONTHLY_BATCH`. Same-period existing Invoice is fail-closed/skipped using the full Bangkok due-date day rather than timestamp equality, so legacy UTC-midnight due dates cannot evade the guard; no write retry is used. S106 targeted Billing/monthly/redirect gate passed 109/109, expanded financial+batch release gate 101/101, full regression 458/458, TypeScript/scoped ESLint/diff check passed, and production build 127/127 routes passed. Isolated Neon UAT with period 12/2099 confirmed canonical 200, legacy/pre-login redirects 307, STAFF batch 403, first ADMIN batch created exactly 1 Invoice linked to exactly 1 source transaction with AuditLog despite `currentCredit=0`, second batch skipped with duplicate count remaining 1, and cleanup Owner/Transaction/Invoice/User/Station = 0. A second compatibility UAT seeded a legacy Invoice due `2099-01-15T00:00:00Z`; the new 12/2098 batch returned created=0/skipped=1, Invoice count stayed 1, and the unbilled transaction remained unlinked, proving cross-version duplicate protection.**

Latest inventory-admin retirement rerun: **S107 — `/admin/inventory` and `/admin/low-stock` retire to canonical station-5 Inventory after moving the only unique capability, ADMIN manual quantity correction, into the canonical surface. Adjustment is integer/nonzero + reason validated, uses one bounded serializable transaction, never creates a missing ProductInventory row, rejects negative resulting stock, writes ProductInventory `ADJUST` AuditLog with old/new quantity and reason, and does not fabricate ProductReceipt/ProductSale history. Low-stock read is now ADMIN-protected and includes quantity-zero rows; alert level 0 is preserved instead of falling back to 10. No sales/billing formula changed. Targeted S107 inventory/route/context regression passed 123/123, financial+monthly release gate 101/101, full regression 472/472, TypeScript/scoped ESLint/diff check passed, and production build 127/127 routes passed. Isolated Neon UAT confirmed canonical 200, legacy redirects 307, anonymous low-stock 401, STAFF low-stock/adjust 403, zero-stock visibility, ADMIN +5 adjustment 0->5 with AuditLog, ProductReceipt=0/ProductSale=0, overdraw -6 blocked 400 with quantity still 5, and cleanup Product/Inventory/Audit/User=0.**

Latest global admin transaction maintenance hardening rerun: **S108 — `/admin/transactions` remains KEEP_ADMIN_REPORT after parity audit because it is the only cross-station transaction edit/void surface and GAS canonical History is still read-only for transaction correction. The admin list now uses shared `requireAdminApi` session/role handling, Bangkok-today default and Bangkok day bounds, and rejects malformed dates or unknown station inputs. The global edit UI requires a 3-200 character reason and passes it as optional `auditReason`; the shared station transaction PUT records normalized final owner/payment/liters/amount plus that reason in the existing UPDATE AuditLog without breaking other callers that do not send it. No sale/billing formula or route ownership changed. Targeted S108 auth/date/audit regression passed 101/101, financial+monthly release gate 101/101, full regression 476/476, TypeScript/scoped ESLint/diff check passed, and production build 127/127 routes passed. Isolated Neon UAT confirmed anonymous admin-list 401, STAFF 403, invalid date/station 400, ADMIN list/page/edit 200, exact `auditReason` persisted, and cleanup transaction/audit/users = 0.**

Latest legacy GAS history retirement rerun: **S109 — `/admin/gas-history` retires to the v2 GAS daily report after repository caller/parity audit proved its read/create/edit/empty-cleanup duties are already split across `reports/daily`, `data-entry`, and `operations`. The old page had stale station options and the old GET could create a Station row; createRecord could produce OPEN shifts with zero meters and no gauges. The active page now redirects, canonical GAS History links ADMIN to the v2 report, legacy bookmark filters hydrate the modern report, and `/api/admin/gas-history` GET/POST/DELETE perform shared ADMIN auth then return 410 with replacement paths and no Prisma access. No financial write/formula changed. Targeted S109 redirect/API/operations regression passed 111/111, financial+monthly release gate 101/101, full regression 486/486, TypeScript/scoped ESLint/diff check passed, and production build 127/127 routes passed. UAT preflight confirmed a separate Neon UAT host, but an existing user-started Next dev on port 3005 held the shared `.next` dev lock; it was not stopped. No authenticated UAT DB write was attempted. Anonymous runtime smoke against that existing dev confirmed the legacy page returns 307 to login with the normalized v2 report redirect and the legacy API returns 401.**

Latest Gas Control v1 API retirement rerun: **S110 — `/admin/gas-control` normalizes to `/admin/gas`, and the unreferenced v1 `/api/admin/gas-control/{dashboard,gauge,meters,reports,shifts}` family is retired after caller/parity audit. The old gauge POST hard-coded tank 1 / shift 1 and a 7,200 L capacity, while old meter PUT edited individual rows outside the newer shift/reconciliation workflow; safe replacements are v2 dashboard/reports/operations plus admin data-entry and the audited opening-meter editor. All v1 methods now share `requireAdminApi` and return 410 with replacement paths; the retired route files contain no Prisma or cookie-session logic. No financial formula/write semantics changed. Targeted S110 retirement/redirect/GAS-regression gate passed 126/126, financial+monthly release gate 101/101, full regression 498/498, TypeScript/scoped ESLint/diff check passed, and production build 127/127 routes passed. Anonymous runtime smoke on the existing user-owned dev confirmed `/admin/gas-control` 307 to login with normalized `/admin/gas` target and v1 dashboard/gauge-write APIs 401. No authenticated UAT DB write was attempted and the existing dev process was not stopped.**

Latest GAS fallback-settings hardening rerun: **S111 — `/admin/gas/settings` remains an ADMIN tool only for the actual global fallback `gasPrice`; dead settings (`tankCapacity`, `tankCount`, `alertLowGauge`, `alertCriticalGauge`) are removed because no runtime caller uses them. The UI now states the authoritative priority `DailyRecord -> Station -> global fallback -> 16.09`, so editing the fallback cannot be mistaken for changing existing station/day prices. GET/POST use `requireAdminApi`; only `gasPrice` is accepted, zero/non-positive and extreme values are blocked, writes normalize to two decimals and create a GasSettings AuditLog in one bounded transaction. No sale or reconciliation formula changed. Targeted S111 settings/GAS regression passed 40/40, financial+monthly release gate 101/101, full regression 503/503, TypeScript/scoped ESLint/diff check passed, and production build 127/127 routes passed. Anonymous runtime smoke confirmed the settings page 307 to login and settings API 401. No authenticated UAT write was attempted because the existing user-owned Next dev holds the shared `.next` lock and was deliberately left untouched.**

Latest GAS reconciliation consolidation rerun: **S112 — standalone `/admin/gas/reconciliation` retires into `/admin/gas/reports/shift?view=reconciliation` after parity review proved both surfaces already use the same per-shift reconciliation PUT. Shift Report now owns reconciliation-only filtering, totals, station visibility, `status`/`editShiftId` bookmark hydration, variance-note editing, non-negative input validation, and expected/received/variance preview. Meter-report edit links and admin navigation point to the consolidated report. The old reconciliation list GET has no remaining caller, so `GET /api/v2/gas/admin/reconciliation` performs ADMIN auth then returns 410 with the replacement report and active per-shift PUT pattern; `/api/v2/gas/admin/reconciliation/[shiftId]` remains the authoritative write contract unchanged. Targeted parity/redirect/GAS regression passed 118/118, final focused regression 92/92, financial+monthly release gate 101/101, full regression 511/511, TypeScript/scoped ESLint/diff check passed, and final production build generated 127/127 routes. The first production build correctly caught an S112-only shared-shell `useSearchParams` prerender regression on `/billing`; S112 removed that shared hook, kept query-aware state local to the GAS admin layout, and the final build passed. Anonymous runtime smoke confirmed the legacy page 307 to login with all filters/deep-link preserved and the retired list API 401 before auth. No reconciliation formula, per-shift PUT implementation, authenticated UAT DB write, production DB write, push, or deploy occurred.**

Latest GAS gauge-history hardening rerun: **S113 — `/admin/gas/gauge` remains KEEP_ADMIN_REPORT because it is the only tank-by-tank opening/closing gauge history with tank filter and CSV export; `/admin/gas/supplies` also remains KEEP because its cross-station cost, gauge-verification, stock forecast and audited edit/delete capabilities exceed canonical Inventory parity. S113 hardens only `GET /api/v2/gas/admin/gauge`: shared ADMIN auth remains authoritative; default range is the latest 7 GAS business days; `from/to` must be valid ordered Bangkok date keys; station filter must resolve to configured GAS station(s); tank must be exactly 1-3; query bounds use Bangkok start/end-of-day; and returned `date/displayDate` are serialized in Asia/Bangkok rather than server UTC. No write path or financial formula changed. Targeted gauge/GAS regression passed 37/37, financial+monthly release gate 101/101, full regression 517/517, TypeScript/scoped ESLint/diff check passed, and production build 127/127 routes passed. No authenticated UAT or DB write was required for this read-only hardening.**

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
2. **`/api/payments` was the legacy Invoice payment endpoint found unreferenced in S44 and is retired in S128.** Canonical Billing must continue using `/api/invoices/[id]/payments`; do not reintroduce a global payment write that mutates `Owner.currentCredit`.
3. **Do not delete active sale/shift APIs during UI route retirement.** S45+ redirects UI entry routes one at a time; backend compatibility remains until all callers and print/read flows are proven migrated.
4. **Do not combine Invoice, BillingCollection, unbilled credit, or legacy `currentCredit` into one grand total.** Their overlap is not relationally proven for historical data.

## S45+ rule

A legacy route may be redirected only when:

- its canonical target already has feature parity,
- this financial gate remains green,
- the route is not required for read/print compatibility,
- the redirect is limited to one bounded route/session, and
- post-redirect smoke/regression verification passes before choosing another route.

### S114 GAS supply atomicity/read hardening (2026-08-30)
- Admin/station supply date filters fail closed on invalid/reversed Bangkok date ranges; admin station filter accepts configured GAS stations only.
- LPG receiving normalization/math is unchanged; write mutation + AuditLog are now atomic for station CREATE and admin CREATE/UPDATE/DELETE.
- Verified release gate: **101/101 tests passed**; full regression **530/530**; production build **127/127 routes**.
### S115 GAS Executive Billing-source alignment (2026-08-30)
- Live GAS Executive no longer uses drift-prone `Owner.currentCredit` for AR.
- Executive and canonical Billing use the same derived three-bucket summary: unbilled credit-like transactions, Invoice outstanding, and BillingCollection outstanding.
- These buckets remain deliberately separate; do not sum them into a grand total because historical overlap is not relationally proven.
- Verified release gate: **101/101 tests passed**; full regression **534/534**; production build **127/127 routes**.

### S116 GAS admin dashboard fact alignment (2026-08-30)
- Live GAS dashboard sales/liters/transaction summaries now derive from the same shift analytics facts as GAS reports, including configured aliases and void/deleted/orphan handling.
- Today/week/month boundaries are Bangkok business-date based and bounded through today; the selector applies consistently to sales, liters and transaction counts.
- This is read-only alignment: no sale, price, reconciliation, payment or inventory write formula changed.
- Verified release gate: **101/101 tests passed**; full regression **539/539**; production build **127/127 routes**.

### S117 SIMPLE mock-stock retirement (2026-08-30)
- `/admin/simple/stock` and its v2 stock endpoint no longer expose randomized mock inventory/order data; no production tank source exists for retired SIMPLE stations.
- This phase changes no transaction, payment, price, invoice, reconciliation or inventory write formula.
- Verified release gate: **101/101 tests passed**; full regression **544/544**; production build **127/127 routes**.

### S118 SIMPLE admin read-scope hardening (2026-08-30)
- Real SIMPLE admin reports remain read-only and now require ADMIN before operational-sales/Prisma access; report range/station/type inputs fail closed to bounded SIMPLE-only scope.
- No transaction, payment, price, invoice, reconciliation or operational-sales aggregation formula changed.
- Verified release gate: **101/101 tests passed**; full regression **558/558**; production build **127/127 routes**.

### S119 FULL admin fact/date alignment (2026-08-30)
- FULL executive/anomaly reads now use the shared operational-sales fact dataset for selected-day, selected-month-to-date, 30-day and fuel summaries, with explicit Bangkok date keys.
- The only direct transaction read is selected-day void count; sale/payment/pricing/shift write formulas are unchanged.
- Verified release gate: **101/101 tests passed**; full regression **563/563**; production build **127/127 routes**.

### S120 anomaly / Anti-Fraud admin hardening (2026-08-30)
- Existing anomaly thresholds/formulas are unchanged (MeterAnomaly 50%/100%; DailyAnomaly 10L/50L).
- Anti-Fraud shift lock and MeterAnomaly review are ADMIN-only, conditional and atomic with AuditLog; DailyAnomaly GET no longer performs hidden scan/write work, while explicit scans are bounded to configured FULL stations and 1-90 days.
- No sale, meter, reconciliation, payment, invoice, pricing or anomaly-detection formula changed.
- Verified release gate: **101/101 tests passed**; full regression **583/583**; production build **127/127 routes**.

### S121 Product Inventory scope / retired-page defense (2026-08-30)
- `/admin/inventory` and `/admin/low-stock` remain retired to canonical station-5 Inventory; page files are now redirect-only defense in depth.
- ProductInventory compatibility reads and ADMIN adjustment are scoped to `STATIONS.hasProducts` (currently station-5); invalid/non-product stations fail before service/Prisma mutation.
- Existing ADMIN adjustment amount semantics, non-negative guard, serializable transaction, AuditLog, ProductReceipt/ProductSale separation and station-5 canonical behavior are unchanged.
- Targeted regression: **104/104**; financial + monthly gate: **101/101**; full regression: **590/590**; production build: **127/127**.

### S122 Dispenser/Nozzle master-data hardening (2026-08-30)
- Local Dispenser/Nozzle remains a separate master-data capability from Watchara external sync; meter reconciliation can use linked nozzle FuelProduct/PriceBook data.
- Writes are ADMIN-only, active-station-only, canonical-station normalized and atomic with CREATE/UPDATE/DELETE AuditLog; FuelProduct references must be active.
- No financial formula, sale amount calculation, price-book selection rule or billing behavior changed.
- Targeted regression: **31/31**; financial + monthly gate: **101/101**; full regression: **600/600**; production build: **127/127**.

### S123 Watchara integration local commit hardening (2026-08-30)
- Watchara external integration remains separate from local Dispenser/Nozzle master data.
- No sales/billing formula changed; this phase hardens control-plane auth/date parsing and the local persistence boundary only.
- Bootstrap source upsert + AuditLog is atomic. Successful sync landing-row upserts + source success metadata + sync AuditLog are atomic after external fetch; failed external attempts can still record `lastError` outside that success transaction.
- Date validation rejects impossible calendar dates; sync range remains max 31 days; page defaults use Bangkok date.
- Targeted regression: **20/20**; financial + monthly gate: **101/101**; full regression: **609/609**; production build: **127/127**.

### S124 Temporary fix-shift API retirement (2026-08-31)
- Removed the unreferenced direct force-close/hard-delete/renumber implementation from `/api/admin/fix-shift`; authenticated ADMIN callers now receive 410 and replacement audited workflows.
- This phase removes an unsafe write path and introduces no sale, shift-close, reconciliation, payment, invoice or pricing formula.
- Targeted regression: **25/25**; financial + monthly gate: **101/101**; full regression: **612/612**; production build: **127/127**.

### S125 SIMPLE shift-status force-close retirement (2026-08-31)
- `GET /api/simple-station/[id]/shift-status` remains read-only compatibility; the legacy POST force-close write is retired with 410 after station access.
- This removes a direct unaudited Shift mutation and adds no replacement calculation/write path; canonical Operations and retired-station read-only policy remain authoritative.
- Targeted regression: **220/220**; financial + monthly gate: **101/101**; full regression: **615/615**; production build: **127/127**.

### S126 SIMPLE shift-end write retirement (2026-08-31)
- Historical/read GET remains available, but the legacy SIMPLE shift-end POST no longer invokes the financial/operational `closeFullShift()` path.
- Canonical station-1 Operations remains the active FULL close source of truth; retired SIMPLE stations stay read-only/POS. No replacement formula or write path was added.
- Targeted regression: **223/223**; financial + monthly gate: **101/101**; full regression: **618/618**; production build: **127/127**.

### S127 SIMPLE product mutation retirement (2026-08-31)
- SIMPLE product GET remains read compatibility; legacy POST/PUT/DELETE no longer create/update/delete Product or ProductInventory rows.
- Active product-stock writes remain the canonical station-5 Inventory contract. No stock, sale, billing, payment or pricing formula was changed.
- Targeted regression: **229/229**; financial + monthly gate: **101/101**; full regression: **624/624**; production build: **127/127**.

### S128 Legacy global Invoice payment API retirement (2026-08-31)
- `/api/payments` had no internal caller and previously wrote Payment, Invoice and legacy `Owner.currentCredit` in separate steps. It is now retired after auth with 410.
- Canonical Billing continues to use only `/api/invoices/[id]/payments`, whose transaction and optimistic-concurrency guard are unchanged.
- Targeted regression: **28/28**; financial + monthly gate: **101/101**; full regression: **629/629**; production build: **127/127**.

### S129 Global Product API retirement (2026-08-31)
- Unreferenced `/api/products` GET/POST now retire after auth; the global non-station Product create path is removed.
- Active supplemental product writes remain station-5 canonical Inventory and existing station product APIs; no stock/sale/payment/billing formula changed.
- Targeted regression: **30/30**; financial + monthly gate: **101/101**; full regression: **633/633**; production build: **127/127**.

### S130 PriceBook control-plane hardening (2026-08-31)
- PriceBook remains a financial/reconciliation input: active `PriceBookLine` can supply per-nozzle expected fuel price. The reconciliation lookup/fallback formula itself is unchanged.
- Line-based API writes now validate station/date/active FuelProduct/positive unique prices, reject scalar `price-service` rows, and commit PriceBook + line replacement + AuditLog atomically. Active reads are authenticated and STAFF station-scoped.
- Targeted regression: **39/39**; financial + monthly gate: **101/101**; full regression: **644/644**; production build: **127/127**.

### S131 Product Inventory atomic write gate (2026-08-31)
- [x] Canonical station-5 product create/update/receive writes use bounded SERIALIZABLE transactions.
- [x] Product create + ProductInventory + opening receipt (when any) + AuditLog commit atomically.
- [x] Price + alert-level update + AuditLog commit atomically.
- [x] Receive increment + ProductReceipt + AuditLog commit atomically.
- [x] Invalid/fractional/negative quantities and invalid prices fail before writes.
- [x] Missing/non-product station fails closed; POST no longer silently upserts Station.
- [x] Direct legacy product sale/add mutation paths return 410 and cannot mutate ProductInventory/ProductSale.
- [x] V2 shift-close stock-count/ProductSale/reconciliation calculation is unchanged.
- [x] Targeted regression **49/49**, financial/monthly gate **101/101**, full regression **652/652**, TypeScript/scoped ESLint/diff check passed.
- [x] Post-review focused regression **22/22**, full regression **652/652**, TypeScript/scoped ESLint/diff check, and production build **127/127** passed.
- [x] Isolated UAT create/update/receive verified quantity `5`, sale price `23`, alert level `2`, two ProductReceipt rows and three AuditLog rows; cleanup returned Product/ProductInventory/ProductReceipt/ProductSale/AuditLog counts to zero.

### S132 Legacy GAS transaction write retirement (2026-08-31)
- [x] Legacy GAS transaction POST/DELETE authorize first, return 410, and contain no Prisma mutation.
- [x] Canonical GAS sales remain on `/api/v2/gas/[stationId]/sell` with `CASH`, `CREDIT`, `CREDIT_CARD`, and `TRANSFER` only.
- [x] Legacy per-Transaction `EXPENSE` creation is removed; shift closing/admin data entry retain aggregate `otherExpensesAmount` reconciliation.
- [x] `BOX_TRUCK` and `OIL_TRUCK_SUPACHAI` remain FULL-only and are intentionally unsupported for GAS sales.
- [x] Canonical transaction void requires a trimmed 3-200 character reason before reads/writes.
- [x] Transaction void state and DELETE AuditLog commit in one Prisma transaction.
- [x] Repeat/concurrent void requests return 409 and preserve the first reason, time, user and single AuditLog.
- [x] Targeted regression **43/43**, financial/monthly gate **101/101**, full regression **667/667**, TypeScript/diff check and production build **127/127** passed.

### S133 Legacy owner/currentCredit admin retirement (2026-08-31)
- [x] Retired admin owner list/edit APIs authorize ADMIN first and return 410 without Prisma access.
- [x] Canonical Customer master-data edit remains `/api/owners/[id]`; canonical AR remains separate unbilled / Invoice / BillingCollection buckets.
- [x] `/api/admin/owners/merge` remains active and unchanged for audited atomic duplicate-owner merge.
- [x] Dead `checkCreditLimit`, `updateOwnerCredit`, and `getOwnersWithOutstandingCredit` helpers are removed; no runtime currentCredit mutation helper remains in `credit-service`.
- [x] Retired owner/outstanding/credit-limit pages server-redirect to Customers/Billing and Sidebar points directly to Customers.
- [x] Targeted regression **106/106**, financial/monthly gate **101/101**, full regression **672/672**, TypeScript/scoped ESLint/diff check passed; production build **127/127** passed with `NODE_ENV=production`; the first attempt inherited non-standard machine-level `NODE_ENV=development` and failed in unrelated prerender pages.
