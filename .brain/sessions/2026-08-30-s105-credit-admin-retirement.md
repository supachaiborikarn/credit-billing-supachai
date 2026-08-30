# S105 — Legacy credit admin retirement

Date: 2026-08-30

## Decision
- Retired `/admin/outstanding` to `/billing`; the old view depends on drift-prone `Owner.currentCredit`, while canonical Billing derives and displays debt by real source.
- Retired `/admin/credit-limit` to `/customers`; Customer 360 already owns ADMIN credit-limit edits and clearly labels legacy currentCredit.
- Removed duplicate sidebar entries.
- Kept `/admin/generate-invoices` because monthly/batch invoice generation is a separate workflow not replaced by ordinary S104 creation.

## Verification
- Targeted middleware/Billing/Customer: 93/93.
- Financial release gate: 91/91.
- Full regression: 445/445.
- TypeScript/scoped ESLint/diff check and production build 127/127 passed.
- No UAT DB write, push, deploy or production DB write.
- Tank Loy auto-print/shared brain work remains outside this change.
