# S129 — Retire global Product API

## Finding
`/api/products` has no repository caller. Its POST could create a Product outside station inventory ownership and without AuditLog.

## Decision
Retire GET/POST after existing auth. Station-5 canonical Inventory remains the active supplemental Product domain.

## Verification
- targeted: 30/30
- financial/monthly: 101/101
- full: 633/633
- TypeScript + scoped ESLint + diff check passed
- build: 127/127

No push, deploy, production DB write, or Tank Loy staging.
