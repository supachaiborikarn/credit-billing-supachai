# Watchara Shared Dispenser AI Handoff

อัปเดตล่าสุด: 2026-04-18

## Current Stage

งานนี้อยู่ที่สถานะ:

- Wave 1 complete: schema + sync + status + bootstrap + admin UI
- Wave 2 complete for simple admin only: merged operational reporting เข้าหน้า simple admin 4 จุดแล้ว
- Wave 3 complete:
  - global reporting
  - executive additive merge
  - CSV export alignment
- Wave 4 core service alignment complete:
  - anomaly / reconciliation services patched
  - still needs cautious user validation before production push
- Push-hardening pass complete:
  - admin pages now have a server-side admin layout guard
  - high-risk admin/write APIs touched by this rollout and related close/report flows now require session/admin/station access
  - upload endpoints now require login and image/size validation
- Full legacy write API auth sweep complete:
  - quick scan now reports `NO_UNGUARDED_WRITE_ROUTES`
  - legacy gas-station/simple-station/invoice/payment/owner/truck/product/price-book/dispenser write APIs now require session/admin/station access as appropriate
  - cross-station resource checks were added for inventory, shift, dispenser, and nozzle mutations

## What Was Implemented

### Wave 1 landing + sync

- Prisma models:
  - `external_sales_sources`
  - `external_dispenser_transactions`
- Sync/status/bootstrap:
  - `src/lib/watchara-dispenser-utils.ts`
  - `src/lib/watchara-dispenser-client.ts`
  - `src/lib/watchara-dispenser-sync.ts`
  - `src/app/api/admin/watchara-dispenser/status/route.ts`
  - `src/app/api/admin/watchara-dispenser/sync/route.ts`
  - `src/app/api/admin/watchara-dispenser/bootstrap/route.ts`
  - `src/app/admin/watchara-dispenser/page.tsx`

### External data state

- `WATCHARA_DISPENSER_DATABASE_URL` ถูกตั้งใน local `.env.local` แล้ว
- external source confirmed:
  - total rows = `4954`
  - transaction date range = `2025-12-03` to `2026-03-14`
  - latest row update = `2026-03-23T07:12:43.882Z`
- local landing state after backfill:
  - imported rows = `4954`
  - distinct `externalTxId = 4954`
  - `lastSyncedAt = 2026-04-18T11:27:20.384Z`
  - `lastSeenSourceAt = 2026-03-14T11:01:05.000Z`
  - `lastError = null`

### Wave 2 merged simple admin reporting

Shared helper:

- `src/lib/operational-sales.ts`

Helper responsibilities:

- read internal POS transactions
- read Watchara external landing rows from local DB
- merge only for local target `station-2`
- normalize diesel labels so internal/external land in the same bucket
- group by Bangkok date/hour
- expose `watcharaExternal` status payload for UI/debug

Patched API routes:

- `src/app/api/v2/simple/admin/overview/route.ts`
- `src/app/api/v2/simple/admin/analytics/route.ts`
- `src/app/api/v2/simple/admin/stations/route.ts`
- `src/app/api/v2/simple/admin/fuel-time/route.ts`

Patched UI pages:

- `src/app/admin/simple/page.tsx`
- `src/app/admin/simple/analytics/page.tsx`
- `src/app/admin/simple/stations/page.tsx`
- `src/app/admin/simple/fuel-time/page.tsx`
- `src/components/WatcharaExternalStatusBanner.tsx`

### Wave 3 global reporting

Patched routes/pages:

- `src/app/api/reports/route.ts`
- `src/app/reports/page.tsx`
- `src/app/api/dashboard/executive/route.ts`
- `src/app/dashboard/executive/page.tsx`
- `src/app/api/export/csv/route.ts`

Wave 3 design choice:

- `reports` route merges Watchara into sales report types:
  - `daily`
  - `monthly`
  - `station`
- `executive` does not overwrite meter/reconciliation KPIs
- instead it adds:
  - `operational_sales`
  - `watcharaExternal`
  - per-station `operational_sales`

### Wave 4 core service alignment

Patched services:

- `src/services/daily-anomaly-detection.ts`
- `src/services/shift-reconciliation.ts`
- `src/services/shift-service.ts`

Wave 4 design choice:

- external source is treated as synthetic daily operational contribution
- to avoid false variance, external values are added to both sides:
  - anomaly: add external liters to both meter-side and transaction-side totals
  - reconciliation: add external revenue to expected fuel amount and received payment buckets

### Push-readiness hardening

Added:

- `src/lib/api-auth.ts`
- `src/app/admin/layout.tsx`

Patched high-risk routes:

- `/admin` page tree now requires real ADMIN session server-side
- `src/middleware.ts` includes `/admin` in protected page routes
- users/settings/admin maintenance APIs require admin
- station transaction create/list/bulk/edit/void require station access
- gas v2 sell/open/close requires station access
- upload APIs require session, image MIME, and 8 MB max size
- billing collection destructive/verification APIs require session/admin as appropriate
- LINE webhook fails closed if `LINE_CHANNEL_SECRET` is missing
- transaction edit/void audit writes are now in the same DB transaction as the data change

## Important Behavior

