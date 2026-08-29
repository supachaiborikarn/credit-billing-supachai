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
| `/gas/[id]/meters` | future canonical recovery/correction | **KEEP_GAS_CORRECTION (S64 REVIEWED)** | Keep: legacy page can safely correct START baselines while server lock allows it, and can save standalone END readings. Canonical Operations handles normal atomic opening/closing but does not yet expose this recovery/correction capability. |
| `/gas/[id]/gauge` | future canonical recovery/correction | **KEEP_GAS_CORRECTION (S65 REVIEWED)** | Keep: supports guarded START-gauge correction while baseline lock allows it plus standalone END-gauge save/retry; canonical normal open/close does not yet expose equivalent recovery UI. |
| `/gas/[id]/supplies` | future inventory/operations domain | **KEEP_GAS_INVENTORY (S66 REVIEWED)** | Keep: records LPG deliveries with liters, supplier, invoice, cost, notes, audit log, date filtering and supply history. Canonical shift Operations has no equivalent receive-stock workflow. |
| `/gas/5/products` | future inventory/master-data domain | **KEEP_GAS_INVENTORY (S67 REVIEWED)** | Keep: create product, receive stock, edit sale price/alert level and view IN/OUT history. Legacy GET also upserts Station, so do not reuse it as a canonical read model without cleanup. |
| `/gas/6/products` | `/stations/station-6` | **S81 CAPABILITY GUARD** | station-6 has `hasProducts=false`. Direct UI/bookmark now redirects to canonical Overview; product APIs already enforce `requireGasProductsEnabled`. |
| `/gas/[id]/summary` | `/stations/station-[id]` | **S80 IMPLEMENTED for station-5/6** | Active current summary UI now redirects to canonical Overview after S79 parity. Middleware/login preserve query and normalize unauthenticated bookmarks; legacy UI source is retained as fallback. `GET /api/v2/gas/[stationId]/summary` remains a required read API for canonical live summary and closing flow. |

## GAS — older `/gas-station/[id]/new/*`

These are an older GAS route family. Do not remove by naming alone; some links/bookmarks may still exist.

| Legacy route family | Future route | Disposition |
| --- | --- | --- |
| `/gas-station/[id]` | `/stations/station-[id]` | **S74 IMPLEMENTED for station-5/6** |
| `/gas-station/[id]/new`, `/new/home` | `/stations/station-[id]` | **S74 IMPLEMENTED for station-5/6** |
| `/gas-station/[id]/new/sell` | `/stations/station-[id]/sales` | **S54 IMPLEMENTED** |
| `/gas-station/[id]/new/meters` | `/gas/[id]/meters` guarded correction | **S75 CONFIRMED COMPAT MAPPING** |
| `/gas-station/[id]/new/supplies` | `/gas/[id]/supplies` LPG inventory | **S76 CONFIRMED COMPAT MAPPING** |
| `/gas-station/[id]/new/products` | station-5 → `/gas/5/products`; station-6 → canonical overview | **S77 CAPABILITY MAPPING FIXED** |
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
- `/simple-station/[id]/new/summary` — **KEEP_HISTORICAL_MAINTENANCE (S84 REVIEWED)**. It owns transaction-level edit, void, transfer-slip replacement, receipt/credit reprint (58/80 mm), CSV export and daily report print. Canonical History is intentionally read-only and has no parity for these actions. S84 hardens retired station-2/3/4 mutations to ADMIN-only while STAFF keeps read/print/export access.
- `/simple-station/[id]/new/receipt` — **KEEP_PRINT_COMPAT (S85 REVIEWED)**. This route remains the receipt/credit reprint surface for Epson TM-m30III and browser print, supports 58/80 mm, original + copy, and credit signature lines. S85 binds transaction URLs to the transaction station, selects print config from `transaction.stationId`, and fails closed for station-3 because its previous config incorrectly reused the Supachai header and no verified Ponganan address/phone exists in repo history.

Disposition: `shift-history` retired in S82 and `meter-summary` retired in S83 after raw-evidence parity. `summary` is **KEEP_HISTORICAL_MAINTENANCE** after S84 audit. `receipt` is **KEEP_PRINT_COMPAT** after S85 audit; station-3 historical receipt printing stays fail-closed until a verified legal/header config is supplied.

## Billing routes

| Legacy route | Canonical | Disposition |
| --- | --- | --- |
| `/invoices`, `/admin/invoices` | `/billing` | KEEP_READ_COMPAT until write/admin parity is signed off |
| `/invoices/[id]` | `/billing/[id]?kind=INVOICE` | KEEP_READ_COMPAT; canonical receive-payment exists but legacy remains fallback |
| `/billing-collections` | `/billing` | KEEP_READ_COMPAT |
| `/billing-collections/[id]` | `/billing/[id]?kind=BILLING_COLLECTION` | KEEP_READ_COMPAT; slip verify/reject admin workflow still exists in legacy |
| `/admin/generate-invoices` | future Billing action | KEEP_ADMIN_REPORT |
| `/admin/outstanding`, `/admin/credit-limit` | Billing/Customer 360 | KEEP_ADMIN_REPORT until explicit parity |

## Customer/master-data routes

| Legacy route | Canonical | Disposition |
| --- | --- | --- |
| `/owners` | `/customers` | KEEP_MASTER_DATA — legacy still owns create/edit/deactivate/add-truck operations |
| `/admin/owners` | `/customers` / settings | KEEP_MASTER_DATA |
| `/trucks` | `/customers/[id]` / master data | KEEP_MASTER_DATA |

Customer 360 is currently the read/workspace surface; do not redirect master-data writes until their actions are migrated with permission checks.

## Admin/report routes

`/admin/full/*`, `/admin/gas/*`, `/admin/gas-control/*`, `/admin/simple/*`, `/admin/transactions`, anomaly/reconciliation/inventory/report pages remain **KEEP_ADMIN_REPORT** unless a later task explicitly proves canonical parity. Retired SIMPLE admin history/report data remains readable; only front-line operational create entry is retired.

## APIs

All `/api/station/*`, `/api/v2/gas/*`, `/api/simple-station/*`, invoice/payment, billing-collection and other legacy APIs are **API_COMPAT** for now. New SaleFlow, StationContext, Billing and Customer adapters deliberately orchestrate these APIs/data models. UI route retirement must not be coupled to API deletion.

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
