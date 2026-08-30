# Credit Billing — Route Migration Plan

> Source of truth for S03 + S37. Redesign is incremental: keep legacy compatibility until feature parity + financial regression, except operational create routes for business-retired SIMPLE stations (station-2/3/4).

## Canonical destinations

| Domain | Canonical route |
| --- | --- |
| Work queue | `/today` |
| Sales entry / station chooser | `/sales` |
| Station home | `/stations/[stationId]` |
| Active-station sales | `/stations/[stationId]/sales` |
| Active-station operations | `/stations/[stationId]/operations` |
| Station history | `/stations/[stationId]/history` |
| Customers | `/customers` |
| Customer 360 | `/customers/[id]` |
| Billing | `/billing` |
| Billing detail | `/billing/[id]` |
| Reports | `/reports` |

Canonical station IDs are `station-1` … `station-6`. URL structure must not encode FULL/SIMPLE/GAS.

**Global landing (S81 pass 3):** `/` และ exact legacy `/dashboard` ไป `/today`; normal login/default authenticated landing ใช้ `/today`. Subroutes เช่น `/dashboard/executive` ยังเป็น compatibility surface แยกต่างหาก.

## Business scope

- **ACTIVE:** `station-1` (FULL), `station-5` and `station-6` (GAS).
- **RETIRED operationally:** `station-2`, `station-3`, `station-4` (SIMPLE). Forecourt work moved to another POS.
- Retired means **no new sale / open shift / close shift / operational stock work in this system**.
- Historical transactions, billing, customer references, reports, receipts and audit evidence are preserved.

## Disposition vocabulary

- **REDIRECT_NOW_RETIRED** — safe to remove the create/operate entry for station-2/3/4 because the business has retired that workflow.
- **REDIRECT_AFTER_S44** — new equivalent exists, but keep legacy until the financial regression checklist is complete; S45+ retires one route at a time.
- **KEEP_UNTIL_S38_S40** — active operational/open-close/history parity is not complete yet.
- **KEEP_FULL_ADMIN_COMPAT** — keep FULL legacy workspace while it still owns admin edit/print/audit/historical correction capabilities not yet migrated.
- **KEEP_GAS_CORRECTION** — keep a GAS operational correction surface when canonical normal workflow cannot yet repair the same guarded state safely.
- **KEEP_GAS_INVENTORY** — keep GAS supply/product inventory workflows until their create/edit/receive/history capabilities have a canonical replacement.
- **KEEP_GAS_WORKSPACE** — keep the current GAS landing while it is still the only discoverable entry for retained correction/inventory tools or an active staff capability such as price update.
- **KEEP_READ_COMPAT** — keep for historical/summary compatibility until the canonical read path proves parity.
- **KEEP_PRINT_COMPAT** — keep a legacy print surface when it still owns verified receipt/document layout or printer integration that canonical History does not replace.
- **KEEP_HISTORICAL_MAINTENANCE** — legacy surface still owns audited historical correction plus read/print/export behavior; retired-station mutation is ADMIN-only and must not be redirected until a canonical maintenance replacement exists.
- **KEEP_MASTER_DATA** — still contains create/edit administration not yet moved into Customer 360.
- **KEEP_ADMIN_REPORT** — admin/reporting tool; not part of the first station-route retirement wave.
- **API_COMPAT** — do not redirect API routes; new adapters intentionally call existing APIs until backend migration is a separate verified change.

## FULL — legacy `/station/[id]`

Applicable active station: `station-1`.

