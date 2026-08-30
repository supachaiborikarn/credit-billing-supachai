# S116 — GAS admin dashboard hardening

- KEEP `/admin/gas` as the live GAS operations/admin dashboard.
- Replaced direct raw Transaction/DailyRecord dashboard aggregation with shared GAS shift analytics facts, preserving canonical station IDs, aliases, void/deleted filtering and orphan transaction handling.
- Replaced server-local date mutation with Bangkok business-date window helpers; month subtraction clamps end-of-month.
- Gauge average/low alert now uses the latest reading for each tank 1-3 across canonical + alias IDs using bounded per-tank reads.
- Today/Week/Month selector now switches sales, liters and transaction counts consistently.
- Removed fake all-zero fallback on first-load failure; fatal error has retry, while later refresh failure keeps last successful data visible with warning/retry.
- Passed targeted 16/16, financial 101/101, full 539/539, TypeScript, scoped ESLint, diff-check and production build 127/127 routes.
- Read-only hardening: no DB write, push or deploy. Tank Loy concurrent files were not touched.
