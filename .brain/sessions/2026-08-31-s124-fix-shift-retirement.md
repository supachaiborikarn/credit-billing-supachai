# S124 — Retire temporary fix-shift API

## Finding
`POST /api/admin/fix-shift` was a leftover temporary escape hatch with no internal caller. It could force-close, hard-delete, or renumber shifts and separately close DailyRecord without audit or atomicity.

## Decision
Retire instead of hardening. Existing GAS stale-shift cleanup, Anti-Fraud review/lock, and canonical station Operations are the supported audited workflows.

## Implementation
- keep ADMIN auth boundary with `requireAdminApi()`
- return HTTP 410 with replacement paths
- remove Prisma and all destructive mutation implementation from the route

## Verification
- targeted: 25/25
- financial/monthly: 101/101
- full: 612/612
- TypeScript + scoped ESLint + diff check passed
- production build: 127/127

No push, deploy, production DB write, or Tank Loy staging.
