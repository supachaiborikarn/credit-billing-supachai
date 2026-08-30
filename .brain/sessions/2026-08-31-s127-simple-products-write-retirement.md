# S127 — Retire legacy SIMPLE product mutations

## Finding
The SIMPLE products API still provided create/update/delete even though all UI callers are legacy retired operational surfaces. Station 2/3/4 moved to POS; station-1 has no product inventory capability.

## Decision
Keep GET read compatibility. Retire POST/PUT/DELETE and leave station-5 canonical Inventory as the active product-stock write domain.

## Verification
- targeted: 229/229
- financial/monthly: 101/101
- full: 624/624
- TypeScript + scoped ESLint + diff check passed
- build: 127/127

No push, deploy, production DB write, or Tank Loy staging.
