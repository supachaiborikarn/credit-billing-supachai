# S115 — GAS Executive Billing buckets

- KEEP both GAS Executive surfaces: `/admin/gas/executive` is live management; `/admin/gas/reports/executive` is date-range A4 print.
- Found live Executive AR still using drift-prone `Owner.currentCredit` despite S105 retiring that source.
- Added shared `buildBillingOutstandingSummary()` and wired canonical `/api/billing` plus GAS Executive to separate `waitingToBill`, `invoiceOutstanding`, and `collectionOutstanding` buckets.
- Executive UI removed combined outstanding and Top-5 legacy debtors; it now labels three buckets separately to avoid double counting.
- Passed targeted 19/19, financial 101/101, full 534/534, TypeScript, scoped ESLint and diff-check.
- Production build task `e4b6eb07-9569-4fb8-ae38-307d550712d6` completed with exit 0: 127/127 routes.
- No push/deploy/DB write. Tank Loy concurrent files were not touched.
