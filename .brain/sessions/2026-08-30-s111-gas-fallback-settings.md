# S111 — GAS global fallback settings

- Kept `/admin/gas/settings` only for configurable global `gasPrice` fallback.
- Confirmed price priority: DailyRecord -> Station -> gasSettings fallback -> DEFAULT_GAS_PRICE 16.09.
- Removed dead UI/API controls for tankCapacity, tankCount, alertLowGauge and alertCriticalGauge; no runtime caller uses them.
- GET/POST settings are ADMIN-only; only gasPrice accepted, positive bounded validation, 2-decimal normalization, bounded transaction + GasSettings AuditLog.
- Targeted 40/40, financial 101/101, full 503/503, TypeScript/scoped ESLint/diff check, build 127/127.
- Anonymous runtime smoke 307/401; no authenticated UAT or DB write because existing user dev owns `.next` lock.
- No push/deploy and no concurrent Tank Loy auto-print files staged.
