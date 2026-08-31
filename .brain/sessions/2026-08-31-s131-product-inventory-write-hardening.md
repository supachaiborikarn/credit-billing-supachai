# S131 — Product Inventory write hardening

Date: 2026-08-31
Branch: redesign/ux-v2
Status: complete and commit-ready.

## Finding
Canonical station-5 Inventory uses `/api/gas-station/5/products` for create/receive/update. The same route still carried dead `sell` and `add_to_inventory` actions, while dedicated `products/add` and `products/sell` endpoints had no repository callers. Remaining canonical writes also mixed transactional and non-transactional mutations and lacked consistent audit coverage.

## Change
- Added `src/services/product-inventory-write-service.ts` with bounded SERIALIZABLE transactions.
- Create: Product + ProductInventory + optional opening ProductReceipt + AuditLog are atomic; missing/disabled DB station fails closed instead of POST-time Station upsert.
- Update: Product.salePrice + ProductInventory.alertLevel + AuditLog are atomic.
- Receive: inventory increment + ProductReceipt + AuditLog are atomic.
- Added strict server validation for names, unit, finite positive prices, integer quantities, alert levels, and safe quantity bounds.
- Numeric parsers accept only numbers or non-empty numeric strings, so booleans cannot become `1`/`0` through coercion.
- Update and receive repeat the database station/product capability check inside the same transaction as the write.
- Retired root `sell`/`add_to_inventory` and duplicate `products/add`/`products/sell` endpoints with authenticated/capability-scoped HTTP 410 responses.
- Kept GET inventory/history and V2 shift-close product stock-count/reconciliation behavior unchanged.

## Final verification
- Targeted: 49/49 passed.
- Post-review focused regression: 22/22 passed.
- Financial/monthly: 101/101 passed.
- Full: 652/652 passed.
- TypeScript, scoped ESLint, diff check passed.
- UAT preflight PASS; confirmed separate production and UAT Neon hosts.
- Production build: 127/127 routes passed.
- Isolated UAT create/update/receive passed with final quantity 5, sale price 23, alert level 2, two receipts and three audit rows.
- Cleanup returned product, inventory, receipt, sale and audit fixture counts to zero.
- Temporary UAT harness removed after recording the durable result.

## Concurrent-work boundary
Do not stage Tank Loy auto-print files or shared `.brain/changelog.md`, `.brain/index.md`, `.brain/topics/bugs-and-fixes.md`, `.brain/topics/station-types.md` hunks with S131.
