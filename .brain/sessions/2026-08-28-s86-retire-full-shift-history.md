# S86 — Retire FULL shift-history

- Retired `/station/1/new/shift-history` to canonical `/stations/station-1/history`.
- Added active-FULL bounded helper and middleware rule so broad Tank Loy fallback no longer intercepts this route.
- Canonical parity covers opener/closer, duration, meter evidence and adds LOCKED/photos/transaction/reconciliation/anomaly context.
- Regression: 4 files / 151 tests; TypeScript/ESLint/diff check passed.
- Isolated UAT: legacy 307 -> canonical History, target 200, query preserved.
- No write/financial change, no production DB write, no push/deploy.
- Concurrent Tank Loy/shared brain edits remained untouched.

- Final production build with `NODE_ENV=production`: 127/127 routes passed.