| Legacy route | Future route | Disposition | Notes |
| --- | --- | --- | --- |
| `/station/1/v2` | `/stations/station-1/history` | **S96 RETIRED** | S93-S95 moved all unique correction/maintenance/print/audit capabilities to canonical Operations/History. S96 isolated patch UAT, financial gate and redirect/query/auth tests passed; direct V2 entry now redirects to canonical History. |
| `/station/1` | `/stations/station-1` | **S96 RETIRED** | Classic FULL root no longer owns a unique admin capability; all navigation now points directly to canonical Overview and middleware preserves query/auth normalization. |
| `/station/1/new/home` | `/stations/station-1` | **S61 IMPLEMENTED** | Old navigation entry now redirects directly to canonical Station Overview; no unique capability lived in this route. |
| `/station/1/new/sell` | `/stations/station-1/sales` | **S55 IMPLEMENTED** | Direct canonical SaleFlow redirect; canonical SaleFlow is the supported operational workspace. |
| `/station/1/new/oil-sell` | `/stations/station-1/sales` | **S56 IMPLEMENTED** | Direct canonical SaleFlow redirect; prior route was redirect-only because Tank Loy has no engine-oil/product flow. |
| `/station/1/new/open-shift` | `/stations/station-1/operations` | **S57 IMPLEMENTED** | Direct canonical Operations redirect after S38-S40 parity + operational/financial regression; canonical opening preserves daily-price + shift APIs and requires 4 start meters with photos before sale. |
| `/station/1/new/close-shift` | `/stations/station-1/operations` | **S58 IMPLEMENTED** | Direct canonical Operations redirect after S39 closing/reconciliation parity + operational/financial regression; legacy APIs/history preserved. |
| `/station/1/new/shift-end` | `/stations/station-1/operations` | **S59 IMPLEMENTED** | Direct canonical Operations redirect after S39 closing/reconciliation parity; legacy APIs/read compatibility preserved. |
| `/station/1/new/meters` | `/stations/station-1/operations` | **S60 IMPLEMENTED** | Direct canonical Operations redirect; legacy route was redirect-only to `/new/shift-end`, so no standalone meter capability is removed. |
| `/station/1/new/meter-summary` | `/stations/station-1/history` | **S87 IMPLEMENTED** | Legacy page was read-only. It compared raw meter liters with transaction liters/amount, but its meter-money value multiplied readings by hard-coded `STATION_FUEL_CONFIGS` prices (station-1 = 30.84) rather than persisted historical prices. Canonical History preserves the reliable evidence: per-nozzle start/end/sold, photos, transaction liters/amount, liters difference, reconciliation and anomalies. Middleware and page wrapper now redirect to canonical History; query strings are preserved.
| `/station/1/new/shift-history` | `/stations/station-1/history` | **S86 IMPLEMENTED** | Legacy page was read-only and showed date, OPEN/CLOSED status, opener/closer, duration and per-nozzle meter start/end/sold. Canonical History now has all of that plus LOCKED, meter photos, transaction totals, reconciliation and anomaly evidence. Middleware and route wrapper redirect directly to canonical History; query strings are preserved by middleware. |
| `/station/1/new/summary` | `/stations/station-1/history` | **S96 FINALIZED** | FULL legacy summary is retired to V2 after closing its maintenance/export gaps: V2 now exports CSV with payment-type filtering, supports historical transfer-proof attach/replacement, uses the correct station-scoped transaction DELETE path, keeps edit/void + receipt/credit 58/80 + daily print, and preserves audit/locking via the existing APIs. S89 first consolidated this page into V2; S95 closed canonical maintenance parity and S96 now redirects it directly to History. Legacy SIMPLE summary for retired stations remains separate. |
| `/station/1/new/list` | `/stations/station-1/history` | **S96 FINALIZED** | Redirect-only compatibility entry with no unique data/action; S96 removes the V2 hop and preserves query/auth normalization. |
| `/station/1/new/record` | `/stations/station-1/history` | **S96 FINALIZED** | Redirect-only compatibility entry with no unique data/action; S96 removes the V2 hop and preserves query/auth normalization. |
| `/station/1/new/receipt` | canonical history/detail | KEEP_READ_COMPAT | Preserve receipt/print behavior. |
| `/station/1/new/products` | `/stations/station-1` | **S90 IMPLEMENTED** | FULL station-1 has `hasProducts=false` in canonical capability data and the legacy FULL wrapper never owned product CRUD; it only redirected back to home. Both `/station/1/new/products` and the Tank Loy alias `/simple-station/1/new/products` now normalize to canonical Overview. Shared SIMPLE product CRUD/API is preserved and no product data was changed. |

## GAS — current legacy `/gas/[stationId]`

Applicable active stations: station numbers `5`, `6` (legacy URL parameters may be numeric or aliases depending on route).

