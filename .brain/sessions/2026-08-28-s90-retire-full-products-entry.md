# S90 — Retire FULL products compatibility entry

Date: 2026-08-28
Branch: `redesign/ux-v2`
Base: `7d98f6f`

- Audited FULL `/station/1/new/products`: wrapper was redirect-only and owned no inventory capability.
- Canonical station-1 capability is `hasProducts=false`; Tank Loy product/oil flow had already been retired from sales.
- Normalized `/station/1/new/products` and `/simple-station/1/new/products` to `/stations/station-1` Overview.
- Shared SIMPLE products CRUD/API remains untouched.
- Route/context regression: 3 files / 164 tests PASS; TypeScript/ESLint/diff check PASS.
- Production build: 127/127 routes PASS.
- Isolated Neon smoke: both legacy entries 307 -> canonical Overview; target 200. No DB writes.
- No push/deploy/production DB write.
