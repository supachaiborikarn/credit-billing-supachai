# S84 — Retired SIMPLE summary policy

- Date: 2026-08-28
- Decision: do not retire SIMPLE summary; it is ADMIN historical maintenance + read/print/export fallback, not read-only.
- Unique legacy capabilities: transaction edit/void, transfer-slip replacement, receipt/credit reprint 58/80 mm, CSV export, daily report print.
- Security hardening: retired station-2/3/4 historical PUT/DELETE is ADMIN-only via central station policy; STAFF UI hides mutation controls but keeps read/print/export.
- UAT isolated fixture without shift: STAFF GET 200 / PUT 403 / DELETE 403; ADMIN PUT 200.
- Financial regression: 16 files / 82 tests; TypeScript/ESLint/diff check pass.
- Next: S85 receipt/thermal print parity audit.
- No production DB write, push or deploy.
