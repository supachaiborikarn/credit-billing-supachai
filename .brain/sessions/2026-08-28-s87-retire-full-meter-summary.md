# S87 — Retire FULL meter-summary to canonical History

- Active FULL station-1 only.
- Audited legacy meter-summary as read-only. Reliable parity is raw meter evidence vs persisted transactions; legacy meter-money is derived from hard-coded current/static fuel prices and is not treated as historical truth.
- Added active-FULL meter-summary redirect helper plus page/middleware route to `/stations/station-1/history`.
- Regression: 4 files / 163 tests; TypeScript, targeted ESLint and diff check passed.
- Isolated Neon UAT: legacy 307 to canonical History with query preserved; canonical target 200.
- No financial/write API change; no production DB write; no push/deploy.
- Concurrent Tank Loy/shared brain work intentionally excluded.
- Final production build with `NODE_ENV=production`: 127/127 routes passed.