| Legacy route | Future route | Disposition | Notes |
| --- | --- | --- | --- |
| `/gas/5`, `/gas/6` | `/stations/station-5`, `/stations/station-6` | **S73 IMPLEMENTED** | Root GAS landing now redirects directly to canonical Station Overview after S69/S70/S72 parity. Middleware/login preserve query and normalize auth redirects; legacy dashboard source is retained. Correction/inventory/summary subroutes remain separate compatibility routes. |
| `/gas/5/sell`, `/gas/6/sell` | `/stations/station-5/sales`, `/stations/station-6/sales` | **S53 IMPLEMENTED** | Server-side redirect to canonical SaleFlow; legacy source preserved in `LegacyGasSellPage.tsx`. |
| `/gas/[id]/shift/open` | `/stations/station-[id]/operations` | **S62 IMPLEMENTED** | station-5/6 redirect to canonical Operations. Canonical uses the same atomic GAS open API with price + 4 meters + 3 gauges and derives next shift from actual business-day shifts. |
| `/gas/[id]/shift/close` | `/stations/station-[id]/operations` | **S63 IMPLEMENTED** | station-5/6 redirect to canonical Closing after parity guard. Canonical saves end meters + gauges, then uses the same GAS close/reconciliation API; legacy source preserved. |
| `/gas/[id]/meters` | `/stations/station-[id]/operations` | **S98 RETIRED for station-5/6** | Canonical Operations now owns guarded START correction and standalone END save/retry on the exact OPEN Shift, preserving existing photo evidence when no replacement is selected. Backend baseline lock remains authoritative; post-activity ADMIN repair still uses the audited admin meter-edit flow. Legacy component remains in-tree as fallback source. |
| `/gas/[id]/gauge` | `/stations/station-[id]/operations` | **S98 RETIRED for station-5/6** | Canonical Operations now owns guarded START-gauge correction and standalone END-gauge save/retry on the exact OPEN Shift. Existing gauge photo URLs are preserved on rewrite and the existing baseline lock still rejects unsafe START edits. Legacy component remains in-tree as fallback source. |
| `/gas/[id]/supplies` | `/stations/station-[id]/inventory` | **S99 RETIRED for station-5/6** | Canonical Inventory now owns LPG receiving plus date-filtered history/summary using the existing station-scoped supplies API and AuditLog. Current and older supplies bookmarks redirect with auth/query preservation; legacy component remains in-tree as fallback source. |
| `/gas/5/products` | `/stations/station-5/inventory` | **S100 RETIRED** | Canonical Inventory now owns create product, receive stock, sale-price/alert edit and IN/OUT history. S100 removed the legacy GET-side Station upsert so inventory reads are read-only; current/older station-5 product bookmarks redirect to canonical Inventory. |
| `/gas/6/products` | `/stations/station-6` | **S81 CAPABILITY GUARD** | station-6 has `hasProducts=false`. Direct UI/bookmark now redirects to canonical Overview; product APIs already enforce `requireGasProductsEnabled`. |
| `/gas/[id]/summary` | `/stations/station-[id]` | **S80 IMPLEMENTED for station-5/6** | Active current summary UI now redirects to canonical Overview after S79 parity. Middleware/login preserve query and normalize unauthenticated bookmarks; legacy UI source is retained as fallback. `GET /api/v2/gas/[stationId]/summary` remains a required read API for canonical live summary and closing flow. |

## GAS — older `/gas-station/[id]/new/*`

These are an older GAS route family. Do not remove by naming alone; some links/bookmarks may still exist.

| Legacy route family | Future route | Disposition |
| --- | --- | --- |
| `/gas-station/[id]` | `/stations/station-[id]` | **S74 IMPLEMENTED for station-5/6** |
| `/gas-station/[id]/new`, `/new/home` | `/stations/station-[id]` | **S74 IMPLEMENTED for station-5/6** |
| `/gas-station/[id]/new/sell` | `/stations/station-[id]/sales` | **S54 IMPLEMENTED** |
| `/gas-station/[id]/new/meters` | `/stations/station-[id]/operations` | **S98 FINALIZED** |
| `/gas-station/[id]/new/supplies` | `/stations/station-[id]/inventory` | **S99 FINALIZED for station-5/6** |
| `/gas-station/[id]/new/products` | station-5 → canonical Inventory; station-6 → canonical overview | **S100 FINALIZED / S77 CAPABILITY GUARD** |
| `/gas-station/[id]/new/summary`, `/new/shift-summary` | `/stations/station-[id]` | **S80 IMPLEMENTED for station-5/6** |
| `/gas-station/[id]/new/monthly-balance` | `/stations/station-[id]` | **S78 IMPLEMENTED for station-5/6** |

## SIMPLE — retired `/simple-station/[id]`

Applicable retired station numbers: `2`, `3`, `4` only.

### Safe to close operational entry now

