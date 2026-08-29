# S100 — station-5 products to canonical Inventory

- Canonical `/stations/station-5/inventory` now owns product list/create, initial/received stock, sale-price + alert edits, and recent IN/OUT history; station-6 remains product-disabled.
- `/gas/5/products` and older station-5 product bookmarks redirect to canonical Inventory; legacy source stays in-tree and APIs remain compatibility contracts.
- Removed the read-side-effecting `Station.upsert()` from product GET. Unit regression proves GET is station-scoped and never calls Station upsert.
- Verification: targeted 89/89, financial 90/90, full 409/409, TypeScript/scoped ESLint/diff check, build 127/127.
- Isolated UAT: canonical 200, legacy 307, create/update/receive/history all 200, readback quantity 7 / price 43 / alert 2, station-6 access 403; temporary product/receipts/inventory/session cleaned and port 3005 stopped.
- GAS frontline inventory/recovery migration is now canonical; remaining legacy work is historical/admin/report/master-data. Auto-print hunks excluded. No push/deploy/production DB write.
