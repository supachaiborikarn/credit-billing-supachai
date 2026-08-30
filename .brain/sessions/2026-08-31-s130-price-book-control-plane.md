# S130 — Harden and KEEP PriceBook control plane

## Finding
PriceBook has two record shapes in one model: scalar `productType/retailPrice/wholesalePrice` rows used by `price-service`, and line-based PriceBook/PriceBookLine rows used by nozzle-linked reconciliation. HTTP callers are absent, but the data domain is not dead.

## Decision
KEEP the PriceBook API/master-data family and harden it. Do not retire based only on HTTP caller search, and do not alter scalar price-service or reconciliation price priority.

## Changes
- authenticated active read, STAFF station scope
- canonical station validation; new books only global or active station 1/5/6
- strict real dates, ordered interval, 1-100 unique lines, positive finite prices, active FuelProduct validation
- bounded atomic CREATE/UPDATE/DELETE + AuditLog
- atomic line replacement
- fail closed on scalar price-service rows

## Verification
- targeted 39/39
- financial/monthly 101/101
- full 644/644
- TypeScript + scoped ESLint + diff check passed
- build 127/127

No push, deploy, production DB write, live PriceBook mutation, or Tank Loy staging.