These routes may redirect to `/stations/station-[id]`, whose StationContext shows the POS-migration notice and exposes no create/operate action:

- `/simple-station/[id]` — **S45 IMPLEMENTED** สำหรับ station-2/3/4 → `/stations/station-[id]`
- `/simple-station/[id]/new/home` — **S46 IMPLEMENTED** สำหรับ station-2/3/4 → `/stations/station-[id]`
- `/simple-station/[id]/new/sell` — **S47 IMPLEMENTED** สำหรับ station-2/3/4 → `/stations/station-[id]`
- `/simple-station/[id]/new/oil-sell` — **S48 IMPLEMENTED** สำหรับ station-2/3/4 → `/stations/station-[id]`
- `/simple-station/[id]/new/open-shift` — **S49 IMPLEMENTED** สำหรับ station-2/3/4 → `/stations/station-[id]`
- `/simple-station/[id]/new/close-shift` — **S50 IMPLEMENTED** สำหรับ station-2/3/4 → `/stations/station-[id]`
- `/simple-station/[id]/new/shift-end` — **S51 IMPLEMENTED** สำหรับ station-2/3/4 → `/stations/station-[id]`
- `/simple-station/[id]/new/products` — **S52 IMPLEMENTED** สำหรับ station-2/3/4 → `/stations/station-[id]`

Disposition: **REDIRECTED_RETIRED_COMPLETE**. S45-S52 ปิด retired SIMPLE operational/create entry ครบทุก route ที่กำหนดแล้วแบบ server-side redirect; legacy source/API/history ยังเก็บ compatibility และ read-only routes ด้านล่างยังไม่ redirect.

### Keep read compatibility until S40

- `/simple-station/[id]/new/shift-history` — **S82 IMPLEMENTED** สำหรับ station-2/3/4 → `/stations/station-[id]/history`; canonical History now exposes opener/closer, duration, per-nozzle meter start/end/sold evidence, date/status filters and read-only retired notice.
- `/simple-station/[id]/new/meter-summary` — **S83 IMPLEMENTED** สำหรับ station-2/3/4 → `/stations/station-[id]/history`; legacy `date` bookmark is preserved as canonical `from=to`. Canonical History compares raw meter liters with persisted transaction liters/amount and shows the liters difference. Legacy meter-money values are not treated as parity because they use hard-coded current prices and station-3 falls back to station-2 fuel config.
- `/simple-station/[id]/new/summary` — **S101 RETIRED** → `/stations/station-[id]/history`. Canonical History now reuses the audited daily-maintenance surface for retired SIMPLE: STAFF keeps read/view-slip/receipt reprint/CSV/daily print only; ADMIN additionally gets edit, void, transfer-proof replacement and AuditLog review. Historical create remains disabled for retired SIMPLE; no new frontline work is exposed.
- `/simple-station/[id]/new/receipt` — **KEEP_PRINT_COMPAT (S85 REVIEWED)**. This route remains the receipt/credit reprint surface for Epson TM-m30III and browser print, supports 58/80 mm, original + copy, and credit signature lines. S85 binds transaction URLs to the transaction station, selects print config from `transaction.stationId`, and fails closed for station-3 because its previous config incorrectly reused the Supachai header and no verified Ponganan address/phone exists in repo history.

Disposition: `shift-history` retired in S82, `meter-summary` retired in S83, and `summary` retired in S101 after role-safe maintenance parity. `receipt` remains **KEEP_PRINT_COMPAT** after S85 audit; station-3 historical receipt printing stays fail-closed until a verified legal/header config is supplied.

## Billing routes

