# S125 — Retire legacy SIMPLE shift-status force-close

## Finding
The read/write `shift-status` route still let station-access users force-close a Shift directly without AuditLog. All source callers are legacy SIMPLE components; retired station 2/3/4 operational routes already redirect, and station-1 legacy SIMPLE routes normalize to canonical Operations.

## Decision
Keep GET as read compatibility. Retire POST only.

## Implementation
- preserve station-access auth
- POST returns 410 without Prisma mutation
- station-1 replacement = canonical Operations
- retired SIMPLE replacement = canonical History / POS notice

## Verification
- targeted: 220/220
- financial/monthly: 101/101
- full: 615/615
- TypeScript + scoped ESLint + diff check passed
- production build: 127/127

No push, deploy, production DB write, or Tank Loy staging.
