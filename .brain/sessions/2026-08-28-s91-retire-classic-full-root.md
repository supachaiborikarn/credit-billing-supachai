# S91 — Retire classic FULL station root

Date: 2026-08-28
Branch: `redesign/ux-v2`
Base: `e5963e2`

- Audited classic `/station/1` against `/station/1/v2` after S89/S90.
- V2 now covers FULL admin maintenance/reporting: price settings, historical meter/photos, transaction entry/edit/void, transfer proof, receipt/credit print, CSV, daily print, history/audit and bill handling.
- The transaction API auto-creates a Truck when a selected owner uses a new plate; `/trucks` remains the standalone/bulk truck maintenance surface.
- Middleware now redirects exact `/station/1` and the existing `/simple-station/1` alias to V2; query strings and pre-login normalization are preserved.
- Regression: 3 files / 166 tests PASS; TypeScript/ESLint/diff check PASS.
- Production build: 127/127 routes PASS.
- Isolated Neon smoke: classic root 307 -> V2, target 200. No DB write.
- `/station/1/v2` remains KEEP_FULL_ADMIN_COMPAT and receipt remains KEEP_PRINT_COMPAT.
- No push/deploy/production DB write.
