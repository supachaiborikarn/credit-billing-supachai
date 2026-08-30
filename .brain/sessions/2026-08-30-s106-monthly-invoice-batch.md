# S106 — Monthly Invoice batch -> canonical Billing

- Date: 2026-08-30
- Branch: redesign/ux-v2
- Scope: move monthly Invoice batch UI into canonical Billing and harden batch financial linkage.
- Legacy findings: owner selection used drift-prone currentCredit; source query did not require invoiceId=null; created Invoice did not connect source transactions.
- Canonical result: /admin/generate-invoices -> /billing?batch=monthly; ADMIN-only API retained.
- Safety: CREDIT_PAYMENT_TYPES + Bangkok month, unbilled/non-void rows only, bounded serializable per-owner write, in-transaction total recompute + source connect + CREATE AuditLog, same-period duplicate skip by full Bangkok due-date day (covers legacy UTC midnight), no write retry.
- Gates: targeted 109/109; expanded financial+batch 101/101; full 458/458; TypeScript/ESLint/diff check pass; production build 127/127.
- Isolated UAT: period 12/2099, canonical 200, legacy/unauth 307, STAFF 403, first batch 1 created and linked/audited with currentCredit=0, second batch skipped and duplicate count=1, cleanup Owner/Transaction/Invoice/User/Station=0. Separate 12/2098 compatibility UAT with existing dueDate 2099-01-15T00:00:00Z returned created=0/skipped=1 and kept Invoice count=1.
- UAT harness note: first attempt failed before batch write on relative Location URL parsing; cleanup succeeded. Assertion-only fix reran the same app code successfully.
- No push, no deploy, no production DB write.
- Tank Loy auto-print/shared-brain concurrent files excluded from this scope.