- Merge scope is intentionally narrow:
  - only `station-2`
  - only operational sales totals for simple admin
  - no write-back into `transactions`
- `watcharaExternal` is an additive field in the patched API responses
- UI now shows a banner when the current page/range includes `station-2`
- If the source is stale, the banner warns instead of silently pretending the data is fresh
- export route for sales report types now uses the same merged dataset as the report UI
- export date for merged rows now uses `dateKey` / business day, not raw `soldAt`
- Shift reconciliation applies Watchara external rows only to the synthetic final-shift case:
  - configured final shift via `STATION_STAFF[stationId].maxShifts`
  - or latest historical shift when no higher shift exists
  - not current-day non-final shifts
- Full write-route auth sweep is complete for this pass
  - previous quick audit count: `43` unauthenticated write routes before hardening
  - after first push-hardening pass: `28`
  - after final legacy sweep: `NO_UNGUARDED_WRITE_ROUTES`
  - note: this scan checks obvious write-route auth guards; it is not a formal penetration test

## Important Caveats

- Source is stale right now:
  - latest sold transaction = `2026-03-14`
  - latest businessDate in local landing = `2026-03-13`
  - today in this session = `2026-04-18`
- Because of that:
  - simple overview "today / this month" will not visibly increase yet
  - analytics last-month comparison can show merged March impact
  - stations/fuel-time only show merged impact when the selected range reaches back into March
- `topCustomers` in `analytics` remains internal POS only
  - external source has no owner/customer data
  - route returns `topCustomersScope = internal_pos_only`
- Do not confuse `soldAt` with report day
  - Watchara source anchors day via `daily_records.date`
  - merged reporting/export/reconciliation in this rollout intentionally use business day semantics
- Existing persisted `shift_reconciliations` rows were not backfilled or recalculated automatically
  - new calculations use the patched logic
  - old saved reconciliation records may still reflect pre-Watchara totals until explicitly recalculated/saved
- `WATCHARA_DISPENSER_DATABASE_URL` exists only in local `.env.local` right now
  - production/staging must be configured separately
  - never commit the credential
- Security note:
  - legacy write-route auth sweep is complete by static scan
  - remaining audit work should focus on business authorization depth, rate limiting, CSRF strategy, and secret/env hygiene

## Smoke-Test Result

Helper smoke-tested against the project DB after implementation:

- query range: `2026-03-01` to `2026-04-18`
- station ids: `station-2`, `station-3`, `station-4`
- merged rows = `579`
- merged totals:
  - liters = `139028.36899999998`
  - revenue = `4316559.085099999`
  - transactions = `579`
- Watchara external contribution in that range:
  - rows = `214`
  - liters = `91738.239`
  - revenue = `2872279.0697000003`

Additional smoke tests:

- `reports` route:
  - `GET /api/reports?type=daily&startDate=2026-03-01&endDate=2026-03-14`
  - returned `watcharaExternal.rowsInRange = 214`
- `executive` route:
  - `GET /api/dashboard/executive?date=2026-03-13`
  - returned external contribution:
    - amount = `19741.75`
    - liters = `564.05`
- `export` route:
  - `GET /api/export/csv?type=daily&startDate=2026-03-13&endDate=2026-03-13`
  - first merged rows now export as `2026-03-13` business date
- Wave 4 reconciliation:
  - real `station-2` day on `2026-03-13`
  - `shift-service.calculateReconciliation()` => `variance = 0`, `GREEN`
  - `shift-reconciliation.calculateForShift()` => `variance = 0`, `GREEN`

## Verification Already Run

- `npx prisma generate`
- `npx prisma db push`
- `npx tsc --noEmit`
- `npx eslint ...` on the modified Wave 2 files
- `npx eslint ...` on the push-hardening files
- `npx eslint ...` on the final legacy auth-sweep files
- `npx vitest run tests/env.test.ts tests/watchara-dispenser-sync.test.ts tests/operational-sales.test.ts`
- `npm run build`

## Tests Added

- `tests/operational-sales.test.ts`

Coverage of the new test file:

- diesel label normalization
- inclusive date-key range generation
- daily merged totals
- Bangkok-hour grouping
- fuel bucket merge behavior

## What Is Still Not Done

Do not assume the rollout is fully business-validated just because the code paths and auth guards exist. These are still pending:

1. Validate daily numbers on at least one known March day end-to-end with business owner
2. Validate close-shift flow in UI for station-2 on a representative historical day or staging day
3. Decide whether to expose more explicit business-date labels in UI
4. Decide whether to optimize sync throughput
   - current backfill path still upserts one row at a time
5. Decide whether old saved `shift_reconciliations` need a controlled recalculation/backfill

## Safe Next Step

The safest next implementation move is:

1. Run user validation on March 13 / March 14 examples with owner/team
2. Confirm the synthetic final-shift behavior in the UI, not only through service smoke tests
3. Configure production/staging env vars only after validation
4. Only after that consider push/deploy

## Do Not Forget

- Do not push credentials; `WATCHARA_DISPENSER_DATABASE_URL` is local-only in `.env.local`
- Do not merge external rows into the canonical `transactions` table
- Do not treat this as production-complete until user validation is done
