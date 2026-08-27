# Credit Billing — Route Migration Plan

> Source of truth for S03 + S37. Redesign is incremental: keep legacy compatibility until feature parity + financial regression, except operational create routes for business-retired SIMPLE stations (station-2/3/4).

## Canonical destinations

| Domain | Canonical route |
| --- | --- |
| Work queue | `/today` |
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
- **KEEP_READ_COMPAT** — keep for historical/receipt/summary/print compatibility until the canonical read path proves parity.
- **KEEP_MASTER_DATA** — still contains create/edit administration not yet moved into Customer 360.
- **KEEP_ADMIN_REPORT** — admin/reporting tool; not part of the first station-route retirement wave.
- **API_COMPAT** — do not redirect API routes; new adapters intentionally call existing APIs until backend migration is a separate verified change.

## FULL — legacy `/station/[id]`

Applicable active station: `station-1`.

| Legacy route | Future route | Disposition | Notes |
| --- | --- | --- | --- |
| `/station/1` | `/stations/station-1` | KEEP_FULL_ADMIN_COMPAT | Classic page is admin-only and still owns direct transaction/daily-record correction and report actions; do not retire yet. |
| `/station/1/v2` | `/stations/station-1` | KEEP_FULL_ADMIN_COMPAT | V2 still owns admin settings, transaction edit/delete, print, history/audit and historical meter correction; keep as explicit fallback. |
| `/station/1/new/home` | `/stations/station-1` | **S61 IMPLEMENTED** | Old navigation entry now redirects directly to canonical Station Overview; no unique capability lived in this route. |
| `/station/1/new/sell` | `/stations/station-1/sales` | **S55 IMPLEMENTED** | Direct canonical SaleFlow redirect; V2 remains a supported operational workspace. |
| `/station/1/new/oil-sell` | `/stations/station-1/sales` | **S56 IMPLEMENTED** | Direct canonical SaleFlow redirect; prior route was redirect-only because Tank Loy has no engine-oil/product flow. |
| `/station/1/new/open-shift` | `/stations/station-1/operations` | **S57 IMPLEMENTED** | Direct canonical Operations redirect after S38-S40 parity + operational/financial regression; canonical opening preserves daily-price + shift APIs and requires 4 start meters with photos before sale. |
| `/station/1/new/close-shift` | `/stations/station-1/operations` | **S58 IMPLEMENTED** | Direct canonical Operations redirect after S39 closing/reconciliation parity + operational/financial regression; legacy APIs/history preserved. |
| `/station/1/new/shift-end` | `/stations/station-1/operations` | **S59 IMPLEMENTED** | Direct canonical Operations redirect after S39 closing/reconciliation parity; legacy APIs/read compatibility preserved. |
| `/station/1/new/meters` | `/stations/station-1/operations` | **S60 IMPLEMENTED** | Direct canonical Operations redirect; legacy route was redirect-only to `/new/shift-end`, so no standalone meter capability is removed. |
| `/station/1/new/meter-summary` | `/stations/station-1/history` | KEEP_READ_COMPAT | Historical meter evidence. |
| `/station/1/new/shift-history` | `/stations/station-1/history` | KEEP_READ_COMPAT | S40 must prove parity. |
| `/station/1/new/summary` | `/stations/station-1/history` | KEEP_READ_COMPAT | Daily/shift summary. |
| `/station/1/new/list` | `/stations/station-1/history` | KEEP_READ_COMPAT | Transaction/list compatibility. |
| `/station/1/new/record` | `/stations/station-1/history` | KEEP_READ_COMPAT | Historical entry/detail compatibility. |
| `/station/1/new/receipt` | canonical history/detail | KEEP_READ_COMPAT | Preserve receipt/print behavior. |
| `/station/1/new/products` | future station operations | KEEP_UNTIL_S38_S40 | Do not invent product parity in main fuel flow. |

## GAS — current legacy `/gas/[stationId]`

Applicable active stations: station numbers `5`, `6` (legacy URL parameters may be numeric or aliases depending on route).

