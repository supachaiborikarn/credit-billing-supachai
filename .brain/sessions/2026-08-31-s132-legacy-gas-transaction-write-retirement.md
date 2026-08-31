# S132 — Legacy GAS transaction write retirement

Date: 2026-08-31
Branch: redesign/ux-v2
Status: complete and commit-ready.

## Finding
Canonical GAS SaleFlow uses `/api/v2/gas/[stationId]/sell`, and no active repository caller uses `POST /api/gas-station/[id]/transactions`. The legacy create route performed Station/DailyRecord/Transaction writes separately. Its companion DELETE route updated the Transaction and AuditLog separately without requiring a reason. The only old DELETE caller was an orphaned hook behind retired GAS pages.

## Change
- Legacy GAS transaction POST/DELETE retain station authorization and return HTTP 410 with canonical replacement metadata.
- Both retired routes contain no Prisma write implementation.
- GAS sales retain the canonical `CASH`, `CREDIT`, `CREDIT_CARD`, and `TRANSFER` payment scope.
- Legacy `BOX_TRUCK` and `OIL_TRUCK_SUPACHAI` GAS inputs are intentionally unsupported.
- Legacy per-Transaction `EXPENSE` creation is removed; canonical shift closing/admin historical data entry store aggregate `otherExpensesAmount` reconciliation.
- Retained station-scoped transaction DELETE now requires a trimmed 3-200 character reason.
- Canonical FULL History maintenance and global admin transaction UI collect and send that reason.
- Transaction void state and DELETE AuditLog remain atomic in one Prisma transaction.
- A conditional active-row update prevents repeat/concurrent requests from replacing the original void metadata or creating a second AuditLog; losing requests receive 409.

## Final verification
- Targeted retirement/void/GAS regression: 43/43 passed.
- Financial/monthly release gate: 101/101 passed.
- Full regression: 667/667 passed across 89 files.
- TypeScript and diff check passed.
- Scoped ESLint passed with zero errors and one pre-existing `no-img-element` warning in TransactionCard.
- Production build: 127/127 routes passed.
- No DB/UAT mutation was needed; no production DB write, push or deploy occurred.

## Concurrent-work boundary
Do not stage Tank Loy auto-print files or shared `.brain/changelog.md`, `.brain/index.md`, `.brain/topics/bugs-and-fixes.md`, `.brain/topics/station-types.md` hunks with S132.
