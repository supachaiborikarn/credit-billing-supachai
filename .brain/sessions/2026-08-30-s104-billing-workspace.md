# S104 — Canonical Billing workspace

Date: 2026-08-30

## Result
- Retired ordinary `/invoices`, `/admin/invoices`, `/billing-collections` and BillingCollection detail into canonical `/billing`.
- Kept `/invoices/[id]` only as verified print compatibility.
- Canonical ADMIN now owns Invoice create/unpaid-delete, manual BillingCollection create and pending-slip verify/reject/delete; STAFF remains read-only.
- Unsafe cross-owner combined Invoice mode is rejected; multi-owner selection creates separate owner-scoped documents.
- Invoice and BillingCollection document writes are audited, bounded serializable transactions; no write retry.
- Export is authenticated and document numbering uses Bangkok date.

## Verification
- Targeted S104 gate: 96/96 + TypeScript + scoped ESLint + diff check.
- Financial release gate: 91/91.
- Full regression: 441/441.
- Production build: 127/127 routes.
- Isolated UAT: reads 200/200, STAFF writes 403, unsafe combine 400, Invoice create/delete/payment guard, print/export, Collection create and slip verify/reject/delete all passed.
- Cleanup: S104 Owner/Transaction/Invoice/BillingCollection/Audit = 0; port 3005 stopped; port 3000 untouched.

## Compatibility left intentionally
- `/invoices/[id]`: KEEP_PRINT_COMPAT.
- `/admin/generate-invoices`, `/admin/outstanding`, `/admin/credit-limit`: separate admin/report work; not retired in S104.
- Tank Loy auto-print/shared-brain concurrent work was not staged or modified for S104.
- No push, deploy or production DB write.