| Legacy route | Future route | Disposition | Notes |
| --- | --- | --- | --- |
| `/gas/5`, `/gas/6` | `/stations/station-5`, `/stations/station-6` | KEEP_UNTIL_S38_S40 | Current GAS operations landing. |
| `/gas/5/sell`, `/gas/6/sell` | `/stations/station-5/sales`, `/stations/station-6/sales` | **S53 IMPLEMENTED** | Server-side redirect to canonical SaleFlow; legacy source preserved in `LegacyGasSellPage.tsx`. |
| `/gas/[id]/shift/open` | `/stations/station-[id]/operations` | **S62 IMPLEMENTED** | station-5/6 redirect to canonical Operations. Canonical uses the same atomic GAS open API with price + 4 meters + 3 gauges and derives next shift from actual business-day shifts. |
| `/gas/[id]/shift/close` | `/stations/station-[id]/operations` | **S63 IMPLEMENTED** | station-5/6 redirect to canonical Closing after parity guard. Canonical saves end meters + gauges, then uses the same GAS close/reconciliation API; legacy source preserved. |
| `/gas/[id]/meters` | future canonical recovery/correction | **KEEP_GAS_CORRECTION (S64 REVIEWED)** | Keep: legacy page can safely correct START baselines while server lock allows it, and can save standalone END readings. Canonical Operations handles normal atomic opening/closing but does not yet expose this recovery/correction capability. |
| `/gas/[id]/gauge` | future canonical recovery/correction | **KEEP_GAS_CORRECTION (S65 REVIEWED)** | Keep: supports guarded START-gauge correction while baseline lock allows it plus standalone END-gauge save/retry; canonical normal open/close does not yet expose equivalent recovery UI. |
| `/gas/[id]/supplies` | future inventory/operations domain | **KEEP_GAS_INVENTORY (S66 REVIEWED)** | Keep: records LPG deliveries with liters, supplier, invoice, cost, notes, audit log, date filtering and supply history. Canonical shift Operations has no equivalent receive-stock workflow. |
| `/gas/5/products` | future inventory/master-data domain | **KEEP_GAS_INVENTORY (S67 REVIEWED)** | Keep: create product, receive stock, edit sale price/alert level and view IN/OUT history. Legacy GET also upserts Station, so do not reuse it as a canonical read model without cleanup. |
| `/gas/[id]/summary` | `/stations/station-[id]/history` | KEEP_READ_COMPAT | S40 must prove summary parity. |

## GAS — older `/gas-station/[id]/new/*`

These are an older GAS route family. Do not remove by naming alone; some links/bookmarks may still exist.

| Legacy route family | Future route | Disposition |
| --- | --- | --- |
| `/gas-station/[id]` | `/stations/station-[id]` | KEEP_UNTIL_S38_S40 |
| `/gas-station/[id]/new`, `/new/home` | `/stations/station-[id]` | KEEP_UNTIL_S38_S40 |
| `/gas-station/[id]/new/sell` | `/stations/station-[id]/sales` | **S54 IMPLEMENTED** |
| `/gas-station/[id]/new/meters` | `/stations/station-[id]/operations` | KEEP_UNTIL_S38_S40 |
| `/gas-station/[id]/new/supplies` | future operations/history | KEEP_UNTIL_S38_S40 |
| `/gas-station/[id]/new/products` | future operations | KEEP_UNTIL_S38_S40 |
| `/gas-station/[id]/new/summary`, `/new/shift-summary`, `/new/monthly-balance` | `/stations/station-[id]/history` | KEEP_READ_COMPAT |

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

- `/simple-station/[id]/new/shift-history`
- `/simple-station/[id]/new/meter-summary`
- `/simple-station/[id]/new/summary`
- `/simple-station/[id]/new/receipt`

Disposition: **KEEP_READ_COMPAT** → eventual `/stations/station-[id]/history` or canonical transaction/receipt detail after parity.

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

**S44 status (2026-08-27): PASS.** See `FINANCIAL_REGRESSION_CHECKLIST.md`. S63 reran the full financial gate after GAS `/gas/5|6/shift/close` direct-canonical Operations retirement changes: 16 files / 81 tests passed; GAS closing/opening/context regression also passed. Remaining active operational/money routes are still eligible only for bounded one-family review.

Before redirecting an **active FULL/GAS** legacy route:

1. Canonical feature parity for that exact route purpose.
2. Permission and retired-station guard verified.
3. S44 financial regression checklist passes where the route can affect money/quantity/date/shift scope.
4. Authenticated smoke test on canonical target.
5. Redirect only one bounded route/family at a time (S45+), preserve read/print compatibility.
6. No database/history deletion as part of a redirect.

## First retirement candidates after gates

1. Retired SIMPLE operational/create family — **S45-S52 complete** for station-2/3/4; read/history/receipt compatibility remains.
2. Active GAS sell entries → canonical sales — **S53 current `/gas/[id]/sell` complete** and **S54 older `/gas-station/[id]/new/sell` complete** for station-5/6.
3. Active FULL sale-entry pair → canonical sales — **S55 `/station/1/new/sell` complete** and **S56 `/station/1/new/oil-sell` complete**.
4. Active FULL operational entries → canonical operations — **S57 `/station/1/new/open-shift`**, **S58 `/station/1/new/close-shift`**, **S59 `/station/1/new/shift-end`**, and **S60 `/station/1/new/meters` complete** after S38-S40 parity/regression.
5. Active FULL navigation shell → canonical overview — **S61 `/station/1/new/home` complete**; keep `/station/1` and `/station/1/v2` as admin compatibility workspaces until their remaining edit/print/audit capabilities move.
6. Active GAS shift operations → canonical operations — **S62 `/gas/5|6/shift/open`** and **S63 `/gas/5|6/shift/close` complete**; keep meters/gauge/supplies/products as separate bounded reviews.
7. History/summary/receipt routes last, after explicit read/print parity review.
