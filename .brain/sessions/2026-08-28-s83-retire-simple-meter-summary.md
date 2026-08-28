# S83 — Retire retired-SIMPLE meter-summary

- Date: 2026-08-28
- Scope: station-2/3/4 retired SIMPLE meter-summary only.
- Legacy audit: meter revenue/fuel grouping uses hard-coded prices; station-3 falls back to station-2 config, so that money calculation is not historical source of truth.
- Canonical parity: raw meter liters, transaction liters/count/amount, explicit meter-minus-transaction difference, date-preserving query initialization.
- Route: retired SIMPLE meter-summary redirects to canonical History; FULL legacy source remains isolated.
- Targeted regression: 4 files / 137 tests; TypeScript/ESLint/diff check pass.
- UAT: station 2/3/4 redirect 307 with date preserved, canonical targets 200; station-1 History data 10 L meter / 10 L transaction / 313.40 amount / 0 L difference.
- No production DB write, push or deploy.
- Next: S84 audit retired SIMPLE summary; keep receipt until explicit print parity.
