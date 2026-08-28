# S85 — Receipt / thermal print compatibility audit

- Receipt stays KEEP_PRINT_COMPAT: Epson TM-m30III / browser fallback, 58/80 mm, original+copy, receipt/credit + signatures remain unique legacy capability.
- Hardened transaction detail GET/PUT/DELETE so route station must match transaction.stationId; prevents wrong-station receipt branding/bookmark misuse.
- Receipt page now derives header from transaction.stationId.
- Removed unsafe station-3 receipt header that incorrectly duplicated Supachai station-4. No verified Ponganan Petroleum address/phone exists in repo/history, so station-3 printing fails closed until admin supplies verified header data.
- Tests: thermal + station-context 9/9; TypeScript/ESLint/diff check passed.
- UAT temporary Neon: station-2 transaction correct GET 200; wrong station-3 GET/PUT/DELETE 404; source transaction unchanged.
- No production write, push or deploy.
