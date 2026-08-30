# S113 — Harden and KEEP GAS gauge history

- Kept `/admin/gas/gauge`: unique per-tank opening/closing history, tank filter and CSV remain useful.
- Kept `/admin/gas/supplies`: cross-station cost, gauge verification, forecast and audited edit/delete are not yet canonical Inventory parity.
- Hardened `GET /api/v2/gas/admin/gauge` with ADMIN guard, 7-business-day default, strict Bangkok date ordering, configured-GAS station validation, exact tank 1-3 validation and Bangkok-safe response dates.
- Targeted 37/37; financial 101/101; full 517/517; TypeScript/scoped ESLint/diff check passed; production build 127/127.
- Read-only phase: no UAT/production DB write, push or deploy. Concurrent Tank Loy/shared-brain files remain unstaged.