| Legacy route | Canonical | Disposition |
| --- | --- | --- |
| `/invoices`, `/admin/invoices` | `/billing` | **S104 RETIRED** — canonical Billing owns unbilled review, ADMIN Invoice creation, receive-payment and unpaid delete. Multi-owner selection creates one Invoice per owner; unsafe single-Invoice multi-owner mode is rejected. |
| `/invoices/[id]` | `/billing/[id]?kind=INVOICE` | **KEEP_PRINT_COMPAT** — canonical detail owns normal read/payment/delete/export actions, but this verified legacy detail remains only for browser/legal-layout print. Export API is authenticated. |
| `/billing-collections` | `/billing` | **S104 RETIRED** — canonical Billing owns manual BillingCollection creation and workspace list/filtering. |
| `/billing-collections/[id]` | `/billing/[id]?kind=BILLING_COLLECTION` | **S104 RETIRED** — canonical detail owns evidence upload plus ADMIN verify/reject/delete of pending slips. |
| `/admin/generate-invoices` | `/billing?batch=monthly` | **S106 RETIRED** — canonical Billing owns ADMIN monthly batch generation. The batch derives owners from real unbilled credit-like transactions, uses Bangkok month boundaries, connects source transactions atomically, audits every created Invoice, and skips an owner when an Invoice already exists anywhere on the same Bangkok due-date day (including legacy UTC-midnight rows). |
| `/admin/outstanding` | `/billing` | **S105 RETIRED** — legacy page summed `Owner.currentCredit`, which live audit proved can drift from actual unbilled + Invoice balances. Canonical Billing shows separated source-of-truth debt buckets instead. |
| `/admin/credit-limit` | `/customers` / Customer 360 | **S105 RETIRED** — canonical Customer 360 already owns ADMIN credit-limit edit and shows legacy credit only as a labeled non-authoritative indicator. |

S104 makes `/billing` the normal user-facing Billing workspace. Invoice writes are owner-scoped and audited in bounded serializable transactions; BillingCollection create/review is ADMIN-only. `/invoices/[id]` deliberately remains a print-only compatibility surface. S105 retires the old currentCredit-based outstanding report to Billing and the duplicate credit-limit editor to Customers. S106 then moves the final monthly Invoice batch action into canonical Billing and retires `/admin/generate-invoices`; the API remains as the ADMIN-only batch write contract.

## Customer/master-data routes

| Legacy route | Canonical | Disposition |
| --- | --- | --- |
| `/owners` | `/customers` | **S102 RETIRED** — canonical Customers/Customer 360 now owns ADMIN create/edit/soft-deactivate plus add/edit-plate for the current customer's trucks. Legacy bookmark/login redirects normalize to `/customers`. |
| `/admin/owners` | `/customers` | **S103 RETIRED** — canonical Customers ADMIN tools now own duplicate merge; merge moves Truck, Transaction, Invoice and BillingCollection relations atomically, audits the target, guards dual LINE mappings, and preserves BillingCollection `ownerName` snapshot. |
| `/trucks` | `/customers` / `/customers/[id]` | **S103 RETIRED** — Customer 360 owns add/edit-plate for the current customer and Customers ADMIN tools own cross-owner reassignment. Truck PUT is ADMIN-only; frontline search/create contracts remain. |

S102 moved ordinary owner master-data writes into canonical Customers. S103 completes the user-facing master-data migration by retiring `/trucks` and `/admin/owners`; Owner/Truck APIs stay as compatibility/data contracts for sale and search flows.

## Admin/report routes

S107 retires `/admin/inventory` and `/admin/low-stock` to `/stations/station-5/inventory`. Canonical station-5 Inventory now owns product create/receive/price-alert/history plus ADMIN-only audited manual `+/-` quantity correction and low-stock visibility (including quantity zero). The legacy admin inventory APIs remain compatibility contracts, but low-stock read is ADMIN-protected and manual adjustment no longer creates a missing inventory row silently.

S111 reviews `/admin/gas/settings` and **keeps only the global GAS fallback price capability**. Runtime price priority is `DailyRecord.gasPrice -> Station.gasPrice -> gasSettings.gasPrice -> DEFAULT_GAS_PRICE`; therefore this page must not describe its value as applying to every station. The unused `tankCapacity`, `tankCount`, `alertLowGauge`, and `alertCriticalGauge` controls are removed from the UI/API surface. Settings GET/POST are ADMIN-only; only `gasPrice` is accepted, value must be positive, and writes are audited in one bounded transaction.

S112 retires standalone `/admin/gas/reconciliation` into `/admin/gas/reports/shift?view=reconciliation`. The Shift Report now owns reconciliation-only status filtering, totals, station context, `editShiftId` deep-link editing, variance-note editing and preview while continuing to use the existing `/api/v2/gas/admin/reconciliation/[shiftId]` PUT. Legacy filters are preserved through middleware/login normalization, and meter-report edit links point to the same consolidated surface.

S113 reviews `/admin/gas/gauge` and `/admin/gas/supplies` and **keeps both intentionally**. Gauge History remains the only per-tank opening/closing history with tank filtering and CSV; Admin Supplies still owns cross-station cost analysis, gauge verification, stock forecast and audited edit/delete beyond canonical Inventory. S113 hardens the gauge read contract with strict Bangkok date/station/tank validation and a useful seven-business-day default without changing route ownership.

