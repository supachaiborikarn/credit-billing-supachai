# S99 — GAS supplies to canonical Inventory

- Added canonical `/stations/station-5|6/inventory`; GAS Overview now sends LPG receiving there and legacy current/older supplies bookmarks redirect with auth/query preservation.
- Canonical Inventory reuses the existing station-scoped v2 supplies GET/POST, keeps date-filtered history + summary, and keeps writes blocked while StationContext is stale/error.
- No schema or financial model changed; POST still creates `GasSupply` + `AuditLog` using existing normalization and station access guard.
- Verification: targeted 90/90, financial 90/90, full 407/407, TypeScript/scoped ESLint/diff check, production build 127/127.
- Isolated UAT: station-5 STAFF canonical page 200, legacy redirect 307, create/readback 200, AuditLog present, cross-station station-6 403; fixture/audit/session cleaned and port 3005 stopped.
- Station-5 products remain compatibility for S100. Tank Loy auto-print files/hunks were excluded. No push/deploy/production DB write.
