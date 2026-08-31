# S133 — Legacy owner/currentCredit admin control-plane retirement

Date: 2026-08-31
Branch: redesign/ux-v2
Status: complete.

## Finding
The legacy admin owner list/edit control plane survived after its UI ownership had already moved to Customers/Billing. `/api/admin/owners` was only called by retired currentCredit-based admin pages, and `/api/admin/owners/[id]` was only called by the retired credit-limit page. The old `credit-service` currentCredit check/update/outstanding helpers had no runtime callers. `Owner.currentCredit` remains explicitly non-authoritative for AR.

## Change
- Retired `GET /api/admin/owners` and `PATCH /api/admin/owners/[id]` after ADMIN auth with HTTP 410 and canonical replacement metadata.
- Kept `/api/admin/owners/merge` because canonical Customers still uses it; no merge semantics changed.
- Added page-level redirects for `/admin/owners` and `/admin/credit-limit` to Customers and `/admin/outstanding` to Billing.
- Changed Sidebar customer navigation to `/customers` and removed the duplicate retired merge menu entry.
- Reduced `credit-service` to a compatibility barrel for monthly Invoice generation; no currentCredit check/update/list helper remains.

## Verification
- Targeted owner/customer/monthly/redirect regression: 106/106.
- Financial/monthly release gate: 101/101.
- Full regression: 672/672 across 90 files.
- TypeScript, scoped ESLint and diff check passed.
- Production build: 127/127 routes passed with `NODE_ENV=production`. Initial build inherited machine-level `NODE_ENV=development` and failed in unrelated prerender pages; no application code change was needed for the successful rerun.

## Concurrent-work boundary
Do not stage Tank Loy auto-print files or shared `.brain/changelog.md`, `.brain/index.md`, `.brain/topics/bugs-and-fixes.md`, `.brain/topics/station-types.md` hunks with S133.