S114 keeps `/admin/gas/supplies` as **KEEP_ADMIN_REPORT** but hardens its active contracts. Admin and station-scoped supply reads now fail closed on invalid Bangkok date ranges (and admin station filters); malformed write JSON returns 400. Station-scoped CREATE plus admin CREATE/UPDATE/DELETE now mutate `GasSupply` and write `AuditLog` atomically in one bounded Prisma transaction. Admin edit continues to forbid moving an existing delivery across stations, matching the disabled station selector in the current UI.

S116 keeps `/admin/gas` as **KEEP_ADMIN_REPORT** and hardens its live dashboard read path. Dashboard totals/current shifts now come from the shared GAS shift analytics fact layer so configured aliases and void/deleted/orphan handling match reports; Bangkok date windows no longer depend on server-local setters. Gauge alerts/average use the latest reading per tank 1-3 across canonical+alias IDs, and UI refresh failures no longer masquerade as zero business activity.

S117 retires `/admin/simple/stock` because the page/API were explicitly random mock tank data (`Math.random()`) with no production Tank source. The navigation entry is removed, direct/bookmarked UI access normalizes to `/admin/simple`, and `GET /api/v2/simple/admin/stock` now applies the shared ADMIN guard then returns 410 instead of fabricated inventory/ordering data. Other SIMPLE analytics/report surfaces remain KEEP_ADMIN_REPORT pending separate review.

S118 keeps `/admin/simple`, `/admin/simple/stations`, `/admin/simple/fuel-time`, and `/admin/simple/analytics` as **KEEP_ADMIN_REPORT** because they read real operational/Watchara sales facts. Their v2 read APIs now require ADMIN before touching report data; `days` is bounded to integer 1-90, optional station filters are limited to station-2/3/4, and the analytics endpoint is SIMPLE-only because no internal FULL caller exists.

S119 keeps `/admin/full` and `/admin/full/anomalies` as **KEEP_ADMIN_REPORT** because they provide FULL executive/anomaly views not present in canonical station History. `/api/v2/full/admin/dashboard` now requires ADMIN, validates real calendar date keys, and derives selected-day/month-to-selected-day/30-day/fuel facts from the shared operational-sales dataset with Bangkok date keys. Voided anomaly count is the only direct transaction read and is Bangkok-bounded with `deletedAt:null`; UI date presets/labels and failure states no longer depend on UTC browser dates or silently show empty data.

S120 keeps `/admin/alerts`, `/admin/anomalies`, and `/admin/daily-anomalies` as distinct **KEEP_ADMIN_REPORT** tools: Anti-Fraud shift/reconciliation/audit maintenance, per-shift/nozzle `MeterAnomaly` review, and FULL daily meter-vs-transaction anomaly review. All admin anomaly APIs now use shared ADMIN authorization; MeterAnomaly review and Anti-Fraud shift locking are atomic with AuditLog, daily-anomaly GET is read-only (auto-scan side effects removed), and explicit daily scans are bounded to configured FULL stations and 1-90 days. Existing detection thresholds/formulas are unchanged.

`/admin/full/*`, remaining `/admin/gas/*`, `/admin/simple/*`, `/admin/transactions` and remaining anomaly/report pages remain **KEEP_ADMIN_REPORT** unless a later task explicitly proves canonical parity. Retired SIMPLE admin history/report data remains readable; only front-line operational create entry is retired. **S108 REVIEWED `/admin/transactions` and keeps it intentionally:** it is the only cross-station transaction edit/void workspace while GAS canonical History remains read-only. S108 hardens its list read with shared ADMIN/session guards, Bangkok date/station validation, and requires an edit reason in this global UI so the station transaction UPDATE AuditLog records the reason; no route redirect is introduced. **S109 RETIRES `/admin/gas-history`** to `/admin/gas/reports/daily`: read history is owned by the v2 daily/meter/shift reports, historical create/edit is owned by `/admin/gas/data-entry`, and empty-shift cleanup is owned by `/admin/gas/operations`. Legacy `startDate/endDate/stationId` bookmark filters are preserved and the modern daily report hydrates them. **S110 FINALIZES `/admin/gas-control` v1 retirement:** the UI normalizes to `/admin/gas`, and repository caller audit found no internal callers for the v1 dashboard/gauge/meters/reports/shifts API family.

