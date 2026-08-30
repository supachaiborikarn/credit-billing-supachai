# S128 — Retire legacy global Invoice payment API

## Finding
`/api/payments` has no repo caller. Its POST was weaker than canonical Billing: Payment creation, Invoice update, and `Owner.currentCredit` reduction happened as separate writes.

## Decision
Retire GET/POST after their existing auth boundaries. Keep `/api/invoices/[id]/payments` as the single supported Invoice payment write path.

## Verification
- targeted: 28/28
- financial/monthly: 101/101
- full: 629/629
- TypeScript + scoped ESLint + diff check passed
- build: 127/127

No push, deploy, production DB write, or Tank Loy staging.
