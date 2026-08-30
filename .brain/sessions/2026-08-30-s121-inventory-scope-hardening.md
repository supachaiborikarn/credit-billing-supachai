# S121 — Inventory scope hardening and retired-page defense

Date: 2026-08-30
Branch: redesign/ux-v2

## Decision
S107 already made canonical `/stations/station-5/inventory` the owner of product inventory UI and retired `/admin/inventory` + `/admin/low-stock`. S121 does not create another inventory flow. It finalizes that retirement and narrows the compatibility API boundary.

## Changes
- Replaced both retired admin client pages with server redirects to canonical station-5 Inventory.
- Added `src/lib/inventory-scope.ts`, deriving allowed ProductInventory station IDs from `STATIONS.hasProducts` (currently `station-5`).
- `GET /api/admin/inventory`, `GET /api/inventory/low-stock`, and `POST /api/admin/inventory/adjust` reject non-product/retired station IDs.
- Global low-stock reads only query configured product-inventory stations.
- `adjustInventory()` itself rejects invalid product stations before opening the Prisma transaction.
- S107 write semantics remain: ADMIN-only, integer nonzero change, 3-200 char reason, non-negative stock, serializable bounded transaction, atomic ADJUST AuditLog, no fake ProductReceipt/ProductSale.

## Verification
- Targeted inventory/service/canonical/redirect: 104/104.
- Financial + monthly release gate: 101/101.
- Full regression: 590/590.
- TypeScript/scoped ESLint/diff check: passed.
- Production build: 127/127 routes.

## Safety
- No production DB write.
- No push/deploy.
- New invalid-station adjustment path fails before Prisma; unchanged valid station-5 write path was already isolated-UAT tested in S107.
- Concurrent Tank Loy auto-print and shared brain working-tree changes were not staged with S121.