## APIs

All `/api/station/*`, `/api/v2/gas/*`, `/api/simple-station/*`, invoice/payment, billing-collection and other legacy APIs are **API_COMPAT** for now unless a phase explicitly retires an unreferenced unsafe contract. **S109 explicitly retires `/api/admin/gas-history` GET/POST/DELETE:** repository caller audit found only the retired `/admin/gas-history` page, while the old GET could create a Station row and the old writes could create incomplete GAS shifts without gauges. The route now applies the shared ADMIN guard then returns 410 with the v2 read/edit/operations replacement paths; it performs no Prisma read/write. **S110 explicitly retires `/api/admin/gas-control/{dashboard,gauge,meters,reports,shifts}`:** no internal caller remains; dashboard/reports/shifts reads have v2 equivalents, historical gauge correction belongs in `/admin/gas/data-entry`, and opening-meter correction belongs in the audited v2 meter editor. The old gauge POST hard-coded tank 1 / shift 1 and the old meter PUT edited rows outside the newer shift-level reconciliation workflow. Every v1 method now uses a shared ADMIN guard and returns 410 with replacement paths, with no Prisma/session-cookie implementation left. **S112 explicitly retires only the reconciliation list GET `/api/v2/gas/admin/reconciliation`:** its sole UI caller is retired and Shift Report reads the richer `/api/v2/gas/admin/reports/shift`; the list GET now applies the ADMIN guard and returns 410 without Prisma/analytics access. The active per-shift PUT `/api/v2/gas/admin/reconciliation/[shiftId]` remains API_COMPAT and unchanged because Shift Report still uses it for audited corrections. **S113 keeps `/api/v2/gas/admin/gauge` as an active ADMIN read API** and hardens its filters: valid ordered Bangkok `from/to`, configured GAS station only, tank 1-3 only, seven-business-day default and Bangkok-safe serialization. New SaleFlow, StationContext, Billing and Customer adapters deliberately orchestrate the remaining APIs/data models. UI route retirement must not be coupled to unrelated API deletion.

## Retirement gates

**S44 status (2026-08-27): PASS.** See `FINANCIAL_REGRESSION_CHECKLIST.md`. S70 reran the full financial gate after moving the audited active-GAS price-update UX into canonical Overview: 16 files / 81 tests passed; GAS price/opening/closing/context regression also passed. Remaining active operational/money routes are still eligible only for bounded one-family review.

**S97 canonical browser acceptance (2026-08-29): PASS.** Guarded UAT on a separate Neon host passed 105/105 authenticated ADMIN/STAFF checks across mobile `390x844` and desktop `1440x900`, including canonical FULL/GAS/retired-SIMPLE pages, role boundaries, empty/error states and legacy redirect/query normalization. No HTTP 5xx, runtime exception or fatal console error occurred; temporary S97 fixtures were removed after verification. Physical camera/Epson smoke remains a rollout-day hardware check, not a route-parity blocker.

Before redirecting an **active FULL/GAS** legacy route:

1. Canonical feature parity for that exact route purpose.
2. Permission and retired-station guard verified.
3. S44 financial regression checklist passes where the route can affect money/quantity/date/shift scope.
4. Authenticated smoke test on canonical target.
5. Redirect only one bounded route/family at a time (S45+), preserve read/print compatibility.
6. No database/history deletion as part of a redirect.

## First retirement candidates after gates

1. Retired SIMPLE operational/create family — **S45-S52 complete** for station-2/3/4; S82 retires `shift-history` and S83 retires `meter-summary` after canonical raw-evidence parity. S84 keeps `summary` as ADMIN historical maintenance + read/print/export fallback. S85 keeps `receipt` as bounded print compatibility and hardens station binding/header safety.
2. Active GAS sell entries → canonical sales — **S53 current `/gas/[id]/sell` complete** and **S54 older `/gas-station/[id]/new/sell` complete** for station-5/6.
3. Active FULL sale-entry pair → canonical sales — **S55 `/station/1/new/sell` complete** and **S56 `/station/1/new/oil-sell` complete**.
4. Active FULL operational entries → canonical operations — **S57 `/station/1/new/open-shift`**, **S58 `/station/1/new/close-shift`**, **S59 `/station/1/new/shift-end`**, and **S60 `/station/1/new/meters` complete** after S38-S40 parity/regression.
5. Active FULL navigation shell → canonical workspace — **S61 `/station/1/new/home` complete** and **S96 `/station/1` + `/station/1/v2` retired** after edit/print/audit parity moved to canonical Operations/History; retain only the bounded thermal receipt compatibility route.
6. Active GAS workspace → **S62-S63 open/close canonical**, S64-S67 keep correction/inventory subroutes, S69 tool entry + S70 price + S72 live payment/gauge/alert summary complete; `/gas/5|6` landing is now bounded S73 redirect candidate while its subroutes remain compatibility surfaces.
7. History/summary/receipt routes last, after explicit read/print parity review.

