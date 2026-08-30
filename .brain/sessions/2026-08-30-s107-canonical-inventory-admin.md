# S107 — Canonical product Inventory admin parity

- Date: 2026-08-30
- Branch: redesign/ux-v2
- Scope: retire `/admin/inventory` + `/admin/low-stock` into station-5 canonical Inventory.
- Unique parity moved: ADMIN manual signed quantity correction with required reason.
- Safety: existing ProductInventory only; integer nonzero change; no negative final stock; bounded serializable transaction; `ADJUST` AuditLog old/new/reason; no write retry; no fake ProductReceipt/ProductSale.
- Low-stock hardening: ADMIN auth, quantity zero included, `alertLevel=0` preserved.
- Routes/nav: both legacy admin pages -> `/stations/station-5/inventory`; one canonical Sidebar entry. `/admin/transactions` deliberately remains separate KEEP_ADMIN_REPORT.
- Gates: targeted 123/123; financial+monthly 101/101; full 472/472; TypeScript/ESLint/diff check pass; production build 127/127.
- Isolated UAT: canonical 200; legacy 307; low-stock anonymous 401 / STAFF 403 / ADMIN 200 with zero-stock fixture; STAFF adjust 403; ADMIN +5 0->5 audited; receipt/sale 0/0; overdraw -6 -> 400 and quantity stayed 5; cleanup product/inventory/audit/users = 0.
- Port 3005 stopped; port 3000 untouched. No push/deploy/production DB write.
- Tank Loy auto-print/shared-brain concurrent files excluded.