S121 finalizes the S107 `/admin/inventory` and `/admin/low-stock` retirement with redirect-only page files as defense in depth. Their compatibility APIs remain available, but ProductInventory reads/adjustments now fail closed outside stations configured with `hasProducts`; current configured product scope is station-5 only, and unfiltered low-stock reads exclude retired/non-product station inventory rows.

S122 keeps `/admin/dispensers` as the local Dispenser/Nozzle master-data surface because meter reconciliation can consume `MeterReading.nozzleId` -> FuelProduct/PriceBook. It is intentionally separate from `/admin/watchara-dispenser`, which manages an external sales-source integration. Local Dispenser/Nozzle mutations are now ADMIN-only, active-station-only, canonical-ID normalized, FuelProduct validated and atomically audited; retired station master data remains read compatibility only.

S123 keeps `/admin/watchara-dispenser` as a distinct **KEEP_ADMIN_REPORT / integration control-plane** surface. Status/bootstrap/sync now share ADMIN auth and fail-closed inputs; Bootstrap is atomically audited, and a successful real Sync commits local landing-row upserts, source-success metadata and its AuditLog in one bounded transaction after the external fetch completes. External fetch/failure visibility remains outside that local transaction by design.

S124 retires the unreferenced temporary `POST /api/admin/fix-shift` escape hatch. The old route could force-close, hard-delete, or renumber Shift rows and separately close DailyRecord without AuditLog/atomicity. It now performs shared ADMIN auth then returns 410 with the audited GAS Operations, Anti-Fraud and canonical station Operations replacements; no Prisma mutation implementation remains.

S125 retires only the mutation half of `/api/simple-station/[id]/shift-status`. GET remains read compatibility, but POST no longer accepts `force-close`: station-1 legacy callers use canonical Operations and retired station-2/3/4 remain read-only because forecourt work moved to POS. Authorized POST callers receive 410 and no Shift mutation/Audit bypass remains.

S126 retires only the write half of `/api/simple-station/[id]/shift-end`. GET remains historical/read compatibility, while POST no longer invokes `closeFullShift`: station-1 uses canonical Operations and retired station-2/3/4 remain POS/read-only. Authorized POST callers receive 410 and no parallel legacy shift-close contract remains.

S127 supersedes the old note that shared SIMPLE product CRUD remains a write compatibility surface. `GET /api/simple-station/[id]/products` remains station-scoped read compatibility, but POST/PUT/DELETE are retired with 410 after station access because all callers are legacy operational/product pages, station-2/3/4 moved to POS, and station-1 has no product capability. Active product inventory remains canonical station-5 Inventory.

S128 completes the route-level review of legacy `/api/payments` noted in the financial checklist. No internal caller remains; GET/POST now preserve their auth boundaries then return 410. The old non-atomic Payment -> Invoice -> `Owner.currentCredit` mutation chain is removed, and canonical `/api/invoices/[id]/payments` remains the supported optimistic-concurrency payment contract.

S129 retires the unreferenced global `/api/products` GET/POST family after auth. Active Product/ProductInventory ownership is station-scoped canonical station-5 Inventory (`/api/gas-station/5/products`); the old global POST had no station scope/AuditLog and no repo caller. FuelProduct/PriceBook master data is a separate domain and is not retired by S129.

S130 reviews `/api/price-books`, `/api/price-books/[id]`, and `/api/price-books/active` and **keeps them as master-data/API compatibility** because `PriceBookLine` still participates in shift reconciliation. The control plane is now authenticated/station-bounded, validates active FuelProducts/dates/positive unique lines, and performs line-based CREATE/UPDATE/DELETE atomically with AuditLog. The shared PriceBook model also contains scalar `productType/retailPrice/wholesalePrice` records used by `price-service`; line-based mutation APIs explicitly refuse those rows, and S130 does not change reconciliation or scalar price-service semantics.
